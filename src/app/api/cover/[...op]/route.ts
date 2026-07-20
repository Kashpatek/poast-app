// /api/cover/* — backend for the CoverCreator lab (the /testing123 hub).
// Catch-all dispatcher on the last path segment. Reuses POAST's callLLM
// (Claude/Gemini/Grok text + Claude vision) and safeFetch (SSRF-guarded).
// Serverless-safe: no filesystem writes — keepers + saved styles live in the
// client's localStorage. Auth + admin gating is enforced upstream in proxy.ts.
import { NextRequest, NextResponse } from "next/server";
import { callLLM, llmTextOf, parseLLMJson, type LLMProvider } from "@/lib/llm-provider";
import { safeFetch, SsrfBlockedError } from "@/lib/safe-fetch";
import STYLES from "../data/STYLES.json";
import FUSIONS from "../data/FUSIONS.json";
import THEMES from "../data/THEMES.json";
import PROFILE from "../data/PROFILE.json";

export const dynamic = "force-dynamic";

const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3-pro-image-preview";
const GROK_IMAGE_MODEL = process.env.GROK_IMAGE_MODEL || "grok-imagine-image";
const KEYS = { anthropic: !!process.env.ANTHROPIC_API_KEY, gemini: !!process.env.GEMINI_API_KEY, grok: !!process.env.XAI_API_KEY };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

function capabilities() {
  return {
    brains: { claude: KEYS.anthropic, gemini: KEYS.gemini, grok: KEYS.grok },
    lanes: {
      grok: { ok: KEYS.grok, label: "Grok · Aurora", model: GROK_IMAGE_MODEL },
      gemini: { ok: KEYS.gemini, label: "Gemini · image", model: GEMINI_IMAGE_MODEL, hint: KEYS.gemini ? "" : "add GEMINI_API_KEY (Google AI Studio)" },
      midjourney: { ok: true, manual: true, label: "Midjourney · manual" },
    },
  };
}

function houseStyle() {
  const p = (PROFILE as Any).palette;
  return { id: "house", name: "House (developing)", blurb: (PROFILE as Any).note?.slice(0, 90) || "The evolving SemiAnalysis house style.", styleBlock: (PROFILE as Any).styleBlock, palette: `${p.mode} — ink ${p.ink}, amber ${p.amber}, blue ${p.blue}, cream ${p.cream}` };
}
function stylesList() {
  return [{ ...houseStyle(), sampleUrl: null }, ...(STYLES as Any).styles.map((s: Any) => ({ ...s, sampleUrl: `/cover-lab/trends/${s.id}.jpg` }))];
}
function fusionsList() {
  return (FUSIONS as Any).fusions.map((f: Any) => ({ ...f, sampleUrl: `/cover-lab/fusions/${f.id}.jpg` }));
}
function resolveTheme(themeId?: string) { return themeId ? ((THEMES as Any).themes.find((t: Any) => t.id === themeId) || null) : null; }
function resolveLook(b: Any) {
  if (b.style && b.style.styleBlock) return { id: "ref", name: b.style.name || "Reference recipe", styleBlock: b.style.styleBlock, palette: b.style.palette || "as in the reference" };
  if (b.fusionId) { const f = (FUSIONS as Any).fusions.find((x: Any) => x.id === b.fusionId); if (f) return { id: f.id, name: f.name, styleBlock: f.styleBlock, palette: f.palette || "brand amber/blue on ink + cream" }; }
  if (b.blend?.a && b.blend?.b) {
    const S = (STYLES as Any).styles; const A = S.find((x: Any) => x.id === b.blend.a) || houseStyle(); const B = S.find((x: Any) => x.id === b.blend.b) || houseStyle();
    return { id: "blend", name: `${A.name} × ${B.name}`, styleBlock: `${A.styleBlock}, fused and clashing with ${B.styleBlock}`, palette: A.palette };
  }
  if (b.styleId && b.styleId !== "house") { const s = (STYLES as Any).styles.find((x: Any) => x.id === b.styleId); if (s) return s; }
  return houseStyle();
}

async function draftPrompt(b: Any) {
  const style = resolveLook(b); const theme = resolveTheme(b.themeId); const provider: LLMProvider = b.brain || "claude";
  const system = [
    "You are the prompt engineer for SemiAnalysis article cover IMAGES.",
    "You write ONE vivid image-generation prompt (natural language, 1–3 sentences) a text-to-image model will render.",
    `Lock to this STYLE — ${style.name}: ${style.styleBlock}`,
    `PALETTE: ${style.palette}.`,
    `ASPECT: ${(PROFILE as Any).aspect}.`,
    ...(theme ? [`TOPIC LENS — ${theme.name}: draw on these concept seeds (choose or synthesize ONE): ${(theme.concepts || []).join("; ")}.`] : []),
    `HARD AVOID: ${(PROFILE as Any).avoid.join("; ")}.`,
    ...((PROFILE as Any).notes || []).map((n: string) => `NOTE: ${n}`),
    "When the style is a FUSION of two clashing looks, commit to BOTH at once — the tension is the point.",
    'Return STRICT JSON: {"concept":"one-line idea","prompt":"the image prompt, style-locked, NO text-in-image","mj":"terser Midjourney phrasing (no --profile/--ar)"}.',
    "The prompt must NOT ask for any lettering/words/titles in the image.",
  ].join("\n");
  const user = [b.article ? `ARTICLE / TOPIC:\n${b.article}` : "", b.notes ? `\nNOTES:\n${b.notes}` : "", "\nWrite the cover-image prompt as strict JSON."].join("\n");
  const raw = llmTextOf(await callLLM({ provider, system, prompt: user, json: true, maxTokens: 1200 }));
  let out: Any; try { out = parseLLMJson(raw); } catch { out = { concept: "", prompt: raw.trim(), mj: raw.trim() }; }
  const mb = (PROFILE as Any).moodboards;
  return { ...out, style: { id: style.id, name: style.name }, mj: `${out.mj || out.prompt} --p ${mb.oilPainting} ${mb.dithering} --ar 16:9` };
}

async function grokImage(prompt: string) {
  const r = await fetch("https://api.x.ai/v1/images/generations", {
    method: "POST", headers: { Authorization: `Bearer ${process.env.XAI_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ model: GROK_IMAGE_MODEL, prompt, n: 1 }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || j?.error || `Grok image ${r.status}`);
  const d = j?.data?.[0] || {};
  if (d.b64_json) return { dataUrl: `data:image/jpeg;base64,${d.b64_json}` };
  if (d.url) { const img = await safeFetch(d.url); const buf = Buffer.from(await img.arrayBuffer()); return { dataUrl: `data:${img.headers.get("content-type") || "image/jpeg"};base64,${buf.toString("base64")}` }; }
  throw new Error("Grok image: no image in response");
}
async function geminiImage(prompt: string) {
  if (!KEYS.gemini) throw new Error("GEMINI_API_KEY not configured");
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"] } }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || `Gemini image ${r.status}`);
  const part = (j?.candidates?.[0]?.content?.parts || []).find((p: Any) => p.inlineData || p.inline_data);
  if (!part) throw new Error("Gemini image: no image part");
  const inl = part.inlineData || part.inline_data;
  return { dataUrl: `data:${inl.mimeType || "image/png"};base64,${inl.data}` };
}

async function reverseImage(b: Any) {
  let image: string = b.image || "";
  // data URL passes through; a remote http(s) URL is fetched SSRF-guarded.
  if (/^https?:\/\//.test(image)) {
    try { const r = await safeFetch(image, { headers: { "User-Agent": "Mozilla/5.0 CoverCreator" } }); const ct = r.headers.get("content-type") || "image/jpeg"; if (r.ok && ct.startsWith("image/")) image = `data:${ct};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}`; }
    catch (e) { if (e instanceof SsrfBlockedError) throw new Error("that URL isn't allowed"); }
  }
  const m = image.match(/^data:(image\/\w+);base64,([\s\S]+)$/);
  if (!m) throw new Error("No valid image");
  const system = [
    "You reverse-engineer a REFERENCE cover image so SemiAnalysis can REPRODUCE ITS STYLE (not copy its subject).",
    "Study medium/technique, texture, palette, lighting, composition, abstraction, signature tricks.",
    "Then write a REUSABLE prompt that reproduces THIS STYLE on a {SUBJECT} placeholder. Never request text in the image.",
    'Return STRICT JSON: {"analysis":"what was done + how to replicate","styleBlock":"terse comma-separated style descriptors","prompt":"full replication prompt","mj":"terser Midjourney phrasing"}.',
  ].join("\n");
  const raw = llmTextOf(await callLLM({ provider: b.brain || "claude", system, prompt: "Analyze the attached reference image and return the JSON.", json: true, maxTokens: 1500, images: [{ media_type: m[1], data: m[2] }] }));
  let out: Any; try { out = parseLLMJson(raw); } catch { out = { analysis: raw.trim(), styleBlock: "", prompt: raw.trim(), mj: raw.trim() }; }
  const mb = (PROFILE as Any).moodboards;
  return { ...out, mj: `${out.mj || out.prompt} --p ${mb.oilPainting} ${mb.dithering} --ar 16:9` };
}

// ── Inspo (Are.na boards + design-blog RSS + free search) ──
const INSPO_SOURCES = [
  { id: "posters", name: "Posters", type: "arena", q: "poster graphic design" },
  { id: "editorial", name: "Editorial", type: "arena", q: "editorial layout magazine" },
  { id: "type", name: "Typography", type: "arena", q: "typography type specimen" },
  { id: "generative", name: "Generative", type: "arena", q: "generative computational art" },
  { id: "brutalist", name: "Brutalist", type: "arena", q: "brutalist design" },
  { id: "print", name: "Print / Riso", type: "arena", q: "risograph screenprint print" },
  { id: "collage", name: "Collage", type: "arena", q: "collage graphic montage" },
  { id: "3d", name: "3D / CGI", type: "arena", q: "3d render cgi" },
  { id: "diagram", name: "Diagrams", type: "arena", q: "diagram technical drawing schematic" },
  { id: "dataviz", name: "Data viz", type: "arena", q: "data visualization" },
  { id: "datacenter", name: "Infrastructure", type: "arena", q: "datacenter server infrastructure industrial" },
  { id: "bookcovers", name: "Book covers", type: "arena", q: "book cover design" },
  { id: "colossal", name: "Colossal", type: "rss", url: "https://www.thisiscolossal.com/feed/" },
  { id: "designboom", name: "designboom", type: "rss", url: "https://www.designboom.com/feed/" },
  { id: "core77", name: "Core77", type: "rss", url: "https://www.core77.com/feed" },
];
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 CoverCreator/0.3";
const inspoCache = new Map<string, { ts: number; items: Any[] }>();
function decodeEnt(s: string) { return (s || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'"); }
async function inspoArena(q: string) {
  const r = await fetch(`https://api.are.na/v2/search?q=${encodeURIComponent(q)}&per=40`, { headers: { "User-Agent": UA } });
  if (!r.ok) return [];
  const j = await r.json();
  return (j?.blocks || []).filter((b: Any) => b.class === "Image" && b.image).map((b: Any) => ({ img: b.image.large?.url || b.image.display?.url || b.image.original?.url, title: b.title || b.generated_title || "", link: b.source?.url || `https://www.are.na/block/${b.id}`, source: "are.na" })).filter((x: Any) => x.img);
}
async function inspoRss(src: Any) {
  const r = await fetch(src.url, { headers: { "User-Agent": UA } }); if (!r.ok) return [];
  const xml = await r.text(); const out: Any[] = [];
  for (const block of xml.split(/<item[ >]/).slice(1, 31)) {
    const title = decodeEnt((block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1] || "").trim();
    const link = decodeEnt((block.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/) || [])[1] || "").trim();
    let img = (block.match(/<media:content[^>]+url="([^"]+)"/) || block.match(/<enclosure[^>]+url="([^"]+)"/) || [])[1];
    if (!img) img = decodeEnt((block.match(/<img[^>]+src="([^"]+)"/) || [])[1] || "");
    if (img) out.push({ img, title, link, source: src.name });
  }
  return out;
}
async function inspoRedditSearch(q: string) {
  try {
    const r = await fetch(`https://www.reddit.com/r/DesignPorn+graphic_design+midjourney/search.rss?q=${encodeURIComponent(q)}&restrict_sr=1&sort=relevance&limit=40`, { headers: { "User-Agent": UA } });
    if (!r.ok) return []; const xml = await r.text(); const out: Any[] = [];
    for (const e of xml.split(/<entry>/).slice(1)) {
      const content = decodeEnt((e.match(/<content[^>]*>([\s\S]*?)<\/content>/) || [])[1] || "");
      const img = (content.match(/<img[^>]+src="([^"]+)"/) || [])[1]; if (!img) continue;
      out.push({ img: decodeEnt(img), title: decodeEnt((e.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "").trim(), link: ((e.match(/<link[^>]+href="([^"]+)"/) || [])[1] || ""), source: "reddit" });
    }
    return out;
  } catch { return []; }
}
async function fetchInspo(id: string | null, q: string | null) {
  const cacheKey = q ? `q:${q}` : `id:${id}`; const hit = inspoCache.get(cacheKey);
  if (hit && Date.now() - hit.ts < 10 * 60 * 1000) return hit.items;
  const jobs: Promise<Any[]>[] = [];
  if (q) { jobs.push(inspoArena(q)); jobs.push(inspoRedditSearch(q)); }
  else { const src = INSPO_SOURCES.find((s) => s.id === id) || INSPO_SOURCES[0]; jobs.push(src.type === "arena" ? inspoArena((src as Any).q) : inspoRss(src)); }
  const seen = new Set<string>(), items: Any[] = [];
  for (const arr of await Promise.all(jobs)) for (const it of arr) if (it.img && !seen.has(it.img)) { seen.add(it.img); items.push(it); }
  const out = items.slice(0, 60); if (out.length) inspoCache.set(cacheKey, { ts: Date.now(), items: out }); return out;
}

async function handle(req: NextRequest, op: string) {
  const url = req.nextUrl;
  if (op === "capabilities") return NextResponse.json(capabilities());
  if (op === "styles") return NextResponse.json({ styles: stylesList() });
  if (op === "fusions") return NextResponse.json({ fusions: fusionsList() });
  if (op === "themes") return NextResponse.json({ themes: (THEMES as Any).themes });
  if (op === "inspo-sources") return NextResponse.json({ sources: INSPO_SOURCES.map((s) => ({ id: s.id, name: s.name })) });
  if (op === "inspo") return NextResponse.json({ items: await fetchInspo(url.searchParams.get("id"), url.searchParams.get("q")) });
  if (req.method === "POST") {
    const b = await req.json().catch(() => ({}));
    if (op === "prompt") return NextResponse.json(await draftPrompt(b));
    if (op === "generate") return NextResponse.json(b.lane === "gemini" ? await geminiImage(b.prompt) : await grokImage(b.prompt));
    if (op === "reverse") return NextResponse.json(await reverseImage(b));
  }
  return NextResponse.json({ error: "Unknown op: " + op }, { status: 404 });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ op: string[] }> }) {
  const { op } = await ctx.params;
  try { return await handle(req, (op || [])[0] || ""); } catch (e) { return NextResponse.json({ error: String((e as Error)?.message || e) }, { status: 500 }); }
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ op: string[] }> }) {
  const { op } = await ctx.params;
  try { return await handle(req, (op || [])[0] || ""); } catch (e) { return NextResponse.json({ error: String((e as Error)?.message || e) }, { status: 500 }); }
}
