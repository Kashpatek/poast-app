// RSS feed loader for the Production Studio RSS Manager. Fetches the
// raw XML server-side (avoids browser CORS) then parses it with
// rss-parser. Returns a normalized shape the client can render
// without further massaging.

import { NextRequest, NextResponse } from "next/server";
import Parser from "rss-parser";

export const maxDuration = 30;

interface FeedItemOut {
  id: string;
  title: string;
  pubDate: string;
  isoDate: string;
  duration: string;
  link: string;
  description: string;
}

interface FeedRespOk {
  ok: true;
  valid: true;
  title: string;
  description: string;
  feedUrl: string;
  lastBuildDate: string;
  itemCount: number;
  latestEpisodeDate: string;
  imageUrl: string;
  items: FeedItemOut[];
  httpStatus: number;
}

interface FeedRespErr {
  ok: false;
  valid: false;
  error: string;
  httpStatus?: number;
}

function clean(s: string | undefined | null): string {
  return (s || "").toString().trim();
}

function formatDuration(raw: unknown): string {
  if (!raw) return "—";
  const s = String(raw).trim();
  if (!s) return "—";
  // iTunes duration can come as "HH:MM:SS", "MM:SS", or plain seconds.
  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10);
    if (!Number.isFinite(n)) return "—";
    const h = Math.floor(n / 3600);
    const m = Math.floor((n % 3600) / 60);
    const sec = n % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    return `${m}:${String(sec).padStart(2, "0")}`;
  }
  return s;
}

export async function POST(req: NextRequest) {
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    const err: FeedRespErr = { ok: false, valid: false, error: "Invalid JSON" };
    return NextResponse.json(err, { status: 400 });
  }
  const url = clean(body.url);
  if (!url) {
    const err: FeedRespErr = { ok: false, valid: false, error: "Missing feed URL" };
    return NextResponse.json(err, { status: 400 });
  }

  let httpStatus = 0;
  let xml = "";
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 PoastRSSManager/1.0" },
      cache: "no-store",
    });
    httpStatus = res.status;
    if (!res.ok) {
      const err: FeedRespErr = {
        ok: false,
        valid: false,
        error: `Feed responded with HTTP ${res.status}`,
        httpStatus,
      };
      return NextResponse.json(err, { status: 502 });
    }
    xml = await res.text();
  } catch (e) {
    const err: FeedRespErr = { ok: false, valid: false, error: `Fetch failed: ${String(e)}` };
    return NextResponse.json(err, { status: 502 });
  }

  type ItunesItemFields = { itunes?: { duration?: string; image?: string; summary?: string } };
  const parser = new Parser<Record<string, unknown>, ItunesItemFields>({
    customFields: { item: [["itunes:duration", "itunes"]] },
  });

  try {
    const feed = await parser.parseString(xml);
    const items: FeedItemOut[] = (feed.items || []).map((it, idx) => ({
      id: clean(it.guid) || clean(it.link) || `item-${idx}`,
      title: clean(it.title) || "(untitled)",
      pubDate: clean(it.pubDate),
      isoDate: clean(it.isoDate),
      duration: formatDuration(it.itunes?.duration),
      link: clean(it.link),
      description: clean(it.contentSnippet || it.summary || it.itunes?.summary || ""),
    }));

    const latest = items.find((i) => !!i.isoDate)?.isoDate || items[0]?.pubDate || "";
    const out: FeedRespOk = {
      ok: true,
      valid: true,
      title: clean(feed.title) || "(unnamed feed)",
      description: clean(feed.description),
      feedUrl: clean(feed.feedUrl) || url,
      lastBuildDate: clean((feed as Record<string, unknown>).lastBuildDate as string),
      itemCount: items.length,
      latestEpisodeDate: latest,
      imageUrl: clean(feed.image?.url),
      items,
      httpStatus,
    };
    return NextResponse.json(out);
  } catch (e) {
    const err: FeedRespErr = {
      ok: false,
      valid: false,
      error: `Parse failed: ${String(e)}`,
      httpStatus,
    };
    return NextResponse.json(err, { status: 502 });
  }
}
