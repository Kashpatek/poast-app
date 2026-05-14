import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const TABLE = "docu_projects";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _supabase = createClient(url, key);
  return _supabase;
}

const ArtboardSchema = z.object({
  id: z.string(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
  label: z.string().optional(),
  svg: z.string(),
});

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  ts: z.number().optional(),
  uploads: z.array(z.object({ url: z.string(), name: z.string().optional(), kind: z.string().optional() })).optional(),
});

const BriefSchema = z
  .object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
    audience: z.string().optional(),
    tone: z.string().optional(),
    keyPoints: z.array(z.string()).optional(),
    context: z.string().optional(),
    designSystemOverrideId: z.string().uuid().nullable().optional(),
  })
  .passthrough();

const ProjectSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(160),
  type: z.enum(["document", "other", "graphic", "image", "motion", "programmatic", "quote", "event"]),
  fidelity: z.enum(["wireframe", "high"]).optional(),
  design_system_id: z.string().uuid().nullable().optional(),
  artboards: z.array(ArtboardSchema).optional(),
  messages: z.array(MessageSchema).optional(),
  uploads: z.array(z.object({ url: z.string(), name: z.string().optional(), kind: z.string().optional() })).optional(),
  size_preset: z.string().nullable().optional(),
  purpose: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  brief: BriefSchema.optional(),
  format: z.string().optional(),
  output_files: z.array(z.unknown()).optional(),
  editor_doc: z.unknown().optional(),
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
      .select("id,name,type,fidelity,design_system_id,created_at,updated_at")
      .order("updated_at", { ascending: false });
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
    const parsed = ProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
    }
    const input = parsed.data;
    // Phase 2 fields go in `phase2Fields` so we can drop them if the schema
    // cache hasn't picked them up yet. When that happens we embed the data
    // into the messages array as a single system-prefixed entry so the
    // canvas can still recover it on load.
    const baseRow: Record<string, unknown> = {
      ...(input.id ? { id: input.id } : {}),
      name: input.name,
      type: input.type,
      fidelity: input.fidelity ?? "high",
      design_system_id: input.design_system_id ?? null,
      artboards: input.artboards ?? [],
      messages: input.messages ?? [],
      uploads: input.uploads ?? [],
      updated_at: new Date().toISOString(),
    };
    const phase2Fields: Record<string, unknown> = {};
    if (input.size_preset !== undefined) phase2Fields.size_preset = input.size_preset;
    if (input.purpose !== undefined)     phase2Fields.purpose = input.purpose;
    if (input.category !== undefined)    phase2Fields.category = input.category;
    if (input.brief !== undefined)       phase2Fields.brief = input.brief;
    if (input.format !== undefined)      phase2Fields.format = input.format;
    if (input.output_files !== undefined) phase2Fields.output_files = input.output_files;
    if (input.editor_doc !== undefined)  phase2Fields.editor_doc = input.editor_doc;

    const fullRow = { ...baseRow, ...phase2Fields };

    let { data, error } = await supabase
      .from(TABLE)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(fullRow as any, { onConflict: "id" })
      .select()
      .single();

    // Fallback: if PostgREST's schema cache hasn't picked up the Phase 2
    // columns yet, retry without them and stash the metadata into the
    // messages array (prefixed __META__) so nothing is lost. The canvas
    // strips this on load.
    if (error && /Could not find the .* column|schema cache/i.test(error.message) && Object.keys(phase2Fields).length) {
      const messages = Array.isArray(baseRow.messages) ? [...(baseRow.messages as unknown[])] : [];
      messages.unshift({
        role: "assistant",
        content: "__META__" + JSON.stringify(phase2Fields),
        ts: Date.now(),
      });
      const fallbackRow = { ...baseRow, messages };
      const retry = await supabase
        .from(TABLE)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .upsert(fallbackRow as any, { onConflict: "id" })
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

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
