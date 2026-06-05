"use client";
import React, { useState, useEffect, useRef } from "react";
import { exportDocx } from "./docx-export";
import { useUser } from "./user-context";

// ═══ TYPES ═══
interface Guest {
  name: string;
  handle: string;
}

interface EpState {
  number: string;
  link: string;
  transcript: string;
  timestamps?: string;
  extra?: string;
}

interface ThumbnailConcept {
  concept: string;
  text_overlay: string;
  mood: string;
}

interface TitleOption {
  topic: string;
  category: string;
}

interface GeneratedOptions {
  titles: TitleOption[];
  descriptions: string[];
  thumbnails: (string | ThumbnailConcept)[];
}

interface SelectionState {
  title: number;
  desc: number;
  thumb: number;
}

interface FinalizedState {
  title: string;
  description: string;
  thumbnail: string | ThumbnailConcept;
}

interface SocialResult {
  x_hook?: string;
  x_reply?: string;
  linkedin_post?: string;
  linkedin_comment?: string;
  facebook_post?: string;
  facebook_comment?: string;
  instagram_caption?: string;
  yt_shorts_title?: string;
  yt_shorts_desc?: string;
  tiktok_caption?: string;
  [key: string]: string | undefined;
}

interface ClipCaptions {
  x_hook?: string;
  x_reply?: string;
  linkedin_post?: string;
  linkedin_comment?: string;
  facebook_post?: string;
  facebook_comment?: string;
  instagram_caption?: string;
  yt_shorts_title?: string;
  yt_shorts_desc?: string;
  tiktok_caption?: string;
  [key: string]: string | undefined;
}

// Inputs are all optional — the more the user provides, the better the
// captions. We send whatever's filled in; the prompt instructs Claude to
// reference the specific clip moment, not the full episode.
interface ClipInputs {
  topic: string;
  firstLines: string;
  lastLines: string;
  transcript: string;
  context: string;
}

interface ClipResult {
  inputs: ClipInputs;
  captions: ClipCaptions | null;
  generatedAt?: number;
}

// Phase 2A — append-only version history. Every save spawns a fresh
// LogVersion that carries the entire editor snapshot. The legacy flat
// fields on LogEntry (title, description, …) are now a *projection* of
// the top version so older renderers continue to read them transparently.
interface LogVersionPayload {
  ep: EpState;
  guestList: Guest[];
  opts: GeneratedOptions | null;
  sel: SelectionState;
  fin: FinalizedState | null;
  socialRes: SocialResult | null;
  clips: ClipResult[];
  thumb: string | null;
  descLen: string;
}

interface LogVersion {
  versionId: string;             // log-<id>-v<N>
  savedAt: string;               // ISO timestamp
  savedBy: string;               // user.name
  payload: LogVersionPayload;    // full editor snapshot
  changeNote?: string;           // optional, prompted on Save
}

interface LogEntry {
  episode: string;
  title: string;
  description: string;
  guests: string;
  date: string;
  social: SocialResult | null;
  // The two new fields are optional so older log entries continue to work
  // unchanged. id is generated at launch time and used to match the entry
  // when the user clicks "Develop Clips" on a past episode.
  id?: string;
  clips?: ClipResult[];
  // Full editor snapshot — saved going forward so "Edit" can re-open
  // the suite hydrated with the EXACT state from when the episode was
  // saved. Older entries without these fields fall back to a best-
  // effort parse of `guests` + the stored title/description/social.
  ep?: EpState;
  guestList?: Guest[];
  opts?: GeneratedOptions | null;
  sel?: SelectionState;
  thumb?: string | null;
  descLen?: string;
  // Phase 2A — version history. Optional so legacy rows still load
  // without errors; migration wraps them into a synthetic v1 on read.
  versions?: LogVersion[];
  currentVersion?: number;       // 1-indexed pointer into versions[]
  status?: "draft" | "published";
  createdBy?: string;            // pinned; never overwritten on edit
  // Phase 2B — presence stamps. Written when a user opens an entry for
  // editing; cleared on save / publish or after 5-min staleness check.
  editorName?: string;
  editorStartedAt?: string;      // ISO timestamp
  lastEditedBy?: string;
  lastEditedAt?: string;         // ISO timestamp — drives presence banner
}

interface ConfettiPiece {
  left: string;
  color: string;
  delay: string;
  dur: string;
  size: number;
  drift: number;
  rot: number;
  shape: string;
}

interface FKProspect {
  id: string;
  name: string;
  company?: string;
  role?: string;
  tier?: string;
  [key: string]: unknown;
}

interface CheckResult {
  score: number;
  feedback: string;
  suggestions?: string[];
}

interface ABOption {
  title?: string;
  thumbnail_concept?: string;
  score: number;
  reasoning: string;
}

interface ABResult {
  option_a: ABOption;
  option_b: ABOption;
  verdict: string;
}

interface DocSection {
  heading: string;
  items: { label: string; content: string }[];
}

interface SocialField {
  key: string;
  label: string;
  color?: string;
  plat?: string;
}

// ═══ DESIGN (coral accent for PODCAST) ═══
var D = {
  bg: "#060608", surface: "#09090D", elevated: "#0D0D12",
  border: "rgba(255,255,255,0.06)", borderHover: "rgba(255,255,255,0.12)",
  amber: "#F7B041", blue: "#0B86D1", teal: "#2EAD8E", coral: "#E06347", violet: "#905CCB",
  tx: "#ffffff", txb: "rgba(255,255,255,0.55)", txl: "rgba(255,255,255,0.4)", txh: "rgba(255,255,255,0.12)",
};
var ft = "'Outfit',sans-serif";
var gf = "'Grift','Outfit',sans-serif";
var mn = "'JetBrains Mono',monospace";
var ACC = D.coral; // accent color for this flow

var PL = { x: "#1DA1F2", li: "#0A66C2", fb: "#1877F2", ig: "#E4405F", yt: "#FF0000", tt: "#00F2EA" };

var SYS_EP = "You are a content strategist for SemiAnalysis Weekly, a podcast on semiconductors and AI infrastructure.\n\nTITLE FORMAT (mandatory). Episode titles always render as `Ep. {number} - {Topic} ({Category})`. You return ONLY the topic and category fields. The client builds the full string and appends guest names for Spotify. Do not include `Ep.`, the number, or guest names in your output.\n\n- Topic: the episode's hook in 5-12 words. A concrete claim, sharp question, or specific framing. Reference a real thing happening (a number, a company, a tradeoff, a controversy). Avoid 'Why X matters', 'Everything you need to know', 'A deep dive into...', 'The future of...', 'Understanding X'.\n- Category: a 1-4 word topic tag in title case. Examples: 'AI Cloud TCO', 'Memory, Tokenomics, Macro', 'AI Supply Chain & Fabs', 'Datacenter, Energy', 'Core Research', 'Technical Staff', 'AI Supply Chain', 'ChipBook'.\n\nLENGTH BUDGET. The full assembled string `Ep. {number} - {Topic} ({Category})` must fit ≤ 100 characters total (YouTube limit). Plan your topic length around the episode number and category that will be appended. If it doesn't fit, shorten the topic — never the format.\n\nGOOD title examples (full strings, for calibration):\n- Ep. 010 - How Much Do GPUs Really Cost, and Where Does the Value Go? (AI Cloud TCO)\n- Ep. 008 - Claude Code Psychosis: How SemiAnalysis Is Token Mogging Meta\n- Ep. 007 - The 3 Choke Points Killing the AI Boom (Core Research)\n- Ep. 005 - Measuring AI's Impact On The Market (Memory, Tokenomics, Macro)\n\nBAD title examples (do not write like these):\n- 'Why Memory Is the Next Bottleneck' (vague, opinion-ish)\n- 'Everything You Need To Know About HBM' (clickbait scaffold)\n- 'A Deep Dive Into Vera Rubin' (deep dive cliche)\n- 'The AI Revolution Is Here' (hype + zero specifics)\n\nVOICE.\n- Never use em dashes. Use commas, periods, or colons.\n- No emojis.\n- Direct, specific, technical. Never clickbait.\n- No hype words: 'revolutionary', 'unleashed', 'game-changing', 'next-gen', 'bleeding-edge', 'transform', 'dive into', 'unlock', 'seamless'.\n- No rhetorical openers: avoid starting with 'Why', 'How', or a question unless the question is the actual hook of the episode.\n- Plain declarative sentences. Lead with the most concrete fact.\n\nDESCRIPTIONS. When mentioning guests, include their social handle in parentheses on first mention, e.g. Jordan Nanos (@JordanNanos). Open with a concrete hook or stat from the episode, never with 'In this episode'.\n\nRESPOND ONLY IN VALID JSON. No markdown fences. No preamble.";

var SYS_SOC = "You are a social media strategist for SemiAnalysis Weekly. HARD RULES (absolute): X/Twitter NEVER hashtags, not one, ever. TikTok NEVER overlay text or on-screen text, caption only. Style rules: Never use em dashes. No emojis. YT Shorts titles under 40 chars. Instagram: caption + Save this for later CTA + 5-8 hashtags + location San Francisco CA, point to youtube.com/@SemianalysisWeekly. TikTok: all lowercase caption only, NO hashtags, NO overlay text. LinkedIn/Facebook: link in first comment, end Link in comments. X: Hook tweet no link + reply-to-self with link, NO hashtags. Mention all guests with handles on every platform. RESPOND ONLY IN VALID JSON. No markdown fences. No preamble.";

// ═══ API ═══
import { showToast } from "./toast-context";
import { getSurfaceProvider, getPreferredProvider } from "./shared-constants";
import { ProviderChips } from "./provider-chips";
import { confirmDialog } from "./dialog-context";
import { VersionTimelineModal } from "./components/version-timeline-modal";

async function ask(sys: string, prompt: string): Promise<Record<string, unknown> | null> {
  try {
    var provider = getSurfaceProvider("sa-weekly") || getPreferredProvider();
    var r = await fetch("/api/generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: sys, prompt: prompt, provider: provider, applyBrandVoice: true }),
    });
    var d = await r.json();
    if (d.error) { showToast("API Error: " + (d.error.message || d.error)); return null; }
    if (!d.content) { showToast("API returned empty response. Check your ANTHROPIC_API_KEY in Vercel env vars."); return null; }
    var t = (d.content || []).map(function(c: { text?: string }) { return c.text || ""; }).join("");
    try {
      return JSON.parse(t.replace(/```json|```/g, "").trim());
    } catch (pe) { showToast("Failed to parse API response. The model returned invalid JSON."); console.error("Parse error:", t); return null; }
  } catch (e) { showToast("Network error: Could not reach /api/generate"); console.error("API:", e); return null; }
}

function buildPrompt(parts: (string | null | undefined | false)[]): string { return parts.filter(Boolean).join("\n\n"); }

// Next episode number = max(log entries) + 1, zero-padded to 3 digits.
// Empty log → "001". Used to seed Setup with the obvious next-up so
// the user doesn't have to remember "what was the last one".
function nextEpisodeNumber(log: LogEntry[]): string {
  var max = 0;
  for (var i = 0; i < log.length; i++) {
    var raw = String(log[i] && log[i].episode || "").replace(/\D/g, "");
    var n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return String(max + 1).padStart(3, "0");
}

// Frequent SemiAnalysis Weekly guests. Quick-add chips in the Guest
// Manager skip the typing dance for the regulars. Edit handles here
// when someone changes theirs — single source of truth.
var FREQUENT_GUESTS: Guest[] = [
  { name: "Dylan Patel",            handle: "@dylan522p"        },
  { name: "Doug O'Laughlin",        handle: "@Doug_OLaughlin"   },
  { name: "Jeremie Eliahou Ontiveros", handle: "@JeremieEli"    },
  { name: "Jordan Nanos",           handle: "@JordanNanos"      },
  { name: "Daniel Nishball",        handle: "@dnishball"        },
  { name: "George Cozma",           handle: "@GeorgeCozma"      },
  { name: "Tanj Bennett",           handle: "@tanjbennett"      },
  { name: "Wei Zhou",               handle: "@weizhou"          },
];

// Compose the final YouTube description by deterministically appending
// the user's timestamps (if any) as a "Chapters:" block. Guards against
// double-append in case the AI already included them. Used by the
// Export step + launch-kit DOCX + "Copy all" so timestamps never get
// dropped at the finish line.
function composeDescription(description: string, timestamps: string | undefined): string {
  var desc = (description || "").trim();
  var ts = (timestamps || "").trim();
  if (!ts) return desc;
  // If the description already contains the chapter block (AI included
  // it during Generate), don't duplicate. We check on the FIRST 20
  // chars of the timestamps block to be tolerant of light edits.
  var probe = ts.slice(0, 20);
  if (probe && desc.indexOf(probe) >= 0) return desc;
  return desc + "\n\nChapters:\n" + ts;
}

function copyText(str: string): boolean {
  try { var ta = document.createElement("textarea"); ta.value = str; ta.style.position = "fixed"; ta.style.left = "-9999px"; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); return true; } catch (e) { try { navigator.clipboard.writeText(str); return true; } catch (e2) { return false; } }
}

function gStr(guests: Guest[]): string { return guests.filter(function(g: Guest) { return g.name; }).map(function(g: Guest) { return g.handle ? g.name + " (" + g.handle + ")" : g.name; }).join(", ") || "TBD"; }

// Render `Ep. NNN - Topic (Category)`. Pads ep number to 3 digits.
// Category is optional — falls back to no parens when missing.
function buildYoutubeTitle(epNum: string, topic: string, category: string): string {
  var num = String(epNum || "").trim();
  if (num && /^\d+$/.test(num)) num = num.padStart(3, "0");
  var t = (topic || "").trim();
  var c = (category || "").trim();
  return "Ep. " + (num || "?") + " - " + t + (c ? " (" + c + ")" : "");
}

// Append `| Name, Name, Name` until it fits in 200 chars. Drops trailing names
// whole rather than mid-name truncation. Falls back to YouTube title alone if
// even one guest can't fit.
function buildSpotifyTitle(yt: string, guests: Guest[]): string {
  var names = guests.filter(function(g: Guest) { return g.name; }).map(function(g: Guest) { return g.name; });
  if (!names.length) return yt;
  var active = names.slice();
  var candidate = yt + " | " + active.join(", ");
  while (candidate.length > 200 && active.length > 0) {
    active.pop();
    candidate = active.length ? yt + " | " + active.join(", ") : yt;
  }
  return candidate;
}

// Coerce a title slot from the model into a TitleOption. Tolerates legacy
// rows that may still be plain strings (saved log entries pre-format).
function asTitleOption(t: unknown): TitleOption {
  if (t && typeof t === "object" && "topic" in (t as Record<string, unknown>)) {
    var o = t as Record<string, unknown>;
    return { topic: String(o.topic || ""), category: String(o.category || "") };
  }
  return { topic: typeof t === "string" ? t : "", category: "" };
}
function thTxt(th: string | ThumbnailConcept | null): string { if (!th) return ""; if (typeof th === "string") return th; return th.concept + '\nText: "' + th.text_overlay + '"\nMood: ' + th.mood; }

function exportDoc(title: string, sections: DocSection[]): void {
  exportDocx(title, sections);
}

// ═══ PHASE 2A · VERSION HISTORY HELPERS ═══
// Build a LogVersionPayload from the editor's working state. The same
// snapshot is captured for every append, so re-running this from the
// same UI state is deterministic.
function buildPayload(p: {
  ep: EpState;
  guests: Guest[];
  opts: GeneratedOptions | null;
  sel: SelectionState;
  fin: FinalizedState | null;
  socialRes: SocialResult | null;
  clips: ClipResult[];
  thumb: string | null;
  descLen: string;
}): LogVersionPayload {
  return {
    ep: p.ep,
    guestList: p.guests,
    opts: p.opts,
    sel: p.sel,
    fin: p.fin,
    socialRes: p.socialRes,
    clips: p.clips,
    thumb: p.thumb,
    descLen: p.descLen,
  };
}

// Non-destructive migration. Legacy entries lack `versions` — wrap their
// existing flat fields into a synthetic v1 so the rest of the codebase
// can treat every entry as versioned. Idempotent: returns the entry
// unchanged if it's already in the new shape.
function migrateLogEntry(entry: LogEntry): LogEntry {
  if (entry.versions && entry.versions.length > 0) return entry;
  var id = entry.id || ("log-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8));
  var payload: LogVersionPayload = {
    ep: entry.ep || { number: entry.episode, link: "", transcript: "", timestamps: "", extra: "" },
    guestList: entry.guestList || [],
    opts: entry.opts || null,
    sel: entry.sel || { title: 0, desc: 0, thumb: 0 },
    fin: entry.title || entry.description ? { title: entry.title, description: entry.description, thumbnail: "" } : null,
    socialRes: entry.social,
    clips: entry.clips || [],
    thumb: entry.thumb || null,
    descLen: entry.descLen || "medium",
  };
  // Reconstruct an ISO timestamp from `date` when we can; otherwise use now.
  var savedAtISO: string;
  try {
    var d = new Date(entry.date);
    savedAtISO = isFinite(d.getTime()) ? d.toISOString() : new Date().toISOString();
  } catch (_e) {
    savedAtISO = new Date().toISOString();
  }
  var v1: LogVersion = {
    versionId: "log-" + id + "-v1",
    savedAt: savedAtISO,
    savedBy: entry.createdBy || "Unknown",
    payload: payload,
    changeNote: undefined,
  };
  return Object.assign({}, entry, {
    id: id,
    versions: [v1],
    currentVersion: 1,
    status: (entry.status as "draft" | "published") || "published",
    createdBy: entry.createdBy || "Unknown",
  });
}

// Project the legacy flat fields from the top version of a versioned
// entry. Run every time a new version is appended so the legacy view
// (Activity Log card, Launch Kit, etc.) stays accurate without changing
// downstream code.
function projectLegacyFields(entry: LogEntry): LogEntry {
  if (!entry.versions || !entry.versions.length) return entry;
  var idx = Math.max(0, Math.min(entry.versions.length - 1, (entry.currentVersion || entry.versions.length) - 1));
  var v = entry.versions[idx];
  var p = v.payload;
  var fin = p.fin || { title: entry.title || "", description: entry.description || "", thumbnail: "" };
  var guestsStr = (p.guestList || []).filter(function(g) { return g && g.name; }).map(function(g) { return g.name; }).join(", ") || entry.guests || "";
  return Object.assign({}, entry, {
    title: fin.title || entry.title || "",
    description: fin.description || entry.description || "",
    guests: guestsStr,
    social: p.socialRes,
    clips: (p.clips && p.clips.length) ? p.clips : undefined,
    ep: p.ep,
    guestList: p.guestList,
    opts: p.opts,
    sel: p.sel,
    thumb: p.thumb,
    descLen: p.descLen,
  });
}

// Append-only save. Returns the new entry with the new version on top.
function appendVersion(
  entry: LogEntry,
  payload: LogVersionPayload,
  savedBy: string,
  changeNote?: string,
): LogEntry {
  var migrated = migrateLogEntry(entry);
  var versions = (migrated.versions || []).slice();
  var nextN = versions.length + 1;
  var version: LogVersion = {
    versionId: "log-" + (migrated.id || "x") + "-v" + nextN,
    savedAt: new Date().toISOString(),
    savedBy: savedBy || "Unknown",
    payload: payload,
    changeNote: changeNote && changeNote.trim() ? changeNote.trim() : undefined,
  };
  versions.push(version);
  var withVersion = Object.assign({}, migrated, {
    versions: versions,
    currentVersion: nextN,
    lastEditedBy: savedBy || "Unknown",
    lastEditedAt: version.savedAt,
  });
  return projectLegacyFields(withVersion);
}

// Returns ms since lastEditedAt, or Infinity when never edited.
function msSinceLastEdit(entry: LogEntry): number {
  var t = entry.lastEditedAt || (entry.versions && entry.versions.length ? entry.versions[entry.versions.length - 1].savedAt : null);
  if (!t) return Infinity;
  var ms = Date.now() - new Date(t).getTime();
  return isFinite(ms) ? ms : Infinity;
}

// "4 min ago" / "32 sec ago" / "2 hr ago" / "3 days ago" — small util
// shared by the presence banner + version timeline rows.
function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "just now";
  var ms = Date.now() - new Date(iso).getTime();
  if (!isFinite(ms) || ms < 0) return "just now";
  var sec = Math.floor(ms / 1000);
  if (sec < 60) return sec + " sec ago";
  var min = Math.floor(sec / 60);
  if (min < 60) return min + " min ago";
  var hr = Math.floor(min / 60);
  if (hr < 24) return hr + " hr ago";
  var d = Math.floor(hr / 24);
  return d + " day" + (d === 1 ? "" : "s") + " ago";
}

// Phase 2E — per-user draft scratch via localStorage. Shared row
// `weekly-master` keeps only the published log; in-flight transcript
// pastes live per-user so Akash's draft doesn't bleed into Vansh's
// session. Keyed by user name (falls back to "anon").
var DRAFT_STORAGE_PREFIX = "poast-weekly-draft:";
function draftKeyFor(userName: string | null | undefined): string {
  return DRAFT_STORAGE_PREFIX + (userName && userName.trim() ? userName.trim() : "anon");
}
function readUserDraft(userName: string | null | undefined): Record<string, unknown> | null {
  try {
    if (typeof window === "undefined") return null;
    var raw = window.localStorage.getItem(draftKeyFor(userName));
    if (!raw) return null;
    var parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_e) {
    return null;
  }
}
function writeUserDraft(userName: string | null | undefined, state: Record<string, unknown>): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(draftKeyFor(userName), JSON.stringify(state));
  } catch (_e) {
    /* swallow quota errors */
  }
}
function clearUserDraft(userName: string | null | undefined): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(draftKeyFor(userName));
  } catch (_e) {
    /* ignore */
  }
}

// ═══ UI COMPONENTS ═══
function ProgressBar({ label }: { label?: string }) {
  return <div style={{ margin: "22px 0" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <div style={{ fontFamily: mn, fontSize: 11, color: ACC, letterSpacing: "2px", textTransform: "uppercase" }}>{label || "Generating..."}</div>
      <div className="progress-dots" style={{ fontFamily: mn, fontSize: 10, color: "rgba(255,255,255,0.4)" }} />
    </div>
    <div style={{ width: "100%", height: 2, background: "rgba(255,255,255,0.06)", borderRadius: 1, overflow: "hidden", position: "relative" }}>
      <div className="progress-slide" style={{ position: "absolute", top: 0, left: 0, height: "100%", width: "40%", borderRadius: 1, background: "linear-gradient(90deg, transparent, " + ACC + ", transparent)" }} />
    </div>
  </div>;
}

function Label({ children }: { children: React.ReactNode }) { return <div style={{ fontFamily: mn, fontSize: 11, color: ACC, textTransform: "uppercase", letterSpacing: "2px", marginBottom: 8 }}>{children}</div>; }

function Field({ label, value, onChange, placeholder, isMono }: { label?: string; value: string; onChange: (v: string) => void; placeholder?: string; isMono?: boolean }) { return (<div style={{ marginBottom: 16 }}>{label && <Label>{label}</Label>}<input value={value} onChange={function(e: React.ChangeEvent<HTMLInputElement>) { onChange(e.target.value); }} placeholder={placeholder} style={{ width: "100%", padding: "12px 14px", background: D.surface, border: "1px solid " + D.border, borderRadius: 10, color: D.tx, fontFamily: isMono ? mn : ft, fontSize: 14, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s ease, box-shadow 0.2s ease" }} onFocus={function(e) { e.target.style.borderColor = ACC; e.target.style.boxShadow = "0 0 24px rgba(224,99,71,0.06)"; }} onBlur={function(e) { e.target.style.borderColor = D.border; e.target.style.boxShadow = "none"; }} /></div>); }

function Btn({ children, onClick, loading, sec, sm, off }: { children: React.ReactNode; onClick?: () => void; loading?: boolean; sec?: boolean; sm?: boolean; off?: boolean }) { return (<button onClick={onClick} disabled={loading || off} style={{ padding: sm ? "8px 16px" : "12px 28px", background: off ? D.surface : sec ? "transparent" : "linear-gradient(135deg, " + ACC + ", #C84E35)", color: off ? "rgba(255,255,255,0.4)" : sec ? ACC : "#ffffff", border: sec ? "1px solid " + (off ? D.border : ACC) : "none", borderRadius: 10, fontFamily: ft, fontSize: sm ? 12 : 14, fontWeight: 800, cursor: loading || off ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1, letterSpacing: -0.3, transition: "all 0.2s ease" }}>{loading ? "Working..." : children}</button>); }

function CopyBtn({ text }: { text: string }) { var _s = useState<boolean>(false), ok = _s[0], set = _s[1]; return <span onClick={function(e: React.MouseEvent) { e.stopPropagation(); set(copyText(text)); setTimeout(function() { set(false); }, 1200); }} style={{ fontFamily: mn, fontSize: 9, color: ok ? ACC : "rgba(255,255,255,0.4)", cursor: "pointer", padding: "3px 8px", borderRadius: 6, border: "1px solid " + D.border, userSelect: "none", transition: "all 0.2s ease" }}>{ok ? "Copied" : "Copy"}</span>; }

function Divider() { return <div style={{ borderBottom: "1px solid " + D.border, margin: "28px 0" }} />; }

function Pick({ text, picked, onPick, onRedo, rLoading }: { text: string; picked: boolean; onPick: () => void; onRedo?: () => void; rLoading?: boolean }) {
  return (<div onClick={onPick} style={{ background: picked ? "linear-gradient(135deg, " + ACC + "0A 0%, " + ACC + "05 100%)" : D.elevated, border: "1px solid " + (picked ? ACC + "60" : D.border), borderRadius: 12, padding: "16px 20px", marginBottom: 8, cursor: "pointer", boxShadow: picked ? "0 0 24px rgba(224,99,71,0.06)" : "none", transition: "all 0.2s ease" }}>
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, marginTop: 2, border: "2px solid " + (picked ? ACC : D.borderHover), background: picked ? ACC : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease" }}>{picked && <div style={{ width: 8, height: 8, borderRadius: "50%", background: D.bg }} />}</div>
      <div style={{ flex: 1, fontFamily: ft, fontSize: 14, color: picked ? D.tx : D.txb, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{text}</div>
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        <CopyBtn text={text} />
        {onRedo && <span onClick={function(e: React.MouseEvent) { e.stopPropagation(); if (!rLoading) onRedo(); }} style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.4)", cursor: rLoading ? "wait" : "pointer", padding: "3px 8px", borderRadius: 6, border: "1px solid " + D.border, opacity: rLoading ? 0.4 : 1, userSelect: "none", transition: "all 0.2s ease" }}>&#x21bb;</span>}
      </div>
    </div>
  </div>);
}

function TitlePick({ option, epNum, guests, picked, onPick, onRedo, rLoading }: { option: TitleOption; epNum: string; guests: Guest[]; picked: boolean; onPick: () => void; onRedo?: () => void; rLoading?: boolean }) {
  var yt = buildYoutubeTitle(epNum, option.topic, option.category);
  var sp = buildSpotifyTitle(yt, guests);
  var ytLen = yt.length;
  var spLen = sp.length;
  var ytOver = ytLen > 100;
  var spOver = spLen > 200;
  var copyVal = "YouTube:\n" + yt + "\n\nSpotify:\n" + sp;
  return (<div onClick={onPick} style={{ background: picked ? "linear-gradient(135deg, " + ACC + "0A 0%, " + ACC + "05 100%)" : D.elevated, border: "1px solid " + (picked ? ACC + "60" : D.border), borderRadius: 12, padding: "16px 20px", marginBottom: 8, cursor: "pointer", boxShadow: picked ? "0 0 24px rgba(224,99,71,0.06)" : "none", transition: "all 0.2s ease" }}>
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, marginTop: 2, border: "2px solid " + (picked ? ACC : D.borderHover), background: picked ? ACC : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease" }}>{picked && <div style={{ width: 8, height: 8, borderRadius: "50%", background: D.bg }} />}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
          <div style={{ fontFamily: mn, fontSize: 9, color: PL.yt, letterSpacing: "1.5px", fontWeight: 700 }}>YOUTUBE</div>
          <div style={{ fontFamily: mn, fontSize: 9, color: ytOver ? D.coral : D.txl, fontWeight: ytOver ? 700 : 400 }}>{ytLen}/100{ytOver ? " over" : ""}</div>
        </div>
        <div style={{ fontFamily: ft, fontSize: 14, color: picked ? D.tx : D.txb, lineHeight: 1.55, marginBottom: 10, wordBreak: "break-word" }}>{yt}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
          <div style={{ fontFamily: mn, fontSize: 9, color: "#1DB954", letterSpacing: "1.5px", fontWeight: 700 }}>SPOTIFY</div>
          <div style={{ fontFamily: mn, fontSize: 9, color: spOver ? D.coral : D.txl, fontWeight: spOver ? 700 : 400 }}>{spLen}/200{spOver ? " over" : ""}</div>
        </div>
        <div style={{ fontFamily: ft, fontSize: 13, color: picked ? D.txb : D.txl, lineHeight: 1.55, wordBreak: "break-word" }}>{sp}</div>
      </div>
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        <CopyBtn text={copyVal} />
        {onRedo && <span onClick={function(e: React.MouseEvent) { e.stopPropagation(); if (!rLoading) onRedo(); }} style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.4)", cursor: rLoading ? "wait" : "pointer", padding: "3px 8px", borderRadius: 6, border: "1px solid " + D.border, opacity: rLoading ? 0.4 : 1, userSelect: "none", transition: "all 0.2s ease" }}>&#x21bb;</span>}
      </div>
    </div>
  </div>);
}

function SecHead({ label, onRedoAll, rL }: { label: string; onRedoAll?: () => void; rL?: boolean }) {
  return (<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
    <div style={{ fontFamily: mn, fontSize: 11, color: ACC, textTransform: "uppercase", letterSpacing: "2px", fontWeight: 700 }}>{label}</div>
    {onRedoAll && <span onClick={function() { if (!rL) onRedoAll(); }} style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.4)", cursor: rL ? "wait" : "pointer", padding: "4px 10px", borderRadius: 8, border: "1px solid " + D.border, opacity: rL ? 0.4 : 1, transition: "all 0.2s ease" }}>&#x21bb; Redo All 3</span>}
  </div>);
}

function OutCard({ title, content, color, onRedo, rLoading }: { title: string; content: string; color?: string; onRedo?: () => void; rLoading?: boolean }) {
  return (<div style={{ background: D.elevated, border: "1px solid " + D.border, borderLeft: "3px solid " + (color || ACC), borderRadius: 12, padding: "16px 20px", marginBottom: 10, boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
      <div style={{ fontFamily: mn, fontSize: 11, color: color || ACC, textTransform: "uppercase", letterSpacing: "2px" }}>{title}</div>
      <div style={{ display: "flex", gap: 5 }}>
        <CopyBtn text={content} />
        {onRedo && <span onClick={function() { if (!rLoading) onRedo(); }} style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.4)", cursor: rLoading ? "wait" : "pointer", padding: "3px 8px", borderRadius: 6, border: "1px solid " + D.border, opacity: rLoading ? 0.4 : 1, userSelect: "none", transition: "all 0.2s ease" }}>&#x21bb;</span>}
      </div>
    </div>
    <div style={{ fontFamily: ft, fontSize: 14, color: D.txb, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{content}</div>
  </div>);
}

// ═══ STEP TRACKER (P2P-style numbered circles) ═══
function StepTracker({ current, steps, canNavigate, onNav }: { current: number; steps: string[]; canNavigate?: (i: number) => boolean; onNav: (i: number) => void }) {
  var progress = ((current + 1) / steps.length) * 100;
  return <div style={{ marginBottom: 40 }}>
    {/* Progress bar */}
    <div style={{ height: 4, background: D.border, borderRadius: 2, marginBottom: 20, overflow: "hidden" }}>
      <div style={{ height: "100%", width: progress + "%", background: "linear-gradient(90deg, " + ACC + ", " + D.teal + ")", borderRadius: 2, transition: "width 0.5s cubic-bezier(0.16, 1, 0.3, 1)" }} />
    </div>
    {/* Step labels */}
    <div style={{ display: "flex", gap: 0 }}>
      {steps.map(function(s, i) {
        var done = i < current; var active = i === current; var future = i > current;
        var clickable = done || (canNavigate && canNavigate(i));
        return <div key={i} onClick={function() { if (clickable) onNav(i); }} style={{ flex: 1, textAlign: "center", cursor: clickable ? "pointer" : "default", opacity: future ? 0.3 : 1, transition: "opacity 0.2s" }}>
          <div style={{ fontFamily: mn, fontSize: 24, fontWeight: 900, color: done ? D.teal : active ? ACC : D.txl, transition: "color 0.3s", textShadow: active ? "0 0 20px " + ACC + "40" : "none" }}>{done ? "\u2713" : i + 1}</div>
          <div style={{ fontFamily: ft, fontSize: 11, fontWeight: active ? 700 : 500, color: active ? D.tx : D.txl, marginTop: 4, letterSpacing: active ? 0.5 : 0 }}>{s}</div>
        </div>;
      })}
    </div>
  </div>;
}

// ═══ CONFETTI ═══
function Confetti() {
  var pieces = useRef<ConfettiPiece[]>([]);
  if (pieces.current.length === 0) {
    var colors = [ACC, D.amber, D.blue, D.teal, D.violet, "#26C9D8", "#56BC42", "#E8C83A"];
    for (var i = 0; i < 80; i++) {
      pieces.current.push({
        left: Math.random() * 100 + "%",
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 0.8 + "s",
        dur: 2 + Math.random() * 2 + "s",
        size: 4 + Math.random() * 6,
        drift: -40 + Math.random() * 80,
        rot: Math.random() * 720,
        shape: Math.random() > 0.5 ? "circle" : "rect",
      });
    }
  }
  return <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 1000 }}>
    <style dangerouslySetInnerHTML={{ __html: "@keyframes confetti-fall{0%{transform:translateY(-20px) translateX(0) rotate(0deg);opacity:1}70%{opacity:1}100%{transform:translateY(calc(80vh)) translateX(var(--drift)) rotate(var(--rot));opacity:0}}" }} />
    {pieces.current.map(function(p: ConfettiPiece, i: number) {
      return <div key={i} style={{
        position: "absolute", top: 0, left: p.left,
        width: p.shape === "circle" ? p.size : p.size * 0.6, height: p.size,
        borderRadius: p.shape === "circle" ? "50%" : "1px",
        background: p.color,
        "--drift": p.drift + "px", "--rot": p.rot + "deg",
        animation: "confetti-fall " + p.dur + " cubic-bezier(0.25,0.46,0.45,0.94) " + p.delay + " forwards",
      } as React.CSSProperties} />;
    })}
  </div>;
}

// ═══ GUEST MANAGER ═══
function GuestManager({ guests, setGuests }: { guests: Guest[]; setGuests: (g: Guest[]) => void }) {
  var _guestBrowse = useState<boolean>(false), guestBrowseOpen = _guestBrowse[0], setGuestBrowseOpen = _guestBrowse[1];
  var _fkGuests = useState<FKProspect[]>([]), fkGuests = _fkGuests[0], setFkGuests = _fkGuests[1];
  var _fkSearch = useState<string>(""), fkSearch = _fkSearch[0], setFkSearch = _fkSearch[1];
  var _fkLoading = useState<boolean>(false), fkLoading = _fkLoading[0], setFkLoading = _fkLoading[1];

  var tierColors: Record<string, string> = { S: "#F7B041", A: "#0B86D1", B: "#2EAD8E", C: "rgba(255,255,255,0.4)" };

  function loadFKGuests() {
    setFkLoading(true);
    fetch("/api/db?table=prospects").then(function(r) { return r.json(); }).then(function(res) {
      if (res.data) setFkGuests(res.data);
      setFkLoading(false);
    }).catch(function() { setFkLoading(false); });
  }

  function toggleBrowse() {
    var next = !guestBrowseOpen;
    setGuestBrowseOpen(next);
    if (next && fkGuests.length === 0) loadFKGuests();
    if (!next) setFkSearch("");
  }

  function addFKGuest(prospect: FKProspect) {
    var name = prospect.name || "";
    var handle = "";
    setGuests(guests.concat([{ name: name, handle: handle }]));
    setGuestBrowseOpen(false);
    setFkSearch("");
    showToast("Added " + name + " from FK prospects");
  }

  var filteredFK = fkGuests.filter(function(p: FKProspect) {
    if (!fkSearch) return true;
    var q = fkSearch.toLowerCase();
    return (p.name || "").toLowerCase().indexOf(q) > -1 || (p.company || "").toLowerCase().indexOf(q) > -1;
  });

  // Quick-pick popup state for SemiAnalysis Weekly's frequent guests.
  var _quick = useState<boolean>(false), quickOpen = _quick[0], setQuickOpen = _quick[1];
  function addFrequent(g: Guest) {
    // Skip if guest is already in the list (case-insensitive name match).
    var already = guests.some(function(x) { return (x.name || "").toLowerCase().trim() === (g.name || "").toLowerCase().trim(); });
    if (already) { showToast(g.name + " is already added"); return; }
    setGuests(guests.concat([{ name: g.name, handle: g.handle }]));
    showToast("Added " + g.name);
  }
  return (<div style={{ marginBottom: 20 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <Label>Guests</Label>
      <div style={{ display: "flex", gap: 6 }}>
        <span onClick={function() { setQuickOpen(function(v) { return !v; }); }} style={{ fontFamily: mn, fontSize: 10, color: quickOpen ? D.amber : D.txb, cursor: "pointer", padding: "4px 10px", borderRadius: 8, border: "1px solid " + (quickOpen ? D.amber + "60" : D.border), background: quickOpen ? D.amber + "0A" : "transparent", transition: "all 0.2s ease" }}>Frequent</span>
        <span onClick={toggleBrowse} style={{ fontFamily: mn, fontSize: 10, color: guestBrowseOpen ? D.teal : D.txb, cursor: "pointer", padding: "4px 10px", borderRadius: 8, border: "1px solid " + (guestBrowseOpen ? D.teal + "60" : D.border), background: guestBrowseOpen ? D.teal + "0A" : "transparent", transition: "all 0.2s ease" }}>Browse FK</span>
        <span onClick={function() { setGuests(guests.concat([{ name: "", handle: "" }])); }} style={{ fontFamily: mn, fontSize: 10, color: ACC, cursor: "pointer", padding: "4px 10px", borderRadius: 8, border: "1px solid " + D.border, transition: "all 0.2s ease" }}>+ Add</span>
      </div>
    </div>
    {/* Frequent guests quick-pick. Click a chip → adds (with handle). */}
    {quickOpen && <div style={{ background: D.elevated, border: "1px solid " + D.amber + "30", borderRadius: 12, padding: 14, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <div style={{ fontFamily: mn, fontSize: 9.5, color: D.amber, letterSpacing: "1.5px", fontWeight: 700, textTransform: "uppercase" }}>Frequent · click to add</div>
        <span onClick={function() { setQuickOpen(false); }} style={{ fontFamily: mn, fontSize: 10, color: D.txl, cursor: "pointer" }}>Close</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {FREQUENT_GUESTS.map(function(g) {
          var added = guests.some(function(x) { return (x.name || "").toLowerCase().trim() === g.name.toLowerCase().trim(); });
          return <span key={g.name}
            onClick={function() { addFrequent(g); }}
            style={{
              padding: "6px 11px",
              background: added ? D.teal + "12" : D.surface,
              border: "1px solid " + (added ? D.teal + "50" : D.border),
              color: added ? D.teal : D.tx,
              borderRadius: 999,
              cursor: added ? "default" : "pointer",
              fontFamily: ft, fontSize: 12, fontWeight: 700,
              display: "inline-flex", alignItems: "center", gap: 6,
              transition: "background 0.15s ease, border-color 0.15s ease",
            }}
            title={added ? "Already added" : "Add " + g.name + " " + g.handle}
          >
            {added ? "✓ " : "+ "}{g.name}
            <span style={{ fontFamily: mn, fontSize: 9.5, color: added ? D.teal : D.txl }}>{g.handle}</span>
          </span>;
        })}
      </div>
    </div>}
    {/* FK Prospects Browse Panel */}
    {guestBrowseOpen && <div style={{ background: D.elevated, border: "1px solid " + D.border, borderRadius: 12, padding: 14, marginBottom: 12, maxHeight: 280, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <input value={fkSearch} onChange={function(e: React.ChangeEvent<HTMLInputElement>) { setFkSearch(e.target.value); }} placeholder="Search FK prospects..." style={{ width: "100%", padding: "8px 12px", background: D.surface, border: "1px solid " + D.border, borderRadius: 8, color: D.tx, fontFamily: mn, fontSize: 11, outline: "none", boxSizing: "border-box", marginBottom: 8, transition: "border-color 0.2s ease" }} onFocus={function(e) { e.target.style.borderColor = ACC; }} onBlur={function(e) { e.target.style.borderColor = D.border; }} />
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
        {fkLoading && <div style={{ fontFamily: mn, fontSize: 10, color: D.txl, textAlign: "center", padding: 16 }}>Loading...</div>}
        {!fkLoading && filteredFK.length === 0 && <div style={{ fontFamily: mn, fontSize: 10, color: D.txl, textAlign: "center", padding: 16 }}>No prospects found</div>}
        {!fkLoading && filteredFK.map(function(p: FKProspect) {
          return <div key={p.id} onClick={function() { addFKGuest(p); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: D.surface, borderRadius: 8, cursor: "pointer", border: "1px solid " + D.border, transition: "all 0.15s ease" }}>
            <div>
              <div style={{ fontFamily: ft, fontSize: 13, fontWeight: 700, color: D.tx }}>{p.name}</div>
              <div style={{ fontFamily: mn, fontSize: 10, color: D.txb }}>{p.role ? p.role + (p.company ? " @ " + p.company : "") : p.company || ""}</div>
            </div>
            <span style={{ fontFamily: mn, fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: (tierColors[p.tier || ""] || D.txl) + "18", color: tierColors[p.tier || ""] || D.txl, border: "1px solid " + (tierColors[p.tier || ""] || D.txl) + "30" }}>{p.tier || "-"}</span>
          </div>;
        })}
      </div>
    </div>}
    {guests.length === 0 && <div onClick={function() { setGuests([{ name: "", handle: "" }]); }} style={{ background: D.surface, border: "1px dashed " + D.border, borderRadius: 10, padding: "16px", cursor: "pointer", textAlign: "center", fontFamily: ft, fontSize: 13, color: D.txl }}>Click to add guests</div>}
    {guests.map(function(g: Guest, i: number) { return (<div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
      <input value={g.name} onChange={function(e: React.ChangeEvent<HTMLInputElement>) { var c = guests.slice(); c[i] = { name: e.target.value, handle: g.handle }; setGuests(c); }} placeholder="Name" style={{ flex: 1, padding: "10px 12px", background: D.surface, border: "1px solid " + D.border, borderRadius: 10, color: D.tx, fontFamily: ft, fontSize: 14, outline: "none", transition: "border-color 0.2s ease" }} onFocus={function(e) { e.target.style.borderColor = ACC; }} onBlur={function(e) { e.target.style.borderColor = D.border; }} />
      <input value={g.handle} onChange={function(e: React.ChangeEvent<HTMLInputElement>) { var c = guests.slice(); c[i] = { name: g.name, handle: e.target.value }; setGuests(c); }} placeholder="@handle" style={{ flex: 1, padding: "10px 12px", background: D.surface, border: "1px solid " + D.border, borderRadius: 10, color: D.tx, fontFamily: mn, fontSize: 13, outline: "none", transition: "border-color 0.2s ease" }} onFocus={function(e) { e.target.style.borderColor = ACC; }} onBlur={function(e) { e.target.style.borderColor = D.border; }} />
      <span onClick={function() { setGuests(guests.filter(function(_: Guest, j: number) { return j !== i; })); }} style={{ fontFamily: mn, fontSize: 11, color: D.txl, cursor: "pointer", padding: "4px 8px" }}>x</span>
    </div>); })}
  </div>);
}

// ═══ KEYWORD BAR ═══
function KeywordBar({ onSuggest, loading }: { onSuggest: (kw: string) => void; loading: boolean }) {
  var _s = useState<string>(""), kw = _s[0], setKw = _s[1];
  return (<div style={{ display: "flex", gap: 8, marginTop: 10, marginBottom: 14 }}>
    <input value={kw} onChange={function(e: React.ChangeEvent<HTMLInputElement>) { setKw(e.target.value); }} placeholder="Keywords to refine titles (e.g. TSMC, GPU shortage)" onKeyDown={function(e: React.KeyboardEvent<HTMLInputElement>) { if (e.key === "Enter" && kw.trim()) { onSuggest(kw.trim()); setKw(""); } }} style={{ flex: 1, padding: "10px 14px", background: D.surface, border: "1px solid " + D.border, borderRadius: 10, color: D.tx, fontFamily: mn, fontSize: 12, outline: "none", transition: "border-color 0.2s ease" }} onFocus={function(e) { e.target.style.borderColor = ACC; }} onBlur={function(e) { e.target.style.borderColor = D.border; }} />
    <Btn sm onClick={function() { if (kw.trim()) { onSuggest(kw.trim()); setKw(""); } }} loading={loading} off={!kw.trim()}>Suggest</Btn>
  </div>);
}

// ═══ PERSISTENCE ═══
var saveTimer: ReturnType<typeof setTimeout> | null = null;
function weeklyDbSync(state: Record<string, unknown>, log: LogEntry[]): void {
  fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ table: "projects", data: { id: "weekly-master", name: "SA Weekly", data: { state: state, log: log }, type: "weekly", updated_at: new Date().toISOString() } }),
  }).catch(function() {});
}
function saveState(state: Record<string, unknown>, log: LogEntry[]): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(function() {
    fetch("/api/state", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: state, log: log }),
    }).catch(function(e) { console.error("Auto-save failed:", e); });
    weeklyDbSync(state, log);
  }, 1000);
}

// Chapters extractor. One Claude call that turns a transcript into a
// YouTube-format chapter list. Detects embedded timestamps if present;
// estimates from topic shifts if not. Output replaces the timestamps
// field whole so the user can edit it after.
var SYS_CHAPTERS = "You extract YouTube chapters from podcast transcripts. Output ONLY the chapter list (one chapter per line), nothing else — no preamble, no JSON, no markdown fences. Each line is exactly `(MM:SS) Chapter title` or `(HH:MM:SS) Chapter title` for episodes over an hour. Chapter titles are 3-7 words, specific (name what was discussed, not 'Discussion of X'). 5-10 chapters total. (00:00) must always be the first chapter (YouTube requires it). Times in ascending order. If the transcript has embedded timestamps, use them. If not, estimate from topic-shift positions; do NOT prefix anything. SA voice: no em dashes, no emojis, no hype words.";

// ═══ STEP 1: SETUP ═══
function StepSetup({ ep, setEp, guests, setGuests }: { ep: EpState; setEp: (ep: EpState) => void; guests: Guest[]; setGuests: (g: Guest[]) => void }) {
  var _chL = useState<boolean>(false), chL = _chL[0], setChL = _chL[1];

  var generateChapters = async function() {
    if (!ep.transcript || chL) return;
    setChL(true);
    try {
      var provider = getSurfaceProvider("sa-weekly") || getPreferredProvider();
      var r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: SYS_CHAPTERS,
          prompt: "Episode #" + ep.number + ". Transcript (first 20000 chars):\n\n" + ep.transcript.slice(0, 20000) + "\n\nReturn 5-10 chapters, one per line.",
          provider: provider,
          applyBrandVoice: true,
        }),
      });
      var d = await r.json();
      if (d.error) { showToast("Couldn't generate chapters: " + (d.error.message || d.error)); return; }
      var raw = (d.content || []).map(function(c: { text?: string }) { return c.text || ""; }).join("");
      var cleaned = raw.replace(/```[a-z]*|```/g, "").trim();
      // Keep only lines that look like (MM:SS) Title or (HH:MM:SS) Title so
      // any stray prose from the model gets filtered out.
      var lines = cleaned.split("\n").map(function(l: string) { return l.trim(); }).filter(function(l: string) { return /^\(\d{1,2}:\d{2}(?::\d{2})?\)\s+\S/.test(l); });
      if (!lines.length) { showToast("Model returned no chapters. Try again."); return; }
      setEp(Object.assign({}, ep, { timestamps: lines.join("\n") }));
      showToast("Generated " + lines.length + " chapters from the transcript.");
    } catch (e) {
      showToast("Network error generating chapters.");
    } finally {
      setChL(false);
    }
  };

  return (<div>
    <div style={{ fontFamily: ft, fontSize: 42, fontWeight: 900, color: D.tx, letterSpacing: -2, marginBottom: 8 }}>Episode Setup</div>
    <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 500, color: D.txb, marginBottom: 32 }}>Fill in episode details, guests, and transcript.</div>

    <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 14, marginBottom: 4 }}>
      <Field label="Episode #" value={ep.number} onChange={function(v: string) { setEp(Object.assign({}, ep, { number: v })); }} isMono />
      <Field label="YouTube Link" value={ep.link} onChange={function(v: string) { setEp(Object.assign({}, ep, { link: v })); }} placeholder="https://youtube.com/watch?v=..." isMono />
    </div>
    <GuestManager guests={guests} setGuests={setGuests} />

    {/* Transcript */}
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <Label>Full Transcript</Label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 8, cursor: "pointer", background: "transparent", border: "1px solid " + D.border, fontFamily: mn, fontSize: 10, color: ACC, transition: "all 0.2s ease" }}>Upload .txt<input type="file" accept=".txt,.text" style={{ display: "none" }} onChange={function(e) { var f = e.target.files && e.target.files[0]; if (!f) return; var r = new FileReader(); r.onload = function(ev: ProgressEvent<FileReader>) { setEp(Object.assign({}, ep, { transcript: ev.target?.result as string })); }; r.readAsText(f); e.target.value = ""; }} /></label>
      </div>
      <div onDragOver={function(e) { e.preventDefault(); e.currentTarget.style.borderColor = ACC; }} onDragLeave={function(e) { e.currentTarget.style.borderColor = D.border; }} onDrop={function(e) { e.preventDefault(); e.currentTarget.style.borderColor = D.border; var f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) { var r = new FileReader(); r.onload = function(ev: ProgressEvent<FileReader>) { setEp(Object.assign({}, ep, { transcript: ev.target?.result as string })); }; r.readAsText(f); } }} style={{ position: "relative", border: "1px solid " + D.border, borderRadius: 12, background: D.surface, transition: "border-color 0.2s ease" }}>
        {!ep.transcript && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 1 }}><div style={{ fontFamily: ft, fontSize: 14, color: D.txl }}>Drop .txt or paste transcript</div></div>}
        <textarea value={ep.transcript} onChange={function(e) { setEp(Object.assign({}, ep, { transcript: e.target.value })); }} rows={10} style={{ width: "100%", padding: "14px 16px", background: "transparent", border: "none", borderRadius: 12, color: D.tx, fontFamily: mn, fontSize: 12, outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.7, position: "relative", zIndex: 2, minHeight: 140 }} />
      </div>
      {ep.transcript && <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}><span style={{ fontFamily: mn, fontSize: 9, color: D.txl }}>{ep.transcript.length.toLocaleString()} chars</span><span onClick={function() { setEp(Object.assign({}, ep, { transcript: "" })); }} style={{ fontFamily: mn, fontSize: 9, color: D.txl, cursor: "pointer" }}>Clear</span></div>}
    </div>

    {/* Timestamps */}
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <Label>Timestamps (optional)</Label>
        <button type="button" onClick={generateChapters} disabled={!ep.transcript || chL} title={!ep.transcript ? "Paste a transcript first" : "Auto-generate YouTube chapters from the transcript"} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, cursor: !ep.transcript || chL ? "not-allowed" : "pointer", background: "transparent", border: "1px solid " + D.border, fontFamily: mn, fontSize: 10, color: !ep.transcript || chL ? D.txl : ACC, opacity: !ep.transcript || chL ? 0.6 : 1, transition: "all 0.2s ease" }}>{chL ? "Generating…" : "Auto-generate from transcript"}</button>
      </div>
      <textarea value={ep.timestamps || ""} onChange={function(e) { setEp(Object.assign({}, ep, { timestamps: e.target.value })); }} rows={4} placeholder={"(00:00) Cold open\n(02:06) Introduction\n(05:10) Supply chain choke points"} style={{ width: "100%", padding: "12px 14px", background: D.surface, border: "1px solid " + D.border, borderRadius: 10, color: D.tx, fontFamily: mn, fontSize: 12, outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.7, transition: "border-color 0.2s ease, box-shadow 0.2s ease" }} onFocus={function(e) { e.target.style.borderColor = ACC; e.target.style.boxShadow = "0 0 24px rgba(224,99,71,0.06)"; }} onBlur={function(e) { e.target.style.borderColor = D.border; e.target.style.boxShadow = "none"; }} />
      <div style={{ fontFamily: mn, fontSize: 9, color: D.txl, marginTop: 6 }}>Added to end of generated descriptions.</div>
    </div>

    {/* Additional Info */}
    <div style={{ marginBottom: 20 }}>
      <Label>Additional Info (optional)</Label>
      <textarea value={ep.extra || ""} onChange={function(e) { setEp(Object.assign({}, ep, { extra: e.target.value })); }} rows={2} placeholder="Key topics, sponsor mentions, angles to emphasize..." style={{ width: "100%", padding: "12px 14px", background: D.surface, border: "1px solid " + D.border, borderRadius: 10, color: D.tx, fontFamily: ft, fontSize: 14, outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.6, transition: "border-color 0.2s ease, box-shadow 0.2s ease" }} onFocus={function(e) { e.target.style.borderColor = ACC; e.target.style.boxShadow = "0 0 24px rgba(224,99,71,0.06)"; }} onBlur={function(e) { e.target.style.borderColor = D.border; e.target.style.boxShadow = "none"; }} />
    </div>
  </div>);
}

// ═══ STEP 2: GENERATE ═══
function StepGenerate({ ep, guests, opts, setOpts, sel, setSel, fin, setFin, descLen, setDescLen, onDone }: { ep: EpState; guests: Guest[]; opts: GeneratedOptions | null; setOpts: React.Dispatch<React.SetStateAction<GeneratedOptions | null>>; sel: SelectionState; setSel: React.Dispatch<React.SetStateAction<SelectionState>>; fin: FinalizedState | null; setFin: React.Dispatch<React.SetStateAction<FinalizedState | null>>; descLen: string; setDescLen: (v: string) => void; onDone: () => void }) {
  var _l = useState<boolean>(false), loading = _l[0], setLoading = _l[1];
  var _r = useState<Record<string, boolean>>({}), rL = _r[0], setRL = _r[1];
  var _k = useState<boolean>(false), kwL = _k[0], setKwL = _k[1];

  var descInstr = function() {
    if (descLen === "short") return "Descriptions: concise, 2-4 sentences. Key topics only.";
    if (descLen === "long") return "Descriptions: LONG (3-5 paragraphs, 200-400 words). All key topics, guest credentials with handles, why it matters, subscribe CTA. SEO keywords. Include timestamps at the end if provided.";
    return "Descriptions: medium (2 solid paragraphs). Main topics, guest names with handles on first mention, subscribe CTA. SEO keywords. Include timestamps at the end if provided.";
  };

  var genAll = async function() {
    if (!ep.transcript) return;
    setLoading(true); setOpts(null); setSel({ title: 0, desc: 0, thumb: 0 }); setFin(null);
    var gs = gStr(guests); var tx = ep.transcript.slice(0, 8000);
    var p = buildPrompt([
      "Generate content for SemiAnalysis Weekly Episode #" + ep.number + ".",
      "Guests with handles: " + gs,
      ep.extra ? "Additional context: " + ep.extra : "",
      ep.timestamps ? "Timestamps to include at end of descriptions:\n" + ep.timestamps : "",
      "Transcript (first 8000 chars): " + tx,
      descInstr(),
      "Generate 3 STRUCTURALLY DIFFERENT title options. Each option is {topic, category} per the title format rules. The 3 options should explore different angles, not three rewordings of the same hook.",
      'Return JSON: {"titles":[{"topic":"...","category":"..."},{"topic":"...","category":"..."},{"topic":"...","category":"..."}],"descriptions":["d1","d2","d3"],"thumbnails":[{"concept":"c1","text_overlay":"to1","mood":"m1"},{"concept":"c2","text_overlay":"to2","mood":"m2"},{"concept":"c3","text_overlay":"to3","mood":"m3"}]}',
    ]);
    var data = await ask(SYS_EP, p);
    if (data) {
      var d = data as unknown as Record<string, unknown>;
      var normalized: GeneratedOptions = {
        titles: ((d.titles as unknown[]) || []).map(asTitleOption),
        descriptions: ((d.descriptions as string[]) || []),
        thumbnails: ((d.thumbnails as (string | ThumbnailConcept)[]) || []),
      };
      setOpts(normalized); onDone();
    }
    setLoading(false);
  };

  var suggestKW = async function(keywords: string) {
    setKwL(true);
    var existing = (opts && opts.titles || []).map(function(t) { return t.topic; }).join(" | ");
    var data = await ask(SYS_EP, buildPrompt([
      "Generate 3 NEW title options for SemiAnalysis Weekly Ep #" + ep.number + ".",
      "Keywords to anchor on: " + keywords,
      "Guests: " + gStr(guests),
      "Avoid these existing topics: " + existing,
      "Transcript: " + (ep.transcript || "").slice(0, 4000),
      'Return JSON: {"titles":[{"topic":"...","category":"..."},{"topic":"...","category":"..."},{"topic":"...","category":"..."}]}',
    ]));
    if (data && data.titles) {
      var newTitles = (data.titles as unknown[]).map(asTitleOption);
      setOpts(function(prev: GeneratedOptions | null) { return Object.assign({}, prev, { titles: newTitles }) as GeneratedOptions; });
      setSel(function(prev: SelectionState) { return Object.assign({}, prev, { title: 0 }); });
    }
    setKwL(false);
  };

  var redoOne = async function(cat: string, idx: number) {
    var k = cat + "-" + idx; setRL(function(p: Record<string, boolean>) { var o = Object.assign({}, p); o[k] = true; return o; });
    var curItem = (opts as unknown as Record<string, unknown[]>)[cat][idx];
    var curStr: string;
    if (cat === "thumbnails") curStr = (curItem as ThumbnailConcept).concept;
    else if (cat === "titles") curStr = (curItem as TitleOption).topic;
    else curStr = curItem as string;
    var gs = gStr(guests); var tx = (ep.transcript || "").slice(0, 3000); var p2: string; var parse: (d: Record<string, unknown>) => unknown;
    if (cat === "thumbnails") {
      p2 = buildPrompt(["ONE new thumbnail for SA Weekly Ep #" + ep.number + ". Different from: " + curStr, "Guests: " + gs, "Transcript: " + tx, 'Return JSON: {"concept":"...","text_overlay":"...","mood":"..."}']);
      parse = function(d: Record<string, unknown>) { return d; };
    } else if (cat === "titles") {
      p2 = buildPrompt([
        "ONE new title option for SA Weekly Ep #" + ep.number + ". Different topic angle from: " + curStr,
        "Guests: " + gs,
        "Transcript: " + tx,
        'Return JSON: {"topic":"...","category":"..."}',
      ]);
      parse = function(d: Record<string, unknown>) { return asTitleOption(d); };
    } else {
      var dn = " " + descInstr();
      var en = ep.extra ? " Context: " + ep.extra : "";
      var tsn = ep.timestamps ? " Timestamps:\n" + ep.timestamps : "";
      p2 = buildPrompt(["ONE new description for SA Weekly Ep #" + ep.number + ". Different from: " + curStr + "." + dn, "Guests: " + gs + en + tsn, "Transcript: " + tx, 'Return JSON: {"result":"..."}']);
      parse = function(d: Record<string, unknown>) { return d.result; };
    }
    var data = await ask(SYS_EP, p2);
    if (data) { setOpts(function(prev: GeneratedOptions | null) { var c2 = Object.assign({}, prev) as unknown as Record<string, unknown>; c2[cat] = ((prev as unknown as Record<string, unknown[]>)[cat] || []).slice(); (c2[cat] as unknown[])[idx] = parse(data!); return c2 as unknown as GeneratedOptions; }); }
    setRL(function(p: Record<string, boolean>) { var o = Object.assign({}, p); o[k] = false; return o; });
  };

  var redoCat = async function(cat: string) {
    var k = "all-" + cat; setRL(function(p: Record<string, boolean>) { var o = Object.assign({}, p); o[k] = true; return o; });
    var gs = gStr(guests); var tx = (ep.transcript || "").slice(0, 4000); var p2;
    if (cat === "thumbnails") {
      p2 = buildPrompt(["3 NEW thumbnails for SA Weekly Ep #" + ep.number, "Guests: " + gs, "Transcript: " + tx, 'Return JSON: {"thumbnails":[{"concept":"c","text_overlay":"t","mood":"m"},{"concept":"c","text_overlay":"t","mood":"m"},{"concept":"c","text_overlay":"t","mood":"m"}]}']);
    } else if (cat === "titles") {
      p2 = buildPrompt([
        "3 NEW title options for SA Weekly Ep #" + ep.number + ". Each option must be a different angle, not three rewordings.",
        "Guests: " + gs,
        "Transcript: " + tx,
        'Return JSON: {"titles":[{"topic":"...","category":"..."},{"topic":"...","category":"..."},{"topic":"...","category":"..."}]}',
      ]);
    } else {
      var dn = ". " + descInstr();
      var en = ep.extra ? ". Context: " + ep.extra : "";
      var tsn = ep.timestamps ? ". Timestamps:\n" + ep.timestamps : "";
      p2 = buildPrompt(["3 NEW " + cat + " for SA Weekly Ep #" + ep.number + dn, "Guests: " + gs + en + tsn, "Transcript: " + tx, 'Return JSON: {"' + cat + '":["a","b","c"]}']);
    }
    var data = await ask(SYS_EP, p2);
    if (data && data[cat]) {
      var payload = data[cat];
      if (cat === "titles") payload = (payload as unknown[]).map(asTitleOption);
      setOpts(function(prev: GeneratedOptions | null) { return Object.assign({}, prev, (function() { var o: Record<string, unknown> = {}; o[cat] = payload; return o; })()) as GeneratedOptions; });
      var sk = cat === "titles" ? "title" : cat === "descriptions" ? "desc" : "thumb";
      setSel(function(prev: SelectionState) { var o = Object.assign({}, prev) as unknown as Record<string, number>; o[sk] = 0; return o as unknown as SelectionState; });
    }
    setRL(function(p: Record<string, boolean>) { var o = Object.assign({}, p); o[k] = false; return o; });
  };

  return (<div>
    <div style={{ fontFamily: ft, fontSize: 42, fontWeight: 900, color: D.tx, letterSpacing: -2, marginBottom: 8 }}>Generate</div>
    <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 500, color: D.txb, marginBottom: 32 }}>Generate titles, descriptions, and thumbnail concepts.</div>

    {/* Desc length */}
    <div style={{ marginBottom: 24 }}>
      <Label>Description Length</Label>
      <div style={{ display: "flex", gap: 8 }}>
        {[{ id: "short", l: "Short", sub: "2-4 sentences" }, { id: "medium", l: "Medium", sub: "2 paragraphs" }, { id: "long", l: "Long", sub: "3-5 paragraphs" }].map(function(m) { var s2 = descLen === m.id; return <div key={m.id} onClick={function() { setDescLen(m.id); }} style={{ flex: 1, padding: "14px 16px", borderRadius: 12, cursor: "pointer", background: s2 ? ACC + "0A" : D.elevated, border: "1px solid " + (s2 ? ACC + "60" : D.border), textAlign: "center", boxShadow: s2 ? "0 0 24px rgba(224,99,71,0.06)" : "none", transition: "all 0.2s ease" }}><div style={{ fontFamily: ft, fontSize: 14, fontWeight: s2 ? 800 : 500, color: s2 ? ACC : D.tx }}>{m.l}</div><div style={{ fontFamily: mn, fontSize: 9, color: s2 ? ACC : D.txl, marginTop: 3 }}>{m.sub}</div></div>; })}
      </div>
    </div>

    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <Btn onClick={genAll} loading={loading} off={!ep.transcript}>Generate Options</Btn>
      {opts && <Btn onClick={genAll} loading={loading} sec sm>Full Regen</Btn>}
      {!ep.transcript && <span style={{ fontFamily: mn, fontSize: 10, color: D.txl }}>Paste or upload a transcript first</span>}
    </div>
    {loading && <ProgressBar label="Generating titles, descriptions, and thumbnails" />}

    {opts && <div style={{ marginTop: 32 }}>
      <SecHead label="Titles" onRedoAll={function() { redoCat("titles"); }} rL={rL["all-titles"]} />
      {(opts.titles || []).map(function(t, i) { return <TitlePick key={"t" + i} option={t} epNum={ep.number} guests={guests} picked={sel.title === i} onPick={function() { setSel(Object.assign({}, sel, { title: i })); }} onRedo={function() { redoOne("titles", i); }} rLoading={rL["titles-" + i]} />; })}
      <KeywordBar onSuggest={suggestKW} loading={kwL} />
      <Divider />
      <SecHead label="Descriptions" onRedoAll={function() { redoCat("descriptions"); }} rL={rL["all-descriptions"]} />
      {(opts.descriptions || []).map(function(d, i) { return <Pick key={"d" + i} text={d} picked={sel.desc === i} onPick={function() { setSel(Object.assign({}, sel, { desc: i })); }} onRedo={function() { redoOne("descriptions", i); }} rLoading={rL["descriptions-" + i]} />; })}
      <Divider />
      <SecHead label="Thumbnail Concepts" onRedoAll={function() { redoCat("thumbnails"); }} rL={rL["all-thumbnails"]} />
      {(opts.thumbnails || []).map(function(th, i) { return <Pick key={"th" + i} text={thTxt(th)} picked={sel.thumb === i} onPick={function() { setSel(Object.assign({}, sel, { thumb: i })); }} onRedo={function() { redoOne("thumbnails", i); }} rLoading={rL["thumbnails-" + i]} />; })}
    </div>}
  </div>);
}

// ═══ STEP 3: REVIEW ═══
function StepReview({ ep, guests, opts, sel, fin, setFin, thumb, setThumb, onDone }: { ep: EpState; guests: Guest[]; opts: GeneratedOptions | null; sel: SelectionState; fin: FinalizedState | null; setFin: React.Dispatch<React.SetStateAction<FinalizedState | null>>; thumb: string | null; setThumb: React.Dispatch<React.SetStateAction<string | null>>; onDone: () => void }) {
  var _cl = useState<boolean>(false), checkL = _cl[0], setCheckL = _cl[1];
  var _cr = useState<CheckResult | null>(null), checkR = _cr[0], setCheckR = _cr[1];
  var _al = useState<boolean>(false), abL = _al[0], setAbL = _al[1];
  var _ar = useState<ABResult | null>(null), abR = _ar[0], setAbR = _ar[1];
  var _am = useState<string>("both"), abM = _am[0], setAbM = _am[1];
  // Grok thumbnail generation state. variants is null while no run has
  // finished; [] after a run that produced nothing; populated array on success.
  var _tgl = useState<boolean>(false), thumbGenL = _tgl[0], setThumbGenL = _tgl[1];
  var _tgv = useState<string[] | null>(null), thumbVariants = _tgv[0], setThumbVariants = _tgv[1];
  var _tgu = useState<number | null>(null), uploadingIdx = _tgu[0], setUploadingIdx = _tgu[1];
  // Blob preflight — fires once on mount to tell the user whether the
  // generated thumbnail will be persisted past the session. When
  // BLOB_READ_WRITE_TOKEN isn't set, the upload-asset endpoint silently
  // falls back to a data URL; user only finds out after generating + clicking
  // "Use this." The chip below the Generate button is the early warning.
  var _blob = useState<boolean | null>(null), blobConfigured = _blob[0], setBlobConfigured = _blob[1];
  React.useEffect(function() {
    var cancelled = false;
    fetch("/api/upload-asset/health").then(function(r) { return r.json(); }).then(function(d: { blobConfigured?: boolean }) {
      if (!cancelled) setBlobConfigured(!!d.blobConfigured);
    }).catch(function() { if (!cancelled) setBlobConfigured(false); });
    return function() { cancelled = true; };
  }, []);
  // Thumbnail provider + editable prompt + count. Defaults to Imagen
  // (cheaper, brand-safe) at 3 variants. Prompt textarea is seeded from
  // the picked concept the first time it opens and then becomes the
  // user's free-form edit surface.
  var _tprov = useState<"imagen" | "grok">("imagen"), thumbProvider = _tprov[0], setThumbProvider = _tprov[1];
  var _tcnt = useState<number>(3), thumbCount = _tcnt[0], setThumbCount = _tcnt[1];
  var _tpr = useState<string>(""), thumbPrompt = _tpr[0], setThumbPrompt = _tpr[1];
  var _topen = useState<boolean>(false), thumbAdv = _topen[0], setThumbAdv = _topen[1];
  // New thumbnail controls — style preset, aspect ratio, negative prompt,
  // reference image. Default to cinematic + 16:9 (YouTube thumbnail).
  var _tsty = useState<string>("cinematic"), thumbStyle = _tsty[0], setThumbStyle = _tsty[1];
  var _tar  = useState<"16:9" | "1:1" | "9:16">("16:9"), thumbAspect = _tar[0], setThumbAspect = _tar[1];
  var _tneg = useState<string>(""), thumbNeg = _tneg[0], setThumbNeg = _tneg[1];
  var _tref = useState<string | null>(null), thumbRef = _tref[0], setThumbRef = _tref[1];
  // Provider that actually generated the current variants. Set from the
  // /api/generate-thumbnail response so the variant cards + toasts
  // reflect reality (Imagen often refuses brand-y prompts and silently
  // falls back to Grok — without this tracking the user would think
  // they used Imagen when Grok ran).
  var _tactual = useState<"imagen" | "grok" | null>(null), thumbActualProvider = _tactual[0], setThumbActualProvider = _tactual[1];

  // Per-image cost estimates. Adjust if pricing shifts; the user sees
  // the running total live next to the Generate button.
  // Imagen 3.0 generate: $0.04 / image · Grok 2 image: ~$0.07 / image.
  function thumbCostUSD(provider: "imagen" | "grok", count: number): number {
    var per = provider === "imagen" ? 0.04 : 0.07;
    return per * count;
  }
  function thumbModelLabel(provider: "imagen" | "grok"): string {
    return provider === "imagen" ? "imagen-3.0-generate-002" : "grok-2-image";
  }
  // Seed the editable prompt from the picked concept the first time
  // the advanced panel opens (or when the user switches concept).
  React.useEffect(function() {
    if (!opts) return;
    var picked = opts.thumbnails[sel.thumb];
    if (!picked) return;
    var concept = typeof picked === "string" ? picked : (picked && picked.concept) || "";
    var textOverlay = typeof picked === "string" ? "" : (picked && picked.text_overlay) || "";
    var mood = typeof picked === "string" ? "" : (picked && picked.mood) || "";
    var seed = [
      concept,
      textOverlay ? "Text-overlay region (do not render text): \"" + textOverlay + "\"" : "",
      mood ? "Mood: " + mood : "",
    ].filter(Boolean).join(" · ");
    setThumbPrompt(seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel.thumb, opts]);

  if (!opts) return <div style={{ textAlign: "center", padding: 80, color: D.txb, fontFamily: ft }}>Generate options first.</div>;

  var selectedTitle = opts.titles[sel.title];
  var ytTitle = selectedTitle ? buildYoutubeTitle(ep.number, selectedTitle.topic, selectedTitle.category) : "";
  var curFin = fin || { title: ytTitle, description: opts.descriptions[sel.desc], thumbnail: opts.thumbnails[sel.thumb] };
  var spTitle = buildSpotifyTitle(curFin.title, guests);
  var thS = thTxt(curFin.thumbnail);

  var doubleCheck = async function() {
    setCheckL(true);
    var thC = typeof curFin.thumbnail === "string" ? curFin.thumbnail : curFin.thumbnail.concept;
    var thT2 = typeof curFin.thumbnail === "string" ? "" : curFin.thumbnail.text_overlay;
    var thMood = typeof curFin.thumbnail === "string" ? "" : curFin.thumbnail.mood;
    var thumbInfo = "Thumbnail concept: " + thC;
    if (thT2) thumbInfo += " | Text overlay: " + thT2;
    if (thMood) thumbInfo += " | Mood: " + thMood;
    if (thumb) thumbInfo += " | Actual thumbnail has been uploaded (image present).";
    else thumbInfo += " | No actual thumbnail uploaded yet, only the concept.";
    var data = await ask(SYS_EP, buildPrompt([
      "You are reviewing the full package for SemiAnalysis Weekly before it goes live. Evaluate how well the title, description, and thumbnail work TOGETHER as a cohesive unit.",
      "Title: " + curFin.title,
      "Full Description: " + (curFin.description || ""),
      thumbInfo,
      "Evaluate: 1) Does the title create curiosity that the thumbnail reinforces? 2) Does the description deliver on what the title promises? 3) Is there redundancy between title and thumbnail text? 4) Would this stop a scroll on YouTube? 5) Is the overall package cohesive or disjointed?",
      "Score 1-10 (10 = perfect cohesion, scroll-stopping, zero redundancy).",
      'Return JSON: {"score":8,"feedback":"2-3 sentence overall assessment of how well these three elements work together","suggestions":["specific actionable suggestion 1","specific actionable suggestion 2","specific actionable suggestion 3"]}'
    ]));
    if (data) setCheckR(data as unknown as CheckResult);
    setCheckL(false);
  };

  var runAB = async function() {
    setAbL(true);
    var allT = opts && opts.titles || [];
    var allTh = opts && opts.thumbnails || [];
    var mS = abM === "both" ? "Title + Thumbnail" : abM === "title" ? "Title only" : "Thumbnail only";
    var curThumb = typeof curFin.thumbnail === "string" ? curFin.thumbnail : curFin.thumbnail.concept;
    var data = await ask(SYS_EP, buildPrompt([
      "A/B Test for SA Weekly. Mode: " + mS + ".",
      "Current title: " + curFin.title,
      "Current thumbnail concept: " + curThumb,
      "All previously generated titles: " + JSON.stringify(allT),
      "All previously generated thumbnails: " + JSON.stringify(allTh),
      "Provide two options: Option A (current) and Option B (your recommended alternative). Score each for predicted CTR on a 1-10 scale. Explain the reasoning for each.",
      'Return JSON: {"option_a":{"title":"...","thumbnail_concept":"...","score":7,"reasoning":"why this works or falls short"},"option_b":{"title":"...","thumbnail_concept":"...","score":9,"reasoning":"why this is better"},"verdict":"1-2 sentence recommendation"}'
    ]));
    if (data) setAbR(data as unknown as ABResult);
    setAbL(false);
  };

  var applyAB = function() {
    if (!abR || !abR.option_b) return;
    var nf = Object.assign({}, curFin);
    if ((abM === "title" || abM === "both") && abR.option_b.title) nf.title = abR.option_b.title;
    if ((abM === "thumbnail" || abM === "both") && abR.option_b.thumbnail_concept) {
      nf.thumbnail = typeof curFin.thumbnail === "string" ? abR.option_b.thumbnail_concept : Object.assign({}, curFin.thumbnail, { concept: abR.option_b.thumbnail_concept });
    }
    setFin(nf); setAbR(null); setCheckR(null);
  };

  var saveFin = function() {
    var picked = opts.titles[sel.title];
    var yt = picked ? buildYoutubeTitle(ep.number, picked.topic, picked.category) : "";
    setFin({ title: yt, description: opts.descriptions[sel.desc], thumbnail: opts.thumbnails[sel.thumb] });
  };

  // Grok-powered thumbnail generation. Pulls the currently selected
  // thumbnail concept (text-only) and renders 3 image variants. The user
  // picks one to commit; we Blob-upload it for permanence so the export
  // still works after Grok's URL expires.
  var generateThumbImages = async function() {
    if (thumbGenL || !opts) return;
    var picked = opts.thumbnails[sel.thumb];
    var concept = typeof picked === "string" ? picked : (picked && picked.concept) || "";
    if (!concept && !thumbPrompt.trim()) { showToast("Pick or generate a thumbnail concept first."); return; }
    var textOverlay = typeof picked === "string" ? "" : (picked && picked.text_overlay) || "";
    var mood = typeof picked === "string" ? "" : (picked && picked.mood) || "";
    // When the advanced panel is open + the user has edited the prompt,
    // the prompt replaces the concept (concept+textOverlay+mood get
    // folded into the user's free-form text). Otherwise the legacy
    // concept-driven path stays the default.
    var usingCustomPrompt = thumbAdv && thumbPrompt.trim().length > 0;
    setThumbGenL(true);
    setThumbVariants(null);
    setThumbActualProvider(null);
    try {
      var r = await fetch("/api/generate-thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept: usingCustomPrompt ? thumbPrompt.trim() : concept,
          textOverlay: usingCustomPrompt ? "" : textOverlay,
          mood: usingCustomPrompt ? "" : mood,
          title: curFin.title,
          style: thumbStyle,
          aspectRatio: thumbAspect,
          negativePrompt: thumbNeg.trim() || undefined,
          referenceImageUrl: thumbRef || undefined,
          count: thumbCount,
          provider: thumbProvider,
        }),
      });
      var d = await r.json();
      if (!r.ok) { showToast(d.error || "Image generation failed"); return; }
      setThumbVariants((d.images as string[]) || []);
      // Track the actual provider that ran (may differ from requested
      // when Imagen refuses and the route silently falls back to Grok).
      var actual = (d.provider === "grok" || d.provider === "imagen") ? d.provider : null;
      setThumbActualProvider(actual);
      if (d.fellBackTo) {
        // Surface the actual Imagen refusal reason (e.g. "Person/Face
        // generation not allowed") instead of a generic "refused" toast.
        var reason = typeof d.imagenError === "string"
          ? d.imagenError.slice(0, 140)
          : "policy refusal";
        showToast("Imagen refused: " + reason + " → used " + d.fellBackTo + " instead");
      }
    } catch (e) {
      showToast("Network error: " + String(e));
    } finally {
      setThumbGenL(false);
    }
  };

  // Use a generated variant as the thumbnail. Persists to Vercel Blob so
  // the asset survives Grok URL expiry; falls back to data URL if the
  // upload fails (the user can still export DOCX in the same session).
  var useGeneratedThumb = async function(imgUrl: string, idx: number) {
    if (uploadingIdx !== null) return;
    setUploadingIdx(idx);
    var providerLabel = thumbActualProvider === "grok" ? "Grok" : thumbActualProvider === "imagen" ? "Imagen" : "AI";
    try {
      var dataUrl = imgUrl;
      var isAlreadyDataUrl = imgUrl.startsWith("data:");
      if (!isAlreadyDataUrl) {
        // Provider returned a remote URL (Grok always; Imagen never).
        // Fetch + base64 it so we can ship to Vercel Blob for a
        // permanent URL that survives the provider's expiry.
        try {
          var fres = await fetch(imgUrl);
          var blob = await fres.blob();
          dataUrl = await new Promise<string>(function(resolve, reject) {
            var fr = new FileReader();
            fr.onload = function() { resolve(fr.result as string); };
            fr.onerror = function() { reject(fr.error); };
            fr.readAsDataURL(blob);
          });
        } catch (e) {
          // CORS or transient network error — use the URL as-is. The
          // image still renders in-app; it just may expire from the
          // provider's CDN. User sees what actually happened.
          setThumb(imgUrl);
          showToast("Thumbnail set · " + providerLabel + " URL (may expire — try Save Episode now)");
          return;
        }
      }
      // We now have a data URL — try to persist to Vercel Blob so the
      // export pipeline can reference a permanent URL.
      try {
        var up = await fetch("/api/upload-asset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: dataUrl,
            filename: "sa-weekly-ep" + (ep.number || "x") + "-thumb-" + Date.now() + ".png",
            contentType: "image/png",
          }),
        });
        var upJ = await up.json();
        if (up.ok && upJ.url) {
          setThumb(upJ.url as string);
          showToast("Thumbnail saved to Blob · " + providerLabel);
          return;
        }
        // Non-2xx → fall through to local fallback below. Surface the
        // server reason so the user knows it wasn't a network issue.
        if (upJ && upJ.error) {
          showToast("Thumbnail set locally · Blob upload error: " + upJ.error);
          setThumb(dataUrl);
          return;
        }
      } catch (e) { /* fall through to local fallback */ }
      setThumb(dataUrl);
      showToast("Thumbnail set locally · " + providerLabel + " (Blob upload failed — image still embedded)");
    } finally {
      setUploadingIdx(null);
    }
  };

  return (<div>
    <div style={{ fontFamily: ft, fontSize: 42, fontWeight: 900, color: D.tx, letterSpacing: -2, marginBottom: 8 }}>Review</div>
    <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 500, color: D.txb, marginBottom: 32 }}>Preview, double check, A/B test, then finalize your selections.</div>

    {/* Selections summary */}
    <div style={{ background: D.elevated, border: "1px solid " + D.border, borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: "0 0 24px rgba(224,99,71,0.06)" }}>
      <div style={{ fontFamily: mn, fontSize: 11, color: ACC, textTransform: "uppercase", letterSpacing: "2px", marginBottom: 18, fontWeight: 700 }}>Your Selections</div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
          <div style={{ fontFamily: mn, fontSize: 9, color: PL.yt, letterSpacing: "1.5px", fontWeight: 700 }}>YOUTUBE TITLE</div>
          <div style={{ fontFamily: mn, fontSize: 9, color: curFin.title.length > 100 ? D.coral : D.txl, fontWeight: curFin.title.length > 100 ? 700 : 400 }}>{curFin.title.length}/100{curFin.title.length > 100 ? " over" : ""}</div>
        </div>
        <div style={{ fontFamily: ft, fontSize: 16, color: D.tx, fontWeight: 700, marginBottom: 12 }}>{curFin.title}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
          <div style={{ fontFamily: mn, fontSize: 9, color: "#1DB954", letterSpacing: "1.5px", fontWeight: 700 }}>SPOTIFY TITLE</div>
          <div style={{ fontFamily: mn, fontSize: 9, color: spTitle.length > 200 ? D.coral : D.txl, fontWeight: spTitle.length > 200 ? 700 : 400 }}>{spTitle.length}/200{spTitle.length > 200 ? " over" : ""}</div>
        </div>
        <div style={{ fontFamily: ft, fontSize: 14, color: D.txb, fontWeight: 500 }}>{spTitle}</div>
      </div>
      <div style={{ marginBottom: 16 }}><div style={{ fontFamily: mn, fontSize: 9, color: D.txb, marginBottom: 4, letterSpacing: "1.5px" }}>DESCRIPTION</div><div style={{ fontFamily: ft, fontSize: 14, color: D.txb, lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 150, overflow: "auto" }}>{curFin.description}</div></div>
      <div><div style={{ fontFamily: mn, fontSize: 9, color: D.txb, marginBottom: 4, letterSpacing: "1.5px" }}>THUMBNAIL CONCEPT</div><div style={{ fontFamily: ft, fontSize: 14, color: D.txb, lineHeight: 1.7 }}>{thS}</div></div>
      {!fin && <div style={{ marginTop: 16 }}><Btn onClick={saveFin} sm>Lock Selections</Btn></div>}
    </div>

    {/* YouTube Preview */}
    <div style={{ background: D.elevated, border: "1px solid " + D.border, borderRadius: 12, overflow: "hidden", marginBottom: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}>
      <div style={{ width: "100%", aspectRatio: "16/9", background: D.surface, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>{thumb ? <img src={thumb} alt="Thumb" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ textAlign: "center" }}><div style={{ fontFamily: ft, fontSize: 15, color: D.txl }}>Thumbnail Preview</div></div>}<div style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.8)", borderRadius: 4, padding: "3px 8px", fontFamily: mn, fontSize: 10, color: "#fff" }}>42:18</div></div>
      <div style={{ padding: "16px 20px" }}><div style={{ fontFamily: ft, fontSize: 16, fontWeight: 800, color: D.tx, lineHeight: 1.4, marginBottom: 10 }}>{curFin.title}</div><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 28, height: 28, borderRadius: "50%", background: ACC, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: ft, fontSize: 11, fontWeight: 800, color: D.tx }}>SA</div><div style={{ fontFamily: ft, fontSize: 12, color: D.txb, fontWeight: 600 }}>SemiAnalysis Weekly</div></div></div>
    </div>

    {/* Blob preflight warning — fires when BLOB_READ_WRITE_TOKEN isn't
        set so the user knows up front that thumbnails won't persist
        past the session. */}
    {blobConfigured === false && (
      <div style={{
        marginBottom: 12, padding: "8px 14px",
        background: D.amber + "12", border: "1px solid " + D.amber + "55",
        borderRadius: 8, fontFamily: mn, fontSize: 10.5, color: D.amber, letterSpacing: 0.4, lineHeight: 1.5,
      }}>
        ⚠ Vercel Blob not configured — generated thumbnails will only render this session. Set <span style={{ background: "rgba(0,0,0,0.3)", padding: "1px 5px", borderRadius: 3, fontWeight: 700 }}>BLOB_READ_WRITE_TOKEN</span> to persist them past tab close.
      </div>
    )}

    {/* Thumbnail upload */}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
      <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 28, background: D.surface, border: "2px dashed " + D.border, borderRadius: 12, cursor: "pointer", transition: "border-color 0.2s ease" }}><div style={{ fontFamily: ft, fontSize: 15, fontWeight: 800, color: ACC, marginBottom: 4 }}>Upload Thumbnail</div><div style={{ fontFamily: mn, fontSize: 10, color: D.txl }}>PNG, JPG, 1280x720</div><input type="file" accept="image/*" style={{ display: "none" }} onChange={function(e) { var f = e.target.files && e.target.files[0]; if (!f) return; var r = new FileReader(); r.onload = function(ev: ProgressEvent<FileReader>) { setThumb(ev.target?.result as string); }; r.readAsDataURL(f); e.target.value = ""; }} /></label>
      <div onClick={generateThumbImages} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 28, background: thumbGenL ? "rgba(247,176,65,0.06)" : D.surface, border: "2px dashed " + (thumbGenL ? D.amber : D.border), borderRadius: 12, cursor: thumbGenL ? "wait" : "pointer", transition: "all 0.2s ease", opacity: thumbGenL ? 0.85 : 1 }}>
        <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 800, color: D.amber, marginBottom: 4 }}>{thumbGenL ? "Generating…" : "Generate Thumbnails"}</div>
        <div style={{ fontFamily: mn, fontSize: 10, color: D.txl, textAlign: "center" }}>
          {thumbGenL ? "About 10–20 seconds" : (
            <span>
              {thumbProvider === "imagen" ? "Imagen" : "Grok"} · {thumbCount} variant{thumbCount === 1 ? "" : "s"} · ~${thumbCostUSD(thumbProvider, thumbCount).toFixed(2)}
            </span>
          )}
        </div>
      </div>
    </div>

    {/* Advanced thumbnail controls — platform / model / prompt / cost. */}
    <div style={{ background: D.elevated, border: "1px solid " + (thumbAdv ? D.amber + "40" : D.border), borderRadius: 12, padding: thumbAdv ? "14px 16px 18px" : "10px 16px", marginBottom: 16, transition: "all 0.2s ease" }}>
      <div onClick={function() { setThumbAdv(function(v) { return !v; }); }} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
        <div style={{ fontFamily: mn, fontSize: 10, color: thumbAdv ? D.amber : D.txb, letterSpacing: "1.5px", fontWeight: 800, textTransform: "uppercase" }}>
          {thumbAdv ? "▾" : "▸"} Thumbnail Settings
        </div>
        <div style={{ fontFamily: mn, fontSize: 9.5, color: D.txl }}>
          {thumbModelLabel(thumbProvider)} · ${thumbCostUSD(thumbProvider, thumbCount).toFixed(2)} / run
        </div>
      </div>
      {thumbAdv && <div style={{ marginTop: 14 }}>
        {/* Provider picker */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {([
            { id: "imagen" as const, label: "Imagen 3.0", sub: "Google · $0.04 / img" },
            { id: "grok"   as const, label: "Grok 2 Image", sub: "xAI · $0.07 / img" },
          ]).map(function(p) {
            var on = thumbProvider === p.id;
            return <div key={p.id} onClick={function() { setThumbProvider(p.id); }}
              style={{ flex: 1, padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                background: on ? D.amber + "12" : D.surface,
                border: "1px solid " + (on ? D.amber + "60" : D.border),
                textAlign: "left", transition: "all 0.15s ease" }}>
              <div style={{ fontFamily: ft, fontSize: 13, fontWeight: 800, color: on ? D.amber : D.tx }}>{p.label}</div>
              <div style={{ fontFamily: mn, fontSize: 9.5, color: on ? D.amber : D.txl, marginTop: 2 }}>{p.sub}</div>
            </div>;
          })}
        </div>
        {/* Variant count + aspect ratio on one row */}
        <div style={{ display: "flex", gap: 4, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontFamily: mn, fontSize: 9.5, color: D.txb, letterSpacing: 1, marginRight: 8, fontWeight: 700 }}>Variants:</div>
          {[1, 2, 3, 4].map(function(n) {
            var on = thumbCount === n;
            return <span key={n} onClick={function() { setThumbCount(n); }}
              style={{ padding: "5px 11px", borderRadius: 999, cursor: "pointer",
                background: on ? D.amber + "20" : D.surface,
                border: "1px solid " + (on ? D.amber + "60" : D.border),
                color: on ? D.amber : D.tx,
                fontFamily: mn, fontSize: 11, fontWeight: 700 }}>{n}</span>;
          })}
          <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 10.5, color: D.amber, fontWeight: 800 }}>
            ~${thumbCostUSD(thumbProvider, thumbCount).toFixed(2)} / run
          </span>
        </div>
        {/* Aspect ratio + style preset row */}
        <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontFamily: mn, fontSize: 9.5, color: D.txb, letterSpacing: 1, fontWeight: 700, marginBottom: 5 }}>Aspect</div>
            <div style={{ display: "flex", gap: 4 }}>
              {([
                { id: "16:9" as const, label: "16:9",  sub: "YT" },
                { id: "1:1"  as const, label: "1:1",   sub: "Sq" },
                { id: "9:16" as const, label: "9:16",  sub: "Shorts" },
              ]).map(function(a) {
                var on = thumbAspect === a.id;
                return <span key={a.id} onClick={function() { setThumbAspect(a.id); }}
                  style={{ flex: 1, padding: "6px 8px", borderRadius: 8, cursor: "pointer", textAlign: "center",
                    background: on ? D.amber + "20" : D.surface,
                    border: "1px solid " + (on ? D.amber + "60" : D.border),
                    color: on ? D.amber : D.tx,
                    fontFamily: mn, fontSize: 11, fontWeight: 700 }}>
                  {a.label}
                  <div style={{ fontSize: 8.5, color: on ? D.amber : D.txl, marginTop: 1, fontWeight: 600 }}>{a.sub}</div>
                </span>;
              })}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontFamily: mn, fontSize: 9.5, color: D.txb, letterSpacing: 1, fontWeight: 700, marginBottom: 5 }}>Style</div>
            <select
              value={thumbStyle}
              onChange={function(e) { setThumbStyle(e.target.value); }}
              style={{ width: "100%", padding: "7px 10px", background: D.surface, border: "1px solid " + D.border, borderRadius: 8, color: D.tx, fontFamily: mn, fontSize: 11.5, fontWeight: 700, outline: "none", cursor: "pointer", appearance: "none", WebkitAppearance: "none" }}
            >
              <option value="cinematic">Cinematic · film-frame</option>
              <option value="photorealistic">Photorealistic · studio</option>
              <option value="editorial">Editorial · magazine cover</option>
              <option value="dataviz">Data Viz · infographic</option>
              <option value="abstract">Abstract · particle / neon</option>
            </select>
          </div>
        </div>
        {/* Editable prompt */}
        <div style={{ fontFamily: mn, fontSize: 9.5, color: D.txb, letterSpacing: 1, fontWeight: 700, marginBottom: 6 }}>
          Prompt {thumbPrompt ? "· " + thumbPrompt.length + " chars" : ""}
        </div>
        <textarea
          value={thumbPrompt}
          onChange={function(e) { setThumbPrompt(e.target.value); }}
          rows={4}
          placeholder="Edit the prompt before generating — concept, mood, composition, text-overlay region..."
          style={{ width: "100%", padding: "10px 12px", background: D.surface, border: "1px solid " + D.border, borderRadius: 10, color: D.tx, fontFamily: mn, fontSize: 12, outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.55, transition: "border-color 0.15s ease" }}
          onFocus={function(e) { e.target.style.borderColor = D.amber; }}
          onBlur={function(e) { e.target.style.borderColor = D.border; }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontFamily: mn, fontSize: 9.5, color: D.txl }}>
          <span>Empty = use the picked concept as-is.</span>
          <span onClick={function() {
            if (!opts) return;
            var picked = opts.thumbnails[sel.thumb];
            var c2 = typeof picked === "string" ? picked : (picked && picked.concept) || "";
            var t2 = typeof picked === "string" ? "" : (picked && picked.text_overlay) || "";
            var m2 = typeof picked === "string" ? "" : (picked && picked.mood) || "";
            var seed = [c2, t2 ? "Text-overlay region: \"" + t2 + "\"" : "", m2 ? "Mood: " + m2 : ""].filter(Boolean).join(" · ");
            setThumbPrompt(seed);
          }} style={{ cursor: "pointer", color: D.amber }}>Reset to concept</span>
        </div>
        {/* Negative prompt — things the model should avoid. */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontFamily: mn, fontSize: 9.5, color: D.txb, letterSpacing: 1, fontWeight: 700, marginBottom: 5 }}>
            Avoid / Negative prompt {thumbNeg ? "· " + thumbNeg.length + " chars" : "· optional"}
          </div>
          <input
            value={thumbNeg}
            onChange={function(e) { setThumbNeg(e.target.value); }}
            placeholder="e.g. people, faces, cluttered desk, neon signs, anime, low contrast"
            style={{ width: "100%", padding: "9px 11px", background: D.surface, border: "1px solid " + D.border, borderRadius: 8, color: D.tx, fontFamily: mn, fontSize: 12, outline: "none", boxSizing: "border-box", transition: "border-color 0.15s ease" }}
            onFocus={function(e) { e.target.style.borderColor = D.amber; }}
            onBlur={function(e) { e.target.style.borderColor = D.border; }}
          />
        </div>
        {/* Reference image — anchor the model to an existing style. */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
            <div style={{ fontFamily: mn, fontSize: 9.5, color: D.txb, letterSpacing: 1, fontWeight: 700 }}>
              Reference image {thumbRef ? "· set" : "· optional"}
            </div>
            {thumbRef && <span onClick={function() { setThumbRef(null); }} style={{ fontFamily: mn, fontSize: 9.5, color: D.coral, cursor: "pointer" }}>Clear</span>}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ flex: 1, padding: "10px 12px", borderRadius: 8, background: D.surface, border: "1px dashed " + D.border, cursor: "pointer", fontFamily: mn, fontSize: 11, color: D.tx, textAlign: "center" }}>
              {thumbRef ? "Replace" : "Upload PNG / JPG"}
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={function(e) {
                var f = e.target.files && e.target.files[0];
                if (!f) return;
                var r = new FileReader();
                r.onload = function(ev) { setThumbRef(ev.target?.result as string); };
                r.readAsDataURL(f);
                e.target.value = "";
              }} />
            </label>
            {thumbRef && <div style={{ width: 56, height: 32, borderRadius: 6, border: "1px solid " + D.border, overflow: "hidden", flexShrink: 0 }}>
              { /* eslint-disable-next-line @next/next/no-img-element */ }
              <img src={thumbRef} alt="ref" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>}
          </div>
          <div style={{ fontFamily: mn, fontSize: 9, color: D.txl, marginTop: 5, letterSpacing: 0.3 }}>
            Lock the model to an existing thumbnail&apos;s style. Imagen and Grok both honor this when supported.
          </div>
        </div>
      </div>}
    </div>

    {thumbGenL && <ProgressBar label={"Generating with " + thumbModelLabel(thumbProvider)} />}

    {thumbVariants && thumbVariants.length > 0 && <div style={{ background: D.elevated, border: "1px solid " + D.border, borderRadius: 12, padding: 16, marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ fontFamily: mn, fontSize: 11, color: D.amber, textTransform: "uppercase", letterSpacing: "2px", fontWeight: 700 }}>Generated · pick one</div>
        {thumbActualProvider && <span style={{
          fontFamily: mn, fontSize: 9, fontWeight: 800, letterSpacing: 0.6,
          padding: "3px 8px", borderRadius: 999,
          background: (thumbActualProvider === "imagen" ? D.blue : D.violet) + "1A",
          color: thumbActualProvider === "imagen" ? D.blue : D.violet,
          border: "1px solid " + (thumbActualProvider === "imagen" ? D.blue : D.violet) + "55",
          textTransform: "uppercase",
        }}>
          {thumbActualProvider === "imagen" ? "Imagen" : "Grok"}
          {thumbActualProvider !== thumbProvider && " · fallback"}
        </span>}
        <span style={{ fontFamily: mn, fontSize: 9, color: D.txl, letterSpacing: 0.5 }}>
          {thumbStyle} · {thumbAspect}
        </span>
        <span onClick={generateThumbImages} style={{ marginLeft: "auto", fontFamily: mn, fontSize: 9, color: D.txl, padding: "4px 10px", borderRadius: 8, border: "1px solid " + D.border, cursor: thumbGenL ? "wait" : "pointer", letterSpacing: 1 }}>↻ Re-roll all</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(" + Math.min(3, thumbVariants.length) + ", 1fr)", gap: 10 }}>
        {thumbVariants.map(function(url, i) {
          var picked = thumb === url;
          var uploading = uploadingIdx === i;
          var aspectCss = thumbAspect === "16:9" ? "16/9" : thumbAspect === "9:16" ? "9/16" : "1/1";
          return <div key={i} style={{ background: D.surface, border: "1px solid " + (picked ? D.amber : D.border), borderRadius: 10, overflow: "hidden", position: "relative" }}>
            { /* eslint-disable-next-line @next/next/no-img-element */ }
            <img src={url} alt={"variant " + (i + 1)} style={{ width: "100%", aspectRatio: aspectCss, objectFit: "cover", display: "block" }} />
            <div style={{ padding: "8px 10px", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: mn, fontSize: 9, color: D.txl, letterSpacing: 1 }}>{"Var. " + (i + 1)}</span>
              <button type="button" disabled={uploading} onClick={function() { useGeneratedThumb(url, i); }} style={{ marginLeft: "auto", padding: "5px 12px", background: picked ? D.teal + "15" : D.amber, color: picked ? D.teal : "#060608", border: picked ? "1px solid " + D.teal + "60" : "none", borderRadius: 6, fontFamily: mn, fontSize: 10, fontWeight: 800, cursor: uploading ? "wait" : "pointer", letterSpacing: 0.5 }}>{uploading ? "Saving…" : picked ? "✓ In use" : "Use this"}</button>
            </div>
          </div>;
        })}
      </div>
    </div>}

    {thumb && <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20 }}><span style={{ fontFamily: mn, fontSize: 10, color: D.teal }}>Thumbnail set</span><span onClick={function() { setThumb(null); }} style={{ fontFamily: mn, fontSize: 9, color: D.txl, cursor: "pointer" }}>Remove</span></div>}

    <Divider />

    {/* Double Check */}
    <div style={{ marginBottom: 28 }}><div style={{ fontFamily: ft, fontSize: 18, fontWeight: 800, color: D.tx, marginBottom: 10, letterSpacing: -0.5 }}>Double Check</div><Btn onClick={doubleCheck} loading={checkL} sec>Run Double Check</Btn>
      {checkL && <ProgressBar label="Evaluating cohesion" />}
      {checkR && <div style={{ background: D.elevated, border: "1px solid " + D.border, borderRadius: 12, padding: 20, marginTop: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}><div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}><div style={{ width: 48, height: 48, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: (checkR.score >= 8 ? D.teal : checkR.score >= 5 ? D.amber : ACC) + "15", border: "2px solid " + (checkR.score >= 8 ? D.teal : checkR.score >= 5 ? D.amber : ACC), fontFamily: mn, fontSize: 18, fontWeight: 700, color: checkR.score >= 8 ? D.teal : checkR.score >= 5 ? D.amber : ACC }}>{checkR.score}</div><div><div style={{ fontFamily: ft, fontSize: 15, fontWeight: 800, color: D.tx }}>Cohesion Score</div></div></div><div style={{ fontFamily: ft, fontSize: 14, color: D.txb, lineHeight: 1.7, marginBottom: 14 }}>{checkR.feedback}</div>{checkR.suggestions && checkR.suggestions.map(function(s, i) { return <div key={i} style={{ fontFamily: ft, fontSize: 13, color: D.txb, paddingLeft: 12, borderLeft: "2px solid " + D.border, marginBottom: 6, lineHeight: 1.6 }}>{s}</div>; })}</div>}
    </div>

    <Divider />

    {/* A/B Testing */}
    <div style={{ marginBottom: 28 }}><div style={{ fontFamily: ft, fontSize: 18, fontWeight: 800, color: D.tx, marginBottom: 10, letterSpacing: -0.5 }}>A/B Testing</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>{[{ id: "title", l: "Title Only" }, { id: "thumbnail", l: "Thumbnail Only" }, { id: "both", l: "Title + Thumbnail" }].map(function(m) { var s2 = abM === m.id; return <div key={m.id} onClick={function() { setAbM(m.id); }} style={{ padding: "10px 16px", borderRadius: 10, cursor: "pointer", background: s2 ? ACC + "0A" : D.elevated, border: "1px solid " + (s2 ? ACC + "60" : D.border), fontFamily: mn, fontSize: 11, color: s2 ? ACC : D.txb, boxShadow: s2 ? "0 0 24px rgba(224,99,71,0.06)" : "none", transition: "all 0.2s ease" }}>{m.l}</div>; })}</div>
      <div style={{ display: "flex", gap: 8 }}><Btn onClick={runAB} loading={abL} sec>Run A/B Test</Btn>{abR && <Btn onClick={function() { setAbR(null); runAB(); }} loading={abL} sec sm>Redo Fresh</Btn>}</div>
      {abL && <ProgressBar label="Running A/B analysis" />}
      {abR && abR.option_a && abR.option_b && <div style={{ marginTop: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          {[{ key: "option_a" as const, label: "Option A // Current", color: D.txb }, { key: "option_b" as const, label: "Option B // Recommended", color: ACC }].map(function(col) {
            var opt = abR![col.key];
            return <div key={col.key} style={{ background: D.elevated, border: "1px solid " + (col.key === "option_b" ? ACC + "40" : D.border), borderRadius: 12, padding: 20, boxShadow: col.key === "option_b" ? "0 0 24px rgba(224,99,71,0.06)" : "0 2px 12px rgba(0,0,0,0.3)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontFamily: mn, fontSize: 9, color: col.color, textTransform: "uppercase", letterSpacing: "2px" }}>{col.label}</div>
                <div style={{ width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: col.color + "15", border: "2px solid " + col.color, fontFamily: mn, fontSize: 15, fontWeight: 700, color: col.color }}>{opt.score}</div>
              </div>
              {opt.title && <div style={{ marginBottom: 12 }}><div style={{ fontFamily: mn, fontSize: 9, color: D.txl, marginBottom: 4, letterSpacing: "1.5px" }}>TITLE</div><div style={{ fontFamily: ft, fontSize: 14, color: D.tx, fontWeight: 700 }}>{opt.title}</div></div>}
              {opt.thumbnail_concept && <div style={{ marginBottom: 12 }}><div style={{ fontFamily: mn, fontSize: 9, color: D.txl, marginBottom: 4, letterSpacing: "1.5px" }}>THUMBNAIL</div><div style={{ fontFamily: ft, fontSize: 13, color: D.txb }}>{opt.thumbnail_concept}</div></div>}
              <div style={{ fontFamily: ft, fontSize: 12, color: D.txb, lineHeight: 1.6, borderTop: "1px solid " + D.border, paddingTop: 12, marginTop: 8 }}>{opt.reasoning}</div>
            </div>;
          })}
        </div>
        <div style={{ background: D.surface, border: "1px solid " + D.border, borderRadius: 10, padding: "14px 18px", marginBottom: 16 }}>
          <div style={{ fontFamily: ft, fontSize: 13, color: D.txb, lineHeight: 1.6 }}>{abR.verdict}</div>
        </div>
        <Btn onClick={applyAB} sm>Apply Option B</Btn>
      </div>}
    </div>

    <Divider />

    {/* Finalize */}
    <div style={{ background: fin ? D.teal + "08" : D.surface, border: "1px solid " + (fin ? D.teal : D.border), borderRadius: 12, padding: 24 }}>
      <div style={{ fontFamily: ft, fontSize: 18, fontWeight: 800, color: fin ? D.teal : D.tx, marginBottom: 8, letterSpacing: -0.5 }}>{fin ? "Finalized" : "Ready to Finalize?"}</div>
      {!fin ? <Btn onClick={function() { saveFin(); onDone(); }}>Finalize Selections</Btn> : <Btn onClick={onDone}>Continue to Social</Btn>}
    </div>
  </div>);
}

// ═══ STEP 4: SOCIAL ═══
function StepSocial({ ep, guests, fin, socialRes, setSocialRes }: { ep: EpState; guests: Guest[]; fin: FinalizedState | null; socialRes: SocialResult | null; setSocialRes: React.Dispatch<React.SetStateAction<SocialResult | null>> }) {
  var _h = useState<string>("Cold open into intro. Out Now announcement."), hook = _h[0], setHook = _h[1];
  var _l = useState<boolean>(false), loading = _l[0], setLoading = _l[1];
  var _rl = useState<Record<string, boolean>>({}), redoL = _rl[0], setRedoL = _rl[1];

  if (!fin) return <div style={{ textAlign: "center", padding: 80, color: D.txb, fontFamily: ft }}>Complete Review step first.</div>;
  var gs = gStr(guests);
  var link = ep.link || "https://youtube.com/@SemianalysisWeekly";

  var FIELDS = [
    { key: "x_hook", label: "X // Hook Tweet", color: PL.x, plat: "X" },
    { key: "x_reply", label: "X // Reply-to-self", color: PL.x, plat: "X" },
    { key: "linkedin_post", label: "LinkedIn // Post", color: PL.li, plat: "LinkedIn" },
    { key: "linkedin_comment", label: "LinkedIn // Comment", color: PL.li, plat: "LinkedIn" },
    { key: "facebook_post", label: "Facebook // Post", color: PL.fb, plat: "Facebook" },
    { key: "facebook_comment", label: "Facebook // Comment", color: PL.fb, plat: "Facebook" },
    { key: "instagram_caption", label: "Instagram Reels", color: PL.ig, plat: "Instagram" },
    { key: "yt_shorts_title", label: "YouTube Shorts // Title", color: PL.yt, plat: "YouTube Shorts" },
    { key: "yt_shorts_desc", label: "YouTube Shorts // Description", color: PL.yt, plat: "YouTube Shorts" },
    { key: "tiktok_caption", label: "TikTok", color: PL.tt, plat: "TikTok" },
  ];

  var gen = async function() {
    setLoading(true);
    var data = await ask(SYS_SOC, buildPrompt(["Out Now launch rollout for SemiAnalysis Weekly Episode #" + ep.number, "Title: " + fin.title, "Guests with handles: " + gs, "Link: " + link, "Hook: " + hook, "Transcript: " + (ep.transcript || "").slice(0, 4000), 'Return JSON with these EXACT keys: {"x_hook":"...","x_reply":"...","linkedin_post":"...","linkedin_comment":"...","facebook_post":"...","facebook_comment":"...","instagram_caption":"full caption with Save CTA and hashtags and shop grid link ' + link + '","yt_shorts_title":"under 40 chars","yt_shorts_desc":"description with hashtags including #shorts","tiktok_caption":"all lowercase caption only, NO hashtags, NO overlay text"}']));
    if (data) setSocialRes(data as unknown as SocialResult);
    setLoading(false);
  };

  var redoField = async function(key: string, platLabel: string) {
    setRedoL(function(p: Record<string, boolean>) { var o = Object.assign({}, p); o[key] = true; return o; });
    var current = socialRes?.[key] || "";
    var isTitle = key === "yt_shorts_title";
    var extra = isTitle ? " Must be under 40 characters." : "";
    var data = await ask(SYS_SOC, buildPrompt(["Regenerate ONLY the " + platLabel + " caption for SA Weekly Ep #" + ep.number + " launch." + extra, "Title: " + fin.title, "Guests: " + gs, "Link: " + link, "Hook: " + hook, "Current version (be DIFFERENT): " + current, 'Return JSON: {"result":"..."}']));
    if (data && data.result) { setSocialRes(function(prev: SocialResult | null) { var o = Object.assign({}, prev) as SocialResult; o[key] = data!.result as string; return o; }); }
    setRedoL(function(p: Record<string, boolean>) { var o = Object.assign({}, p); o[key] = false; return o; });
  };

  return (<div>
    <div style={{ fontFamily: ft, fontSize: 42, fontWeight: 900, color: D.tx, letterSpacing: -2, marginBottom: 8 }}>Social</div>
    <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 500, color: D.txb, marginBottom: 32 }}>Generate social media posts for all platforms.</div>

    <div style={{ background: D.elevated, border: "1px solid " + D.border, borderRadius: 12, padding: 26, marginBottom: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}>
      <div style={{ fontFamily: mn, fontSize: 11, color: ACC, textTransform: "uppercase", letterSpacing: "2px", marginBottom: 8 }}>{"Episode #" + ep.number + " // Full Launch"}</div>
      <div style={{ fontFamily: ft, fontSize: 24, fontWeight: 900, color: D.tx, letterSpacing: -1 }}>{fin.title}</div>
      <div style={{ fontFamily: ft, fontSize: 13, color: D.txb, marginTop: 6 }}>{gs}</div>
    </div>
    <div style={{ marginBottom: 20 }}><Label>Hook / Angle</Label><textarea value={hook} onChange={function(e) { setHook(e.target.value); }} rows={3} style={{ width: "100%", padding: "12px 14px", background: D.surface, border: "1px solid " + D.border, borderRadius: 10, color: D.tx, fontFamily: ft, fontSize: 14, outline: "none", boxSizing: "border-box", resize: "vertical", transition: "border-color 0.2s ease, box-shadow 0.2s ease" }} onFocus={function(e) { e.target.style.borderColor = ACC; e.target.style.boxShadow = "0 0 24px rgba(224,99,71,0.06)"; }} onBlur={function(e) { e.target.style.borderColor = D.border; e.target.style.boxShadow = "none"; }} /></div>
    <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
      <Btn onClick={gen} loading={loading}>Generate Social Posts</Btn>
      {socialRes && <Btn onClick={gen} loading={loading} sec sm>Regen All</Btn>}
    </div>
    {loading && <ProgressBar label="Generating social captions for all platforms" />}

    {socialRes && <div style={{ marginTop: 28 }}>
      <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 800, color: D.txb, marginBottom: 12 }}>Horizontal (X, LinkedIn, Facebook)</div>
      {FIELDS.slice(0, 6).map(function(f) { return <OutCard key={f.key} title={f.label} content={socialRes[f.key] || "(not generated)"} color={f.color} onRedo={function() { redoField(f.key, f.label); }} rLoading={redoL[f.key]} />; })}
      <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 800, color: D.txb, marginTop: 24, marginBottom: 12 }}>Vertical (Shorts, Reels, TikTok)</div>
      {FIELDS.slice(6).map(function(f) { return <OutCard key={f.key} title={f.label} content={socialRes[f.key] || "(not generated)"} color={f.color} onRedo={function() { redoField(f.key, f.label); }} rLoading={redoL[f.key]} />; })}
    </div>}
  </div>);
}

// ═══ STEP 5: CLIPS ═══
// ─────────────────────────────────────────────────────────────────────
// CLIP CAPTION PROMPT
// SA Weekly does roughly 3 clips per podcast. The clips are usually
// edited later, so the analyst writes captions ahead of time using
// whatever info they have: a topic, the first/last lines spoken, a
// transcript snippet, or just context. The more inputs, the tighter
// the captions. We send only what's filled in.
// ─────────────────────────────────────────────────────────────────────
function buildClipPrompt(args: {
  ep: EpState;
  guests: Guest[];
  fin: FinalizedState | null;
  link: string;
  clipNumber: number;
  inputs: ClipInputs;
}): string {
  var parts: string[] = [];
  parts.push("Generate platform-specific captions for ONE short-form clip from SemiAnalysis Weekly Episode #" + args.ep.number + ".");
  parts.push("Episode title: " + (args.fin ? args.fin.title : "(not yet finalized)"));
  parts.push("Guests with handles: " + gStr(args.guests));
  parts.push("Episode link: " + args.link);
  parts.push("This is Clip " + args.clipNumber + " of the episode.");

  var clipBits: string[] = [];
  if (args.inputs.topic.trim()) clipBits.push("Topic / hook of this clip: " + args.inputs.topic.trim());
  if (args.inputs.firstLines.trim()) clipBits.push("First spoken lines of the clip:\n" + args.inputs.firstLines.trim());
  if (args.inputs.lastLines.trim()) clipBits.push("Last spoken lines of the clip:\n" + args.inputs.lastLines.trim());
  if (args.inputs.transcript.trim()) clipBits.push("Transcript snippet of the clip:\n" + args.inputs.transcript.trim().slice(0, 4000));
  if (args.inputs.context.trim()) clipBits.push("Additional context from the analyst: " + args.inputs.context.trim());

  if (clipBits.length === 0) {
    parts.push("Clip details: (none provided — write captions that work as a generic teaser for this episode topic, but flag that the analyst should add specifics later)");
  } else {
    parts.push("Clip details:\n\n" + clipBits.join("\n\n"));
  }

  parts.push("Captions should reference the SPECIFIC clip moment, not the full episode. Each platform follows the SA Weekly social rules baked into your system prompt.");
  parts.push('Return JSON with EXACT keys: {"x_hook":"hook tweet, no link, no hashtags","x_reply":"reply with link " + ' + JSON.stringify(args.link) + ' + " and brief context, no hashtags","linkedin_post":"3-5 sentence post ending with \\"Link in comments.\\"","linkedin_comment":"comment text starting with the link","facebook_post":"similar to linkedin, ends with \\"Link in comments.\\"","facebook_comment":"comment with link","instagram_caption":"Reels caption + Save this for later CTA + 5-8 hashtags + location San Francisco CA + ' + JSON.stringify(args.link) + '","yt_shorts_title":"under 40 chars","yt_shorts_desc":"with #shorts","tiktok_caption":"all lowercase, no hashtags, no overlay text"}');
  return parts.join("\n\n");
}

function emptyClipInputs(): ClipInputs {
  return { topic: "", firstLines: "", lastLines: "", transcript: "", context: "" };
}

interface StepClipsProps {
  ep: EpState;
  guests: Guest[];
  fin: FinalizedState | null;
  clips: ClipResult[];
  setClips: React.Dispatch<React.SetStateAction<ClipResult[]>>;
  editingLogId: string | null;
  onSavedToLog: () => void;
}

function StepClips({ ep, guests, fin, clips, setClips, editingLogId, onSavedToLog }: StepClipsProps) {
  // Default to 3 empty clip slots — that's the typical podcast cadence.
  // Triggers only when clips is empty (first arrival to the step).
  useEffect(function() {
    if (clips.length === 0) {
      setClips([
        { inputs: emptyClipInputs(), captions: null },
        { inputs: emptyClipInputs(), captions: null },
        { inputs: emptyClipInputs(), captions: null },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  var _busy = useState<Record<number, boolean>>({}), busy = _busy[0], setBusy = _busy[1];
  var link = ep.link || "https://youtube.com/@SemianalysisWeekly";

  var updateInputs = function(i: number, patch: Partial<ClipInputs>) {
    setClips(function(prev) {
      return prev.map(function(c, idx) {
        if (idx !== i) return c;
        return Object.assign({}, c, { inputs: Object.assign({}, c.inputs, patch) });
      });
    });
  };

  var addClip = function() {
    setClips(function(prev) { return prev.concat([{ inputs: emptyClipInputs(), captions: null }]); });
  };

  var removeClip = function(i: number) {
    setClips(function(prev) { return prev.filter(function(_, idx) { return idx !== i; }); });
  };

  var generateClip = async function(i: number) {
    setBusy(function(p) { var n = Object.assign({}, p); n[i] = true; return n; });
    try {
      var prompt = buildClipPrompt({ ep: ep, guests: guests, fin: fin, link: link, clipNumber: i + 1, inputs: clips[i].inputs });
      var data = await ask(SYS_SOC, prompt);
      if (data) {
        setClips(function(prev) {
          return prev.map(function(c, idx) {
            if (idx !== i) return c;
            return Object.assign({}, c, { captions: data as unknown as ClipCaptions, generatedAt: Date.now() });
          });
        });
      }
    } finally {
      setBusy(function(p) { var n = Object.assign({}, p); n[i] = false; return n; });
    }
  };

  var generateAll = async function() {
    for (var i = 0; i < clips.length; i++) {
      // Skip clips with no inputs at all so we don't waste calls on blanks.
      var anyInput = Object.values(clips[i].inputs).some(function(v) { return v && v.trim(); });
      if (!anyInput) continue;
      await generateClip(i);
    }
  };

  var anyClipGenerated = clips.some(function(c) { return c.captions; });

  var FIELDS: { key: keyof ClipCaptions; label: string; color: string }[] = [
    { key: "x_hook", label: "X // Hook Tweet", color: PL.x },
    { key: "x_reply", label: "X // Reply-to-self", color: PL.x },
    { key: "linkedin_post", label: "LinkedIn // Post", color: PL.li },
    { key: "linkedin_comment", label: "LinkedIn // Comment", color: PL.li },
    { key: "facebook_post", label: "Facebook // Post", color: PL.fb },
    { key: "facebook_comment", label: "Facebook // Comment", color: PL.fb },
    { key: "instagram_caption", label: "Instagram Reels", color: PL.ig },
    { key: "yt_shorts_title", label: "YouTube Shorts // Title", color: PL.yt },
    { key: "yt_shorts_desc", label: "YouTube Shorts // Description", color: PL.yt },
    { key: "tiktok_caption", label: "TikTok", color: PL.tt },
  ];

  return <div>
    <div style={{ fontFamily: ft, fontSize: 42, fontWeight: 900, color: D.tx, letterSpacing: -2, marginBottom: 8 }}>Clips</div>
    <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 500, color: D.txb, marginBottom: 24 }}>Generate platform-ready captions for the clips you'll cut from this episode. Fill in whatever you have — topic, first/last lines, a snippet — and the captions will land tighter the more context you provide.</div>

    {editingLogId && <div style={{ marginBottom: 20, padding: "10px 14px", borderRadius: 10, background: D.teal + "0A", border: "1px solid " + D.teal + "30", fontFamily: mn, fontSize: 11, color: D.teal, letterSpacing: 0.5 }}>Editing clips for a previously launched episode. Changes save back to the Activity Log automatically.</div>}

    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
      <div style={{ fontFamily: ft, fontSize: 18, fontWeight: 800, color: D.tx }}>{clips.length} clip{clips.length !== 1 ? "s" : ""}</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span onClick={addClip} style={{ fontFamily: mn, fontSize: 10, color: D.txl, cursor: "pointer", padding: "6px 12px", borderRadius: 8, border: "1px solid " + D.border, transition: "all 0.2s ease" }}>+ Add clip</span>
        <Btn onClick={generateAll} sec sm>Generate all with input</Btn>
        {editingLogId && anyClipGenerated && <Btn onClick={onSavedToLog} sm>Done · Back to log</Btn>}
      </div>
    </div>

    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {clips.map(function(clip, i) {
        var loading = !!busy[i];
        var hasInput = Object.values(clip.inputs).some(function(v) { return v && v.trim(); });
        return <div key={i} style={{ background: D.elevated, border: "1px solid " + D.border, borderRadius: 12, padding: "20px 22px", boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: ACC + "15", border: "1px solid " + ACC + "40", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: gf, fontSize: 16, fontWeight: 900, color: ACC, flexShrink: 0 }}>{i + 1}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: gf, fontSize: 18, fontWeight: 800, color: D.tx, letterSpacing: -0.3 }}>Clip {i + 1}</div>
              <div style={{ fontFamily: mn, fontSize: 10, color: D.txl, marginTop: 2 }}>{clip.captions ? "Captions generated" : hasInput ? "Inputs ready · click Generate" : "Add any context to start"}</div>
            </div>
            {clips.length > 1 && <span onClick={function() { removeClip(i); }} style={{ fontFamily: mn, fontSize: 9, color: D.txl, cursor: "pointer", padding: "4px 10px", borderRadius: 6, border: "1px solid " + D.border }}>Remove</span>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div style={{ gridColumn: "1 / 3" }}>
              <div style={{ fontFamily: mn, fontSize: 10, color: D.txb, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 }}>Topic / hook of the clip</div>
              <input value={clip.inputs.topic} onChange={function(e) { updateInputs(i, { topic: e.target.value }); }} placeholder="e.g. Why HBM3E is the bottleneck" style={inputStyle()} />
            </div>
            <div>
              <div style={{ fontFamily: mn, fontSize: 10, color: D.txb, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 }}>First few lines spoken</div>
              <textarea rows={3} value={clip.inputs.firstLines} onChange={function(e) { updateInputs(i, { firstLines: e.target.value }); }} placeholder='"You know what nobody wants to talk about with Blackwell..."' style={taStyle()} />
            </div>
            <div>
              <div style={{ fontFamily: mn, fontSize: 10, color: D.txb, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 }}>Last few lines spoken</div>
              <textarea rows={3} value={clip.inputs.lastLines} onChange={function(e) { updateInputs(i, { lastLines: e.target.value }); }} placeholder="Closing line that lands the punch." style={taStyle()} />
            </div>
            <div style={{ gridColumn: "1 / 3" }}>
              <div style={{ fontFamily: mn, fontSize: 10, color: D.txb, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 }}>Transcript snippet (optional)</div>
              <textarea rows={4} value={clip.inputs.transcript} onChange={function(e) { updateInputs(i, { transcript: e.target.value }); }} placeholder="Paste the section of the episode this clip covers. Top 4000 characters used." style={taStyle()} />
            </div>
            <div style={{ gridColumn: "1 / 3" }}>
              <div style={{ fontFamily: mn, fontSize: 10, color: D.txb, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 }}>Additional context for the captions</div>
              <textarea rows={2} value={clip.inputs.context} onChange={function(e) { updateInputs(i, { context: e.target.value }); }} placeholder="e.g. Make it punchy, lean on the supply chain angle, mention TSMC capex" style={taStyle()} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Btn onClick={function() { generateClip(i); }} loading={loading} sm>{clip.captions ? "Regenerate captions" : "Generate captions"}</Btn>
            {loading && <span style={{ fontFamily: mn, fontSize: 10, color: D.txl }}>Writing platform captions…</span>}
          </div>

          {clip.captions && <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid " + D.border }}>
            <div style={{ fontFamily: mn, fontSize: 10, color: ACC, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>Captions for Clip {i + 1}</div>
            {FIELDS.map(function(f) {
              var val = clip.captions ? clip.captions[f.key] : undefined;
              if (!val) return null;
              return <div key={String(f.key)} style={{ background: D.surface, borderLeft: "3px solid " + f.color, border: "1px solid " + D.border, borderLeftWidth: 3, borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontFamily: mn, fontSize: 10, color: f.color, textTransform: "uppercase", letterSpacing: 1.5 }}>{f.label}</div>
                  <span onClick={function() { copyText(val as string); showToast("Copied " + f.label); }} style={{ fontFamily: mn, fontSize: 9, color: D.txl, cursor: "pointer", padding: "2px 8px", borderRadius: 4, border: "1px solid " + D.border }}>Copy</span>
                </div>
                <div style={{ fontFamily: ft, fontSize: 13, color: D.tx, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{val}</div>
              </div>;
            })}
          </div>}
        </div>;
      })}
    </div>
  </div>;
}

function inputStyle(): React.CSSProperties {
  return { width: "100%", padding: "10px 12px", background: D.surface, border: "1px solid " + D.border, borderRadius: 8, color: D.tx, fontFamily: ft, fontSize: 13, outline: "none", boxSizing: "border-box" };
}
function taStyle(): React.CSSProperties {
  return Object.assign({}, inputStyle(), { fontFamily: ft, lineHeight: 1.5, resize: "vertical" as const, minHeight: 60 });
}

// ═══ STEP 6: EXPORT ═══
function StepExport({ ep, guests, fin, socialRes, clips, onComplete }: { ep: EpState; guests: Guest[]; fin: FinalizedState | null; socialRes: SocialResult | null; clips?: ClipResult[]; onComplete?: (data: { title: string; description: string; social: SocialResult | null }) => void }) {
  var _done = useState<boolean>(false), done = _done[0], setDone = _done[1];
  var _show = useState<boolean>(false), showModal = _show[0], setShowModal = _show[1];

  if (!fin) return <div style={{ textAlign: "center", padding: 80, color: D.txb, fontFamily: ft }}>Complete earlier steps first.</div>;

  var gs = gStr(guests);
  var FIELDS = [
    { key: "x_hook", label: "X // Hook Tweet" },
    { key: "x_reply", label: "X // Reply-to-self" },
    { key: "linkedin_post", label: "LinkedIn // Post" },
    { key: "linkedin_comment", label: "LinkedIn // Comment" },
    { key: "facebook_post", label: "Facebook // Post" },
    { key: "facebook_comment", label: "Facebook // Comment" },
    { key: "instagram_caption", label: "Instagram Reels" },
    { key: "yt_shorts_title", label: "YouTube Shorts // Title" },
    { key: "yt_shorts_desc", label: "YouTube Shorts // Description" },
    { key: "tiktok_caption", label: "TikTok" },
  ];

  var fullDescription = composeDescription(fin.description, ep.timestamps);
  var doExport = function() {
    if (!socialRes) return;
    var spotifyTitle = buildSpotifyTitle(fin.title, guests);
    var sections = [
      { heading: "Episode Info", items: [
        { label: "YouTube Title", content: fin.title + "  (" + fin.title.length + "/100)" },
        { label: "Spotify Title", content: spotifyTitle + "  (" + spotifyTitle.length + "/200)" },
        { label: "YouTube Description (with chapters)", content: fullDescription },
        { label: "Guests", content: gs },
      ]},
      { heading: "Horizontal (X, LinkedIn, Facebook)", items: FIELDS.slice(0, 6).map(function(f) { return { label: f.label, content: socialRes[f.key] || "" }; }) },
      { heading: "Vertical (Shorts, Reels, TikTok)", items: FIELDS.slice(6).map(function(f) { return { label: f.label, content: socialRes[f.key] || "" }; }) },
    ];
    // Include any generated clip captions in the same launch DOCX so the
    // entire kit ships in one file. Each clip gets its own labeled section.
    if (clips && clips.length) {
      clips.forEach(function(clip, i) {
        if (!clip.captions) return;
        var caps = clip.captions;
        sections.push({
          heading: "Clip " + (i + 1) + (clip.inputs.topic ? " // " + clip.inputs.topic : ""),
          items: FIELDS.map(function(f) { return { label: f.label, content: caps[f.key] || "" }; }).filter(function(item) { return item.content; }),
        });
      });
    }
    exportDoc("Ep #" + ep.number + " Launch Rollout", sections);
  };

  var copyAll = function() {
    if (!socialRes) return;
    var parts = ["EPISODE #" + ep.number + " - " + fin.title, "Guests: " + gs, "", "DESCRIPTION:", fullDescription, ""];
    FIELDS.forEach(function(f) {
      if (socialRes[f.key]) { parts.push(f.label.toUpperCase() + ":"); parts.push(socialRes[f.key]!); parts.push(""); }
    });
    copyText(parts.join("\n"));
    showToast("All content copied to clipboard");
  };

  var copyYoutubeDescription = function() {
    copyText(fullDescription);
    showToast(ep.timestamps ? "YouTube description with chapters copied" : "Description copied");
  };

  var doComplete = function() {
    setDone(true); setShowModal(true);
    if (onComplete) onComplete({ title: fin.title, description: fullDescription, social: socialRes });
  };

  return (<div>
    <div style={{ fontFamily: ft, fontSize: 42, fontWeight: 900, color: D.tx, letterSpacing: -2, marginBottom: 8 }}>Export</div>
    <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 500, color: D.txb, marginBottom: 32 }}>Download your launch kit and copy all content.</div>

    {/* Summary */}
    <div style={{ background: D.elevated, border: "1px solid " + D.border, borderRadius: 12, padding: 26, marginBottom: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}>
      <div style={{ fontFamily: mn, fontSize: 11, color: ACC, textTransform: "uppercase", letterSpacing: "2px", marginBottom: 8 }}>{"Episode #" + ep.number}</div>
      <div style={{ fontFamily: ft, fontSize: 24, fontWeight: 900, color: D.tx, letterSpacing: -1, marginBottom: 6 }}>{fin.title}</div>
      <div style={{ fontFamily: ft, fontSize: 13, color: D.txb }}>{gs}</div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 12 }}>
        <div style={{ fontFamily: mn, fontSize: 9, color: D.txb, letterSpacing: "1.5px", fontWeight: 700, textTransform: "uppercase" }}>
          YouTube Description {ep.timestamps ? "· chapters appended" : ""}
        </div>
        <span onClick={copyYoutubeDescription} style={{ fontFamily: mn, fontSize: 10, color: ACC, cursor: "pointer", padding: "4px 10px", borderRadius: 6, border: "1px solid " + ACC + "30", letterSpacing: 0.5 }}>
          Copy
        </span>
      </div>
      <div style={{ fontFamily: ft, fontSize: 14, color: D.txb, lineHeight: 1.7, whiteSpace: "pre-wrap", marginTop: 6, maxHeight: 200, overflow: "auto", padding: "10px 12px", background: D.surface, border: "1px solid " + D.border, borderRadius: 8 }}>{fullDescription}</div>
    </div>

    {socialRes && <div style={{ background: D.elevated, border: "1px solid " + D.border, borderRadius: 12, padding: 20, marginBottom: 24 }}>
      <div style={{ fontFamily: mn, fontSize: 9, color: D.txb, textTransform: "uppercase", letterSpacing: "2px", marginBottom: 12 }}>Social Captions</div>
      {FIELDS.map(function(f) { if (!socialRes![f.key]) return null; return <div key={f.key} style={{ marginBottom: 10, padding: "12px 14px", background: D.surface, borderRadius: 10, border: "1px solid " + D.border }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}><div style={{ fontFamily: mn, fontSize: 9, color: ACC, textTransform: "uppercase", letterSpacing: "1.5px" }}>{f.label}</div><CopyBtn text={socialRes![f.key] || ""} /></div>
        <div style={{ fontFamily: ft, fontSize: 13, color: D.txb, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{socialRes![f.key]}</div>
      </div>; })}
    </div>}

    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {socialRes && <Btn onClick={doExport} sec>Download as .doc</Btn>}
      {socialRes && <Btn onClick={copyAll} sec>Copy All</Btn>}
      <Btn onClick={doComplete}>Complete Launch Kit</Btn>
    </div>

    {/* Congratulations Modal */}
    {showModal && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }} onClick={function() { setShowModal(false); }}>
      <Confetti />
      <div onClick={function(e) { e.stopPropagation(); }} style={{ background: D.elevated, border: "1px solid " + ACC, borderRadius: 12, padding: 40, maxWidth: 440, textAlign: "center", boxShadow: "0 0 40px rgba(224,99,71,0.2), 0 0 80px rgba(224,99,71,0.08)", position: "relative", zIndex: 1001 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>&#x1F680;</div>
        <div style={{ fontFamily: ft, fontSize: 24, fontWeight: 900, color: ACC, marginBottom: 10, letterSpacing: -1 }}>Launch Your Video Now</div>
        <div style={{ fontFamily: ft, fontSize: 15, color: D.tx, marginBottom: 6, fontWeight: 700 }}>{fin.title}</div>
        <div style={{ fontFamily: mn, fontSize: 11, color: D.txb, marginBottom: 22, letterSpacing: "1px" }}>Episode #{ep.number} - {gs}</div>
        <div style={{ fontFamily: ft, fontSize: 14, color: D.txb, marginBottom: 28 }}>Your Launch Kit is saved. Download the doc, schedule in Buffer, and push it live.</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Btn onClick={function() { window.open("https://publish.buffer.com", "_blank"); }}>Open Buffer</Btn>
          {socialRes && <Btn onClick={doExport} sec>Download .doc</Btn>}
          <Btn onClick={function() { setShowModal(false); }} sec sm>Close</Btn>
        </div>
      </div>
    </div>}
  </div>);
}

// ═══ STEP 7: LOG ═══
function StepLog({ logData, setLogData, onDevelopClips, onEditEntry, onOpenTimeline, current, onSaveCurrent }: {
  logData: LogEntry[];
  setLogData: React.Dispatch<React.SetStateAction<LogEntry[]>>;
  onDevelopClips: (entry: LogEntry) => void;
  onEditEntry: (entry: LogEntry) => void;
  onOpenTimeline: (entryId: string) => void;
  current: { ep: EpState; guests: Guest[]; fin: FinalizedState | null; socialRes: SocialResult | null; clips: ClipResult[]; editingLogId: string | null };
  onSaveCurrent: () => void;
}) {
  var _ed = useState<boolean>(false), editing = _ed[0], setEditing = _ed[1];
  var _view = useState<number | null>(null), viewIdx = _view[0], setViewIdx = _view[1];
  var _viewClips = useState<number | null>(null), viewClipsIdx = _viewClips[0], setViewClipsIdx = _viewClips[1];

  // Is there a current draft that's NOT yet in the log? Only show the
  // save panel when there's actually something meaningful to save.
  var alreadyLogged = !!current.editingLogId && logData.some(function(e) { return e.id === current.editingLogId; });
  var hasDraftToSave = !!current.fin && !alreadyLogged && (current.ep.transcript || current.fin.title);
  var draftEpInLog = !!current.ep.number && logData.some(function(e) {
    return String(e.episode || "").replace(/\D/g, "") === String(current.ep.number || "").replace(/\D/g, "");
  });

  var removeEntry = function(idx: number) { setLogData(function(prev: LogEntry[]) { return prev.filter(function(_: LogEntry, j: number) { return j !== idx; }); }); };

  var downloadLaunchKit = function(e: LogEntry) {
    var sections: DocSection[] = [
      { heading: "Episode Info", items: [
        { label: "Title", content: e.title },
        { label: "Description", content: e.description || "" },
        { label: "Guests", content: e.guests },
        { label: "Date", content: e.date },
      ]},
    ];
    if (e.social) {
      var social = e.social;
      sections.push({ heading: "Horizontal (X, LinkedIn, Facebook)", items: ["x_hook", "x_reply", "linkedin_post", "linkedin_comment", "facebook_post", "facebook_comment"].filter(function(k: string) { return social[k]; }).map(function(k: string) { return { label: k.replace(/_/g, " ").replace(/\b\w/g, function(c: string) { return c.toUpperCase(); }), content: social[k] || "" }; }) });
      sections.push({ heading: "Vertical (Shorts, Reels, TikTok)", items: ["instagram_caption", "yt_shorts_title", "yt_shorts_desc", "tiktok_caption"].filter(function(k: string) { return social[k]; }).map(function(k: string) { return { label: k.replace(/_/g, " ").replace(/\b\w/g, function(c: string) { return c.toUpperCase(); }), content: social[k] || "" }; }) });
    }
    if (e.clips && e.clips.length) {
      e.clips.forEach(function(clip, i) {
        if (!clip.captions) return;
        var caps = clip.captions;
        sections.push({
          heading: "Clip " + (i + 1) + (clip.inputs.topic ? " // " + clip.inputs.topic : ""),
          items: Object.keys(caps).filter(function(k) { return caps[k]; }).map(function(k) { return { label: k.replace(/_/g, " ").replace(/\b\w/g, function(c) { return c.toUpperCase(); }), content: caps[k] || "" }; }),
        });
      });
    }
    exportDoc("Ep #" + e.episode + " Launch Kit", sections);
  };

  var downloadSocialKit = function(e: LogEntry) {
    if (!e.social) return;
    var social = e.social;
    var sections: DocSection[] = [
      { heading: "Social Captions", items: Object.keys(social).map(function(k: string) { return { label: k.replace(/_/g, " ").replace(/\b\w/g, function(c: string) { return c.toUpperCase(); }), content: social[k] || "" }; }) },
    ];
    exportDoc("Ep #" + e.episode + " Social Kit", sections);
  };

  // Clip Kit · per-episode DOCX of just the clip captions, with each clip
  // clearly labeled "Clip 1 // <topic>" so there's never confusion about
  // which set of captions belongs to which cut.
  var downloadClipKit = function(e: LogEntry) {
    if (!e.clips || !e.clips.length) return;
    var sections: DocSection[] = [
      { heading: "Episode Info", items: [
        { label: "Episode", content: "#" + e.episode + " — " + e.title },
        { label: "Guests", content: e.guests },
        { label: "Date", content: e.date },
      ]},
    ];
    e.clips.forEach(function(clip, i) {
      var inputItems: { label: string; content: string }[] = [];
      if (clip.inputs.topic) inputItems.push({ label: "Topic", content: clip.inputs.topic });
      if (clip.inputs.firstLines) inputItems.push({ label: "First lines", content: clip.inputs.firstLines });
      if (clip.inputs.lastLines) inputItems.push({ label: "Last lines", content: clip.inputs.lastLines });
      if (clip.inputs.context) inputItems.push({ label: "Context", content: clip.inputs.context });
      if (inputItems.length) {
        sections.push({ heading: "Clip " + (i + 1) + " · Inputs", items: inputItems });
      }
      if (clip.captions) {
        var caps = clip.captions;
        sections.push({
          heading: "Clip " + (i + 1) + " · Captions" + (clip.inputs.topic ? " · " + clip.inputs.topic : ""),
          items: Object.keys(caps).filter(function(k) { return caps[k]; }).map(function(k) { return { label: k.replace(/_/g, " ").replace(/\b\w/g, function(c) { return c.toUpperCase(); }), content: caps[k] || "" }; }),
        });
      }
    });
    exportDoc("Ep #" + e.episode + " Clip Kit", sections);
  };

  var hasClips = function(e: LogEntry) { return !!(e.clips && e.clips.some(function(c) { return c.captions; })); };

  var viewEntry = viewIdx !== null && logData[viewIdx] ? logData[viewIdx] : null;

  return (<div>
    <div style={{ fontFamily: ft, fontSize: 42, fontWeight: 900, color: D.tx, letterSpacing: -2, marginBottom: 8 }}>Activity Log</div>
    <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 500, color: D.txb, marginBottom: 32 }}>View and manage completed episodes.</div>

    {/* Save current draft → log (without going through the full Export
        flow). When the user is mid-episode and wants to bookmark progress. */}
    {hasDraftToSave && <div style={{
      background: D.elevated, border: "1px solid " + D.teal + "40", borderRadius: 12,
      padding: 18, marginBottom: 22,
      boxShadow: "0 0 24px rgba(46,173,142,0.06)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: mn, fontSize: 10, color: D.teal, textTransform: "uppercase", letterSpacing: "2px", marginBottom: 6, fontWeight: 800 }}>
            Current draft · not in log yet
          </div>
          <div style={{ fontFamily: ft, fontSize: 16, fontWeight: 800, color: D.tx, lineHeight: 1.35, marginBottom: 4 }}>
            Ep #{current.ep.number} · {current.fin?.title || "(untitled)"}
          </div>
          <div style={{ fontFamily: mn, fontSize: 10, color: D.txl }}>
            {gStr(current.guests)} · {current.clips.length} clip{current.clips.length === 1 ? "" : "s"}
            {current.socialRes ? " · social done" : " · no social yet"}
            {draftEpInLog ? " · note: an episode with this number already exists in log" : ""}
          </div>
        </div>
        <Btn onClick={onSaveCurrent} sm>Save to Log</Btn>
      </div>
    </div>}

    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
      <div style={{ fontFamily: ft, fontSize: 18, fontWeight: 800, color: D.tx, letterSpacing: -0.5 }}>{logData.length} Episode{logData.length !== 1 ? "s" : ""}</div>
      {logData.length > 0 && <span onClick={function() { setEditing(!editing); }} style={{ fontFamily: mn, fontSize: 10, color: editing ? ACC : D.txl, cursor: "pointer", padding: "5px 12px", borderRadius: 8, border: "1px solid " + (editing ? ACC + "40" : D.border), transition: "all 0.2s ease" }}>{editing ? "Done" : "Edit"}</span>}
    </div>
    {logData.length === 0 ? <div style={{ textAlign: "center", padding: 60, color: D.txl, fontFamily: ft, fontSize: 14 }}>No completed episodes yet.</div>
      : logData.map(function(e, i) { return (<div key={i} style={{ background: D.elevated, border: "1px solid " + D.border, borderRadius: 12, padding: "18px 20px", marginBottom: 10, boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
          {editing && <span onClick={function() { removeEntry(i); }} style={{ width: 24, height: 24, borderRadius: "50%", background: ACC + "15", border: "1px solid " + ACC, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mn, fontSize: 13, color: ACC, cursor: "pointer", flexShrink: 0 }}>x</span>}
          <div style={{ width: 42, height: 42, borderRadius: 10, background: D.surface, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mn, fontSize: 12, color: ACC, fontWeight: 700, border: "1px solid " + D.border, flexShrink: 0 }}>{"#" + e.episode}</div>
          <div style={{ flex: 1 }}><div style={{ fontFamily: ft, fontSize: 15, fontWeight: 700, color: D.tx }}>{e.title}</div><div style={{ fontFamily: ft, fontSize: 12, color: D.txb }}>{e.guests}</div></div>
          {/* Phase 2C · "N versions" chip — opens the version timeline modal. */}
          {(function() {
            var vCount = e.versions ? e.versions.length : 1;
            return <span onClick={function(ev) { ev.stopPropagation(); if (e.id) onOpenTimeline(e.id); }} title="View version history" style={{ fontFamily: mn, fontSize: 9, color: D.violet, cursor: "pointer", padding: "3px 9px", background: D.violet + "0F", border: "1px solid " + D.violet + "40", borderRadius: 999, fontWeight: 700, letterSpacing: 0.4 }}>{vCount} version{vCount === 1 ? "" : "s"}</span>;
          })()}
          <div style={{ fontFamily: mn, fontSize: 9, color: D.txl }}>{e.date}</div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {/* Edit Episode — re-opens the whole suite hydrated with this
              entry. Subsequent saves write back to the same log entry. */}
          <span onClick={function() { onEditEntry(e); }} style={{ fontFamily: mn, fontSize: 9, color: D.amber, cursor: "pointer", padding: "4px 12px", background: "linear-gradient(135deg, " + D.amber + "1A, " + D.amber + "08)", borderRadius: 6, border: "1px solid " + D.amber + "55", fontWeight: 700 }}
            title={e.ep && e.guestList ? "Reopen with full hydrated state" : "Reopen with best-effort hydration (transcript blank — older entry)"}>
            ✎ Edit Episode{e.ep && e.guestList ? "" : " ·"}
          </span>
          <span onClick={function() { setViewIdx(i); }} style={{ fontFamily: mn, fontSize: 9, color: D.teal, padding: "4px 12px", background: D.teal + "0A", borderRadius: 6, cursor: "pointer", border: "1px solid " + D.teal + "30" }}>View Launch Kit</span>
          <span onClick={function() { downloadLaunchKit(e); }} style={{ fontFamily: mn, fontSize: 9, color: ACC, cursor: "pointer", padding: "4px 12px", background: ACC + "0A", borderRadius: 6, border: "1px solid " + ACC + "30" }}>Download Launch Kit</span>
          {e.social && <span onClick={function() { downloadSocialKit(e); }} style={{ fontFamily: mn, fontSize: 9, color: D.blue, cursor: "pointer", padding: "4px 12px", background: D.blue + "0A", borderRadius: 6, border: "1px solid " + D.blue + "30" }}>Download Social Kit</span>}
          {/* Clip Kit affordances · "Develop Clips" until clips exist; then "View" + "Download". */}
          {hasClips(e) ? <>
            <span onClick={function() { setViewClipsIdx(i); }} style={{ fontFamily: mn, fontSize: 9, color: D.violet, padding: "4px 12px", background: D.violet + "0A", borderRadius: 6, cursor: "pointer", border: "1px solid " + D.violet + "40" }}>View Clip Kit</span>
            <span onClick={function() { downloadClipKit(e); }} style={{ fontFamily: mn, fontSize: 9, color: D.violet, padding: "4px 12px", background: D.violet + "0A", borderRadius: 6, cursor: "pointer", border: "1px solid " + D.violet + "40" }}>Download Clip Kit</span>
            <span onClick={function() { onDevelopClips(e); }} style={{ fontFamily: mn, fontSize: 9, color: D.txl, padding: "4px 12px", borderRadius: 6, cursor: "pointer", border: "1px solid " + D.border }}>Edit Clips</span>
          </> : <span onClick={function() { onDevelopClips(e); }} style={{ fontFamily: mn, fontSize: 9, color: D.violet, padding: "4px 12px", background: "linear-gradient(135deg, " + D.violet + "12, " + D.violet + "04)", borderRadius: 6, cursor: "pointer", border: "1px solid " + D.violet + "55", fontWeight: 700 }}>+ Develop Clips</span>}
        </div>
      </div>); })}

    {/* View Launch Kit Modal */}
    {viewEntry && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }} onClick={function() { setViewIdx(null); }}>
      <div onClick={function(e) { e.stopPropagation(); }} style={{ background: D.elevated, border: "1px solid " + D.border, borderRadius: 12, padding: 32, maxWidth: 640, width: "90%", maxHeight: "80vh", overflow: "auto", boxShadow: "0 4px 40px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: mn, fontSize: 11, color: ACC, textTransform: "uppercase", letterSpacing: "2px" }}>{"Episode #" + viewEntry.episode + " // Launch Kit"}</div>
          <span onClick={function() { setViewIdx(null); }} style={{ fontFamily: mn, fontSize: 11, color: D.txl, cursor: "pointer", padding: "4px 8px" }}>x</span>
        </div>
        <div style={{ fontFamily: ft, fontSize: 20, fontWeight: 900, color: D.tx, marginBottom: 4, letterSpacing: -0.5 }}>{viewEntry.title}</div>
        <div style={{ fontFamily: ft, fontSize: 13, color: D.txb, marginBottom: 8 }}>{viewEntry.guests} // {viewEntry.date}</div>
        {viewEntry.description && <div style={{ fontFamily: ft, fontSize: 14, color: D.txb, lineHeight: 1.7, whiteSpace: "pre-wrap", padding: "14px 16px", background: D.surface, borderRadius: 10, border: "1px solid " + D.border, marginBottom: 18, maxHeight: 160, overflow: "auto" }}>{viewEntry.description}</div>}
        {viewEntry.social && <div>
          <div style={{ fontFamily: mn, fontSize: 9, color: D.txb, textTransform: "uppercase", letterSpacing: "2px", marginBottom: 12 }}>Social Captions</div>
          {Object.keys(viewEntry!.social!).map(function(k: string) { return <div key={k} style={{ marginBottom: 10, padding: "12px 14px", background: D.surface, borderRadius: 10, border: "1px solid " + D.border }}>
            <div style={{ fontFamily: mn, fontSize: 9, color: ACC, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 5 }}>{k.replace(/_/g, " ")}</div>
            <div style={{ fontFamily: ft, fontSize: 13, color: D.txb, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{viewEntry!.social![k]}</div>
          </div>; })}
        </div>}
        <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
          <Btn onClick={function() { onEditEntry(viewEntry!); setViewIdx(null); }} sm>✎ Edit Episode</Btn>
          <Btn onClick={function() { downloadLaunchKit(viewEntry!); }} sm sec>Download Launch Kit</Btn>
          {viewEntry.social && <Btn onClick={function() { downloadSocialKit(viewEntry!); }} sm sec>Download Social Kit</Btn>}
          {hasClips(viewEntry) && <Btn onClick={function() { downloadClipKit(viewEntry!); }} sm sec>Download Clip Kit</Btn>}
        </div>
      </div>
    </div>}

    {/* View Clip Kit Modal */}
    {viewClipsIdx !== null && logData[viewClipsIdx] && (function() {
      var clipEntry = logData[viewClipsIdx];
      var clipsArr = clipEntry.clips || [];
      return <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }} onClick={function() { setViewClipsIdx(null); }}>
        <div onClick={function(e) { e.stopPropagation(); }} style={{ background: D.elevated, border: "1px solid " + D.border, borderRadius: 12, padding: 32, maxWidth: 720, width: "92%", maxHeight: "85vh", overflow: "auto", boxShadow: "0 4px 40px rgba(0,0,0,0.6)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ fontFamily: mn, fontSize: 11, color: D.violet, textTransform: "uppercase", letterSpacing: "2px" }}>{"Episode #" + clipEntry.episode + " // Clip Kit"}</div>
            <span onClick={function() { setViewClipsIdx(null); }} style={{ fontFamily: mn, fontSize: 11, color: D.txl, cursor: "pointer", padding: "4px 8px" }}>x</span>
          </div>
          <div style={{ fontFamily: ft, fontSize: 20, fontWeight: 900, color: D.tx, marginBottom: 4, letterSpacing: -0.5 }}>{clipEntry.title}</div>
          <div style={{ fontFamily: ft, fontSize: 13, color: D.txb, marginBottom: 24 }}>{clipEntry.guests} // {clipEntry.date} // {clipsArr.length} clip{clipsArr.length !== 1 ? "s" : ""}</div>
          {clipsArr.map(function(clip, ci) {
            var caps = clip.captions || {};
            return <div key={ci} style={{ marginBottom: 22, padding: "16px 18px", background: D.surface, borderRadius: 12, border: "1px solid " + D.border }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: D.violet + "20", border: "1px solid " + D.violet + "50", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: gf, fontSize: 14, fontWeight: 900, color: D.violet }}>{ci + 1}</div>
                <div style={{ fontFamily: gf, fontSize: 16, fontWeight: 800, color: D.tx, letterSpacing: -0.3 }}>Clip {ci + 1}{clip.inputs.topic ? " · " + clip.inputs.topic : ""}</div>
              </div>
              {!clip.captions ? <div style={{ fontFamily: mn, fontSize: 10, color: D.txl, padding: "8px 0" }}>No captions generated yet.</div> : Object.keys(caps).filter(function(k) { return caps[k]; }).map(function(k) { return <div key={k} style={{ marginBottom: 8, padding: "10px 12px", background: D.elevated, borderRadius: 8, border: "1px solid " + D.border }}>
                <div style={{ fontFamily: mn, fontSize: 9, color: ACC, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 5 }}>{k.replace(/_/g, " ")}</div>
                <div style={{ fontFamily: ft, fontSize: 13, color: D.txb, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{caps[k]}</div>
              </div>; })}
            </div>;
          })}
          <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
            <Btn onClick={function() { downloadClipKit(clipEntry); }} sm sec>Download Clip Kit</Btn>
            <Btn onClick={function() { setViewClipsIdx(null); onDevelopClips(clipEntry); }} sm>Edit Clips</Btn>
          </div>
        </div>
      </div>;
    })()}
  </div>);
}

// ═══ MAIN COMPONENT ═══
export default function SAWeekly() {
  var userCtx = useUser();
  var STEPS = ["Setup", "Generate", "Review", "Social", "Clips", "Export", "Log"];
  var _step = useState<number>(0), step = _step[0], setStep = _step[1];

  // Episode state
  var _e = useState<EpState>({ number: "008", link: "", transcript: "", timestamps: "", extra: "" }), ep = _e[0], setEp = _e[1];
  var _g = useState<Guest[]>([]), guests = _g[0], setGuests = _g[1];
  var _o = useState<GeneratedOptions | null>(null), opts = _o[0], setOpts = _o[1];
  var _sl = useState<SelectionState>({ title: 0, desc: 0, thumb: 0 }), sel = _sl[0], setSel = _sl[1];
  var _f = useState<FinalizedState | null>(null), fin = _f[0], setFin = _f[1];
  var _th = useState<string | null>(null), thumb = _th[0], setThumb = _th[1];
  var _dl = useState<string>("medium"), descLen = _dl[0], setDescLen = _dl[1];
  var _sr = useState<SocialResult | null>(null), socialRes = _sr[0], setSocialRes = _sr[1];
  var _cl = useState<ClipResult[]>([]), clips = _cl[0], setClips = _cl[1];
  // When the user clicked "Develop Clips" on a past Activity Log entry,
  // editingLogId tracks which entry the clips should be written back into.
  // null when working on the current in-flight episode.
  var _eli = useState<string | null>(null), editingLogId = _eli[0], setEditingLogId = _eli[1];
  var _lch = useState<boolean>(false), launched = _lch[0], setLaunched = _lch[1];
  var _log = useState<LogEntry[]>([]), logData = _log[0], setLogData = _log[1];
  var _loaded = useState<boolean>(false), loaded = _loaded[0], setLoaded = _loaded[1];
  var _hasDraft = useState<boolean>(false), hasDraft = _hasDraft[0], setHasDraft = _hasDraft[1];
  var _interacted = useState<boolean>(false), interacted = _interacted[0], setInteracted = _interacted[1];
  var draftRef = useRef<Record<string, unknown> | null>(null);
  // Phase 2B — local editor session stamps. editorName + editorStartedAt
  // are also written into the LogEntry on hydrate so other tabs can see
  // "Akash started editing 1 min ago" via lastEditedAt/lastEditedBy.
  var _editorName = useState<string | null>(null), editorName = _editorName[0], setEditorName = _editorName[1];
  var _editorStartedAt = useState<string | null>(null), editorStartedAt = _editorStartedAt[0], setEditorStartedAt = _editorStartedAt[1];
  // Phase 2C — version timeline modal target.
  var _timelineId = useState<string | null>(null), timelineEntryId = _timelineId[0], setTimelineEntryId = _timelineId[1];

  // Load state on mount: try Supabase first (800ms timeout), fall back to Redis
  useEffect(function() {
    var settled = false;
    var applyData = function(d: { state?: Record<string, unknown> | null; log?: LogEntry[] }) {
      if (d.log && Array.isArray(d.log)) {
        // Phase 2A migration · wrap legacy flat-shaped entries into the
        // versioned shape on read. Non-destructive: re-running on already
        // migrated rows is idempotent.
        var migrated = d.log.map(function(e) { return migrateLogEntry(e); });
        setLogData(migrated);
        // Auto-bump episode number to (latest_in_log + 1) on fresh load,
        // unless an in-flight draft is going to be loaded (in which case
        // the draft's number wins). The user can still type a different
        // number — this is just a sensible default so step 0 doesn't
        // anchor on "008" forever.
        // Per-user draft (Phase 2E) takes precedence; fall back to shared row.
        var userDraft = readUserDraft(userCtx.user ? userCtx.user.name : null);
        var sharedDraft = d.state && ((d.state.ep && (d.state.ep as Record<string, unknown>).transcript) || d.state.opts || d.state.fin) ? d.state : null;
        var draftHasContent = !!userDraft || !!sharedDraft;
        if (!draftHasContent) {
          setEp(function(prev) { return Object.assign({}, prev, { number: nextEpisodeNumber(migrated) }); });
        }
      }
      // Phase 2E · per-user draft scratch wins over the shared weekly-master
      // state. Falls back to the shared row for backward compat.
      var userDraftFinal = readUserDraft(userCtx.user ? userCtx.user.name : null);
      if (userDraftFinal && ((userDraftFinal.ep && (userDraftFinal.ep as Record<string, unknown>).transcript) || userDraftFinal.opts || userDraftFinal.fin)) {
        draftRef.current = userDraftFinal;
        setHasDraft(true);
      } else if (d.state && ((d.state.ep && (d.state.ep as Record<string, unknown>).transcript) || d.state.opts || d.state.fin)) {
        draftRef.current = d.state;
        setHasDraft(true);
      }
      setLoaded(true);
    };
    var redisFallback = function() {
      fetch("/api/state").then(function(r) { return r.json(); }).then(function(d) {
        if (settled) return;
        settled = true;
        applyData(d);
      }).catch(function() { if (!settled) { settled = true; setLoaded(true); } });
    };
    var timer = setTimeout(function() {
      if (settled) return;
      redisFallback();
    }, 800);
    fetch("/api/db?table=projects").then(function(r) { return r.json(); }).then(function(res) {
      if (settled) return;
      clearTimeout(timer);
      if (res.data && res.data.length > 0) {
        var row = res.data.find(function(r: Record<string, unknown>) { return r.type === "weekly" && r.id === "weekly-master"; });
        if (row && row.data) {
          settled = true;
          applyData({ state: row.data.state || null, log: row.data.log || [] });
          return;
        }
      }
      redisFallback();
    }).catch(function() {
      if (settled) return;
      clearTimeout(timer);
      redisFallback();
    });
    return function() { clearTimeout(timer); };
  }, []);

  var loadDraft = function() {
    var s = draftRef.current;
    if (!s) return;
    if (s.ep) setEp(s.ep as EpState);
    if (s.guests) setGuests(s.guests as Guest[]);
    if (s.opts) setOpts(s.opts as GeneratedOptions);
    if (s.sel) setSel(s.sel as SelectionState);
    if (s.fin) setFin(s.fin as FinalizedState);
    if (s.thumb) setThumb(s.thumb as string);
    if (s.launched) setLaunched(s.launched as boolean);
    if (s.descLen) setDescLen(s.descLen as string);
    if (s.socialRes) setSocialRes(s.socialRes as SocialResult);
    if (s.clips) setClips(s.clips as ClipResult[]);
    // Restore step based on how far user got
    if (s.launched) setStep(6);
    else if (s.socialRes) setStep(5);
    else if (s.fin) setStep(3);
    else if (s.opts) setStep(2);
    else if (s.ep && (s.ep as EpState).transcript) setStep(1);
    setHasDraft(false);
    draftRef.current = null;
    setInteracted(true);

    // Defensive re-pull of the activity log. The mount fetch already
    // populated logData, but if anything shuffled state during the
    // session (multi-tab, stale Redis fallback, a debounced save that
    // closed over an early empty array) past episodes can disappear
    // from the Log step. Refetching directly from the Supabase row
    // here guarantees they show up as soon as the user navigates to
    // step 6 after Load from Draft.
    fetch("/api/db?table=projects").then(function(r) { return r.json(); }).then(function(res: { data?: Array<{ type: string; id: string; data?: { log?: LogEntry[] } }> }) {
      if (!res.data || !res.data.length) return;
      var row = res.data.find(function(rr) { return rr.type === "weekly" && rr.id === "weekly-master"; });
      if (row && row.data && Array.isArray(row.data.log) && row.data.log.length > 0) {
        // Phase 2A · run migration on every refetch path so legacy rows
        // (no `versions` array, no id) get wrapped into a synthetic v1
        // before they hit React state. Otherwise the StepLog version
        // chip + presence banner silently no-op on legacy entries.
        setLogData(row.data.log.map(function(e) { return migrateLogEntry(e); }));
      }
    }).catch(function() { /* ignore — keep whatever logData we already have */ });
  };

  // "Develop Clips" entry from the Activity Log. Loads a past episode's
  // metadata into the working state, sets editingLogId so writes flow back
  // to the right log entry, and jumps straight to the Clips step.
  var openClipsForLogEntry = function(entry: LogEntry) {
    if (!entry.id) {
      // Backfill an id for legacy entries so future writes can match.
      var newId = "log-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      var withId = Object.assign({}, entry, { id: newId });
      setLogData(function(prev) { return prev.map(function(e) { return e === entry ? withId : e; }); });
      entry = withId;
    }
    setEp(Object.assign({}, ep, { number: entry.episode, transcript: ep.transcript || "" }));
    var fakeFin: FinalizedState = { title: entry.title, description: entry.description, thumbnail: "" };
    setFin(fakeFin);
    setSocialRes(entry.social);
    setClips(entry.clips || []);
    setEditingLogId(entry.id || null);
    setStep(4);
    setInteracted(true);
  };

  // Auto-save · Phase 2E split.
  // The shared `weekly-master` row holds only the published log going forward.
  // In-flight editor scratch (transcript paste, mid-flow selections, etc.)
  // writes to a per-user localStorage tier keyed by user name so Akash's
  // draft doesn't bleed into Vansh's session.
  useEffect(function() {
    if (!loaded || !interacted) return;
    var inflightState = { ep: ep, guests: guests, opts: opts, sel: sel, fin: fin, thumb: null, launched: launched, descLen: descLen, socialRes: socialRes, clips: clips, createdBy: userCtx.user ? userCtx.user.name : "Unknown", createdByRole: userCtx.user ? userCtx.user.role : "" };
    // Per-user scratch — primary location for in-flight state.
    writeUserDraft(userCtx.user ? userCtx.user.name : null, inflightState as Record<string, unknown>);
    // Shared row still receives the log (so other users see the published
    // archive). The state piece is preserved here for backward compat with
    // older sessions / browsers that haven't run the per-user migration,
    // but published log is the source of truth going forward.
    saveState(inflightState, logData);
  }, [ep, guests, opts, sel, fin, thumb, launched, descLen, socialRes, clips, logData, loaded, interacted]);

  // When clips change while editing a past log entry, mirror the change
  // back into the log entry so "View Clip Kit" / "Download Clip Kit" stay
  // accurate. Idempotent — only updates when something actually differs.
  useEffect(function() {
    if (!editingLogId) return;
    setLogData(function(prev) {
      var next = prev.map(function(e) {
        if (e.id !== editingLogId) return e;
        if (JSON.stringify(e.clips || []) === JSON.stringify(clips)) return e;
        return Object.assign({}, e, { clips: clips });
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips, editingLogId]);

  // Mark as interacted
  useEffect(function() {
    if (!loaded) return;
    if (ep.transcript || ep.link || guests.length > 0) setInteracted(true);
  }, [ep, guests, loaded]);

  var gn = guests.filter(function(g) { return g.name; }).map(function(g) { return g.name; }).join(", ");

  // Snapshot the full editor state into the optional LogEntry fields
  // so future "Edit" round-trips can rehydrate without loss. Centralized
  // so handleComplete + saveCurrentToLog stay in sync.
  var fullEditorSnapshot = function(): Pick<LogEntry, "ep" | "guestList" | "opts" | "sel" | "thumb" | "descLen"> {
    return {
      ep: ep,
      guestList: guests,
      opts: opts,
      sel: sel,
      thumb: thumb,
      descLen: descLen,
    };
  };

  var handleComplete = function(data: { title: string; description: string; social: SocialResult | null }) {
    setLaunched(true);
    // Phase 2A · append-only. If editingLogId points at a known entry,
    // append a new version under it. Otherwise mint a brand-new entry
    // with a single v1. Previously this mutated the existing entry in
    // place, which erased the archive on Edit→Save→Edit cycles.
    var savedBy = userCtx.user ? userCtx.user.name : "Unknown";
    var existing = editingLogId ? logData.find(function(e) { return e.id === editingLogId; }) : null;
    var payload: LogVersionPayload = {
      ep: ep,
      guestList: guests,
      opts: opts,
      sel: sel,
      fin: { title: data.title, description: data.description, thumbnail: (fin && typeof fin.thumbnail !== "undefined") ? fin.thumbnail : "" },
      socialRes: data.social,
      clips: clips,
      thumb: thumb,
      descLen: descLen,
    };
    if (existing) {
      var nextEntry = appendVersion(existing, payload, savedBy);
      nextEntry.status = "published";
      // editor presence stamps clear on publish.
      delete nextEntry.editorName;
      delete nextEntry.editorStartedAt;
      setLogData(function(prev) { return prev.map(function(e) { return e.id === existing!.id ? nextEntry : e; }); });
      setEditingLogId(nextEntry.id || null);
    } else {
      var newId = "log-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      var nowISO = new Date().toISOString();
      var v1: LogVersion = {
        versionId: "log-" + newId + "-v1",
        savedAt: nowISO,
        savedBy: savedBy,
        payload: payload,
      };
      var fresh: LogEntry = {
        id: newId,
        episode: ep.number,
        title: data.title,
        description: data.description,
        guests: gn,
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        social: data.social,
        clips: clips.length ? clips : undefined,
        ep: ep,
        guestList: guests,
        opts: opts,
        sel: sel,
        thumb: thumb,
        descLen: descLen,
        versions: [v1],
        currentVersion: 1,
        status: "published",
        createdBy: savedBy,
        lastEditedBy: savedBy,
        lastEditedAt: nowISO,
      };
      var projected = projectLegacyFields(fresh);
      setLogData(function(prev) { return [projected].concat(prev); });
      setEditingLogId(projected.id || null);
    }
    // Phase 2E · clear the per-user draft scratch once the work is
    // published. Without this, the next mount sees the still-populated
    // localStorage key and re-prompts a stale "Load from Draft" chip
    // pointing at content already in the log.
    clearUserDraft(userCtx.user ? userCtx.user.name : null);
    setStep(6); // go to log
  };

  // Save current draft as a log entry without going through the full
  // Export → Complete Launch Kit flow. Used by the "Save to Log" button
  // on Step 7. Mirrors handleComplete but doesn't flip `launched` and
  // bakes the chapters into the saved description deterministically.
  // Phase 2A · append-only: never mutates a prior version.
  var saveCurrentToLog = function() {
    if (!fin) { showToast("Finalize selections first (Step 3 Review)"); return; }
    var savedBy = userCtx.user ? userCtx.user.name : "Unknown";
    var existing = editingLogId ? logData.find(function(e) { return e.id === editingLogId; }) : null;
    var payload: LogVersionPayload = {
      ep: ep,
      guestList: guests,
      opts: opts,
      sel: sel,
      fin: { title: fin.title, description: composeDescription(fin.description, ep.timestamps), thumbnail: fin.thumbnail },
      socialRes: socialRes,
      clips: clips,
      thumb: thumb,
      descLen: descLen,
    };
    if (existing) {
      var nextEntry = appendVersion(existing, payload, savedBy);
      // keep current status — "Save to Log" does not publish if user
      // hasn't completed the launch kit yet.
      if (!nextEntry.status) nextEntry.status = existing.status || "draft";
      // Editor-presence stamps clear on save (same as handleComplete) so
      // subsequent edits don't trigger a stale "Akash was here 4 min
      // ago" banner against the same user.
      delete nextEntry.editorName;
      delete nextEntry.editorStartedAt;
      setLogData(function(prev) { return prev.map(function(e) { return e.id === existing!.id ? nextEntry : e; }); });
      setEditingLogId(nextEntry.id || null);
      showToast("Episode #" + ep.number + " · saved as v" + (nextEntry.versions ? nextEntry.versions.length : 1));
    } else {
      var newId = "log-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      var nowISO = new Date().toISOString();
      var v1: LogVersion = {
        versionId: "log-" + newId + "-v1",
        savedAt: nowISO,
        savedBy: savedBy,
        payload: payload,
      };
      var fresh: LogEntry = {
        id: newId,
        episode: ep.number,
        title: fin.title,
        description: composeDescription(fin.description, ep.timestamps),
        guests: gn,
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        social: socialRes,
        clips: clips.length ? clips : undefined,
        ep: ep,
        guestList: guests,
        opts: opts,
        sel: sel,
        thumb: thumb,
        descLen: descLen,
        versions: [v1],
        currentVersion: 1,
        status: "draft",
        createdBy: savedBy,
        lastEditedBy: savedBy,
        lastEditedAt: nowISO,
      };
      var projected = projectLegacyFields(fresh);
      setLogData(function(prev) { return [projected].concat(prev); });
      setEditingLogId(projected.id || null);
      showToast("Episode #" + ep.number + " saved to log");
    }
    // Phase 2E · clear the per-user draft scratch — same rationale as
    // handleComplete. The committed log entry IS the source of truth
    // from here on; the localStorage scratch would just confuse the
    // next mount.
    clearUserDraft(userCtx.user ? userCtx.user.name : null);
  };

  // Best-effort parse of a stored "Dylan Patel, Doug O'Laughlin" string
  // back into Guest[] for legacy log entries that didn't snapshot the
  // structured list. The handle is left blank — the user can fill it in
  // from the Frequent quick-pick if needed.
  var parseGuestString = function(s: string): Guest[] {
    if (!s) return [];
    return s.split(/[,;]/).map(function(part: string) {
      var name = part.trim();
      if (!name) return null;
      // Match against the canonical FREQUENT_GUESTS list so handles come
      // back automatically for the regulars.
      var match = FREQUENT_GUESTS.find(function(g) {
        return g.name.toLowerCase() === name.toLowerCase();
      });
      return match ? { name: match.name, handle: match.handle } : { name: name, handle: "" };
    }).filter(Boolean) as Guest[];
  };

  // Full edit handler — load a past log entry into the working editor
  // state and jump back into the suite. Phase 2B · pull the top version's
  // payload (versioned shape). For legacy entries the migration helper
  // wraps the flat fields into a synthetic v1 first, so the same code
  // path works for both shapes.
  var editLogEntry = async function(entry: LogEntry) {
    // Backfill an id + run migration so subsequent saves match.
    var migrated = migrateLogEntry(entry);
    if (migrated !== entry) {
      var migratedSnap = migrated; // capture for closure
      setLogData(function(prev) { return prev.map(function(e) { return e === entry || e.id === migratedSnap.id ? migratedSnap : e; }); });
    }

    // Phase 2B · presence guard. If another user touched this entry in
    // the last 5 minutes, give the current user a chance to bail.
    var FIVE_MIN = 5 * 60 * 1000;
    var currentName = userCtx.user ? userCtx.user.name : "Unknown";
    var lastEditor = migrated.lastEditedBy || (migrated.editorName);
    var msSince = msSinceLastEdit(migrated);
    if (lastEditor && lastEditor !== currentName && msSince < FIVE_MIN) {
      var stamp = migrated.lastEditedAt || migrated.editorStartedAt || "";
      var when = timeAgo(stamp);
      var proceed = await confirmDialog({
        title: "Someone else just edited this",
        body: lastEditor + " touched Ep #" + migrated.episode + " " + when + ". Pick up where they left off, or cancel to avoid stepping on their work.",
        cta: "Pick up where they left off",
        cancel: "Cancel",
      });
      if (!proceed) return;
    }

    // Hydrate from the top version when available; fall back to legacy
    // best-effort for any version-less shape that slips through.
    var top = (migrated.versions && migrated.currentVersion && migrated.versions[migrated.currentVersion - 1]) ||
              (migrated.versions && migrated.versions.length ? migrated.versions[migrated.versions.length - 1] : null);
    var payload: LogVersionPayload | null = top ? top.payload : null;
    var hydratedEp: EpState = payload && payload.ep
      ? payload.ep
      : (migrated.ep ? migrated.ep : { number: migrated.episode, link: "", transcript: "", timestamps: "", extra: "" });
    var hydratedGuests: Guest[] = payload && payload.guestList && payload.guestList.length > 0
      ? payload.guestList
      : (migrated.guestList && migrated.guestList.length > 0 ? migrated.guestList : parseGuestString(migrated.guests));
    var hydratedFin: FinalizedState = payload && payload.fin
      ? payload.fin
      : { title: migrated.title, description: migrated.description, thumbnail: "" };
    setEp(hydratedEp);
    setGuests(hydratedGuests);
    setOpts(payload ? payload.opts : (migrated.opts || null));
    setSel(payload ? payload.sel : (migrated.sel || { title: 0, desc: 0, thumb: 0 }));
    setFin(hydratedFin);
    setThumb(payload ? payload.thumb : (migrated.thumb || null));
    setSocialRes(payload ? payload.socialRes : migrated.social);
    setClips(payload ? payload.clips : (migrated.clips || []));
    if (payload && payload.descLen) setDescLen(payload.descLen);
    else if (migrated.descLen) setDescLen(migrated.descLen);
    setEditingLogId(migrated.id || null);
    setLaunched(false); // re-enter edit mode; flip back on Complete

    // Phase 2B · stamp editor presence onto the entry so other users see
    // the banner. Both as local React state and persisted on the entry.
    var nowISO = new Date().toISOString();
    setEditorName(currentName);
    setEditorStartedAt(nowISO);
    var targetId = migrated.id;
    setLogData(function(prev) {
      return prev.map(function(e) {
        if (e.id !== targetId) return e;
        return Object.assign({}, e, { editorName: currentName, editorStartedAt: nowISO });
      });
    });

    setStep(0);         // start at Setup so user can review/edit from the top
    setInteracted(true);
    showToast("Editing Ep #" + migrated.episode + " · changes save back to this entry");
  };

  // Phase 2C · "Revert to this version" copies a historical payload into
  // a brand-new top version (non-destructive). The current top version
  // stays intact in the timeline.
  var revertToVersion = function(entryId: string, versionIdx: number) {
    setLogData(function(prev) {
      return prev.map(function(e) {
        if (e.id !== entryId) return e;
        var migrated = migrateLogEntry(e);
        if (!migrated.versions || !migrated.versions[versionIdx]) return migrated;
        var source = migrated.versions[versionIdx];
        var savedBy = userCtx.user ? userCtx.user.name : "Unknown";
        // Deep clone the historical payload so the new top version
        // doesn't share a reference with the source. Today nothing
        // mutates payloads, but any future in-place edit on the new
        // version would silently corrupt history without this guard.
        var clonedPayload = JSON.parse(JSON.stringify(source.payload)) as LogVersionPayload;
        return appendVersion(migrated, clonedPayload, savedBy, "Reverted to v" + (versionIdx + 1));
      });
    });
    showToast("Reverted to v" + (versionIdx + 1) + " · saved as a new top version");
  };

  // Look up an entry by id for the timeline modal.
  var timelineEntry: LogEntry | null = timelineEntryId ? (logData.find(function(e) { return e.id === timelineEntryId; }) || null) : null;

  // Step navigation logic
  var canNavigate = function(targetStep: number): boolean {
    if (targetStep === 0) return true; // always can go to setup
    if (targetStep === 1) return !!ep.transcript; // need transcript for generate
    if (targetStep === 2) return !!opts; // need generated options for review
    if (targetStep === 3) return !!fin; // need finalized selections for social
    if (targetStep === 4) return !!fin; // clips available after finalize
    if (targetStep === 5) return !!fin; // export available after finalize
    if (targetStep === 6) return true; // log always available
    return false;
  };

  // Phase 2D · presence banner data. Show when actively editing a known
  // entry AND another user touched it inside the 5-minute window.
  var FIVE_MIN_MS = 5 * 60 * 1000;
  var presenceEntry: LogEntry | null = editingLogId ? (logData.find(function(e) { return e.id === editingLogId; }) || null) : null;
  var currentUserName = userCtx.user ? userCtx.user.name : "Unknown";
  var presenceLastBy = presenceEntry ? (presenceEntry.lastEditedBy || presenceEntry.editorName || "") : "";
  var presenceLastAt = presenceEntry ? (presenceEntry.lastEditedAt || presenceEntry.editorStartedAt || null) : null;
  var presenceMs = presenceEntry ? msSinceLastEdit(presenceEntry) : Infinity;
  var showPresenceBanner = !!presenceEntry && !!presenceLastBy && presenceLastBy !== currentUserName && presenceMs < FIVE_MIN_MS;

  return (<div>
    <style dangerouslySetInnerHTML={{ __html: "@keyframes progressSlide{0%{left:-40%}100%{left:100%}}.progress-slide{animation:progressSlide 1.5s ease-in-out infinite}@keyframes dotPulse{0%,80%,100%{opacity:0.2}40%{opacity:1}}.progress-dots::after{content:'...';display:inline-block;animation:dotPulse 1.4s ease-in-out infinite}@keyframes confetti-fall{0%{transform:translateY(-20px) translateX(0) rotate(0deg);opacity:1}70%{opacity:1}100%{transform:translateY(calc(80vh)) translateX(var(--drift)) rotate(var(--rot));opacity:0}}" }} />

    {/* Header */}
    <div style={{ padding: "24px 0", borderBottom: "1px solid " + D.border, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", background: D.bg + "E0" }}>
      <div>
        <div style={{ fontFamily: ft, fontSize: 42, fontWeight: 900, color: D.tx, letterSpacing: -2 }}>SemiAnalysis Weekly</div>
        <div style={{ fontFamily: mn, fontSize: 11, color: D.txb, marginTop: 4, letterSpacing: "2px", textTransform: "uppercase" }}>{"Ep #" + ep.number + (gn ? " . " + gn : "") + (launched ? " . Launched" : fin ? " . Saved" : "")}</div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <ProviderChips surface="sa-weekly" compact />
        {hasDraft && <span onClick={loadDraft} title={logData.length > 0 ? logData.length + " past episode" + (logData.length === 1 ? "" : "s") + " also visible in the Log step" : undefined} style={{ fontFamily: mn, fontSize: 9, color: ACC, cursor: "pointer", padding: "6px 12px", border: "1px solid " + ACC + "40", borderRadius: 8, background: ACC + "08", transition: "all 0.2s ease" }}>Load from Draft{logData.length > 0 ? " · " + logData.length + " past ep" + (logData.length === 1 ? "" : "s") : ""}</span>}
        <a href="https://youtube.com/@SemianalysisWeekly" target="_blank" rel="noopener noreferrer" style={{ fontFamily: mn, fontSize: 9, color: D.txl, textDecoration: "none", padding: "6px 12px", border: "1px solid " + D.border, borderRadius: 8, transition: "all 0.2s ease" }}>@SemianalysisWeekly</a>
      </div>
    </div>

    {/* Step Tracker */}
    <div style={{ marginTop: 28 }}>
      <StepTracker current={step} steps={STEPS} canNavigate={canNavigate} onNav={function(i) { if (canNavigate(i) || i < step) setStep(i); }} />
    </div>

    {/* Phase 2D · presence banner. Renders only when another user touched
        this entry within the last 5 minutes — gives the current editor a
        nudge that they might be stepping on someone's work. */}
    {showPresenceBanner && presenceEntry && (
      <div style={{ margin: "0 0 18px", padding: "8px 14px", background: D.amber + "12", border: "1px solid " + D.amber + "55", borderRadius: 8, display: "flex", alignItems: "center", gap: 10, fontFamily: mn, fontSize: 11, color: D.amber, letterSpacing: 0.5 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: D.amber, flexShrink: 0 }} />
        <span style={{ flex: 1 }}>{presenceLastBy} edited this {timeAgo(presenceLastAt)} · Ep #{presenceEntry.episode}</span>
        <span onClick={function() { setTimelineEntryId(presenceEntry!.id || null); }} style={{ cursor: "pointer", color: D.amber, textDecoration: "underline", textUnderlineOffset: 3 }}>View history</span>
      </div>
    )}

    {/* Step Content */}
    <div style={{ paddingBottom: 60 }}>
      {step === 0 && <StepSetup ep={ep} setEp={setEp} guests={guests} setGuests={setGuests} />}
      {step === 1 && <StepGenerate ep={ep} guests={guests} opts={opts} setOpts={setOpts} sel={sel} setSel={setSel} fin={fin} setFin={setFin} descLen={descLen} setDescLen={setDescLen} onDone={function() {}} />}
      {step === 2 && <StepReview ep={ep} guests={guests} opts={opts} sel={sel} fin={fin} setFin={setFin} thumb={thumb} setThumb={setThumb} onDone={function() { setStep(3); }} />}
      {step === 3 && <StepSocial ep={ep} guests={guests} fin={fin} socialRes={socialRes} setSocialRes={setSocialRes} />}
      {step === 4 && <StepClips ep={ep} guests={guests} fin={fin} clips={clips} setClips={setClips} editingLogId={editingLogId} onSavedToLog={function() { setStep(6); }} />}
      {step === 5 && <StepExport ep={ep} guests={guests} fin={fin} socialRes={socialRes} clips={clips} onComplete={handleComplete} />}
      {step === 6 && <StepLog
        logData={logData}
        setLogData={setLogData}
        onDevelopClips={openClipsForLogEntry}
        onEditEntry={editLogEntry}
        onOpenTimeline={function(id: string) { setTimelineEntryId(id); }}
        current={{ ep: ep, guests: guests, fin: fin, socialRes: socialRes, clips: clips, editingLogId: editingLogId }}
        onSaveCurrent={saveCurrentToLog}
      />}
    </div>

    {/* Phase 2C · version timeline modal */}
    {timelineEntry && (
      <VersionTimelineModal
        entry={timelineEntry}
        currentUserName={currentUserName}
        onClose={function() { setTimelineEntryId(null); }}
        onRevert={function(versionIdx: number) {
          if (!timelineEntry || !timelineEntry.id) return;
          revertToVersion(timelineEntry.id, versionIdx);
        }}
      />
    )}

    {/* Step navigation buttons */}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 40 }}>
      {step > 0 ? <button onClick={function() { setStep(step - 1); }} style={{ padding: "14px 24px", background: "transparent", border: "1px solid " + D.border, color: D.txl, borderRadius: 10, fontFamily: ft, fontSize: 14, cursor: "pointer", transition: "all 0.2s" }}>Back</button> : <div />}
      {step < 6 ? <button onClick={function() { if (canNavigate(step + 1)) setStep(step + 1); }} disabled={!canNavigate(step + 1)} style={{ padding: "14px 32px", background: canNavigate(step + 1) ? "linear-gradient(135deg, " + ACC + ", #C84E35)" : D.surface, color: canNavigate(step + 1) ? D.tx : D.txl, border: "none", borderRadius: 10, fontFamily: ft, fontSize: 14, fontWeight: 800, cursor: canNavigate(step + 1) ? "pointer" : "not-allowed", opacity: canNavigate(step + 1) ? 1 : 0.35, boxShadow: canNavigate(step + 1) ? "0 4px 20px rgba(224,99,71,0.3)" : "none", transition: "all 0.2s" }}>Next Step</button> : <div />}
    </div>
  </div>);
}
