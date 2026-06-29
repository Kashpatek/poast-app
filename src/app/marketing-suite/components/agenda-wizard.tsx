"use client";
// Plan my day — a visual time-slot planner. Set a window (which can run past
// midnight, e.g. 10pm → 1am), then SEE the hours: the left timeline shows every
// slot from start → end with :30 / :15 ticks. Drag tasks from the backlog onto a
// slot to block time, drag a block to re-time it, drag its edge to stretch the
// length. "Fill" packs the backlog into the gaps; "Auto-build" lets Claude lay it
// out. Nothing is written until you hit "Add to my day".
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Wand2, Plus, X, Loader2, GripVertical, Clock, Zap, Eraser } from "lucide-react";
import { D, ft, gf, mn, uid } from "../../shared-constants";
import { Modal, GhostBtn } from "./modal";
import type { MarketingState } from "../use-marketing";
import { isAllDayEvent, type BoardTaskLite } from "../marketing-constants";
import { useBoardTasks } from "../use-board-tasks";

// ── geometry / time ──
const HOUR_PX = 52;
const GUTTER = 54;
const SNAP = 15;        // drag/resize snap
const BOOK_SNAP = 30;   // drop snaps to clean :30 slots
const DAY = 1440;

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function toDateStr(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function minsOfDay(d: Date) { return d.getHours() * 60 + d.getMinutes(); }
function parseHHMM(s: string) { const [h, m] = s.split(":").map(Number); return (h || 0) * 60 + (m || 0); }
function hhmm(min: number) { const v = ((min % DAY) + DAY) % DAY; return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(Math.round(v % 60)).padStart(2, "0")}`; }
function isoAt(date: Date, min: number) { const d = new Date(date); d.setHours(Math.floor(min / 60), Math.round(min % 60), 0, 0); return d.toISOString(); }
function snap(min: number) { return Math.round(min / SNAP) * SNAP; }
function snapBook(min: number) { return Math.round(min / BOOK_SNAP) * BOOK_SNAP; }
function estMins(t: BoardTaskLite) { return t.estimateMins && t.estimateMins > 0 ? t.estimateMins : 45; }
// absolute-minute → am/pm label, rolls past midnight (24h → 12a, 25h → 1a)
function label(abs: number) {
  const h = Math.floor(abs / 60) % 24, m = Math.round(abs % 60);
  const ap = h < 12 ? "a" : "p", h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${ap}` : `${h12}:${String(m).padStart(2, "0")}${ap}`;
}
// absolute minute (may exceed 1440 = next day) → real ISO on the right calendar day
function absToISO(windowDate: Date, abs: number) { const off = Math.floor(abs / DAY); return isoAt(addDays(windowDate, off), abs - off * DAY); }

interface Block { id: string; taskId?: string; title: string; startMin: number; endMin: number; } // absolute minutes
type Tab = "priority" | "due" | "category";
const PRIORITY_RANK: Record<string, number> = { HIGH: 0, MEDIUM: 1, "THIS WEEK": 2, ONGOING: 3, DONE: 9 };
const PRIO_COLOR: Record<string, string> = { HIGH: D.coral, MEDIUM: D.amber, "THIS WEEK": D.blue, ONGOING: D.txd };

export default function AgendaWizard({ open, m, date, onClose, onOpenView }: {
  open: boolean;
  m: MarketingState;
  date: Date;
  onClose: () => void;
  onOpenView?: (v: string, focusId?: string) => void;
}) {
  const allTasks = useBoardTasks();
  const openTasks = useMemo(() => allTasks.filter((t) => !t.done), [allTasks]);

  // ── window (start → end, may cross midnight) ──
  const defaultStart = useMemo(() => {
    const isToday = startOfDay(new Date()).getTime() === startOfDay(date).getTime();
    return hhmm(snapBook(Math.min(isToday ? minsOfDay(new Date()) + 5 : 9 * 60, DAY - 60)));
  }, [date]);
  const [startTime, setStartTime] = useState(defaultStart);
  const [endTime, setEndTime] = useState(() => hhmm(parseHHMM(defaultStart) + 4 * 60));
  const [tab, setTab] = useState<Tab>("priority");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "ai">(null);
  const [result, setResult] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStartTime(defaultStart);
    setEndTime(hhmm(parseHHMM(defaultStart) + 4 * 60));
    setBlocks([]); setSelected(null); setResult(null); setErr(null);
  }, [open, defaultStart]);

  const winStart = parseHHMM(startTime);
  let winEnd = parseHHMM(endTime);
  if (winEnd <= winStart) winEnd += DAY;           // crosses midnight
  const winLen = winEnd - winStart;
  const firstHour = Math.floor(winStart / 60);
  const lastHour = Math.ceil(winEnd / 60);
  const rows = Math.max(1, lastHour - firstHour);
  const canvasH = rows * HOUR_PX;
  const yOf = (abs: number) => ((abs - firstHour * 60) / 60) * HOUR_PX;
  const minAt = (y: number) => firstHour * 60 + (y / HOUR_PX) * 60;
  const clampWin = (x: number) => Math.max(winStart, Math.min(winEnd, x));

  // Existing events on this day (and the small hours of the next) → fixed blocks.
  const fixed = useMemo<Block[]>(() => {
    const wd = startOfDay(date).getTime();
    const out: Block[] = [];
    for (const e of m.events) {
      if (isAllDayEvent(e)) continue;
      const s = new Date(e.start);
      const dayDiff = Math.round((startOfDay(s).getTime() - wd) / 86400000);
      if (dayDiff < 0 || dayDiff > 1) continue;
      const sm = minsOfDay(s) + dayDiff * DAY;
      let em = sm + 30;
      if (e.end) { const en = new Date(e.end); em = minsOfDay(en) + Math.round((startOfDay(en).getTime() - wd) / 86400000) * DAY; }
      const b = { id: "fx-" + e.id, title: e.title, startMin: sm, endMin: Math.max(em, sm + 15) };
      if (b.endMin > winStart && b.startMin < winEnd) out.push(b);
    }
    return out;
  }, [m.events, date, winStart, winEnd]);

  const candidates = useMemo(() => {
    const arr = [...openTasks];
    if (tab === "priority") arr.sort((a, b) => (PRIORITY_RANK[a.priority || "MEDIUM"] ?? 1) - (PRIORITY_RANK[b.priority || "MEDIUM"] ?? 1) || (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
    else if (tab === "due") arr.sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
    else arr.sort((a, b) => (a.category || "ZZ").localeCompare(b.category || "ZZ"));
    return arr;
  }, [openTasks, tab]);
  const placedIds = useMemo(() => new Set(blocks.map((b) => b.taskId).filter(Boolean)), [blocks]);
  const backlog = candidates.filter((t) => !placedIds.has(t.id));

  const occupied = (extra: Block[] = []): [number, number][] => [
    ...fixed.map((f) => [Math.max(f.startMin, winStart), Math.min(f.endMin, winEnd)] as [number, number]),
    ...blocks.map((b) => [b.startMin, b.endMin] as [number, number]),
    ...extra.map((b) => [b.startMin, b.endMin] as [number, number]),
  ];
  function firstFit(dur: number, occ: [number, number][]): number | null {
    const o = [...occ].sort((a, b) => a[0] - b[0]);
    let cur = winStart;
    for (const [s, e] of o) { if (s - cur >= dur) return cur; cur = Math.max(cur, e); }
    return winEnd - cur >= dur ? cur : null;
  }

  function placeTask(t: BoardTaskLite, atAbs: number) {
    const dur = Math.min(estMins(t), Math.max(15, winLen));
    let s = clampWin(snapBook(atAbs));
    if (s + dur > winEnd) s = Math.max(winStart, winEnd - dur);
    const id = uid("blk");
    setBlocks((prev) => [...prev, { id, taskId: t.id, title: t.title, startMin: s, endMin: Math.max(s + 15, s + dur) }]);
    setSelected(id);
  }
  function autoPlace(t: BoardTaskLite) {
    const dur = Math.min(estMins(t), Math.max(15, winLen));
    const pos = firstFit(dur, occupied());
    placeTask(t, pos ?? winStart);
  }
  function removeBlock(id: string) { setBlocks((prev) => prev.filter((b) => b.id !== id)); }

  // ── Fill: pack the backlog into the gaps around fixed events ──
  function fillDay() {
    setErr(null); setResult(null);
    const occ = fixed.map((f) => [Math.max(f.startMin, winStart), Math.min(f.endMin, winEnd)] as [number, number]);
    const placed: Block[] = [];
    for (const t of candidates) {
      const dur = Math.min(estMins(t), Math.max(15, winLen));
      const pos = firstFit(dur, occ);
      if (pos == null) continue;
      placed.push({ id: uid("blk"), taskId: t.id, title: t.title, startMin: pos, endMin: pos + dur });
      occ.push([pos, pos + dur]); occ.sort((a, b) => a[0] - b[0]);
    }
    setBlocks(placed); setSelected(null);
    setResult(placed.length ? `Filled ${placed.length} block${placed.length === 1 ? "" : "s"} into your window.` : "Nothing fit — widen the window or add estimates.");
  }

  // ── Auto-build with Claude ──
  async function buildAI() {
    setBusy("ai"); setErr(null); setResult(null);
    try {
      const res = await fetch("/api/assistant/plan-day", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: toDateStr(date), startTime, endTime,
          busy: fixed.map((f) => ({ startTime: hhmm(f.startMin), endTime: hhmm(f.endMin), title: f.title })),
          tasks: candidates.slice(0, 16).map((t) => ({ id: t.id, title: t.title, estimateMins: t.estimateMins, priority: t.priority, subtasks: (t.subtasks || []).length })),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not build a plan");
      const plan = Array.isArray(j.plan) ? j.plan : [];
      const toAbs = (s: string) => { const v = parseHHMM(s); return v < winStart ? v + DAY : v; };
      const occ = fixed.map((f) => [Math.max(f.startMin, winStart), Math.min(f.endMin, winEnd)] as [number, number]);
      const out: Block[] = [];
      for (const b of plan) {
        const s = toAbs(b.startTime); let e = toAbs(b.endTime); if (e <= s) e += DAY;
        if (isNaN(s) || isNaN(e) || e <= s) continue;
        if (s < winStart || e > winEnd) continue;
        if (occ.some(([os, oe]) => s < oe && e > os)) continue;
        out.push({ id: uid("blk"), taskId: b.taskId, title: b.title, startMin: s, endMin: e });
        occ.push([s, e]);
      }
      setBlocks(out); setSelected(null);
      setResult(out.length ? `Claude built ${out.length} block${out.length === 1 ? "" : "s"}${j.summary ? " · " + j.summary : ""}` : "The planner returned nothing that fit.");
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally { setBusy(null); }
  }

  function commit() {
    if (!blocks.length) { setErr("Nothing planned yet — drag tasks onto the timeline, or hit Fill / Auto-build."); return; }
    for (const b of [...blocks].sort((a, z) => a.startMin - z.startMin)) {
      m.addEvent({
        title: b.title, type: "manual", status: "scheduled",
        start: absToISO(date, b.startMin), end: absToISO(date, b.endMin),
        source: "poast", payload: { scheduleKind: "block", ...(b.taskId ? { sourceTaskId: b.taskId } : {}) },
      });
    }
    onOpenView?.("schedule");
    onClose();
  }

  const winHrs = Math.floor(winLen / 60), winMins = winLen % 60;
  const focusMins = blocks.reduce((n, b) => n + (b.endMin - b.startMin), 0);

  return (
    <Modal
      open={open} title="Plan my day"
      subtitle="Set your window, then drag tasks onto the slots. Crosses midnight — work 10pm → 1am if you want."
      accent={D.violet} icon={<Wand2 size={17} />} width={980} onClose={onClose}
      footer={<>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: "auto", fontFamily: mn, fontSize: 11, color: D.txm, flexWrap: "wrap" }}>
          <Clock size={13} />
          <span>From</span>
          <TimeInput value={startTime} onChange={setStartTime} />
          <span>to</span>
          <TimeInput value={endTime} onChange={setEndTime} />
          <span style={{ color: D.txd }}>· {winHrs}h{winMins ? ` ${winMins}m` : ""} window</span>
        </div>
        <GhostBtn onClick={onClose}>Cancel</GhostBtn>
        <button onClick={buildAI} disabled={!!busy} style={{
          display: "inline-flex", alignItems: "center", gap: 6, cursor: busy ? "default" : "pointer", borderRadius: 9, padding: "9px 15px",
          border: `1px solid ${D.violet}66`, background: D.violet + "16", color: D.violet, fontFamily: mn, fontSize: 11.5, fontWeight: 700, opacity: busy ? 0.6 : 1,
        }}>{busy === "ai" ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : "✨"} Auto-build</button>
        <button onClick={commit} disabled={!blocks.length} style={{
          display: "inline-flex", alignItems: "center", gap: 7, cursor: blocks.length ? "pointer" : "default", borderRadius: 9, padding: "9px 17px",
          border: "none", color: "#150a1c", fontFamily: mn, fontSize: 11.5, fontWeight: 800, letterSpacing: 0.3,
          background: `linear-gradient(135deg, ${D.violet}, ${D.violet}cc)`, opacity: blocks.length ? 1 : 0.5,
        }}><Plus size={14} /> Add to my day</button>
      </>}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 13 }}>
        {/* ── LEFT: the timeline ── */}
        <div style={{ border: `1px solid ${D.border}`, borderRadius: 12, background: D.card, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: `1px solid ${D.border}` }}>
            <span style={{ fontFamily: gf, fontSize: 14, fontWeight: 800, color: D.tx }}>Your day</span>
            <span style={{ fontFamily: mn, fontSize: 9.5, color: D.txd }}>{label(winStart)} → {label(winEnd)}</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontFamily: mn, fontSize: 9, color: D.txd }}>{blocks.length} · {Math.round(focusMins / 60 * 10) / 10}h</span>
            <MiniBtn onClick={fillDay} title="Pack the backlog into the gaps"><Wand2 size={11} /> Fill</MiniBtn>
            <MiniBtn onClick={() => { setBlocks([]); setSelected(null); }} title="Clear planned blocks"><Eraser size={11} /></MiniBtn>
          </div>
          <Timeline
            canvasH={canvasH} firstHour={firstHour} lastHour={lastHour} winStart={winStart} winEnd={winEnd}
            yOf={yOf} minAt={minAt} clampWin={clampWin} fixed={fixed} blocks={blocks} setBlocks={setBlocks}
            selected={selected} setSelected={setSelected} onRemove={removeBlock}
            onDropTask={(taskId, atY) => { const t = openTasks.find((x) => x.id === taskId); if (t) placeTask(t, minAt(atY)); }}
          />
        </div>

        {/* ── RIGHT: backlog ── */}
        <div style={{ border: `1px solid ${D.border}`, borderRadius: 12, background: D.card, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: `1px solid ${D.border}` }}>
            <span style={{ fontFamily: gf, fontSize: 14, fontWeight: 800, color: D.tx }}>Backlog</span>
            <span style={{ flex: 1 }} />
            <div style={{ display: "inline-flex", border: `1px solid ${D.border}`, borderRadius: 8, overflow: "hidden" }}>
              {(["priority", "due", "category"] as Tab[]).map((tb, i) => (
                <button key={tb} onClick={() => setTab(tb)} style={{
                  fontFamily: mn, fontSize: 9, padding: "4px 8px", cursor: "pointer", border: "none",
                  borderLeft: i ? `1px solid ${D.border}` : "none", textTransform: "capitalize",
                  color: tab === tb ? D.tx : D.txm, background: tab === tb ? D.hover : "transparent",
                }}>{tb}</button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "10px 11px", display: "flex", flexDirection: "column", gap: 6, maxHeight: rows > 0 ? Math.max(360, Math.min(canvasH + 44, 520)) : 420 }}>
            {backlog.length === 0 && <div style={{ fontFamily: mn, fontSize: 10.5, color: D.txd, padding: "14px 4px", textAlign: "center" }}>{candidates.length ? "Everything's slotted in 🎉" : "No open tasks. Add some on the Board."}</div>}
            {backlog.slice(0, 80).map((t) => {
              const pc = t.priority ? PRIO_COLOR[t.priority] : null;
              return (
                <div key={t.id} draggable
                  onDragStart={(e) => { e.dataTransfer.setData("text/x-task-id", t.id); e.dataTransfer.effectAllowed = "copy"; }}
                  onClick={() => autoPlace(t)}
                  title="Drag onto a slot · click to drop at the next free slot"
                  style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "9px 10px", borderRadius: 10, border: `1px solid ${D.border}`, background: D.cardGrad, cursor: "grab", borderLeft: pc ? `3px solid ${pc}` : `1px solid ${D.border}` }}>
                  <GripVertical size={13} color={D.txd} style={{ flex: "none", marginTop: 1 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: ft, fontSize: 12.5, color: D.tx, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{t.title}</div>
                    <div style={{ display: "flex", gap: 7, marginTop: 4, fontFamily: mn, fontSize: 8.5, color: D.txd, flexWrap: "wrap" }}>
                      {pc && <span style={{ color: pc }}>{t.priority}</span>}
                      {t.category && <span>{t.category}</span>}
                      <span style={{ color: D.txm }}>{estMins(t)}m</span>
                      {t.dueDate && <span>due {t.dueDate.slice(5)}</span>}
                    </div>
                  </div>
                  <Plus size={14} color={D.txm} style={{ flex: "none", marginTop: 1 }} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {(result || err) && (
        <div style={{ fontFamily: mn, fontSize: 11.5, color: err ? D.coral : D.teal, border: `1px solid ${(err ? D.coral : D.teal)}44`, borderRadius: 8, padding: "9px 11px", background: (err ? D.coral : D.teal) + "10" }}>
          {err || result}
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </Modal>
  );
}

// ════════ TIMELINE ════════
function Timeline({ canvasH, firstHour, lastHour, winStart, winEnd, yOf, minAt, clampWin, fixed, blocks, setBlocks, selected, setSelected, onRemove, onDropTask }: {
  canvasH: number; firstHour: number; lastHour: number; winStart: number; winEnd: number;
  yOf: (abs: number) => number; minAt: (y: number) => number; clampWin: (x: number) => number;
  fixed: Block[]; blocks: Block[]; setBlocks: React.Dispatch<React.SetStateAction<Block[]>>;
  selected: string | null; setSelected: (id: string | null) => void; onRemove: (id: string) => void;
  onDropTask: (taskId: string, atY: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<{ id: string; mode: "move" | "resize" | "resize-top"; offMin: number; startY: number; moved: boolean; s: number; e: number } | null>(null);
  const [dragY, setDragY] = useState(0);
  const [ghostY, setGhostY] = useState<number | null>(null);

  // open scrolled to the window start
  useEffect(() => { const sc = scrollRef.current; if (sc) sc.scrollTop = Math.max(0, yOf(winStart) - 8); }, [winStart, canvasH]); // eslint-disable-line react-hooks/exhaustive-deps

  const snap15 = (x: number) => Math.round(x / SNAP) * SNAP;

  const onBlockDown = (e: React.PointerEvent, b: Block, mode: "move" | "resize" | "resize-top") => {
    e.preventDefault(); e.stopPropagation();
    const rect = canvasRef.current!.getBoundingClientRect();
    const y = e.clientY - rect.top;
    setDrag({ id: b.id, mode, offMin: minAt(y) - b.startMin, startY: y, moved: false, s: b.startMin, e: b.endMin });
    setDragY(y);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const y = e.clientY - rect.top;
    if (drag) {
      setDragY(y);
      if (!drag.moved && Math.abs(y - drag.startY) > 4) setDrag((d) => d ? { ...d, moved: true } : d);
      return;
    }
    const t = e.target as HTMLElement;
    setGhostY(t.closest("[data-blk]") ? null : snapBook(clampWin(minAt(y))));
  };
  const onUp = () => {
    if (!drag) return;
    if (!drag.moved) { setSelected(drag.id); setDrag(null); return; }
    const len = drag.e - drag.s;
    setBlocks((prev) => prev.map((b) => {
      if (b.id !== drag.id) return b;
      if (drag.mode === "move") { let s = clampWin(snap15(minAt(dragY) - drag.offMin)); if (s + len > winEnd) s = winEnd - len; s = Math.max(winStart, s); return { ...b, startMin: s, endMin: s + len }; }
      if (drag.mode === "resize") { const en = clampWin(snap15(Math.max(drag.s + SNAP, minAt(dragY)))); return { ...b, endMin: en }; }
      const st = clampWin(snap15(Math.min(drag.e - SNAP, minAt(dragY)))); return { ...b, startMin: st };
    }));
    setDrag(null);
  };

  return (
    <div ref={scrollRef} onPointerLeave={() => setGhostY(null)} style={{ flex: 1, overflowY: "auto", maxHeight: Math.max(360, Math.min(canvasH, 520)) }}>
      <div ref={canvasRef}
        onPointerMove={onMove} onPointerUp={onUp}
        onClick={(e) => { if (!(e.target as HTMLElement).closest("[data-blk]")) setSelected(null); }}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; const r = canvasRef.current!.getBoundingClientRect(); setGhostY(snapBook(clampWin(minAt(e.clientY - r.top)))); }}
        onDragLeave={() => setGhostY(null)}
        onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/x-task-id"); const r = canvasRef.current!.getBoundingClientRect(); setGhostY(null); if (id) onDropTask(id, e.clientY - r.top); }}
        style={{ position: "relative", height: canvasH, cursor: drag ? (drag.mode === "move" ? "grabbing" : "ns-resize") : "copy" }}
      >
        {/* hour rows + labels + :30/:15 ticks */}
        {Array.from({ length: lastHour - firstHour + 1 }, (_, i) => {
          const hour = firstHour + i; const y = i * HOUR_PX;
          return (
            <React.Fragment key={hour}>
              <div style={{ position: "absolute", left: GUTTER - 4, right: 0, top: y, height: 1, background: "rgba(255,255,255,0.06)" }} />
              <div style={{ position: "absolute", left: 0, top: y - 6, width: GUTTER - 10, textAlign: "right", fontFamily: mn, fontSize: 9.5, color: D.txd }}>{label(hour * 60)}</div>
            </React.Fragment>
          );
        })}
        {Array.from({ length: lastHour - firstHour }, (_, i) => (
          <React.Fragment key={"t" + i}>
            <div style={{ position: "absolute", left: GUTTER, right: 0, top: i * HOUR_PX + HOUR_PX / 2, height: 1, background: "rgba(255,255,255,0.04)" }} />
            <div style={{ position: "absolute", left: GUTTER, right: 0, top: i * HOUR_PX + HOUR_PX / 4, borderTop: "1px dotted rgba(255,255,255,0.03)" }} />
            <div style={{ position: "absolute", left: GUTTER, right: 0, top: i * HOUR_PX + (HOUR_PX * 3) / 4, borderTop: "1px dotted rgba(255,255,255,0.03)" }} />
          </React.Fragment>
        ))}

        {/* out-of-window shading */}
        {winStart > firstHour * 60 && <div style={{ position: "absolute", left: GUTTER, right: 0, top: 0, height: yOf(winStart), background: "rgba(0,0,0,0.28)", pointerEvents: "none" }} />}
        {winEnd < lastHour * 60 && <div style={{ position: "absolute", left: GUTTER, right: 0, top: yOf(winEnd), bottom: 0, background: "rgba(0,0,0,0.28)", pointerEvents: "none" }} />}

        {/* drop ghost */}
        {ghostY != null && !drag && (
          <div style={{ position: "absolute", left: GUTTER, right: 6, top: yOf(ghostY), height: (BOOK_SNAP / 60) * HOUR_PX - 2, borderRadius: 7, border: `1px dashed ${D.violet}99`, background: D.violet + "16", pointerEvents: "none", display: "flex", alignItems: "center", gap: 6, padding: "0 8px" }}>
            <Plus size={11} color={D.violet} /><span style={{ fontFamily: mn, fontSize: 9, color: D.violet }}>{label(ghostY)}</span>
          </div>
        )}

        {/* fixed (existing) events */}
        {fixed.map((f) => {
          const top = yOf(Math.max(f.startMin, winStart));
          const h = Math.max(18, yOf(Math.min(f.endMin, winEnd)) - top - 2);
          return (
            <div key={f.id} style={{ position: "absolute", left: GUTTER, right: 6, top, height: h, borderRadius: 7, border: `1px solid ${D.border}`, background: "repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0 6px, transparent 6px 12px)", padding: "3px 8px", overflow: "hidden", pointerEvents: "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontFamily: ft, fontSize: 11.5, color: D.txm, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{f.title}</span>
                <span style={{ fontFamily: mn, fontSize: 7.5, letterSpacing: 0.5, color: D.txd, flex: "none" }}>FIXED</span>
              </div>
            </div>
          );
        })}

        {/* planned task blocks */}
        {blocks.map((b) => {
          const isSel = selected === b.id;
          const dragging = drag?.id === b.id;
          const len = b.endMin - b.startMin;
          const liveS = dragging && drag!.mode === "move" ? clampWin(snap15(minAt(dragY) - drag!.offMin))
            : dragging && drag!.mode === "resize-top" ? clampWin(snap15(Math.min(b.endMin - SNAP, minAt(dragY)))) : b.startMin;
          const liveE = dragging && drag!.mode === "resize" ? clampWin(snap15(Math.max(b.startMin + SNAP, minAt(dragY)))) : (dragging && drag!.mode === "move" ? liveS + len : b.endMin);
          const top = yOf(liveS);
          const h = Math.max(20, yOf(liveE) - top - 2);
          return (
            <div key={b.id} data-blk
              onPointerDown={(e) => onBlockDown(e, b, "move")}
              style={{
                position: "absolute", left: GUTTER, right: 6, top, height: h,
                borderRadius: 8, border: `1px solid ${D.violet}${isSel ? "" : "88"}`, borderLeft: `3px solid ${D.violet}`,
                background: `linear-gradient(135deg, ${D.violet}33, ${D.violet}16)`,
                boxShadow: dragging ? "0 12px 28px rgba(0,0,0,0.5)" : isSel ? `0 0 0 1px ${D.violet}, 0 6px 18px rgba(0,0,0,0.4)` : "none",
                zIndex: dragging ? 30 : isSel ? 20 : 10, padding: "3px 8px", overflow: "hidden",
                cursor: dragging && drag!.mode === "move" ? "grabbing" : "grab", userSelect: "none", touchAction: "none",
              }}>
              {isSel && (
                <div onPointerDown={(e) => onBlockDown(e, b, "resize-top")} style={{ position: "absolute", left: 0, right: 0, top: -1, height: 10, cursor: "ns-resize", display: "flex", justifyContent: "center" }}>
                  <span style={{ width: 26, height: 3, borderRadius: 2, marginTop: 1, background: D.violet }} />
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontFamily: ft, fontSize: 11.5, fontWeight: 600, color: D.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{b.title}</span>
                <button onPointerDown={(e) => { e.stopPropagation(); }} onClick={(e) => { e.stopPropagation(); onRemove(b.id); }}
                  style={{ flex: "none", width: 16, height: 16, borderRadius: 5, border: "none", background: "transparent", color: D.txm, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><X size={11} /></button>
              </div>
              {h > 30 && <div style={{ fontFamily: mn, fontSize: 9, color: D.txm, marginTop: 1 }}>{label(liveS)}–{label(liveE)} · {liveE - liveS}m</div>}
              <div onPointerDown={(e) => onBlockDown(e, b, "resize")} style={{ position: "absolute", left: 0, right: 0, bottom: -1, height: isSel ? 12 : 8, cursor: "ns-resize", display: "flex", justifyContent: "center", alignItems: "flex-end" }}>
                {isSel && <span style={{ width: 26, height: 3, borderRadius: 2, marginBottom: 1, background: D.violet }} />}
              </div>
            </div>
          );
        })}

        {blocks.length === 0 && fixed.length === 0 && (
          <div style={{ position: "absolute", left: GUTTER + 10, right: 10, top: yOf(winStart) + 14, fontFamily: mn, fontSize: 10.5, color: D.txd, pointerEvents: "none" }}>
            <Zap size={12} style={{ verticalAlign: -2, marginRight: 5 }} />Drag tasks here, or hit Fill / Auto-build.
          </div>
        )}
      </div>
    </div>
  );
}

function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input type="time" value={value} onChange={(e) => onChange(e.target.value)}
      style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 7, color: D.tx, fontFamily: mn, fontSize: 12, padding: "5px 7px", colorScheme: "dark" }} />
  );
}

function MiniBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title?: string }) {
  return (
    <button onClick={onClick} title={title} style={{
      display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer", border: `1px solid ${D.border}`,
      background: D.cardGrad, color: D.txm, borderRadius: 7, padding: "5px 9px", fontFamily: mn, fontSize: 9.5,
    }}>{children}</button>
  );
}
