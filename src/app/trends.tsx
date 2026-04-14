// @ts-nocheck
"use client";
import { useState, useEffect } from "react";

// ═══ DESIGN LANGUAGE ═══
var D = {
  bg: "#060608", card: "#09090D", border: "rgba(255,255,255,0.06)", hover: "#0D0D12",
  surface: "#0D0D12", tx: "#E8E4DD", txm: "#9A969F", txd: "#5A5766",
  amber: "#F7B041", blue: "#0B86D1", teal: "#2EAD8E", coral: "#E06347",
  violet: "#905CCB", cyan: "#26C9D8",
};
var ft = "'Outfit',sans-serif";
var mn = "'JetBrains Mono',monospace";

// ═══ SOURCE DEFINITIONS ═══
var SOURCES = [
  { key: "all", label: "All", color: D.amber },
  { key: "google", label: "Google", color: "#4285F4" },
  { key: "youtube", label: "YouTube", color: "#FF0000" },
  { key: "news", label: "News", color: "#333333" },
  { key: "apple-podcasts", label: "Apple Podcasts", color: "#FC3C44" },
  { key: "apple-music", label: "Apple Music", color: "#FC3C44" },
  { key: "reddit", label: "Reddit", color: "#FF4500" },
  { key: "spotify", label: "Spotify", color: "#1DB954" },
];

var CATEGORY_ROWS = [
  { key: "news", label: "Top Stories", icon: "N" },
  { key: "youtube", label: "Trending Videos", icon: "YT" },
  { key: "apple-podcasts", label: "Top Podcasts", icon: "AP" },
  { key: "apple-music", label: "Top Music (Apple)", icon: "AM" },
  { key: "spotify", label: "Top Music (Spotify)", icon: "S" },
  { key: "reddit", label: "Reddit Hot", icon: "R" },
  { key: "google", label: "Google Trends", icon: "G" },
];

var CONTENT_FORMATS = ["Short video", "Meme", "Thread", "Carousel", "Article"];
var TOPIC_AREAS = ["AI", "Semiconductors", "Data Centers", "Memory", "Geopolitics", "General Tech"];

// ═══ MANUAL TREND HELPERS ═══
var SENTIMENTS = ["Humorous", "Educational", "Hype", "Emotional", "Informational"];
var AUDIENCES = ["General", "Tech", "Finance", "AI", "Hardware"];
var PLATFORMS_MANUAL = {
  tiktok: { name: "TikTok", color: "#00F2EA" },
  ytshorts: { name: "YT Shorts", color: "#FF0000" },
  igreels: { name: "IG Reels", color: "#E4405F" },
  x: { name: "X", color: "#1DA1F2" },
};

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
    <style dangerouslySetInnerHTML={{ __html: "@keyframes toastIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes toastDrain{from{width:100%}to{width:0}}@keyframes wizGlow{0%,100%{box-shadow:0 0 16px rgba(247,176,65,0.4)}50%{box-shadow:0 0 28px rgba(247,176,65,0.7)}}@keyframes overlayIn{from{opacity:0}to{opacity:1}}" }} />
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
function sourceColor(key) {
  var s = SOURCES.find(function(s) { return s.key === key; });
  return s ? s.color : D.txm;
}
function truncText(text, max) { if (!text) return ""; if (text.length <= (max || 80)) return text; return text.slice(0, max || 80) + "\u2026"; }
function makeId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function fromDbRow(row) {
  return { id: row.id, url: row.url || "", platform: row.platform || "", format: row.format || "", audio: row.audio || "", visual: row.visual || "", sentiment: row.sentiment || "", audience: row.audience || "", ctaType: row.cta_type || "", relevance: row.relevance_score != null ? row.relevance_score : 5, saAngle: row.sa_angle || "", status: row.status || "Active", date: row.created_at || new Date().toISOString(), _manual: true };
}
function toDbRow(t) {
  var row = { url: t.url || "", platform: t.platform || "", format: t.format || "", audio: t.audio || "", visual: t.visual || "", sentiment: t.sentiment || "", audience: t.audience || "", cta_type: t.ctaType || "", relevance_score: t.relevance != null ? t.relevance : 5, sa_angle: t.saAngle || "", status: t.status || "Active" };
  if (t.id) row.id = t.id;
  return row;
}

// ═══ PILL COMPONENT ═══
function Pill({ label, active, onClick, color }) {
  var bg = active ? (color || D.blue) + "25" : "transparent";
  var bc = active ? (color || D.blue) : D.border;
  var tx = active ? (color || D.blue) : D.txm;
  return <span onClick={onClick} style={{ fontFamily: mn, fontSize: 10, color: tx, padding: "3px 10px", borderRadius: 20, border: "1px solid " + bc, background: bg, cursor: "pointer", userSelect: "none", transition: "all 0.15s ease", whiteSpace: "nowrap" }}>{label}</span>;
}

// ═══ TREND CARD ═══
function TrendCard({ item, sourceKey }) {
  var c = sourceColor(sourceKey);
  var _hov = useState(false), hov = _hov[0], setHov = _hov[1];
  var timeAgo = "";
  if (item.timestamp) {
    var diff = Date.now() - new Date(item.timestamp).getTime();
    var hours = Math.floor(diff / 3600000);
    if (hours < 1) timeAgo = "just now";
    else if (hours < 24) timeAgo = hours + "h ago";
    else timeAgo = Math.floor(hours / 24) + "d ago";
  }
  return <div onMouseEnter={function() { setHov(true); }} onMouseLeave={function() { setHov(false); }} style={{ background: hov ? D.hover : D.card, border: "1px solid " + (hov ? c + "40" : D.border), borderRadius: 10, padding: 14, minWidth: 240, maxWidth: 300, flex: "0 0 auto", transition: "all 0.15s ease", cursor: "default" }}>
    {/* Color strip */}
    <div style={{ height: 2, width: 32, background: c, borderRadius: 1, marginBottom: 10, opacity: 0.7 }} />
    {/* Title */}
    <div style={{ fontFamily: ft, fontSize: 13, fontWeight: 600, color: D.tx, lineHeight: 1.35, marginBottom: 8, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.title}</div>
    {/* Metric + time */}
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
      <div style={{ fontFamily: mn, fontSize: 10, color: c, fontWeight: 600 }}>{item.metric}</div>
      {timeAgo && <div style={{ fontFamily: mn, fontSize: 8, color: D.txd }}>{timeAgo}</div>}
    </div>
    {/* Tags */}
    {item.tags && item.tags.length > 0 && <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
      {item.tags.slice(0, 3).map(function(tag, i) {
        return <span key={i} style={{ fontFamily: mn, fontSize: 8, color: D.txd, padding: "2px 6px", borderRadius: 8, background: D.surface, border: "1px solid " + D.border }}>{tag}</span>;
      })}
    </div>}
    {/* URL */}
    {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: mn, fontSize: 9, color: D.blue, textDecoration: "none", opacity: 0.8 }}>{truncText(item.url, 40)}</a>}
  </div>;
}

// ═══ MANUAL TREND CARD ═══
function ManualTrendCard({ trend, onRemove }) {
  return <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 10, padding: 14, minWidth: 240, maxWidth: 300, flex: "0 0 auto" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
      <span style={{ fontFamily: mn, fontSize: 8, color: D.amber, padding: "2px 6px", borderRadius: 8, background: D.amber + "15", border: "1px solid " + D.amber + "30" }}>Manual</span>
      <span style={{ fontFamily: mn, fontSize: 8, color: D.txd }}>{PLATFORMS_MANUAL[trend.platform] ? PLATFORMS_MANUAL[trend.platform].name : trend.platform}</span>
    </div>
    <div style={{ fontFamily: ft, fontSize: 12, color: D.tx, marginBottom: 6, lineHeight: 1.4 }}>{truncText(trend.url, 60)}</div>
    {trend.saAngle && <div style={{ fontFamily: ft, fontSize: 11, color: D.txm, marginBottom: 6 }}>{trend.saAngle}</div>}
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
      {trend.sentiment && <span style={{ fontFamily: mn, fontSize: 8, color: D.cyan, padding: "2px 6px", borderRadius: 8, background: D.cyan + "12" }}>{trend.sentiment}</span>}
      {trend.audience && <span style={{ fontFamily: mn, fontSize: 8, color: D.violet, padding: "2px 6px", borderRadius: 8, background: D.violet + "12" }}>{trend.audience}</span>}
    </div>
    <span onClick={onRemove} style={{ fontFamily: mn, fontSize: 9, color: D.coral, cursor: "pointer", userSelect: "none" }}>Remove</span>
  </div>;
}

// ═══ HORIZONTAL SCROLL ROW ═══
function HScrollRow({ label, icon, sourceKey, items }) {
  var c = sourceColor(sourceKey);
  if (!items || items.length === 0) return null;
  return <div style={{ marginBottom: 24 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <span style={{ fontFamily: mn, fontSize: 10, fontWeight: 700, color: "#fff", background: c + "30", border: "1px solid " + c + "50", padding: "2px 8px", borderRadius: 5 }}>{icon}</span>
      <span style={{ fontFamily: ft, fontSize: 15, fontWeight: 700, color: D.tx }}>{label}</span>
      <span style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>{items.length}</span>
    </div>
    <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "thin", scrollbarColor: D.border + " transparent" }}>
      {items.map(function(item, i) {
        return <TrendCard key={sourceKey + "-" + i} item={item} sourceKey={sourceKey} />;
      })}
    </div>
  </div>;
}

// ═══ FULL GRID VIEW ═══
function FullGrid({ items, sourceKey }) {
  if (!items || items.length === 0) return <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 10, padding: "40px 20px", textAlign: "center" }}>
    <div style={{ fontFamily: ft, fontSize: 14, color: D.txm }}>No items from this source</div>
  </div>;
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
    {items.map(function(item, i) {
      return <TrendCard key={sourceKey + "-grid-" + i} item={item} sourceKey={sourceKey} />;
    })}
  </div>;
}

// ═══ WIZARD OVERLAY ═══
function WizardOverlay({ visible, onClose, feedData }) {
  var _contentType = useState(""), contentType = _contentType[0], setContentType = _contentType[1];
  var _topic = useState(""), topic = _topic[0], setTopic = _topic[1];
  var _ideas = useState(null), ideas = _ideas[0], setIdeas = _ideas[1];
  var _loading = useState(false), loading = _loading[0], setLoading = _loading[1];
  var _error = useState(""), error = _error[0], setError = _error[1];

  function reset() { setContentType(""); setTopic(""); setIdeas(null); setError(""); }
  function handleClose() { reset(); onClose(); }

  function generate() {
    if (!contentType || !topic) { addToast("Select both content type and topic", "error"); return; }
    setLoading(true); setError(""); setIdeas(null);

    // Build a summary of current trends for context
    var trendSummary = "";
    if (feedData && feedData.length > 0) {
      feedData.forEach(function(src) {
        if (src.items && src.items.length > 0) {
          trendSummary += "\n[" + src.source.toUpperCase() + "]\n";
          src.items.slice(0, 5).forEach(function(item) {
            trendSummary += "- " + item.title + " (" + item.metric + ")\n";
          });
        }
      });
    }

    var systemPrompt = "You are a content strategist specializing in viral social media content. You have deep knowledge of content trends, engagement patterns, and platform algorithms. Given current trending topics and the user's preferences, suggest exactly 5 content ideas. Each idea must reference a specific current trend from the data provided. Respond ONLY with valid JSON in this exact format: {\"ideas\":[{\"title\":\"...\",\"hook\":\"...\",\"format\":\"...\",\"trendReference\":\"...\"}]} where title is a punchy content title, hook is the opening line or concept hook, format is a specific format recommendation (length, style, platform tips), and trendReference names which trend from the data it builds on.";

    var userPrompt = "Current trending data:\n" + trendSummary + "\n\nI want to create: " + contentType + "\nTopic area: " + topic + "\n\nGive me 5 content ideas based on these current trends.";

    fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: systemPrompt, prompt: userPrompt }),
    }).then(function(r) { return r.json(); }).then(function(data) {
      setLoading(false);
      if (data.error) { setError(data.error.message || data.error); return; }
      var text = "";
      if (data.content && data.content[0]) text = data.content[0].text || "";
      try {
        var jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          var parsed = JSON.parse(jsonMatch[0]);
          setIdeas(parsed.ideas || []);
        } else { setError("Could not parse response"); }
      } catch(e) { setError("Failed to parse AI response"); }
    }).catch(function(e) { setLoading(false); setError(e.message || "Network error"); });
  }

  function sendIdea(idea, dest) {
    addToast("Sent \"" + truncText(idea.title, 30) + "\" to " + dest, "success");
  }

  if (!visible) return null;

  return <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(0,0,0,0.85)", animation: "overlayIn 0.2s ease", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
    <div style={{ background: D.bg, border: "1px solid " + D.border, borderRadius: 16, width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto", padding: 28 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: ft, fontSize: 20, fontWeight: 800, color: D.amber }}>Content Wizard</div>
          <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, marginTop: 2 }}>AI-powered trend-based content ideation</div>
        </div>
        <span onClick={handleClose} style={{ fontFamily: mn, fontSize: 18, color: D.txm, cursor: "pointer", userSelect: "none", padding: "4px 8px" }}>x</span>
      </div>

      {/* Step 1: Content Type */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>What type of content do you want to make?</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {CONTENT_FORMATS.map(function(f) {
            return <Pill key={f} label={f} active={contentType === f} onClick={function() { setContentType(contentType === f ? "" : f); }} color={D.amber} />;
          })}
        </div>
      </div>

      {/* Step 2: Topic */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>What topic area?</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {TOPIC_AREAS.map(function(t) {
            return <Pill key={t} label={t} active={topic === t} onClick={function() { setTopic(topic === t ? "" : t); }} color={D.blue} />;
          })}
        </div>
      </div>

      {/* Generate button */}
      <div onClick={loading ? undefined : generate} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: ft, fontSize: 13, fontWeight: 700, color: "#fff", padding: "10px 24px", borderRadius: 8, background: loading ? D.txd : D.amber, cursor: loading ? "default" : "pointer", userSelect: "none", marginBottom: 20, opacity: loading ? 0.6 : 1, transition: "all 0.15s ease" }}>
        {loading ? "Generating..." : "Generate Ideas"}
      </div>

      {/* Error */}
      {error && <div style={{ fontFamily: mn, fontSize: 11, color: D.coral, marginBottom: 16, padding: "8px 12px", background: D.coral + "10", borderRadius: 6, border: "1px solid " + D.coral + "30" }}>{error}</div>}

      {/* Ideas */}
      {ideas && ideas.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {ideas.map(function(idea, i) {
          return <div key={i} style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 10, padding: 16 }}>
            <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: D.tx, marginBottom: 6 }}>{(i + 1) + ". " + idea.title}</div>
            <div style={{ fontFamily: ft, fontSize: 12, color: D.txm, marginBottom: 6, lineHeight: 1.5 }}><span style={{ color: D.amber, fontWeight: 600 }}>Hook:</span> {idea.hook}</div>
            <div style={{ fontFamily: ft, fontSize: 11, color: D.txm, marginBottom: 6, lineHeight: 1.4 }}><span style={{ color: D.blue, fontWeight: 600 }}>Format:</span> {idea.format}</div>
            <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, marginBottom: 10 }}>Trend ref: {idea.trendReference}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <span onClick={function() { sendIdea(idea, "Slop Top"); }} style={{ fontFamily: mn, fontSize: 9, color: D.blue, padding: "4px 12px", borderRadius: 5, border: "1px solid " + D.blue + "40", background: D.blue + "10", cursor: "pointer", userSelect: "none" }}>Send to Slop Top</span>
              <span onClick={function() { sendIdea(idea, "IdeationNation"); }} style={{ fontFamily: mn, fontSize: 9, color: D.violet, padding: "4px 12px", borderRadius: 5, border: "1px solid " + D.violet + "40", background: D.violet + "10", cursor: "pointer", userSelect: "none" }}>Send to IdeationNation</span>
            </div>
          </div>;
        })}
      </div>}
    </div>
  </div>;
}

// ═══ MANUAL ADD FORM ═══
function ManualAddForm({ onAdd, onClose }) {
  var _url = useState(""), url = _url[0], setUrl = _url[1];
  var _platform = useState("tiktok"), platform = _platform[0], setPlatform = _platform[1];
  var _format = useState(""), format = _format[0], setFormat = _format[1];
  var _audio = useState(""), audio = _audio[0], setAudio = _audio[1];
  var _visual = useState(""), visual = _visual[0], setVisual = _visual[1];
  var _sentiment = useState(""), sentiment = _sentiment[0], setSentiment = _sentiment[1];
  var _audience = useState(""), audience = _audience[0], setAudience = _audience[1];
  var _saAngle = useState(""), saAngle = _saAngle[0], setSaAngle = _saAngle[1];
  var _relevance = useState(5), relevance = _relevance[0], setRelevance = _relevance[1];

  function handleSubmit() {
    if (!url.trim()) { addToast("URL is required", "error"); return; }
    onAdd({ url: url.trim(), platform: platform, format: format.trim(), audio: audio.trim(), visual: visual.trim(), sentiment: sentiment, audience: audience, ctaType: "", relevance: relevance, saAngle: saAngle.trim(), status: "Active", date: new Date().toISOString() });
    onClose();
  }

  function InputField({ label, value, onChange, placeholder, mono }) {
    return <div style={{ marginBottom: 10 }}>
      <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      <input value={value} onChange={function(e) { onChange(e.target.value); }} placeholder={placeholder || ""} style={{ width: "100%", background: D.surface, border: "1px solid " + D.border, borderRadius: 6, padding: "8px 10px", color: D.tx, fontFamily: mono ? mn : ft, fontSize: 12, outline: "none", boxSizing: "border-box" }} />
    </div>;
  }

  return <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 12, padding: 20, marginBottom: 24, maxWidth: 640 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
      <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: D.tx }}>Add Manual Trend</div>
      <span onClick={onClose} style={{ fontFamily: mn, fontSize: 14, color: D.txm, cursor: "pointer", userSelect: "none" }}>x</span>
    </div>
    <InputField label="URL" value={url} onChange={setUrl} placeholder="https://..." mono />
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>PLATFORM</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {Object.keys(PLATFORMS_MANUAL).map(function(pk) {
          var p = PLATFORMS_MANUAL[pk];
          var active = platform === pk;
          return <span key={pk} onClick={function() { setPlatform(pk); }} style={{ fontFamily: mn, fontSize: 10, color: active ? "#fff" : D.txm, padding: "5px 12px", borderRadius: 6, border: "1px solid " + (active ? p.color : D.border), background: active ? p.color + "30" : "transparent", cursor: "pointer", userSelect: "none" }}>{p.name}</span>;
        })}
      </div>
    </div>
    <InputField label="FORMAT" value={format} onChange={setFormat} placeholder="Hook structure, length, pacing" />
    <InputField label="AUDIO" value={audio} onChange={setAudio} placeholder="Trending sound name" />
    <InputField label="VISUAL" value={visual} onChange={setVisual} placeholder="Color grade, text placement" />
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>SENTIMENT</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {SENTIMENTS.map(function(s) { return <Pill key={s} label={s} active={sentiment === s} onClick={function() { setSentiment(sentiment === s ? "" : s); }} />; })}
      </div>
    </div>
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>AUDIENCE</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {AUDIENCES.map(function(a) { return <Pill key={a} label={a} active={audience === a} onClick={function() { setAudience(audience === a ? "" : a); }} />; })}
      </div>
    </div>
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>RELEVANCE</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <input type="range" min={0} max={10} value={relevance} onChange={function(e) { setRelevance(Number(e.target.value)); }} style={{ flex: 1, accentColor: D.blue }} />
        <span style={{ fontFamily: mn, fontSize: 14, fontWeight: 700, color: relevance <= 3 ? D.coral : relevance <= 6 ? D.amber : D.teal }}>{relevance}</span>
      </div>
    </div>
    <InputField label="SA ANGLE" value={saAngle} onChange={setSaAngle} placeholder="How would SA use this?" />
    <div onClick={handleSubmit} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: ft, fontSize: 12, fontWeight: 700, color: "#fff", padding: "10px 24px", borderRadius: 8, background: D.blue, marginTop: 4, cursor: "pointer", userSelect: "none" }}>Add Trend</div>
  </div>;
}

// ═══ MAIN COMPONENT ═══
export default function Trends() {
  var _activeSource = useState("all"), activeSource = _activeSource[0], setActiveSource = _activeSource[1];
  var _feedData = useState([]), feedData = _feedData[0], setFeedData = _feedData[1];
  var _manualTrends = useState([]), manualTrends = _manualTrends[0], setManualTrends = _manualTrends[1];
  var _loading = useState(true), loading = _loading[0], setLoading = _loading[1];
  var _wizardOpen = useState(false), wizardOpen = _wizardOpen[0], setWizardOpen = _wizardOpen[1];
  var _addFormOpen = useState(false), addFormOpen = _addFormOpen[0], setAddFormOpen = _addFormOpen[1];

  // ═══ FETCH TRENDS FEED ═══
  function fetchFeed() {
    setLoading(true);
    fetch("/api/trends-feed?source=all").then(function(r) { return r.json(); }).then(function(data) {
      if (data.sources) {
        var valid = data.sources.filter(function(s) { return s.items && !s.error; });
        setFeedData(valid);
      }
      setLoading(false);
    }).catch(function() { setLoading(false); addToast("Failed to load trends feed", "error"); });
  }

  // ═══ FETCH MANUAL TRENDS ═══
  function fetchManual() {
    fetch("/api/db?table=trends").then(function(r) { return r.json(); }).then(function(res) {
      if (res.data && res.data.length > 0) { setManualTrends(res.data.map(fromDbRow)); }
    }).catch(function() {});
  }

  useEffect(function() { fetchFeed(); fetchManual(); }, []);

  // ═══ ADD MANUAL TREND ═══
  function handleManualAdd(entry) {
    fetch("/api/db", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ table: "trends", data: toDbRow(entry) }) })
      .then(function(r) { return r.json(); })
      .then(function(res) {
        if (res.data && res.data[0]) { setManualTrends(function(p) { return [fromDbRow(res.data[0])].concat(p); }); }
        else { setManualTrends(function(p) { return [Object.assign({}, entry, { id: makeId(), _manual: true })].concat(p); }); }
      })
      .catch(function() { setManualTrends(function(p) { return [Object.assign({}, entry, { id: makeId(), _manual: true })].concat(p); }); });
    addToast("Manual trend added", "success");
  }

  // ═══ REMOVE MANUAL TREND ═══
  function handleManualRemove(id) {
    fetch("/api/db", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ table: "trends", id: id }) }).catch(function() {});
    setManualTrends(function(p) { return p.filter(function(t) { return t.id !== id; }); });
    addToast("Manual trend removed", "info");
  }

  // ═══ GET ITEMS FOR A SOURCE ═══
  function getSourceItems(key) {
    var src = feedData.find(function(s) { return s.source === key; });
    return src ? src.items : [];
  }

  return <div style={{ minHeight: "100vh", background: D.bg, color: D.tx, fontFamily: ft, padding: "32px 24px", position: "relative" }}>
    <ToastContainer />

    {/* ═══ HEADER ═══ */}
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 28, fontWeight: 900, fontFamily: ft, color: D.tx, letterSpacing: -0.5 }}>Trends</div>
      <div style={{ fontFamily: mn, fontSize: 10, color: D.txm, marginTop: 4 }}>TrendPulse // Real-time content intelligence</div>
    </div>

    {/* ═══ SOURCE ROW ═══ */}
    <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, marginBottom: 20, scrollbarWidth: "thin", scrollbarColor: D.border + " transparent" }}>
      {SOURCES.map(function(s) {
        var active = activeSource === s.key;
        return <span key={s.key} onClick={function() { setActiveSource(s.key); }} style={{ fontFamily: mn, fontSize: 10, fontWeight: 600, color: active ? "#fff" : D.txm, padding: "6px 14px", borderRadius: 20, border: "1px solid " + (active ? s.color : D.border), background: active ? s.color + "25" : "transparent", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap", transition: "all 0.15s ease", flexShrink: 0 }}>{s.label}</span>;
      })}

      {/* Refresh button */}
      <span onClick={function() { fetchFeed(); addToast("Refreshing trends...", "info"); }} style={{ fontFamily: mn, fontSize: 10, color: D.blue, padding: "6px 14px", borderRadius: 20, border: "1px solid " + D.blue + "40", background: D.blue + "10", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap", flexShrink: 0, transition: "all 0.15s ease" }}>Refresh</span>
    </div>

    {/* ═══ ADD BUTTON ═══ */}
    <div style={{ marginBottom: 16 }}>
      <span onClick={function() { setAddFormOpen(!addFormOpen); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: mn, fontSize: 11, color: D.blue, padding: "6px 14px", borderRadius: 8, border: "1px solid " + D.blue + "40", background: D.blue + "10", cursor: "pointer", userSelect: "none", transition: "all 0.15s ease" }}>
        <span style={{ fontSize: 14, transform: addFormOpen ? "rotate(45deg)" : "rotate(0deg)", transition: "transform 0.2s ease", display: "inline-block" }}>+</span>
        {addFormOpen ? "Close" : "Add Manual"}
      </span>
    </div>

    {/* ═══ MANUAL ADD FORM ═══ */}
    {addFormOpen && <ManualAddForm onAdd={handleManualAdd} onClose={function() { setAddFormOpen(false); }} />}

    {/* ═══ LOADING ═══ */}
    {loading && <div style={{ fontFamily: mn, fontSize: 11, color: D.txd, marginBottom: 20, padding: "20px 0", textAlign: "center" }}>Loading trends feed...</div>}

    {/* ═══ STATS BAR ═══ */}
    {!loading && <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
      {feedData.map(function(src) {
        var c = sourceColor(src.source);
        var count = src.items ? src.items.length : 0;
        var label = SOURCES.find(function(s) { return s.key === src.source; });
        return <div key={src.source} style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: mn, fontSize: 9, color: D.txd }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: c }} />
          <span>{label ? label.label : src.source}</span>
          <span style={{ color: c, fontWeight: 700 }}>{count}</span>
        </div>;
      })}
      {manualTrends.length > 0 && <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: mn, fontSize: 9, color: D.txd }}>
        <span style={{ width: 6, height: 6, borderRadius: 3, background: D.amber }} />
        <span>Manual</span>
        <span style={{ color: D.amber, fontWeight: 700 }}>{manualTrends.length}</span>
      </div>}
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: mn, fontSize: 9, color: D.txm }}>
        <span>Total:</span>
        <span style={{ color: D.tx, fontWeight: 700 }}>{feedData.reduce(function(sum, s) { return sum + (s.items ? s.items.length : 0); }, 0) + manualTrends.length}</span>
      </div>
    </div>}

    {/* ═══ ALL VIEW -- CATEGORY ROWS ═══ */}
    {!loading && activeSource === "all" && <div>
      {/* Manual trends row */}
      {manualTrends.length > 0 && <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontFamily: mn, fontSize: 10, fontWeight: 700, color: "#fff", background: D.amber + "30", border: "1px solid " + D.amber + "50", padding: "2px 8px", borderRadius: 5 }}>M</span>
          <span style={{ fontFamily: ft, fontSize: 15, fontWeight: 700, color: D.tx }}>Manual Trends</span>
          <span style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>{manualTrends.length}</span>
        </div>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8 }}>
          {manualTrends.map(function(t) {
            return <ManualTrendCard key={t.id} trend={t} onRemove={function() { handleManualRemove(t.id); }} />;
          })}
        </div>
      </div>}

      {/* Feed category rows */}
      {CATEGORY_ROWS.map(function(cat) {
        var items = getSourceItems(cat.key);
        return <HScrollRow key={cat.key} label={cat.label} icon={cat.icon} sourceKey={cat.key} items={items} />;
      })}

      {/* Empty state */}
      {feedData.length === 0 && manualTrends.length === 0 && <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 10, padding: "40px 20px", textAlign: "center" }}>
        <div style={{ fontFamily: ft, fontSize: 14, color: D.txm, marginBottom: 4 }}>No trends data available</div>
        <div style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>Click Refresh or add trends manually</div>
      </div>}
    </div>}

    {/* ═══ SINGLE SOURCE VIEW ═══ */}
    {!loading && activeSource !== "all" && <div>
      {/* Source header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ width: 10, height: 10, borderRadius: 5, background: sourceColor(activeSource) }} />
        <span style={{ fontFamily: ft, fontSize: 16, fontWeight: 700, color: D.tx }}>{(SOURCES.find(function(s) { return s.key === activeSource; }) || {}).label || activeSource}</span>
        <span style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>{getSourceItems(activeSource).length} items</span>
      </div>
      <FullGrid items={getSourceItems(activeSource)} sourceKey={activeSource} />
    </div>}

    {/* ═══ WIZARD FLOATING BUTTON ═══ */}
    <div onClick={function() { setWizardOpen(true); }} style={{ position: "fixed", bottom: 28, right: 28, width: 56, height: 56, borderRadius: 28, background: D.amber, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", userSelect: "none", animation: "wizGlow 2s ease-in-out infinite", zIndex: 8000, transition: "transform 0.15s ease" }} title="Content Wizard">
      <span style={{ fontFamily: ft, fontSize: 20, fontWeight: 900, color: D.bg }}>W</span>
    </div>

    {/* ═══ WIZARD OVERLAY ═══ */}
    <WizardOverlay visible={wizardOpen} onClose={function() { setWizardOpen(false); }} feedData={feedData} />
  </div>;
}
