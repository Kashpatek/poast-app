// Office host client — talks to the self-hosted ONLYOFFICE + LibreOffice
// Docker stack defined in docker/office-host/. All real-file conversion
// and in-app editing flows through this module.
//
// Required env:
//   OFFICE_HOST_URL          e.g. https://office.poast.app
//   ONLYOFFICE_JWT_SECRET    shared secret with the ONLYOFFICE container
//
// The companion Docker stack exposes:
//   POST  ${OFFICE_HOST_URL}/convert  →  LibreOffice headless wrapper
//                                        body: { url? | html? | base64?, from, to }
//                                        returns: binary stream of converted file
//   GET   ${OFFICE_HOST_URL}/onlyoffice/  →  ONLYOFFICE Document Server
//   POST  ${OFFICE_HOST_URL}/onlyoffice/ConvertService.ashx  →  ONLYOFFICE conversion API
//   GET   ${OFFICE_HOST_URL}/onlyoffice/web-apps/apps/api/documents/api.js
//                                        →  loaded into <script> for the editor iframe
//
// If OFFICE_HOST_URL isn't set, every entry point returns a clear error
// surface so the UI can show "Office service not configured" instead of
// hanging.

import crypto from "crypto";

export class OfficeNotConfigured extends Error {
  constructor() {
    super("Office host not configured (set OFFICE_HOST_URL and ONLYOFFICE_JWT_SECRET).");
    this.name = "OfficeNotConfigured";
  }
}

export function isOfficeConfigured(): boolean {
  return !!process.env.OFFICE_HOST_URL && !!process.env.ONLYOFFICE_JWT_SECRET;
}

function requireConfig(): { host: string; secret: string } {
  const host = process.env.OFFICE_HOST_URL;
  const secret = process.env.ONLYOFFICE_JWT_SECRET;
  if (!host || !secret) throw new OfficeNotConfigured();
  return { host: host.replace(/\/$/, ""), secret };
}

export type OfficeFormat = "pdf" | "docx" | "pptx" | "xlsx" | "html";

// LibreOffice headless conversion. Accepts either a URL the host can pull,
// inline HTML, or a base64 blob. Returns a Buffer of the converted file.
export async function convertViaLibreOffice(
  input: { url?: string; html?: string; base64?: string; sourceFormat?: string },
  target: OfficeFormat
): Promise<Buffer> {
  const { host } = requireConfig();
  const res = await fetch(`${host}/convert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: input.url,
      html: input.html,
      base64: input.base64,
      from: input.sourceFormat ?? (input.html ? "html" : undefined),
      to: target,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`LibreOffice convert failed (${res.status}): ${txt.slice(0, 200)}`);
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

// Sign a JWT payload for ONLYOFFICE editor or conversion API. Uses HS256
// with the shared secret. Kept minimal to avoid a jsonwebtoken dep.
export function signOnlyOfficeJWT(payload: Record<string, unknown>): string {
  const { secret } = requireConfig();
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest();
  return `${header}.${body}.${base64url(sig)}`;
}

export function verifyOnlyOfficeJWT(token: string): Record<string, unknown> | null {
  try {
    const { secret } = requireConfig();
    const [header, body, sig] = token.split(".");
    if (!header || !body || !sig) return null;
    const expected = base64url(
      crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest()
    );
    if (expected !== sig) return null;
    return JSON.parse(Buffer.from(body, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function base64url(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Editor config bundle returned to the client. The client embeds this into
// the ONLYOFFICE editor via window.DocsAPI.DocEditor(elementId, config).
export interface OnlyOfficeEditorConfig {
  apiScriptUrl: string;
  documentServerUrl: string;
  config: Record<string, unknown>;
}

export function getOnlyOfficeEditorConfig(opts: {
  documentUrl: string;
  documentKey: string;
  fileType: string;        // "docx", "pdf", "pptx", "xlsx"
  documentTitle: string;
  userId: string;
  userName: string;
  callbackUrl: string;     // our /api/design-studio/edit endpoint that handles save events
  mode?: "edit" | "view";
}): OnlyOfficeEditorConfig {
  const { host } = requireConfig();
  const baseConfig: Record<string, unknown> = {
    document: {
      fileType: opts.fileType,
      key: opts.documentKey,
      title: opts.documentTitle,
      url: opts.documentUrl,
      permissions: { edit: opts.mode !== "view", download: true, print: true },
    },
    documentType: documentTypeFor(opts.fileType),
    editorConfig: {
      mode: opts.mode === "view" ? "view" : "edit",
      callbackUrl: opts.callbackUrl,
      user: { id: opts.userId, name: opts.userName },
      customization: {
        autosave: true,
        forcesave: true,
        compactHeader: true,
        compactToolbar: true,
        toolbarNoTabs: false,
        unit: "px",
      },
    },
  };
  const token = signOnlyOfficeJWT(baseConfig);
  return {
    apiScriptUrl: `${host}/onlyoffice/web-apps/apps/api/documents/api.js`,
    documentServerUrl: `${host}/onlyoffice/`,
    config: { ...baseConfig, token },
  };
}

function documentTypeFor(fileType: string): "word" | "cell" | "slide" | "pdf" {
  if (["xls", "xlsx", "ods", "csv"].includes(fileType)) return "cell";
  if (["ppt", "pptx", "odp"].includes(fileType)) return "slide";
  if (["pdf"].includes(fileType)) return "pdf";
  return "word";
}
