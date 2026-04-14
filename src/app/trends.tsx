// @ts-nocheck
"use client";
import { useState, useEffect } from "react";

// ═══ DESIGN LANGUAGE ═══
var D = {
  bg: "#06060C", card: "#14141E", border: "#252535", hover: "#181824",
  surface: "#101018", tx: "#E8E4DD", txm: "#8A8690", txd: "#4E4B56",
  amber: "#F7B041", blue: "#0B86D1", teal: "#2EAD8E", coral: "#E06347",
  violet: "#905CCB", cyan: "#26C9D8",
};
var ft = "'Outfit',sans-serif";
var mn = "'JetBrains Mono',monospace";

var PLATFORMS = {
  tiktok: { name: "TikTok", icon: "\uD83C\uDFB5", color: "#00F2EA" },
  ytshorts: { name: "YT Shorts", icon: "\u25B6\uFE0F", color: "#FF0000" },
  igreels: { name: "IG Reels", icon: "\uD83D\uDCF7", color: "#E4405F" },
  x: { name: "X", icon: "\uD83D\uDC26", color: "#1DA1F2" },
};
var SENTIMENTS = ["Humorous", "Educational", "Hype", "Emotional", "Informational"];
var AUDIENCES = ["General", "Tech", "Finance", "AI", "Hardware"];
var CTA_TYPES = ["Follow", "Comment", "Share", "Duet", "Stitch", "Link in bio"];
var STATUSES = ["Active", "Fading", "Dead"];
var STATUS_COLORS = { Active: D.teal, Fading: D.amber, Dead: D.coral };

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
  var colors = { success: D.teal, error: D.coral, info: D.blue };
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

// ═══ HELPERS ═══
function loadData() {
  try { var raw = localStorage.getItem("trends-data"); return raw ? JSON.parse(raw) : []; }
  catch(e) { return []; }
}
function saveData(trends) { localStorage.setItem("trends-data", JSON.stringify(trends)); }
function truncUrl(url, max) { if (!url) return ""; if (url.length <= (max || 50)) return url; return url.slice(0, max || 50) + "\u2026"; }
function makeId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function relScoreColor(score) { if (score <= 3) return D.coral; if (score <= 6) return D.amber; return D.teal; }

// ═══ PILL COMPONENT ═══
function Pill({ label, active, onClick, color }) {
  var bg = active ? (color || D.blue) + "25" : "transparent";
  var bc = active ? (color || D.blue) : D.border;
  var tx = active ? (color || D.blue) : D.txm;
  return <span onClick={onClick} style={{ fontFamily: mn, fontSize: 10, color: tx, padding: "3px 10px", borderRadius: 20, border: "1px solid " + bc, background: bg, cursor: "pointer", userSelect: "none", transition: "all 0.15s ease", whiteSpace: "nowrap" }}>{label}</span>;
}

// ═══ MAIN COMPONENT ═══
export default function Trends() {
  var _trends = useState([]), trends = _trends[0], setTrends = _trends[1];
  var _formOpen = useState(false), formOpen = _formOpen[0], setFormOpen = _formOpen[1];

  // Form state
  var _url = useState(""), url = _url[0], setUrl = _url[1];
  var _platform = useState("tiktok"), platform = _platform[0], setPlatform = _platform[1];
  var _format = useState(""), format = _format[0], setFormat = _format[1];
  var _audio = useState(""), audio = _audio[0], setAudio = _audio[1];
  var _visual = useState(""), visual = _visual[0], setVisual = _visual[1];
  var _sentiment = useState(""), sentiment = _sentiment[0], setSentiment = _sentiment[1];
  var _audience = useState(""), audience = _audience[0], setAudience = _audience[1];
  var _ctaType = useState(""), ctaType = _ctaType[0], setCtaType = _ctaType[1];
  var _relevance = useState(5), relevance = _relevance[0], setRelevance = _relevance[1];
  var _saAngle = useState(""), saAngle = _saAngle[0], setSaAngle = _saAngle[1];

  // Filter state
  var _fPlat = useState(""), fPlat = _fPlat[0], setFPlat = _fPlat[1];
  var _fSent = useState(""), fSent = _fSent[0], setFSent = _fSent[1];
  var _fAud = useState(""), fAud = _fAud[0], setFAud = _fAud[1];
  var _fStat = useState(""), fStat = _fStat[0], setFStat = _fStat[1];

  // Load on mount
  useEffect(function() { setTrends(loadData()); }, []);

  // Persist on change
  useEffect(function() { if (trends.length > 0) saveData(trends); }, [trends]);

  function resetForm() {
    setUrl(""); setPlatform("tiktok"); setFormat(""); setAudio(""); setVisual("");
    setSentiment(""); setAudience(""); setCtaType(""); setRelevance(5); setSaAngle("");
  }

  function handleAdd() {
    if (!url.trim()) { addToast("URL is required", "error"); return; }
    if (!sentiment) { addToast("Select a sentiment", "error"); return; }
    if (!audience) { addToast("Select an audience", "error"); return; }
    var entry = {
      id: makeId(), url: url.trim(), platform: platform, format: format.trim(),
      audio: audio.trim(), visual: visual.trim(), sentiment: sentiment,
      audience: audience, ctaType: ctaType, relevance: relevance,
      saAngle: saAngle.trim(), status: "Active", date: new Date().toISOString(),
    };
    setTrends(function(p) { var next = [entry].concat(p); saveData(next); return next; });
    resetForm();
    setFormOpen(false);
    addToast("Trend added", "success");
  }

  function cycleStatus(id) {
    setTrends(function(p) {
      var next = p.map(function(t) {
        if (t.id !== id) return t;
        var idx = STATUSES.indexOf(t.status);
        var ns = STATUSES[(idx + 1) % STATUSES.length];
        return Object.assign({}, t, { status: ns });
      });
      saveData(next);
      return next;
    });
  }

  function removeTrend(id) {
    setTrends(function(p) { var next = p.filter(function(t) { return t.id !== id; }); saveData(next); return next; });
    addToast("Trend removed", "info");
  }

  // Filtered + sorted
  var filtered = trends.filter(function(t) {
    if (fPlat && t.platform !== fPlat) return false;
    if (fSent && t.sentiment !== fSent) return false;
    if (fAud && t.audience !== fAud) return false;
    if (fStat && t.status !== fStat) return false;
    return true;
  }).sort(function(a, b) {
    var dDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (dDiff !== 0) return dDiff;
    return b.relevance - a.relevance;
  });

  // ═══ RENDER: INPUT FIELD ═══
  function InputField({ label, value, onChange, placeholder, mono }) {
    return <div style={{ marginBottom: 10 }}>
      <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      <input value={value} onChange={function(e) { onChange(e.target.value); }} placeholder={placeholder || ""} style={{ width: "100%", background: D.surface, border: "1px solid " + D.border, borderRadius: 6, padding: "8px 10px", color: D.tx, fontFamily: mono ? mn : ft, fontSize: 12, outline: "none", boxSizing: "border-box" }} />
    </div>;
  }

  // ═══ RENDER: SELECT ROW ═══
  function SelectRow({ label, options, value, onChange }) {
    return <div style={{ marginBottom: 10 }}>
      <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {options.map(function(opt) {
          return <Pill key={opt} label={opt} active={value === opt} onClick={function() { onChange(value === opt ? "" : opt); }} />;
        })}
      </div>
    </div>;
  }

  return <div style={{ minHeight: "100vh", background: D.bg, color: D.tx, fontFamily: ft, padding: "32px 24px" }}>
    <ToastContainer />

    {/* ═══ HEADER ═══ */}
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 28, fontWeight: 900, fontFamily: ft, color: D.tx, letterSpacing: -0.5 }}>Trends</div>
      <div style={{ fontFamily: mn, fontSize: 10, color: D.txm, marginTop: 4 }}>Viral formats, sounds, and content structures</div>
    </div>

    {/* ═══ ADD TREND TOGGLE ═══ */}
    <div style={{ marginBottom: 20 }}>
      <div onClick={function() { setFormOpen(!formOpen); }} style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontFamily: mn, fontSize: 11, color: D.blue, padding: "8px 16px", borderRadius: 8, border: "1px solid " + D.blue + "40", background: D.blue + "10", userSelect: "none", transition: "all 0.15s ease" }}>
        <span style={{ fontSize: 14, transform: formOpen ? "rotate(45deg)" : "rotate(0deg)", transition: "transform 0.2s ease", display: "inline-block" }}>+</span>
        {formOpen ? "Close Form" : "Add Trend"}
      </div>
    </div>

    {/* ═══ ADD TREND FORM ═══ */}
    {formOpen && <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 12, padding: 20, marginBottom: 24, maxWidth: 640 }}>
      <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: D.tx, marginBottom: 16 }}>New Trend</div>

      <InputField label="URL" value={url} onChange={setUrl} placeholder="https://..." mono />

      {/* Platform selector */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>PLATFORM</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Object.keys(PLATFORMS).map(function(pk) {
            var p = PLATFORMS[pk];
            var active = platform === pk;
            return <span key={pk} onClick={function() { setPlatform(pk); }} style={{ fontFamily: mn, fontSize: 10, color: active ? "#fff" : D.txm, padding: "5px 12px", borderRadius: 6, border: "1px solid " + (active ? p.color : D.border), background: active ? p.color + "30" : "transparent", cursor: "pointer", userSelect: "none", transition: "all 0.15s ease" }}>
              {p.icon} {p.name}
            </span>;
          })}
        </div>
      </div>

      <InputField label="FORMAT" value={format} onChange={setFormat} placeholder="Hook structure, video length, pacing, transition style" />
      <InputField label="AUDIO" value={audio} onChange={setAudio} placeholder="Trending sound name + link" />
      <InputField label="VISUAL" value={visual} onChange={setVisual} placeholder="Color grade, text placement, overlay style" />

      <SelectRow label="SENTIMENT" options={SENTIMENTS} value={sentiment} onChange={setSentiment} />
      <SelectRow label="AUDIENCE" options={AUDIENCES} value={audience} onChange={setAudience} />
      <SelectRow label="CTA TYPE" options={CTA_TYPES} value={ctaType} onChange={setCtaType} />

      {/* Relevance slider */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>RELEVANCE SCORE</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input type="range" min={0} max={10} value={relevance} onChange={function(e) { setRelevance(Number(e.target.value)); }} style={{ flex: 1, accentColor: D.blue }} />
          <span style={{ fontFamily: mn, fontSize: 16, fontWeight: 700, color: relScoreColor(relevance), minWidth: 24, textAlign: "center" }}>{relevance}</span>
        </div>
      </div>

      <InputField label="SA ANGLE" value={saAngle} onChange={setSaAngle} placeholder="How would SA use this?" />

      <div onClick={handleAdd} style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontFamily: ft, fontSize: 12, fontWeight: 700, color: "#fff", padding: "10px 24px", borderRadius: 8, background: D.blue, marginTop: 8, userSelect: "none", transition: "opacity 0.15s ease" }}>
        Add Trend
      </div>
    </div>}

    {/* ═══ FILTER BAR ═══ */}
    <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 10, padding: "14px 16px", marginBottom: 24 }}>
      <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Filters</div>

      {/* Platform filter */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ fontFamily: mn, fontSize: 9, color: D.txd, width: 60 }}>Platform</span>
        <Pill label="All" active={!fPlat} onClick={function() { setFPlat(""); }} />
        {Object.keys(PLATFORMS).map(function(pk) {
          return <Pill key={pk} label={PLATFORMS[pk].name} active={fPlat === pk} onClick={function() { setFPlat(fPlat === pk ? "" : pk); }} color={PLATFORMS[pk].color} />;
        })}
      </div>

      {/* Sentiment filter */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ fontFamily: mn, fontSize: 9, color: D.txd, width: 60 }}>Sentiment</span>
        <Pill label="All" active={!fSent} onClick={function() { setFSent(""); }} />
        {SENTIMENTS.map(function(s) { return <Pill key={s} label={s} active={fSent === s} onClick={function() { setFSent(fSent === s ? "" : s); }} />; })}
      </div>

      {/* Audience filter */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ fontFamily: mn, fontSize: 9, color: D.txd, width: 60 }}>Audience</span>
        <Pill label="All" active={!fAud} onClick={function() { setFAud(""); }} />
        {AUDIENCES.map(function(a) { return <Pill key={a} label={a} active={fAud === a} onClick={function() { setFAud(fAud === a ? "" : a); }} />; })}
      </div>

      {/* Status filter */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontFamily: mn, fontSize: 9, color: D.txd, width: 60 }}>Status</span>
        <Pill label="All" active={!fStat} onClick={function() { setFStat(""); }} />
        {STATUSES.map(function(s) { return <Pill key={s} label={s} active={fStat === s} onClick={function() { setFStat(fStat === s ? "" : s); }} color={STATUS_COLORS[s]} />; })}
      </div>
    </div>

    {/* ═══ COUNT ═══ */}
    <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, marginBottom: 12 }}>
      {filtered.length} trend{filtered.length !== 1 ? "s" : ""}{(fPlat || fSent || fAud || fStat) ? " (filtered)" : ""}
    </div>

    {/* ═══ TREND FEED ═══ */}
    {filtered.length === 0 && <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 10, padding: "40px 20px", textAlign: "center" }}>
      <div style={{ fontFamily: ft, fontSize: 14, color: D.txm, marginBottom: 4 }}>No trends yet</div>
      <div style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>Add one above to get started</div>
    </div>}

    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {filtered.map(function(t) {
        var plat = PLATFORMS[t.platform] || { name: t.platform, icon: "\uD83D\uDCE2", color: D.txm };
        var sc = relScoreColor(t.relevance);
        var dateStr = new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

        return <div key={t.id} style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 10, padding: 16, transition: "border-color 0.15s ease" }}>
          {/* Top row: platform + URL + status + date */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            {/* Platform badge */}
            <span style={{ fontFamily: mn, fontSize: 10, color: "#fff", padding: "3px 10px", borderRadius: 5, background: plat.color + "30", border: "1px solid " + plat.color + "50", whiteSpace: "nowrap" }}>
              {plat.icon} {plat.name}
            </span>

            {/* URL */}
            <a href={t.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: mn, fontSize: 11, color: D.blue, textDecoration: "none", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {truncUrl(t.url, 60)}
            </a>

            {/* Status badge */}
            <span onClick={function() { cycleStatus(t.id); }} style={{ fontFamily: mn, fontSize: 9, color: STATUS_COLORS[t.status], padding: "3px 10px", borderRadius: 5, border: "1px solid " + STATUS_COLORS[t.status] + "50", background: STATUS_COLORS[t.status] + "15", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }} title="Click to cycle status">
              {t.status}
            </span>

            {/* Date */}
            <span style={{ fontFamily: mn, fontSize: 9, color: D.txd, whiteSpace: "nowrap" }}>{dateStr}</span>
          </div>

          {/* Relevance bar */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
              <span style={{ fontFamily: mn, fontSize: 9, color: D.txd }}>RELEVANCE</span>
              <span style={{ fontFamily: mn, fontSize: 11, fontWeight: 700, color: sc }}>{t.relevance}/10</span>
            </div>
            <div style={{ height: 4, background: D.border, borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: (t.relevance * 10) + "%", background: sc, borderRadius: 2, transition: "width 0.3s ease" }} />
            </div>
          </div>

          {/* SA Angle */}
          {t.saAngle && <div style={{ marginBottom: 10 }}>
            <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, marginBottom: 2 }}>SA ANGLE</div>
            <div style={{ fontFamily: ft, fontSize: 12, color: D.tx, lineHeight: 1.5 }}>{t.saAngle}</div>
          </div>}

          {/* Detail rows: format, audio, visual */}
          {(t.format || t.audio || t.visual) && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            {t.format && <div style={{ fontFamily: mn, fontSize: 9, color: D.txm, background: D.surface, padding: "3px 8px", borderRadius: 4 }}><span style={{ color: D.txd }}>FMT</span> {t.format}</div>}
            {t.audio && <div style={{ fontFamily: mn, fontSize: 9, color: D.txm, background: D.surface, padding: "3px 8px", borderRadius: 4 }}><span style={{ color: D.txd }}>AUD</span> {t.audio}</div>}
            {t.visual && <div style={{ fontFamily: mn, fontSize: 9, color: D.txm, background: D.surface, padding: "3px 8px", borderRadius: 4 }}><span style={{ color: D.txd }}>VIS</span> {t.visual}</div>}
          </div>}

          {/* Tags row + actions */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {t.sentiment && <span style={{ fontFamily: mn, fontSize: 9, color: D.cyan, padding: "2px 8px", borderRadius: 12, background: D.cyan + "12", border: "1px solid " + D.cyan + "25" }}>{t.sentiment}</span>}
              {t.audience && <span style={{ fontFamily: mn, fontSize: 9, color: D.violet, padding: "2px 8px", borderRadius: 12, background: D.violet + "12", border: "1px solid " + D.violet + "25" }}>{t.audience}</span>}
              {t.ctaType && <span style={{ fontFamily: mn, fontSize: 9, color: D.amber, padding: "2px 8px", borderRadius: 12, background: D.amber + "12", border: "1px solid " + D.amber + "25" }}>{t.ctaType}</span>}
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {/* Send to Slob Top */}
              <span onClick={function() { addToast("Sent to Slob Top", "success"); }} style={{ fontFamily: mn, fontSize: 9, color: D.blue, padding: "4px 10px", borderRadius: 5, border: "1px solid " + D.blue + "40", background: D.blue + "10", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
                Send to Slob Top
              </span>

              {/* Remove */}
              <span onClick={function() { removeTrend(t.id); }} style={{ fontFamily: mn, fontSize: 9, color: D.coral, padding: "4px 10px", borderRadius: 5, border: "1px solid " + D.coral + "40", background: D.coral + "10", cursor: "pointer", userSelect: "none" }}>
                Remove
              </span>
            </div>
          </div>
        </div>;
      })}
    </div>
  </div>;
}
