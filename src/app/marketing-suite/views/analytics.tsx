"use client";
// MarketingSUITE · Data → WORK EFFICIENCY MANAGER.
// Reframed from "marketing metrics" into an operations cockpit: how much work
// is going in, how much is getting done, and how fast it moves from
// assignment → complete. Real data comes from readBoardTasks() (the live task
// board cache); when that's empty we synthesize a believable demo so the view
// always renders. Buffer content-output is a best-effort bonus stat.
// All viz is hand-rolled CSS/SVG — no chart libs. Inline styles + D tokens.
import React, { useEffect, useMemo, useState } from "react";
import {
  Activity, Timer, Gauge, Users, Layers, TriangleAlert,
  CheckCircle2, Clock, TrendingUp, TrendingDown, Minus, Zap, Target,
  Flame, AlarmClock, ArrowUpRight, Hash,
} from "lucide-react";
import { D, ft, gf, mn } from "../../shared-constants";
import { readBoardTasks, type BoardTaskLite } from "../marketing-constants";
import type { ViewProps } from "../use-marketing";
import PageHeader from "../components/page-header";

// ───────────────────────────────────────── time helpers
const DAY = 86_400_000;
const HOUR = 3_600_000;
function parseT(s?: string): number | null {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}
function fmtDur(ms: number): string {
  if (ms < HOUR) return Math.max(1, Math.round(ms / 60_000)) + "m";
  if (ms < DAY) return (ms / HOUR).toFixed(1) + "h";
  return (ms / DAY).toFixed(1) + "d";
}
function fmtDurShort(ms: number): string {
  if (ms < DAY) return (ms / HOUR).toFixed(0) + "h";
  const d = ms / DAY;
  return (d >= 10 ? d.toFixed(0) : d.toFixed(1)) + "d";
}
function startOfWeek(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // Mon=0
  return d.getTime() - dow * DAY;
}
function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// ───────────────────────────────────────── demo fallback (believable)
// Synthesized only when the live board cache is empty. Anchored to "now" so the
// throughput/cycle math reads naturally. Mirrors the SemiAnalysis content team.
const DEMO_PEOPLE = ["Dylan", "Doug", "Jordan", "Dan", "Kimbo", "Cameron", "Wega"];
const DEMO_CATS = ["Production", "Clips", "Social", "Ads", "Strategy", "Research"];
function makeDemoTasks(): BoardTaskLite[] {
  const now = Date.now();
  const out: BoardTaskLite[] = [];
  let seed = 1337;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const titles = [
    "EP17 short cut", "Thumbnail pass", "Clip batch", "X thread draft", "Carousel build",
    "Meta flight copy", "HBM4 teardown", "Caption polish", "Recap outline", "Hook variants",
    "B-roll grade", "Audiogram", "Newsletter blurb", "Landing tweak", "Retarget creative",
  ];
  for (let i = 0; i < 64; i++) {
    const addedDelta = -(rnd() * 56 + 1); // up to 8 weeks back
    const added = now + addedDelta * DAY;
    const done = rnd() < 0.66;
    const cycleDays = 0.2 + rnd() * rnd() * 11; // skewed toward fast
    const updated = done ? Math.min(now, added + cycleDays * DAY) : added + rnd() * 6 * DAY;
    const open = !done;
    // some open tasks are overdue, some aging
    const due = open
      ? now + (rnd() < 0.45 ? -(rnd() * 5 + 0.5) : rnd() * 9) * DAY
      : added + (cycleDays + rnd() * 2) * DAY;
    out.push({
      id: "demo-" + i,
      title: titles[i % titles.length] + (i >= titles.length ? " " + Math.ceil((i + 1) / titles.length) : ""),
      category: DEMO_CATS[Math.floor(rnd() * DEMO_CATS.length)],
      assignee: DEMO_PEOPLE[Math.floor(rnd() * DEMO_PEOPLE.length)],
      priority: rnd() < 0.25 ? "high" : rnd() < 0.6 ? "med" : "low",
      done,
      addedAt: new Date(added).toISOString(),
      updatedAt: new Date(updated).toISOString(),
      dueDate: new Date(due).toISOString(),
    });
  }
  return out;
}

// ───────────────────────────────────────── derived model
interface PersonStat { name: string; assigned: number; done: number; open: number; cycleAvg: number; overdue: number; }
interface CatStat { name: string; total: number; done: number; effort: number; }
interface WeekBucket { label: string; start: number; added: number; done: number; }
interface BottleRow { title: string; assignee?: string; metric: number; }
interface Derived {
  total: number; open: number; done: number; completion: number;
  cycleAvg: number; cycleMed: number; cycleSamples: number[];
  wip: number; overdue: number; aging: number; onTime: number;
  weeks: WeekBucket[]; people: PersonStat[]; cats: CatStat[];
  heat: number[][]; heatMax: number; throughputPerWeek: number;
  oldestOpen: { title: string; age: number; assignee?: string } | null;
  overdueRows: BottleRow[]; agingRows: BottleRow[];
}

function derive(tasks: BoardTaskLite[]): Derived {
  const now = Date.now();
  const total = tasks.length;
  const doneTasks = tasks.filter((t) => t.done);
  const openTasks = tasks.filter((t) => !t.done);
  const done = doneTasks.length;
  const open = openTasks.length;

  // cycle time: addedAt → updatedAt for done tasks
  const cycleSamples: number[] = [];
  for (const t of doneTasks) {
    const a = parseT(t.addedAt), u = parseT(t.updatedAt);
    if (a != null && u != null && u >= a) cycleSamples.push(u - a);
  }
  const cycleAvg = cycleSamples.length ? cycleSamples.reduce((s, x) => s + x, 0) / cycleSamples.length : 0;
  const cycleMed = median(cycleSamples);

  // on-time: done tasks completed at/before due date
  let dueCount = 0, onTimeCount = 0;
  for (const t of doneTasks) {
    const d = parseT(t.dueDate), u = parseT(t.updatedAt);
    if (d != null && u != null) { dueCount++; if (u <= d + DAY * 0.5) onTimeCount++; }
  }
  const onTime = dueCount ? Math.round((onTimeCount / dueCount) * 100) : 0;

  // overdue + aging WIP
  let overdue = 0, aging = 0;
  let oldestOpen: Derived["oldestOpen"] = null;
  for (const t of openTasks) {
    const due = parseT(t.dueDate);
    if (due != null && due < now) overdue++;
    const a = parseT(t.addedAt);
    if (a != null) {
      const age = now - a;
      if (age > 5 * DAY) aging++;
      if (!oldestOpen || age > oldestOpen.age) oldestOpen = { title: t.title, age, assignee: t.assignee };
    }
  }

  // weekly throughput (added vs done), last 8 weeks
  const wkNow = startOfWeek(now);
  const weeks: WeekBucket[] = [];
  for (let i = 7; i >= 0; i--) {
    const start = wkNow - i * 7 * DAY;
    weeks.push({ label: new Date(start).toLocaleDateString("en-US", { month: "numeric", day: "numeric" }), start, added: 0, done: 0 });
  }
  const weekIndex = (t: number) => {
    const ws = startOfWeek(t);
    const idx = Math.round((ws - (wkNow - 7 * 7 * DAY)) / (7 * DAY));
    return idx >= 0 && idx < 8 ? idx : -1;
  };
  for (const t of tasks) {
    const a = parseT(t.addedAt);
    if (a != null) { const i = weekIndex(a); if (i >= 0) weeks[i].added++; }
    if (t.done) { const u = parseT(t.updatedAt); if (u != null) { const i = weekIndex(u); if (i >= 0) weeks[i].done++; } }
  }
  const recentDone = weeks.slice(-4).reduce((s, w) => s + w.done, 0);
  const throughputPerWeek = recentDone / 4;

  // per-assignee
  const pmap = new Map<string, PersonStat>();
  const pcycle = new Map<string, number[]>();
  for (const t of tasks) {
    const name = (t.assignee || "Unassigned").trim() || "Unassigned";
    let p = pmap.get(name);
    if (!p) { p = { name, assigned: 0, done: 0, open: 0, cycleAvg: 0, overdue: 0 }; pmap.set(name, p); pcycle.set(name, []); }
    p.assigned++;
    if (t.done) {
      p.done++;
      const a = parseT(t.addedAt), u = parseT(t.updatedAt);
      if (a != null && u != null && u >= a) pcycle.get(name)!.push(u - a);
    } else {
      p.open++;
      const due = parseT(t.dueDate);
      if (due != null && due < now) p.overdue++;
    }
  }
  const people = [...pmap.values()].map((p) => {
    const cs = pcycle.get(p.name)!;
    p.cycleAvg = cs.length ? cs.reduce((s, x) => s + x, 0) / cs.length : 0;
    return p;
  }).sort((a, b) => b.done - a.done || b.assigned - a.assigned);

  // categories
  const cmap = new Map<string, CatStat>();
  for (const t of tasks) {
    const name = (t.category || "Uncategorized").trim() || "Uncategorized";
    let c = cmap.get(name);
    if (!c) { c = { name, total: 0, done: 0, effort: 0 }; cmap.set(name, c); }
    c.total++;
    if (t.done) c.done++;
  }
  const cats = [...cmap.values()].map((c) => ({ ...c, effort: total ? c.total / total : 0 }))
    .sort((a, b) => b.total - a.total);

  // bottleneck rows (overdue by lateness, aging WIP by age) — derived here so
  // the render path stays pure (no Date.now() during render).
  const overdueRows: BottleRow[] = openTasks
    .map((t) => ({ t, due: parseT(t.dueDate) }))
    .filter((x) => x.due != null && x.due < now)
    .sort((a, b) => a.due! - b.due!)
    .slice(0, 6)
    .map((x) => ({ title: x.t.title, assignee: x.t.assignee, metric: now - x.due! }));
  const agingRows: BottleRow[] = openTasks
    .map((t) => ({ t, age: now - (parseT(t.addedAt) ?? now) }))
    .filter((x) => x.age > 5 * DAY)
    .sort((a, b) => b.age - a.age)
    .slice(0, 6)
    .map((x) => ({ title: x.t.title, assignee: x.t.assignee, metric: x.age }));

  // activity heat: day-of-week × week (last 8 weeks), count of completions
  const heat: number[][] = Array.from({ length: 7 }, () => Array(8).fill(0));
  let heatMax = 0;
  for (const t of tasks) {
    if (!t.done) continue;
    const u = parseT(t.updatedAt);
    if (u == null) continue;
    const i = weekIndex(u);
    if (i < 0) continue;
    const dow = (new Date(u).getDay() + 6) % 7;
    heat[dow][i]++;
    if (heat[dow][i] > heatMax) heatMax = heat[dow][i];
  }

  return {
    total, open, done,
    completion: total ? Math.round((done / total) * 100) : 0,
    cycleAvg, cycleMed, cycleSamples,
    wip: open, overdue, aging, onTime,
    weeks, people, cats, heat, heatMax: heatMax || 1, throughputPerWeek, oldestOpen,
    overdueRows, agingRows,
  };
}

// ───────────────────────────────────────── shared atoms
const PAGE: React.CSSProperties = { padding: "22px 26px 48px", fontFamily: ft, color: D.tx, maxWidth: 1520, margin: "0 auto" };
const glass: React.CSSProperties = { borderRadius: 16, border: `1px solid ${D.border}`, background: D.cardGrad, boxShadow: D.glow, padding: 18 };
const gh: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, fontFamily: mn, fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase", color: D.txm, marginBottom: 14 };
const micro: React.CSSProperties = { fontFamily: mn, fontSize: 9.5, letterSpacing: 0.6, textTransform: "uppercase", color: D.txd };
const note: React.CSSProperties = { fontSize: 11.5, color: D.txm, lineHeight: 1.55, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${D.border}` };

function DirArrow({ dir, size = 12 }: { dir: 1 | 0 | -1; size?: number }) {
  if (dir === 1) return <TrendingUp size={size} color={D.teal} />;
  if (dir === -1) return <TrendingDown size={size} color={D.coral} />;
  return <Minus size={size} color={D.txd} />;
}

type TabId = "throughput" | "cycle" | "workload" | "categories" | "bottlenecks";
const TABS: { id: TabId; label: string; Icon: typeof Activity; accent: string }[] = [
  { id: "throughput", label: "Throughput", Icon: Activity, accent: D.teal },
  { id: "cycle", label: "Cycle time", Icon: Timer, accent: D.cyan },
  { id: "workload", label: "Workload", Icon: Users, accent: D.amber },
  { id: "categories", label: "Categories", Icon: Layers, accent: D.violet },
  { id: "bottlenecks", label: "Bottlenecks", Icon: TriangleAlert, accent: D.coral },
];

const PALETTE = [D.teal, D.cyan, D.amber, D.violet, D.blue, D.coral, D.crimson];
const colorFor = (i: number) => PALETTE[i % PALETTE.length];

// ───────────────────────────────────────── main
export default function AnalyticsView({ m, onOpenView }: ViewProps) {
  void onOpenView;
  const [tab, setTab] = useState<TabId>("throughput");
  const [bufferSent, setBufferSent] = useState<number | null>(null);
  // Read the real board cache once; fall back to a believable demo dataset.
  // Lazy initializer keeps this out of an effect (localStorage is client-only,
  // and this component is "use client" so it never runs during SSR).
  const [{ tasks, live }] = useState<{ tasks: BoardTaskLite[]; live: boolean }>(() => {
    const real = readBoardTasks();
    return real.length >= 4 ? { tasks: real, live: true } : { tasks: makeDemoTasks(), live: false };
  });

  // best-effort content-output stat from Buffer (never blocks/crashes)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/buffer?type=sent");
        if (!res.ok) return;
        const j = await res.json();
        const posts = Array.isArray(j?.posts) ? j.posts : [];
        if (alive && posts.length > 0) setBufferSent(posts.length);
      } catch { /* best-effort */ }
    })();
    return () => { alive = false; };
  }, []);

  const dv = useMemo(() => derive(tasks), [tasks]);
  const prevThroughput = useMemo(() => {
    const w = dv.weeks;
    const recent = w.slice(-4).reduce((s, x) => s + x.done, 0) / 4;
    const prior = w.slice(-8, -4).reduce((s, x) => s + x.done, 0) / 4;
    return { recent, prior, dir: (recent > prior + 0.4 ? 1 : recent < prior - 0.4 ? -1 : 0) as 1 | 0 | -1 };
  }, [dv.weeks]);

  return (
    <div style={PAGE}>
      <style>{`@keyframes anRise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes anGrow{from{transform:scaleY(0)}to{transform:scaleY(1)}}`}</style>

      {/* ── head ── */}
      <PageHeader
        id="analytics"
        title="Work Efficiency"
        subtitle="How much work is going in, how much is getting done, and how fast it moves from assignment to complete. Computed from the live task board."
        right={<>
          <SourcePill label={live ? "Live board" : "Demo data"} on={live} />
          {bufferSent != null && <SourcePill label={`${bufferSent} shipped`} on subtle />}
          {m.offline && <SourcePill label="Spine offline" on={false} />}
        </>}
      />

      {/* ── KPI header row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, marginBottom: 16 }}>
        <Kpi Icon={Zap} accent={D.amber} value={String(dv.total)} label="Work in" sub={`${dv.open} open · ${dv.done} done`} />
        <Kpi Icon={CheckCircle2} accent={D.teal} value={`${dv.completion}%`} label="Completion" sub={`${dv.throughputPerWeek.toFixed(1)}/wk throughput`}
          spark={dv.weeks.map((w) => w.done)} sparkColor={D.teal} />
        <Kpi Icon={Timer} accent={D.cyan} value={dv.cycleAvg ? fmtDurShort(dv.cycleAvg) : "—"} label="Avg cycle time"
          sub={dv.cycleMed ? `median ${fmtDurShort(dv.cycleMed)}` : "assignment → done"} />
        <Kpi Icon={Target} accent={dv.onTime >= 70 ? D.teal : dv.onTime >= 40 ? D.amber : D.coral}
          value={dv.onTime ? `${dv.onTime}%` : "—"} label="On-time" sub={dv.overdue ? `${dv.overdue} overdue now` : "no overdue"} />
      </div>

      {/* ── tab switcher ── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {TABS.map((t) => {
          const on = t.id === tab;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 999,
              cursor: "pointer", fontFamily: mn, fontSize: 11.5, letterSpacing: 0.3, transition: "all 0.16s",
              border: `1px solid ${on ? t.accent + "66" : D.border}`,
              background: on ? t.accent + "16" : "transparent", color: on ? t.accent : D.txm,
            }}
              onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
              onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "transparent"; }}
            >
              <t.Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      <div key={tab} style={{ animation: "anRise 0.28s ease both" }}>
        {tab === "throughput" && <Throughput dv={dv} pt={prevThroughput} />}
        {tab === "cycle" && <Cycle dv={dv} />}
        {tab === "workload" && <Workload dv={dv} />}
        {tab === "categories" && <Categories dv={dv} />}
        {tab === "bottlenecks" && <Bottlenecks dv={dv} />}
      </div>
    </div>
  );
}

// ───────────────────────────────────────── THROUGHPUT
function Throughput({ dv, pt }: { dv: Derived; pt: { recent: number; prior: number; dir: 1 | 0 | -1 } }) {
  const max = Math.max(1, ...dv.weeks.map((w) => Math.max(w.added, w.done)));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.7fr) minmax(0,1fr)", gap: 14, alignItems: "stretch" }}>
      {/* added vs done bars */}
      <div style={glass}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={gh}><Activity size={14} /> Work in vs work done · last 8 weeks</div>
          <Legend items={[["Added", D.txd], ["Done", D.teal]]} />
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 210, padding: "8px 4px 0" }}>
          {dv.weeks.map((w, i) => {
            const last = i === dv.weeks.length - 1;
            return (
              <div key={w.start} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 7, height: "100%", justifyContent: "flex-end" }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, width: "100%", height: "100%", justifyContent: "center" }}>
                  <Bar h={(w.added / max) * 100} color={D.txd} delay={i * 40} title={`${w.added} added`} />
                  <Bar h={(w.done / max) * 100} color={last ? D.amber : D.teal} delay={i * 40 + 20} title={`${w.done} done`} glow />
                </div>
                <span style={{ fontFamily: mn, fontSize: 9, color: last ? D.amber : D.txm, letterSpacing: 0.3 }}>{w.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* side stats */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={glass}>
          <div style={gh}><Gauge size={14} /> Velocity</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <div style={{ fontFamily: gf, fontSize: 40, fontWeight: 800, lineHeight: 1, color: D.teal }}>{pt.recent.toFixed(1)}</div>
            <div style={{ fontFamily: mn, fontSize: 11, color: D.txm }}>done / week<br /><span style={{ color: D.txd }}>trailing 4wk avg</span></div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, fontFamily: mn, fontSize: 11.5, color: pt.dir === 1 ? D.teal : pt.dir === -1 ? D.coral : D.txm }}>
            <DirArrow dir={pt.dir} size={13} />
            {pt.dir === 0 ? "Flat" : pt.dir === 1 ? "Speeding up" : "Slowing down"} vs prior 4wk ({pt.prior.toFixed(1)}/wk)
          </div>
        </div>
        <div style={{ ...glass, flex: 1 }}>
          <div style={gh}><Flame size={14} /> Completion heat · day × week</div>
          <ActivityHeat dv={dv} />
          <div style={{ ...micro, marginTop: 10 }}>each cell = tasks completed that day · brighter = busier</div>
        </div>
      </div>
    </div>
  );
}

function Bar({ h, color, delay, title, glow }: { h: number; color: string; delay: number; title: string; glow?: boolean }) {
  return (
    <div title={title} style={{
      width: "46%", maxWidth: 26, height: `${Math.max(2, h)}%`, borderRadius: "5px 5px 2px 2px",
      background: `linear-gradient(180deg, ${color}, ${color}22)`,
      boxShadow: glow ? `0 0 14px ${color}33` : "none",
      transformOrigin: "bottom", animation: `anGrow 0.5s ${delay}ms cubic-bezier(.2,.8,.2,1) both`,
    }} />
  );
}

function ActivityHeat({ dv }: { dv: Derived }) {
  const dows = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <div style={{ display: "grid", gridTemplateColumns: `18px repeat(8, 1fr)`, gap: 4 }}>
      {dv.heat.map((row, r) => (
        <React.Fragment key={r}>
          <div style={{ ...micro, display: "flex", alignItems: "center", color: r >= 5 ? D.txd : D.txm }}>{dows[r]}</div>
          {row.map((v, c) => {
            const a = v / dv.heatMax;
            const bg = v === 0 ? "rgba(255,255,255,0.03)" : `rgba(46,173,142,${0.18 + a * 0.7})`;
            return (
              <div key={c} title={`${v} done`} style={{
                aspectRatio: "1", borderRadius: 4, background: bg,
                border: v > 0 ? `1px solid ${D.teal}22` : `1px solid transparent`,
                transition: "transform .12s",
              }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.12)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
              />
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
}

// ───────────────────────────────────────── CYCLE TIME
function Cycle({ dv }: { dv: Derived }) {
  // bucket cycle samples into a distribution (hours → days)
  const buckets = useMemo(() => {
    const edges = [0, 0.25, 0.5, 1, 2, 3, 5, 7, 14, Infinity];
    const labels = ["<6h", "<12h", "1d", "2d", "3d", "5d", "1w", "2w", "2w+"];
    const counts = new Array(labels.length).fill(0);
    for (const s of dv.cycleSamples) {
      const days = s / DAY;
      for (let i = 0; i < edges.length - 1; i++) {
        if (days >= edges[i] && days < edges[i + 1]) { counts[i]++; break; }
      }
    }
    return labels.map((label, i) => ({ label, count: counts[i] }));
  }, [dv.cycleSamples]);
  const maxB = Math.max(1, ...buckets.map((b) => b.count));
  const fast = dv.cycleSamples.filter((s) => s < DAY).length;
  const slow = dv.cycleSamples.filter((s) => s > 5 * DAY).length;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr)", gap: 14 }}>
      <div style={glass}>
        <div style={gh}><Timer size={14} /> Cycle-time distribution · assignment → complete</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 200, padding: "8px 2px 0" }}>
          {buckets.map((b, i) => {
            const hot = i >= 6;
            const c = hot ? D.coral : i >= 4 ? D.amber : D.cyan;
            return (
              <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
                <span style={{ fontFamily: mn, fontSize: 10, color: b.count ? D.tx : D.txd }}>{b.count || ""}</span>
                <div title={`${b.count} tasks`} style={{
                  width: "100%", maxWidth: 38, height: `${(b.count / maxB) * 100}%`, minHeight: b.count ? 3 : 0,
                  borderRadius: "5px 5px 2px 2px", background: `linear-gradient(180deg, ${c}, ${c}22)`,
                  boxShadow: `0 0 12px ${c}22`, transformOrigin: "bottom",
                  animation: `anGrow 0.5s ${i * 35}ms cubic-bezier(.2,.8,.2,1) both`,
                }} />
                <span style={{ fontFamily: mn, fontSize: 9, color: D.txm }}>{b.label}</span>
              </div>
            );
          })}
        </div>
        <div style={note}>
          <b style={{ color: D.teal }}>{fast}</b> finished within a day · <b style={{ color: D.coral }}>{slow}</b> took longer than 5 days.
          {" "}Long tails are where work stalls between assignment and completion.
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <StatBig Icon={Timer} accent={D.cyan} label="Average cycle" value={dv.cycleAvg ? fmtDur(dv.cycleAvg) : "—"} sub={`${dv.cycleSamples.length} completed tasks measured`} />
        <StatBig Icon={Clock} accent={D.teal} label="Median cycle" value={dv.cycleMed ? fmtDur(dv.cycleMed) : "—"} sub="half of tasks finish faster than this" />
        <div style={glass}>
          <div style={gh}><Gauge size={14} /> Spread</div>
          <CycleSpread samples={dv.cycleSamples} avg={dv.cycleAvg} med={dv.cycleMed} />
        </div>
      </div>
    </div>
  );
}

function CycleSpread({ samples, avg, med }: { samples: number[]; avg: number; med: number }) {
  if (!samples.length) return <div style={{ ...micro, color: D.txm }}>no completed tasks yet</div>;
  const max = Math.max(...samples);
  const p90 = [...samples].sort((a, b) => a - b)[Math.floor(samples.length * 0.9)] || max;
  const pct = (v: number) => (v / max) * 100;
  return (
    <div>
      <div style={{ position: "relative", height: 10, borderRadius: 999, background: "rgba(255,255,255,0.05)", overflow: "visible" }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct(p90)}%`, borderRadius: 999, background: `linear-gradient(90deg, ${D.teal}, ${D.cyan})` }} />
        <Tick pct={pct(med)} color={D.tx} label="med" />
        <Tick pct={pct(avg)} color={D.amber} label="avg" />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 22, fontFamily: mn, fontSize: 9.5, color: D.txd }}>
        <span>0</span><span>p90 {fmtDurShort(p90)}</span><span>max {fmtDurShort(max)}</span>
      </div>
    </div>
  );
}
function Tick({ pct, color, label }: { pct: number; color: string; label: string }) {
  return (
    <div style={{ position: "absolute", left: `${Math.min(98, pct)}%`, top: -3, transform: "translateX(-50%)" }}>
      <div style={{ width: 2, height: 16, background: color, borderRadius: 2, margin: "0 auto" }} />
      <div style={{ fontFamily: mn, fontSize: 8.5, color, marginTop: 2, whiteSpace: "nowrap", textAlign: "center" }}>{label}</div>
    </div>
  );
}

// ───────────────────────────────────────── WORKLOAD
function Workload({ dv }: { dv: Derived }) {
  const people = dv.people.slice(0, 9);
  const maxAssigned = Math.max(1, ...people.map((p) => p.assigned));
  return (
    <div style={glass}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={gh}><Users size={14} /> Workload leaderboard · assigned vs done · avg cycle</div>
        <Legend items={[["Done", D.teal], ["Open", "rgba(255,255,255,0.10)"]]} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "26px minmax(110px,1.2fr) minmax(0,2.4fr) 78px 88px", gap: 12, alignItems: "center", paddingBottom: 9, borderBottom: `1px solid ${D.border}`, marginBottom: 4 }}>
        <span style={micro}>#</span><span style={micro}>Person</span><span style={micro}>Load (done / open)</span>
        <span style={{ ...micro, textAlign: "right" }}>Done %</span><span style={{ ...micro, textAlign: "right" }}>Avg cycle</span>
      </div>
      {people.map((p, i) => {
        const donePct = p.assigned ? Math.round((p.done / p.assigned) * 100) : 0;
        const c = colorFor(i);
        return (
          <div key={p.name} style={{ display: "grid", gridTemplateColumns: "26px minmax(110px,1.2fr) minmax(0,2.4fr) 78px 88px", gap: 12, alignItems: "center", padding: "11px 0", borderBottom: `1px solid ${D.border}` }}>
            <span style={{ fontFamily: gf, fontSize: 14, fontWeight: 700, color: i === 0 ? D.amber : D.txd }}>{i + 1}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: c, flex: "none", boxShadow: `0 0 8px ${c}66` }} />
              <span style={{ fontSize: 13, color: D.tx, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
              {p.overdue > 0 && <span style={{ fontFamily: mn, fontSize: 9, color: D.coral, background: D.coral + "1c", border: `1px solid ${D.coral}40`, borderRadius: 4, padding: "1px 5px" }}>{p.overdue} late</span>}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{ flex: 1, height: 10, borderRadius: 999, background: "rgba(255,255,255,0.05)", overflow: "hidden", display: "flex" }}>
                <div style={{ width: `${(p.done / maxAssigned) * 100}%`, background: `linear-gradient(90deg, ${D.teal}, ${D.teal}aa)`, boxShadow: `0 0 8px ${D.teal}44` }} />
                <div style={{ width: `${(p.open / maxAssigned) * 100}%`, background: "rgba(255,255,255,0.10)" }} />
              </div>
              <span style={{ fontFamily: mn, fontSize: 11, color: D.txm, minWidth: 56, textAlign: "right" }}>{p.done}/{p.open}</span>
            </div>
            <span style={{ fontFamily: mn, fontSize: 12, color: donePct >= 60 ? D.teal : donePct >= 30 ? D.amber : D.coral, textAlign: "right" }}>{donePct}%</span>
            <span style={{ fontFamily: mn, fontSize: 12, color: D.tx, textAlign: "right" }}>{p.cycleAvg ? fmtDurShort(p.cycleAvg) : "—"}</span>
          </div>
        );
      })}
      <div style={note}>
        Leaderboard ranks by throughput (tasks completed). Avg cycle is each person&apos;s assignment→done time — a high load with a tight cycle is the sweet spot.
      </div>
    </div>
  );
}

// ───────────────────────────────────────── CATEGORIES
function Categories({ dv }: { dv: Derived }) {
  const cats = dv.cats.slice(0, 8);
  const total = dv.total || 1;
  // donut segments — compute cumulative start offsets without mutating an outer
  // variable during render (each segment's start = sum of prior fractions).
  const segs = cats.map((c, i) => {
    const start = cats.slice(0, i).reduce((s, p) => s + p.total / total, 0);
    return { start, frac: c.total / total, color: colorFor(i), name: c.name };
  });
  const R = 54, C = 2 * Math.PI * R;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.7fr)", gap: 14, alignItems: "stretch" }}>
      <div style={{ ...glass, display: "flex", flexDirection: "column" }}>
        <div style={gh}><Layers size={14} /> Where effort goes</div>
        <div style={{ display: "flex", justifyContent: "center", padding: "6px 0 14px" }}>
          <svg width={148} height={148} viewBox="0 0 148 148">
            <circle cx={74} cy={74} r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={16} />
            {segs.map((s, i) => (
              <circle key={i} cx={74} cy={74} r={R} fill="none" stroke={s.color} strokeWidth={16}
                strokeDasharray={`${s.frac * C} ${C}`} strokeDashoffset={`${-s.start * C}`}
                transform="rotate(-90 74 74)" strokeLinecap="butt"
                style={{ transition: "stroke-dasharray .6s ease" }}>
                <title>{`${s.name} · ${Math.round(s.frac * 100)}%`}</title>
              </circle>
            ))}
            <text x={74} y={70} textAnchor="middle" fontFamily={gf} fontSize={26} fontWeight={800} fill={D.tx}>{dv.total}</text>
            <text x={74} y={88} textAnchor="middle" fontFamily={mn} fontSize={9} letterSpacing={1} fill={D.txm}>TASKS</text>
          </svg>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: "auto" }}>
          {cats.map((c, i) => (
            <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: colorFor(i), flex: "none" }} />
              <span style={{ color: D.tx, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
              <span style={{ fontFamily: mn, fontSize: 11, color: D.txm }}>{Math.round((c.total / total) * 100)}%</span>
            </div>
          ))}
        </div>
      </div>

      <div style={glass}>
        <div style={gh}><Hash size={14} /> Volume &amp; completion by category</div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(110px,1fr) minmax(0,2.6fr) 64px 70px", gap: 12, alignItems: "center", paddingBottom: 9, borderBottom: `1px solid ${D.border}`, marginBottom: 4 }}>
          <span style={micro}>Category</span><span style={micro}>Completion</span>
          <span style={{ ...micro, textAlign: "right" }}>Tasks</span><span style={{ ...micro, textAlign: "right" }}>Done</span>
        </div>
        {cats.map((c, i) => {
          const pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
          const col = colorFor(i);
          return (
            <div key={c.name} style={{ display: "grid", gridTemplateColumns: "minmax(110px,1fr) minmax(0,2.6fr) 64px 70px", gap: 12, alignItems: "center", padding: "11px 0", borderBottom: `1px solid ${D.border}` }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: col, flex: "none" }} />
                <span style={{ fontSize: 12.5, color: D.tx, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div style={{ flex: 1, height: 8, borderRadius: 999, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${col}, ${col}aa)` }} />
                </div>
                <span style={{ fontFamily: mn, fontSize: 11, color: pct >= 60 ? D.teal : pct >= 30 ? D.txm : D.coral, minWidth: 34, textAlign: "right" }}>{pct}%</span>
              </div>
              <span style={{ fontFamily: mn, fontSize: 12, color: D.tx, textAlign: "right" }}>{c.total}</span>
              <span style={{ fontFamily: mn, fontSize: 12, color: D.txm, textAlign: "right" }}>{c.done}</span>
            </div>
          );
        })}
        <div style={note}>Share shows where the team&apos;s effort concentrates; completion % flags categories that pile up faster than they clear.</div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────── BOTTLENECKS
function Bottlenecks({ dv }: { dv: Derived }) {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginBottom: 14 }}>
        <StatBig Icon={AlarmClock} accent={D.coral} label="Overdue" value={String(dv.overdue)} sub="past due, still open" />
        <StatBig Icon={Clock} accent={D.amber} label="Aging WIP" value={String(dv.aging)} sub="open > 5 days" />
        <StatBig Icon={Layers} accent={D.cyan} label="Work in progress" value={String(dv.wip)} sub="all open tasks" />
        <StatBig Icon={ArrowUpRight} accent={D.violet} label="Oldest open"
          value={dv.oldestOpen ? fmtDurShort(dv.oldestOpen.age) : "—"} sub={dv.oldestOpen ? dv.oldestOpen.title : "nothing aging"} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 14 }}>
        <BottleList title="Overdue — past due date" accent={D.coral} Icon={AlarmClock}
          rows={dv.overdueRows.map((x) => ({ title: x.title, assignee: x.assignee, tag: fmtDurShort(x.metric) + " late" }))}
          empty="Nothing overdue — the queue is clean." />
        <BottleList title="Aging WIP — stuck the longest" accent={D.amber} Icon={Clock}
          rows={dv.agingRows.map((x) => ({ title: x.title, assignee: x.assignee, tag: "open " + fmtDurShort(x.metric) }))}
          empty="No tasks aging past 5 days." />
      </div>

      <div style={{ ...note, marginTop: 16, paddingTop: 0, border: "none" }}>
        Bottlenecks surface where assignment→complete breaks down. Overdue items missed their date; aging WIP has sat open without closing.
      </div>
    </div>
  );
}

function BottleList({ title, accent, Icon, rows, empty }: { title: string; accent: string; Icon: typeof Clock; rows: { title: string; assignee?: string; tag: string }[]; empty: string }) {
  return (
    <div style={{ ...glass, borderColor: accent + "2e", background: `linear-gradient(135deg, ${accent}0a 0%, ${D.card} 72%)` }}>
      <div style={{ ...gh, color: accent }}><Icon size={14} /> {title}</div>
      {rows.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: D.txm, fontSize: 12.5, padding: "10px 0" }}>
          <CheckCircle2 size={14} color={D.teal} /> {empty}
        </div>
      ) : rows.map((r, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 0", borderTop: i === 0 ? "none" : `1px solid ${D.border}` }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, color: D.tx, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
            {r.assignee && <div style={{ fontFamily: mn, fontSize: 9.5, color: D.txd, marginTop: 2 }}>{r.assignee}</div>}
          </div>
          <span style={{ fontFamily: mn, fontSize: 10.5, color: accent, background: accent + "16", border: `1px solid ${accent}38`, borderRadius: 6, padding: "3px 8px", whiteSpace: "nowrap", flex: "none" }}>{r.tag}</span>
        </div>
      ))}
    </div>
  );
}

// ───────────────────────────────────────── small shared components
function Kpi({ Icon, accent, value, label, sub, spark, sparkColor }: {
  Icon: typeof Zap; accent: string; value: string; label: string; sub: string; spark?: number[]; sparkColor?: string;
}) {
  return (
    <div style={{ ...glass, padding: 16, position: "relative", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center", background: accent + "16", border: `1px solid ${accent}33` }}>
          <Icon size={15} color={accent} />
        </div>
        {spark && <Sparkline values={spark} color={sparkColor || accent} />}
      </div>
      <div style={{ fontFamily: gf, fontSize: 32, fontWeight: 800, color: D.tx, lineHeight: 1, marginTop: 12 }}>{value}</div>
      <div style={{ fontFamily: mn, fontSize: 10.5, letterSpacing: 0.5, textTransform: "uppercase", color: D.txm, marginTop: 8 }}>{label}</div>
      <div style={{ fontFamily: mn, fontSize: 11, color: D.txd, marginTop: 5 }}>{sub}</div>
    </div>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 76, h = 26;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const pts = values.map((v, i) => `${i * step},${h - (v / max) * (h - 3) - 1.5}`).join(" ");
  const area = `0,${h} ${pts} ${(values.length - 1) * step},${h}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }}>
      <polygon points={area} fill={color} opacity={0.12} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      {values.length > 0 && (
        <circle cx={(values.length - 1) * step} cy={h - (values[values.length - 1] / max) * (h - 3) - 1.5} r={2.2} fill={color} />
      )}
    </svg>
  );
}

function StatBig({ Icon, accent, label, value, sub }: { Icon: typeof Clock; accent: string; label: string; value: string; sub: string }) {
  return (
    <div style={{ ...glass, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, ...micro, color: accent, marginBottom: 10 }}>
        <Icon size={13} color={accent} /> {label}
      </div>
      <div style={{ fontFamily: gf, fontSize: 28, fontWeight: 800, color: D.tx, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: mn, fontSize: 11, color: D.txd, marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>
    </div>
  );
}

function Legend({ items }: { items: [string, string][] }) {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      {items.map(([label, color]) => (
        <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: mn, fontSize: 9.5, color: D.txm }}>
          <span style={{ width: 9, height: 9, borderRadius: 3, background: color }} /> {label}
        </span>
      ))}
    </div>
  );
}

function SourcePill({ label, on, subtle }: { label: string; on: boolean; subtle?: boolean }) {
  const c = on ? (subtle ? D.cyan : D.teal) : D.txd;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: mn, fontSize: 10.5, padding: "5px 10px", borderRadius: 999, border: `1px solid ${c}40`, color: c, background: c + "12" }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, background: c, boxShadow: on ? `0 0 6px ${c}` : "none" }} />
      {label}
    </span>
  );
}
