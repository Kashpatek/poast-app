// @ts-nocheck
"use client";
import { useState, useEffect, useRef, useCallback } from "react";

// ═══ THEME (dark glow, non-SA) ═══
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

// ═══ WIDGET WRAPPER ═══
function W({ title, icon, children, expanded, onToggleExpand, actions, maxH }) {
  return (
    <div style={{ background: "linear-gradient(135deg, " + T.card + " 0%, " + T.surface + " 100%)", border: "1px solid " + T.border, borderRadius: 12, boxShadow: T.glow, display: "flex", flexDirection: "column", maxHeight: expanded ? "none" : maxH || 480, gridColumn: expanded ? "1 / -1" : undefined, transition: "all 0.3s ease", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid " + T.border, background: "linear-gradient(90deg, " + T.accent + "06, transparent)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 13 }}>{icon}</span>
          <span style={{ fontFamily: ft, fontSize: 11, fontWeight: 700, color: T.tx }}>{title}</span>
        </div>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          {actions}
          <span onClick={onToggleExpand} style={{ fontFamily: mn, fontSize: 9, color: T.txd, cursor: "pointer", padding: "2px 5px", borderRadius: 3, border: "1px solid " + T.border }}>{expanded ? "\u25F4" : "\u25F0"}</span>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "10px 14px" }}>{children}</div>
    </div>
  );
}

function SmBtn({ children, onClick, color, on }) {
  return <span onClick={onClick} style={{ fontFamily: mn, fontSize: 8, color: color || T.accent, cursor: "pointer", padding: "2px 7px", borderRadius: 3, border: "1px solid " + (color || T.accent) + (on ? "60" : "25"), background: on ? (color || T.accent) + "15" : "transparent" }}>{children}</span>;
}

// ═══ NEWS FEED ═══
function NewsFeed({ expanded, onToggle, onDraft }) {
  var _d = useState({ items: [], categories: [], sources: [] }), data = _d[0], setData = _d[1];
  var _cat = useState("All"), cat = _cat[0], setCat = _cat[1];
  var _src = useState("All"), src = _src[0], setSrc = _src[1];
  var _loading = useState(true), loading = _loading[0], setLoading = _loading[1];

  var load = useCallback(function() {
    var q = "?"; if (cat !== "All") q += "category=" + cat + "&"; if (src !== "All") q += "source=" + src;
    fetch("/api/news" + q).then(function(r) { return r.json(); }).then(function(d) { setData(d); setLoading(false); }).catch(function() { setLoading(false); });
  }, [cat, src]);

  useEffect(function() { load(); var iv = setInterval(load, 15000); return function() { clearInterval(iv); }; }, [load]);

  var sourceColor = { "SemiAnalysis": T.accent, "Hacker News": "#FF6600", "TechCrunch": T.green, "The Verge": T.accent4, "Bloomberg": "#5C068C", "CNBC Tech": "#005E9E", "Tom's Hardware": "#E63946", "VideoCardz": "#F4A300", "ServeTheHome": "#2196F3", "Reuters": "#FF8000", "Wired": "#000", "Ars Technica": "#FF4400", "Next Platform": "#00BCD4" };

  return (
    <W title="News Feed" icon={"\uD83D\uDCF0"} expanded={expanded} onToggleExpand={onToggle} maxH={560} actions={<SmBtn onClick={load}>Refresh</SmBtn>}>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
        <select value={cat} onChange={function(e) { setCat(e.target.value); }} style={{ padding: "3px 6px", background: T.surface, border: "1px solid " + T.border, borderRadius: 4, color: T.accent, fontFamily: mn, fontSize: 9 }}>
          <option value="All">All Topics</option>
          {(data.categories || []).map(function(c) { return <option key={c} value={c}>{c}</option>; })}
        </select>
        <select value={src} onChange={function(e) { setSrc(e.target.value); }} style={{ padding: "3px 6px", background: T.surface, border: "1px solid " + T.border, borderRadius: 4, color: T.accent2, fontFamily: mn, fontSize: 9 }}>
          <option value="All">All Sources</option>
          {(data.sources || []).map(function(s) { return <option key={s} value={s}>{s}</option>; })}
        </select>
      </div>
      {loading && data.items.length === 0 ? <div style={{ color: T.txd, fontFamily: mn, fontSize: 10, padding: 20, textAlign: "center" }}>Loading...</div>
      : data.items.map(function(item, i) {
        var sc = sourceColor[item.source] || T.txm;
        return <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid " + T.border, display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ fontFamily: ft, fontSize: 12, fontWeight: 600, color: T.tx, textDecoration: "none", lineHeight: 1.4, display: "block", marginBottom: 3 }}>{item.title}</a>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontFamily: mn, fontSize: 8, color: sc, padding: "1px 5px", borderRadius: 3, background: sc + "15" }}>{item.source}</span>
              <span style={{ fontFamily: mn, fontSize: 8, color: T.accent, padding: "1px 5px", borderRadius: 3, background: T.accent + "10" }}>{item.category}</span>
              {item.date && <span style={{ fontFamily: mn, fontSize: 8, color: T.txd }}>{new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>}
            </div>
          </div>
          <span onClick={function() { onDraft(item); }} style={{ fontFamily: mn, fontSize: 8, color: T.accent2, cursor: "pointer", padding: "3px 7px", borderRadius: 3, border: "1px solid " + T.accent2 + "25", flexShrink: 0, alignSelf: "center" }}>Draft</span>
        </div>;
      })}
    </W>
  );
}

// ═══ SEMIANALYSIS RSS ═══
function SAFeed({ expanded, onToggle, onDraft }) {
  var _items = useState([]), items = _items[0], setItems = _items[1];
  useEffect(function() {
    var load = function() { fetch("/api/news?type=semianalysis").then(function(r) { return r.json(); }).then(function(d) { if (d.items) setItems(d.items); }); };
    load(); var iv = setInterval(load, 30000); return function() { clearInterval(iv); };
  }, []);
  return (
    <W title="SemiAnalysis" icon={"\uD83D\uDD2C"} expanded={expanded} onToggleExpand={onToggle}>
      {items.length === 0 ? <div style={{ color: T.txd, fontFamily: mn, fontSize: 10, padding: 20, textAlign: "center" }}>Loading...</div>
      : items.map(function(item, i) {
        return <div key={i} style={{ padding: "7px 0", borderBottom: "1px solid " + T.border }}>
          <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ fontFamily: ft, fontSize: 11, fontWeight: 600, color: T.accent, textDecoration: "none", lineHeight: 1.4 }}>{item.title}</a>
          <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
            {item.date && <span style={{ fontFamily: mn, fontSize: 8, color: T.txd }}>{new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>}
            <span onClick={function() { onDraft(item); }} style={{ fontFamily: mn, fontSize: 8, color: T.accent2, cursor: "pointer" }}>Draft</span>
          </div>
        </div>;
      })}
    </W>
  );
}

// ═══ STOCK TICKER ═══
function StockTicker({ expanded, onToggle }) {
  var _stocks = useState([]), stocks = _stocks[0], setStocks = _stocks[1];
  var _view = useState("ticker"), view = _view[0], setView = _view[1];
  useEffect(function() {
    var load = function() { fetch("/api/news?type=stocks").then(function(r) { return r.json(); }).then(function(d) { if (d.stocks) setStocks(d.stocks); }); };
    load(); var iv = setInterval(load, 15000); return function() { clearInterval(iv); };
  }, []);
  return (
    <W title="Stocks" icon={"\uD83D\uDCC8"} expanded={expanded} onToggleExpand={onToggle} actions={<SmBtn onClick={function() { setView(view === "ticker" ? "grid" : "ticker"); }}>{view === "ticker" ? "Grid" : "Ticker"}</SmBtn>}>
      {stocks.length === 0 ? <div style={{ color: T.txd, fontFamily: mn, fontSize: 10, padding: 20, textAlign: "center" }}>Loading stocks...</div>
      : view === "ticker" ? (
        <div style={{ overflow: "hidden" }}>
          <style dangerouslySetInnerHTML={{ __html: "@keyframes stk{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}" }} />
          <div style={{ display: "flex", gap: 20, animation: "stk 35s linear infinite", whiteSpace: "nowrap" }}>
            {stocks.concat(stocks).map(function(s, i) {
              var up = s.change >= 0;
              return <div key={i} style={{ display: "inline-flex", gap: 6, alignItems: "center", padding: "4px 0" }}>
                <span style={{ fontFamily: mn, fontSize: 10, fontWeight: 700, color: T.tx }}>{s.symbol}</span>
                <span style={{ fontFamily: mn, fontSize: 10, color: T.tx }}>${s.price.toFixed(2)}</span>
                <span style={{ fontFamily: mn, fontSize: 9, color: up ? T.green : T.red }}>{up ? "\u25B2" : "\u25BC"}{Math.abs(s.changePct).toFixed(1)}%</span>
              </div>;
            })}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5 }}>
          {stocks.map(function(s, i) {
            var up = s.change >= 0;
            return <div key={i} style={{ padding: "6px 8px", borderRadius: 5, background: up ? T.green + "08" : T.red + "08", border: "1px solid " + (up ? T.green : T.red) + "18" }}>
              <div style={{ fontFamily: mn, fontSize: 9, fontWeight: 700, color: T.tx }}>{s.symbol}</div>
              <div style={{ fontFamily: mn, fontSize: 12, fontWeight: 700, color: T.tx }}>${s.price.toFixed(2)}</div>
              <div style={{ fontFamily: mn, fontSize: 9, color: up ? T.green : T.red }}>{up ? "+" : ""}{s.changePct.toFixed(2)}%</div>
            </div>;
          })}
        </div>
      )}
    </W>
  );
}

// ═══ EARNINGS CALENDAR ═══
function EarningsCalendar({ expanded, onToggle }) {
  var _earn = useState([]), earn = _earn[0], setEarn = _earn[1];
  useEffect(function() {
    fetch("/api/news?type=earnings").then(function(r) { return r.json(); }).then(function(d) { if (d.earnings) setEarn(d.earnings); });
  }, []);
  var now = new Date();
  return (
    <W title="Earnings Calendar" icon={"\uD83D\uDCC5"} expanded={expanded} onToggleExpand={onToggle}>
      {earn.map(function(e, i) {
        var d = new Date(e.date);
        var past = d < now;
        var days = Math.ceil((d.getTime() - now.getTime()) / 86400000);
        return <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid " + T.border, opacity: past ? 0.4 : 1 }}>
          <div style={{ fontFamily: mn, fontSize: 10, fontWeight: 700, color: T.accent, width: 44 }}>{e.symbol}</div>
          <div style={{ flex: 1, fontFamily: ft, fontSize: 11, color: T.tx }}>{e.name}</div>
          <div style={{ fontFamily: mn, fontSize: 9, color: T.txm }}>{d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} {e.time === "before" ? "BMO" : "AMC"}</div>
          {!past && <div style={{ fontFamily: mn, fontSize: 8, color: days <= 7 ? T.accent3 : T.txd }}>{days}d</div>}
        </div>;
      })}
    </W>
  );
}

// ═══ LIVE! STREAMS ═══
var STREAMS = [
  { id: "tbpn", name: "TBPN", url: "https://www.youtube.com/@TBPN/live", embed: "https://www.youtube.com/embed/live_stream?channel=UCvnE-DPONRhjNBMRqzNBMRg", schedule: "Weekdays 6AM-2PM ET", icon: "\uD83D\uDCFA" },
  { id: "bloomberg", name: "Bloomberg TV", url: "https://www.youtube.com/watch?v=dp8PhLsUcFE", embed: "https://www.youtube.com/embed/dp8PhLsUcFE", schedule: "24/7", icon: "\uD83D\uDCCA" },
  { id: "cnbc", name: "CNBC", url: "https://www.youtube.com/watch?v=9NyxcX3rhQs", embed: "https://www.youtube.com/embed/9NyxcX3rhQs", schedule: "Weekdays 5AM-7PM ET", icon: "\uD83D\uDCB0" },
  { id: "aljazeera", name: "Al Jazeera", url: "https://www.youtube.com/watch?v=F-POY4Q0QSI", embed: "https://www.youtube.com/embed/F-POY4Q0QSI", schedule: "24/7", icon: "\uD83C\uDF0D" },
  { id: "dw", name: "DW News", url: "https://www.youtube.com/watch?v=GE_SfNVNyqo", embed: "https://www.youtube.com/embed/GE_SfNVNyqo", schedule: "24/7", icon: "\uD83C\uDF10" },
  { id: "france24", name: "France 24", url: "https://www.youtube.com/watch?v=ULDJLFMzekc", embed: "https://www.youtube.com/embed/ULDJLFMzekc", schedule: "24/7", icon: "\uD83C\uDDEB\uD83C\uDDF7" },
];

function LiveStreams({ expanded, onToggle }) {
  var _active = useState(null), active = _active[0], setActive = _active[1];
  return (
    <W title="LIVE!" icon={"\uD83D\uDD34"} expanded={expanded} onToggleExpand={onToggle} maxH={expanded ? 800 : 480}>
      <style dangerouslySetInnerHTML={{ __html: "@keyframes liveBlink{0%,100%{opacity:1}50%{opacity:0.3}}" }} />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {STREAMS.map(function(s) {
          var on = active === s.id;
          return <div key={s.id} onClick={function() { setActive(on ? null : s.id); }} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6, cursor: "pointer", background: on ? T.accent3 + "15" : T.surface, border: "1px solid " + (on ? T.accent3 + "40" : T.border) }}>
            <span style={{ fontSize: 12 }}>{s.icon}</span>
            <span style={{ fontFamily: mn, fontSize: 9, color: on ? T.accent3 : T.txm, fontWeight: on ? 700 : 400 }}>{s.name}</span>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.accent3, animation: "liveBlink 1.5s ease-in-out infinite", opacity: on ? 1 : 0.3 }} />
          </div>;
        })}
      </div>
      {active ? (
        <div>
          <div style={{ position: "relative", paddingBottom: "56.25%", borderRadius: 8, overflow: "hidden", background: T.surface }}>
            <iframe src={STREAMS.find(function(s) { return s.id === active; }).embed + "?autoplay=1&mute=1"} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }} allow="autoplay; encrypted-media" allowFullScreen />
          </div>
          <div style={{ fontFamily: mn, fontSize: 8, color: T.txd, marginTop: 6, display: "flex", justifyContent: "space-between" }}>
            <span>{STREAMS.find(function(s) { return s.id === active; }).schedule}</span>
            <a href={STREAMS.find(function(s) { return s.id === active; }).url} target="_blank" rel="noopener noreferrer" style={{ color: T.accent4, textDecoration: "none" }}>Open in tab</a>
          </div>
        </div>
      ) : <div style={{ color: T.txd, fontFamily: mn, fontSize: 10, textAlign: "center", padding: 30 }}>Select a stream above</div>}
    </W>
  );
}

// ═══ NOTES ═══
function Notes({ expanded, onToggle }) {
  var _notes = useState(""), notes = _notes[0], setNotes = _notes[1];
  useEffect(function() { try { var s = localStorage.getItem("poast-notes"); if (s) setNotes(s); } catch (e) {} }, []);
  var save = function(v) { setNotes(v); try { localStorage.setItem("poast-notes", v); } catch (e) {} };
  return (
    <W title="Notes" icon={"\uD83D\uDCDD"} expanded={expanded} onToggleExpand={onToggle}>
      <textarea value={notes} onChange={function(e) { save(e.target.value); }} placeholder="Quick notes, links, ideas..." style={{ width: "100%", height: expanded ? 360 : 180, padding: 10, background: T.surface, border: "1px solid " + T.border, borderRadius: 6, color: T.tx, fontFamily: mn, fontSize: 11, outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.7 }} />
    </W>
  );
}

// ═══ TO-DO LIST ═══
function TodoList({ expanded, onToggle }) {
  var _todos = useState([]), todos = _todos[0], setTodos = _todos[1];
  var _input = useState(""), input = _input[0], setInput = _input[1];
  var _deadline = useState(""), deadline = _deadline[0], setDeadline = _deadline[1];

  useEffect(function() { try { var s = localStorage.getItem("poast-todos"); if (s) setTodos(JSON.parse(s)); } catch (e) {} }, []);
  useEffect(function() { try { localStorage.setItem("poast-todos", JSON.stringify(todos)); } catch (e) {} }, [todos]);

  var add = function() { if (!input.trim()) return; setTodos(function(p) { return p.concat([{ text: input.trim(), done: false, deadline: deadline || null, id: Date.now() }]); }); setInput(""); setDeadline(""); };
  var toggle = function(id) { setTodos(function(p) { return p.map(function(t) { return t.id === id ? Object.assign({}, t, { done: !t.done }) : t; }); }); };
  var remove = function(id) { setTodos(function(p) { return p.filter(function(t) { return t.id !== id; }); }); };

  var pending = todos.filter(function(t) { return !t.done; });
  var done = todos.filter(function(t) { return t.done; });

  return (
    <W title="To-Do" icon={"\u2705"} expanded={expanded} onToggleExpand={onToggle}>
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        <input value={input} onChange={function(e) { setInput(e.target.value); }} onKeyDown={function(e) { if (e.key === "Enter") add(); }} placeholder="Add task..." style={{ flex: 1, padding: "6px 8px", background: T.surface, border: "1px solid " + T.border, borderRadius: 4, color: T.tx, fontFamily: mn, fontSize: 10, outline: "none" }} />
        <input type="date" value={deadline} onChange={function(e) { setDeadline(e.target.value); }} style={{ padding: "6px 6px", background: T.surface, border: "1px solid " + T.border, borderRadius: 4, color: T.txm, fontFamily: mn, fontSize: 9, outline: "none", width: 110 }} />
        <span onClick={add} style={{ padding: "6px 10px", background: T.accent, color: "#fff", borderRadius: 4, cursor: "pointer", fontFamily: ft, fontSize: 10, fontWeight: 700 }}>+</span>
      </div>
      {pending.map(function(t) {
        var overdue = t.deadline && new Date(t.deadline) < new Date();
        return <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid " + T.border }}>
          <span onClick={function() { toggle(t.id); }} style={{ width: 16, height: 16, borderRadius: 3, border: "2px solid " + T.border, cursor: "pointer", flexShrink: 0 }} />
          <span style={{ flex: 1, fontFamily: ft, fontSize: 11, color: T.tx }}>{t.text}</span>
          {t.deadline && <span style={{ fontFamily: mn, fontSize: 8, color: overdue ? T.red : T.txd }}>{new Date(t.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
          <span onClick={function() { remove(t.id); }} style={{ fontFamily: mn, fontSize: 9, color: T.txd, cursor: "pointer" }}>x</span>
        </div>;
      })}
      {done.length > 0 && <div style={{ marginTop: 8 }}>
        <div style={{ fontFamily: mn, fontSize: 8, color: T.txd, marginBottom: 4 }}>COMPLETED ({done.length})</div>
        {done.map(function(t) {
          return <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", opacity: 0.4 }}>
            <span onClick={function() { toggle(t.id); }} style={{ width: 16, height: 16, borderRadius: 3, border: "2px solid " + T.green, background: T.green + "30", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mn, fontSize: 9, color: T.green }}>{"\u2713"}</span>
            <span style={{ flex: 1, fontFamily: ft, fontSize: 11, color: T.txm, textDecoration: "line-through" }}>{t.text}</span>
            <span onClick={function() { remove(t.id); }} style={{ fontFamily: mn, fontSize: 9, color: T.txd, cursor: "pointer" }}>x</span>
          </div>;
        })}
      </div>}
    </W>
  );
}

// ═══ AI IDEAS ═══
function AIIdeas({ expanded, onToggle, onDraft }) {
  var _ideas = useState([]), ideas = _ideas[0], setIdeas = _ideas[1];
  var _loading = useState(false), loading = _loading[0], setLoading = _loading[1];
  var _topic = useState(""), topic = _topic[0], setTopic = _topic[1];
  var _showBuilder = useState(false), showBuilder = _showBuilder[0], setShowBuilder = _showBuilder[1];

  // Auto-generate on mount
  useEffect(function() {
    gen("Latest trends in semiconductors, AI infrastructure, GPU supply, and data center buildout");
  }, []);

  var gen = async function(t) {
    setLoading(true);
    try {
      var r = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system: "You are a content strategist for SemiAnalysis. RESPOND ONLY IN VALID JSON. No markdown fences.", prompt: "Generate 5 content ideas about: " + t + "\n\nFor each, suggest format (X thread, LinkedIn post, IG carousel, YouTube Short, video recap).\nReturn JSON: {\"ideas\":[{\"title\":\"...\",\"format\":\"...\",\"hook\":\"one line\",\"angle\":\"why now\"}]}" }) });
      var d = await r.json();
      var txt = (d.content || []).map(function(c) { return c.text || ""; }).join("");
      var p = JSON.parse(txt.replace(/```json|```/g, "").trim());
      if (p.ideas) setIdeas(p.ideas);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  var fmtColor = function(f) { if (!f) return T.accent; if (f.includes("X")) return "#1DA1F2"; if (f.includes("LinkedIn")) return "#0A66C2"; if (f.includes("IG") || f.includes("carousel")) return "#E4405F"; if (f.includes("YouTube") || f.includes("video")) return "#FF0000"; return T.accent; };

  return (
    <W title="AI Ideas" icon={"\uD83D\uDCA1"} expanded={expanded} onToggleExpand={onToggle} actions={<><SmBtn onClick={function() { setShowBuilder(!showBuilder); }} color={T.accent2} on={showBuilder}>Build</SmBtn><SmBtn onClick={function() { gen("Latest semiconductor, AI, and data center news"); }} color={T.accent}>Refresh</SmBtn></>}>
      {showBuilder && <div style={{ marginBottom: 12, padding: 10, background: T.surface, borderRadius: 6, border: "1px solid " + T.accent2 + "30" }}>
        <div style={{ fontFamily: mn, fontSize: 9, color: T.accent2, marginBottom: 6 }}>BUILD YOUR OWN IDEA</div>
        <input value={topic} onChange={function(e) { setTopic(e.target.value); }} onKeyDown={function(e) { if (e.key === "Enter" && topic.trim()) { gen(topic); setShowBuilder(false); } }} placeholder="Paste article, topic, or describe your idea..." style={{ width: "100%", padding: "8px 10px", background: T.card, border: "1px solid " + T.border, borderRadius: 5, color: T.tx, fontFamily: mn, fontSize: 10, outline: "none", boxSizing: "border-box", marginBottom: 6 }} />
        <div style={{ display: "flex", gap: 4 }}>
          <span onClick={function() { if (topic.trim()) { gen(topic); setShowBuilder(false); } }} style={{ padding: "5px 12px", background: T.accent2, color: "#fff", borderRadius: 4, cursor: "pointer", fontFamily: ft, fontSize: 10, fontWeight: 700 }}>Generate</span>
        </div>
      </div>}
      {loading ? <div style={{ color: T.txd, fontFamily: mn, fontSize: 10, textAlign: "center", padding: 20 }}>Generating ideas...</div>
      : ideas.map(function(idea, i) {
        return <div key={i} style={{ padding: "8px 10px", marginBottom: 5, background: T.surface, borderRadius: 5, border: "1px solid " + T.border }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 6, marginBottom: 3 }}>
            <div style={{ fontFamily: ft, fontSize: 11, fontWeight: 600, color: T.tx, lineHeight: 1.3 }}>{idea.title}</div>
            <span style={{ fontFamily: mn, fontSize: 8, color: fmtColor(idea.format), padding: "1px 5px", borderRadius: 3, background: fmtColor(idea.format) + "15", flexShrink: 0, whiteSpace: "nowrap" }}>{idea.format}</span>
          </div>
          <div style={{ fontFamily: ft, fontSize: 10, color: T.accent2, marginBottom: 1 }}>{idea.hook}</div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div style={{ fontFamily: ft, fontSize: 9, color: T.txm }}>{idea.angle}</div>
            <span onClick={function() { onDraft({ title: idea.title, source: "AI Ideas", snippet: idea.hook + " " + idea.angle, link: "" }); }} style={{ fontFamily: mn, fontSize: 8, color: T.accent, cursor: "pointer" }}>Draft</span>
          </div>
        </div>;
      })}
    </W>
  );
}

// ═══ WATCHLIST ═══
function Watchlist({ expanded, onToggle }) {
  var _items = useState([
    { name: "NVIDIA", ticker: "NVDA", note: "Blackwell ramp, H200 demand" },
    { name: "TSMC", ticker: "TSM", note: "Arizona fab, CoWoS capacity" },
    { name: "AMD", ticker: "AMD", note: "MI355X launch, ROCm adoption" },
    { name: "Nebius", ticker: "NBIS", note: "Meta/Microsoft deals, neocloud" },
    { name: "Broadcom", ticker: "AVGO", note: "Custom silicon, VMware" },
    { name: "ASML", ticker: "ASML", note: "High-NA EUV, China restrictions" },
  ]);
  var items = _items[0];
  return (
    <W title="Watchlist" icon={"\uD83D\uDC41"} expanded={expanded} onToggleExpand={onToggle}>
      {items.map(function(item, i) {
        return <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid " + T.border }}>
          <div style={{ fontFamily: mn, fontSize: 10, fontWeight: 700, color: T.accent, width: 40 }}>{item.ticker}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: ft, fontSize: 11, fontWeight: 600, color: T.tx }}>{item.name}</div>
            <div style={{ fontFamily: ft, fontSize: 9, color: T.txm }}>{item.note}</div>
          </div>
        </div>;
      })}
    </W>
  );
}

// ═══ DRAFT MODAL ═══
function DraftModal({ item, onClose }) {
  var _type = useState("social"), type = _type[0], setType = _type[1];
  var _result = useState(""), result = _result[0], setResult = _result[1];
  var _loading = useState(false), loading = _loading[0], setLoading = _loading[1];
  var _copied = useState(false), copied = _copied[0], setCopied = _copied[1];

  var generate = async function() {
    setLoading(true);
    var prompt;
    if (type === "social") prompt = "Draft social captions for X (hook, no hashtags) and LinkedIn (3-5 sentences).\n\nTitle: " + item.title + "\nSource: " + item.source + "\nSnippet: " + (item.snippet || "") + "\n\nFormat:\nX HOOK:\n[hook]\n\nLINKEDIN:\n[post]";
    else if (type === "thread") prompt = "Draft a 5-tweet X thread. No hashtags. Each tweet its own point.\n\nTitle: " + item.title + "\nSnippet: " + (item.snippet || "") + "\n\nFormat as 1/5, 2/5, etc.";
    else prompt = "Write a 60-second video recap script. Hook, 3 key points, CTA.\n\nTitle: " + item.title + "\nSnippet: " + (item.snippet || "");
    try {
      var r = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system: "You write content for SemiAnalysis. Never use em dashes. No emojis. Direct, informed, casual.", prompt: prompt }) });
      var d = await r.json(); setResult((d.content || []).map(function(c) { return c.text || ""; }).join(""));
    } catch (e) { setResult("Error generating."); }
    setLoading(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }} onClick={onClose}>
      <div onClick={function(e) { e.stopPropagation(); }} style={{ background: "linear-gradient(135deg, " + T.card + ", " + T.surface + ")", border: "1px solid " + T.accent + "30", borderRadius: 12, padding: 24, maxWidth: 580, width: "90%", maxHeight: "80vh", overflow: "auto", boxShadow: T.glowAccent }}>
        <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 800, color: T.tx, marginBottom: 3 }}>{item.title}</div>
        <div style={{ fontFamily: mn, fontSize: 9, color: T.txm, marginBottom: 14 }}>{item.source}</div>
        <div style={{ display: "flex", gap: 5, marginBottom: 14 }}>
          {[{ id: "social", l: "Social Post" }, { id: "thread", l: "X Thread" }, { id: "recap", l: "Video Recap" }].map(function(t) {
            return <div key={t.id} onClick={function() { setType(t.id); setResult(""); }} style={{ padding: "5px 10px", borderRadius: 4, cursor: "pointer", background: type === t.id ? T.accent + "18" : T.surface, border: "1px solid " + (type === t.id ? T.accent : T.border), fontFamily: mn, fontSize: 9, color: type === t.id ? T.accent : T.txm }}>{t.l}</div>;
          })}
        </div>
        <button onClick={generate} disabled={loading} style={{ padding: "7px 18px", background: T.accent, color: "#fff", border: "none", borderRadius: 5, fontFamily: ft, fontSize: 11, fontWeight: 700, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.5 : 1, marginBottom: 12 }}>{loading ? "Generating..." : "Generate"}</button>
        {result && <div style={{ padding: 12, background: T.surface, borderRadius: 6, border: "1px solid " + T.border }}>
          <pre style={{ fontFamily: ft, fontSize: 11, color: T.tx, lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0 }}>{result}</pre>
          <span onClick={function() { navigator.clipboard.writeText(result); setCopied(true); setTimeout(function() { setCopied(false); }, 1500); }} style={{ fontFamily: mn, fontSize: 8, color: T.accent, cursor: "pointer", marginTop: 8, display: "inline-block" }}>{copied ? "Copied!" : "Copy"}</span>
        </div>}
        <div style={{ textAlign: "right", marginTop: 14 }}><span onClick={onClose} style={{ fontFamily: mn, fontSize: 10, color: T.txd, cursor: "pointer" }}>Close</span></div>
      </div>
    </div>
  );
}

// ═══ SETTINGS ═══
var WIDGET_IDS = ["news", "semianalysis", "stocks", "earnings", "live", "watchlist", "ideas", "notes", "todos"];
var WIDGET_META = { news: { l: "News Feed", i: "\uD83D\uDCF0" }, semianalysis: { l: "SemiAnalysis", i: "\uD83D\uDD2C" }, stocks: { l: "Stocks", i: "\uD83D\uDCC8" }, earnings: { l: "Earnings", i: "\uD83D\uDCC5" }, live: { l: "LIVE!", i: "\uD83D\uDD34" }, watchlist: { l: "Watchlist", i: "\uD83D\uDC41" }, ideas: { l: "AI Ideas", i: "\uD83D\uDCA1" }, notes: { l: "Notes", i: "\uD83D\uDCDD" }, todos: { l: "To-Do", i: "\u2705" } };

function Settings({ order, setOrder, disabled, setDisabled, onClose }) {
  var toggle = function(id) { setDisabled(function(p) { var s = new Set(p); if (s.has(id)) s.delete(id); else s.add(id); return Array.from(s); }); };
  var move = function(idx, dir) { setOrder(function(p) { var a = p.slice(); var ni = idx + dir; if (ni < 0 || ni >= a.length) return a; var t = a[idx]; a[idx] = a[ni]; a[ni] = t; return a; }); };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }} onClick={onClose}>
      <div onClick={function(e) { e.stopPropagation(); }} style={{ background: "linear-gradient(135deg, " + T.card + ", " + T.surface + ")", border: "1px solid " + T.accent + "30", borderRadius: 12, padding: 24, maxWidth: 400, width: "90%", boxShadow: T.glowAccent }}>
        <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 800, color: T.tx, marginBottom: 16 }}>Dashboard Settings</div>
        {order.map(function(id, i) {
          var m = WIDGET_META[id]; var off = disabled.indexOf(id) >= 0;
          return <div key={id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", marginBottom: 3, background: off ? "transparent" : T.surface, borderRadius: 5, border: "1px solid " + (off ? "transparent" : T.border) }}>
            <span style={{ fontSize: 12 }}>{m.i}</span>
            <span style={{ flex: 1, fontFamily: ft, fontSize: 11, color: off ? T.txd : T.tx, fontWeight: 600 }}>{m.l}</span>
            <span onClick={function() { move(i, -1); }} style={{ fontFamily: mn, fontSize: 9, color: T.txd, cursor: "pointer" }}>{"\u25B2"}</span>
            <span onClick={function() { move(i, 1); }} style={{ fontFamily: mn, fontSize: 9, color: T.txd, cursor: "pointer" }}>{"\u25BC"}</span>
            <span onClick={function() { toggle(id); }} style={{ width: 32, height: 18, borderRadius: 9, background: off ? T.border : T.accent, cursor: "pointer", position: "relative", display: "inline-block" }}>
              <span style={{ position: "absolute", top: 2, left: off ? 2 : 16, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
            </span>
          </div>;
        })}
        <div style={{ textAlign: "right", marginTop: 14 }}><span onClick={onClose} style={{ fontFamily: ft, fontSize: 11, fontWeight: 700, color: T.accent, cursor: "pointer" }}>Done</span></div>
      </div>
    </div>
  );
}

// ═══ MAIN DASHBOARD ═══
export default function NewsFlow() {
  var _order = useState(WIDGET_IDS), order = _order[0], setOrder = _order[1];
  var _disabled = useState([]), disabled = _disabled[0], setDisabled = _disabled[1];
  var _showSettings = useState(false), showSettings = _showSettings[0], setShowSettings = _showSettings[1];
  var _expanded = useState(null), expanded = _expanded[0], setExpanded = _expanded[1];
  var _draftItem = useState(null), draftItem = _draftItem[0], setDraftItem = _draftItem[1];

  useEffect(function() {
    try { var o = localStorage.getItem("nf-order"); if (o) setOrder(JSON.parse(o)); } catch (e) {}
    try { var d = localStorage.getItem("nf-disabled"); if (d) setDisabled(JSON.parse(d)); } catch (e) {}
  }, []);
  useEffect(function() { try { localStorage.setItem("nf-order", JSON.stringify(order)); } catch (e) {} }, [order]);
  useEffect(function() { try { localStorage.setItem("nf-disabled", JSON.stringify(disabled)); } catch (e) {} }, [disabled]);

  var toggleExpand = function(id) { setExpanded(expanded === id ? null : id); };

  var renderWidget = function(id) {
    if (disabled.indexOf(id) >= 0) return null;
    var ex = expanded === id;
    var tog = function() { toggleExpand(id); };
    if (id === "news") return <NewsFeed key={id} expanded={ex} onToggle={tog} onDraft={setDraftItem} />;
    if (id === "semianalysis") return <SAFeed key={id} expanded={ex} onToggle={tog} onDraft={setDraftItem} />;
    if (id === "stocks") return <StockTicker key={id} expanded={ex} onToggle={tog} />;
    if (id === "earnings") return <EarningsCalendar key={id} expanded={ex} onToggle={tog} />;
    if (id === "live") return <LiveStreams key={id} expanded={ex} onToggle={tog} />;
    if (id === "watchlist") return <Watchlist key={id} expanded={ex} onToggle={tog} />;
    if (id === "ideas") return <AIIdeas key={id} expanded={ex} onToggle={tog} onDraft={setDraftItem} />;
    if (id === "notes") return <Notes key={id} expanded={ex} onToggle={tog} />;
    if (id === "todos") return <TodoList key={id} expanded={ex} onToggle={tog} />;
    return null;
  };

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: "@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: ft, fontSize: 20, fontWeight: 900, color: T.tx }}>News Flow</div>
          <div style={{ fontFamily: mn, fontSize: 9, color: T.txm, marginTop: 1 }}>Live feeds, stocks, streams, ideas. Draft from any article.</div>
        </div>
        <span onClick={function() { setShowSettings(true); }} style={{ width: 30, height: 30, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: T.surface, border: "1px solid " + T.border, fontSize: 15, color: T.txm }}>{"\u2699"}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 12 }}>
        {order.map(renderWidget)}
      </div>

      {showSettings && <Settings order={order} setOrder={setOrder} disabled={disabled} setDisabled={setDisabled} onClose={function() { setShowSettings(false); }} />}
      {draftItem && <DraftModal item={draftItem} onClose={function() { setDraftItem(null); }} />}
    </div>
  );
}
