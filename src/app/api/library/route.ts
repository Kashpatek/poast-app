import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { promises as fs } from "fs";
import path from "path";
import { generateWithClaude, AnthropicError } from "@/lib/anthropic";
import { checkRateLimit } from "@/lib/ratelimit";
import { callLLM, llmTextOf, parseLLMJson, type LLMProvider } from "@/lib/llm-provider";
import { suggestTopic } from "../../wizard/engine/library/suggest";
import type { LibField, LibTemplate, LibTopicKey, TopicsData } from "@/app/wizard/engine/library/data";
import type { CaptionOption } from "@/app/wizard/engine/types";

// ═══════════════════════════════════════════════════════════════════════════
// LIBRARY platform · POST /api/library (docs/LIBRARY-INTEGRATION.md §C + v2 §Q)
//
// One request: article text OR a URL (fetched + extracted server-side),
// optional confirmed topic (null → the server suggests one), target count →
// THREE slide PLANS in one LLM call, each a distinct direction over the 90
// approved handoff templates (data / narrative / visual), + ONE set of
// captionOptions in the exact shape /api/carousel's "caption" action returns,
// so PUBLISH works unchanged. Conventions (provider routing, zod validation,
// error envelopes) mirror src/app/api/carousel/route.ts.
// The plan constraints live in the prompt AND in server validation; plans
// that fail parse/validation are retried ONCE with the errors appended, and
// any plan still failing after the retry is dropped (survivors returned,
// min 1) with a note in the response's "warnings" array.
// ═══════════════════════════════════════════════════════════════════════════

// Provider-aware JSON helper — local copy of /api/carousel's genJSON (it is
// not exported from that route). One deliberate difference: the Claude path
// also runs through parseLLMJson, because this route's contract requires
// defensive parsing (fence-strip + outermost-block slice) on every provider.
async function genJSON<T>(opts: { system: string; prompt: string; maxTokens?: number; provider?: LLMProvider }): Promise<T> {
  const provider = opts.provider || "claude";
  if (provider === "claude") {
    const raw = await generateWithClaude({ system: opts.system, prompt: opts.prompt, maxTokens: opts.maxTokens });
    return parseLLMJson<T>(raw);
  }
  // Non-Claude providers don't reliably return clean JSON — request strict
  // JSON mode and parse defensively (same rationale as /api/carousel).
  const r = await callLLM({
    provider,
    system: opts.system,
    prompt: opts.prompt,
    maxTokens: opts.maxTokens || 4000,
    json: true,
  });
  return parseLLMJson<T>(llmTextOf(r));
}

// ─── server-side template index ───
// The client loads /library/templates.json over fetch (engine/library/data.ts);
// the server reads the same file from disk, once per module instance. Only
// approved rows may ever reach the prompt: the handoff ships 90 rows whose
// dispositions all start with "keep" ("keep" + a few "keep-fixed-flag" whose
// fixes were verified pre-handoff) — anything cut/undecided that sneaks in
// upstream is filtered here defensively.
let templatesCache: LibTemplate[] | null = null;

async function loadLibraryTemplates(): Promise<LibTemplate[]> {
  if (templatesCache) return templatesCache;
  const file = path.join(process.cwd(), "public", "library", "templates.json");
  const raw = await fs.readFile(file, "utf8");
  const parsed = JSON.parse(raw) as { templates?: LibTemplate[] };
  templatesCache = (parsed.templates || []).filter(
    (t) => typeof t.disposition === "string" && t.disposition.startsWith("keep")
  );
  return templatesCache;
}

// ─── server-side topics (v2 §Q) ───
// Same disk-read pattern as templates. Needed for the server-side topic
// default: when the request carries no topic, suggestTopic (pure, importable
// here) resolves one from the article text against these topics, and the
// response echoes it so the client can adopt it.
let topicsCache: TopicsData | null = null;

async function loadLibraryTopics(): Promise<TopicsData> {
  if (topicsCache) return topicsCache;
  const file = path.join(process.cwd(), "public", "library", "backdrop-topics.json");
  const raw = await fs.readFile(file, "utf8");
  topicsCache = JSON.parse(raw) as TopicsData;
  return topicsCache;
}

// ─── server-side template use-cases (v3.4) ───
// public/library/template-usecases.json is the PLANNER-FACING sidecar from
// the 2026-07-14 visual annotation pass: per template idx, a genuine usage
// note ("use"), an anti-pattern note ("avoid"), and a "textRich" flag naming
// the layouts whose body copy can carry an argument in full sentences. It
// replaces templates.json's `useWhen` in the prompt — that field is curation
// residue (reviewer verdicts about flaws/siblings) and must never reach the
// model again. Missing/unreadable sidecar degrades to {} (prompt ships
// without use-when clauses; the quota falls back to a field heuristic).
interface UseCaseEntry { use?: string; avoid?: string; textRich?: boolean }

let usecasesCache: Record<string, UseCaseEntry> | null = null;

async function loadTemplateUseCases(): Promise<Record<string, UseCaseEntry>> {
  if (usecasesCache) return usecasesCache;
  try {
    const file = path.join(process.cwd(), "public", "library", "template-usecases.json");
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw) as { entries?: Record<string, unknown> };
    // Per-entry sanitization: a regenerated/hand-edited sidecar with a bad
    // value must degrade to "no note for that template", never throw at
    // prompt-build time (a TypeError there would 500 every request AND stick
    // in this cache until restart). Arrays also satisfy typeof "object".
    const entries =
      parsed.entries && typeof parsed.entries === "object" && !Array.isArray(parsed.entries)
        ? parsed.entries
        : {};
    const out: Record<string, UseCaseEntry> = {};
    for (const k of Object.keys(entries)) {
      const v = entries[k] as UseCaseEntry | null;
      if (!v || typeof v !== "object" || Array.isArray(v)) continue;
      const e: UseCaseEntry = {};
      if (typeof v.use === "string" && v.use.trim()) e.use = v.use;
      if (typeof v.avoid === "string" && v.avoid.trim()) e.avoid = v.avoid;
      if (typeof v.textRich === "boolean") e.textRich = v.textRich;
      if (e.use || e.avoid || e.textRich !== undefined) out[k] = e;
    }
    usecasesCache = out;
  } catch (e) {
    console.warn(
      `[api/library] template-usecases.json unavailable, planning without use-when notes: ${e instanceof Error ? e.message : String(e)}`
    );
    // Deliberately NOT cached: a transient fs error (EMFILE, disk hiccup) on
    // the first request must not strip use-when guidance for the process
    // lifetime — retry the read on the next request.
    return {};
  }
  return usecasesCache;
}

// ─── URL → article text (v2 §Q) ───
// url-only requests fetch the page server-side and extract readable prose.
// https only, 10s hard timeout, desktop browser UA (news/CMS origins often
// serve bots a stub), redirects followed (fetch default), non-HTML rejected.
// Every failure throws with a human reason — POST turns it into a 422 the
// store surfaces verbatim in the generating overlay.
const FETCH_TIMEOUT_MS = 10_000;
const EXTRACT_CAP = 12_000; // chars of article text carried into the prompt
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// Decode the entities that actually show up in article HTML (named set +
// numeric forms) — superset of lib/html.ts's stripHTML set, kept local so the
// shared helper's behavior (used by /api/carousel) stays untouched.
function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&lsquo;|&rsquo;|&#8216;|&#8217;/gi, "'")
    .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/&ndash;|&#8211;/gi, "-")
    .replace(/&mdash;|&#8212;/gi, "-")
    .replace(/&hellip;|&#8230;/gi, "...")
    .replace(/&#(\d+);/g, (_, code) => {
      const n = parseInt(code, 10);
      return n > 31 && n < 65536 ? String.fromCharCode(n) : " ";
    })
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&"); // last, so "&amp;lt;" doesn't double-decode
}

// Strip remaining tags → decode entities → collapse whitespace.
function tagStrip(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

// Extract readable article text from a fetched page. Cut the block elements
// that never carry prose (script/style/svg/noscript + nav/header/footer
// chrome), then prefer the largest <article> element; failing that, the
// page's <p>-run when the paragraphs hold real bulk (drops sidebars and menu
// soup — "trivially findable" per the contract, no readability engine); else
// whole-body tag-strip. Cap at EXTRACT_CAP chars.
function extractReadableText(html: string): string {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<nav[\s>][\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s>][\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s>][\s\S]*?<\/footer>/gi, " ");
  let scope = "";
  const articles = cleaned.match(/<article[\s>][\s\S]*?<\/article>/gi);
  if (articles && articles.length) {
    scope = articles.reduce((a, b) => (b.length > a.length ? b : a), "");
  } else {
    const paragraphs = cleaned.match(/<p[\s>][\s\S]*?<\/p>/gi) || [];
    const joined = paragraphs.join(" ");
    if (tagStrip(joined).length >= 800) scope = joined;
  }
  return tagStrip(scope || cleaned).slice(0, EXTRACT_CAP);
}

async function fetchArticleText(rawUrl: string): Promise<string> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new Error("that is not a valid URL");
  }
  if (u.protocol !== "https:") throw new Error("only https:// URLs are supported");

  // One 10s budget for the whole round trip — the signal stays armed through
  // the body read, so a slow origin can't hang past the timeout either way.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(u.toString(), {
        headers: { "User-Agent": BROWSER_UA, Accept: "text/html,application/xhtml+xml" },
        signal: ctrl.signal,
      });
    } catch {
      throw new Error(
        ctrl.signal.aborted
          ? "the page took longer than 10 seconds to respond"
          : "the page could not be fetched"
      );
    }
    if (!res.ok) throw new Error(`the page returned HTTP ${res.status}`);
    // Reject declared non-HTML (PDFs, JSON APIs, images…); a missing header
    // is not a declaration, so it falls through to extraction.
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (ct && !ct.includes("text/html") && !ct.includes("application/xhtml")) {
      throw new Error(`the URL is not an HTML page (content-type: ${ct.split(";")[0]})`);
    }
    let html: string;
    try {
      html = await res.text();
    } catch {
      throw new Error(
        ctrl.signal.aborted
          ? "the page took longer than 10 seconds to respond"
          : "the page body could not be read"
      );
    }
    const text = extractReadableText(html);
    if (!text) throw new Error("no readable article text was found on the page");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

// ─── text-rich classification (v3.4) ───
// A template is text-rich when its sidecar entry says so; the sidecar's
// flags are authoritative (they came from looking at every rendered layout).
// Only when a template has no entry (sidecar missing or partially regen'd)
// does the field heuristic apply: total body-role character capacity of
// TEXT_RICH_BODY_CAP+ means the layout can hold real explanatory prose
// ("has a body field" alone is too weak — the claude family's big-stat
// heroes carry tiny body fields).
const TEXT_RICH_BODY_CAP = 180;

function isTextRich(t: LibTemplate, usecases: Record<string, UseCaseEntry>): boolean {
  const uc = usecases[String(t.idx)];
  if (uc && typeof uc.textRich === "boolean") return uc.textRich;
  const bodyCap = t.fields.reduce((sum, f) => sum + (f.role === "body" ? f.maxLen || 0 : 0), 0);
  return bodyCap >= TEXT_RICH_BODY_CAP;
}

// EXPLAINER quota: body slides = every position except the cover (slide 1)
// and, on 3+ slide decks, the end slide. Decks with 2+ body slides must use
// text-rich layouts on at least a third of them (minimum 1); a single-body
// deck is exempt (the cover + one punchy slide is a valid short post).
function textRichQuota(bodyCount: number): number {
  return bodyCount >= 2 ? Math.max(1, Math.ceil(bodyCount / 3)) : 0;
}

// ─── compact prompt index ───
// One line per template: idx, family/layout, TEXT-RICH marker, fields
// (name/role/maxLen), slots (name/accepts), and the sidecar's use/avoid
// notes. NOT the SVGs — the schema is enough for the model to match
// templates to content signals. Logo-role fields are omitted entirely so
// the model never tries to fill a brand mark. templates.json's `useWhen`
// (curation residue) deliberately does NOT feed this line — v3.4.
function fieldSpec(f: LibField): string {
  if (!f.maxLen) return `${f.name}(${f.role})`;
  // Micro tag fields: spell out what actually fits — "max 4" alone reads as
  // negotiable and the planner poured sentences into issue-number boxes.
  const tag = f.role === "stat" || f.role === "label" || f.role === "kicker" || f.role === "eyebrow";
  if (tag && f.maxLen <= 12) {
    return `${f.name}(${f.role}, max ${f.maxLen} — TINY, e.g. ${f.maxLen <= 5 ? `"40%"` : `"4.1 TB/s"`})`;
  }
  return `${f.name}(${f.role}, max ${f.maxLen})`;
}

function templateIndexLine(t: LibTemplate, usecases: Record<string, UseCaseEntry>): string {
  const fields = t.fields.filter((f) => f.role !== "logo").map(fieldSpec).join(", ");
  const slots = (t.slots || []).map((s) => `${s.name}:${s.accepts}`).join(", ");
  const bits = [`#${t.idx} ${t.family}/${t.layout}`];
  if (t.family === "cover") bits.push("COVER — slide 1 ONLY");
  else if (t.family === "end") bits.push("CLOSER — last slide ONLY");
  else bits.push("BODY — never slide 1");
  if (t.family !== "cover" && t.family !== "end" && isTextRich(t, usecases)) bits.push("TEXT-RICH");
  bits.push(`fields: ${fields || "none"}`);
  if (slots) bits.push(`slots: ${slots}`);
  const uc = usecases[String(t.idx)];
  const use = uc && uc.use ? uc.use.trim() : "";
  const avoid = uc && uc.avoid ? uc.avoid.trim() : "";
  if (use) bits.push(`use when: ${use}${avoid ? ` AVOID: ${avoid}` : ""}`);
  return bits.join(" · ");
}

// ─── plan validation + normalization (every guarantee applies to EACH of
// the three plans independently) ───
// Fatal problems (wrong count, unknown/misplaced template, missing headline
// fill, text-rich quota shortfall — v3.4, egregiously over-cap body/subhead
// prose on the first attempt — v3.5) reject the plan so the retry can fix
// it. Recoverable problems are normalized in place and logged: unknown/
// logo/empty fills are dropped, over-maxLen fills are clamped at the last
// COMPLETE SENTENCE inside the cap (v3.5 — the 7.14 export shipped six
// slides ending mid-sentence off the old word-boundary clamp), slotImage
// falls back to null when it isn't one of the provided URLs or the template
// has no image slot.
interface PlanSlide {
  templateIdx: number;
  fills: Record<string, string>;
  slotImage: string | null;
}

// Clamp over-cap text so it still reads as finished prose: prefer the last
// real sentence terminator inside the cap (skipping decimal points like
// "2.1x"), accept it when it keeps at least half the budget; otherwise fall
// back to a word-boundary cut marked with an ellipsis. The one thing this
// must never do is the old behavior — strip trailing punctuation and ship a
// fragment that ends mid-sentence with no signal at all.
// Trailing connectives that must never dangle at the end of a cut — before
// an ellipsis ("…TSVs, MIM capacitors, and a…") or at the end of a short
// headline. Shared by the sentence, headline, and teaser clamps.
const HEADLINE_STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "of", "to", "in", "on", "at", "for",
  "vs", "with", "is", "are", "as", "its", "their", "it",
]);
function clampToSentence(text: string, cap: number): string {
  const cut = text.slice(0, cap);
  let best = -1;
  for (let ci = cut.length - 1; ci >= 0; ci--) {
    const ch = cut[ci];
    if (ch !== "." && ch !== "!" && ch !== "?") continue;
    const prev = cut[ci - 1];
    const next = text[ci + 1];
    if (ch === "." && prev >= "0" && prev <= "9" && next >= "0" && next <= "9") continue; // decimal point
    if (next === undefined || next === " " || next === "\n") { best = ci; break; }
  }
  if (best >= cap * 0.5) return cut.slice(0, best + 1);
  const sp = cut.lastIndexOf(" ");
  // The ellipsis path must come back UNDER the cap too (review finding: a
  // no-space cut of exactly cap chars + "…" shipped cap+1 and lit the EDIT
  // panel's over-limit state on the server's own output).
  const word = sp > cap * 0.55 ? cut.slice(0, sp) : cut.slice(0, cap - 1);
  return tidyEllipsis(word.replace(/[\s,;:.]+$/, "") + "…");
}

// Ellipsis teaser tidy (v3.5): any fill that ends in an ellipsis — a clamp's
// word cut or a teaser the planner wrote itself — must not dangle a
// connective before the dots ("…MIM capacitors, and a…"). Strip up to two
// trailing stopwords plus stray punctuation and keep the ellipsis. Strings
// without a trailing ellipsis pass through untouched.
function tidyEllipsis(text: string): string {
  if (!/(…|\.\.\.)$/.test(text)) return text;
  let words = text.replace(/(…|\.\.\.)$/, "").replace(/[\s,;:.—]+$/, "").split(/\s+/).filter(Boolean);
  for (let n = 0; n < 2 && words.length > 1 && HEADLINE_STOPWORDS.has(words[words.length - 1].toLowerCase()); n++) {
    words = words.slice(0, -1);
  }
  return words.join(" ").replace(/[\s,;:.—]+$/, "") + "…";
}

// Headline clamp (v3.5): headlines are display type — a trailing "…" reads
// as a broken render at 96px. Cut at the last clause boundary (; : — , as
// well as sentence terminators) when it keeps half the budget; otherwise cut
// at a word boundary and strip trailing connectives so the cut reads like a
// deliberate short headline ("Which packaging disclosure matters…" becomes
// "Which packaging disclosure matters"). The ellipsis only survives when the
// remainder would be too short to stand alone.
function clampHeadline(text: string, cap: number): string {
  const cut = text.slice(0, cap);
  let best = -1;
  for (let ci = cut.length - 1; ci >= 0; ci--) {
    const ch = cut[ci];
    if (!".!?;:,".includes(ch) && ch !== "—") continue;
    const prev = cut[ci - 1];
    const next = text[ci + 1];
    if (ch === "." && prev >= "0" && prev <= "9" && next >= "0" && next <= "9") continue; // decimal
    if (ch === "," && prev >= "0" && prev <= "9" && next >= "0" && next <= "9") continue; // 1,024
    if (next === undefined || next === " " || next === "\n") { best = ci; break; }
  }
  if (best >= cap * 0.5) {
    const kept = cut.slice(0, best + 1);
    // keep real terminators (?!), drop clause separators
    return /[.!?]/.test(cut[best]) ? kept : kept.slice(0, -1).replace(/[\s]+$/, "");
  }
  const sp = cut.lastIndexOf(" ");
  let words = (sp > cap * 0.5 ? cut.slice(0, sp) : cut.slice(0, cap - 1)).replace(/[\s,;:.—]+$/, "").split(/\s+/);
  for (let n = 0; n < 2 && words.length > 1 && HEADLINE_STOPWORDS.has(words[words.length - 1].toLowerCase()); n++) {
    words = words.slice(0, -1);
  }
  const out = words.join(" ");
  return out.length >= cap * 0.4 ? out : out + "…";
}

// Tag-field clamp (v3.5): stat/label/kicker/eyebrow boxes hold a figure or a
// short tag, and a mid-word ellipsis there reads as a broken render ("32 Gb…",
// "Host…"). Keep the longest run of WHOLE tokens that fits, with no ellipsis —
// "32 Gb/s peak" at cap 6 becomes "32", which reads intentional. Only when
// the first token itself is wider than the box does the hard cut + ellipsis
// remain (nothing meaningful fits; the retry/shortener should have caught it).
function clampTag(text: string, cap: number): string {
  const tokens = text.split(/\s+/).filter(Boolean);
  let out = "";
  for (const tok of tokens) {
    const next = out ? `${out} ${tok}` : tok;
    if (next.length > cap) break;
    out = next;
  }
  return out || text.slice(0, Math.max(1, cap - 1)).replace(/[\s,;:.]+$/, "") + "…";
}

function validatePlan(
  rawSlides: unknown,
  templates: LibTemplate[],
  pageCount: number,
  imageUrls: string[],
  usecases: Record<string, UseCaseEntry>,
  strictLen: boolean
): { slides?: PlanSlide[]; error?: string } {
  if (!Array.isArray(rawSlides) || rawSlides.length === 0) {
    return { error: `"slides" must be a non-empty array` };
  }
  let slideRows: unknown[] = rawSlides;
  if (pageCount > 0 && slideRows.length !== pageCount) {
    return { error: `expected exactly ${pageCount} slide(s), got ${slideRows.length}` };
  }
  if (pageCount === 0 && slideRows.length > 8) {
    if (strictLen) return { error: `auto slide count must be 4-8, got ${slideRows.length}` };
    // Final attempt: too many slides is repairable — keep the first 8 (the
    // position repair below restores an end-family closer on the new last
    // slide), rather than drop the plan over an overflow.
    console.warn(`[api/library] auto slide count ${slideRows.length} > 8 on final attempt — truncated to 8`);
    slideRows = slideRows.slice(0, 8);
  }
  if (pageCount === 0 && slideRows.length < 4) {
    return { error: `auto slide count must be 4-8, got ${slideRows.length}` };
  }

  const byIdx = new Map(templates.map((t) => [t.idx, t]));
  // Concrete allow-lists for the position-constraint retry messages: naming
  // the valid idxs outperforms restating the family rule — the planner kept
  // re-picking hero layouts for slide 1 when told only "cover-family".
  const coverSet = templates.filter((t) => t.family === "cover").map((t) => `#${t.idx}`).join(" ");
  const endSet = templates.filter((t) => t.family === "end").map((t) => `#${t.idx}`).join(" ");
  const total = slideRows.length;
  const problems: string[] = [];
  const slides: PlanSlide[] = [];
  // v3.4 EXPLAINER quota bookkeeping. Body positions are derived from the
  // slide's POSITION (not its family — a misplaced cover in the body is
  // already a fatal problem of its own): everything except slide 1 and, on
  // 3+ slide decks, the last slide. Rows whose templateIdx didn't resolve
  // can't count as text-rich; they're already fatal, so the joined error
  // still gives the retry everything it needs in one message.
  const bodyCount = total - 1 - (total >= 3 ? 1 : 0);
  let richCount = 0;

  // v3.5 position repair (final attempt only): the planner regenerates the
  // whole plan on every retry and can REINTRODUCE a bad opener while fixing
  // the other problems (#190 hero on slide 1 came back on attempt 3 after
  // being corrected on attempt 2). Rather than drop an otherwise-valid plan,
  // swap the offending opener/closer for a stock cover/end template and
  // remap its fills by role (a queue per role, source field order); the
  // lenient clamp below fits the carried text to the new template's caps.
  if (!strictLen) {
    const repair = (pos: number, family: "cover" | "end", stockIdx: number) => {
      const row = slideRows[pos] as { templateIdx?: unknown; fills?: unknown } | null;
      if (!row || typeof row !== "object") return;
      const src = typeof row.templateIdx === "number" ? byIdx.get(row.templateIdx) : undefined;
      const tgt = byIdx.get(stockIdx);
      if (!src || !tgt || src.family === family) return;
      const queues = new Map<string, string[]>();
      const fillsIn = (row.fills && typeof row.fills === "object" ? row.fills : {}) as Record<string, unknown>;
      src.fields.forEach((f) => {
        const v = fillsIn[f.name];
        if (typeof v === "string" && v.trim()) {
          if (!queues.has(f.role)) queues.set(f.role, []);
          queues.get(f.role)!.push(v.trim());
        }
      });
      const mapped: Record<string, string> = {};
      tgt.fields.forEach((f) => {
        const q = queues.get(f.role);
        if (q && q.length) mapped[f.name] = q.shift()!;
      });
      row.templateIdx = stockIdx;
      row.fills = mapped;
      console.warn(`[api/library] repaired slide ${pos + 1} → ${family} #${stockIdx} (was #${src.idx})`);
    };
    repair(0, "cover", 8);
    if (total >= 3) repair(total - 1, "end", 109);
  }

  slideRows.forEach((s, i) => {
    const row = (s && typeof s === "object" ? s : {}) as { templateIdx?: unknown; fills?: unknown; slotImage?: unknown };
    const idx = typeof row.templateIdx === "number" ? row.templateIdx : NaN;
    const t = byIdx.get(idx);
    if (!t) {
      problems.push(`slide ${i + 1}: templateIdx ${String(row.templateIdx)} is not an approved template`);
      return;
    }
    // Quota bookkeeping: a resolved template on a body position counts
    // toward the plan's text-rich floor.
    if (i > 0 && !(total >= 3 && i === total - 1) && isTextRich(t, usecases)) richCount++;
    // Position constraints: cover family opens, end family closes (when the
    // deck is 3+ slides); neither is allowed anywhere else.
    if (i === 0 && t.family !== "cover") {
      problems.push(`slide 1 must use a cover-family template — replace #${t.idx} (family "${t.family}") with one of: ${coverSet}`);
    }
    if (i === total - 1 && total >= 3 && t.family !== "end") {
      problems.push(`the last slide must use an end-family template — replace #${t.idx} (family "${t.family}") with one of: ${endSet}`);
    }
    if (i > 0 && t.family === "cover") {
      problems.push(`slide ${i + 1}: cover-family templates are only allowed on slide 1`);
    }
    if (i < total - 1 && t.family === "end") {
      problems.push(`slide ${i + 1}: end-family templates are only allowed on the last slide`);
    }

    // Fills — every key must name a declared field; logo-role never fills;
    // empty values fall back to the baked placeholder (drop); clamp at maxLen.
    const fieldByName = new Map(t.fields.map((f) => [f.name, f]));
    const fillsIn = (row.fills && typeof row.fills === "object" ? row.fills : {}) as Record<string, unknown>;
    const fills: Record<string, string> = {};
    Object.keys(fillsIn).forEach((k) => {
      const v = fillsIn[k];
      if (typeof v !== "string" || !v.trim()) return; // omitted/empty → baked placeholder
      const f = fieldByName.get(k);
      if (!f) {
        console.warn(`[api/library] slide ${i + 1}: dropped unknown fill "${k}" (template #${t.idx})`);
        return;
      }
      if (f.role === "logo") {
        console.warn(`[api/library] slide ${i + 1}: dropped logo-role fill "${k}" (template #${t.idx})`);
        return;
      }
      let text = v.trim();
      if (f.maxLen && text.length > f.maxLen) {
        // Any overshoot (v3.5): on the FIRST attempt every over-cap fill is a
        // fatal problem — the retry carries the exact budget per field and the
        // planner rewrites to fit. Tiny stat/label caps (4-16 chars) word-cut
        // to garbage ("Int…", "240x240…") and even in-tolerance prose clamps
        // dangle mid-clause, so silent clamping on attempt 0 always loses to
        // one rewrite pass (a fresh ectc2026 run stored 43 ellipsis fills
        // under the old >=80/1.35x gate). On the retry itself (strictLen
        // false) we accept what we got and sentence-clamp, so a plan can
        // never be dropped over length alone after its one rewrite chance.
        // Tag-like = tag roles OR any box of chip scale (#59/#90 strips bake
        // body-role fields at caps 12-16; they hold tokens, not sentences).
        const isTag = f.role === "stat" || f.role === "label" || f.role === "kicker" || f.role === "eyebrow" || f.maxLen <= 16;
        if (strictLen) {
          problems.push(
            isTag
              ? `slide ${i + 1}: "${k}" is ${text.length} chars but this ${f.role} field holds only ${f.maxLen} — use a figure or 1-2 word tag that fits, or omit the field to keep its baked placeholder`
              : f.role === "headline"
                ? `slide ${i + 1}: "${k}" is ${text.length} chars but the headline cap is ${f.maxLen} — write a shorter headline that fits`
                : `slide ${i + 1}: "${k}" is ${text.length} chars but the cap is ${f.maxLen} — rewrite it as complete sentences that fit under the cap`
          );
          return;
        }
        console.warn(`[api/library] slide ${i + 1}: clamped "${k}" ${text.length} → ${f.maxLen} chars (template #${t.idx})`);
        // Tag fields never take the mid-word ellipsis path — "32 Gb…" under a
        // number reads broken while "32" reads intentional. Keep whole tokens
        // that fit; the hard cut only remains for a first token wider than
        // the box.
        if (isTag) {
          const tagCut = clampTag(text, f.maxLen);
          // Micro furniture boxes (cap < 8: issue numbers, ticks — baked text
          // like "AI", "9", "Util") whose first token can't fit: the baked
          // placeholder beats a mid-word cut ("Feyn…"). Stats are exempt —
          // a demo number reads as fabricated data; the cut at least reads
          // as what it is.
          if (tagCut.endsWith("…") && f.maxLen <= 8 && f.role !== "stat") {
            console.warn(`[api/library] slide ${i + 1}: dropped unfittable ${f.role} fill "${k}" (cap ${f.maxLen}, template #${t.idx}) — placeholder shows`);
            return;
          }
          text = tagCut;
        } else if (f.role === "headline") {
          text = clampHeadline(text, f.maxLen);
        } else {
          text = clampToSentence(text, f.maxLen);
        }
      }
      fills[k] = tidyEllipsis(text);
    });
    // Headline-role fields are the one class the model may never leave to the
    // placeholder — a slide without its headline is not a plan.
    t.fields.forEach((f) => {
      if (f.role === "headline" && !fills[f.name]) {
        problems.push(`slide ${i + 1}: missing required headline fill "${f.name}" (template #${t.idx})`);
      }
    });

    // slotImage — one of the provided URLs (or its LIST INDEX, robust against
    // long-URL echo drift), and only meaningful on a template that actually
    // has an image-accepting slot.
    let slotImage: string | null = typeof row.slotImage === "string" && row.slotImage.trim() ? row.slotImage.trim() : null;
    if (slotImage === null && typeof row.slotImage === "number" && imageUrls[row.slotImage]) {
      slotImage = imageUrls[row.slotImage];
    }
    if (slotImage && /^\d{1,2}$/.test(slotImage) && imageUrls[Number(slotImage)]) {
      slotImage = imageUrls[Number(slotImage)];
    }
    if (slotImage && imageUrls.indexOf(slotImage) === -1) {
      console.warn(`[api/library] slide ${i + 1}: slotImage is not one of the provided imageUrls, nulled`);
      slotImage = null;
    }
    if (slotImage && !(t.slots || []).some((sl) => sl.accepts === "image")) {
      console.warn(`[api/library] slide ${i + 1}: template #${t.idx} has no image slot, slotImage nulled`);
      slotImage = null;
    }

    slides.push({ templateIdx: t.idx, fills, slotImage });
  });

  // v3.4 HARD QUOTA (deck-level, fatal): the deck must read as an explainer,
  // so a plan below the text-rich floor is rejected — the ONE retry carries
  // this message verbatim, so it names the shortfall AND the qualifying
  // template idx values the model can swap in. Prepended (unshift) so the
  // slice(0, 6) cap on the joined error can never drop it behind six
  // per-slide problems.
  const required = textRichQuota(bodyCount);
  if (richCount < required) {
    const qualifyingList = templates.filter(
      (t) => t.family !== "cover" && t.family !== "end" && isTextRich(t, usecases)
    );
    // Satisfiability guard: a bad sidecar regen could leave fewer qualifying
    // body templates than the quota demands — an unmeetable fatal would 502
    // every run with a retry hint the model cannot act on. Downgrade to a
    // warn and let the plan through rather than take the route down.
    if (qualifyingList.length < required) {
      console.warn(
        `[api/library] text-rich quota unsatisfiable (${qualifyingList.length} qualifying < ${required} required) — skipping the quota check; fix template-usecases.json`
      );
    } else if (strictLen) {
      const qualifying = qualifyingList.map((t) => `#${t.idx}`).join(", ");
      problems.unshift(
        `only ${richCount} of ${bodyCount} body slides use TEXT-RICH layouts; at least ${required} must — swap body slides to text-rich templates (${qualifying})`
      );
    } else {
      // Final attempt: a thin-on-text plan is a quality miss, not a broken
      // render — under strict length pressure the planner trades text-rich
      // layouts for terse stat ones, and rejecting here dropped 2 of 3 plans
      // in testing. Ship it with a warn; the other plans usually cover it.
      console.warn(
        `[api/library] text-rich quota missed on final attempt (${richCount}/${bodyCount} body slides, wanted ${required}) — shipping anyway`
      );
    }
  }

  // Cap the retry message at 12 problems: the strict length gate can flag a
  // dozen small fields at once, and a problem the retry never hears about is
  // one it cannot fix (it lands on the silent-clamp path instead).
  if (problems.length) return { error: problems.slice(0, 12).join("; ") };
  return { slides };
}

// ─── v3.5 residual-overshoot shortener ───
// The strict attempt-0 gate teaches the planner exact budgets, but the retry
// is accepted leniently — anything still over cap would silently word-cut to
// a dangler ("Intel/Goog…", "9 lay…"). Before the lenient validate, batch
// every remaining over-cap fill into one tiny rewrite call so the ellipsis
// path stays a true last resort. Mutates the raw plan fills in place.
// Failure here is non-fatal: validatePlan's sentence-clamp is the backstop.
async function shortenOverCapFills(
  plansObj: Partial<Record<PlanKey, { slides?: unknown }>>,
  keys: PlanKey[],
  templates: LibTemplate[],
  provider: LLMProvider
): Promise<void> {
  const byIdx = new Map(templates.map((t) => [t.idx, t]));
  const items: { kind: string; max: number; text: string; apply: (s: string) => void }[] = [];
  for (const key of keys) {
    const raw = plansObj[key];
    const slides = raw && Array.isArray(raw.slides) ? raw.slides : [];
    for (const s of slides) {
      const row = (s && typeof s === "object" ? s : {}) as { templateIdx?: unknown; fills?: unknown };
      const t = typeof row.templateIdx === "number" ? byIdx.get(row.templateIdx) : undefined;
      const fills = (row.fills && typeof row.fills === "object" ? row.fills : null) as Record<string, unknown> | null;
      if (!t || !fills) continue;
      for (const f of t.fields) {
        const v = fills[f.name];
        if (typeof v !== "string" || !f.maxLen || v.trim().length <= f.maxLen) continue;
        // Budgets under 8 chars are hopeless for an LLM (character counting
        // fails at that scale) — clampTag's token cut handles them instead.
        if (f.maxLen < 8) continue;
        const kind =
          f.role === "stat" || f.role === "label" || f.role === "kicker" || f.role === "eyebrow" || f.maxLen <= 16
            ? "tag"
            : f.role === "headline"
              ? "headline"
              : "prose";
        items.push({ kind, max: f.maxLen, text: v.trim(), apply: (out) => { fills[f.name] = out; } });
      }
    }
  }
  if (!items.length) return;
  try {
    const result = await genJSON<{ out?: unknown }>({
      system: "You shorten strings to fit fixed-width slide fields. Return strict JSON only.",
      maxTokens: 4000,
      provider,
      prompt:
        `Rewrite each "text" to fit its field. HARD LIMIT: "max" characters — but character counting is error-prone, so TARGET 80% of "max" (e.g. max 20 → aim for 16). When in doubt cut more; a shorter string always fits. ` +
        `Keep the key fact; keep figures and units exact; never invent. ` +
        `kind "tag": a figure or 1-3 word tag, never a sentence. kind "headline": still reads as a headline. kind "prose": complete sentence(s) ending with a period. ` +
        `NEVER end an output with "…" or "..." — every output must read complete in itself, not truncated. ` +
        `Return {"out": [...]} — an array of exactly ${items.length} strings, same order as the input.\n\n` +
        `Input:\n${JSON.stringify(items.map((it, i) => ({ i, kind: it.kind, max: it.max, text: it.text })))}`,
    });
    const out = Array.isArray((result as { out?: unknown }).out) ? ((result as { out: unknown[] }).out) : [];
    let fixed = 0;
    items.forEach((it, i) => {
      const raw = out[i];
      if (typeof raw !== "string") return;
      let s: string = raw.trim();
      // The rewriter sometimes truncates instead of rewriting and ships its
      // own "…" — that is exactly the artifact this pass exists to remove.
      const hadEllipsis = /(…|\.\.\.)$/.test(s);
      if (hadEllipsis) s = s.replace(/(…|\.\.\.)$/, "").replace(/[\s,;:]+$/, "");
      if (!s) return;
      // A dangling prose/headline rewrite is no better than the clamp it
      // replaces — reject it and let clampToSentence cut the ORIGINAL text
      // at a clean sentence instead.
      if (hadEllipsis && it.kind !== "tag") return;
      if (it.kind === "tag") s = clampTag(s, it.max); // token-safe fit, no ellipsis
      if (s.length <= it.max && !s.endsWith("…")) { it.apply(s); fixed++; }
    });
    console.warn(`[api/library] shortener: ${fixed}/${items.length} residual over-cap fills rewritten to budget`);
  } catch (e) {
    console.warn(`[api/library] shortener failed (${e instanceof Error ? e.message : String(e)}) — falling back to sentence-clamp`);
  }
}

// ─── the three plan directions (v2 §Q) ───
// Keys/labels are THE contract with plan.ts + the store + ChooseStation's
// bench columns; canonical order data → narrative → visual. Each brief is
// injected into the prompt to force genuinely distinct template mixes.
type PlanKey = "data" | "narrative" | "visual";

const PLAN_DIRECTIONS: { key: PlanKey; label: string; brief: string }[] = [
  {
    key: "data",
    label: "DATA-LED",
    brief: "DATA-LED: the numbers make the argument. Favor stat, scorecard, leaderboard and table layouts, but every stat page must PROVE a specific claim the deck is building (no decorative numbers), and TEXT-RICH pages at the quota floor connect the figures into one explanation.",
  },
  {
    key: "narrative",
    label: "NARRATIVE",
    brief: "NARRATIVE: an argument arc carried by prose. A clear MAJORITY of body slides are TEXT-RICH pages that develop the reasoning in full sentences; a quote layout lands the voice when the article has a quotable line, and the end closes the loop.",
  },
  {
    key: "visual",
    label: "VISUAL",
    brief: "VISUAL: spectacle where it is earned. Favor image-slot and bold big-type layouts ONLY where the article genuinely supplies the visual moment; TEXT-RICH pages at the quota floor still carry the explanation between the set pieces. The fewest words per slide of the three plans.",
  },
];

// ─── prompts ───
const LIBRARY_SYS = `You are a content designer for SemiAnalysis, turning research articles into Instagram carousels that read as scrollable EXPLAINERS, built ONLY from an approved template library. In one pass you produce THREE alternative carousel plans for the same article, each taking a genuinely different direction with a different template mix. You pick one template per slide by matching each template's fields and "use when" note to the article's content signals (stats, comparisons, quotes, rankings, step lists, timelines, big single numbers, images), then fill that template's text fields from the source.

Voice rules:
- Never use em dashes. Use commas, periods, or colons.
- No emojis. Plain declarative sentences.
- Confident, technical, institutional. SA voice.
- No hype words like "revolutionary" or "game-changing".

INTEGRITY RULE: every number, statistic, and claim in your fills must appear in or be directly computable from the source text. Never invent data.

You MUST respond ONLY with valid JSON. No markdown fences. No preamble.`;

// Caption prompt mirrors /api/carousel's "caption" action (same 3-option
// IG/TikTok/Shorts shape + hard rules) so PUBLISH consumes it unchanged.
const CAPTION_SYS = `You are a content strategist for SemiAnalysis, writing social captions for Instagram carousel posts built from research articles. Tone: confident, technical, institutional. SA voice. Never use em dashes. No emojis. No hype words like "revolutionary" or "game-changing". You MUST respond ONLY with valid JSON. No markdown fences. No preamble.`;

// ─── chart action (v3 §V) ───
// EDIT-time "generate a chart for this slot": article text (or a re-fetched
// URL) + the slide's context → a small validated chart SPEC. The client
// renders it to brand-styled SVG (engine/library/chart.ts) — the LLM never
// draws, so the output is always on-system.
const CHART_SYS = `You are a data-visualization editor for SemiAnalysis. From a research article and one slide's context, you extract the single most relevant charted series. INTEGRITY RULE: every point must come from figures stated in or directly computable from the article. Never invent or interpolate data. Prefer 4-8 points. You MUST respond ONLY with valid JSON. No markdown fences. No preamble.`;

// (shape mirrored client-side in engine/library/chart.ts — route files must
// not export custom members)
interface ChartSeries { label: string; points: { x: string; y: number }[] }
interface ChartSpec { type: "line" | "bar" | "area"; title: string; unit: string; series: ChartSeries[]; source: string }

function validateChartSpec(raw: unknown): { spec?: ChartSpec; error?: string } {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const type = r.type === "bar" || r.type === "area" ? r.type : r.type === "line" ? "line" : null;
  if (!type) return { error: `chart "type" must be line | bar | area` };
  const seriesIn = Array.isArray(r.series) ? r.series.slice(0, 3) : [];
  const series: ChartSeries[] = [];
  for (const s of seriesIn) {
    const so = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
    const pts = (Array.isArray(so.points) ? so.points.slice(0, 12) : [])
      .map((p) => {
        const po = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
        const y = typeof po.y === "number" ? po.y : parseFloat(String(po.y));
        return { x: String(po.x ?? "").slice(0, 16), y };
      })
      .filter((p) => p.x && isFinite(p.y));
    if (pts.length >= 2) series.push({ label: String(so.label ?? "").slice(0, 40), points: pts });
  }
  if (!series.length) return { error: "chart needs at least one series with 2+ numeric points" };
  return {
    spec: {
      type,
      title: String(r.title ?? "").slice(0, 60),
      unit: String(r.unit ?? "").slice(0, 20),
      series,
      source: String(r.source ?? "").slice(0, 80),
    },
  };
}

async function handleChartAction(body: Record<string, unknown>): Promise<NextResponse> {
  const ChartReq = z.object({
    action: z.literal("chart"),
    text: z.string().optional(),
    url: z.string().optional(),
    slideContext: z.string().max(2000).optional(),
    provider: z.enum(["claude", "gemini", "grok"]).optional(),
  }).passthrough();
  const parsed = ChartReq.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
  }
  let articleText = (parsed.data.text || "").trim();
  if (!articleText && (parsed.data.url || "").trim()) {
    try {
      articleText = await fetchArticleText((parsed.data.url as string).trim());
    } catch (e) {
      return NextResponse.json(
        { error: `Could not read the article at that URL: ${e instanceof Error ? e.message : String(e)}` },
        { status: 422 }
      );
    }
  }
  if (!articleText) return NextResponse.json({ error: "text or url required" }, { status: 400 });

  const prompt = `Extract ONE chart from this article for a carousel slide.

Slide context (what the slide is saying — the chart must support exactly this):
${parsed.data.slideContext || "(none — pick the article's single most load-bearing series)"}

Article:
${articleText.slice(0, 12000)}

Return JSON exactly in this shape:
{ "type": "line" | "bar" | "area", "title": "<= 60 chars", "unit": "e.g. GW, $B, %", "series": [ { "label": "<= 40 chars", "points": [ { "x": "label", "y": 42 } ] } ], "source": "e.g. SemiAnalysis Tokenomics Model" }
1-3 series, 2-12 points each, exact figures from the article only.`;

  let lastErr = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await genJSON<unknown>({
        system: CHART_SYS,
        maxTokens: 2000,
        provider: parsed.data.provider || "claude",
        prompt: attempt === 0 ? prompt : prompt + `\n\nYour previous attempt was rejected: ${lastErr}. Fix that and return corrected strict JSON only.`,
      });
      const v = validateChartSpec(raw);
      if (v.spec) return NextResponse.json({ chart: v.spec });
      lastErr = v.error || "invalid chart spec";
    } catch (e) {
      if ((e as AnthropicError).status) {
        return NextResponse.json({ error: (e as Error).message || "Chart generation failed" }, { status: (e as AnthropicError).status });
      }
      lastErr = e instanceof SyntaxError ? "the response was not valid JSON" : String(e);
    }
  }
  return NextResponse.json({ error: `Chart generation failed: ${lastErr}` }, { status: 502 });
}

export async function POST(req: NextRequest) {
  try {
    const { allowed, remaining } = await checkRateLimit(req);
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "X-RateLimit-Remaining": String(remaining ?? 0) } }
      );
    }

    const body = await req.json();
    // Chart action (v3 §V): small EDIT-time call, same rate-limit budget.
    if (body && body.action === "chart") {
      return handleChartAction(body as Record<string, unknown>);
    }
    const LibrarySchema = z.object({
      text: z.string().optional(),
      url: z.string().optional(),
      topic: z.string().nullable().optional(),
      pageCount: z.number().int().min(0).max(12).optional(),
      imageUrls: z.array(z.string()).optional(),
      provider: z.enum(["claude", "gemini", "grok"]).optional(),
    }).passthrough();
    const parsed = LibrarySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { text, url } = parsed.data;
    const hasText = !!(text && text.trim());
    const hasUrl = !!(url && url.trim());
    if (!hasText && !hasUrl) {
      return NextResponse.json({ error: "text or url required" }, { status: 400 });
    }
    const pageCount = parsed.data.pageCount || 0; // 0 = auto (model picks 4-8)
    const imageUrls = (parsed.data.imageUrls || []).filter((u) => u && !u.startsWith("data:")).slice(0, 12);
    const provider: LLMProvider = parsed.data.provider || "claude";

    // Article source: pasted text always wins; the url then rides along as a
    // reference line. Url-only → server-side fetch + extraction; a 422 with
    // the human reason lets the store surface it in the overlay verbatim.
    let articleText = hasText ? (text as string).trim() : "";
    let extracted = false;
    if (!articleText) {
      try {
        articleText = await fetchArticleText((url as string).trim());
        extracted = true;
      } catch (e) {
        return NextResponse.json(
          { error: `Could not read the article at that URL: ${e instanceof Error ? e.message : String(e)}` },
          { status: 422 }
        );
      }
    }

    const [templates, topicsData, usecases] = await Promise.all([
      loadLibraryTemplates(),
      loadLibraryTopics(),
      loadTemplateUseCases(),
    ]);
    if (!templates.length) {
      return NextResponse.json({ error: "Template library is empty" }, { status: 500 });
    }

    // Topic: the client's confirmed pick wins; null/absent → the server
    // suggests one from the article text (same pure suggestTopic the CREATE
    // station uses, so client and server defaults never diverge). The
    // response echoes the resolved key either way.
    const requestedTopic = (parsed.data.topic || "").trim();
    let topic: LibTopicKey;
    if (requestedTopic) {
      if (!topicsData.topics.some((t) => t.key === requestedTopic)) {
        return NextResponse.json({ error: `Unknown topic "${requestedTopic}"` }, { status: 400 });
      }
      topic = requestedTopic as LibTopicKey;
    } else {
      topic = suggestTopic(articleText, topicsData.topics);
    }

    const countGuidance = pageCount > 0
      ? `The user requested exactly ${pageCount} slide(s). Every plan must have exactly that many.`
      : `Pick the count each plan genuinely supports, between 4 and 8 slides. Every slide must earn its place; do not pad with filler. The three plans may have different counts.`;

    const imageNote = imageUrls.length
      ? `Available images (${imageUrls.length}) — set "slotImage" to the list INDEX (e.g. "0") or the exact URL. Entries named "local:N (...)" are user-imported images: the user chose them, so they matter — EVERY plan should place at least one image on a template with an image slot when one genuinely fits the content:\n${imageUrls.map((u, i) => `${i}: ${u}`).join("\n")}`
      : `No images provided. Set "slotImage": null on every slide.`;

    const basePrompt = `Plan THREE alternative SemiAnalysis carousels from this article using ONLY the templates below. Same article, three directions:
${PLAN_DIRECTIONS.map((d) => `- "${d.key}" — ${d.brief}`).join("\n")}

Topic (confirmed): ${topic}

Article:
${articleText.slice(0, 12000)}
${hasUrl ? `\nSource URL: ${(url as string).trim()}\n` : ""}
${imageNote}

SLIDE COUNT:
${countGuidance}

TEMPLATE LIBRARY (choose by idx):
Family guide: cover = openers · end = closers · detail and lab = the body workhorses (lab holds the text-rich "typical body post" layouts: takeaways, margin notes, head-to-heads, checklists, tables) · claude = big-stat heroes · simple = minimal type · scenario/spectacle/brand = special moments.
${templates.map((t) => templateIndexLine(t, usecases)).join("\n")}

Rules (apply to EACH plan independently):
- Slide 1 templateIdx MUST be one of the cover set: ${templates.filter((t) => t.family === "cover").map((t) => `#${t.idx}`).join(" ")}. No other idx is valid on slide 1 — even in the VISUAL plan, "bold big-type" layouts named like heroes (labCircuitHero, labContourHero, labGradientMonolith, claudeDeltaHero) are BODY templates; a plan opening outside the cover set is REJECTED whole.
- With 3 or more slides, the LAST slide templateIdx MUST be one of the end set: ${templates.filter((t) => t.family === "end").map((t) => `#${t.idx}`).join(" ")}.
- Cover and end templates are ONLY allowed in those positions; body slides come from the other families.
- Fill EVERY field the chosen template lists. Headline fields are mandatory. You may omit a minor field (a label, a footer) to keep its baked placeholder text, but never omit a field the article can serve.
- Character limits are HARD visual capacity, freshly measured against each layout. Write to roughly 85% of every "max N"; a fill at the limit renders at the minimum font size.
- SHORT FIELDS: stat, label, and kicker caps are TINY (many under 16 chars — room for a figure, a unit, or a two-word tag: "4.1 TB/s", "36 µm", "IPO filed"). Write exactly what fits or omit the field to keep its placeholder; anything longer is cut mid-word and renders as garbage on the slide.
- Every body and subhead fill MUST end as a COMPLETE sentence and fit UNDER its cap. Over-cap text is rejected (>35% over) or cut at the last full sentence — either way the reader sees only what fits, so write the argument to the budget, never past it.

EXPLAINER ARC (apply to EACH plan — the deck must work as one coherent explainer):
- A reader scrolls the deck once, top to bottom, and should come away understanding the article's argument. Read aloud cover to end, the slides must flow as one explanation in order, not a pile of graphics.
- TEXT-RICH templates (marked in the library) CARRY the argument: full sentences that develop the reasoning. In any plan with 2 or more body slides, at least a third of them (minimum 1) MUST be TEXT-RICH — validated server-side; plans below the floor are rejected. A deck with a single body slide is exempt: pick whatever layout serves it best.
- Stat, visual, and overlay templates are PUNCTUATION, not the argument. Use one ONLY when its "use when" signal is genuinely present in the article: stat fields need hard numbers, quote layouts a quotable sentence, leaderboards a ranking, step layouts a sequence, image slots a relevant image. Respect every AVOID note; a visual that is not needed is filler.
- Never place two pure-stat or overlay body slides back to back; a connective TEXT-RICH page must sit between them.
- STAT PRECISION: every stat must be the exact figure from the article, units kept. Do not round or approximate unless the article does. Each stat must be the figure that PROVES that slide's specific claim; never decorate a slide with a number about something else.
- Numbers and claims only from the article. Never invent data.
- "slotImage": the chosen image (list index or URL) for templates with an image slot, else null.

DISTINCTNESS (across the three plans):
- The three plans must read as genuinely different carousels, each with a different template mix, not the same deck reshuffled.
- Plans may share the cover template ONLY if the article truly demands it (one obvious cover treatment); otherwise pick different covers.
- Prefer different body templates across plans, but REUSE the right body workhorse over forcing a weak fit; the reader sees one plan, not three.

Return JSON exactly in this shape:
{
  "plans": {
    "data":      { "slides": [ { "templateIdx": 0, "fills": { "<field name>": "<text>" }, "slotImage": null } ] },
    "narrative": { "slides": [ ... ] },
    "visual":    { "slides": [ ... ] }
  }
}`;

    // ─── plan call (ONE call for all three; retry ONCE on parse/validation
    // failure). Plans that validated on attempt 1 are kept as-is — the retry
    // only has to fix the rejected ones (its output for already-valid keys is
    // ignored, so a good plan can never regress). Any plan still invalid
    // after the retry is dropped; survivors ship with a warning per drop.
    const validPlans: Partial<Record<PlanKey, PlanSlide[]>> = {};
    const planErrors: Partial<Record<PlanKey, string>> = {};
    try {
      // Three attempts (v3.5): the strict length gate can surface a dozen
      // problems at once and one guided retry does not always clear both the
      // structural asks (quota, cover) and the lengths — a second strict
      // retry converges. Only the final attempt validates leniently (clamp).
      for (let attempt = 0; attempt < 3; attempt++) {
        const missing = PLAN_DIRECTIONS.filter((d) => !validPlans[d.key]);
        if (!missing.length) break;
        const rejectNote = missing
          .filter((d) => planErrors[d.key])
          .map((d) => `the "${d.key}" plan: ${planErrors[d.key]}`)
          .join("; ");
        const prompt = attempt === 0
          ? basePrompt
          : basePrompt + `\n\nYour previous attempt was rejected: ${rejectNote}. Fix that and return the corrected strict JSON only (all three plans, same shape).`;
        try {
          const result = await genJSON<{ plans?: Partial<Record<PlanKey, { slides?: unknown }>> }>({
            system: LIBRARY_SYS,
            maxTokens: 14000, // three full plans in one response
            provider,
            prompt,
          });
          const plansObj = (result && result.plans && typeof result.plans === "object" ? result.plans : {}) as Partial<Record<PlanKey, { slides?: unknown }>>;
          // Lenient (final) attempt: rescue residual over-cap fills with one
          // targeted rewrite call before validate silently clamps them.
          if (attempt > 0) await shortenOverCapFills(plansObj, missing.map((d) => d.key), templates, provider);
          missing.forEach((d) => {
            const raw = plansObj[d.key];
            const v = validatePlan(raw ? raw.slides : undefined, templates, pageCount, imageUrls, usecases, attempt < 2);
            if (v.slides) {
              validPlans[d.key] = v.slides;
              delete planErrors[d.key];
            } else {
              planErrors[d.key] = v.error || "invalid plan";
            }
          });
        } catch (e) {
          if ((e as AnthropicError).status) throw e; // provider/API failure — not fixable by re-prompting
          const msg = e instanceof SyntaxError ? "the response was not valid JSON" : String(e);
          missing.forEach((d) => { planErrors[d.key] = msg; });
        }
        PLAN_DIRECTIONS.forEach((d) => {
          if (!validPlans[d.key]) console.warn(`[api/library] "${d.key}" plan attempt ${attempt + 1} rejected: ${planErrors[d.key]}`);
        });
      }
    } catch (e) {
      if ((e as AnthropicError).status) {
        return NextResponse.json({ error: (e as Error).message || "Library generation failed" }, { status: (e as AnthropicError).status });
      }
      throw e;
    }

    const survivors = PLAN_DIRECTIONS.filter((d) => validPlans[d.key]);
    if (!survivors.length) {
      const detail = PLAN_DIRECTIONS.map((d) => `${d.key}: ${planErrors[d.key] || "invalid plan"}`).join("; ");
      return NextResponse.json({ error: `Library plans failed validation: ${detail}` }, { status: 502 });
    }
    const warnings = PLAN_DIRECTIONS
      .filter((d) => !validPlans[d.key])
      .map((d) => `Dropped the ${d.label} plan: ${planErrors[d.key] || "invalid plan"}`);

    // ─── captions (small second call, /api/carousel "caption" shape) ───
    // ONE set for the whole run — captions describe the article, not a
    // direction, so they're grounded in the first surviving plan's slides
    // (canonical order). A caption failure never sinks valid plans — PUBLISH
    // can regenerate captions on demand, so degrade to [] and log instead.
    const byIdx = new Map(templates.map((t) => [t.idx, t]));
    const captionBasis = validPlans[survivors[0].key]!;
    const slideContent = captionBasis.map((ps, i) => {
      const t = byIdx.get(ps.templateIdx)!;
      const typeLabel = t.family === "cover" ? "COVER" : t.family === "end" ? "CLOSER" : "BODY";
      const parts = t.fields.map((f) => ps.fills[f.name]).filter(Boolean);
      return `${i + 1}. [${typeLabel} · ${t.layout}] ${parts.join(" | ")}`;
    }).join("\n");

    let captionOptions: CaptionOption[] = [];
    try {
      const capResult = await genJSON<CaptionOption[]>({
        system: CAPTION_SYS,
        maxTokens: 2000,
        provider,
        prompt: `Generate 3 caption OPTIONS for this carousel. Each option should take a different angle on presenting this content.

Topic: ${topic}
Slide content:
${slideContent}

Return a JSON array of 3 options. Each option has captions for Instagram, TikTok, and YT Shorts:
[
  {
    "label": "Hook-driven",
    "instagram": { "caption": "full caption with Save CTA + 5-8 hashtags + Location: San Francisco, CA. Under 2200 chars.", "hashtags": ["tag1", "tag2"] },
    "tiktok": { "caption": "all lowercase, casual, hook first line. NO hashtags. NO overlay text." },
    "shorts": { "title": "under 40 chars" }
  },
  { "label": "Data-forward", ... },
  { "label": "Narrative", ... }
]

HARD RULES (absolute):
- X/Twitter (if requested anywhere): NEVER hashtags
- TikTok: NEVER overlay text / on-screen text. NEVER hashtags. Caption only.

Style rules:
- No em dashes, no emojis
- Confident, technical, institutional tone
- Each option should feel genuinely different, not just rewording
- IG: save CTA, hashtags at end, San Francisco CA location
- TikTok: all lowercase, casual, NO hashtags, NO overlay text
- YT Shorts: title only, under 40 chars`,
      });
      if (Array.isArray(capResult)) captionOptions = capResult;
    } catch (e) {
      console.warn(`[api/library] caption generation failed, returning []: ${e instanceof Error ? e.message : String(e)}`);
    }

    // Response (v2 §Q shape): survivors in canonical order; articleText echoes
    // the first ~2000 extracted chars ONLY on url-only runs, so the client
    // can persist the source context it never had.
    const payload: {
      plans: { key: PlanKey; label: string; slides: PlanSlide[] }[];
      captionOptions: CaptionOption[];
      topic: LibTopicKey;
      articleText?: string;
      warnings?: string[];
      ts: number;
    } = {
      plans: survivors.map((d) => ({ key: d.key, label: d.label, slides: validPlans[d.key]! })),
      captionOptions,
      topic,
      ts: Date.now(),
    };
    if (extracted) payload.articleText = articleText.slice(0, 2000);
    if (warnings.length) payload.warnings = warnings;
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof Error && error.message === "ANTHROPIC_API_KEY not configured") {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
