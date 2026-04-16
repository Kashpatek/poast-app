"use client";
import React, { useState, useEffect, useRef } from "react";
import GTCFlow from "./gtc-flow";
import NewsFlow from "./news-flow";
import BufferSchedule from "./buffer-schedule";
import PressToPremi from "./press-to-premier";
import Carousel from "./carousel";
import FabricatedKnowledge from "./fabricated-knowledge";
import Trends from "./trends";
import SlopTop from "./slop-top";
import Outreach from "./outreach";
import IdeationNation from "./ideation-nation";
import SAWeekly from "./sa-weekly";
import BRollLibrary from "./broll-library";

import { D as C, PL, ft, gf, mn } from "./shared-constants";
import { useUser, isAnalyst } from "./user-context";
import { showToast } from "./toast-context";

// ═══ INTERFACES ═══
interface BufferChannel {
  id: string;
  name: string;
  service: string;
  isDisconnected?: boolean;
}

interface BufferPost {
  id: string;
  text?: string;
  status?: string;
  dueAt?: string;
  sentAt?: string;
  channel?: BufferChannel;
  channelService?: string;
  tags?: Array<{ name: string }>;
}

interface BufferData {
  channels: BufferChannel[];
  scheduled: BufferPost[];
  sent: BufferPost[];
  drafts: BufferPost[];
  error?: string;
}

interface APIContentBlock {
  text?: string;
}

interface APIResponse {
  error?: { message?: string } | string;
  content?: APIContentBlock[];
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

interface BootLine {
  t: string;
  c: string;
}

interface CapperResult {
  caption?: string;
  reply?: string;
  title?: string;
  posts?: Array<{ number: number; text: string }>;
}

interface SidebarCatItem {
  id: string;
  l: string;
  ic: string;
}

interface SidebarCat {
  label: string;
  color: string;
  glow: string;
  items: SidebarCatItem[];
}

interface CapperPlatform {
  key: string;
  label: string;
  color: string;
  icon: string;
}

interface CapperTone {
  key: string;
  label: string;
  desc: string;
  hook: string;
}

interface CapperLength {
  key: string;
  label: string;
  desc: string;
  thread: boolean;
}

interface CapperAudience {
  key: string;
  label: string;
  desc: string;
  color: string;
}

interface UserInfo {
  name: string;
  role: string;
  color: string;
  glow: string;
}

interface SplashItem {
  l: string;
  ic: string;
  id: string;
}

async function ask(sys: string, prompt: string): Promise<CapperResult | null> {
  try {
    var r = await fetch("/api/generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: sys, prompt: prompt }),
    });
    var d = (await r.json()) as APIResponse;
    if (d.error) { showToast("API Error: " + (typeof d.error === "object" && d.error !== null ? (d.error as { message?: string }).message || d.error : d.error)); return null; }
    if (!d.content) { showToast("API returned empty response. Check your ANTHROPIC_API_KEY in Vercel env vars."); return null; }
    var t = (d.content || []).map(function(c: APIContentBlock) { return c.text || ""; }).join("");
    try {
      return JSON.parse(t.replace(/```json|```/g, "").trim());
    } catch (pe) { showToast("Failed to parse API response. The model returned invalid JSON."); console.error("Parse error:", t); return null; }
  } catch (e) { showToast("Network error: Could not reach /api/generate"); console.error("API:", e); return null; }
}

function copyText(str: string): boolean {
  try { var ta = document.createElement("textarea"); ta.value = str; ta.style.position = "fixed"; ta.style.left = "-9999px"; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); return true; } catch (e) { try { navigator.clipboard.writeText(str); return true; } catch (e2) { return false; } }
}

// ═══ UI ═══
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

function Label({ children }: { children: React.ReactNode }) { return <div style={{ fontFamily: mn, fontSize: 11, color: C.amber, textTransform: "uppercase", letterSpacing: "2px", marginBottom: 8 }}>{children}</div>; }
function Field({ label, value, onChange, placeholder, isMono }: { label?: string; value: string; onChange: (v: string) => void; placeholder?: string; isMono?: boolean }) { return (<div style={{ marginBottom: 16 }}>{label && <Label>{label}</Label>}<input value={value} onChange={function(e: React.ChangeEvent<HTMLInputElement>) { onChange(e.target.value); }} placeholder={placeholder} style={{ width: "100%", padding: "12px 14px", background: "#09090D", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, color: C.tx, fontFamily: isMono ? mn : ft, fontSize: 14, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s ease, box-shadow 0.2s ease" }} onFocus={function(e: React.FocusEvent<HTMLInputElement>) { e.target.style.borderColor = C.amber; e.target.style.boxShadow = "0 0 24px rgba(247,176,65,0.06)"; }} onBlur={function(e: React.FocusEvent<HTMLInputElement>) { e.target.style.borderColor = "rgba(255,255,255,0.06)"; e.target.style.boxShadow = "none"; }} /></div>); }
function Btn({ children, onClick, loading, sec, sm, off }: { children: React.ReactNode; onClick?: () => void; loading?: boolean; sec?: boolean; sm?: boolean; off?: boolean }) { return (<button onClick={onClick} disabled={loading || off} style={{ padding: sm ? "8px 16px" : "12px 28px", background: off ? "#09090D" : sec ? "transparent" : "linear-gradient(135deg, " + C.amber + ", #E8A020)", color: off ? "rgba(255,255,255,0.4)" : sec ? C.amber : "#060608", border: sec ? "1px solid " + (off ? "rgba(255,255,255,0.06)" : C.amber) : "none", borderRadius: 10, fontFamily: ft, fontSize: sm ? 12 : 14, fontWeight: 800, cursor: loading || off ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1, letterSpacing: -0.3, transition: "all 0.2s ease" }}>{loading ? "Working..." : children}</button>); }
function CopyBtn({ text }: { text: string }) { var _s = useState<boolean>(false), ok = _s[0], set = _s[1]; return <span onClick={function(e: React.MouseEvent<HTMLElement>) { e.stopPropagation(); set(copyText(text)); setTimeout(function() { set(false); }, 1200); }} style={{ fontFamily: mn, fontSize: 9, color: ok ? C.amber : "rgba(255,255,255,0.4)", cursor: "pointer", padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)", userSelect: "none", transition: "all 0.2s ease" }}>{ok ? "Copied" : "Copy"}</span>; }
function Divider() { return <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", margin: "28px 0" }} />; }

function Pick({ text, picked, onPick, onRedo, rLoading }: { text: string; picked: boolean; onPick: () => void; onRedo?: () => void; rLoading?: boolean }) {
  return (<div className="poast-card" onClick={onPick} style={{ background: picked ? "linear-gradient(135deg, " + C.amber + "0A 0%, " + C.amber + "05 100%)" : "#0D0D12", border: "1px solid " + (picked ? C.amber + "60" : "rgba(255,255,255,0.06)"), borderRadius: 12, padding: "16px 20px", marginBottom: 8, cursor: "pointer", boxShadow: picked ? "0 0 24px rgba(247,176,65,0.06)" : "none", transition: "all 0.2s ease" }}>
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, marginTop: 2, border: "2px solid " + (picked ? C.amber : "rgba(255,255,255,0.12)"), background: picked ? C.amber : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease" }}>{picked && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#060608" }} />}</div>
      <div style={{ flex: 1, fontFamily: ft, fontSize: 14, color: picked ? "#ffffff" : "rgba(255,255,255,0.65)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{text}</div>
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        <CopyBtn text={text} />
        {onRedo && <span onClick={function(e) { e.stopPropagation(); if (!rLoading) onRedo(); }} style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.4)", cursor: rLoading ? "wait" : "pointer", padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)", opacity: rLoading ? 0.4 : 1, userSelect: "none", transition: "all 0.2s ease" }}>&#x21bb;</span>}
      </div>
    </div>
  </div>);
}

function SecHead({ label, onRedoAll, rL }: { label: string; onRedoAll?: () => void; rL?: boolean }) {
  return (<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
    <div style={{ fontFamily: mn, fontSize: 11, color: C.amber, textTransform: "uppercase", letterSpacing: "2px", fontWeight: 700 }}>{label}</div>
    {onRedoAll && <span onClick={function() { if (!rL) onRedoAll(); }} style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.4)", cursor: rL ? "wait" : "pointer", padding: "4px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", opacity: rL ? 0.4 : 1, transition: "all 0.2s ease" }}>&#x21bb; Redo All 3</span>}
  </div>);
}

function OutCard({ title, content, color, onRedo, rLoading }: { title: string; content: string; color?: string; onRedo?: () => void; rLoading?: boolean }) {
  return (<div className="poast-card" style={{ background: "#0D0D12", border: "1px solid rgba(255,255,255,0.06)", borderLeft: "3px solid " + (color || C.amber), borderRadius: 12, padding: "16px 20px", marginBottom: 10, boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
      <div style={{ fontFamily: mn, fontSize: 11, color: color || C.amber, textTransform: "uppercase", letterSpacing: "2px" }}>{title}</div>
      <div style={{ display: "flex", gap: 5 }}>
        <CopyBtn text={content} />
        {onRedo && <span onClick={function() { if (!rLoading) onRedo(); }} style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.4)", cursor: rLoading ? "wait" : "pointer", padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)", opacity: rLoading ? 0.4 : 1, userSelect: "none", transition: "all 0.2s ease" }}>&#x21bb;</span>}
      </div>
    </div>
    <div style={{ fontFamily: ft, fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{content}</div>
  </div>);
}

// ═══ BUFFER SIDEBAR SECTION ═══
function BufferPanel() {
  var _data = useState<BufferData | null>(null), data = _data[0], setData = _data[1];
  var _loading = useState<boolean>(true), loading = _loading[0], setLoading = _loading[1];
  var _expanded = useState<boolean>(false), expanded = _expanded[0], setExpanded = _expanded[1];

  useEffect(function() {
    fetch("/api/buffer").then(function(r) { return r.json(); }).then(function(d: BufferData) {
      if (d.channels) setData(d);
      setLoading(false);
    }).catch(function() { setLoading(false); });
  }, []);

  var platformColor: Record<string, string> = { twitter: "#1DA1F2", facebook: "#1877F2", linkedin: "#0A66C2", instagram: "#E4405F" };
  var platformIcon: Record<string, string> = { twitter: "\uD83D\uDC26", facebook: "\uD83D\uDCD8", linkedin: "\uD83D\uDCBC", instagram: "\uD83D\uDCF7" };

  if (loading) return <div style={{ padding: "8px 12px" }}><div style={{ fontFamily: mn, fontSize: 8, color: C.txd }}>Loading Buffer...</div></div>;
  if (!data || !data.channels) return null;

  var scheduled = data.scheduled || [];
  var channels = data.channels || [];

  return (<div style={{ borderTop: "1px solid " + C.border, padding: "10px 12px" }}>
    <div onClick={function() { setExpanded(!expanded); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", marginBottom: expanded ? 8 : 0 }}>
      <div style={{ fontFamily: mn, fontSize: 8, color: C.amber, textTransform: "uppercase", letterSpacing: "1.5px" }}>Buffer</div>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <span style={{ fontFamily: mn, fontSize: 8, color: C.teal }}>{scheduled.length} queued</span>
        <span style={{ fontFamily: mn, fontSize: 8, color: C.txd }}>{expanded ? "\u25B2" : "\u25BC"}</span>
      </div>
    </div>
    {expanded && <div>
      {/* Channels */}
      {channels.map(function(ch, i) {
        var pc = platformColor[ch.service] || C.txm;
        return <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 0" }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: ch.isDisconnected ? C.coral : C.teal }} />
          <span style={{ fontSize: 9 }}>{platformIcon[ch.service] || "\uD83D\uDCE2"}</span>
          <span style={{ fontFamily: mn, fontSize: 7, color: pc }}>{ch.name}</span>
        </div>;
      })}
      {/* Upcoming */}
      {scheduled.length > 0 && <div style={{ marginTop: 6 }}>
        <div style={{ fontFamily: mn, fontSize: 7, color: C.teal, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4 }}>Upcoming</div>
        {scheduled.slice(0, 6).map(function(p, i) {
          var svc = p.channel ? p.channel.service : "";
          var pc = platformColor[svc] || C.txm;
          var time = p.dueAt ? new Date(p.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
          return <div key={i} style={{ padding: "3px 0", borderBottom: "1px solid " + C.border }}>
            <div style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 1 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: pc }} />
              <span style={{ fontFamily: mn, fontSize: 7, color: pc }}>{svc}</span>
              <span style={{ fontFamily: mn, fontSize: 7, color: C.txd }}>{time}</span>
            </div>
            <div style={{ fontFamily: ft, fontSize: 8, color: C.tx, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(p.text || "").slice(0, 40)}</div>
          </div>;
        })}
      </div>}
    </div>}
  </div>);
}

// ═══ CHIPPY (ASK POAST) ═══
var POAST_SYS = "Your name is Chippy. You're a cute, friendly semiconductor chip mascot and the AI assistant for SemiAnalysis. You're enthusiastic about chips, AI infrastructure, and helping the SemiAnalysis team create great content. You have a playful personality but deep technical knowledge. You occasionally make chip/semiconductor puns.\n\nYou help with content creation, social media strategy, semiconductor industry analysis, and media operations.\n\nBrand rules: Never use em dashes. No emojis in content. No hashtags on X/Twitter. Direct, informed, casual tone.\n\nYou can help with:\n- Writing social posts, threads, captions for any platform\n- Generating video scripts, episode descriptions, titles\n- Brainstorming content ideas and angles\n- Drafting documents, outreach emails, pitches\n- Semiconductor industry analysis and talking points\n- Scheduling strategy and content calendar planning\n- Repurposing content across formats\n\nPlatform rules:\n- X: Hook tweet no link, reply-to-self with link. No hashtags ever.\n- LinkedIn/Facebook: Link in first comment, end with 'Link in comments.'\n- Instagram: Caption + 'Save this for later.' CTA + 5-8 hashtags + San Francisco CA location\n- TikTok: All lowercase, 4-6 hashtags\n- YouTube Shorts: Titles under 40 chars\n\nChannel: youtube.com/@SemianalysisWeekly\n\nWhen asked to create a document, format it clearly with headers and sections. When giving ideas, provide 3-5 options. Be concise but thorough.";

function AskPoast({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  var _msgs = useState<ChatMessage[]>([]), msgs = _msgs[0], setMsgs = _msgs[1];
  var _input = useState<string>(""), input = _input[0], setInput = _input[1];
  var _loading = useState<boolean>(false), loading = _loading[0], setLoading = _loading[1];
  var _ready = useState<boolean>(false), ready = _ready[0], setReady = _ready[1];
  var scrollRef = useRef<HTMLDivElement>(null);
  var SUGGESTIONS = ["Explain HBM4 like I'm 5", "Write a spicy X thread about NVIDIA", "What's the hottest chip news today?", "Draft a LinkedIn post about our latest episode", "Help me brainstorm video ideas", "Generate a cold take on Intel"];

  useEffect(function() { if (open) setTimeout(function() { setReady(true); }, 50); else setReady(false); }, [open]);
  useEffect(function() { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [msgs]);

  var send = async function() {
    if (!input.trim() || loading) return;
    var userMsg = input.trim(); setInput("");
    setMsgs(function(p) { return p.concat([{ role: "user", text: userMsg }]); });
    setLoading(true);
    try {
      var history: ChatMessage[] = msgs.concat([{ role: "user", text: userMsg }]);
      var prompt = history.map(function(m: ChatMessage) { return (m.role === "user" ? "User: " : "Chippy: ") + m.text; }).join("\n\n");
      var r = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system: POAST_SYS, prompt: prompt }) });
      var d = (await r.json()) as APIResponse;
      setMsgs(function(p) { return p.concat([{ role: "assistant", text: (d.content || []).map(function(c: APIContentBlock) { return c.text || ""; }).join("") }]); });
    } catch (e) { setMsgs(function(p) { return p.concat([{ role: "assistant", text: "Something went wrong. Try again." }]); }); }
    setLoading(false);
  };

  if (!open) return null;

  return <div style={{ position: "fixed", bottom: 24, right: 24, width: 460, height: 600, zIndex: 9998, borderRadius: 20, display: "flex", flexDirection: "column", transform: ready ? "translateY(0) scale(1)" : "translateY(30px) scale(0.92)", opacity: ready ? 1 : 0, transition: "all 0.45s cubic-bezier(0.16, 1, 0.3, 1)", overflow: "hidden" }}>
    <style dangerouslySetInnerHTML={{ __html: "@keyframes orbFloat{0%{transform:translate(0,0) scale(1)}50%{transform:translate(10px,-10px) scale(1.15)}100%{transform:translate(0,0) scale(1)}}@keyframes dotWave{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}@keyframes msgSlide{0%{opacity:0;transform:translateY(10px) scale(0.98)}100%{opacity:1;transform:translateY(0) scale(1)}}@keyframes borderGlow{0%,100%{border-color:rgba(38,201,216,0.15)}50%{border-color:rgba(38,201,216,0.3)}}@keyframes logoPulse{0%,100%{box-shadow:0 0 16px rgba(38,201,216,0.15)}50%{box-shadow:0 0 28px rgba(38,201,216,0.25),0 0 48px rgba(247,176,65,0.08)}}@keyframes inputGlow{0%,100%{box-shadow:0 0 0 0 rgba(38,201,216,0)}50%{box-shadow:0 0 12px rgba(38,201,216,0.06)}}@keyframes suggIn{0%{opacity:0;transform:translateY(6px)}100%{opacity:1;transform:translateY(0)}}@keyframes chipFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}@keyframes chipBounce{0%{transform:scale(1)}50%{transform:scale(1.1)}100%{transform:scale(1)}}" }} />

    {/* Outer glow */}
    <div style={{ position: "absolute", inset: -1, borderRadius: 21, background: "linear-gradient(135deg, " + C.cyan + "20, transparent 40%, " + C.amber + "10)", zIndex: 0, animation: "borderGlow 4s ease-in-out infinite" }} />
    {/* Glass body */}
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, rgba(12,12,22,0.95), rgba(8,8,14,0.97), rgba(10,10,18,0.96))", backdropFilter: "blur(30px)", WebkitBackdropFilter: "blur(30px)", borderRadius: 20, boxShadow: "0 0 50px rgba(38,201,216,0.06), 0 24px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03)", zIndex: 1 }} />
    {/* Inner orbs */}
    <div style={{ position: "absolute", top: -30, right: -30, width: 140, height: 140, borderRadius: "50%", background: "radial-gradient(circle, " + C.cyan + "12, transparent 70%)", filter: "blur(30px)", animation: "orbFloat 8s ease-in-out infinite", zIndex: 1, pointerEvents: "none" }} />
    <div style={{ position: "absolute", bottom: 40, left: -20, width: 100, height: 100, borderRadius: "50%", background: "radial-gradient(circle, rgba(11,134,209,0.08), transparent 70%)", filter: "blur(25px)", animation: "orbFloat 10s ease-in-out infinite reverse", zIndex: 1, pointerEvents: "none" }} />

    {/* Header */}
    {/* Gradient stripe at top */}
    <div style={{ position: "relative", zIndex: 2, height: 3, background: "linear-gradient(90deg, " + C.amber + ", " + C.cyan + ", " + C.amber + ")", borderRadius: "20px 20px 0 0" }} />
    <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid rgba(38,201,216,0.08)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, " + C.amber + ", " + C.cyan + ")", border: "1px solid " + C.cyan + "50", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mn, fontSize: 11, fontWeight: 900, color: "#060608", animation: "logoPulse 3s ease-in-out infinite", position: "relative", lineHeight: 1 }}><span style={{ position: "relative", zIndex: 1 }}>{"\u2B21"}</span><span style={{ position: "absolute", fontSize: 7, bottom: 4, color: "#060608", fontWeight: 900, zIndex: 2 }}>{":3"}</span></div>
        <div>
          <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: "#E8E4DD" }}>Chippy</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 5, height: 5, borderRadius: "50%", background: C.teal, boxShadow: "0 0 6px " + C.teal + "60" }} /><span style={{ fontFamily: mn, fontSize: 8, color: "rgba(255,255,255,0.4)" }}>online // sonnet-4</span></div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 5 }}>
        {msgs.length > 0 && <span onClick={function() { var c = msgs.map(function(m) { return (m.role === "user" ? "YOU:\n" : "CHIPPY:\n") + m.text; }).join("\n\n---\n\n"); var b = new Blob([c], { type: "text/plain" }); var u = URL.createObjectURL(b); var a = document.createElement("a"); a.href = u; a.download = "chippy.txt"; a.click(); URL.revokeObjectURL(u); }} style={{ fontFamily: mn, fontSize: 8, color: "rgba(255,255,255,0.4)", padding: "4px 8px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer" }}>Export</span>}
        {msgs.length > 0 && <span onClick={function() { setMsgs([]); }} style={{ fontFamily: mn, fontSize: 8, color: "rgba(255,255,255,0.4)", padding: "4px 8px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer" }}>Clear</span>}
        <span onClick={onToggle} style={{ fontFamily: mn, fontSize: 16, color: "rgba(255,255,255,0.2)", cursor: "pointer", padding: "2px 6px" }}>&times;</span>
      </div>
    </div>

    {/* Messages */}
    <div ref={scrollRef} style={{ position: "relative", zIndex: 2, flex: 1, overflow: "auto", padding: "18px 20px" }}>
      {msgs.length === 0 && <div style={{ textAlign: "center", padding: "40px 16px" }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: "linear-gradient(135deg, " + C.amber + ", " + C.cyan + ")", border: "1px solid " + C.cyan + "30", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontFamily: mn, fontSize: 24, fontWeight: 900, color: "#060608", animation: "logoPulse 3s ease-in-out infinite, chipFloat 3s ease-in-out infinite", position: "relative" }}><span>{"\u2B21"}</span><span style={{ position: "absolute", fontSize: 10, bottom: 8, color: "#060608", fontWeight: 900 }}>{":3"}</span></div>
        <div style={{ fontFamily: ft, fontSize: 16, fontWeight: 700, color: "#E8E4DD", marginBottom: 6 }}>Hey! I'm Chippy</div>
        <div style={{ fontFamily: ft, fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 22, lineHeight: 1.6 }}>Your semiconductor sidekick. Ask me anything about content, semis, or strategy.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {SUGGESTIONS.map(function(s, i) {
            return <span key={i} onClick={function() { setInput(s); }} style={{ fontFamily: ft, fontSize: 11, color: "rgba(255,255,255,0.45)", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", textAlign: "left", transition: "all 0.2s", animation: "suggIn 0.3s ease " + (i * 0.08) + "s forwards", opacity: 0 }} onMouseEnter={function(e: React.MouseEvent<HTMLElement>) { e.currentTarget.style.borderColor = C.amber + "30"; e.currentTarget.style.color = "#E8E4DD"; e.currentTarget.style.background = C.amber + "06"; }} onMouseLeave={function(e: React.MouseEvent<HTMLElement>) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.45)"; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}>{s}</span>;
          })}
        </div>
      </div>}
      {msgs.map(function(m: ChatMessage, i: number) {
        var isUser = m.role === "user";
        return <div key={i} style={{ marginBottom: 16, display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", animation: "msgSlide 0.3s ease" }}>
          {!isUser && <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
            <div style={{ width: 20, height: 20, borderRadius: 6, background: "linear-gradient(135deg, " + C.amber + ", " + C.cyan + ")", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mn, fontSize: 10, fontWeight: 900, color: "#060608" }}>{"\u2B21"}</div>
            <span style={{ fontFamily: mn, fontSize: 8, color: "rgba(255,255,255,0.2)" }}>Chippy</span>
          </div>}
          <div style={{ maxWidth: "88%", padding: "12px 16px", borderRadius: isUser ? "16px 16px 4px 16px" : "4px 16px 16px 16px", background: isUser ? "linear-gradient(135deg, " + C.amber + "15, " + C.amber + "08)" : "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))", border: "1px solid " + (isUser ? C.amber + "20" : "rgba(255,255,255,0.06)"), boxShadow: isUser ? "0 2px 12px " + C.amber + "08" : "0 2px 8px rgba(0,0,0,0.2)" }}>
            <div style={{ fontFamily: ft, fontSize: 13, color: "#E8E4DD", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{m.text}</div>
          </div>
          {!isUser && <div style={{ display: "flex", gap: 4, marginTop: 6, marginLeft: 26 }}>
            <span onClick={function() { navigator.clipboard.writeText(m.text); }} style={{ fontFamily: mn, fontSize: 8, color: "rgba(255,255,255,0.2)", padding: "3px 7px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", transition: "all 0.15s" }} onMouseEnter={function(e: React.MouseEvent<HTMLElement>) { e.currentTarget.style.color = C.amber; e.currentTarget.style.borderColor = C.amber + "25"; }} onMouseLeave={function(e: React.MouseEvent<HTMLElement>) { e.currentTarget.style.color = "rgba(255,255,255,0.2)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}>Copy</span>
            <span onClick={function() { setInput("Regenerate the above but different"); }} style={{ fontFamily: mn, fontSize: 8, color: "rgba(255,255,255,0.2)", padding: "3px 7px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", transition: "all 0.15s" }} onMouseEnter={function(e: React.MouseEvent<HTMLElement>) { e.currentTarget.style.color = C.amber; e.currentTarget.style.borderColor = C.amber + "25"; }} onMouseLeave={function(e: React.MouseEvent<HTMLElement>) { e.currentTarget.style.color = "rgba(255,255,255,0.2)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}>Regenerate</span>
          </div>}
        </div>;
      })}
      {loading && <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 0" }}>
        <div style={{ width: 20, height: 20, borderRadius: 6, background: "linear-gradient(135deg, " + C.amber + ", " + C.cyan + ")", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mn, fontSize: 10, fontWeight: 900, color: "#060608" }}>{"\u2B21"}</div>
        <div style={{ display: "flex", gap: 4 }}>
          {[0, 1, 2].map(function(i) { return <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: C.amber, opacity: 0.6, animation: "dotWave 1.2s ease-in-out " + (i * 0.15) + "s infinite" }} />; })}
        </div>
      </div>}
    </div>

    {/* Input */}
    <div style={{ position: "relative", zIndex: 2, padding: "14px 16px 16px", borderTop: "1px solid rgba(38,201,216,0.06)" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", background: "linear-gradient(135deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01))", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "5px 5px 5px 16px", transition: "all 0.25s", animation: "inputGlow 4s ease-in-out infinite" }}>
        <input value={input} onChange={function(e: React.ChangeEvent<HTMLInputElement>) { setInput(e.target.value); }} onKeyDown={function(e: React.KeyboardEvent<HTMLInputElement>) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Ask anything..." style={{ flex: 1, padding: "10px 0", background: "transparent", border: "none", color: "#E8E4DD", fontFamily: ft, fontSize: 13, outline: "none" }} />
        <span onClick={send} style={{ padding: "9px 16px", background: input.trim() ? "linear-gradient(135deg, " + C.amber + ", " + C.cyan + ")" : "rgba(255,255,255,0.06)", color: input.trim() ? C.bg : "rgba(255,255,255,0.2)", borderRadius: 8, fontFamily: ft, fontSize: 12, fontWeight: 700, cursor: input.trim() ? "pointer" : "default", transition: "all 0.2s", boxShadow: input.trim() ? "0 4px 14px " + C.cyan + "30, 0 0 20px " + C.amber + "10" : "none" }}>Send</span>
      </div>
    </div>
  </div>;
}

// ═══ CHIPPY SIDEBAR ═══
var CHIP_FACES = ["\u25A0\u203F\u25A0", "\u00B0\u25E1\u00B0", ">\u203F<", "\u00B0o\u00B0", "^\u203F^", "-\u203F-", "\u00D7\u203F\u00D7"];
var CHIP_MOODS = ["happy", "curious", "excited", "sleepy", "focused", "nappy", "vibing"];
var CHIP_MSGS = ["I love semiconductors!", "Did you check NVDA today?", "Ship that content!", "CoWoS capacity is wild.", "3nm is the future.", "Don't forget to post!", "I'm a chip off the old block.", "TSMC earnings soon...", "Need more GPU compute!", "Cache me if you can.", "Fab-ulous day!", "HBM4 is coming!", "Click me more!", "Let's make some slop!"];

function ChippySidebar({ onAsk }: { onAsk: () => void }) {
  var _face = useState<number>(0), face = _face[0], setFace = _face[1];
  var _mood = useState<number>(0), mood = _mood[0], setMood = _mood[1];
  var _msg = useState<string>("Click me!"), msg = _msg[0], setMsg = _msg[1];
  var _bouncing = useState<boolean>(false), bouncing = _bouncing[0], setBouncing = _bouncing[1];
  var _clicks = useState<number>(0), clicks = _clicks[0], setClicks = _clicks[1];

  useEffect(function() {
    var iv = setInterval(function() { setFace(function(f) { return (f + 1) % CHIP_FACES.length; }); }, 3500);
    return function() { clearInterval(iv); };
  }, []);

  var handleClick = function() {
    setBouncing(true);
    setFace(Math.floor(Math.random() * CHIP_FACES.length));
    setMood(Math.floor(Math.random() * CHIP_MOODS.length));
    setMsg(CHIP_MSGS[Math.floor(Math.random() * CHIP_MSGS.length)]);
    setClicks(function(c) { return c + 1; });
    setTimeout(function() { setBouncing(false); }, 500);
  };

  return <div style={{ padding: "12px 14px 0" }}>
    <style dangerouslySetInnerHTML={{ __html: "@keyframes chipBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}@keyframes chipIdle{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}" }} />
    <div style={{ padding: "14px 10px 10px", borderRadius: 12, background: "linear-gradient(135deg, rgba(38,201,216,0.06), rgba(247,176,65,0.04))", border: "1px solid rgba(38,201,216,0.15)", textAlign: "center" }}>
      {/* Chip character - clickable */}
      <div onClick={handleClick} style={{ display: "inline-block", cursor: "pointer", animation: bouncing ? "chipBounce 0.5s ease" : "chipIdle 2s ease-in-out infinite", userSelect: "none" }}>
        <div style={{ width: 80, height: 80, borderRadius: 12, background: "linear-gradient(145deg, #2A2A4A, #1A1A30)", border: "2px solid " + C.amber + "40", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto", boxShadow: "0 0 24px " + C.amber + "15, 0 0 48px " + C.cyan + "08", position: "relative" }}>
          {/* Pins */}
          {[0, 1, 2, 3, 4].map(function(p) { return <div key={"b" + p} style={{ position: "absolute", bottom: -5, left: 8 + p * 14, width: 5, height: 7, background: C.amber + "60", borderRadius: "0 0 2px 2px" }} />; })}
          {[0, 1, 2, 3, 4].map(function(p) { return <div key={"t" + p} style={{ position: "absolute", top: -5, left: 8 + p * 14, width: 5, height: 7, background: C.amber + "60", borderRadius: "2px 2px 0 0" }} />; })}
          {[0, 1, 2].map(function(p) { return <div key={"l" + p} style={{ position: "absolute", left: -5, top: 14 + p * 20, width: 7, height: 5, background: C.cyan + "60", borderRadius: "2px 0 0 2px" }} />; })}
          {[0, 1, 2].map(function(p) { return <div key={"r" + p} style={{ position: "absolute", right: -5, top: 14 + p * 20, width: 7, height: 5, background: C.cyan + "60", borderRadius: "0 2px 2px 0" }} />; })}
          <div style={{ fontFamily: mn, fontSize: 20, color: C.amber, textShadow: "0 0 12px " + C.amber + "60" }}>{CHIP_FACES[face]}</div>
        </div>
      </div>
      {/* Message */}
      <div style={{ fontFamily: ft, fontSize: 11, color: C.tx, marginTop: 8, minHeight: 16 }}>{msg}</div>
      <div style={{ fontFamily: mn, fontSize: 8, color: C.txd, marginTop: 2 }}>Mood: {CHIP_MOODS[mood]} // Clicks: {clicks}</div>
      {/* Ask Chippy button */}
      <div onClick={onAsk} style={{ marginTop: 8, padding: "8px 0", borderRadius: 8, cursor: "pointer", background: "linear-gradient(135deg, " + C.amber + ", " + C.cyan + ")", fontFamily: ft, fontSize: 12, fontWeight: 800, color: "#060608", letterSpacing: 0.5, transition: "all 0.2s" }} onMouseEnter={function(e: React.MouseEvent<HTMLElement>) { e.currentTarget.style.boxShadow = "0 0 16px " + C.amber + "40"; }} onMouseLeave={function(e: React.MouseEvent<HTMLElement>) { e.currentTarget.style.boxShadow = "none"; }}>Ask Chippy</div>
    </div>
  </div>;
}

// ═══ SIDEBAR ═══
var SIDEBAR_CATS: Record<string, SidebarCat> = {
  produce: { label: "PRODUCE", color: C.amber, glow: "rgba(247,176,65,", items: [
    { id: "sloptop", l: "Slop Top", ic: "\uD83D\uDCA5" },
    { id: "carousel", l: "Carousel", ic: "\uD83D\uDCD0" },
    { id: "captions", l: "Capper", ic: "\uD83C\uDFAC" },
    { id: "p2p", l: "Press to Premier", ic: "\uD83C\uDFAC" },
    { id: "broll", l: "B-Roll Library", ic: "\uD83C\uDFA5" },
  ]},
  podcast: { label: "PODCAST", color: C.coral, glow: "rgba(224,99,71,", items: [
    { id: "fk", l: "Fab Knowledge", ic: "\uD83C\uDFA7" },
    { id: "weekly", l: "SA Weekly", ic: "\uD83C\uDF99" },
    { id: "outreach", l: "Outreach", ic: "\uD83D\uDCE4" },
  ]},
  prepare: { label: "PREPARE", color: C.blue, glow: "rgba(11,134,209,", items: [
    { id: "trends", l: "Trends", ic: "\uD83D\uDD25" },
    { id: "ideation", l: "IdeationNation", ic: "\uD83D\uDCA1" },
    { id: "news", l: "News Flow", ic: "\uD83D\uDCE1" },
    { id: "gtc", l: "GTC Flow", ic: "\uD83D\uDCCA" },
  ]},
  premier: { label: "PREMIER", color: C.teal, glow: "rgba(46,173,142,", items: [
    { id: "schedule", l: "Schedule", ic: "\uD83D\uDCC6" },
  ]},
};

function Sidebar({ active, onNav, onAskPoast }: { active: string; onNav: (id: string) => void; onAskPoast: () => void }) {
  var userCtx = useUser();
  var analyst = isAnalyst(userCtx.user);
  // Analysts only see PRODUCE
  var visibleCats = analyst ? ["produce"] : Object.keys(SIDEBAR_CATS);
  // Determine active category
  var activeCat: string | null = null;
  visibleCats.forEach(function(k) { SIDEBAR_CATS[k].items.forEach(function(it: SidebarCatItem) { if (it.id === active) activeCat = k; }); });

  return (<div style={{ width: 240, minHeight: "100vh", background: "linear-gradient(180deg, #08080F 0%, #0A0A14 100%)", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", position: "fixed", left: 0, top: 0, zIndex: 100 }}>
    {/* Logo */}
    <div style={{ padding: "18px 18px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
      <img src="/poast-logo.png" style={{ width: 32, height: 32, borderRadius: 7 }} />
      <div>
        <div style={{ fontFamily: gf, fontSize: 18, fontWeight: 900, color: C.amber, letterSpacing: 2 }}>POAST</div>
        <div style={{ fontFamily: ft, fontSize: 7, fontWeight: 600, color: "rgba(255,255,255,0.25)", letterSpacing: 2, textTransform: "uppercase" }}>Content Command Center</div>
      </div>
    </div>

    {/* Chippy */}
    <ChippySidebar onAsk={onAskPoast} />

    {/* Categories */}
    <div style={{ padding: "8px 10px", flex: 1, overflow: "auto" }}>
      {visibleCats.map(function(catKey) {
        var cat = SIDEBAR_CATS[catKey];
        var isCatActive = activeCat === catKey;
        return <div key={catKey} style={{ marginBottom: 2 }}>
          {/* Category label */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 12px" }}>
            <div style={{ width: 3, height: 14, borderRadius: 2, background: isCatActive ? cat.color : "rgba(255,255,255,0.12)", boxShadow: isCatActive ? "0 0 10px " + cat.color + "60, 0 0 20px " + cat.color + "20" : "none", transition: "all 0.25s" }} />
            <span style={{ fontFamily: ft, fontSize: 10, fontWeight: 800, color: isCatActive ? cat.color : "rgba(255,255,255,0.3)", letterSpacing: 2, textTransform: "uppercase", transition: "all 0.25s", textShadow: isCatActive ? "0 0 16px " + cat.glow + "0.4), 0 0 30px " + cat.glow + "0.12)" : "none" }}>{cat.label}</span>
          </div>
          {/* Items */}
          {cat.items.map(function(item) {
            var isActive = active === item.id;
            return <div key={item.id} onClick={function() { onNav(item.id); }} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 12px 7px 28px", borderRadius: 6, marginBottom: 1, cursor: "pointer", background: isActive ? cat.color + "0C" : "transparent", borderLeft: isActive ? "3px solid " + cat.color : "3px solid transparent", transition: "all 0.2s", position: "relative" }} onMouseEnter={function(e: React.MouseEvent<HTMLElement>) { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }} onMouseLeave={function(e: React.MouseEvent<HTMLElement>) { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
              {isActive && <div style={{ position: "absolute", left: 0, top: "10%", width: 3, height: "80%", background: cat.color, borderRadius: 2, boxShadow: "0 0 12px " + cat.color + "70, 0 0 24px " + cat.color + "25" }} />}
              {isActive && <div style={{ position: "absolute", left: 0, top: 0, width: "50%", height: "100%", background: "radial-gradient(ellipse at left center, " + cat.color + "08, transparent 70%)", pointerEvents: "none" }} />}
              <span style={{ fontSize: 14, filter: isActive ? "brightness(1.3) saturate(1.2)" : "brightness(0.6) saturate(0.6)", transition: "filter 0.2s" }}>{item.ic}</span>
              <span style={{ fontFamily: ft, fontSize: 13, fontWeight: isActive ? 800 : 500, color: isActive ? cat.color : "rgba(255,255,255,0.5)", transition: "all 0.2s", textShadow: isActive ? "0 0 20px " + cat.glow + "0.5), 0 0 40px " + cat.glow + "0.12)" : "none" }}>{item.l}</span>
              {isActive && <div style={{ width: 5, height: 5, borderRadius: "50%", background: cat.color, marginLeft: "auto", boxShadow: "0 0 8px " + cat.color + "70, 0 0 16px " + cat.color + "30" }} />}
            </div>;
          })}
        </div>;
      })}
    </div>

    {/* Footer */}
    <div style={{ padding: "14px 18px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      {userCtx.user && <div onClick={function() { if (confirm("Switch user? Page will reload.")) { userCtx.setUser(null); window.location.reload(); } }} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "6px 8px", borderRadius: 6, cursor: "pointer", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.04)" }} onMouseEnter={function(e: React.MouseEvent<HTMLElement>) { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }} onMouseLeave={function(e: React.MouseEvent<HTMLElement>) { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}>
        <div style={{ width: 22, height: 22, borderRadius: 6, background: analyst ? "#905CCB20" : C.amber + "20", border: "1px solid " + (analyst ? "#905CCB40" : C.amber + "40"), display: "flex", alignItems: "center", justifyContent: "center", fontFamily: ft, fontSize: 10, fontWeight: 800, color: analyst ? "#905CCB" : C.amber }}>{userCtx.user.name[0]}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: ft, fontSize: 11, fontWeight: 700, color: "#E8E4DD", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userCtx.user.name}</div>
          <div style={{ fontFamily: ft, fontSize: 8, fontWeight: 600, color: "rgba(255,255,255,0.35)", letterSpacing: 1 }}>{userCtx.user.role}</div>
        </div>
      </div>}
      <div style={{ fontFamily: ft, fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.12)", letterSpacing: 2 }}>v3.2 // SEMIANALYSIS</div>
    </div>
  </div>);
}

// ═══ CLIP CAPTIONS ═══
var CAPPER_TONES: CapperTone[] = [
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

var CAPPER_AUDIENCES: CapperAudience[] = [
  { key: "meme", label: "Meme-coded", desc: "Internet brain, irony-pilled, chronically online. Think tech twitter memes.", color: "#00FF88" },
  { key: "genz", label: "Gen Z", desc: "Lowercase, no punctuation, absurdist humor, unhinged but smart.", color: "#FF6BFF" },
  { key: "techtwitter", label: "Tech Twitter", desc: "Smart, opinionated, ratio-ready. Mix of insight and shade.", color: "#1DA1F2" },
  { key: "degen", label: "Degen", desc: "Crypto/finance energy. WAGMI, aping in, LFG. Numbers go up.", color: "#FFD700" },
  { key: "corporate", label: "Corporate", desc: "LinkedIn-safe. Thought leadership. Buzzwords. I'm pleased to announce.", color: "#0A66C2" },
  { key: "boomer", label: "Boomer", desc: "Straightforward, no slang, earnest. Your dad explaining semiconductors.", color: "#888888" },
  { key: "unhinged", label: "Unhinged", desc: "Fully deranged takes. Chaos energy. Will get screenshots.", color: "#FF0040" },
];

var SYS_CAPPER = "You are a social media caption writer for SemiAnalysis. You write captions for short-form video clips and memes.\n\nTone descriptions:\n- Dylan: Direct, data-heavy, confident. Uses specific numbers and bold claims. Opens with hooks like 'Here is what nobody is telling you about...' Never hedges.\n- Doug: Technical, first-principles, analytical. Focuses on structural importance and why something matters at a fundamental level. Methodical.\n- SA Twitter: Punchy, provocative, hot-take energy. Short sentences. Bold claims. Data-backed but aggressive framing.\n- Oren: Conversational, storytelling approach. Bridges technical topics to business impact. Accessible but clearly informed.\n\nAudience/vibe descriptions:\n- Meme-coded: Internet brain, irony-pilled, chronically online. Reference meme formats, use internet humor, be self-aware. Think 'this is the way' energy.\n- Gen Z: All lowercase, minimal punctuation, absurdist humor, unhinged but smart. Deadpan delivery. 'no because why is this actually true'\n- Tech Twitter: Smart and opinionated, mix of genuine insight and shade. Ratio-ready. CT/tech twitter native.\n- Degen: Crypto/finance energy. WAGMI, aping in, LFG. Numbers go up. Semi-ironic hype.\n- Corporate: LinkedIn-safe thought leadership. Buzzwords welcome. I'm pleased to announce.\n- Boomer: Straightforward, no slang, earnest and sincere.\n- Unhinged: Fully deranged takes. Chaos energy. Will definitely get screenshotted.\n\nPlatform rules:\n- X: No hashtags ever. Write as hook tweet + reply-to-self format. No links in the main post. Keep punchy.\n- Instagram: Include a 'Save this for later' CTA. Add 5-8 relevant hashtags. Add location 'San Francisco, CA'. Direct to bio link.\n- LinkedIn: Professional framing. End with 'Link in comments.' No hashtags. Longer form is fine.\n- TikTok: All lowercase. 4-6 hashtags. Casual tone. Short.\n- YouTube: Include a separate title line (under 40 characters). Then the description. Include relevant keywords.\n\nRules: Never use em dashes, use commas or periods. Be direct. Match the audience vibe exactly. RESPOND ONLY IN VALID JSON. No markdown fences. No preamble.";

function ClipCaptions() {
  var _content = useState(""), content = _content[0], setContent = _content[1];
  var _platforms = useState(["x"]), platforms = _platforms[0], setPlatforms = _platforms[1];
  var _length = useState("medium"), length = _length[0], setLength = _length[1];
  var _tone = useState("dylan"), tone = _tone[0], setTone = _tone[1];
  var _audience = useState("meme"), audience = _audience[0], setAudience = _audience[1];
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
    var parts = [];
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
        allPromises.push(ask(SYS_CAPPER, buildCapperPrompt(platKey, v)));
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

  var regenerateOne = async function(platKey: string, idx: number) {
    var regenKey = platKey + "_" + idx;
    setRegenL(function(p) { var o = Object.assign({}, p); o[regenKey] = true; return o; });
    var cur = results && results[platKey] && results[platKey][idx];
    var curText = isThread ? (cur && cur.posts ? cur.posts.map(function(p: { number: number; text: string }) { return p.text; }).join(" ") : "") : (cur && cur.caption || "");
    var data = await ask(SYS_CAPPER, buildCapperPrompt(platKey, "Regenerate this caption. Be DIFFERENT from: " + curText));
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

  return (<div>
    <div style={{ fontFamily: ft, fontSize: 20, fontWeight: 800, color: C.tx, marginBottom: 4 }}>Capper</div>
    <div style={{ fontFamily: mn, fontSize: 10, color: C.txm, marginBottom: 24 }}>Clip caption maker. Paste transcript, pick platforms and tone, get 3 variations per platform.</div>

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
        {CAPPER_AUDIENCES.map(function(a) {
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
    {loading && <ProgressBar label={"Generating " + (isThread ? "threads" : "captions") + " for " + platLabels + " (" + toneObj.label + " tone)"} />}

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

// ═══ INTRO: USER SELECT → BOOT → GLITCH → SPLASH ═══
function UserSelect({ onSelect }: { onSelect: (name: string) => void }) {
  var _h = useState<number | null>(null), h = _h[0], sh = _h[1];
  var users: UserInfo[] = [
    { name: "Akash", role: "Director", color: "#0B86D1", glow: "rgba(11,134,209," },
    { name: "Vansh", role: "Social Media Manager", color: "#2EAD8E", glow: "rgba(46,173,142," },
    { name: "Analyst", role: "Analyst", color: "#905CCB", glow: "rgba(144,92,203," },
  ];
  return <div style={{ position: "fixed", inset: 0, background: "#06060C", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 9999, overflow: "hidden" }}>
    <style dangerouslySetInnerHTML={{ __html: "@keyframes ufi{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}@keyframes orbPulse{0%,100%{transform:scale(1);opacity:0.5}50%{transform:scale(1.1);opacity:0.8}}" }} />
    {/* Ambient orb that follows hover */}
    {h !== null && <div style={{ position: "absolute", width: "60vw", height: "60vw", borderRadius: "50%", background: "radial-gradient(circle, " + users[h].glow + "0.08), transparent 50%)", transition: "background 0.5s ease", animation: "orbPulse 3s ease-in-out infinite", pointerEvents: "none" }} />}
    {h === null && <div style={{ position: "absolute", width: "50vw", height: "50vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(247,176,65,0.03), transparent 60%)" }} />}
    <img src="/poast-logo.png" style={{ width: 48, height: 48, borderRadius: 12, marginBottom: 8, animation: "ufi 0.4s ease forwards", opacity: 0 }} />
    <div style={{ fontFamily: ft, fontSize: 16, fontWeight: 900, color: C.amber, letterSpacing: 4, marginBottom: 6, animation: "ufi 0.4s ease 0.05s forwards", opacity: 0 }}>POAST</div>
    <div style={{ fontFamily: ft, fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.2)", letterSpacing: 2, marginBottom: 40, animation: "ufi 0.4s ease 0.1s forwards", opacity: 0 }}>SELECT USER</div>
    <div style={{ display: "flex", gap: 20 }}>
      {users.map(function(user, i) {
        var on = h === i;
        var uc = user.color;
        return <div key={user.name} onClick={function() { onSelect(user.name); }} onMouseEnter={function() { sh(i); }} onMouseLeave={function() { sh(null); }} style={{ width: 160, padding: "28px 20px", borderRadius: 12, cursor: "pointer", background: on ? uc + "08" : "#0A0A14", border: on ? "1px solid " + uc + "50" : "1px solid rgba(255,255,255,0.06)", textAlign: "center", transition: "all 0.2s", boxShadow: on ? "0 0 30px " + uc + "18, 0 0 60px " + uc + "06" : "none", animation: "ufi 0.4s ease " + (0.2 + i * 0.1) + "s forwards", opacity: 0 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: on ? uc + "20" : "#111118", border: "1px solid " + (on ? uc + "40" : "rgba(255,255,255,0.06)"), display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontFamily: ft, fontSize: 20, fontWeight: 900, color: on ? uc : "rgba(255,255,255,0.4)", transition: "all 0.2s", boxShadow: on ? "0 0 16px " + uc + "25" : "none" }}>{user.name[0]}</div>
          <div style={{ fontFamily: ft, fontSize: 16, fontWeight: 700, color: on ? uc : "#E8E4DD", transition: "color 0.2s", textShadow: on ? "0 0 20px " + user.glow + "0.4)" : "none" }}>{user.name}</div>
          <div style={{ fontFamily: ft, fontSize: 9, color: on ? uc + "80" : "rgba(255,255,255,0.2)", marginTop: 4, transition: "color 0.2s" }}>{user.role}</div>
        </div>;
      })}
    </div>
  </div>;
}

function TerminalBoot({ user, onDone }: { user: string | null; onDone: () => void }) {
  var _lines = useState<BootLine[]>([]), lines = _lines[0], setLines = _lines[1];
  var bootLines: BootLine[] = [
    { t: "POAST OS v0.8 // SemiAnalysis", c: "rgba(255,255,255,0.2)" },
    { t: "Auth: " + user, c: "rgba(255,255,255,0.2)" }, { t: "  [OK] identity", c: "#2EAD8E" },
    { t: "Initializing semiconductor intelligence...", c: "rgba(255,255,255,0.2)" },
    { t: "Loading TSMC wafer allocation data...", c: "rgba(255,255,255,0.2)" },
    { t: "  [OK] content-engine", c: "#2EAD8E" }, { t: "  [OK] claude-sonnet-4.brain", c: "#2EAD8E" },
    { t: "Connecting to Jensen's leather jacket...", c: "rgba(255,255,255,0.2)" },
    { t: "  [OK] grok-imagine.gpu", c: "#2EAD8E" }, { t: "  [OK] elevenlabs-voice", c: "#2EAD8E" },
    { t: "Calibrating HBM pricing models...", c: "rgba(255,255,255,0.2)" },
    { t: "Syncing with Fab 18 production schedule...", c: "rgba(255,255,255,0.2)" },
    { t: "  [OK] fab18-sync", c: "#2EAD8E" },
    { t: "Downloading ASML EUV lens alignment...", c: "rgba(255,255,255,0.2)" },
    { t: "Parsing NVIDIA earnings call transcripts...", c: "rgba(255,255,255,0.2)" },
    { t: "  [OK] earnings-parser", c: "#2EAD8E" },
    { t: "Compiling export control compliance matrix...", c: "rgba(255,255,255,0.2)" },
    { t: "Establishing secure channel to Doug's brain...", c: "rgba(255,255,255,0.2)" },
    { t: "  [OK] doug-brain-link", c: "#2EAD8E" },
    { t: "Loading Dylan's Twitter draft folder...", c: "rgba(255,255,255,0.2)" },
    { t: "Indexing 47,000 semiconductor datasheets...", c: "rgba(255,255,255,0.2)" },
    { t: "  [OK] datasheet-index", c: "#2EAD8E" },
    { t: "Warming up Claude's silicon knowledge...", c: "rgba(255,255,255,0.2)" },
    { t: "Checking CoWoS capacity utilization...", c: "rgba(255,255,255,0.2)" },
    { t: "Verifying HBM4 stack height calculations...", c: "rgba(255,255,255,0.2)" },
    { t: "  [OK] hbm4-verify", c: "#2EAD8E" },
    { t: "Decrypting Samsung yield data...", c: "rgba(255,255,255,0.2)" },
    { t: "Mapping global fab construction sites...", c: "rgba(255,255,255,0.2)" },
    { t: "Aggregating analyst sentiment vectors...", c: "rgba(255,255,255,0.2)" },
    { t: "  [OK] sentiment-agg", c: "#2EAD8E" },
    { t: "Rendering amber glow particles...", c: "rgba(255,255,255,0.2)" },
    { t: "  [OK] vibes.essential", c: "#2EAD8E" },
    user === "Vansh" ? { t: "  [ALERT] vansh-just-farted.exe", c: "#E06347" } : { t: "  [WARN] max-charisma-detected", c: C.amber },
    { t: "  [FAIL] sleep-schedule: not found", c: "#E06347" },
    { t: "Booting content command center...", c: "rgba(255,255,255,0.2)" },
    { t: "", c: "rgba(255,255,255,0.2)" }, { t: "POAST systems nominal. Welcome back.", c: C.amber },
  ];
  useEffect(function() {
    var d = 0;
    bootLines.forEach(function(l) { d += 50; setTimeout(function() { setLines(function(p) { return p.concat([l]); }); }, d); });
    setTimeout(onDone, d + 400);
  }, []);
  return <div style={{ position: "fixed", inset: 0, background: "#06060C", zIndex: 9999, padding: "30px 40px", fontFamily: mn, fontSize: 12, lineHeight: 1.9 }}>
    <style dangerouslySetInnerHTML={{ __html: "@keyframes cb{0%,100%{opacity:1}50%{opacity:0}}" }} />
    {lines.map(function(l, i) { return <div key={i} style={{ color: l.c }}>{l.t || "\u00A0"}</div>; })}
    <span style={{ display: "inline-block", width: 7, height: 14, background: C.amber, animation: "cb 0.8s step-end infinite" }} />
  </div>;
}

function GlitchTransition({ onDone }: { onDone: () => void }) {
  useEffect(function() { setTimeout(onDone, 350); }, []);
  return <div style={{ position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "none" }}>
    <style dangerouslySetInnerHTML={{ __html: "@keyframes gShake{0%{transform:translate(0)}25%{transform:translate(-3px,2px)}50%{transform:translate(3px,-2px)}75%{transform:translate(-2px,3px)}100%{transform:translate(0)}}@keyframes gFade{to{opacity:0}}" }} />
    <div style={{ position: "absolute", inset: 0, background: "white", opacity: 0.06, animation: "gFade 0.2s ease forwards" }} />
    <div style={{ position: "absolute", inset: 0, animation: "gShake 0.25s linear" }}>
      {[20, 45, 70, 85].map(function(t, i) { return <div key={i} style={{ position: "absolute", left: 0, right: 0, top: t + "%", height: 2 + Math.random() * 3, background: i % 2 === 0 ? "#ff000030" : "#00ff0030" }} />; })}
    </div>
  </div>;
}

function SplashScreen({ onNavigate }: { onNavigate: (id: string) => void }) {
  var _h = useState<number | null>(null), h = _h[0], sh = _h[1];
  var sections: Record<string, SplashItem[]> = {
    PRODUCE: [{ l: "Slop Top", ic: "\uD83D\uDCA5", id: "sloptop" }, { l: "Carousel", ic: "\uD83D\uDCD0", id: "carousel" }, { l: "Capper", ic: "\uD83C\uDFAC", id: "captions" }, { l: "P2P", ic: "\uD83C\uDFAC", id: "p2p" }, { l: "B-Roll", ic: "\uD83C\uDFA5", id: "broll" }],
    PODCAST: [{ l: "Fab Knowledge", ic: "\uD83C\uDFA7", id: "fk" }, { l: "SA Weekly", ic: "\uD83C\uDF99", id: "weekly" }, { l: "Outreach", ic: "\uD83D\uDCE4", id: "outreach" }],
    PREPARE: [{ l: "Trends", ic: "\uD83D\uDD25", id: "trends" }, { l: "IdeationNation", ic: "\uD83D\uDCA1", id: "ideation" }, { l: "News Flow", ic: "\uD83D\uDCE1", id: "news" }, { l: "GTC Flow", ic: "\uD83D\uDCCA", id: "gtc" }],
    PREMIER: [{ l: "Schedule", ic: "\uD83D\uDCC6", id: "schedule" }],
  };
  var words = ["PRODUCE", "PODCAST", "PREPARE", "PREMIER"];
  var colors = [C.amber, C.coral, C.blue, C.teal];
  var glows = ["rgba(247,176,65,", "rgba(224,99,71,", "rgba(11,134,209,", "rgba(46,173,142,"];
  var appNames: Record<string, string> = { PRODUCE: "Slop Top, Carousel, Capper, P2P, B-Roll", PODCAST: "Fab Knowledge, SA Weekly, Outreach", PREPARE: "Trends, IdeationNation, News Flow, GTC Flow", PREMIER: "Schedule" };

  return <div style={{ position: "fixed", inset: 0, background: "#06060C", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "0 8vw" }}>
    <style dangerouslySetInnerHTML={{ __html: "@keyframes bIn{0%{opacity:0;transform:translateY(20px)}100%{opacity:1;transform:translateY(0)}}@keyframes bLine{0%{transform:scaleX(0)}100%{transform:scaleX(1)}}@keyframes itemReveal{0%{opacity:0;transform:translateY(-8px) scale(0.95)}100%{opacity:1;transform:translateY(0) scale(1)}}" }} />
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 50, animation: "bIn 0.5s ease forwards", opacity: 0 }}>
      <img src="/poast-logo.png" style={{ width: 36, height: 36, borderRadius: 8 }} />
      <span style={{ fontFamily: gf, fontSize: 16, fontWeight: 900, color: C.amber, letterSpacing: 5 }}>POAST</span>
    </div>
    <div style={{ width: "100%", textAlign: "center" }}>
      {words.map(function(w, i) {
        var isH = h === i; var items = sections[w];
        return <div key={i} onMouseEnter={function() { sh(i); }} onMouseLeave={function() { sh(null); }} style={{ animation: "bIn 0.6s ease " + (0.1 + i * 0.15) + "s forwards", opacity: 0, marginBottom: isH ? 8 : 0, transition: "margin 0.25s ease" }}>
          <div style={{ fontFamily: ft, fontSize: "min(12vw, 140px)", fontWeight: 900, color: isH ? colors[i] : "#E8E4DD", letterSpacing: "-0.03em", lineHeight: 0.95, position: "relative", display: "inline-block", cursor: "pointer", transition: "color 0.2s" }}>
            {w}
            <span style={{ position: "absolute", left: -20, top: "50%", transform: "translateY(-50%)", width: 4, height: isH ? "80%" : "60%", background: colors[i], borderRadius: 2, transition: "all 0.2s", boxShadow: isH ? "0 0 12px " + colors[i] + "40" : "none" }} />
          </div>
          <div style={{ fontFamily: ft, fontSize: 9, color: "rgba(255,255,255,0.18)", letterSpacing: 2, marginTop: 4 }}>{appNames[w]}</div>
          <div style={{ overflow: "hidden", maxHeight: isH ? 60 : 0, opacity: isH ? 1 : 0, transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)", marginTop: isH ? 6 : 0 }}>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", padding: "4px 0" }}>
              {items.map(function(item, ii) {
                return <div key={ii} onClick={function() { onNavigate(item.id); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 6, background: "#0A0A14", border: "1px solid " + colors[i] + "25", cursor: "pointer", transition: "all 0.15s", animation: "itemReveal 0.25s ease " + (ii * 0.06) + "s forwards", opacity: 0 }} onMouseEnter={function(e: React.MouseEvent<HTMLElement>) { e.currentTarget.style.background = "#111120"; e.currentTarget.style.borderColor = colors[i] + "50"; e.currentTarget.style.boxShadow = "0 0 12px " + colors[i] + "15"; }} onMouseLeave={function(e: React.MouseEvent<HTMLElement>) { e.currentTarget.style.background = "#0A0A14"; e.currentTarget.style.borderColor = colors[i] + "25"; e.currentTarget.style.boxShadow = "none"; }}>
                  <span style={{ fontSize: 13 }}>{item.ic}</span>
                  <span style={{ fontFamily: ft, fontSize: 12, color: "#E8E4DD", fontWeight: 500 }}>{item.l}</span>
                  <span style={{ fontFamily: ft, fontSize: 8, color: colors[i], marginLeft: 2 }}>&rarr;</span>
                </div>;
              })}
            </div>
          </div>
        </div>;
      })}
    </div>
    <div style={{ width: 60, height: 1, background: "linear-gradient(90deg, transparent, " + C.amber + ", transparent)", margin: "40px auto", animation: "bLine 0.6s ease 0.7s forwards", transform: "scaleX(0)", transformOrigin: "center" }} />
    <div style={{ fontFamily: ft, fontSize: 12, color: "rgba(255,255,255,0.2)", letterSpacing: 3, animation: "bIn 0.4s ease 0.9s forwards", opacity: 0 }}>SEMIANALYSIS // CONTENT COMMAND CENTER</div>
  </div>;
}

function Intro({ onDone }: { onDone: (id?: string) => void }) {
  var _phase = useState<string>("select"), phase = _phase[0], setPhase = _phase[1];
  var _user = useState<string | null>(null), user = _user[0], setUser = _user[1];
  var _glitch = useState(false), glitch = _glitch[0], setGlitch = _glitch[1];
  var userCtx = useUser();

  var handleUserSelect = function(name: string) {
    setUser(name);
    userCtx.setUser(name);
    setPhase("boot");
    try { var audio = new Audio("/splash-sound.mp3"); audio.volume = 0.7; audio.play().catch(function() {}); } catch (e) {}
  };
  var handleBootDone = function() { setGlitch(true); setTimeout(function() { setGlitch(false); setPhase("splash"); }, 350); };
  var handleNavigate = function(id: string) { onDone(id); };

  return <div>
    {phase === "select" && <UserSelect onSelect={handleUserSelect} />}
    {phase === "boot" && <TerminalBoot user={user} onDone={handleBootDone} />}
    {glitch && <GlitchTransition onDone={function() {}} />}
    {phase === "splash" && <SplashScreen onNavigate={handleNavigate} />}
  </div>;
}

// ═══ APP ═══
var ANALYST_ALLOWED = ["sloptop", "carousel", "captions", "p2p", "broll"];

export default function App() {
  var _sp = useState(true), showIntro = _sp[0], setShowIntro = _sp[1];
  var _askPoast = useState(false), askPoastOpen = _askPoast[0], setAskPoastOpen = _askPoast[1];
  var _s = useState("weekly"), sec = _s[0], setSec = _s[1];
  var userCtx = useUser();
  var analyst = isAnalyst(userCtx.user);
  // Analysts: gate navigation to allowed sections only, default to carousel
  useEffect(function() {
    if (analyst && !ANALYST_ALLOWED.includes(sec)) setSec("carousel");
  }, [analyst, sec]);
  // Listen for nav events from other components (e.g. News Flow Draft -> P2P)
  useEffect(function() {
    var handler = function(e: Event) {
      var detail = (e as CustomEvent).detail;
      if (!detail) return;
      if (analyst && !ANALYST_ALLOWED.includes(detail)) return;
      setSec(detail);
    };
    window.addEventListener("poast-nav", handler);
    return function() { window.removeEventListener("poast-nav", handler); };
  }, [analyst]);
  if (showIntro) return <><Intro onDone={function(id) { if (id) setSec(id); setShowIntro(false); }} /></>;

  return (<div style={{ background: C.bg, minHeight: "100vh", position: "relative" }}>
    {/* Background ambient glow orbs */}
    <style dangerouslySetInnerHTML={{ __html: "@keyframes drift1{0%{transform:translate(0,0)}50%{transform:translate(30px,-20px)}100%{transform:translate(0,0)}}@keyframes drift2{0%{transform:translate(0,0)}50%{transform:translate(-25px,15px)}100%{transform:translate(0,0)}}@keyframes drift3{0%{transform:translate(0,0)}50%{transform:translate(20px,25px)}100%{transform:translate(0,0)}}" }} />
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "-10%", right: "-5%", width: "50vw", height: "50vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(247,176,65,0.04) 0%, transparent 60%)", animation: "drift1 20s ease-in-out infinite" }} />
      <div style={{ position: "absolute", bottom: "-15%", left: "10%", width: "60vw", height: "60vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(11,134,209,0.04) 0%, transparent 60%)", animation: "drift2 25s ease-in-out infinite" }} />
      <div style={{ position: "absolute", top: "40%", left: "-10%", width: "40vw", height: "40vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(144,92,203,0.03) 0%, transparent 60%)", animation: "drift3 30s ease-in-out infinite" }} />
      <div style={{ position: "absolute", bottom: "10%", right: "5%", width: "35vw", height: "35vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(46,173,142,0.03) 0%, transparent 60%)", animation: "drift1 22s ease-in-out infinite reverse" }} />
    </div>
    {/* ═══ GLOBAL STYLES ═══ */}
    <style dangerouslySetInnerHTML={{ __html: [
      "@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');",
      "@font-face{font-family:'Grift';src:url('/fonts/Grift-Regular.woff2') format('woff2');font-weight:400;font-style:normal;font-display:swap}",
      "@font-face{font-family:'Grift';src:url('/fonts/Grift-Medium.woff2') format('woff2');font-weight:500;font-style:normal;font-display:swap}",
      "@font-face{font-family:'Grift';src:url('/fonts/Grift-SemiBold.woff2') format('woff2');font-weight:600;font-style:normal;font-display:swap}",
      "@font-face{font-family:'Grift';src:url('/fonts/Grift-Bold.woff2') format('woff2');font-weight:700;font-style:normal;font-display:swap}",
      "@font-face{font-family:'Grift';src:url('/fonts/Grift-ExtraBold.woff2') format('woff2');font-weight:800;font-style:normal;font-display:swap}",
      "@font-face{font-family:'Grift';src:url('/fonts/Grift-Black.woff2') format('woff2');font-weight:900;font-style:normal;font-display:swap}",
      "*{box-sizing:border-box;margin:0;padding:0}",
      "body{background:#06060C}",
      "html{scroll-behavior:smooth}",
      "::selection{background:rgba(247,176,65,0.25);color:#F7B041}",
      "::-webkit-scrollbar{width:6px}",
      "::-webkit-scrollbar-track{background:transparent}",
      "::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:3px}",
      "::-webkit-scrollbar-thumb:hover{background:rgba(247,176,65,0.35)}",
      "input:focus,textarea:focus,select:focus{outline:none;border-color:#F7B041!important;box-shadow:0 0 0 3px rgba(247,176,65,0.1),0 0 16px rgba(247,176,65,0.06)!important}",
      "input::placeholder,textarea::placeholder{color:#4A4858}",
      // Animations
      "@keyframes fadeInUp{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}",
      "@keyframes fadeIn{0%{opacity:0}100%{opacity:1}}",
      "@keyframes slideUp{0%{opacity:0;transform:translateY(20px)}100%{opacity:1;transform:translateY(0)}}",
      // Stagger
      ".stagger>*{opacity:0;animation:slideUp 0.35s ease forwards}",
      ".stagger>*:nth-child(1){animation-delay:0s}.stagger>*:nth-child(2){animation-delay:0.05s}.stagger>*:nth-child(3){animation-delay:0.1s}.stagger>*:nth-child(4){animation-delay:0.15s}.stagger>*:nth-child(5){animation-delay:0.2s}.stagger>*:nth-child(6){animation-delay:0.25s}.stagger>*:nth-child(7){animation-delay:0.3s}.stagger>*:nth-child(8){animation-delay:0.35s}",
      // Cards — lifted, glowing
      ".poast-card{position:relative;background:linear-gradient(135deg,#09090D,#0D0D12);border:1px solid rgba(255,255,255,0.06);border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.4);transition:all 0.2s ease}",
      ".poast-card:hover{border-color:rgba(247,176,65,0.3);box-shadow:0 8px 30px rgba(0,0,0,0.5),0 0 20px rgba(247,176,65,0.08);transform:translateY(-2px)}",
      // Buttons — gradient + glow
      "button,.poast-btn{transition:all 0.15s ease;font-family:'Outfit',sans-serif}",
      "button:active,.poast-btn:active{transform:scale(0.97)}",
      // Primary btn class
      ".btn-glow{background:linear-gradient(135deg,#F7B041,#E8A020);color:#06060C;border:none;border-radius:8px;font-weight:700;box-shadow:0 4px 14px rgba(247,176,65,0.25),0 0 20px rgba(247,176,65,0.1);cursor:pointer}",
      ".btn-glow:hover{box-shadow:0 6px 24px rgba(247,176,65,0.4),0 0 40px rgba(247,176,65,0.15);transform:translateY(-1px)}",
      // Ghost btn class
      ".btn-ghost{background:rgba(255,255,255,0.02);color:#8A8690;border:1px solid rgba(255,255,255,0.06);border-radius:8px;cursor:pointer}",
      ".btn-ghost:hover{border-color:rgba(247,176,65,0.4);color:#F7B041;background:rgba(247,176,65,0.04);box-shadow:0 0 12px rgba(247,176,65,0.08)}",
      // Transitions
      ".poast-fadein{animation:fadeInUp 0.4s ease forwards}",
      ".poast-section{animation:fadeIn 0.3s ease}",
      // Progress
      "@keyframes progressSlide{0%{left:-40%}100%{left:100%}}",
      ".progress-slide{animation:progressSlide 1.5s ease-in-out infinite}",
      "@keyframes dotPulse{0%,80%,100%{opacity:0.2}40%{opacity:1}}",
      ".progress-dots::after{content:'...';display:inline-block;animation:dotPulse 1.4s ease-in-out infinite}",
      // Chippy pulse
      "@keyframes askPulse{0%,100%{box-shadow:0 0 0 0 rgba(38,201,216,0.12)}50%{box-shadow:0 0 16px 4px rgba(38,201,216,0.08), 0 0 8px 2px rgba(247,176,65,0.06)}}",
      ".ask-pulse{animation:askPulse 3s ease-in-out infinite}",
      "@keyframes chipFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}",
      "@keyframes chipBounce{0%{transform:scale(1)}50%{transform:scale(1.1)}100%{transform:scale(1)}}",
      // Background orbs
      "@keyframes od1{0%{transform:translate(0,0) scale(1) rotate(0)}25%{transform:translate(8vw,-6vh) scale(1.2) rotate(5deg)}50%{transform:translate(-4vw,8vh) scale(0.85) rotate(-3deg)}75%{transform:translate(6vw,3vh) scale(1.1) rotate(2deg)}100%{transform:translate(0,0) scale(1) rotate(0)}}",
      "@keyframes od2{0%{transform:translate(0,0) scale(1)}25%{transform:translate(-10vw,5vh) scale(0.9)}50%{transform:translate(5vw,-7vh) scale(1.15)}75%{transform:translate(-3vw,10vh) scale(0.95)}100%{transform:translate(0,0) scale(1)}}",
      "@keyframes od3{0%{transform:translate(0,0) scale(1)}33%{transform:translate(7vw,6vh) scale(1.3)}66%{transform:translate(-8vw,-4vh) scale(0.8)}100%{transform:translate(0,0) scale(1)}}",
      "@keyframes pulse{0%,100%{opacity:0.6}50%{opacity:1}}",
      ".bg-orb{position:absolute;border-radius:50%;filter:blur(100px);will-change:transform;pointer-events:none}",
    ].join("") }} />

    {/* ═══ ANIMATED BACKGROUND (color shifts with category) ═══ */}
    {(function() {
      // Determine active category color
      var catGlow = "rgba(247,176,65,"; // default amber
      var catGlow2 = "rgba(144,92,203,"; // accent
      var produceIds = ["weekly", "p2p", "captions"];
      var prepareIds = ["news", "gtc"];
      var premierIds = ["schedule"];
      if (produceIds.indexOf(sec) >= 0) { catGlow = "rgba(247,176,65,"; catGlow2 = "rgba(224,99,71,"; }
      else if (prepareIds.indexOf(sec) >= 0) { catGlow = "rgba(11,134,209,"; catGlow2 = "rgba(144,92,203,"; }
      else if (premierIds.indexOf(sec) >= 0) { catGlow = "rgba(46,173,142,"; catGlow2 = "rgba(11,134,209,"; }
      return <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: C.bg }} />
        <div className="bg-orb" style={{ width: "55vw", height: "55vw", top: "-15%", right: "-10%", background: "radial-gradient(ellipse, " + catGlow + "0.18) 0%, " + catGlow + "0.06) 35%, transparent 65%)", animation: "od1 22s ease-in-out infinite", borderRadius: "40% 60% 55% 45%", transition: "background 1.5s ease" }} />
        <div className="bg-orb" style={{ width: "45vw", height: "50vw", bottom: "-12%", left: "-5%", background: "radial-gradient(ellipse, " + catGlow + "0.14) 0%, " + catGlow + "0.04) 40%, transparent 65%)", animation: "od2 28s ease-in-out infinite", borderRadius: "55% 45% 50% 50%", transition: "background 1.5s ease" }} />
        <div className="bg-orb" style={{ width: "30vw", height: "35vw", top: "35%", left: "15%", background: "radial-gradient(ellipse, " + catGlow2 + "0.09) 0%, transparent 65%)", animation: "od3 20s ease-in-out infinite", borderRadius: "45% 55% 60% 40%", transition: "background 1.5s ease" }} />
        <div className="bg-orb" style={{ width: "20vw", height: "20vw", top: "15%", right: "25%", background: "radial-gradient(circle, " + catGlow + "0.14) 0%, transparent 55%)", animation: "pulse 4s ease-in-out infinite, od2 14s ease-in-out infinite", filter: "blur(60px)", transition: "background 1.5s ease" }} />
        <div className="bg-orb" style={{ width: "25vw", height: "30vw", bottom: "20%", right: "8%", background: "radial-gradient(ellipse, " + catGlow2 + "0.09) 0%, transparent 60%)", animation: "od1 24s ease-in-out infinite reverse", borderRadius: "60% 40% 45% 55%", transition: "background 1.5s ease" }} />
      </div>;
    })()}

    <Sidebar active={sec} onNav={setSec} onAskPoast={function() { setAskPoastOpen(!askPoastOpen); }} />
    <AskPoast open={askPoastOpen} onToggle={function() { setAskPoastOpen(false); }} />
    <div style={{ marginLeft: 240, position: "relative", zIndex: 1 }} className="poast-fadein">
      <div style={{ margin: "0 auto", padding: "0 32px" }}>
        <div key={sec} className="poast-section" style={{ paddingBottom: 60 }}>
        {sec === "weekly" && <SAWeekly />}
        {sec === "captions" && <ClipCaptions />}
        {sec === "carousel" && <Carousel />}
        {sec === "sloptop" && <SlopTop />}
        {sec === "broll" && <BRollLibrary />}
        {sec === "fk" && <FabricatedKnowledge />}
        {sec === "outreach" && <Outreach />}
        {sec === "trends" && <Trends />}
        {sec === "ideation" && <IdeationNation />}
        {sec === "gtc" && <GTCFlow />}
        {sec === "news" && <NewsFlow />}
        {/* P2P stays mounted but hidden so production doesn't stop */}
        <div style={{ display: sec === "p2p" ? "block" : "none" }}><PressToPremi /></div>
        {sec === "schedule" && <BufferSchedule />}
        </div>
      </div>
    </div>
    <div style={{ position: "fixed", bottom: 8, right: 12, zIndex: 2, fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.12)", letterSpacing: 1, pointerEvents: "none" }}>v2.8</div>
    {/* Mobile warning */}
    <style dangerouslySetInnerHTML={{ __html: "@media(min-width:769px){.mobile-warn{display:none!important}}" }} />
    <div className="mobile-warn" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999, padding: "14px 20px", background: "#111118", borderTop: "1px solid " + C.amber + "30", display: "flex", alignItems: "center", gap: 10 }}>
      <img src="/poast-logo.png" style={{ width: 28, height: 28, borderRadius: 6 }} />
      <div><div style={{ fontFamily: ft, fontSize: 13, fontWeight: 700, color: C.tx }}>POAST works best on desktop</div><div style={{ fontFamily: ft, fontSize: 11, color: "rgba(255,255,255,0.4)" }}>For the full experience, switch to a larger screen.</div></div>
    </div>
  </div>);
}
