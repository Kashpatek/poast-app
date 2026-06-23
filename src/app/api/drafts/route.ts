// CopySTUDIO · server-side drafts stub.
// Minimal proxy over /api/db with table=projects, type="copy-draft".
// • GET ?id=<id>     → reads a single draft by id (mirrors /api/db's single-row shape).
// • GET (no id)      → lists all rows with type="copy-draft".
// • POST { id, body }→ upserts the draft. Body is JSON-serialized and stored on data.
// Same Supabase client pattern as /api/db, including service-role-first key
// resolution so writes bypass RLS when configured. Fails closed on bad input.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/app/lib/neon-db";

export const dynamic = "force-dynamic";

const TABLE = "projects";
const DRAFT_TYPE = "copy-draft";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const key = serviceKey || anonKey;
  if (!url || !key) return null;
  _supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _supabase;
}

const PostSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  body: z.unknown(),
});

export async function GET(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const id = req.nextUrl.searchParams.get("id");
  try {
    if (id) {
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .eq("id", id)
        .eq("type", DRAFT_TYPE)
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 404 });
      return NextResponse.json({ data });
    }
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("type", DRAFT_TYPE)
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data, count: (data || []).length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const json = await req.json();
    const parsed = PostSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }
    const { id, name, body } = parsed.data;
    const row = {
      id,
      name: name || "Untitled draft",
      type: DRAFT_TYPE,
      data: body,
      updated_at: new Date().toISOString(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: result, error } = await supabase.from(TABLE).upsert(row as any, { onConflict: "id" }).select();
    if (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = error as any;
      return NextResponse.json(
        { error: `${e.message || "Save failed"}${e.hint ? " · hint: " + e.hint : ""}${e.code ? " · code: " + e.code : ""}` },
        { status: 500 }
      );
    }
    return NextResponse.json({ data: result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
