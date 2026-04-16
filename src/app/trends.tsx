"use client";
import { useState, useEffect } from "react";

interface ToastItem {
  id: number;
  msg: string;
  type: string;
}

interface TrendItem {
  title: string;
  metric: string;
  url?: string;
  timestamp?: string;
  tags?: string[];
}

interface FeedSource {
  source: string;
  items: TrendItem[];
  error?: string;
}

interface ManualTrend {
  id: string;
  url: string;
  platform: string;
  format: string;
  audio: string;
  visual: string;
  sentiment: string;
  audience: string;
  ctaType: string;
  relevance: number;
  saAngle: string;
  status: string;
  date: string;
  _manual: true;
  _onRemove?: () => void;
}

interface ContentIdea {
  title: string;
  hook: string;
  format: string;
  trendReference: string;
}

// ═══ DESIGN LANGUAGE ═══
var D = {
  bg: "#060608", card: "#09090D", border: "rgba(255,255,255,0.06)", hover: "#0D0D12",
  surface: "#0D0D12", tx: "#E8E4DD", txm: "#9A969F", txd: "#5A5766",
  amber: "#F7B041", blue: "#0B86D1", teal: "#2EAD8E", coral: "#E06347",
  violet: "#905CCB", cyan: "#26C9D8",
};
var ft = "'Outfit',sans-serif";
var mn = "'JetBrains Mono',monospace";

// ═══ TAB DEFINITIONS ═══
var TABS = [
  { key: "social", label: "Social Media" },
  { key: "podcasts", label: "Podcasts & Music" },
  { key: "news", label: "News & Topics" },
];

// ═══ SOURCE CONFIGS PER TAB ═══
var SOURCE_META = {
  tiktok: { label: "TikTok Trending", color: "#00F2EA", icon: "\uD83D\uDD25" },
  instagram: { label: "Instagram Hot", color: "#E4405F", icon: "\uD83D\uDCF8" },
  youtube: { label: "YouTube Tech Trending", color: "#FF0000", icon: "\u25B6" },
  x: { label: "X Trending", color: "#1DA1F2", icon: "\uD83D\uDC26" },
  reddit: { label: "Reddit Hot", color: "#FF4500", icon: "\uD83D\uDD34" },
  "apple-podcasts": { label: "Apple Podcasts Top", color: "#FC3C44", icon: "\uD83C\uDFA7" },
  spotify: { label: "Spotify Browse", color: "#1DB954", icon: "\uD83C\uDFB5" },
  "apple-music": { label: "Apple Music Top", color: "#FC3C44", icon: "\uD83C\uDFB6" },
  google: { label: "Google Trends", color: "#4285F4", icon: "\uD83D\uDD0D" },
  news: { label: "News Headlines", color: "#6B7280", icon: "\uD83D\uDCF0" },
};

var TAB_SOURCES = {
  social: ["tiktok", "youtube", "instagram", "x", "reddit"],
  podcasts: ["apple-podcasts", "spotify", "apple-music"],
  news: ["google", "news"],
};

// ═══ MANUAL TREND HELPERS ═══
var CONTENT_FORMATS = ["Short video", "Meme", "Thread", "Carousel", "Article"];
var TOPIC_AREAS = ["AI", "Semiconductors", "Data Centers", "Memory", "Geopolitics", "General Tech"];
var SENTIMENTS = ["Humorous", "Educational", "Hype", "Emotional", "Informational"];
var AUDIENCES = ["General", "Tech", "Finance", "AI", "Hardware"];
var PLATFORMS_MANUAL = {
  tiktok: { name: "TikTok", color: "#00F2EA", tab: "social" },
  ytshorts: { name: "YT Shorts", color: "#FF0000", tab: "social" },
  igreels: { name: "IG Reels", color: "#E4405F", tab: "social" },
  x: { name: "X", color: "#1DA1F2", tab: "social" },
};

// ═══ TOAST SYSTEM ═══
var _toasts: { current: ((msg: string, type?: string) => void) | null } = { current: null };
function addToast(msg: string, type?: string) { if (_toasts.current) _toasts.current(msg, type); }

function ToastContainer() {
  var _list = useState<ToastItem[]>([]), list = _list[0], setList = _list[1];
  _toasts.current = function(msg: string, type?: string) {
    var id = Date.now();
    setList(function(p) { return [{ id: id, msg: msg, type: type || "success" }].concat(p).slice(0, 5); });
    setTimeout(function() { setList(function(p) { return p.filter(function(t) { return t.id !== id; }); }); }, 3200);
  };
  var colors: Record<string, string> = { success: D.teal, error: D.coral, info: D.blue };
  return <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 10000, display: "flex", flexDirection: "column", gap: 8 }}>
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
function srcColor(key: string) { var m = SOURCE_META[key as keyof typeof SOURCE_META]; return m ? m.color : D.txm; }
function truncText(text: string, max?: number) { if (!text) return ""; if (text.length <= (max || 80)) return text; return text.slice(0, max || 80) + "\u2026"; }
function makeId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function timeAgo(ts: string | undefined) {
  if (!ts) return "";
  var diff = Date.now() - new Date(ts).getTime();
  var mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  var hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  return Math.floor(hrs / 24) + "d ago";
}
function fromDbRow(row: Record<string, unknown>): ManualTrend {
  return { id: row.id as string, url: (row.url as string) || "", platform: (row.platform as string) || "", format: (row.format as string) || "", audio: (row.audio as string) || "", visual: (row.visual as string) || "", sentiment: (row.sentiment as string) || "", audience: (row.audience as string) || "", ctaType: (row.cta_type as string) || "", relevance: row.relevance_score != null ? row.relevance_score as number : 5, saAngle: (row.sa_angle as string) || "", status: (row.status as string) || "Active", date: (row.created_at as string) || new Date().toISOString(), _manual: true };
}
function toDbRow(t: ManualTrend) {
  var row: Record<string, unknown> = { url: t.url || "", platform: t.platform || "", format: t.format || "", audio: t.audio || "", visual: t.visual || "", sentiment: t.sentiment || "", audience: t.audience || "", cta_type: t.ctaType || "", relevance_score: t.relevance != null ? t.relevance : 5, sa_angle: t.saAngle || "", status: t.status || "Active" };
  if (t.id) row.id = t.id;
  return row;
}

// ═══ TREND CARD (240x180) ═══
function TrendCard({ item, sourceKey }: { item: TrendItem; sourceKey: string }) {
  var c = srcColor(sourceKey);
  var _hov = useState(false), hov = _hov[0], setHov = _hov[1];
  var ta = timeAgo(item.timestamp);
  return <div
    onMouseEnter={function() { setHov(true); }}
    onMouseLeave={function() { setHov(false); }}
    onClick={function() { if (item.url) window.open(item.url, "_blank", "noopener,noreferrer"); }}
    style={{ width: 240, minWidth: 240, height: 180, background: hov ? D.hover : D.card, border: "1px solid " + (hov ? c + "40" : D.border), borderRadius: 12, overflow: "hidden", cursor: item.url ? "pointer" : "default", transition: "all 0.2s ease", transform: hov ? "translateY(-2px)" : "translateY(0)", boxShadow: hov ? "0 8px 24px rgba(0,0,0,0.4)" : "none", flexShrink: 0, display: "flex", flexDirection: "column" }}
  >
    {/* Color strip */}
    <div style={{ height: 3, background: c, flexShrink: 0 }} />
    {/* Body */}
    <div style={{ padding: "12px 14px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <div>
        {/* Title */}
        <div style={{ fontFamily: ft, fontSize: 13, fontWeight: 700, color: D.tx, lineHeight: 1.4, marginBottom: 10, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.title}</div>
        {/* Tags */}
        {item.tags && item.tags.length > 0 && <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
          {item.tags.slice(0, 2).map(function(tag: string, i: number) {
            return <span key={i} style={{ fontFamily: mn, fontSize: 9, color: D.txm, padding: "2px 7px", borderRadius: 8, background: D.surface, border: "1px solid " + D.border }}>{tag}</span>;
          })}
        </div>}
      </div>
      {/* Bottom: metric + time */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: mn, fontSize: 10, fontWeight: 700, color: c, padding: "2px 8px", borderRadius: 6, background: c + "15" }}>{item.metric}</span>
        {ta && <span style={{ fontFamily: mn, fontSize: 9, color: D.txd }}>{ta}</span>}
      </div>
    </div>
  </div>;
}

// ═══ MANUAL TREND CARD ═══
function ManualTrendCard({ trend, onRemove }: { trend: ManualTrend; onRemove: () => void }) {
  var _hov = useState(false), hov = _hov[0], setHov = _hov[1];
  var pc = PLATFORMS_MANUAL[trend.platform as keyof typeof PLATFORMS_MANUAL];
  var c = pc ? pc.color : D.amber;
  return <div
    onMouseEnter={function() { setHov(true); }}
    onMouseLeave={function() { setHov(false); }}
    style={{ width: 240, minWidth: 240, height: 180, background: hov ? D.hover : D.card, border: "1px solid " + (hov ? c + "40" : D.border), borderRadius: 12, overflow: "hidden", transition: "all 0.2s ease", transform: hov ? "translateY(-2px)" : "translateY(0)", boxShadow: hov ? "0 8px 24px rgba(0,0,0,0.4)" : "none", flexShrink: 0, display: "flex", flexDirection: "column" }}
  >
    <div style={{ height: 3, background: c, flexShrink: 0 }} />
    <div style={{ padding: "12px 14px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <span style={{ fontFamily: mn, fontSize: 8, color: c, padding: "2px 6px", borderRadius: 8, background: c + "15", border: "1px solid " + c + "30" }}>Manual</span>
          <span style={{ fontFamily: mn, fontSize: 8, color: D.txd }}>{pc ? pc.name : trend.platform}</span>
        </div>
        <div style={{ fontFamily: ft, fontSize: 12, fontWeight: 600, color: D.tx, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{trend.saAngle || truncText(trend.url, 50)}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {trend.sentiment && <span style={{ fontFamily: mn, fontSize: 8, color: D.cyan, padding: "2px 6px", borderRadius: 6, background: D.cyan + "12" }}>{trend.sentiment}</span>}
          {trend.audience && <span style={{ fontFamily: mn, fontSize: 8, color: D.violet, padding: "2px 6px", borderRadius: 6, background: D.violet + "12" }}>{trend.audience}</span>}
        </div>
        <span onClick={function(e) { e.stopPropagation(); onRemove(); }} style={{ fontFamily: mn, fontSize: 9, color: D.coral, cursor: "pointer", userSelect: "none" }}>Remove</span>
      </div>
    </div>
  </div>;
}

// ═══ HORIZONTAL SCROLL ROW ═══
function HScrollRow({ label, icon, sourceKey, items, color }: { label: string; icon: string; sourceKey: string; items: (TrendItem | (ManualTrend & { _onRemove?: () => void }))[]; color?: string }) {
  var c = color || srcColor(sourceKey);
  if (!items || items.length === 0) return null;
  return <div style={{ marginBottom: 28 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, paddingLeft: 2 }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: D.tx }}>{label}</span>
      <span style={{ width: 6, height: 6, borderRadius: 3, background: c, flexShrink: 0 }} />
      <span style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>({items.length})</span>
    </div>
    <div className="hscroll-row" style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4, paddingLeft: 2, paddingRight: 12 }}>
      {items.map(function(item: TrendItem | ManualTrend, i: number) {
        if ("_manual" in item && item._manual) return <ManualTrendCard key={"m-" + item.id} trend={item as ManualTrend} onRemove={(item as ManualTrend)._onRemove || function(){}} />;
        return <TrendCard key={sourceKey + "-" + i} item={item as TrendItem} sourceKey={sourceKey} />;
      })}
    </div>
  </div>;
}

// ═══ PILL COMPONENT ═══
function Pill({ label, active, onClick, color }: { label: string; active: boolean; onClick: () => void; color?: string }) {
  var bg = active ? (color || D.blue) + "25" : "transparent";
  var bc = active ? (color || D.blue) : D.border;
  var tx = active ? (color || D.blue) : D.txm;
  return <span onClick={onClick} style={{ fontFamily: mn, fontSize: 10, color: tx, padding: "3px 10px", borderRadius: 20, border: "1px solid " + bc, background: bg, cursor: "pointer", userSelect: "none", transition: "all 0.15s ease", whiteSpace: "nowrap" }}>{label}</span>;
}

// ═══ WIZARD OVERLAY ═══
function WizardOverlay({ visible, onClose, feedData }: { visible: boolean; onClose: () => void; feedData: FeedSource[] }) {
  var _contentType = useState(""), contentType = _contentType[0], setContentType = _contentType[1];
  var _topic = useState(""), topic = _topic[0], setTopic = _topic[1];
  var _ideas = useState<ContentIdea[] | null>(null), ideas = _ideas[0], setIdeas = _ideas[1];
  var _loading = useState(false), loading = _loading[0], setLoading = _loading[1];
  var _error = useState(""), error = _error[0], setError = _error[1];

  function reset() { setContentType(""); setTopic(""); setIdeas(null); setError(""); }
  function handleClose() { reset(); onClose(); }

  function generate() {
    if (!contentType || !topic) { addToast("Select both content type and topic", "error"); return; }
    setLoading(true); setError(""); setIdeas(null);
    var trendSummary = "";
    if (feedData && feedData.length > 0) {
      feedData.forEach(function(src: FeedSource) {
        if (src.items && src.items.length > 0) {
          trendSummary += "\n[" + src.source.toUpperCase() + "]\n";
          src.items.slice(0, 5).forEach(function(item: TrendItem) { trendSummary += "- " + item.title + " (" + item.metric + ")\n"; });
        }
      });
    }
    var systemPrompt = "You are a content strategist specializing in viral social media content. You have deep knowledge of content trends, engagement patterns, and platform algorithms. Given current trending topics and the user's preferences, suggest exactly 5 content ideas. Each idea must reference a specific current trend from the data provided. Respond ONLY with valid JSON in this exact format: {\"ideas\":[{\"title\":\"...\",\"hook\":\"...\",\"format\":\"...\",\"trendReference\":\"...\"}]} where title is a punchy content title, hook is the opening line or concept hook, format is a specific format recommendation (length, style, platform tips), and trendReference names which trend from the data it builds on.";
    var userPrompt = "Current trending data:\n" + trendSummary + "\n\nI want to create: " + contentType + "\nTopic area: " + topic + "\n\nGive me 5 content ideas based on these current trends.";
    fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system: systemPrompt, prompt: userPrompt }) })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        setLoading(false);
        if (data.error) { setError(data.error.message || data.error); return; }
        var text = ""; if (data.content && data.content[0]) text = data.content[0].text || "";
        try { var jsonMatch = text.match(/\{[\s\S]*\}/); if (jsonMatch) { var parsed = JSON.parse(jsonMatch[0]); setIdeas(parsed.ideas || []); } else { setError("Could not parse response"); } } catch(e) { setError("Failed to parse AI response"); }
      }).catch(function(e) { setLoading(false); setError(e.message || "Network error"); });
  }

  function sendIdea(idea: ContentIdea, dest: string) { addToast("Sent \"" + truncText(idea.title, 30) + "\" to " + dest, "success"); }

  if (!visible) return null;
  return <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(0,0,0,0.85)", animation: "overlayIn 0.2s ease", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
    <div style={{ background: D.bg, border: "1px solid " + D.border, borderRadius: 16, width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto", padding: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: ft, fontSize: 20, fontWeight: 800, color: D.amber }}>Content Wizard</div>
          <div style={{ fontFamily: mn, fontSize: 9, color: D.txm, marginTop: 2 }}>AI-powered trend-based content ideation</div>
        </div>
        <span onClick={handleClose} style={{ fontFamily: mn, fontSize: 18, color: D.txm, cursor: "pointer", userSelect: "none", padding: "4px 8px", borderRadius: 6, background: D.surface, border: "1px solid " + D.border, transition: "all 0.15s", lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32 }}>x</span>
      </div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: mn, fontSize: 9, color: D.txm, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>What type of content?</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {CONTENT_FORMATS.map(function(f) { return <Pill key={f} label={f} active={contentType === f} onClick={function() { setContentType(contentType === f ? "" : f); }} color={D.amber} />; })}
        </div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: mn, fontSize: 9, color: D.txm, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Topic area?</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {TOPIC_AREAS.map(function(t) { return <Pill key={t} label={t} active={topic === t} onClick={function() { setTopic(topic === t ? "" : t); }} color={D.blue} />; })}
        </div>
      </div>
      <div onClick={loading ? undefined : generate} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: ft, fontSize: 13, fontWeight: 700, color: "#fff", padding: "10px 24px", borderRadius: 8, background: loading ? D.txd : D.amber, cursor: loading ? "default" : "pointer", userSelect: "none", marginBottom: 20, opacity: loading ? 0.6 : 1, transition: "all 0.15s ease" }}>
        {loading ? "Generating..." : "Generate Ideas"}
      </div>
      {error && <div style={{ fontFamily: mn, fontSize: 11, color: D.coral, marginBottom: 16, padding: "8px 12px", background: D.coral + "10", borderRadius: 6, border: "1px solid " + D.coral + "30" }}>{error}</div>}
      {ideas && ideas.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {ideas.map(function(idea: ContentIdea, i: number) {
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
function ManualAddForm({ onAdd, onClose }: { onAdd: (entry: Omit<ManualTrend, "id" | "_manual">) => void; onClose: () => void }) {
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

  function InputField({ label, value, onChange, placeholder, mono }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) {
    return <div style={{ marginBottom: 10 }}>
      <div style={{ fontFamily: mn, fontSize: 9, color: D.txm, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      <input value={value} onChange={function(e) { onChange(e.target.value); }} placeholder={placeholder || ""} style={{ width: "100%", background: D.surface, border: "1px solid " + D.border, borderRadius: 6, padding: "8px 10px", color: D.tx, fontFamily: mono ? mn : ft, fontSize: 12, outline: "none", boxSizing: "border-box" }} />
    </div>;
  }

  return <div style={{ position: "fixed", inset: 0, zIndex: 8500, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "overlayIn 0.2s ease" }}>
    <div style={{ background: D.bg, border: "1px solid " + D.border, borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "85vh", overflowY: "auto", padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontFamily: ft, fontSize: 16, fontWeight: 700, color: D.tx }}>Add Manual Trend</div>
        <span onClick={onClose} style={{ fontFamily: mn, fontSize: 14, color: D.txm, cursor: "pointer", userSelect: "none", borderRadius: 6, background: D.surface, border: "1px solid " + D.border, transition: "all 0.15s", lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28 }}>x</span>
      </div>
      <InputField label="URL" value={url} onChange={setUrl} placeholder="https://..." mono />
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontFamily: mn, fontSize: 9, color: D.txm, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>PLATFORM</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Object.keys(PLATFORMS_MANUAL).map(function(pk) {
            var p = PLATFORMS_MANUAL[pk as keyof typeof PLATFORMS_MANUAL]; var active = platform === pk;
            return <span key={pk} onClick={function() { setPlatform(pk); }} style={{ fontFamily: mn, fontSize: 10, color: active ? "#fff" : D.txm, padding: "5px 12px", borderRadius: 6, border: "1px solid " + (active ? p.color : D.border), background: active ? p.color + "30" : "transparent", cursor: "pointer", userSelect: "none" }}>{p.name}</span>;
          })}
        </div>
      </div>
      <InputField label="FORMAT" value={format} onChange={setFormat} placeholder="Hook structure, length, pacing" />
      <InputField label="AUDIO" value={audio} onChange={setAudio} placeholder="Trending sound name" />
      <InputField label="VISUAL" value={visual} onChange={setVisual} placeholder="Color grade, text placement" />
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontFamily: mn, fontSize: 9, color: D.txm, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>SENTIMENT</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{SENTIMENTS.map(function(s) { return <Pill key={s} label={s} active={sentiment === s} onClick={function() { setSentiment(sentiment === s ? "" : s); }} />; })}</div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontFamily: mn, fontSize: 9, color: D.txm, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>AUDIENCE</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{AUDIENCES.map(function(a) { return <Pill key={a} label={a} active={audience === a} onClick={function() { setAudience(audience === a ? "" : a); }} />; })}</div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontFamily: mn, fontSize: 9, color: D.txm, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>RELEVANCE</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input type="range" min={0} max={10} value={relevance} onChange={function(e) { setRelevance(Number(e.target.value)); }} style={{ flex: 1, accentColor: D.blue }} />
          <span style={{ fontFamily: mn, fontSize: 14, fontWeight: 700, color: relevance <= 3 ? D.coral : relevance <= 6 ? D.amber : D.teal }}>{relevance}</span>
        </div>
      </div>
      <InputField label="SA ANGLE" value={saAngle} onChange={setSaAngle} placeholder="How would SA use this?" />
      <div onClick={handleSubmit} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: ft, fontSize: 12, fontWeight: 700, color: "#fff", padding: "10px 24px", borderRadius: 8, background: D.blue, marginTop: 4, cursor: "pointer", userSelect: "none" }}>Add Trend</div>
    </div>
  </div>;
}

// ═══ MAIN COMPONENT ═══
export default function Trends() {
  var _tab = useState("social"), tab = _tab[0], setTab = _tab[1];
  var _feedData = useState<FeedSource[]>([]), feedData = _feedData[0], setFeedData = _feedData[1];
  var _manualTrends = useState<ManualTrend[]>([]), manualTrends = _manualTrends[0], setManualTrends = _manualTrends[1];
  var _loading = useState(true), loading = _loading[0], setLoading = _loading[1];
  var _lastUpdated = useState<number | null>(null), lastUpdated = _lastUpdated[0], setLastUpdated = _lastUpdated[1];
  var _wizardOpen = useState(false), wizardOpen = _wizardOpen[0], setWizardOpen = _wizardOpen[1];
  var _addFormOpen = useState(false), addFormOpen = _addFormOpen[0], setAddFormOpen = _addFormOpen[1];

  // ═══ FETCH ═══
  function fetchFeed() {
    setLoading(true);
    fetch("/api/trends-feed?source=all").then(function(r) { return r.json(); }).then(function(data) {
      if (data.sources) { var valid = data.sources.filter(function(s: FeedSource) { return s.items && !s.error; }); setFeedData(valid); }
      setLastUpdated(Date.now());
      setLoading(false);
    }).catch(function() { setLoading(false); addToast("Failed to load trends feed", "error"); });
  }
  function fetchManual() {
    fetch("/api/db?table=trends").then(function(r) { return r.json(); }).then(function(res) {
      if (res.data && res.data.length > 0) setManualTrends(res.data.map(fromDbRow));
    }).catch(function() {});
  }
  useEffect(function() { fetchFeed(); fetchManual(); }, []);

  // ═══ MANUAL CRUD ═══
  function handleManualAdd(entry: Omit<ManualTrend, "id" | "_manual">) {
    var fullEntry = Object.assign({}, entry, { id: makeId(), _manual: true as const });
    fetch("/api/db", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ table: "trends", data: toDbRow(fullEntry) }) })
      .then(function(r) { return r.json(); })
      .then(function(res) {
        if (res.data && res.data[0]) setManualTrends(function(p) { return [fromDbRow(res.data[0])].concat(p); });
        else setManualTrends(function(p) { return [fullEntry].concat(p); });
      })
      .catch(function() { setManualTrends(function(p) { return [fullEntry].concat(p); }); });
    addToast("Manual trend added", "success");
  }
  function handleManualRemove(id: string) {
    fetch("/api/db", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ table: "trends", id: id }) }).catch(function() {});
    setManualTrends(function(p) { return p.filter(function(t) { return t.id !== id; }); });
    addToast("Manual trend removed", "info");
  }

  // ═══ DATA GROUPING ═══
  function getSourceItems(key: string) {
    var src = feedData.find(function(s) { return s.source === key; });
    return src ? src.items : [];
  }
  function getManualForTab(tabKey: string) {
    return manualTrends.filter(function(t) {
      var pm = PLATFORMS_MANUAL[t.platform as keyof typeof PLATFORMS_MANUAL];
      var mtab = pm ? pm.tab : "social";
      return mtab === tabKey;
    }).map(function(t) {
      return Object.assign({}, t, { _onRemove: function() { handleManualRemove(t.id); } });
    });
  }

  // ═══ LAST UPDATED TEXT ═══
  var updatedText = "";
  if (lastUpdated) {
    var diffMins = Math.floor((Date.now() - lastUpdated) / 60000);
    updatedText = diffMins < 1 ? "Updated just now" : "Updated " + diffMins + "m ago";
  }

  // ═══ RENDER ROWS FOR ACTIVE TAB ═══
  function renderTabContent() {
    var sources = TAB_SOURCES[tab as keyof typeof TAB_SOURCES] || [];
    var manualForTab = getManualForTab(tab);
    var hasAny = false;

    var rows = sources.map(function(srcKey: string) {
      var meta = SOURCE_META[srcKey as keyof typeof SOURCE_META];
      var items = getSourceItems(srcKey);
      if (items.length > 0) hasAny = true;
      if (!meta) return null;
      return <HScrollRow key={srcKey} label={meta.label} icon={meta.icon} sourceKey={srcKey} items={items} color={meta.color} />;
    });

    if (manualForTab.length > 0) {
      hasAny = true;
      rows.push(<HScrollRow key="manual" label="Manual Trends" icon="\u270D" sourceKey="manual" items={manualForTab} color={D.amber} />);
    }

    if (!hasAny && !loading) {
      return <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 12, padding: "48px 24px", textAlign: "center", marginTop: 8 }}>
        <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.3 }}>&#128225;</div>
        <div style={{ fontFamily: ft, fontSize: 14, color: D.txm, marginBottom: 6 }}>No data for this tab yet</div>
        <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, lineHeight: 1.6 }}>API keys may not be configured, or sources have not returned data.<br />Try refreshing or add trends manually with the + button.</div>
      </div>;
    }

    return <div>{rows}</div>;
  }

  return <div style={{ minHeight: "100vh", background: D.bg, color: D.tx, fontFamily: ft, position: "relative" }}>
    {/* Global scrollbar-hiding styles + animations */}
    <style dangerouslySetInnerHTML={{ __html: ".hscroll-row::-webkit-scrollbar{display:none}.hscroll-row{-ms-overflow-style:none;scrollbar-width:none}@keyframes toastIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes toastDrain{from{width:100%}to{width:0}}@keyframes wizGlow{0%,100%{box-shadow:0 0 16px rgba(247,176,65,0.4)}50%{box-shadow:0 0 28px rgba(247,176,65,0.7)}}@keyframes overlayIn{from{opacity:0}to{opacity:1}}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}" }} />
    <ToastContainer />

    <div style={{ padding: "32px 24px 0 24px" }}>
      {/* ═══ HEADER ═══ */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 900, fontFamily: ft, color: D.tx, letterSpacing: -0.5 }}>Trends</div>
          <div style={{ fontFamily: mn, fontSize: 10, color: D.txm, marginTop: 4 }}>TrendPulse // Real-time content intelligence</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {updatedText && <span style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>{updatedText}</span>}
          <span onClick={function() { fetchFeed(); addToast("Refreshing trends...", "info"); }} style={{ fontFamily: mn, fontSize: 10, fontWeight: 600, color: D.blue, padding: "6px 14px", borderRadius: 8, border: "1px solid " + D.blue + "40", background: D.blue + "10", cursor: "pointer", userSelect: "none", transition: "all 0.15s ease" }}>Refresh</span>
          {/* + Add button */}
          <span onClick={function() { setAddFormOpen(true); }} style={{ fontFamily: mn, fontSize: 16, fontWeight: 700, color: D.blue, width: 32, height: 32, borderRadius: 8, border: "1px solid " + D.blue + "40", background: D.blue + "10", cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s ease" }}>+</span>
        </div>
      </div>

      {/* ═══ TABS ═══ */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid " + D.border, marginBottom: 24 }}>
        {TABS.map(function(t) {
          var active = tab === t.key;
          return <div key={t.key} onClick={function() { setTab(t.key); }} style={{ fontFamily: ft, fontSize: 13, fontWeight: active ? 700 : 500, color: active ? D.tx : D.txm, padding: "10px 20px", cursor: "pointer", userSelect: "none", borderBottom: active ? "2px solid " + D.blue : "2px solid transparent", transition: "all 0.15s ease", marginBottom: -1 }}>{t.label}</div>;
        })}
      </div>
    </div>

    {/* ═══ CONTENT ═══ */}
    <div style={{ padding: "0 24px 120px 24px" }}>
      {loading && <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: 10 }}>
        <div style={{ width: 16, height: 16, border: "2px solid " + D.blue + "40", borderTopColor: D.blue, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <span style={{ fontFamily: mn, fontSize: 11, color: D.txd }}>Loading trends feed...</span>
      </div>}
      {!loading && renderTabContent()}
    </div>

    {/* ═══ WIZARD FLOATING BUTTON ═══ */}
    <div onClick={function() { setWizardOpen(true); }} style={{ position: "fixed", bottom: 28, right: 28, width: 56, height: 56, borderRadius: 28, background: D.amber, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", userSelect: "none", animation: "wizGlow 2s ease-in-out infinite", zIndex: 8000, transition: "transform 0.15s ease" }} title="Content Wizard">
      <span style={{ fontFamily: ft, fontSize: 20, fontWeight: 900, color: D.bg }}>W</span>
    </div>

    {/* ═══ OVERLAYS ═══ */}
    <WizardOverlay visible={wizardOpen} onClose={function() { setWizardOpen(false); }} feedData={feedData} />
    {addFormOpen && <ManualAddForm onAdd={handleManualAdd} onClose={function() { setAddFormOpen(false); }} />}
  </div>;
}
