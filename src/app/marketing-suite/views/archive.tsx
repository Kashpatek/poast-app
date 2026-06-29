"use client";
// MarketingSUITE · Archive + Weekly Ops.
//
// The user's ask: "add an archive section on the left to see completed work,
// track what was done this week, and have an ongoing 'Weekly Ops' list forming.
// Refer to the .skill i have on my account for it Standups and how to write it."
//
//   • DONE THIS WEEK — everything completed since Monday (done events + done
//     board tasks), grouped by day, with a shipped count.
//   • ARCHIVE — the full history of completed work, grouped by week (this week,
//     last week, then older ranges).
//   • WEEKLY OPS — the standing operational list (ongoing / ops-category tasks)
//     that accretes as the week goes; check items off here (synced to the board).
//   • WEEKLY DIGEST — a copyable standup-style write-up built from the above.
//     NOTE: the prose format here is a sensible default; it will be tuned to the
//     user's "Standups" skill once that skill is available on this machine.
//
// Read-mostly aggregation over m.events + the shared board store. Toggling a
// Weekly Ops item writes through the store (mode-gated, safe in demo).
import React, { useMemo, useState } from "react";
import {
  Archive, CheckCircle2, CalendarCheck, Repeat, Copy, Check, Rocket,
  ClipboardList, ArrowRight, Sparkles,
} from "lucide-react";
import { D, ft, gf, mn } from "../../shared-constants";
import {
  TYPE_COLOR, scheduleKindOf,
  type MarketingEvent, type BoardTaskLite,
} from "../marketing-constants";
import type { ViewProps } from "../use-marketing";
import { useBoardStore } from "../board-store";
import PageHeader from "../components/page-header";

const DAY = 86400000;
function startOfWeek(d: Date): Date {
  const x = new Date(d); const off = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - off); x.setHours(0, 0, 0, 0); return x;
}
const fmtDay = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const fmtRange = (s: Date) => {
  const e = new Date(s.getTime() + 6 * DAY);
  return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${e.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
};
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

// One unified completed item (event or task) for the archive timeline.
interface DoneItem {
  id: string; title: string; kind: "event" | "task";
  when: Date; group: string | null; accent: string; tag: string;
}

export default function ArchiveView({ m, onOpenView }: ViewProps) {
  const { events, campaigns } = m;
  const store = useBoardStore();
  const campName = useMemo(() => new Map(campaigns.map((c) => [c.id, c.name] as const)), [campaigns]);
  const [copied, setCopied] = useState(false);

  const now = new Date();
  const weekStart = startOfWeek(now);

  // ── Unified completed items: done events + done board tasks ──
  const done = useMemo<DoneItem[]>(() => {
    const out: DoneItem[] = [];
    for (const e of events) {
      if (e.status !== "done") continue;
      out.push({
        id: "e:" + e.id, title: e.title, kind: "event",
        when: new Date(e.start), group: e.campaignId ? campName.get(e.campaignId) || null : null,
        accent: TYPE_COLOR[e.type] || D.teal, tag: e.type,
      });
    }
    for (const t of store.tasks) {
      if (!t.done) continue;
      out.push({
        id: "t:" + t.id, title: t.title, kind: "task",
        when: new Date(t.updatedAt || t.addedAt || now.toISOString()),
        group: t.category || null, accent: D.blue, tag: "task",
      });
    }
    return out.sort((a, b) => b.when.getTime() - a.when.getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, store.tasks, campName]);

  const thisWeek = useMemo(() => done.filter((d) => d.when >= weekStart), [done, weekStart]);

  // Group the full history by week (newest first).
  const byWeek = useMemo(() => {
    const map = new Map<number, { start: Date; items: DoneItem[] }>();
    for (const d of done) {
      const ws = startOfWeek(d.when).getTime();
      if (!map.has(ws)) map.set(ws, { start: new Date(ws), items: [] });
      map.get(ws)!.items.push(d);
    }
    return [...map.values()].sort((a, b) => b.start.getTime() - a.start.getTime());
  }, [done]);

  // ── Weekly Ops — the standing operational list (ongoing / ops-category) ──
  const weeklyOps = useMemo(
    () => store.tasks
      .filter((t) => (t.priority || "").toUpperCase() === "ONGOING" || /ops|operations/i.test(t.category || ""))
      .sort((a, b) => Number(!!a.done) - Number(!!b.done) || (a.title || "").localeCompare(b.title || "")),
    [store.tasks],
  );
  const opsDone = weeklyOps.filter((t) => t.done).length;

  // ── In-flight + next-up (for the digest + a glance) ──
  const inFlight = useMemo(
    () => events.filter((e) => e.status === "live" || (e.status === "scheduled" && new Date(e.start) >= weekStart && new Date(e.start) <= now)),
    [events, weekStart, now],
  );
  const nextUp = useMemo(() => {
    const horizon = now.getTime() + 7 * DAY;
    return events
      .filter((e) => e.status !== "done" && new Date(e.start).getTime() > now.getTime() && new Date(e.start).getTime() <= horizon)
      .filter((e) => e.type === "launch" || scheduleKindOf(typeof e.payload?.scheduleKind === "string" ? e.payload.scheduleKind : null).key === "deadline" || e.type === "production")
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 8);
  }, [events, now]);

  // ── The copyable standup-style digest (format provisional → Standups skill) ──
  const digest = useMemo(() => {
    const line = (d: DoneItem) => `- ${d.title}${d.group ? ` — ${d.group}` : ""}`;
    const evLine = (e: MarketingEvent) => `- ${e.title}${e.campaignId && campName.get(e.campaignId) ? ` — ${campName.get(e.campaignId)}` : ""}`;
    const L: string[] = [];
    L.push(`*Marketing — week of ${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}*`, "");
    L.push(`✅ Shipped (${thisWeek.length})`);
    L.push(...(thisWeek.length ? thisWeek.map(line) : ["- —"]), "");
    L.push(`🟢 In flight (${inFlight.length})`);
    L.push(...(inFlight.length ? inFlight.map(evLine) : ["- —"]), "");
    L.push(`⏭️ Next up (${nextUp.length})`);
    L.push(...(nextUp.length ? nextUp.map((e) => `${evLine(e)} · ${fmtDay(new Date(e.start))}`) : ["- —"]), "");
    L.push(`🔁 Weekly Ops (${opsDone}/${weeklyOps.length})`);
    L.push(...(weeklyOps.length ? weeklyOps.map((t) => `- ${t.done ? "✓" : "·"} ${t.title}`) : ["- —"]));
    return L.join("\n");
  }, [thisWeek, inFlight, nextUp, weeklyOps, opsDone, weekStart, campName]);

  const copyDigest = async () => {
    try { await navigator.clipboard.writeText(digest); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  };

  const empty = done.length === 0 && weeklyOps.length === 0;

  return (
    <div style={{ padding: "22px 26px 48px", fontFamily: ft, width: "100%" }}>
      <PageHeader
        id="archive"
        title="Archive"
        subtitle="Completed work, what shipped this week, and the Weekly Ops list as it forms — ready to drop into your standup."
      />

      {/* Summary strip */}
      <div style={sumStrip}>
        <SumCell label="SHIPPED THIS WEEK" value={String(thisWeek.length)} Icon={CheckCircle2} color={thisWeek.length ? D.teal : D.txm} />
        <SumCell label="DONE ALL-TIME" value={String(done.length)} Icon={Archive} color={done.length ? D.blue : D.txm} />
        <SumCell label="WEEKLY OPS" value={`${opsDone}/${weeklyOps.length}`} Icon={Repeat} color={weeklyOps.length ? D.amber : D.txm} />
        <SumCell label="IN FLIGHT" value={String(inFlight.length)} Icon={Rocket} color={inFlight.length ? D.crimson : D.txm} />
      </div>

      {empty ? (
        <div style={emptyWrap}>
          <Sparkles size={20} color={D.txd} />
          <div style={{ fontFamily: gf, fontSize: 17, color: D.tx, marginTop: 10 }}>Nothing archived yet</div>
          <div style={{ fontFamily: mn, fontSize: 12, color: D.txm, marginTop: 6, lineHeight: 1.6, maxWidth: 440 }}>
            Mark tasks or calendar items done and they roll up here — this week&apos;s wins, the running Weekly Ops list, and a standup you can copy.
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.7fr) minmax(280px, 1fr)", gap: 22, alignItems: "start" }}>
          {/* ── LEFT: this week + history ── */}
          <div>
            <SectionTitle Icon={CalendarCheck} color={D.teal} title="DONE THIS WEEK" count={thisWeek.length} sub={fmtRange(weekStart)} />
            {thisWeek.length === 0 ? (
              <div style={muted}>Nothing completed yet this week — it&apos;ll appear here as you check things off.</div>
            ) : (
              <DayGroups items={thisWeek} />
            )}

            {byWeek.length > 1 && (
              <div style={{ marginTop: 30 }}>
                <SectionTitle Icon={Archive} color={D.blue} title="EARLIER" count={done.length - thisWeek.length} sub="by week" />
                {byWeek.filter((w) => w.start.getTime() !== weekStart.getTime()).map((w) => (
                  <WeekBlock key={w.start.getTime()} label={fmtRange(w.start)} items={w.items} />
                ))}
              </div>
            )}
          </div>

          {/* ── RIGHT: Weekly Ops + Digest ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={panel}>
              <SectionTitle Icon={Repeat} color={D.amber} title="WEEKLY OPS" count={weeklyOps.length} sub={`${opsDone} done`} />
              {weeklyOps.length === 0 ? (
                <div style={muted}>Tag tasks “ONGOING” or put them in an Ops category and they form your weekly operational list here.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                  {weeklyOps.map((t) => <OpsRow key={t.id} t={t} onToggle={() => store.updateBoardTask(t.id, { done: !t.done })} />)}
                </div>
              )}
            </div>

            <div style={panel}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
                <ClipboardList size={14} color={D.violet} />
                <span style={{ fontFamily: mn, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: D.tx }}>Weekly digest</span>
                <span style={{ flex: 1 }} />
                <button onClick={copyDigest} title="Copy the standup" style={{
                  display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontFamily: mn, fontSize: 10.5, fontWeight: 700,
                  borderRadius: 8, padding: "6px 11px", border: `1px solid ${copied ? D.teal + "77" : D.violet + "55"}`,
                  background: copied ? D.teal + "16" : D.violet + "12", color: copied ? D.teal : D.violet,
                }}>
                  {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <pre style={{
                margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: mn, fontSize: 11, lineHeight: 1.7,
                color: D.txm, background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10, padding: "12px 13px", maxHeight: 360, overflow: "auto",
              }}>{digest}</pre>
              <div style={{ fontFamily: mn, fontSize: 8.5, color: D.txd, marginTop: 7, lineHeight: 1.5 }}>
                Format will be tuned to your Standups skill once it&apos;s on this machine.
              </div>
            </div>

            {nextUp.length > 0 && (
              <div style={panel}>
                <SectionTitle Icon={ArrowRight} color={D.crimson} title="NEXT UP" count={nextUp.length} sub="next 7 days" />
                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 4 }}>
                  {nextUp.map((e) => (
                    <button key={e.id} onClick={() => onOpenView?.("campaigns", e.campaignId || undefined)} style={nextRow}>
                      <span style={{ width: 7, height: 7, borderRadius: 2, background: TYPE_COLOR[e.type] || D.amber, flex: "none" }} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: D.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</span>
                      <span style={{ fontFamily: mn, fontSize: 9.5, color: D.txd, flex: "none" }}>{fmtDay(new Date(e.start))}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════ Pieces ══════════════ */
function DayGroups({ items }: { items: DoneItem[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, { when: Date; items: DoneItem[] }>();
    for (const it of items) {
      const k = dayKey(it.when);
      if (!map.has(k)) map.set(k, { when: it.when, items: [] });
      map.get(k)!.items.push(it);
    }
    return [...map.values()].sort((a, b) => b.when.getTime() - a.when.getTime());
  }, [items]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {groups.map((g) => (
        <div key={dayKey(g.when)}>
          <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 0.5, color: D.txd, marginBottom: 7 }}>{fmtDay(g.when)}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {g.items.map((it) => <DoneRow key={it.id} it={it} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function WeekBlock({ label, items }: { label: string; items: DoneItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 10 }}>
      <button onClick={() => setOpen((v) => !v)} style={{
        display: "flex", alignItems: "center", gap: 9, width: "100%", cursor: "pointer", textAlign: "left",
        background: "transparent", border: "none", padding: "6px 0", color: D.txm,
      }}>
        <span style={{ fontFamily: mn, fontSize: 11, color: D.tx }}>{label}</span>
        <span style={{ fontFamily: mn, fontSize: 9.5, color: D.txd, border: `1px solid ${D.border}`, borderRadius: 999, padding: "1px 7px" }}>{items.length}</span>
        <div style={{ flex: 1, height: 1, background: D.border }} />
        <span style={{ fontFamily: mn, fontSize: 9.5, color: D.txd }}>{open ? "hide" : "show"}</span>
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
          {items.map((it) => <DoneRow key={it.id} it={it} />)}
        </div>
      )}
    </div>
  );
}

function DoneRow({ it }: { it: DoneItem }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 11px", borderRadius: 10, border: `1px solid ${D.border}`, background: D.card }}>
      <CheckCircle2 size={14} color={D.teal} style={{ flex: "none" }} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: D.txm, textDecoration: "line-through", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.title}</span>
      {it.group && <span style={{ fontFamily: mn, fontSize: 8.5, color: D.txd, textTransform: "uppercase", letterSpacing: 0.3, flex: "none" }}>{it.group}</span>}
      <span style={{ fontFamily: mn, fontSize: 8, fontWeight: 700, letterSpacing: 0.4, color: it.accent, border: `1px solid ${it.accent}44`, borderRadius: 5, padding: "1px 6px", flex: "none", textTransform: "uppercase" }}>{it.tag}</span>
    </div>
  );
}

function OpsRow({ t, onToggle }: { t: BoardTaskLite; onToggle: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 4px" }}>
      <button onClick={onToggle} title={t.done ? "Mark not done" : "Mark done"} style={{ flex: "none", width: 16, height: 16, borderRadius: "50%", cursor: "pointer", padding: 0,
        border: `1.6px solid ${t.done ? D.teal : D.txd}`, background: t.done ? D.teal : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        {t.done && <Check size={9} color="#08110d" />}
      </button>
      <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: t.done ? D.txd : D.tx, textDecoration: t.done ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
      {t.category && <span style={{ fontFamily: mn, fontSize: 8, color: D.txd, textTransform: "uppercase", letterSpacing: 0.3, flex: "none" }}>{t.category}</span>}
    </div>
  );
}

function SectionTitle({ Icon, color, title, count, sub }: { Icon: typeof Archive; color: string; title: string; count: number; sub?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, margin: "0 0 12px" }}>
      <Icon size={14} color={color} />
      <span style={{ fontFamily: mn, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: D.tx }}>{title}</span>
      <span style={{ fontFamily: mn, fontSize: 10, color, padding: "1px 8px", borderRadius: 999, border: `1px solid ${color}55` }}>{count}</span>
      {sub && <span style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4 }}>· {sub}</span>}
      <div style={{ flex: 1, height: 1, background: D.border, marginLeft: 4 }} />
    </div>
  );
}

function SumCell({ label, value, Icon, color }: { label: string; value: string; Icon: typeof Archive; color: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: mn, fontSize: 9, letterSpacing: 1, color: D.txd, display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
        <Icon size={11} color={color} /> {label}
      </div>
      <div style={{ fontFamily: gf, fontSize: 23, color: D.tx, letterSpacing: -0.4 }}>{value}</div>
    </div>
  );
}

/* ══════════════ Styles ══════════════ */
const sumStrip: React.CSSProperties = {
  display: "flex", gap: 30, flexWrap: "wrap", alignItems: "center",
  border: `1px solid ${D.border}`, borderRadius: 16, padding: "18px 22px", marginBottom: 24,
  background: "linear-gradient(135deg, rgba(45,191,150,.05), rgba(91,140,255,.03))",
};
const panel: React.CSSProperties = {
  border: `1px solid ${D.border}`, borderRadius: 14, padding: "15px 16px",
  background: "linear-gradient(150deg, #0b0b12, #0d0d15)",
};
const muted: React.CSSProperties = { fontFamily: mn, fontSize: 11, color: D.txd, lineHeight: 1.6, padding: "4px 0" };
const nextRow: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left", cursor: "pointer",
  padding: "8px 10px", borderRadius: 9, border: `1px solid ${D.border}`, background: D.card, color: D.tx,
};
const emptyWrap: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
  padding: "60px 24px", border: `1px dashed ${D.border}`, borderRadius: 16, background: D.cardGrad,
};
