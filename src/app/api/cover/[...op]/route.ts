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
import EDITORIAL from "../data/EDITORIAL.json";
import PRICING from "../data/PRICING.json";

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
      grok: { ok: KEYS.grok, label: "Grok · Aurora", model: GROK_IMAGE_MODEL, models: ["grok-imagine-image", "grok-imagine-image-quality"] },
      gemini: { ok: KEYS.gemini, label: "Gemini · image", model: GEMINI_IMAGE_MODEL, models: ["gemini-3-pro-image-preview", "gemini-2.5-flash-image", "imagen-4.0-generate-001"], hint: KEYS.gemini ? "" : "add GEMINI_API_KEY (Google AI Studio)" },
      midjourney: { ok: true, manual: true, label: "Midjourney · manual", models: ["v7", "v6.1", "niji 6"] },
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
function resolveEditorial(id?: string) { const S = (EDITORIAL as Any).styles; return S.find((x: Any) => x.id === id) || S[0]; }
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
  if (b.mode === "editorial") return draftEditorial(b);
  const style = resolveLook(b); const theme = resolveTheme(b.themeId); const provider: LLMProvider = b.brain || "claude";
  const ar = b.aspect || (PROFILE as Any).aspect || "16:9";
  const wantText = !!(b.textInclude && String(b.textInclude).trim());
  const refs: Any[] = Array.isArray(b.refs) ? b.refs.filter((r: Any) => r && r.data && r.media_type) : [];
  const system = [
    "You are the art director + prompt engineer for SemiAnalysis article COVER IMAGES (semiconductors, AI compute, datacenters, capital, geopolitics).",
    "STEP 1 — Read the article and pull the RELEVANT ENTITIES (companies/orgs/people/products the cover should evoke — e.g. NVIDIA, TSMC, Anthropic) and the core TOPICS/themes.",
    `STEP 2 — Form ONE strong cover concept: a single vivid visual idea (metaphor or concrete scene) that makes the story legible at a glance, weaving in relevant entity motifs — recognizable objects/forms/brand-colour accents${wantText ? "" : " — but NEVER logos or written words"}.`,
    "STEP 3 — Render that concept in the LOCKED STYLE below. If it's a FUSION of two clashing looks, commit to BOTH at once.",
    `LOCKED STYLE — ${style.name}: ${style.styleBlock}. PALETTE: ${style.palette}. ASPECT: ${ar}.`,
    ...(theme ? [`TOPIC LENS — ${theme.name}: lean on these seeds if apt: ${(theme.concepts || []).join("; ")}.`] : []),
    ...(wantText ? [`ON-IMAGE TEXT — the image MUST render this EXACT text as a designed element (title/label), integrated into the style: "${String(b.textInclude).trim()}". In EACH platform prompt, quote it verbatim and say where it sits. Gemini renders text most reliably; for Midjourney add \`--style raw\` and expect to composite.`] : []),
    ...(refs.length ? [`REFERENCE IMAGE(S) — ${refs.length} attached. Use them as guidance for style, palette, composition, texture, or the specific subject as the notes indicate — adapt, do not copy verbatim.`] : []),
    `HARD AVOID: ${[(PROFILE as Any).avoid.join("; "), String(b.avoid || "").trim()].filter(Boolean).join("; ")}.`,
    "STEP 4 — Write THREE prompts of the SAME concept + style, each ACCURATE to its platform's idiom:",
    `  • midjourney: terse, comma-separated visual descriptors (subject → style → composition → lighting → palette). NO full sentences. The app appends --p moodboards + --ar ${ar}. You MAY add \`--style raw\` and/or \`--s <0-1000>\` inline.`,
    `  • gemini: a rich NATURAL-LANGUAGE paragraph describing scene/subject/composition/style/lighting/mood/palette in full sentences; include '${ar} cinematic framing'.`,
    "  • grok: a punchy natural-language prompt, 1–2 sentences — scene + style + palette.",
    ...(wantText ? [] : ["None may request any text, lettering, captions, or logos in the image."]),
    'Return STRICT JSON: {"concept":"one line","entities":["..."],"topics":["..."],"prompts":{"midjourney":"..","gemini":"..","grok":".."}}.',
  ].join("\n");
  const user = [b.article ? `ARTICLE / TOPIC:\n${b.article}` : "(No article — invent a fitting SemiAnalysis cover from the style + topic lens.)", b.notes ? `\nNOTES:\n${b.notes}` : "", "\nReturn the strict JSON now."].join("\n");
  const raw = llmTextOf(await callLLM({ provider, system, prompt: user, json: true, maxTokens: 2048, ...(refs.length ? { images: refs.map((r) => ({ media_type: r.media_type, data: r.data })) } : {}) }));
  let out: Any; try { out = parseLLMJson(raw); } catch { out = { concept: "", entities: [], topics: [], prompts: { midjourney: raw.trim(), gemini: raw.trim(), grok: raw.trim() } }; }
  if (!out.prompts) { const p = out.prompt || ""; out.prompts = { midjourney: out.mj || p, gemini: p, grok: p }; }
  out.entities = out.entities || []; out.topics = out.topics || [];
  const mb = (PROFILE as Any).moodboards;
  out.prompts.midjourney = `${out.prompts.midjourney} --p ${mb.oilPainting} ${mb.dithering} --ar ${ar}`;
  return { ...out, style: { id: style.id, name: style.name } };
}

// EDITORIAL mode — the real SemiAnalysis house style: witty, text-rich covers
// with on-image text, caricatures of named people, brand logos, humor.
async function draftEditorial(b: Any) {
  const style = resolveEditorial(b.editorialId); const theme = resolveTheme(b.themeId); const provider: LLMProvider = b.brain || "claude"; const p = (PROFILE as Any).palette;
  const ar = b.aspect || (PROFILE as Any).aspect || "16:9";
  const refs: Any[] = Array.isArray(b.refs) ? b.refs.filter((r: Any) => r && r.data && r.media_type) : [];
  const system = [
    "You are the cover artist for SemiAnalysis — a hard-tech publication famous for WITTY, TEXT-RICH EDITORIAL COVER ILLUSTRATIONS (caricatures, satirical scenes, annotated infographics) that make a technical story instantly legible and funny.",
    "STEP 1 — Read the article: identify the key PLAYERS (companies/people to feature) and the core story/tension + TOPICS.",
    b.headline ? `STEP 2 — Use this HEADLINE as the on-image title (refine only lightly): "${b.headline}".` : "STEP 2 — Invent a punchy, funny HEADLINE — a short on-image title/joke (≤ ~5 words).",
    `STEP 3 — Render it in this EDITORIAL LOOK — ${style.name}: ${style.styleBlock}. Use SemiAnalysis brand colours (amber ${p.amber}, blue ${p.blue}) as accents. Unlike premium covers, here you SHOULD include ON-IMAGE TEXT (the headline + a few short labels), CARICATURES of the named people (describe them recognizably — glasses, hairstyle, signature outfit), and company logo / brand-colour cues.`,
    ...(b.textInclude && String(b.textInclude).trim() ? [`ALSO render this EXACT text somewhere in the image, in addition to the headline: "${String(b.textInclude).trim()}".`] : []),
    ...(theme ? [`TOPIC LENS — ${theme.name}: lean on these if apt: ${(theme.concepts || []).join("; ")}.`] : []),
    ...(b.avoid && String(b.avoid).trim() ? [`KEEP OUT OF FRAME: ${String(b.avoid).trim()}.`] : []),
    ...(refs.length ? [`REFERENCE IMAGE(S) — ${refs.length} attached. Use them to guide likeness, style, composition or the specific subject as the notes indicate.`] : []),
    "STEP 4 — Write THREE prompts of the SAME concept, each platform-accurate AND spelling out the EXACT text to render:",
    `  • gemini: a rich NATURAL-LANGUAGE paragraph; explicitly quote the text that must appear and where (Gemini / Nano-Banana renders in-image text reliably). Include '${ar}'.`,
    `  • midjourney: terse comma-separated descriptors; put intended words in quotes and add \`--style raw\` (MJ text is unreliable — fine, the artist can composite). The app appends --ar ${ar}.`,
    "  • grok: a punchy natural-language prompt naming the text to render.",
    'Return STRICT JSON: {"concept":"one line","headline":"the on-image title","entities":["..."],"topics":["..."],"caricatures":["who + how to draw them"],"prompts":{"midjourney":"..","gemini":"..","grok":".."}}.',
  ].join("\n");
  const user = [b.article ? `ARTICLE / TOPIC:\n${b.article}` : "(No article — invent a fitting satirical SemiAnalysis cover.)", b.notes ? `\nNOTES:\n${b.notes}` : "", "\nReturn the strict JSON now."].join("\n");
  // 2048 matches the standalone's per-provider budget (Gemini editorial JSON — with
  // headline + caricatures + a rich prose prompt — can exceed 1500 and truncate).
  const raw = llmTextOf(await callLLM({ provider, system, prompt: user, json: true, maxTokens: 2048, ...(refs.length ? { images: refs.map((r) => ({ media_type: r.media_type, data: r.data })) } : {}) }));
  let out: Any; try { out = parseLLMJson(raw); } catch { out = { concept: "", headline: b.headline || "", entities: [], topics: [], caricatures: [], prompts: { midjourney: raw.trim(), gemini: raw.trim(), grok: raw.trim() } }; }
  if (!out.prompts) { const pp = out.prompt || ""; out.prompts = { midjourney: pp, gemini: pp, grok: pp }; }
  out.entities = out.entities || []; out.topics = out.topics || []; out.editorial = true;
  out.prompts.midjourney = `${out.prompts.midjourney} --ar ${ar}`;
  return { ...out, style: { id: style.id, name: style.name } };
}

async function grokImage(prompt: string, model?: string) {
  const r = await fetch("https://api.x.ai/v1/images/generations", {
    method: "POST", headers: { Authorization: `Bearer ${process.env.XAI_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ model: model || GROK_IMAGE_MODEL, prompt, n: 1 }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || j?.error || `Grok image ${r.status}`);
  const d = j?.data?.[0] || {};
  if (d.b64_json) return { dataUrl: `data:image/jpeg;base64,${d.b64_json}` };
  if (d.url) { const img = await safeFetch(d.url); const buf = Buffer.from(await img.arrayBuffer()); return { dataUrl: `data:${img.headers.get("content-type") || "image/jpeg"};base64,${buf.toString("base64")}` }; }
  throw new Error("Grok image: no image in response");
}
async function geminiImage(prompt: string, model?: string) {
  if (!KEYS.gemini) throw new Error("GEMINI_API_KEY not configured");
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model || GEMINI_IMAGE_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
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
  if (op === "styles") return NextResponse.json({ sampleSubject: (STYLES as Any).sampleSubject, styles: stylesList(), editorial: (EDITORIAL as Any).styles });
  if (op === "fusions") return NextResponse.json({ fusions: fusionsList() });
  if (op === "themes") return NextResponse.json({ themes: (THEMES as Any).themes });
  if (op === "pricing") return NextResponse.json(PRICING);
  if (op === "inspo-sources") return NextResponse.json({ sources: INSPO_SOURCES.map((s) => ({ id: s.id, name: s.name })) });
  if (op === "inspo") return NextResponse.json({ items: await fetchInspo(url.searchParams.get("id"), url.searchParams.get("q")) });
  if (req.method === "POST") {
    const b = await req.json().catch(() => ({}));
    if (op === "prompt") return NextResponse.json(await draftPrompt(b));
    if (op === "generate") return NextResponse.json(b.lane === "gemini" ? await geminiImage(b.prompt, b.model) : await grokImage(b.prompt, b.model));
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
