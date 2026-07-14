import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/app/lib/neon-db";

export const dynamic = "force-dynamic";

let _supabase: ReturnType<typeof createClient> | null = null;

// Prefer the service-role key on the server when available so writes
// bypass Row-Level Security policies on the projects table. Falls
// back to the anon key, which works only when RLS allows anon writes
// (or isn't enabled on the table). If you see "new row violates
// row-level security policy" in a save-failure, set
// SUPABASE_SERVICE_ROLE_KEY in your Vercel env.
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

const VALID_TABLES = ["prospects", "episodes", "archive", "trends", "outreach", "projects", "weekly"] as const;

// Singleton "master" rows each hold an ENTIRE shared dataset as one JSON blob —
// the company task board (akash-todo-master), SA Weekly, Press-to-Premier,
// approval queue, etc. They are created/updated only by their owning tool via a
// full-blob upsert and are NEVER legitimately deleted or blanked through this
// generic service-role gateway. Without a guard, a single request from any
// signed-in user — `DELETE {table:"projects",id:"akash-todo-master"}` or a bare
// `POST {data:{id:"akash-todo-master"}}` — wipes that dataset for the whole team.
// Per-item rows (an individual trend, outreach lead, archived carousel, or
// design project) don't match this shape and are unaffected. Every such
// singleton follows the `*-master` id convention (verified across the codebase),
// so match on the suffix — new singletons following the convention are protected
// automatically.
function isProtectedRowId(id: string): boolean {
  return /-master$/.test(id);
}

const DbPostSchema = z.object({
  table: z.enum(VALID_TABLES),
  data: z.record(z.string(), z.unknown()),
});

const DbDeleteSchema = z.object({
  table: z.enum(VALID_TABLES),
  id: z.string(),
});

export async function GET(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const table = req.nextUrl.searchParams.get("table");
  const id = req.nextUrl.searchParams.get("id");
  const type = req.nextUrl.searchParams.get("type");

  if (!table || !(VALID_TABLES as readonly string[]).includes(table)) {
    return NextResponse.json({ error: "Invalid or missing table param", valid: VALID_TABLES }, { status: 400 });
  }

  try {
    if (id) {
      const { data, error } = await supabase.from(table).select("*").eq("id", id).single();
      if (error) return NextResponse.json({ error: error.message }, { status: 404 });
      return NextResponse.json({ data });
    }

    let query = supabase.from(table).select("*");
    if (type) query = query.eq("type", type);
    // Only order by created_at if the table has it
    const noCreatedAt = ["archive"];
    if (!noCreatedAt.includes(table)) query = query.order("created_at", { ascending: false });
    const { data, error } = await query;
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
    const body = await req.json();
    const parsed = DbPostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { table, data } = parsed.data;

    // Refuse a content-blanking upsert to a protected master row (e.g. a stray
    // `{id:"akash-todo-master"}` that would null the blob out from under the
    // whole team). Legit saves always carry the full record in `data`, so this
    // only rejects an obviously-destructive write — it never blocks a real save
    // (clearing to an empty board still sends a populated object like
    // `{boards:[],activeId:""}`, which is non-empty).
    const rowId = typeof data.id === "string" ? data.id : "";
    if (rowId && isProtectedRowId(rowId)) {
      const content = data.data;
      const blank =
        content === undefined || content === null || content === "" ||
        (typeof content === "object" && Object.keys(content as object).length === 0);
      if (blank) {
        return NextResponse.json(
          { error: `Refusing to blank protected shared row "${rowId}" via /api/db — include the full record.` },
          { status: 409 }
        );
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: result, error } = await supabase.from(table).upsert(data as any, { onConflict: "id" }).select();
    if (error) {
      // Surface the full PostgREST error so the client can show it inline.
      // Includes message, hint, code (e.g. "42501" for RLS denial,
      // "23505" duplicate-key, "23502" not-null violation, etc.).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = error as any;
      return NextResponse.json(
        { error: `${e.message || "Save failed"}${e.hint ? " · hint: " + e.hint : ""}${e.code ? " · code: " + e.code : ""}${e.details ? " · " + e.details : ""}` },
        { status: 500 }
      );
    }
    return NextResponse.json({ data: result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const body = await req.json();
    const parsed = DbDeleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { table, id } = parsed.data;

    // The one-request company-board wipe: this generic gateway runs with the
    // service-role key (RLS bypassed) and took only {table,id}, so any signed-in
    // user could delete a shared master blob. No legitimate caller deletes a
    // master row (verified: the only projects-table deletes are per-item
    // carousel-archive and design-project rows), so reject it outright.
    if (isProtectedRowId(id)) {
      return NextResponse.json(
        { error: `Refusing to delete protected shared row "${id}" via /api/db — master rows are managed by their owning tool.` },
        { status: 403 }
      );
    }

    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
