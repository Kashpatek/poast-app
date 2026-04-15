// @ts-nocheck
"use client";
import { useState, useEffect, useRef } from "react";
import { exportDocx } from "./docx-export";

// ═══ DESIGN (coral accent for PODCAST) ═══
var D = {
  bg: "#060608", surface: "#09090D", elevated: "#0D0D12",
  border: "rgba(255,255,255,0.06)", borderHover: "rgba(255,255,255,0.12)",
  amber: "#F7B041", blue: "#0B86D1", teal: "#2EAD8E", coral: "#E06347", violet: "#905CCB",
  tx: "#ffffff", txb: "rgba(255,255,255,0.55)", txl: "rgba(255,255,255,0.4)", txh: "rgba(255,255,255,0.12)",
};
var ft = "'Outfit',sans-serif";
var mn = "'JetBrains Mono',monospace";
var ACC = D.coral; // accent color for this flow

var PL = { x: "#1DA1F2", li: "#0A66C2", fb: "#1877F2", ig: "#E4405F", yt: "#FF0000", tt: "#00F2EA" };

var SYS_EP = "You are a content strategist for SemiAnalysis, a semiconductor and AI infrastructure research firm. Rules: Never use em dashes, use commas or periods. No emojis. Be direct, not clickbait. When mentioning guests in descriptions, include their social handle in parentheses on first mention, e.g. Jordan Nanos (@JordanNanos). RESPOND ONLY IN VALID JSON. No markdown fences. No preamble.";

var SYS_SOC = "You are a social media strategist for SemiAnalysis Weekly. Rules: Never use em dashes. No emojis. No hashtags on X/Twitter ever. YT Shorts titles under 40 chars. Instagram: caption + Save this for later CTA + 5-8 hashtags + location San Francisco CA, point to youtube.com/@SemianalysisWeekly. TikTok: all lowercase 4-6 hashtags. LinkedIn/Facebook: link in first comment, end Link in comments. X: Hook tweet no link + reply-to-self with link. Mention all guests with handles on every platform. RESPOND ONLY IN VALID JSON. No markdown fences. No preamble.";

// ═══ API ═══
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

// ═══ TOAST ═══
function Toast() {
  var _s = useState(null), msg = _s[0], setMsg = _s[1];
  _toastSet.current = function(m) { if (_toastTimer.current) clearTimeout(_toastTimer.current); setMsg(m); _toastTimer.current = setTimeout(function() { setMsg(null); }, 6000); };
  if (!msg) return null;
  return <div onClick={function() { setMsg(null); }} style={{ position: "fixed", bottom: 24, right: 24, zIndex: 10000, maxWidth: 420, padding: "14px 20px", background: ACC + "20", border: "1px solid " + ACC, borderRadius: 8, fontFamily: mn, fontSize: 11, color: ACC, cursor: "pointer", boxShadow: "0 0 20px rgba(224,99,71,0.2)", lineHeight: 1.5 }}>{msg}</div>;
}

// ═══ UI COMPONENTS ═══
function ProgressBar({ label }) {
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

function Label({ children }) { return <div style={{ fontFamily: mn, fontSize: 11, color: ACC, textTransform: "uppercase", letterSpacing: "2px", marginBottom: 8 }}>{children}</div>; }

function Field({ label, value, onChange, placeholder, isMono }) { return (<div style={{ marginBottom: 16 }}>{label && <Label>{label}</Label>}<input value={value} onChange={function(e) { onChange(e.target.value); }} placeholder={placeholder} style={{ width: "100%", padding: "12px 14px", background: D.surface, border: "1px solid " + D.border, borderRadius: 10, color: D.tx, fontFamily: isMono ? mn : ft, fontSize: 14, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s ease, box-shadow 0.2s ease" }} onFocus={function(e) { e.target.style.borderColor = ACC; e.target.style.boxShadow = "0 0 24px rgba(224,99,71,0.06)"; }} onBlur={function(e) { e.target.style.borderColor = D.border; e.target.style.boxShadow = "none"; }} /></div>); }

function Btn({ children, onClick, loading, sec, sm, off }) { return (<button onClick={onClick} disabled={loading || off} style={{ padding: sm ? "8px 16px" : "12px 28px", background: off ? D.surface : sec ? "transparent" : "linear-gradient(135deg, " + ACC + ", #C84E35)", color: off ? "rgba(255,255,255,0.4)" : sec ? ACC : "#ffffff", border: sec ? "1px solid " + (off ? D.border : ACC) : "none", borderRadius: 10, fontFamily: ft, fontSize: sm ? 12 : 14, fontWeight: 800, cursor: loading || off ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1, letterSpacing: -0.3, transition: "all 0.2s ease" }}>{loading ? "Working..." : children}</button>); }

function CopyBtn({ text }) { var _s = useState(false), ok = _s[0], set = _s[1]; return <span onClick={function(e) { e.stopPropagation(); set(copyText(text)); setTimeout(function() { set(false); }, 1200); }} style={{ fontFamily: mn, fontSize: 9, color: ok ? ACC : "rgba(255,255,255,0.4)", cursor: "pointer", padding: "3px 8px", borderRadius: 6, border: "1px solid " + D.border, userSelect: "none", transition: "all 0.2s ease" }}>{ok ? "Copied" : "Copy"}</span>; }

function Divider() { return <div style={{ borderBottom: "1px solid " + D.border, margin: "28px 0" }} />; }

function Pick({ text, picked, onPick, onRedo, rLoading }) {
  return (<div onClick={onPick} style={{ background: picked ? "linear-gradient(135deg, " + ACC + "0A 0%, " + ACC + "05 100%)" : D.elevated, border: "1px solid " + (picked ? ACC + "60" : D.border), borderRadius: 12, padding: "16px 20px", marginBottom: 8, cursor: "pointer", boxShadow: picked ? "0 0 24px rgba(224,99,71,0.06)" : "none", transition: "all 0.2s ease" }}>
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, marginTop: 2, border: "2px solid " + (picked ? ACC : D.borderHover), background: picked ? ACC : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease" }}>{picked && <div style={{ width: 8, height: 8, borderRadius: "50%", background: D.bg }} />}</div>
      <div style={{ flex: 1, fontFamily: ft, fontSize: 14, color: picked ? D.tx : D.txb, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{text}</div>
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        <CopyBtn text={text} />
        {onRedo && <span onClick={function(e) { e.stopPropagation(); if (!rLoading) onRedo(); }} style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.4)", cursor: rLoading ? "wait" : "pointer", padding: "3px 8px", borderRadius: 6, border: "1px solid " + D.border, opacity: rLoading ? 0.4 : 1, userSelect: "none", transition: "all 0.2s ease" }}>&#x21bb;</span>}
      </div>
    </div>
  </div>);
}

function SecHead({ label, onRedoAll, rL }) {
  return (<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
    <div style={{ fontFamily: mn, fontSize: 11, color: ACC, textTransform: "uppercase", letterSpacing: "2px", fontWeight: 700 }}>{label}</div>
    {onRedoAll && <span onClick={function() { if (!rL) onRedoAll(); }} style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.4)", cursor: rL ? "wait" : "pointer", padding: "4px 10px", borderRadius: 8, border: "1px solid " + D.border, opacity: rL ? 0.4 : 1, transition: "all 0.2s ease" }}>&#x21bb; Redo All 3</span>}
  </div>);
}

function OutCard({ title, content, color, onRedo, rLoading }) {
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
function StepTracker({ current, steps, canNavigate, onNav }) {
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
  var pieces = useRef([]);
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

// ═══ GUEST MANAGER ═══
function GuestManager({ guests, setGuests }) {
  var _guestBrowse = useState(false), guestBrowseOpen = _guestBrowse[0], setGuestBrowseOpen = _guestBrowse[1];
  var _fkGuests = useState([]), fkGuests = _fkGuests[0], setFkGuests = _fkGuests[1];
  var _fkSearch = useState(""), fkSearch = _fkSearch[0], setFkSearch = _fkSearch[1];
  var _fkLoading = useState(false), fkLoading = _fkLoading[0], setFkLoading = _fkLoading[1];

  var tierColors = { S: "#F7B041", A: "#0B86D1", B: "#2EAD8E", C: "rgba(255,255,255,0.4)" };

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

  function addFKGuest(prospect) {
    var name = prospect.name || "";
    var handle = "";
    setGuests(guests.concat([{ name: name, handle: handle }]));
    setGuestBrowseOpen(false);
    setFkSearch("");
    showToast("Added " + name + " from FK prospects");
  }

  var filteredFK = fkGuests.filter(function(p) {
    if (!fkSearch) return true;
    var q = fkSearch.toLowerCase();
    return (p.name || "").toLowerCase().indexOf(q) > -1 || (p.company || "").toLowerCase().indexOf(q) > -1;
  });

  return (<div style={{ marginBottom: 20 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <Label>Guests</Label>
      <div style={{ display: "flex", gap: 6 }}>
        <span onClick={toggleBrowse} style={{ fontFamily: mn, fontSize: 10, color: guestBrowseOpen ? D.teal : D.txb, cursor: "pointer", padding: "4px 10px", borderRadius: 8, border: "1px solid " + (guestBrowseOpen ? D.teal + "60" : D.border), background: guestBrowseOpen ? D.teal + "0A" : "transparent", transition: "all 0.2s ease" }}>Browse FK</span>
        <span onClick={function() { setGuests(guests.concat([{ name: "", handle: "" }])); }} style={{ fontFamily: mn, fontSize: 10, color: ACC, cursor: "pointer", padding: "4px 10px", borderRadius: 8, border: "1px solid " + D.border, transition: "all 0.2s ease" }}>+ Add</span>
      </div>
    </div>
    {/* FK Prospects Browse Panel */}
    {guestBrowseOpen && <div style={{ background: D.elevated, border: "1px solid " + D.border, borderRadius: 12, padding: 14, marginBottom: 12, maxHeight: 280, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <input value={fkSearch} onChange={function(e) { setFkSearch(e.target.value); }} placeholder="Search FK prospects..." style={{ width: "100%", padding: "8px 12px", background: D.surface, border: "1px solid " + D.border, borderRadius: 8, color: D.tx, fontFamily: mn, fontSize: 11, outline: "none", boxSizing: "border-box", marginBottom: 8, transition: "border-color 0.2s ease" }} onFocus={function(e) { e.target.style.borderColor = ACC; }} onBlur={function(e) { e.target.style.borderColor = D.border; }} />
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
        {fkLoading && <div style={{ fontFamily: mn, fontSize: 10, color: D.txl, textAlign: "center", padding: 16 }}>Loading...</div>}
        {!fkLoading && filteredFK.length === 0 && <div style={{ fontFamily: mn, fontSize: 10, color: D.txl, textAlign: "center", padding: 16 }}>No prospects found</div>}
        {!fkLoading && filteredFK.map(function(p) {
          return <div key={p.id} onClick={function() { addFKGuest(p); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: D.surface, borderRadius: 8, cursor: "pointer", border: "1px solid " + D.border, transition: "all 0.15s ease" }}>
            <div>
              <div style={{ fontFamily: ft, fontSize: 13, fontWeight: 700, color: D.tx }}>{p.name}</div>
              <div style={{ fontFamily: mn, fontSize: 10, color: D.txb }}>{p.role ? p.role + (p.company ? " @ " + p.company : "") : p.company || ""}</div>
            </div>
            <span style={{ fontFamily: mn, fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: (tierColors[p.tier] || D.txl) + "18", color: tierColors[p.tier] || D.txl, border: "1px solid " + (tierColors[p.tier] || D.txl) + "30" }}>{p.tier || "-"}</span>
          </div>;
        })}
      </div>
    </div>}
    {guests.length === 0 && <div onClick={function() { setGuests([{ name: "", handle: "" }]); }} style={{ background: D.surface, border: "1px dashed " + D.border, borderRadius: 10, padding: "16px", cursor: "pointer", textAlign: "center", fontFamily: ft, fontSize: 13, color: D.txl }}>Click to add guests</div>}
    {guests.map(function(g, i) { return (<div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
      <input value={g.name} onChange={function(e) { var c = guests.slice(); c[i] = { name: e.target.value, handle: g.handle }; setGuests(c); }} placeholder="Name" style={{ flex: 1, padding: "10px 12px", background: D.surface, border: "1px solid " + D.border, borderRadius: 10, color: D.tx, fontFamily: ft, fontSize: 14, outline: "none", transition: "border-color 0.2s ease" }} onFocus={function(e) { e.target.style.borderColor = ACC; }} onBlur={function(e) { e.target.style.borderColor = D.border; }} />
      <input value={g.handle} onChange={function(e) { var c = guests.slice(); c[i] = { name: g.name, handle: e.target.value }; setGuests(c); }} placeholder="@handle" style={{ flex: 1, padding: "10px 12px", background: D.surface, border: "1px solid " + D.border, borderRadius: 10, color: D.tx, fontFamily: mn, fontSize: 13, outline: "none", transition: "border-color 0.2s ease" }} onFocus={function(e) { e.target.style.borderColor = ACC; }} onBlur={function(e) { e.target.style.borderColor = D.border; }} />
      <span onClick={function() { setGuests(guests.filter(function(_, j) { return j !== i; })); }} style={{ fontFamily: mn, fontSize: 11, color: D.txl, cursor: "pointer", padding: "4px 8px" }}>x</span>
    </div>); })}
  </div>);
}

// ═══ KEYWORD BAR ═══
function KeywordBar({ onSuggest, loading }) {
  var _s = useState(""), kw = _s[0], setKw = _s[1];
  return (<div style={{ display: "flex", gap: 8, marginTop: 10, marginBottom: 14 }}>
    <input value={kw} onChange={function(e) { setKw(e.target.value); }} placeholder="Keywords to refine titles (e.g. TSMC, GPU shortage)" onKeyDown={function(e) { if (e.key === "Enter" && kw.trim()) { onSuggest(kw.trim()); setKw(""); } }} style={{ flex: 1, padding: "10px 14px", background: D.surface, border: "1px solid " + D.border, borderRadius: 10, color: D.tx, fontFamily: mn, fontSize: 12, outline: "none", transition: "border-color 0.2s ease" }} onFocus={function(e) { e.target.style.borderColor = ACC; }} onBlur={function(e) { e.target.style.borderColor = D.border; }} />
    <Btn sm onClick={function() { if (kw.trim()) { onSuggest(kw.trim()); setKw(""); } }} loading={loading} off={!kw.trim()}>Suggest</Btn>
  </div>);
}

// ═══ PERSISTENCE ═══
var saveTimer = null;
function weeklyDbSync(state, log) {
  fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ table: "projects", data: { id: "weekly-master", name: "SA Weekly", data: { state: state, log: log }, type: "weekly", updated_at: new Date().toISOString() } }),
  }).catch(function() {});
}
function saveState(state, log) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(function() {
    fetch("/api/state", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: state, log: log }),
    }).catch(function(e) { console.error("Auto-save failed:", e); });
    weeklyDbSync(state, log);
  }, 1000);
}

// ═══ STEP 1: SETUP ═══
function StepSetup({ ep, setEp, guests, setGuests }) {
  return (<div>
    <div style={{ fontFamily: ft, fontSize: 42, fontWeight: 900, color: D.tx, letterSpacing: -2, marginBottom: 8 }}>Episode Setup</div>
    <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 500, color: D.txb, marginBottom: 32 }}>Fill in episode details, guests, and transcript.</div>

    <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 14, marginBottom: 4 }}>
      <Field label="Episode #" value={ep.number} onChange={function(v) { setEp(Object.assign({}, ep, { number: v })); }} isMono />
      <Field label="YouTube Link" value={ep.link} onChange={function(v) { setEp(Object.assign({}, ep, { link: v })); }} placeholder="https://youtube.com/watch?v=..." isMono />
    </div>
    <GuestManager guests={guests} setGuests={setGuests} />

    {/* Transcript */}
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <Label>Full Transcript</Label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 8, cursor: "pointer", background: "transparent", border: "1px solid " + D.border, fontFamily: mn, fontSize: 10, color: ACC, transition: "all 0.2s ease" }}>Upload .txt<input type="file" accept=".txt,.text" style={{ display: "none" }} onChange={function(e) { var f = e.target.files && e.target.files[0]; if (!f) return; var r = new FileReader(); r.onload = function(ev) { setEp(Object.assign({}, ep, { transcript: ev.target.result })); }; r.readAsText(f); e.target.value = ""; }} /></label>
      </div>
      <div onDragOver={function(e) { e.preventDefault(); e.currentTarget.style.borderColor = ACC; }} onDragLeave={function(e) { e.currentTarget.style.borderColor = D.border; }} onDrop={function(e) { e.preventDefault(); e.currentTarget.style.borderColor = D.border; var f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) { var r = new FileReader(); r.onload = function(ev) { setEp(Object.assign({}, ep, { transcript: ev.target.result })); }; r.readAsText(f); } }} style={{ position: "relative", border: "1px solid " + D.border, borderRadius: 12, background: D.surface, transition: "border-color 0.2s ease" }}>
        {!ep.transcript && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 1 }}><div style={{ fontFamily: ft, fontSize: 14, color: D.txl }}>Drop .txt or paste transcript</div></div>}
        <textarea value={ep.transcript} onChange={function(e) { setEp(Object.assign({}, ep, { transcript: e.target.value })); }} rows={10} style={{ width: "100%", padding: "14px 16px", background: "transparent", border: "none", borderRadius: 12, color: D.tx, fontFamily: mn, fontSize: 12, outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.7, position: "relative", zIndex: 2, minHeight: 140 }} />
      </div>
      {ep.transcript && <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}><span style={{ fontFamily: mn, fontSize: 9, color: D.txl }}>{ep.transcript.length.toLocaleString()} chars</span><span onClick={function() { setEp(Object.assign({}, ep, { transcript: "" })); }} style={{ fontFamily: mn, fontSize: 9, color: D.txl, cursor: "pointer" }}>Clear</span></div>}
    </div>

    {/* Timestamps */}
    <div style={{ marginBottom: 20 }}>
      <Label>Timestamps (optional)</Label>
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
function StepGenerate({ ep, guests, opts, setOpts, sel, setSel, fin, setFin, descLen, setDescLen, onDone }) {
  var _l = useState(false), loading = _l[0], setLoading = _l[1];
  var _r = useState({}), rL = _r[0], setRL = _r[1];
  var _k = useState(false), kwL = _k[0], setKwL = _k[1];

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
    if (data) { setOpts(data); onDone(); }
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
      {(opts.titles || []).map(function(t, i) { return <Pick key={"t" + i} text={t} picked={sel.title === i} onPick={function() { setSel(Object.assign({}, sel, { title: i })); }} onRedo={function() { redoOne("titles", i); }} rLoading={rL["titles-" + i]} />; })}
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
function StepReview({ opts, sel, fin, setFin, thumb, setThumb, onDone }) {
  var _cl = useState(false), checkL = _cl[0], setCheckL = _cl[1];
  var _cr = useState(null), checkR = _cr[0], setCheckR = _cr[1];
  var _al = useState(false), abL = _al[0], setAbL = _al[1];
  var _ar = useState(null), abR = _ar[0], setAbR = _ar[1];
  var _am = useState("both"), abM = _am[0], setAbM = _am[1];

  if (!opts) return <div style={{ textAlign: "center", padding: 80, color: D.txb, fontFamily: ft }}>Generate options first.</div>;

  var curFin = fin || { title: opts.titles[sel.title], description: opts.descriptions[sel.desc], thumbnail: opts.thumbnails[sel.thumb] };
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
    if (data) setCheckR(data);
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
    if (data) setAbR(data);
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
    setFin({ title: opts.titles[sel.title], description: opts.descriptions[sel.desc], thumbnail: opts.thumbnails[sel.thumb] });
  };

  return (<div>
    <div style={{ fontFamily: ft, fontSize: 42, fontWeight: 900, color: D.tx, letterSpacing: -2, marginBottom: 8 }}>Review</div>
    <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 500, color: D.txb, marginBottom: 32 }}>Preview, double check, A/B test, then finalize your selections.</div>

    {/* Selections summary */}
    <div style={{ background: D.elevated, border: "1px solid " + D.border, borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: "0 0 24px rgba(224,99,71,0.06)" }}>
      <div style={{ fontFamily: mn, fontSize: 11, color: ACC, textTransform: "uppercase", letterSpacing: "2px", marginBottom: 18, fontWeight: 700 }}>Your Selections</div>
      <div style={{ marginBottom: 16 }}><div style={{ fontFamily: mn, fontSize: 9, color: D.txb, marginBottom: 4, letterSpacing: "1.5px" }}>TITLE</div><div style={{ fontFamily: ft, fontSize: 16, color: D.tx, fontWeight: 700 }}>{curFin.title}</div></div>
      <div style={{ marginBottom: 16 }}><div style={{ fontFamily: mn, fontSize: 9, color: D.txb, marginBottom: 4, letterSpacing: "1.5px" }}>DESCRIPTION</div><div style={{ fontFamily: ft, fontSize: 14, color: D.txb, lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 150, overflow: "auto" }}>{curFin.description}</div></div>
      <div><div style={{ fontFamily: mn, fontSize: 9, color: D.txb, marginBottom: 4, letterSpacing: "1.5px" }}>THUMBNAIL CONCEPT</div><div style={{ fontFamily: ft, fontSize: 14, color: D.txb, lineHeight: 1.7 }}>{thS}</div></div>
      {!fin && <div style={{ marginTop: 16 }}><Btn onClick={saveFin} sm>Lock Selections</Btn></div>}
    </div>

    {/* YouTube Preview */}
    <div style={{ background: D.elevated, border: "1px solid " + D.border, borderRadius: 12, overflow: "hidden", marginBottom: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}>
      <div style={{ width: "100%", aspectRatio: "16/9", background: D.surface, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>{thumb ? <img src={thumb} alt="Thumb" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ textAlign: "center" }}><div style={{ fontFamily: ft, fontSize: 15, color: D.txl }}>Thumbnail Preview</div></div>}<div style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.8)", borderRadius: 4, padding: "3px 8px", fontFamily: mn, fontSize: 10, color: "#fff" }}>42:18</div></div>
      <div style={{ padding: "16px 20px" }}><div style={{ fontFamily: ft, fontSize: 16, fontWeight: 800, color: D.tx, lineHeight: 1.4, marginBottom: 10 }}>{curFin.title}</div><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 28, height: 28, borderRadius: "50%", background: ACC, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: ft, fontSize: 11, fontWeight: 800, color: D.tx }}>SA</div><div style={{ fontFamily: ft, fontSize: 12, color: D.txb, fontWeight: 600 }}>SemiAnalysis Weekly</div></div></div>
    </div>

    {/* Thumbnail upload */}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 28 }}>
      <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 28, background: D.surface, border: "2px dashed " + D.border, borderRadius: 12, cursor: "pointer", transition: "border-color 0.2s ease" }}><div style={{ fontFamily: ft, fontSize: 15, fontWeight: 800, color: ACC, marginBottom: 4 }}>Upload Thumbnail</div><div style={{ fontFamily: mn, fontSize: 10, color: D.txl }}>PNG, JPG, 1280x720</div><input type="file" accept="image/*" style={{ display: "none" }} onChange={function(e) { var f = e.target.files && e.target.files[0]; if (!f) return; var r = new FileReader(); r.onload = function(ev) { setThumb(ev.target.result); }; r.readAsDataURL(f); e.target.value = ""; }} /></label>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 28, background: D.surface, border: "2px dashed " + D.border, borderRadius: 12, opacity: 0.35 }}><div style={{ fontFamily: ft, fontSize: 15, fontWeight: 800, color: D.txb, marginBottom: 4 }}>Get One Prompted</div><div style={{ fontFamily: mn, fontSize: 10, color: D.txl }}>Coming Soon</div></div>
    </div>
    {thumb && <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20 }}><span style={{ fontFamily: mn, fontSize: 10, color: D.teal }}>Thumbnail uploaded</span><span onClick={function() { setThumb(null); }} style={{ fontFamily: mn, fontSize: 9, color: D.txl, cursor: "pointer" }}>Remove</span></div>}

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
          {[{ key: "option_a", label: "Option A // Current", color: D.txb }, { key: "option_b", label: "Option B // Recommended", color: ACC }].map(function(col) {
            var opt = abR[col.key];
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
function StepSocial({ ep, guests, fin, socialRes, setSocialRes, onComplete }) {
  var _h = useState("Cold open into intro. Out Now announcement."), hook = _h[0], setHook = _h[1];
  var _l = useState(false), loading = _l[0], setLoading = _l[1];
  var _rl = useState({}), redoL = _rl[0], setRedoL = _rl[1];

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
    var data = await ask(SYS_SOC, buildPrompt(["Out Now launch rollout for SemiAnalysis Weekly Episode #" + ep.number, "Title: " + fin.title, "Guests with handles: " + gs, "Link: " + link, "Hook: " + hook, "Transcript: " + (ep.transcript || "").slice(0, 4000), 'Return JSON with these EXACT keys: {"x_hook":"...","x_reply":"...","linkedin_post":"...","linkedin_comment":"...","facebook_post":"...","facebook_comment":"...","instagram_caption":"full caption with Save CTA and hashtags and shop grid link ' + link + '","yt_shorts_title":"under 40 chars","yt_shorts_desc":"description with hashtags including #shorts","tiktok_caption":"all lowercase with hashtags"}']));
    if (data) setSocialRes(data);
    setLoading(false);
  };

  var redoField = async function(key, platLabel) {
    setRedoL(function(p) { var o = Object.assign({}, p); o[key] = true; return o; });
    var current = socialRes[key] || "";
    var isTitle = key === "yt_shorts_title";
    var extra = isTitle ? " Must be under 40 characters." : "";
    var data = await ask(SYS_SOC, buildPrompt(["Regenerate ONLY the " + platLabel + " caption for SA Weekly Ep #" + ep.number + " launch." + extra, "Title: " + fin.title, "Guests: " + gs, "Link: " + link, "Hook: " + hook, "Current version (be DIFFERENT): " + current, 'Return JSON: {"result":"..."}']));
    if (data && data.result) { setSocialRes(function(prev) { var o = Object.assign({}, prev); o[key] = data.result; return o; }); }
    setRedoL(function(p) { var o = Object.assign({}, p); o[key] = false; return o; });
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
function StepClips() {
  return <div>
    <div style={{ fontFamily: ft, fontSize: 42, fontWeight: 900, color: D.tx, letterSpacing: -2, marginBottom: 8 }}>Clips</div>
    <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 500, color: D.txb, marginBottom: 32 }}>Manage episode clip highlights.</div>
    <div style={{ textAlign: "center", padding: 80, color: D.txl, fontFamily: ft }}><div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8, color: D.txb }}>Clip Manager</div><div style={{ fontFamily: mn, fontSize: 11, letterSpacing: "1px" }}>Coming next.</div></div>
  </div>;
}

// ═══ STEP 6: EXPORT ═══
function StepExport({ ep, guests, fin, socialRes, onComplete }) {
  var _done = useState(false), done = _done[0], setDone = _done[1];
  var _show = useState(false), showModal = _show[0], setShowModal = _show[1];

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

  var doExport = function() {
    if (!socialRes) return;
    var sections = [
      { heading: "Episode Info", items: [
        { label: "Title", content: fin.title },
        { label: "Description", content: fin.description || "" },
        { label: "Guests", content: gs },
      ]},
      { heading: "Horizontal (X, LinkedIn, Facebook)", items: FIELDS.slice(0, 6).map(function(f) { return { label: f.label, content: socialRes[f.key] || "" }; }) },
      { heading: "Vertical (Shorts, Reels, TikTok)", items: FIELDS.slice(6).map(function(f) { return { label: f.label, content: socialRes[f.key] || "" }; }) },
    ];
    exportDoc("Ep #" + ep.number + " Launch Rollout", sections);
  };

  var copyAll = function() {
    if (!socialRes) return;
    var parts = ["EPISODE #" + ep.number + " - " + fin.title, "Guests: " + gs, "", "DESCRIPTION:", fin.description || "", ""];
    FIELDS.forEach(function(f) {
      if (socialRes[f.key]) { parts.push(f.label.toUpperCase() + ":"); parts.push(socialRes[f.key]); parts.push(""); }
    });
    copyText(parts.join("\n"));
    showToast("All content copied to clipboard");
  };

  var doComplete = function() {
    setDone(true); setShowModal(true);
    if (onComplete) onComplete({ title: fin.title, description: fin.description, social: socialRes });
  };

  return (<div>
    <div style={{ fontFamily: ft, fontSize: 42, fontWeight: 900, color: D.tx, letterSpacing: -2, marginBottom: 8 }}>Export</div>
    <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 500, color: D.txb, marginBottom: 32 }}>Download your launch kit and copy all content.</div>

    {/* Summary */}
    <div style={{ background: D.elevated, border: "1px solid " + D.border, borderRadius: 12, padding: 26, marginBottom: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}>
      <div style={{ fontFamily: mn, fontSize: 11, color: ACC, textTransform: "uppercase", letterSpacing: "2px", marginBottom: 8 }}>{"Episode #" + ep.number}</div>
      <div style={{ fontFamily: ft, fontSize: 24, fontWeight: 900, color: D.tx, letterSpacing: -1, marginBottom: 6 }}>{fin.title}</div>
      <div style={{ fontFamily: ft, fontSize: 13, color: D.txb }}>{gs}</div>
      <div style={{ fontFamily: ft, fontSize: 14, color: D.txb, lineHeight: 1.7, whiteSpace: "pre-wrap", marginTop: 12, maxHeight: 120, overflow: "auto" }}>{fin.description}</div>
    </div>

    {socialRes && <div style={{ background: D.elevated, border: "1px solid " + D.border, borderRadius: 12, padding: 20, marginBottom: 24 }}>
      <div style={{ fontFamily: mn, fontSize: 9, color: D.txb, textTransform: "uppercase", letterSpacing: "2px", marginBottom: 12 }}>Social Captions</div>
      {FIELDS.map(function(f) { if (!socialRes[f.key]) return null; return <div key={f.key} style={{ marginBottom: 10, padding: "12px 14px", background: D.surface, borderRadius: 10, border: "1px solid " + D.border }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}><div style={{ fontFamily: mn, fontSize: 9, color: ACC, textTransform: "uppercase", letterSpacing: "1.5px" }}>{f.label}</div><CopyBtn text={socialRes[f.key]} /></div>
        <div style={{ fontFamily: ft, fontSize: 13, color: D.txb, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{socialRes[f.key]}</div>
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
function StepLog({ logData, setLogData }) {
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
    <div style={{ fontFamily: ft, fontSize: 42, fontWeight: 900, color: D.tx, letterSpacing: -2, marginBottom: 8 }}>Activity Log</div>
    <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 500, color: D.txb, marginBottom: 32 }}>View and manage completed episodes.</div>

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
          <div style={{ fontFamily: mn, fontSize: 9, color: D.txl }}>{e.date}</div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span onClick={function() { setViewIdx(i); }} style={{ fontFamily: mn, fontSize: 9, color: D.teal, padding: "4px 12px", background: D.teal + "0A", borderRadius: 6, cursor: "pointer", border: "1px solid " + D.teal + "30" }}>View Launch Kit</span>
          <span onClick={function() { downloadLaunchKit(e); }} style={{ fontFamily: mn, fontSize: 9, color: ACC, cursor: "pointer", padding: "4px 12px", background: ACC + "0A", borderRadius: 6, border: "1px solid " + ACC + "30" }}>Download Launch Kit</span>
          {e.social && <span onClick={function() { downloadSocialKit(e); }} style={{ fontFamily: mn, fontSize: 9, color: D.blue, cursor: "pointer", padding: "4px 12px", background: D.blue + "0A", borderRadius: 6, border: "1px solid " + D.blue + "30" }}>Download Social Kit</span>}
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
          {Object.keys(viewEntry.social).map(function(k) { return <div key={k} style={{ marginBottom: 10, padding: "12px 14px", background: D.surface, borderRadius: 10, border: "1px solid " + D.border }}>
            <div style={{ fontFamily: mn, fontSize: 9, color: ACC, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 5 }}>{k.replace(/_/g, " ")}</div>
            <div style={{ fontFamily: ft, fontSize: 13, color: D.txb, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{viewEntry.social[k]}</div>
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

// ═══ MAIN COMPONENT ═══
export default function SAWeekly() {
  var STEPS = ["Setup", "Generate", "Review", "Social", "Clips", "Export", "Log"];
  var _step = useState(0), step = _step[0], setStep = _step[1];

  // Episode state
  var _e = useState({ number: "008", link: "", transcript: "", timestamps: "", extra: "" }), ep = _e[0], setEp = _e[1];
  var _g = useState([]), guests = _g[0], setGuests = _g[1];
  var _o = useState(null), opts = _o[0], setOpts = _o[1];
  var _sl = useState({ title: 0, desc: 0, thumb: 0 }), sel = _sl[0], setSel = _sl[1];
  var _f = useState(null), fin = _f[0], setFin = _f[1];
  var _th = useState(null), thumb = _th[0], setThumb = _th[1];
  var _dl = useState("medium"), descLen = _dl[0], setDescLen = _dl[1];
  var _sr = useState(null), socialRes = _sr[0], setSocialRes = _sr[1];
  var _lch = useState(false), launched = _lch[0], setLaunched = _lch[1];
  var _log = useState([]), logData = _log[0], setLogData = _log[1];
  var _loaded = useState(false), loaded = _loaded[0], setLoaded = _loaded[1];
  var _hasDraft = useState(false), hasDraft = _hasDraft[0], setHasDraft = _hasDraft[1];
  var _interacted = useState(false), interacted = _interacted[0], setInteracted = _interacted[1];
  var draftRef = useRef(null);

  // Load state on mount: try Supabase first (800ms timeout), fall back to Redis
  useEffect(function() {
    var settled = false;
    var applyData = function(d) {
      if (d.log && Array.isArray(d.log)) setLogData(d.log);
      if (d.state && (d.state.ep && d.state.ep.transcript || d.state.opts || d.state.fin)) {
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
        var row = res.data.find(function(r) { return r.type === "weekly" && r.id === "weekly-master"; });
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
    if (s.ep) setEp(s.ep);
    if (s.guests) setGuests(s.guests);
    if (s.opts) setOpts(s.opts);
    if (s.sel) setSel(s.sel);
    if (s.fin) setFin(s.fin);
    if (s.thumb) setThumb(s.thumb);
    if (s.launched) setLaunched(s.launched);
    if (s.descLen) setDescLen(s.descLen);
    if (s.socialRes) setSocialRes(s.socialRes);
    // Restore step based on how far user got
    if (s.launched) setStep(6);
    else if (s.socialRes) setStep(5);
    else if (s.fin) setStep(3);
    else if (s.opts) setStep(2);
    else if (s.ep && s.ep.transcript) setStep(1);
    setHasDraft(false);
    draftRef.current = null;
    setInteracted(true);
  };

  // Auto-save
  useEffect(function() {
    if (!loaded || !interacted) return;
    saveState({ ep: ep, guests: guests, opts: opts, sel: sel, fin: fin, thumb: null, launched: launched, descLen: descLen, socialRes: socialRes }, logData);
  }, [ep, guests, opts, sel, fin, thumb, launched, descLen, socialRes, logData, loaded, interacted]);

  // Mark as interacted
  useEffect(function() {
    if (!loaded) return;
    if (ep.transcript || ep.link || guests.length > 0) setInteracted(true);
  }, [ep, guests, loaded]);

  var gn = guests.filter(function(g) { return g.name; }).map(function(g) { return g.name; }).join(", ");

  var handleComplete = function(data) {
    setLaunched(true);
    var entry = { episode: ep.number, title: data.title, description: data.description, guests: gn, date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), social: data.social };
    setLogData(function(prev) { return [entry].concat(prev); });
    setStep(6); // go to log
  };

  // Step navigation logic
  var canNavigate = function(targetStep) {
    if (targetStep === 0) return true; // always can go to setup
    if (targetStep === 1) return !!ep.transcript; // need transcript for generate
    if (targetStep === 2) return !!opts; // need generated options for review
    if (targetStep === 3) return !!fin; // need finalized selections for social
    if (targetStep === 4) return !!fin; // clips available after finalize
    if (targetStep === 5) return !!fin; // export available after finalize
    if (targetStep === 6) return true; // log always available
    return false;
  };

  return (<div>
    <Toast />
    <style dangerouslySetInnerHTML={{ __html: "@keyframes progressSlide{0%{left:-40%}100%{left:100%}}.progress-slide{animation:progressSlide 1.5s ease-in-out infinite}@keyframes dotPulse{0%,80%,100%{opacity:0.2}40%{opacity:1}}.progress-dots::after{content:'...';display:inline-block;animation:dotPulse 1.4s ease-in-out infinite}@keyframes confetti-fall{0%{transform:translateY(-20px) translateX(0) rotate(0deg);opacity:1}70%{opacity:1}100%{transform:translateY(calc(80vh)) translateX(var(--drift)) rotate(var(--rot));opacity:0}}" }} />

    {/* Header */}
    <div style={{ padding: "24px 0", borderBottom: "1px solid " + D.border, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", background: D.bg + "E0" }}>
      <div>
        <div style={{ fontFamily: ft, fontSize: 42, fontWeight: 900, color: D.tx, letterSpacing: -2 }}>SemiAnalysis Weekly</div>
        <div style={{ fontFamily: mn, fontSize: 11, color: D.txb, marginTop: 4, letterSpacing: "2px", textTransform: "uppercase" }}>{"Ep #" + ep.number + (gn ? " . " + gn : "") + (launched ? " . Launched" : fin ? " . Saved" : "")}</div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {hasDraft && <span onClick={loadDraft} style={{ fontFamily: mn, fontSize: 9, color: ACC, cursor: "pointer", padding: "6px 12px", border: "1px solid " + ACC + "40", borderRadius: 8, background: ACC + "08", transition: "all 0.2s ease" }}>Load from Draft</span>}
        <a href="https://youtube.com/@SemianalysisWeekly" target="_blank" rel="noopener noreferrer" style={{ fontFamily: mn, fontSize: 9, color: D.txl, textDecoration: "none", padding: "6px 12px", border: "1px solid " + D.border, borderRadius: 8, transition: "all 0.2s ease" }}>@SemianalysisWeekly</a>
      </div>
    </div>

    {/* Step Tracker */}
    <div style={{ marginTop: 28 }}>
      <StepTracker current={step} steps={STEPS} canNavigate={canNavigate} onNav={function(i) { if (canNavigate(i) || i < step) setStep(i); }} />
    </div>

    {/* Step Content */}
    <div style={{ paddingBottom: 60 }}>
      {step === 0 && <StepSetup ep={ep} setEp={setEp} guests={guests} setGuests={setGuests} />}
      {step === 1 && <StepGenerate ep={ep} guests={guests} opts={opts} setOpts={setOpts} sel={sel} setSel={setSel} fin={fin} setFin={setFin} descLen={descLen} setDescLen={setDescLen} onDone={function() {}} />}
      {step === 2 && <StepReview opts={opts} sel={sel} fin={fin} setFin={setFin} thumb={thumb} setThumb={setThumb} onDone={function() { setStep(3); }} />}
      {step === 3 && <StepSocial ep={ep} guests={guests} fin={fin} socialRes={socialRes} setSocialRes={setSocialRes} />}
      {step === 4 && <StepClips />}
      {step === 5 && <StepExport ep={ep} guests={guests} fin={fin} socialRes={socialRes} onComplete={handleComplete} />}
      {step === 6 && <StepLog logData={logData} setLogData={setLogData} />}
    </div>

    {/* Step navigation buttons */}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 40 }}>
      {step > 0 ? <button onClick={function() { setStep(step - 1); }} style={{ padding: "14px 24px", background: "transparent", border: "1px solid " + D.border, color: D.txl, borderRadius: 10, fontFamily: ft, fontSize: 14, cursor: "pointer", transition: "all 0.2s" }}>Back</button> : <div />}
      {step < 6 ? <button onClick={function() { if (canNavigate(step + 1)) setStep(step + 1); }} disabled={!canNavigate(step + 1)} style={{ padding: "14px 32px", background: canNavigate(step + 1) ? "linear-gradient(135deg, " + ACC + ", #C84E35)" : D.surface, color: canNavigate(step + 1) ? D.tx : D.txl, border: "none", borderRadius: 10, fontFamily: ft, fontSize: 14, fontWeight: 800, cursor: canNavigate(step + 1) ? "pointer" : "not-allowed", opacity: canNavigate(step + 1) ? 1 : 0.35, boxShadow: canNavigate(step + 1) ? "0 4px 20px rgba(224,99,71,0.3)" : "none", transition: "all 0.2s" }}>Next Step</button> : <div />}
    </div>
  </div>);
}
