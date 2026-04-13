// @ts-nocheck
"use client";
import { useState, useEffect, useCallback, useRef } from "react";

// ═══ SA BRAND THEME ═══
var C = {
  amber: "#F7B041", blue: "#0B86D1", teal: "#2EAD8E", coral: "#E06347",
  violet: "#905CCB", cyan: "#26C9D8", crimson: "#D1334A", green: "#56BC42",
  rose: "#D34574", yellow: "#E8C83A", indigo: "#495BCE", magenta: "#BF49B5",
  bg: "#0B0B12", card: "#12121C", border: "#1C1C2C", surface: "#181826",
  tx: "#E8E4DD", txm: "#8A8690", txd: "#4E4B56",
};
var ft = "'Outfit',sans-serif";
var mn = "'JetBrains Mono',monospace";

// Platform config with SA 12-series colors
var PLATS = {
  twitter: { name: "X / Twitter", icon: "\uD83D\uDC26", color: C.blue, short: "X" },
  linkedin: { name: "LinkedIn", icon: "\uD83D\uDCBC", color: C.blue, short: "LI" },
  facebook: { name: "Facebook", icon: "\uD83D\uDCD8", color: C.indigo, short: "FB" },
  instagram: { name: "Instagram", icon: "\uD83D\uDCF7", color: C.rose, short: "IG" },
  youtube: { name: "YouTube", icon: "\u25B6\uFE0F", color: C.crimson, short: "YT" },
  tiktok: { name: "TikTok", icon: "\uD83C\uDFB5", color: C.teal, short: "TT" },
  threads: { name: "Threads", icon: "\uD83E\uDDF5", color: C.txm, short: "TH" },
  bluesky: { name: "Bluesky", icon: "\u2601\uFE0F", color: C.cyan, short: "BS" },
};
function plat(svc) { return PLATS[svc] || { name: svc, icon: "\uD83D\uDCE2", color: C.txm, short: svc }; }

// ═══ COMPONENTS ═══
function MetricCard({ label, value, color, icon }) {
  return <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 10, padding: "18px 16px", textAlign: "center", flex: 1, minWidth: 0 }}>
    {icon && <div style={{ fontSize: 18, marginBottom: 6 }}>{icon}</div>}
    <div style={{ fontFamily: mn, fontSize: 28, fontWeight: 900, color: color }}>{value}</div>
    <div style={{ fontFamily: mn, fontSize: 9, color: C.txd, textTransform: "uppercase", letterSpacing: 1.5, marginTop: 4 }}>{label}</div>
  </div>;
}

function PlatFilter({ channels, active, setActive }) {
  var svcs = [];
  (channels || []).forEach(function(ch) { if (svcs.indexOf(ch.service) < 0) svcs.push(ch.service); });
  return <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
    <span onClick={function() { setActive(null); }} style={{ padding: "5px 12px", borderRadius: 6, cursor: "pointer", background: !active ? C.amber + "18" : C.card, border: "1px solid " + (!active ? C.amber : C.border), fontFamily: mn, fontSize: 10, color: !active ? C.amber : C.txm, fontWeight: !active ? 700 : 400 }}>All</span>
    {svcs.map(function(s) {
      var p = plat(s); var on = active === s;
      return <span key={s} onClick={function() { setActive(on ? null : s); }} style={{ padding: "5px 12px", borderRadius: 6, cursor: "pointer", background: on ? p.color + "18" : C.card, border: "1px solid " + (on ? p.color + "60" : C.border), fontFamily: mn, fontSize: 10, color: on ? p.color : C.txm, display: "flex", alignItems: "center", gap: 4 }}><span style={{ fontSize: 12 }}>{p.icon}</span>{p.short}</span>;
    })}
  </div>;
}

function Tab({ label, active, onClick, count }) {
  return <div onClick={onClick} style={{ padding: "10px 18px", cursor: "pointer", fontFamily: ft, fontSize: 13, fontWeight: active ? 700 : 500, color: active ? C.amber : C.txm, borderBottom: active ? "2px solid " + C.amber : "2px solid transparent", display: "flex", alignItems: "center", gap: 6 }}>{label}{count > 0 && <span style={{ fontFamily: mn, fontSize: 9, background: active ? C.amber + "20" : C.surface, color: active ? C.amber : C.txd, padding: "2px 7px", borderRadius: 10 }}>{count}</span>}</div>;
}

// ═══ POST CARD (redesigned) ═══
function PostCard({ post, onDelete, showEdit }) {
  var _exp = useState(false), expanded = _exp[0], setExpanded = _exp[1];
  var svc = post.channel ? post.channel.service : post.channelService || "";
  var p = plat(svc);
  var time = post.dueAt ? new Date(post.dueAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  var sentTime = post.sentAt ? new Date(post.sentAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  var text = post.text || "";
  var isNoText = !text.trim();
  var displayText = isNoText ? (svc === "youtube" ? "Video post" : "Media post") : text;

  // Extract hashtags for pill styling
  var renderText = function(t) {
    if (isNoText) return <span style={{ color: C.txd, fontStyle: "italic" }}>{displayText}</span>;
    var parts = t.split(/(#\w+)/g);
    return parts.map(function(part, i) {
      if (part.startsWith("#")) return <span key={i} style={{ display: "inline-block", fontFamily: mn, fontSize: 10, color: C.amber, background: C.amber + "15", padding: "1px 6px", borderRadius: 4, margin: "1px 2px" }}>{part}</span>;
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 10, marginBottom: 12, overflow: "hidden" }}>
      {/* Top row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid " + C.border }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: p.color + "15", border: "1px solid " + p.color + "30", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>{p.icon}</div>
          <div>
            <div style={{ fontFamily: ft, fontSize: 12, fontWeight: 700, color: p.color }}>{p.name}</div>
            <div style={{ fontFamily: mn, fontSize: 8, color: C.txd }}>{post.channel ? post.channel.name : ""}</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: mn, fontSize: 10, color: C.tx }}>{post.status === "sent" ? sentTime : time}</div>
          <span style={{ fontFamily: mn, fontSize: 8, color: post.status === "sent" ? C.teal : post.status === "draft" ? C.amber : C.blue, padding: "1px 6px", borderRadius: 3, background: (post.status === "sent" ? C.teal : post.status === "draft" ? C.amber : C.blue) + "12" }}>{post.status}</span>
        </div>
      </div>

      {/* Text */}
      <div onClick={function() { if (!isNoText) setExpanded(!expanded); }} style={{ padding: "12px 16px", cursor: isNoText ? "default" : "pointer" }}>
        <div style={{ fontFamily: ft, fontSize: 13, color: C.tx, lineHeight: 1.6, whiteSpace: "pre-wrap", overflow: "hidden", maxHeight: expanded ? "none" : "3.2em", wordBreak: "break-word" }}>{renderText(displayText)}</div>
        {!isNoText && text.length > 120 && !expanded && <div style={{ fontFamily: mn, fontSize: 9, color: C.txd, marginTop: 4 }}>Click to expand</div>}
      </div>

      {/* Bottom row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 16px", borderTop: "1px solid " + C.border }}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {(post.tags || []).map(function(t, i) { return <span key={i} style={{ fontFamily: mn, fontSize: 8, color: t.color || C.amber, padding: "2px 7px", borderRadius: 4, background: (t.color || C.amber) + "15" }}>{t.name}</span>; })}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {showEdit && <a href={"https://publish.buffer.com"} target="_blank" rel="noopener noreferrer" style={{ fontFamily: mn, fontSize: 9, color: C.amber, textDecoration: "none", padding: "4px 10px", borderRadius: 5, border: "1px solid " + C.amber + "30" }}>Edit in Buffer</a>}
          {onDelete && <span onClick={function() { onDelete(post.id); }} style={{ fontFamily: mn, fontSize: 9, color: C.coral, cursor: "pointer", padding: "4px 10px", borderRadius: 5, border: "1px solid " + C.coral + "30" }}>Delete</span>}
        </div>
      </div>
    </div>
  );
}

// ═══ CALENDAR ═══
function CalendarTab({ posts, channels }) {
  var _m = useState(new Date().getMonth()), month = _m[0], setMonth = _m[1];
  var _y = useState(new Date().getFullYear()), year = _y[0], setYear = _y[1];
  var _pf = useState(null), platF = _pf[0], setPlatF = _pf[1];
  var _hover = useState(null), hoverDay = _hover[0], setHoverDay = _hover[1];
  var _hoverPos = useState({ x: 0, y: 0 }), hoverPos = _hoverPos[0], setHoverPos = _hoverPos[1];

  var filtered = platF ? posts.filter(function(p) { return (p.channel ? p.channel.service : p.channelService) === platF; }) : posts;
  var fd = new Date(year, month, 1).getDay();
  var dim = new Date(year, month + 1, 0).getDate();
  var cells = []; for (var i = 0; i < fd; i++) cells.push(null); for (var d = 1; d <= dim; d++) cells.push(d);

  var onDay = function(day) { return filtered.filter(function(p) { if (!p.dueAt) return false; var pd = new Date(p.dueAt); return pd.getDate() === day && pd.getMonth() === month && pd.getFullYear() === year; }); };

  return (<div>
    <PlatFilter channels={channels} active={platF} setActive={setPlatF} />
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
      <span onClick={function() { if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1); }} style={{ fontFamily: ft, fontSize: 14, color: C.txm, cursor: "pointer", padding: "6px 14px", borderRadius: 6, border: "1px solid " + C.border }}>&larr;</span>
      <div style={{ fontFamily: ft, fontSize: 18, fontWeight: 800, color: C.tx }}>{new Date(year, month).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</div>
      <span onClick={function() { if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1); }} style={{ fontFamily: ft, fontSize: 14, color: C.txm, cursor: "pointer", padding: "6px 14px", borderRadius: 6, border: "1px solid " + C.border }}>&rarr;</span>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, position: "relative" }}>
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(function(d) { return <div key={d} style={{ textAlign: "center", fontFamily: mn, fontSize: 10, color: C.txd, padding: 6, fontWeight: 700 }}>{d}</div>; })}
      {cells.map(function(day, ci) {
        if (!day) return <div key={"e" + ci} />;
        var dp = onDay(day);
        var isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
        // Group by platform
        var svcs = {};
        dp.forEach(function(p) { var s = p.channel ? p.channel.service : p.channelService || ""; svcs[s] = (svcs[s] || 0) + 1; });
        return <div key={ci} onMouseEnter={function(e) { if (dp.length > 0) { setHoverDay(day); setHoverPos({ x: e.clientX, y: e.clientY }); } }} onMouseLeave={function() { setHoverDay(null); }} style={{ minHeight: 90, padding: "6px 8px", borderRadius: 8, background: C.card, border: isToday ? "2px solid " + C.amber : "1px solid " + (dp.length > 0 ? C.border : C.border), boxShadow: isToday ? "0 0 12px " + C.amber + "20" : "none" }}>
          <div style={{ fontFamily: mn, fontSize: 11, fontWeight: isToday ? 800 : 500, color: isToday ? C.amber : C.tx, marginBottom: 4 }}>{day}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
            {Object.keys(svcs).map(function(s) {
              var pl = plat(s);
              return <div key={s} style={{ display: "flex", alignItems: "center", gap: 2, padding: "1px 5px", borderRadius: 4, background: pl.color + "15", border: "1px solid " + pl.color + "25" }}>
                <span style={{ fontSize: 9 }}>{pl.icon}</span>
                <span style={{ fontFamily: mn, fontSize: 8, color: pl.color, fontWeight: 700 }}>{svcs[s]}</span>
              </div>;
            })}
          </div>
        </div>;
      })}

      {/* Hover popover */}
      {hoverDay && <div style={{ position: "fixed", left: hoverPos.x + 12, top: hoverPos.y - 10, background: C.card, border: "1px solid " + C.amber + "30", borderRadius: 8, padding: "10px 14px", zIndex: 1000, maxWidth: 320, boxShadow: "0 0 20px rgba(0,0,0,0.5)", pointerEvents: "none" }}>
        {onDay(hoverDay).slice(0, 5).map(function(p, i) {
          var pl = plat(p.channel ? p.channel.service : "");
          var t = p.dueAt ? new Date(p.dueAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "";
          return <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", padding: "4px 0", borderBottom: i < 4 ? "1px solid " + C.border : "none" }}>
            <span style={{ fontSize: 10, flexShrink: 0 }}>{pl.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: ft, fontSize: 10, color: C.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(p.text || "").slice(0, 60) || "Media post"}</div>
              <div style={{ fontFamily: mn, fontSize: 8, color: C.txd }}>{pl.name} // {t}</div>
            </div>
          </div>;
        })}
        {onDay(hoverDay).length > 5 && <div style={{ fontFamily: mn, fontSize: 8, color: C.txd, marginTop: 4 }}>+{onDay(hoverDay).length - 5} more</div>}
      </div>}
    </div>
  </div>);
}

// ═══ POST LIST (Scheduled / Sent / Drafts) ═══
function PostList({ posts, channels, onDelete, showEdit, emptyLabel, showSearch }) {
  var _pf = useState(null), platF = _pf[0], setPlatF = _pf[1];
  var _search = useState(""), search = _search[0], setSearch = _search[1];

  var filtered = posts;
  if (platF) filtered = filtered.filter(function(p) { return (p.channel ? p.channel.service : p.channelService) === platF; });
  if (search.trim()) {
    var q = search.toLowerCase();
    filtered = filtered.filter(function(p) { return (p.text || "").toLowerCase().includes(q); });
  }

  return (<div>
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 16 }}>
      <div style={{ flex: 1 }}><PlatFilter channels={channels} active={platF} setActive={setPlatF} /></div>
      {showSearch && <input value={search} onChange={function(e) { setSearch(e.target.value); }} placeholder="Search posts..." style={{ padding: "6px 12px", background: C.card, border: "1px solid " + C.border, borderRadius: 6, color: C.tx, fontFamily: mn, fontSize: 10, outline: "none", width: 200 }} />}
    </div>
    {filtered.length === 0 ? <div style={{ textAlign: "center", padding: 50, color: C.txd, fontFamily: ft, fontSize: 13 }}>{emptyLabel || "No posts"}</div>
    : filtered.map(function(p) { return <PostCard key={p.id} post={p} onDelete={onDelete} showEdit={showEdit} />; })}
  </div>);
}

// ═══ CHANNELS ═══
function ChannelsTab({ channels, data, onFilterChannel }) {
  return (<div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12, marginBottom: 28 }}>
      {(channels || []).map(function(ch) {
        var pl = plat(ch.service);
        var sched = (data.scheduled || []).filter(function(p) { return p.channel && p.channel.id === ch.id; }).length;
        var sent = (data.sent || []).filter(function(p) { return p.channel && p.channel.id === ch.id; }).length;
        var lastPost = (data.sent || []).filter(function(p) { return p.channel && p.channel.id === ch.id; }).sort(function(a, b) { return new Date(b.sentAt || 0).getTime() - new Date(a.sentAt || 0).getTime(); })[0];
        var lastDate = lastPost && lastPost.sentAt ? new Date(lastPost.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Never";

        return <div key={ch.id} onClick={function() { onFilterChannel(ch.service); }} style={{ padding: "16px 18px", background: C.card, borderRadius: 10, border: "1px solid " + C.border, borderLeft: "3px solid " + pl.color, cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: pl.color + "15", border: "1px solid " + pl.color + "30", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{pl.icon}</div>
            <div>
              <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: pl.color }}>{ch.name}</div>
              <div style={{ fontFamily: mn, fontSize: 9, color: C.txd }}>{pl.name} // {ch.timezone}</div>
            </div>
            {ch.isDisconnected && <span style={{ fontFamily: mn, fontSize: 8, color: C.coral, marginLeft: "auto", padding: "2px 6px", borderRadius: 3, background: C.coral + "15" }}>Disconnected</span>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, fontFamily: mn, fontSize: 9 }}>
            <div style={{ textAlign: "center", padding: "6px 0", background: C.surface, borderRadius: 4 }}><div style={{ color: C.blue, fontWeight: 700, fontSize: 14 }}>{sched}</div><div style={{ color: C.txd }}>Queued</div></div>
            <div style={{ textAlign: "center", padding: "6px 0", background: C.surface, borderRadius: 4 }}><div style={{ color: C.teal, fontWeight: 700, fontSize: 14 }}>{sent}</div><div style={{ color: C.txd }}>Sent</div></div>
            <div style={{ textAlign: "center", padding: "6px 0", background: C.surface, borderRadius: 4 }}><div style={{ color: C.txm, fontWeight: 700, fontSize: 10 }}>{lastDate}</div><div style={{ color: C.txd }}>Last</div></div>
          </div>
        </div>;
      })}
    </div>
  </div>);
}

// ═══ STATS ═══
function StatsTab({ data }) {
  var scheduled = (data.scheduled || []).length;
  var sent = (data.sent || []).length;
  var drafts = (data.drafts || []).length;
  var channels = (data.channels || []).length;

  var byPlat = {};
  (data.sent || []).forEach(function(p) { var s = p.channel ? p.channel.service : ""; byPlat[s] = (byPlat[s] || 0) + 1; });
  var maxSent = Math.max(1, ...Object.values(byPlat));

  var byPlatFull = {};
  (data.scheduled || []).concat(data.sent || []).forEach(function(p) {
    var s = p.channel ? p.channel.service : "";
    if (!byPlatFull[s]) byPlatFull[s] = { sched: 0, sent: 0 };
    if (p.status === "sent") byPlatFull[s].sent++; else byPlatFull[s].sched++;
  });

  return (<div>
    <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
      <MetricCard label="Scheduled" value={scheduled} color={C.amber} icon={"\uD83D\uDCC5"} />
      <MetricCard label="Sent" value={sent} color={C.teal} icon={"\u2705"} />
      <MetricCard label="Drafts" value={drafts} color={C.blue} icon={"\uD83D\uDCDD"} />
      <MetricCard label="Channels" value={channels} color={C.violet} icon={"\uD83D\uDCE2"} />
    </div>

    {/* Bar chart */}
    <div style={{ fontFamily: mn, fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 14 }}>Posts Sent by Platform</div>
    <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 10, padding: "20px", marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 160 }}>
        {Object.keys(byPlat).sort(function(a, b) { return byPlat[b] - byPlat[a]; }).map(function(s) {
          var pl = plat(s);
          var pct = (byPlat[s] / maxSent) * 100;
          return <div key={s} style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontFamily: mn, fontSize: 12, fontWeight: 700, color: pl.color, marginBottom: 4 }}>{byPlat[s]}</div>
            <div style={{ height: pct + "%", minHeight: 4, background: "linear-gradient(180deg, " + pl.color + ", " + pl.color + "60)", borderRadius: "4px 4px 0 0" }} />
            <div style={{ fontFamily: mn, fontSize: 8, color: C.txd, marginTop: 6 }}>{pl.short}</div>
          </div>;
        })}
      </div>
    </div>

    {/* By platform cards */}
    <div style={{ fontFamily: mn, fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 14 }}>By Platform</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
      {Object.keys(byPlatFull).sort().map(function(s) {
        var d = byPlatFull[s];
        var pl = plat(s);
        return <div key={s} style={{ padding: "14px 16px", background: C.card, borderRadius: 8, border: "1px solid " + C.border, borderLeft: "3px solid " + pl.color }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 16 }}>{pl.icon}</span>
            <span style={{ fontFamily: ft, fontSize: 13, fontWeight: 700, color: pl.color }}>{pl.name}</span>
          </div>
          <div style={{ display: "flex", gap: 16, fontFamily: mn, fontSize: 11 }}>
            <div><span style={{ color: C.blue, fontWeight: 700, fontSize: 18 }}>{d.sched}</span><div style={{ fontSize: 8, color: C.txd }}>Queued</div></div>
            <div><span style={{ color: C.teal, fontWeight: 700, fontSize: 18 }}>{d.sent}</span><div style={{ fontSize: 8, color: C.txd }}>Sent</div></div>
          </div>
        </div>;
      })}
    </div>
  </div>);
}

// ═══ COMPOSE MODAL ═══
function ComposeModal({ channels, onClose, onRefresh }) {
  var _text = useState(""), text = _text[0], setText = _text[1];
  var _selected = useState([]), selected = _selected[0], setSelected = _selected[1];
  var _date = useState(""), date = _date[0], setDate = _date[1];
  var _time = useState("10:00"), time = _time[0], setTime = _time[1];
  var _sending = useState(false), sending = _sending[0], setSending = _sending[1];
  var _done = useState(false), done = _done[0], setDone = _done[1];

  var toggle = function(id) { setSelected(function(p) { return p.indexOf(id) >= 0 ? p.filter(function(x) { return x !== id; }) : p.concat([id]); }); };

  var send = async function() {
    if (!text.trim() || selected.length === 0) return;
    setSending(true);
    var dueAt = date && time ? new Date(date + "T" + time + ":00").toISOString() : undefined;
    for (var i = 0; i < selected.length; i++) {
      try {
        await fetch("/api/buffer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "createPost", input: { channelId: selected[i], text: text, dueAt: dueAt, schedulingType: dueAt ? "custom" : "now" } }) });
      } catch (e) {}
    }
    setSending(false); setDone(true);
    setTimeout(function() { onRefresh(); onClose(); }, 1500);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }} onClick={onClose}>
      <div onClick={function(e) { e.stopPropagation(); }} style={{ background: C.card, border: "1px solid " + C.amber + "30", borderRadius: 12, padding: 28, maxWidth: 540, width: "90%", maxHeight: "85vh", overflow: "auto" }}>
        <div style={{ fontFamily: ft, fontSize: 18, fontWeight: 800, color: C.tx, marginBottom: 16 }}>{done ? "Scheduled!" : "New Post"}</div>

        {done ? <div style={{ textAlign: "center", padding: 20, fontFamily: ft, fontSize: 14, color: C.teal }}>Post created successfully.</div> : <>
          <div style={{ fontFamily: mn, fontSize: 9, color: C.txd, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Channels</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
            {(channels || []).map(function(ch) {
              var pl = plat(ch.service); var on = selected.indexOf(ch.id) >= 0;
              return <div key={ch.id} onClick={function() { toggle(ch.id); }} style={{ padding: "6px 12px", borderRadius: 6, cursor: "pointer", background: on ? pl.color + "18" : C.surface, border: on ? "2px solid " + pl.color : "1px solid " + C.border, fontFamily: mn, fontSize: 10, color: on ? pl.color : C.txm, display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 12 }}>{pl.icon}</span>{ch.name}
              </div>;
            })}
          </div>

          <div style={{ fontFamily: mn, fontSize: 9, color: C.txd, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Content</div>
          <textarea value={text} onChange={function(e) { setText(e.target.value); }} rows={5} placeholder="Write your post..." style={{ width: "100%", padding: "12px 14px", background: C.surface, border: "1px solid " + C.border, borderRadius: 8, color: C.tx, fontFamily: ft, fontSize: 13, outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.6, marginBottom: 14 }} />

          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: mn, fontSize: 9, color: C.txd, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Date</div>
              <input type="date" value={date} onChange={function(e) { setDate(e.target.value); }} style={{ width: "100%", padding: "8px 10px", background: C.surface, border: "1px solid " + C.border, borderRadius: 6, color: C.tx, fontFamily: mn, fontSize: 11, outline: "none" }} />
            </div>
            <div style={{ width: 120 }}>
              <div style={{ fontFamily: mn, fontSize: 9, color: C.txd, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Time</div>
              <input type="time" value={time} onChange={function(e) { setTime(e.target.value); }} style={{ width: "100%", padding: "8px 10px", background: C.surface, border: "1px solid " + C.border, borderRadius: 6, color: C.tx, fontFamily: mn, fontSize: 11, outline: "none" }} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <span onClick={onClose} style={{ padding: "8px 16px", fontFamily: ft, fontSize: 12, color: C.txm, cursor: "pointer" }}>Cancel</span>
            <span onClick={send} style={{ padding: "8px 24px", background: C.amber, color: C.bg, borderRadius: 6, fontFamily: ft, fontSize: 13, fontWeight: 700, cursor: sending ? "wait" : "pointer", opacity: sending ? 0.5 : 1 }}>{sending ? "Scheduling..." : date ? "Schedule via Buffer" : "Post Now via Buffer"}</span>
          </div>
        </>}
      </div>
    </div>
  );
}

// ═══ MAIN ═══
export default function BufferSchedule() {
  var _tab = useState("calendar"), tab = _tab[0], setTab = _tab[1];
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

  var deletePost = function(postId) { fetch("/api/buffer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "deletePost", postId: postId }) }).then(function() { load(); }); };

  // When clicking a channel, filter and jump to scheduled tab
  var filterByChannel = function(svc) { setChanFilter(svc); setTab("scheduled"); };

  var allPosts = data ? (data.scheduled || []).concat(data.sent || []) : [];

  return (<div>
    <style dangerouslySetInnerHTML={{ __html: "@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');" }} />

    {/* Header */}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
      <div>
        <div style={{ fontFamily: ft, fontSize: 22, fontWeight: 900, color: C.tx, letterSpacing: -0.5 }}>Schedule</div>
        <div style={{ fontFamily: mn, fontSize: 9, color: C.txm, marginTop: 2 }}>Manage your Buffer queue across all platforms.</div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span onClick={function() { setCompose(true); }} style={{ padding: "7px 16px", background: C.amber, color: C.bg, borderRadius: 6, fontFamily: ft, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ New Post</span>
        <span onClick={load} style={{ fontFamily: mn, fontSize: 9, color: C.amber, cursor: "pointer", padding: "7px 12px", borderRadius: 6, border: "1px solid " + C.amber + "30" }}>Refresh</span>
        <a href="https://publish.buffer.com" target="_blank" rel="noopener noreferrer" style={{ padding: "7px 14px", background: C.amber, color: C.bg, borderRadius: 6, fontFamily: ft, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>Open Buffer</a>
      </div>
    </div>

    {/* Metric cards */}
    {data && <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
      <MetricCard label="Scheduled" value={(data.scheduled || []).length} color={C.amber} />
      <MetricCard label="Sent" value={(data.sent || []).length} color={C.teal} />
      <MetricCard label="Drafts" value={(data.drafts || []).length} color={C.blue} />
      <MetricCard label="Channels" value={(data.channels || []).length} color={C.violet} />
    </div>}

    {/* Tabs */}
    <div style={{ display: "flex", borderBottom: "1px solid " + C.border, marginBottom: 24 }}>
      <Tab label="Calendar" active={tab === "calendar"} onClick={function() { setTab("calendar"); setChanFilter(null); }} />
      <Tab label="Scheduled" active={tab === "scheduled"} onClick={function() { setTab("scheduled"); }} count={(data ? data.scheduled || [] : []).length} />
      <Tab label="Sent" active={tab === "sent"} onClick={function() { setTab("sent"); setChanFilter(null); }} count={(data ? data.sent || [] : []).length} />
      <Tab label="Drafts" active={tab === "drafts"} onClick={function() { setTab("drafts"); setChanFilter(null); }} count={(data ? data.drafts || [] : []).length} />
      <Tab label="Channels" active={tab === "channels"} onClick={function() { setTab("channels"); setChanFilter(null); }} count={(data ? data.channels || [] : []).length} />
      <Tab label="Stats" active={tab === "stats"} onClick={function() { setTab("stats"); setChanFilter(null); }} />
      {chanFilter && <span onClick={function() { setChanFilter(null); }} style={{ fontFamily: mn, fontSize: 9, color: C.amber, cursor: "pointer", alignSelf: "center", marginLeft: 8, padding: "4px 8px", borderRadius: 4, background: C.amber + "15" }}>Filtered: {plat(chanFilter).name} x</span>}
    </div>

    {/* Content */}
    {loading ? <div style={{ textAlign: "center", padding: 80 }}>
      <style dangerouslySetInnerHTML={{ __html: "@keyframes bLoad{0%{opacity:0.3}50%{opacity:1}100%{opacity:0.3}}" }} />
      <div style={{ fontFamily: mn, fontSize: 12, color: C.amber, animation: "bLoad 1.5s ease-in-out infinite" }}>Loading Buffer...</div>
    </div>
    : error ? <div style={{ textAlign: "center", padding: 50, maxWidth: 480, margin: "0 auto" }}>
      <div style={{ fontFamily: ft, fontSize: 18, fontWeight: 800, color: C.tx, marginBottom: 8 }}>Connect Buffer</div>
      <div style={{ fontFamily: ft, fontSize: 12, color: C.txm, lineHeight: 1.7, marginBottom: 20 }}>Generate an API key from your Buffer settings.</div>
      <div style={{ padding: "16px 18px", background: C.card, borderRadius: 10, border: "1px solid " + C.border, textAlign: "left", marginBottom: 16 }}>
        <div style={{ fontFamily: mn, fontSize: 10, color: C.tx, lineHeight: 2.2 }}>
          <span style={{ color: C.amber }}>1.</span> Go to publish.buffer.com/settings/api{"\n"}
          <span style={{ color: C.amber }}>2.</span> Generate an API key{"\n"}
          <span style={{ color: C.amber }}>3.</span> Add to Vercel as <span style={{ color: C.amber }}>BUFFER_API_KEY</span>{"\n"}
          <span style={{ color: C.amber }}>4.</span> Redeploy
        </div>
      </div>
      <a href="https://publish.buffer.com/settings/api" target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", fontFamily: ft, fontSize: 13, fontWeight: 700, color: C.bg, background: C.amber, textDecoration: "none", padding: "10px 24px", borderRadius: 8 }}>Get API Key</a>
      {error !== "BUFFER_API_KEY not configured" && <div style={{ fontFamily: mn, fontSize: 9, color: C.coral, marginTop: 14 }}>{error}</div>}
    </div>
    : <div>
      {tab === "calendar" && <CalendarTab posts={allPosts} channels={data.channels} />}
      {tab === "scheduled" && <PostList posts={chanFilter ? (data.scheduled || []).filter(function(p) { return (p.channel ? p.channel.service : "") === chanFilter; }) : data.scheduled || []} channels={data.channels} onDelete={deletePost} showEdit emptyLabel="No scheduled posts" />}
      {tab === "sent" && <PostList posts={data.sent || []} channels={data.channels} emptyLabel="No sent posts" showSearch />}
      {tab === "drafts" && <PostList posts={data.drafts || []} channels={data.channels} onDelete={deletePost} showEdit emptyLabel="No drafts" />}
      {tab === "channels" && <ChannelsTab channels={data.channels} data={data} onFilterChannel={filterByChannel} />}
      {tab === "stats" && <StatsTab data={data} />}
    </div>}

    {compose && <ComposeModal channels={data ? data.channels : []} onClose={function() { setCompose(false); }} onRefresh={load} />}
  </div>);
}
