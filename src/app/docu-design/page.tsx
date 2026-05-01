"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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

export default function WorkspacePage() {
  const router = useRouter();
  const { showToast: toast } = useToast();
  const { confirm, prompt } = useDialog();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [tablesMissing, setTablesMissing] = useState(false);

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

  useEffect(() => {
    load();
  }, [load]);

  async function createProject(type: "document" | "other") {
    const name = await prompt({
      title: type === "document" ? "New document" : "New graphic",
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
    router.push(`/docu-design/p/${j.data.id}`);
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
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => createProject("document")}
            style={primaryBtn}
          >
            + New document
          </button>
          <button
            type="button"
            onClick={() => createProject("other")}
            style={secondaryBtn}
          >
            + New graphic
          </button>
        </div>
      }
    >
      <div style={{ padding: 32, maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 24 }}>
          <h1 style={{ fontFamily: gf, fontSize: 28, letterSpacing: 0.4, margin: 0 }}>Designs</h1>
          <div style={{ color: D.txm, fontFamily: mn, fontSize: 12 }}>
            {loading ? "loading…" : `${projects.length} project${projects.length === 1 ? "" : "s"}`}
          </div>
        </div>

        {tablesMissing ? (
          <div style={tablesMissingBox}>
            <div style={{ fontFamily: gf, fontSize: 18, marginBottom: 8 }}>Supabase tables missing</div>
            <div style={{ color: D.txm, lineHeight: 1.5, fontSize: 13 }}>
              DocuDesign needs two tables: <code style={code}>docu_design_systems</code> and{" "}
              <code style={code}>docu_projects</code>. Create them in your Supabase dashboard, then refresh.
            </div>
          </div>
        ) : null}

        {!loading && !tablesMissing && projects.length === 0 ? (
          <div style={emptyBox}>
            <div style={{ fontFamily: gf, fontSize: 18, marginBottom: 8 }}>No projects yet</div>
            <div style={{ color: D.txm, lineHeight: 1.5, fontSize: 13, marginBottom: 16 }}>
              Start a Document for paginated print work, or a Graphic for a single artboard.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => createProject("document")} style={primaryBtn}>
                + New document
              </button>
              <button type="button" onClick={() => createProject("other")} style={secondaryBtn}>
                + New graphic
              </button>
            </div>
            <div style={{ marginTop: 16, fontSize: 12, color: D.txd }}>
              First time?{" "}
              <Link href="/docu-design/system" style={{ color: D.amber }}>
                Set up a Design System →
              </Link>
            </div>
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {projects.map((p) => (
            <div key={p.id} style={card}>
              <Link
                href={`/docu-design/p/${p.id}`}
                style={{ textDecoration: "none", color: "inherit", flex: 1, padding: 16 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <div style={typePill(p.type)}>{p.type === "document" ? "DOC" : "GFX"}</div>
                  {p.fidelity === "wireframe" ? <div style={fidelityPill}>WIREFRAME</div> : null}
                </div>
                <div style={{ fontFamily: gf, fontSize: 16, marginBottom: 6, color: D.tx }}>{p.name}</div>
                <div style={{ fontFamily: mn, fontSize: 11, color: D.txd }}>
                  {p.updated_at ? new Date(p.updated_at).toLocaleString() : ""}
                </div>
              </Link>
              <div style={{ borderTop: `1px solid ${D.border}`, padding: "8px 16px", display: "flex", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => deleteProject(p)} style={dangerBtn}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DocuShell>
  );
}

const primaryBtn: React.CSSProperties = {
  background: D.amber,
  color: "#000",
  border: "none",
  padding: "8px 14px",
  borderRadius: 8,
  fontFamily: ft,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  background: "transparent",
  color: D.tx,
  border: `1px solid ${D.border}`,
  padding: "8px 14px",
  borderRadius: 8,
  fontFamily: ft,
  fontSize: 13,
  cursor: "pointer",
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

const card: React.CSSProperties = {
  background: D.card,
  border: `1px solid ${D.border}`,
  borderRadius: 12,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  transition: "border-color 120ms ease",
};

const emptyBox: React.CSSProperties = {
  border: `1px dashed ${D.border}`,
  borderRadius: 12,
  padding: 32,
  textAlign: "left",
  background: D.surface,
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
