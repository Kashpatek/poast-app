import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/ratelimit";
import { streamClaude, transformAnthropicSSE, StreamMessage } from "@/lib/anthropic-stream";
import { buildSystemPrompt, DesignSystem, ProjectMeta } from "@/app/docu-design/design-context";
import type { Artboard } from "@/app/docu-design/artboard-ops";

export const maxDuration = 300;
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

const ChatSchema = z.object({
  projectId: z.string().uuid(),
  userMessage: z.string().min(1).max(20000),
  uploads: z
    .array(
      z.object({
        url: z.string().url(),
        name: z.string().optional(),
        kind: z.string().optional(),
      })
    )
    .optional(),
});

interface ProjectRow {
  id: string;
  name: string;
  type: "document" | "other";
  fidelity: "wireframe" | "high";
  design_system_id: string | null;
  artboards: Artboard[];
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

export async function POST(req: NextRequest) {
  const { allowed } = await checkRateLimit(req);
  if (!allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  let body: z.infer<typeof ChatSchema>;
  try {
    const raw = await req.json();
    const parsed = ChatSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
    }
    body = parsed.data;
  } catch (err) {
    return NextResponse.json({ error: "Invalid JSON body", detail: String(err) }, { status: 400 });
  }

  const { data: projectRow, error: projectErr } = await supabase
    .from("docu_projects")
    .select("*")
    .eq("id", body.projectId)
    .single();
  if (projectErr || !projectRow) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  const project = projectRow as unknown as ProjectRow;

  let designSystem: DesignSystem | null = null;
  if (project.design_system_id) {
    const { data: dsRow } = await supabase
      .from("docu_design_systems")
      .select("*")
      .eq("id", project.design_system_id)
      .single();
    if (dsRow) {
      const r = dsRow as Record<string, unknown>;
      designSystem = {
        id: r.id as string,
        name: r.name as string,
        status: r.status as "published" | "draft" | undefined,
        isDefault: !!r.is_default,
        assets: (r.assets as DesignSystem["assets"]) || [],
        analyzed: (r.analyzed as DesignSystem["analyzed"]) || {},
        notes: (r.notes as string) || "",
      };
    }
  }

  if (!designSystem) {
    const { data: defaultRow } = await supabase
      .from("docu_design_systems")
      .select("*")
      .eq("is_default", true)
      .limit(1)
      .maybeSingle();
    if (defaultRow) {
      const r = defaultRow as Record<string, unknown>;
      designSystem = {
        id: r.id as string,
        name: r.name as string,
        status: r.status as "published" | "draft" | undefined,
        isDefault: true,
        assets: (r.assets as DesignSystem["assets"]) || [],
        analyzed: (r.analyzed as DesignSystem["analyzed"]) || {},
        notes: (r.notes as string) || "",
      };
    }
  }

  const meta: ProjectMeta = {
    id: project.id,
    name: project.name,
    type: project.type,
    fidelity: project.fidelity,
  };

  const system = buildSystemPrompt({
    project: meta,
    designSystem,
    artboards: project.artboards || [],
  });

  const history: StreamMessage[] = (project.messages || []).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const uploadsBlock =
    body.uploads && body.uploads.length
      ? "\n\nReferenced assets (use these exact URLs in <image href>):\n" +
        body.uploads.map((u) => `- ${u.name ? u.name + ": " : ""}${u.url}`).join("\n")
      : "";

  history.push({ role: "user", content: body.userMessage + uploadsBlock });

  let upstream: Response;
  try {
    upstream = await streamClaude({ system, messages: history, maxTokens: 16000 });
  } catch (err) {
    const status = (err as { status?: number })?.status ?? 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }

  if (!upstream.body) {
    return NextResponse.json({ error: "No upstream body" }, { status: 502 });
  }

  const stream = transformAnthropicSSE(upstream.body);
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
