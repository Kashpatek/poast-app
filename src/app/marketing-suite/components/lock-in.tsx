"use client";
// Lock In — turn empty time into focused work. A setup wizard (how long, which
// events to keep, breather between blocks, auto/manual fill) → a full-screen,
// glanceable "lock in" screen with a countdown, the current task, and the plan.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Zap, X, Shuffle, Clock, Check, GripVertical, ChevronRight, Coffee } from "lucide-react";
import { D, ft, gf, mn } from "../../shared-constants";
import { scheduleKindOf, TYPE_COLOR, isAllDayEvent, type MarketingEvent } from "../marketing-constants";
import type { MarketingState } from "../use-marketing";
import { useBoardTasks } from "../use-board-tasks";

type Sub = { id: string; title: string; done?: boolean };
interface Task { id: string; title: string; estimateMins?: number; priority?: string; dueDate?: string; subtasks?: Sub[]; description?: string; done?: boolean; }
interface Placed { task: Task; startMin: number; endMin: number; }
interface KeptItem { e: MarketingEvent; startMin: number; endMin: number; }

const PRIO_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, "THIS WEEK": 2, ONGOING: 3 };
function mins(d: Date) { return d.getHours() * 60 + d.getMinutes(); }
function estOf(t: Task) { return t.estimateMins && t.estimateMins > 0 ? t.estimateMins : 30; }
function label(min: number) {
  const h = Math.floor(min / 60) % 24, m = Math.round(min % 60);
  const ap = h < 12 ? "am" : "pm", h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")}${ap}`;
}
function shuffle<T>(a: T[]): T[] { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[r[i], r[j]] = [r[j], r[i]]; } return r; }

// First position >= est minutes that doesn't collide with occupied intervals.
function firstFit(occupied: [number, number][], winS: number, winE: number, est: number, bumper: number): number | null {
  const occ = [...occupied].sort((a, b) => a[0] - b[0]);
  let cur = winS;
  for (const [s, e] of occ) {
    if (s - cur >= est) return cur;
    cur = Math.max(cur, e + bumper);
  }
  return winE - cur >= est ? cur : null;
}

export default function LockIn({ m, onClose }: { m: MarketingState; onClose: () => void }) {
  const boardTasks = useBoardTasks();
  const [phase, setPhase] = useState<"setup" | "lock">("setup");

  // Window anchored at "now", rounded up to the next 5 minutes.
  const startBase = useMemo(() => { const n = new Date(); return Math.ceil(mins(n) / 5) * 5; }, []);
  const [durMin, setDurMin] = useState(120);
  const eodMin = 22 * 60; // 10pm cap for "until end of day"
  const winStart = startBase;
  const winEnd = Math.min(durMin === -1 ? eodMin : startBase + durMin, 24 * 60 - 1);

  const [bumper, setBumper] = useState(0);
  const [auto, setAuto] = useState(true);

  // Today's events inside the window → keep candidates (default kept).
  const todayKey = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }, []);
  const windowEvents = useMemo<KeptItem[]>(() => m.events
    .filter((e) => { const s = new Date(e.start); const k = new Date(s); k.setHours(0, 0, 0, 0); return k.getTime() === todayKey && !isAllDayEvent(e); })
    .map((e) => { const s = new Date(e.start); const sm = mins(s); const em = e.end ? mins(new Date(e.end)) : sm + 30; return { e, startMin: sm, endMin: Math.max(em, sm + 15) }; })
    .filter((k) => k.endMin > winStart && k.startMin < winEnd)
    .sort((a, b) => a.startMin - b.startMin), [m.events, todayKey, winStart, winEnd]);
  const [dropped, setDropped] = useState<Record<string, boolean>>({});
  const kept = windowEvents.filter((k) => !dropped[k.e.id]);

  // Candidate tasks: open, with a due/priority sort.
  const candidates = useMemo<Task[]>(() => boardTasks
    .filter((t) => !t.done)
    .sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999") || (PRIO_ORDER[a.priority || ""] ?? 9) - (PRIO_ORDER[b.priority || ""] ?? 9)),
    [boardTasks]);

  const [placed, setPlaced] = useState<Placed[]>([]);
  const [seed, setSeed] = useState(0);

  const occupiedOf = (extra: Placed[]): [number, number][] =>
    [...kept.map((k) => [Math.max(k.startMin, winStart), k.endMin] as [number, number]),
     ...extra.map((p) => [p.startMin, p.endMin] as [number, number])];

  // Auto-fill whenever the window / kept / bumper / shuffle seed change.
  useEffect(() => {
    if (!auto) return;
    const pool = seed === 0 ? candidates : shuffle(candidates);
    const out: Placed[] = [];
    for (const t of pool) {
      const est = estOf(t);
      const pos = firstFit(occupiedOf(out), winStart, winEnd, est, bumper);
      if (pos != null) out.push({ task: t, startMin: pos, endMin: pos + est });
    }
    out.sort((a, b) => a.startMin - b.startMin);
    setPlaced(out);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, seed, durMin, bumper, JSON.stringify(dropped), candidates.length]);

  function addTask(t: Task) {
    if (placed.some((p) => p.task.id === t.id)) return;
    const est = estOf(t);
    const pos = firstFit(occupiedOf(placed), winStart, winEnd, est, bumper);
    if (pos == null) return;
    setPlaced((prev) => [...prev, { task: t, startMin: pos, endMin: pos + est }].sort((a, b) => a.startMin - b.startMin));
  }
  function removeTask(id: string) { setPlaced((prev) => prev.filter((p) => p.task.id !== id)); }

  // Merged, time-sorted plan for review + lock screen.
  const plan = useMemo(() => [
    ...kept.map((k) => ({ kind: "event" as const, id: k.e.id, title: k.e.title, startMin: Math.max(k.startMin, winStart), endMin: k.endMin, e: k.e })),
    ...placed.map((p) => ({ kind: "task" as const, id: p.task.id, title: p.task.title, startMin: p.startMin, endMin: p.endMin, task: p.task })),
  ].sort((a, b) => a.startMin - b.startMin), [kept, placed, winStart]);

  const taskCount = placed.length;
  const focusMins = placed.reduce((n, p) => n + (p.endMin - p.startMin), 0);

  if (typeof document === "undefined") return null;
  if (phase === "lock") return createPortal(<LockScreen plan={plan} winStart={winStart} winEnd={winEnd} onExit={onClose} />, document.body);

  // ── Setup wizard ──
  const durChips: { label: string; v: number }[] = [
    { label: "1h", v: 60 }, { label: "2h", v: 120 }, { label: "3h", v: 180 }, { label: "4h", v: 240 }, { label: "Til EOD", v: -1 },
  ];
  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 12000, background: "rgba(4,4,8,0.8)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 22, fontFamily: ft }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(880px, 100%)", maxHeight: "90vh", overflowY: "auto", background: D.bg, border: `1px solid ${D.amber}44`, borderRadius: 18, boxShadow: `0 30px 80px rgba(0,0,0,0.6)` }}>
        {/* header */}
        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${D.border}`, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: D.amber + "1c", border: `1px solid ${D.amber}66`, display: "flex", alignItems: "center", justifyContent: "center" }}><Zap size={18} color={D.amber} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: gf, fontSize: 19, fontWeight: 800, letterSpacing: -0.3 }}>Lock In</div>
            <div style={{ fontFamily: mn, fontSize: 11, color: D.txm }}>From {label(winStart)} to {label(winEnd)} · {Math.max(0, Math.round((winEnd - winStart) / 60 * 10) / 10)}h of runway</div>
          </div>
          <button onClick={onClose} style={iconBtn}><X size={16} /></button>
        </div>

        <div style={{ padding: "18px 22px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
          {/* left column: settings */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <Section title="How long are you locking in?">
              <ChipRow options={durChips.map((d) => d.label)} value={durChips.find((d) => d.v === durMin)?.label || ""} onPick={(l) => setDurMin(durChips.find((d) => d.label === l)!.v)} />
            </Section>
            <Section title="Breather between blocks">
              <ChipRow options={["None", "5m", "10m", "15m"]} value={bumper === 0 ? "None" : `${bumper}m`} onPick={(l) => setBumper(l === "None" ? 0 : parseInt(l))} />
            </Section>
            <Section title="Fill">
              <ChipRow options={["Auto", "Manual"]} value={auto ? "Auto" : "Manual"} onPick={(l) => { setAuto(l === "Auto"); if (l === "Manual") setPlaced([]); }} />
              {auto && <button onClick={() => setSeed((s) => s + 1)} style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", border: `1px solid ${D.border}`, background: D.card, color: D.txm, borderRadius: 8, padding: "6px 11px", fontFamily: mn, fontSize: 10.5 }}><Shuffle size={12} /> Shuffle suggestions</button>}
            </Section>
            {windowEvents.length > 0 && (
              <Section title="Events in this window (kept fixed)">
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {windowEvents.map((k) => {
                    const on = !dropped[k.e.id];
                    return (
                      <label key={k.e.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", opacity: on ? 1 : 0.5 }}>
                        <input type="checkbox" checked={on} onChange={(e) => setDropped((p) => ({ ...p, [k.e.id]: !e.target.checked }))} />
                        <span style={{ fontFamily: mn, fontSize: 10.5, color: D.txm, flex: "none" }}>{label(k.startMin)}</span>
                        <span style={{ fontFamily: ft, fontSize: 12.5, color: D.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.e.title}</span>
                      </label>
                    );
                  })}
                </div>
              </Section>
            )}
          </div>

          {/* right column: candidates + plan */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {!auto && (
              <Section title="Tasks — drag or click to add">
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 150, overflowY: "auto" }}>
                  {candidates.filter((t) => !placed.some((p) => p.task.id === t.id)).slice(0, 30).map((t) => (
                    <div key={t.id} draggable
                      onDragStart={(e) => { e.dataTransfer.setData("text/x-task-id", t.id); e.dataTransfer.effectAllowed = "copy"; }}
                      onClick={() => addTask(t)}
                      title="Click or drag into the plan"
                      style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 8px", borderRadius: 8, border: `1px solid ${D.border}`, background: D.card, cursor: "grab" }}>
                      <GripVertical size={12} color={D.txd} style={{ flex: "none" }} />
                      <span style={{ fontFamily: ft, fontSize: 12, color: D.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{t.title}</span>
                      <span style={{ fontFamily: mn, fontSize: 8.5, color: D.txd, flex: "none" }}>{estOf(t)}m</span>
                    </div>
                  ))}
                  {candidates.length === 0 && <Empty text="No open tasks on your board." />}
                </div>
              </Section>
            )}
            <Section title={`Plan · ${taskCount} task${taskCount === 1 ? "" : "s"} · ${Math.round(focusMins / 60 * 10) / 10}h focus`}>
              <div
                onDragOver={(e) => { if (!auto) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } }}
                onDrop={(e) => { if (auto) return; e.preventDefault(); const id = e.dataTransfer.getData("text/x-task-id"); const t = candidates.find((c) => c.id === id); if (t) addTask(t); }}
                style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 280, overflowY: "auto", border: !auto ? `1px dashed ${D.border}` : "none", borderRadius: 10, padding: !auto ? 8 : 0, minHeight: 60 }}>
                {plan.length === 0 && <Empty text={auto ? "No tasks fit — shorten blocks or add estimates." : "Drag tasks here to build your run."} />}
                {plan.map((it) => (
                  <div key={it.kind + it.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", borderRadius: 8, border: `1px solid ${it.kind === "event" ? D.border : D.amber + "55"}`, background: it.kind === "event" ? D.card : D.amber + "12" }}>
                    <span style={{ fontFamily: mn, fontSize: 10, color: D.txm, width: 58, flex: "none" }}>{label(it.startMin)}</span>
                    <span style={{ fontFamily: ft, fontSize: 12.5, color: D.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{it.title}</span>
                    <span style={{ fontFamily: mn, fontSize: 9, color: D.txd, flex: "none" }}>{it.endMin - it.startMin}m</span>
                    {it.kind === "event" ? <span style={{ fontFamily: mn, fontSize: 8, color: D.txd, flex: "none" }}>FIXED</span>
                      : <button onClick={() => removeTask(it.id)} style={{ border: "none", background: "transparent", color: D.txd, cursor: "pointer", flex: "none", padding: 0 }}><X size={12} /></button>}
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </div>

        {/* footer */}
        <div style={{ padding: "14px 22px", borderTop: `1px solid ${D.border}`, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: mn, fontSize: 10.5, color: D.txd, flex: 1 }}>Review your run, then lock in. Esc exits the lock screen.</span>
          <button onClick={onClose} style={ghostBtn}>Cancel</button>
          <button onClick={() => setPhase("lock")} disabled={taskCount === 0}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, cursor: taskCount === 0 ? "default" : "pointer", border: "none", borderRadius: 10, padding: "10px 18px", fontFamily: mn, fontSize: 12, fontWeight: 800, letterSpacing: 0.5, color: "#15100a", background: `linear-gradient(135deg, ${D.amber}, ${D.amber}bb)`, opacity: taskCount === 0 ? 0.5 : 1 }}>
            <Zap size={14} /> LOCK IN
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ════════ LOCK SCREEN ════════
type PlanItem = { kind: "event" | "task"; id: string; title: string; startMin: number; endMin: number; e?: MarketingEvent; task?: Task };
function LockScreen({ plan, winStart, winEnd, onExit }: { plan: PlanItem[]; winStart: number; winEnd: number; onExit: () => void }) {
  const [, setTick] = useState(0);
  const [notes, setNotes] = useState("");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onExit(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onExit]);

  const nowMin = mins(new Date());
  const nowSec = new Date().getSeconds();
  const remaining = Math.max(0, (winEnd - nowMin) * 60 - nowSec);
  const hh = Math.floor(remaining / 3600), mm = Math.floor((remaining % 3600) / 60), ss = remaining % 60;
  const pct = Math.min(100, Math.max(0, ((nowMin - winStart) / Math.max(1, winEnd - winStart)) * 100));

  const current = plan.find((p) => nowMin >= p.startMin && nowMin < p.endMin) || plan.find((p) => p.startMin >= nowMin) || plan[plan.length - 1];
  const next = current ? plan[plan.indexOf(current) + 1] : undefined;
  const subs = current?.task?.subtasks || [];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 13000, background: `radial-gradient(1200px 700px at 50% -10%, ${D.amber}14, transparent 60%), #060608`, color: D.tx, fontFamily: ft, display: "flex", flexDirection: "column", padding: "26px 34px", overflow: "hidden" }}>
      {/* top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontFamily: mn, fontSize: 11, letterSpacing: 3, color: D.amber, textTransform: "uppercase", fontWeight: 800 }}>● Locked In</span>
        <span style={{ flex: 1 }} />
        <button onClick={onExit} style={{ ...ghostBtn, color: D.txm }}>End session · Esc</button>
      </div>

      {/* timer */}
      <div style={{ textAlign: "center", marginTop: 18 }}>
        <div style={{ fontFamily: mn, fontSize: 12, letterSpacing: 2, color: D.txm, textTransform: "uppercase" }}>Time left</div>
        <div style={{ fontFamily: mn, fontWeight: 800, fontSize: "clamp(56px, 11vw, 132px)", lineHeight: 1, letterSpacing: -2, color: D.amber, textShadow: `0 0 40px ${D.amber}55`, margin: "4px 0 10px" }}>
          {hh > 0 ? String(hh).padStart(2, "0") + ":" : ""}{String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
        </div>
        <div style={{ width: "min(560px, 90%)", height: 5, borderRadius: 999, background: "rgba(255,255,255,0.08)", margin: "0 auto", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${D.amber}, ${D.coral})`, transition: "width 1s linear" }} />
        </div>
        <div style={{ fontFamily: mn, fontSize: 10.5, color: D.txd, marginTop: 6 }}>{label(winStart)} → {label(winEnd)}</div>
      </div>

      {/* body: current + plan */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 26, marginTop: 26, minHeight: 0 }}>
        {/* current task */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ fontFamily: mn, fontSize: 11, letterSpacing: 1.5, color: D.txm, textTransform: "uppercase", marginBottom: 8 }}>Now</div>
          <div style={{ fontFamily: gf, fontSize: "clamp(26px, 4vw, 46px)", fontWeight: 800, letterSpacing: -0.8, lineHeight: 1.1, color: D.tx }}>{current?.title || "Free time"}</div>
          {current && <div style={{ fontFamily: mn, fontSize: 12, color: D.amber, marginTop: 8 }}>{label(current.startMin)} – {label(current.endMin)} · {current.endMin - current.startMin}m</div>}
          {subs.length > 0 && (
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
              {subs.map((s) => {
                const on = checked[s.id] ?? s.done;
                return (
                  <button key={s.id} onClick={() => setChecked((p) => ({ ...p, [s.id]: !on }))} style={{ display: "flex", alignItems: "center", gap: 10, background: "transparent", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                    <span style={{ width: 18, height: 18, borderRadius: 5, flex: "none", border: `1.5px solid ${on ? D.teal : D.border}`, background: on ? D.teal : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#060608" }}>{on && <Check size={12} />}</span>
                    <span style={{ fontFamily: ft, fontSize: 15, color: on ? D.txd : D.tx, textDecoration: on ? "line-through" : "none" }}>{s.title}</span>
                  </button>
                );
              })}
            </div>
          )}
          {current?.task?.description && <div style={{ marginTop: 16, fontFamily: ft, fontSize: 13.5, color: D.txm, lineHeight: 1.5, maxWidth: 560 }}>{current.task.description}</div>}
          {next && <div style={{ marginTop: "auto", paddingTop: 16, fontFamily: mn, fontSize: 12, color: D.txd, display: "inline-flex", alignItems: "center", gap: 7 }}><ChevronRight size={13} color={D.amber} /> Next: {next.title} · {label(next.startMin)}</div>}
        </div>

        {/* plan timeline + notes */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0, gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={{ fontFamily: mn, fontSize: 11, letterSpacing: 1.5, color: D.txm, textTransform: "uppercase", marginBottom: 8 }}>The run</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, overflowY: "auto" }}>
              {plan.map((p) => {
                const isNow = current && p.id === current.id && p.kind === current.kind;
                const accent = p.kind === "event" ? (scheduleKindOf(typeof p.e?.payload?.scheduleKind === "string" ? p.e!.payload!.scheduleKind as string : "")?.color || TYPE_COLOR[p.e?.type || "manual"]) : D.amber;
                const past = nowMin >= p.endMin;
                return (
                  <div key={p.kind + p.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", borderRadius: 8, border: `1px solid ${isNow ? D.amber : D.border}`, background: isNow ? D.amber + "16" : "transparent", opacity: past ? 0.4 : 1 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 999, background: accent, flex: "none" }} />
                    <span style={{ fontFamily: mn, fontSize: 10, color: D.txm, width: 52, flex: "none" }}>{label(p.startMin)}</span>
                    <span style={{ fontFamily: ft, fontSize: 12.5, color: D.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{p.title}</span>
                    {p.kind === "event" && <span style={{ fontFamily: mn, fontSize: 8, color: D.txd, flex: "none" }}>FIXED</span>}
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontFamily: mn, fontSize: 11, letterSpacing: 1.5, color: D.txm, textTransform: "uppercase", marginBottom: 8, display: "inline-flex", alignItems: "center", gap: 6 }}><Coffee size={12} /> Scratchpad</div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Capture stray thoughts so you can stay locked in…"
              style={{ resize: "none", height: 90, background: "rgba(255,255,255,0.03)", border: `1px solid ${D.border}`, borderRadius: 10, color: D.tx, fontFamily: ft, fontSize: 13, padding: "10px 12px", outline: "none", lineHeight: 1.5 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── small bits ──
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontFamily: mn, fontSize: 9.5, letterSpacing: 0.8, textTransform: "uppercase", color: D.txd, fontWeight: 700, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}
function ChipRow({ options, value, onPick }: { options: string[]; value: string; onPick: (l: string) => void }) {
  return (
    <div style={{ display: "inline-flex", flexWrap: "wrap", gap: 6 }}>
      {options.map((o) => {
        const on = o === value;
        return <button key={o} onClick={() => onPick(o)} style={{ cursor: "pointer", padding: "6px 12px", borderRadius: 8, fontFamily: mn, fontSize: 11, fontWeight: 700, border: `1px solid ${on ? D.amber : D.border}`, color: on ? D.amber : D.txm, background: on ? D.amber + "18" : D.card }}>{o}</button>;
      })}
    </div>
  );
}
function Empty({ text }: { text: string }) { return <div style={{ fontFamily: mn, fontSize: 10.5, color: D.txd, padding: "10px 4px" }}>{text}</div>; }
const iconBtn: React.CSSProperties = { width: 30, height: 30, borderRadius: 8, border: `1px solid ${D.border}`, background: "transparent", color: D.txm, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" };
const ghostBtn: React.CSSProperties = { cursor: "pointer", border: `1px solid ${D.border}`, background: "transparent", color: D.tx, borderRadius: 9, padding: "9px 15px", fontFamily: mn, fontSize: 11.5, fontWeight: 600 };
