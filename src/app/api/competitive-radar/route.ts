import { NextRequest, NextResponse } from "next/server";
import Parser from "rss-parser";
import { callLLM, llmTextOf, LLMError, type LLMProvider } from "@/lib/llm-provider";

// Competitive Radar feed.
//
// Pulls a fixed set of competitor outlet RSS feeds, picks items from
// the last 24h, then asks the LLM (one call per item) for a one-line
// "SemiAnalysis angle" each. Per-item angles are cached in Supabase
// under the `trends` table with id `competitive-radar-cache` so the
// LLM doesn't get re-asked for the same link on every poll.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RadarItem {
  source: string;
  title: string;
  link: string;
  time: string;       // ISO date
  saAngle: string;
}

interface FeedSpec {
  source: string;
  url: string;
}

const FEEDS: FeedSpec[] = [
  { source: "Stratechery", url: "https://stratechery.com/feed/" },
  // The Information has no public RSS — see task notes.
  { source: "Asianometry", url: "https://www.asianometry.com/rss/" },
  { source: "Doomberg", url: "https://doomberg.substack.com/feed" },
  { source: "Lex Fridman", url: "https://lexfridman.com/feed/podcast/" },
  { source: "Acquired", url: "https://feeds.transistor.fm/acquired" },
];

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const CACHE_ID = "competitive-radar-cache";
const CACHE_TABLE = "trends";

// Cache row stored as a single record in `trends`. Map from item link
// to its generated SA angle so duplicates are skipped.
interface CacheRow {
  id: string;
  type?: string;
  angles?: Record<string, string>;
  updated_at?: number;
}

function pickSnippet(content: string | undefined, contentSnippet: string | undefined): string {
  const raw = contentSnippet || content || "";
  // Strip any residual tags + collapse whitespace, then clip.
  return raw.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 360);
}

// Forward the caller's session cookie — same-origin route-to-route fetches that
// re-enter the access gate and would otherwise be 401'd (dead cache).
async function readCache(origin: string, cookie: string): Promise<Record<string, string>> {
  try {
    const r = await fetch(`${origin}/api/db?table=${CACHE_TABLE}&id=${CACHE_ID}`, { cache: "no-store", headers: { cookie } });
    if (!r.ok) return {};
    const d = (await r.json()) as { data?: CacheRow };
    return d.data?.angles || {};
  } catch {
    return {};
  }
}

async function writeCache(origin: string, angles: Record<string, string>, cookie: string): Promise<void> {
  try {
    const row: CacheRow = { id: CACHE_ID, type: "radar-cache", angles, updated_at: Date.now() };
    await fetch(`${origin}/api/db`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ table: CACHE_TABLE, data: row }),
    });
  } catch {
    /* cache write best-effort */
  }
}

async function pullFeed(feed: FeedSpec, cutoff: number): Promise<Array<{ source: string; title: string; link: string; time: string; snippet: string }>> {
  const parser = new Parser({ timeout: 6000 });
  try {
    const f = await parser.parseURL(feed.url);
    const out: Array<{ source: string; title: string; link: string; time: string; snippet: string }> = [];
    for (const it of f.items || []) {
      const dateStr = it.isoDate || it.pubDate || "";
      const ts = dateStr ? new Date(dateStr).getTime() : NaN;
      if (Number.isFinite(ts) && ts < cutoff) continue;
      const title = (it.title || "").trim();
      const link = (it.link || it.guid || "").trim();
      if (!title || !link) continue;
      out.push({
        source: feed.source,
        title,
        link,
        time: dateStr || new Date().toISOString(),
        snippet: pickSnippet(it.content, it.contentSnippet),
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function generateAngle(
  raw: { source: string; title: string; snippet: string },
  provider: LLMProvider,
): Promise<string> {
  try {
    const r = await callLLM({
      provider,
      system:
        "You are the SemiAnalysis editorial strategist. Given a competitor outlet's headline plus a snippet, propose the SemiAnalysis angle: the specific, technical, supply-chain-or-capex framing that SA would use that the competitor missed. Respond with one sentence only, plain text, no preamble, no quotes, no em dashes.",
      prompt: `Source: ${raw.source}
Headline: ${raw.title}
Snippet: ${raw.snippet || "(no snippet)"}

One-sentence SemiAnalysis angle:`,
      maxTokens: 120,
    });
    return llmTextOf(r).trim().replace(/^["']|["']$/g, "").slice(0, 280);
  } catch {
    return "";
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { provider?: LLMProvider; sources?: string[] };
    const provider: LLMProvider = body.provider || "claude";

    const filterSources = Array.isArray(body.sources) && body.sources.length
      ? new Set(body.sources)
      : null;
    const activeFeeds = filterSources
      ? FEEDS.filter((f) => filterSources.has(f.source))
      : FEEDS;

    const origin = req.nextUrl.origin;
    const cookie = req.headers.get("cookie") || "";
    const cutoff = Date.now() - ONE_DAY_MS;

    // Pull every feed in parallel — failures don't break the rest.
    const pulled = await Promise.all(activeFeeds.map((f) => pullFeed(f, cutoff)));
    let raw = pulled.flat();
    raw.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    raw = raw.slice(0, 20);

    const cache = await readCache(origin, cookie);
    const items: RadarItem[] = [];
    const cacheUpdates: Record<string, string> = {};

    for (const r of raw) {
      const cached = cache[r.link];
      let saAngle = cached;
      if (!saAngle) {
        saAngle = await generateAngle({ source: r.source, title: r.title, snippet: r.snippet }, provider);
        if (saAngle) cacheUpdates[r.link] = saAngle;
      }
      items.push({
        source: r.source,
        title: r.title,
        link: r.link,
        time: r.time,
        saAngle: saAngle || "Angle pending — regenerate to retry.",
      });
    }

    if (Object.keys(cacheUpdates).length) {
      // Trim the cache to the 200 most recent links to avoid unbounded growth.
      const merged = { ...cache, ...cacheUpdates };
      const trimmed: Record<string, string> = {};
      const keys = Object.keys(merged).slice(-200);
      for (const k of keys) trimmed[k] = merged[k];
      await writeCache(origin, trimmed, cookie);
    }

    return NextResponse.json({
      items,
      provider,
      sources: activeFeeds.map((f) => f.source),
      ts: Date.now(),
    });
  } catch (e) {
    if (e instanceof LLMError) {
      return NextResponse.json({ error: e.message, provider: e.provider }, { status: e.status });
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
