import { NextRequest, NextResponse } from "next/server";
import { safeFetch } from "@/lib/safe-fetch";

// ═══ METASCRAPER (server-only) ═══
// metascraper relies on a cheerio + a stack of rule bundles. We import lazily
// inside the handler so the module graph doesn't try to bundle these for any
// edge/preview environment that doesn't need them, and so the cold-start cost
// is paid only on the routes that actually call this.
//
// Rules installed: title, description, image, url (per task spec).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let scraperPromise: Promise<(opts: { html: string; url: string }) => Promise<any>> | null = null;

async function getScraper() {
  if (!scraperPromise) {
    scraperPromise = (async () => {
      const createMetascraper = (await import("metascraper")).default;
      const title = (await import("metascraper-title")).default;
      const description = (await import("metascraper-description")).default;
      const image = (await import("metascraper-image")).default;
      const url = (await import("metascraper-url")).default;
      return createMetascraper([title(), description(), image(), url()]);
    })();
  }
  return scraperPromise;
}

export async function POST(req: NextRequest) {
  let body: { url?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const target = (body.url || "").trim();
  if (!target || !/^https?:\/\//i.test(target)) {
    return NextResponse.json({ error: "Provide a fully-qualified http(s) URL." }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const r = await safeFetch(target, {
      signal: controller.signal,
      headers: {
        // Some sites gate on UA — mimic a regular browser.
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      // Light cache so quick re-fetches don't hammer remote hosts.
      next: { revalidate: 300 },
    });
    clearTimeout(timeout);
    if (!r.ok) {
      return NextResponse.json({ error: `Upstream ${r.status} ${r.statusText}` }, { status: 502 });
    }
    // Cap HTML read to 1MB — metascraper only cares about <head>.
    const html = (await r.text()).slice(0, 1_000_000);

    const scraper = await getScraper();
    const meta = await scraper({ html, url: target });

    return NextResponse.json({
      title: meta.title || "",
      description: meta.description || "",
      image: meta.image || "",
      url: meta.url || target,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: "Scrape failed: " + msg }, { status: 500 });
  }
}
