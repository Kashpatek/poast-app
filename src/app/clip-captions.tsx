"use client";

// Extracted from poast-client.tsx to support both the in-shell mount
// (sec === "captions") AND CopySTUDIO's /copy-studio/captions module
// without duplicating the 430-line component or bundling all of
// poast-client into the CopySTUDIO route. CAPPER_SOURCES + CapperSource
// stay exported here for brainstorm.tsx + saved-prompts seed compat.

import React, { useEffect, useRef, useState } from "react";
import { Captions, Send, Type as TypeIcon } from "lucide-react";
import { useUser, isAnalyst } from "./user-context";
import { showToast } from "./toast-context";
import { D as C, PL, ft, gf, mn, copyText } from "./shared-constants";
import { SendToChip } from "./components/send-to-chip";
import { SaveToLibrary } from "./components/save-to-library";
import { useShortcuts } from "./keyboard-shortcuts";

// Buffer channel shape — mirrors the type from poast-client.tsx. Kept
// minimal since ClipCaptions only consumes the id/service fields.
interface BufferChannel {
  id: string;
  service?: string;
  name?: string;
  username?: string;
}

// ─── Capper interfaces ─────────────────────────────────────────────
interface CapperResult {
  caption?: string;
  reply?: string;
  title?: string;
  posts?: Array<{ number: number; text: string }>;
}

interface CapperPlatform { key: string; label: string; color: string; icon: string; }
interface CapperTone { key: string; label: string; desc: string; hook: string; }
interface CapperLength { key: string; label: string; desc: string; thread: boolean; }

export interface CapperSource {
  key: string;
  label: string;
  desc: string;
  voicePrompt: string;
  color: string;
  example: string;
}

type CapperProvider = "claude" | "gemini" | "grok";
interface CapperProviderOption { key: CapperProvider; label: string; sub: string; color: string; }
interface CapperAudience { key: string; label: string; desc: string; color: string; }

interface APIContentBlock { text?: string; }
interface APIResponse { error?: { message?: string } | string; content?: APIContentBlock[]; }

var CAPPER_TONES: CapperTone[] = [
  { key: "sa_research", label: "SA Research", desc: "Measured, numbers-first. Leads with data and a precise claim. Cites sources when useful. Neutral register.", hook: "" },
  { key: "dylan", label: "Dylan", desc: "Direct, data-heavy, confident, uses specific numbers and claims.", hook: "Here's what nobody is telling you about..." },
  { key: "doug", label: "Doug", desc: "Technical, first-principles, analytical. Focuses on why something matters structurally.", hook: "" },
  { key: "sa_twitter", label: "SA Twitter", desc: "Punchy, provocative, hot-take style. Short sentences. Bold claims backed by data.", hook: "" },
  { key: "oren", label: "Oren", desc: "Conversational, storytelling, bridges tech to business impact. Accessible but informed.", hook: "" },
];

var CAPPER_PLATFORMS: CapperPlatform[] = [
  { key: "x", label: "X", color: PL.x, icon: "X" },
  { key: "instagram", label: "Instagram", color: PL.ig, icon: "IG" },
  { key: "linkedin", label: "LinkedIn", color: PL.li, icon: "in" },
  { key: "tiktok", label: "TikTok", color: PL.tt, icon: "TT" },
  { key: "youtube", label: "YouTube", color: PL.yt, icon: "YT" },
];

var CAPPER_LENGTHS: CapperLength[] = [
  { key: "short", label: "Short", desc: "1-2 sentences", thread: false },
  { key: "medium", label: "Medium", desc: "3-4 sentences", thread: false },
  { key: "long", label: "Long", desc: "Paragraph", thread: false },
  { key: "thread", label: "Thread", desc: "3-5 posts", thread: true },
  { key: "epic", label: "Epic Thread", desc: "6-10 posts", thread: true },
];

// Source type — where the clip came from. Drives the framing (first-
// person vs commentary, attribution, hook patterns). Pick the one
// that matches reality; the system prompt adjusts the voice to suit.
export var CAPPER_SOURCES: CapperSource[] = [
  { key: "sa_podcast",  label: "SA Weekly",       desc: "Clip from SemiAnalysis Weekly — Dylan & guests",
    color: "#F7B041",
    example: "Dylan and Jordan got into why HBM4 supply is the actual bottleneck.",
    voicePrompt: "SOURCE: A clip from SemiAnalysis Weekly, OUR podcast. Use first-person 'we' or name guests directly (e.g. \"Dylan and Jordan got into\"). The hook should grab the most provocative thing said. Don't add insights that weren't on the show — sharpen what was actually said. Reference the conversation directly. OK to mention 'on Weekly' for context." },
  { key: "sa_article",  label: "SA Article / Research", desc: "Clip-style caption from a SA written piece",
    color: "#0B86D1",
    example: "We modeled the GB300 NVL72 TCO at 30% MFU. It's not what NVIDIA's slide says.",
    voicePrompt: "SOURCE: A SemiAnalysis written research piece (article, deep dive, model). Use confident first-person 'we' framing ('we modeled', 'our data shows', 'we dug into'). Drive readers toward the full article — caption should tease the punchline without giving it all away. Cite methodology when it sharpens the point. Authoritative register." },
  { key: "sa_video",    label: "SA Own Video",    desc: "Internal video — Datacloud, Cannes, panels",
    color: "#2EAD8E",
    example: "At Datacloud we walked through the Trainium roadmap. Slide 14 is the one to watch.",
    voicePrompt: "SOURCE: An internal SemiAnalysis video (Datacloud, Cannes panel, internal event — NOT the podcast). Hybrid voice: insider first-person but more polished than podcast banter. Include event/venue context ('at Datacloud', 'on the Cannes panel'). Less casual than Weekly, more analytical." },
  { key: "external_podcast", label: "External Podcast", desc: "Bg2, Acquired, Dwarkesh — 3rd-party show",
    color: "#905CCB",
    example: "He told Acquired the launch slipped to Q4. Here's what he's missing.",
    voicePrompt: "SOURCE: A 3rd-party podcast clip (Bg2, Acquired, Dwarkesh, BG2, etc.). Use third-person attribution ('X told [host] on [show]'). Frame the caption as COMMENTARY on someone else's analysis — SA adds the angle. The hook can be a hot take ON the take ('Here's why he's missing the bigger story...' / 'This is the part nobody's caught...'). Never claim their insights as ours. Credit the show + guest." },
  { key: "external_video", label: "External Video", desc: "NVIDIA keynote, AMD analyst day, GTC",
    color: "#E06347",
    example: "Jensen said Rubin Ultra ships in 2027. What that actually means for the supply chain:",
    voicePrompt: "SOURCE: A 3rd-party video clip (NVIDIA keynote, AMD analyst day, vendor event). Event/news framing ('Jensen said at GTC', '[Co] confirmed at analyst day'). Time-sensitive — feels like reporting. Often pair the quote with a SA take ('What this actually means:'). Cite company + event clearly." },
  { key: "conference_talk", label: "Conference Talk", desc: "GTC, Hot Chips, ISSCC, Computex",
    color: "#26C9D8",
    example: "At Hot Chips, AMD finally showed the chiplet die yield numbers. They're better than expected.",
    voicePrompt: "SOURCE: A conference-talk clip (GTC, Hot Chips, ISSCC, Computex, MICRO). Strong on venue + speaker provenance ('At Hot Chips, [Co] showed...'). Often technical — assume the audience knows the conference. Quote-heavy framing. SA voice adds analyst context ('This is a big deal because...')." },
  { key: "interview",   label: "Long-form Interview", desc: "Cut from a longer interview, external or own",
    color: "#7ACFBA",
    example: "Asked about TSMC capacity in '27, he said quietly: 'We won't have enough.'",
    voicePrompt: "SOURCE: A cut from a longer interview (NOT the podcast feed). Quote-heavy framing — lift a notable line. Third-person attribution ('[X] told [Y] in an interview'). Caption should make the quote stand alone — context-set in one sentence, then the line lands." },
];

// LLM provider picker. Each provider produces a different natural voice
// on top of the explicit Tone choice; user can swap mid-batch if a
// generation feels off-brand.
var CAPPER_PROVIDERS: CapperProviderOption[] = [
  { key: "claude", label: "Claude",  sub: "Sharpest · brand-safe",         color: "#F7B041" },
  { key: "gemini", label: "Gemini",  sub: "Direct · less hedge",           color: "#4285F4" },
  { key: "grok",   label: "Grok",    sub: "Edgier · memorable",            color: "#905CCB" },
];

var CAPPER_AUDIENCES: CapperAudience[] = [
  { key: "meme", label: "Meme-coded", desc: "Internet brain, irony-pilled, chronically online. Think tech twitter memes.", color: "#00FF88" },
  { key: "genz", label: "Gen Z", desc: "Lowercase, no punctuation, absurdist humor, unhinged but smart.", color: "#FF6BFF" },
  { key: "techtwitter", label: "Tech Twitter", desc: "Smart, opinionated, ratio-ready. Mix of insight and shade.", color: "#1DA1F2" },
  { key: "degen", label: "Degen", desc: "Crypto/finance energy. WAGMI, aping in, LFG. Numbers go up.", color: "#FFD700" },
  { key: "corporate", label: "Corporate", desc: "LinkedIn-safe. Thought leadership. Buzzwords. I'm pleased to announce.", color: "#0A66C2" },
  { key: "boomer", label: "Boomer", desc: "Straightforward, no slang, earnest. Your dad explaining semiconductors.", color: "#888888" },
  { key: "unhinged", label: "Unhinged", desc: "Fully deranged takes. Chaos energy. Will get screenshots.", color: "#FF0040" },
];

var SYS_CAPPER = "You are a social media caption writer for SemiAnalysis. You write captions for short-form video clips and memes.\n\nTone descriptions:\n- SA Research: Measured, numbers-first, research-grade tone. Lead with a specific figure or a precise claim. Neutral register — no hype, no hedging. Cite sources when they sharpen the point. Think institutional analyst writing for a sharp retail audience.\n- Dylan: Direct, data-heavy, confident. Uses specific numbers and bold claims. Opens with hooks like 'Here is what nobody is telling you about...' Never hedges.\n- Doug: Technical, first-principles, analytical. Focuses on structural importance and why something matters at a fundamental level. Methodical.\n- SA Twitter: Punchy, provocative, hot-take energy. Short sentences. Bold claims. Data-backed but aggressive framing.\n- Oren: Conversational, storytelling approach. Bridges technical topics to business impact. Accessible but clearly informed.\n\nAudience/vibe descriptions:\n- Meme-coded: Internet brain, irony-pilled, chronically online. Reference meme formats, use internet humor, be self-aware. Think 'this is the way' energy.\n- Gen Z: All lowercase, minimal punctuation, absurdist humor, unhinged but smart. Deadpan delivery. 'no because why is this actually true'\n- Tech Twitter: Smart and opinionated, mix of genuine insight and shade. Ratio-ready. CT/tech twitter native.\n- Degen: Crypto/finance energy. WAGMI, aping in, LFG. Numbers go up. Semi-ironic hype.\n- Corporate: LinkedIn-safe thought leadership. Buzzwords welcome. I'm pleased to announce.\n- Boomer: Straightforward, no slang, earnest and sincere.\n- Unhinged: Fully deranged takes. Chaos energy. Will definitely get screenshotted.\n\nPlatform rules (HARD — absolute):\n- X/Twitter: NEVER hashtags. Not one. Ever. Write as hook tweet + reply-to-self format. No links in the main post. Keep punchy.\n- TikTok: All lowercase caption only. NEVER hashtags. NEVER overlay text / on-screen text. Just the caption.\n- Instagram: Include a 'Save this for later' CTA. Add 5-8 relevant hashtags. Add location 'San Francisco, CA'. Direct to bio link.\n- LinkedIn: Professional framing. End with 'Link in comments.' No hashtags. Longer form is fine.\n- YouTube: Include a separate title line (under 40 characters). Then the description. Include relevant keywords.\n\nRules: Never use em dashes, use commas or periods. Be direct. Match the audience vibe exactly. RESPOND ONLY IN VALID JSON. No markdown fences. No preamble.";

// ─── ask() — POST to /api/generate, return parsed JSON or null ─────
async function ask(sys: string, prompt: string, provider?: CapperProvider): Promise<CapperResult | null> {
  try {
    var body: Record<string, unknown> = { system: sys, prompt: prompt };
    if (provider && provider !== "claude") body.provider = provider;
    var r = await fetch("/api/generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    var d = (await r.json()) as APIResponse;
    if (d.error) {
      var prov = provider || "claude";
      var hint = prov === "gemini" ? " (check GEMINI_API_KEY)" : prov === "grok" ? " (check XAI_API_KEY)" : " (check ANTHROPIC_API_KEY)";
      showToast("API Error: " + (typeof d.error === "object" && d.error !== null ? (d.error as { message?: string }).message || d.error : d.error) + hint);
      return null;
    }
    if (!d.content) {
      var prov2 = provider || "claude";
      var key2 = prov2 === "gemini" ? "GEMINI_API_KEY" : prov2 === "grok" ? "XAI_API_KEY" : "ANTHROPIC_API_KEY";
      showToast("API returned empty response. Check your " + key2 + " in Vercel env vars.");
      return null;
    }
    var t = (d.content || []).map(function(c: APIContentBlock) { return c.text || ""; }).join("");
    try {
      return JSON.parse(t.replace(/```json|```/g, "").trim());
    } catch (pe) { showToast("Failed to parse API response. The model returned invalid JSON."); console.error("Parse error:", t); return null; }
  } catch (e) { showToast("Network error: Could not reach /api/generate"); console.error("API:", e); return null; }
}


// ─── ProgressBar — local copy of the poast-client helper ───────────
function ProgressBar({ label }: { label?: string }) {
  return <div style={{ margin: "22px 0" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <div style={{ fontFamily: mn, fontSize: 11, color: C.amber, letterSpacing: "2px", textTransform: "uppercase" }}>{label || "Generating..."}</div>
      <div className="progress-dots" style={{ fontFamily: mn, fontSize: 10, color: "rgba(255,255,255,0.4)" }} />
    </div>
    <div style={{ width: "100%", height: 2, background: "rgba(255,255,255,0.06)", borderRadius: 1, overflow: "hidden", position: "relative" }}>
      <div className="progress-slide" style={{ position: "absolute", top: 0, left: 0, height: "100%", width: "40%", borderRadius: 1, background: "linear-gradient(90deg, transparent, " + C.amber + ", transparent)" }} />
    </div>
  </div>;
}

// ─── Small helpers inlined from poast-client.tsx ──────────────────
function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: mn, fontSize: 11, color: C.amber, textTransform: "uppercase", letterSpacing: "2px", marginBottom: 8 }}>{children}</div>;
}

function Btn({ children, onClick, loading, sec, sm, off }: { children: React.ReactNode; onClick?: () => void; loading?: boolean; sec?: boolean; sm?: boolean; off?: boolean }) {
  return (<button onClick={onClick} disabled={loading || off} style={{ padding: sm ? "8px 16px" : "12px 28px", background: off ? "#09090D" : sec ? "transparent" : "linear-gradient(135deg, " + C.amber + ", #E8A020)", color: off ? "rgba(255,255,255,0.4)" : sec ? C.amber : "#060608", border: sec ? "1px solid " + (off ? "rgba(255,255,255,0.06)" : C.amber) : "none", borderRadius: 10, fontFamily: ft, fontSize: sm ? 12 : 14, fontWeight: 800, cursor: loading || off ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1, letterSpacing: -0.3, transition: "all 0.2s ease" }}>{loading ? "Working..." : children}</button>);
}

function CopyBtn({ text }: { text: string }) {
  var _s = useState<boolean>(false), ok = _s[0], set = _s[1];
  return <span onClick={function(e: React.MouseEvent<HTMLElement>) { e.stopPropagation(); set(copyText(text)); setTimeout(function() { set(false); }, 1200); }} style={{ fontFamily: mn, fontSize: 9, color: ok ? C.amber : "rgba(255,255,255,0.4)", cursor: "pointer", padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)", userSelect: "none", transition: "all 0.2s ease" }}>{ok ? "Copied" : "Copy"}</span>;
}

// ─── Default export · ClipCaptions ─────────────────────────────────
export default function ClipCaptions() {
  var userCtx = useUser();
  var analyst = isAnalyst(userCtx.user);
  // Analysts get a tighter vibe set — no Degen, no Unhinged (per launch scope).
  var VISIBLE_AUDIENCES = analyst
    ? CAPPER_AUDIENCES.filter(function(a) { return a.key !== "degen" && a.key !== "unhinged"; })
    : CAPPER_AUDIENCES;
  var _content = useState(""), content = _content[0], setContent = _content[1];
  var _platforms = useState(["x"]), platforms = _platforms[0], setPlatforms = _platforms[1];
  var _length = useState("medium"), length = _length[0], setLength = _length[1];
  var _tone = useState("sa_research"), tone = _tone[0], setTone = _tone[1];
  var _audience = useState("techtwitter"), audience = _audience[0], setAudience = _audience[1];
  // Where the clip came from. Defaults to SA Weekly (the most common
  // source) — drives first-person vs commentary framing in the prompt.
  var _source = useState("sa_podcast"), sourceType = _source[0], setSourceType = _source[1];
  // LLM provider. Claude is the default (sharpest + brand-safe); Gemini
  // and Grok produce different natural voices on top of the explicit
  // Tone picker.
  var _provider = useState<CapperProvider>("claude"), provider = _provider[0], setProvider = _provider[1];
  // If an analyst somehow has a restricted audience selected (e.g. from a
  // stale state), snap it back to the default.
  useEffect(function() {
    if (analyst && (audience === "degen" || audience === "unhinged")) setAudience("techtwitter");
  }, [analyst, audience]);
  var _customPrompt = useState(""), customPrompt = _customPrompt[0], setCustomPrompt = _customPrompt[1];
  var _link = useState(false), showLink = _link[0], setShowLink = _link[1];
  var _url = useState(""), url = _url[0], setUrl = _url[1];
  var _loading = useState(false), loading = _loading[0], setLoading = _loading[1];
  var _results = useState<Record<string, CapperResult[]> | null>(null), results = _results[0], setResults = _results[1];
  var _regenL = useState<Record<string, boolean>>({}), regenL = _regenL[0], setRegenL = _regenL[1];
  var _bufferSending = useState<Record<string, boolean>>({}), bufferSending = _bufferSending[0], setBufferSending = _bufferSending[1];

  var PLAT_TO_SERVICE: Record<string, string> = { x: "twitter", instagram: "instagram", linkedin: "linkedin", tiktok: "tiktok", youtube: "youtube", facebook: "facebook" };

  var sendToBuffer = async function(platKey: string, text: string): Promise<boolean> {
    setBufferSending(function(p) { var o = Object.assign({}, p); o[platKey] = true; return o; });
    try {
      var chRes = await fetch("/api/buffer?type=channels");
      var chData = (await chRes.json()) as { channels?: BufferChannel[]; error?: string };
      if (!chData.channels || chData.channels.length === 0) { showToast("No Buffer channels found. Connect channels in Buffer first."); setBufferSending(function(p) { var o = Object.assign({}, p); o[platKey] = false; return o; }); return false; }
      var service = PLAT_TO_SERVICE[platKey] || platKey;
      var channel = chData.channels.find(function(ch: BufferChannel) { return ch.service === service; });
      if (!channel) { showToast("No Buffer channel found for " + service + ". Connect it in Buffer."); setBufferSending(function(p) { var o = Object.assign({}, p); o[platKey] = false; return o; }); return false; }
      var postRes = await fetch("/api/buffer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "createPost", input: { channelId: channel.id, text: text, schedulingType: "draft" } }) });
      var postData = (await postRes.json()) as { error?: { message?: string } | string };
      if (postData.error) { showToast("Buffer error: " + (typeof postData.error === "object" && postData.error !== null ? (postData.error as { message?: string }).message || postData.error : postData.error)); setBufferSending(function(p) { var o = Object.assign({}, p); o[platKey] = false; return o; }); return false; }
      setBufferSending(function(p) { var o = Object.assign({}, p); o[platKey] = false; return o; });
      return true;
    } catch (e) { showToast("Failed to send to Buffer: " + (e instanceof Error ? e.message : String(e))); setBufferSending(function(p) { var o = Object.assign({}, p); o[platKey] = false; return o; }); return false; }
  };

  var sendAllToBuffer = async function() {
    if (!results) return;
    setBufferSending(function(p) { var o = Object.assign({}, p); o["_all"] = true; return o; });
    var sent = 0; var failed = 0;
    for (var pi = 0; pi < platforms.length; pi++) {
      var platKey = platforms[pi];
      var platResults = results[platKey] || [];
      if (platResults.length === 0) continue;
      var r = platResults[0];
      var text = isThread ? (r.posts || []).map(function(p: { number: number; text: string }) { return p.text; }).join("\n\n") : (r.caption || "");
      if (!text) continue;
      var ok = await sendToBuffer(platKey, text);
      if (ok) sent++; else failed++;
    }
    setBufferSending(function(p) { var o = Object.assign({}, p); o["_all"] = false; return o; });
    if (sent > 0 && failed === 0) showToast("Sent " + sent + " draft" + (sent > 1 ? "s" : "") + " to Buffer.");
    else if (sent > 0) showToast("Sent " + sent + " draft" + (sent > 1 ? "s" : "") + " to Buffer. " + failed + " failed.");
  };

  var toneObj = CAPPER_TONES.find(function(t) { return t.key === tone; }) || CAPPER_TONES[0];
  var lenObj = CAPPER_LENGTHS.find(function(l) { return l.key === length; }) || CAPPER_LENGTHS[1];
  var isThread = lenObj.thread;

  var togglePlatform = function(key: string) {
    setPlatforms(function(prev) {
      if (prev.indexOf(key) > -1) {
        var next = prev.filter(function(k) { return k !== key; });
        return next.length > 0 ? next : prev;
      }
      return prev.concat([key]);
    });
  };

  var buildCapperPrompt = function(platKey: string, variationNote?: string): string {
    var platObj = CAPPER_PLATFORMS.find(function(p) { return p.key === platKey; }) || CAPPER_PLATFORMS[0];
    var srcObj = CAPPER_SOURCES.find(function(s) { return s.key === sourceType; }) || CAPPER_SOURCES[0];
    var parts = [];
    // Source framing comes FIRST so the model anchors the voice before
    // anything else lands. Treats podcast / commentary / event clips
    // as fundamentally different speaking positions.
    parts.push(srcObj.voicePrompt);
    if (isThread) {
      var postCount = length === "epic" ? "6-10" : "3-5";
      parts.push("Generate a " + platObj.label + " thread/multi-post series (" + postCount + " connected posts) for this clip.");
      parts.push("Each post should be numbered (Post 1/" + postCount.split("-")[1] + ", Post 2/" + postCount.split("-")[1] + ", etc.) and form a coherent narrative.");
      parts.push("The first post should hook the reader. Middle posts deliver value. Last post has a strong closer or CTA.");
    } else {
      parts.push("Generate a " + platObj.label + " caption for this clip.");
      parts.push("Length: " + lenObj.label + " (" + lenObj.desc + ")");
    }
    var audObj = CAPPER_AUDIENCES.find(function(a) { return a.key === audience; }) || CAPPER_AUDIENCES[0];
    parts.push("Tone: " + toneObj.label + " - " + toneObj.desc);
    parts.push("Audience/Vibe: " + audObj.label + " - " + audObj.desc + ". MATCH THIS VIBE EXACTLY.");
    parts.push("Platform: " + platObj.label);
    parts.push("Clip content:\n" + content.slice(0, 6000));
    if (showLink && url) parts.push("Include this redirect link naturally: " + url);
    if (customPrompt.trim()) parts.push("Additional instructions from user: " + customPrompt.trim());
    if (variationNote) parts.push(variationNote);
    if (isThread) {
      parts.push('Return JSON: {"posts":[{"number":1,"text":"post text"},{"number":2,"text":"post text"},...]}');
    } else {
      parts.push('Return JSON: {"caption":"the caption text"' + (platKey === "youtube" ? ',"title":"short title under 40 chars"' : '') + (platKey === "x" ? ',"reply":"reply tweet with link or additional context"' : '') + '}');
    }
    return parts.filter(Boolean).join("\n\n");
  };

  var generate = async function() {
    if (!content || platforms.length === 0) return;
    setLoading(true);
    setResults(null);
    var allPromises: Promise<CapperResult | null>[] = [];
    var promiseMap: Array<{ platform: string; variation: number }> = [];
    platforms.forEach(function(platKey: string) {
      var variations = [
        "This is variation 1 of 3. Be direct and sharp.",
        "This is variation 2 of 3. Try a different angle or hook.",
        "This is variation 3 of 3. Take the most creative or unexpected approach.",
      ];
      variations.forEach(function(v, vi) {
        allPromises.push(ask(SYS_CAPPER, buildCapperPrompt(platKey, v), provider));
        promiseMap.push({ platform: platKey, variation: vi });
      });
    });
    var allResults = await Promise.all(allPromises);
    var grouped: Record<string, CapperResult[]> = {};
    allResults.forEach(function(d: CapperResult | null, i: number) {
      var info = promiseMap[i];
      if (!grouped[info.platform]) grouped[info.platform] = [];
      grouped[info.platform].push(d || (isThread ? { posts: [{ number: 1, text: "Generation failed for variation " + (info.variation + 1) }] } : { caption: "Generation failed for variation " + (info.variation + 1) }));
    });
    setResults(grouped);
    setLoading(false);
  };

  var generateRef = useRef<(() => void) | undefined>(undefined);
  generateRef.current = function() { generate(); };
  useShortcuts({
    "$mod+g": { description: "Generate captions", handler: function() { generateRef.current?.(); } },
  }, { scope: "Capper" });

  var regenerateOne = async function(platKey: string, idx: number) {
    var regenKey = platKey + "_" + idx;
    setRegenL(function(p) { var o = Object.assign({}, p); o[regenKey] = true; return o; });
    var cur = results && results[platKey] && results[platKey][idx];
    var curText = isThread ? (cur && cur.posts ? cur.posts.map(function(p: { number: number; text: string }) { return p.text; }).join(" ") : "") : (cur && cur.caption || "");
    var data = await ask(SYS_CAPPER, buildCapperPrompt(platKey, "Regenerate this caption. Be DIFFERENT from: " + curText), provider);
    if (data) {
      var captured = data;
      setResults(function(p) {
        var o = Object.assign({}, p);
        var arr = (o[platKey] || []).slice();
        arr[idx] = captured;
        o[platKey] = arr;
        return o;
      });
    }
    setRegenL(function(p) { var o = Object.assign({}, p); o[regenKey] = false; return o; });
  };

  var charCount = function(text: string) {
    if (!text) return 0;
    return text.length;
  };

  var cardBg = "#09090D";
  var borderC = "rgba(255,255,255,0.06)";

  var platLabels = platforms.map(function(k) {
    var p = CAPPER_PLATFORMS.find(function(pl) { return pl.key === k; });
    return p ? p.label : k;
  }).join(", ");

  return (<div style={{ padding: "32px 0 0", maxWidth: 1100, margin: "0 auto" }}>
    {/* Standardized header — matches Carousel + SlopTop */}
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontFamily: gf, fontSize: 28, fontWeight: 900, color: C.tx, letterSpacing: -0.5 }}>Capper</div>
      <div style={{ fontFamily: mn, fontSize: 10, color: C.txm, marginTop: 4, letterSpacing: 1 }}>
        CLIP CAPTION MAKER // 3 VARIATIONS PER PLATFORM //
        <span style={{ color: (CAPPER_PROVIDERS.find(function(p) { return p.key === provider; }) || CAPPER_PROVIDERS[0]).color, marginLeft: 6 }}>
          {(CAPPER_PROVIDERS.find(function(p) { return p.key === provider; }) || CAPPER_PROVIDERS[0]).label.toUpperCase()}
        </span>
        <span style={{ color: (CAPPER_SOURCES.find(function(s) { return s.key === sourceType; }) || CAPPER_SOURCES[0]).color, marginLeft: 6 }}>
          // {(CAPPER_SOURCES.find(function(s) { return s.key === sourceType; }) || CAPPER_SOURCES[0]).label.toUpperCase()}
        </span>
      </div>
    </div>

    {/* Clip Content */}
    <div style={{ marginBottom: 20 }}>
      <Label>Clip Content</Label>
      <textarea value={content} onChange={function(e: React.ChangeEvent<HTMLTextAreaElement>) { setContent(e.target.value); }} rows={7} placeholder="Paste the clip transcript or describe the topic..." style={{ width: "100%", padding: "14px 16px", background: cardBg, border: "1px solid " + borderC, borderRadius: 10, color: C.tx, fontFamily: mn, fontSize: 12, outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.7, transition: "border-color 0.2s ease, box-shadow 0.2s ease" }} onFocus={function(e: React.FocusEvent<HTMLTextAreaElement>) { e.target.style.borderColor = C.amber; e.target.style.boxShadow = "0 0 24px rgba(247,176,65,0.06)"; }} onBlur={function(e: React.FocusEvent<HTMLTextAreaElement>) { e.target.style.borderColor = borderC; e.target.style.boxShadow = "none"; }} />
      {content && <div style={{ fontFamily: mn, fontSize: 9, color: C.txd, marginTop: 4 }}>{content.length.toLocaleString()} chars</div>}
    </div>

    {/* Platform (multi-select) */}
    <div style={{ marginBottom: 20 }}>
      <Label>Platforms <span style={{ fontWeight: 400, opacity: 0.5, textTransform: "none", letterSpacing: 0 }}>(multi-select)</span></Label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {CAPPER_PLATFORMS.map(function(p) {
          var on = platforms.indexOf(p.key) > -1;
          return <div key={p.key} onClick={function() { togglePlatform(p.key); }} style={{ padding: "8px 16px", borderRadius: 8, cursor: "pointer", background: on ? p.color + "18" : cardBg, border: "1px solid " + (on ? p.color + "60" : borderC), fontFamily: ft, fontSize: 12, fontWeight: on ? 700 : 500, color: on ? p.color : C.txd, transition: "all 0.2s ease", display: "flex", alignItems: "center", gap: 6 }} onMouseEnter={function(e: React.MouseEvent<HTMLElement>) { if (!on) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; } }} onMouseLeave={function(e: React.MouseEvent<HTMLElement>) { if (!on) { e.currentTarget.style.borderColor = borderC; e.currentTarget.style.background = cardBg; } }}>
            <span style={{ fontFamily: mn, fontSize: 9, opacity: 0.7 }}>{p.icon}</span>
            {p.label}
            {on && <span style={{ width: 6, height: 6, borderRadius: "50%", background: p.color, boxShadow: "0 0 6px " + p.color + "60", marginLeft: 2 }} />}
          </div>;
        })}
      </div>
      {platforms.length > 1 && <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, marginTop: 6 }}>{platforms.length} platforms selected -- captions generated for each</div>}
    </div>

    {/* Length */}
    <div style={{ marginBottom: 20 }}>
      <Label>Length</Label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {CAPPER_LENGTHS.map(function(l) {
          var on = length === l.key;
          return <div key={l.key} onClick={function() { setLength(l.key); }} style={{ padding: "8px 16px", borderRadius: 8, cursor: "pointer", background: on ? (l.thread ? C.violet + "15" : C.amber + "15") : cardBg, border: "1px solid " + (on ? (l.thread ? C.violet + "60" : C.amber + "60") : borderC), fontFamily: ft, fontSize: 12, fontWeight: on ? 700 : 500, color: on ? (l.thread ? C.violet : C.amber) : C.txd, transition: "all 0.2s ease" }} onMouseEnter={function(e: React.MouseEvent<HTMLElement>) { if (!on) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; } }} onMouseLeave={function(e: React.MouseEvent<HTMLElement>) { if (!on) { e.currentTarget.style.borderColor = borderC; e.currentTarget.style.background = cardBg; } }}>
            {l.label}
            <span style={{ fontFamily: mn, fontSize: 9, marginLeft: 6, opacity: 0.5 }}>{l.desc}</span>
          </div>;
        })}
      </div>
      {isThread && <div style={{ fontFamily: mn, fontSize: 9, color: C.violet, marginTop: 6 }}>Thread mode: each variation will be a series of connected posts forming a narrative.</div>}
    </div>

    {/* Source type — where the clip came from. Drives the framing
        (first-person vs commentary, attribution patterns, hook style). */}
    <div style={{ marginBottom: 20 }}>
      <Label>Clip Source</Label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {CAPPER_SOURCES.map(function(s) {
          var on = sourceType === s.key;
          return <div key={s.key} onClick={function() { setSourceType(s.key); }}
            title={"Voice example: " + s.example}
            style={{ padding: "8px 14px", borderRadius: 8, cursor: "pointer",
              background: on ? s.color + "18" : cardBg,
              border: "1px solid " + (on ? s.color + "60" : borderC),
              fontFamily: ft, fontSize: 12, fontWeight: on ? 700 : 500,
              color: on ? s.color : C.txd,
              transition: "all 0.2s ease",
              display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1,
              maxWidth: 280 }}
            onMouseEnter={function(e: React.MouseEvent<HTMLElement>) { if (!on) e.currentTarget.style.borderColor = s.color + "30"; }}
            onMouseLeave={function(e: React.MouseEvent<HTMLElement>) { if (!on) e.currentTarget.style.borderColor = borderC; }}>
            <span>{s.label}</span>
            <span style={{ fontFamily: mn, fontSize: 9, color: on ? s.color : C.txd, opacity: 0.8, fontWeight: 500 }}>{s.desc}</span>
            {on && (
              <span style={{ fontFamily: ft, fontSize: 10.5, color: s.color, opacity: 0.9, fontStyle: "italic", fontWeight: 500, marginTop: 4, lineHeight: 1.35 }}>
                &ldquo;{s.example}&rdquo;
              </span>
            )}
          </div>;
        })}
      </div>
    </div>

    {/* LLM Provider — Claude / Gemini / Grok. Each produces a different
        natural voice on top of the explicit Tone choice. */}
    <div style={{ marginBottom: 20 }}>
      <Label>Generator</Label>
      <div style={{ display: "flex", gap: 6 }}>
        {CAPPER_PROVIDERS.map(function(p) {
          var on = provider === p.key;
          return <div key={p.key} onClick={function() { setProvider(p.key); }}
            style={{ flex: 1, padding: "10px 12px", borderRadius: 10, cursor: "pointer",
              background: on ? p.color + "15" : cardBg,
              border: "1px solid " + (on ? p.color + "60" : borderC),
              textAlign: "left", transition: "all 0.2s ease" }}>
            <div style={{ fontFamily: ft, fontSize: 13, fontWeight: 800, color: on ? p.color : C.tx }}>{p.label}</div>
            <div style={{ fontFamily: mn, fontSize: 10, color: on ? p.color : C.txm, marginTop: 2 }}>{p.sub}</div>
          </div>;
        })}
      </div>
    </div>

    {/* Tone */}
    <div style={{ marginBottom: 20 }}>
      <Label>Tone</Label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {CAPPER_TONES.map(function(t) {
          var on = tone === t.key;
          return <div key={t.key} onClick={function() { setTone(t.key); }} style={{ padding: "14px 16px", borderRadius: 10, cursor: "pointer", background: on ? C.amber + "0C" : cardBg, border: "1px solid " + (on ? C.amber + "50" : borderC), boxShadow: on ? "0 0 20px rgba(247,176,65,0.06)" : "none", transition: "all 0.2s ease" }} onMouseEnter={function(e: React.MouseEvent<HTMLElement>) { if (!on) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.3)"; } }} onMouseLeave={function(e: React.MouseEvent<HTMLElement>) { if (!on) { e.currentTarget.style.borderColor = borderC; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; } }}>
            <div style={{ fontFamily: ft, fontSize: 13, fontWeight: 700, color: on ? C.amber : C.tx, marginBottom: 4 }}>{t.label}</div>
            <div style={{ fontFamily: mn, fontSize: 10, color: C.txm, lineHeight: 1.5 }}>{t.desc}</div>
            {t.hook && <div style={{ fontFamily: mn, fontSize: 9, color: C.txd, marginTop: 6, fontStyle: "italic" }}>"{t.hook}"</div>}
          </div>;
        })}
      </div>
    </div>

    {/* Audience / Vibe */}
    <div style={{ marginBottom: 20 }}>
      <Label>Audience / Vibe</Label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {VISIBLE_AUDIENCES.map(function(a) {
          var on = audience === a.key;
          return <div key={a.key} onClick={function() { setAudience(a.key); }} style={{ padding: "8px 14px", borderRadius: 20, cursor: "pointer", background: on ? a.color + "18" : cardBg, border: "1px solid " + (on ? a.color + "60" : borderC), fontFamily: ft, fontSize: 11, fontWeight: on ? 700 : 500, color: on ? a.color : C.txm, transition: "all 0.15s" }} onMouseEnter={function(e: React.MouseEvent<HTMLElement>) { if (!on) e.currentTarget.style.borderColor = a.color + "30"; }} onMouseLeave={function(e: React.MouseEvent<HTMLElement>) { if (!on) e.currentTarget.style.borderColor = borderC; }}>
            {a.label}
          </div>;
        })}
      </div>
      <div style={{ fontFamily: mn, fontSize: 9, color: C.txd, marginTop: 6 }}>{(CAPPER_AUDIENCES.find(function(a) { return a.key === audience; }) || {}).desc || ""}</div>
    </div>

    {/* Custom Prompt Addition */}
    <div style={{ marginBottom: 20 }}>
      <Label>Add to Prompt (optional)</Label>
      <textarea value={customPrompt} onChange={function(e: React.ChangeEvent<HTMLTextAreaElement>) { setCustomPrompt(e.target.value); }} placeholder="e.g. make it meme-coded, reference the Drake format, add more chaos..." rows={2} style={{ width: "100%", padding: "10px 14px", background: cardBg, border: "1px solid " + borderC, borderRadius: 8, color: C.tx, fontFamily: ft, fontSize: 12, lineHeight: 1.5, resize: "none", outline: "none", boxSizing: "border-box", transition: "border-color 0.2s ease" }} onFocus={function(e: React.FocusEvent<HTMLTextAreaElement>) { e.target.style.borderColor = C.amber; }} onBlur={function(e: React.FocusEvent<HTMLTextAreaElement>) { e.target.style.borderColor = borderC; }} />
    </div>

    {/* Redirect Link Toggle */}
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: showLink ? 10 : 0 }}>
        <div onClick={function() { setShowLink(!showLink); }} style={{ width: 36, height: 20, borderRadius: 10, cursor: "pointer", background: showLink ? C.amber : "rgba(255,255,255,0.1)", position: "relative", transition: "background 0.2s ease" }}>
          <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: showLink ? 18 : 2, transition: "left 0.2s ease", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }} />
        </div>
        <span style={{ fontFamily: mn, fontSize: 11, color: showLink ? C.amber : C.txd }}>Include redirect link</span>
      </div>
      {showLink && <input value={url} onChange={function(e: React.ChangeEvent<HTMLInputElement>) { setUrl(e.target.value); }} placeholder="https://..." style={{ width: "100%", padding: "10px 14px", background: cardBg, border: "1px solid " + borderC, borderRadius: 8, color: C.tx, fontFamily: mn, fontSize: 12, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s ease" }} onFocus={function(e: React.FocusEvent<HTMLInputElement>) { e.target.style.borderColor = C.amber; }} onBlur={function(e: React.FocusEvent<HTMLInputElement>) { e.target.style.borderColor = borderC; }} />}
    </div>

    {/* Generate */}
    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
      <Btn onClick={generate} loading={loading} off={!content}>Generate Captions</Btn>
      {!content && <span style={{ fontFamily: mn, fontSize: 10, color: C.txd }}>Paste clip content first</span>}
    </div>
    {loading && <ProgressBar label={"Generating " + (isThread ? "threads" : "captions") + " for " + platLabels + " · " + (CAPPER_PROVIDERS.find(function(p) { return p.key === provider; }) || CAPPER_PROVIDERS[0]).label + " · " + toneObj.label + " tone · " + (CAPPER_SOURCES.find(function(s) { return s.key === sourceType; }) || CAPPER_SOURCES[0]).label + " source"} />}

    {/* Output -- grouped by platform */}
    {results && <div style={{ marginTop: 28 }}>
      {platforms.map(function(platKey) {
        var platObj = CAPPER_PLATFORMS.find(function(p) { return p.key === platKey; }) || CAPPER_PLATFORMS[0];
        var platResults = results![platKey] || [];
        if (platResults.length === 0) return null;

        return <div key={platKey} style={{ marginBottom: 32 }}>
          {/* Platform header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, paddingBottom: 10, borderBottom: "1px solid " + platObj.color + "25" }}>
            <span style={{ fontFamily: mn, fontSize: 12, fontWeight: 800, color: platObj.color, background: platObj.color + "18", padding: "4px 12px", borderRadius: 6 }}>{platObj.icon}</span>
            <span style={{ fontFamily: ft, fontSize: 16, fontWeight: 800, color: platObj.color }}>{platObj.label}</span>
            <span style={{ fontFamily: mn, fontSize: 10, color: C.txm }}>{toneObj.label} Tone</span>
            {isThread && <span style={{ fontFamily: mn, fontSize: 9, color: C.violet, background: C.violet + "15", padding: "2px 8px", borderRadius: 4 }}>Thread</span>}
          </div>

          {platResults.map(function(r, i) {
            var regenKey = platKey + "_" + i;
            var isRegen = regenL[regenKey];

            if (isThread) {
              /* Thread / multi-post output */
              var posts = r.posts || [];
              var fullText = posts.map(function(p) { return "Post " + p.number + ": " + p.text; }).join("\n\n");
              return <div key={i} style={{ background: cardBg, border: "1px solid " + borderC, borderLeft: "3px solid " + platObj.color, borderRadius: 12, padding: "18px 20px", marginBottom: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.3)", transition: "all 0.2s ease" }} onMouseEnter={function(e: React.MouseEvent<HTMLElement>) { e.currentTarget.style.borderColor = platObj.color + "40"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.4), 0 0 12px " + platObj.color + "08"; }} onMouseLeave={function(e: React.MouseEvent<HTMLElement>) { e.currentTarget.style.borderColor = borderC; e.currentTarget.style.borderLeftColor = platObj.color; e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.3)"; }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: mn, fontSize: 11, color: C.txm }}>Variation {i + 1}</span>
                    <span style={{ fontFamily: mn, fontSize: 9, color: C.violet, background: C.violet + "12", padding: "2px 8px", borderRadius: 4 }}>{posts.length} posts</span>
                  </div>
                  <div style={{ display: "flex", gap: 5 }}>
                    <CopyBtn text={fullText} />
                    <SaveToLibrary tool="capper" title={"Variation " + (i + 1) + " \u00B7 " + platObj.label + " thread"} prompt={posts.map(function(p) { return p.text; }).join("\n\n")} provider={provider} />
                    <SendToChip text={posts.map(function(p) { return p.text; }).join("\n\n")} sourceTool="capper" provider={provider} kind="thread" excludeDestinations={["capper"]} />
                    <span onClick={function() { if (!isRegen) regenerateOne(platKey, i); }} style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.4)", cursor: isRegen ? "wait" : "pointer", padding: "3px 8px", borderRadius: 6, border: "1px solid " + borderC, opacity: isRegen ? 0.4 : 1, userSelect: "none", transition: "all 0.2s ease" }}>{isRegen ? "..." : "\u21BB"}</span>
                    <span onClick={function() { if (!bufferSending[platKey]) { var threadText = posts.map(function(p: { number: number; text: string }) { return p.text; }).join("\n\n"); sendToBuffer(platKey, threadText).then(function(ok: boolean) { if (ok) showToast("Sent " + platObj.label + " thread draft to Buffer."); }); } }} style={{ fontFamily: mn, fontSize: 9, color: bufferSending[platKey] ? C.teal : "rgba(255,255,255,0.4)", cursor: bufferSending[platKey] ? "wait" : "pointer", padding: "3px 8px", borderRadius: 6, border: "1px solid " + (bufferSending[platKey] ? C.teal + "40" : borderC), background: bufferSending[platKey] ? C.teal + "08" : "transparent", opacity: bufferSending[platKey] ? 0.6 : 1, userSelect: "none", transition: "all 0.2s ease" }} onMouseEnter={function(e: React.MouseEvent<HTMLElement>) { if (!bufferSending[platKey]) { e.currentTarget.style.borderColor = C.teal + "40"; e.currentTarget.style.color = C.teal; } }} onMouseLeave={function(e: React.MouseEvent<HTMLElement>) { if (!bufferSending[platKey]) { e.currentTarget.style.borderColor = borderC; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; } }}>{bufferSending[platKey] ? "Sending..." : "Buffer"}</span>
                  </div>
                </div>
                {/* Thread posts */}
                {posts.map(function(post) {
                  return <div key={post.number} style={{ marginBottom: 10, padding: "12px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 8, border: "1px solid " + borderC }}>
                    <div style={{ fontFamily: mn, fontSize: 9, color: platObj.color, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: "1px" }}>Post {post.number}/{posts.length}</div>
                    <div style={{ fontFamily: ft, fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{post.text}</div>
                  </div>;
                })}
              </div>;
            }

            /* Standard single-post output */
            var cap = r.caption || "";
            return <div key={i} style={{ background: cardBg, border: "1px solid " + borderC, borderLeft: "3px solid " + platObj.color, borderRadius: 12, padding: "18px 20px", marginBottom: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.3)", transition: "all 0.2s ease" }} onMouseEnter={function(e: React.MouseEvent<HTMLElement>) { e.currentTarget.style.borderColor = platObj.color + "40"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.4), 0 0 12px " + platObj.color + "08"; }} onMouseLeave={function(e: React.MouseEvent<HTMLElement>) { e.currentTarget.style.borderColor = borderC; e.currentTarget.style.borderLeftColor = platObj.color; e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.3)"; }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: mn, fontSize: 11, color: C.txm }}>Variation {i + 1}</span>
                  <span style={{ fontFamily: mn, fontSize: 9, color: C.txd }}>{charCount(cap)} chars</span>
                </div>
                <div style={{ display: "flex", gap: 5 }}>
                  <CopyBtn text={cap + (r.reply ? "\n\n[Reply]\n" + r.reply : "") + (r.title ? "\n\n[Title]\n" + r.title : "")} />
                  <SaveToLibrary tool="capper" title={"Variation " + (i + 1) + " \u00B7 " + platObj.label} prompt={cap + (r.reply ? "\n\n[Reply]\n" + r.reply : "") + (r.title ? "\n\n[Title]\n" + r.title : "")} provider={provider} />
                  <SendToChip text={cap + (r.reply ? "\n\n[Reply]\n" + r.reply : "") + (r.title ? "\n\n[Title]\n" + r.title : "")} sourceTool="capper" provider={provider} kind="caption" excludeDestinations={["capper"]} />
                  <span onClick={function() { if (!isRegen) regenerateOne(platKey, i); }} style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.4)", cursor: isRegen ? "wait" : "pointer", padding: "3px 8px", borderRadius: 6, border: "1px solid " + borderC, opacity: isRegen ? 0.4 : 1, userSelect: "none", transition: "all 0.2s ease" }}>{isRegen ? "..." : "\u21BB"}</span>
                  <span onClick={function() { if (!bufferSending[platKey]) { sendToBuffer(platKey, cap).then(function(ok: boolean) { if (ok) showToast("Sent " + platObj.label + " draft to Buffer."); }); } }} style={{ fontFamily: mn, fontSize: 9, color: bufferSending[platKey] ? C.teal : "rgba(255,255,255,0.4)", cursor: bufferSending[platKey] ? "wait" : "pointer", padding: "3px 8px", borderRadius: 6, border: "1px solid " + (bufferSending[platKey] ? C.teal + "40" : borderC), background: bufferSending[platKey] ? C.teal + "08" : "transparent", opacity: bufferSending[platKey] ? 0.6 : 1, userSelect: "none", transition: "all 0.2s ease" }} onMouseEnter={function(e: React.MouseEvent<HTMLElement>) { if (!bufferSending[platKey]) { e.currentTarget.style.borderColor = C.teal + "40"; e.currentTarget.style.color = C.teal; } }} onMouseLeave={function(e: React.MouseEvent<HTMLElement>) { if (!bufferSending[platKey]) { e.currentTarget.style.borderColor = borderC; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; } }}>{bufferSending[platKey] ? "Sending..." : "Buffer"}</span>
                </div>
              </div>

              {/* YouTube title */}
              {platKey === "youtube" && r.title && <div style={{ marginBottom: 10 }}>
                <div style={{ fontFamily: mn, fontSize: 9, color: C.txd, marginBottom: 4, textTransform: "uppercase", letterSpacing: "1px" }}>Title ({r.title.length} chars)</div>
                <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 700, color: C.tx, padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 6, border: "1px solid " + borderC }}>{r.title}</div>
              </div>}

              {/* Caption body */}
              <div style={{ fontFamily: ft, fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{cap}</div>

              {/* X reply format */}
              {platKey === "x" && r.reply && <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed " + borderC }}>
                <div style={{ fontFamily: mn, fontSize: 9, color: C.txd, marginBottom: 4, textTransform: "uppercase", letterSpacing: "1px" }}>Reply</div>
                <div style={{ fontFamily: ft, fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{r.reply}</div>
              </div>}
            </div>;
          })}
        </div>;
      })}
      {/* Send All to Buffer */}
      {platforms.length > 0 && <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid " + borderC, display: "flex", alignItems: "center", gap: 12 }}>
        <span onClick={function() { if (!bufferSending["_all"]) sendAllToBuffer(); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 10, cursor: bufferSending["_all"] ? "wait" : "pointer", background: bufferSending["_all"] ? C.teal + "15" : "linear-gradient(135deg, " + C.teal + "18, " + C.teal + "08)", border: "1px solid " + C.teal + "40", fontFamily: ft, fontSize: 13, fontWeight: 700, color: C.teal, opacity: bufferSending["_all"] ? 0.6 : 1, transition: "all 0.2s ease", boxShadow: "0 0 16px " + C.teal + "08" }} onMouseEnter={function(e: React.MouseEvent<HTMLElement>) { if (!bufferSending["_all"]) { e.currentTarget.style.boxShadow = "0 0 24px " + C.teal + "18"; e.currentTarget.style.borderColor = C.teal + "70"; } }} onMouseLeave={function(e: React.MouseEvent<HTMLElement>) { e.currentTarget.style.boxShadow = "0 0 16px " + C.teal + "08"; e.currentTarget.style.borderColor = C.teal + "40"; }}>{bufferSending["_all"] ? "Sending..." : "Send All to Buffer"}</span>
        <span style={{ fontFamily: mn, fontSize: 9, color: C.txd }}>Sends first variation of each platform as a draft</span>
      </div>}
    </div>}
  </div>);
}
