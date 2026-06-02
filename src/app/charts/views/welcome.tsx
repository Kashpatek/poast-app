"use client";

// Welcome view · the first thing a user sees when they land on Studio
// with an empty library (or click "+ New" from elsewhere). Three big tiles
// pick a doc type; recent docs sit below.

import { BarChart3, Sparkles, Table2, Workflow } from "lucide-react";
import { D, ft, gf, mn } from "../studio-theme";
import { DocType, StudioDoc } from "../studio-types";

export default function WelcomeView({
  onPickType, onOpenDoc, onOpenLibrary, recent, userName,
}: {
  onPickType: (t: DocType) => void;
  onOpenDoc: (id: string) => void;
  onOpenLibrary: () => void;
  recent: StudioDoc[];
  userName: string;
}) {
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 28px 80px" }}>
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontFamily: mn, fontSize: 10.5, letterSpacing: 2, fontWeight: 700, color: D.amber, textTransform: "uppercase", marginBottom: 8 }}>
          POAST Studio
        </div>
        <h1 style={{ fontFamily: gf, fontSize: 36, fontWeight: 900, letterSpacing: -1.2, color: D.tx, margin: 0, lineHeight: 1.1 }}>
          Make something, {userName}.
        </h1>
        <p style={{ fontFamily: ft, fontSize: 14.5, color: D.txm, marginTop: 10, maxWidth: 620, lineHeight: 1.5 }}>
          Charts, tables, diagrams — one workspace. Saved to your library, ready to come back to.
        </p>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: 16,
        marginBottom: 44,
      }}>
        <TypeTile
          title="Chart"
          subtitle="18 types · stacked, lines, scatter, gantt, mekko"
          accent={D.amber}
          Icon={BarChart3}
          onClick={() => onPickType("chart")}
        />
        <TypeTile
          title="Table"
          subtitle="Edit data, export CSV, build chart from selection"
          accent={D.teal}
          Icon={Table2}
          onClick={() => onPickType("table")}
        />
        <TypeTile
          title="Diagram"
          subtitle="Flowcharts and wireframes, brand-styled"
          accent={D.blue}
          Icon={Workflow}
          onClick={() => onPickType("diagram")}
        />
      </div>

      {recent.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "baseline", marginBottom: 12 }}>
            <span style={{ fontFamily: mn, fontSize: 10, color: D.txm, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700 }}>
              Recent
            </span>
            <button
              onClick={onOpenLibrary}
              style={{
                marginLeft: "auto",
                background: "transparent", border: "none", color: D.txm,
                fontFamily: mn, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6,
                textTransform: "uppercase", cursor: "pointer",
              }}
            >View library →</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            {recent.slice(0, 5).map((d) => <RecentCard key={d.id} doc={d} onOpen={() => onOpenDoc(d.id)} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function TypeTile({ title, subtitle, accent, Icon, onClick }: {
  title: string; subtitle: string; accent: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: "22px 22px 24px",
        background: "linear-gradient(160deg, " + D.card + ", " + D.surface + ")",
        border: "1px solid " + D.border,
        borderRadius: 14,
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        transition: "border-color 0.18s, transform 0.18s, box-shadow 0.18s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = accent + "66";
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 14px 36px rgba(0,0,0,0.5), 0 0 0 1px " + accent + "33";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = D.border;
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{
        position: "absolute", top: -28, right: -28, width: 140, height: 140,
        borderRadius: "50%",
        background: "radial-gradient(circle, " + accent + "26 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 40, height: 40, borderRadius: 10,
        background: accent + "1A", border: "1px solid " + accent + "44",
        marginBottom: 14,
      }}>
        <Icon size={20} strokeWidth={2} color={accent} />
      </div>
      <div style={{ fontFamily: gf, fontSize: 20, fontWeight: 800, color: D.tx, letterSpacing: -0.4, marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ fontFamily: ft, fontSize: 12.5, color: D.txm, lineHeight: 1.45 }}>
        {subtitle}
      </div>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        marginTop: 16,
        fontFamily: mn, fontSize: 10, fontWeight: 700, color: accent,
        letterSpacing: 0.6, textTransform: "uppercase",
      }}>
        <Sparkles size={11} strokeWidth={2.2} /> New {title.toLowerCase()}
      </div>
    </button>
  );
}

function RecentCard({ doc, onOpen }: { doc: StudioDoc; onOpen: () => void }) {
  const typeColor = doc.type === "chart" ? D.amber : doc.type === "table" ? D.teal : D.blue;
  return (
    <button
      onClick={onOpen}
      style={{
        textAlign: "left",
        padding: 0,
        background: D.card, border: "1px solid " + D.border,
        borderRadius: 10, overflow: "hidden",
        cursor: "pointer",
        transition: "border-color 0.14s, transform 0.14s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = typeColor + "66"; e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = D.border; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      <div style={{
        height: 96, background: D.bg,
        backgroundImage: doc.thumbnail ? `url(${doc.thumbnail})` : undefined,
        backgroundSize: "cover", backgroundPosition: "center",
        display: "flex", alignItems: "center", justifyContent: "center",
        borderBottom: "1px solid " + D.border,
      }}>
        {!doc.thumbnail && (
          <span style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 1.4, textTransform: "uppercase" }}>no preview</span>
        )}
      </div>
      <div style={{ padding: "9px 11px" }}>
        <div style={{
          fontFamily: ft, fontSize: 12.5, fontWeight: 600, color: D.tx,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{doc.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <span style={{
            fontFamily: mn, fontSize: 8.5, fontWeight: 700, color: typeColor,
            letterSpacing: 0.6, textTransform: "uppercase",
          }}>{doc.type}</span>
          <span style={{ fontFamily: mn, fontSize: 9, color: D.txd }}>· {fmtRelative(doc.updatedAt)}</span>
        </div>
      </div>
    </button>
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
