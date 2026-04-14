// @ts-nocheck
"use client";
import { useState, useEffect, useCallback, useRef } from "react";

// ═══ DESIGN LANGUAGE ═══
var D = {
  bg: "#060608", card: "#09090D", border: "rgba(255,255,255,0.06)", cardHover: "#0D0D12", cardActive: "#101018",
  amber: "#F7B041", teal: "#2EAD8E", blue: "#0B86D1", coral: "#E06347", violet: "#905CCB", crimson: "#D1334A",
  tx: "#E8E4DD", txs: "rgba(255,255,255,0.4)", accent: "#F7B041",
  glow: "0 2px 12px rgba(0,0,0,0.4)",
};
var ft = "'Outfit',sans-serif";
var mn = "'JetBrains Mono',monospace";
var PLATS = {
  twitter: { n: "X / Twitter", i: "\uD83D\uDC26", c: "#1DA1F2", s: "X", lim: 280 },
  linkedin: { n: "LinkedIn", i: "\uD83D\uDCBC", c: "#0A66C2", s: "LI", lim: 3000 },
  facebook: { n: "Facebook", i: "\uD83D\uDCD8", c: "#1877F2", s: "FB", lim: 63206 },
  instagram: { n: "Instagram", i: "\uD83D\uDCF7", c: "#E4405F", s: "IG", lim: 2200 },
  youtube: { n: "YouTube", i: "\u25B6\uFE0F", c: "#FF0000", s: "YT", lim: 5000 },
  tiktok: { n: "TikTok", i: "\uD83C\uDFB5", c: "#00F2EA", s: "TT", lim: 2200 },
  threads: { n: "Threads", i: "\uD83E\uDDF5", c: "#999", s: "TH", lim: 500 },
  bluesky: { n: "Bluesky", i: "\u2601\uFE0F", c: "#0085FF", s: "BS", lim: 300 },
};
function pl(svc) { return PLATS[svc] || { n: svc, i: "\uD83D\uDCE2", c: D.txs, s: svc, lim: 5000 }; }

// ═══ TOAST SYSTEM ═══
var _toasts = { current: null };
function addToast(msg, type) { if (_toasts.current) _toasts.current(msg, type); }

function ToastContainer() {
  var _list = useState([]), list = _list[0], setList = _list[1];
  _toasts.current = function(msg, type) {
    var id = Date.now();
    setList(function(p) { return [{ id: id, msg: msg, type: type || "success" }].concat(p).slice(0, 5); });
    setTimeout(function() { setList(function(p) { return p.filter(function(t) { return t.id !== id; }); }); }, 3200);
  };
  var colors = { success: D.teal, error: D.coral, info: D.amber };
  return <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 10000, display: "flex", flexDirection: "column", gap: 8 }}>
    <style dangerouslySetInnerHTML={{ __html: "@keyframes toastIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes toastDrain{from{width:100%}to{width:0}}" }} />
    {list.map(function(t) {
      var c = colors[t.type] || D.teal;
      return <div key={t.id} style={{ background: D.card, border: "1px solid " + D.border, borderLeft: "3px solid " + c, borderRadius: 10, padding: "12px 16px", minWidth: 280, boxShadow: "0 4px 24px rgba(0,0,0,0.5)", animation: "toastIn 0.25s ease", overflow: "hidden" }}>
        <div style={{ fontFamily: ft, fontSize: 12, color: D.tx, marginBottom: 6 }}>{t.msg}</div>
        <div style={{ height: 2, background: D.border, borderRadius: 1 }}><div style={{ height: "100%", background: c, borderRadius: 1, animation: "toastDrain 3s linear forwards" }} /></div>
      </div>;
    })}
  </div>;
}

// ═══ STAT CHIPS ═══
function StatRow({ data }) {
  if (!data) return null;
  var chips = [
    { l: "Scheduled", v: (data.scheduled || []).length, c: D.amber },
    { l: "Sent", v: (data.sent || []).length, c: D.teal },
    { l: "Drafts", v: (data.drafts || []).length, c: D.blue },
    { l: "Channels", v: (data.channels || []).length, c: D.violet },
  ];
  return <div style={{ display: "flex", gap: 0, background: D.card, border: "1px solid " + D.border, borderRadius: 8, overflow: "hidden", marginBottom: 20 }}>
    {chips.map(function(ch, i) {
      return <div key={i} style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", borderRight: i < 3 ? "1px solid " + D.border : "none" }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: ch.c, flexShrink: 0 }} />
        <span style={{ fontFamily: ft, fontSize: 12, color: D.txs }}>{ch.l}</span>
        <span style={{ fontFamily: mn, fontSize: 14, fontWeight: 700, color: D.tx, marginLeft: "auto" }}>{ch.v}</span>
      </div>;
    })}
  </div>;
}

// ═══ TAB BAR ═══
function Tab({ label, active, onClick, count }) {
  return <div onClick={onClick} style={{ padding: "10px 18px", cursor: "pointer", fontFamily: ft, fontSize: 13, fontWeight: active ? 700 : 500, color: active ? D.amber : D.txs, borderBottom: active ? "2px solid " + D.amber : "2px solid transparent", display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s ease" }}>{label}{count > 0 && <span style={{ fontFamily: mn, fontSize: 11, background: D.border, color: D.amber, padding: "1px 7px", borderRadius: 10 }}>{count}</span>}</div>;
}

// ═══ PLATFORM FILTER ═══
function PlatFilter({ channels, active, setActive }) {
  var svcs = []; (channels || []).forEach(function(ch) { if (svcs.indexOf(ch.service) < 0) svcs.push(ch.service); });
  return <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
    <span onClick={function() { setActive(null); }} style={{ height: 30, display: "inline-flex", alignItems: "center", gap: 4, padding: "0 12px", borderRadius: 6, cursor: "pointer", background: !active ? D.amber : "transparent", border: !active ? "none" : "1px solid " + D.border, color: !active ? D.bg : D.txs, fontFamily: ft, fontSize: 12, fontWeight: !active ? 600 : 400, transition: "all 0.15s ease" }}>All</span>
    {svcs.map(function(s) {
      var p = pl(s); var on = active === s;
      return <span key={s} onClick={function() { setActive(on ? null : s); }} style={{ height: 30, display: "inline-flex", alignItems: "center", gap: 4, padding: "0 12px", borderRadius: 6, cursor: "pointer", background: on ? D.amber : "transparent", border: on ? "none" : "1px solid " + D.border, color: on ? D.bg : D.txs, fontFamily: ft, fontSize: 12, fontWeight: on ? 600 : 400, transition: "all 0.15s ease" }}><span style={{ fontSize: 14 }}>{p.i}</span>{p.s}</span>;
    })}
  </div>;
}

// ═══ DRAFT CARD ═══
function DraftCard({ post, channels, onDelete, onRefresh, selected, onToggleSelect, showCheck }) {
  var svc = post.channel ? post.channel.service : post.channelService || "";
  var p = pl(svc);
  var _exp = useState(false), expanded = _exp[0], setExpanded = _exp[1];
  var _editing = useState(false), editing = _editing[0], setEditing = _editing[1];
  var _editText = useState(post.text || ""), editText = _editText[0], setEditText = _editText[1];
  var _rewriting = useState(false), rewriting = _rewriting[0], setRewriting = _rewriting[1];
  var _rwInput = useState(""), rwInput = _rwInput[0], setRwInput = _rwInput[1];
  var _rwLoading = useState(false), rwLoading = _rwLoading[0], setRwLoading = _rwLoading[1];
  var _rwResult = useState(null), rwResult = _rwResult[0], setRwResult = _rwResult[1];
  var _scheduling = useState(false), scheduling = _scheduling[0], setScheduling = _scheduling[1];
  var _schedDate = useState(""), schedDate = _schedDate[0], setSchedDate = _schedDate[1];
  var _schedTime = useState("08:00"), schedTime = _schedTime[0], setSchedTime = _schedTime[1];
  var _schedLoading = useState(false), schedLoading = _schedLoading[0], setSchedLoading = _schedLoading[1];
  var _delConfirm = useState(false), delConfirm = _delConfirm[0], setDelConfirm = _delConfirm[1];
  var _exiting = useState(false), exiting = _exiting[0], setExiting = _exiting[1];
  var _saving = useState(false), saving = _saving[0], setSaving = _saving[1];

  var text = rwResult || editText;
  var charLimit = p.lim;
  var charCount = text.length;
  var overLimit = charCount > charLimit;

  // Smart date suggestion: next Tue or Wed
  var nextSmart = function() {
    var d = new Date(); var day = d.getDay();
    var daysToTue = (2 - day + 7) % 7 || 7;
    var daysToWed = (3 - day + 7) % 7 || 7;
    var target = daysToTue <= daysToWed ? daysToTue : daysToWed;
    d.setDate(d.getDate() + target);
    return d.toISOString().slice(0, 10);
  };
  if (!schedDate) setTimeout(function() { setSchedDate(nextSmart()); }, 0);

  var renderText = function(t) {
    var parts = t.split(/(#\w+)/g);
    return parts.map(function(part, i) {
      if (part.startsWith("#")) return <span key={i} style={{ display: "inline-block", fontFamily: mn, fontSize: 11, color: D.amber, background: "rgba(247,176,65,0.12)", border: "1px solid rgba(247,176,65,0.25)", padding: "2px 8px", borderRadius: 4, margin: "1px 2px" }}>{part}</span>;
      return <span key={i}>{part}</span>;
    });
  };

  var doRewrite = async function() {
    setRwLoading(true);
    try {
      var r = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system: "You are editing a social media post for SemiAnalysis. Follow SA brand rules: no em dashes, no emojis, no hashtags on Twitter. Return only the rewritten post text, nothing else.", prompt: "Original post:\n" + text + "\n\nInstruction: " + rwInput }) });
      var d = await r.json(); var t = (d.content || []).map(function(c) { return c.text || ""; }).join("");
      setRwResult(t); setRewriting(false); setEditing(true);
    } catch (e) { addToast("Rewrite failed", "error"); }
    setRwLoading(false);
  };

  var doSave = async function() {
    setSaving(true);
    // Buffer API doesn't support PATCH, so we save locally
    setEditText(text); setRwResult(null); setEditing(false);
    addToast("Changes saved locally", "info");
    setSaving(false);
  };

  var doSchedule = async function() {
    setSchedLoading(true);
    try {
      var dueAt = new Date(schedDate + "T" + schedTime + ":00").toISOString();
      var chId = post.channel ? post.channel.id : null;
      if (!chId) { addToast("No channel found", "error"); setSchedLoading(false); return; }
      await fetch("/api/buffer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "createPost", input: { channelId: chId, text: text, dueAt: dueAt, schedulingType: "custom" } }) });
      await fetch("/api/buffer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "deletePost", postId: post.id }) });
      var dateStr = new Date(dueAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + " at " + schedTime;
      addToast("Scheduled for " + dateStr, "success");
      setExiting(true); setTimeout(function() { onRefresh(); }, 400);
    } catch (e) { addToast("Failed to schedule", "error"); }
    setSchedLoading(false); setScheduling(false);
  };

  var doDelete = async function() {
    setExiting(true);
    try {
      await fetch("/api/buffer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "deletePost", postId: post.id }) });
      addToast("Draft deleted", "info");
      setTimeout(function() { onRefresh(); }, 350);
    } catch (e) { addToast("Delete failed", "error"); setExiting(false); }
  };

  if (exiting) return <div style={{ overflow: "hidden", transition: "all 0.25s ease", maxHeight: 0, opacity: 0, marginBottom: 0 }} />;

  return (
    <div style={{ background: selected ? D.cardActive : editing ? D.card : D.card, border: editing ? "1px solid " + D.amber : delConfirm ? "1px solid " + D.crimson : "1px solid " + D.border, borderLeft: selected ? "3px solid " + D.amber : editing ? "3px solid " + D.amber : "1px solid " + D.border, borderRadius: 8, marginBottom: 16, padding: 0, transition: "all 0.15s ease", overflow: "hidden" }} onMouseEnter={function(e) { if (!editing && !delConfirm) { e.currentTarget.style.borderColor = "rgba(247,176,65,0.4)"; e.currentTarget.style.background = D.cardHover; } }} onMouseLeave={function(e) { if (!editing && !delConfirm) { e.currentTarget.style.borderColor = D.border; e.currentTarget.style.background = D.card; } }}>

      {/* ZONE 1: Top row */}
      <div style={{ display: "flex", alignItems: "center", padding: "14px 20px", gap: 10 }}>
        {showCheck && <span onClick={function(e) { e.stopPropagation(); onToggleSelect(post.id); }} style={{ width: 18, height: 18, borderRadius: 4, border: "2px solid " + (selected ? D.amber : D.border), background: selected ? D.amber : "transparent", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: D.bg, fontWeight: 700 }}>{selected ? "\u2713" : ""}</span>}
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: p.c + "18", border: "1px solid " + p.c + "30", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>{p.i}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: ft, fontSize: 13, color: D.tx }}>{post.channel ? post.channel.name : svc}</div>
          <div style={{ fontFamily: ft, fontSize: 11, color: D.txs }}>{p.n}</div>
        </div>
        <span style={{ fontFamily: mn, fontSize: 10, color: D.txs, textTransform: "uppercase", letterSpacing: 1, padding: "3px 8px", background: D.border, borderRadius: 4 }}>DRAFT</span>
      </div>

      {/* ZONE 2: Body */}
      <div style={{ padding: "0 20px 12px" }}>
        {editing ? <div>
          <textarea value={text} onChange={function(e) { var v = e.target.value; if (rwResult) setRwResult(v); else setEditText(v); }} style={{ width: "100%", minHeight: 100, padding: "12px", background: D.bg, border: "1px solid " + D.border, borderRadius: 6, color: D.tx, fontFamily: ft, fontSize: 14, lineHeight: 1.7, outline: "none", boxSizing: "border-box", resize: "vertical" }} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            {rwResult && <div style={{ display: "flex", gap: 6 }}>
              <span onClick={function() { setEditText(rwResult); setRwResult(null); addToast("Rewrite applied", "success"); }} style={{ fontFamily: mn, fontSize: 10, color: D.amber, cursor: "pointer", padding: "3px 8px", borderRadius: 4, background: D.amber + "15" }}>Keep</span>
              <span onClick={function() { setRwResult(null); }} style={{ fontFamily: mn, fontSize: 10, color: D.txs, cursor: "pointer", padding: "3px 8px", borderRadius: 4, border: "1px solid " + D.border }}>Undo</span>
            </div>}
            <span style={{ fontFamily: mn, fontSize: 11, color: overLimit ? D.coral : D.txs }}>{charCount} / {charLimit}</span>
          </div>
        </div>
        : <div>
          <div onClick={function() { if (text.length > 120) setExpanded(!expanded); }} style={{ fontFamily: ft, fontSize: 14, color: text ? D.tx : D.txs, lineHeight: 1.7, whiteSpace: "pre-wrap", overflow: "hidden", maxHeight: expanded ? "none" : "4.9em", cursor: text.length > 120 ? "pointer" : "default", wordBreak: "break-word" }}>
            {text ? renderText(text) : <em>{svc === "youtube" ? "Video post" : "Media post"}</em>}
          </div>
          {text.length > 120 && !expanded && <div style={{ fontFamily: mn, fontSize: 10, color: D.amber, marginTop: 4, cursor: "pointer" }} onClick={function() { setExpanded(true); }}>Show more &#x25BE;</div>}
          <div style={{ textAlign: "right", marginTop: 4 }}><span style={{ fontFamily: mn, fontSize: 11, color: overLimit ? D.coral : D.txs }}>{charCount} / {charLimit}</span></div>
        </div>}
      </div>

      {/* Rewrite input */}
      {rewriting && <div style={{ padding: "0 20px 12px", overflow: "hidden", transition: "all 0.2s ease" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <input value={rwInput} onChange={function(e) { setRwInput(e.target.value); }} onKeyDown={function(e) { if (e.key === "Enter") doRewrite(); }} placeholder="What should I change?" style={{ flex: 1, padding: "8px 12px", background: D.bg, border: "1px solid " + D.border, borderRadius: 6, color: D.tx, fontFamily: ft, fontSize: 12, outline: "none" }} />
          <span onClick={doRewrite} style={{ padding: "8px 14px", background: D.amber, color: D.bg, borderRadius: 6, fontFamily: ft, fontSize: 11, fontWeight: 600, cursor: rwLoading ? "wait" : "pointer", opacity: rwLoading ? 0.5 : 1 }}>{rwLoading ? "\u25CF\u25CF\u25CF" : "Generate"}</span>
        </div>
      </div>}

      {/* Scheduling popover */}
      {scheduling && <div style={{ padding: "0 20px 12px" }}>
        <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 12, padding: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
            <span style={{ fontSize: 14 }}>{p.i}</span>
            <span style={{ fontFamily: ft, fontSize: 12, color: D.tx }}>{post.channel ? post.channel.name : svc}</span>
          </div>
          <span onClick={function() { setSchedDate(nextSmart()); setSchedTime("08:00"); }} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 4, border: "1px solid " + D.amber + "40", color: D.amber, fontFamily: mn, fontSize: 10, cursor: "pointer", marginBottom: 10 }}>Next {new Date(nextSmart()).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at 8:00 AM</span>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input type="date" value={schedDate} onChange={function(e) { setSchedDate(e.target.value); }} style={{ flex: 1, padding: "8px 10px", background: D.bg, border: "1px solid " + D.border, borderRadius: 6, color: D.tx, fontFamily: mn, fontSize: 11, outline: "none" }} />
            <input type="time" value={schedTime} onChange={function(e) { setSchedTime(e.target.value); }} style={{ width: 100, padding: "8px 10px", background: D.bg, border: "1px solid " + D.border, borderRadius: 6, color: D.tx, fontFamily: mn, fontSize: 11, outline: "none" }} />
          </div>
          {schedDate && <div style={{ fontFamily: ft, fontSize: 11, color: D.txs, marginBottom: 10 }}>Posting to {p.i} {post.channel ? post.channel.name : ""} on {new Date(schedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at {schedTime}</div>}
          <span onClick={doSchedule} style={{ display: "block", textAlign: "center", padding: "8px", background: D.amber, color: D.bg, borderRadius: 6, fontFamily: ft, fontSize: 12, fontWeight: 600, cursor: schedLoading ? "wait" : "pointer", opacity: schedLoading ? 0.5 : 1 }}>{schedLoading ? "Scheduling..." : "Confirm Schedule"}</span>
          <div style={{ textAlign: "center", marginTop: 6 }}><span onClick={function() { setScheduling(false); }} style={{ fontFamily: mn, fontSize: 10, color: D.txs, cursor: "pointer" }}>Cancel</span></div>
        </div>
      </div>}

      {/* Delete confirmation */}
      {delConfirm && <div style={{ padding: "8px 20px 12px", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: ft, fontSize: 12, color: D.coral }}>Delete this draft?</span>
        <span onClick={doDelete} style={{ fontFamily: ft, fontSize: 11, color: "#fff", background: D.coral, padding: "4px 12px", borderRadius: 6, cursor: "pointer" }}>Yes, delete</span>
        <span onClick={function() { setDelConfirm(false); }} style={{ fontFamily: ft, fontSize: 11, color: D.txs, cursor: "pointer" }}>Cancel</span>
      </div>}

      {/* ZONE 3: Actions */}
      {!delConfirm && <div style={{ display: "flex", gap: 8, padding: "10px 20px 14px" }}>
        {editing ? <>
          <span onClick={doSave} style={{ padding: "6px 14px", background: D.amber, color: D.bg, borderRadius: 6, fontFamily: ft, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{saving ? "Saving..." : "Save"}</span>
          <span onClick={function() { setEditing(false); setRwResult(null); setEditText(post.text || ""); }} style={{ padding: "6px 14px", border: "1px solid " + D.border, color: D.txs, borderRadius: 6, fontFamily: ft, fontSize: 12, cursor: "pointer" }}>Cancel</span>
        </> : <>
          <span onClick={function() { setEditing(true); setRewriting(false); }} style={{ padding: "6px 14px", border: "1px solid " + D.border, color: D.txs, borderRadius: 6, fontFamily: ft, fontSize: 12, cursor: "pointer", transition: "all 0.15s ease" }} onMouseEnter={function(e) { e.currentTarget.style.borderColor = D.amber + "66"; e.currentTarget.style.color = D.amber; }} onMouseLeave={function(e) { e.currentTarget.style.borderColor = D.border; e.currentTarget.style.color = D.txs; }}>Edit</span>
          <span onClick={function() { setRewriting(!rewriting); setEditing(false); }} style={{ padding: "6px 14px", border: "1px solid " + D.border, color: D.txs, borderRadius: 6, fontFamily: ft, fontSize: 12, cursor: "pointer", transition: "all 0.15s ease" }} onMouseEnter={function(e) { e.currentTarget.style.borderColor = D.amber + "66"; e.currentTarget.style.color = D.amber; }} onMouseLeave={function(e) { e.currentTarget.style.borderColor = D.border; e.currentTarget.style.color = D.txs; }}><span style={{ color: D.amber }}>&#x2726;</span> Rewrite</span>
          <span onClick={function() { setScheduling(!scheduling); }} style={{ padding: "6px 16px", background: D.amber, color: D.bg, borderRadius: 6, fontFamily: ft, fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.15s ease" }}>Approve & Schedule</span>
          <span onClick={function() { setDelConfirm(true); }} style={{ padding: "6px 14px", border: "1px solid " + D.border, color: D.txs, borderRadius: 6, fontFamily: ft, fontSize: 12, cursor: "pointer", marginLeft: "auto", transition: "all 0.15s ease" }} onMouseEnter={function(e) { e.currentTarget.style.borderColor = D.coral + "66"; e.currentTarget.style.color = D.coral; }} onMouseLeave={function(e) { e.currentTarget.style.borderColor = D.border; e.currentTarget.style.color = D.txs; }}>Delete</span>
        </>}
      </div>}
    </div>
  );
}

// ═══ DRAFTS TAB ═══
function DraftsTab({ drafts, channels, onRefresh }) {
  var _pf = useState(null), platF = _pf[0], setPlatF = _pf[1];
  var _sel = useState([]), sel = _sel[0], setSel = _sel[1];
  var _bulkDate = useState(""), bulkDate = _bulkDate[0], setBulkDate = _bulkDate[1];
  var _bulkTime = useState("08:00"), bulkTime = _bulkTime[0], setBulkTime = _bulkTime[1];
  var _showBulkSched = useState(false), showBulkSched = _showBulkSched[0], setShowBulkSched = _showBulkSched[1];
  var _bulkLoading = useState(false), bulkLoading = _bulkLoading[0], setBulkLoading = _bulkLoading[1];

  var filtered = platF ? drafts.filter(function(p) { return (p.channel ? p.channel.service : p.channelService) === platF; }) : drafts;
  var toggleSel = function(id) { setSel(function(p) { return p.indexOf(id) >= 0 ? p.filter(function(x) { return x !== id; }) : p.concat([id]); }); };
  var allSelected = filtered.length > 0 && filtered.every(function(p) { return sel.indexOf(p.id) >= 0; });
  var toggleAll = function() { if (allSelected) setSel([]); else setSel(filtered.map(function(p) { return p.id; })); };

  var bulkSchedule = async function() {
    setBulkLoading(true);
    var dueAt = new Date(bulkDate + "T" + bulkTime + ":00").toISOString();
    for (var i = 0; i < sel.length; i++) {
      var d = filtered.find(function(p) { return p.id === sel[i]; });
      if (!d || !d.channel) continue;
      try {
        await fetch("/api/buffer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "createPost", input: { channelId: d.channel.id, text: d.text || "", dueAt: dueAt, schedulingType: "custom" } }) });
        await fetch("/api/buffer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "deletePost", postId: d.id }) });
      } catch (e) {}
    }
    addToast(sel.length + " drafts scheduled", "success");
    setSel([]); setShowBulkSched(false); setBulkLoading(false); onRefresh();
  };

  var bulkDelete = async function() {
    for (var i = 0; i < sel.length; i++) {
      try { await fetch("/api/buffer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "deletePost", postId: sel[i] }) }); } catch (e) {}
    }
    addToast(sel.length + " drafts deleted", "info");
    setSel([]); onRefresh();
  };

  return (<div>
    <PlatFilter channels={channels} active={platF} setActive={setPlatF} />

    {/* Bulk bar */}
    {sel.length > 0 && <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px", background: D.card, border: "1px solid " + D.border, borderRadius: 8, marginBottom: 16, position: "sticky", top: 0, zIndex: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span onClick={toggleAll} style={{ width: 18, height: 18, borderRadius: 4, border: "2px solid " + D.amber, background: allSelected ? D.amber : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: D.bg }}>{allSelected ? "\u2713" : ""}</span>
        <span style={{ fontFamily: ft, fontSize: 13, color: D.tx }}>{sel.length} selected</span>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", position: "relative" }}>
        <span onClick={function() { setShowBulkSched(!showBulkSched); }} style={{ padding: "6px 14px", background: D.amber, color: D.bg, borderRadius: 6, fontFamily: ft, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Approve All</span>
        {showBulkSched && <div style={{ position: "absolute", top: "100%", right: 80, marginTop: 6, background: D.card, border: "1px solid " + D.border, borderRadius: 10, padding: 14, zIndex: 20, minWidth: 250, boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <input type="date" value={bulkDate} onChange={function(e) { setBulkDate(e.target.value); }} style={{ flex: 1, padding: "6px 8px", background: D.bg, border: "1px solid " + D.border, borderRadius: 4, color: D.tx, fontFamily: mn, fontSize: 10, outline: "none" }} />
            <input type="time" value={bulkTime} onChange={function(e) { setBulkTime(e.target.value); }} style={{ width: 80, padding: "6px 8px", background: D.bg, border: "1px solid " + D.border, borderRadius: 4, color: D.tx, fontFamily: mn, fontSize: 10, outline: "none" }} />
          </div>
          <span onClick={bulkSchedule} style={{ display: "block", textAlign: "center", padding: "6px", background: D.amber, color: D.bg, borderRadius: 6, fontFamily: ft, fontSize: 11, fontWeight: 600, cursor: bulkLoading ? "wait" : "pointer", opacity: bulkLoading ? 0.5 : 1 }}>{bulkLoading ? "Scheduling..." : "Confirm"}</span>
        </div>}
        <span onClick={bulkDelete} style={{ padding: "6px 14px", border: "1px solid " + D.coral, color: D.coral, borderRadius: 6, fontFamily: ft, fontSize: 12, cursor: "pointer" }}>Delete Selected</span>
      </div>
    </div>}

    {filtered.length === 0 ? <div style={{ textAlign: "center", padding: 60 }}>
      <style dangerouslySetInnerHTML={{ __html: "@keyframes emptyGlow{0%,100%{box-shadow:0 0 20px rgba(247,176,65,0.1)}50%{box-shadow:0 0 30px rgba(247,176,65,0.2)}}" }} />
      <div style={{ width: 48, height: 48, borderRadius: 12, background: D.amber + "15", border: "1px solid " + D.amber + "30", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: D.amber, fontWeight: 900, fontFamily: ft, marginBottom: 12, animation: "emptyGlow 2s ease-in-out infinite" }}>P</div>
      <div style={{ fontFamily: ft, fontSize: 18, color: D.tx, marginBottom: 6 }}>No drafts</div>
      <div style={{ fontFamily: ft, fontSize: 14, color: D.txs }}>Content generated from SA Weekly and Capper will appear here as drafts.</div>
    </div>
    : filtered.map(function(d) { return <DraftCard key={d.id} post={d} channels={channels} onDelete={function() {}} onRefresh={onRefresh} selected={sel.indexOf(d.id) >= 0} onToggleSelect={toggleSel} showCheck={sel.length > 0} />; })}
  </div>);
}

// ═══ GENERIC POST LIST (Scheduled / Sent) ═══
function PostList({ posts, channels, emptyLabel, showSearch, showEdit, onDelete }) {
  var _pf = useState(null), platF = _pf[0], setPlatF = _pf[1];
  var _search = useState(""), search = _search[0], setSearch = _search[1];
  var filtered = posts;
  if (platF) filtered = filtered.filter(function(p) { return (p.channel ? p.channel.service : p.channelService) === platF; });
  if (search.trim()) { var q = search.toLowerCase(); filtered = filtered.filter(function(p) { return (p.text || "").toLowerCase().includes(q); }); }

  return (<div>
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 4 }}>
      <div style={{ flex: 1 }}><PlatFilter channels={channels} active={platF} setActive={setPlatF} /></div>
      {showSearch && <input value={search} onChange={function(e) { setSearch(e.target.value); }} placeholder="Search..." style={{ padding: "6px 12px", background: D.card, border: "1px solid " + D.border, borderRadius: 6, color: D.tx, fontFamily: mn, fontSize: 11, outline: "none", width: 200 }} />}
    </div>
    {filtered.length === 0 ? <div style={{ textAlign: "center", padding: 50, color: D.txs, fontFamily: ft, fontSize: 13 }}>{emptyLabel || "No posts"}</div>
    : filtered.map(function(p) {
      var svc = p.channel ? p.channel.service : p.channelService || "";
      var pl2 = pl(svc);
      var _exp = useState(false); var expanded = _exp[0]; var setExpanded = _exp[1];
      var text = p.text || (svc === "youtube" ? "Video post" : "Media post");
      var time = p.dueAt ? new Date(p.dueAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
      var sentTime = p.sentAt ? new Date(p.sentAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

      return <div key={p.id} style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 8, marginBottom: 16, transition: "all 0.15s ease" }} onMouseEnter={function(e) { e.currentTarget.style.borderColor = "rgba(247,176,65,0.4)"; e.currentTarget.style.background = D.cardHover; }} onMouseLeave={function(e) { e.currentTarget.style.borderColor = D.border; e.currentTarget.style.background = D.card; }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: pl2.c + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>{pl2.i}</div>
            <div><div style={{ fontFamily: ft, fontSize: 12, fontWeight: 700, color: pl2.c }}>{pl2.n}</div><div style={{ fontFamily: mn, fontSize: 9, color: D.txs }}>{p.channel ? p.channel.name : ""}</div></div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: mn, fontSize: 10, color: D.tx }}>{p.status === "sent" ? sentTime : time}</div>
            <span style={{ fontFamily: mn, fontSize: 8, color: p.status === "sent" ? D.teal : D.blue, padding: "1px 6px", borderRadius: 3, background: (p.status === "sent" ? D.teal : D.blue) + "12" }}>{p.status}</span>
          </div>
        </div>
        <div onClick={function() { setExpanded(!expanded); }} style={{ padding: "0 20px 12px", cursor: "pointer" }}>
          <div style={{ fontFamily: ft, fontSize: 14, color: p.text ? D.tx : D.txs, lineHeight: 1.7, whiteSpace: "pre-wrap", overflow: "hidden", maxHeight: expanded ? "none" : "3.2em", fontStyle: p.text ? "normal" : "italic" }}>{text}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 20px 12px", borderTop: "1px solid " + D.border }}>
          <div style={{ display: "flex", gap: 4 }}>{(p.tags || []).map(function(t, i) { return <span key={i} style={{ fontFamily: mn, fontSize: 8, color: D.amber, padding: "2px 6px", borderRadius: 4, background: D.amber + "12" }}>{t.name}</span>; })}</div>
          <div style={{ display: "flex", gap: 6 }}>
            {showEdit && <a href="https://publish.buffer.com" target="_blank" rel="noopener noreferrer" style={{ fontFamily: mn, fontSize: 9, color: D.amber, textDecoration: "none", padding: "3px 8px", borderRadius: 4, border: "1px solid " + D.amber + "30" }}>Edit in Buffer</a>}
            {onDelete && <span onClick={function() { onDelete(p.id); }} style={{ fontFamily: mn, fontSize: 9, color: D.coral, cursor: "pointer", padding: "3px 8px", borderRadius: 4, border: "1px solid " + D.coral + "30" }}>Delete</span>}
          </div>
        </div>
      </div>;
    })}
  </div>);
}

// ═══ CHANNELS / STATS / CALENDAR / COMPOSE (kept from previous build, applying new design tokens) ═══
// [Calendar, Channels, Stats, Compose reuse same logic but with D.* tokens]

function CalendarTab({ posts, channels }) {
  var _m = useState(new Date().getMonth()), month = _m[0], setMonth = _m[1];
  var _y = useState(new Date().getFullYear()), year = _y[0], setYear = _y[1];
  var _pf = useState(null), platF = _pf[0], setPlatF = _pf[1];
  var _hover = useState(null), hoverDay = _hover[0], setHoverDay = _hover[1];
  var _hp = useState({ x: 0, y: 0 }), hp = _hp[0], setHp = _hp[1];
  var filtered = platF ? posts.filter(function(p) { return (p.channel ? p.channel.service : p.channelService) === platF; }) : posts;
  var fd = new Date(year, month, 1).getDay(); var dim = new Date(year, month + 1, 0).getDate();
  var cells = []; for (var i = 0; i < fd; i++) cells.push(null); for (var d = 1; d <= dim; d++) cells.push(d);
  var onDay = function(day) { return filtered.filter(function(p) { if (!p.dueAt) return false; var pd = new Date(p.dueAt); return pd.getDate() === day && pd.getMonth() === month && pd.getFullYear() === year; }); };

  return (<div>
    <PlatFilter channels={channels} active={platF} setActive={setPlatF} />
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
      <span onClick={function() { if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1); }} style={{ fontFamily: ft, fontSize: 14, color: D.txs, cursor: "pointer", padding: "6px 14px", borderRadius: 6, border: "1px solid " + D.border }}>&larr;</span>
      <div style={{ fontFamily: ft, fontSize: 18, fontWeight: 800, color: D.tx }}>{new Date(year, month).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</div>
      <span onClick={function() { if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1); }} style={{ fontFamily: ft, fontSize: 14, color: D.txs, cursor: "pointer", padding: "6px 14px", borderRadius: 6, border: "1px solid " + D.border }}>&rarr;</span>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(function(dn) { return <div key={dn} style={{ textAlign: "center", fontFamily: mn, fontSize: 10, color: D.txs, padding: 6, fontWeight: 700 }}>{dn}</div>; })}
      {cells.map(function(day, ci) {
        if (!day) return <div key={"e" + ci} />;
        var dp = onDay(day); var isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
        var svcs = {}; dp.forEach(function(p) { var s = p.channel ? p.channel.service : ""; svcs[s] = (svcs[s] || 0) + 1; });
        return <div key={ci} onMouseEnter={function(e) { if (dp.length > 0) { setHoverDay(day); setHp({ x: e.clientX, y: e.clientY }); } }} onMouseMove={function(e) { if (dp.length > 0) setHp({ x: e.clientX, y: e.clientY }); }} onMouseLeave={function() { setHoverDay(null); }} style={{ minHeight: 90, padding: "6px 8px", borderRadius: 8, background: D.card, border: isToday ? "2px solid " + D.amber : "1px solid " + D.border, boxShadow: isToday ? "0 0 12px " + D.amber + "20" : "none" }}>
          <div style={{ fontFamily: mn, fontSize: 11, fontWeight: isToday ? 800 : 500, color: isToday ? D.amber : D.tx, marginBottom: 4 }}>{day}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
            {Object.keys(svcs).map(function(s) { var pp = pl(s); return <div key={s} style={{ display: "flex", alignItems: "center", gap: 2, padding: "1px 5px", borderRadius: 4, background: pp.c + "15", border: "1px solid " + pp.c + "25" }}><span style={{ fontSize: 9 }}>{pp.i}</span><span style={{ fontFamily: mn, fontSize: 8, color: pp.c, fontWeight: 700 }}>{svcs[s]}</span></div>; })}
          </div>
        </div>;
      })}
    </div>
    {hoverDay && <div style={{ position: "fixed", left: hp.x + 8, top: hp.y + 16, background: D.card, border: "1px solid " + D.amber + "30", borderRadius: 8, padding: "10px 14px", zIndex: 1000, maxWidth: 320, boxShadow: "0 4px 24px rgba(0,0,0,0.6)", pointerEvents: "none", transition: "left 0.05s ease, top 0.05s ease" }}>
      {onDay(hoverDay).slice(0, 5).map(function(p, i) { var pp = pl(p.channel ? p.channel.service : ""); var t = p.dueAt ? new Date(p.dueAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : ""; return <div key={i} style={{ display: "flex", gap: 6, padding: "3px 0", borderBottom: i < 4 ? "1px solid " + D.border : "none" }}><span style={{ fontSize: 10 }}>{pp.i}</span><div style={{ flex: 1 }}><div style={{ fontFamily: ft, fontSize: 10, color: D.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(p.text || "Media post").slice(0, 50)}</div><div style={{ fontFamily: mn, fontSize: 8, color: D.txs }}>{pp.n} // {t}</div></div></div>; })}
    </div>}
  </div>);
}

function ChannelsTab({ channels, data, onFilter }) {
  return (<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
    {(channels || []).map(function(ch) {
      var pp = pl(ch.service);
      var sched = (data.scheduled || []).filter(function(p) { return p.channel && p.channel.id === ch.id; }).length;
      var sent = (data.sent || []).filter(function(p) { return p.channel && p.channel.id === ch.id; }).length;
      var last = (data.sent || []).filter(function(p) { return p.channel && p.channel.id === ch.id; }).sort(function(a, b) { return new Date(b.sentAt || 0) - new Date(a.sentAt || 0); })[0];
      return <div key={ch.id} onClick={function() { onFilter(ch.service); }} style={{ padding: "16px 18px", background: D.card, borderRadius: 8, border: "1px solid " + D.border, borderLeft: "3px solid " + pp.c, cursor: "pointer", transition: "all 0.15s ease" }} onMouseEnter={function(e) { e.currentTarget.style.boxShadow = D.glow; }} onMouseLeave={function(e) { e.currentTarget.style.boxShadow = "none"; }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: pp.c + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{pp.i}</div>
          <div><div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: pp.c }}>{ch.name}</div><div style={{ fontFamily: mn, fontSize: 9, color: D.txs }}>{pp.n}</div></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          <div style={{ textAlign: "center", padding: "6px 0", background: D.bg, borderRadius: 4 }}><div style={{ fontFamily: mn, color: D.blue, fontWeight: 700, fontSize: 14 }}>{sched}</div><div style={{ fontFamily: mn, fontSize: 8, color: D.txs }}>Queued</div></div>
          <div style={{ textAlign: "center", padding: "6px 0", background: D.bg, borderRadius: 4 }}><div style={{ fontFamily: mn, color: D.teal, fontWeight: 700, fontSize: 14 }}>{sent}</div><div style={{ fontFamily: mn, fontSize: 8, color: D.txs }}>Sent</div></div>
          <div style={{ textAlign: "center", padding: "6px 0", background: D.bg, borderRadius: 4 }}><div style={{ fontFamily: mn, color: D.txs, fontSize: 10 }}>{last && last.sentAt ? new Date(last.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Never"}</div><div style={{ fontFamily: mn, fontSize: 8, color: D.txs }}>Last</div></div>
        </div>
      </div>;
    })}
  </div>);
}

// ═══ HOME HUB ═══
function HomeTab({ data, onTab, onCompose }) {
  var now = new Date();
  var todayStr = now.toISOString().slice(0, 10);
  var scheduled = data.scheduled || [];
  var sent = data.sent || [];
  var drafts = data.drafts || [];
  var channels = data.channels || [];

  // Today's posts
  var todayPosts = scheduled.filter(function(p) { return p.dueAt && p.dueAt.slice(0, 10) === todayStr; });
  // Next up (soonest 5 scheduled)
  var nextUp = scheduled.filter(function(p) { return p.dueAt && new Date(p.dueAt) > now; }).sort(function(a, b) { return new Date(a.dueAt) - new Date(b.dueAt); }).slice(0, 5);
  // Recent (last 5 sent)
  var recent = sent.slice(0, 5);

  return (<div>
    {/* Quick actions */}
    <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
      <span onClick={onCompose} style={{ padding: "10px 20px", background: D.amber, color: D.bg, borderRadius: 8, fontFamily: ft, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ New Post</span>
      <span onClick={function() { onTab("drafts"); }} style={{ padding: "10px 20px", background: D.card, border: "1px solid " + D.border, color: D.tx, borderRadius: 8, fontFamily: ft, fontSize: 13, cursor: "pointer" }}>Review Drafts {drafts.length > 0 && <span style={{ fontFamily: mn, fontSize: 10, color: D.amber, marginLeft: 4 }}>({drafts.length})</span>}</span>
      <a href="https://publish.buffer.com" target="_blank" rel="noopener noreferrer" style={{ padding: "10px 20px", background: D.card, border: "1px solid " + D.border, color: D.txs, borderRadius: 8, fontFamily: ft, fontSize: 13, textDecoration: "none" }}>Open Buffer</a>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
      {/* Today's Queue */}
      <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 8, padding: 20 }}>
        <div style={{ fontFamily: mn, fontSize: 10, color: D.amber, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>Today's Queue</div>
        {todayPosts.length === 0 ? <div style={{ fontFamily: ft, fontSize: 12, color: D.txs, padding: "12px 0" }}>Nothing scheduled for today.</div>
        : todayPosts.map(function(p, i) {
          var pp = pl(p.channel ? p.channel.service : "");
          var t = new Date(p.dueAt);
          var diff = t - now;
          var hrs = Math.floor(diff / 3600000);
          var mins = Math.floor((diff % 3600000) / 60000);
          var countdown = diff > 0 ? (hrs > 0 ? hrs + "h " : "") + mins + "m" : "Now";
          return <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < todayPosts.length - 1 ? "1px solid " + D.border : "none" }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: pp.c + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>{pp.i}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: ft, fontSize: 11, color: D.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(p.text || "Media post").slice(0, 60)}</div>
              <div style={{ fontFamily: mn, fontSize: 8, color: D.txs }}>{pp.s} // {t.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</div>
            </div>
            <span style={{ fontFamily: mn, fontSize: 10, color: diff > 0 ? D.amber : D.teal, fontWeight: 700 }}>{countdown}</span>
          </div>;
        })}
      </div>

      {/* Next Up */}
      <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 8, padding: 20 }}>
        <div style={{ fontFamily: mn, fontSize: 10, color: D.blue, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>Next Up</div>
        {nextUp.length === 0 ? <div style={{ fontFamily: ft, fontSize: 12, color: D.txs, padding: "12px 0" }}>Queue is empty.</div>
        : nextUp.map(function(p, i) {
          var pp = pl(p.channel ? p.channel.service : "");
          return <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < nextUp.length - 1 ? "1px solid " + D.border : "none" }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: pp.c + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>{pp.i}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: ft, fontSize: 11, color: D.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(p.text || "Media post").slice(0, 60)}</div>
              <div style={{ fontFamily: mn, fontSize: 8, color: D.txs }}>{pp.s} // {new Date(p.dueAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</div>
            </div>
          </div>;
        })}
      </div>
    </div>

    {/* Channel Health */}
    <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 8, padding: 20, marginBottom: 24 }}>
      <div style={{ fontFamily: mn, fontSize: 10, color: D.violet, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>Channel Health</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {channels.map(function(ch) {
          var pp = pl(ch.service);
          return <div key={ch.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: D.bg, borderRadius: 6, border: "1px solid " + D.border }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: ch.isDisconnected ? D.coral : D.teal }} />
            <span style={{ fontSize: 12 }}>{pp.i}</span>
            <span style={{ fontFamily: ft, fontSize: 11, color: D.tx }}>{ch.name}</span>
          </div>;
        })}
      </div>
    </div>

    {/* Recent Activity */}
    <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 8, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontFamily: mn, fontSize: 10, color: D.teal, textTransform: "uppercase", letterSpacing: 1.5 }}>Recent Activity</div>
        <span onClick={function() { onTab("sent"); }} style={{ fontFamily: mn, fontSize: 9, color: D.amber, cursor: "pointer" }}>View all</span>
      </div>
      {recent.length === 0 ? <div style={{ fontFamily: ft, fontSize: 12, color: D.txs }}>No recent posts.</div>
      : recent.map(function(p, i) {
        var pp = pl(p.channel ? p.channel.service : "");
        return <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < recent.length - 1 ? "1px solid " + D.border : "none" }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: pp.c + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>{pp.i}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: ft, fontSize: 11, color: D.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(p.text || "Media post").slice(0, 70)}</div>
          </div>
          <div style={{ fontFamily: mn, fontSize: 9, color: D.txs, flexShrink: 0 }}>{p.sentAt ? new Date(p.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}</div>
        </div>;
      })}
    </div>
  </div>);
}

// ═══ STATS ═══
function StatsTab({ data }) {
  var byPlat = {}; (data.sent || []).forEach(function(p) { var s = p.channel ? p.channel.service : ""; byPlat[s] = (byPlat[s] || 0) + 1; });
  var max = Math.max(1, ...Object.values(byPlat));
  var byFull = {}; (data.scheduled || []).concat(data.sent || []).forEach(function(p) { var s = p.channel ? p.channel.service : ""; if (!byFull[s]) byFull[s] = { q: 0, s: 0 }; if (p.status === "sent") byFull[s].s++; else byFull[s].q++; });

  return (<div>
    <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
      {[{ l: "Scheduled", v: (data.scheduled || []).length, c: D.amber }, { l: "Sent", v: (data.sent || []).length, c: D.teal }, { l: "Drafts", v: (data.drafts || []).length, c: D.blue }, { l: "Channels", v: (data.channels || []).length, c: D.violet }].map(function(s, i) {
        return <div key={i} style={{ flex: 1, background: D.card, border: "1px solid " + D.border, borderRadius: 8, padding: "18px 14px", textAlign: "center" }}><div style={{ fontFamily: mn, fontSize: 28, fontWeight: 900, color: s.c }}>{s.v}</div><div style={{ fontFamily: mn, fontSize: 9, color: D.txs, textTransform: "uppercase", letterSpacing: 1.5, marginTop: 4 }}>{s.l}</div></div>;
      })}
    </div>
    <div style={{ fontFamily: mn, fontSize: 10, color: D.amber, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 14 }}>Posts Sent by Platform</div>
    <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 8, padding: 20, marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 160 }}>
        {Object.keys(byPlat).sort(function(a, b) { return byPlat[b] - byPlat[a]; }).map(function(s) { var pp = pl(s); return <div key={s} style={{ flex: 1, textAlign: "center" }}><div style={{ fontFamily: mn, fontSize: 12, fontWeight: 700, color: pp.c, marginBottom: 4 }}>{byPlat[s]}</div><div style={{ height: (byPlat[s] / max * 100) + "%", minHeight: 4, background: "linear-gradient(180deg, " + pp.c + ", " + pp.c + "60)", borderRadius: "4px 4px 0 0" }} /><div style={{ fontFamily: mn, fontSize: 8, color: D.txs, marginTop: 6 }}>{pp.s}</div></div>; })}
      </div>
    </div>
    {/* Day-of-week heatmap */}
    <div style={{ fontFamily: mn, fontSize: 10, color: D.amber, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 14 }}>Posting by Day of Week</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginBottom: 28 }}>
      {(function() {
        var days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        var counts = [0, 0, 0, 0, 0, 0, 0];
        (data.sent || []).forEach(function(p) { if (p.sentAt) counts[new Date(p.sentAt).getDay()]++; });
        var maxD = Math.max(1, Math.max.apply(null, counts));
        return days.map(function(d, i) {
          var pct = (counts[i] / maxD) * 100;
          var isBest = counts[i] === maxD && counts[i] > 0;
          return <div key={i} style={{ background: D.card, border: "1px solid " + (isBest ? D.amber + "40" : D.border), borderRadius: 8, padding: "12px 8px", textAlign: "center" }}>
            <div style={{ fontFamily: mn, fontSize: 9, color: D.txs, marginBottom: 6 }}>{d}</div>
            <div style={{ height: 60, display: "flex", alignItems: "flex-end", justifyContent: "center", marginBottom: 6 }}>
              <div style={{ width: 20, height: pct + "%", minHeight: counts[i] > 0 ? 4 : 0, background: isBest ? D.amber : D.blue, borderRadius: "3px 3px 0 0" }} />
            </div>
            <div style={{ fontFamily: mn, fontSize: 14, fontWeight: 700, color: isBest ? D.amber : D.tx }}>{counts[i]}</div>
          </div>;
        });
      })()}
    </div>

    {/* Time distribution */}
    <div style={{ fontFamily: mn, fontSize: 10, color: D.amber, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 14 }}>Posting by Hour</div>
    <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 8, padding: 20, marginBottom: 28 }}>
      {(function() {
        var hours = new Array(24).fill(0);
        (data.sent || []).forEach(function(p) { if (p.sentAt) hours[new Date(p.sentAt).getHours()]++; });
        var maxH2 = Math.max(1, Math.max.apply(null, hours));
        return <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80 }}>
          {hours.map(function(c, i) {
            var pct = (c / maxH2) * 100;
            return <div key={i} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ height: pct + "%", minHeight: c > 0 ? 3 : 0, background: c > 0 ? "linear-gradient(180deg, " + D.amber + ", " + D.amber + "40)" : "transparent", borderRadius: "2px 2px 0 0" }} />
              {i % 3 === 0 && <div style={{ fontFamily: mn, fontSize: 7, color: D.txs, marginTop: 4 }}>{i}h</div>}
            </div>;
          })}
        </div>;
      })()}
    </div>

    {/* Extra metrics row */}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
      {(function() {
        var allSent = data.sent || [];
        // Avg content length
        var totalLen = 0; var countLen = 0;
        allSent.forEach(function(p) { if (p.text) { totalLen += p.text.length; countLen++; } });
        var avgLen = countLen > 0 ? Math.round(totalLen / countLen) : 0;
        // Queue depth (days of content)
        var sched = data.scheduled || [];
        var queueDays = 0;
        if (sched.length > 0) {
          var latest = sched.reduce(function(m, p) { var d = new Date(p.dueAt || 0); return d > m ? d : m; }, new Date(0));
          queueDays = Math.max(0, Math.ceil((latest - new Date()) / 86400000));
        }
        // Streak
        var streak = 0;
        var daySet = new Set();
        allSent.forEach(function(p) { if (p.sentAt) daySet.add(new Date(p.sentAt).toISOString().slice(0, 10)); });
        var check = new Date(); check.setHours(0, 0, 0, 0);
        while (daySet.has(check.toISOString().slice(0, 10))) { streak++; check.setDate(check.getDate() - 1); }
        // Top day
        var dayCounts = [0, 0, 0, 0, 0, 0, 0];
        allSent.forEach(function(p) { if (p.sentAt) dayCounts[new Date(p.sentAt).getDay()]++; });
        var topIdx = dayCounts.indexOf(Math.max.apply(null, dayCounts));
        var dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

        return [
          { l: "Avg Length", v: avgLen + " chars", c: D.blue },
          { l: "Queue Depth", v: queueDays + " days", c: D.amber },
          { l: "Posting Streak", v: streak + " days", c: D.teal },
          { l: "Top Day", v: dayNames[topIdx], c: D.violet },
        ].map(function(s, i) {
          return <div key={i} style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 8, padding: "16px 12px", textAlign: "center" }}>
            <div style={{ fontFamily: ft, fontSize: 18, fontWeight: 800, color: s.c }}>{s.v}</div>
            <div style={{ fontFamily: mn, fontSize: 9, color: D.txs, textTransform: "uppercase", letterSpacing: 1, marginTop: 4 }}>{s.l}</div>
          </div>;
        });
      })()}
    </div>

    {/* By platform */}
    <div style={{ fontFamily: mn, fontSize: 10, color: D.amber, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 14 }}>By Platform</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
      {Object.keys(byFull).sort().map(function(s) { var d2 = byFull[s]; var pp = pl(s); return <div key={s} style={{ padding: "14px 16px", background: D.card, borderRadius: 8, border: "1px solid " + D.border, borderLeft: "3px solid " + pp.c }}><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><span style={{ fontSize: 16 }}>{pp.i}</span><span style={{ fontFamily: ft, fontSize: 13, fontWeight: 700, color: pp.c }}>{pp.n}</span></div><div style={{ display: "flex", gap: 16, fontFamily: mn }}><div><span style={{ color: D.blue, fontWeight: 700, fontSize: 18 }}>{d2.q}</span><div style={{ fontSize: 8, color: D.txs }}>Queued</div></div><div><span style={{ color: D.teal, fontWeight: 700, fontSize: 18 }}>{d2.s}</span><div style={{ fontSize: 8, color: D.txs }}>Sent</div></div></div></div>; })}
    </div>
  </div>);
}

function ComposeModal({ channels, onClose, onRefresh }) {
  var _text = useState(""), text = _text[0], setText = _text[1];
  var _sel = useState([]), sel = _sel[0], setSel = _sel[1];
  var _date = useState(""), date = _date[0], setDate = _date[1];
  var _time = useState("10:00"), time = _time[0], setTime = _time[1];
  var _sending = useState(false), sending = _sending[0], setSending = _sending[1];
  var toggle = function(id) { setSel(function(p) { return p.indexOf(id) >= 0 ? p.filter(function(x) { return x !== id; }) : p.concat([id]); }); };
  var send = async function() {
    if (!text.trim() || sel.length === 0) return; setSending(true);
    var dueAt = date && time ? new Date(date + "T" + time + ":00").toISOString() : undefined;
    for (var i = 0; i < sel.length; i++) { try { await fetch("/api/buffer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "createPost", input: { channelId: sel[i], text: text, dueAt: dueAt, schedulingType: dueAt ? "custom" : "now" } }) }); } catch (e) {} }
    addToast(sel.length + " post(s) " + (dueAt ? "scheduled" : "published"), "success");
    setSending(false); onRefresh(); onClose();
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }} onClick={onClose}>
      <div onClick={function(e) { e.stopPropagation(); }} style={{ background: D.card, border: "1px solid " + D.amber + "30", borderRadius: 8, padding: 28, maxWidth: 540, width: "90%", maxHeight: "85vh", overflow: "auto" }}>
        <div style={{ fontFamily: ft, fontSize: 18, fontWeight: 800, color: D.tx, marginBottom: 16 }}>New Post</div>
        <div style={{ fontFamily: mn, fontSize: 9, color: D.txs, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Channels</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {(channels || []).map(function(ch) { var pp = pl(ch.service); var on = sel.indexOf(ch.id) >= 0; return <div key={ch.id} onClick={function() { toggle(ch.id); }} style={{ padding: "6px 12px", borderRadius: 6, cursor: "pointer", background: on ? pp.c + "18" : "transparent", border: on ? "2px solid " + pp.c : "1px solid " + D.border, fontFamily: mn, fontSize: 10, color: on ? pp.c : D.txs, display: "flex", alignItems: "center", gap: 4 }}><span style={{ fontSize: 12 }}>{pp.i}</span>{ch.name}</div>; })}
        </div>
        <textarea value={text} onChange={function(e) { setText(e.target.value); }} rows={5} placeholder="Write your post..." style={{ width: "100%", padding: "12px", background: D.bg, border: "1px solid " + D.border, borderRadius: 6, color: D.tx, fontFamily: ft, fontSize: 13, outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.6, marginBottom: 14 }} />
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <div style={{ flex: 1 }}><div style={{ fontFamily: mn, fontSize: 9, color: D.txs, marginBottom: 4 }}>Date</div><input type="date" value={date} onChange={function(e) { setDate(e.target.value); }} style={{ width: "100%", padding: "8px 10px", background: D.bg, border: "1px solid " + D.border, borderRadius: 6, color: D.tx, fontFamily: mn, fontSize: 11, outline: "none" }} /></div>
          <div style={{ width: 120 }}><div style={{ fontFamily: mn, fontSize: 9, color: D.txs, marginBottom: 4 }}>Time</div><input type="time" value={time} onChange={function(e) { setTime(e.target.value); }} style={{ width: "100%", padding: "8px 10px", background: D.bg, border: "1px solid " + D.border, borderRadius: 6, color: D.tx, fontFamily: mn, fontSize: 11, outline: "none" }} /></div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <span onClick={onClose} style={{ padding: "8px 16px", fontFamily: ft, fontSize: 12, color: D.txs, cursor: "pointer" }}>Cancel</span>
          <span onClick={send} style={{ padding: "8px 24px", background: D.amber, color: D.bg, borderRadius: 6, fontFamily: ft, fontSize: 13, fontWeight: 700, cursor: sending ? "wait" : "pointer", opacity: sending ? 0.5 : 1 }}>{sending ? "Sending..." : date ? "Schedule" : "Post Now"}</span>
        </div>
      </div>
    </div>
  );
}

// ═══ MAIN ═══
export default function BufferSchedule() {
  var _tab = useState("home"), tab = _tab[0], setTab = _tab[1];
  var _data = useState(null), data = _data[0], setData = _data[1];
  var _loading = useState(true), loading = _loading[0], setLoading = _loading[1];
  var _error = useState(null), error = _error[0], setError = _error[1];
  var _compose = useState(false), compose = _compose[0], setCompose = _compose[1];
  var _chanFilter = useState(null), chanFilter = _chanFilter[0], setChanFilter = _chanFilter[1];

  var load = useCallback(function() {
    fetch("/api/buffer").then(function(r) { return r.json(); }).then(function(d) {
      if (d.error) { setError(d.error); setLoading(false); return; }
      setData(d); setError(null); setLoading(false);
    }).catch(function(e) { setError(String(e)); setLoading(false); });
  }, []);

  useEffect(function() { load(); var iv = setInterval(load, 60000); return function() { clearInterval(iv); }; }, [load]);
  var deletePost = function(id) { fetch("/api/buffer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "deletePost", postId: id }) }).then(load); };
  var allPosts = data ? (data.scheduled || []).concat(data.sent || []) : [];

  return (<div>
    <style dangerouslySetInnerHTML={{ __html: "@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');" }} />
    <ToastContainer />

    {/* Header */}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
      <div><div style={{ fontFamily: ft, fontSize: 22, fontWeight: 900, color: D.tx }}>Schedule</div><div style={{ fontFamily: mn, fontSize: 9, color: D.txs, marginTop: 2 }}>Manage your Buffer queue across all platforms.</div></div>
      <div style={{ display: "flex", gap: 8 }}>
        <span onClick={function() { setCompose(true); }} style={{ padding: "7px 16px", background: D.amber, color: D.bg, borderRadius: 6, fontFamily: ft, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ New Post</span>
        <span onClick={load} style={{ padding: "7px 12px", border: "1px solid " + D.border, color: D.txs, borderRadius: 6, fontFamily: mn, fontSize: 10, cursor: "pointer" }}>Refresh</span>
        <a href="https://publish.buffer.com" target="_blank" rel="noopener noreferrer" style={{ padding: "7px 14px", background: D.amber, color: D.bg, borderRadius: 6, fontFamily: ft, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>Open Buffer</a>
      </div>
    </div>

    <StatRow data={data} />

    <div style={{ display: "flex", borderBottom: "1px solid " + D.border, marginBottom: 24 }}>
      <Tab label="Home" active={tab === "home"} onClick={function() { setTab("home"); setChanFilter(null); }} />
      <Tab label="Calendar" active={tab === "calendar"} onClick={function() { setTab("calendar"); setChanFilter(null); }} />
      <Tab label="Scheduled" active={tab === "scheduled"} onClick={function() { setTab("scheduled"); }} count={data ? (data.scheduled || []).length : 0} />
      <Tab label="Sent" active={tab === "sent"} onClick={function() { setTab("sent"); setChanFilter(null); }} count={data ? (data.sent || []).length : 0} />
      <Tab label="Drafts" active={tab === "drafts"} onClick={function() { setTab("drafts"); setChanFilter(null); }} count={data ? (data.drafts || []).length : 0} />
      <Tab label="Channels" active={tab === "channels"} onClick={function() { setTab("channels"); setChanFilter(null); }} count={data ? (data.channels || []).length : 0} />
      <Tab label="Stats" active={tab === "stats"} onClick={function() { setTab("stats"); }} />
      {chanFilter && <span onClick={function() { setChanFilter(null); }} style={{ fontFamily: mn, fontSize: 9, color: D.amber, cursor: "pointer", alignSelf: "center", marginLeft: 8, padding: "4px 8px", borderRadius: 4, background: D.amber + "15" }}>{pl(chanFilter).n} x</span>}
    </div>

    {loading ? <div style={{ textAlign: "center", padding: 80 }}><style dangerouslySetInnerHTML={{ __html: "@keyframes bL{0%{opacity:0.3}50%{opacity:1}100%{opacity:0.3}}" }} /><div style={{ fontFamily: mn, fontSize: 12, color: D.amber, animation: "bL 1.5s ease-in-out infinite" }}>Loading Buffer...</div></div>
    : error ? <div style={{ textAlign: "center", padding: 50, maxWidth: 440, margin: "0 auto" }}><div style={{ fontFamily: ft, fontSize: 18, fontWeight: 800, color: D.tx, marginBottom: 8 }}>Connect Buffer</div><div style={{ fontFamily: ft, fontSize: 12, color: D.txs, lineHeight: 1.7, marginBottom: 16 }}>Generate an API key from your Buffer settings.</div><div style={{ padding: "14px 16px", background: D.card, borderRadius: 8, border: "1px solid " + D.border, textAlign: "left", marginBottom: 14, fontFamily: mn, fontSize: 10, color: D.tx, lineHeight: 2.2 }}><span style={{ color: D.amber }}>1.</span> Go to publish.buffer.com/settings/api{"\n"}<span style={{ color: D.amber }}>2.</span> Generate a key{"\n"}<span style={{ color: D.amber }}>3.</span> Add to Vercel as <span style={{ color: D.amber }}>BUFFER_API_KEY</span>{"\n"}<span style={{ color: D.amber }}>4.</span> Redeploy</div><a href="https://publish.buffer.com/settings/api" target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", fontFamily: ft, fontSize: 13, fontWeight: 700, color: D.bg, background: D.amber, padding: "10px 24px", borderRadius: 6, textDecoration: "none" }}>Get API Key</a>{error !== "BUFFER_API_KEY not configured" && <div style={{ fontFamily: mn, fontSize: 9, color: D.coral, marginTop: 14 }}>{error}</div>}</div>
    : <div>
      {tab === "home" && <HomeTab data={data} onTab={setTab} onCompose={function() { setCompose(true); }} />}
      {tab === "calendar" && <CalendarTab posts={allPosts} channels={data.channels} />}
      {tab === "scheduled" && <PostList posts={chanFilter ? (data.scheduled || []).filter(function(p) { return (p.channel ? p.channel.service : "") === chanFilter; }) : data.scheduled || []} channels={data.channels} onDelete={deletePost} showEdit emptyLabel="No scheduled posts" />}
      {tab === "sent" && <PostList posts={data.sent || []} channels={data.channels} emptyLabel="No sent posts" showSearch />}
      {tab === "drafts" && <DraftsTab drafts={data.drafts || []} channels={data.channels} onRefresh={load} />}
      {tab === "channels" && <ChannelsTab channels={data.channels} data={data} onFilter={function(svc) { setChanFilter(svc); setTab("scheduled"); }} />}
      {tab === "stats" && <StatsTab data={data} />}
    </div>}

    {compose && <ComposeModal channels={data ? data.channels : []} onClose={function() { setCompose(false); }} onRefresh={load} />}
  </div>);
}
