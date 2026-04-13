// @ts-nocheck
"use client";
import { useState, useEffect, useRef, useCallback } from "react";

// ═══ THEME (non-SA, dark glow aesthetic) ═══
var T = {
  bg: "#06060E", card: "#0C0C18", border: "#161625", surface: "#101020",
  accent: "#7C5CFC", accent2: "#00D4AA", accent3: "#FF6B6B", accent4: "#3B9EFF",
  tx: "#E8E6F0", txm: "#8B88A0", txd: "#4A4860",
  glow: "0 0 20px rgba(124,92,252,0.08), 0 0 40px rgba(124,92,252,0.04)",
  glowAccent: "0 0 30px rgba(124,92,252,0.15)",
  green: "#00D4AA", red: "#FF6B6B",
};
var ft = "'Outfit',sans-serif";
var mn = "'JetBrains Mono',monospace";

// ═══ WIDGET CONFIG ═══
var DEFAULT_WIDGETS = [
  { id: "news", label: "News Feed", icon: "\uD83D\uDCF0", enabled: true, size: "large" },
  { id: "semianalysis", label: "SemiAnalysis", icon: "\uD83D\uDD2C", enabled: true, size: "medium" },
  { id: "stocks", label: "Stock Ticker", icon: "\uD83D\uDCC8", enabled: true, size: "medium" },
  { id: "tbpn", label: "TBPN Live", icon: "\uD83D\uDCFA", enabled: true, size: "medium" },
  { id: "notes", label: "Notes", icon: "\uD83D\uDCDD", enabled: true, size: "medium" },
  { id: "ideas", label: "AI Ideas", icon: "\uD83D\uDCA1", enabled: true, size: "medium" },
];

// ═══ WIDGET WRAPPER ═══
function Widget({ title, icon, children, size, expanded, onToggleExpand, onAction, actionLabel }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, " + T.card + " 0%, " + T.surface + " 100%)",
      border: "1px solid " + T.border,
      borderRadius: 12,
      padding: 0,
      boxShadow: T.glow,
      gridColumn: expanded ? "1 / -1" : size === "large" ? "span 2" : "span 1",
      gridRow: expanded ? "span 2" : "auto",
      display: "flex",
      flexDirection: "column",
      maxHeight: expanded ? "none" : 520,
      transition: "all 0.3s ease",
      overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", borderBottom: "1px solid " + T.border,
        background: "linear-gradient(90deg, " + T.accent + "08, transparent)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>{icon}</span>
          <span style={{ fontFamily: ft, fontSize: 12, fontWeight: 700, color: T.tx, letterSpacing: 0.5 }}>{title}</span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {actionLabel && onAction && <span onClick={onAction} style={{ fontFamily: mn, fontSize: 9, color: T.accent, cursor: "pointer", padding: "3px 8px", borderRadius: 4, border: "1px solid " + T.accent + "30", background: T.accent + "10" }}>{actionLabel}</span>}
          <span onClick={onToggleExpand} style={{ fontFamily: mn, fontSize: 9, color: T.txd, cursor: "pointer", padding: "3px 6px", borderRadius: 3, border: "1px solid " + T.border }}>{expanded ? "\u25F4" : "\u25F0"}</span>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "12px 16px" }}>
        {children}
      </div>
    </div>
  );
}

// ═══ NEWS FEED WIDGET ═══
function NewsFeed({ expanded, onToggleExpand, onDraft }) {
  var _items = useState([]), items = _items[0], setItems = _items[1];
  var _loading = useState(true), loading = _loading[0], setLoading = _loading[1];

  var load = useCallback(function() {
    setLoading(true);
    fetch("/api/news").then(function(r) { return r.json(); }).then(function(d) {
      if (d.items) setItems(d.items);
      setLoading(false);
    }).catch(function() { setLoading(false); });
  }, []);

  useEffect(function() { load(); var iv = setInterval(load, 120000); return function() { clearInterval(iv); }; }, [load]);

  var sourceColor = function(s) {
    if (s === "SemiAnalysis") return T.accent;
    if (s === "Hacker News") return "#FF6600";
    if (s === "TechCrunch AI") return T.green;
    if (s === "The Verge AI") return T.accent4;
    return T.txm;
  };

  return (
    <Widget title="News Feed" icon={"\uD83D\uDCF0"} size="large" expanded={expanded} onToggleExpand={onToggleExpand} actionLabel="Refresh" onAction={load}>
      {loading && items.length === 0 ? <div style={{ color: T.txd, fontFamily: mn, fontSize: 11, padding: 20, textAlign: "center" }}>Loading feeds...</div>
      : items.map(function(item, i) {
        return <div key={i} style={{ padding: "10px 0", borderBottom: i < items.length - 1 ? "1px solid " + T.border : "none", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ fontFamily: ft, fontSize: 13, fontWeight: 600, color: T.tx, textDecoration: "none", lineHeight: 1.4, display: "block", marginBottom: 4 }}>{item.title}</a>
            {item.snippet && <div style={{ fontFamily: ft, fontSize: 11, color: T.txm, lineHeight: 1.5, marginBottom: 4 }}>{item.snippet.slice(0, 120)}...</div>}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontFamily: mn, fontSize: 9, color: sourceColor(item.source), padding: "1px 6px", borderRadius: 3, background: sourceColor(item.source) + "15" }}>{item.source}</span>
              {item.date && <span style={{ fontFamily: mn, fontSize: 9, color: T.txd }}>{new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>}
            </div>
          </div>
          <span onClick={function() { onDraft(item); }} style={{ fontFamily: mn, fontSize: 9, color: T.accent2, cursor: "pointer", padding: "4px 8px", borderRadius: 4, border: "1px solid " + T.accent2 + "30", background: T.accent2 + "08", flexShrink: 0, whiteSpace: "nowrap" }}>Draft</span>
        </div>;
      })}
    </Widget>
  );
}

// ═══ SEMIANALYSIS RSS WIDGET ═══
function SAFeed({ expanded, onToggleExpand, onDraft }) {
  var _items = useState([]), items = _items[0], setItems = _items[1];
  var _loading = useState(true), loading = _loading[0], setLoading = _loading[1];

  useEffect(function() {
    fetch("/api/news?type=semianalysis").then(function(r) { return r.json(); }).then(function(d) {
      if (d.items) setItems(d.items);
      setLoading(false);
    }).catch(function() { setLoading(false); });
  }, []);

  return (
    <Widget title="SemiAnalysis" icon={"\uD83D\uDD2C"} size="medium" expanded={expanded} onToggleExpand={onToggleExpand}>
      {loading ? <div style={{ color: T.txd, fontFamily: mn, fontSize: 11, padding: 20, textAlign: "center" }}>Loading...</div>
      : items.length === 0 ? <div style={{ color: T.txd, fontFamily: mn, fontSize: 11, padding: 20, textAlign: "center" }}>No articles found</div>
      : items.map(function(item, i) {
        return <div key={i} style={{ padding: "8px 0", borderBottom: i < items.length - 1 ? "1px solid " + T.border : "none" }}>
          <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ fontFamily: ft, fontSize: 12, fontWeight: 600, color: T.accent, textDecoration: "none", lineHeight: 1.4, display: "block", marginBottom: 3 }}>{item.title}</a>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {item.date && <span style={{ fontFamily: mn, fontSize: 9, color: T.txd }}>{new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>}
            <span onClick={function() { onDraft(item); }} style={{ fontFamily: mn, fontSize: 9, color: T.accent2, cursor: "pointer" }}>Draft</span>
          </div>
        </div>;
      })}
    </Widget>
  );
}

// ═══ STOCK TICKER WIDGET ═══
function StockTicker({ expanded, onToggleExpand }) {
  var _stocks = useState([]), stocks = _stocks[0], setStocks = _stocks[1];
  var _view = useState("ticker"), view = _view[0], setView = _view[1];
  var _loading = useState(true), loading = _loading[0], setLoading = _loading[1];
  var tickerRef = useRef(null);

  var load = useCallback(function() {
    fetch("/api/news?type=stocks").then(function(r) { return r.json(); }).then(function(d) {
      if (d.stocks) setStocks(d.stocks);
      setLoading(false);
    }).catch(function() { setLoading(false); });
  }, []);

  useEffect(function() { load(); var iv = setInterval(load, 30000); return function() { clearInterval(iv); }; }, [load]);

  return (
    <Widget title="Stock Ticker" icon={"\uD83D\uDCC8"} size="medium" expanded={expanded} onToggleExpand={onToggleExpand} actionLabel={view === "ticker" ? "Grid" : "Ticker"} onAction={function() { setView(view === "ticker" ? "grid" : "ticker"); }}>
      {loading && stocks.length === 0 ? <div style={{ color: T.txd, fontFamily: mn, fontSize: 11, padding: 20, textAlign: "center" }}>Loading stocks...</div>
      : view === "ticker" ? (
        <div style={{ overflow: "hidden", position: "relative" }}>
          <style dangerouslySetInnerHTML={{ __html: "@keyframes stockScroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}" }} />
          <div style={{ display: "flex", gap: 24, animation: "stockScroll 40s linear infinite", whiteSpace: "nowrap", width: "max-content" }}>
            {stocks.concat(stocks).map(function(s, i) {
              var up = s.change >= 0;
              return <div key={i} style={{ display: "inline-flex", gap: 8, alignItems: "center", padding: "6px 0" }}>
                <span style={{ fontFamily: mn, fontSize: 11, fontWeight: 700, color: T.tx }}>{s.symbol}</span>
                <span style={{ fontFamily: mn, fontSize: 11, color: T.tx }}>${s.price.toFixed(2)}</span>
                <span style={{ fontFamily: mn, fontSize: 10, color: up ? T.green : T.red }}>{up ? "\u25B2" : "\u25BC"} {Math.abs(s.changePct).toFixed(2)}%</span>
              </div>;
            })}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
          {stocks.map(function(s, i) {
            var up = s.change >= 0;
            return <div key={i} style={{ padding: "8px 10px", borderRadius: 6, background: up ? T.green + "08" : T.red + "08", border: "1px solid " + (up ? T.green : T.red) + "20" }}>
              <div style={{ fontFamily: mn, fontSize: 10, fontWeight: 700, color: T.tx, marginBottom: 2 }}>{s.symbol}</div>
              <div style={{ fontFamily: mn, fontSize: 13, fontWeight: 700, color: T.tx }}>${s.price.toFixed(2)}</div>
              <div style={{ fontFamily: mn, fontSize: 10, color: up ? T.green : T.red }}>{up ? "+" : ""}{s.changePct.toFixed(2)}%</div>
            </div>;
          })}
        </div>
      )}
    </Widget>
  );
}

// ═══ TBPN LIVE WIDGET ═══
function TBPNLive({ expanded, onToggleExpand }) {
  return (
    <Widget title="TBPN Live" icon={"\uD83D\uDCFA"} size="medium" expanded={expanded} onToggleExpand={onToggleExpand}>
      <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: 8, overflow: "hidden", background: T.surface }}>
        <iframe src="https://www.youtube.com/@TBPN/live" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }} allow="autoplay; encrypted-media" allowFullScreen />
      </div>
      <div style={{ fontFamily: mn, fontSize: 9, color: T.txd, marginTop: 8, textAlign: "center" }}>
        <a href="https://www.youtube.com/@TBPN/live" target="_blank" rel="noopener noreferrer" style={{ color: T.accent4, textDecoration: "none" }}>Open in new tab</a>
      </div>
    </Widget>
  );
}

// ═══ NOTES WIDGET ═══
function NotesWidget({ expanded, onToggleExpand }) {
  var _notes = useState(""), notes = _notes[0], setNotes = _notes[1];
  var _saved = useState(false), saved = _saved[0], setSaved = _saved[1];

  useEffect(function() {
    try { var s = localStorage.getItem("poast-notes"); if (s) setNotes(s); } catch (e) {}
  }, []);

  var save = function(v) {
    setNotes(v);
    try { localStorage.setItem("poast-notes", v); } catch (e) {}
    setSaved(true);
    setTimeout(function() { setSaved(false); }, 1000);
  };

  return (
    <Widget title="Notes" icon={"\uD83D\uDCDD"} size="medium" expanded={expanded} onToggleExpand={onToggleExpand} actionLabel={saved ? "Saved" : null}>
      <textarea value={notes} onChange={function(e) { save(e.target.value); }} placeholder="Quick notes, links, ideas..." style={{
        width: "100%", height: expanded ? 400 : 200, padding: 12, background: T.surface, border: "1px solid " + T.border,
        borderRadius: 8, color: T.tx, fontFamily: mn, fontSize: 12, outline: "none", boxSizing: "border-box",
        resize: "vertical", lineHeight: 1.7,
      }} />
    </Widget>
  );
}

// ═══ AI IDEAS WIDGET ═══
function AIIdeas({ expanded, onToggleExpand }) {
  var _topic = useState(""), topic = _topic[0], setTopic = _topic[1];
  var _ideas = useState([]), ideas = _ideas[0], setIdeas = _ideas[1];
  var _loading = useState(false), loading = _loading[0], setLoading = _loading[1];

  var generate = async function() {
    if (!topic.trim()) return;
    setLoading(true);
    try {
      var r = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: "You are a content strategist for SemiAnalysis, a semiconductor and AI infrastructure research firm. Generate content ideas. RESPOND ONLY IN VALID JSON. No markdown fences.",
          prompt: "Generate 5 content ideas based on this topic/article: " + topic + "\n\nFor each idea, suggest the best format (X thread, LinkedIn post, IG carousel, YouTube short, or full video recap).\n\nReturn JSON: {\"ideas\":[{\"title\":\"...\",\"format\":\"...\",\"hook\":\"one line hook\",\"angle\":\"why this matters now\"}]}"
        }),
      });
      var d = await r.json();
      var t = (d.content || []).map(function(c) { return c.text || ""; }).join("");
      var parsed = JSON.parse(t.replace(/```json|```/g, "").trim());
      if (parsed.ideas) setIdeas(parsed.ideas);
    } catch (e) { console.error("AI Ideas:", e); }
    setLoading(false);
  };

  var formatColor = function(f) {
    if (f.includes("X")) return "#1DA1F2";
    if (f.includes("LinkedIn")) return "#0A66C2";
    if (f.includes("IG") || f.includes("Instagram")) return "#E4405F";
    if (f.includes("YouTube") || f.includes("video")) return "#FF0000";
    return T.accent;
  };

  return (
    <Widget title="AI Ideas" icon={"\uD83D\uDCA1"} size="medium" expanded={expanded} onToggleExpand={onToggleExpand}>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <input value={topic} onChange={function(e) { setTopic(e.target.value); }} onKeyDown={function(e) { if (e.key === "Enter") generate(); }} placeholder="Paste article title, topic, or URL..." style={{
          flex: 1, padding: "8px 10px", background: T.surface, border: "1px solid " + T.border,
          borderRadius: 6, color: T.tx, fontFamily: mn, fontSize: 11, outline: "none",
        }} />
        <button onClick={generate} disabled={loading} style={{
          padding: "8px 14px", background: T.accent, color: "#fff", border: "none",
          borderRadius: 6, fontFamily: ft, fontSize: 11, fontWeight: 700, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.5 : 1,
        }}>{loading ? "..." : "Generate"}</button>
      </div>
      {ideas.map(function(idea, i) {
        return <div key={i} style={{ padding: "10px 12px", marginBottom: 6, background: T.surface, borderRadius: 6, border: "1px solid " + T.border }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
            <div style={{ fontFamily: ft, fontSize: 12, fontWeight: 600, color: T.tx, lineHeight: 1.4 }}>{idea.title}</div>
            <span style={{ fontFamily: mn, fontSize: 9, color: formatColor(idea.format), padding: "2px 6px", borderRadius: 3, background: formatColor(idea.format) + "15", flexShrink: 0, whiteSpace: "nowrap" }}>{idea.format}</span>
          </div>
          <div style={{ fontFamily: ft, fontSize: 11, color: T.accent2, marginBottom: 2 }}>{idea.hook}</div>
          <div style={{ fontFamily: ft, fontSize: 10, color: T.txm }}>{idea.angle}</div>
        </div>;
      })}
      {ideas.length === 0 && !loading && <div style={{ color: T.txd, fontFamily: mn, fontSize: 11, textAlign: "center", padding: 20 }}>Enter a topic and generate content ideas</div>}
    </Widget>
  );
}

// ═══ DRAFT MODAL ═══
function DraftModal({ item, onClose }) {
  var _type = useState("social"), type = _type[0], setType = _type[1];
  var _result = useState(""), result = _result[0], setResult = _result[1];
  var _loading = useState(false), loading = _loading[0], setLoading = _loading[1];

  var generate = async function() {
    setLoading(true);
    var prompt;
    if (type === "social") {
      prompt = "Draft a social media post about this article for X (no hashtags, hook format) and LinkedIn (3-5 sentences).\n\nTitle: " + item.title + "\nSource: " + item.source + "\nSnippet: " + (item.snippet || "") + "\n\nFormat as:\nX HOOK:\n[hook]\n\nLINKEDIN:\n[post]";
    } else if (type === "thread") {
      prompt = "Draft a 5-tweet X thread about this article. No hashtags. Each tweet should be its own point.\n\nTitle: " + item.title + "\nSource: " + item.source + "\nSnippet: " + (item.snippet || "") + "\n\nFormat as numbered tweets (1/5, 2/5, etc).";
    } else {
      prompt = "Write a 60-second video recap script for this article. Conversational, direct, no marketing language. Include a hook, 3 key points, and a CTA.\n\nTitle: " + item.title + "\nSource: " + item.source + "\nSnippet: " + (item.snippet || "");
    }
    try {
      var r = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: "You write content for SemiAnalysis. Never use em dashes. No emojis. Direct, informed, casual.", prompt: prompt }),
      });
      var d = await r.json();
      var t = (d.content || []).map(function(c) { return c.text || ""; }).join("");
      setResult(t);
    } catch (e) { setResult("Error generating draft."); }
    setLoading(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }} onClick={onClose}>
      <div onClick={function(e) { e.stopPropagation(); }} style={{ background: "linear-gradient(135deg, " + T.card + ", " + T.surface + ")", border: "1px solid " + T.accent + "30", borderRadius: 12, padding: 28, maxWidth: 600, width: "90%", maxHeight: "80vh", overflow: "auto", boxShadow: T.glowAccent }}>
        <div style={{ fontFamily: ft, fontSize: 16, fontWeight: 800, color: T.tx, marginBottom: 4 }}>{item.title}</div>
        <div style={{ fontFamily: mn, fontSize: 9, color: T.txm, marginBottom: 16 }}>{item.source} // Draft content from this article</div>

        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {[{ id: "social", l: "Social Post" }, { id: "thread", l: "X Thread" }, { id: "recap", l: "Video Recap" }].map(function(t) {
            var on = type === t.id;
            return <div key={t.id} onClick={function() { setType(t.id); setResult(""); }} style={{ padding: "6px 12px", borderRadius: 5, cursor: "pointer", background: on ? T.accent + "18" : T.surface, border: "1px solid " + (on ? T.accent : T.border), fontFamily: mn, fontSize: 10, color: on ? T.accent : T.txm }}>{t.l}</div>;
          })}
        </div>

        <button onClick={generate} disabled={loading} style={{ padding: "8px 20px", background: T.accent, color: "#fff", border: "none", borderRadius: 6, fontFamily: ft, fontSize: 12, fontWeight: 700, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.5 : 1, marginBottom: 14 }}>{loading ? "Generating..." : "Generate Draft"}</button>

        {result && <div style={{ padding: 14, background: T.surface, borderRadius: 8, border: "1px solid " + T.border }}>
          <pre style={{ fontFamily: ft, fontSize: 12, color: T.tx, lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0 }}>{result}</pre>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <span onClick={function() { navigator.clipboard.writeText(result); }} style={{ fontFamily: mn, fontSize: 9, color: T.accent, cursor: "pointer", padding: "4px 10px", borderRadius: 4, border: "1px solid " + T.accent + "30" }}>Copy</span>
          </div>
        </div>}

        <div style={{ textAlign: "right", marginTop: 16 }}>
          <span onClick={onClose} style={{ fontFamily: mn, fontSize: 10, color: T.txd, cursor: "pointer" }}>Close</span>
        </div>
      </div>
    </div>
  );
}

// ═══ SETTINGS PANEL ═══
function SettingsPanel({ widgets, setWidgets, onClose }) {
  var toggle = function(id) {
    setWidgets(function(prev) { return prev.map(function(w) { return w.id === id ? Object.assign({}, w, { enabled: !w.enabled }) : w; }); });
  };
  var moveUp = function(idx) {
    if (idx === 0) return;
    setWidgets(function(prev) { var a = prev.slice(); var t = a[idx]; a[idx] = a[idx - 1]; a[idx - 1] = t; return a; });
  };
  var moveDown = function(idx) {
    setWidgets(function(prev) { if (idx >= prev.length - 1) return prev; var a = prev.slice(); var t = a[idx]; a[idx] = a[idx + 1]; a[idx + 1] = t; return a; });
  };
  var cycleSize = function(id) {
    var sizes = ["small", "medium", "large"];
    setWidgets(function(prev) { return prev.map(function(w) {
      if (w.id !== id) return w;
      var ci = sizes.indexOf(w.size);
      return Object.assign({}, w, { size: sizes[(ci + 1) % sizes.length] });
    }); });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }} onClick={onClose}>
      <div onClick={function(e) { e.stopPropagation(); }} style={{ background: "linear-gradient(135deg, " + T.card + ", " + T.surface + ")", border: "1px solid " + T.accent + "30", borderRadius: 12, padding: 28, maxWidth: 440, width: "90%", boxShadow: T.glowAccent }}>
        <div style={{ fontFamily: ft, fontSize: 16, fontWeight: 800, color: T.tx, marginBottom: 4 }}>Dashboard Settings</div>
        <div style={{ fontFamily: mn, fontSize: 10, color: T.txm, marginBottom: 20 }}>Toggle, reorder, and resize widgets</div>

        {widgets.map(function(w, i) {
          return <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", marginBottom: 4, background: w.enabled ? T.surface : "transparent", borderRadius: 6, border: "1px solid " + (w.enabled ? T.border : "transparent") }}>
            <span style={{ fontSize: 14 }}>{w.icon}</span>
            <div style={{ flex: 1, fontFamily: ft, fontSize: 12, color: w.enabled ? T.tx : T.txd, fontWeight: 600 }}>{w.label}</div>
            <span onClick={function() { moveUp(i); }} style={{ fontFamily: mn, fontSize: 10, color: T.txd, cursor: "pointer", padding: "2px 4px" }}>{"\u25B2"}</span>
            <span onClick={function() { moveDown(i); }} style={{ fontFamily: mn, fontSize: 10, color: T.txd, cursor: "pointer", padding: "2px 4px" }}>{"\u25BC"}</span>
            <span onClick={function() { cycleSize(w.id); }} style={{ fontFamily: mn, fontSize: 9, color: T.accent, cursor: "pointer", padding: "2px 8px", borderRadius: 3, border: "1px solid " + T.accent + "30" }}>{w.size}</span>
            <span onClick={function() { toggle(w.id); }} style={{ width: 36, height: 20, borderRadius: 10, background: w.enabled ? T.accent : T.border, cursor: "pointer", position: "relative", display: "inline-block", transition: "background 0.2s" }}>
              <span style={{ position: "absolute", top: 2, left: w.enabled ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
            </span>
          </div>;
        })}

        <div style={{ textAlign: "right", marginTop: 16 }}>
          <span onClick={onClose} style={{ fontFamily: ft, fontSize: 12, fontWeight: 700, color: T.accent, cursor: "pointer" }}>Done</span>
        </div>
      </div>
    </div>
  );
}

// ═══ MAIN DASHBOARD ═══
export default function NewsFlow() {
  var _widgets = useState(DEFAULT_WIDGETS), widgets = _widgets[0], setWidgets = _widgets[1];
  var _showSettings = useState(false), showSettings = _showSettings[0], setShowSettings = _showSettings[1];
  var _expanded = useState(null), expanded = _expanded[0], setExpanded = _expanded[1];
  var _draftItem = useState(null), draftItem = _draftItem[0], setDraftItem = _draftItem[1];

  // Load widget config from localStorage
  useEffect(function() {
    try { var s = localStorage.getItem("poast-newsflow-widgets"); if (s) setWidgets(JSON.parse(s)); } catch (e) {}
  }, []);
  useEffect(function() {
    try { localStorage.setItem("poast-newsflow-widgets", JSON.stringify(widgets)); } catch (e) {}
  }, [widgets]);

  var toggleExpand = function(id) { setExpanded(expanded === id ? null : id); };
  var active = widgets.filter(function(w) { return w.enabled; });

  var renderWidget = function(w) {
    var isExpanded = expanded === w.id;
    var props = { expanded: isExpanded, onToggleExpand: function() { toggleExpand(w.id); } };
    if (w.id === "news") return <NewsFeed key={w.id} {...props} onDraft={setDraftItem} />;
    if (w.id === "semianalysis") return <SAFeed key={w.id} {...props} onDraft={setDraftItem} />;
    if (w.id === "stocks") return <StockTicker key={w.id} {...props} />;
    if (w.id === "tbpn") return <TBPNLive key={w.id} {...props} />;
    if (w.id === "notes") return <NotesWidget key={w.id} {...props} />;
    if (w.id === "ideas") return <AIIdeas key={w.id} {...props} />;
    return null;
  };

  return (
    <div style={{ position: "relative" }}>
      <style dangerouslySetInnerHTML={{ __html: "@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');" }} />
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: ft, fontSize: 22, fontWeight: 900, color: T.tx, letterSpacing: -0.5 }}>News Flow</div>
          <div style={{ fontFamily: mn, fontSize: 10, color: T.txm, marginTop: 2 }}>Live feeds, stocks, ideas. Click Draft on any article to start creating.</div>
        </div>
        <span onClick={function() { setShowSettings(true); }} style={{
          width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", background: T.surface, border: "1px solid " + T.border, fontSize: 16, color: T.txm,
          transition: "all 0.2s",
        }}>{"\u2699"}</span>
      </div>

      {/* Widget Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: 14,
      }}>
        {active.map(renderWidget)}
      </div>

      {/* Settings Modal */}
      {showSettings && <SettingsPanel widgets={widgets} setWidgets={setWidgets} onClose={function() { setShowSettings(false); }} />}

      {/* Draft Modal */}
      {draftItem && <DraftModal item={draftItem} onClose={function() { setDraftItem(null); }} />}
    </div>
  );
}
