"use client";

import React, { useEffect, useState, useCallback } from "react";
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
} from "lucide-react";
import { DocuShell } from "./docu-shell";
import { D, ft, gf, mn } from "../shared-constants";
import { useToast } from "../toast-context";
import { useDialog } from "../dialog-context";

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
  { id: "graphics",    label: "Graphics",       sub: "Canva-style WYSIWYG editor",    Icon: LayoutGrid,   accent: D.amber,   status: "soon", action: "graphic" },
  { id: "image",       label: "Image Studio",   sub: "AI gen + inline editor",        Icon: Sparkles,     accent: D.violet,  status: "soon", action: "image" },
  { id: "motion",      label: "Motion",         sub: "Animated graphics & loops",     Icon: Play,         accent: D.teal,    status: "soon", action: "motion" },
  { id: "programmatic",label: "Programmatic",   sub: "Code-driven video templates",   Icon: Code,         accent: D.cyan,    status: "soon", action: "programmatic" },
  { id: "quote",       label: "Quote card",     sub: "Preset SA-styled cards",        Icon: Quote,        accent: D.coral,   status: "soon", action: "quote" },
  { id: "event",       label: "Event one-pager",sub: "Conference & sponsor handouts", Icon: CalendarDays, accent: D.crimson, status: "soon", action: "event" },
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
    if (t.action === "doc") createProject("document");
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
      rightSlot={
        <Link href="/design-studio/system" style={ghostLink}>
          ⚙ Design system
        </Link>
      }
    >
      <div style={{ padding: 32, maxWidth: 1280, margin: "0 auto" }}>
        {/* Hero */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <Wand size={20} color={D.amber} strokeWidth={1.8} />
            <h1 style={{ fontFamily: gf, fontSize: 30, letterSpacing: 0.2, margin: 0, color: D.tx }}>
              DesignStudio
            </h1>
          </div>
          <div style={{ fontFamily: ft, fontSize: 14, color: D.txm }}>
            Your creative suite. Docs, graphics, AI images, motion — all powered by your SA design system.
          </div>
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
