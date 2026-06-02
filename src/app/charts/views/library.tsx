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
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 14,
        }}>
          {filtered.map((d) => (
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
      )}
    </div>
  );
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
  const typeColor = doc.type === "chart" ? D.amber : doc.type === "table" ? D.teal : D.blue;
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
        <div style={{
          height: 130,
          background: D.bg,
          backgroundImage: doc.thumbnail ? `url(${doc.thumbnail})` : undefined,
          backgroundSize: "cover", backgroundPosition: "center",
          display: "flex", alignItems: "center", justifyContent: "center",
          borderBottom: "1px solid " + D.border,
        }}>
          {!doc.thumbnail && (
            <span style={{ fontFamily: mn, fontSize: 9.5, color: D.txd, letterSpacing: 1.4, textTransform: "uppercase" }}>
              {doc.type}
            </span>
          )}
        </div>
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
