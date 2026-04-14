// @ts-nocheck
"use client";
import { useState, useEffect, useRef } from "react";
import GTCFlow from "./gtc-flow";
import NewsFlow from "./news-flow";
import BufferSchedule from "./buffer-schedule";
import PressToPremi from "./press-to-premier";
import Carousel from "./carousel";
import FabricatedKnowledge from "./fabricated-knowledge";
import Trends from "./trends";
import SlopTop from "./slop-top";
import { exportDocx } from "./docx-export";
import Outreach from "./outreach";
import IdeationNation from "./ideation-nation";

var C = {
  amber: "#F7B041", blue: "#0B86D1", teal: "#2EAD8E", coral: "#E06347",
  violet: "#905CCB", cyan: "#26C9D8", crimson: "#D1334A",
  bg: "#06060C", card: "#14141E", border: "#252535", hover: "#181824",
  surface: "#101018", tx: "#E8E4DD", txm: "#9A969F", txd: "#5A5766",
  glow: "0 2px 12px rgba(0,0,0,0.4), 0 0 0 0 rgba(247,176,65,0)",
  glowHover: "0 8px 30px rgba(0,0,0,0.5), 0 0 20px rgba(247,176,65,0.08)",
  cardGrad: "linear-gradient(135deg, #14141E 0%, #101018 100%)",
  surfGrad: "linear-gradient(135deg, #181824 0%, #14141E 100%)",
};
var PL = { x: "#1DA1F2", li: "#0A66C2", fb: "#1877F2", ig: "#E4405F", yt: "#FF0000", tt: "#00F2EA" };
var ft = "'Outfit',sans-serif";
var gf = "'Grift','Outfit',sans-serif";
var mn = "'JetBrains Mono',monospace";

var SYS_EP = "You are a content strategist for SemiAnalysis, a semiconductor and AI infrastructure research firm. Rules: Never use em dashes, use commas or periods. No emojis. Be direct, not clickbait. When mentioning guests in descriptions, include their social handle in parentheses on first mention, e.g. Jordan Nanos (@JordanNanos). RESPOND ONLY IN VALID JSON. No markdown fences. No preamble.";

var SYS_SOC = "You are a social media strategist for SemiAnalysis Weekly. Rules: Never use em dashes. No emojis. No hashtags on X/Twitter ever. YT Shorts titles under 40 chars. Instagram: caption + Save this for later CTA + 5-8 hashtags + location San Francisco CA, point to youtube.com/@SemianalysisWeekly. TikTok: all lowercase 4-6 hashtags. LinkedIn/Facebook: link in first comment, end Link in comments. X: Hook tweet no link + reply-to-self with link. Mention all guests with handles on every platform. RESPOND ONLY IN VALID JSON. No markdown fences. No preamble.";

var _toastSet = { current: null };
var _toastTimer = { current: null };
function showToast(msg) { if (_toastSet.current) _toastSet.current(msg); }

async function ask(sys, prompt) {
  try {
    var r = await fetch("/api/generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: sys, prompt: prompt }),
    });
    var d = await r.json();
    if (d.error) { showToast("API Error: " + (d.error.message || d.error)); return null; }
    if (!d.content) { showToast("API returned empty response. Check your ANTHROPIC_API_KEY in Vercel env vars."); return null; }
    var t = (d.content || []).map(function(c) { return c.text || ""; }).join("");
    try {
      return JSON.parse(t.replace(/```json|```/g, "").trim());
    } catch (pe) { showToast("Failed to parse API response. The model returned invalid JSON."); console.error("Parse error:", t); return null; }
  } catch (e) { showToast("Network error: Could not reach /api/generate"); console.error("API:", e); return null; }
}

function buildPrompt(parts) { return parts.filter(Boolean).join("\n\n"); }

function copyText(str) {
  try { var ta = document.createElement("textarea"); ta.value = str; ta.style.position = "fixed"; ta.style.left = "-9999px"; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); return true; } catch (e) { try { navigator.clipboard.writeText(str); return true; } catch (e2) { return false; } }
}

function gStr(guests) { return guests.filter(function(g) { return g.name; }).map(function(g) { return g.handle ? g.name + " (" + g.handle + ")" : g.name; }).join(", ") || "TBD"; }
function thTxt(th) { if (!th) return ""; if (typeof th === "string") return th; return th.concept + '\nText: "' + th.text_overlay + '"\nMood: ' + th.mood; }

function exportDoc(title, sections) {
  exportDocx(title, sections);
}

// ═══ UI ═══
function Toast() {
  var _s = useState(null), msg = _s[0], setMsg = _s[1];
  _toastSet.current = function(m) { if (_toastTimer.current) clearTimeout(_toastTimer.current); setMsg(m); _toastTimer.current = setTimeout(function() { setMsg(null); }, 6000); };
  if (!msg) return null;
  return <div onClick={function() { setMsg(null); }} style={{ position: "fixed", bottom: 24, right: 24, zIndex: 10000, maxWidth: 420, padding: "14px 20px", background: C.coral + "20", border: "1px solid " + C.coral, borderRadius: 8, fontFamily: mn, fontSize: 11, color: C.coral, cursor: "pointer", boxShadow: "0 0 20px rgba(224,99,71,0.2)", lineHeight: 1.5 }}>{msg}</div>;
}

function ProgressBar({ label }) {
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

function Label({ children }) { return <div style={{ fontFamily: mn, fontSize: 11, color: C.amber, textTransform: "uppercase", letterSpacing: "2px", marginBottom: 8 }}>{children}</div>; }
function Field({ label, value, onChange, placeholder, isMono }) { return (<div style={{ marginBottom: 16 }}>{label && <Label>{label}</Label>}<input value={value} onChange={function(e) { onChange(e.target.value); }} placeholder={placeholder} style={{ width: "100%", padding: "12px 14px", background: "#09090D", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, color: C.tx, fontFamily: isMono ? mn : ft, fontSize: 14, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s ease, box-shadow 0.2s ease" }} onFocus={function(e) { e.target.style.borderColor = C.amber; e.target.style.boxShadow = "0 0 24px rgba(247,176,65,0.06)"; }} onBlur={function(e) { e.target.style.borderColor = "rgba(255,255,255,0.06)"; e.target.style.boxShadow = "none"; }} /></div>); }
function Btn({ children, onClick, loading, sec, sm, off }) { return (<button onClick={onClick} disabled={loading || off} style={{ padding: sm ? "8px 16px" : "12px 28px", background: off ? "#09090D" : sec ? "transparent" : "linear-gradient(135deg, " + C.amber + ", #E8A020)", color: off ? "rgba(255,255,255,0.4)" : sec ? C.amber : "#060608", border: sec ? "1px solid " + (off ? "rgba(255,255,255,0.06)" : C.amber) : "none", borderRadius: 10, fontFamily: ft, fontSize: sm ? 12 : 14, fontWeight: 800, cursor: loading || off ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1, letterSpacing: -0.3, transition: "all 0.2s ease" }}>{loading ? "Working..." : children}</button>); }
function CopyBtn({ text }) { var _s = useState(false), ok = _s[0], set = _s[1]; return <span onClick={function(e) { e.stopPropagation(); set(copyText(text)); setTimeout(function() { set(false); }, 1200); }} style={{ fontFamily: mn, fontSize: 9, color: ok ? C.amber : "rgba(255,255,255,0.4)", cursor: "pointer", padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)", userSelect: "none", transition: "all 0.2s ease" }}>{ok ? "Copied" : "Copy"}</span>; }
function Divider() { return <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", margin: "28px 0" }} />; }

function Pick({ text, picked, onPick, onRedo, rLoading }) {
  return (<div className="poast-card" onClick={onPick} style={{ background: picked ? "linear-gradient(135deg, " + C.amber + "0A 0%, " + C.amber + "05 100%)" : "#0D0D12", border: "1px solid " + (picked ? C.amber + "60" : "rgba(255,255,255,0.06)"), borderRadius: 12, padding: "16px 20px", marginBottom: 8, cursor: "pointer", boxShadow: picked ? "0 0 24px rgba(247,176,65,0.06)" : "none", transition: "all 0.2s ease" }}>
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, marginTop: 2, border: "2px solid " + (picked ? C.amber : "rgba(255,255,255,0.12)"), background: picked ? C.amber : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease" }}>{picked && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#060608" }} />}</div>
      <div style={{ flex: 1, fontFamily: ft, fontSize: 14, color: picked ? "#ffffff" : "rgba(255,255,255,0.55)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{text}</div>
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        <CopyBtn text={text} />
        {onRedo && <span onClick={function(e) { e.stopPropagation(); if (!rLoading) onRedo(); }} style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.4)", cursor: rLoading ? "wait" : "pointer", padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)", opacity: rLoading ? 0.4 : 1, userSelect: "none", transition: "all 0.2s ease" }}>&#x21bb;</span>}
      </div>
    </div>
  </div>);
}

function SecHead({ label, onRedoAll, rL }) {
  return (<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
    <div style={{ fontFamily: mn, fontSize: 11, color: C.amber, textTransform: "uppercase", letterSpacing: "2px", fontWeight: 700 }}>{label}</div>
    {onRedoAll && <span onClick={function() { if (!rL) onRedoAll(); }} style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.4)", cursor: rL ? "wait" : "pointer", padding: "4px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", opacity: rL ? 0.4 : 1, transition: "all 0.2s ease" }}>&#x21bb; Redo All 3</span>}
  </div>);
}

function OutCard({ title, content, color, onRedo, rLoading }) {
  return (<div className="poast-card" style={{ background: "#0D0D12", border: "1px solid rgba(255,255,255,0.06)", borderLeft: "3px solid " + (color || C.amber), borderRadius: 12, padding: "16px 20px", marginBottom: 10, boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
      <div style={{ fontFamily: mn, fontSize: 11, color: color || C.amber, textTransform: "uppercase", letterSpacing: "2px" }}>{title}</div>
      <div style={{ display: "flex", gap: 5 }}>
        <CopyBtn text={content} />
        {onRedo && <span onClick={function() { if (!rLoading) onRedo(); }} style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.4)", cursor: rLoading ? "wait" : "pointer", padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)", opacity: rLoading ? 0.4 : 1, userSelect: "none", transition: "all 0.2s ease" }}>&#x21bb;</span>}
      </div>
    </div>
    <div style={{ fontFamily: ft, fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{content}</div>
  </div>);
}

// ═══ BUFFER SIDEBAR SECTION ═══
function BufferPanel() {
  var _data = useState(null), data = _data[0], setData = _data[1];
  var _loading = useState(true), loading = _loading[0], setLoading = _loading[1];
  var _expanded = useState(false), expanded = _expanded[0], setExpanded = _expanded[1];

  useEffect(function() {
    fetch("/api/buffer").then(function(r) { return r.json(); }).then(function(d) {
      if (d.channels) setData(d);
      setLoading(false);
    }).catch(function() { setLoading(false); });
  }, []);

  var platformColor = { twitter: "#1DA1F2", facebook: "#1877F2", linkedin: "#0A66C2", instagram: "#E4405F" };
  var platformIcon = { twitter: "\uD83D\uDC26", facebook: "\uD83D\uDCD8", linkedin: "\uD83D\uDCBC", instagram: "\uD83D\uDCF7" };

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

// ═══ ASK POAST ═══
var POAST_SYS = "You are Poast, the AI assistant for SemiAnalysis. You help with content creation, social media strategy, semiconductor industry analysis, and media operations.\n\nBrand rules: Never use em dashes. No emojis in content. No hashtags on X/Twitter. Direct, informed, casual tone.\n\nYou can help with:\n- Writing social posts, threads, captions for any platform\n- Generating video scripts, episode descriptions, titles\n- Brainstorming content ideas and angles\n- Drafting documents, outreach emails, pitches\n- Semiconductor industry analysis and talking points\n- Scheduling strategy and content calendar planning\n- Repurposing content across formats\n\nPlatform rules:\n- X: Hook tweet no link, reply-to-self with link. No hashtags ever.\n- LinkedIn/Facebook: Link in first comment, end with 'Link in comments.'\n- Instagram: Caption + 'Save this for later.' CTA + 5-8 hashtags + San Francisco CA location\n- TikTok: All lowercase, 4-6 hashtags\n- YouTube Shorts: Titles under 40 chars\n\nChannel: youtube.com/@SemianalysisWeekly\n\nWhen asked to create a document, format it clearly with headers and sections. When giving ideas, provide 3-5 options. Be concise but thorough.";

function AskPoast({ open, onToggle }) {
  var _msgs = useState([]), msgs = _msgs[0], setMsgs = _msgs[1];
  var _input = useState(""), input = _input[0], setInput = _input[1];
  var _loading = useState(false), loading = _loading[0], setLoading = _loading[1];
  var _ready = useState(false), ready = _ready[0], setReady = _ready[1];
  var scrollRef = useRef(null);
  var SUGGESTIONS = ["Write an X thread about NVIDIA earnings", "Draft a LinkedIn post for our latest episode", "5 content ideas about AI infrastructure", "Create an outreach email for podcast guests"];

  useEffect(function() { if (open) setTimeout(function() { setReady(true); }, 50); else setReady(false); }, [open]);
  useEffect(function() { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [msgs]);

  var send = async function() {
    if (!input.trim() || loading) return;
    var userMsg = input.trim(); setInput("");
    setMsgs(function(p) { return p.concat([{ role: "user", text: userMsg }]); });
    setLoading(true);
    try {
      var history = msgs.concat([{ role: "user", text: userMsg }]);
      var prompt = history.map(function(m) { return (m.role === "user" ? "User: " : "Poast: ") + m.text; }).join("\n\n");
      var r = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system: POAST_SYS, prompt: prompt }) });
      var d = await r.json();
      setMsgs(function(p) { return p.concat([{ role: "assistant", text: (d.content || []).map(function(c) { return c.text || ""; }).join("") }]); });
    } catch (e) { setMsgs(function(p) { return p.concat([{ role: "assistant", text: "Something went wrong. Try again." }]); }); }
    setLoading(false);
  };

  if (!open) return null;

  return <div style={{ position: "fixed", bottom: 24, right: 24, width: 460, height: 600, zIndex: 9998, borderRadius: 20, display: "flex", flexDirection: "column", transform: ready ? "translateY(0) scale(1)" : "translateY(30px) scale(0.92)", opacity: ready ? 1 : 0, transition: "all 0.45s cubic-bezier(0.16, 1, 0.3, 1)", overflow: "hidden" }}>
    <style dangerouslySetInnerHTML={{ __html: "@keyframes orbFloat{0%{transform:translate(0,0) scale(1)}50%{transform:translate(10px,-10px) scale(1.15)}100%{transform:translate(0,0) scale(1)}}@keyframes dotWave{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}@keyframes msgSlide{0%{opacity:0;transform:translateY(10px) scale(0.98)}100%{opacity:1;transform:translateY(0) scale(1)}}@keyframes borderGlow{0%,100%{border-color:rgba(247,176,65,0.15)}50%{border-color:rgba(247,176,65,0.3)}}@keyframes logoPulse{0%,100%{box-shadow:0 0 16px rgba(247,176,65,0.15)}50%{box-shadow:0 0 28px rgba(247,176,65,0.25),0 0 48px rgba(247,176,65,0.08)}}@keyframes inputGlow{0%,100%{box-shadow:0 0 0 0 rgba(247,176,65,0)}50%{box-shadow:0 0 12px rgba(247,176,65,0.06)}}@keyframes suggIn{0%{opacity:0;transform:translateY(6px)}100%{opacity:1;transform:translateY(0)}}" }} />

    {/* Outer glow */}
    <div style={{ position: "absolute", inset: -1, borderRadius: 21, background: "linear-gradient(135deg, " + C.amber + "20, transparent 40%, " + C.amber + "10)", zIndex: 0, animation: "borderGlow 4s ease-in-out infinite" }} />
    {/* Glass body */}
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, rgba(12,12,22,0.95), rgba(8,8,14,0.97), rgba(10,10,18,0.96))", backdropFilter: "blur(30px)", WebkitBackdropFilter: "blur(30px)", borderRadius: 20, boxShadow: "0 0 50px rgba(247,176,65,0.06), 0 24px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03)", zIndex: 1 }} />
    {/* Inner orbs */}
    <div style={{ position: "absolute", top: -30, right: -30, width: 140, height: 140, borderRadius: "50%", background: "radial-gradient(circle, " + C.amber + "12, transparent 70%)", filter: "blur(30px)", animation: "orbFloat 8s ease-in-out infinite", zIndex: 1, pointerEvents: "none" }} />
    <div style={{ position: "absolute", bottom: 40, left: -20, width: 100, height: 100, borderRadius: "50%", background: "radial-gradient(circle, rgba(11,134,209,0.08), transparent 70%)", filter: "blur(25px)", animation: "orbFloat 10s ease-in-out infinite reverse", zIndex: 1, pointerEvents: "none" }} />

    {/* Header */}
    <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid rgba(247,176,65,0.08)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, " + C.amber + "30, " + C.amber + "10)", border: "1px solid " + C.amber + "30", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: ft, fontSize: 16, fontWeight: 900, color: C.amber, animation: "logoPulse 3s ease-in-out infinite" }}>P</div>
        <div>
          <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: "#E8E4DD" }}>Poast</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 5, height: 5, borderRadius: "50%", background: C.teal, boxShadow: "0 0 6px " + C.teal + "60" }} /><span style={{ fontFamily: mn, fontSize: 8, color: "rgba(255,255,255,0.4)" }}>online // sonnet-4</span></div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 5 }}>
        {msgs.length > 0 && <span onClick={function() { var c = msgs.map(function(m) { return (m.role === "user" ? "YOU:\n" : "POAST:\n") + m.text; }).join("\n\n---\n\n"); var b = new Blob([c], { type: "text/plain" }); var u = URL.createObjectURL(b); var a = document.createElement("a"); a.href = u; a.download = "poast.txt"; a.click(); URL.revokeObjectURL(u); }} style={{ fontFamily: mn, fontSize: 8, color: "rgba(255,255,255,0.4)", padding: "4px 8px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer" }}>Export</span>}
        {msgs.length > 0 && <span onClick={function() { setMsgs([]); }} style={{ fontFamily: mn, fontSize: 8, color: "rgba(255,255,255,0.4)", padding: "4px 8px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer" }}>Clear</span>}
        <span onClick={onToggle} style={{ fontFamily: mn, fontSize: 16, color: "rgba(255,255,255,0.2)", cursor: "pointer", padding: "2px 6px" }}>&times;</span>
      </div>
    </div>

    {/* Messages */}
    <div ref={scrollRef} style={{ position: "relative", zIndex: 2, flex: 1, overflow: "auto", padding: "18px 20px" }}>
      {msgs.length === 0 && <div style={{ textAlign: "center", padding: "40px 16px" }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: "linear-gradient(135deg, " + C.amber + "22, " + C.amber + "0A)", border: "1px solid " + C.amber + "20", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontFamily: ft, fontSize: 24, fontWeight: 900, color: C.amber, animation: "logoPulse 3s ease-in-out infinite" }}>P</div>
        <div style={{ fontFamily: ft, fontSize: 16, fontWeight: 700, color: "#E8E4DD", marginBottom: 6 }}>How can I help?</div>
        <div style={{ fontFamily: ft, fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 22, lineHeight: 1.6 }}>SA brand rules, platform formats, content drafts, ideas, and more.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {SUGGESTIONS.map(function(s, i) {
            return <span key={i} onClick={function() { setInput(s); }} style={{ fontFamily: ft, fontSize: 11, color: "rgba(255,255,255,0.45)", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", textAlign: "left", transition: "all 0.2s", animation: "suggIn 0.3s ease " + (i * 0.08) + "s forwards", opacity: 0 }} onMouseEnter={function(e) { e.currentTarget.style.borderColor = C.amber + "30"; e.currentTarget.style.color = "#E8E4DD"; e.currentTarget.style.background = C.amber + "06"; }} onMouseLeave={function(e) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.45)"; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}>{s}</span>;
          })}
        </div>
      </div>}
      {msgs.map(function(m, i) {
        var isUser = m.role === "user";
        return <div key={i} style={{ marginBottom: 16, display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", animation: "msgSlide 0.3s ease" }}>
          {!isUser && <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
            <div style={{ width: 20, height: 20, borderRadius: 6, background: C.amber + "18", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: ft, fontSize: 9, fontWeight: 900, color: C.amber }}>P</div>
            <span style={{ fontFamily: mn, fontSize: 8, color: "rgba(255,255,255,0.2)" }}>Poast</span>
          </div>}
          <div style={{ maxWidth: "88%", padding: "12px 16px", borderRadius: isUser ? "16px 16px 4px 16px" : "4px 16px 16px 16px", background: isUser ? "linear-gradient(135deg, " + C.amber + "15, " + C.amber + "08)" : "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))", border: "1px solid " + (isUser ? C.amber + "20" : "rgba(255,255,255,0.06)"), boxShadow: isUser ? "0 2px 12px " + C.amber + "08" : "0 2px 8px rgba(0,0,0,0.2)" }}>
            <div style={{ fontFamily: ft, fontSize: 13, color: "#E8E4DD", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{m.text}</div>
          </div>
          {!isUser && <div style={{ display: "flex", gap: 4, marginTop: 6, marginLeft: 26 }}>
            <span onClick={function() { navigator.clipboard.writeText(m.text); }} style={{ fontFamily: mn, fontSize: 8, color: "rgba(255,255,255,0.2)", padding: "3px 7px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", transition: "all 0.15s" }} onMouseEnter={function(e) { e.currentTarget.style.color = C.amber; e.currentTarget.style.borderColor = C.amber + "25"; }} onMouseLeave={function(e) { e.currentTarget.style.color = "rgba(255,255,255,0.2)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}>Copy</span>
            <span onClick={function() { setInput("Regenerate the above but different"); }} style={{ fontFamily: mn, fontSize: 8, color: "rgba(255,255,255,0.2)", padding: "3px 7px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", transition: "all 0.15s" }} onMouseEnter={function(e) { e.currentTarget.style.color = C.amber; e.currentTarget.style.borderColor = C.amber + "25"; }} onMouseLeave={function(e) { e.currentTarget.style.color = "rgba(255,255,255,0.2)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}>Regenerate</span>
          </div>}
        </div>;
      })}
      {loading && <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 0" }}>
        <div style={{ width: 20, height: 20, borderRadius: 6, background: C.amber + "18", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: ft, fontSize: 9, fontWeight: 900, color: C.amber }}>P</div>
        <div style={{ display: "flex", gap: 4 }}>
          {[0, 1, 2].map(function(i) { return <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: C.amber, opacity: 0.6, animation: "dotWave 1.2s ease-in-out " + (i * 0.15) + "s infinite" }} />; })}
        </div>
      </div>}
    </div>

    {/* Input */}
    <div style={{ position: "relative", zIndex: 2, padding: "14px 16px 16px", borderTop: "1px solid rgba(247,176,65,0.06)" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", background: "linear-gradient(135deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01))", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "5px 5px 5px 16px", transition: "all 0.25s", animation: "inputGlow 4s ease-in-out infinite" }}>
        <input value={input} onChange={function(e) { setInput(e.target.value); }} onKeyDown={function(e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Ask anything..." style={{ flex: 1, padding: "10px 0", background: "transparent", border: "none", color: "#E8E4DD", fontFamily: ft, fontSize: 13, outline: "none" }} />
        <span onClick={send} style={{ padding: "9px 16px", background: input.trim() ? "linear-gradient(135deg, " + C.amber + ", #E8A020)" : "rgba(255,255,255,0.06)", color: input.trim() ? C.bg : "rgba(255,255,255,0.2)", borderRadius: 8, fontFamily: ft, fontSize: 12, fontWeight: 700, cursor: input.trim() ? "pointer" : "default", transition: "all 0.2s", boxShadow: input.trim() ? "0 4px 14px " + C.amber + "30, 0 0 20px " + C.amber + "10" : "none" }}>Send</span>
      </div>
    </div>
  </div>;
}

// ═══ SIDEBAR ═══
// ═══ SIDEBAR CATEGORIES ═══
var SIDEBAR_CATS = {
  produce: { label: "PRODUCE", color: C.amber, glow: "rgba(247,176,65,", items: [
    { id: "sloptop", l: "Slop Top", ic: "\uD83D\uDCA5" },
    { id: "carousel", l: "Carousel", ic: "\uD83D\uDCD0" },
    { id: "captions", l: "Capper", ic: "\uD83C\uDFAC" },
    { id: "p2p", l: "Press to Premier", ic: "\uD83C\uDFAC" },
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

function Sidebar({ active, onNav, onAskPoast }) {
  // Determine active category
  var activeCat = null;
  Object.keys(SIDEBAR_CATS).forEach(function(k) { SIDEBAR_CATS[k].items.forEach(function(it) { if (it.id === active) activeCat = k; }); });

  return (<div style={{ width: 240, minHeight: "100vh", background: "linear-gradient(180deg, #08080F 0%, #0A0A14 100%)", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", position: "fixed", left: 0, top: 0, zIndex: 100 }}>
    {/* Logo */}
    <div style={{ padding: "18px 18px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
      <img src="/poast-logo.png" style={{ width: 32, height: 32, borderRadius: 7 }} />
      <div>
        <div style={{ fontFamily: gf, fontSize: 18, fontWeight: 900, color: C.amber, letterSpacing: 2 }}>POAST</div>
        <div style={{ fontFamily: ft, fontSize: 7, fontWeight: 600, color: "rgba(255,255,255,0.25)", letterSpacing: 2, textTransform: "uppercase" }}>Content Command Center</div>
      </div>
    </div>

    {/* Ask Poast */}
    <div style={{ padding: "10px 12px 0" }}>
      <div className="ask-pulse" onClick={onAskPoast} style={{ padding: "10px 12px", borderRadius: 8, cursor: "pointer", background: "linear-gradient(135deg, " + C.amber + "15, " + C.amber + "06)", border: "1px solid " + C.amber + "25", display: "flex", alignItems: "center", gap: 9, transition: "all 0.2s" }} onMouseEnter={function(e) { e.currentTarget.style.boxShadow = "0 0 20px " + C.amber + "18"; e.currentTarget.style.borderColor = C.amber + "50"; }} onMouseLeave={function(e) { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = C.amber + "25"; }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, " + C.amber + "25, " + C.amber + "10)", border: "1px solid " + C.amber + "30", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: ft, fontSize: 14, fontWeight: 900, color: C.amber, boxShadow: "0 0 14px " + C.amber + "15" }}>P</div>
        <div>
          <div style={{ fontFamily: ft, fontSize: 13, fontWeight: 700, color: C.amber }}>Ask Poast</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 4, height: 4, borderRadius: "50%", background: C.teal, boxShadow: "0 0 6px " + C.teal + "60" }} /><span style={{ fontFamily: ft, fontSize: 8, color: "rgba(255,255,255,0.4)" }}>online</span></div>
        </div>
      </div>
    </div>

    {/* Categories */}
    <div style={{ padding: "8px 10px", flex: 1, overflow: "auto" }}>
      {Object.keys(SIDEBAR_CATS).map(function(catKey) {
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
            return <div key={item.id} onClick={function() { onNav(item.id); }} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 12px 7px 28px", borderRadius: 6, marginBottom: 1, cursor: "pointer", background: isActive ? cat.color + "0C" : "transparent", borderLeft: isActive ? "3px solid " + cat.color : "3px solid transparent", transition: "all 0.2s", position: "relative" }} onMouseEnter={function(e) { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }} onMouseLeave={function(e) { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
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
      <div style={{ fontFamily: ft, fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.12)", letterSpacing: 2 }}>v2.0 // SEMIANALYSIS</div>
    </div>
  </div>);
}

function TabBar({ items, active, onPick, locks }) {
  return (<div style={{ display: "flex", gap: 4, borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 28, paddingBottom: 0, background: "transparent", flexWrap: "wrap" }}>
    {items.map(function(t) { var s = active === t.id, lk = locks && locks.indexOf(t.id) >= 0; return (<div key={t.id} onClick={function() { if (!lk) onPick(t.id); }} style={{ padding: "14px 22px", cursor: lk ? "not-allowed" : "pointer", fontFamily: ft, fontSize: 13, fontWeight: s ? 800 : 500, color: lk ? "rgba(255,255,255,0.12)" : s ? C.amber : "rgba(255,255,255,0.55)", borderBottom: s ? "2px solid " + C.amber : "2px solid transparent", opacity: lk ? 0.35 : 1, display: "flex", alignItems: "center", gap: 6, letterSpacing: s ? -0.3 : 0, transition: "all 0.2s ease", position: "relative" }}>{t.l}{lk && <span style={{ fontFamily: mn, fontSize: 7, background: "#09090D", padding: "2px 6px", borderRadius: 4, color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.06)" }}>locked</span>}</div>); })}
  </div>);
}

function GuestManager({ guests, setGuests }) {
  return (<div style={{ marginBottom: 20 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}><Label>Guests</Label><span onClick={function() { setGuests(guests.concat([{ name: "", handle: "" }])); }} style={{ fontFamily: mn, fontSize: 10, color: C.amber, cursor: "pointer", padding: "4px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", transition: "all 0.2s ease" }}>+ Add</span></div>
    {guests.length === 0 && <div onClick={function() { setGuests([{ name: "", handle: "" }]); }} style={{ background: "#09090D", border: "1px dashed rgba(255,255,255,0.06)", borderRadius: 10, padding: "16px", cursor: "pointer", textAlign: "center", fontFamily: ft, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Click to add guests</div>}
    {guests.map(function(g, i) { return (<div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
      <input value={g.name} onChange={function(e) { var c = guests.slice(); c[i] = { name: e.target.value, handle: g.handle }; setGuests(c); }} placeholder="Name" style={{ flex: 1, padding: "10px 12px", background: "#09090D", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, color: C.tx, fontFamily: ft, fontSize: 14, outline: "none", transition: "border-color 0.2s ease" }} onFocus={function(e) { e.target.style.borderColor = C.amber; }} onBlur={function(e) { e.target.style.borderColor = "rgba(255,255,255,0.06)"; }} />
      <input value={g.handle} onChange={function(e) { var c = guests.slice(); c[i] = { name: g.name, handle: e.target.value }; setGuests(c); }} placeholder="@handle" style={{ flex: 1, padding: "10px 12px", background: "#09090D", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, color: C.tx, fontFamily: mn, fontSize: 13, outline: "none", transition: "border-color 0.2s ease" }} onFocus={function(e) { e.target.style.borderColor = C.amber; }} onBlur={function(e) { e.target.style.borderColor = "rgba(255,255,255,0.06)"; }} />
      <span onClick={function() { setGuests(guests.filter(function(_, j) { return j !== i; })); }} style={{ fontFamily: mn, fontSize: 11, color: "rgba(255,255,255,0.4)", cursor: "pointer", padding: "4px 8px" }}>x</span>
    </div>); })}
  </div>);
}

function KeywordBar({ onSuggest, loading }) {
  var _s = useState(""), kw = _s[0], setKw = _s[1];
  return (<div style={{ display: "flex", gap: 8, marginTop: 10, marginBottom: 14 }}>
    <input value={kw} onChange={function(e) { setKw(e.target.value); }} placeholder="Keywords to refine titles (e.g. TSMC, GPU shortage)" onKeyDown={function(e) { if (e.key === "Enter" && kw.trim()) { onSuggest(kw.trim()); setKw(""); } }} style={{ flex: 1, padding: "10px 14px", background: "#09090D", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, color: C.tx, fontFamily: mn, fontSize: 12, outline: "none", transition: "border-color 0.2s ease" }} onFocus={function(e) { e.target.style.borderColor = C.amber; }} onBlur={function(e) { e.target.style.borderColor = "rgba(255,255,255,0.06)"; }} />
    <Btn sm onClick={function() { if (kw.trim()) { onSuggest(kw.trim()); setKw(""); } }} loading={loading} off={!kw.trim()}>Suggest</Btn>
  </div>);
}

// ═══ EPISODE SETUP ═══
function EpisodeSetup({ ep, setEp, guests, setGuests, opts, setOpts, sel, setSel, fin, setFin, goTest }) {
  var _l = useState(false), loading = _l[0], setLoading = _l[1];
  var _r = useState({}), rL = _r[0], setRL = _r[1];
  var _k = useState(false), kwL = _k[0], setKwL = _k[1];
  var _dl = useState("medium"), descLen = _dl[0], setDescLen = _dl[1];

  var descInstr = function() {
    if (descLen === "short") return "Descriptions: concise, 2-4 sentences. Key topics only.";
    if (descLen === "long") return "Descriptions: LONG (3-5 paragraphs, 200-400 words). All key topics, guest credentials with handles, why it matters, subscribe CTA. SEO keywords. Include timestamps at the end if provided.";
    return "Descriptions: medium (2 solid paragraphs). Main topics, guest names with handles on first mention, subscribe CTA. SEO keywords. Include timestamps at the end if provided.";
  };

  var genAll = async function() {
    if (!ep.transcript) return;
    setLoading(true); setOpts(null); setSel({ title: 0, desc: 0, thumb: 0 }); setFin(null);
    var gs = gStr(guests); var tx = ep.transcript.slice(0, 8000);
    var p = buildPrompt(["Generate content for SemiAnalysis Weekly Episode #" + ep.number + ".", "Guests with handles: " + gs, ep.extra ? "Additional context: " + ep.extra : "", ep.timestamps ? "Timestamps to include at end of descriptions:\n" + ep.timestamps : "", "Transcript (first 8000 chars): " + tx, descInstr(), 'Return JSON: {"titles":["t1","t2","t3"],"descriptions":["d1","d2","d3"],"thumbnails":[{"concept":"c1","text_overlay":"to1","mood":"m1"},{"concept":"c2","text_overlay":"to2","mood":"m2"},{"concept":"c3","text_overlay":"to3","mood":"m3"}]}']);
    var data = await ask(SYS_EP, p);
    if (data) setOpts(data);
    setLoading(false);
  };

  var suggestKW = async function(keywords) {
    setKwL(true);
    var existing = (opts && opts.titles || []).join(" | ");
    var data = await ask(SYS_EP, buildPrompt(["Generate 3 NEW titles for SemiAnalysis Weekly Ep #" + ep.number + ".", "Keywords: " + keywords, "Guests: " + gStr(guests), "Different from: " + existing, "Transcript: " + (ep.transcript || "").slice(0, 4000), 'Return JSON: {"titles":["t1","t2","t3"]}']));
    if (data && data.titles) { setOpts(function(prev) { return Object.assign({}, prev, { titles: data.titles }); }); setSel(function(prev) { return Object.assign({}, prev, { title: 0 }); }); }
    setKwL(false);
  };

  var redoOne = async function(cat, idx) {
    var k = cat + "-" + idx; setRL(function(p) { var o = Object.assign({}, p); o[k] = true; return o; });
    var cur = opts[cat][idx]; var curStr = typeof cur === "string" ? cur : cur.concept;
    var gs = gStr(guests); var tx = (ep.transcript || "").slice(0, 3000); var p2, parse;
    if (cat === "thumbnails") { p2 = buildPrompt(["ONE new thumbnail for SA Weekly Ep #" + ep.number + ". Different from: " + curStr, "Guests: " + gs, "Transcript: " + tx, 'Return JSON: {"concept":"...","text_overlay":"...","mood":"..."}']); parse = function(d) { return d; };
    } else { var dn = cat === "descriptions" ? " " + descInstr() : ""; var en = cat === "descriptions" && ep.extra ? " Context: " + ep.extra : ""; var tsn = cat === "descriptions" && ep.timestamps ? " Timestamps:\n" + ep.timestamps : ""; p2 = buildPrompt(["ONE new " + (cat === "titles" ? "title" : "description") + " for SA Weekly Ep #" + ep.number + ". Different from: " + curStr + "." + dn, "Guests: " + gs + en + tsn, "Transcript: " + tx, 'Return JSON: {"result":"..."}']); parse = function(d) { return d.result; }; }
    var data = await ask(SYS_EP, p2);
    if (data) { setOpts(function(prev) { var c2 = Object.assign({}, prev); c2[cat] = prev[cat].slice(); c2[cat][idx] = parse(data); return c2; }); }
    setRL(function(p) { var o = Object.assign({}, p); o[k] = false; return o; });
  };

  var redoCat = async function(cat) {
    var k = "all-" + cat; setRL(function(p) { var o = Object.assign({}, p); o[k] = true; return o; });
    var gs = gStr(guests); var tx = (ep.transcript || "").slice(0, 4000); var p2;
    if (cat === "thumbnails") { p2 = buildPrompt(["3 NEW thumbnails for SA Weekly Ep #" + ep.number, "Guests: " + gs, "Transcript: " + tx, 'Return JSON: {"thumbnails":[{"concept":"c","text_overlay":"t","mood":"m"},{"concept":"c","text_overlay":"t","mood":"m"},{"concept":"c","text_overlay":"t","mood":"m"}]}']);
    } else { var dn = cat === "descriptions" ? ". " + descInstr() : ""; var en = cat === "descriptions" && ep.extra ? ". Context: " + ep.extra : ""; var tsn = cat === "descriptions" && ep.timestamps ? ". Timestamps:\n" + ep.timestamps : ""; p2 = buildPrompt(["3 NEW " + cat + " for SA Weekly Ep #" + ep.number + dn, "Guests: " + gs + en + tsn, "Transcript: " + tx, 'Return JSON: {"' + cat + '":["a","b","c"]}']); }
    var data = await ask(SYS_EP, p2);
    if (data && data[cat]) { setOpts(function(prev) { return Object.assign({}, prev, (function() { var o = {}; o[cat] = data[cat]; return o; })()); }); var sk = cat === "titles" ? "title" : cat === "descriptions" ? "desc" : "thumb"; setSel(function(prev) { var o = Object.assign({}, prev); o[sk] = 0; return o; }); }
    setRL(function(p) { var o = Object.assign({}, p); o[k] = false; return o; });
  };

  return (<div>
    <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 14, marginBottom: 4 }}>
      <Field label="Episode #" value={ep.number} onChange={function(v) { setEp(Object.assign({}, ep, { number: v })); }} isMono />
      <Field label="YouTube Link" value={ep.link} onChange={function(v) { setEp(Object.assign({}, ep, { link: v })); }} placeholder="https://youtube.com/watch?v=..." isMono />
    </div>
    <GuestManager guests={guests} setGuests={setGuests} />

    {/* Transcript */}
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <Label>Full Transcript</Label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 8, cursor: "pointer", background: "transparent", border: "1px solid rgba(255,255,255,0.06)", fontFamily: mn, fontSize: 10, color: C.amber, transition: "all 0.2s ease" }}>Upload .txt<input type="file" accept=".txt,.text" style={{ display: "none" }} onChange={function(e) { var f = e.target.files && e.target.files[0]; if (!f) return; var r = new FileReader(); r.onload = function(ev) { setEp(Object.assign({}, ep, { transcript: ev.target.result })); }; r.readAsText(f); e.target.value = ""; }} /></label>
      </div>
      <div onDragOver={function(e) { e.preventDefault(); e.currentTarget.style.borderColor = C.amber; }} onDragLeave={function(e) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }} onDrop={function(e) { e.preventDefault(); e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; var f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) { var r = new FileReader(); r.onload = function(ev) { setEp(Object.assign({}, ep, { transcript: ev.target.result })); }; r.readAsText(f); } }} style={{ position: "relative", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, background: "#09090D", transition: "border-color 0.2s ease" }}>
        {!ep.transcript && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 1 }}><div style={{ fontFamily: ft, fontSize: 14, color: "rgba(255,255,255,0.4)" }}>Drop .txt or paste transcript</div></div>}
        <textarea value={ep.transcript} onChange={function(e) { setEp(Object.assign({}, ep, { transcript: e.target.value })); }} rows={10} style={{ width: "100%", padding: "14px 16px", background: "transparent", border: "none", borderRadius: 12, color: C.tx, fontFamily: mn, fontSize: 12, outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.7, position: "relative", zIndex: 2, minHeight: 140 }} />
      </div>
      {ep.transcript && <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}><span style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.4)" }}>{ep.transcript.length.toLocaleString()} chars</span><span onClick={function() { setEp(Object.assign({}, ep, { transcript: "" })); }} style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.4)", cursor: "pointer" }}>Clear</span></div>}
    </div>

    {/* Timestamps */}
    <div style={{ marginBottom: 20 }}>
      <Label>Timestamps (optional)</Label>
      <textarea value={ep.timestamps || ""} onChange={function(e) { setEp(Object.assign({}, ep, { timestamps: e.target.value })); }} rows={4} placeholder={"(00:00) Cold open\n(02:06) Introduction\n(05:10) Supply chain choke points"} style={{ width: "100%", padding: "12px 14px", background: "#09090D", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, color: C.tx, fontFamily: mn, fontSize: 12, outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.7, transition: "border-color 0.2s ease, box-shadow 0.2s ease" }} onFocus={function(e) { e.target.style.borderColor = C.amber; e.target.style.boxShadow = "0 0 24px rgba(247,176,65,0.06)"; }} onBlur={function(e) { e.target.style.borderColor = "rgba(255,255,255,0.06)"; e.target.style.boxShadow = "none"; }} />
      <div style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>Added to end of generated descriptions.</div>
    </div>

    {/* Additional Info */}
    <div style={{ marginBottom: 20 }}>
      <Label>Additional Info (optional)</Label>
      <textarea value={ep.extra || ""} onChange={function(e) { setEp(Object.assign({}, ep, { extra: e.target.value })); }} rows={2} placeholder="Key topics, sponsor mentions, angles to emphasize..." style={{ width: "100%", padding: "12px 14px", background: "#09090D", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, color: C.tx, fontFamily: ft, fontSize: 14, outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.6, transition: "border-color 0.2s ease, box-shadow 0.2s ease" }} onFocus={function(e) { e.target.style.borderColor = C.amber; e.target.style.boxShadow = "0 0 24px rgba(247,176,65,0.06)"; }} onBlur={function(e) { e.target.style.borderColor = "rgba(255,255,255,0.06)"; e.target.style.boxShadow = "none"; }} />
    </div>

    {/* Desc length */}
    <div style={{ marginBottom: 24 }}>
      <Label>Description Length</Label>
      <div style={{ display: "flex", gap: 8 }}>
        {[{ id: "short", l: "Short", sub: "2-4 sentences" }, { id: "medium", l: "Medium", sub: "2 paragraphs" }, { id: "long", l: "Long", sub: "3-5 paragraphs" }].map(function(m) { var s2 = descLen === m.id; return <div key={m.id} onClick={function() { setDescLen(m.id); }} style={{ flex: 1, padding: "14px 16px", borderRadius: 12, cursor: "pointer", background: s2 ? C.amber + "0A" : "#0D0D12", border: "1px solid " + (s2 ? C.amber + "60" : "rgba(255,255,255,0.06)"), textAlign: "center", boxShadow: s2 ? "0 0 24px rgba(247,176,65,0.06)" : "none", transition: "all 0.2s ease" }}><div style={{ fontFamily: ft, fontSize: 14, fontWeight: s2 ? 800 : 500, color: s2 ? C.amber : "#ffffff" }}>{m.l}</div><div style={{ fontFamily: mn, fontSize: 9, color: s2 ? C.amber : "rgba(255,255,255,0.4)", marginTop: 3 }}>{m.sub}</div></div>; })}
      </div>
    </div>

    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <Btn onClick={genAll} loading={loading} off={!ep.transcript}>Generate Options</Btn>
      {opts && <Btn onClick={genAll} loading={loading} sec sm>Full Regen</Btn>}
      {!ep.transcript && <span style={{ fontFamily: mn, fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Paste or upload a transcript first</span>}
    </div>
    {loading && <ProgressBar label="Generating titles, descriptions, and thumbnails" />}

    {opts && <div style={{ marginTop: 32 }}>
      <SecHead label="Select a Title" onRedoAll={function() { redoCat("titles"); }} rL={rL["all-titles"]} />
      {(opts.titles || []).map(function(t, i) { return <Pick key={"t" + i} text={t} picked={sel.title === i} onPick={function() { setSel(Object.assign({}, sel, { title: i })); }} onRedo={function() { redoOne("titles", i); }} rLoading={rL["titles-" + i]} />; })}
      <KeywordBar onSuggest={suggestKW} loading={kwL} />
      <Divider />
      <SecHead label="Select a Description" onRedoAll={function() { redoCat("descriptions"); }} rL={rL["all-descriptions"]} />
      {(opts.descriptions || []).map(function(d, i) { return <Pick key={"d" + i} text={d} picked={sel.desc === i} onPick={function() { setSel(Object.assign({}, sel, { desc: i })); }} onRedo={function() { redoOne("descriptions", i); }} rLoading={rL["descriptions-" + i]} />; })}
      <Divider />
      <SecHead label="Select a Thumbnail Concept" onRedoAll={function() { redoCat("thumbnails"); }} rL={rL["all-thumbnails"]} />
      {(opts.thumbnails || []).map(function(th, i) { return <Pick key={"th" + i} text={thTxt(th)} picked={sel.thumb === i} onPick={function() { setSel(Object.assign({}, sel, { thumb: i })); }} onRedo={function() { redoOne("thumbnails", i); }} rLoading={rL["thumbnails-" + i]} />; })}
      <Divider />
      <div className="poast-card" style={{ background: "#0D0D12", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: "0 0 24px rgba(247,176,65,0.06)" }}>
        <div style={{ fontFamily: mn, fontSize: 11, color: C.amber, textTransform: "uppercase", letterSpacing: "2px", marginBottom: 18, fontWeight: 700 }}>Your Selections</div>
        <div style={{ marginBottom: 16 }}><div style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.55)", marginBottom: 4, letterSpacing: "1.5px" }}>TITLE</div><div style={{ fontFamily: ft, fontSize: 16, color: "#ffffff", fontWeight: 700 }}>{opts.titles && opts.titles[sel.title]}</div></div>
        <div style={{ marginBottom: 16 }}><div style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.55)", marginBottom: 4, letterSpacing: "1.5px" }}>DESCRIPTION</div><div style={{ fontFamily: ft, fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 150, overflow: "auto" }}>{opts.descriptions && opts.descriptions[sel.desc]}</div></div>
        <div><div style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.55)", marginBottom: 4, letterSpacing: "1.5px" }}>THUMBNAIL CONCEPT</div><div style={{ fontFamily: ft, fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>{thTxt(opts.thumbnails && opts.thumbnails[sel.thumb])}</div></div>
      </div>
      <Btn onClick={function() { if (!opts) return; setFin({ title: opts.titles[sel.title], description: opts.descriptions[sel.desc], thumbnail: opts.thumbnails[sel.thumb] }); goTest(); }}>Save Selections + Go to Test Page</Btn>
      {fin && <span style={{ fontFamily: mn, fontSize: 10, color: C.teal, marginLeft: 12 }}>Saved</span>}
    </div>}
  </div>);
}

// ═══ TEST PAGE (same as before minus changes) ═══
function TestPage({ ep, guests, opts, fin, setFin, thumb, setThumb, goLaunch }) {
  var _cl = useState(false), checkL = _cl[0], setCheckL = _cl[1];
  var _cr = useState(null), checkR = _cr[0], setCheckR = _cr[1];
  var _al = useState(false), abL = _al[0], setAbL = _al[1];
  var _ar = useState(null), abR = _ar[0], setAbR = _ar[1];
  var _am = useState("both"), abM = _am[0], setAbM = _am[1];
  var _fn = useState(false), locked = _fn[0], setLocked = _fn[1];

  if (!fin) return <div style={{ textAlign: "center", padding: 80, color: C.txm, fontFamily: ft }}>Save selections in Episode Setup first.</div>;
  var thS = thTxt(fin.thumbnail);

  var doubleCheck = async function() {
    setCheckL(true);
    var thC = typeof fin.thumbnail === "string" ? fin.thumbnail : fin.thumbnail.concept;
    var thT2 = typeof fin.thumbnail === "string" ? "" : fin.thumbnail.text_overlay;
    var thMood = typeof fin.thumbnail === "string" ? "" : fin.thumbnail.mood;
    var thumbInfo = "Thumbnail concept: " + thC;
    if (thT2) thumbInfo += " | Text overlay: " + thT2;
    if (thMood) thumbInfo += " | Mood: " + thMood;
    if (thumb) thumbInfo += " | Actual thumbnail has been uploaded (image present).";
    else thumbInfo += " | No actual thumbnail uploaded yet, only the concept.";
    var data = await ask(SYS_EP, buildPrompt([
      "You are reviewing the full package for SemiAnalysis Weekly Episode #" + ep.number + " before it goes live. Evaluate how well the title, description, and thumbnail work TOGETHER as a cohesive unit.",
      "Title: " + fin.title,
      "Full Description: " + (fin.description || ""),
      thumbInfo,
      "Guests: " + gStr(guests),
      "Evaluate: 1) Does the title create curiosity that the thumbnail reinforces? 2) Does the description deliver on what the title promises? 3) Is there redundancy between title and thumbnail text? 4) Would this stop a scroll on YouTube? 5) Is the overall package cohesive or disjointed?",
      "Score 1-10 (10 = perfect cohesion, scroll-stopping, zero redundancy).",
      'Return JSON: {"score":8,"feedback":"2-3 sentence overall assessment of how well these three elements work together","suggestions":["specific actionable suggestion 1","specific actionable suggestion 2","specific actionable suggestion 3"]}'
    ]));
    if (data) setCheckR(data);
    setCheckL(false);
  };

  var runAB = async function() {
    setAbL(true);
    var allT = opts && opts.titles || [];
    var allTh = opts && opts.thumbnails || [];
    var mS = abM === "both" ? "Title + Thumbnail" : abM === "title" ? "Title only" : "Thumbnail only";
    var curThumb = typeof fin.thumbnail === "string" ? fin.thumbnail : fin.thumbnail.concept;
    var data = await ask(SYS_EP, buildPrompt([
      "A/B Test for SA Weekly Ep #" + ep.number + ". Mode: " + mS + ".",
      "Current title: " + fin.title,
      "Current thumbnail concept: " + curThumb,
      "All previously generated titles: " + JSON.stringify(allT),
      "All previously generated thumbnails: " + JSON.stringify(allTh),
      "Provide two options: Option A (current) and Option B (your recommended alternative). Score each for predicted CTR on a 1-10 scale. Explain the reasoning for each.",
      'Return JSON: {"option_a":{"title":"...","thumbnail_concept":"...","score":7,"reasoning":"why this works or falls short"},"option_b":{"title":"...","thumbnail_concept":"...","score":9,"reasoning":"why this is better"},"verdict":"1-2 sentence recommendation"}'
    ]));
    if (data) setAbR(data);
    setAbL(false);
  };

  var applyAB = function() {
    if (!abR || !abR.option_b) return;
    var nf = Object.assign({}, fin);
    if ((abM === "title" || abM === "both") && abR.option_b.title) nf.title = abR.option_b.title;
    if ((abM === "thumbnail" || abM === "both") && abR.option_b.thumbnail_concept) {
      nf.thumbnail = typeof fin.thumbnail === "string" ? abR.option_b.thumbnail_concept : Object.assign({}, fin.thumbnail, { concept: abR.option_b.thumbnail_concept });
    }
    setFin(nf); setAbR(null); setCheckR(null);
  };

  return (<div>
    <div style={{ fontFamily: ft, fontSize: 24, fontWeight: 900, color: "#ffffff", marginBottom: 4, letterSpacing: -1 }}>Test Page</div>
    <div style={{ fontFamily: mn, fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 32, letterSpacing: "1px" }}>Preview, double check, A/B test, then finalize.</div>
    <div className="poast-card" style={{ background: "#0D0D12", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden", marginBottom: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}>
      <div style={{ width: "100%", aspectRatio: "16/9", background: "#09090D", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>{thumb ? <img src={thumb} alt="Thumb" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ textAlign: "center" }}><div style={{ fontFamily: ft, fontSize: 15, color: "rgba(255,255,255,0.4)" }}>Thumbnail Preview</div></div>}<div style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.8)", borderRadius: 4, padding: "3px 8px", fontFamily: mn, fontSize: 10, color: "#fff" }}>42:18</div></div>
      <div style={{ padding: "16px 20px" }}><div style={{ fontFamily: ft, fontSize: 16, fontWeight: 800, color: "#ffffff", lineHeight: 1.4, marginBottom: 10 }}>{fin.title}</div><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 28, height: 28, borderRadius: "50%", background: C.amber, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: ft, fontSize: 11, fontWeight: 800, color: "#060608" }}>SA</div><div style={{ fontFamily: ft, fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>SemiAnalysis Weekly</div></div></div>
    </div>
    <div className="poast-card" style={{ background: "#0D0D12", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><div style={{ fontFamily: mn, fontSize: 11, color: C.amber, textTransform: "uppercase", letterSpacing: "2px" }}>Description</div><CopyBtn text={fin.description} /></div><div style={{ fontFamily: ft, fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{fin.description}</div></div>
    <div className="poast-card" style={{ background: "#0D0D12", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20, marginBottom: 28, boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}><div style={{ fontFamily: mn, fontSize: 11, color: C.violet, textTransform: "uppercase", letterSpacing: "2px", marginBottom: 10 }}>Thumbnail Concept</div><div style={{ fontFamily: ft, fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>{thS}</div></div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 28 }}>
      <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 28, background: "#09090D", border: "2px dashed rgba(255,255,255,0.06)", borderRadius: 12, cursor: "pointer", transition: "border-color 0.2s ease" }}><div style={{ fontFamily: ft, fontSize: 15, fontWeight: 800, color: C.amber, marginBottom: 4 }}>A. Upload Thumbnail</div><div style={{ fontFamily: mn, fontSize: 10, color: "rgba(255,255,255,0.4)" }}>PNG, JPG, 1280x720</div><input type="file" accept="image/*" style={{ display: "none" }} onChange={function(e) { var f = e.target.files && e.target.files[0]; if (!f) return; var r = new FileReader(); r.onload = function(ev) { setThumb(ev.target.result); }; r.readAsDataURL(f); e.target.value = ""; }} /></label>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 28, background: "#09090D", border: "2px dashed rgba(255,255,255,0.06)", borderRadius: 12, opacity: 0.35 }}><div style={{ fontFamily: ft, fontSize: 15, fontWeight: 800, color: "rgba(255,255,255,0.55)", marginBottom: 4 }}>B. Get One Prompted</div><div style={{ fontFamily: mn, fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Coming Soon</div></div>
    </div>
    {thumb && <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20 }}><span style={{ fontFamily: mn, fontSize: 10, color: C.teal }}>Thumbnail uploaded</span><span onClick={function() { setThumb(null); }} style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.4)", cursor: "pointer" }}>Remove</span></div>}
    <Divider />
    <div style={{ marginBottom: 28 }}><div style={{ fontFamily: ft, fontSize: 18, fontWeight: 800, color: "#ffffff", marginBottom: 10, letterSpacing: -0.5 }}>Double Check</div><Btn onClick={doubleCheck} loading={checkL} sec>Run Double Check</Btn>
      {checkL && <ProgressBar label="Evaluating cohesion" />}
      {checkR && <div className="poast-card" style={{ background: "#0D0D12", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20, marginTop: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}><div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}><div style={{ width: 48, height: 48, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: (checkR.score >= 8 ? C.teal : checkR.score >= 5 ? C.amber : C.coral) + "15", border: "2px solid " + (checkR.score >= 8 ? C.teal : checkR.score >= 5 ? C.amber : C.coral), fontFamily: mn, fontSize: 18, fontWeight: 700, color: checkR.score >= 8 ? C.teal : checkR.score >= 5 ? C.amber : C.coral }}>{checkR.score}</div><div><div style={{ fontFamily: ft, fontSize: 15, fontWeight: 800, color: "#ffffff" }}>Cohesion Score</div></div></div><div style={{ fontFamily: ft, fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, marginBottom: 14 }}>{checkR.feedback}</div>{checkR.suggestions && checkR.suggestions.map(function(s, i) { return <div key={i} style={{ fontFamily: ft, fontSize: 13, color: "rgba(255,255,255,0.55)", paddingLeft: 12, borderLeft: "2px solid rgba(255,255,255,0.06)", marginBottom: 6, lineHeight: 1.6 }}>{s}</div>; })}</div>}
    </div>
    <Divider />
    <div style={{ marginBottom: 28 }}><div style={{ fontFamily: ft, fontSize: 18, fontWeight: 800, color: "#ffffff", marginBottom: 10, letterSpacing: -0.5 }}>A/B Testing</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>{[{ id: "title", l: "Title Only" }, { id: "thumbnail", l: "Thumbnail Only" }, { id: "both", l: "Title + Thumbnail" }].map(function(m) { var s2 = abM === m.id; return <div key={m.id} onClick={function() { setAbM(m.id); }} style={{ padding: "10px 16px", borderRadius: 10, cursor: "pointer", background: s2 ? C.amber + "0A" : "#0D0D12", border: "1px solid " + (s2 ? C.amber + "60" : "rgba(255,255,255,0.06)"), fontFamily: mn, fontSize: 11, color: s2 ? C.amber : "rgba(255,255,255,0.55)", boxShadow: s2 ? "0 0 24px rgba(247,176,65,0.06)" : "none", transition: "all 0.2s ease" }}>{m.l}</div>; })}</div>
      <div style={{ display: "flex", gap: 8 }}><Btn onClick={runAB} loading={abL} sec>Run A/B Test</Btn>{abR && <Btn onClick={function() { setAbR(null); runAB(); }} loading={abL} sec sm>Redo Fresh</Btn>}</div>
      {abL && <ProgressBar label="Running A/B analysis" />}
      {abR && abR.option_a && abR.option_b && <div style={{ marginTop: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          {[{ key: "option_a", label: "Option A // Current", color: "rgba(255,255,255,0.55)" }, { key: "option_b", label: "Option B // Recommended", color: C.amber }].map(function(col) {
            var opt = abR[col.key];
            return <div key={col.key} className="poast-card" style={{ background: "#0D0D12", border: "1px solid " + (col.key === "option_b" ? C.amber + "40" : "rgba(255,255,255,0.06)"), borderRadius: 12, padding: 20, boxShadow: col.key === "option_b" ? "0 0 24px rgba(247,176,65,0.06)" : "0 2px 12px rgba(0,0,0,0.3)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontFamily: mn, fontSize: 9, color: col.color, textTransform: "uppercase", letterSpacing: "2px" }}>{col.label}</div>
                <div style={{ width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: col.color + "15", border: "2px solid " + col.color, fontFamily: mn, fontSize: 15, fontWeight: 700, color: col.color }}>{opt.score}</div>
              </div>
              {opt.title && <div style={{ marginBottom: 12 }}><div style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.4)", marginBottom: 4, letterSpacing: "1.5px" }}>TITLE</div><div style={{ fontFamily: ft, fontSize: 14, color: "#ffffff", fontWeight: 700 }}>{opt.title}</div></div>}
              {opt.thumbnail_concept && <div style={{ marginBottom: 12 }}><div style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.4)", marginBottom: 4, letterSpacing: "1.5px" }}>THUMBNAIL</div><div style={{ fontFamily: ft, fontSize: 13, color: "rgba(255,255,255,0.55)" }}>{opt.thumbnail_concept}</div></div>}
              <div style={{ fontFamily: ft, fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12, marginTop: 8 }}>{opt.reasoning}</div>
            </div>;
          })}
        </div>
        <div style={{ background: "#09090D", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "14px 18px", marginBottom: 16 }}>
          <div style={{ fontFamily: ft, fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>{abR.verdict}</div>
        </div>
        <Btn onClick={applyAB} sm>Apply Option B</Btn>
      </div>}
    </div>
    <Divider />
    <div style={{ background: locked ? C.teal + "08" : "#09090D", border: "1px solid " + (locked ? C.teal : "rgba(255,255,255,0.06)"), borderRadius: 12, padding: 24 }}>
      <div style={{ fontFamily: ft, fontSize: 18, fontWeight: 800, color: locked ? C.teal : "#ffffff", marginBottom: 8, letterSpacing: -0.5 }}>{locked ? "Finalized" : "Ready to Finalize?"}</div>
      {!locked ? <Btn onClick={function() { setLocked(true); }} off={!thumb}>{thumb ? "Finalize for Launch" : "Upload Thumbnail First"}</Btn> : <Btn onClick={goLaunch}>Continue to Launch Rollout</Btn>}
    </div>
  </div>);
}

// ═══ LAUNCH ROLLOUT ═══
function LaunchRollout({ ep, guests, fin, onComplete }) {
  var _h = useState("Cold open into intro. Out Now announcement."), hook = _h[0], setHook = _h[1];
  var _l = useState(false), loading = _l[0], setLoading = _l[1];
  var _r = useState(null), res = _r[0], setRes = _r[1];
  var _rl = useState({}), redoL = _rl[0], setRedoL = _rl[1];
  var _done = useState(false), done = _done[0], setDone = _done[1];
  var _show = useState(false), showModal = _show[0], setShowModal = _show[1];

  if (!fin) return <div style={{ textAlign: "center", padding: 80, color: C.txm, fontFamily: ft }}>Complete Episode Setup and Test Page first.</div>;
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
    var data = await ask(SYS_SOC, buildPrompt(["Out Now launch rollout for SemiAnalysis Weekly Episode #" + ep.number, "Title: " + fin.title, "Guests with handles: " + gs, "Link: " + link, "Hook: " + hook, "Transcript: " + (ep.transcript || "").slice(0, 4000), 'Return JSON with these EXACT keys: {"x_hook":"...","x_reply":"...","linkedin_post":"...","linkedin_comment":"...","facebook_post":"...","facebook_comment":"...","instagram_caption":"full caption with Save CTA and hashtags and shop grid link ' + link + '","yt_shorts_title":"under 40 chars","yt_shorts_desc":"description with hashtags including #shorts","tiktok_caption":"all lowercase with hashtags"}']));
    if (data) setRes(data);
    setLoading(false);
  };

  var redoField = async function(key, platLabel) {
    setRedoL(function(p) { var o = Object.assign({}, p); o[key] = true; return o; });
    var current = res[key] || "";
    var isTitle = key === "yt_shorts_title";
    var extra = isTitle ? " Must be under 40 characters." : "";
    var data = await ask(SYS_SOC, buildPrompt(["Regenerate ONLY the " + platLabel + " caption for SA Weekly Ep #" + ep.number + " launch." + extra, "Title: " + fin.title, "Guests: " + gs, "Link: " + link, "Hook: " + hook, "Current version (be DIFFERENT): " + current, 'Return JSON: {"result":"..."}']));
    if (data && data.result) { setRes(function(prev) { var o = Object.assign({}, prev); o[key] = data.result; return o; }); }
    setRedoL(function(p) { var o = Object.assign({}, p); o[key] = false; return o; });
  };

  var doExport = function() {
    if (!res) return;
    var sections = [
      { heading: "Horizontal (X, LinkedIn, Facebook)", items: FIELDS.slice(0, 6).map(function(f) { return { label: f.label, content: res[f.key] || "" }; }) },
      { heading: "Vertical (Shorts, Reels, TikTok)", items: FIELDS.slice(6).map(function(f) { return { label: f.label, content: res[f.key] || "" }; }) },
    ];
    exportDoc("Ep #" + ep.number + " Launch Rollout", sections);
  };

  var doComplete = function() {
    setDone(true); setShowModal(true);
    if (onComplete) onComplete({ title: fin.title, description: fin.description, social: res });
  };

  return (<div>
    <div className="poast-card" style={{ background: "#0D0D12", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 26, marginBottom: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}>
      <div style={{ fontFamily: mn, fontSize: 11, color: C.amber, textTransform: "uppercase", letterSpacing: "2px", marginBottom: 8 }}>{"Episode #" + ep.number + " // Full Launch"}</div>
      <div style={{ fontFamily: ft, fontSize: 24, fontWeight: 900, color: "#ffffff", letterSpacing: -1 }}>{fin.title}</div>
      <div style={{ fontFamily: ft, fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 6 }}>{gs}</div>
    </div>
    <div style={{ marginBottom: 20 }}><Label>Hook / Angle</Label><textarea value={hook} onChange={function(e) { setHook(e.target.value); }} rows={3} style={{ width: "100%", padding: "12px 14px", background: "#09090D", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, color: C.tx, fontFamily: ft, fontSize: 14, outline: "none", boxSizing: "border-box", resize: "vertical", transition: "border-color 0.2s ease, box-shadow 0.2s ease" }} onFocus={function(e) { e.target.style.borderColor = C.amber; e.target.style.boxShadow = "0 0 24px rgba(247,176,65,0.06)"; }} onBlur={function(e) { e.target.style.borderColor = "rgba(255,255,255,0.06)"; e.target.style.boxShadow = "none"; }} /></div>
    <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
      <Btn onClick={gen} loading={loading}>Generate Launch Rollout</Btn>
      {res && <Btn onClick={gen} loading={loading} sec sm>Regen All</Btn>}
    </div>
    {loading && <ProgressBar label="Generating social captions for all platforms" />}

    {res && <div style={{ marginTop: 28 }}>
      <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 800, color: "rgba(255,255,255,0.55)", marginBottom: 12 }}>Horizontal (X, LinkedIn, Facebook)</div>
      {FIELDS.slice(0, 6).map(function(f) { return <OutCard key={f.key} title={f.label} content={res[f.key] || "(not generated)"} color={f.color} onRedo={function() { redoField(f.key, f.label); }} rLoading={redoL[f.key]} />; })}
      <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 800, color: "rgba(255,255,255,0.55)", marginTop: 24, marginBottom: 12 }}>Vertical (Shorts, Reels, TikTok)</div>
      {FIELDS.slice(6).map(function(f) { return <OutCard key={f.key} title={f.label} content={res[f.key] || "(not generated)"} color={f.color} onRedo={function() { redoField(f.key, f.label); }} rLoading={redoL[f.key]} />; })}

      <Divider />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Btn onClick={doExport} sec>Download as .doc</Btn>
        <Btn onClick={doComplete}>Complete Launch Kit</Btn>
      </div>
    </div>}

    {/* Congratulations Modal */}
    {showModal && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }} onClick={function() { setShowModal(false); }}>
      <Confetti />
      <div onClick={function(e) { e.stopPropagation(); }} style={{ background: "#0D0D12", border: "1px solid " + C.amber, borderRadius: 12, padding: 40, maxWidth: 440, textAlign: "center", boxShadow: "0 0 40px rgba(247,176,65,0.2), 0 0 80px rgba(247,176,65,0.08)", position: "relative", zIndex: 1001 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>&#x1F680;</div>
        <div style={{ fontFamily: ft, fontSize: 24, fontWeight: 900, color: C.amber, marginBottom: 10, letterSpacing: -1 }}>Launch Your Video Now</div>
        <div style={{ fontFamily: ft, fontSize: 15, color: "#ffffff", marginBottom: 6, fontWeight: 700 }}>{fin.title}</div>
        <div style={{ fontFamily: mn, fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 22, letterSpacing: "1px" }}>Episode #{ep.number} - {gs}</div>
        <div style={{ fontFamily: ft, fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 28 }}>Your Launch Kit is saved. Download the doc, schedule in Buffer, and push it live.</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Btn onClick={function() { window.open("https://publish.buffer.com", "_blank"); }}>Open Buffer</Btn>
          <Btn onClick={doExport} sec>Download .doc</Btn>
          <Btn onClick={function() { setShowModal(false); }} sec sm>Close</Btn>
        </div>
      </div>
    </div>}
  </div>);
}

// ═══ CLIP MANAGER + LOG ═══
function ClipMgr() { return <div style={{ textAlign: "center", padding: 80, color: "rgba(255,255,255,0.4)", fontFamily: ft }}><div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8, color: "rgba(255,255,255,0.55)" }}>Clip Manager</div><div style={{ fontFamily: mn, fontSize: 11, letterSpacing: "1px" }}>Coming next.</div></div>; }

function LogTab({ logData, setLogData }) {
  var _ed = useState(false), editing = _ed[0], setEditing = _ed[1];
  var _view = useState(null), viewIdx = _view[0], setViewIdx = _view[1];

  var removeEntry = function(idx) { setLogData(function(prev) { return prev.filter(function(_, j) { return j !== idx; }); }); };

  var downloadLaunchKit = function(e) {
    var sections = [
      { heading: "Episode Info", items: [
        { label: "Title", content: e.title },
        { label: "Description", content: e.description || "" },
        { label: "Guests", content: e.guests },
        { label: "Date", content: e.date },
      ]},
    ];
    if (e.social) {
      sections.push({ heading: "Horizontal (X, LinkedIn, Facebook)", items: ["x_hook", "x_reply", "linkedin_post", "linkedin_comment", "facebook_post", "facebook_comment"].filter(function(k) { return e.social[k]; }).map(function(k) { return { label: k.replace(/_/g, " ").replace(/\b\w/g, function(c) { return c.toUpperCase(); }), content: e.social[k] }; }) });
      sections.push({ heading: "Vertical (Shorts, Reels, TikTok)", items: ["instagram_caption", "yt_shorts_title", "yt_shorts_desc", "tiktok_caption"].filter(function(k) { return e.social[k]; }).map(function(k) { return { label: k.replace(/_/g, " ").replace(/\b\w/g, function(c) { return c.toUpperCase(); }), content: e.social[k] }; }) });
    }
    exportDoc("Ep #" + e.episode + " Launch Kit", sections);
  };

  var downloadSocialKit = function(e) {
    if (!e.social) return;
    var sections = [
      { heading: "Social Captions", items: Object.keys(e.social).map(function(k) { return { label: k.replace(/_/g, " ").replace(/\b\w/g, function(c) { return c.toUpperCase(); }), content: e.social[k] }; }) },
    ];
    exportDoc("Ep #" + e.episode + " Social Kit", sections);
  };

  var viewEntry = viewIdx !== null && logData[viewIdx] ? logData[viewIdx] : null;

  return (<div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
      <div style={{ fontFamily: ft, fontSize: 18, fontWeight: 800, color: "#ffffff", letterSpacing: -0.5 }}>Activity Log</div>
      {logData.length > 0 && <span onClick={function() { setEditing(!editing); }} style={{ fontFamily: mn, fontSize: 10, color: editing ? C.coral : "rgba(255,255,255,0.4)", cursor: "pointer", padding: "5px 12px", borderRadius: 8, border: "1px solid " + (editing ? C.coral + "40" : "rgba(255,255,255,0.06)"), transition: "all 0.2s ease" }}>{editing ? "Done" : "Edit"}</span>}
    </div>
    {logData.length === 0 ? <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.4)", fontFamily: ft, fontSize: 14 }}>No completed episodes yet.</div>
      : logData.map(function(e, i) { return (<div key={i} className="poast-card" style={{ background: "#0D0D12", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "18px 20px", marginBottom: 10, boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
          {editing && <span onClick={function() { removeEntry(i); }} style={{ width: 24, height: 24, borderRadius: "50%", background: C.coral + "15", border: "1px solid " + C.coral, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mn, fontSize: 13, color: C.coral, cursor: "pointer", flexShrink: 0 }}>x</span>}
          <div style={{ width: 42, height: 42, borderRadius: 10, background: "#09090D", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mn, fontSize: 12, color: C.amber, fontWeight: 700, border: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>{"#" + e.episode}</div>
          <div style={{ flex: 1 }}><div style={{ fontFamily: ft, fontSize: 15, fontWeight: 700, color: "#ffffff" }}>{e.title}</div><div style={{ fontFamily: ft, fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{e.guests}</div></div>
          <div style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.4)" }}>{e.date}</div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span onClick={function() { setViewIdx(i); }} style={{ fontFamily: mn, fontSize: 9, color: C.teal, padding: "4px 12px", background: C.teal + "0A", borderRadius: 6, cursor: "pointer", border: "1px solid " + C.teal + "30" }}>View Launch Kit</span>
          <span onClick={function() { downloadLaunchKit(e); }} style={{ fontFamily: mn, fontSize: 9, color: C.amber, cursor: "pointer", padding: "4px 12px", background: C.amber + "0A", borderRadius: 6, border: "1px solid " + C.amber + "30" }}>Download Launch Kit</span>
          {e.social && <span onClick={function() { downloadSocialKit(e); }} style={{ fontFamily: mn, fontSize: 9, color: C.blue, cursor: "pointer", padding: "4px 12px", background: C.blue + "0A", borderRadius: 6, border: "1px solid " + C.blue + "30" }}>Download Social Kit</span>}
        </div>
      </div>); })}

    {/* View Launch Kit Modal */}
    {viewEntry && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }} onClick={function() { setViewIdx(null); }}>
      <div onClick={function(e) { e.stopPropagation(); }} style={{ background: "#0D0D12", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 32, maxWidth: 640, width: "90%", maxHeight: "80vh", overflow: "auto", boxShadow: "0 4px 40px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: mn, fontSize: 11, color: C.amber, textTransform: "uppercase", letterSpacing: "2px" }}>{"Episode #" + viewEntry.episode + " // Launch Kit"}</div>
          <span onClick={function() { setViewIdx(null); }} style={{ fontFamily: mn, fontSize: 11, color: "rgba(255,255,255,0.4)", cursor: "pointer", padding: "4px 8px" }}>x</span>
        </div>
        <div style={{ fontFamily: ft, fontSize: 20, fontWeight: 900, color: "#ffffff", marginBottom: 4, letterSpacing: -0.5 }}>{viewEntry.title}</div>
        <div style={{ fontFamily: ft, fontSize: 13, color: "rgba(255,255,255,0.55)", marginBottom: 8 }}>{viewEntry.guests} // {viewEntry.date}</div>
        {viewEntry.description && <div style={{ fontFamily: ft, fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, whiteSpace: "pre-wrap", padding: "14px 16px", background: "#09090D", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 18, maxHeight: 160, overflow: "auto" }}>{viewEntry.description}</div>}
        {viewEntry.social && <div>
          <div style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "2px", marginBottom: 12 }}>Social Captions</div>
          {Object.keys(viewEntry.social).map(function(k) { return <div key={k} style={{ marginBottom: 10, padding: "12px 14px", background: "#09090D", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 5 }}>{k.replace(/_/g, " ")}</div>
            <div style={{ fontFamily: ft, fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{viewEntry.social[k]}</div>
          </div>; })}
        </div>}
        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <Btn onClick={function() { downloadLaunchKit(viewEntry); }} sm sec>Download Launch Kit</Btn>
          {viewEntry.social && <Btn onClick={function() { downloadSocialKit(viewEntry); }} sm sec>Download Social Kit</Btn>}
        </div>
      </div>
    </div>}
  </div>);
}

// ═══ CLIP CAPTIONS ═══
var CAPPER_TONES = [
  { key: "dylan", label: "Dylan", desc: "Direct, data-heavy, confident, uses specific numbers and claims.", hook: "Here's what nobody is telling you about..." },
  { key: "doug", label: "Doug", desc: "Technical, first-principles, analytical. Focuses on why something matters structurally.", hook: "" },
  { key: "sa_twitter", label: "SA Twitter", desc: "Punchy, provocative, hot-take style. Short sentences. Bold claims backed by data.", hook: "" },
  { key: "oren", label: "Oren", desc: "Conversational, storytelling, bridges tech to business impact. Accessible but informed.", hook: "" },
];

var CAPPER_PLATFORMS = [
  { key: "x", label: "X", color: PL.x, icon: "X" },
  { key: "instagram", label: "Instagram", color: PL.ig, icon: "IG" },
  { key: "linkedin", label: "LinkedIn", color: PL.li, icon: "in" },
  { key: "tiktok", label: "TikTok", color: PL.tt, icon: "TT" },
  { key: "youtube", label: "YouTube", color: PL.yt, icon: "YT" },
];

var CAPPER_LENGTHS = [
  { key: "short", label: "Short", desc: "1-2 sentences", thread: false },
  { key: "medium", label: "Medium", desc: "3-4 sentences", thread: false },
  { key: "long", label: "Long", desc: "Paragraph", thread: false },
  { key: "thread", label: "Thread", desc: "3-5 posts", thread: true },
  { key: "epic", label: "Epic Thread", desc: "6-10 posts", thread: true },
];

var SYS_CAPPER = "You are a social media caption writer. You write captions for short-form video clips.\n\nTone descriptions:\n- Dylan: Direct, data-heavy, confident. Uses specific numbers and bold claims. Opens with hooks like 'Here is what nobody is telling you about...' Never hedges.\n- Doug: Technical, first-principles, analytical. Focuses on structural importance and why something matters at a fundamental level. Methodical.\n- SA Twitter: Punchy, provocative, hot-take energy. Short sentences. Bold claims. Data-backed but aggressive framing.\n- Oren: Conversational, storytelling approach. Bridges technical topics to business impact. Accessible but clearly informed.\n\nPlatform rules:\n- X: No hashtags ever. Write as hook tweet + reply-to-self format. No links in the main post. Keep punchy.\n- Instagram: Include a 'Save this for later' CTA. Add 5-8 relevant hashtags. Add location 'San Francisco, CA'. Direct to bio link.\n- LinkedIn: Professional framing. End with 'Link in comments.' No hashtags. Longer form is fine.\n- TikTok: All lowercase. 4-6 hashtags. Casual tone. Short.\n- YouTube: Include a separate title line (under 40 characters). Then the description. Include relevant keywords.\n\nRules: Never use em dashes, use commas or periods. No emojis. Be direct. RESPOND ONLY IN VALID JSON. No markdown fences. No preamble.";

function ClipCaptions() {
  var _content = useState(""), content = _content[0], setContent = _content[1];
  var _platforms = useState(["x"]), platforms = _platforms[0], setPlatforms = _platforms[1];
  var _length = useState("medium"), length = _length[0], setLength = _length[1];
  var _tone = useState("dylan"), tone = _tone[0], setTone = _tone[1];
  var _link = useState(false), showLink = _link[0], setShowLink = _link[1];
  var _url = useState(""), url = _url[0], setUrl = _url[1];
  var _loading = useState(false), loading = _loading[0], setLoading = _loading[1];
  var _results = useState(null), results = _results[0], setResults = _results[1];
  var _regenL = useState({}), regenL = _regenL[0], setRegenL = _regenL[1];

  var toneObj = CAPPER_TONES.find(function(t) { return t.key === tone; }) || CAPPER_TONES[0];
  var lenObj = CAPPER_LENGTHS.find(function(l) { return l.key === length; }) || CAPPER_LENGTHS[1];
  var isThread = lenObj.thread;

  var togglePlatform = function(key) {
    setPlatforms(function(prev) {
      if (prev.indexOf(key) > -1) {
        var next = prev.filter(function(k) { return k !== key; });
        return next.length > 0 ? next : prev;
      }
      return prev.concat([key]);
    });
  };

  var buildCapperPrompt = function(platKey, variationNote) {
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
    parts.push("Tone: " + toneObj.label + " - " + toneObj.desc);
    parts.push("Platform: " + platObj.label);
    parts.push("Clip content:\n" + content.slice(0, 6000));
    if (showLink && url) parts.push("Include this redirect link naturally: " + url);
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
    var allPromises = [];
    var promiseMap = [];
    platforms.forEach(function(platKey) {
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
    var grouped = {};
    allResults.forEach(function(d, i) {
      var info = promiseMap[i];
      if (!grouped[info.platform]) grouped[info.platform] = [];
      grouped[info.platform].push(d || (isThread ? { posts: [{ number: 1, text: "Generation failed for variation " + (info.variation + 1) }] } : { caption: "Generation failed for variation " + (info.variation + 1) }));
    });
    setResults(grouped);
    setLoading(false);
  };

  var regenerateOne = async function(platKey, idx) {
    var regenKey = platKey + "_" + idx;
    setRegenL(function(p) { var o = Object.assign({}, p); o[regenKey] = true; return o; });
    var cur = results[platKey] && results[platKey][idx];
    var curText = isThread ? (cur && cur.posts ? cur.posts.map(function(p) { return p.text; }).join(" ") : "") : (cur && cur.caption || "");
    var data = await ask(SYS_CAPPER, buildCapperPrompt(platKey, "Regenerate this caption. Be DIFFERENT from: " + curText));
    if (data) {
      setResults(function(p) {
        var o = Object.assign({}, p);
        var arr = (o[platKey] || []).slice();
        arr[idx] = data;
        o[platKey] = arr;
        return o;
      });
    }
    setRegenL(function(p) { var o = Object.assign({}, p); o[regenKey] = false; return o; });
  };

  var charCount = function(text) {
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
      <textarea value={content} onChange={function(e) { setContent(e.target.value); }} rows={7} placeholder="Paste the clip transcript or describe the topic..." style={{ width: "100%", padding: "14px 16px", background: cardBg, border: "1px solid " + borderC, borderRadius: 10, color: C.tx, fontFamily: mn, fontSize: 12, outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.7, transition: "border-color 0.2s ease, box-shadow 0.2s ease" }} onFocus={function(e) { e.target.style.borderColor = C.amber; e.target.style.boxShadow = "0 0 24px rgba(247,176,65,0.06)"; }} onBlur={function(e) { e.target.style.borderColor = borderC; e.target.style.boxShadow = "none"; }} />
      {content && <div style={{ fontFamily: mn, fontSize: 9, color: C.txd, marginTop: 4 }}>{content.length.toLocaleString()} chars</div>}
    </div>

    {/* Platform (multi-select) */}
    <div style={{ marginBottom: 20 }}>
      <Label>Platforms <span style={{ fontWeight: 400, opacity: 0.5, textTransform: "none", letterSpacing: 0 }}>(multi-select)</span></Label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {CAPPER_PLATFORMS.map(function(p) {
          var on = platforms.indexOf(p.key) > -1;
          return <div key={p.key} onClick={function() { togglePlatform(p.key); }} style={{ padding: "8px 16px", borderRadius: 8, cursor: "pointer", background: on ? p.color + "18" : cardBg, border: "1px solid " + (on ? p.color + "60" : borderC), fontFamily: ft, fontSize: 12, fontWeight: on ? 700 : 500, color: on ? p.color : C.txd, transition: "all 0.2s ease", display: "flex", alignItems: "center", gap: 6 }}>
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
          return <div key={l.key} onClick={function() { setLength(l.key); }} style={{ padding: "8px 16px", borderRadius: 8, cursor: "pointer", background: on ? (l.thread ? C.violet + "15" : C.amber + "15") : cardBg, border: "1px solid " + (on ? (l.thread ? C.violet + "60" : C.amber + "60") : borderC), fontFamily: ft, fontSize: 12, fontWeight: on ? 700 : 500, color: on ? (l.thread ? C.violet : C.amber) : C.txd, transition: "all 0.2s ease" }}>
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
          return <div key={t.key} onClick={function() { setTone(t.key); }} style={{ padding: "14px 16px", borderRadius: 10, cursor: "pointer", background: on ? C.amber + "0C" : cardBg, border: "1px solid " + (on ? C.amber + "50" : borderC), boxShadow: on ? "0 0 20px rgba(247,176,65,0.06)" : "none", transition: "all 0.2s ease" }}>
            <div style={{ fontFamily: ft, fontSize: 13, fontWeight: 700, color: on ? C.amber : C.tx, marginBottom: 4 }}>{t.label}</div>
            <div style={{ fontFamily: mn, fontSize: 10, color: C.txm, lineHeight: 1.5 }}>{t.desc}</div>
            {t.hook && <div style={{ fontFamily: mn, fontSize: 9, color: C.txd, marginTop: 6, fontStyle: "italic" }}>"{t.hook}"</div>}
          </div>;
        })}
      </div>
    </div>

    {/* Redirect Link Toggle */}
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: showLink ? 10 : 0 }}>
        <div onClick={function() { setShowLink(!showLink); }} style={{ width: 36, height: 20, borderRadius: 10, cursor: "pointer", background: showLink ? C.amber : "rgba(255,255,255,0.1)", position: "relative", transition: "background 0.2s ease" }}>
          <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: showLink ? 18 : 2, transition: "left 0.2s ease", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }} />
        </div>
        <span style={{ fontFamily: mn, fontSize: 11, color: showLink ? C.amber : C.txd }}>Include redirect link</span>
      </div>
      {showLink && <input value={url} onChange={function(e) { setUrl(e.target.value); }} placeholder="https://..." style={{ width: "100%", padding: "10px 14px", background: cardBg, border: "1px solid " + borderC, borderRadius: 8, color: C.tx, fontFamily: mn, fontSize: 12, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s ease" }} onFocus={function(e) { e.target.style.borderColor = C.amber; }} onBlur={function(e) { e.target.style.borderColor = borderC; }} />}
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
        var platResults = results[platKey] || [];
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
              return <div key={i} style={{ background: cardBg, border: "1px solid " + borderC, borderLeft: "3px solid " + platObj.color, borderRadius: 12, padding: "18px 20px", marginBottom: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.3)", transition: "all 0.2s ease" }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: mn, fontSize: 11, color: C.txm }}>Variation {i + 1}</span>
                    <span style={{ fontFamily: mn, fontSize: 9, color: C.violet, background: C.violet + "12", padding: "2px 8px", borderRadius: 4 }}>{posts.length} posts</span>
                  </div>
                  <div style={{ display: "flex", gap: 5 }}>
                    <CopyBtn text={fullText} />
                    <span onClick={function() { if (!isRegen) regenerateOne(platKey, i); }} style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.4)", cursor: isRegen ? "wait" : "pointer", padding: "3px 8px", borderRadius: 6, border: "1px solid " + borderC, opacity: isRegen ? 0.4 : 1, userSelect: "none", transition: "all 0.2s ease" }}>{isRegen ? "..." : "\u21BB"}</span>
                  </div>
                </div>
                {/* Thread posts */}
                {posts.map(function(post) {
                  return <div key={post.number} style={{ marginBottom: 10, padding: "12px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 8, border: "1px solid " + borderC }}>
                    <div style={{ fontFamily: mn, fontSize: 9, color: platObj.color, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: "1px" }}>Post {post.number}/{posts.length}</div>
                    <div style={{ fontFamily: ft, fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{post.text}</div>
                  </div>;
                })}
              </div>;
            }

            /* Standard single-post output */
            var cap = r.caption || "";
            return <div key={i} style={{ background: cardBg, border: "1px solid " + borderC, borderLeft: "3px solid " + platObj.color, borderRadius: 12, padding: "18px 20px", marginBottom: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.3)", transition: "all 0.2s ease" }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: mn, fontSize: 11, color: C.txm }}>Variation {i + 1}</span>
                  <span style={{ fontFamily: mn, fontSize: 9, color: C.txd }}>{charCount(cap)} chars</span>
                </div>
                <div style={{ display: "flex", gap: 5 }}>
                  <CopyBtn text={cap + (r.reply ? "\n\n[Reply]\n" + r.reply : "") + (r.title ? "\n\n[Title]\n" + r.title : "")} />
                  <span onClick={function() { if (!isRegen) regenerateOne(platKey, i); }} style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.4)", cursor: isRegen ? "wait" : "pointer", padding: "3px 8px", borderRadius: 6, border: "1px solid " + borderC, opacity: isRegen ? 0.4 : 1, userSelect: "none", transition: "all 0.2s ease" }}>{isRegen ? "..." : "\u21BB"}</span>
                </div>
              </div>

              {/* YouTube title */}
              {platKey === "youtube" && r.title && <div style={{ marginBottom: 10 }}>
                <div style={{ fontFamily: mn, fontSize: 9, color: C.txd, marginBottom: 4, textTransform: "uppercase", letterSpacing: "1px" }}>Title ({r.title.length} chars)</div>
                <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 700, color: C.tx, padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 6, border: "1px solid " + borderC }}>{r.title}</div>
              </div>}

              {/* Caption body */}
              <div style={{ fontFamily: ft, fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{cap}</div>

              {/* X reply format */}
              {platKey === "x" && r.reply && <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed " + borderC }}>
                <div style={{ fontFamily: mn, fontSize: 9, color: C.txd, marginBottom: 4, textTransform: "uppercase", letterSpacing: "1px" }}>Reply</div>
                <div style={{ fontFamily: ft, fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{r.reply}</div>
              </div>}
            </div>;
          })}
        </div>;
      })}
    </div>}
  </div>);
}

// ═══ PERSISTENCE ═══
var saveTimer = null;
function saveState(state, log) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(function() {
    fetch("/api/state", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: state, log: log }),
    }).catch(function(e) { console.error("Auto-save failed:", e); });
  }, 1000);
}

// ═══ CONFETTI ═══
function Confetti() {
  var pieces = useRef([]);
  if (pieces.current.length === 0) {
    var colors = [C.amber, C.blue, C.teal, C.coral, C.violet, "#26C9D8", "#56BC42", "#E8C83A"];
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
    {pieces.current.map(function(p, i) {
      return <div key={i} style={{
        position: "absolute", top: 0, left: p.left,
        width: p.shape === "circle" ? p.size : p.size * 0.6, height: p.size,
        borderRadius: p.shape === "circle" ? "50%" : "1px",
        background: p.color,
        "--drift": p.drift + "px", "--rot": p.rot + "deg",
        animation: "confetti-fall " + p.dur + " cubic-bezier(0.25,0.46,0.45,0.94) " + p.delay + " forwards",
      }} />;
    })}
  </div>;
}

// ═══ INTRO: USER SELECT → BOOT → GLITCH → SPLASH ═══
function UserSelect({ onSelect }) {
  var _h = useState(null), h = _h[0], sh = _h[1];
  var users = [
    { name: "Akash", role: "Director", color: "#0B86D1", glow: "rgba(11,134,209," },
    { name: "Vansh", role: "Social Media Manager", color: "#2EAD8E", glow: "rgba(46,173,142," },
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

function TerminalBoot({ user, onDone }) {
  var _lines = useState([]), lines = _lines[0], setLines = _lines[1];
  var bootLines = [
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

function GlitchTransition({ onDone }) {
  useEffect(function() { setTimeout(onDone, 350); }, []);
  return <div style={{ position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "none" }}>
    <style dangerouslySetInnerHTML={{ __html: "@keyframes gShake{0%{transform:translate(0)}25%{transform:translate(-3px,2px)}50%{transform:translate(3px,-2px)}75%{transform:translate(-2px,3px)}100%{transform:translate(0)}}@keyframes gFade{to{opacity:0}}" }} />
    <div style={{ position: "absolute", inset: 0, background: "white", opacity: 0.06, animation: "gFade 0.2s ease forwards" }} />
    <div style={{ position: "absolute", inset: 0, animation: "gShake 0.25s linear" }}>
      {[20, 45, 70, 85].map(function(t, i) { return <div key={i} style={{ position: "absolute", left: 0, right: 0, top: t + "%", height: 2 + Math.random() * 3, background: i % 2 === 0 ? "#ff000030" : "#00ff0030" }} />; })}
    </div>
  </div>;
}

function SplashScreen({ onNavigate }) {
  var _h = useState(null), h = _h[0], sh = _h[1];
  var sections = {
    PRODUCE: [{ l: "Slop Top", ic: "\uD83D\uDCA5", id: "sloptop" }, { l: "Carousel", ic: "\uD83D\uDCD0", id: "carousel" }, { l: "Capper", ic: "\uD83C\uDFAC", id: "captions" }, { l: "P2P", ic: "\uD83C\uDFAC", id: "p2p" }],
    PODCAST: [{ l: "Fab Knowledge", ic: "\uD83C\uDFA7", id: "fk" }, { l: "SA Weekly", ic: "\uD83C\uDF99", id: "weekly" }, { l: "Outreach", ic: "\uD83D\uDCE4", id: "outreach" }],
    PREPARE: [{ l: "Trends", ic: "\uD83D\uDD25", id: "trends" }, { l: "News Flow", ic: "\uD83D\uDCE1", id: "news" }, { l: "GTC Flow", ic: "\uD83D\uDCCA", id: "gtc" }],
    PREMIER: [{ l: "Schedule", ic: "\uD83D\uDCC6", id: "schedule" }],
  };
  var words = ["PRODUCE", "PODCAST", "PREPARE", "PREMIER"];
  var colors = [C.amber, C.coral, C.blue, C.teal];
  var glows = ["rgba(247,176,65,", "rgba(224,99,71,", "rgba(11,134,209,", "rgba(46,173,142,"];
  var appNames = { PRODUCE: "Slop Top, Carousel, Capper, P2P", PODCAST: "Fab Knowledge, SA Weekly, Outreach", PREPARE: "Trends, News Flow, GTC Flow", PREMIER: "Schedule" };

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
                return <div key={ii} onClick={function() { onNavigate(item.id); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 6, background: "#0A0A14", border: "1px solid " + colors[i] + "25", cursor: "pointer", transition: "all 0.15s", animation: "itemReveal 0.25s ease " + (ii * 0.06) + "s forwards", opacity: 0 }} onMouseEnter={function(e) { e.currentTarget.style.background = "#111120"; e.currentTarget.style.borderColor = colors[i] + "50"; e.currentTarget.style.boxShadow = "0 0 12px " + colors[i] + "15"; }} onMouseLeave={function(e) { e.currentTarget.style.background = "#0A0A14"; e.currentTarget.style.borderColor = colors[i] + "25"; e.currentTarget.style.boxShadow = "none"; }}>
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

function Intro({ onDone }) {
  var _phase = useState("select"), phase = _phase[0], setPhase = _phase[1];
  var _user = useState(null), user = _user[0], setUser = _user[1];
  var _glitch = useState(false), glitch = _glitch[0], setGlitch = _glitch[1];

  var handleUserSelect = function(name) { setUser(name); setPhase("boot"); try { var audio = new Audio("/splash-sound.mp3"); audio.volume = 0.7; audio.play().catch(function() {}); } catch (e) {} };
  var handleBootDone = function() { setGlitch(true); setTimeout(function() { setGlitch(false); setPhase("splash"); }, 350); };
  var handleNavigate = function(id) { onDone(id); };

  return <div>
    {phase === "select" && <UserSelect onSelect={handleUserSelect} />}
    {phase === "boot" && <TerminalBoot user={user} onDone={handleBootDone} />}
    {glitch && <GlitchTransition onDone={function() {}} />}
    {phase === "splash" && <SplashScreen onNavigate={handleNavigate} />}
  </div>;
}

// ═══ APP ═══
export default function App() {
  var _sp = useState(true), showIntro = _sp[0], setShowIntro = _sp[1];
  var _askPoast = useState(false), askPoastOpen = _askPoast[0], setAskPoastOpen = _askPoast[1];
  var _s = useState("weekly"), sec = _s[0], setSec = _s[1];
  // Listen for nav events from other components (e.g. News Flow Draft -> P2P)
  useEffect(function() {
    var handler = function(e) { if (e.detail) setSec(e.detail); };
    window.addEventListener("poast-nav", handler);
    return function() { window.removeEventListener("poast-nav", handler); };
  }, []);
  var _t = useState("setup"), tab = _t[0], setTab = _t[1];
  var _e = useState({ number: "008", link: "", transcript: "", timestamps: "", extra: "" }), ep = _e[0], setEp = _e[1];
  var _g = useState([]), guests = _g[0], setGuests = _g[1];
  var _o = useState(null), opts = _o[0], setOpts = _o[1];
  var _sl = useState({ title: 0, desc: 0, thumb: 0 }), sel = _sl[0], setSel = _sl[1];
  var _f = useState(null), fin = _f[0], setFin = _f[1];
  var _th = useState(null), thumb = _th[0], setThumb = _th[1];
  var _lch = useState(false), launched = _lch[0], setLaunched = _lch[1];
  var _log = useState([]), logData = _log[0], setLogData = _log[1];
  var _loaded = useState(false), loaded = _loaded[0], setLoaded = _loaded[1];
  var _hasDraft = useState(false), hasDraft = _hasDraft[0], setHasDraft = _hasDraft[1];
  var _interacted = useState(false), interacted = _interacted[0], setInteracted = _interacted[1];
  var draftRef = useRef(null);

  // Load only activity log on mount, check if draft exists
  useEffect(function() {
    fetch("/api/state").then(function(r) { return r.json(); }).then(function(d) {
      if (d.log && Array.isArray(d.log)) setLogData(d.log);
      if (d.state && (d.state.ep && d.state.ep.transcript || d.state.opts || d.state.fin)) {
        draftRef.current = d.state;
        setHasDraft(true);
      }
      setLoaded(true);
    }).catch(function() { setLoaded(true); });
  }, []);

  var loadDraft = function() {
    var s = draftRef.current;
    if (!s) return;
    if (s.ep) setEp(s.ep);
    if (s.guests) setGuests(s.guests);
    if (s.opts) setOpts(s.opts);
    if (s.sel) setSel(s.sel);
    if (s.fin) setFin(s.fin);
    if (s.thumb) setThumb(s.thumb);
    if (s.launched) setLaunched(s.launched);
    if (s.tab) setTab(s.tab);
    setHasDraft(false);
    draftRef.current = null;
    setInteracted(true);
  };

  // Auto-save only after user has interacted (not on initial load)
  useEffect(function() {
    if (!loaded || !interacted) return;
    // Exclude base64 thumbnail from save to stay under Redis 1MB limit
    saveState({ ep: ep, guests: guests, opts: opts, sel: sel, fin: fin, thumb: null, launched: launched, tab: tab }, logData);
  }, [ep, guests, opts, sel, fin, thumb, launched, tab, logData, loaded, interacted]);

  // Mark as interacted on any episode field change (after load)
  useEffect(function() {
    if (!loaded) return;
    if (ep.transcript || ep.link || guests.length > 0) setInteracted(true);
  }, [ep, guests, loaded]);

  var tabs = [{ id: "setup", l: "Episode Setup" }, { id: "test", l: "Test Page" }, { id: "launch", l: "Launch Rollout" }, { id: "clips", l: "Clip Manager" }, { id: "log", l: "Activity Log" }];
  var locks = [];
  if (!fin) { locks.push("test"); locks.push("launch"); }
  if (!launched) locks.push("clips");
  var gn = guests.filter(function(g) { return g.name; }).map(function(g) { return g.name; }).join(", ");

  var handleComplete = function(data) {
    setLaunched(true);
    var entry = { episode: ep.number, title: data.title, description: data.description, guests: gn, date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), social: data.social };
    setLogData(function(prev) { return [entry].concat(prev); });
  };

  if (showIntro) return <><Toast /><Intro onDone={function(id) { if (id) setSec(id); setShowIntro(false); }} /></>;

  return (<div style={{ background: C.bg, minHeight: "100vh", position: "relative" }}>
    <Toast />
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
      "::-webkit-scrollbar-thumb{background:#252535;border-radius:3px}",
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
      ".poast-card{position:relative;background:linear-gradient(135deg,#14141E,#101018);border:1px solid #252535;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.4);transition:all 0.2s ease}",
      ".poast-card:hover{border-color:rgba(247,176,65,0.3);box-shadow:0 8px 30px rgba(0,0,0,0.5),0 0 20px rgba(247,176,65,0.08);transform:translateY(-2px)}",
      // Buttons — gradient + glow
      "button,.poast-btn{transition:all 0.15s ease;font-family:'Outfit',sans-serif}",
      "button:active,.poast-btn:active{transform:scale(0.97)}",
      // Primary btn class
      ".btn-glow{background:linear-gradient(135deg,#F7B041,#E8A020);color:#06060C;border:none;border-radius:8px;font-weight:700;box-shadow:0 4px 14px rgba(247,176,65,0.25),0 0 20px rgba(247,176,65,0.1);cursor:pointer}",
      ".btn-glow:hover{box-shadow:0 6px 24px rgba(247,176,65,0.4),0 0 40px rgba(247,176,65,0.15);transform:translateY(-1px)}",
      // Ghost btn class
      ".btn-ghost{background:rgba(255,255,255,0.02);color:#8A8690;border:1px solid #252535;border-radius:8px;cursor:pointer}",
      ".btn-ghost:hover{border-color:rgba(247,176,65,0.4);color:#F7B041;background:rgba(247,176,65,0.04);box-shadow:0 0 12px rgba(247,176,65,0.08)}",
      // Transitions
      ".poast-fadein{animation:fadeInUp 0.4s ease forwards}",
      ".poast-section{animation:fadeIn 0.3s ease}",
      // Progress
      "@keyframes progressSlide{0%{left:-40%}100%{left:100%}}",
      ".progress-slide{animation:progressSlide 1.5s ease-in-out infinite}",
      "@keyframes dotPulse{0%,80%,100%{opacity:0.2}40%{opacity:1}}",
      ".progress-dots::after{content:'...';display:inline-block;animation:dotPulse 1.4s ease-in-out infinite}",
      // Ask Poast pulse
      "@keyframes askPulse{0%,100%{box-shadow:0 0 0 0 rgba(247,176,65,0.12)}50%{box-shadow:0 0 16px 4px rgba(247,176,65,0.08)}}",
      ".ask-pulse{animation:askPulse 3s ease-in-out infinite}",
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
      <div style={{ maxWidth: sec === "news" || sec === "schedule" || sec === "p2p" ? "none" : "none", margin: "0 auto", padding: "0 32px" }}>
        {sec === "weekly" && <div style={{ padding: "24px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", background: "#060608E0" }}>
          <div><div style={{ fontFamily: ft, fontSize: 42, fontWeight: 900, color: "#ffffff", letterSpacing: -2 }}>SemiAnalysis Weekly</div><div style={{ fontFamily: mn, fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 4, letterSpacing: "2px", textTransform: "uppercase" }}>{"Ep #" + ep.number + (gn ? " . " + gn : "") + (launched ? " . Launched" : fin ? " . Saved" : "")}</div></div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {hasDraft && <span onClick={loadDraft} style={{ fontFamily: mn, fontSize: 9, color: C.amber, cursor: "pointer", padding: "6px 12px", border: "1px solid " + C.amber + "40", borderRadius: 8, background: C.amber + "08", transition: "all 0.2s ease" }}>Load from Draft</span>}
            <a href="https://youtube.com/@SemianalysisWeekly" target="_blank" rel="noopener noreferrer" style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.4)", textDecoration: "none", padding: "6px 12px", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, transition: "all 0.2s ease" }}>@SemianalysisWeekly</a>
          </div>
        </div>}
        {sec === "weekly" && <TabBar items={tabs} active={tab} onPick={setTab} locks={locks} />}
        <div key={sec} className="poast-section" style={{ paddingBottom: 60 }}>
        {sec === "weekly" && tab === "setup" && <EpisodeSetup ep={ep} setEp={setEp} guests={guests} setGuests={setGuests} opts={opts} setOpts={setOpts} sel={sel} setSel={setSel} fin={fin} setFin={setFin} goTest={function() { setTab("test"); }} />}
        {sec === "weekly" && tab === "test" && <TestPage ep={ep} guests={guests} opts={opts} fin={fin} setFin={setFin} thumb={thumb} setThumb={setThumb} goLaunch={function() { setTab("launch"); }} />}
        {sec === "weekly" && tab === "launch" && <LaunchRollout ep={ep} guests={guests} fin={fin} onComplete={handleComplete} />}
        {sec === "weekly" && tab === "clips" && <ClipMgr />}
        {sec === "weekly" && tab === "log" && <LogTab logData={logData} setLogData={setLogData} />}
        {sec === "captions" && <ClipCaptions />}
        {sec === "carousel" && <Carousel />}
        {sec === "sloptop" && <SlopTop />}
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
    <div style={{ position: "fixed", bottom: 8, right: 12, zIndex: 2, fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.12)", letterSpacing: 1, pointerEvents: "none" }}>v2.0</div>
    {/* Mobile warning */}
    <style dangerouslySetInnerHTML={{ __html: "@media(min-width:769px){.mobile-warn{display:none!important}}" }} />
    <div className="mobile-warn" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999, padding: "14px 20px", background: "#111118", borderTop: "1px solid " + C.amber + "30", display: "flex", alignItems: "center", gap: 10 }}>
      <img src="/poast-logo.png" style={{ width: 28, height: 28, borderRadius: 6 }} />
      <div><div style={{ fontFamily: ft, fontSize: 13, fontWeight: 700, color: C.tx }}>POAST works best on desktop</div><div style={{ fontFamily: ft, fontSize: 11, color: "rgba(255,255,255,0.4)" }}>For the full experience, switch to a larger screen.</div></div>
    </div>
  </div>);
}
