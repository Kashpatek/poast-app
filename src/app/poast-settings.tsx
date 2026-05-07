"use client";
import { useEffect, useState } from "react";
import { Bug, BarChart3, RefreshCw, CheckCircle, Circle, HelpCircle } from "lucide-react";
import { D as C, ft, mn, gf } from "./shared-constants";
import { useOnboarding } from "./onboarding-context";
import { showToast } from "./toast-context";
import { STEP_WELCOME, STEP_CHART2_DEEP } from "./onboarding/tours";

interface PoastEvent {
  event: string;
  user: string;
  role: string;
  sec: string | null;
  payload: Record<string, unknown>;
  ts: number;
}

interface BugItem {
  id: string;
  title: string;
  body: string;
  user: string;
  role: string;
  sec: string | null;
  ts: number;
  status: "open" | "fixed";
}

type AnalyticsFilter = "all" | "today" | "7d" | "analyst";

// POAST Settings page · Director / Marketing / Social Media Manager.
// Two tabs: Analytics (usage metrics) and Bugs (analyst submissions).
export default function PoastSettings() {
  var _t = useState<"analytics" | "bugs" | "onboarding">("analytics"), tab = _t[0], setTab = _t[1];

  return (
    <div style={{ padding: "32px 0 0", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: gf, fontSize: 28, fontWeight: 900, color: C.tx, letterSpacing: -0.5 }}>POAST Settings</div>
        <div style={{ fontFamily: mn, fontSize: 10, color: C.txm, marginTop: 4, letterSpacing: 1 }}>USAGE ANALYTICS // BUG REPORTS // ONBOARDING</div>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid " + C.border }}>
        {([
          { id: "analytics" as const, l: "Analytics", Icon: BarChart3 },
          { id: "bugs" as const, l: "Bugs", Icon: Bug },
          { id: "onboarding" as const, l: "Onboarding", Icon: HelpCircle },
        ]).map(function(t) {
          var on = tab === t.id;
          return <div key={t.id} onClick={function() { setTab(t.id); }} style={{
            padding: "10px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
            borderBottom: on ? "2px solid " + C.amber : "2px solid transparent",
            color: on ? C.amber : C.txm,
            fontFamily: ft, fontSize: 13, fontWeight: on ? 800 : 500, transition: "all 0.2s",
          }}>
            <t.Icon size={14} strokeWidth={on ? 2.2 : 1.8} />
            {t.l}
          </div>;
        })}
      </div>

      {tab === "analytics" && <AnalyticsTab />}
      {tab === "bugs" && <BugsTab />}
      {tab === "onboarding" && <OnboardingTab />}
    </div>
  );
}

function OnboardingTab() {
  const { reset, setActiveStep } = useOnboarding();

  function replayWelcome() {
    setActiveStep(STEP_WELCOME);
    showToast("Welcome tour started.");
  }

  function replayChart() {
    setActiveStep(STEP_CHART2_DEEP);
    showToast("Open Chart Maker 2 to see the tour.");
  }

  function resetAll() {
    reset();
    showToast("Onboarding flags cleared. New tools will introduce themselves again.");
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
      <Card title="Replay welcome tour" body="Reopen the four-step welcome modal that new analysts see on first login. Useful for demos or onboarding new teammates one screen at a time.">
        <ActionButton onClick={replayWelcome}>Replay welcome</ActionButton>
      </Card>
      <Card title="Replay Chart Maker 2 tour" body="Walk through the spreadsheet, chart types, annotations, themes, and export flow inside Chart Maker 2.">
        <ActionButton onClick={replayChart}>Replay chart tour</ActionButton>
      </Card>
      <Card title="Reset all onboarding flags" body="Clears the &lsquo;seen&rsquo; markers for every tour and coach mark on this device. Next visit to each tool re-introduces itself.">
        <ActionButton onClick={resetAll} variant="danger">Reset all flags</ActionButton>
      </Card>
    </div>
  );
}

function Card({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: 18, boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}>
      <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 800, color: C.tx, marginBottom: 6 }}>{title}</div>
      <div style={{ fontFamily: ft, fontSize: 13, color: C.txm, lineHeight: 1.55, marginBottom: 14 }}>{body}</div>
      {children}
    </div>
  );
}

function ActionButton({ onClick, children, variant }: { onClick: () => void; children: React.ReactNode; variant?: "danger" }) {
  const isDanger = variant === "danger";
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: isDanger ? "transparent" : C.amber,
        color: isDanger ? C.coral : "#060608",
        border: isDanger ? "1px solid " + C.border : "none",
        padding: "8px 14px",
        borderRadius: 8,
        fontFamily: ft,
        fontSize: 13,
        fontWeight: isDanger ? 600 : 800,
        cursor: "pointer",
        letterSpacing: 0.2,
      }}
    >
      {children}
    </button>
  );
}

function AnalyticsTab() {
  var _e = useState<PoastEvent[] | null>(null), events = _e[0], setEvents = _e[1];
  var _r = useState(false), refreshing = _r[0], setRefreshing = _r[1];
  var _f = useState<AnalyticsFilter>("all"), filter = _f[0], setFilter = _f[1];

  var load = async function() {
    setRefreshing(true);
    try {
      var r = await fetch("/api/poast-events");
      var d = await r.json() as { events?: PoastEvent[] };
      setEvents(d.events || []);
    } catch (e) {
      setEvents([]);
    } finally { setRefreshing(false); }
  };
  useEffect(function() { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  if (!events) return <div style={{ color: C.txd, fontFamily: mn, fontSize: 11 }}>Loading...</div>;

  var now = Date.now();
  var dayMs = 86400000;
  var filtered = events.filter(function(e) {
    if (filter === "today") return e.ts > now - dayMs;
    if (filter === "7d") return e.ts > now - dayMs * 7;
    if (filter === "analyst") return e.role === "Analyst";
    return true;
  });

  var byEvent: Record<string, number> = {};
  var byUser: Record<string, number> = {};
  var bySec: Record<string, number> = {};
  var sessions: Record<string, true> = {};
  var totalGenerates = 0;
  var totalExports = 0;
  for (var i = 0; i < filtered.length; i++) {
    var e = filtered[i];
    byEvent[e.event] = (byEvent[e.event] || 0) + 1;
    if (e.user) byUser[e.user] = (byUser[e.user] || 0) + 1;
    if (e.sec) bySec[e.sec] = (bySec[e.sec] || 0) + 1;
    if (e.event === "session") sessions[e.user + "-" + Math.floor(e.ts / (1800 * 1000))] = true;
    if (e.event === "generate") totalGenerates++;
    if (e.event === "export") totalExports++;
  }

  // Pair successive view events per user to estimate time on tool.
  var sortedViews = filtered.filter(function(e) { return e.event === "view"; }).sort(function(a, b) { return a.ts - b.ts; });
  var timeBySec: Record<string, number> = {};
  var byUserViews: Record<string, PoastEvent[]> = {};
  for (var j = 0; j < sortedViews.length; j++) {
    var v = sortedViews[j];
    if (!byUserViews[v.user]) byUserViews[v.user] = [];
    byUserViews[v.user].push(v);
  }
  Object.keys(byUserViews).forEach(function(u) {
    var arr = byUserViews[u];
    for (var k = 0; k < arr.length - 1; k++) {
      var cur = arr[k], next = arr[k + 1];
      if (cur.sec) {
        var dur = Math.min(next.ts - cur.ts, 30 * 60 * 1000);
        if (dur > 0) timeBySec[cur.sec] = (timeBySec[cur.sec] || 0) + dur;
      }
    }
  });

  var fmtMs = function(ms: number) {
    var sec = Math.floor(ms / 1000);
    if (sec < 60) return sec + "s";
    var m = Math.floor(sec / 60);
    if (m < 60) return m + "m";
    return Math.floor(m / 60) + "h " + (m % 60) + "m";
  };

  var topSec = Object.entries(bySec).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 8).map(function(p) { return { label: p[0], value: String(p[1]) }; });
  var topUsers = Object.entries(byUser).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 8).map(function(p) { return { label: p[0], value: String(p[1]) }; });
  var timeRows = Object.entries(timeBySec).sort(function(a, b) { return b[1] - a[1]; }).map(function(p) { return { label: p[0], value: fmtMs(p[1]) }; });

  return <div>
    <div style={{ display: "flex", gap: 6, marginBottom: 18, alignItems: "center", flexWrap: "wrap" }}>
      {([
        { id: "all" as const, l: "All time" },
        { id: "today" as const, l: "Today" },
        { id: "7d" as const, l: "Last 7 days" },
        { id: "analyst" as const, l: "Analyst only" },
      ]).map(function(f) {
        var on = filter === f.id;
        return <span key={f.id} onClick={function() { setFilter(f.id); }} style={{
          padding: "5px 12px", borderRadius: 999, cursor: "pointer",
          fontFamily: mn, fontSize: 10, fontWeight: 700,
          background: on ? C.amber + "20" : "transparent",
          border: "1px solid " + (on ? C.amber + "60" : C.border),
          color: on ? C.amber : C.txm,
          letterSpacing: 0.5,
        }}>{f.l}</span>;
      })}
      <span onClick={load} style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", cursor: "pointer", color: C.txm, fontFamily: mn, fontSize: 10, fontWeight: 600 }}>
        <RefreshCw size={11} strokeWidth={2} className={refreshing ? "ps-rot" : ""} />
        Refresh
      </span>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
      <Stat label="Sessions" value={Object.keys(sessions).length} />
      <Stat label="Tool views" value={byEvent.view || 0} />
      <Stat label="Generates" value={totalGenerates} />
      <Stat label="Exports" value={totalExports} />
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
      <ListCard title="Top tools" rows={topSec} />
      <ListCard title="Top users" rows={topUsers} />
    </div>

    <ListCard title="Time on tool" rows={timeRows} />

    <div style={{ marginTop: 24, fontFamily: mn, fontSize: 10, color: C.txm, letterSpacing: 1, marginBottom: 8 }}>RECENT EVENTS · LAST 50</div>
    <div style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: 10, maxHeight: 360, overflow: "auto" }}>
      {filtered.slice(0, 50).map(function(e, i) {
        return <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", borderBottom: i < Math.min(filtered.length, 50) - 1 ? "1px solid " + C.border : "none", fontFamily: mn, fontSize: 11 }}>
          <span style={{ width: 110, color: C.txd, flexShrink: 0 }}>{new Date(e.ts).toLocaleString(undefined, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
          <span style={{ width: 70, color: C.amber, fontWeight: 700, flexShrink: 0 }}>{e.event}</span>
          <span style={{ width: 90, color: C.tx, flexShrink: 0 }}>{e.user}</span>
          <span style={{ width: 80, color: C.txm, flexShrink: 0 }}>{e.sec || "-"}</span>
          <span style={{ flex: 1, color: C.txd, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {Object.keys(e.payload || {}).length > 0 ? JSON.stringify(e.payload) : ""}
          </span>
        </div>;
      })}
      {filtered.length === 0 && <div style={{ padding: 20, textAlign: "center", color: C.txd, fontFamily: ft, fontSize: 12 }}>No events match this filter yet.</div>}
    </div>

    <style>{`.ps-rot{animation:psrot 1s linear infinite}@keyframes psrot{to{transform:rotate(360deg)}}`}</style>
  </div>;
}

function BugsTab() {
  var _b = useState<BugItem[] | null>(null), bugs = _b[0], setBugs = _b[1];
  var _f = useState<"all" | "open" | "fixed">("all"), filter = _f[0], setFilter = _f[1];

  var load = async function() {
    try {
      var r = await fetch("/api/bugs");
      var d = await r.json() as { bugs?: BugItem[] };
      setBugs(d.bugs || []);
    } catch (e) {
      setBugs([]);
    }
  };
  useEffect(function() { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  if (!bugs) return <div style={{ color: C.txd, fontFamily: mn, fontSize: 11 }}>Loading...</div>;

  var filtered = bugs.filter(function(b) { return filter === "all" || b.status === filter; });
  var openCount = bugs.filter(function(b) { return b.status === "open"; }).length;
  var fixedCount = bugs.filter(function(b) { return b.status === "fixed"; }).length;

  var toggle = async function(id: string, status: "open" | "fixed") {
    await fetch("/api/bugs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: id, status: status === "open" ? "fixed" : "open" }),
    }).catch(function() {});
    load();
  };

  return <div>
    <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
      {([
        { id: "all" as const, l: "All", count: bugs.length },
        { id: "open" as const, l: "Open", count: openCount },
        { id: "fixed" as const, l: "Fixed", count: fixedCount },
      ]).map(function(f) {
        var on = filter === f.id;
        return <span key={f.id} onClick={function() { setFilter(f.id); }} style={{
          padding: "5px 12px", borderRadius: 999, cursor: "pointer",
          fontFamily: mn, fontSize: 10, fontWeight: 700,
          background: on ? "#E0634720" : "transparent",
          border: "1px solid " + (on ? "#E0634760" : C.border),
          color: on ? "#E06347" : C.txm,
          letterSpacing: 0.5,
        }}>{f.l} <span style={{ opacity: 0.6, marginLeft: 4 }}>({f.count})</span></span>;
      })}
    </div>

    {filtered.length === 0 && <div style={{ padding: 40, textAlign: "center", fontFamily: ft, fontSize: 12, color: C.txd }}>No bugs match this filter.</div>}

    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {filtered.map(function(b) {
        var open = b.status === "open";
        return <div key={b.id} style={{ background: C.surface, border: "1px solid " + (open ? "#E0634740" : "#2EAD8E40"), borderLeft: "3px solid " + (open ? "#E06347" : "#2EAD8E"), borderRadius: 10, padding: "14px 18px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 800, color: C.tx, marginBottom: 4 }}>{b.title || "(untitled)"}</div>
              <div style={{ fontFamily: mn, fontSize: 10, color: C.txm, marginBottom: 8, letterSpacing: 0.5 }}>
                {b.user} · {b.role} · {b.sec || "n/a"} · {new Date(b.ts).toLocaleString()}
              </div>
              <div style={{ fontFamily: ft, fontSize: 12, color: C.txm, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{b.body}</div>
            </div>
            <button onClick={function() { toggle(b.id, b.status); }} style={{
              padding: "6px 12px", borderRadius: 6,
              background: open ? "transparent" : "#2EAD8E20",
              border: "1px solid " + (open ? C.border : "#2EAD8E60"),
              color: open ? C.txm : "#2EAD8E",
              cursor: "pointer", fontFamily: mn, fontSize: 10, fontWeight: 700,
              display: "flex", alignItems: "center", gap: 6, letterSpacing: 0.5,
              flexShrink: 0,
            }}>
              {open ? <Circle size={11} strokeWidth={1.8} /> : <CheckCircle size={11} strokeWidth={2.2} />}
              {open ? "Mark fixed" : "Fixed"}
            </button>
          </div>
        </div>;
      })}
    </div>
  </div>;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: 10, padding: "16px 18px" }}>
    <div style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 1.5, marginBottom: 6, textTransform: "uppercase" }}>{label}</div>
    <div style={{ fontFamily: gf, fontSize: 26, fontWeight: 900, color: C.tx, letterSpacing: -0.5 }}>{value}</div>
  </div>;
}

function ListCard({ title, rows }: { title: string; rows: Array<{ label: string; value: string }> }) {
  return <div style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: 10, padding: "16px 18px" }}>
    <div style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 1.5, marginBottom: 10, textTransform: "uppercase" }}>{title}</div>
    {rows.length === 0 && <div style={{ fontFamily: ft, fontSize: 11, color: C.txd, padding: "8px 0" }}>No data yet</div>}
    {rows.map(function(r, i) {
      return <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: i < rows.length - 1 ? "1px solid " + C.border : "none", fontFamily: ft, fontSize: 12 }}>
        <span style={{ color: C.tx }}>{r.label}</span>
        <span style={{ color: C.amber, fontFamily: mn, fontWeight: 700 }}>{r.value}</span>
      </div>;
    })}
  </div>;
}
