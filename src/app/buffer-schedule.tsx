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
var platformColor = { twitter: "#1DA1F2", facebook: "#1877F2", linkedin: "#0A66C2", instagram: "#E4405F", pinterest: "#E60023", tiktok: "#00F2EA" };
var platformIcon = { twitter: "\uD83D\uDC26", facebook: "\uD83D\uDCD8", linkedin: "\uD83D\uDCBC", instagram: "\uD83D\uDCF7", pinterest: "\uD83D\uDCCC", tiktok: "\uD83C\uDFB5" };

function TabBtn({ label, active, onClick }) {
  return <div onClick={onClick} style={{ padding: "8px 16px", cursor: "pointer", fontFamily: ft, fontSize: 12, fontWeight: active ? 700 : 500, color: active ? B.accent : B.txm, borderBottom: active ? "2px solid " + B.accent : "2px solid transparent" }}>{label}</div>;
}

// ═══ CALENDAR TAB ═══
function CalendarView({ profiles }) {
  var _month = useState(new Date().getMonth()), month = _month[0], setMonth = _month[1];
  var _year = useState(new Date().getFullYear()), year = _year[0], setYear = _year[1];

  var allPosts = [];
  (profiles || []).forEach(function(p) {
    (p.pending || []).forEach(function(u) { allPosts.push(Object.assign({}, u, { service: p.service, username: p.username, type: "pending" })); });
    (p.sent || []).forEach(function(u) { allPosts.push(Object.assign({}, u, { service: p.service, username: p.username, type: "sent" })); });
  });

  var firstDay = new Date(year, month, 1).getDay();
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  var cells = [];
  for (var i = 0; i < firstDay; i++) cells.push(null);
  for (var d = 1; d <= daysInMonth; d++) cells.push(d);

  var postsOnDay = function(day) {
    return allPosts.filter(function(p) {
      if (!p.due_at) return false;
      var pd = new Date(p.due_at * 1000);
      return pd.getDate() === day && pd.getMonth() === month && pd.getFullYear() === year;
    });
  };

  var prev = function() { if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1); };
  var next = function() { if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1); };

  return (<div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
      <span onClick={prev} style={{ fontFamily: mn, fontSize: 12, color: B.txm, cursor: "pointer", padding: "4px 10px" }}>&larr;</span>
      <div style={{ fontFamily: ft, fontSize: 16, fontWeight: 700, color: B.tx }}>{new Date(year, month).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</div>
      <span onClick={next} style={{ fontFamily: mn, fontSize: 12, color: B.txm, cursor: "pointer", padding: "4px 10px" }}>&rarr;</span>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(function(d) { return <div key={d} style={{ textAlign: "center", fontFamily: mn, fontSize: 9, color: B.txd, padding: 4, fontWeight: 700 }}>{d}</div>; })}
      {cells.map(function(day, ci) {
        if (!day) return <div key={"e" + ci} />;
        var posts = postsOnDay(day);
        var isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
        return <div key={ci} style={{ minHeight: 70, padding: "4px 6px", borderRadius: 6, background: isToday ? B.accent + "12" : B.surface, border: "1px solid " + (isToday ? B.accent + "40" : B.border) }}>
          <div style={{ fontFamily: mn, fontSize: 10, fontWeight: isToday ? 700 : 400, color: isToday ? B.accent : B.tx, marginBottom: 3 }}>{day}</div>
          {posts.slice(0, 3).map(function(p, pi) {
            var pc = platformColor[p.service] || B.txm;
            return <div key={pi} style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 2 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: pc, flexShrink: 0 }} />
              <span style={{ fontFamily: ft, fontSize: 8, color: B.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(p.text || "").slice(0, 30)}</span>
            </div>;
          })}
          {posts.length > 3 && <div style={{ fontFamily: mn, fontSize: 7, color: B.txd }}>+{posts.length - 3} more</div>}
        </div>;
      })}
    </div>
  </div>);
}

// ═══ SCHEDULE TAB ═══
function ScheduleView({ profiles }) {
  var allPending = [];
  (profiles || []).forEach(function(p) {
    (p.pending || []).forEach(function(u) { allPending.push(Object.assign({}, u, { service: p.service, username: p.username })); });
  });
  allPending.sort(function(a, b) { return (a.due_at || 0) - (b.due_at || 0); });

  // Group by day
  var groups = {};
  allPending.forEach(function(p) {
    var key = p.day || "Unscheduled";
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  });

  return (<div>
    {Object.keys(groups).length === 0 && <div style={{ textAlign: "center", padding: 40, fontFamily: ft, fontSize: 13, color: B.txd }}>No scheduled posts in the queue.</div>}
    {Object.keys(groups).map(function(day) {
      return <div key={day} style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: mn, fontSize: 10, color: B.accent, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8, paddingBottom: 4, borderBottom: "1px solid " + B.border }}>{day}</div>
        {groups[day].map(function(post, i) {
          var pc = platformColor[post.service] || B.txm;
          return <div key={i} style={{ display: "flex", gap: 12, padding: "12px 14px", marginBottom: 6, background: B.surface, borderRadius: 8, border: "1px solid " + B.border, borderLeft: "3px solid " + pc }}>
            <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <span style={{ fontSize: 14 }}>{platformIcon[post.service] || "\uD83D\uDCE2"}</span>
              <span style={{ fontFamily: mn, fontSize: 8, color: pc }}>{post.service}</span>
              <span style={{ fontFamily: mn, fontSize: 8, color: B.txd }}>{post.time}</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: ft, fontSize: 12, color: B.tx, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{post.text}</div>
              {post.media && post.media.length > 0 && <div style={{ fontFamily: mn, fontSize: 8, color: B.blue, marginTop: 4 }}>{post.media.length} media attached</div>}
            </div>
          </div>;
        })}
      </div>;
    })}
  </div>);
}

// ═══ ANALYTICS TAB ═══
function AnalyticsView({ profiles }) {
  var totals = { posts: 0, clicks: 0, reach: 0, likes: 0, shares: 0, comments: 0 };
  (profiles || []).forEach(function(p) {
    var a = p.analytics || {};
    totals.posts += a.posts || 0;
    totals.clicks += a.clicks || 0;
    totals.reach += a.reach || 0;
    totals.likes += a.likes || 0;
    totals.shares += a.shares || 0;
    totals.comments += a.comments || 0;
  });

  var fmt = function(n) { if (n >= 1000000) return (n / 1000000).toFixed(1) + "M"; if (n >= 1000) return (n / 1000).toFixed(1) + "K"; return n; };

  return (<div>
    {/* Overview */}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 24 }}>
      {[{ l: "Total Posts", v: totals.posts, c: B.accent }, { l: "Clicks", v: totals.clicks, c: B.blue }, { l: "Reach", v: totals.reach, c: B.green }, { l: "Likes", v: totals.likes, c: "#FF6B6B" }, { l: "Shares", v: totals.shares, c: "#F7B041" }, { l: "Comments", v: totals.comments, c: "#00D4AA" }].map(function(s, i) {
        return <div key={i} style={{ padding: "16px 14px", background: B.surface, borderRadius: 8, border: "1px solid " + B.border, textAlign: "center" }}>
          <div style={{ fontFamily: mn, fontSize: 22, fontWeight: 900, color: s.c }}>{fmt(s.v)}</div>
          <div style={{ fontFamily: mn, fontSize: 9, color: B.txd, textTransform: "uppercase", letterSpacing: 1, marginTop: 4 }}>{s.l}</div>
        </div>;
      })}
    </div>

    {/* Per Platform */}
    <div style={{ fontFamily: mn, fontSize: 10, color: B.accent, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>By Platform</div>
    {(profiles || []).map(function(p, i) {
      var pc = platformColor[p.service] || B.txm;
      var a = p.analytics || {};
      var maxVal = Math.max(a.clicks || 1, a.reach || 1, a.likes || 1);
      return <div key={i} style={{ marginBottom: 14, padding: "14px 16px", background: B.surface, borderRadius: 8, border: "1px solid " + B.border }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 16 }}>{platformIcon[p.service] || "\uD83D\uDCE2"}</span>
          <div>
            <div style={{ fontFamily: ft, fontSize: 13, fontWeight: 700, color: pc }}>{p.username}</div>
            <div style={{ fontFamily: mn, fontSize: 9, color: B.txd }}>{p.service} // {a.posts || 0} posts</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 40px", gap: "6px 10px", alignItems: "center" }}>
          {[{ l: "Clicks", v: a.clicks || 0, c: B.blue }, { l: "Reach", v: a.reach || 0, c: B.green }, { l: "Likes", v: a.likes || 0, c: "#FF6B6B" }, { l: "Shares", v: a.shares || 0, c: "#F7B041" }, { l: "Comments", v: a.comments || 0, c: "#00D4AA" }].map(function(m, mi) {
            var pct = maxVal > 0 ? (m.v / maxVal) * 100 : 0;
            return [
              <div key={"l" + mi} style={{ fontFamily: mn, fontSize: 9, color: B.txm }}>{m.l}</div>,
              <div key={"b" + mi} style={{ height: 6, background: B.border, borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", width: pct + "%", background: m.c, borderRadius: 3 }} /></div>,
              <div key={"v" + mi} style={{ fontFamily: mn, fontSize: 9, color: B.tx, textAlign: "right" }}>{fmt(m.v)}</div>,
            ];
          })}
        </div>
      </div>;
    })}
  </div>);
}

// ═══ MAIN ═══
export default function BufferSchedule() {
  var _tab = useState("calendar"), tab = _tab[0], setTab = _tab[1];
  var _data = useState(null), data = _data[0], setData = _data[1];
  var _loading = useState(true), loading = _loading[0], setLoading = _loading[1];

  var load = useCallback(function() {
    fetch("/api/buffer").then(function(r) { return r.json(); }).then(function(d) {
      if (d.profiles) setData(d);
      setLoading(false);
    }).catch(function() { setLoading(false); });
  }, []);

  useEffect(function() { load(); var iv = setInterval(load, 60000); return function() { clearInterval(iv); }; }, [load]);

  return (<div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
      <div>
        <div style={{ fontFamily: ft, fontSize: 20, fontWeight: 900, color: B.tx }}>Schedule</div>
        <div style={{ fontFamily: mn, fontSize: 9, color: B.txm, marginTop: 1 }}>Buffer queue, calendar, and analytics.</div>
      </div>
      <a href="https://publish.buffer.com" target="_blank" rel="noopener noreferrer" style={{ fontFamily: mn, fontSize: 9, color: B.accent, textDecoration: "none", padding: "5px 10px", border: "1px solid " + B.accent + "30", borderRadius: 5 }}>Open Buffer</a>
    </div>
    <div style={{ display: "flex", borderBottom: "1px solid " + B.border, marginBottom: 20 }}>
      <TabBtn label="Calendar" active={tab === "calendar"} onClick={function() { setTab("calendar"); }} />
      <TabBtn label="Queue" active={tab === "queue"} onClick={function() { setTab("queue"); }} />
      <TabBtn label="Analytics" active={tab === "analytics"} onClick={function() { setTab("analytics"); }} />
    </div>
    {loading ? <div style={{ textAlign: "center", padding: 60, fontFamily: mn, fontSize: 11, color: B.txd }}>Loading Buffer data...</div>
    : !data ? <div style={{ textAlign: "center", padding: 40, maxWidth: 500, margin: "0 auto" }}>
      <div style={{ fontFamily: ft, fontSize: 16, fontWeight: 700, color: B.tx, marginBottom: 10 }}>Buffer Setup Required</div>
      <div style={{ fontFamily: ft, fontSize: 12, color: B.txm, lineHeight: 1.7, marginBottom: 16 }}>Your current token is an OIDC token which Buffer's API doesn't accept directly. You need a classic OAuth access token.</div>
      <div style={{ fontFamily: mn, fontSize: 10, color: B.txd, lineHeight: 2, textAlign: "left", padding: "14px 16px", background: B.surface, borderRadius: 8, border: "1px solid " + B.border }}>
        1. Go to buffer.com/developers/apps/create{"\n"}
        2. Create an app (name: POAST, redirect: https://localhost){"\n"}
        3. Authorize via the OAuth URL with your client_id{"\n"}
        4. Exchange the code for an access_token{"\n"}
        5. Add that token as BUFFER_ACCESS_TOKEN in Vercel
      </div>
      <a href="https://buffer.com/developers/apps/create" target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 14, fontFamily: ft, fontSize: 12, fontWeight: 700, color: B.accent, textDecoration: "none", padding: "8px 16px", border: "1px solid " + B.accent + "40", borderRadius: 6 }}>Go to Buffer Developer Portal</a>
    </div>
    : <div>
      {tab === "calendar" && <CalendarView profiles={data.profiles} />}
      {tab === "queue" && <ScheduleView profiles={data.profiles} />}
      {tab === "analytics" && <AnalyticsView profiles={data.profiles} />}
    </div>}
  </div>);
}
