import { NextRequest, NextResponse } from "next/server";

// RSS parser helper
async function fetchRSS(url: string) {
  try {
    const r = await fetch(url, { next: { revalidate: 300 } });
    const xml = await r.text();
    const items: Array<{title: string; link: string; date: string; source: string; snippet: string}> = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1];
      const title = (block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/) || [])[1] || "";
      const link = (block.match(/<link>(.*?)<\/link>/) || [])[1] || "";
      const pubDate = (block.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || "";
      const desc = (block.match(/<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/) || [])[1] || "";
      const snippet = desc.replace(/<[^>]*>/g, "").slice(0, 200);
      items.push({ title, link, date: pubDate, source: "", snippet });
    }
    return items.slice(0, 15);
  } catch {
    return [];
  }
}

// Stock data from Yahoo Finance (no API key needed)
async function fetchStocks(symbols: string[]) {
  const results: Array<{symbol: string; price: number; change: number; changePct: number}> = [];
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(",")}`;
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 30 },
    });
    const data = await r.json();
    const quotes = data?.quoteResponse?.result || [];
    for (const q of quotes) {
      results.push({
        symbol: q.symbol,
        price: q.regularMarketPrice || 0,
        change: q.regularMarketChange || 0,
        changePct: q.regularMarketChangePercent || 0,
      });
    }
  } catch {
    // If Yahoo fails, return empty -- client will show stale data
  }
  return results;
}

// SemiAnalysis-relevant stock tickers
const SA_STOCKS = [
  "NVDA", "AMD", "INTC", "TSM", "AVGO", "MRVL",
  "ASML", "AMAT", "LRCX", "KLAC", "MU", "QCOM",
  "ARM", "SMCI", "NBIS", "GOOG", "MSFT", "AMZN",
];

const NEWS_FEEDS = [
  { url: "https://semianalysis.com/feed", source: "SemiAnalysis" },
  { url: "https://www.anandtech.com/rss/", source: "AnandTech" },
  { url: "https://techcrunch.com/category/artificial-intelligence/feed/", source: "TechCrunch AI" },
  { url: "https://feeds.arstechnica.com/arstechnica/technology-lab", source: "Ars Technica" },
  { url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", source: "The Verge AI" },
  { url: "https://news.ycombinator.com/rss", source: "Hacker News" },
];

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type");

  if (type === "stocks") {
    const stocks = await fetchStocks(SA_STOCKS);
    return NextResponse.json({ stocks, ts: Date.now() });
  }

  if (type === "semianalysis") {
    const items = await fetchRSS("https://semianalysis.com/feed");
    items.forEach(i => { i.source = "SemiAnalysis"; });
    return NextResponse.json({ items, ts: Date.now() });
  }

  // Default: aggregate all news feeds
  const allItems: Array<{title: string; link: string; date: string; source: string; snippet: string}> = [];
  const feedResults = await Promise.allSettled(
    NEWS_FEEDS.map(async (f) => {
      const items = await fetchRSS(f.url);
      items.forEach(i => { i.source = f.source; });
      return items;
    })
  );
  for (const r of feedResults) {
    if (r.status === "fulfilled") allItems.push(...r.value);
  }
  // Sort by date descending
  allItems.sort((a, b) => {
    const da = new Date(a.date).getTime() || 0;
    const db = new Date(b.date).getTime() || 0;
    return db - da;
  });

  return NextResponse.json({ items: allItems.slice(0, 50), ts: Date.now() });
}
