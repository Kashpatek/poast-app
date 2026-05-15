"use client";

// Akash's personal Task Board.
//
// Matches the visual style of the SA Marketing + Production task board
// PDF (sa_taskboard_may2026.pdf): horizontal rows with priority dot,
// category pill, title + sub, due date. Three ways to add tasks:
//   1. Manual — form fields
//   2. Prompt — paste any prose, Claude parses into tasks
//   3. Image — drag a screenshot/PDF page, Claude vision extracts tasks
//
// Multiple boards. Persists to Supabase under projects/akash-todo-master.
// Eventually syncs out to a Slack workflow for new-task submissions.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { D, ft, gf, mn } from "./shared-constants";
import { useUser, isAkash } from "./user-context";

type Priority = "HIGH" | "MEDIUM" | "THIS WEEK" | "ONGOING" | "DONE";
type AddMode = "manual" | "prompt" | "image";

interface Task {
  id: string;
  title: string;
  description?: string;
  category: string;
  priority: Priority;
  dueDate?: string;            // yyyy-mm-dd
  notes?: string;
  done?: boolean;
  source?: "manual" | "prompt" | "image";
  addedAt: string;
  updatedAt?: string;
}

interface Board {
  id: string;
  name: string;
  description?: string;
  tasks: Task[];
  createdAt: string;
}

interface BoardArchive {
  boards: Board[];
  activeId: string;
}

const CATEGORIES = [
  "GRAPHIC DESIGN",
  "MARKETING OPS",
  "VIDEO PRODUCTION",
  "BRAND / IDENTITY",
  "DEV / ACCESS",
  "CONTENT OPS",
  "PODCAST",
  "EVENTS",
  "RESEARCH",
  "ADMIN",
  "OTHER",
];

const CATEGORY_COLORS: Record<string, string> = {
  "GRAPHIC DESIGN":   "#F7B041",
  "MARKETING OPS":    "#E06347",
  "VIDEO PRODUCTION": "#0B86D1",
  "BRAND / IDENTITY": "#2EAD8E",
  "DEV / ACCESS":     "#905CCB",
  "CONTENT OPS":      "#26C9D8",
  "PODCAST":          "#E06347",
  "EVENTS":           "#F7B041",
  "RESEARCH":         "#0B86D1",
  "ADMIN":            "#905CCB",
  "OTHER":            "#8A8690",
};

const PRIORITIES: Priority[] = ["HIGH", "MEDIUM", "THIS WEEK", "ONGOING", "DONE"];
const PRIORITY_COLORS: Record<Priority, string> = {
  "HIGH":      "#E06347",
  "MEDIUM":    "#F7B041",
  "THIS WEEK": "#0B86D1",
  "ONGOING":   "#8A8690",
  "DONE":      "#2EAD8E",
};

export default function AkashTodo() {
  const userCtx = useUser();
  const allowed = isAkash(userCtx.user);

  const [archive, setArchive] = useState<BoardArchive>({ boards: [], activeId: "" });
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState<"priority" | "category" | "due">("priority");
  const [showDone, setShowDone] = useState(false);
  const [filter, setFilter] = useState("");
  const [addingMode, setAddingMode] = useState<AddMode | null>(null);
  const [boardModalOpen, setBoardModalOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/db?table=projects");
      const j = await res.json();
      const row = (j.data || []).find((r: { id: string; type: string }) => r.id === "akash-todo-master" && r.type === "akash-todo");
      const data: BoardArchive = row?.data || { boards: [], activeId: "" };
      if (!data.boards || data.boards.length === 0) {
        const def: Board = {
          id: "b-" + Date.now(),
          name: "May 2026",
          description: "Marketing + Production",
          tasks: [],
          createdAt: new Date().toISOString(),
        };
        data.boards = [def];
        data.activeId = def.id;
      }
      if (!data.activeId || !data.boards.find((b) => b.id === data.activeId)) {
        data.activeId = data.boards[0].id;
      }
      setArchive(data);
    } catch { /* tolerate */ }
    setLoading(false);
  }, []);

  useEffect(() => { if (allowed) load(); else setLoading(false); }, [allowed, load]);

  const persist = useCallback(async (next: BoardArchive) => {
    setArchive(next);
    try {
      await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: "projects", id: "akash-todo-master", type: "akash-todo", data: next }),
      });
    } catch { /* ignore */ }
  }, []);

  const activeBoard = archive.boards.find((b) => b.id === archive.activeId);

  function updateActiveBoard(patch: Partial<Board> | ((b: Board) => Board)) {
    if (!activeBoard) return;
    const next = typeof patch === "function" ? patch(activeBoard) : { ...activeBoard, ...patch };
    persist({
      ...archive,
      boards: archive.boards.map((b) => (b.id === activeBoard.id ? next : b)),
    });
  }

  async function addTasks(newTasks: Omit<Task, "id" | "addedAt">[]) {
    if (!activeBoard) return;
    const stamp = new Date().toISOString();
    const expanded: Task[] = newTasks.map((t, i) => ({
      ...t,
      id: "t-" + Date.now() + "-" + i,
      addedAt: stamp,
    }));
    updateActiveBoard((b) => ({ ...b, tasks: [...expanded, ...b.tasks] }));
    setAddingMode(null);
  }

  function toggleTask(id: string, patch: Partial<Task>) {
    updateActiveBoard((b) => ({
      ...b,
      tasks: b.tasks.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t)),
    }));
  }

  function removeTask(id: string) {
    updateActiveBoard((b) => ({ ...b, tasks: b.tasks.filter((t) => t.id !== id) }));
  }

  // Filtering / grouping
  const visibleTasks = useMemo(() => {
    if (!activeBoard) return [];
    const q = filter.trim().toLowerCase();
    return activeBoard.tasks.filter((t) => {
      if (!showDone && (t.done || t.priority === "DONE")) return false;
      if (!q) return true;
      const hay = `${t.title} ${t.description || ""} ${t.category} ${t.notes || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [activeBoard, filter, showDone]);

  const grouped = useMemo(() => groupTasks(visibleTasks, groupBy), [visibleTasks, groupBy]);

  if (!allowed) {
    return (
      <div style={{ maxWidth: 600, margin: "60px auto", padding: 24, textAlign: "center" }}>
        <div style={{ fontFamily: gf, fontSize: 22, color: D.tx, marginBottom: 8 }}>Akash only</div>
        <div style={{ fontFamily: ft, fontSize: 13, color: D.txm, lineHeight: 1.5 }}>
          This board is the Brand and Creative Director's personal queue. If you should have access, ping Akash.
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 32px" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 10px", borderRadius: 999, background: "rgba(247,176,65,0.10)", border: `1px solid ${D.amber}55`, marginBottom: 14 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: D.amber, boxShadow: `0 0 8px ${D.amber}` }} />
          <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.amber, textTransform: "uppercase" }}>
            Marketing + Production
          </span>
        </div>
        <h1 style={{ fontFamily: ft, fontSize: 46, fontWeight: 900, letterSpacing: -1.6, margin: 0, marginBottom: 4, color: D.tx }}>
          Task Board{" "}
          <span style={{ background: "linear-gradient(120deg,#F7B041,#26C9D8,#F7B041)", backgroundSize: "200% 100%", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: "tbShim 9s ease-in-out infinite" }}>
            {activeBoard?.name || ""}
          </span>
          <style dangerouslySetInnerHTML={{ __html: "@keyframes tbShim{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}" }} />
        </h1>
        <div style={{ fontFamily: ft, fontSize: 13, color: D.txm }}>
          SemiAnalysis Marketing · Akash Patel · All active + ongoing items
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
          {PRIORITIES.filter((p) => p !== "DONE").map((p) => (
            <div key={p} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: PRIORITY_COLORS[p] }} />
              <span style={{ fontFamily: mn, fontSize: 10, color: D.txm, letterSpacing: 0.6 }}>{p}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 18 }}>
        <select
          value={archive.activeId}
          onChange={(e) => persist({ ...archive, activeId: e.target.value })}
          style={{ ...inputStyle, width: 200 }}
        >
          {archive.boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <button type="button" onClick={() => setBoardModalOpen(true)} style={ghostBtn}>+ Board</button>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter tasks…"
          style={{ ...inputStyle, flex: 1, minWidth: 180 }}
        />
        <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as typeof groupBy)} style={{ ...inputStyle, width: 160 }}>
          <option value="priority">Group: Priority</option>
          <option value="category">Group: Category</option>
          <option value="due">Group: Due</option>
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: mn, fontSize: 11, color: D.txm, cursor: "pointer" }}>
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} style={{ accentColor: D.amber }} />
          Show done
        </label>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button type="button" onClick={() => setAddingMode("manual")} style={primaryBtn}>+ Task</button>
          <button type="button" onClick={() => setAddingMode("prompt")} style={ghostBtn}>From prompt</button>
          <button type="button" onClick={() => setAddingMode("image")} style={ghostBtn}>From image</button>
        </div>
      </div>

      {/* Counters */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 20 }}>
        {PRIORITIES.map((p) => {
          const count = (activeBoard?.tasks || []).filter((t) => (t.done ? "DONE" : t.priority) === p).length;
          const color = PRIORITY_COLORS[p];
          return (
            <div key={p} style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ fontFamily: mn, fontSize: 9, letterSpacing: 1.2, textTransform: "uppercase", color: D.txd, marginBottom: 4 }}>{p}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontFamily: gf, fontSize: 24, fontWeight: 900, color, letterSpacing: -0.8, lineHeight: 1 }}>{count}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Task list */}
      {loading ? (
        <div style={{ fontFamily: mn, fontSize: 12, color: D.txm, padding: 20 }}>Loading…</div>
      ) : visibleTasks.length === 0 ? (
        <div style={emptyBox}>
          No tasks yet. Add one manually, paste a Slack thread into "From prompt," or drop a screenshot into "From image."
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {grouped.map(({ key, tasks }) => (
            <div key={key}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", color: D.txd, display: "flex", alignItems: "center", gap: 8 }}>
                  {groupBy === "priority" ? <span style={{ width: 8, height: 8, borderRadius: "50%", background: PRIORITY_COLORS[key as Priority] || D.txd }} /> : null}
                  {key}
                </div>
                <span style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4 }}>{tasks.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {tasks.map((t) => (
                  <TaskRow key={t.id} task={t} onToggle={(patch) => toggleTask(t.id, patch)} onRemove={() => removeTask(t.id)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {addingMode ? (
        <AddTaskModal
          mode={addingMode}
          onCancel={() => setAddingMode(null)}
          onAdd={addTasks}
          onSwitchMode={setAddingMode}
        />
      ) : null}
      {boardModalOpen ? (
        <BoardModal
          archive={archive}
          onCancel={() => setBoardModalOpen(false)}
          onSave={(next) => { persist(next); setBoardModalOpen(false); }}
        />
      ) : null}
    </div>
  );
}

// ── Task row ────────────────────────────────────────────────────────
function TaskRow({ task, onToggle, onRemove }: { task: Task; onToggle: (p: Partial<Task>) => void; onRemove: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const due = formatDue(task.dueDate);
  const priority = task.done ? "DONE" : task.priority;
  const pColor = PRIORITY_COLORS[priority as Priority] || D.txd;
  const cColor = CATEGORY_COLORS[task.category] || D.txm;
  return (
    <div
      style={{
        background: D.surface,
        border: `1px solid ${D.border}`,
        borderRadius: 10,
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        cursor: "pointer",
        opacity: task.done ? 0.55 : 1,
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggle({ done: !task.done }); }}
        title={task.done ? "Mark as not done" : "Mark as done"}
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: task.done ? D.teal : "transparent",
          border: `2px solid ${task.done ? D.teal : pColor}`,
          boxShadow: !task.done ? `0 0 6px ${pColor}66` : "none",
          cursor: "pointer",
          flexShrink: 0,
          padding: 0,
        }}
      />

      <div style={{
        fontFamily: mn,
        fontSize: 9,
        letterSpacing: 1.2,
        textTransform: "uppercase",
        fontWeight: 700,
        color: cColor,
        background: cColor + "1c",
        border: `1px solid ${cColor}55`,
        padding: "3px 10px",
        borderRadius: 4,
        flexShrink: 0,
        minWidth: 110,
        textAlign: "center",
      }}>
        {task.category}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: gf, fontSize: 14, fontWeight: 700, color: D.tx, letterSpacing: -0.3, textDecoration: task.done ? "line-through" : "none" }}>
          {task.title}
        </div>
        {task.description ? (
          <div style={{ fontFamily: ft, fontSize: 11.5, color: D.txm, marginTop: 2, lineHeight: 1.4, maxHeight: expanded ? "none" : 18, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: expanded ? "normal" : "nowrap" }}>
            {task.description}
          </div>
        ) : null}
        {expanded && task.notes ? (
          <div style={{ marginTop: 6, padding: "6px 10px", background: "rgba(255,255,255,0.02)", border: `1px solid ${D.border}`, borderRadius: 6, fontFamily: ft, fontSize: 12, color: D.tx, lineHeight: 1.5 }}>
            {task.notes}
          </div>
        ) : null}
      </div>

      {due ? (
        <div style={{ fontFamily: mn, fontSize: 10, color: due.urgent ? D.coral : D.txm, letterSpacing: 0.4, flexShrink: 0 }}>
          {due.label}
        </div>
      ) : null}

      {expanded ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); if (confirm("Remove this task?")) onRemove(); }}
          style={{ background: "transparent", border: "none", color: D.coral, fontFamily: mn, fontSize: 10, cursor: "pointer", letterSpacing: 0.4 }}
        >
          Remove
        </button>
      ) : null}
    </div>
  );
}

// ── Add modal ──────────────────────────────────────────────────────
function AddTaskModal({ mode, onCancel, onAdd, onSwitchMode }: { mode: AddMode; onCancel: () => void; onAdd: (tasks: Omit<Task, "id" | "addedAt">[]) => void; onSwitchMode: (m: AddMode) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("MARKETING OPS");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const [promptText, setPromptText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [parsing, setParsing] = useState(false);
  const [parsedTasks, setParsedTasks] = useState<Omit<Task, "id" | "addedAt">[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleImage(file: File) {
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function parsePrompt() {
    if (!promptText.trim() && !imageFile) return;
    setParsing(true);
    setError(null);
    setParsedTasks([]);
    try {
      let imageUrl: string | undefined;
      if (imageFile) {
        const reader = new FileReader();
        const data = await new Promise<string>((res, rej) => {
          reader.onload = () => res(reader.result as string);
          reader.onerror = () => rej(reader.error);
          reader.readAsDataURL(imageFile);
        });
        const up = await fetch("/api/upload-asset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data, filename: imageFile.name, contentType: imageFile.type }),
        });
        const upJ = await up.json();
        if (!up.ok || !upJ.url) {
          setError("Image upload failed: " + (upJ.error || up.status));
          setParsing(false);
          return;
        }
        imageUrl = upJ.url;
      }
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch("/api/akash-todo/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: promptText.trim() || undefined, imageUrl, today }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "Parse failed");
      } else {
        setParsedTasks((j.tasks || []).map((t: Omit<Task, "id" | "addedAt">) => ({ ...t, source: imageUrl ? "image" : "prompt" })));
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setParsing(false);
    }
  }

  function submitManual() {
    if (!title.trim()) return;
    onAdd([{
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      priority,
      dueDate: dueDate || undefined,
      notes: notes.trim() || undefined,
      source: "manual",
    }]);
  }

  // Image and prompt modes can produce a lot of preview rows; give them a
  // wider panel so the parsed list doesn't get squashed under a tiny image
  // preview at the top of an 680px column.
  const wide = mode === "image" || mode === "prompt";
  const panelStyle: React.CSSProperties = {
    ...panel,
    width: wide ? "min(1080px, 96vw)" : panel.width,
  };

  return (
    <div style={overlay} onClick={onCancel}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {(["manual", "prompt", "image"] as const).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => onSwitchMode(m)}
                style={{
                  padding: "8px 14px",
                  background: active ? D.amber : "transparent",
                  color: active ? "#060608" : D.tx,
                  border: `1px solid ${active ? D.amber : D.border}`,
                  borderRadius: 8,
                  fontFamily: ft,
                  fontSize: 12,
                  fontWeight: active ? 800 : 500,
                  cursor: "pointer",
                  letterSpacing: 0.3,
                }}
              >
                {m === "manual" ? "Manual" : m === "prompt" ? "From prompt" : "From image"}
              </button>
            );
          })}
        </div>

        {mode === "manual" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Field label="Title" value={title} onChange={setTitle} placeholder="Redo ClusterMax ribbons" />
            <Field label="Description (optional)" value={description} onChange={setDescription} placeholder="Participant version, basic version, deadline next Wednesday" multi />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={lbl}>Category</div>
                <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <div style={lbl}>Priority</div>
                <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} style={inputStyle}>
                  {PRIORITIES.filter((p) => p !== "DONE").map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <Field label="Due date (optional)" value={dueDate} onChange={setDueDate} placeholder="2026-05-21" type="date" />
            <Field label="Notes (optional)" value={notes} onChange={setNotes} placeholder="Contacts, blockers, links" multi />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={onCancel} style={ghostBtn}>Cancel</button>
              <button type="button" onClick={submitManual} disabled={!title.trim()} style={{ ...primaryBtn, opacity: title.trim() ? 1 : 0.5 }}>
                Add task
              </button>
            </div>
          </div>
        ) : null}

        {mode === "prompt" ? (
          <div>
            <div style={lbl}>Paste anything · Slack thread, email, meeting notes, brain dump</div>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Need to redo the ClusterMax ribbons by next Wednesday. Also BoM images for the Unitree robots, ask Jacob. Datacloud Cannes Luma graphic for the SA happy hour. Capital business cards + website timeline next week..."
              style={{ ...inputStyle, minHeight: 200, resize: "vertical" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
              <span style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4 }}>{promptText.length} chars</span>
              <button type="button" onClick={parsePrompt} disabled={parsing || !promptText.trim()} style={{ ...primaryBtn, opacity: parsing || !promptText.trim() ? 0.5 : 1 }}>
                {parsing ? "Parsing…" : "Parse into tasks"}
              </button>
            </div>
            {error ? <div style={{ marginTop: 10, fontFamily: mn, fontSize: 11, color: D.coral }}>{error}</div> : null}
            {parsedTasks.length > 0 ? (
              <ParsedPreview tasks={parsedTasks} onConfirm={() => onAdd(parsedTasks)} onEdit={setParsedTasks} onCancel={() => setParsedTasks([])} />
            ) : null}
          </div>
        ) : null}

        {mode === "image" ? (
          parsedTasks.length > 0 ? (
            // Two-column layout once we have parsed tasks: image stays
            // small on the left so the task list has the whole right
            // side to breathe.
            <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>
              <div>
                <div style={lbl}>Source image</div>
                {imagePreview ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={imagePreview} alt="preview" style={{ width: "100%", maxHeight: 280, objectFit: "contain", display: "block", border: `1px solid ${D.border}`, borderRadius: 8, marginBottom: 10 }} />
                ) : null}
                {imageFile ? (
                  <div style={{ fontFamily: mn, fontSize: 10, color: D.txm, marginBottom: 8, wordBreak: "break-all" }}>{imageFile.name}</div>
                ) : null}
                <button type="button" onClick={parsePrompt} disabled={parsing} style={{ ...primaryBtn, opacity: parsing ? 0.5 : 1, width: "100%" }}>
                  {parsing ? "Re-reading…" : "Re-extract"}
                </button>
                <button type="button" onClick={() => { setImageFile(null); setImagePreview(""); setParsedTasks([]); }} style={{ ...ghostBtn, width: "100%", marginTop: 8 }}>
                  Different image
                </button>
              </div>
              <div style={{ minWidth: 0 }}>
                <ParsedPreview tasks={parsedTasks} onConfirm={() => onAdd(parsedTasks)} onEdit={setParsedTasks} onCancel={() => setParsedTasks([])} />
              </div>
            </div>
          ) : (
            <div>
              <div style={lbl}>Drop a screenshot, PDF page, or whiteboard photo</div>
              <label
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = D.amber; }}
                onDragLeave={(e) => { e.currentTarget.style.borderColor = D.border; }}
                onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = D.border; const f = e.dataTransfer.files?.[0]; if (f) handleImage(f); }}
                style={{
                  display: "block",
                  border: `1px dashed ${D.border}`,
                  borderRadius: 10,
                  padding: imagePreview ? 0 : 32,
                  background: D.surface,
                  textAlign: "center",
                  cursor: "pointer",
                  marginBottom: 12,
                  overflow: "hidden",
                }}
              >
                {imagePreview ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={imagePreview} alt="preview" style={{ width: "100%", maxHeight: 240, objectFit: "contain", display: "block" }} />
                ) : (
                  <div style={{ fontFamily: ft, fontSize: 13, color: D.txm, lineHeight: 1.5 }}>
                    Drop image here · or click to choose
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImage(f); }}
                  style={{ display: "none" }}
                />
              </label>
              {imageFile ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontFamily: mn, fontSize: 10, color: D.txm }}>{imageFile.name}</span>
                  <button type="button" onClick={() => { setImageFile(null); setImagePreview(""); }} style={{ background: "transparent", border: "none", color: D.coral, fontFamily: mn, fontSize: 10, cursor: "pointer" }}>Remove</button>
                </div>
              ) : null}
              <button type="button" onClick={parsePrompt} disabled={parsing || !imageFile} style={{ ...primaryBtn, opacity: parsing || !imageFile ? 0.5 : 1, width: "100%" }}>
                {parsing ? "Reading image with Claude…" : "Extract tasks from image"}
              </button>
              {error ? <div style={{ marginTop: 10, fontFamily: mn, fontSize: 11, color: D.coral }}>{error}</div> : null}
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}

function ParsedPreview({ tasks, onConfirm, onEdit, onCancel }: { tasks: Omit<Task, "id" | "addedAt">[]; onConfirm: () => void; onEdit: (t: Omit<Task, "id" | "addedAt">[]) => void; onCancel: () => void }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={lbl}>Found {tasks.length} task{tasks.length === 1 ? "" : "s"} — review before adding</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "60vh", overflowY: "auto", marginBottom: 12, paddingRight: 4 }}>
        {tasks.map((t, i) => {
          const cColor = CATEGORY_COLORS[t.category] || D.txm;
          return (
            <div key={i} style={{ background: D.bg, border: `1px solid ${D.border}`, borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
                <span style={{ fontFamily: mn, fontSize: 9, color: cColor, letterSpacing: 0.8, textTransform: "uppercase", padding: "1px 6px", border: `1px solid ${cColor}55`, borderRadius: 3 }}>{t.category}</span>
                <span style={{ fontFamily: mn, fontSize: 9, color: PRIORITY_COLORS[t.priority as Priority], letterSpacing: 0.8 }}>{t.priority}</span>
                {t.dueDate ? <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 9, color: D.txd }}>{t.dueDate}</span> : null}
              </div>
              <div style={{ fontFamily: gf, fontSize: 13, fontWeight: 700, color: D.tx, marginBottom: 2 }}>{t.title}</div>
              {t.description ? <div style={{ fontFamily: ft, fontSize: 11, color: D.txm, lineHeight: 1.4 }}>{t.description}</div> : null}
              <button
                type="button"
                onClick={() => onEdit(tasks.filter((_, idx) => idx !== i))}
                style={{ background: "transparent", border: "none", color: D.coral, fontFamily: mn, fontSize: 9, cursor: "pointer", marginTop: 4, letterSpacing: 0.4 }}
              >
                drop
              </button>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" onClick={onCancel} style={ghostBtn}>Discard all</button>
        <button type="button" onClick={onConfirm} style={primaryBtn}>Add {tasks.length} task{tasks.length === 1 ? "" : "s"}</button>
      </div>
    </div>
  );
}

// ── Board management ───────────────────────────────────────────────
function BoardModal({ archive, onCancel, onSave }: { archive: BoardArchive; onCancel: () => void; onSave: (a: BoardArchive) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  function addBoard() {
    if (!name.trim()) return;
    const next: Board = { id: "b-" + Date.now(), name: name.trim(), description: description.trim() || undefined, tasks: [], createdAt: new Date().toISOString() };
    onSave({ boards: [...archive.boards, next], activeId: next.id });
  }

  function removeBoard(id: string) {
    if (archive.boards.length === 1) return;
    if (!confirm("Delete this board and all its tasks?")) return;
    const remaining = archive.boards.filter((b) => b.id !== id);
    onSave({ boards: remaining, activeId: remaining[0].id });
  }

  return (
    <div style={overlay} onClick={onCancel}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontFamily: gf, fontSize: 20, fontWeight: 800, color: D.tx, letterSpacing: -0.5, marginBottom: 14 }}>Boards</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          {archive.boards.map((b) => (
            <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: D.surface, border: `1px solid ${D.border}`, borderRadius: 8 }}>
              <div>
                <div style={{ fontFamily: ft, fontSize: 13, color: D.tx, fontWeight: 700 }}>{b.name}</div>
                {b.description ? <div style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>{b.description}</div> : null}
                <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, marginTop: 2 }}>{b.tasks.length} task{b.tasks.length === 1 ? "" : "s"}</div>
              </div>
              <button type="button" onClick={() => removeBoard(b.id)} disabled={archive.boards.length === 1} style={{ background: "transparent", border: "none", color: archive.boards.length === 1 ? D.txd : D.coral, fontFamily: mn, fontSize: 10, cursor: archive.boards.length === 1 ? "not-allowed" : "pointer", letterSpacing: 0.4 }}>Delete</button>
            </div>
          ))}
        </div>
        <div style={{ borderTop: `1px solid ${D.border}`, paddingTop: 14 }}>
          <Field label="New board name" value={name} onChange={setName} placeholder="June 2026" />
          <Field label="Description (optional)" value={description} onChange={setDescription} placeholder="Marketing + Production" />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <button type="button" onClick={onCancel} style={ghostBtn}>Close</button>
            <button type="button" onClick={addBoard} disabled={!name.trim()} style={{ ...primaryBtn, opacity: name.trim() ? 1 : 0.5 }}>+ Add board</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tiny shared bits ───────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, multi, type }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multi?: boolean; type?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={lbl}>{label}</div>
      {multi ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} />
      ) : (
        <input type={type || "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
      )}
    </div>
  );
}

function groupTasks(tasks: Task[], by: "priority" | "category" | "due"): Array<{ key: string; tasks: Task[] }> {
  if (by === "priority") {
    const order: Priority[] = ["HIGH", "MEDIUM", "THIS WEEK", "ONGOING", "DONE"];
    return order
      .map((k) => ({ key: k, tasks: tasks.filter((t) => (t.done ? "DONE" : t.priority) === k) }))
      .filter((g) => g.tasks.length > 0);
  }
  if (by === "category") {
    const buckets: Record<string, Task[]> = {};
    tasks.forEach((t) => { (buckets[t.category] = buckets[t.category] || []).push(t); });
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, ts]) => ({ key: k, tasks: ts }));
  }
  // by due
  const buckets: Record<string, Task[]> = { Overdue: [], "This week": [], "Later": [], "No due date": [] };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekOut = new Date(today); weekOut.setDate(weekOut.getDate() + 7);
  tasks.forEach((t) => {
    if (!t.dueDate) { buckets["No due date"].push(t); return; }
    const d = new Date(t.dueDate); d.setHours(0, 0, 0, 0);
    if (isNaN(d.getTime())) { buckets["No due date"].push(t); return; }
    if (d < today) buckets["Overdue"].push(t);
    else if (d <= weekOut) buckets["This week"].push(t);
    else buckets["Later"].push(t);
  });
  return Object.entries(buckets).filter(([, ts]) => ts.length > 0).map(([k, ts]) => ({ key: k, tasks: ts }));
}

function formatDue(due?: string): { label: string; urgent: boolean } | null {
  if (!due) return null;
  const d = new Date(due);
  if (isNaN(d.getTime())) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, urgent: true };
  if (diffDays === 0) return { label: "Today", urgent: true };
  if (diffDays === 1) return { label: "Tomorrow", urgent: true };
  if (diffDays < 7) return { label: `in ${diffDays}d`, urgent: false };
  return { label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), urgent: false };
}

const lbl: React.CSSProperties = { fontFamily: mn, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: D.txd, marginBottom: 4 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.03)", border: `1px solid ${D.border}`, borderRadius: 6, color: D.tx, fontFamily: ft, fontSize: 13, outline: "none", boxSizing: "border-box" };
const primaryBtn: React.CSSProperties = { background: D.amber, color: "#060608", border: "none", padding: "9px 18px", borderRadius: 8, fontFamily: ft, fontSize: 13, fontWeight: 800, cursor: "pointer", letterSpacing: 0.3 };
const ghostBtn: React.CSSProperties = { background: "transparent", color: D.tx, border: `1px solid ${D.border}`, padding: "9px 14px", borderRadius: 8, fontFamily: ft, fontSize: 12, cursor: "pointer" };
const emptyBox: React.CSSProperties = { border: `1px dashed ${D.border}`, borderRadius: 12, padding: 28, background: D.surface, color: D.txm, fontFamily: ft, fontSize: 14, lineHeight: 1.5 };
const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(6,6,12,0.78)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", zIndex: 12000, display: "flex", alignItems: "safe center", justifyContent: "center", overflowY: "auto", padding: 24 };
const panel: React.CSSProperties = { width: "min(680px, 96vw)", background: "#0A0A14", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "26px 28px 22px", maxHeight: "calc(100vh - 48px)", overflowY: "auto" };
