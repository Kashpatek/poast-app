// /api/board-task · create a task on the shared master board (projects row
// akash-todo-master) from the MarketingSUITE create layer.
//
// The board is one BoardArchive blob in a single projects row, so there is no
// per-task append — we read-modify-write the whole archive server-side in one
// request (same shim + service-role path as /api/db). Returns the created task
// (incl. its id) so the caller can link a marketing event back to it.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/lib/neon-db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const ROW_ID = "akash-todo-master";

let _db: ReturnType<typeof createClient> | null = null;
function db() {
  if (_db) return _db;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _db;
}

const TaskInput = z.object({
  title: z.string().min(1).max(280),
  description: z.string().max(4000).optional(),
  category: z.string().max(60).default("MARKETING OPS"),
  priority: z.enum(["HIGH", "MEDIUM", "THIS WEEK", "ONGOING"]).default("MEDIUM"),
  assignee: z.string().max(40).default("Akash"),
  dueDate: z.string().max(10).optional(),           // YYYY-MM-DD
  scheduledFor: z.string().optional(),               // ISO datetime
  estimateMins: z.number().int().positive().max(100000).optional(),
  marketingEventId: z.string().max(120).optional(),  // link back to a synced event
  source: z.string().max(40).default("marketing-suite"),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export async function POST(req: NextRequest) {
  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = TaskInput.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
  const inp = parsed.data;

  try {
    const { data: row, error } = await supabase.from("projects").select("*").eq("id", ROW_ID).single();
    if (error || !row) return NextResponse.json({ error: error?.message || "Board not found" }, { status: 404 });

    // BoardArchive lives in the jsonb `data` column.
    const archive: Row = (row as Row).data && typeof (row as Row).data === "object"
      ? (row as Row).data
      : { boards: [], activeId: "" };
    const boards: Row[] = Array.isArray(archive.boards) ? archive.boards : [];
    if (!boards.length) return NextResponse.json({ error: "No boards on the master archive" }, { status: 409 });
    const active = boards.find((b) => b.id === archive.activeId) || boards[0];

    const now = new Date().toISOString();
    const task: Row = {
      id: "t-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      title: inp.title,
      category: inp.category,
      priority: inp.priority,
      assignee: inp.assignee,
      addedAt: now,
      source: inp.source,
      ...(inp.description ? { description: inp.description } : {}),
      ...(inp.dueDate ? { dueDate: inp.dueDate } : {}),
      ...(inp.scheduledFor ? { scheduledFor: inp.scheduledFor } : {}),
      ...(inp.estimateMins ? { estimateMins: inp.estimateMins } : {}),
      ...(inp.marketingEventId ? { marketingEventId: inp.marketingEventId } : {}),
    };
    active.tasks = [task, ...(Array.isArray(active.tasks) ? active.tasks : [])];

    // Activity log (the board keeps one per board).
    if (!Array.isArray(active.activity)) active.activity = [];
    active.activity.unshift({ ts: now, action: "add", label: task.title, taskId: task.id });

    const writeBack: Row = {
      id: ROW_ID,
      name: (row as Row).name || "Akash Todo",
      type: (row as Row).type || "akash-todo",
      data: archive,
      updated_at: now,
    };
    const { error: upErr } = await supabase.from("projects").upsert(writeBack, { onConflict: "id" }).select();
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, task });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PATCH — update an existing master-board task in place. Locate it by `id`
// (preferred) or by linked `marketingEventId`, shallow-merge `patch` (array
// fields like subtasks/notesLog replace wholesale), stamp updatedAt, and RMW the
// archive blob. Used by the in-campaign editor + the event↔task sync reconciler.
const PatchInput = z.object({
  id: z.string().max(120).optional(),
  marketingEventId: z.string().max(120).optional(),
  patch: z.object({
    title: z.string().min(1).max(280).optional(),
    description: z.string().max(4000).optional(),
    category: z.string().max(60).optional(),
    priority: z.string().max(20).optional(),
    assignee: z.string().max(40).optional(),
    done: z.boolean().optional(),
    dueDate: z.string().max(10).nullable().optional(),
    scheduledFor: z.string().nullable().optional(),
    estimateMins: z.number().int().positive().max(100000).optional(),
    notes: z.string().max(8000).nullable().optional(),
    marketingEventId: z.string().max(120).optional(),
    updatedAt: z.string().max(40).optional(),
    // Arrays replace wholesale (caller sends the full next array).
    subtasks: z.array(z.object({
      id: z.string(), title: z.string(), done: z.boolean().optional(),
      dueDate: z.string().optional(), spawnedEventId: z.string().optional(),
    })).optional(),
    notesLog: z.array(z.object({
      id: z.string(), ts: z.string(), author: z.string().optional(), text: z.string(),
    })).optional(),
  }).passthrough(),
}).refine((v) => v.id || v.marketingEventId, { message: "id or marketingEventId required" });

export async function PATCH(req: NextRequest) {
  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = PatchInput.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
  const { id, marketingEventId, patch } = parsed.data;

  try {
    const { data: row, error } = await supabase.from("projects").select("*").eq("id", ROW_ID).single();
    if (error || !row) return NextResponse.json({ error: error?.message || "Board not found" }, { status: 404 });

    const archive: Row = (row as Row).data && typeof (row as Row).data === "object" ? (row as Row).data : { boards: [], activeId: "" };
    const boards: Row[] = Array.isArray(archive.boards) ? archive.boards : [];

    // Find the holding board + task by id, else by linked marketingEventId.
    let hostBoard: Row | undefined; let idx = -1;
    for (const b of boards) {
      const tasks: Row[] = Array.isArray(b.tasks) ? b.tasks : [];
      let i = id ? tasks.findIndex((t) => t.id === id) : -1;
      if (i < 0 && marketingEventId) i = tasks.findIndex((t) => t.marketingEventId === marketingEventId);
      if (i >= 0) { hostBoard = b; idx = i; break; }
    }
    if (!hostBoard || idx < 0) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const now = new Date().toISOString();
    const prev: Row = hostBoard.tasks[idx];
    const next: Row = { ...prev, ...patch, updatedAt: patch.updatedAt || now };
    hostBoard.tasks[idx] = next;

    if (!Array.isArray(hostBoard.activity)) hostBoard.activity = [];
    hostBoard.activity.unshift({ ts: now, action: "update", label: next.title, taskId: next.id });

    const writeBack: Row = {
      id: ROW_ID,
      name: (row as Row).name || "Akash Todo",
      type: (row as Row).type || "akash-todo",
      data: archive,
      updated_at: now,
    };
    const { error: upErr } = await supabase.from("projects").upsert(writeBack, { onConflict: "id" }).select();
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, task: next });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
