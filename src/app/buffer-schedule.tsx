// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";

var B = {
  bg: "#06060E", card: "#0C0C18", border: "#161625", surface: "#101020",
  accent: "#7C5CFC", green: "#00D4AA", red: "#FF6B6B", blue: "#3B9EFF", amber: "#F7B041",
  tx: "#E8E6F0", txm: "#8B88A0", txd: "#4A4860",
  glow: "0 0 20px rgba(124,92,252,0.06), 0 0 40px rgba(124,92,252,0.03)",
  glowHover: "0 0 20px rgba(124,92,252,0.12), 0 0 40px rgba(124,92,252,0.06)",
};
var ft = "'Outfit',sans-serif";
var mn = "'JetBrains Mono',monospace";
var PC = { twitter: "#1DA1F2", linkedin: "#0A66C2", facebook: "#1877F2", instagram: "#E4405F", youtube: "#FF0000", tiktok: "#00F2EA", threads: "#000", bluesky: "#0085FF", mastodon: "#6364FF", googlebusiness: "#4285F4", pinterest: "#E60023" };
var PI = { twitter: "\uD83D\uDC26", linkedin: "\uD83D\uDCBC", facebook: "\uD83D\uDCD8", instagram: "\uD83D\uDCF7", youtube: "\u25B6", tiktok: "\uD83C\uDFB5", threads: "\uD83E\uDDF5", bluesky: "\u2601", mastodon: "\uD83D\uDC18" };

function Tab({ label, active, onClick, count }) {
  return <div onClick={onClick} style={{ padding: "10px 18px", cursor: "pointer", fontFamily: ft, fontSize: 13, fontWeight: active ? 700 : 500, color: active ? B.accent : B.txm, borderBottom: active ? "2px solid " + B.accent : "2px solid transparent", display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s" }}>{label}{count !== undefined && count > 0 ? <span style={{ fontFamily: mn, fontSize: 9, background: active ? B.accent + "25" : B.surface, color: active ? B.accent : B.txd, padding: "2px 6px", borderRadius: 10 }}>{count}</span> : null}</div>;
}

// ═══ POST CARD ═══
function PostCard({ post, onDelete }) {
  var svc = post.channel ? post.channel.service : post.channelService || "";
  var pc = PC[svc] || B.txm;
  var time = post.dueAt ? new Date(post.dueAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  var sentTime = post.sentAt ? new Date(post.sentAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div style={{ display: "flex", gap: 14, padding: "16px 18px", background: "linear-gradient(135deg, " + B.card + ", " + B.surface + ")", borderRadius: 10, border: "1px solid " + B.border, borderLeft: "3px solid " + pc, marginBottom: 8, boxShadow: B.glow, transition: "box-shadow 0.3s, border-color 0.3s" }} onMouseEnter={function(e) { e.currentTarget.style.boxShadow = B.glowHover; e.currentTarget.style.borderColor = pc + "40"; }} onMouseLeave={function(e) { e.currentTarget.style.boxShadow = B.glow; e.currentTarget.style.borderColor = B.border; }}>
      <div style={{ flexShrink: 0, textAlign: "center", minWidth: 48 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: pc + "15", border: "1px solid " + pc + "30", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, margin: "0 auto 4px" }}>{PI[svc] || "\uD83D\uDCE2"}</div>
        <div style={{ fontFamily: mn, fontSize: 8, color: pc, fontWeight: 700 }}>{post.channel ? post.channel.name : svc}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: ft, fontSize: 13, color: B.tx, lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 8, wordBreak: "break-word" }}>{post.text || <span style={{ color: B.txd, fontStyle: "italic" }}>(no text)</span>}</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {(post.tags || []).map(function(t, i) { return <span key={i} style={{ fontFamily: mn, fontSize: 8, color: t.color || B.accent, padding: "2px 7px", borderRadius: 4, background: (t.color || B.accent) + "15", fontWeight: 600 }}>{t.name}</span>; })}
          {time && <span style={{ fontFamily: mn, fontSize: 9, color: B.txd }}>{post.status === "sent" ? "Sent " + sentTime : "Due " + time}</span>}
          <span style={{ fontFamily: mn, fontSize: 8, color: post.status === "sent" ? B.green : post.status === "draft" ? B.amber : B.blue, padding: "1px 6px", borderRadius: 3, background: (post.status === "sent" ? B.green : post.status === "draft" ? B.amber : B.blue) + "12" }}>{post.status}</span>
        </div>
      </div>
      {onDelete && <span onClick={function() { onDelete(post.id); }} style={{ fontFamily: mn, fontSize: 9, color: B.txd, cursor: "pointer", padding: "4px 8px", borderRadius: 4, border: "1px solid " + B.border, alignSelf: "flex-start", transition: "color 0.2s" }} onMouseEnter={function(e) { e.currentTarget.style.color = B.red; }} onMouseLeave={function(e) { e.currentTarget.style.color = B.txd; }}>Del</span>}
    </div>
  );
}

// ═══ CALENDAR ═══
function Calendar({ posts }) {
  var _m = useState(new Date().getMonth()), month = _m[0], setMonth = _m[1];
  var _y = useState(new Date().getFullYear()), year = _y[0], setYear = _y[1];
  var fd = new Date(year, month, 1).getDay();
  var dim = new Date(year, month + 1, 0).getDate();
  var cells = []; for (var i = 0; i < fd; i++) cells.push(null); for (var d = 1; d <= dim; d++) cells.push(d);

  var onDay = function(day) { return posts.filter(function(p) { if (!p.dueAt) return false; var pd = new Date(p.dueAt); return pd.getDate() === day && pd.getMonth() === month && pd.getFullYear() === year; }); };

  return (<div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
      <span onClick={function() { if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1); }} style={{ fontFamily: ft, fontSize: 16, color: B.txm, cursor: "pointer", padding: "6px 14px", borderRadius: 6, border: "1px solid " + B.border, transition: "all 0.2s" }}>&larr;</span>
      <div style={{ fontFamily: ft, fontSize: 18, fontWeight: 800, color: B.tx }}>{new Date(year, month).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</div>
      <span onClick={function() { if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1); }} style={{ fontFamily: ft, fontSize: 16, color: B.txm, cursor: "pointer", padding: "6px 14px", borderRadius: 6, border: "1px solid " + B.border }}>&rarr;</span>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(function(d) { return <div key={d} style={{ textAlign: "center", fontFamily: mn, fontSize: 10, color: B.txd, padding: 6, fontWeight: 700 }}>{d}</div>; })}
      {cells.map(function(day, ci) {
        if (!day) return <div key={"e" + ci} />;
        var dp = onDay(day);
        var isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
        var hasPosts = dp.length > 0;
        // Group by platform
        var svcs = {};
        dp.forEach(function(p) { var s = p.channel ? p.channel.service : ""; svcs[s] = (svcs[s] || 0) + 1; });
        return <div key={ci} style={{ minHeight: 90, padding: "6px 8px", borderRadius: 8, background: isToday ? "linear-gradient(135deg, " + B.accent + "12, " + B.accent + "06)" : hasPosts ? "linear-gradient(135deg, " + B.card + ", " + B.surface + ")" : B.surface, border: "1px solid " + (isToday ? B.accent + "50" : hasPosts ? B.green + "20" : B.border), boxShadow: isToday ? "0 0 15px " + B.accent + "10" : "none", transition: "all 0.2s" }}>
          <div style={{ fontFamily: mn, fontSize: 11, fontWeight: isToday ? 800 : 500, color: isToday ? B.accent : B.tx, marginBottom: 4 }}>{day}</div>
          {Object.keys(svcs).map(function(s) {
            var pc = PC[s] || B.txm;
            return <div key={s} style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 2 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: pc, flexShrink: 0 }} />
              <span style={{ fontFamily: mn, fontSize: 8, color: pc }}>{svcs[s]}</span>
            </div>;
          })}
        </div>;
      })}
    </div>
  </div>);
}

// ═══ CHANNELS ═══
function Channels({ channels }) {
  return (<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
    {(channels || []).map(function(ch) {
      var pc = PC[ch.service] || B.txm;
      return <div key={ch.id} style={{ padding: "16px 18px", background: "linear-gradient(135deg, " + B.card + ", " + B.surface + ")", borderRadius: 10, border: "1px solid " + B.border, borderLeft: "3px solid " + pc, boxShadow: B.glow, transition: "box-shadow 0.3s" }} onMouseEnter={function(e) { e.currentTarget.style.boxShadow = B.glowHover; }} onMouseLeave={function(e) { e.currentTarget.style.boxShadow = B.glow; }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: pc + "15", border: "1px solid " + pc + "30", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{PI[ch.service] || "\uD83D\uDCE2"}</div>
          <div>
            <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: pc }}>{ch.name}</div>
            <div style={{ fontFamily: mn, fontSize: 9, color: B.txd }}>{ch.service} // {ch.timezone}</div>
          </div>
          {ch.isDisconnected && <span style={{ fontFamily: mn, fontSize: 8, color: B.red, marginLeft: "auto", padding: "2px 6px", borderRadius: 3, background: B.red + "15" }}>Disconnected</span>}
        </div>
      </div>;
    })}
  </div>);
}

// ═══ STATS ═══
function Stats({ data }) {
  var scheduled = (data.scheduled || []).length;
  var sent = (data.sent || []).length;
  var drafts = (data.drafts || []).length;
  var channels = (data.channels || []).length;

  // Platform breakdown
  var byPlat = {};
  (data.scheduled || []).concat(data.sent || []).forEach(function(p) {
    var s = p.channel ? p.channel.service : p.channelService || "unknown";
    if (!byPlat[s]) byPlat[s] = { scheduled: 0, sent: 0 };
    if (p.status === "sent") byPlat[s].sent++; else byPlat[s].scheduled++;
  });

  return (<div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
      {[{ l: "Scheduled", v: scheduled, c: B.blue, ic: "\uD83D\uDCC5" }, { l: "Sent", v: sent, c: B.green, ic: "\u2705" }, { l: "Drafts", v: drafts, c: B.amber, ic: "\uD83D\uDCDD" }, { l: "Channels", v: channels, c: B.accent, ic: "\uD83D\uDCE2" }].map(function(s, i) {
        return <div key={i} style={{ padding: "20px 16px", background: "linear-gradient(135deg, " + B.card + ", " + s.c + "08)", borderRadius: 10, border: "1px solid " + s.c + "20", textAlign: "center", boxShadow: "0 0 20px " + s.c + "06" }}>
          <div style={{ fontSize: 20, marginBottom: 6 }}>{s.ic}</div>
          <div style={{ fontFamily: mn, fontSize: 28, fontWeight: 900, color: s.c }}>{s.v}</div>
          <div style={{ fontFamily: mn, fontSize: 9, color: B.txd, textTransform: "uppercase", letterSpacing: 1, marginTop: 4 }}>{s.l}</div>
        </div>;
      })}
    </div>

    <div style={{ fontFamily: mn, fontSize: 10, color: B.accent, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 14 }}>By Platform</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
      {Object.keys(byPlat).sort().map(function(s) {
        var d = byPlat[s];
        var pc = PC[s] || B.txm;
        var total = d.scheduled + d.sent;
        var pct = total > 0 ? (d.sent / total) * 100 : 0;
        return <div key={s} style={{ padding: "14px 16px", background: "linear-gradient(135deg, " + B.card + ", " + B.surface + ")", borderRadius: 8, border: "1px solid " + B.border, boxShadow: B.glow }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 16 }}>{PI[s] || "\uD83D\uDCE2"}</span>
            <span style={{ fontFamily: ft, fontSize: 13, fontWeight: 700, color: pc }}>{s}</span>
            <span style={{ fontFamily: mn, fontSize: 9, color: B.txd, marginLeft: "auto" }}>{total} posts</span>
          </div>
          <div style={{ height: 6, background: B.border, borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
            <div style={{ height: "100%", width: pct + "%", background: "linear-gradient(90deg, " + pc + ", " + pc + "80)", borderRadius: 3, transition: "width 0.5s ease" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: mn, fontSize: 9 }}>
            <span style={{ color: B.blue }}>{d.scheduled} queued</span>
            <span style={{ color: B.green }}>{d.sent} sent</span>
          </div>
        </div>;
      })}
    </div>
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
      setData(d); setError(null); setLoading(false);
    }).catch(function(e) { setError(String(e)); setLoading(false); });
  }, []);

  useEffect(function() { load(); var iv = setInterval(load, 60000); return function() { clearInterval(iv); }; }, [load]);

  var deletePost = function(postId) {
    fetch("/api/buffer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "deletePost", postId: postId }) }).then(function() { load(); });
  };

  var allPosts = data ? (data.scheduled || []).concat(data.sent || []) : [];

  return (<div>
    <style dangerouslySetInnerHTML={{ __html: "@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');" }} />

    {/* Header */}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
      <div>
        <div style={{ fontFamily: ft, fontSize: 22, fontWeight: 900, color: B.tx, letterSpacing: -0.5 }}>Schedule</div>
        <div style={{ fontFamily: mn, fontSize: 9, color: B.txm, marginTop: 2 }}>
          {data ? (data.channels || []).length + " channels connected // " + (data.scheduled || []).length + " queued // " + (data.sent || []).length + " sent" : "Loading..."}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span onClick={load} style={{ fontFamily: mn, fontSize: 9, color: B.accent, cursor: "pointer", padding: "6px 12px", borderRadius: 6, border: "1px solid " + B.accent + "30", background: B.accent + "08", transition: "all 0.2s" }}>Refresh</span>
        <a href="https://publish.buffer.com" target="_blank" rel="noopener noreferrer" style={{ fontFamily: mn, fontSize: 9, color: B.txd, textDecoration: "none", padding: "6px 12px", border: "1px solid " + B.border, borderRadius: 6 }}>Open Buffer</a>
      </div>
    </div>

    {/* Tabs */}
    <div style={{ display: "flex", borderBottom: "1px solid " + B.border, marginBottom: 24 }}>
      <Tab label="Calendar" active={tab === "calendar"} onClick={function() { setTab("calendar"); }} />
      <Tab label="Scheduled" active={tab === "scheduled"} onClick={function() { setTab("scheduled"); }} count={data ? (data.scheduled || []).length : 0} />
      <Tab label="Sent" active={tab === "sent"} onClick={function() { setTab("sent"); }} count={data ? (data.sent || []).length : 0} />
      <Tab label="Drafts" active={tab === "drafts"} onClick={function() { setTab("drafts"); }} count={data ? (data.drafts || []).length : 0} />
      <Tab label="Channels" active={tab === "channels"} onClick={function() { setTab("channels"); }} count={data ? (data.channels || []).length : 0} />
      <Tab label="Stats" active={tab === "stats"} onClick={function() { setTab("stats"); }} />
    </div>

    {/* Content */}
    {loading ? <div style={{ textAlign: "center", padding: 80 }}>
      <style dangerouslySetInnerHTML={{ __html: "@keyframes bufLoad{0%{opacity:0.3}50%{opacity:1}100%{opacity:0.3}}" }} />
      <div style={{ fontFamily: mn, fontSize: 12, color: B.accent, animation: "bufLoad 1.5s ease-in-out infinite" }}>Loading Buffer...</div>
    </div>
    : error ? <div style={{ textAlign: "center", padding: 50, maxWidth: 480, margin: "0 auto" }}>
      <div style={{ width: 60, height: 60, borderRadius: 14, background: B.accent + "15", border: "1px solid " + B.accent + "30", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px" }}>{"\uD83D\uDD17"}</div>
      <div style={{ fontFamily: ft, fontSize: 18, fontWeight: 800, color: B.tx, marginBottom: 8 }}>Connect Buffer</div>
      <div style={{ fontFamily: ft, fontSize: 12, color: B.txm, lineHeight: 1.7, marginBottom: 20 }}>Generate an API key from Buffer's settings to connect your posting schedule.</div>
      <div style={{ padding: "16px 18px", background: B.surface, borderRadius: 10, border: "1px solid " + B.border, textAlign: "left", marginBottom: 16 }}>
        <div style={{ fontFamily: mn, fontSize: 10, color: B.tx, lineHeight: 2.2 }}>
          <span style={{ color: B.accent }}>1.</span> Go to publish.buffer.com/settings/api{"\n"}
          <span style={{ color: B.accent }}>2.</span> Generate an API key{"\n"}
          <span style={{ color: B.accent }}>3.</span> Add to Vercel as <span style={{ color: B.accent }}>BUFFER_API_KEY</span>{"\n"}
          <span style={{ color: B.accent }}>4.</span> Redeploy
        </div>
      </div>
      <a href="https://publish.buffer.com/settings/api" target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", fontFamily: ft, fontSize: 13, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg, " + B.accent + ", " + B.blue + ")", textDecoration: "none", padding: "10px 24px", borderRadius: 8, boxShadow: "0 0 20px " + B.accent + "30" }}>Get API Key</a>
      {error !== "BUFFER_API_KEY not configured" && <div style={{ fontFamily: mn, fontSize: 9, color: B.red, marginTop: 14 }}>{error}</div>}
    </div>
    : <div>
      {tab === "calendar" && <Calendar posts={allPosts} />}
      {tab === "scheduled" && <div>{(data.scheduled || []).length === 0 ? <div style={{ textAlign: "center", padding: 50, color: B.txd, fontFamily: ft, fontSize: 13 }}>No scheduled posts</div> : (data.scheduled || []).map(function(p) { return <PostCard key={p.id} post={p} onDelete={deletePost} />; })}</div>}
      {tab === "sent" && <div>{(data.sent || []).length === 0 ? <div style={{ textAlign: "center", padding: 50, color: B.txd, fontFamily: ft, fontSize: 13 }}>No sent posts</div> : (data.sent || []).map(function(p) { return <PostCard key={p.id} post={p} />; })}</div>}
      {tab === "drafts" && <div>{(data.drafts || []).length === 0 ? <div style={{ textAlign: "center", padding: 50, color: B.txd, fontFamily: ft, fontSize: 13 }}>No drafts</div> : (data.drafts || []).map(function(p) { return <PostCard key={p.id} post={p} onDelete={deletePost} />; })}</div>}
      {tab === "channels" && <Channels channels={data.channels} />}
      {tab === "stats" && <Stats data={data} />}
    </div>}
  </div>);
}
