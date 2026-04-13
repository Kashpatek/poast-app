// @ts-nocheck
"use client";
import { useState, useEffect, useRef } from "react";
import GTCFlow from "./gtc-flow";
import NewsFlow from "./news-flow";
import BufferSchedule from "./buffer-schedule";
import PressToPremi from "./press-to-premier";

var C = {
  amber: "#F7B041", blue: "#0B86D1", teal: "#2EAD8E", coral: "#E06347",
  violet: "#905CCB", cyan: "#26C9D8", crimson: "#D1334A",
  bg: "#06060C", card: "#14141E", border: "#252535", hover: "#181824",
  surface: "#101018", tx: "#E8E4DD", txm: "#8A8690", txd: "#4E4B56",
  glow: "0 2px 12px rgba(0,0,0,0.4), 0 0 0 0 rgba(247,176,65,0)",
  glowHover: "0 8px 30px rgba(0,0,0,0.5), 0 0 20px rgba(247,176,65,0.08)",
  cardGrad: "linear-gradient(135deg, #14141E 0%, #101018 100%)",
  surfGrad: "linear-gradient(135deg, #181824 0%, #14141E 100%)",
};
var PL = { x: "#1DA1F2", li: "#0A66C2", fb: "#1877F2", ig: "#E4405F", yt: "#FF0000", tt: "#00F2EA" };
var ft = "'Outfit',sans-serif";
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
  var html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a;padding:40px}h1{font-size:22px;color:#E8A830;border-bottom:2px solid #E8A830;padding-bottom:8px}h2{font-size:16px;color:#1A84C6;margin-top:24px}h3{font-size:13px;color:#333;margin-top:16px}.card{background:#f5f5f5;border-left:3px solid #E8A830;padding:12px 16px;margin:8px 0;white-space:pre-wrap}.meta{color:#888;font-size:11px;font-family:monospace}</style></head><body>';
  html += '<h1>SemiAnalysis Weekly - ' + title + '</h1>';
  sections.forEach(function(s) {
    html += '<h2>' + s.heading + '</h2>';
    if (s.items) s.items.forEach(function(it) { html += '<h3>' + it.label + '</h3><div class="card">' + (it.content || "").replace(/\n/g, "<br>") + '</div>'; });
    if (s.text) html += '<div class="card">' + s.text.replace(/\n/g, "<br>") + '</div>';
  });
  html += '</body></html>';
  var blob = new Blob([html], { type: "application/msword" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a"); a.href = url; a.download = "SA_Weekly_Launch_Rollout.doc"; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ═══ UI ═══
function Toast() {
  var _s = useState(null), msg = _s[0], setMsg = _s[1];
  _toastSet.current = function(m) { if (_toastTimer.current) clearTimeout(_toastTimer.current); setMsg(m); _toastTimer.current = setTimeout(function() { setMsg(null); }, 6000); };
  if (!msg) return null;
  return <div onClick={function() { setMsg(null); }} style={{ position: "fixed", bottom: 24, right: 24, zIndex: 10000, maxWidth: 420, padding: "14px 20px", background: C.coral + "20", border: "1px solid " + C.coral, borderRadius: 8, fontFamily: mn, fontSize: 11, color: C.coral, cursor: "pointer", boxShadow: "0 0 20px rgba(224,99,71,0.2)", lineHeight: 1.5 }}>{msg}</div>;
}

function ProgressBar({ label }) {
  return <div style={{ margin: "20px 0" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
      <div style={{ fontFamily: mn, fontSize: 10, color: C.amber, letterSpacing: "1px" }}>{label || "Generating..."}</div>
      <div className="progress-dots" style={{ fontFamily: mn, fontSize: 10, color: C.txm }} />
    </div>
    <div style={{ width: "100%", height: 3, background: C.border, borderRadius: 2, overflow: "hidden", position: "relative" }}>
      <div className="progress-slide" style={{ position: "absolute", top: 0, left: 0, height: "100%", width: "40%", borderRadius: 2, background: "linear-gradient(90deg, transparent, " + C.amber + ", transparent)" }} />
    </div>
  </div>;
}

function Label({ children }) { return <div style={{ fontFamily: mn, fontSize: 10, color: C.txm, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 6 }}>{children}</div>; }
function Field({ label, value, onChange, placeholder, isMono }) { return (<div style={{ marginBottom: 14 }}>{label && <Label>{label}</Label>}<input value={value} onChange={function(e) { onChange(e.target.value); }} placeholder={placeholder} style={{ width: "100%", padding: "10px 12px", background: C.card, border: "1px solid " + C.border, borderRadius: 6, color: C.tx, fontFamily: isMono ? mn : ft, fontSize: 13, outline: "none", boxSizing: "border-box" }} onFocus={function(e) { e.target.style.borderColor = C.amber; }} onBlur={function(e) { e.target.style.borderColor = C.border; }} /></div>); }
function Btn({ children, onClick, loading, sec, sm, off }) { return (<button onClick={onClick} disabled={loading || off} style={{ padding: sm ? "6px 13px" : "10px 24px", background: off ? C.surface : sec ? "transparent" : C.amber, color: off ? C.txd : sec ? C.amber : C.bg, border: sec ? "1px solid " + (off ? C.border : C.amber) : "none", borderRadius: 6, fontFamily: ft, fontSize: sm ? 11 : 13, fontWeight: 700, cursor: loading || off ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1 }}>{loading ? "Working..." : children}</button>); }
function CopyBtn({ text }) { var _s = useState(false), ok = _s[0], set = _s[1]; return <span onClick={function(e) { e.stopPropagation(); set(copyText(text)); setTimeout(function() { set(false); }, 1200); }} style={{ fontFamily: mn, fontSize: 9, color: ok ? C.amber : C.txd, cursor: "pointer", padding: "2px 6px", borderRadius: 3, border: "1px solid " + C.border, userSelect: "none" }}>{ok ? "Copied" : "Copy"}</span>; }
function Divider() { return <div style={{ borderBottom: "1px solid " + C.border, margin: "24px 0" }} />; }

function Pick({ text, picked, onPick, onRedo, rLoading }) {
  return (<div className="poast-card" onClick={onPick} style={{ background: picked ? "linear-gradient(135deg, " + C.amber + "0C 0%, " + C.amber + "08 100%)" : C.cardGrad, border: "1px solid " + (picked ? C.amber : C.border), borderRadius: 7, padding: "12px 16px", marginBottom: 7, cursor: "pointer", boxShadow: picked ? C.glow : "none" }}>
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, marginTop: 2, border: "2px solid " + (picked ? C.amber : C.border), background: picked ? C.amber : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>{picked && <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.bg }} />}</div>
      <div style={{ flex: 1, fontFamily: ft, fontSize: 13, color: C.tx, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{text}</div>
      <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
        <CopyBtn text={text} />
        {onRedo && <span onClick={function(e) { e.stopPropagation(); if (!rLoading) onRedo(); }} style={{ fontFamily: mn, fontSize: 9, color: C.txd, cursor: rLoading ? "wait" : "pointer", padding: "2px 6px", borderRadius: 3, border: "1px solid " + C.border, opacity: rLoading ? 0.4 : 1, userSelect: "none" }}>&#x21bb;</span>}
      </div>
    </div>
  </div>);
}

function SecHead({ label, onRedoAll, rL }) {
  return (<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
    <div style={{ fontFamily: mn, fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: "2px" }}>{label}</div>
    {onRedoAll && <span onClick={function() { if (!rL) onRedoAll(); }} style={{ fontFamily: mn, fontSize: 9, color: C.txd, cursor: rL ? "wait" : "pointer", padding: "3px 8px", borderRadius: 4, border: "1px solid " + C.border, opacity: rL ? 0.4 : 1 }}>&#x21bb; Redo All 3</span>}
  </div>);
}

function OutCard({ title, content, color, onRedo, rLoading }) {
  return (<div className="poast-card" style={{ background: C.cardGrad, border: "1px solid " + C.border, borderLeft: "3px solid " + (color || C.amber), borderRadius: 7, padding: "13px 16px", marginBottom: 8, boxShadow: C.glow }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
      <div style={{ fontFamily: mn, fontSize: 10, color: color || C.amber, textTransform: "uppercase", letterSpacing: "1.5px" }}>{title}</div>
      <div style={{ display: "flex", gap: 4 }}>
        <CopyBtn text={content} />
        {onRedo && <span onClick={function() { if (!rLoading) onRedo(); }} style={{ fontFamily: mn, fontSize: 9, color: C.txd, cursor: rLoading ? "wait" : "pointer", padding: "2px 6px", borderRadius: 3, border: "1px solid " + C.border, opacity: rLoading ? 0.4 : 1, userSelect: "none" }}>&#x21bb;</span>}
      </div>
    </div>
    <div style={{ fontFamily: ft, fontSize: 13, color: C.tx, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{content}</div>
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
  var scrollRef = useRef(null);

  useEffect(function() {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs]);

  var send = async function() {
    if (!input.trim() || loading) return;
    var userMsg = input.trim();
    setInput("");
    setMsgs(function(p) { return p.concat([{ role: "user", text: userMsg }]); });
    setLoading(true);
    try {
      // Build conversation for context
      var history = msgs.concat([{ role: "user", text: userMsg }]);
      var prompt = history.map(function(m) { return (m.role === "user" ? "User: " : "Poast: ") + m.text; }).join("\n\n");
      var r = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: POAST_SYS, prompt: prompt }),
      });
      var d = await r.json();
      var reply = (d.content || []).map(function(c) { return c.text || ""; }).join("");
      setMsgs(function(p) { return p.concat([{ role: "assistant", text: reply }]); });
    } catch (e) {
      setMsgs(function(p) { return p.concat([{ role: "assistant", text: "Something went wrong. Try again." }]); });
    }
    setLoading(false);
  };

  var exportDoc = function() {
    var content = msgs.map(function(m) { return (m.role === "user" ? "YOU:\n" : "POAST:\n") + m.text; }).join("\n\n---\n\n");
    var blob = new Blob([content], { type: "text/plain" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a"); a.href = url; a.download = "poast-conversation.txt"; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  if (!open) return null;

  return (
    <div style={{ position: "fixed", right: 20, bottom: 20, width: 420, height: 560, background: C.card, border: "1px solid " + C.amber + "30", borderRadius: 14, boxShadow: "0 0 40px rgba(247,176,65,0.1), 0 8px 32px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", zIndex: 9998, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid " + C.border, background: "linear-gradient(90deg, " + C.amber + "08, transparent)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: C.amber + "20", border: "1px solid " + C.amber + "40", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: ft, fontSize: 14, fontWeight: 900, color: C.amber }}>P</div>
          <div>
            <div style={{ fontFamily: ft, fontSize: 13, fontWeight: 700, color: C.tx }}>Ask Poast</div>
            <div style={{ fontFamily: mn, fontSize: 8, color: C.txd }}>SA Content AI</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {msgs.length > 0 && <span onClick={exportDoc} style={{ fontFamily: mn, fontSize: 8, color: C.txd, cursor: "pointer", padding: "3px 6px", borderRadius: 3, border: "1px solid " + C.border }}>Export</span>}
          {msgs.length > 0 && <span onClick={function() { setMsgs([]); }} style={{ fontFamily: mn, fontSize: 8, color: C.txd, cursor: "pointer", padding: "3px 6px", borderRadius: 3, border: "1px solid " + C.border }}>Clear</span>}
          <span onClick={onToggle} style={{ fontFamily: mn, fontSize: 14, color: C.txd, cursor: "pointer", padding: "2px 6px" }}>&times;</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflow: "auto", padding: "12px 16px" }}>
        {msgs.length === 0 && <div style={{ textAlign: "center", padding: "40px 10px" }}>
          <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: C.tx, marginBottom: 8 }}>What can I help with?</div>
          <div style={{ fontFamily: ft, fontSize: 11, color: C.txm, lineHeight: 1.7, marginBottom: 16 }}>I know SemiAnalysis brand rules, all platform formats, and can create content, docs, and ideas.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {["Write an X thread about NVIDIA earnings", "Draft a LinkedIn post for our latest episode", "Give me 5 content ideas about AI infrastructure", "Create an outreach email template for podcast guests"].map(function(s, i) {
              return <span key={i} onClick={function() { setInput(s); }} style={{ fontFamily: ft, fontSize: 11, color: C.amber, cursor: "pointer", padding: "8px 12px", background: C.surface, borderRadius: 6, border: "1px solid " + C.border, textAlign: "left" }}>{s}</span>;
            })}
          </div>
        </div>}
        {msgs.map(function(m, i) {
          var isUser = m.role === "user";
          return <div key={i} style={{ marginBottom: 12, display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth: "85%", padding: "10px 14px", borderRadius: isUser ? "12px 12px 2px 12px" : "12px 12px 12px 2px", background: isUser ? C.amber + "18" : C.surface, border: "1px solid " + (isUser ? C.amber + "25" : C.border) }}>
              <div style={{ fontFamily: ft, fontSize: 12, color: C.tx, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{m.text}</div>
            </div>
          </div>;
        })}
        {loading && <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 12 }}>
          <div style={{ padding: "10px 14px", borderRadius: "12px 12px 12px 2px", background: C.surface, border: "1px solid " + C.border }}>
            <style dangerouslySetInnerHTML={{ __html: "@keyframes poastDot{0%,80%,100%{opacity:0.2}40%{opacity:1}}" }} />
            <span style={{ fontFamily: mn, fontSize: 12, color: C.amber }}>
              <span style={{ animation: "poastDot 1.4s ease-in-out infinite" }}>.</span>
              <span style={{ animation: "poastDot 1.4s ease-in-out 0.2s infinite" }}>.</span>
              <span style={{ animation: "poastDot 1.4s ease-in-out 0.4s infinite" }}>.</span>
            </span>
          </div>
        </div>}
      </div>

      {/* Input */}
      <div style={{ padding: "10px 12px", borderTop: "1px solid " + C.border, display: "flex", gap: 8 }}>
        <input value={input} onChange={function(e) { setInput(e.target.value); }} onKeyDown={function(e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Ask anything..." style={{ flex: 1, padding: "10px 12px", background: C.surface, border: "1px solid " + C.border, borderRadius: 8, color: C.tx, fontFamily: ft, fontSize: 12, outline: "none" }} />
        <span onClick={send} style={{ padding: "10px 14px", background: C.amber, color: C.bg, borderRadius: 8, fontFamily: ft, fontSize: 12, fontWeight: 700, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.5 : 1, display: "flex", alignItems: "center" }}>Send</span>
      </div>
    </div>
  );
}

// ═══ SIDEBAR ═══
// ═══ SIDEBAR CATEGORIES ═══
var SIDEBAR_CATS = {
  produce: { label: "PRODUCE", color: C.amber, glow: "rgba(247,176,65,", items: [
    { id: "weekly", l: "SA Weekly", ic: "\uD83C\uDF99" },
    { id: "p2p", l: "Press to Premier", ic: "\uD83C\uDFAC" },
    { id: "captions", l: "Capper", ic: "\uD83C\uDFAC" },
  ]},
  prepare: { label: "PREPARE", color: C.blue, glow: "rgba(11,134,209,", items: [
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
    <div style={{ padding: "28px 22px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ fontFamily: ft, fontSize: 24, fontWeight: 900, color: C.amber, letterSpacing: 2 }}>POAST</div>
      <div style={{ fontFamily: ft, fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.2)", letterSpacing: 3, marginTop: 4, textTransform: "uppercase" }}>Content Command Center</div>
    </div>

    {/* Ask Poast */}
    <div style={{ padding: "16px 14px 0" }}>
      <div className="ask-pulse" onClick={onAskPoast} style={{ padding: "14px 14px", borderRadius: 10, cursor: "pointer", background: "linear-gradient(135deg, " + C.amber + "15, " + C.amber + "06)", border: "1px solid " + C.amber + "25", display: "flex", alignItems: "center", gap: 10, transition: "all 0.2s" }} onMouseEnter={function(e) { e.currentTarget.style.boxShadow = "0 0 20px " + C.amber + "18"; e.currentTarget.style.borderColor = C.amber + "50"; }} onMouseLeave={function(e) { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = C.amber + "25"; }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, " + C.amber + "25, " + C.amber + "10)", border: "1px solid " + C.amber + "30", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: ft, fontSize: 16, fontWeight: 900, color: C.amber, boxShadow: "0 0 14px " + C.amber + "15" }}>P</div>
        <div>
          <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: C.amber }}>Ask Poast</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 5, height: 5, borderRadius: "50%", background: C.teal, boxShadow: "0 0 6px " + C.teal + "60" }} /><span style={{ fontFamily: ft, fontSize: 9, color: "rgba(255,255,255,0.25)" }}>online</span></div>
        </div>
      </div>
    </div>

    {/* Categories */}
    <div style={{ padding: "12px 10px", flex: 1, overflow: "auto" }}>
      {Object.keys(SIDEBAR_CATS).map(function(catKey) {
        var cat = SIDEBAR_CATS[catKey];
        var isCatActive = activeCat === catKey;
        return <div key={catKey} style={{ marginBottom: 8 }}>
          {/* Category label */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px" }}>
            <div style={{ width: 4, height: 18, borderRadius: 2, background: isCatActive ? cat.color : "rgba(255,255,255,0.08)", boxShadow: isCatActive ? "0 0 10px " + cat.color + "60, 0 0 20px " + cat.color + "20" : "none", transition: "all 0.25s" }} />
            <span style={{ fontFamily: ft, fontSize: 12, fontWeight: 800, color: isCatActive ? cat.color : "rgba(255,255,255,0.25)", letterSpacing: 2, textTransform: "uppercase", transition: "all 0.25s", textShadow: isCatActive ? "0 0 16px " + cat.glow + "0.4), 0 0 30px " + cat.glow + "0.12)" : "none" }}>{cat.label}</span>
          </div>
          {/* Items */}
          {cat.items.map(function(item) {
            var isActive = active === item.id;
            return <div key={item.id} onClick={function() { onNav(item.id); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px 11px 30px", borderRadius: 8, marginBottom: 2, cursor: "pointer", background: isActive ? cat.color + "0C" : "transparent", borderLeft: isActive ? "3px solid " + cat.color : "3px solid transparent", transition: "all 0.2s", position: "relative" }} onMouseEnter={function(e) { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }} onMouseLeave={function(e) { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
              {isActive && <div style={{ position: "absolute", left: 0, top: "10%", width: 3, height: "80%", background: cat.color, borderRadius: 2, boxShadow: "0 0 12px " + cat.color + "70, 0 0 24px " + cat.color + "25" }} />}
              {isActive && <div style={{ position: "absolute", left: 0, top: 0, width: "50%", height: "100%", background: "radial-gradient(ellipse at left center, " + cat.color + "08, transparent 70%)", pointerEvents: "none" }} />}
              <span style={{ fontSize: 16, filter: isActive ? "brightness(1.3) saturate(1.2)" : "brightness(0.5) saturate(0.5)", transition: "filter 0.2s" }}>{item.ic}</span>
              <span style={{ fontFamily: ft, fontSize: 14, fontWeight: isActive ? 800 : 500, color: isActive ? cat.color : "rgba(255,255,255,0.4)", transition: "all 0.2s", textShadow: isActive ? "0 0 20px " + cat.glow + "0.5), 0 0 40px " + cat.glow + "0.12)" : "none" }}>{item.l}</span>
              {isActive && <div style={{ width: 6, height: 6, borderRadius: "50%", background: cat.color, marginLeft: "auto", boxShadow: "0 0 8px " + cat.color + "70, 0 0 16px " + cat.color + "30" }} />}
            </div>;
          })}
        </div>;
      })}
    </div>

    {/* Footer */}
    <div style={{ padding: "14px 18px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ fontFamily: ft, fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.12)", letterSpacing: 2 }}>v0.8 // SEMIANALYSIS</div>
    </div>
  </div>);
}

function TabBar({ items, active, onPick, locks }) {
  return (<div style={{ display: "flex", borderBottom: "1px solid " + C.border, marginBottom: 24, background: C.bg, flexWrap: "wrap" }}>
    {items.map(function(t) { var s = active === t.id, lk = locks && locks.indexOf(t.id) >= 0; return (<div key={t.id} onClick={function() { if (!lk) onPick(t.id); }} style={{ padding: "12px 18px", cursor: lk ? "not-allowed" : "pointer", fontFamily: ft, fontSize: 12, fontWeight: s ? 700 : 500, color: lk ? C.txd : s ? C.amber : C.txm, borderBottom: s ? "2px solid " + C.amber : "2px solid transparent", opacity: lk ? 0.35 : 1, display: "flex", alignItems: "center", gap: 5 }}>{t.l}{lk && <span style={{ fontFamily: mn, fontSize: 7, background: C.surface, padding: "1px 5px", borderRadius: 3, color: C.txd }}>locked</span>}</div>); })}
  </div>);
}

function GuestManager({ guests, setGuests }) {
  return (<div style={{ marginBottom: 18 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}><Label>Guests</Label><span onClick={function() { setGuests(guests.concat([{ name: "", handle: "" }])); }} style={{ fontFamily: mn, fontSize: 10, color: C.amber, cursor: "pointer", padding: "3px 8px", borderRadius: 4, border: "1px solid " + C.border }}>+ Add</span></div>
    {guests.length === 0 && <div onClick={function() { setGuests([{ name: "", handle: "" }]); }} style={{ background: C.card, border: "1px dashed " + C.border, borderRadius: 6, padding: "14px", cursor: "pointer", textAlign: "center", fontFamily: ft, fontSize: 12, color: C.txd }}>Click to add guests</div>}
    {guests.map(function(g, i) { return (<div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
      <input value={g.name} onChange={function(e) { var c = guests.slice(); c[i] = { name: e.target.value, handle: g.handle }; setGuests(c); }} placeholder="Name" style={{ flex: 1, padding: "8px 10px", background: C.card, border: "1px solid " + C.border, borderRadius: 5, color: C.tx, fontFamily: ft, fontSize: 13, outline: "none" }} />
      <input value={g.handle} onChange={function(e) { var c = guests.slice(); c[i] = { name: g.name, handle: e.target.value }; setGuests(c); }} placeholder="@handle" style={{ flex: 1, padding: "8px 10px", background: C.card, border: "1px solid " + C.border, borderRadius: 5, color: C.tx, fontFamily: mn, fontSize: 12, outline: "none" }} />
      <span onClick={function() { setGuests(guests.filter(function(_, j) { return j !== i; })); }} style={{ fontFamily: mn, fontSize: 11, color: C.txd, cursor: "pointer", padding: "4px 8px" }}>x</span>
    </div>); })}
  </div>);
}

function KeywordBar({ onSuggest, loading }) {
  var _s = useState(""), kw = _s[0], setKw = _s[1];
  return (<div style={{ display: "flex", gap: 6, marginTop: 8, marginBottom: 12 }}>
    <input value={kw} onChange={function(e) { setKw(e.target.value); }} placeholder="Keywords to refine titles (e.g. TSMC, GPU shortage)" onKeyDown={function(e) { if (e.key === "Enter" && kw.trim()) { onSuggest(kw.trim()); setKw(""); } }} style={{ flex: 1, padding: "8px 10px", background: C.card, border: "1px solid " + C.border, borderRadius: 5, color: C.tx, fontFamily: mn, fontSize: 11, outline: "none" }} />
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
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <Label>Full Transcript</Label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 5, cursor: "pointer", background: C.surface, border: "1px solid " + C.border, fontFamily: mn, fontSize: 10, color: C.amber }}>Upload .txt<input type="file" accept=".txt,.text" style={{ display: "none" }} onChange={function(e) { var f = e.target.files && e.target.files[0]; if (!f) return; var r = new FileReader(); r.onload = function(ev) { setEp(Object.assign({}, ep, { transcript: ev.target.result })); }; r.readAsText(f); e.target.value = ""; }} /></label>
      </div>
      <div onDragOver={function(e) { e.preventDefault(); e.currentTarget.style.borderColor = C.amber; }} onDragLeave={function(e) { e.currentTarget.style.borderColor = C.border; }} onDrop={function(e) { e.preventDefault(); e.currentTarget.style.borderColor = C.border; var f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) { var r = new FileReader(); r.onload = function(ev) { setEp(Object.assign({}, ep, { transcript: ev.target.result })); }; r.readAsText(f); } }} style={{ position: "relative", border: "1px solid " + C.border, borderRadius: 7, background: C.card }}>
        {!ep.transcript && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 1 }}><div style={{ fontFamily: ft, fontSize: 13, color: C.txd }}>Drop .txt or paste transcript</div></div>}
        <textarea value={ep.transcript} onChange={function(e) { setEp(Object.assign({}, ep, { transcript: e.target.value })); }} rows={10} style={{ width: "100%", padding: "12px 14px", background: "transparent", border: "none", borderRadius: 7, color: C.tx, fontFamily: mn, fontSize: 11, outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.6, position: "relative", zIndex: 2, minHeight: 140 }} />
      </div>
      {ep.transcript && <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}><span style={{ fontFamily: mn, fontSize: 9, color: C.txd }}>{ep.transcript.length.toLocaleString()} chars</span><span onClick={function() { setEp(Object.assign({}, ep, { transcript: "" })); }} style={{ fontFamily: mn, fontSize: 9, color: C.txd, cursor: "pointer" }}>Clear</span></div>}
    </div>

    {/* Timestamps */}
    <div style={{ marginBottom: 16 }}>
      <Label>Timestamps (optional)</Label>
      <textarea value={ep.timestamps || ""} onChange={function(e) { setEp(Object.assign({}, ep, { timestamps: e.target.value })); }} rows={4} placeholder={"(00:00) Cold open\n(02:06) Introduction\n(05:10) Supply chain choke points"} style={{ width: "100%", padding: "10px 12px", background: C.card, border: "1px solid " + C.border, borderRadius: 6, color: C.tx, fontFamily: mn, fontSize: 11, outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.6 }} onFocus={function(e) { e.target.style.borderColor = C.amber; }} onBlur={function(e) { e.target.style.borderColor = C.border; }} />
      <div style={{ fontFamily: mn, fontSize: 9, color: C.txd, marginTop: 4 }}>Added to end of generated descriptions.</div>
    </div>

    {/* Additional Info */}
    <div style={{ marginBottom: 16 }}>
      <Label>Additional Info (optional)</Label>
      <textarea value={ep.extra || ""} onChange={function(e) { setEp(Object.assign({}, ep, { extra: e.target.value })); }} rows={2} placeholder="Key topics, sponsor mentions, angles to emphasize..." style={{ width: "100%", padding: "10px 12px", background: C.card, border: "1px solid " + C.border, borderRadius: 6, color: C.tx, fontFamily: ft, fontSize: 13, outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.5 }} onFocus={function(e) { e.target.style.borderColor = C.amber; }} onBlur={function(e) { e.target.style.borderColor = C.border; }} />
    </div>

    {/* Desc length */}
    <div style={{ marginBottom: 20 }}>
      <Label>Description Length</Label>
      <div style={{ display: "flex", gap: 6 }}>
        {[{ id: "short", l: "Short", sub: "2-4 sentences" }, { id: "medium", l: "Medium", sub: "2 paragraphs" }, { id: "long", l: "Long", sub: "3-5 paragraphs" }].map(function(m) { var s2 = descLen === m.id; return <div key={m.id} onClick={function() { setDescLen(m.id); }} style={{ flex: 1, padding: "10px 14px", borderRadius: 6, cursor: "pointer", background: s2 ? C.amber + "12" : C.card, border: "1px solid " + (s2 ? C.amber : C.border), textAlign: "center" }}><div style={{ fontFamily: ft, fontSize: 13, fontWeight: s2 ? 700 : 500, color: s2 ? C.amber : C.tx }}>{m.l}</div><div style={{ fontFamily: mn, fontSize: 9, color: s2 ? C.amber : C.txd, marginTop: 2 }}>{m.sub}</div></div>; })}
      </div>
    </div>

    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <Btn onClick={genAll} loading={loading} off={!ep.transcript}>Generate Options</Btn>
      {opts && <Btn onClick={genAll} loading={loading} sec sm>Full Regen</Btn>}
      {!ep.transcript && <span style={{ fontFamily: mn, fontSize: 10, color: C.txd }}>Paste or upload a transcript first</span>}
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
      <div className="poast-card" style={{ background: C.surfGrad, border: "1px solid " + C.border, borderRadius: 8, padding: 20, marginBottom: 20, boxShadow: C.glow }}>
        <div style={{ fontFamily: mn, fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: "2px", marginBottom: 14 }}>Your Selections</div>
        <div style={{ marginBottom: 14 }}><div style={{ fontFamily: mn, fontSize: 9, color: C.txm, marginBottom: 3 }}>TITLE</div><div style={{ fontFamily: ft, fontSize: 15, color: C.tx, fontWeight: 600 }}>{opts.titles && opts.titles[sel.title]}</div></div>
        <div style={{ marginBottom: 14 }}><div style={{ fontFamily: mn, fontSize: 9, color: C.txm, marginBottom: 3 }}>DESCRIPTION</div><div style={{ fontFamily: ft, fontSize: 13, color: C.tx, lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: 150, overflow: "auto" }}>{opts.descriptions && opts.descriptions[sel.desc]}</div></div>
        <div><div style={{ fontFamily: mn, fontSize: 9, color: C.txm, marginBottom: 3 }}>THUMBNAIL CONCEPT</div><div style={{ fontFamily: ft, fontSize: 13, color: C.tx, lineHeight: 1.6 }}>{thTxt(opts.thumbnails && opts.thumbnails[sel.thumb])}</div></div>
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

  if (!fin) return <div style={{ textAlign: "center", padding: 80, color: C.txd, fontFamily: ft }}>Save selections in Episode Setup first.</div>;
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
    <div style={{ fontFamily: ft, fontSize: 20, fontWeight: 800, color: C.tx, marginBottom: 4 }}>Test Page</div>
    <div style={{ fontFamily: mn, fontSize: 10, color: C.txm, marginBottom: 28 }}>Preview, double check, A/B test, then finalize.</div>
    <div className="poast-card" style={{ background: C.cardGrad, border: "1px solid " + C.border, borderRadius: 10, overflow: "hidden", marginBottom: 24, boxShadow: C.glow }}>
      <div style={{ width: "100%", aspectRatio: "16/9", background: C.surface, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>{thumb ? <img src={thumb} alt="Thumb" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ textAlign: "center" }}><div style={{ fontFamily: ft, fontSize: 15, color: C.txd }}>Thumbnail Preview</div></div>}<div style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.8)", borderRadius: 3, padding: "2px 6px", fontFamily: mn, fontSize: 10, color: "#fff" }}>42:18</div></div>
      <div style={{ padding: "14px 16px" }}><div style={{ fontFamily: ft, fontSize: 15, fontWeight: 700, color: C.tx, lineHeight: 1.4, marginBottom: 8 }}>{fin.title}</div><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 28, height: 28, borderRadius: "50%", background: C.amber, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: ft, fontSize: 11, fontWeight: 800, color: C.bg }}>SA</div><div style={{ fontFamily: ft, fontSize: 12, color: C.txm, fontWeight: 600 }}>SemiAnalysis Weekly</div></div></div>
    </div>
    <div className="poast-card" style={{ background: C.cardGrad, border: "1px solid " + C.border, borderRadius: 8, padding: 18, marginBottom: 20, boxShadow: C.glow }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><div style={{ fontFamily: mn, fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: "1.5px" }}>Description</div><CopyBtn text={fin.description} /></div><div style={{ fontFamily: ft, fontSize: 13, color: C.tx, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{fin.description}</div></div>
    <div className="poast-card" style={{ background: C.cardGrad, border: "1px solid " + C.border, borderRadius: 8, padding: 18, marginBottom: 24, boxShadow: C.glow }}><div style={{ fontFamily: mn, fontSize: 10, color: C.violet, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 8 }}>Thumbnail Concept</div><div style={{ fontFamily: ft, fontSize: 13, color: C.tx, lineHeight: 1.6 }}>{thS}</div></div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
      <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, background: C.card, border: "2px dashed " + C.border, borderRadius: 8, cursor: "pointer" }}><div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: C.amber, marginBottom: 3 }}>A. Upload Thumbnail</div><div style={{ fontFamily: mn, fontSize: 10, color: C.txd }}>PNG, JPG, 1280x720</div><input type="file" accept="image/*" style={{ display: "none" }} onChange={function(e) { var f = e.target.files && e.target.files[0]; if (!f) return; var r = new FileReader(); r.onload = function(ev) { setThumb(ev.target.result); }; r.readAsDataURL(f); e.target.value = ""; }} /></label>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, background: C.card, border: "2px dashed " + C.border, borderRadius: 8, opacity: 0.35 }}><div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: C.txm, marginBottom: 3 }}>B. Get One Prompted</div><div style={{ fontFamily: mn, fontSize: 10, color: C.txd }}>Coming Soon</div></div>
    </div>
    {thumb && <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20 }}><span style={{ fontFamily: mn, fontSize: 10, color: C.teal }}>Thumbnail uploaded</span><span onClick={function() { setThumb(null); }} style={{ fontFamily: mn, fontSize: 9, color: C.txd, cursor: "pointer" }}>Remove</span></div>}
    <Divider />
    <div style={{ marginBottom: 24 }}><div style={{ fontFamily: ft, fontSize: 16, fontWeight: 700, color: C.tx, marginBottom: 8 }}>Double Check</div><Btn onClick={doubleCheck} loading={checkL} sec>Run Double Check</Btn>
      {checkL && <ProgressBar label="Evaluating cohesion" />}
      {checkR && <div className="poast-card" style={{ background: C.cardGrad, border: "1px solid " + C.border, borderRadius: 8, padding: 18, marginTop: 14, boxShadow: C.glow }}><div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}><div style={{ width: 48, height: 48, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: (checkR.score >= 8 ? C.teal : checkR.score >= 5 ? C.amber : C.coral) + "20", border: "2px solid " + (checkR.score >= 8 ? C.teal : checkR.score >= 5 ? C.amber : C.coral), fontFamily: mn, fontSize: 18, fontWeight: 700, color: checkR.score >= 8 ? C.teal : checkR.score >= 5 ? C.amber : C.coral }}>{checkR.score}</div><div><div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: C.tx }}>Cohesion Score</div></div></div><div style={{ fontFamily: ft, fontSize: 13, color: C.tx, lineHeight: 1.6, marginBottom: 12 }}>{checkR.feedback}</div>{checkR.suggestions && checkR.suggestions.map(function(s, i) { return <div key={i} style={{ fontFamily: ft, fontSize: 12, color: C.txm, paddingLeft: 10, borderLeft: "2px solid " + C.border, marginBottom: 4 }}>{s}</div>; })}</div>}
    </div>
    <Divider />
    <div style={{ marginBottom: 24 }}><div style={{ fontFamily: ft, fontSize: 16, fontWeight: 700, color: C.tx, marginBottom: 8 }}>A/B Testing</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>{[{ id: "title", l: "Title Only" }, { id: "thumbnail", l: "Thumbnail Only" }, { id: "both", l: "Title + Thumbnail" }].map(function(m) { var s2 = abM === m.id; return <div key={m.id} onClick={function() { setAbM(m.id); }} style={{ padding: "7px 14px", borderRadius: 5, cursor: "pointer", background: s2 ? C.amber + "15" : C.card, border: "1px solid " + (s2 ? C.amber : C.border), fontFamily: mn, fontSize: 10, color: s2 ? C.amber : C.txm }}>{m.l}</div>; })}</div>
      <div style={{ display: "flex", gap: 8 }}><Btn onClick={runAB} loading={abL} sec>Run A/B Test</Btn>{abR && <Btn onClick={function() { setAbR(null); runAB(); }} loading={abL} sec sm>Redo Fresh</Btn>}</div>
      {abL && <ProgressBar label="Running A/B analysis" />}
      {abR && abR.option_a && abR.option_b && <div style={{ marginTop: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          {[{ key: "option_a", label: "Option A // Current", color: C.txm }, { key: "option_b", label: "Option B // Recommended", color: C.amber }].map(function(col) {
            var opt = abR[col.key];
            return <div key={col.key} className="poast-card" style={{ background: C.cardGrad, border: "1px solid " + (col.key === "option_b" ? C.amber + "40" : C.border), borderRadius: 8, padding: 18, boxShadow: C.glow }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontFamily: mn, fontSize: 9, color: col.color, textTransform: "uppercase", letterSpacing: "1.5px" }}>{col.label}</div>
                <div style={{ width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: col.color + "18", border: "2px solid " + col.color, fontFamily: mn, fontSize: 15, fontWeight: 700, color: col.color }}>{opt.score}</div>
              </div>
              {opt.title && <div style={{ marginBottom: 10 }}><div style={{ fontFamily: mn, fontSize: 9, color: C.txd, marginBottom: 3 }}>TITLE</div><div style={{ fontFamily: ft, fontSize: 13, color: C.tx, fontWeight: 600 }}>{opt.title}</div></div>}
              {opt.thumbnail_concept && <div style={{ marginBottom: 10 }}><div style={{ fontFamily: mn, fontSize: 9, color: C.txd, marginBottom: 3 }}>THUMBNAIL</div><div style={{ fontFamily: ft, fontSize: 12, color: C.tx }}>{opt.thumbnail_concept}</div></div>}
              <div style={{ fontFamily: ft, fontSize: 11, color: C.txm, lineHeight: 1.5, borderTop: "1px solid " + C.border, paddingTop: 10, marginTop: 6 }}>{opt.reasoning}</div>
            </div>;
          })}
        </div>
        <div style={{ background: C.surfGrad, border: "1px solid " + C.border, borderRadius: 6, padding: "12px 16px", marginBottom: 14 }}>
          <div style={{ fontFamily: ft, fontSize: 12, color: C.tx, lineHeight: 1.5 }}>{abR.verdict}</div>
        </div>
        <Btn onClick={applyAB} sm>Apply Option B</Btn>
      </div>}
    </div>
    <Divider />
    <div style={{ background: locked ? C.teal + "10" : C.surface, border: "1px solid " + (locked ? C.teal : C.border), borderRadius: 8, padding: 20 }}>
      <div style={{ fontFamily: ft, fontSize: 16, fontWeight: 700, color: locked ? C.teal : C.tx, marginBottom: 6 }}>{locked ? "Finalized" : "Ready to Finalize?"}</div>
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

  if (!fin) return <div style={{ textAlign: "center", padding: 80, color: C.txd, fontFamily: ft }}>Complete Episode Setup and Test Page first.</div>;
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
    <div className="poast-card" style={{ background: "linear-gradient(135deg," + C.card + " 0%," + C.surface + " 50%," + C.card + " 100%)", border: "1px solid " + C.border, borderRadius: 10, padding: 22, marginBottom: 22, boxShadow: C.glow }}>
      <div style={{ fontFamily: mn, fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: "2px", marginBottom: 6 }}>{"Episode #" + ep.number + " // Full Launch"}</div>
      <div style={{ fontFamily: ft, fontSize: 20, fontWeight: 800, color: C.tx }}>{fin.title}</div>
      <div style={{ fontFamily: ft, fontSize: 12, color: C.txm, marginTop: 4 }}>{gs}</div>
    </div>
    <div style={{ marginBottom: 16 }}><Label>Hook / Angle</Label><textarea value={hook} onChange={function(e) { setHook(e.target.value); }} rows={3} style={{ width: "100%", padding: "10px 12px", background: C.card, border: "1px solid " + C.border, borderRadius: 6, color: C.tx, fontFamily: ft, fontSize: 13, outline: "none", boxSizing: "border-box", resize: "vertical" }} /></div>
    <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
      <Btn onClick={gen} loading={loading}>Generate Launch Rollout</Btn>
      {res && <Btn onClick={gen} loading={loading} sec sm>Regen All</Btn>}
    </div>
    {loading && <ProgressBar label="Generating social captions for all platforms" />}

    {res && <div style={{ marginTop: 24 }}>
      <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: C.txm, marginBottom: 10 }}>Horizontal (X, LinkedIn, Facebook)</div>
      {FIELDS.slice(0, 6).map(function(f) { return <OutCard key={f.key} title={f.label} content={res[f.key] || "(not generated)"} color={f.color} onRedo={function() { redoField(f.key, f.label); }} rLoading={redoL[f.key]} />; })}
      <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: C.txm, marginTop: 20, marginBottom: 10 }}>Vertical (Shorts, Reels, TikTok)</div>
      {FIELDS.slice(6).map(function(f) { return <OutCard key={f.key} title={f.label} content={res[f.key] || "(not generated)"} color={f.color} onRedo={function() { redoField(f.key, f.label); }} rLoading={redoL[f.key]} />; })}

      <Divider />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Btn onClick={doExport} sec>Download as .doc</Btn>
        <Btn onClick={doComplete}>Complete Launch Kit</Btn>
      </div>
    </div>}

    {/* Congratulations Modal */}
    {showModal && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }} onClick={function() { setShowModal(false); }}>
      <Confetti />
      <div onClick={function(e) { e.stopPropagation(); }} style={{ background: C.cardGrad, border: "1px solid " + C.amber, borderRadius: 12, padding: 36, maxWidth: 440, textAlign: "center", boxShadow: "0 0 40px rgba(247,176,65,0.2), 0 0 80px rgba(247,176,65,0.08)", position: "relative", zIndex: 1001 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>&#x1F680;</div>
        <div style={{ fontFamily: ft, fontSize: 22, fontWeight: 800, color: C.amber, marginBottom: 8 }}>Launch Your Video Now</div>
        <div style={{ fontFamily: ft, fontSize: 14, color: C.tx, marginBottom: 6 }}>{fin.title}</div>
        <div style={{ fontFamily: mn, fontSize: 10, color: C.txm, marginBottom: 20 }}>Episode #{ep.number} - {gs}</div>
        <div style={{ fontFamily: ft, fontSize: 13, color: C.txm, marginBottom: 24 }}>Your Launch Kit is saved. Download the doc, schedule in Buffer, and push it live.</div>
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
function ClipMgr() { return <div style={{ textAlign: "center", padding: 80, color: C.txd, fontFamily: ft }}><div style={{ fontSize: 16, marginBottom: 6 }}>Clip Manager</div><div style={{ fontFamily: mn, fontSize: 11 }}>Coming next.</div></div>; }

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
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
      <div style={{ fontFamily: ft, fontSize: 16, fontWeight: 700, color: C.tx }}>Activity Log</div>
      {logData.length > 0 && <span onClick={function() { setEditing(!editing); }} style={{ fontFamily: mn, fontSize: 10, color: editing ? C.coral : C.txd, cursor: "pointer", padding: "4px 10px", borderRadius: 4, border: "1px solid " + (editing ? C.coral + "40" : C.border) }}>{editing ? "Done" : "Edit"}</span>}
    </div>
    {logData.length === 0 ? <div style={{ textAlign: "center", padding: 60, color: C.txd, fontFamily: ft, fontSize: 13 }}>No completed episodes yet.</div>
      : logData.map(function(e, i) { return (<div key={i} className="poast-card" style={{ background: C.cardGrad, border: "1px solid " + C.border, borderRadius: 8, padding: "16px 18px", marginBottom: 8, boxShadow: C.glow }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
          {editing && <span onClick={function() { removeEntry(i); }} style={{ width: 24, height: 24, borderRadius: "50%", background: C.coral + "20", border: "1px solid " + C.coral, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mn, fontSize: 13, color: C.coral, cursor: "pointer", flexShrink: 0 }}>x</span>}
          <div style={{ width: 40, height: 40, borderRadius: 6, background: C.surface, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mn, fontSize: 12, color: C.amber, fontWeight: 700, border: "1px solid " + C.border, flexShrink: 0 }}>{"#" + e.episode}</div>
          <div style={{ flex: 1 }}><div style={{ fontFamily: ft, fontSize: 14, fontWeight: 600, color: C.tx }}>{e.title}</div><div style={{ fontFamily: ft, fontSize: 11, color: C.txm }}>{e.guests}</div></div>
          <div style={{ fontFamily: mn, fontSize: 9, color: C.txd }}>{e.date}</div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span onClick={function() { setViewIdx(i); }} style={{ fontFamily: mn, fontSize: 9, color: C.teal, padding: "3px 10px", background: C.teal + "15", borderRadius: 4, cursor: "pointer" }}>View Launch Kit</span>
          <span onClick={function() { downloadLaunchKit(e); }} style={{ fontFamily: mn, fontSize: 9, color: C.amber, cursor: "pointer", padding: "3px 10px", background: C.amber + "15", borderRadius: 4 }}>Download Launch Kit</span>
          {e.social && <span onClick={function() { downloadSocialKit(e); }} style={{ fontFamily: mn, fontSize: 9, color: C.blue, cursor: "pointer", padding: "3px 10px", background: C.blue + "15", borderRadius: 4 }}>Download Social Kit</span>}
        </div>
      </div>); })}

    {/* View Launch Kit Modal */}
    {viewEntry && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }} onClick={function() { setViewIdx(null); }}>
      <div onClick={function(e) { e.stopPropagation(); }} style={{ background: C.cardGrad, border: "1px solid " + C.border, borderRadius: 12, padding: 28, maxWidth: 640, width: "90%", maxHeight: "80vh", overflow: "auto", boxShadow: C.glow }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontFamily: mn, fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: "2px" }}>{"Episode #" + viewEntry.episode + " // Launch Kit"}</div>
          <span onClick={function() { setViewIdx(null); }} style={{ fontFamily: mn, fontSize: 11, color: C.txd, cursor: "pointer", padding: "4px 8px" }}>x</span>
        </div>
        <div style={{ fontFamily: ft, fontSize: 18, fontWeight: 800, color: C.tx, marginBottom: 4 }}>{viewEntry.title}</div>
        <div style={{ fontFamily: ft, fontSize: 12, color: C.txm, marginBottom: 6 }}>{viewEntry.guests} // {viewEntry.date}</div>
        {viewEntry.description && <div style={{ fontFamily: ft, fontSize: 13, color: C.tx, lineHeight: 1.7, whiteSpace: "pre-wrap", padding: "12px 14px", background: C.surface, borderRadius: 6, border: "1px solid " + C.border, marginBottom: 16, maxHeight: 160, overflow: "auto" }}>{viewEntry.description}</div>}
        {viewEntry.social && <div>
          <div style={{ fontFamily: mn, fontSize: 9, color: C.txm, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 10 }}>Social Captions</div>
          {Object.keys(viewEntry.social).map(function(k) { return <div key={k} style={{ marginBottom: 10, padding: "10px 12px", background: C.surface, borderRadius: 6, border: "1px solid " + C.border }}>
            <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4 }}>{k.replace(/_/g, " ")}</div>
            <div style={{ fontFamily: ft, fontSize: 12, color: C.tx, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{viewEntry.social[k]}</div>
          </div>; })}
        </div>}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <Btn onClick={function() { downloadLaunchKit(viewEntry); }} sm sec>Download Launch Kit</Btn>
          {viewEntry.social && <Btn onClick={function() { downloadSocialKit(viewEntry); }} sm sec>Download Social Kit</Btn>}
        </div>
      </div>
    </div>}
  </div>);
}

// ═══ CLIP CAPTIONS ═══
var SYS_CLIP = "You are a social media strategist for SemiAnalysis. You write captions for short-form video clips pulled from longer podcast episodes. Rules: Never use em dashes. No emojis. No hashtags on X/Twitter ever. YT Shorts titles under 40 chars. Instagram: caption + Save this for later CTA + 5-8 hashtags + location San Francisco CA, point to youtube.com/@SemianalysisWeekly. TikTok: all lowercase 4-6 hashtags no on-screen text overlays. LinkedIn/Facebook: link in first comment end with Link in comments. X: Hook tweet no link. Include guest handles on every platform. RESPOND ONLY IN VALID JSON. No markdown fences. No preamble.";

var CLIP_PLATFORMS = [
  { key: "x", label: "X // Post", color: PL.x },
  { key: "linkedin", label: "LinkedIn // Post", color: PL.li },
  { key: "facebook", label: "Facebook // Post", color: PL.fb },
  { key: "instagram", label: "Instagram Reels", color: PL.ig },
  { key: "yt_shorts_title", label: "YouTube Shorts // Title", color: PL.yt },
  { key: "yt_shorts_desc", label: "YouTube Shorts // Description", color: PL.yt },
  { key: "tiktok", label: "TikTok", color: PL.tt },
];

function ClipCaptions() {
  var _clips = useState([{ name: "", context: "", guests: "", platforms: ["x", "linkedin", "facebook", "instagram", "yt_shorts_title", "yt_shorts_desc", "tiktok"] }]);
  var clips = _clips[0], setClips = _clips[1];
  var _active = useState(0), active = _active[0], setActive = _active[1];
  var _results = useState({}), results = _results[0], setResults = _results[1];
  var _loading = useState({}), loading = _loading[0], setLoading = _loading[1];
  var _redoL = useState({}), redoL = _redoL[0], setRedoL = _redoL[1];

  var addClip = function() {
    var c = clips.concat([{ name: "", context: "", guests: "", platforms: ["x", "linkedin", "facebook", "instagram", "yt_shorts_title", "yt_shorts_desc", "tiktok"] }]);
    setClips(c);
    setActive(c.length - 1);
  };

  var removeClip = function(idx) {
    if (clips.length <= 1) return;
    var c = clips.filter(function(_, i) { return i !== idx; });
    setClips(c);
    if (active >= c.length) setActive(c.length - 1);
    // Re-index results to match new clip positions
    var nr = {};
    Object.keys(results).forEach(function(k) {
      var ki = parseInt(k);
      if (ki < idx) nr[ki] = results[ki];
      else if (ki > idx) nr[ki - 1] = results[ki];
    });
    setResults(nr);
    // Re-index redo loading states too
    var nrl = {};
    Object.keys(redoL).forEach(function(k) {
      var parts = k.split("-");
      var ki = parseInt(parts[0]);
      if (ki < idx) nrl[k] = redoL[k];
      else if (ki > idx) nrl[(ki - 1) + "-" + parts.slice(1).join("-")] = redoL[k];
    });
    setRedoL(nrl);
  };

  var updateClip = function(idx, field, val) {
    var c = clips.slice();
    c[idx] = Object.assign({}, c[idx]);
    c[idx][field] = val;
    setClips(c);
  };

  var togglePlatform = function(idx, key) {
    var c = clips.slice();
    var p = c[idx].platforms.slice();
    var i = p.indexOf(key);
    if (i >= 0) p.splice(i, 1); else p.push(key);
    c[idx] = Object.assign({}, c[idx], { platforms: p });
    setClips(c);
  };

  var genCaptions = async function(idx) {
    var clip = clips[idx];
    if (!clip.context) return;
    setLoading(function(p) { var o = Object.assign({}, p); o[idx] = true; return o; });
    var platKeys = clip.platforms.join('","');
    var data = await ask(SYS_CLIP, buildPrompt([
      "Generate social captions for a short clip from SemiAnalysis Weekly.",
      "Clip name: " + (clip.name || "Untitled"),
      clip.guests ? "Guests with handles: " + clip.guests : "",
      "Clip context/transcript: " + clip.context.slice(0, 6000),
      "Channel: youtube.com/@SemianalysisWeekly",
      "Generate captions ONLY for these platforms: " + clip.platforms.map(function(k) { var f = CLIP_PLATFORMS.find(function(p) { return p.key === k; }); return f ? f.label : k; }).join(", "),
      'Return JSON with these exact keys: {"' + platKeys + '":"..."}. LinkedIn and Facebook posts should end with "Link in comments." X post should have no link. YT Shorts title must be under 40 characters.',
    ]));
    if (data) setResults(function(p) { var o = Object.assign({}, p); o[idx] = data; return o; });
    setLoading(function(p) { var o = Object.assign({}, p); o[idx] = false; return o; });
  };

  var redoOne = async function(clipIdx, platKey) {
    var rk = clipIdx + "-" + platKey;
    setRedoL(function(p) { var o = Object.assign({}, p); o[rk] = true; return o; });
    var clip = clips[clipIdx];
    var cur = results[clipIdx] && results[clipIdx][platKey] || "";
    var platLabel = (CLIP_PLATFORMS.find(function(p) { return p.key === platKey; }) || {}).label || platKey;
    var data = await ask(SYS_CLIP, buildPrompt([
      "Regenerate ONLY the " + platLabel + " caption for this SemiAnalysis clip.",
      "Clip: " + (clip.name || "Untitled"),
      clip.guests ? "Guests: " + clip.guests : "",
      "Context: " + clip.context.slice(0, 3000),
      "Current (be DIFFERENT): " + cur,
      'Return JSON: {"result":"..."}',
    ]));
    if (data && data.result) {
      setResults(function(p) {
        var o = Object.assign({}, p);
        o[clipIdx] = Object.assign({}, o[clipIdx]);
        o[clipIdx][platKey] = data.result;
        return o;
      });
    }
    setRedoL(function(p) { var o = Object.assign({}, p); o[rk] = false; return o; });
  };

  var exportClip = function(idx) {
    var clip = clips[idx];
    var res = results[idx];
    if (!res) return;
    var sections = [{ heading: "Clip: " + (clip.name || "Untitled"), items: Object.keys(res).map(function(k) {
      var f = CLIP_PLATFORMS.find(function(p) { return p.key === k; });
      return { label: f ? f.label : k, content: res[k] };
    })}];
    exportDoc("Clip Captions - " + (clip.name || "Untitled"), sections);
  };

  var clip = clips[active] || {};
  var res = results[active] || null;
  var isLoading = loading[active] || false;

  return (<div>
    <div style={{ fontFamily: ft, fontSize: 20, fontWeight: 800, color: C.tx, marginBottom: 4 }}>Capper</div>
    <div style={{ fontFamily: mn, fontSize: 10, color: C.txm, marginBottom: 24 }}>Generate platform captions for individual clips from Opus/Riverside.</div>

    {/* Clip tabs */}
    <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
      {clips.map(function(c, i) {
        var s = active === i;
        return <div key={i} style={{ display: "flex", alignItems: "center", gap: 0 }}>
          <div onClick={function() { setActive(i); }} style={{ padding: "8px 14px", borderRadius: clips.length > 1 ? "6px 0 0 6px" : 6, cursor: "pointer", background: s ? C.amber + "15" : C.card, border: "1px solid " + (s ? C.amber : C.border), borderRight: clips.length > 1 ? "none" : undefined, fontFamily: ft, fontSize: 12, fontWeight: s ? 700 : 500, color: s ? C.amber : C.txm }}>{c.name || "Clip " + (i + 1)}</div>
          {clips.length > 1 && <div onClick={function() { removeClip(i); }} style={{ padding: "8px 8px", borderRadius: "0 6px 6px 0", cursor: "pointer", background: s ? C.amber + "15" : C.card, border: "1px solid " + (s ? C.amber : C.border), fontFamily: mn, fontSize: 10, color: C.txd }}>x</div>}
        </div>;
      })}
      <div onClick={addClip} style={{ padding: "8px 14px", borderRadius: 6, cursor: "pointer", background: C.card, border: "1px dashed " + C.border, fontFamily: mn, fontSize: 11, color: C.amber }}>+ Add Clip</div>
    </div>

    {/* Clip form */}
    <Field label="Clip Name" value={clip.name} onChange={function(v) { updateClip(active, "name", v); }} placeholder="e.g. TSMC Arizona Update" />
    <Field label="Guest Handles" value={clip.guests} onChange={function(v) { updateClip(active, "guests", v); }} placeholder="e.g. Jordan Nanos (@JordanNanos)" isMono />

    <div style={{ marginBottom: 16 }}>
      <Label>Clip Transcript / Context</Label>
      <textarea value={clip.context} onChange={function(e) { updateClip(active, "context", e.target.value); }} rows={8} placeholder="Paste the clip transcript or describe what the clip covers..." style={{ width: "100%", padding: "12px 14px", background: C.card, border: "1px solid " + C.border, borderRadius: 7, color: C.tx, fontFamily: mn, fontSize: 11, outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.6 }} onFocus={function(e) { e.target.style.borderColor = C.amber; }} onBlur={function(e) { e.target.style.borderColor = C.border; }} />
      {clip.context && <div style={{ fontFamily: mn, fontSize: 9, color: C.txd, marginTop: 4 }}>{clip.context.length.toLocaleString()} chars</div>}
    </div>

    {/* Platform selector */}
    <div style={{ marginBottom: 20 }}>
      <Label>Platforms</Label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {CLIP_PLATFORMS.map(function(p) {
          var on = clip.platforms && clip.platforms.indexOf(p.key) >= 0;
          return <div key={p.key} onClick={function() { togglePlatform(active, p.key); }} style={{ padding: "6px 12px", borderRadius: 5, cursor: "pointer", background: on ? p.color + "18" : C.card, border: "1px solid " + (on ? p.color + "60" : C.border), fontFamily: mn, fontSize: 10, color: on ? p.color : C.txd, transition: "all 0.2s ease" }}>{p.label.split(" // ")[0]}</div>;
        })}
      </div>
    </div>

    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
      <Btn onClick={function() { genCaptions(active); }} loading={isLoading} off={!clip.context}>Generate Captions</Btn>
      {res && <Btn onClick={function() { genCaptions(active); }} loading={isLoading} sec sm>Regen All</Btn>}
      {!clip.context && <span style={{ fontFamily: mn, fontSize: 10, color: C.txd }}>Add transcript or context first</span>}
    </div>
    {isLoading && <ProgressBar label={"Generating captions for " + (clip.name || "clip")} />}

    {/* Results */}
    {res && <div style={{ marginTop: 24 }}>
      {CLIP_PLATFORMS.filter(function(p) { return clip.platforms.indexOf(p.key) >= 0 && res[p.key]; }).map(function(p) {
        return <OutCard key={p.key} title={p.label} content={res[p.key]} color={p.color} onRedo={function() { redoOne(active, p.key); }} rLoading={redoL[active + "-" + p.key]} />;
      })}
      <Divider />
      <Btn onClick={function() { exportClip(active); }} sec>Download as .doc</Btn>
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
  return <div style={{ position: "fixed", inset: 0, background: "#06060C", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
    <style dangerouslySetInnerHTML={{ __html: "@keyframes ufi{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}" }} />
    <div style={{ position: "absolute", width: "50vw", height: "50vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(247,176,65,0.03), transparent 60%)" }} />
    <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: C.amber, letterSpacing: 4, marginBottom: 6, animation: "ufi 0.4s ease forwards", opacity: 0 }}>POAST</div>
    <div style={{ fontFamily: ft, fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.2)", letterSpacing: 2, marginBottom: 40, animation: "ufi 0.4s ease 0.1s forwards", opacity: 0 }}>SELECT USER</div>
    <div style={{ display: "flex", gap: 20 }}>
      {["Akash", "Vansh"].map(function(name, i) {
        var on = h === i;
        return <div key={name} onClick={function() { onSelect(name); }} onMouseEnter={function() { sh(i); }} onMouseLeave={function() { sh(null); }} style={{ width: 160, padding: "28px 20px", borderRadius: 12, cursor: "pointer", background: on ? "#111118" : "#0A0A14", border: on ? "1px solid " + C.amber + "60" : "1px solid rgba(255,255,255,0.06)", textAlign: "center", transition: "all 0.15s", boxShadow: on ? "0 0 20px " + C.amber + "15" : "none", animation: "ufi 0.4s ease " + (0.2 + i * 0.1) + "s forwards", opacity: 0 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: on ? C.amber + "20" : "#111118", border: "1px solid " + (on ? C.amber + "40" : "rgba(255,255,255,0.06)"), display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontFamily: ft, fontSize: 20, fontWeight: 900, color: on ? C.amber : "rgba(255,255,255,0.25)" }}>{name[0]}</div>
          <div style={{ fontFamily: ft, fontSize: 16, fontWeight: 700, color: on ? C.amber : "#E8E4DD" }}>{name}</div>
          <div style={{ fontFamily: ft, fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 4 }}>{name === "Akash" ? "Producer" : "Analyst"}</div>
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
    { t: "Loading modules...", c: "rgba(255,255,255,0.2)" },
    { t: "  [OK] content-engine", c: "#2EAD8E" }, { t: "  [OK] claude-sonnet-4.brain", c: "#2EAD8E" },
    { t: "  [OK] grok-imagine.gpu", c: "#2EAD8E" }, { t: "  [OK] elevenlabs-voice", c: "#2EAD8E" },
    user === "Vansh" ? { t: "  [ALERT] vansh-just-farted.exe", c: "#E06347" } : { t: "  [WARN] max-charisma-detected", c: C.amber },
    { t: "  [FAIL] sleep-schedule: not found", c: "#E06347" },
    { t: "  [OK] vibes.essential", c: "#2EAD8E" },
    { t: "", c: "rgba(255,255,255,0.2)" }, { t: "Systems nominal. Welcome, " + user + ".", c: C.amber },
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
    PRODUCE: [{ l: "SA Weekly", ic: "\uD83C\uDF99", id: "weekly" }, { l: "Press to Premier", ic: "\uD83C\uDFAC", id: "p2p" }, { l: "Capper", ic: "\uD83C\uDFAC", id: "captions" }],
    PREPARE: [{ l: "News Flow", ic: "\uD83D\uDCE1", id: "news" }, { l: "GTC Flow", ic: "\uD83D\uDCCA", id: "gtc" }],
    PREMIER: [{ l: "Schedule", ic: "\uD83D\uDCC6", id: "schedule" }],
  };
  var words = ["PRODUCE", "PREPARE", "PREMIER"];
  var colors = [C.amber, C.blue, C.teal];
  var glows = ["rgba(247,176,65,", "rgba(11,134,209,", "rgba(46,173,142,"];

  return <div style={{ position: "fixed", inset: 0, background: "#06060C", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "0 8vw" }}>
    <style dangerouslySetInnerHTML={{ __html: "@keyframes bIn{0%{opacity:0;transform:translateY(20px)}100%{opacity:1;transform:translateY(0)}}@keyframes bLine{0%{transform:scaleX(0)}100%{transform:scaleX(1)}}@keyframes itemReveal{0%{opacity:0;transform:translateY(-8px) scale(0.95)}100%{opacity:1;transform:translateY(0) scale(1)}}" }} />
    <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: C.amber, letterSpacing: 5, marginBottom: 50, animation: "bIn 0.5s ease forwards", opacity: 0 }}>POAST</div>
    <div style={{ width: "100%", textAlign: "center" }}>
      {words.map(function(w, i) {
        var isH = h === i; var items = sections[w];
        return <div key={i} onMouseEnter={function() { sh(i); }} onMouseLeave={function() { sh(null); }} style={{ animation: "bIn 0.6s ease " + (0.1 + i * 0.15) + "s forwards", opacity: 0, marginBottom: isH ? 8 : 0, transition: "margin 0.25s ease" }}>
          <div style={{ fontFamily: ft, fontSize: "min(12vw, 140px)", fontWeight: 900, color: isH ? colors[i] : "#E8E4DD", letterSpacing: "-0.03em", lineHeight: 0.95, position: "relative", display: "inline-block", cursor: "pointer", transition: "color 0.2s" }}>
            {w}
            <span style={{ position: "absolute", left: -20, top: "50%", transform: "translateY(-50%)", width: 4, height: isH ? "80%" : "60%", background: colors[i], borderRadius: 2, transition: "all 0.2s", boxShadow: isH ? "0 0 12px " + colors[i] + "40" : "none" }} />
          </div>
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

    {/* ═══ ANIMATED BACKGROUND ═══ */}
    <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: C.bg }} />
      <div className="bg-orb" style={{ width: "55vw", height: "55vw", top: "-15%", right: "-10%", background: "radial-gradient(ellipse, rgba(247,176,65,0.16) 0%, rgba(247,176,65,0.05) 35%, transparent 65%)", animation: "od1 22s ease-in-out infinite", borderRadius: "40% 60% 55% 45%" }} />
      <div className="bg-orb" style={{ width: "45vw", height: "50vw", bottom: "-12%", left: "-5%", background: "radial-gradient(ellipse, rgba(11,134,209,0.12) 0%, rgba(11,134,209,0.04) 40%, transparent 65%)", animation: "od2 28s ease-in-out infinite", borderRadius: "55% 45% 50% 50%" }} />
      <div className="bg-orb" style={{ width: "30vw", height: "35vw", top: "35%", left: "15%", background: "radial-gradient(ellipse, rgba(144,92,203,0.09) 0%, transparent 65%)", animation: "od3 20s ease-in-out infinite", borderRadius: "45% 55% 60% 40%" }} />
      <div className="bg-orb" style={{ width: "20vw", height: "20vw", top: "15%", right: "25%", background: "radial-gradient(circle, rgba(247,176,65,0.12) 0%, transparent 55%)", animation: "pulse 4s ease-in-out infinite, od2 14s ease-in-out infinite", filter: "blur(60px)" }} />
      <div className="bg-orb" style={{ width: "25vw", height: "30vw", bottom: "20%", right: "8%", background: "radial-gradient(ellipse, rgba(46,173,142,0.09) 0%, transparent 60%)", animation: "od1 24s ease-in-out infinite reverse", borderRadius: "60% 40% 45% 55%" }} />
    </div>

    <Sidebar active={sec} onNav={setSec} onAskPoast={function() { setAskPoastOpen(!askPoastOpen); }} />
    <AskPoast open={askPoastOpen} onToggle={function() { setAskPoastOpen(false); }} />
    <div style={{ marginLeft: 240, position: "relative", zIndex: 1 }} className="poast-fadein">
      <div style={{ maxWidth: sec === "news" || sec === "schedule" || sec === "p2p" ? "none" : 1100, margin: "0 auto", padding: sec === "news" || sec === "schedule" || sec === "p2p" ? "0 24px" : "0 40px" }}>
        <div style={{ padding: "20px 0", borderBottom: "1px solid " + C.border, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", background: C.bg + "E0" }}>
          <div><div style={{ fontFamily: ft, fontSize: 22, fontWeight: 800, color: C.tx, letterSpacing: -0.5 }}>SemiAnalysis Weekly</div><div style={{ fontFamily: mn, fontSize: 9, color: C.txm, marginTop: 2 }}>{"Ep #" + ep.number + (gn ? " . " + gn : "") + (launched ? " . Launched" : fin ? " . Saved" : "")}</div></div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {hasDraft && <span onClick={loadDraft} style={{ fontFamily: mn, fontSize: 9, color: C.amber, cursor: "pointer", padding: "5px 10px", border: "1px solid " + C.amber + "40", borderRadius: 5, background: C.amber + "10" }}>Load from Draft</span>}
            <a href="https://youtube.com/@SemianalysisWeekly" target="_blank" rel="noopener noreferrer" style={{ fontFamily: mn, fontSize: 9, color: C.txd, textDecoration: "none", padding: "5px 10px", border: "1px solid " + C.border, borderRadius: 5 }}>@SemianalysisWeekly</a>
          </div>
        </div>
        {sec === "weekly" && <TabBar items={tabs} active={tab} onPick={setTab} locks={locks} />}
        <div key={sec} className="poast-section" style={{ paddingBottom: 60 }}>
        {sec === "weekly" && tab === "setup" && <EpisodeSetup ep={ep} setEp={setEp} guests={guests} setGuests={setGuests} opts={opts} setOpts={setOpts} sel={sel} setSel={setSel} fin={fin} setFin={setFin} goTest={function() { setTab("test"); }} />}
        {sec === "weekly" && tab === "test" && <TestPage ep={ep} guests={guests} opts={opts} fin={fin} setFin={setFin} thumb={thumb} setThumb={setThumb} goLaunch={function() { setTab("launch"); }} />}
        {sec === "weekly" && tab === "launch" && <LaunchRollout ep={ep} guests={guests} fin={fin} onComplete={handleComplete} />}
        {sec === "weekly" && tab === "clips" && <ClipMgr />}
        {sec === "weekly" && tab === "log" && <LogTab logData={logData} setLogData={setLogData} />}
        {sec === "captions" && <ClipCaptions />}
        {sec === "gtc" && <GTCFlow />}
        {sec === "news" && <NewsFlow />}
        {sec === "p2p" && <PressToPremi />}
        {sec === "schedule" && <BufferSchedule />}
        </div>
      </div>
    </div>
  </div>);
}
