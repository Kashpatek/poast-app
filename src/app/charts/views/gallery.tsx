"use client";

// Gallery view · pick a starter template for the chosen doc type.
//
// Chart: one tile per ChartType (18 of them). Placeholder previews until
// Checkpoint 2 wires in samplePerType-driven thumbnails.
// Table: 3 starter shapes.
// Diagram: 3 starter shapes.

import { ArrowLeft } from "lucide-react";
import SaTableSvg from "../lib/sa-table-svg";
import { templateById as tableTemplateById, TABLE_TEMPLATES as TABLE_SEEDS } from "../lib/table-templates";
import { D, ft, gf, mn } from "../studio-theme";
import { DocType } from "../studio-types";

export interface GalleryTemplate {
  id: string;
  label: string;
  subtitle?: string;
  accent: string;
  // Inline preview (for placeholder tiles). Replaced by real renderings
  // in Checkpoint 2 when ChartMaker2 exports a thumbnail renderer.
  glyph?: string;
}

const CHART_TEMPLATES: GalleryTemplate[] = [
  { id: "stacked",        label: "Stacked",       accent: "#F7B041", glyph: "▮▮▮" },
  { id: "stackedPosNeg",  label: "Stacked +/−",   accent: "#F7B041", glyph: "▮▯▮" },
  { id: "pct",            label: "100%",          accent: "#F7B041", glyph: "▮▮▮" },
  { id: "clustered",      label: "Clustered",     accent: "#F7B041", glyph: "▍▍▍" },
  { id: "wfup",           label: "Waterfall ↑",   accent: "#F7B041", glyph: "▁▃▅▇" },
  { id: "wfdn",           label: "Waterfall ↓",   accent: "#F7B041", glyph: "▇▅▃▁" },
  { id: "variance",       label: "Variance",      accent: "#E06347", glyph: "▮Δ▮" },
  { id: "combo",          label: "Combo",         accent: "#0B86D1", glyph: "▮~▮" },
  { id: "line",           label: "Line",          accent: "#0B86D1", glyph: "╱╲╱" },
  { id: "stackedArea",    label: "Stacked Area",  accent: "#0B86D1", glyph: "▼▼▼" },
  { id: "pctArea",        label: "100% Area",     accent: "#0B86D1", glyph: "▼▼▼" },
  { id: "scatter",        label: "Scatter",       accent: "#E06347", glyph: "·∘·" },
  { id: "bubble",         label: "Bubble",        accent: "#E06347", glyph: "○●○" },
  { id: "pie",            label: "Pie",           accent: "#2EAD8E", glyph: "◐" },
  { id: "doughnut",       label: "Doughnut",      accent: "#2EAD8E", glyph: "◯" },
  { id: "mekkoPct",       label: "Mekko %",       accent: "#2EAD8E", glyph: "▦" },
  { id: "mekkoUnit",      label: "Mekko Unit",    accent: "#2EAD8E", glyph: "▩" },
  { id: "gantt",          label: "Gantt",         accent: "#905CCB", glyph: "▭▬▭" },
];

// Table templates are sourced from lib/table-templates so the Gallery
// stays in sync with the seed payloads used by editor-table on mount.
const TABLE_TEMPLATES: GalleryTemplate[] = TABLE_SEEDS.map((t) => ({
  id: t.id, label: t.label, subtitle: t.blurb, accent: t.accent, glyph: t.glyph,
}));

const DIAGRAM_TEMPLATES: GalleryTemplate[] = [
  { id: "blank",           label: "Blank canvas",   subtitle: "Empty board, drop any shape",    accent: "#0B86D1", glyph: "◇" },
  { id: "flowchart",       label: "Flowchart",      subtitle: "Start + decision + 2 branches",  accent: "#0B86D1", glyph: "→" },
  { id: "wireframe",       label: "Wireframe",      subtitle: "Header + body + footer blocks",  accent: "#F7B041", glyph: "▢" },
  { id: "timeline-nodes",  label: "Timeline",       subtitle: "8 era nodes w/ labels above/below", accent: "#F7B041", glyph: "◯─◯" },
  { id: "before-after",    label: "Before / After", subtitle: "Two stacked horizontal flows",   accent: "#F7B041", glyph: "⇄" },
  { id: "topology",        label: "Topology",       subtitle: "Hub + 6 spokes",                  accent: "#2EAD8E", glyph: "✦" },
  { id: "swimlane",        label: "Swimlane",       subtitle: "3 lanes w/ process flow",         accent: "#2EAD8E", glyph: "▤" },
  { id: "segment-ladder",  label: "Tier ladder",    subtitle: "Stacked colored tiers infographic", accent: "#905CCB", glyph: "▬▬▬" },
  { id: "architecture",    label: "Architecture",   subtitle: "4 stacked blocks w/ sidecar",     accent: "#0B86D1", glyph: "▭▭▭" },
  { id: "mindmap",         label: "Mind map",       subtitle: "Central node + 3 branches × 2",   accent: "#F7B041", glyph: "✺" },
  { id: "sequence",        label: "Sequence",       subtitle: "4 lifelines + horizontal messages", accent: "#0B86D1", glyph: "═══" },
];

function templatesFor(type: DocType): GalleryTemplate[] {
  if (type === "chart")   return CHART_TEMPLATES;
  if (type === "table")   return TABLE_TEMPLATES;
  return DIAGRAM_TEMPLATES;
}

export default function GalleryView({
  type, onPick, onBack,
}: {
  type: DocType;
  onPick: (templateId: string) => void;
  onBack: () => void;
}) {
  const tpls = templatesFor(type);
  const heading = type === "chart" ? "Pick a chart" : type === "table" ? "Pick a table" : "Pick a diagram";
  // Table tiles render a real SaTableSvg snapshot at thumb size; chart and
  // diagram fall back to the placeholder glyph until those renderers are
  // standalone-callable.
  const widerTiles = type === "table";
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "36px 28px 80px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 26 }}>
        <button
          onClick={onBack}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "7px 12px",
            background: "transparent", border: "1px solid " + D.border,
            color: D.txm, fontFamily: mn, fontSize: 10.5, fontWeight: 700,
            letterSpacing: 0.5, borderRadius: 7,
            cursor: "pointer",
          }}
        ><ArrowLeft size={11} strokeWidth={2.4} /> back</button>
        <div>
          <div style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 1.5, fontWeight: 700, textTransform: "uppercase" }}>
            New {type}
          </div>
          <h2 style={{ fontFamily: gf, fontSize: 26, fontWeight: 900, color: D.tx, letterSpacing: -0.6, margin: 0 }}>{heading}</h2>
        </div>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: widerTiles
          ? "repeat(auto-fill, minmax(280px, 1fr))"
          : "repeat(auto-fill, minmax(190px, 1fr))",
        gap: 14,
      }}>
        {tpls.map((t) => <TemplateTile key={t.id} tpl={t} type={type} onClick={() => onPick(t.id)} />)}
      </div>
    </div>
  );
}

function TemplateTile({ tpl, type, onClick }: { tpl: GalleryTemplate; type: DocType; onClick: () => void }) {
  // Tables get a real SaTableSvg thumbnail rendered from the same
  // payload the editor opens to — what you click is what you'll see.
  const tableSeed = type === "table" ? tableTemplateById(tpl.id) : null;
  const tableBuilt = tableSeed?.build();
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: 0,
        background: D.card, border: "1px solid " + D.border,
        borderRadius: 12, overflow: "hidden",
        cursor: "pointer",
        transition: "border-color 0.14s, transform 0.14s, box-shadow 0.14s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = tpl.accent + "66";
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 12px 28px rgba(0,0,0,0.45), 0 0 0 1px " + tpl.accent + "33";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = D.border;
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{
        height: tableBuilt ? 160 : 120,
        background: "linear-gradient(135deg, " + D.bg + ", " + D.surface + ")",
        borderBottom: "1px solid " + D.border,
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative", overflow: "hidden",
      }}>
        {tableBuilt ? (
          <div style={{ position: "absolute", inset: 0 }}>
            <SaTableSvg
              mode={tableBuilt.mode || "data"}
              sheet={tableBuilt.sheet}
              category={tableBuilt.category}
              titleWhite={tableBuilt.titleWhite}
              titleAmber={tableBuilt.titleAmber}
              subtitle={tableBuilt.subtitle}
              titleBar={tableBuilt.titleBar}
              highlightRowIdx={tableBuilt.highlightRowIdx}
              highlightFlagCol={tableBuilt.highlightFlagCol}
              keyInsight={tableBuilt.keyInsight}
              threshold={tableBuilt.threshold}
              yellowBand={tableBuilt.yellowBand}
              topAxisLabel={tableBuilt.topAxisLabel}
              leftAxisLabel={tableBuilt.leftAxisLabel}
              baselineRow={tableBuilt.baselineRow}
              baselineCol={tableBuilt.baselineCol}
              panelKind={tableBuilt.panelKind}
              panelItems={tableBuilt.panelItems}
              formula={tableBuilt.formula}
              formulaBaseline={tableBuilt.formulaBaseline}
              formulaResult={tableBuilt.formulaResult}
            />
          </div>
        ) : (
          <>
            <div style={{
              position: "absolute", inset: 0,
              background: "radial-gradient(circle at 70% 30%, " + tpl.accent + "22, transparent 60%)",
              pointerEvents: "none",
            }} />
            <span style={{
              position: "relative",
              fontFamily: mn, fontSize: 24, fontWeight: 800,
              color: tpl.accent, letterSpacing: 1.5, opacity: 0.85,
            }}>{tpl.glyph || "·"}</span>
          </>
        )}
      </div>
      <div style={{ padding: "10px 12px" }}>
        <div style={{
          fontFamily: ft, fontSize: 13, fontWeight: 700, color: D.tx,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{tpl.label}</div>
        {tpl.subtitle && (
          <div style={{
            fontFamily: mn, fontSize: 9.5, color: D.txd, marginTop: 3, letterSpacing: 0.3,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{tpl.subtitle}</div>
        )}
      </div>
    </button>
  );
}
