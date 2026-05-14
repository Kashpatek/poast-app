// Shared loader for DesignStudio project records. Handles the __META__
// fallback that the projects API uses when Supabase schema cache or
// CHECK constraints reject the full row. Every editor route (Motion,
// Programmatic, Graphics, Image gallery) calls this so they all decode
// the same way.

export type ProjectKind =
  | "document"
  | "other"
  | "graphic"
  | "image"
  | "motion"
  | "programmatic"
  | "quote"
  | "event";

export interface DecodedProject {
  id: string;
  name: string;
  type: ProjectKind;
  fidelity?: string;
  design_system_id?: string | null;
  artboards: Array<{ id: string; w: number; h: number; svg: string; label?: string }>;
  messages: Array<{ role: string; content: string; ts?: number; uploads?: unknown[] }>;
  uploads: Array<{ url: string; name?: string; kind?: string }>;
  size_preset: string | null;
  category: string | null;
  purpose: string | null;
  brief: Record<string, unknown>;
  format: string | null;
  output_files: Array<Record<string, unknown>>;
  editor_doc: Record<string, unknown>;
}

export async function loadProject(projectId: string): Promise<DecodedProject> {
  const res = await fetch(`/api/docu-design/projects?id=${encodeURIComponent(projectId)}`);
  const j = await res.json();
  if (!res.ok) {
    throw new Error(j.error || "Failed to load project");
  }
  return decodeProject(j.data as Record<string, unknown>);
}

export function decodeProject(r: Record<string, unknown>): DecodedProject {
  // Pull META blob out of messages and strip from the visible array.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let messages: any[] = (r.messages as any[]) || [];
  let meta: Record<string, unknown> = {};
  const idx = messages.findIndex(
    (m) => typeof m?.content === "string" && m.content.startsWith("__META__")
  );
  if (idx !== -1) {
    try {
      meta = JSON.parse(messages[idx].content.slice("__META__".length));
    } catch { /* ignore */ }
    messages = messages.filter((_, i) => i !== idx);
  }

  const pick = <T,>(key: string, fallback: T): T =>
    (r[key] as T) ?? (meta[key] as T) ?? fallback;

  const originalType = (meta.__originalType as ProjectKind | undefined) || (r.type as ProjectKind);

  return {
    id: r.id as string,
    name: r.name as string,
    type: originalType,
    fidelity: (r.fidelity as string) || "high",
    design_system_id: (r.design_system_id as string | null) ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    artboards: ((r.artboards as any[]) || []) as DecodedProject["artboards"],
    messages,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    uploads: ((r.uploads as any[]) || []) as DecodedProject["uploads"],
    size_preset: pick<string | null>("size_preset", null),
    category: pick<string | null>("category", null),
    purpose: pick<string | null>("purpose", null),
    brief: pick<Record<string, unknown>>("brief", {}),
    format: pick<string | null>("format", null),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    output_files: pick<any[]>("output_files", []) as DecodedProject["output_files"],
    editor_doc: pick<Record<string, unknown>>("editor_doc", {}),
  };
}
