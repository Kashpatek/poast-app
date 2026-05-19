"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  LayoutGrid,
  Sparkles,
  Play,
  Code,
  Quote,
  CalendarDays,
  PenTool,
  Wand,
  Search,
} from "lucide-react";
import { DocuShell } from "./docu-shell";
import { D, ft, gf, mn } from "../shared-constants";
import { useToast } from "../toast-context";
import { useDialog } from "../dialog-context";
import { DocumentWizard } from "./wizards/document-wizard";
import { ImageWizard } from "./wizards/image-wizard";
import { QuoteWizard } from "./wizards/quote-wizard";
import { EventWizard } from "./wizards/event-wizard";
import { GraphicWizard } from "./wizards/graphic-wizard";
import { MotionWizard } from "./wizards/motion-wizard";
import { ProgrammaticWizard } from "./wizards/programmatic-wizard";
import { ALL_CATEGORIES, type Category, type StudioTool } from "./wizards/categories";
import { SIZE_PRESETS } from "./wizards/size-presets";
import { QUOTE_TEMPLATES, type QuoteTemplateId } from "./wizards/quote-templates";
import { EVENT_ROSTER } from "./wizards/events";

interface ProjectSummary {
  id: string;
  name: string;
  type: "document" | "other";
  fidelity?: "wireframe" | "high";
  design_system_id: string | null;
  created_at?: string;
  updated_at?: string;
}

// Eight studio tiles. v1: DocuDesign and Custom canvas open project-creation
// dialogs that route to the existing chat-driven SVG canvas. The other six
// surface as "coming next" with a toast — they get wired up in Phase 2+ as
// the wizards and editors ship.
type TileStatus = "live" | "soon";

interface StudioTile {
  id: string;
  label: string;
  sub: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  accent: string;
  status: TileStatus;
  action: "doc" | "graphic" | "image" | "motion" | "programmatic" | "quote" | "event" | "custom";
}

const TILES: StudioTile[] = [
  { id: "docu",        label: "DocuDesign",     sub: "Docs, flyers, briefs, decks",   Icon: FileText,     accent: D.blue,    status: "live", action: "doc" },
  { id: "graphics",    label: "Graphics",       sub: "Canva-style WYSIWYG editor",    Icon: LayoutGrid,   accent: D.amber,   status: "live", action: "graphic" },
  { id: "image",       label: "Image Studio",   sub: "AI gen + inline editor",        Icon: Sparkles,     accent: D.violet,  status: "live", action: "image" },
  { id: "motion",      label: "Motion",         sub: "Animated graphics & loops",     Icon: Play,         accent: D.teal,    status: "live", action: "motion" },
  { id: "programmatic",label: "Programmatic",   sub: "Code-driven video templates",   Icon: Code,         accent: D.cyan,    status: "live", action: "programmatic" },
  { id: "quote",       label: "Quote card",     sub: "Preset SA-styled cards",        Icon: Quote,        accent: D.coral,   status: "live", action: "quote" },
  { id: "event",       label: "Event one-pager",sub: "Conference & sponsor handouts", Icon: CalendarDays, accent: D.crimson, status: "live", action: "event" },
  { id: "custom",      label: "Custom canvas",  sub: "Free chat-driven artboard",     Icon: PenTool,      accent: D.txm,     status: "live", action: "custom" },
];

export default function DesignStudioHubPage() {
  const router = useRouter();
  const { showToast: toast } = useToast();
  const { prompt, confirm } = useDialog();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [tablesMissing, setTablesMissing] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [docWizardOpen, setDocWizardOpen] = useState(false);
  const [imageWizardOpen, setImageWizardOpen] = useState(false);
  const [quoteWizardOpen, setQuoteWizardOpen] = useState(false);
  const [eventWizardOpen, setEventWizardOpen] = useState(false);
  const [graphicWizardOpen, setGraphicWizardOpen] = useState(false);
  const [motionWizardOpen, setMotionWizardOpen] = useState(false);
  const [programmaticWizardOpen, setProgrammaticWizardOpen] = useState(false);

  // Preselection handed to a wizard the next time it opens (cleared on close).
  // Each tool keeps its own bag so opening one wizard doesn't leak into another.
  const [pick, setPick] = useState<{
    doc?: { categoryId?: string; presetId?: string };
    graphic?: { categoryId?: string; presetId?: string };
    image?: { categoryId?: string; presetId?: string };
    motion?: { presetId?: string };
    programmatic?: { compId?: string };
    quote?: { categoryId?: string; presetId?: string; templateId?: QuoteTemplateId };
    event?: { eventId?: string; categoryId?: string; presetId?: string };
  }>({});

  // ── Search ──────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/docu-design/projects");
      const j = await res.json();
      if (!res.ok) {
        if (
          typeof j.error === "string" &&
          (/relation .* does not exist/i.test(j.error) ||
            /could not find the table/i.test(j.error))
        ) {
          setTablesMissing(true);
        } else {
          toast(j.error || "Failed to load projects");
        }
        setProjects([]);
        return;
      }
      setProjects(j.data || []);
    } catch (e) {
      toast(String(e));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  // Cmd/Ctrl+K to focus search.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Open the wizard that matches a tool, with optional preselection.
  function openTool(tool: StudioTool, pre?: {
    categoryId?: string;
    presetId?: string;
    templateId?: QuoteTemplateId;
    eventId?: string;
    compId?: string;
  }) {
    if (tool === "doc") {
      setPick((p) => ({ ...p, doc: { categoryId: pre?.categoryId, presetId: pre?.presetId } }));
      setDocWizardOpen(true);
    } else if (tool === "graphic") {
      setPick((p) => ({ ...p, graphic: { categoryId: pre?.categoryId, presetId: pre?.presetId } }));
      setGraphicWizardOpen(true);
    } else if (tool === "image") {
      setPick((p) => ({ ...p, image: { categoryId: pre?.categoryId, presetId: pre?.presetId } }));
      setImageWizardOpen(true);
    } else if (tool === "motion") {
      setPick((p) => ({ ...p, motion: { presetId: pre?.presetId } }));
      setMotionWizardOpen(true);
    } else if (tool === "programmatic") {
      setPick((p) => ({ ...p, programmatic: { compId: pre?.compId } }));
      setProgrammaticWizardOpen(true);
    } else if (tool === "quote") {
      setPick((p) => ({ ...p, quote: { categoryId: pre?.categoryId, presetId: pre?.presetId, templateId: pre?.templateId } }));
      setQuoteWizardOpen(true);
    } else if (tool === "event") {
      setPick((p) => ({ ...p, event: { eventId: pre?.eventId, categoryId: pre?.categoryId, presetId: pre?.presetId } }));
      setEventWizardOpen(true);
    } else if (tool === "custom") {
      createProject("other");
    }
  }

  // Best-effort: pick the tool a size preset most naturally belongs to.
  function toolForPreset(presetId: string): StudioTool {
    const cat = ALL_CATEGORIES.find(
      (c) => c.defaultPreset === presetId || (c.recommendedPresets || []).includes(presetId)
    );
    return cat?.tool ?? "graphic";
  }

  // Pick the category to preselect alongside a preset, so wizards can advance past size selection.
  function categoryForPreset(presetId: string, tool: StudioTool): string | undefined {
    const c = ALL_CATEGORIES.find(
      (c) => c.tool === tool && (c.defaultPreset === presetId || (c.recommendedPresets || []).includes(presetId))
    );
    return c?.id;
  }

  // ── Search corpus + ranking ─────────────────────────────────────
  type SearchItem =
    | { kind: "tile"; id: string; label: string; sub: string; accent: string; tool: StudioTool }
    | { kind: "category"; id: string; label: string; sub: string; tool: StudioTool; category: Category }
    | { kind: "size"; id: string; label: string; sub: string; tool: StudioTool }
    | { kind: "template"; id: QuoteTemplateId; label: string; sub: string }
    | { kind: "event"; id: string; label: string; sub: string }
    | { kind: "project"; id: string; label: string; sub: string };

  const corpus: SearchItem[] = useMemo(() => {
    const out: SearchItem[] = [];
    TILES.forEach((t) => out.push({ kind: "tile", id: t.id, label: t.label, sub: t.sub, accent: t.accent, tool: t.action }));
    ALL_CATEGORIES.forEach((c) => out.push({ kind: "category", id: c.id, label: c.label, sub: c.sub, tool: c.tool, category: c }));
    SIZE_PRESETS.forEach((p) => {
      const tool = toolForPreset(p.id);
      out.push({
        kind: "size",
        id: p.id,
        label: p.label,
        sub: `${p.w} × ${p.h} ${p.units}${p.platform ? ` · ${p.platform}` : ""}`,
        tool,
      });
    });
    QUOTE_TEMPLATES.forEach((t) => out.push({ kind: "template", id: t.id, label: `Quote · ${t.label}`, sub: t.sub }));
    EVENT_ROSTER.forEach((e) => out.push({ kind: "event", id: e.id, label: `Event · ${e.label}`, sub: `${e.sub} · ${e.category}` }));
    projects.forEach((p) => out.push({ kind: "project", id: p.id, label: `Open · ${p.name}`, sub: p.updated_at ? new Date(p.updated_at).toLocaleString() : "" }));
    return out;
  }, [projects]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as SearchItem[];
    const tokens = q.split(/\s+/).filter(Boolean);
    const scored: Array<{ item: SearchItem; score: number }> = [];
    const kindWeight: Record<SearchItem["kind"], number> = { tile: 1, category: 2, template: 3, event: 4, project: 5, size: 6 };
    corpus.forEach((item) => {
      const hay = (item.label + " " + item.sub).toLowerCase();
      const labelLc = item.label.toLowerCase();
      let matched = true;
      let score = kindWeight[item.kind] * 100;
      for (const tok of tokens) {
        const idx = hay.indexOf(tok);
        if (idx < 0) { matched = false; break; }
        // Earlier matches are better; label matches beat sub matches.
        const labelIdx = labelLc.indexOf(tok);
        score += (labelIdx >= 0 ? labelIdx : 50 + idx);
        if (labelLc.startsWith(tok)) score -= 40;
      }
      if (matched) scored.push({ item, score });
    });
    scored.sort((a, b) => a.score - b.score);
    return scored.slice(0, 12).map((s) => s.item);
  }, [query, corpus]);

  useEffect(() => { setActiveIdx(0); }, [query]);

  function pickResult(item: SearchItem) {
    setQuery("");
    setFocused(false);
    if (item.kind === "tile") {
      openTool(item.tool);
    } else if (item.kind === "category") {
      openTool(item.tool, { categoryId: item.id, presetId: item.category.defaultPreset });
    } else if (item.kind === "size") {
      const cId = categoryForPreset(item.id, item.tool);
      if (item.tool === "motion") openTool("motion", { presetId: item.id });
      else openTool(item.tool, { categoryId: cId, presetId: item.id });
    } else if (item.kind === "template") {
      openTool("quote", { templateId: item.id, categoryId: "quote-card", presetId: "ig-square" });
    } else if (item.kind === "event") {
      openTool("event", { eventId: item.id });
    } else if (item.kind === "project") {
      router.push(`/design-studio/p/${item.id}`);
    }
  }

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(results.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") {
      if (results[activeIdx]) { e.preventDefault(); pickResult(results[activeIdx]); }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setQuery("");
      searchRef.current?.blur();
      setFocused(false);
    }
  }

  async function createProject(type: "document" | "other") {
    const name = await prompt({
      title: type === "document" ? "New document" : "New custom canvas",
      body: "Project name",
      placeholder: type === "document" ? "Blackwell yields one-pager" : "TSMC capex poster",
      cta: "Create",
    });
    if (!name) return;
    const res = await fetch("/api/docu-design/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type, fidelity: "high" }),
    });
    const j = await res.json();
    if (!res.ok) {
      toast(j.error || "Failed to create project");
      return;
    }
    router.push(`/design-studio/p/${j.data.id}`);
  }

  function onTile(t: StudioTile) {
    if (t.status === "soon") {
      toast(`${t.label} ships in the next phase. Stay tuned.`);
      return;
    }
    if (t.action === "doc") setDocWizardOpen(true);
    else if (t.action === "graphic") setGraphicWizardOpen(true);
    else if (t.action === "image") setImageWizardOpen(true);
    else if (t.action === "motion") setMotionWizardOpen(true);
    else if (t.action === "programmatic") setProgrammaticWizardOpen(true);
    else if (t.action === "quote") setQuoteWizardOpen(true);
    else if (t.action === "event") setEventWizardOpen(true);
    else if (t.action === "custom") createProject("other");
  }

  async function deleteProject(p: ProjectSummary) {
    const ok = await confirm({
      title: "Delete project?",
      body: `"${p.name}" will be removed permanently.`,
      cta: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/docu-design/projects?id=${encodeURIComponent(p.id)}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast(j.error || "Delete failed");
      return;
    }
    setProjects((cur) => cur.filter((x) => x.id !== p.id));
    toast("Project deleted");
  }

  return (
    <DocuShell
      hideNav
      rightSlot={
        <Link href="/design-studio/system" style={ghostLink}>
          ⚙ Design system
        </Link>
      }
    >
      <div style={{ padding: "40px 32px 64px", maxWidth: 1280, margin: "0 auto", position: "relative", zIndex: 2 }}>
        {/* Hero */}
        <div style={{ marginBottom: 36 }}>
          <style
            dangerouslySetInnerHTML={{
              __html:
                "@keyframes dsShim{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}.ds-headline{background:linear-gradient(120deg,#F7B041 0%,#26C9D8 50%,#F7B041 100%);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:dsShim 9s ease-in-out infinite}",
            }}
          />
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 10px", borderRadius: 999, background: "rgba(247,176,65,0.10)", border: `1px solid ${D.amber}55`, marginBottom: 14 }}>
            <Wand size={13} color={D.amber} strokeWidth={2} />
            <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.amber, textTransform: "uppercase" }}>The studio</span>
          </div>
          <h1
            className="ds-headline"
            style={{ fontFamily: gf, fontSize: 56, lineHeight: 1.02, letterSpacing: -1.5, margin: 0, marginBottom: 12, fontWeight: 900 }}
          >
            Design anything.
          </h1>
          <div style={{ fontFamily: ft, fontSize: 16, color: D.txm, maxWidth: 620, lineHeight: 1.5 }}>
            Docs, graphics, AI images, motion, programmatic video — eight tools, one design system, zero context-switching.
          </div>
        </div>

        {/* ── Search bar ─────────────────────────────────────── */}
        <div style={{ marginBottom: 28, position: "relative", zIndex: 5 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: D.card,
              border: `1px solid ${focused ? D.amber : D.border}`,
              borderRadius: 12,
              padding: "10px 14px",
              boxShadow: focused ? `0 0 0 3px ${D.amber}1a` : "0 2px 8px rgba(0,0,0,0.18)",
              transition: "border-color 140ms, box-shadow 140ms",
            }}
          >
            <Search size={16} color={focused ? D.amber : D.txm} strokeWidth={2} />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              onKeyDown={onSearchKeyDown}
              placeholder='Search anything — try "instagram story", "AWS re:Invent", "quote card", "one-pager"…'
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: D.tx,
                fontFamily: ft,
                fontSize: 15,
                letterSpacing: 0.1,
              }}
            />
            <span
              style={{
                fontFamily: mn,
                fontSize: 10,
                letterSpacing: 0.6,
                color: D.txd,
                padding: "2px 6px",
                border: `1px solid ${D.border}`,
                borderRadius: 4,
              }}
            >
              ⌘K
            </span>
          </div>

          {focused && results.length > 0 ? (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                right: 0,
                background: D.card,
                border: `1px solid ${D.border}`,
                borderRadius: 12,
                boxShadow: "0 18px 50px -16px rgba(0,0,0,0.7)",
                maxHeight: 460,
                overflowY: "auto",
                zIndex: 10,
              }}
            >
              {results.map((r, i) => {
                const active = i === activeIdx;
                const k = r.kind;
                return (
                  <button
                    type="button"
                    key={`${k}-${r.id}-${i}`}
                    onMouseDown={(e) => { e.preventDefault(); pickResult(r); }}
                    onMouseEnter={() => setActiveIdx(i)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 14px",
                      background: active ? "rgba(247,176,65,0.08)" : "transparent",
                      border: "none",
                      borderBottom: i < results.length - 1 ? `1px solid ${D.border}` : "none",
                      textAlign: "left",
                      cursor: "pointer",
                      fontFamily: ft,
                      color: D.tx,
                    }}
                  >
                    <span style={kindBadge(k)}>{kindLabel(k)}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: gf, fontSize: 14, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.label}
                      </div>
                      {r.sub ? (
                        <div style={{ fontFamily: mn, fontSize: 11, color: D.txm, marginTop: 2, letterSpacing: 0.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.sub}
                        </div>
                      ) : null}
                    </span>
                    {"tool" in r ? (
                      <span style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.8, textTransform: "uppercase" }}>
                        {toolDisplay(r.tool)}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          {focused && query.trim() && results.length === 0 ? (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                right: 0,
                background: D.card,
                border: `1px solid ${D.border}`,
                borderRadius: 12,
                padding: "14px 16px",
                fontFamily: ft,
                fontSize: 13,
                color: D.txm,
                zIndex: 10,
              }}
            >
              No matches. Try a platform name (LinkedIn, Instagram), a category (one-pager, flyer), an event (AWS re:Invent), or a tile name.
            </div>
          ) : null}
        </div>

        {tablesMissing ? (
          <div style={tablesMissingBox}>
            <div style={{ fontFamily: gf, fontSize: 18, marginBottom: 8 }}>Supabase tables missing</div>
            <div style={{ color: D.txm, lineHeight: 1.5, fontSize: 13 }}>
              DesignStudio needs two tables: <code style={code}>docu_design_systems</code> and{" "}
              <code style={code}>docu_projects</code>. Create them in your Supabase dashboard, then refresh.
            </div>
          </div>
        ) : null}

        {/* Tile grid */}
        <div style={{ marginBottom: 36 }}>
          <div style={sectionLabel}>Create something</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
            }}
          >
            {TILES.map((t) => {
              const isHover = hovered === t.id;
              const isSoon = t.status === "soon";
              return (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => onTile(t)}
                  onMouseEnter={() => setHovered(t.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    ...tileStyle,
                    borderColor: isHover ? t.accent : D.border,
                    boxShadow: isHover
                      ? `0 0 0 1px ${t.accent}33, 0 10px 30px -12px ${t.accent}55`
                      : "0 2px 8px rgba(0,0,0,0.18)",
                    transform: isHover ? "translateY(-2px)" : "translateY(0)",
                    opacity: isSoon ? 0.78 : 1,
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: `${t.accent}1c`,
                      border: `1px solid ${t.accent}55`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 12,
                    }}
                  >
                    <t.Icon size={18} color={t.accent} strokeWidth={1.8} />
                  </div>
                  <div style={{ fontFamily: gf, fontSize: 15, color: D.tx, marginBottom: 4 }}>
                    {t.label}
                    {isSoon ? (
                      <span style={soonBadge}>Soon</span>
                    ) : null}
                  </div>
                  <div style={{ fontFamily: ft, fontSize: 12, color: D.txm, lineHeight: 1.4 }}>
                    {t.sub}
                  </div>
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 10, fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.6 }}>
            Video timeline editor will return with the Press-to-Premier revamp.
          </div>
        </div>

        {/* Recent projects */}
        <div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={sectionLabel}>Recent projects</div>
            <div style={{ color: D.txd, fontFamily: mn, fontSize: 11 }}>
              {loading ? "loading…" : `${projects.length} total`}
            </div>
          </div>

          {!loading && projects.length === 0 && !tablesMissing ? (
            <div style={emptyBox}>
              <div style={{ fontFamily: gf, fontSize: 16, marginBottom: 6 }}>No projects yet</div>
              <div style={{ color: D.txm, lineHeight: 1.5, fontSize: 13 }}>
                Pick a tile above to start something. Documents and Custom canvas are wired in — the rest ship over the next few phases.
              </div>
            </div>
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 12,
            }}
          >
            {projects.slice(0, 12).map((p) => (
              <div key={p.id} style={projectCard}>
                <Link
                  href={`/design-studio/p/${p.id}`}
                  style={{ textDecoration: "none", color: "inherit", flex: 1, padding: 14 }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={typePill(p.type)}>{p.type === "document" ? "DOC" : "GFX"}</div>
                    {p.fidelity === "wireframe" ? <div style={fidelityPill}>WIREFRAME</div> : null}
                  </div>
                  <div style={{ fontFamily: gf, fontSize: 15, marginBottom: 4, color: D.tx, lineHeight: 1.25 }}>
                    {p.name}
                  </div>
                  <div style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>
                    {p.updated_at ? new Date(p.updated_at).toLocaleString() : ""}
                  </div>
                </Link>
                <div style={{ borderTop: `1px solid ${D.border}`, padding: "6px 14px", display: "flex", justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => deleteProject(p)} style={dangerBtn}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Wizards take a `key` that includes their open state and any
          preselection — when those change, React remounts the wizard so its
          useState initializers re-read the new initial values. */}
      <DocumentWizard
        key={`doc-${docWizardOpen}-${pick.doc?.categoryId ?? ""}-${pick.doc?.presetId ?? ""}`}
        open={docWizardOpen}
        onClose={() => { setDocWizardOpen(false); setPick((p) => ({ ...p, doc: undefined })); }}
        initialCategoryId={pick.doc?.categoryId}
        initialPresetId={pick.doc?.presetId}
      />
      <GraphicWizard
        key={`graphic-${graphicWizardOpen}-${pick.graphic?.categoryId ?? ""}-${pick.graphic?.presetId ?? ""}`}
        open={graphicWizardOpen}
        onClose={() => { setGraphicWizardOpen(false); setPick((p) => ({ ...p, graphic: undefined })); }}
        initialCategoryId={pick.graphic?.categoryId}
        initialPresetId={pick.graphic?.presetId}
      />
      <ImageWizard
        key={`image-${imageWizardOpen}-${pick.image?.categoryId ?? ""}-${pick.image?.presetId ?? ""}`}
        open={imageWizardOpen}
        onClose={() => { setImageWizardOpen(false); setPick((p) => ({ ...p, image: undefined })); }}
        initialCategoryId={pick.image?.categoryId}
        initialPresetId={pick.image?.presetId}
      />
      <MotionWizard
        key={`motion-${motionWizardOpen}-${pick.motion?.presetId ?? ""}`}
        open={motionWizardOpen}
        onClose={() => { setMotionWizardOpen(false); setPick((p) => ({ ...p, motion: undefined })); }}
        initialPresetId={pick.motion?.presetId}
      />
      <ProgrammaticWizard
        key={`prog-${programmaticWizardOpen}-${pick.programmatic?.compId ?? ""}`}
        open={programmaticWizardOpen}
        onClose={() => { setProgrammaticWizardOpen(false); setPick((p) => ({ ...p, programmatic: undefined })); }}
        initialCompId={pick.programmatic?.compId}
      />
      <QuoteWizard
        key={`quote-${quoteWizardOpen}-${pick.quote?.categoryId ?? ""}-${pick.quote?.presetId ?? ""}-${pick.quote?.templateId ?? ""}`}
        open={quoteWizardOpen}
        onClose={() => { setQuoteWizardOpen(false); setPick((p) => ({ ...p, quote: undefined })); }}
        initialCategoryId={pick.quote?.categoryId}
        initialPresetId={pick.quote?.presetId}
        initialTemplateId={pick.quote?.templateId}
      />
      <EventWizard
        key={`event-${eventWizardOpen}-${pick.event?.eventId ?? ""}-${pick.event?.categoryId ?? ""}-${pick.event?.presetId ?? ""}`}
        open={eventWizardOpen}
        onClose={() => { setEventWizardOpen(false); setPick((p) => ({ ...p, event: undefined })); }}
        initialEventId={pick.event?.eventId}
        initialCategoryId={pick.event?.categoryId}
        initialPresetId={pick.event?.presetId}
      />
    </DocuShell>
  );
}

const tileStyle: React.CSSProperties = {
  background: D.card,
  border: `1px solid ${D.border}`,
  borderRadius: 14,
  padding: "18px 16px 16px",
  textAlign: "left",
  cursor: "pointer",
  transition: "transform 140ms ease, box-shadow 160ms ease, border-color 160ms ease",
  fontFamily: ft,
  color: D.tx,
};

const sectionLabel: React.CSSProperties = {
  fontFamily: mn,
  fontSize: 11,
  letterSpacing: 1.4,
  textTransform: "uppercase",
  color: D.txd,
  marginBottom: 12,
};

const soonBadge: React.CSSProperties = {
  fontFamily: mn,
  fontSize: 9,
  letterSpacing: 0.8,
  padding: "1px 6px",
  borderRadius: 4,
  background: "rgba(255,255,255,0.06)",
  color: D.txd,
  border: `1px solid ${D.border}`,
  marginLeft: 8,
  textTransform: "uppercase",
  verticalAlign: "middle",
};

const ghostLink: React.CSSProperties = {
  fontFamily: mn,
  fontSize: 11,
  letterSpacing: 0.4,
  color: D.txm,
  textDecoration: "none",
  padding: "6px 10px",
  border: `1px solid ${D.border}`,
  borderRadius: 6,
};

const dangerBtn: React.CSSProperties = {
  background: "transparent",
  color: D.coral,
  border: `1px solid ${D.border}`,
  padding: "4px 10px",
  borderRadius: 6,
  fontFamily: mn,
  fontSize: 11,
  cursor: "pointer",
};

const projectCard: React.CSSProperties = {
  background: D.card,
  border: `1px solid ${D.border}`,
  borderRadius: 12,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const emptyBox: React.CSSProperties = {
  border: `1px dashed ${D.border}`,
  borderRadius: 12,
  padding: 24,
  background: D.surface,
  marginBottom: 16,
};

const tablesMissingBox: React.CSSProperties = {
  border: `1px solid ${D.coral}`,
  background: "rgba(224,99,71,0.06)",
  borderRadius: 12,
  padding: 20,
  marginBottom: 24,
};

const code: React.CSSProperties = {
  fontFamily: mn,
  fontSize: 12,
  background: D.surface,
  padding: "1px 6px",
  borderRadius: 4,
};

const KIND_COLORS: Record<string, string> = {
  tile: D.amber,
  category: D.blue,
  size: D.cyan,
  template: D.coral,
  event: D.crimson,
  project: D.txm,
};

function kindLabel(k: string): string {
  if (k === "tile") return "TOOL";
  if (k === "category") return "TYPE";
  if (k === "size") return "SIZE";
  if (k === "template") return "TEMPLATE";
  if (k === "event") return "EVENT";
  if (k === "project") return "PROJECT";
  return k.toUpperCase();
}

function kindBadge(k: string): React.CSSProperties {
  const c = KIND_COLORS[k] || D.txm;
  return {
    fontFamily: mn,
    fontSize: 9,
    letterSpacing: 0.8,
    padding: "2px 7px",
    borderRadius: 4,
    background: `${c}1a`,
    color: c,
    border: `1px solid ${c}55`,
    minWidth: 60,
    textAlign: "center",
    flexShrink: 0,
  };
}

function toolDisplay(t: StudioTool): string {
  if (t === "doc") return "DocuDesign";
  if (t === "graphic") return "Graphics";
  if (t === "image") return "Image Studio";
  if (t === "motion") return "Motion";
  if (t === "programmatic") return "Programmatic";
  if (t === "quote") return "Quote";
  if (t === "event") return "Event";
  return "Custom";
}

function typePill(type: "document" | "other"): React.CSSProperties {
  return {
    fontFamily: mn,
    fontSize: 10,
    letterSpacing: 0.6,
    padding: "2px 6px",
    borderRadius: 4,
    background: type === "document" ? "rgba(11,134,209,0.15)" : "rgba(247,176,65,0.15)",
    color: type === "document" ? D.blue : D.amber,
    border: `1px solid ${type === "document" ? D.blue : D.amber}`,
  };
}

const fidelityPill: React.CSSProperties = {
  fontFamily: mn,
  fontSize: 10,
  letterSpacing: 0.6,
  padding: "2px 6px",
  borderRadius: 4,
  background: D.surface,
  color: D.txm,
  border: `1px solid ${D.border}`,
};
