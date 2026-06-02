// POAST Studio — shared types for the multi-document suite.
//
// The Studio holds three document kinds (chart / table / diagram). Each has
// its own payload shape, but the wrapper `StudioDoc` is the unit of storage,
// listing, and routing. Editors own their own payload validation — the
// shell + storage layers treat the payload as opaque JSON for now.

export type DocType = "chart" | "table" | "diagram";

export interface StudioDoc {
  id: string;            // "doc-<base36 ulid-ish>"
  owner: string;         // normalized user name from user-context
  type: DocType;
  name: string;          // user-visible title
  thumbnail?: string;    // data: URL, ~240×160 PNG snapshot
  payload: unknown;      // editor-specific document body, opaque at this layer
  tags: string[];
  createdAt: string;     // ISO
  updatedAt: string;     // ISO
}

export type SaveState = "idle" | "saving" | "saved" | "error";

export type StudioView =
  | { kind: "welcome" }
  | { kind: "gallery"; type: DocType }
  | { kind: "library" }
  | { kind: "editor"; docId: string };

export function newDocId(): string {
  // Time-ordered, base-36 — sortable by created timestamp without an index.
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 8);
  return `doc-${ts}-${rnd}`;
}

export function emptyDoc(type: DocType, owner: string, name: string): StudioDoc {
  const now = new Date().toISOString();
  return {
    id: newDocId(),
    owner,
    type,
    name,
    payload: null,
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function isAnalystOwner(owner: string): boolean {
  // Mirrors isAnalyst() from user-context. We can't import the React context
  // here (this module is also pulled into the API route), so we duplicate the
  // shallow name check — there's only one Analyst persona today.
  return owner === "Analyst" || owner === "anon" || owner === "";
}
