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
import { useTheme } from "../theme-context";
import ChartEditor from "./editor-chart";
import TableEditor from "./editor-table";
import DiagramEditor from "./editor-diagram";
import { templateById as tableTemplateById } from "./lib/table-templates";
import { listDocs, loadDoc, saveDoc, deleteDoc } from "./studio-storage";
import { D, ft, gf, mn, SAVE_STATE_COLOR } from "./studio-theme";
import {
  ChartDocPayload, TableDocPayload,
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

// Phase 5C — convert the table-shaped payload that /api/studio-image/parse
// returns for chart-classified images into a ChartDocPayload that
// ChartMaker2 can hydrate. The route always emits a table-style sheet
// (its system prompt biases that way for safety); we wrap it as a chart
// doc and hint at a sensible default chart type based on row/col count.
function tableParseToChartPayload(p: Record<string, unknown>): Record<string, unknown> {
  const sheet = (p && typeof p === "object" && p.sheet && typeof p.sheet === "object")
    ? (p.sheet as { schema?: Array<{ key: string; label?: string; type?: string }>; rows?: Array<Record<string, unknown>> })
    : null;
  const schema = sheet?.schema || [];
  const rows = sheet?.rows || [];
  // Pick a sensible default chart type. With <= 5 rows + 1 numeric column,
  // a clustered bar lands cleanly; multiple numeric columns suggest
  // stacked. Pure 2-col text+number → bar. Anything else → clustered.
  const numericCols = schema.filter((c) => c.type === "number" || c.type === "percent").length;
  const defaultType = numericCols >= 2 ? "stacked"
    : rows.length <= 5 ? "stacked"
    : "clustered";
  return {
    kind: "chart",
    version: 1,
    type: defaultType,
    title: (p.titleWhite as string) || (p.name as string) || "",
    subtitle: (p.subtitle as string) || "",
    sheet,
    chartAspect: "fit",
  };
}

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
        "gen-matrix":     "Generation Matrix",
        "rack-arch":      "Rack Architecture",
        "layer-stack":    "Layer Stack",
        "die-floorplan":  "Die Floorplan",
        "value-chain":    "Value Chain",
        "power-dist":     "Power Distribution",
      };
      if (labelByTpl[templateId]) docName = labelByTpl[templateId];
    }
    const doc = emptyDoc(type, owner, docName);
    doc.payload = payload;
    setDocs((cur) => [doc, ...cur]);
    setView({ kind: "editor", docId: doc.id });
    void saveDoc(doc); // first-write so refresh keeps it
  }, [owner]);

  // Mint a doc from an image-parse response. The parsed shape (table /
  // chart / diagram) is already validated against the route's JSON
  // schema; we just need to land it as a fresh doc and route the user
  // into the editor.
  //
  // Phase 5C — when docType === "chart" we now route to ChartMaker2
  // instead of the legacy chart→table fallback. The parse route still
  // returns the data in table shape (route prompt heavily biases that
  // way), but we convert it into a ChartDocPayload here so the chart
  // editor opens with the sheet pre-loaded.
  const newDocFromParsed = useCallback((parsed: {
    docType: "chart" | "table" | "diagram";
    name?: string;
    payload: Record<string, unknown>;
  }) => {
    const type: DocType = parsed.docType === "diagram"
      ? "diagram"
      : parsed.docType === "chart"
      ? "chart"
      : "table";
    const name = (parsed.name && parsed.name.trim()) || NEW_DOC_NAMES[type];
    const doc = emptyDoc(type, owner, name);
    if (type === "chart") {
      doc.payload = tableParseToChartPayload(parsed.payload);
    } else {
      doc.payload = parsed.payload;
    }
    setDocs((cur) => [doc, ...cur]);
    setView({ kind: "editor", docId: doc.id });
    void saveDoc(doc);
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
          onParsedDoc={newDocFromParsed}
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
          onBuildTableFromChart={(sheet, sourceName) => {
            // Reverse — chart's sheet becomes the seed for a new table
            // doc. Lands on the framed chrome so it's recognizable as a
            // sibling of the source chart.
            const doc = emptyDoc("table", owner, "Table of " + sourceName);
            const payload: TableDocPayload = {
              kind: "table", version: 1,
              engine: "standard",
              sheet,
              titleWhite: sourceName,
              category: "SEMIANALYSIS — DRAFT",
              subtitle: "From chart",
              titleBar: sourceName.toUpperCase(),
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

function EditorHost({ doc, onChangePayload, onBuildChartFromTable, onBuildTableFromChart }: {
  doc: StudioDoc;
  onChangePayload: (payload: unknown) => void;
  onBuildChartFromTable: (sheet: TableSheet, sourceName: string) => void;
  onBuildTableFromChart: (sheet: TableSheet, sourceName: string) => void;
}) {
  if (doc.type === "chart")   return <ChartEditor   doc={doc} onChangePayload={onChangePayload} onBuildTable={onBuildTableFromChart} />;
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
  // Under stock/glass RouteChrome floats a "<- POAST" pill at top-right of
  // this route (charts/layout.tsx backSide="right"); reserve its footprint
  // so the save pill + username never render underneath it. Classic has no
  // pill and keeps the standard 22px.
  const { theme } = useTheme();
  const pillPad = theme === "classic" ? 22 : 112;
  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 80,
      background: "rgba(10,10,16,0.78)",
      backdropFilter: "blur(20px) saturate(140%)",
      WebkitBackdropFilter: "blur(20px) saturate(140%)",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      padding: "12px 22px",
      paddingRight: pillPad,
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
