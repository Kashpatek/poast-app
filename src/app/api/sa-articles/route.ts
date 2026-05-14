// Pulls the latest SemiAnalysis articles from the public Substack RSS
// feed. Used by Distribution Pack so the user picks a freshly-published
// article without having to paste a URL.
//
// Substack ships every newsletter site with:
//   https://<sub>.substack.com/feed
//   https://<sub>.<customdomain>/feed
// SA's feed lives at https://newsletter.semianalysis.com/feed

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;
export const revalidate = 300; // 5 min cache

interface Article {
  title: string;
  subtitle?: string;
  url: string;
  pubDate: string;
  authors?: string[];
  coverImage?: string;
  isPaid?: boolean;
}

const FEED_URL = "https://newsletter.semianalysis.com/feed";

// Cheap inline RSS parser — no xml2js dep needed. Substack feeds are
// well-formed and predictable.
function parseFeed(xml: string): Article[] {
  const items: Article[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[1];
    items.push({
      title: pick(block, "title") || "",
      subtitle: pickDescription(block),
      url: pick(block, "link") || "",
      pubDate: pick(block, "pubDate") || "",
      authors: pickAuthors(block),
      coverImage: pickCoverImage(block),
      isPaid: /<paid>true<\/paid>|<isPaid>true<\/isPaid>/i.test(block),
    });
  }
  return items;
}

function pick(block: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i");
  const m = block.match(re);
  if (!m) return undefined;
  return decodeEntities(m[1].trim());
}

function pickDescription(block: string): string | undefined {
  // Substack puts the subtitle in <description> as plain text and the body
  // in <content:encoded>. We want the subtitle/dek for the post format.
  const desc = pick(block, "description");
  if (!desc) return undefined;
  // Strip HTML tags from description in case Substack ever wraps it.
  const text = desc.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text || undefined;
}

function pickAuthors(block: string): string[] | undefined {
  const out: string[] = [];
  const re = /<dc:creator>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/dc:creator>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    const name = decodeEntities(m[1].trim());
    if (name) out.push(name);
  }
  return out.length ? out : undefined;
}

function pickCoverImage(block: string): string | undefined {
  // Substack drops an <enclosure url="..."> for cover images.
  const enc = block.match(/<enclosure[^>]*url=["']([^"']+)["']/i);
  if (enc) return enc[1];
  // Fallback: pull the first <img src=...> inside content:encoded.
  const ce = pick(block, "content:encoded") || pick(block, "content");
  if (ce) {
    const img = ce.match(/<img[^>]*src=["']([^"']+)["']/i);
    if (img) return img[1];
  }
  return undefined;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export async function GET(req: NextRequest) {
  const limit = Math.max(1, Math.min(20, Number(req.nextUrl.searchParams.get("limit") || "10")));
  try {
    const res = await fetch(FEED_URL, {
      headers: { "User-Agent": "POAST-distribution-pack/1.0" },
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Feed fetch failed: " + res.status }, { status: 502 });
    }
    const xml = await res.text();
    const articles = parseFeed(xml).slice(0, limit);
    return NextResponse.json({ articles, ts: Date.now(), source: FEED_URL });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
