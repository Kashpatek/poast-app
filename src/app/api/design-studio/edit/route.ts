// ONLYOFFICE editor integration:
//   GET  /api/design-studio/edit?projectId=...&fileUrl=...&fileType=docx
//        → returns the editor config bundle the client uses to mount
//          the ONLYOFFICE iframe.
//   POST /api/design-studio/edit?projectId=...
//        → callback handler. ONLYOFFICE posts here with status changes
//          and a `url` to download the saved file when editing is done.
//          We pull the URL, persist to Blob, and append to the project's
//          output_files.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/lib/neon-db";
import {
  getOnlyOfficeEditorConfig,
  isOfficeConfigured,
  verifyOnlyOfficeJWT,
} from "@/lib/office-client";

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

export async function GET(req: NextRequest) {
  if (!isOfficeConfigured()) {
    return NextResponse.json({ error: "Office host not configured" }, { status: 503 });
  }
  const params = req.nextUrl.searchParams;
  const projectId = params.get("projectId");
  const fileUrl = params.get("fileUrl");
  const fileType = params.get("fileType") || "docx";
  const documentTitle = params.get("documentTitle") || "Document";
  const userId = params.get("userId") || "anonymous";
  const userName = params.get("userName") || "POAST user";
  if (!projectId || !fileUrl) {
    return NextResponse.json({ error: "Missing projectId or fileUrl" }, { status: 400 });
  }
  const callbackUrl = new URL(req.url);
  callbackUrl.pathname = "/api/design-studio/edit";
  callbackUrl.search = `projectId=${encodeURIComponent(projectId)}`;
  try {
    const cfg = getOnlyOfficeEditorConfig({
      documentUrl: fileUrl,
      documentKey: `${projectId}-${Date.now()}`,
      fileType,
      documentTitle,
      userId,
      userName,
      callbackUrl: callbackUrl.toString(),
    });
    return NextResponse.json(cfg);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ONLYOFFICE callback. Status codes per their docs:
//   0 — no document with the key
//   1 — being edited
//   2 — ready for saving
//   3 — saving error
//   4 — closed without changes
//   6 — being edited but currently saved
//   7 — saving error during edit
// We act on 2 (save) and 6 (forced save) by downloading the new file.
export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  if (!isOfficeConfigured()) {
    return NextResponse.json({ error: "Office host not configured" }, { status: 503 });
  }
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: 0 }); // ONLYOFFICE expects {error:0} on success

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* tolerate empty */ }
  const status = typeof body.status === "number" ? body.status : 0;
  const url = typeof body.url === "string" ? body.url : "";
  const token = typeof body.token === "string" ? body.token : "";

  // If a JWT is provided, verify it. (ONLYOFFICE wraps the whole callback
  // payload in a JWT when JWT is enabled on the server.)
  if (token) {
    const verified = verifyOnlyOfficeJWT(token);
    if (!verified) return NextResponse.json({ error: 1 }, { status: 401 });
  }

  if ((status === 2 || status === 6) && url) {
    try {
      const fileRes = await fetch(url);
      if (!fileRes.ok) throw new Error(`Editor returned ${fileRes.status}`);
      const ab = await fileRes.arrayBuffer();
      const buf = Buffer.from(ab);
      const base64 = `data:application/octet-stream;base64,${buf.toString("base64")}`;
      // Upload via the existing upload-asset endpoint.
      const upUrl = new URL(req.url);
      upUrl.pathname = "/api/upload-asset";
      upUrl.search = "";
      const upRes = await fetch(upUrl.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: base64,
          filename: `edited-${Date.now()}.bin`,
          contentType: "application/octet-stream",
        }),
      });
      const upJson = await upRes.json();
      if (upRes.ok && upJson.url) {
        // Append to output_files (tolerate missing column).
        try {
          const { data: row } = await supabase.from(TABLE).select("output_files").eq("id", projectId).single();
          const existing = ((row as Record<string, unknown> | null)?.output_files as Array<Record<string, unknown>>) || [];
          const next = [
            ...existing,
            {
              url: upJson.url,
              name: `edited-${Date.now()}.bin`,
              format: "edited",
              created_at: new Date().toISOString(),
            },
          ];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from(TABLE) as any)
            .update({ output_files: next, updated_at: new Date().toISOString() })
            .eq("id", projectId);
        } catch { /* ignore schema cache misses */ }
      }
    } catch (e) {
      console.error("[edit-callback] save error", e);
      return NextResponse.json({ error: 1 });
    }
  }

  return NextResponse.json({ error: 0 });
}
