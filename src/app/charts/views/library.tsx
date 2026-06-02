"use client";

// Library view · grid of saved docs. Filter by type, sort by recent, click
// to open. Hover-reveal actions for rename / duplicate / delete.

import { Plus, Trash2, Copy, Pencil } from "lucide-react";
import { useState, useMemo } from "react";
import { D, ft, gf, mn } from "../studio-theme";
import { DocType, StudioDoc } from "../studio-types";

type Filter = "all" | DocType;
type Sort = "recent" | "name" | "type";

export default function LibraryView({
  docs, onOpen, onNew, onRename, onDuplicate, onDelete,
}: {
  docs: StudioDoc[];
  onOpen: (id: string) => void;
  onNew: () => void;
  onRename: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("recent");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    let list = docs.slice();
    if (filter !== "all") list = list.filter((d) => d.type === filter);
    if (qq) list = list.filter((d) => d.name.toLowerCase().includes(qq));
    if (sort === "recent") list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (sort === "name")   list.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "type")   list.sort((a, b) => a.type.localeCompare(b.type) || b.updatedAt.localeCompare(a.updatedAt));
    return list;
  }, [docs, filter, sort, q]);

  const counts = useMemo(() => ({
    all:     docs.length,
    chart:   docs.filter((d) => d.type === "chart").length,
    table:   docs.filter((d) => d.type === "table").length,
    diagram: docs.filter((d) => d.type === "diagram").length,
  }), [docs]);

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 28px 100px" }}>
      <div style={{ display: "flex", alignItems: "baseline", marginBottom: 22 }}>
        <h2 style={{ fontFamily: gf, fontSize: 26, fontWeight: 900, color: D.tx, letterSpacing: -0.6, margin: 0 }}>
          Library
        </h2>
        <span style={{ marginLeft: 12, fontFamily: mn, fontSize: 11, color: D.txm, letterSpacing: 0.5 }}>
          {docs.length} doc{docs.length === 1 ? "" : "s"}
        </span>
        <button
          onClick={onNew}
          style={{
            marginLeft: "auto",
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "8px 16px",
            background: "linear-gradient(135deg, " + D.amber + ", " + D.coral + ")",
            color: "#0A0A0F", border: "none", borderRadius: 9,
            fontFamily: ft, fontSize: 13, fontWeight: 700, letterSpacing: 0.3,
            cursor: "pointer",
            boxShadow: "0 6px 18px rgba(247,176,65,0.25)",
          }}
        ><Plus size={13} strokeWidth={2.4} /> New</button>
      </div>

      <div style={{
        display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10,
        padding: "10px 14px",
        background: D.card, border: "1px solid " + D.border, borderRadius: 11,
        marginBottom: 18,
      }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search documents…"
          style={{
            flex: 1, minWidth: 200,
            background: "transparent", border: "none", outline: "none",
            color: D.tx, fontFamily: ft, fontSize: 13.5,
          }}
        />
        <FilterChips
          options={[
            { id: "all",     label: "All",      n: counts.all },
            { id: "chart",   label: "Charts",   n: counts.chart },
            { id: "table",   label: "Tables",   n: counts.table },
            { id: "diagram", label: "Diagrams", n: counts.diagram },
          ]}
          value={filter}
          onChange={(v) => setFilter(v as Filter)}
        />
        <span style={{ width: 1, height: 18, background: D.border, margin: "0 4px" }} />
        <SortPicker value={sort} onChange={setSort} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState onNew={onNew} hasAny={docs.length > 0} />
      ) : filter !== "all" ? (
        // Single-type filter — render one flat grid.
        <CardGrid
          docs={filtered}
          onOpen={onOpen}
          onRename={onRename}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      ) : (
        // "All" filter — render one section per type so the library
        // reads as Charts / Tables / Diagrams instead of one mixed grid.
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {(["chart", "table", "diagram"] as DocType[]).map((t) => {
            const inType = filtered.filter(d => d.type === t);
            if (inType.length === 0) return null;
            return (
              <section key={t}>
                <SectionHeader type={t} count={inType.length} />
                <CardGrid
                  docs={inType}
                  onOpen={onOpen}
                  onRename={onRename}
                  onDuplicate={onDuplicate}
                  onDelete={onDelete}
                />
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CardGrid({ docs, onOpen, onRename, onDuplicate, onDelete }: {
  docs: StudioDoc[];
  onOpen: (id: string) => void;
  onRename: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
      gap: 14,
    }}>
      {docs.map((d) => (
        <LibraryCard
          key={d.id}
          doc={d}
          onOpen={() => onOpen(d.id)}
          onRename={() => onRename(d.id)}
          onDuplicate={() => onDuplicate(d.id)}
          onDelete={() => onDelete(d.id)}
        />
      ))}
    </div>
  );
}

function SectionHeader({ type, count }: { type: DocType; count: number }) {
  const color = typeColorFor(type);
  const label = type === "chart" ? "Charts" : type === "table" ? "Tables" : "Diagrams";
  const sub =
    type === "chart"   ? "Bars, lines, scatter, gantt — the SemiAnalysis chart set." :
    type === "table"   ? "Branded SA tables + heatmaps with full SVG / PNG / JPEG export." :
                         "Wireframes, flowcharts, circuit diagrams.";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      paddingBottom: 10, marginBottom: 12,
      borderBottom: "1px solid " + D.border,
    }}>
      <div style={{
        width: 6, height: 6, borderRadius: 999, background: color,
        boxShadow: "0 0 12px " + color + "88",
      }} />
      <div>
        <div style={{ fontFamily: gf, fontSize: 16, fontWeight: 900, color: D.tx, letterSpacing: -0.2 }}>
          {label} <span style={{ color: D.txd, fontWeight: 700 }}>{count}</span>
        </div>
        <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4, marginTop: 1 }}>
          {sub}
        </div>
      </div>
    </div>
  );
}

function typeColorFor(t: DocType): string {
  if (t === "chart") return D.amber;
  if (t === "table") return D.teal;
  return D.blue;
}

// Two-character initials extracted from a doc name. First letter of the
// first two words wins so "FY26 KPI Snapshot" → "FK" and "G1 Fleet
// Math" → "GF"; falls back to the first two chars when there's only
// one word.
function docInitials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return "··";
  const words = cleaned.split(/[\s·•|]+/).filter(Boolean);
  if (words.length === 0) return cleaned.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function FilterChips({ options, value, onChange }: {
  options: { id: string; label: string; n: number }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "inline-flex", gap: 4 }}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            style={{
              padding: "5px 10px",
              background: active ? D.amber + "22" : "transparent",
              border: "1px solid " + (active ? D.amber + "55" : "transparent"),
              color: active ? D.amber : D.txm,
              fontFamily: mn, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4,
              borderRadius: 6, cursor: "pointer",
            }}
          >{o.label} <span style={{ color: active ? D.amber : D.txd, marginLeft: 3 }}>{o.n}</span></button>
        );
      })}
    </div>
  );
}

function SortPicker({ value, onChange }: { value: Sort; onChange: (s: Sort) => void }) {
  const opts: { id: Sort; label: string }[] = [
    { id: "recent", label: "Recent" },
    { id: "name",   label: "Name" },
    { id: "type",   label: "Type" },
  ];
  return (
    <div style={{ display: "inline-flex", gap: 2 }}>
      <span style={{ fontFamily: mn, fontSize: 9.5, color: D.txd, letterSpacing: 0.6, padding: "5px 4px", textTransform: "uppercase" }}>sort</span>
      {opts.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            style={{
              padding: "5px 8px",
              background: on ? D.amber : "transparent",
              color: on ? "#0A0A0F" : D.txm,
              border: "none", borderRadius: 5,
              fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 0.4,
              cursor: "pointer",
            }}
          >{o.label}</button>
        );
      })}
    </div>
  );
}

function LibraryCard({ doc, onOpen, onRename, onDuplicate, onDelete }: {
  doc: StudioDoc;
  onOpen: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const typeColor = typeColorFor(doc.type);
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: D.card, border: "1px solid " + D.border,
        borderRadius: 12, overflow: "hidden",
        transition: "border-color 0.14s, transform 0.14s, box-shadow 0.14s",
        transform: hover ? "translateY(-2px)" : "translateY(0)",
        borderColor: hover ? typeColor + "66" : D.border,
        boxShadow: hover ? "0 12px 28px rgba(0,0,0,0.45)" : "none",
        position: "relative",
      }}
    >
      <button
        onClick={onOpen}
        title="Open"
        style={{
          all: "unset", display: "block", width: "100%",
          cursor: "pointer", textAlign: "left",
        }}
      >
        {doc.thumbnail ? (
          <div style={{
            height: 130,
            background: D.bg,
            backgroundImage: `url(${doc.thumbnail})`,
            backgroundSize: "cover", backgroundPosition: "center",
            borderBottom: "1px solid " + D.border,
          }} />
        ) : (
          <InitialsTile name={doc.name} accent={typeColor} />
        )}
        <div style={{ padding: "10px 12px" }}>
          <div style={{
            fontFamily: ft, fontSize: 13, fontWeight: 700, color: D.tx,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{doc.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
            <span style={{
              fontFamily: mn, fontSize: 9, fontWeight: 700, color: typeColor,
              letterSpacing: 0.6, textTransform: "uppercase",
            }}>{doc.type}</span>
            <span style={{ fontFamily: mn, fontSize: 9.5, color: D.txd }}>· {fmtRelative(doc.updatedAt)}</span>
          </div>
        </div>
      </button>
      {hover && (
        <div style={{
          position: "absolute", top: 8, right: 8,
          display: "inline-flex", gap: 3,
          padding: 3,
          background: "rgba(13,13,18,0.92)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 7,
          zIndex: 2,
        }}>
          <ActionIcon Icon={Pencil}     title="Rename"    onClick={(e) => { e.stopPropagation(); onRename(); }} />
          <ActionIcon Icon={Copy}       title="Duplicate" onClick={(e) => { e.stopPropagation(); onDuplicate(); }} />
          <ActionIcon Icon={Trash2}     title="Delete"    onClick={(e) => { e.stopPropagation(); onDelete(); }} danger />
        </div>
      )}
    </div>
  );
}

// Initials tile · brand-colored rounded shape with the first two
// initials of the doc name. Falls in when there's no thumbnail. Reads
// like an app icon, so a 30-doc library still feels orderly.
function InitialsTile({ name, accent }: { name: string; accent: string }) {
  const initials = docInitials(name);
  return (
    <div style={{
      height: 130,
      background: D.bg,
      borderBottom: "1px solid " + D.border,
      position: "relative",
      overflow: "hidden",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {/* Soft accent glow behind the badge */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(circle at 35% 30%, " + accent + "26 0%, transparent 60%)",
        pointerEvents: "none",
      }} />
      {/* The badge itself — rounded square with the gradient + initials */}
      <div style={{
        position: "relative",
        width: 76, height: 76, borderRadius: 18,
        background: "linear-gradient(140deg, " + accent + " 0%, " + accent + "AA 60%, " + accent + "55 100%)",
        boxShadow: "0 12px 24px " + accent + "33, inset 0 1px 0 rgba(255,255,255,0.32), inset 0 -2px 0 rgba(0,0,0,0.18)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--grift-font, 'Outfit', sans-serif)",
        fontWeight: 900,
        fontSize: 30, letterSpacing: -0.5,
        color: "#0A0A0F",
      }}>{initials}</div>
    </div>
  );
}

function ActionIcon({ Icon, title, onClick, danger }: {
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  title: string;
  onClick: (e: React.MouseEvent) => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 26, height: 26,
        background: "transparent", border: "none",
        color: danger ? D.coral : D.txm,
        borderRadius: 5, cursor: "pointer",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    ><Icon size={13} strokeWidth={2.1} /></button>
  );
}

function EmptyState({ onNew, hasAny }: { onNew: () => void; hasAny: boolean }) {
  return (
    <div style={{
      padding: "48px 24px",
      background: D.card, border: "1px dashed " + D.border, borderRadius: 14,
      textAlign: "center",
    }}>
      <div style={{ fontFamily: mn, fontSize: 34, color: D.txd, marginBottom: 8 }}>✶</div>
      <div style={{ fontFamily: gf, fontSize: 18, fontWeight: 800, color: D.tx, letterSpacing: -0.3 }}>
        {hasAny ? "No matches" : "Library is empty"}
      </div>
      <div style={{ fontFamily: ft, fontSize: 13, color: D.txm, marginTop: 4 }}>
        {hasAny ? "Try a different filter or search term." : "Make your first chart, table, or diagram to get started."}
      </div>
      {!hasAny && (
        <button
          onClick={onNew}
          style={{
            marginTop: 18,
            padding: "9px 18px",
            background: "linear-gradient(135deg, " + D.amber + ", " + D.coral + ")",
            color: "#0A0A0F", border: "none", borderRadius: 9,
            fontFamily: ft, fontSize: 13, fontWeight: 700, letterSpacing: 0.3,
            cursor: "pointer", boxShadow: "0 6px 18px rgba(247,176,65,0.25)",
          }}
        >+ New document</button>
      )}
    </div>
  );
}

function fmtRelative(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const delta = Date.now() - then;
  const m = Math.round(delta / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + "m ago";
  const h = Math.round(m / 60);
  if (h < 24) return h + "h ago";
  const d = Math.round(h / 24);
  return d + "d ago";
}
