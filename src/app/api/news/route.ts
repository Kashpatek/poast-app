import { NextRequest, NextResponse } from "next/server";

// ═══ RSS PARSER ═══
async function fetchRSS(url: string, source: string, category: string) {
  try {
    const r = await fetch(url, { next: { revalidate: 15 } });
    const xml = await r.text();
    const items: Array<{title: string; link: string; date: string; source: string; category: string; snippet: string}> = [];
    // Handle both <item> and <entry> (Atom feeds)
    const itemRegex = /<(?:item|entry)>([\s\S]*?)<\/(?:item|entry)>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1];
      const title = (block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/) || [])[1] || "";
      const link = (block.match(/<link>(.*?)<\/link>/) || block.match(/<link[^>]*href="([^"]*)"/) || [])[1] || "";
      const pubDate = (block.match(/<pubDate>(.*?)<\/pubDate>/) || block.match(/<published>(.*?)<\/published>/) || block.match(/<updated>(.*?)<\/updated>/) || [])[1] || "";
      const desc = (block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/) || block.match(/<summary>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/) || [])[1] || "";
      const snippet = desc.replace(/<[^>]*>/g, "").replace(/&[^;]+;/g, " ").trim().slice(0, 200);
      if (title) items.push({ title, link, date: pubDate, source, category, snippet });
    }
    return items.slice(0, 20);
  } catch {
    return [];
  }
}

// ═══ STOCK DATA (client-friendly endpoint) ═══
async function fetchStocks(symbols: string[]) {
  const results: Array<{symbol: string; price: number; change: number; changePct: number; name: string}> = [];
  // Use multiple sources for reliability
  try {
    // Try Finnhub-style (free, no key for basic)
    const promises = symbols.map(async (sym) => {
      try {
        const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1d`, {
          headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
          next: { revalidate: 15 },
        });
        const d = await r.json();
        const meta = d?.chart?.result?.[0]?.meta;
        if (meta) {
          const price = meta.regularMarketPrice || 0;
          const prevClose = meta.previousClose || meta.chartPreviousClose || price;
          const change = price - prevClose;
          const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;
          return { symbol: sym, price, change, changePct, name: meta.shortName || sym };
        }
      } catch { /* skip */ }
      return null;
    });
    const res = await Promise.allSettled(promises);
    for (const r of res) {
      if (r.status === "fulfilled" && r.value) results.push(r.value);
    }
  } catch { /* empty fallback */ }
  return results;
}

// ═══ EARNINGS CALENDAR (hardcoded + computed) ═══
function getEarnings() {
  // Major semiconductor earnings dates (approximate Q2 2026)
  const earnings = [
    { symbol: "NVDA", name: "NVIDIA", date: "2026-05-28", time: "after" },
    { symbol: "AMD", name: "AMD", date: "2026-05-06", time: "after" },
    { symbol: "INTC", name: "Intel", date: "2026-04-24", time: "after" },
    { symbol: "TSM", name: "TSMC", date: "2026-04-17", time: "before" },
    { symbol: "AVGO", name: "Broadcom", date: "2026-06-12", time: "after" },
    { symbol: "MRVL", name: "Marvell", date: "2026-05-29", time: "after" },
    { symbol: "ASML", name: "ASML", date: "2026-04-16", time: "before" },
    { symbol: "MU", name: "Micron", date: "2026-06-25", time: "after" },
    { symbol: "QCOM", name: "Qualcomm", date: "2026-05-07", time: "after" },
    { symbol: "ARM", name: "Arm Holdings", date: "2026-05-14", time: "after" },
    { symbol: "SMCI", name: "Super Micro", date: "2026-05-06", time: "after" },
    { symbol: "GOOG", name: "Alphabet", date: "2026-04-29", time: "after" },
    { symbol: "MSFT", name: "Microsoft", date: "2026-04-29", time: "after" },
    { symbol: "AMZN", name: "Amazon", date: "2026-05-01", time: "after" },
    { symbol: "AMAT", name: "Applied Materials", date: "2026-05-15", time: "after" },
    { symbol: "LRCX", name: "Lam Research", date: "2026-04-23", time: "after" },
    { symbol: "KLAC", name: "KLA Corp", date: "2026-04-28", time: "after" },
    { symbol: "NBIS", name: "Nebius", date: "2026-05-22", time: "before" },
  ];
  return earnings.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// ═══ CONFIG ═══
const SA_STOCKS = [
  "NVDA", "AMD", "INTC", "TSM", "AVGO", "MRVL",
  "ASML", "AMAT", "LRCX", "KLAC", "MU", "QCOM",
  "ARM", "SMCI", "NBIS", "GOOG", "MSFT", "AMZN",
];

const NEWS_FEEDS = [
  // Semiconductors & Hardware
  { url: "https://semianalysis.substack.com/feed", source: "SemiAnalysis", category: "Semiconductors" },
  { url: "https://www.tomshardware.com/feeds/all", source: "Tom's Hardware", category: "Hardware" },
  { url: "https://videocardz.com/feed", source: "VideoCardz", category: "GPUs" },
  { url: "https://www.servethehome.com/feed/", source: "ServeTheHome", category: "Data Center" },
  { url: "https://www.nextplatform.com/feed/", source: "Next Platform", category: "Data Center" },
  // AI & ML
  { url: "https://techcrunch.com/category/artificial-intelligence/feed/", source: "TechCrunch", category: "AI" },
  { url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", source: "The Verge", category: "AI" },
  { url: "https://feeds.arstechnica.com/arstechnica/technology-lab", source: "Ars Technica", category: "Tech" },
  // Markets & Business
  { url: "https://feeds.bloomberg.com/technology/news.rss", source: "Bloomberg", category: "Markets" },
  { url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19854910", source: "CNBC Tech", category: "Markets" },
  // General Tech
  { url: "https://news.ycombinator.com/rss", source: "Hacker News", category: "Tech" },
  { url: "https://www.wired.com/feed/rss", source: "Wired", category: "Tech" },
  { url: "https://www.reuters.com/technology/rss", source: "Reuters", category: "Tech" },
];

// ═══ HANDLER ═══
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type");
  const cat = req.nextUrl.searchParams.get("category");
  const src = req.nextUrl.searchParams.get("source");

  if (type === "stocks") {
    const stocks = await fetchStocks(SA_STOCKS);
    return NextResponse.json({ stocks, ts: Date.now() });
  }

  if (type === "earnings") {
    return NextResponse.json({ earnings: getEarnings(), ts: Date.now() });
  }

  if (type === "semianalysis") {
    const items = await fetchRSS("https://semianalysis.substack.com/feed", "SemiAnalysis", "Semiconductors");
    return NextResponse.json({ items, ts: Date.now() });
  }

  // Default: aggregate all news feeds
  let feeds = NEWS_FEEDS;
  if (cat && cat !== "All") feeds = feeds.filter(f => f.category === cat);
  if (src && src !== "All") feeds = feeds.filter(f => f.source === src);

  const allItems: Array<{title: string; link: string; date: string; source: string; category: string; snippet: string}> = [];
  const feedResults = await Promise.allSettled(
    feeds.map(f => fetchRSS(f.url, f.source, f.category))
  );
  for (const r of feedResults) {
    if (r.status === "fulfilled") allItems.push(...r.value);
  }
  allItems.sort((a, b) => {
    const da = new Date(a.date).getTime() || 0;
    const db = new Date(b.date).getTime() || 0;
    return db - da;
  });

  const categories = [...new Set(NEWS_FEEDS.map(f => f.category))].sort();
  const sources = [...new Set(NEWS_FEEDS.map(f => f.source))].sort();

  return NextResponse.json({
    items: allItems.slice(0, 80),
    categories,
    sources,
    ts: Date.now(),
  });
}
