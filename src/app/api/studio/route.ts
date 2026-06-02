// /api/studio · CRUD for POAST Studio documents (charts / tables / diagrams).
//
// Auth model matches the rest of POAST's APIs: the client supplies a `user`
// field in the body (named users only — analysts never reach this endpoint
// per studio-storage.ts). We then enforce that `user === doc.owner` so a
// client can't write into someone else's library by spoofing the owner.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const dynamic = "force-dynamic";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const key = serviceKey || anonKey;
  if (!url || !key) return null;
  _supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _supabase;
}

const TABLE = "chart_docs";
const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024;
const ANALYST_NAMES = new Set(["Analyst", "anon", ""]);

const DocSchema = z.object({
  id: z.string().min(3).max(80),
  owner: z.string().min(1).max(40),
  type: z.enum(["chart", "table", "diagram"]),
  name: z.string().min(1).max(200),
  thumbnail: z.string().max(800_000).optional(),
  payload: z.unknown(),
  tags: z.array(z.string().max(40)).max(20).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const PostSchema = z.object({
  user: z.string().min(1).max(40),
  doc: DocSchema,
});

const DeleteSchema = z.object({
  user: z.string().min(1).max(40),
  id: z.string().min(3).max(80),
});

function rejectAnalyst(name: string): NextResponse | null {
  if (ANALYST_NAMES.has(name)) {
    return NextResponse.json(
      { error: "Analyst accounts cannot write to the shared library" },
      { status: 403 }
    );
  }
  return null;
}

export async function GET(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const owner = req.nextUrl.searchParams.get("owner");
  if (!owner) return NextResponse.json({ error: "owner param required" }, { status: 400 });
  if (ANALYST_NAMES.has(owner)) return NextResponse.json({ docs: [] });
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("id, owner, type, name, thumbnail, payload, tags, created_at, updated_at")
      .eq("owner", owner)
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const docs = (data || []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: r.id, owner: r.owner, type: r.type, name: r.name,
        thumbnail: r.thumbnail, payload: r.payload,
        tags: Array.isArray(r.tags) ? r.tags : [],
        createdAt: r.created_at, updatedAt: r.updated_at,
      };
    });
    return NextResponse.json({ docs });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
  }
  const { user, doc } = parsed.data;
  const blocked = rejectAnalyst(user);
  if (blocked) return blocked;
  if (user !== doc.owner) {
    return NextResponse.json({ error: "user does not match doc.owner" }, { status: 403 });
  }
  // Reject overly large payloads up front so a stray Univer snapshot can't
  // blow the column. 2 MB still allows a beefy multi-sheet workbook.
  try {
    const size = JSON.stringify(doc.payload ?? null).length;
    if (size > MAX_PAYLOAD_BYTES) {
      return NextResponse.json({ error: `payload too large (${size} > ${MAX_PAYLOAD_BYTES})` }, { status: 413 });
    }
  } catch { /* JSON.stringify can throw on circular refs — fall through */ }
  try {
    const row: Record<string, unknown> = {
      id: doc.id,
      owner: doc.owner,
      type: doc.type,
      name: doc.name,
      thumbnail: doc.thumbnail || null,
      payload: doc.payload ?? null,
      tags: doc.tags,
      created_at: doc.createdAt,
      updated_at: doc.updatedAt,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await supabase.from(TABLE).upsert(row as any, { onConflict: "id" }).select();
    if (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = error as any;
      return NextResponse.json({ error: `${e.message || "Save failed"}${e.code ? " · code: " + e.code : ""}` }, { status: 500 });
    }
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = DeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
  }
  const { user, id } = parsed.data;
  const blocked = rejectAnalyst(user);
  if (blocked) return blocked;
  try {
    const { error } = await supabase.from(TABLE).delete().eq("id", id).eq("owner", user);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
