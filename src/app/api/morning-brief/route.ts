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

interface LeadStory {
  headline: string;
  body: string;
  whyItMatters: string;
  sourceUrl?: string;
}

interface DeeperRead {
  headline: string;
  source: string;
  url?: string;
}

interface BriefPayload {
  topSignals: string[];
  storyIdeas: StorySeed[];
  moveFastAlert: string | null;
  competitorSummary: string;
  leadStory: LeadStory | null;
  deeperReads: DeeperRead[];
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function pullNews(origin: string, cookie: string): Promise<NewsItem[]> {
  try {
    // Forward the caller's session cookie — these are same-origin route-to-route
    // fetches that re-enter the access gate and would otherwise be 401'd.
    const res = await fetch(`${origin}/api/news`, { cache: "no-store", headers: { cookie } });
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

async function pullTrends(origin: string, cookie: string): Promise<TrendItem[]> {
  try {
    const res = await fetch(`${origin}/api/trends-feed`, { cache: "no-store", headers: { cookie } });
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
  "leadStory": {
    "headline": "The single biggest story of the day, written like a newspaper headline (8-14 words)",
    "body": "Two to three short paragraphs (separated by \\n\\n) explaining the story in editorial prose. Be specific with numbers, names, and dates. No marketing fluff.",
    "whyItMatters": "One or two sentences explaining the strategic implication for the semiconductor / AI infra industry",
    "sourceUrl": "the most relevant source URL from the news above, or null if none fits"
  },
  "topSignals": ["signal 1", "signal 2", "signal 3", "signal 4", "signal 5"],
  "storyIdeas": [
    { "title": "...", "angle": "why it matters in one sentence" },
    { "title": "...", "angle": "..." },
    { "title": "...", "angle": "..." },
    { "title": "...", "angle": "..." },
    { "title": "...", "angle": "..." }
  ],
  "moveFastAlert": "single sentence describing the one thing the team should publish on TODAY or null if nothing is urgent",
  "competitorSummary": "2-3 sentence summary of what competitor analysts (The Information, Stratechery, Asianometry, Stratosphere, etc) are covering and any gap we can fill",
  "deeperReads": [
    { "headline": "longer-form piece worth bookmarking", "source": "publication name", "url": "url if available, else null" },
    { "headline": "...", "source": "...", "url": null },
    { "headline": "...", "source": "...", "url": null },
    { "headline": "...", "source": "...", "url": null }
  ]
}

Notes:
- leadStory must be the highest-impact story across all the signals above
- storyIdeas should be exactly 5 distinct angles the editorial team can publish
- deeperReads should be exactly 4 longer-form articles surfaced by the brief
- Use the actual source URLs and publication names from the input news where possible`;
}

function parseBrief(raw: string): BriefPayload {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const data = JSON.parse(cleaned) as Partial<BriefPayload>;
  let leadStory: LeadStory | null = null;
  if (data.leadStory && typeof data.leadStory === "object") {
    const ls = data.leadStory as Partial<LeadStory>;
    const headline = String(ls.headline || "").trim();
    if (headline) {
      leadStory = {
        headline,
        body: String(ls.body || "").trim(),
        whyItMatters: String(ls.whyItMatters || "").trim(),
        sourceUrl: ls.sourceUrl ? String(ls.sourceUrl) : undefined,
      };
    }
  }
  return {
    topSignals: Array.isArray(data.topSignals) ? data.topSignals.slice(0, 5).map((s) => String(s)) : [],
    storyIdeas: Array.isArray(data.storyIdeas)
      ? data.storyIdeas.slice(0, 5).map((s) => ({
          title: String((s as StorySeed)?.title || ""),
          angle: String((s as StorySeed)?.angle || ""),
        }))
      : [],
    moveFastAlert: data.moveFastAlert ? String(data.moveFastAlert) : null,
    competitorSummary: data.competitorSummary ? String(data.competitorSummary) : "",
    leadStory,
    deeperReads: Array.isArray(data.deeperReads)
      ? data.deeperReads.slice(0, 4).map((d) => {
          const dr = d as Partial<DeeperRead>;
          return {
            headline: String(dr.headline || "").trim(),
            source: String(dr.source || "").trim(),
            url: dr.url ? String(dr.url) : undefined,
          };
        }).filter((d) => d.headline.length > 0)
      : [],
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { provider?: LLMProvider };
    const provider: LLMProvider = body.provider || "claude";

    const origin = req.nextUrl.origin;
    const cookie = req.headers.get("cookie") || "";
    const [news, trends] = await Promise.all([pullNews(origin, cookie), pullTrends(origin, cookie)]);

    const prompt = buildPrompt(news, trends);

    const r = await callLLM({
      provider,
      system: "You are a semiconductor and AI infrastructure intelligence editor. RESPOND ONLY IN VALID JSON. No markdown fences. Never use em dashes.",
      prompt,
      maxTokens: 3200,
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
