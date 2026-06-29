"use client";
// MarketingSUITE create modals — the "full pop-up suites" behind every Add
// button and the Assistant. Each captures all context, parses it, creates the
// record, and syncs it everywhere (board + event spine). House style: inline
// styles + D tokens; built on the shared Modal primitive.
import React, { useEffect, useMemo, useState } from "react";
import { CheckSquare, CalendarClock, Video, ExternalLink, Trash2 } from "lucide-react";
import { D, mn } from "../../shared-constants";
import { Modal, Field, TextInput, TextArea, Select, Row, GhostBtn, PrimaryBtn, ChipPicker } from "./modal";
import {
  SCHEDULE_KINDS, scheduleKindOf, TASK_CATEGORIES, TASK_PRIORITIES, TASK_ASSIGNEES,
  eventCalendarId, eventLocation, eventAttendees, eventMeetLink, eventHtmlLink, isAllDayEvent,
  type MarketingEvent,
} from "../marketing-constants";
import type { MarketingState } from "../use-marketing";
import { useGoogle, calendarTargets, resolveDefaultCalendarId } from "../use-google";

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
function pad2(n: number): string { return String(n).padStart(2, "0"); }
function localDate(iso: string): string { const d = new Date(iso); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function localTime(iso: string): string { const d = new Date(iso); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
const linkStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, fontFamily: mn, fontSize: 11, color: D.cyan, textDecoration: "none" };

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
      const calId = resolveDefaultCalendarId();
      if (addToCal && dueDate) {
        const e = m.addEvent({
          title: title.trim(), type: "manual", status: "scheduled",
          start: toISO(dueDate, time || "09:00"), source: "poast",
          payload: { scheduleKind: "task", calendarId: calId },
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
        m.updateEvent(eventId, { payload: { scheduleKind: "task", sourceTaskId: j.task.id, calendarId: calId } });
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
  const [calendarId, setCalendarId] = useState("sa-marketing");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { status: gStatus, owner } = useGoogle();
  const calOptions = useMemo(() => calendarTargets(gStatus), [gStatus]);

  useEffect(() => {
    if (!open) return;
    setTitle(str(prefill.title));
    setKind(SCHEDULE_KINDS.some((k) => k.key === prefill.scheduleKind) ? str(prefill.scheduleKind) : "meeting");
    setDate(str(prefill.date) || todayStr());
    setStartTime(str(prefill.startTime) || nowTimeStr());
    setEndTime(str(prefill.endTime));
    setNotes(str(prefill.notes));
    setCampaignId("");
    setCalendarId(str(prefill.calendarId) || resolveDefaultCalendarId(owner));
    setErr(null);
  }, [open, prefill, owner]);

  const kindDef = useMemo(() => scheduleKindOf(kind), [kind]);

  async function submit() {
    if (!title.trim() || !date || busy) return;
    setBusy(true); setErr(null);
    try {
      const target = calOptions.find((c) => c.id === calendarId);
      const startISO = toISO(date, startTime);
      const endISO = endTime ? toISO(date, endTime) : null;
      const ev = m.addEvent({
        title: title.trim(), type: kindDef.type, status: "scheduled",
        start: startISO, end: endISO,
        campaignId: campaignId || null, notes: notes.trim() || null, source: "manual",
        payload: { scheduleKind: kind, calendarId },
      });
      // If targeting a connected Google calendar, create it on Google now and
      // stamp the returned id back so it stays in sync (best-effort).
      if (target?.google && gStatus.connected && m.mode === "live") {
        try {
          const r = await fetch("/api/google/event", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ owner, calendarId, title: title.trim(), description: notes.trim() || undefined, start: startISO, end: endISO }),
          });
          const j = await r.json();
          if (j.ok && j.gcalEventId) {
            m.updateEvent(ev.id, { gcalEventId: j.gcalEventId, payload: { scheduleKind: kind, calendarId, gcalHtmlLink: j.htmlLink, meetLink: j.meetLink } });
          }
        } catch { /* keep the local event even if the Google push fails */ }
      }
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
        <Field label="Calendar" hint="Which calendar it syncs to">
          <Select value={calendarId} onChange={(e) => setCalendarId(e.target.value)}>
            {calOptions.map((c) => <option key={c.id} value={c.id}>{c.name}{c.google ? " · Google" : ""}</option>)}
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

// ════════ EDIT EXISTING EVENT (rich editor + Google write-back) ════════
export function EventEditModal({ event, m, onClose, onOpenView }: {
  event: MarketingEvent | null;
  m: MarketingState;
  onClose: () => void;
  onOpenView?: (v: string, focusId?: string) => void;
}) {
  const open = !!event;
  const { status: gStatus, owner } = useGoogle();
  const calOptions = useMemo(() => calendarTargets(gStatus), [gStatus]);

  const [title, setTitle] = useState("");
  const [calendarId, setCalendarId] = useState("sa-marketing");
  const [allDay, setAllDay] = useState(false);
  const [date, setDate] = useState(todayStr());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [guests, setGuests] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!event) return;
    setTitle(event.title || "");
    setCalendarId(eventCalendarId(event));
    setAllDay(isAllDayEvent(event));
    setDate(localDate(event.start));
    setStartTime(localTime(event.start));
    setEndTime(event.end ? localTime(event.end) : "");
    setLocation(eventLocation(event));
    setGuests(eventAttendees(event).join(", "));
    setDescription(event.notes || "");
    setErr(null); setBusy(false);
  }, [event]);

  if (!open || !event) return null;

  const fromCalendarId = eventCalendarId(event);
  const gcalEventId = event.gcalEventId || (typeof event.payload?.gcalEventId === "string" ? event.payload.gcalEventId : null);
  const meetLink = eventMeetLink(event);
  const htmlLink = eventHtmlLink(event);
  const target = calOptions.find((c) => c.id === calendarId);
  const attendeesArr = guests.split(",").map((s) => s.trim()).filter((s) => s.includes("@"));

  async function save() {
    if (!title.trim() || busy || !event) return;
    setBusy(true); setErr(null);
    try {
      const startISO = allDay ? toISO(date, "00:00") : toISO(date, startTime || "09:00");
      const endISO = allDay ? null : (endTime ? toISO(date, endTime) : null);
      const payload: Record<string, unknown> = {
        ...(event.payload || {}),
        calendarId, allDay, location: location.trim() || null, attendees: attendeesArr,
      };
      m.updateEvent(event.id, { title: title.trim(), start: startISO, end: endISO, notes: description.trim() || null, payload });

      if (target?.google && gStatus.connected && m.mode === "live") {
        const r = await fetch("/api/google/event", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            owner, calendarId, fromCalendarId, gcalEventId,
            title: title.trim(), description: description.trim(),
            location: location.trim(), attendees: attendeesArr,
            start: startISO, end: endISO, allDay,
          }),
        });
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || "Google sync failed");
        if (j.gcalEventId) {
          m.updateEvent(event.id, { gcalEventId: j.gcalEventId, payload: { ...payload, gcalEventId: j.gcalEventId, gcalHtmlLink: j.htmlLink, meetLink: j.meetLink } });
        }
      }
      onClose();
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally { setBusy(false); }
  }

  return (
    <Modal
      open={open} title="Edit event"
      subtitle={target?.google ? "Changes write back to Google Calendar" : "Saved in MarketingSUITE"}
      accent={target?.color || D.amber} icon={<CalendarClock size={17} />} onClose={onClose}
      footer={<>
        <GhostBtn onClick={() => { m.removeEvent(event.id); onClose(); }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Trash2 size={12} /> Delete</span>
        </GhostBtn>
        <span style={{ flex: 1 }} />
        <GhostBtn onClick={onClose}>Cancel</GhostBtn>
        <PrimaryBtn onClick={save} disabled={!title.trim() || busy} accent={target?.color || D.amber}>
          {busy ? "Saving…" : "Save"}
        </PrimaryBtn>
      </>}
    >
      <Field label="Title">
        <TextInput autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save(); }} />
      </Field>
      <Row cols={2}>
        <Field label="Calendar" hint="Which calendar it lives on">
          <Select value={calendarId} onChange={(e) => setCalendarId(e.target.value)}>
            {calOptions.map((c) => <option key={c.id} value={c.id}>{c.name}{c.google ? " · Google" : ""}</option>)}
          </Select>
        </Field>
        <Field label="Span">
          <label style={{ display: "flex", alignItems: "center", gap: 8, height: 38, fontFamily: mn, fontSize: 11, color: D.txm, cursor: "pointer" }}>
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> All-day
          </label>
        </Field>
      </Row>
      <Row cols={allDay ? 1 : 3}>
        <Field label="Date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        {!allDay && <Field label="Start"><TextInput type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></Field>}
        {!allDay && <Field label="End" hint="Optional"><TextInput type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></Field>}
      </Row>
      <Field label="Location"><TextInput value={location} placeholder="Place or video link" onChange={(e) => setLocation(e.target.value)} /></Field>
      <Field label="Guests" hint="Comma-separated emails — invited on save (Google calendars)">
        <TextInput value={guests} placeholder="alex@example.com, sam@example.com" onChange={(e) => setGuests(e.target.value)} />
      </Field>
      <Field label="Description"><TextArea value={description} placeholder="Agenda, links, notes…" onChange={(e) => setDescription(e.target.value)} /></Field>
      {(meetLink || htmlLink) && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {meetLink && <a href={meetLink} target="_blank" rel="noopener" style={linkStyle}><Video size={12} /> Join Meet</a>}
          {htmlLink && <a href={htmlLink} target="_blank" rel="noopener" style={linkStyle}><ExternalLink size={12} /> Open in Google Calendar</a>}
        </div>
      )}
      {err && <ErrLine text={err} />}
      {!target?.google && <Hint onOpenView={onOpenView} note="This calendar is local to MarketingSUITE — pick a Google calendar to push it to Google." />}
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
