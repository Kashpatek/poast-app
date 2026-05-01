import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const TABLE = "docu_design_systems";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _supabase = createClient(url, key);
  return _supabase;
}

const AssetSchema = z.object({
  url: z.string().url(),
  kind: z.enum(["logo", "backdrop", "font", "other"]),
  name: z.string().optional(),
});

const AnalyzedSchema = z.object({
  colors: z.array(z.object({ name: z.string().optional(), hex: z.string() })).optional(),
  typography: z
    .object({
      display: z.string().optional(),
      body: z.string().optional(),
      mono: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
  layoutNotes: z.string().optional(),
  toneNotes: z.string().optional(),
}).passthrough();

const SystemSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  status: z.enum(["published", "draft"]).optional(),
  is_default: z.boolean().optional(),
  assets: z.array(AssetSchema).optional(),
  analyzed: AnalyzedSchema.optional(),
  notes: z.string().optional(),
  setAsDefault: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const id = req.nextUrl.searchParams.get("id");
  try {
    if (id) {
      const { data, error } = await supabase.from(TABLE).select("*").eq("id", id).single();
      if (error) return NextResponse.json({ error: error.message }, { status: 404 });
      return NextResponse.json({ data });
    }
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: data || [], count: (data || []).length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const body = await req.json();
    const parsed = SystemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
    }
    const input = parsed.data;
    const row: Record<string, unknown> = {
      ...(input.id ? { id: input.id } : {}),
      name: input.name,
      status: input.status ?? "draft",
      is_default: input.is_default ?? false,
      assets: input.assets ?? [],
      analyzed: input.analyzed ?? {},
      notes: input.notes ?? "",
      updated_at: new Date().toISOString(),
    };

    if (input.setAsDefault) {
      // Clear any other default flag, then set this row as the only default.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from(TABLE) as any).update({ is_default: false }).eq("is_default", true);
      row.is_default = true;
    }

    const { data, error } = await supabase
      .from(TABLE)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(row as any, { onConflict: "id" })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
