// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";

var B = {
  bg: "#06060E", card: "#0C0C18", border: "#161625", surface: "#101020",
  accent: "#7C5CFC", green: "#00D4AA", red: "#FF6B6B", blue: "#3B9EFF",
  tx: "#E8E6F0", txm: "#8B88A0", txd: "#4A4860",
};
var ft = "'Outfit',sans-serif";
var mn = "'JetBrains Mono',monospace";
var platformColor = { twitter: "#1DA1F2", linkedin: "#0A66C2", facebook: "#1877F2", instagram: "#E4405F", youtube: "#FF0000", tiktok: "#00F2EA", pinterest: "#E60023", mastodon: "#6364FF", bluesky: "#0085FF", threads: "#000", googlebusiness: "#4285F4" };
var platformIcon = { twitter: "\uD83D\uDC26", linkedin: "\uD83D\uDCBC", facebook: "\uD83D\uDCD8", instagram: "\uD83D\uDCF7", youtube: "\u25B6", tiktok: "\uD83C\uDFB5", pinterest: "\uD83D\uDCCC", mastodon: "\uD83D\uDC18", bluesky: "\u2601", threads: "\uD83E\uDDF5" };

function TabBtn({ label, active, onClick, badge }) {
  return <div onClick={onClick} style={{ padding: "8px 16px", cursor: "pointer", fontFamily: ft, fontSize: 12, fontWeight: active ? 700 : 500, color: active ? B.accent : B.txm, borderBottom: active ? "2px solid " + B.accent : "2px solid transparent", display: "flex", gap: 6, alignItems: "center" }}>{label}{badge ? <span style={{ fontFamily: mn, fontSize: 8, background: B.accent + "20", color: B.accent, padding: "1px 5px", borderRadius: 3 }}>{badge}</span> : null}</div>;
}

// ═══ CALENDAR TAB ═══
function CalendarView({ posts }) {
  var _month = useState(new Date().getMonth()), month = _month[0], setMonth = _month[1];
  var _year = useState(new Date().getFullYear()), year = _year[0], setYear = _year[1];

  var firstDay = new Date(year, month, 1).getDay();
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  var cells = [];
  for (var i = 0; i < firstDay; i++) cells.push(null);
  for (var d = 1; d <= daysInMonth; d++) cells.push(d);

  var postsOnDay = function(day) {
    return posts.filter(function(p) {
      if (!p.dueAt) return false;
      var pd = new Date(p.dueAt);
      return pd.getDate() === day && pd.getMonth() === month && pd.getFullYear() === year;
    });
  };

  return (<div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
      <span onClick={function() { if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1); }} style={{ fontFamily: mn, fontSize: 14, color: B.txm, cursor: "pointer", padding: "4px 12px" }}>&larr;</span>
      <div style={{ fontFamily: ft, fontSize: 16, fontWeight: 700, color: B.tx }}>{new Date(year, month).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</div>
      <span onClick={function() { if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1); }} style={{ fontFamily: mn, fontSize: 14, color: B.txm, cursor: "pointer", padding: "4px 12px" }}>&rarr;</span>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(function(d) { return <div key={d} style={{ textAlign: "center", fontFamily: mn, fontSize: 9, color: B.txd, padding: 4, fontWeight: 700 }}>{d}</div>; })}
      {cells.map(function(day, ci) {
        if (!day) return <div key={"e" + ci} />;
        var dayPosts = postsOnDay(day);
        var isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
        return <div key={ci} style={{ minHeight: 80, padding: "4px 6px", borderRadius: 6, background: isToday ? B.accent + "12" : B.surface, border: "1px solid " + (isToday ? B.accent + "40" : dayPosts.length > 0 ? B.green + "25" : B.border) }}>
          <div style={{ fontFamily: mn, fontSize: 10, fontWeight: isToday ? 700 : 400, color: isToday ? B.accent : B.tx, marginBottom: 3 }}>{day}</div>
          {dayPosts.slice(0, 3).map(function(p, pi) {
            var svc = p.channel ? p.channel.service : "";
            var pc = platformColor[svc] || B.txm;
            return <div key={pi} style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 2 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: pc, flexShrink: 0 }} />
              <span style={{ fontFamily: ft, fontSize: 8, color: B.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(p.text || "").slice(0, 25)}</span>
            </div>;
          })}
          {dayPosts.length > 3 && <div style={{ fontFamily: mn, fontSize: 7, color: B.txd }}>+{dayPosts.length - 3}</div>}
        </div>;
      })}
    </div>
  </div>);
}

// ═══ QUEUE TAB ═══
function QueueView({ posts, label }) {
  if (posts.length === 0) return <div style={{ textAlign: "center", padding: 40, fontFamily: ft, fontSize: 13, color: B.txd }}>No {label || "posts"} found.</div>;

  // Group by date
  var grouped = {};
  posts.forEach(function(p) {
    var d = p.dueAt ? new Date(p.dueAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "No date";
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(p);
  });

  return (<div>
    {Object.keys(grouped).map(function(day) {
      return <div key={day} style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: mn, fontSize: 10, color: B.accent, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8, paddingBottom: 4, borderBottom: "1px solid " + B.border }}>{day}</div>
        {grouped[day].map(function(post) {
          var svc = post.channel ? post.channel.service : "";
          var pc = platformColor[svc] || B.txm;
          var time = post.dueAt ? new Date(post.dueAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "";
          return <div key={post.id} style={{ display: "flex", gap: 12, padding: "12px 14px", marginBottom: 6, background: B.surface, borderRadius: 8, border: "1px solid " + B.border, borderLeft: "3px solid " + pc }}>
            <div style={{ flexShrink: 0, textAlign: "center", minWidth: 44 }}>
              <span style={{ fontSize: 16 }}>{platformIcon[svc] || "\uD83D\uDCE2"}</span>
              <div style={{ fontFamily: mn, fontSize: 8, color: pc, marginTop: 2 }}>{post.channel ? post.channel.name : svc}</div>
              {time && <div style={{ fontFamily: mn, fontSize: 8, color: B.txd }}>{time}</div>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: ft, fontSize: 12, color: B.tx, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{post.text}</div>
              <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                {(post.tags || []).map(function(t, ti) { return <span key={ti} style={{ fontFamily: mn, fontSize: 7, color: t.color || B.txm, padding: "1px 5px", borderRadius: 3, background: (t.color || B.txm) + "15" }}>{t.name}</span>; })}
                <span style={{ fontFamily: mn, fontSize: 7, color: post.status === "sent" ? B.green : B.txd }}>{post.status}</span>
              </div>
            </div>
          </div>;
        })}
      </div>;
    })}
  </div>);
}

// ═══ CHANNELS TAB ═══
function ChannelsView({ channels }) {
  if (!channels || channels.length === 0) return <div style={{ textAlign: "center", padding: 40, fontFamily: ft, fontSize: 13, color: B.txd }}>No channels connected.</div>;
  return (<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 10 }}>
    {channels.map(function(ch) {
      var pc = platformColor[ch.service] || B.txm;
      return <div key={ch.id} style={{ padding: "14px 16px", background: B.surface, borderRadius: 8, border: "1px solid " + B.border, borderLeft: "3px solid " + pc }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 18 }}>{platformIcon[ch.service] || "\uD83D\uDCE2"}</span>
          <div>
            <div style={{ fontFamily: ft, fontSize: 13, fontWeight: 700, color: pc }}>{ch.name}</div>
            <div style={{ fontFamily: mn, fontSize: 9, color: B.txd }}>{ch.service} // {ch.timezone}</div>
          </div>
        </div>
        {ch.isDisconnected && <div style={{ fontFamily: mn, fontSize: 9, color: B.red }}>Disconnected</div>}
      </div>;
    })}
  </div>);
}

// ═══ MAIN ═══
export default function BufferSchedule() {
  var _tab = useState("calendar"), tab = _tab[0], setTab = _tab[1];
  var _data = useState(null), data = _data[0], setData = _data[1];
  var _loading = useState(true), loading = _loading[0], setLoading = _loading[1];
  var _error = useState(null), error = _error[0], setError = _error[1];

  var load = useCallback(function() {
    fetch("/api/buffer").then(function(r) { return r.json(); }).then(function(d) {
      if (d.error) { setError(d.error); setLoading(false); return; }
      setData(d);
      setError(null);
      setLoading(false);
    }).catch(function(e) { setError(String(e)); setLoading(false); });
  }, []);

  useEffect(function() { load(); var iv = setInterval(load, 60000); return function() { clearInterval(iv); }; }, [load]);

  var allPosts = data ? (data.scheduled || []).concat(data.sent || []) : [];

  return (<div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
      <div>
        <div style={{ fontFamily: ft, fontSize: 20, fontWeight: 900, color: B.tx }}>Schedule</div>
        <div style={{ fontFamily: mn, fontSize: 9, color: B.txm, marginTop: 1 }}>Buffer queue, calendar, channels, and history.</div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span onClick={load} style={{ fontFamily: mn, fontSize: 9, color: B.accent, cursor: "pointer", padding: "5px 10px", border: "1px solid " + B.accent + "30", borderRadius: 5 }}>Refresh</span>
        <a href="https://publish.buffer.com" target="_blank" rel="noopener noreferrer" style={{ fontFamily: mn, fontSize: 9, color: B.txd, textDecoration: "none", padding: "5px 10px", border: "1px solid " + B.border, borderRadius: 5 }}>Open Buffer</a>
      </div>
    </div>

    <div style={{ display: "flex", borderBottom: "1px solid " + B.border, marginBottom: 20 }}>
      <TabBtn label="Calendar" active={tab === "calendar"} onClick={function() { setTab("calendar"); }} />
      <TabBtn label="Scheduled" active={tab === "scheduled"} onClick={function() { setTab("scheduled"); }} badge={data ? (data.scheduled || []).length : null} />
      <TabBtn label="Sent" active={tab === "sent"} onClick={function() { setTab("sent"); }} badge={data ? (data.sent || []).length : null} />
      <TabBtn label="Channels" active={tab === "channels"} onClick={function() { setTab("channels"); }} badge={data ? (data.channels || []).length : null} />
    </div>

    {loading ? <div style={{ textAlign: "center", padding: 60, fontFamily: mn, fontSize: 11, color: B.txd }}>Loading Buffer...</div>
    : error ? <div style={{ textAlign: "center", padding: 40, maxWidth: 480, margin: "0 auto" }}>
      <div style={{ fontFamily: ft, fontSize: 16, fontWeight: 700, color: B.tx, marginBottom: 8 }}>Connect Buffer</div>
      <div style={{ fontFamily: ft, fontSize: 12, color: B.txm, lineHeight: 1.7, marginBottom: 16 }}>Buffer's new GraphQL API uses a simple API key. Generate one from your Buffer settings.</div>
      <div style={{ fontFamily: mn, fontSize: 10, color: B.txd, lineHeight: 2, textAlign: "left", padding: "14px 16px", background: B.surface, borderRadius: 8, border: "1px solid " + B.border, marginBottom: 14 }}>
        1. Go to publish.buffer.com/settings/api{"\n"}
        2. Generate an API key{"\n"}
        3. Add it to Vercel as <span style={{ color: B.accent }}>BUFFER_API_KEY</span>{"\n"}
        4. Redeploy
      </div>
      <a href="https://publish.buffer.com/settings/api" target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", fontFamily: ft, fontSize: 12, fontWeight: 700, color: "#fff", background: B.accent, textDecoration: "none", padding: "8px 20px", borderRadius: 6 }}>Get API Key</a>
      {error !== "BUFFER_API_KEY not configured" && <div style={{ fontFamily: mn, fontSize: 9, color: B.red, marginTop: 12 }}>Error: {error}</div>}
    </div>
    : <div>
      {tab === "calendar" && <CalendarView posts={allPosts} />}
      {tab === "scheduled" && <QueueView posts={data.scheduled || []} label="scheduled posts" />}
      {tab === "sent" && <QueueView posts={data.sent || []} label="sent posts" />}
      {tab === "channels" && <ChannelsView channels={data.channels || []} />}
    </div>}
  </div>);
}
