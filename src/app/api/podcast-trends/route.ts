// /api/podcast-trends — mocked feed of trending tech-podcast episodes
// (Acquired, BG2, Dwarkesh, Lex, No Priors, etc.) for the IS Trends
// panel's "Podcast Buzz" card. Real integration would scrape
// Apple/Spotify charts + parse episode metadata across each network;
// that's a multi-day effort. This stub powers the visual until then.

import { NextRequest, NextResponse } from "next/server";

export interface PodcastTrendItem {
  podcast: string;
  episode: string;
  topic: string;
  trending_score: number;   // 0-100 normalized
  url?: string;
}

const ITEMS: PodcastTrendItem[] = [
  { podcast: "Acquired",       episode: "TSMC: The Foundry That Ate The World", topic: "Foundry monopoly", trending_score: 94, url: "https://www.acquired.fm" },
  { podcast: "BG2 Pod",        episode: "The Inference Economy",                topic: "Inference economics", trending_score: 88, url: "https://www.bg2pod.com" },
  { podcast: "Dwarkesh",       episode: "Sutskever on alignment + scaling",     topic: "AI scaling laws",    trending_score: 82, url: "https://www.dwarkesh.com" },
  { podcast: "Lex Fridman",    episode: "Jensen Huang — Rubin and beyond",      topic: "Rubin platform",     trending_score: 76, url: "https://lexfridman.com" },
  { podcast: "No Priors",      episode: "Sovereign AI is real now",             topic: "Sovereign AI",       trending_score: 71, url: "https://www.no-priors.com" },
];

export async function GET(_req: NextRequest) {
  return NextResponse.json({ items: ITEMS, ts: Date.now(), stub: true });
}
