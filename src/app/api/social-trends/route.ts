// /api/social-trends — mocked feed of trending SemiAnalysis-relevant
// topics on X / Reddit / HN. Real cross-platform integration is a
// multi-day effort (each platform has its own rate-limited API, auth
// flow, and parsing quirks). Until then this stub powers the
// "Social Pulse" card in the IS Trends panel so the UI reads as live.

import { NextRequest, NextResponse } from "next/server";

export interface SocialTrendItem {
  platform: "X" | "Reddit" | "HN";
  topic: string;
  engagement: number;       // raw count — likes / upvotes / points
  delta: number;            // percent change vs prior 24h, signed
  url?: string;
}

const ITEMS: SocialTrendItem[] = [
  { platform: "X",      topic: "Blackwell allocations Q3",  engagement: 18420, delta:  142.6, url: "https://x.com/search?q=Blackwell%20allocations" },
  { platform: "Reddit", topic: "TSMC N2 yield rumors",      engagement:  9280, delta:   58.4, url: "https://reddit.com/r/hardware" },
  { platform: "HN",     topic: "HBM4 supply shortage 2026", engagement:  2640, delta:   46.1, url: "https://news.ycombinator.com" },
  { platform: "X",      topic: "Hyperscaler capex revisions", engagement: 14210, delta: 31.8, url: "https://x.com/search?q=hyperscaler%20capex" },
  { platform: "Reddit", topic: "TPU vs GPU inference cost",  engagement:  6190, delta:   22.3, url: "https://reddit.com/r/MachineLearning" },
  { platform: "HN",     topic: "Sovereign AI sovereign cloud", engagement: 1820, delta:  -8.4, url: "https://news.ycombinator.com" },
];

export async function GET(_req: NextRequest) {
  return NextResponse.json({ items: ITEMS, ts: Date.now(), stub: true });
}
