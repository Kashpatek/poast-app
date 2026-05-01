"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DocuShell } from "../docu-shell";
import { D, ft, gf, mn } from "../../shared-constants";
import { useToast } from "../../toast-context";
import { useDialog } from "../../dialog-context";
import type { DesignSystem } from "../design-context";

type SystemRow = DesignSystem & { created_at?: string; updated_at?: string };
type AssetKind = "logo" | "backdrop" | "font" | "other";

export default function DesignSystemsPage() {
  const { showToast } = useToast();
  const { confirm, prompt } = useDialog();
  const [systems, setSystems] = useState<SystemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tablesMissing, setTablesMissing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/docu-design/systems");
      const j = await res.json();
      if (!res.ok) {
        if (
          typeof j.error === "string" &&
          (/relation .* does not exist/i.test(j.error) ||
            /could not find the table/i.test(j.error))
        ) {
          setTablesMissing(true);
        } else {
          showToast(j.error || "Failed to load");
        }
        setSystems([]);
        return;
      }
      const rows = (j.data || []) as Array<Record<string, unknown>>;
      const mapped: SystemRow[] = rows.map((r) => ({
        id: r.id as string,
        name: r.name as string,
        status: r.status as "published" | "draft" | undefined,
        isDefault: !!r.is_default,
        assets: (r.assets as DesignSystem["assets"]) || [],
        analyzed: (r.analyzed as DesignSystem["analyzed"]) || {},
        notes: (r.notes as string) || "",
        created_at: r.created_at as string | undefined,
        updated_at: r.updated_at as string | undefined,
      }));
      setSystems(mapped);
      if (!activeId && mapped.length) setActiveId(mapped[0].id);
    } catch (e) {
      showToast(String(e));
    } finally {
      setLoading(false);
    }
  }, [activeId, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  async function createSystem() {
    const name = await prompt({ title: "New design system", body: "Name", cta: "Create", placeholder: "SemiAnalysis" });
    if (!name) return;
    const res = await fetch("/api/docu-design/systems", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, status: "draft" }),
    });
    const j = await res.json();
    if (!res.ok) {
      showToast(j.error || "Create failed");
      return;
    }
    await load();
    setActiveId(j.data.id);
  }

  async function deleteSystem(s: SystemRow) {
    const ok = await confirm({ title: "Delete design system?", body: `"${s.name}" will be removed.`, cta: "Delete", variant: "danger" });
    if (!ok) return;
    const res = await fetch(`/api/docu-design/systems?id=${encodeURIComponent(s.id)}`, { method: "DELETE" });
    if (!res.ok) {
      showToast("Delete failed");
      return;
    }
    if (activeId === s.id) setActiveId(null);
    await load();
  }

  const active = useMemo(() => systems.find((s) => s.id === activeId) || null, [systems, activeId]);

  return (
    <DocuShell
      title="Design systems"
      rightSlot={
        <button type="button" onClick={createSystem} style={primaryBtn}>
          + New system
        </button>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", height: "100%" }}>
        <div style={{ borderRight: `1px solid ${D.border}`, padding: 12, overflow: "auto" }}>
          {tablesMissing ? (
            <div style={{ padding: 12, color: D.coral, fontSize: 12, fontFamily: mn }}>
              Supabase tables missing. Create <code>docu_design_systems</code>.
            </div>
          ) : null}
          {!loading && !systems.length && !tablesMissing ? (
            <div style={{ padding: 12, color: D.txm, fontSize: 13 }}>No design systems yet. Create one to teach Claude your brand.</div>
          ) : null}
          {systems.map((s) => {
            const sel = s.id === activeId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveId(s.id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: 12,
                  borderRadius: 8,
                  background: sel ? D.hover : "transparent",
                  border: `1px solid ${sel ? D.border : "transparent"}`,
                  color: D.tx,
                  cursor: "pointer",
                  marginBottom: 4,
                  fontFamily: ft,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <div style={{ fontFamily: gf, fontSize: 14 }}>{s.name}</div>
                  {s.isDefault ? <span style={defaultPill}>DEFAULT</span> : null}
                </div>
                <div style={{ color: D.txd, fontFamily: mn, fontSize: 11 }}>
                  {s.status || "draft"} · {(s.assets || []).length} asset(s)
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ overflow: "auto", padding: 24 }}>
          {active ? (
            <SystemEditor key={active.id} system={active} onSaved={load} onDelete={() => deleteSystem(active)} />
          ) : (
            <div style={{ color: D.txm, fontFamily: ft, fontSize: 14 }}>Select or create a design system.</div>
          )}
        </div>
      </div>
    </DocuShell>
  );
}

function SystemEditor({
  system,
  onSaved,
  onDelete,
}: {
  system: SystemRow;
  onSaved: () => void;
  onDelete: () => void;
}) {
  const { showToast } = useToast();
  const [name, setName] = useState(system.name);
  const [status, setStatus] = useState<"published" | "draft">(system.status || "draft");
  const [isDefault, setIsDefault] = useState(!!system.isDefault);
  const [assets, setAssets] = useState(system.assets || []);
  const [notes, setNotes] = useState(system.notes || "");
  const [analyzed, setAnalyzed] = useState(system.analyzed || {});
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    for (const file of Array.from(files)) {
      const reader = new FileReader();
      const data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      try {
        const res = await fetch("/api/upload-asset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data, filename: file.name, contentType: file.type }),
        });
        const j = await res.json();
        if (!res.ok) {
          showToast(j.error || "Upload failed");
          continue;
        }
        const kind: AssetKind = guessKind(file.name);
        setAssets((cur) => [...cur, { url: j.url as string, kind, name: file.name }]);
      } catch (e) {
        showToast(String(e));
      }
    }
  }

  function setAssetKind(idx: number, kind: AssetKind) {
    setAssets((cur) => cur.map((a, i) => (i === idx ? { ...a, kind } : a)));
  }

  function removeAsset(idx: number) {
    setAssets((cur) => cur.filter((_, i) => i !== idx));
  }

  async function analyze() {
    if (!assets.length) {
      showToast("Add at least one asset first");
      return;
    }
    setAnalyzing(true);
    try {
      const res = await fetch("/api/docu-design/analyze-brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assets, notes }),
      });
      const j = await res.json();
      if (!res.ok) {
        showToast(j.error || "Analyze failed");
        return;
      }
      setAnalyzed(j.analyzed || {});
      showToast("Brand analyzed");
    } finally {
      setAnalyzing(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/docu-design/systems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: system.id,
          name,
          status,
          is_default: isDefault,
          setAsDefault: isDefault && !system.isDefault,
          assets,
          analyzed,
          notes,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        showToast(j.error || "Save failed");
        return;
      }
      showToast("Saved");
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 18 }}>
        <h2 style={{ fontFamily: gf, fontSize: 22, margin: 0 }}>{name || "Untitled"}</h2>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button type="button" onClick={onDelete} style={dangerBtn}>
            Delete
          </button>
          <button type="button" onClick={save} disabled={saving} style={primaryBtn}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <Section label="Identity">
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as "published" | "draft")} style={inputStyle}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </Field>
        <Field label="Default">
          <label style={{ display: "flex", alignItems: "center", gap: 8, color: D.txm, fontSize: 13 }}>
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            Use this design system for new projects
          </label>
        </Field>
      </Section>

      <Section label="Brand assets">
        <div
          style={dropzone}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFiles(e.dataTransfer.files);
          }}
        >
          <div style={{ fontFamily: ft, fontSize: 13, color: D.tx }}>Drop files here or click to upload</div>
          <div style={{ fontFamily: mn, fontSize: 11, color: D.txd, marginTop: 4 }}>PNG, SVG, JPG, WOFF2</div>
          <input
            ref={fileRef}
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
          {assets.map((a, i) => (
            <div key={i} style={assetRow}>
              <div style={assetThumb}>
                {a.url.match(/\.(svg|png|jpe?g|gif|webp)/i) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.url}
                    alt=""
                    style={{ width: 36, height: 36, objectFit: "contain", background: D.bg }}
                  />
                ) : (
                  <span style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>{a.kind}</span>
                )}
              </div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div style={{ fontFamily: ft, fontSize: 13, color: D.tx, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {a.name || a.url.split("/").pop()}
                </div>
                <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {a.url}
                </div>
              </div>
              <select
                value={a.kind}
                onChange={(e) => setAssetKind(i, e.target.value as AssetKind)}
                style={{ ...inputStyle, width: 120 }}
              >
                <option value="logo">Logo</option>
                <option value="backdrop">Backdrop</option>
                <option value="font">Font</option>
                <option value="other">Other</option>
              </select>
              <button type="button" onClick={() => removeAsset(i)} style={miniBtn}>
                ×
              </button>
            </div>
          ))}
        </div>
      </Section>

      <Section label="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Anything Claude should know about your brand voice, layout conventions, do/don't examples…"
          style={{ ...inputStyle, fontFamily: ft, lineHeight: 1.5 }}
        />
      </Section>

      <Section
        label="Analyzed brand"
        action={
          <button type="button" onClick={analyze} disabled={analyzing} style={secondaryBtn}>
            {analyzing ? "Analyzing…" : "Analyze with Claude"}
          </button>
        }
      >
        {!analyzed || Object.keys(analyzed).length === 0 ? (
          <div style={{ color: D.txm, fontFamily: ft, fontSize: 13 }}>
            Analyze your assets to extract a colour palette, typography hints, and tone notes.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={fieldLabelStyle}>Colors</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(analyzed.colors || []).map((c, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 22, height: 22, borderRadius: 4, background: c.hex, border: `1px solid ${D.border}` }} />
                    <div style={{ fontFamily: mn, fontSize: 11, color: D.txm }}>
                      {c.hex}
                      {c.name ? ` · ${c.name}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={fieldLabelStyle}>Typography</div>
              <div style={{ fontFamily: mn, fontSize: 11, color: D.txm, lineHeight: 1.6 }}>
                {analyzed.typography?.display ? <div>display: {analyzed.typography.display}</div> : null}
                {analyzed.typography?.body ? <div>body: {analyzed.typography.body}</div> : null}
                {analyzed.typography?.mono ? <div>mono: {analyzed.typography.mono}</div> : null}
                {analyzed.typography?.notes ? <div style={{ marginTop: 4, color: D.txd }}>{analyzed.typography.notes}</div> : null}
              </div>
            </div>
            {analyzed.layoutNotes ? (
              <div style={{ gridColumn: "1 / 3" }}>
                <div style={fieldLabelStyle}>Layout</div>
                <div style={{ fontFamily: ft, fontSize: 13, color: D.txm }}>{analyzed.layoutNotes}</div>
              </div>
            ) : null}
            {analyzed.toneNotes ? (
              <div style={{ gridColumn: "1 / 3" }}>
                <div style={fieldLabelStyle}>Tone</div>
                <div style={{ fontFamily: ft, fontSize: 13, color: D.txm }}>{analyzed.toneNotes}</div>
              </div>
            ) : null}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({
  label,
  action,
  children,
}: {
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontFamily: mn, fontSize: 11, letterSpacing: 0.6, color: D.txm, textTransform: "uppercase" }}>{label}</div>
        <div style={{ marginLeft: "auto" }}>{action}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", alignItems: "center", gap: 12 }}>
      <div style={fieldLabelStyle}>{label}</div>
      <div>{children}</div>
    </div>
  );
}

function guessKind(name: string): AssetKind {
  const n = name.toLowerCase();
  if (/logo|mark|wordmark|lettermark/.test(n)) return "logo";
  if (/backdrop|background|bg|texture/.test(n)) return "backdrop";
  if (/\.woff2?$|\.ttf$|\.otf$/.test(n)) return "font";
  return "other";
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: D.bg,
  border: `1px solid ${D.border}`,
  borderRadius: 8,
  color: D.tx,
  padding: "8px 10px",
  fontFamily: mn,
  fontSize: 12,
  outline: "none",
  boxSizing: "border-box",
};

const fieldLabelStyle: React.CSSProperties = {
  fontFamily: mn,
  fontSize: 11,
  color: D.txm,
  letterSpacing: 0.4,
  textTransform: "uppercase",
};

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
  padding: "8px 12px",
  borderRadius: 8,
  fontFamily: mn,
  fontSize: 12,
  cursor: "pointer",
};

const miniBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  border: `1px solid ${D.border}`,
  background: "transparent",
  color: D.txm,
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 14,
};

const dropzone: React.CSSProperties = {
  border: `1px dashed ${D.border}`,
  borderRadius: 12,
  padding: 24,
  textAlign: "center",
  cursor: "pointer",
  background: D.surface,
};

const assetRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  background: D.surface,
  border: `1px solid ${D.border}`,
  borderRadius: 8,
  padding: 8,
};

const assetThumb: React.CSSProperties = {
  width: 36,
  height: 36,
  background: D.bg,
  border: `1px solid ${D.border}`,
  borderRadius: 6,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const defaultPill: React.CSSProperties = {
  fontFamily: mn,
  fontSize: 9,
  letterSpacing: 0.6,
  padding: "1px 5px",
  borderRadius: 3,
  background: D.amber,
  color: "#000",
};
