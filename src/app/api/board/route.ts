// /api/board · the per-user task board, keyed by the VERIFIED session identity.
//
// The board used to be one shared `projects` row (akash-todo-master) that every
// signed-in user read and wrote — so any user visiting /board or the
// marketing-suite Board view saw and edited Akash's board. This endpoint scopes
// the board to the session owner: GET returns the caller's own board, PUT writes
// only the caller's own row. Row id comes from boardIdFor(owner) server-side, so
// a client can never address another user's board. Akash keeps the legacy row id
// (no migration); everyone else gets todo-<owner>.
//
// Owner-authoritative last-write-wins is intentional (no CAS/merge): one owner
// per row means concurrent-writer clobber is a non-issue by construction.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/lib/neon-db";
import { z } from "zod";
import { ownerFromRequest } from "@/lib/session-owner";
import { boardIdFor } from "@/lib/user-identity";

export const dynamic = "force-dynamic";

let _db: ReturnType<typeof createClient> | null = null;
function db() {
  if (_db) return _db;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _db;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const EMPTY_ARCHIVE = { boards: [], activeId: "" };

// GET → the caller's own board archive (empty default if the row doesn't exist).
export async function GET(req: NextRequest) {
  const sess = await ownerFromRequest(req);
  if (!sess) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  const boardId = boardIdFor(sess.owner);
  // maybeSingle(): {data:null,error:null} on zero rows → absent-vs-outage split on
  // the server (don't create the row on a GET; first PUT/board-task POST does that).
  const { data: row, error } = await supabase.from("projects").select("*").eq("id", boardId).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) {
    return NextResponse.json({ owner: sess.owner, boardId, archive: EMPTY_ARCHIVE, updated_at: null });
  }
  const archive = (row as Row).data && typeof (row as Row).data === "object" ? (row as Row).data : EMPTY_ARCHIVE;
  return NextResponse.json({ owner: sess.owner, boardId, archive, updated_at: (row as Row).updated_at ?? null });
}

// A well-formed BoardArchive: a boards[] array + a string activeId. An empty
// board list is a legit "cleared board"; a missing/null archive is rejected so a
// stray/blank PUT can't wipe a populated board.
const ArchiveSchema = z.object({
  boards: z.array(z.unknown()),
  activeId: z.string(),
}).passthrough();
const PutSchema = z.object({ archive: ArchiveSchema });

// PUT → replace the caller's own board archive. Server owns id/name/type/updated_at.
export async function PUT(req: NextRequest) {
  const sess = await ownerFromRequest(req);
  if (!sess) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = PutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Refusing to save a malformed/blank board archive", details: parsed.error.issues }, { status: 409 });
  }

  const boardId = boardIdFor(sess.owner);
  // Preserve the existing display name; fall back to a per-owner default.
  const { data: existing } = await supabase.from("projects").select("name").eq("id", boardId).maybeSingle();
  const name = (existing as Row | null)?.name || `${sess.owner} Todo`;

  const writeBack: Row = {
    id: boardId,
    name,
    type: "akash-todo",
    data: parsed.data.archive,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("projects").upsert(writeBack, { onConflict: "id" }).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, owner: sess.owner, boardId, updated_at: writeBack.updated_at });
}
