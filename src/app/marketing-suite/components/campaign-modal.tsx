"use client";
// MarketingSUITE · Campaign setup modal — create OR edit a campaign. Captures
// name/type/status/dates/goal, lets you pick a color, and (on create) builds the
// prep-task list. Prep tasks materialize as campaign events; by default they're
// dated to LEAD UP TO the release (T-n…T-1), or can be left unassigned.
import React, { useEffect, useState } from "react";
import { Megaphone, Sparkles, Plus, X, Loader2 } from "lucide-react";
import { D, ft, mn } from "../../shared-constants";
import { Modal, Field, TextInput, TextArea, Select, Row, GhostBtn, PrimaryBtn } from "./modal";
import { DatePicker } from "./date-picker";
import { leadUpDates } from "../marketing-constants";
import type { Campaign } from "../marketing-constants";
import type { MarketingState } from "../use-marketing";

const PALETTE = [D.violet, D.teal, D.coral, D.cyan, D.blue, D.amber];
const TYPES = ["Launch", "Series", "Always-on", "Event", "Awareness", "Recap", "Other"];
const STATUSES: { key: Campaign["status"]; label: string }[] = [
  { key: "planning", label: "Planning" }, { key: "active", label: "Active" },
  { key: "wrapping", label: "Wrapping" }, { key: "done", label: "Done" },
];
type ScheduleMode = "leadup" | "unassigned";

function toISO(date: string, time = "09:00"): string | null {
  if (!date) return null;
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  return new Date(y, (mo || 1) - 1, d || 1, h || 0, mi || 0).toISOString();
}
function str(v: unknown, f = ""): string { return typeof v === "string" ? v : f; }

export function CampaignModal({ open, prefill, m, onClose, onOpenView }: {
  open: boolean;
  prefill: Record<string, unknown>;
  m: MarketingState;
  onClose: () => void;
  onOpenView?: (v: string, focusId?: string) => void;
}) {
  // Editing an existing campaign when prefill carries its id.
  const editId = str(prefill.editId);
  const isEdit = !!editId;

  const [name, setName] = useState("");
  const [type, setType] = useState("Launch");
  const [status, setStatus] = useState<Campaign["status"]>("planning");
  const [goal, setGoal] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [tasks, setTasks] = useState<string[]>([]);
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("leadup");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(str(prefill.name));
    setType(TYPES.includes(str(prefill.type)) ? str(prefill.type) : "Launch");
    setStatus(STATUSES.some((s) => s.key === prefill.status) ? (prefill.status as Campaign["status"]) : "planning");
    setGoal(str(prefill.goal));
    setStart(str(prefill.start));
    setEnd(str(prefill.end));
    // Editing keeps the campaign's own color; creating rotates the palette.
    setColor(typeof prefill.color === "string" && prefill.color ? prefill.color : PALETTE[(m.campaigns.length) % PALETTE.length]);
    setTasks(Array.isArray(prefill.tasks) ? (prefill.tasks as string[]).filter((t) => typeof t === "string") : []);
    setScheduleMode("leadup"); setDraft(""); setErr(null); setBusy(false);
  }, [open, prefill, m.campaigns.length]);

  function addTask() {
    const t = draft.trim();
    if (!t) return;
    setTasks((p) => [...p, t]);
    setDraft("");
  }

  async function suggest() {
    if (!name.trim() || suggesting) return;
    setSuggesting(true); setErr(null);
    try {
      const res = await fetch("/api/assistant/campaign", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, goal, start, end }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not suggest tasks");
      const next = Array.isArray(j.tasks) ? j.tasks.filter((t: unknown) => typeof t === "string") : [];
      setTasks((cur) => Array.from(new Set([...cur, ...next])));
      if (!goal && j.summary) setGoal(j.summary);
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setSuggesting(false);
    }
  }

  function submit() {
    if (!name.trim() || busy) return;
    setBusy(true); setErr(null);
    try {
      // ── Edit existing: patch in place; don't re-materialize prep tasks ──
      if (isEdit) {
        const prevPayload = (prefill.payload && typeof prefill.payload === "object") ? prefill.payload as Record<string, unknown> : {};
        m.updateCampaign(editId, {
          name: name.trim(), color, status,
          goal: goal.trim() || null, start: toISO(start), end: toISO(end),
          payload: { ...prevPayload, type },
        });
        onClose(); onOpenView?.("campaigns"); return;
      }
      const startISO = toISO(start);
      const c = m.addCampaign({
        name: name.trim(), color, status,
        goal: goal.trim() || null, start: startISO, end: toISO(end),
        payload: { type, tasks: tasks.map((label, i) => ({ id: "ct-" + i, label, done: false })) },
      });
      // Materialize prep tasks as campaign events. Lead-up = dated backward so
      // the LAST task lands the day before release and earlier ones step back;
      // Unassigned = created but flagged so they don't claim a real slot.
      if (tasks.length) {
        const releaseISO = startISO || toISO(end) || new Date(Date.now() + 14 * 86_400_000).toISOString();
        const dates = leadUpDates(releaseISO, tasks.length); // earliest-first
        const unassigned = scheduleMode === "unassigned";
        tasks.forEach((label, i) => {
          m.addEvent({
            title: label, type: "production", status: "idea", campaignId: c.id,
            source: "manual", start: unassigned ? releaseISO : dates[i],
            payload: { scheduleKind: "task", campaignTask: true, ...(unassigned ? { unscheduled: true } : {}) },
          });
        });
      }
      onClose(); onOpenView?.("campaigns");
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
      setBusy(false);
    }
  }

  const modeBtn = (key: ScheduleMode, label: string) => {
    const on = scheduleMode === key;
    return (
      <button key={key} onClick={() => setScheduleMode(key)} style={{
        fontFamily: mn, fontSize: 10, letterSpacing: 0.3, borderRadius: 7, padding: "5px 10px", cursor: "pointer",
        border: `1px solid ${on ? color : D.border}`, background: on ? color + "1f" : "transparent",
        color: on ? color : D.txm,
      }}>{label}</button>
    );
  };

  return (
    <Modal
      open={open}
      title={isEdit ? "Edit campaign" : "New campaign"}
      subtitle={isEdit ? "Update the name, status, dates, color or goal" : "Set it up properly — dates, goal, and the prep tasks to launch"}
      accent={color} icon={<Megaphone size={17} />} width={620} onClose={onClose}
      footer={<>
        <GhostBtn onClick={onClose}>Cancel</GhostBtn>
        <PrimaryBtn onClick={submit} disabled={!name.trim() || busy} accent={color}>
          {isEdit
            ? (busy ? "Saving…" : "Save changes")
            : (busy ? "Creating…" : `Create${tasks.length ? ` + ${tasks.length} task${tasks.length === 1 ? "" : "s"}` : ""}`)}
        </PrimaryBtn>
      </>}
    >
      <Field label="Campaign name">
        <TextInput autoFocus value={name} placeholder="e.g. Memory Wars — EP18 launch" onChange={(e) => setName(e.target.value)} />
      </Field>
      <Row cols={2}>
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as Campaign["status"])}>
            {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </Select>
        </Field>
      </Row>
      <Field label="Color">
        <div style={{ display: "flex", gap: 7, alignItems: "center", height: 38 }}>
          {PALETTE.map((c) => (
            <button key={c} onClick={() => setColor(c)} title="Pick color" style={{
              width: 22, height: 22, borderRadius: 7, cursor: "pointer", background: c,
              border: color === c ? `2px solid ${D.tx}` : `2px solid transparent`,
              boxShadow: color === c ? `0 0 10px ${c}88` : "none",
            }} />
          ))}
        </div>
      </Field>
      <Row cols={2}>
        <Field label="Start"><DatePicker value={start} onChange={setStart} accent={color} placeholder="Start date" /></Field>
        <Field label="End / release"><DatePicker value={end} onChange={setEnd} accent={color} placeholder="Release date" /></Field>
      </Row>
      <Field label="Goal" hint="What does winning look like?">
        <TextArea value={goal} placeholder="Drive subs off the HBM4 arc…" onChange={(e) => setGoal(e.target.value)} style={{ minHeight: 56 }} />
      </Field>

      {/* Required prep tasks — create-only (editing shouldn't re-spawn tasks) */}
      {!isEdit && (
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
          <span style={{ fontFamily: mn, fontSize: 9.5, letterSpacing: 0.6, textTransform: "uppercase", color: D.txd }}>
            Prep tasks before launch
          </span>
          <button onClick={suggest} disabled={!name.trim() || suggesting} style={{
            display: "inline-flex", alignItems: "center", gap: 6, cursor: name.trim() ? "pointer" : "default",
            fontFamily: mn, fontSize: 10.5, borderRadius: 8, padding: "5px 11px",
            border: `1px solid ${D.violet}55`, background: D.violet + "14", color: D.violet, opacity: name.trim() ? 1 : 0.5,
          }}>
            {suggesting ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={12} />}
            {suggesting ? "Thinking…" : "Suggest with Claude"}
          </button>
        </div>
        {/* Scheduling: lead up to release vs leave unassigned */}
        {tasks.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontFamily: mn, fontSize: 9.5, color: D.txd }}>SCHEDULE</span>
            <div style={{ display: "flex", gap: 6 }}>
              {modeBtn("leadup", "Lead up to release")}
              {modeBtn("unassigned", "Unassigned")}
            </div>
            <span style={{ fontSize: 10.5, color: D.txd, marginLeft: "auto" }}>
              {scheduleMode === "leadup" ? "dated T-n…T-1 before release" : "no dates — schedule later"}
            </span>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {tasks.map((t, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: D.card, border: `1px solid ${D.border}`, borderRadius: 8, padding: "6px 9px" }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: color, flex: "none" }} />
              <input
                value={t}
                onChange={(e) => setTasks((p) => p.map((x, j) => j === i ? e.target.value : x))}
                style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: ft, fontSize: 13, color: D.tx }}
              />
              <button onClick={() => setTasks((p) => p.filter((_, j) => j !== i))} style={{ border: "none", background: "transparent", color: D.txm, cursor: "pointer", display: "inline-flex" }}>
                <X size={14} />
              </button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 7 }}>
            <TextInput value={draft} placeholder="Add a prep task…" onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTask(); } }} />
            <button onClick={addTask} style={{
              flex: "none", display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer",
              fontFamily: mn, fontSize: 11, borderRadius: 8, padding: "0 13px",
              border: `1px solid ${D.border}`, background: "transparent", color: D.txm,
            }}>
              <Plus size={13} /> Add
            </button>
          </div>
        </div>
      </div>
      )}

      {err && (
        <div style={{ fontFamily: mn, fontSize: 11, color: D.coral, border: `1px solid ${D.coral}44`, borderRadius: 8, padding: "8px 10px", background: D.coral + "11" }}>{err}</div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </Modal>
  );
}
