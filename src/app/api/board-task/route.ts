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
