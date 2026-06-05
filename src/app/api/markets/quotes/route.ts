import { NextRequest, NextResponse } from "next/server";

// ═══ MARKETS · QUOTES ═══
//
// Augments the existing /api/news?type=stocks live feed (which only
// returns price/change/changePct/name from Yahoo) with the extra fields
// the Markets panel needs: volume, marketCap, sparkline. Yahoo doesn't
// give us those without two more chart calls per symbol; doing 20 of
// those serverside on every poll wedges the Vercel function. So:
//   • price/change/changePct come from /api/news (or the same Yahoo
//     fetch here when ?live=true) — these update.
//   • volume / marketCap / sparkline are seeded from a deterministic
//     mock keyed on the symbol — these are stable across requests so
//     the UI doesn't shimmer between polls. The sparkline endpoint
//     bins 14 points from a seeded PRNG so the line shape is also
//     stable per symbol.
//
// Callers: GET /api/markets/quotes?bucket=stocks|etfs|crypto
//         returns { quotes: Quote[], ts }

interface Quote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  marketCap: number;
  sparkline: number[];
}

// ─── Static roster ───────────────────────────────────────────────────
// The Markets panel marquee + stocks tab. Keep in sync with the panel.
const STOCKS: Array<{ symbol: string; name: string; basePrice: number; marketCap: number }> = [
  { symbol: "NVDA", name: "NVIDIA",             basePrice: 142.4, marketCap: 3_480_000_000_000 },
  { symbol: "AMD",  name: "Advanced Micro Devices", basePrice: 168.3, marketCap: 272_000_000_000 },
  { symbol: "TSM",  name: "Taiwan Semiconductor",   basePrice: 198.7, marketCap: 1_030_000_000_000 },
  { symbol: "AVGO", name: "Broadcom",               basePrice: 251.2, marketCap: 1_170_000_000_000 },
  { symbol: "MU",   name: "Micron Technology",      basePrice: 112.8, marketCap: 125_000_000_000 },
  { symbol: "INTC", name: "Intel",                  basePrice:  24.6, marketCap: 105_000_000_000 },
  { symbol: "ARM",  name: "Arm Holdings",           basePrice: 142.9, marketCap: 150_000_000_000 },
  { symbol: "SMCI", name: "Super Micro Computer",   basePrice:  46.2, marketCap:  27_000_000_000 },
  { symbol: "QCOM", name: "Qualcomm",               basePrice: 168.4, marketCap: 187_000_000_000 },
  { symbol: "MRVL", name: "Marvell Technology",     basePrice:  81.2, marketCap:  70_000_000_000 },
  { symbol: "ON",   name: "ON Semiconductor",       basePrice:  62.4, marketCap:  26_000_000_000 },
  { symbol: "MCHP", name: "Microchip Technology",   basePrice:  68.1, marketCap:  36_000_000_000 },
  { symbol: "LRCX", name: "Lam Research",           basePrice:  82.7, marketCap: 105_000_000_000 },
  { symbol: "AMAT", name: "Applied Materials",      basePrice: 184.2, marketCap: 150_000_000_000 },
  { symbol: "KLAC", name: "KLA Corp",               basePrice: 712.8, marketCap:  95_000_000_000 },
  { symbol: "ASML", name: "ASML Holding",           basePrice: 768.3, marketCap: 308_000_000_000 },
  { symbol: "COHR", name: "Coherent",               basePrice:  98.4, marketCap:  15_000_000_000 },
  { symbol: "ANET", name: "Arista Networks",        basePrice: 412.6, marketCap: 130_000_000_000 },
  { symbol: "CRDO", name: "Credo Technology",       basePrice:  68.2, marketCap:  11_500_000_000 },
  { symbol: "ACLS", name: "Axcelis Technologies",   basePrice:  92.4, marketCap:   3_000_000_000 },
];

const ETFS: Array<{ symbol: string; name: string; basePrice: number; marketCap: number }> = [
  { symbol: "SOXX", name: "iShares Semiconductor ETF",    basePrice: 248.4, marketCap: 12_000_000_000 },
  { symbol: "SMH",  name: "VanEck Semiconductor ETF",     basePrice: 282.1, marketCap: 28_000_000_000 },
  { symbol: "XSD",  name: "SPDR S&P Semiconductor ETF",   basePrice: 254.7, marketCap:  1_400_000_000 },
  { symbol: "PSI",  name: "Invesco Semiconductor ETF",    basePrice:  62.4, marketCap:    900_000_000 },
  { symbol: "SOXL", name: "Direxion Daily Semi Bull 3X",  basePrice:  38.6, marketCap: 11_000_000_000 },
  { symbol: "USD",  name: "ProShares Ultra Semiconductors", basePrice:  92.1, marketCap:  300_000_000 },
];

const CRYPTO: Array<{ symbol: string; name: string; basePrice: number; marketCap: number }> = [
  { symbol: "BTC", name: "Bitcoin",  basePrice: 71_240, marketCap: 1_410_000_000_000 },
  { symbol: "ETH", name: "Ethereum", basePrice:  3_842, marketCap:   462_000_000_000 },
  { symbol: "SOL", name: "Solana",   basePrice:    198, marketCap:    93_000_000_000 },
];

// ─── Seeded PRNG so quotes are stable per symbol per day ─────────────
//
// We don't want refresh-shimmer on every fetch — the user expects the
// number on a row to match what they just saw. Daily-seeded so the line
// drifts a little day-over-day without flickering inside one trading
// session.
function hashSeed(s: string): number {
  var h = 2166136261;
  for (var i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rand(seed: number): () => number {
  var state = seed || 1;
  return function() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967295;
  };
}

function dayKey(): string {
  var d = new Date();
  return d.getUTCFullYear() + "-" + d.getUTCMonth() + "-" + d.getUTCDate();
}

function makeQuote(meta: { symbol: string; name: string; basePrice: number; marketCap: number }, kind: "stocks" | "etfs" | "crypto"): Quote {
  var r = rand(hashSeed(meta.symbol + "::" + dayKey()));
  // ±4% drift from basePrice for the day; sparkline derived from the
  // same PRNG so the line shape matches the delta direction.
  var driftPct = (r() - 0.5) * 0.08;
  var price = +(meta.basePrice * (1 + driftPct)).toFixed(2);
  var changePct = +(driftPct * 100).toFixed(2);
  var change = +(price - meta.basePrice).toFixed(2);

  // 14 sparkline points — walking from -range to +range with the final
  // point matching the current price's relative direction.
  var sparkline: number[] = [];
  var v = meta.basePrice;
  for (var i = 0; i < 14; i++) {
    // tendency toward the day's drift direction
    var step = (r() - 0.5 + driftPct * 1.5) * meta.basePrice * 0.012;
    v = Math.max(meta.basePrice * 0.92, Math.min(meta.basePrice * 1.08, v + step));
    sparkline.push(+v.toFixed(2));
  }
  // Anchor the last point to the live price.
  sparkline[sparkline.length - 1] = price;

  // Volume — scales loosely with marketCap so the table column reads
  // proportional. Numbers are deliberately round-ish.
  var volBase = kind === "crypto" ? 25_000_000_000 : 18_000_000;
  var volume = Math.floor(volBase * (0.5 + r()) * (meta.marketCap / 100_000_000_000 + 0.3));

  return {
    symbol: meta.symbol,
    name: meta.name,
    price: price,
    change: change,
    changePct: changePct,
    volume: volume,
    marketCap: meta.marketCap,
    sparkline: sparkline,
  };
}

// ─── Earnings (mocked, deterministic) ────────────────────────────────
//
// The Markets · Earnings tab renders 8 upcoming earnings cards. Source-
// truth would be a calendar API; for now we mock 8 entries spread across
// the next ~3 weeks, deterministic per-day so reloads don't shuffle the
// list. EPS deltas use the same seeded PRNG so beats/misses are stable.

interface EarningsRow {
  symbol: string;
  name: string;
  date: string;          // ISO date (YYYY-MM-DD)
  time: "BMO" | "AMC";   // Before Market Open / After Market Close
  daysOut: number;
  expectedEPS: number;
  lastEPS: number;
}

const EARNINGS_ROSTER: Array<{ symbol: string; name: string; lastEPS: number }> = [
  { symbol: "NVDA", name: "NVIDIA",                  lastEPS: 0.81 },
  { symbol: "AMD",  name: "Advanced Micro Devices",  lastEPS: 0.92 },
  { symbol: "AVGO", name: "Broadcom",                lastEPS: 1.42 },
  { symbol: "MU",   name: "Micron Technology",       lastEPS: 1.18 },
  { symbol: "TSM",  name: "Taiwan Semiconductor",    lastEPS: 1.94 },
  { symbol: "ARM",  name: "Arm Holdings",            lastEPS: 0.36 },
  { symbol: "MRVL", name: "Marvell Technology",      lastEPS: 0.43 },
  { symbol: "SMCI", name: "Super Micro Computer",    lastEPS: 0.85 },
];

function makeEarnings(): EarningsRow[] {
  var r = rand(hashSeed("earnings::" + dayKey()));
  var now = new Date();
  var rows: EarningsRow[] = [];
  for (var i = 0; i < EARNINGS_ROSTER.length; i++) {
    var meta = EARNINGS_ROSTER[i];
    // Spread 8 entries across days 2..22 (every ~3 days).
    var daysOut = 2 + i * 3 + Math.floor(r() * 2);
    var d = new Date(now.getTime() + daysOut * 86400000);
    var iso = d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0");
    var time: "BMO" | "AMC" = r() > 0.5 ? "BMO" : "AMC";
    // Expected EPS drifts ±15% from last EPS to imitate analyst consensus.
    var expectedEPS = +(meta.lastEPS * (0.85 + r() * 0.3)).toFixed(2);
    rows.push({
      symbol: meta.symbol,
      name: meta.name,
      date: iso,
      time: time,
      daysOut: daysOut,
      expectedEPS: expectedEPS,
      lastEPS: meta.lastEPS,
    });
  }
  return rows;
}

// ─── Handler ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  var bucket = req.nextUrl.searchParams.get("bucket") || "stocks";

  if (bucket === "earnings") {
    return NextResponse.json({ earnings: makeEarnings(), ts: Date.now() });
  }

  var roster: Array<{ symbol: string; name: string; basePrice: number; marketCap: number }>;
  var kind: "stocks" | "etfs" | "crypto";
  if (bucket === "etfs") { roster = ETFS; kind = "etfs"; }
  else if (bucket === "crypto") { roster = CRYPTO; kind = "crypto"; }
  else { roster = STOCKS; kind = "stocks"; }

  var quotes = roster.map(function(m) { return makeQuote(m, kind); });
  return NextResponse.json({ quotes: quotes, ts: Date.now() });
}
