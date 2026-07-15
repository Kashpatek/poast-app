"use client";
// ═══════════════════════════════════════════════════════════════════════════
// HomeStation — THE FOUNDRY home (docs/THEME-FOUNDRY.md §8 HOME).
//
// Centered kicker + molten-gradient-word hero, resume draft cards as forged
// plates (hot edge via .glass--tile) with a mini SlidePreview strip, three
// tinted start tiles (Classic Carousel / Verbatim / Unique / Neu), and the ONE archive
// surface as a horizontal plate shelf with fade-edge mask. Behavior is
// frozen from v1: every store call, handler (load / rename / delete /
// resume / discard) and the search / All-Mine / refresh controls are
// unchanged; only the skin and cosmetic copy moved to the foundry language.
// Deliberate post-v1 fixes: startNew is draft-guarded, Cmd+N (browser-
// reserved, dead in Chrome/Safari) became single-key N / 1 / 2 / 3 / 4, cards
// are clickable, and the shelf gained a DUPLICATE action.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useWizard, loadDraft, clearDraft, type WizardDraft, type WizardMode } from "../store";
import { SlidePreview } from "../engine/SlidePreview";
import { listArchive, renameArchive, deleteArchive, saveArchive, type ArchiveRow } from "../engine/api";
import { THEMES, type Slide, type ThemeKey } from "../engine/types";
import {
  loadVerbatimDraft,
  clearVerbatimDraft,
  draftHasContent,
  type VerbatimDraft,
} from "../engine/verbatim";
import { useUser } from "../../user-context";
import { showToast } from "../../toast-context";
import { confirmDialog, promptDialog } from "../../dialog-context";

/* ─────────────── archive row readers (data payload is untyped V1 JSON) ─── */

function rowData(row: ArchiveRow): Record<string, unknown> {
  return row && row.data && typeof row.data === "object" ? row.data : {};
}

function rowSlides(row: ArchiveRow): Slide[] {
  const s = rowData(row).slides;
  return Array.isArray(s) ? (s as Slide[]) : [];
}

function rowTheme(row: ArchiveRow): ThemeKey {
  const t = rowData(row).theme;
  return typeof t === "string" && t in THEMES ? (t as ThemeKey) : "general";
}

function rowTime(row: ArchiveRow): number {
  const t = rowData(row).timestamp;
  if (typeof t === "number") return t;
  if (typeof t === "string") {
    const ms = new Date(t).getTime();
    return Number.isNaN(ms) ? 0 : ms;
  }
  return 0;
}

function rowCreatedBy(row: ArchiveRow): string {
  const c = rowData(row).createdBy;
  return typeof c === "string" ? c : "";
}

function rowSourceUrl(row: ArchiveRow): string {
  const u = rowData(row).sourceUrl;
  return typeof u === "string" ? u : "";
}

function rowSlideCount(row: ArchiveRow): number {
  const n = rowData(row).slideCount;
  if (typeof n === "number" && n > 0) return n;
  return rowSlides(row).length;
}

/* ─────────────── formatting helpers ─────────────── */

function fmtMDY(ms: number): string {
  if (!ms) return "—";
  const d = new Date(ms);
  return d.getMonth() + 1 + "." + d.getDate() + "." + String(d.getFullYear()).slice(-2);
}

function agoLabel(ms?: number): string {
  if (!ms) return "";
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (mins < 1) return "JUST NOW";
  if (mins < 60) return mins + " MIN AGO";
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + " HR AGO";
  return Math.round(hrs / 24) + " D AGO";
}

function firstLine(t: string): string {
  const line = (t.trim().split(/\n/)[0] || "").trim();
  if (!line) return "Untitled run";
  return line.length > 64 ? line.slice(0, 61) + "..." : line;
}

/** Register-2 whispers lead with a cap — first letter only, rest untouched,
 *  so display names like "SemiAnalysis" and "Dylan Patel" survive. */
function sentenceCase(t: string): string {
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function todayLabel(): string {
  return new Date()
    .toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
    .toUpperCase();
}

/* ─────────────── wizard-draft banner readers ─────────────── */

const STATION_ORD: Record<string, number> = {
  create: 1,
  generating: 1, // never resumed into; reads as its CREATE origin
  choose: 2,
  edit: 3,
  publish: 4,
};

function draftStationLabel(d: WizardDraft): string {
  const n = STATION_ORD[d.station || ""] || 1;
  return "STATION 0" + n;
}

function draftTitle(d: WizardDraft): string {
  if (d.articleTitle && d.articleTitle.trim()) return d.articleTitle.trim();
  const cover = (d.slides || []).find(
    (s) => !!s && typeof s.type === "string" && s.type.indexOf("cover") === 0
  );
  if (cover && cover.title && cover.title.trim()) return cover.title.trim();
  if (d.text && d.text.trim()) return firstLine(d.text);
  return "Untitled run";
}

function draftMeta(d: WizardDraft): string {
  const n = Array.isArray(d.slides) ? d.slides.length : 0;
  const what =
    n > 0
      ? n + " SLIDES"
      : (d.mode === "verbatim" ? "VERBATIM" : d.mode === "unique" ? "UNIQUE" : "AI") + " MODE";
  const when = d.savedAt ? "SAVED " + agoLabel(d.savedAt) : "AUTOSAVED";
  return what + " · " + when;
}

function draftTheme(d: WizardDraft): ThemeKey {
  return d.category && d.category in THEMES ? d.category : "general";
}

/* ─────────────── inline style recipes (page-local, on theme.css tokens) ── */

const CARD_W = 150;
// alpha mask only: "black" here is mask coverage, not a rendered color
const FADE =
  "linear-gradient(90deg, transparent 0, black 30px, black calc(100% - 30px), transparent 100%)";

const sx: Record<string, CSSProperties> = {
  page: {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: 16, padding: "36px 32px 64px",
  },
  kickRow: { textAlign: "center" },
  hero: { textAlign: "center", maxWidth: 920 },
  heroSub: { textAlign: "center", maxWidth: 580 },
  resumeCol: {
    display: "flex", flexDirection: "column", gap: 12,
    width: "min(780px, 100%)", marginTop: 12,
  },
  draftCard: { display: "flex", alignItems: "center", gap: 16, padding: "14px 18px" },
  draftStrip: { display: "flex", gap: 6, flex: "0 0 auto" },
  draftTitle: {
    fontFamily: "var(--grift)", fontWeight: 700, fontSize: 15, marginTop: 4,
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  },
  draftMeta: { fontSize: 11, marginTop: 4 },
  draftBtn: { padding: "9px 16px", flex: "0 0 auto" },
  tiles: { display: "flex", alignItems: "stretch", gap: 14, width: "min(1060px, 100%)", marginTop: 14 },
  statsRow: { display: "flex", gap: 12, marginTop: 4 },
  shelf: {
    width: "min(1240px, 100%)", marginTop: 20,
    padding: "18px 22px 12px", display: "flex", flexDirection: "column", gap: 10,
  },
  shelfHead: { display: "flex", alignItems: "center", gap: 14 },
  shelfRow: {
    display: "flex", gap: 16, overflowX: "auto", padding: "8px 30px 14px",
    WebkitMaskImage: FADE, maskImage: FADE,
  },
  card: { flex: "0 0 auto", width: CARD_W + 20, padding: 10 },
  cardName: {
    fontSize: 12, fontWeight: 500, marginTop: 8,
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  },
  cardMeta: {
    fontSize: 9.5, marginTop: 3,
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  },
  noPrev: {
    width: CARD_W, height: CARD_W * 1.25, borderRadius: 8, display: "grid",
    placeItems: "center", fontFamily: "var(--body)", fontWeight: 600,
    fontSize: 8.5, letterSpacing: "0.14em", color: "var(--dim)",
    background: "rgba(12,12,16,.6)", border: "1px solid var(--line)",
  },
  slChip: {
    position: "absolute", top: 8, left: 8, zIndex: 2, fontSize: 8,
    padding: "3px 8px", background: "rgba(10,10,12,.72)", letterSpacing: "0.12em",
  },
  overlay: {
    position: "absolute", inset: 0, zIndex: 3, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", gap: 8,
    background: "rgba(8,6,5,.66)", borderRadius: 10,
  },
  emptyNote: { padding: "26px 8px", whiteSpace: "nowrap" },
  search: {
    flex: 1, maxWidth: 320, marginLeft: "auto", display: "flex", alignItems: "center",
    gap: 10, border: "1px solid var(--line-2)", borderRadius: 10, padding: "8px 13px",
    background: "rgba(12,12,16,.6)",
  },
  searchInput: {
    background: "none", border: 0, outline: 0, color: "var(--tx)",
    fontFamily: "var(--body)", fontSize: 12, fontWeight: 500,
    letterSpacing: "0.04em", width: "100%",
  },
  hint: {
    position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)",
    zIndex: 40, fontFamily: "var(--body)", fontWeight: 600, fontSize: 9.5,
    letterSpacing: "0.18em", color: "var(--muted)",
    background: "rgba(10,10,12,.7)", border: "1px solid var(--line)",
    borderRadius: 8, padding: "6px 14px",
  },
};

function actStyle(kind: "pri" | "ghost" | "del"): CSSProperties {
  return {
    fontFamily: "var(--body)", fontSize: 10, letterSpacing: "0.12em", width: 110,
    padding: "7px 0", textAlign: "center", borderRadius: 10, cursor: "pointer",
    fontWeight: kind === "pri" ? 700 : 600,
    background: kind === "pri" ? "var(--amber)" : "rgba(16,16,21,.9)",
    color: kind === "pri" ? "#0A0A0C" : kind === "del" ? "var(--coral)" : "var(--tx)",
    border: "1px solid " +
      (kind === "pri" ? "var(--amber)" : kind === "del" ? "rgba(224,99,71,.4)" : "var(--line-2)"),
  };
}

/* ─────────────── small pieces ─────────────── */

/** Tinted forged start tile. tc drives border + wash + hot edge via .glass--tint.
 *  hotkey is the tile's single-key shortcut (1/2/3/4); the hot tile also owns N. */
function ModeTile({ tc, name, desc, tag, hot, hotkey, onClick }: {
  tc: string; name: string; desc: string; tag: string; hot: boolean; hotkey: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="glass glass--tile glass--tint"
      onClick={onClick}
      style={{
        ["--tc" as string]: tc,
        flex: 1, minWidth: 0, textAlign: "left", cursor: "pointer",
        display: "flex", flexDirection: "column", gap: 8, padding: 18,
        color: "var(--tx)", fontFamily: "var(--body)",
      } as CSSProperties}
    >
      <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontFamily: "var(--grift)", fontWeight: 800, fontSize: 18, lineHeight: 1 }}>
          {name}
        </span>
        <span style={{ display: "flex", gap: 4 }}>
          {hot && <span className="kbd">N</span>}
          <span className="kbd">{hotkey}</span>
        </span>
      </span>
      <span style={{ fontSize: 13, fontWeight: 400, color: "var(--muted)", lineHeight: 1.5 }}>
        {desc}
      </span>
      <span style={{ fontWeight: 600, fontSize: 9, letterSpacing: "0.14em", color: tc, marginTop: "auto" }}>
        {tag}
      </span>
    </button>
  );
}

/** Resume card: forged plate with hot edge, accent left edge, mini SlidePreview strip. */
function DraftCard({ accent, kicker, title, meta, slides, theme, secondaryLabel, onSecondary, primaryClass, onPrimary }: {
  accent: string; kicker: string; title: string; meta: string;
  slides: Slide[]; theme: ThemeKey;
  secondaryLabel: string; onSecondary: () => void;
  primaryClass: string; onPrimary: () => void;
}) {
  const strip = slides.slice(0, 4);
  return (
    <div
      className="glass glass--tile"
      onClick={onPrimary}
      style={{ ...sx.draftCard, borderLeft: "3px solid " + accent, cursor: "pointer" }}
    >
      {strip.length > 0 && (
        <div style={sx.draftStrip}>
          {strip.map((s, i) => (
            <SlidePreview key={s.id || i} slide={s} theme={theme} width={54} />
          ))}
        </div>
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 9.5, letterSpacing: "0.14em", color: accent }}>
          {kicker}
        </div>
        <div style={sx.draftTitle}>{title}</div>
        <div className="whisper" style={sx.draftMeta}>{meta}</div>
      </div>
      <button
        type="button"
        className="btn btn-ghost"
        style={sx.draftBtn}
        onClick={(e) => { e.stopPropagation(); onSecondary(); }}
      >
        {secondaryLabel}
      </button>
      <button
        type="button"
        className={primaryClass}
        style={sx.draftBtn}
        onClick={(e) => { e.stopPropagation(); onPrimary(); }}
      >
        Resume
      </button>
    </div>
  );
}

/** Archive shelf tile: SlidePreview + name + whisper meta (mono date), hover lift + actions. */
function ShelfCard({ row, onResume, onRename, onDuplicate, onDelete }: {
  row: ArchiveRow;
  onResume: (row: ArchiveRow) => void;
  onRename: (row: ArchiveRow) => void;
  onDuplicate: (row: ArchiveRow) => void;
  onDelete: (row: ArchiveRow) => void;
}) {
  const slides = rowSlides(row);
  const cover = slides[0];
  const theme = rowTheme(row);
  const metaWho = sentenceCase(rowCreatedBy(row) || "unknown");
  return (
    <div className="glass glass--tile" style={{ ...sx.card, cursor: "pointer" }}>
      <div
        onClick={() => onResume(row)}
        style={{ position: "relative", borderRadius: 10, overflow: "hidden", cursor: "pointer" }}
      >
        {cover ? (
          <SlidePreview slide={cover} theme={theme} width={CARD_W} />
        ) : (
          <div style={sx.noPrev}>NO PREVIEW</div>
        )}
        <span className="chip" style={sx.slChip}>{rowSlideCount(row)} SL</span>
        <div className="hover-actions" style={sx.overlay}>
          <button type="button" style={actStyle("pri")} onClick={(e) => { e.stopPropagation(); onResume(row); }}>RESUME</button>
          <button type="button" style={actStyle("ghost")} onClick={(e) => { e.stopPropagation(); onRename(row); }}>RENAME</button>
          <button type="button" style={actStyle("ghost")} onClick={(e) => { e.stopPropagation(); onDuplicate(row); }}>DUPLICATE</button>
          <button type="button" style={actStyle("del")} onClick={(e) => { e.stopPropagation(); onDelete(row); }}>DELETE</button>
        </div>
      </div>
      <div title={row.name || ""} style={sx.cardName}>{row.name || "Untitled"}</div>
      <div className="whisper" style={sx.cardMeta}>
        <span className="mono" style={{ fontStyle: "normal" }}>{fmtMDY(rowTime(row))}</span>
        {" · " + metaWho + " · " + THEMES[theme].label}
      </div>
    </div>
  );
}

/* ─────────────── station ─────────────── */

export function HomeStation() {
  const mode = useWizard((s) => s.mode);
  const startNew = useWizard((s) => s.startNew);
  const hydrateFromDraft = useWizard((s) => s.hydrateFromDraft);
  const patch = useWizard((s) => s.patch);
  const loadFromArchive = useWizard((s) => s.loadFromArchive);
  const go = useWizard((s) => s.go);
  const { user } = useUser();

  const [rows, setRows] = useState<ArchiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"all" | "mine">("all");
  const [draft, setDraft] = useState<WizardDraft | null>(null);
  const [legacyDraft, setLegacyDraft] = useState<VerbatimDraft | null>(null);
  const [showHint, setShowHint] = useState(false);
  const scrollRef = useRef<HTMLElement | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listArchive());
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to load archive.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Drafts are read post-mount only (localStorage), so SSR markup matches.
  useEffect(() => {
    setDraft(loadDraft());
    const vd = loadVerbatimDraft();
    setLegacyDraft(draftHasContent(vd) ? vd : null);
  }, []);

  // Draft guard: startNew wipes the deck and the 600ms autosaver then
  // overwrites the localStorage draft — so any start path (tile click or
  // shortcut) confirms first when a slide-bearing draft would be replaced.
  // Checks the live store (ESC HOME mid-run) then the parked banner draft.
  const startGuarded = useCallback(
    async (m: WizardMode) => {
      const live = useWizard.getState().slides.length;
      const parked = draft && Array.isArray(draft.slides) ? draft.slides.length : 0;
      const n = live > 0 ? live : parked;
      if (n > 0) {
        const ok = await confirmDialog({
          title: "Start a new run?",
          body:
            "Your in-progress " + n + "-slide draft will be replaced. This cannot be undone.",
          cta: "Start new",
          variant: "danger",
        });
        if (!ok) return;
      }
      startNew(m);
    },
    [draft, startNew]
  );

  // Single-key shortcuts: N starts the highlighted mode, 1/2/3/4 a specific
  // tile. (Cmd+N is browser-reserved in Chrome/Safari and never reached us.)
  // All routes go through the startGuarded draft check above.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      if (document.body.hasAttribute("data-modal-open")) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const k = e.key.toLowerCase();
      const m: WizardMode | null =
        k === "n" ? useWizard.getState().mode
        : k === "1" ? "ai"
        : k === "2" ? "verbatim"
        : k === "3" ? "unique"
        : k === "4" ? "library"
        : null;
      if (!m) return;
      e.preventDefault();
      void startGuarded(m);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [startGuarded]);

  // Scroll hint at bottom-center while the page overflows and sits near the top.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () =>
      setShowHint(el.scrollHeight - el.clientHeight > 40 && el.scrollTop < 60);
    check();
    el.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      el.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [rows.length, loading, draft, legacyDraft]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Creator names are free-typed strings — compare normalized, never raw.
    const mine = scope === "mine" ? (user?.name || "").trim().toLowerCase() : null;
    const out = rows.filter((r) => {
      if (mine !== null && rowCreatedBy(r).trim().toLowerCase() !== mine) return false;
      if (!q) return true;
      return (
        (r.name || "").toLowerCase().indexOf(q) !== -1 ||
        rowSourceUrl(r).toLowerCase().indexOf(q) !== -1
      );
    });
    out.sort((a, b) => rowTime(b) - rowTime(a));
    return out;
  }, [rows, query, scope, user?.name]);

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    let week = 0;
    let latest = 0;
    const names = new Set<string>();
    for (const r of rows) {
      const t = rowTime(r);
      if (t >= weekAgo) week += 1;
      if (t > latest) latest = t;
      const by = rowCreatedBy(r);
      if (by) names.add(by);
    }
    return { total: rows.length, week, analysts: names.size, latest };
  }, [rows]);

  /* ─── draft card actions ─── */

  const onResumeDraft = () => {
    if (!draft) return;
    hydrateFromDraft(draft);
    // A draft parked at "home" would resume invisibly; route it to work.
    if (useWizard.getState().station === "home") {
      go(draft.slides && draft.slides.length > 0 ? "edit" : "create");
    }
  };

  const onStartFresh = async () => {
    const ok = await confirmDialog({
      title: "Start fresh",
      body: "Discard the autosaved draft? This cannot be undone.",
      cta: "Discard",
      variant: "danger",
    });
    if (!ok) return;
    clearDraft();
    setDraft(null);
    showToast("Draft cleared.");
  };

  // Legacy verbatim draft: seed text + mode into CREATE (simple mapping,
  // cover knobs stay in the legacy draft and reload if /carousel resumes it).
  const onResumeLegacy = () => {
    if (!legacyDraft) return;
    startNew("verbatim");
    patch({
      text: legacyDraft.text || "",
      category:
        legacyDraft.category && legacyDraft.category in THEMES ? legacyDraft.category : "general",
      countMode: legacyDraft.mode === "manual" ? "manual" : "auto",
      pageCount:
        typeof legacyDraft.pageCount === "number" && legacyDraft.pageCount > 0
          ? legacyDraft.pageCount
          : 4,
    });
    showToast("Verbatim draft loaded into Create.");
  };

  const onDiscardLegacy = async () => {
    const ok = await confirmDialog({
      title: "Discard legacy draft",
      body: "Discard the legacy verbatim draft from /carousel? This cannot be undone.",
      cta: "Discard",
      variant: "danger",
    });
    if (!ok) return;
    clearVerbatimDraft();
    setLegacyDraft(null);
    showToast("Legacy draft cleared.");
  };

  /* ─── archive card actions ─── */

  const onRename = async (row: ArchiveRow) => {
    const name = await promptDialog({
      title: "Rename sheet",
      body: "New archive name for this carousel.",
      placeholder: "Archive name",
      initial: row.name || "",
      cta: "Rename",
    });
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === row.name) return;
    try {
      await renameArchive(row.id, trimmed, rowData(row));
      setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, name: trimmed } : r)));
      showToast("Renamed.");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to rename.", "error");
    }
  };

  // Duplicate: fresh row (no id → saveArchive mints one), same payload with
  // a new timestamp, "<name> copy". Resume still upserts over the ORIGINAL
  // row, so the copy is the safe snapshot left on the shelf.
  const onDuplicate = async (row: ArchiveRow) => {
    try {
      await saveArchive({
        name: (row.name || "Untitled") + " copy",
        data: { ...rowData(row), timestamp: Date.now() },
      });
      showToast("Duplicated.");
      await refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to duplicate.", "error");
    }
  };

  const onDelete = async (row: ArchiveRow) => {
    const ok = await confirmDialog({
      title: "Delete sheet",
      body: 'Delete "' + (row.name || "this carousel") + '" from the archive? This cannot be undone.',
      cta: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await deleteArchive(row.id);
      setRows((rs) => rs.filter((r) => r.id !== row.id));
      showToast("Deleted.");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to delete.", "error");
    }
  };

  /* ─── render ─── */

  return (
    <section ref={scrollRef} className="station-scroll" style={sx.page}>
      <div className="kicker rise d1" style={sx.kickRow}>
        SEMIANALYSIS · CAROUSEL STUDIO · <em>{todayLabel()}</em>
      </div>

      <h1 className="display display--home rise d2" style={sx.hero}>
        Make the next <span className="grad">carousel</span>.
      </h1>
      <p className="sub rise d2" style={sx.heroSub}>
        One source in, a finished 1080×1350 deck out: directed, verbatim, or fully autonomous.
      </p>

      {(draft || legacyDraft) && (
        <div className="rise d3" style={sx.resumeCol}>
          {draft && (
            <DraftCard
              accent="var(--amber)"
              kicker={"DRAFT IN PROGRESS · " + draftStationLabel(draft)}
              title={draftTitle(draft)}
              meta={draftMeta(draft)}
              slides={draft.slides || []}
              theme={draftTheme(draft)}
              secondaryLabel="Start fresh"
              onSecondary={() => void onStartFresh()}
              primaryClass="btn btn--amber"
              onPrimary={onResumeDraft}
            />
          )}
          {legacyDraft && (
            <DraftCard
              accent="var(--cobalt)"
              kicker="LEGACY VERBATIM DRAFT · OPENS IN CREATE"
              title={(legacyDraft.chosenTitle || "").trim() || firstLine(legacyDraft.text || "")}
              meta={"FROM /CAROUSEL" + (legacyDraft.savedAt ? " · SAVED " + agoLabel(legacyDraft.savedAt) : "")}
              slides={[]}
              theme="general"
              secondaryLabel="Discard"
              onSecondary={() => void onDiscardLegacy()}
              primaryClass="btn btn--cobalt-ghost"
              onPrimary={onResumeLegacy}
            />
          )}
        </div>
      )}

      <div className="rise d4" style={sx.tiles}>
        <ModeTile
          tc="var(--cobalt)"
          name="Classic Carousel"
          desc="The model reads your source, structures the story, and drafts three variants to pick from."
          tag="CLASSIC · 3 VARIANTS"
          hot={mode === "ai"}
          hotkey="1"
          onClick={() => void startGuarded("ai")}
        />
        <ModeTile
          tc="var(--amber)"
          name="Verbatim"
          desc="Your text, split exactly as written. Straight to the editing bench."
          tag="EXACT SPLIT"
          hot={mode === "verbatim"}
          hotkey="2"
          onClick={() => void startGuarded("verbatim")}
        />
        <ModeTile
          tc="var(--mint)"
          name="Unique"
          desc="The app designs the whole post: stats, charts, generative art. Pick from three directions."
          tag="AUTONOMOUS"
          hot={mode === "unique"}
          hotkey="3"
          onClick={() => void startGuarded("unique")}
        />
        <ModeTile
          tc="var(--coral)"
          name="Neu"
          desc="Builds from the approved library — parsed covers, templates, and topic backdrops, tinted to your category."
          tag="APPROVED LIBRARY · 3 CUTS"
          hot={mode === "library"}
          hotkey="4"
          onClick={() => void startGuarded("library")}
        />
      </div>

      <div className="rise d5" style={sx.statsRow}>
        <div className="stat-pill">
          <b>{loading ? "—" : String(stats.total)}</b>
          <span>SHEETS ON FILE</span>
        </div>
        <div className="stat-pill">
          <b style={{ color: "var(--amber)" }}>{loading ? "—" : String(stats.week)}</b>
          <span>THIS WEEK</span>
        </div>
        <div className="stat-pill">
          <b>{loading ? "—" : String(stats.analysts)}</b>
          <span>ANALYSTS</span>
        </div>
      </div>

      <section className="glass rise d6" style={sx.shelf}>
        <div style={sx.shelfHead}>
          <div className="kicker" style={{ whiteSpace: "nowrap" }}>
            ON FILE · <b className="mono">{loading ? "—" : String(filtered.length)}</b>
          </div>
          <div style={sx.search}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ stroke: "var(--dim)", flexShrink: 0 }}>
              <circle cx="5" cy="5" r="4" strokeWidth="1.4" />
              <path d="M8.5 8.5L11 11" strokeWidth="1.4" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="SEARCH NAME OR SOURCE URL"
              aria-label="Search archive"
              style={sx.searchInput}
            />
          </div>
          <div className="seg">
            <button
              type="button"
              className={scope === "all" ? "on" : undefined}
              onClick={() => setScope("all")}
            >
              ALL
            </button>
            <button
              type="button"
              className={scope === "mine" ? "on" : undefined}
              onClick={() => setScope("mine")}
            >
              MINE
            </button>
          </div>
          <button
            type="button"
            className="chip"
            disabled={loading}
            onClick={() => void refresh()}
            style={{ cursor: loading ? "default" : "pointer", background: "transparent", opacity: loading ? 0.5 : 1 }}
          >
            REFRESH
          </button>
        </div>

        <div style={sx.shelfRow}>
          {loading && <div className="whisper" style={sx.emptyNote}>Loading the archive…</div>}
          {!loading && rows.length === 0 && (
            <div className="whisper" style={sx.emptyNote}>Nothing cast yet.</div>
          )}
          {!loading && rows.length > 0 && filtered.length === 0 && (
            <div className="whisper" style={sx.emptyNote}>No matches. Adjust search or scope.</div>
          )}
          {!loading &&
            filtered.map((row) => (
              <ShelfCard
                key={row.id}
                row={row}
                onResume={loadFromArchive}
                onRename={(r) => void onRename(r)}
                onDuplicate={(r) => void onDuplicate(r)}
                onDelete={(r) => void onDelete(r)}
              />
            ))}
        </div>
      </section>

      {showHint && (
        <div style={sx.hint}>
          SCROLL FOR THE ARCHIVE ↓
        </div>
      )}
    </section>
  );
}
