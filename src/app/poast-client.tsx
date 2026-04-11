// @ts-nocheck
"use client";
import { useState, useEffect, useRef } from "react";

var C = {
  amber: "#F7B041", blue: "#0B86D1", teal: "#2EAD8E", coral: "#E06347",
  violet: "#905CCB", bg: "#0B0B12", card: "#12121C", border: "#1C1C2C",
  surface: "#181826", tx: "#E8E4DD", txm: "#8A8690", txd: "#4E4B56",
};
var PL = { x: "#1DA1F2", li: "#0A66C2", fb: "#1877F2", ig: "#E4405F", yt: "#FF0000", tt: "#00F2EA" };
var ft = "'Outfit',sans-serif";
var mn = "'JetBrains Mono',monospace";

var SYS_EP = "You are a content strategist for SemiAnalysis, a semiconductor and AI infrastructure research firm. Rules: Never use em dashes, use commas or periods. No emojis. Be direct, not clickbait. When mentioning guests in descriptions, include their social handle in parentheses on first mention, e.g. Jordan Nanos (@JordanNanos). RESPOND ONLY IN VALID JSON. No markdown fences. No preamble.";

var SYS_SOC = "You are a social media strategist for SemiAnalysis Weekly. Rules: Never use em dashes. No emojis. No hashtags on X/Twitter ever. YT Shorts titles under 40 chars. Instagram: caption + Save this for later CTA + 5-8 hashtags + location San Francisco CA, point to youtube.com/@SemianalysisWeekly. TikTok: all lowercase 4-6 hashtags. LinkedIn/Facebook: link in first comment, end Link in comments. X: Hook tweet no link + reply-to-self with link. Mention all guests with handles on every platform. RESPOND ONLY IN VALID JSON. No markdown fences. No preamble.";

async function ask(sys, prompt) {
  try {
    var r = await fetch("/api/generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: sys, prompt: prompt }),
    });
    var d = await r.json();
    var t = (d.content || []).map(function(c) { return c.text || ""; }).join("");
    return JSON.parse(t.replace(/```json|```/g, "").trim());
  } catch (e) { console.error("API:", e); return null; }
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
function Label({ children }) { return <div style={{ fontFamily: mn, fontSize: 10, color: C.txm, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 6 }}>{children}</div>; }
function Field({ label, value, onChange, placeholder, isMono }) { return (<div style={{ marginBottom: 14 }}>{label && <Label>{label}</Label>}<input value={value} onChange={function(e) { onChange(e.target.value); }} placeholder={placeholder} style={{ width: "100%", padding: "10px 12px", background: C.card, border: "1px solid " + C.border, borderRadius: 6, color: C.tx, fontFamily: isMono ? mn : ft, fontSize: 13, outline: "none", boxSizing: "border-box" }} onFocus={function(e) { e.target.style.borderColor = C.amber; }} onBlur={function(e) { e.target.style.borderColor = C.border; }} /></div>); }
function Btn({ children, onClick, loading, sec, sm, off }) { return (<button onClick={onClick} disabled={loading || off} style={{ padding: sm ? "6px 13px" : "10px 24px", background: off ? C.surface : sec ? "transparent" : C.amber, color: off ? C.txd : sec ? C.amber : C.bg, border: sec ? "1px solid " + (off ? C.border : C.amber) : "none", borderRadius: 6, fontFamily: ft, fontSize: sm ? 11 : 13, fontWeight: 700, cursor: loading || off ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1 }}>{loading ? "Working..." : children}</button>); }
function CopyBtn({ text }) { var _s = useState(false), ok = _s[0], set = _s[1]; return <span onClick={function(e) { e.stopPropagation(); set(copyText(text)); setTimeout(function() { set(false); }, 1200); }} style={{ fontFamily: mn, fontSize: 9, color: ok ? C.amber : C.txd, cursor: "pointer", padding: "2px 6px", borderRadius: 3, border: "1px solid " + C.border, userSelect: "none" }}>{ok ? "Copied" : "Copy"}</span>; }
function Divider() { return <div style={{ borderBottom: "1px solid " + C.border, margin: "24px 0" }} />; }

function Pick({ text, picked, onPick, onRedo, rLoading }) {
  return (<div onClick={onPick} style={{ background: picked ? C.amber + "0C" : C.card, border: "1px solid " + (picked ? C.amber : C.border), borderRadius: 7, padding: "12px 16px", marginBottom: 7, cursor: "pointer" }}>
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
  return (<div style={{ background: C.card, border: "1px solid " + C.border, borderLeft: "3px solid " + (color || C.amber), borderRadius: 7, padding: "13px 16px", marginBottom: 8 }}>
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

// ═══ SIDEBAR ═══
function Sidebar({ active, onNav }) {
  var nav = [{ id: "weekly", l: "SA Weekly", ic: "\uD83C\uDF99", on: true }, { id: "carousel", l: "IG Carousel", ic: "\uD83D\uDCD0", on: false }, { id: "news", l: "News Flow", ic: "\uD83D\uDCE1", on: false }];
  return (<div style={{ width: 200, minHeight: "100vh", background: C.bg, borderRight: "1px solid " + C.border, display: "flex", flexDirection: "column", position: "fixed", left: 0, top: 0, zIndex: 100 }}>
    <div style={{ padding: "26px 20px 18px", borderBottom: "1px solid " + C.border }}><div style={{ fontFamily: ft, fontSize: 21, fontWeight: 800, color: C.amber }}>POAST</div><div style={{ fontFamily: mn, fontSize: 8, color: C.txd, letterSpacing: "2px", marginTop: 3, textTransform: "uppercase" }}>Content Command Center</div></div>
    <div style={{ padding: "12px 8px", flex: 1 }}>{nav.map(function(n) { var s = active === n.id; return (<div key={n.id} onClick={function() { if (n.on) onNav(n.id); }} style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 12px", borderRadius: 6, marginBottom: 2, cursor: n.on ? "pointer" : "not-allowed", background: s ? C.surface : "transparent", borderLeft: s ? "3px solid " + C.amber : "3px solid transparent", opacity: n.on ? 1 : 0.28 }}><span style={{ fontSize: 14 }}>{n.ic}</span><span style={{ fontFamily: ft, fontSize: 12, fontWeight: s ? 700 : 500, color: s ? C.amber : C.txm }}>{n.l}</span>{!n.on && <span style={{ fontFamily: mn, fontSize: 8, color: C.txd, marginLeft: "auto" }}>soon</span>}</div>); })}</div>
    <div style={{ padding: "12px 16px", borderTop: "1px solid " + C.border, fontFamily: mn, fontSize: 8, color: C.txd }}>v0.4 // SemiAnalysis</div>
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
    var data = await ask(SYS_EP, buildPrompt(["Generate 3 NEW titles for SemiAnalysis Weekly Ep #" + ep.number + ".", "Keywords: " + keywords, "Guests: " + gStr(guests), "Different from: " + existing, "Transcript: " + ep.transcript.slice(0, 4000), 'Return JSON: {"titles":["t1","t2","t3"]}']));
    if (data && data.titles) { setOpts(function(prev) { return Object.assign({}, prev, { titles: data.titles }); }); setSel(function(prev) { return Object.assign({}, prev, { title: 0 }); }); }
    setKwL(false);
  };

  var redoOne = async function(cat, idx) {
    var k = cat + "-" + idx; setRL(function(p) { var o = Object.assign({}, p); o[k] = true; return o; });
    var cur = opts[cat][idx]; var curStr = typeof cur === "string" ? cur : cur.concept;
    var gs = gStr(guests); var tx = ep.transcript.slice(0, 3000); var p2, parse;
    if (cat === "thumbnails") { p2 = buildPrompt(["ONE new thumbnail for SA Weekly Ep #" + ep.number + ". Different from: " + curStr, "Guests: " + gs, "Transcript: " + tx, 'Return JSON: {"concept":"...","text_overlay":"...","mood":"..."}']); parse = function(d) { return d; };
    } else { var dn = cat === "descriptions" ? " " + descInstr() : ""; var en = cat === "descriptions" && ep.extra ? " Context: " + ep.extra : ""; var tsn = cat === "descriptions" && ep.timestamps ? " Timestamps:\n" + ep.timestamps : ""; p2 = buildPrompt(["ONE new " + (cat === "titles" ? "title" : "description") + " for SA Weekly Ep #" + ep.number + ". Different from: " + curStr + "." + dn, "Guests: " + gs + en + tsn, "Transcript: " + tx, 'Return JSON: {"result":"..."}']); parse = function(d) { return d.result; }; }
    var data = await ask(SYS_EP, p2);
    if (data) { setOpts(function(prev) { var c2 = Object.assign({}, prev); c2[cat] = prev[cat].slice(); c2[cat][idx] = parse(data); return c2; }); }
    setRL(function(p) { var o = Object.assign({}, p); o[k] = false; return o; });
  };

  var redoCat = async function(cat) {
    var k = "all-" + cat; setRL(function(p) { var o = Object.assign({}, p); o[k] = true; return o; });
    var gs = gStr(guests); var tx = ep.transcript.slice(0, 4000); var p2;
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

    <div style={{ display: "flex", gap: 10 }}>
      <Btn onClick={genAll} loading={loading} off={!ep.transcript}>Generate Options</Btn>
      {opts && <Btn onClick={genAll} loading={loading} sec sm>Full Regen</Btn>}
    </div>

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
      <div style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: 8, padding: 20, marginBottom: 20 }}>
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

  var doubleCheck = async function() { setCheckL(true); var thC = typeof fin.thumbnail === "string" ? fin.thumbnail : fin.thumbnail.concept; var thT2 = typeof fin.thumbnail === "string" ? "" : fin.thumbnail.text_overlay; var data = await ask(SYS_EP, buildPrompt(["Review title/description/thumbnail for SA Weekly Ep #" + ep.number + " for max exposure.", "Title: " + fin.title, "Description: " + (fin.description || "").slice(0, 300), "Thumbnail: " + thC + " | Text: " + thT2, "Guests: " + gStr(guests), "Evaluate cohesion, redundancy, scroll-stopping. Score 1-10.", 'Return JSON: {"score":8,"feedback":"...","suggestions":["s1","s2"]}'])); if (data) setCheckR(data); setCheckL(false); };

  var runAB = async function() { setAbL(true); var allT = opts && opts.titles || []; var allTh = opts && opts.thumbnails || []; var mS = abM === "both" ? "Title + Thumbnail" : abM === "title" ? "Title only" : "Thumbnail only"; var data = await ask(SYS_EP, buildPrompt(["A/B Test SA Weekly Ep #" + ep.number, "Current title: " + fin.title, "Current thumb: " + (typeof fin.thumbnail === "string" ? fin.thumbnail : fin.thumbnail.concept), "All titles: " + JSON.stringify(allT), "All thumbs: " + JSON.stringify(allTh), "Mode: " + mS + ". Find best CTR combo.", 'Return JSON: {"current_combo_score":7,"recommended_title":"...","recommended_thumbnail_concept":"...","recommended_combo_score":9,"reasoning":"...","is_change_recommended":true}'])); if (data) setAbR(data); setAbL(false); };

  var applyAB = function() { if (!abR) return; var nf = Object.assign({}, fin); if ((abM === "title" || abM === "both") && abR.recommended_title) nf.title = abR.recommended_title; if ((abM === "thumbnail" || abM === "both") && abR.recommended_thumbnail_concept) { nf.thumbnail = typeof fin.thumbnail === "string" ? abR.recommended_thumbnail_concept : Object.assign({}, fin.thumbnail, { concept: abR.recommended_thumbnail_concept }); } setFin(nf); setAbR(null); setCheckR(null); };

  return (<div>
    <div style={{ fontFamily: ft, fontSize: 20, fontWeight: 800, color: C.tx, marginBottom: 4 }}>Test Page</div>
    <div style={{ fontFamily: mn, fontSize: 10, color: C.txm, marginBottom: 28 }}>Preview, double check, A/B test, then finalize.</div>
    <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 10, overflow: "hidden", marginBottom: 24 }}>
      <div style={{ width: "100%", aspectRatio: "16/9", background: C.surface, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>{thumb ? <img src={thumb} alt="Thumb" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ textAlign: "center" }}><div style={{ fontFamily: ft, fontSize: 15, color: C.txd }}>Thumbnail Preview</div></div>}<div style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.8)", borderRadius: 3, padding: "2px 6px", fontFamily: mn, fontSize: 10, color: "#fff" }}>42:18</div></div>
      <div style={{ padding: "14px 16px" }}><div style={{ fontFamily: ft, fontSize: 15, fontWeight: 700, color: C.tx, lineHeight: 1.4, marginBottom: 8 }}>{fin.title}</div><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 28, height: 28, borderRadius: "50%", background: C.amber, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: ft, fontSize: 11, fontWeight: 800, color: C.bg }}>SA</div><div style={{ fontFamily: ft, fontSize: 12, color: C.txm, fontWeight: 600 }}>SemiAnalysis Weekly</div></div></div>
    </div>
    <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 8, padding: 18, marginBottom: 20 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><div style={{ fontFamily: mn, fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: "1.5px" }}>Description</div><CopyBtn text={fin.description} /></div><div style={{ fontFamily: ft, fontSize: 13, color: C.tx, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{fin.description}</div></div>
    <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 8, padding: 18, marginBottom: 24 }}><div style={{ fontFamily: mn, fontSize: 10, color: C.violet, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 8 }}>Thumbnail Concept</div><div style={{ fontFamily: ft, fontSize: 13, color: C.tx, lineHeight: 1.6 }}>{thS}</div></div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
      <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, background: C.card, border: "2px dashed " + C.border, borderRadius: 8, cursor: "pointer" }}><div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: C.amber, marginBottom: 3 }}>A. Upload Thumbnail</div><div style={{ fontFamily: mn, fontSize: 10, color: C.txd }}>PNG, JPG, 1280x720</div><input type="file" accept="image/*" style={{ display: "none" }} onChange={function(e) { var f = e.target.files && e.target.files[0]; if (!f) return; var r = new FileReader(); r.onload = function(ev) { setThumb(ev.target.result); }; r.readAsDataURL(f); e.target.value = ""; }} /></label>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, background: C.card, border: "2px dashed " + C.border, borderRadius: 8, opacity: 0.35 }}><div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: C.txm, marginBottom: 3 }}>B. Get One Prompted</div><div style={{ fontFamily: mn, fontSize: 10, color: C.txd }}>Coming Soon</div></div>
    </div>
    {thumb && <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20 }}><span style={{ fontFamily: mn, fontSize: 10, color: C.teal }}>Thumbnail uploaded</span><span onClick={function() { setThumb(null); }} style={{ fontFamily: mn, fontSize: 9, color: C.txd, cursor: "pointer" }}>Remove</span></div>}
    <Divider />
    <div style={{ marginBottom: 24 }}><div style={{ fontFamily: ft, fontSize: 16, fontWeight: 700, color: C.tx, marginBottom: 8 }}>Double Check</div><Btn onClick={doubleCheck} loading={checkL} sec>Run Double Check</Btn>
      {checkR && <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 8, padding: 18, marginTop: 14 }}><div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}><div style={{ width: 48, height: 48, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: (checkR.score >= 8 ? C.teal : checkR.score >= 5 ? C.amber : C.coral) + "20", border: "2px solid " + (checkR.score >= 8 ? C.teal : checkR.score >= 5 ? C.amber : C.coral), fontFamily: mn, fontSize: 18, fontWeight: 700, color: checkR.score >= 8 ? C.teal : checkR.score >= 5 ? C.amber : C.coral }}>{checkR.score}</div><div><div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: C.tx }}>Cohesion Score</div></div></div><div style={{ fontFamily: ft, fontSize: 13, color: C.tx, lineHeight: 1.6, marginBottom: 12 }}>{checkR.feedback}</div>{checkR.suggestions && checkR.suggestions.map(function(s, i) { return <div key={i} style={{ fontFamily: ft, fontSize: 12, color: C.txm, paddingLeft: 10, borderLeft: "2px solid " + C.border, marginBottom: 4 }}>{s}</div>; })}</div>}
    </div>
    <Divider />
    <div style={{ marginBottom: 24 }}><div style={{ fontFamily: ft, fontSize: 16, fontWeight: 700, color: C.tx, marginBottom: 8 }}>A/B Testing</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>{[{ id: "title", l: "Title Only" }, { id: "thumbnail", l: "Thumbnail Only" }, { id: "both", l: "Title + Thumbnail" }].map(function(m) { var s2 = abM === m.id; return <div key={m.id} onClick={function() { setAbM(m.id); }} style={{ padding: "7px 14px", borderRadius: 5, cursor: "pointer", background: s2 ? C.amber + "15" : C.card, border: "1px solid " + (s2 ? C.amber : C.border), fontFamily: mn, fontSize: 10, color: s2 ? C.amber : C.txm }}>{m.l}</div>; })}</div>
      <div style={{ display: "flex", gap: 8 }}><Btn onClick={runAB} loading={abL} sec>Run A/B Test</Btn>{abR && <Btn onClick={function() { setAbR(null); runAB(); }} loading={abL} sec sm>Redo Fresh</Btn>}</div>
      {abR && <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 8, padding: 18, marginTop: 14 }}><div style={{ display: "flex", gap: 20, marginBottom: 14 }}><div style={{ textAlign: "center" }}><div style={{ fontFamily: mn, fontSize: 9, color: C.txm }}>CURRENT</div><div style={{ fontFamily: mn, fontSize: 22, fontWeight: 700, color: C.txm }}>{abR.current_combo_score}</div></div><div style={{ fontFamily: ft, fontSize: 20, color: C.txd, alignSelf: "center" }}>&rarr;</div><div style={{ textAlign: "center" }}><div style={{ fontFamily: mn, fontSize: 9, color: C.amber }}>RECOMMENDED</div><div style={{ fontFamily: mn, fontSize: 22, fontWeight: 700, color: C.amber }}>{abR.recommended_combo_score}</div></div></div>{abR.is_change_recommended ? <div>{abR.recommended_title && <div style={{ marginBottom: 10 }}><div style={{ fontFamily: mn, fontSize: 9, color: C.txm }}>TITLE</div><div style={{ fontFamily: ft, fontSize: 14, color: C.tx, fontWeight: 600 }}>{abR.recommended_title}</div></div>}{abR.recommended_thumbnail_concept && <div style={{ marginBottom: 10 }}><div style={{ fontFamily: mn, fontSize: 9, color: C.txm }}>THUMBNAIL</div><div style={{ fontFamily: ft, fontSize: 13, color: C.tx }}>{abR.recommended_thumbnail_concept}</div></div>}<div style={{ fontFamily: ft, fontSize: 12, color: C.txm, marginBottom: 14 }}>{abR.reasoning}</div><Btn onClick={applyAB} sm>Apply</Btn></div> : <div style={{ fontFamily: ft, fontSize: 13, color: C.teal }}>Current combo is already strongest.</div>}</div>}
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
    <div style={{ background: "linear-gradient(135deg," + C.card + "," + C.surface + ")", border: "1px solid " + C.border, borderRadius: 10, padding: 22, marginBottom: 22 }}>
      <div style={{ fontFamily: mn, fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: "2px", marginBottom: 6 }}>{"Episode #" + ep.number + " // Full Launch"}</div>
      <div style={{ fontFamily: ft, fontSize: 20, fontWeight: 800, color: C.tx }}>{fin.title}</div>
      <div style={{ fontFamily: ft, fontSize: 12, color: C.txm, marginTop: 4 }}>{gs}</div>
    </div>
    <div style={{ marginBottom: 16 }}><Label>Hook / Angle</Label><textarea value={hook} onChange={function(e) { setHook(e.target.value); }} rows={3} style={{ width: "100%", padding: "10px 12px", background: C.card, border: "1px solid " + C.border, borderRadius: 6, color: C.tx, fontFamily: ft, fontSize: 13, outline: "none", boxSizing: "border-box", resize: "vertical" }} /></div>
    <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
      <Btn onClick={gen} loading={loading}>Generate Launch Rollout</Btn>
      {res && <Btn onClick={gen} loading={loading} sec sm>Regen All</Btn>}
    </div>

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
      <div onClick={function(e) { e.stopPropagation(); }} style={{ background: C.card, border: "1px solid " + C.amber, borderRadius: 12, padding: 36, maxWidth: 440, textAlign: "center" }}>
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

function LogTab({ logData }) {
  return (<div>
    <div style={{ fontFamily: ft, fontSize: 16, fontWeight: 700, color: C.tx, marginBottom: 16 }}>Activity Log</div>
    {logData.length === 0 ? <div style={{ textAlign: "center", padding: 60, color: C.txd, fontFamily: ft, fontSize: 13 }}>No completed episodes yet.</div>
      : logData.map(function(e, i) { return (<div key={i} style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 8, padding: "16px 18px", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
          <div style={{ width: 40, height: 40, borderRadius: 6, background: C.surface, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mn, fontSize: 12, color: C.amber, fontWeight: 700, border: "1px solid " + C.border }}>{"#" + e.episode}</div>
          <div style={{ flex: 1 }}><div style={{ fontFamily: ft, fontSize: 14, fontWeight: 600, color: C.tx }}>{e.title}</div><div style={{ fontFamily: ft, fontSize: 11, color: C.txm }}>{e.guests}</div></div>
          <div style={{ fontFamily: mn, fontSize: 9, color: C.txd }}>{e.date}</div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontFamily: mn, fontSize: 9, color: C.teal, padding: "2px 8px", background: C.teal + "15", borderRadius: 4 }}>Launch Kit</span>
          {e.social && <span onClick={function() { exportDoc("Ep #" + e.episode + " Launch Rollout", [{ heading: "Social Kit", items: Object.keys(e.social).map(function(k) { return { label: k, content: e.social[k] }; }) }]); }} style={{ fontFamily: mn, fontSize: 9, color: C.amber, cursor: "pointer", padding: "2px 8px", background: C.amber + "15", borderRadius: 4 }}>Download .doc</span>}
        </div>
      </div>); })}
  </div>);
}

// ═══ APP ═══
export default function App() {
  var _s = useState("weekly"), sec = _s[0], setSec = _s[1];
  var _t = useState("setup"), tab = _t[0], setTab = _t[1];
  var _e = useState({ number: "008", link: "", transcript: "", timestamps: "", extra: "" }), ep = _e[0], setEp = _e[1];
  var _g = useState([]), guests = _g[0], setGuests = _g[1];
  var _o = useState(null), opts = _o[0], setOpts = _o[1];
  var _sl = useState({ title: 0, desc: 0, thumb: 0 }), sel = _sl[0], setSel = _sl[1];
  var _f = useState(null), fin = _f[0], setFin = _f[1];
  var _th = useState(null), thumb = _th[0], setThumb = _th[1];
  var _lch = useState(false), launched = _lch[0], setLaunched = _lch[1];
  var _log = useState([]), logData = _log[0], setLogData = _log[1];

  var tabs = [{ id: "setup", l: "Episode Setup" }, { id: "test", l: "Test Page" }, { id: "launch", l: "Launch Rollout" }, { id: "clips", l: "Clip Manager" }, { id: "log", l: "Activity Log" }];
  var locks = [];
  if (!fin) { locks.push("test"); locks.push("launch"); }
  if (!launched) locks.push("clips");
  var gn = guests.filter(function(g) { return g.name; }).map(function(g) { return g.name; }).join(", ");

  var handleComplete = function(data) {
    setLaunched(true);
    var entry = { episode: ep.number, title: data.title, guests: gn, date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), social: data.social };
    setLogData(function(prev) { return [entry].concat(prev); });
  };

  return (<div style={{ background: C.bg, minHeight: "100vh" }}>
    <style dangerouslySetInnerHTML={{ __html: "@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{background:" + C.bg + "}::selection{background:" + C.amber + "33;color:" + C.amber + "}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:" + C.bg + "}::-webkit-scrollbar-thumb{background:" + C.border + ";border-radius:3px}" }} />
    <Sidebar active={sec} onNav={setSec} />
    <div style={{ marginLeft: 200 }}>
      <div style={{ padding: "16px 36px", borderBottom: "1px solid " + C.border, display: "flex", justifyContent: "space-between", alignItems: "center", background: C.bg, position: "sticky", top: 0, zIndex: 50 }}>
        <div><div style={{ fontFamily: ft, fontSize: 18, fontWeight: 800, color: C.tx }}>SemiAnalysis Weekly</div><div style={{ fontFamily: mn, fontSize: 9, color: C.txm, marginTop: 1 }}>{"Ep #" + ep.number + (gn ? " . " + gn : "") + (launched ? " . Launched" : fin ? " . Saved" : "")}</div></div>
        <a href="https://youtube.com/@SemianalysisWeekly" target="_blank" rel="noopener noreferrer" style={{ fontFamily: mn, fontSize: 9, color: C.txd, textDecoration: "none", padding: "5px 10px", border: "1px solid " + C.border, borderRadius: 5 }}>@SemianalysisWeekly</a>
      </div>
      <div style={{ padding: "0 36px" }}><TabBar items={tabs} active={tab} onPick={setTab} locks={locks} /></div>
      <div style={{ padding: "0 36px 60px" }}>
        {tab === "setup" && <EpisodeSetup ep={ep} setEp={setEp} guests={guests} setGuests={setGuests} opts={opts} setOpts={setOpts} sel={sel} setSel={setSel} fin={fin} setFin={setFin} goTest={function() { setTab("test"); }} />}
        {tab === "test" && <TestPage ep={ep} guests={guests} opts={opts} fin={fin} setFin={setFin} thumb={thumb} setThumb={setThumb} goLaunch={function() { setTab("launch"); }} />}
        {tab === "launch" && <LaunchRollout ep={ep} guests={guests} fin={fin} onComplete={handleComplete} />}
        {tab === "clips" && <ClipMgr />}
        {tab === "log" && <LogTab logData={logData} />}
      </div>
    </div>
  </div>);
}
