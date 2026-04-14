import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

let _supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _supabase = createClient(url, key);
  return _supabase;
}

const VALID_TABLES = ["prospects", "episodes", "archive", "trends", "outreach", "projects", "weekly"];

export async function GET(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const table = req.nextUrl.searchParams.get("table");
  const id = req.nextUrl.searchParams.get("id");

  if (!table || !VALID_TABLES.includes(table)) {
    return NextResponse.json({ error: "Invalid or missing table param", valid: VALID_TABLES }, { status: 400 });
  }

  try {
    if (id) {
      const { data, error } = await supabase.from(table).select("*").eq("id", id).single();
      if (error) return NextResponse.json({ error: error.message }, { status: 404 });
      return NextResponse.json({ data });
    }

    const { data, error } = await supabase.from(table).select("*").order("created_at", { ascending: false });
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
    const { table, data } = body;

    if (!table || !VALID_TABLES.includes(table)) {
      return NextResponse.json({ error: "Invalid or missing table" }, { status: 400 });
    }
    if (!data) return NextResponse.json({ error: "Missing data" }, { status: 400 });

    const { data: result, error } = await supabase.from(table).upsert(data, { onConflict: "id" }).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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
    const { table, id } = body;

    if (!table || !VALID_TABLES.includes(table)) {
      return NextResponse.json({ error: "Invalid or missing table" }, { status: 400 });
    }
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
