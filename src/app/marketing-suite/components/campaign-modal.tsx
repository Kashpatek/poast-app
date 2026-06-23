"use client";
// MarketingSUITE · Campaign setup modal — replaces the old zero-friction
// "instantly create an empty campaign". Captures name/type/dates/goal, lets you
// pick a color, and builds the required prep-task list (hand-typed or suggested
// by Claude). On create it makes the campaign AND materializes each prep task as
// a campaign event so it shows on the Schedule, Timeline and Calendar.
import React, { useEffect, useState } from "react";
import { Megaphone, Sparkles, Plus, X, Loader2 } from "lucide-react";
import { D, ft, mn } from "../../shared-constants";
import { Modal, Field, TextInput, TextArea, Select, Row, GhostBtn, PrimaryBtn } from "./modal";
import type { MarketingState } from "../use-marketing";

const PALETTE = [D.violet, D.teal, D.coral, D.cyan, D.blue, D.amber];
const TYPES = ["Launch", "Series", "Always-on", "Event", "Awareness", "Recap", "Other"];

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
  const [name, setName] = useState("");
  const [type, setType] = useState("Launch");
  const [goal, setGoal] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [tasks, setTasks] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(str(prefill.name));
    setType(TYPES.includes(str(prefill.type)) ? str(prefill.type) : "Launch");
    setGoal(str(prefill.goal));
    setStart(str(prefill.start));
    setEnd(str(prefill.end));
    setColor(PALETTE[(m.campaigns.length) % PALETTE.length]);
    setTasks(Array.isArray(prefill.tasks) ? (prefill.tasks as string[]).filter((t) => typeof t === "string") : []);
    setDraft(""); setErr(null);
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

  function create() {
    if (!name.trim() || busy) return;
    setBusy(true); setErr(null);
    try {
      const startISO = toISO(start);
      const c = m.addCampaign({
        name: name.trim(), color, status: "planning",
        goal: goal.trim() || null, start: startISO, end: toISO(end),
        payload: { type, tasks: tasks.map((label, i) => ({ id: "ct-" + i, label, done: false })) },
      });
      // Materialize each prep task as a campaign event → shows on Schedule /
      // Timeline / Calendar and in the campaign's items rail.
      const base = startISO ? new Date(startISO) : new Date();
      tasks.forEach((label, i) => {
        const d = new Date(base); d.setDate(d.getDate() + i);
        m.addEvent({
          title: label, type: "production", status: "idea", campaignId: c.id,
          source: "manual", start: d.toISOString(),
          payload: { scheduleKind: "task", campaignTask: true },
        });
      });
      onClose();
      onOpenView?.("campaigns");
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open} title="New campaign" subtitle="Set it up properly — dates, goal, and the prep tasks to launch"
      accent={color} icon={<Megaphone size={17} />} width={620} onClose={onClose}
      footer={<>
        <GhostBtn onClick={onClose}>Cancel</GhostBtn>
        <PrimaryBtn onClick={create} disabled={!name.trim() || busy} accent={color}>
          {busy ? "Creating…" : `Create${tasks.length ? ` + ${tasks.length} task${tasks.length === 1 ? "" : "s"}` : ""}`}
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
      </Row>
      <Row cols={2}>
        <Field label="Start"><TextInput type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="End"><TextInput type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
      </Row>
      <Field label="Goal" hint="What does winning look like?">
        <TextArea value={goal} placeholder="Drive subs off the HBM4 arc…" onChange={(e) => setGoal(e.target.value)} style={{ minHeight: 56 }} />
      </Field>

      {/* Required prep tasks */}
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

      {err && (
        <div style={{ fontFamily: mn, fontSize: 11, color: D.coral, border: `1px solid ${D.coral}44`, borderRadius: 8, padding: "8px 10px", background: D.coral + "11" }}>{err}</div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </Modal>
  );
}
