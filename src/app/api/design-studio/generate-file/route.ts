// Produces a real-file output (PDF / DOCX / PPTX / XLSX) for a project.
// Flow:
//   1) Pull the project from Supabase (artboards + brief + size_preset).
//   2) Ask Claude for a self-contained HTML rendition that respects the
//      brief and SA tokens.
//   3) Run that HTML through LibreOffice headless (via the Office host)
//      to produce the target format.
//   4) Upload the result to Vercel Blob.
//   5) Append the file entry to the project's `output_files`.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/app/lib/neon-db";
import { generateWithClaude } from "@/lib/anthropic";
import {
  convertViaLibreOffice,
  isOfficeConfigured,
  type OfficeFormat,
} from "@/lib/office-client";

export const maxDuration = 300;
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

const ReqSchema = z.object({
  projectId: z.string().uuid(),
  format: z.enum(["pdf", "docx", "pptx", "xlsx"]),
});

const SYSTEM = `You produce self-contained HTML documents for SemiAnalysis. Output ONLY a complete HTML document (one <html> root) — no commentary, no markdown fences.

Design rules:
- Dark or light page background per brief tone, default near-white (#F4EFE8) for print.
- SA palette: amber #F7B041, cobalt #0B86D1, teal #2EAD8E, coral #E06347, near-black #06060C, ink #1A1A1A.
- Fonts: "Outfit" body, "Grift" display headlines (fall back to system sans). Mono headings use "JetBrains Mono".
- Voice: no em dashes, no emojis, no hype words. Direct, technical, institutional.
- Multi-page: use CSS @page rules and page-break-before:always on section boundaries.
- All CSS inline in a single <style> block. No external stylesheets, no scripts, no images that aren't data URIs.

Length: match the brief — a one-pager fits on one page, a report can run several pages.`;

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  if (!isOfficeConfigured()) {
    return NextResponse.json(
      { error: "Office host not configured. Set OFFICE_HOST_URL and ONLYOFFICE_JWT_SECRET, deploy the docker/office-host stack, then retry." },
      { status: 503 }
    );
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = ReqSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
  const { projectId, format } = parsed.data;

  try {
    // 1. Load project.
    const { data: row, error: loadErr } = await supabase
      .from(TABLE)
      .select("*")
      .eq("id", projectId)
      .single();
    if (loadErr || !row) {
      return NextResponse.json({ error: loadErr?.message || "Project not found" }, { status: 404 });
    }
    const project = row as Record<string, unknown>;

    // 2. Compose the Claude prompt from the project brief + artboards.
    const brief = (project.brief as Record<string, unknown>) || {};
    const artboards = (project.artboards as Array<{ svg?: string; w?: number; h?: number }>) || [];
    const userPrompt = [
      `Project name: ${project.name}`,
      `Category: ${project.category ?? "(none)"} · Size preset: ${project.size_preset ?? "(none)"}`,
      `Brief:`,
      JSON.stringify(brief, null, 2),
      artboards.length ? `Existing artboards (SVG, for reference only — translate the layout to HTML):` : "",
      ...artboards.slice(0, 3).map((a, i) => a.svg ? `\nArtboard ${i + 1} (${a.w}×${a.h}):\n${a.svg.slice(0, 6000)}` : ""),
      `\nProduce the document as a self-contained HTML document ready to render at print quality.`,
    ].filter(Boolean).join("\n");

    const html = await generateWithClaude({
      system: SYSTEM,
      prompt: userPrompt,
      maxTokens: 6000,
    });
    if (!html || !/<html/i.test(html)) {
      return NextResponse.json({ error: "Model did not return HTML" }, { status: 502 });
    }

    // 3. Convert via LibreOffice.
    const buf = await convertViaLibreOffice({ html }, format as OfficeFormat);

    // 4. Upload to Vercel Blob through the existing upload-asset endpoint.
    const base64 = `data:${mime(format)};base64,${buf.toString("base64")}`;
    const baseUrl = new URL(req.url);
    baseUrl.pathname = "/api/upload-asset";
    baseUrl.search = "";
    const upRes = await fetch(baseUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: base64,
        filename: `${(project.name as string) || "document"}.${format}`,
        contentType: mime(format),
      }),
    });
    const upJson = await upRes.json();
    if (!upRes.ok || !upJson.url) {
      return NextResponse.json({ error: upJson.error || "Blob upload failed" }, { status: 502 });
    }
    const url = upJson.url as string;

    // 5. Append to output_files.
    const existing = (project.output_files as Array<Record<string, unknown>>) || [];
    const entry = {
      url,
      name: `${(project.name as string) || "document"}.${format}`,
      format,
      size_bytes: buf.byteLength,
      created_at: new Date().toISOString(),
    };
    const next = [...existing, entry];

    // Tolerate stale schema cache — if output_files column doesn't exist
    // we still return the URL so the client can use it.
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from(TABLE) as any)
        .update({ output_files: next, updated_at: new Date().toISOString() })
        .eq("id", projectId);
    } catch { /* ignore */ }

    return NextResponse.json({ url, format, name: entry.name, size_bytes: buf.byteLength });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

function mime(fmt: string): string {
  switch (fmt) {
    case "pdf":  return "application/pdf";
    case "docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "pptx": return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    default:     return "application/octet-stream";
  }
}
