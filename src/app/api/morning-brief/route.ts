import { NextRequest, NextResponse } from "next/server";
import { callLLM, llmTextOf, LLMError, type LLMProvider } from "@/lib/llm-provider";

interface NewsItem {
  title: string;
  link: string;
  date: string;
  source: string;
  category: string;
  snippet: string;
}

interface TrendItem {
  title: string;
  url: string;
  metric: string;
  timestamp: string;
  tags: string[];
}

interface TrendSourceResult {
  source: string;
  items?: TrendItem[];
  error?: string;
}

interface StorySeed {
  title: string;
  angle: string;
}

interface BriefPayload {
  topSignals: string[];
  storyIdeas: StorySeed[];
  moveFastAlert: string | null;
  competitorSummary: string;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function pullNews(origin: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(`${origin}/api/news`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: NewsItem[] };
    const cutoff = Date.now() - ONE_DAY_MS;
    return (data.items || []).filter((i) => {
      const t = new Date(i.date).getTime();
      return Number.isFinite(t) ? t >= cutoff : true;
    }).slice(0, 30);
  } catch {
    return [];
  }
}

async function pullTrends(origin: string): Promise<TrendItem[]> {
  try {
    const res = await fetch(`${origin}/api/trends-feed`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { sources?: TrendSourceResult[] };
    const flat: TrendItem[] = [];
    for (const s of data.sources || []) {
      for (const it of s.items || []) flat.push(it);
    }
    return flat.slice(0, 30);
  } catch {
    return [];
  }
}

function buildPrompt(news: NewsItem[], trends: TrendItem[]): string {
  const newsBlock = news.length
    ? news.map((n, i) => `${i + 1}. [${n.source}/${n.category}] ${n.title}${n.snippet ? ` — ${n.snippet}` : ""}`).join("\n")
    : "(no live news signals available)";
  const trendBlock = trends.length
    ? trends.map((t, i) => `${i + 1}. [${(t.tags || []).join(",") || "trend"}] ${t.title} (${t.metric})`).join("\n")
    : "(no live trending topics available)";

  return `You are the morning intelligence editor for SemiAnalysis. Build a 24-hour brief for the editorial team. Be sharp, technical, no marketing fluff, no em dashes, no emojis.

LAST 24H NEWS SIGNALS:
${newsBlock}

LIVE TRENDING TOPICS:
${trendBlock}

WATCHLIST FOCUS: NVIDIA, AMD, Intel, TSMC, ASML, Broadcom, Micron, AVGO, hyperscaler capex, HBM supply, AI training clusters, advanced packaging, export controls.

Return ONLY valid JSON in this exact shape (no markdown fences):
{
  "topSignals": ["signal 1", "signal 2", "signal 3", "signal 4", "signal 5"],
  "storyIdeas": [
    { "title": "...", "angle": "why it matters in one sentence" },
    { "title": "...", "angle": "..." },
    { "title": "...", "angle": "..." }
  ],
  "moveFastAlert": "single sentence describing the one thing the team should publish on TODAY or null if nothing is urgent",
  "competitorSummary": "2-3 sentence summary of what competitor analysts (The Information, Stratechery, Asianometry, Stratosphere, etc) are covering and any gap we can fill"
}`;
}

function parseBrief(raw: string): BriefPayload {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const data = JSON.parse(cleaned) as Partial<BriefPayload>;
  return {
    topSignals: Array.isArray(data.topSignals) ? data.topSignals.slice(0, 5).map((s) => String(s)) : [],
    storyIdeas: Array.isArray(data.storyIdeas)
      ? data.storyIdeas.slice(0, 3).map((s) => ({
          title: String((s as StorySeed)?.title || ""),
          angle: String((s as StorySeed)?.angle || ""),
        }))
      : [],
    moveFastAlert: data.moveFastAlert ? String(data.moveFastAlert) : null,
    competitorSummary: data.competitorSummary ? String(data.competitorSummary) : "",
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { provider?: LLMProvider };
    const provider: LLMProvider = body.provider || "claude";

    const origin = req.nextUrl.origin;
    const [news, trends] = await Promise.all([pullNews(origin), pullTrends(origin)]);

    const prompt = buildPrompt(news, trends);

    const r = await callLLM({
      provider,
      system: "You are a semiconductor and AI infrastructure intelligence editor. RESPOND ONLY IN VALID JSON. No markdown fences. Never use em dashes.",
      prompt,
      maxTokens: 2000,
    });
    const text = llmTextOf(r);

    let brief: BriefPayload;
    try {
      brief = parseBrief(text);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse brief", raw: text.slice(0, 400) },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ...brief,
      provider: r.provider,
      sourcedFrom: { news: news.length, trends: trends.length },
      ts: Date.now(),
    });
  } catch (e) {
    if (e instanceof LLMError) {
      return NextResponse.json({ error: e.message, provider: e.provider }, { status: e.status });
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
