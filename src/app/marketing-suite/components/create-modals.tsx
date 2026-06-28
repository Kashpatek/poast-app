"use client";
// MarketingSUITE create modals — the "full pop-up suites" behind every Add
// button and the Assistant. Each captures all context, parses it, creates the
// record, and syncs it everywhere (board + event spine). House style: inline
// styles + D tokens; built on the shared Modal primitive.
import React, { useEffect, useMemo, useState } from "react";
import { CheckSquare, CalendarClock } from "lucide-react";
import { D, mn } from "../../shared-constants";
import { Modal, Field, TextInput, TextArea, Select, Row, GhostBtn, PrimaryBtn, ChipPicker } from "./modal";
import {
  SCHEDULE_KINDS, scheduleKindOf, TASK_CATEGORIES, TASK_PRIORITIES, TASK_ASSIGNEES,
  DEFAULT_CALENDARS,
} from "../marketing-constants";
import type { MarketingState } from "../use-marketing";
import { useGoogle, isCalSelected } from "../use-google";

// Combine a YYYY-MM-DD date + HH:MM time into a local-time ISO datetime.
function toISO(date: string, time?: string): string {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = (time || "09:00").split(":").map(Number);
  return new Date(y, (mo || 1) - 1, d || 1, h || 0, mi || 0, 0, 0).toISOString();
}
function todayStr() { return new Date().toISOString().slice(0, 10); }
function nowTimeStr() {
  const d = new Date(); d.setMinutes(0); // round to the hour for a sane default
  return `${String(d.getHours()).padStart(2, "0")}:00`;
}
function str(v: unknown, fallback = ""): string { return typeof v === "string" ? v : fallback; }

interface ModalProps {
  open: boolean;
  prefill: Record<string, unknown>;
  m: MarketingState;
  onClose: () => void;
  onOpenView?: (v: string, focusId?: string) => void;
}

// ════════ TASK ════════
export function TaskModal({ open, prefill, m, onClose, onOpenView }: ModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("MARKETING OPS");
  const [priority, setPriority] = useState("MEDIUM");
  const [assignee, setAssignee] = useState("Akash");
  const [dueDate, setDueDate] = useState("");
  const [time, setTime] = useState("");
  const [addToCal, setAddToCal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Seed from prefill (Assistant) every time the modal opens.
  useEffect(() => {
    if (!open) return;
    setTitle(str(prefill.title));
    setDescription(str(prefill.description));
    setCategory(TASK_CATEGORIES.includes(str(prefill.category)) ? str(prefill.category) : "MARKETING OPS");
    setPriority(TASK_PRIORITIES.includes(str(prefill.priority)) ? str(prefill.priority) : "MEDIUM");
    setAssignee(str(prefill.assignee, "Akash"));
    setDueDate(str(prefill.dueDate));
    setTime(str(prefill.time));
    setAddToCal(!!prefill.dueDate);
    setErr(null);
  }, [open, prefill]);

  async function submit() {
    if (!title.trim() || busy) return;
    setBusy(true); setErr(null);
    try {
      // 1) If dated + add-to-calendar, mint the event first so we can link it.
      let eventId: string | undefined;
      if (addToCal && dueDate) {
        const e = m.addEvent({
          title: title.trim(), type: "manual", status: "scheduled",
          start: toISO(dueDate, time || "09:00"), source: "poast",
          payload: { scheduleKind: "task" },
        });
        eventId = e.id;
      }
      // 2) Create the board task (persists to the shared master board).
      const res = await fetch("/api/board-task", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(), description: description.trim() || undefined,
          category, priority, assignee,
          dueDate: dueDate || undefined,
          scheduledFor: addToCal && dueDate ? toISO(dueDate, time || "09:00") : undefined,
          marketingEventId: eventId,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not save task");
      // 3) Back-link the task id onto the event so future two-way sync is loop-safe.
      if (eventId && j.task?.id) {
        m.updateEvent(eventId, { payload: { scheduleKind: "task", sourceTaskId: j.task.id } });
      }
      onClose();
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open} title="New task" subtitle="Adds to your master board — and your calendar if dated"
      accent={D.coral} icon={<CheckSquare size={17} />} onClose={onClose}
      footer={<>
        <GhostBtn onClick={onClose}>Cancel</GhostBtn>
        <PrimaryBtn onClick={submit} disabled={!title.trim() || busy} accent={D.coral}>
          {busy ? "Saving…" : "Create task"}
        </PrimaryBtn>
      </>}
    >
      <Field label="Task">
        <TextInput autoFocus value={title} placeholder="What needs doing?" onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }} />
      </Field>
      <Field label="Details" hint="Optional context, links, acceptance criteria">
        <TextArea value={description} placeholder="Add detail…" onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Row cols={3}>
        <Field label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {TASK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Priority">
          <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
            {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
        </Field>
        <Field label="Owner">
          <Select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            {TASK_ASSIGNEES.map((a) => <option key={a} value={a}>{a}</option>)}
          </Select>
        </Field>
      </Row>
      <Row cols={2}>
        <Field label="Due date">
          <TextInput type="date" value={dueDate} onChange={(e) => { setDueDate(e.target.value); if (e.target.value) setAddToCal(true); }} />
        </Field>
        <Field label="Time" hint={dueDate ? undefined : "Set a date first"}>
          <TextInput type="time" value={time} disabled={!dueDate} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </Row>
      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: dueDate ? "pointer" : "default", opacity: dueDate ? 1 : 0.5 }}>
        <input type="checkbox" checked={addToCal && !!dueDate} disabled={!dueDate} onChange={(e) => setAddToCal(e.target.checked)} />
        <span style={{ fontFamily: mn, fontSize: 11, color: D.txm }}>Also put it on the Schedule / Calendar / Timeline</span>
      </label>
      {err && <ErrLine text={err} />}
      <Hint onOpenView={onOpenView} />
    </Modal>
  );
}

// ════════ SCHEDULE ════════
export function ScheduleModal({ open, prefill, m, onClose, onOpenView }: ModalProps) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<string>("meeting");
  const [date, setDate] = useState(todayStr());
  const [startTime, setStartTime] = useState(nowTimeStr());
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [calendarId, setCalendarId] = useState(DEFAULT_CALENDARS[0].id);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { status: gStatus } = useGoogle();
  const calendarOptions = useMemo(() => [
    ...DEFAULT_CALENDARS.map((c) => ({ id: c.id, name: c.name })),
    ...(gStatus.connected
      ? (gStatus.calendars || [])
          .filter((c) => isCalSelected(gStatus.prefs, c.id))
          .map((c) => ({ id: c.id, name: `Google · ${c.summary}` }))
      : []),
  ], [gStatus]);

  useEffect(() => {
    if (!open) return;
    setTitle(str(prefill.title));
    setKind(SCHEDULE_KINDS.some((k) => k.key === prefill.scheduleKind) ? str(prefill.scheduleKind) : "meeting");
    setDate(str(prefill.date) || todayStr());
    setStartTime(str(prefill.startTime) || nowTimeStr());
    setEndTime(str(prefill.endTime));
    setNotes(str(prefill.notes));
    setCampaignId("");
    setCalendarId(DEFAULT_CALENDARS[0].id);
    setErr(null);
  }, [open, prefill]);

  const kindDef = useMemo(() => scheduleKindOf(kind), [kind]);

  async function submit() {
    if (!title.trim() || !date || busy) return;
    setBusy(true); setErr(null);
    try {
      m.addEvent({
        title: title.trim(), type: kindDef.type, status: "scheduled",
        start: toISO(date, startTime), end: endTime ? toISO(date, endTime) : null,
        campaignId: campaignId || null, notes: notes.trim() || null, source: "manual",
        payload: { scheduleKind: kind, calendarId },
      });
      onClose();
      onOpenView?.("schedule");
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open} title="Schedule something" subtitle="A booking, block, meeting, filming, review…"
      accent={kindDef.color} icon={<CalendarClock size={17} />} onClose={onClose}
      footer={<>
        <GhostBtn onClick={onClose}>Cancel</GhostBtn>
        <PrimaryBtn onClick={submit} disabled={!title.trim() || !date || busy} accent={kindDef.color}>
          {busy ? "Scheduling…" : "Add to schedule"}
        </PrimaryBtn>
      </>}
    >
      <Field label="What are you scheduling?">
        <TextInput autoFocus value={title} placeholder="e.g. Record EP18 with guest" onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }} />
      </Field>
      <Field label="Type">
        <ChipPicker
          options={SCHEDULE_KINDS.map((k) => ({ key: k.key, label: k.label, color: k.color }))}
          value={kind}
          onChange={setKind}
        />
      </Field>
      <Row cols={3}>
        <Field label="Date">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Start">
          <TextInput type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </Field>
        <Field label="End" hint="Optional">
          <TextInput type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </Field>
      </Row>
      <Row cols={2}>
        <Field label="Campaign" hint="Optional — links it in">
          <Select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            <option value="">— none —</option>
            {m.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Calendar">
          <Select value={calendarId} onChange={(e) => setCalendarId(e.target.value)}>
            {calendarOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
      </Row>
      <Field label="Notes" hint="Optional">
        <TextArea value={notes} placeholder="Agenda, location, links…" onChange={(e) => setNotes(e.target.value)} style={{ minHeight: 56 }} />
      </Field>
      {err && <ErrLine text={err} />}
      {!gStatus.connected && <Hint onOpenView={onOpenView} note="Connect Google Calendar (Schedule → Calendars) to target a specific Google calendar." />}
    </Modal>
  );
}

function ErrLine({ text }: { text: string }) {
  return (
    <div style={{ fontFamily: mn, fontSize: 11, color: D.coral, border: `1px solid ${D.coral}44`, borderRadius: 8, padding: "8px 10px", background: D.coral + "11" }}>
      {text}
    </div>
  );
}
function Hint({ onOpenView, note }: { onOpenView?: (v: string) => void; note?: string }) {
  void onOpenView;
  if (!note) return null;
  return <div style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>{note}</div>;
}
