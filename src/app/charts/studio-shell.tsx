"use client";

// POAST Studio · top-level shell.
//
// Owns the view state (welcome / gallery / library / editor), pulls the
// current user, talks to studio-storage for save/load, and dispatches the
// right editor component for the selected doc. Editors stay dumb — they
// receive their doc + an onChangePayload callback and emit changes.

import { ArrowLeft, Library, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { confirmDialog, promptDialog } from "../dialog-context";
import { useUser } from "../user-context";
import ChartEditor from "./editor-chart";
import TableEditor from "./editor-table";
import DiagramEditor from "./editor-diagram";
import { templateById as tableTemplateById } from "./lib/table-templates";
import { listDocs, loadDoc, saveDoc, deleteDoc } from "./studio-storage";
import { D, ft, gf, mn, SAVE_STATE_COLOR } from "./studio-theme";
import {
  ChartDocPayload,
  DocType, SaveState, StudioDoc, StudioView, TableSheet,
  emptyDoc, isAnalystOwner, newDocId,
} from "./studio-types";
import WelcomeView from "./views/welcome";
import GalleryView from "./views/gallery";
import LibraryView from "./views/library";

const NEW_DOC_NAMES: Record<DocType, string> = {
  chart:   "Untitled chart",
  table:   "Untitled table",
  diagram: "Untitled diagram",
};

export default function StudioShell() {
  const { user } = useUser();
  const owner = user?.name || "Analyst";
  const analyst = isAnalystOwner(owner);

  const [docs, setDocs] = useState<StudioDoc[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<StudioView>({ kind: "welcome" });
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial load — on mount and whenever the user switches.
  useEffect(() => {
    setLoaded(false);
    listDocs(owner).then((list) => {
      setDocs(list);
      setLoaded(true);
      // Always land on Welcome — the three "new" tiles + recent rail are
      // the friendlier entry point than dumping straight into the
      // library grid. Library is one click away in the header.
    });
  }, [owner]);

  // Active editor doc (resolved each render from the docs list).
  const activeDoc = useMemo(() => {
    if (view.kind !== "editor") return null;
    return docs.find((d) => d.id === view.docId) || null;
  }, [view, docs]);

  // Debounced save — called by the editor onChangePayload callback. Bundles
  // up the latest doc and pushes through studio-storage.
  const scheduleSave = useCallback((doc: StudioDoc) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveState("saving");
    saveTimerRef.current = setTimeout(async () => {
      const res = await saveDoc(doc);
      setSaveState(res.ok ? "saved" : "error");
      if (res.ok) {
        // Drop back to idle after a moment so the pill doesn't shout.
        setTimeout(() => setSaveState((s) => s === "saved" ? "idle" : s), 1400);
      }
    }, 600);
  }, []);

  const updateDoc = useCallback((next: StudioDoc) => {
    setDocs((cur) => cur.map((d) => d.id === next.id ? next : d));
    scheduleSave(next);
  }, [scheduleSave]);

  const newDocFromTemplate = useCallback((type: DocType, templateId: string) => {
    // Tables have rich templates (sheet + branded metadata) defined in
    // lib/table-templates. If the picked template id matches, expand
    // its build() output into the payload and use its title as the
    // doc name so the library card reads as "FY26 KPI Snapshot" etc.
    let docName = NEW_DOC_NAMES[type];
    let payload: Record<string, unknown> = { kind: type, version: 1, templateId };
    if (type === "table") {
      const t = tableTemplateById(templateId);
      if (t) {
        const built = t.build();
        payload = { kind: "table", version: 1, templateId, ...built };
        const w = built.titleWhite || "";
        const a = built.titleAmber || "";
        const stitched = (w + " " + a).trim().replace(/\s+/g, " ");
        if (stitched && stitched !== "Untitled") docName = stitched;
        else docName = t.label;
      }
    }
    if (type === "diagram") {
      const labelByTpl: Record<string, string> = {
        flowchart:        "Untitled flowchart",
        wireframe:        "Untitled wireframe",
        "timeline-nodes": "Untitled timeline",
        "before-after":   "Before / After",
        topology:         "Network topology",
        swimlane:         "Swimlane process",
        "segment-ladder": "Tier ladder",
        architecture:    "System architecture",
        mindmap:          "Mind map",
        sequence:         "Sequence diagram",
      };
      if (labelByTpl[templateId]) docName = labelByTpl[templateId];
    }
    const doc = emptyDoc(type, owner, docName);
    doc.payload = payload;
    setDocs((cur) => [doc, ...cur]);
    setView({ kind: "editor", docId: doc.id });
    void saveDoc(doc); // first-write so refresh keeps it
  }, [owner]);

  const openDoc = useCallback((id: string) => {
    setView({ kind: "editor", docId: id });
  }, []);

  const renameDoc = useCallback(async (id: string) => {
    const doc = docs.find((d) => d.id === id);
    if (!doc) return;
    const next = await promptDialog({
      title: "Rename document",
      body: "Pick a new name for this document.",
      initial: doc.name,
      placeholder: "Untitled",
      cta: "Rename",
    });
    if (typeof next !== "string") return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === doc.name) return;
    const updated = { ...doc, name: trimmed, updatedAt: new Date().toISOString() };
    setDocs((cur) => cur.map((d) => d.id === id ? updated : d));
    await saveDoc(updated);
  }, [docs]);

  const duplicateDoc = useCallback(async (id: string) => {
    const doc = docs.find((d) => d.id === id);
    if (!doc) return;
    const now = new Date().toISOString();
    const copy: StudioDoc = {
      ...doc,
      id: newDocId(),
      name: doc.name + " (copy)",
      createdAt: now,
      updatedAt: now,
    };
    setDocs((cur) => [copy, ...cur]);
    await saveDoc(copy);
  }, [docs]);

  const removeDoc = useCallback(async (id: string) => {
    const doc = docs.find((d) => d.id === id);
    if (!doc) return;
    const ok = await confirmDialog({
      title: "Delete document",
      body: `Delete "${doc.name}"? This can't be undone.`,
      cta: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    setDocs((cur) => cur.filter((d) => d.id !== id));
    await deleteDoc(owner, id);
    if (view.kind === "editor" && view.docId === id) setView({ kind: "library" });
  }, [docs, owner, view]);

  if (!loaded) {
    return (
      <div style={{ padding: "120px 24px", textAlign: "center", color: D.txm, fontFamily: mn, fontSize: 11, letterSpacing: 1 }}>
        Loading library…
      </div>
    );
  }

  return (
    <div style={{ fontFamily: ft, color: D.tx, minHeight: "calc(100vh - 120px)" }}>
      {/* Header — shows back/library/save state when relevant */}
      <StudioHeader
        view={view}
        analyst={analyst}
        userName={owner}
        saveState={saveState}
        activeDoc={activeDoc}
        onBack={() => setView({ kind: "library" })}
        onGoLibrary={() => setView({ kind: "library" })}
        onGoWelcome={() => setView({ kind: "welcome" })}
        onNew={() => setView({ kind: "welcome" })}
        onRenameActive={async () => {
          if (!activeDoc) return;
          await renameDoc(activeDoc.id);
        }}
      />

      {view.kind === "welcome" && (
        <WelcomeView
          userName={owner}
          recent={docs.slice(0, 5)}
          onPickType={(t) => setView({ kind: "gallery", type: t })}
          onOpenDoc={(id) => openDoc(id)}
          onOpenLibrary={() => setView({ kind: "library" })}
        />
      )}

      {view.kind === "gallery" && (
        <GalleryView
          type={view.type}
          onBack={() => setView({ kind: "welcome" })}
          onPick={(templateId) => newDocFromTemplate(view.type, templateId)}
        />
      )}

      {view.kind === "library" && (
        <LibraryView
          docs={docs}
          onOpen={openDoc}
          onNew={() => setView({ kind: "welcome" })}
          onRename={renameDoc}
          onDuplicate={duplicateDoc}
          onDelete={removeDoc}
        />
      )}

      {view.kind === "editor" && activeDoc && (
        <EditorHost
          doc={activeDoc}
          onChangePayload={(payload) => updateDoc({ ...activeDoc, payload })}
          onBuildChartFromTable={(sheet, sourceName) => {
            // Mint a chart doc seeded with the table's sheet + a sensible
            // default chart type, then jump to it. The user is mid-table
            // flow, so we surface the new chart in the editor immediately.
            const doc = emptyDoc("chart", owner, "Chart of " + sourceName);
            const payload: ChartDocPayload = {
              kind: "chart", version: 1,
              type: "clustered",
              title: sourceName,
              subtitle: "From table",
              sheet,
            };
            doc.payload = payload;
            setDocs((cur) => [doc, ...cur]);
            setView({ kind: "editor", docId: doc.id });
            void saveDoc(doc);
          }}
        />
      )}

      {view.kind === "editor" && !activeDoc && (
        <div style={{ padding: 80, textAlign: "center", color: D.txm }}>
          That document no longer exists.{" "}
          <button onClick={() => setView({ kind: "library" })} style={{ background: "none", border: "none", color: D.amber, cursor: "pointer", fontFamily: mn, fontSize: 12, fontWeight: 700 }}>← Back to library</button>
        </div>
      )}
    </div>
  );
}

function EditorHost({ doc, onChangePayload, onBuildChartFromTable }: {
  doc: StudioDoc;
  onChangePayload: (payload: unknown) => void;
  onBuildChartFromTable: (sheet: TableSheet, sourceName: string) => void;
}) {
  if (doc.type === "chart")   return <ChartEditor   doc={doc} onChangePayload={onChangePayload} />;
  if (doc.type === "table")   return <TableEditor   doc={doc} onChangePayload={onChangePayload} onBuildChart={onBuildChartFromTable} />;
  return <DiagramEditor doc={doc} onChangePayload={onChangePayload} />;
}

function StudioHeader({
  view, analyst, userName, saveState, activeDoc,
  onBack, onGoLibrary, onGoWelcome, onNew, onRenameActive,
}: {
  view: StudioView;
  analyst: boolean;
  userName: string;
  saveState: SaveState;
  activeDoc: StudioDoc | null;
  onBack: () => void;
  onGoLibrary: () => void;
  onGoWelcome: () => void;
  onNew: () => void;
  onRenameActive: () => void;
}) {
  void onGoWelcome;
  const inEditor = view.kind === "editor";
  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 80,
      background: "rgba(10,10,16,0.78)",
      backdropFilter: "blur(20px) saturate(140%)",
      WebkitBackdropFilter: "blur(20px) saturate(140%)",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      padding: "12px 22px",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      {inEditor ? (
        <button
          onClick={onBack}
          title="Back to library"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "7px 12px",
            background: "rgba(255,255,255,0.04)", border: "1px solid " + D.border,
            color: D.txm, fontFamily: mn, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5,
            borderRadius: 7, cursor: "pointer",
          }}
        ><ArrowLeft size={11} strokeWidth={2.4} /> library</button>
      ) : (
        <button
          onClick={onGoLibrary}
          title="Library"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "7px 12px",
            background: view.kind === "library" ? D.amber + "22" : "rgba(255,255,255,0.04)",
            border: "1px solid " + (view.kind === "library" ? D.amber + "55" : D.border),
            color: view.kind === "library" ? D.amber : D.txm,
            fontFamily: mn, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5,
            borderRadius: 7, cursor: "pointer",
          }}
        ><Library size={11} strokeWidth={2.4} /> library</button>
      )}

      {!inEditor && (
        <button
          onClick={onNew}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "7px 12px",
            background: view.kind === "welcome" || view.kind === "gallery" ? D.amber + "22" : "rgba(255,255,255,0.04)",
            border: "1px solid " + (view.kind === "welcome" || view.kind === "gallery" ? D.amber + "55" : D.border),
            color: view.kind === "welcome" || view.kind === "gallery" ? D.amber : D.txm,
            fontFamily: mn, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5,
            borderRadius: 7, cursor: "pointer",
          }}
        ><Plus size={11} strokeWidth={2.4} /> new</button>
      )}

      <span style={{ fontFamily: gf, fontSize: 16, fontWeight: 900, color: D.tx, letterSpacing: -0.3, marginLeft: 4 }}>
        POAST Studio
      </span>

      {inEditor && activeDoc && (
        <>
          <span style={{ color: D.txd, fontSize: 14 }}>·</span>
          <button
            onClick={onRenameActive}
            title="Click to rename"
            style={{
              background: "none", border: "none",
              color: D.tx, fontFamily: gf, fontSize: 15, fontWeight: 700, letterSpacing: -0.2,
              cursor: "pointer", padding: 0,
              borderBottom: "1px dotted transparent",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderBottom = "1px dotted " + D.txm; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderBottom = "1px dotted transparent"; }}
          >{activeDoc.name}</button>
          <span style={{
            padding: "2px 7px", borderRadius: 4,
            background: typeAccent(activeDoc.type) + "1A",
            border: "1px solid " + typeAccent(activeDoc.type) + "44",
            color: typeAccent(activeDoc.type),
            fontFamily: mn, fontSize: 9, fontWeight: 700, letterSpacing: 0.6,
            textTransform: "uppercase",
          }}>{activeDoc.type}</span>
        </>
      )}

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
        {inEditor && (
          <SavePill state={saveState} />
        )}
        <span style={{
          fontFamily: mn, fontSize: 9.5, fontWeight: 700, color: analyst ? D.coral : D.txm,
          padding: "4px 9px",
          border: "1px solid " + (analyst ? D.coral + "55" : D.border),
          background: analyst ? D.coral + "12" : "transparent",
          borderRadius: 5, letterSpacing: 0.5, textTransform: "uppercase",
        }}>{analyst ? "local only · analyst" : userName}</span>
      </div>
    </div>
  );
}

function SavePill({ state }: { state: SaveState }) {
  const color = SAVE_STATE_COLOR[state];
  const label =
    state === "saving" ? "● Saving…" :
    state === "saved"  ? "● Saved" :
    state === "error"  ? "● Save failed" :
    "● Auto-saved";
  return (
    <span style={{
      fontFamily: mn, fontSize: 10, fontWeight: 700, color,
      letterSpacing: 0.5,
    }}>{label}</span>
  );
}

function typeAccent(type: DocType): string {
  if (type === "chart")   return D.amber;
  if (type === "table")   return D.teal;
  return D.blue;
}
