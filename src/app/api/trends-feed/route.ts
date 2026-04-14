import { type NextRequest, NextResponse } from "next/server";

// ═══ TYPES ═══

interface TrendItem {
  title: string;
  url: string;
  metric: string;
  timestamp: string;
  tags: string[];
}

interface SourceResult {
  source: string;
  color: string;
  icon: string;
  items: TrendItem[];
}

interface SourceError {
  source: string;
  error: string;
}

type SourceResponse = SourceResult | SourceError;

// ═══ CACHE (30 min TTL) ═══

const CACHE_TTL = 30 * 60 * 1000;
const cache = new Map<string, { data: SourceResult; ts: number }>();

function getCached(key: string): SourceResult | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key: string, data: SourceResult) {
  cache.set(key, { data, ts: Date.now() });
}

// ═══ HELPERS ═══

function abortable(ms = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timeout) };
}

function xmlText(block: string, tag: string): string {
  const re = new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`);
  return (block.match(re) || [])[1]?.trim() || "";
}

// ═══ SOURCE FETCHERS ═══

async function fetchGoogle(): Promise<SourceResult> {
  const cached = getCached("google");
  if (cached) return cached;

  const { signal, clear } = abortable();
  const res = await fetch("https://trends.google.com/trending/rss?geo=US", {
    signal,
    headers: { "User-Agent": "Mozilla/5.0 (compatible; TrendsFeed/1.0)" },
  });
  clear();
  const xml = (await res.text()).slice(0, 500_000);

  const items: TrendItem[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRe.exec(xml)) !== null) {
    const block = match[1];
    const title = xmlText(block, "title");
    const link = xmlText(block, "link");
    const traffic = xmlText(block, "ht:approx_traffic") || xmlText(block, "ht:picture_news_item");
    const pubDate = xmlText(block, "pubDate");
    if (title) {
      items.push({
        title,
        url: link,
        metric: traffic || "Trending",
        timestamp: pubDate || new Date().toISOString(),
        tags: ["trending"],
      });
    }
  }

  const result: SourceResult = {
    source: "google",
    color: "#4285F4",
    icon: "G",
    items: items.slice(0, 20),
  };
  setCache("google", result);
  return result;
}

async function fetchYouTube(): Promise<SourceResponse> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return { source: "youtube", error: "API key not configured" };

  const cached = getCached("youtube");
  if (cached) return cached;

  const { signal, clear } = abortable();
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=US&videoCategoryId=28&maxResults=10&key=${key}`;
  const res = await fetch(url, { signal });
  clear();
  const data = await res.json();

  const items: TrendItem[] = (data.items || []).map(
    (v: { id: string; snippet: { title: string; publishedAt: string; channelTitle: string }; statistics: { viewCount?: string } }) => ({
      title: v.snippet.title,
      url: `https://www.youtube.com/watch?v=${v.id}`,
      metric: v.statistics.viewCount
        ? `${Number(v.statistics.viewCount).toLocaleString()} views`
        : "Trending",
      timestamp: v.snippet.publishedAt,
      tags: ["tech", "video", v.snippet.channelTitle],
    })
  );

  const result: SourceResult = {
    source: "youtube",
    color: "#FF0000",
    icon: "YT",
    items,
  };
  setCache("youtube", result);
  return result;
}

async function fetchNews(): Promise<SourceResponse> {
  const key = process.env.NEWS_API_KEY;
  if (!key) return { source: "news", error: "API key not configured" };

  const cached = getCached("news");
  if (cached) return cached;

  const { signal, clear } = abortable();
  const url = `https://newsapi.org/v2/top-headlines?category=technology&country=us&pageSize=10&apiKey=${key}`;
  const res = await fetch(url, { signal });
  clear();
  const data = await res.json();

  const items: TrendItem[] = (data.articles || []).map(
    (a: { title: string; url: string; publishedAt: string; source: { name: string } }) => ({
      title: a.title,
      url: a.url,
      metric: a.source?.name || "News",
      timestamp: a.publishedAt || new Date().toISOString(),
      tags: ["tech", "news"],
    })
  );

  const result: SourceResult = {
    source: "news",
    color: "#333333",
    icon: "N",
    items,
  };
  setCache("news", result);
  return result;
}

async function fetchApplePodcasts(): Promise<SourceResult> {
  const cached = getCached("apple-podcasts");
  if (cached) return cached;

  const { signal, clear } = abortable();
  const res = await fetch(
    "https://rss.applemarketingtools.com/api/v2/us/podcasts/top/25/podcasts.json",
    { signal }
  );
  clear();
  const data = await res.json();

  const items: TrendItem[] = (data.feed?.results || []).map(
    (p: { name: string; url: string; artistName: string; releaseDate?: string }, i: number) => ({
      title: p.name,
      url: p.url,
      metric: `#${i + 1} Top Podcasts`,
      timestamp: p.releaseDate || new Date().toISOString(),
      tags: ["podcast", p.artistName],
    })
  );

  const result: SourceResult = {
    source: "apple-podcasts",
    color: "#FC3C44",
    icon: "AP",
    items,
  };
  setCache("apple-podcasts", result);
  return result;
}

async function fetchAppleMusic(): Promise<SourceResult> {
  const cached = getCached("apple-music");
  if (cached) return cached;

  const { signal, clear } = abortable();
  const res = await fetch(
    "https://rss.applemarketingtools.com/api/v2/us/music/most-played/25/songs.json",
    { signal }
  );
  clear();
  const data = await res.json();

  const items: TrendItem[] = (data.feed?.results || []).map(
    (s: { name: string; url: string; artistName: string; releaseDate?: string }, i: number) => ({
      title: `${s.name} - ${s.artistName}`,
      url: s.url,
      metric: `#${i + 1} Most Played`,
      timestamp: s.releaseDate || new Date().toISOString(),
      tags: ["music", s.artistName],
    })
  );

  const result: SourceResult = {
    source: "apple-music",
    color: "#FC3C44",
    icon: "AM",
    items,
  };
  setCache("apple-music", result);
  return result;
}

async function fetchReddit(): Promise<SourceResult> {
  const cached = getCached("reddit");
  if (cached) return cached;

  const subs = ["technology", "artificial"];
  const allItems: TrendItem[] = [];

  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      const { signal, clear } = abortable();
      const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=10`, {
        signal,
        headers: {
          "User-Agent": "TrendsFeed/1.0 (server-side aggregator)",
        },
      });
      clear();
      const data = await res.json();
      return (data.data?.children || []).map(
        (c: { data: { title: string; permalink: string; score: number; created_utc: number; link_flair_text?: string; subreddit: string } }) => ({
          title: c.data.title,
          url: `https://reddit.com${c.data.permalink}`,
          metric: `${c.data.score.toLocaleString()} upvotes`,
          timestamp: new Date(c.data.created_utc * 1000).toISOString(),
          tags: ["reddit", `r/${c.data.subreddit}`, c.data.link_flair_text].filter(Boolean) as string[],
        })
      );
    })
  );

  for (const r of results) {
    if (r.status === "fulfilled") allItems.push(...r.value);
  }

  const result: SourceResult = {
    source: "reddit",
    color: "#FF4500",
    icon: "R",
    items: allItems,
  };
  setCache("reddit", result);
  return result;
}

async function fetchSpotify(): Promise<SourceResponse> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return { source: "spotify", error: "API key not configured" };

  const cached = getCached("spotify");
  if (cached) return cached;

  // Get access token
  const { signal: tokenSignal, clear: clearToken } = abortable(5000);
  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    signal: tokenSignal,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: "grant_type=client_credentials",
  });
  clearToken();
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;

  if (!accessToken) return { source: "spotify", error: "Failed to authenticate with Spotify" };

  // Fetch podcast categories
  const { signal, clear } = abortable();
  const catRes = await fetch(
    "https://api.spotify.com/v1/browse/categories?locale=en_US&limit=20",
    {
      signal,
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  clear();
  const catData = await catRes.json();

  const items: TrendItem[] = (catData.categories?.items || []).map(
    (c: { name: string; href: string; id: string; icons: Array<{ url: string }> }) => ({
      title: c.name,
      url: `https://open.spotify.com/genre/${c.id}`,
      metric: "Browse Category",
      timestamp: new Date().toISOString(),
      tags: ["spotify", "category"],
    })
  );

  const result: SourceResult = {
    source: "spotify",
    color: "#1DB954",
    icon: "S",
    items,
  };
  setCache("spotify", result);
  return result;
}

// ═══ SOURCE REGISTRY ═══

const FETCHERS: Record<string, () => Promise<SourceResponse>> = {
  google: fetchGoogle,
  youtube: fetchYouTube,
  news: fetchNews,
  "apple-podcasts": fetchApplePodcasts,
  "apple-music": fetchAppleMusic,
  reddit: fetchReddit,
  spotify: fetchSpotify,
};

// ═══ HANDLER ═══

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get("source") || "all";

  try {
    if (source !== "all") {
      const fetcher = FETCHERS[source];
      if (!fetcher) {
        return NextResponse.json(
          { error: `Unknown source: ${source}. Valid: ${Object.keys(FETCHERS).join(", ")}, all` },
          { status: 400 }
        );
      }
      const data = await fetcher();
      return NextResponse.json({ ...data, ts: Date.now() });
    }

    // Fetch all sources in parallel
    const results = await Promise.allSettled(
      Object.values(FETCHERS).map((fn) => fn())
    );

    const sources: SourceResponse[] = results.map((r, i) => {
      const name = Object.keys(FETCHERS)[i];
      if (r.status === "fulfilled") return r.value;
      return { source: name, error: r.reason?.message || "Fetch failed" };
    });

    return NextResponse.json({ sources, ts: Date.now() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
