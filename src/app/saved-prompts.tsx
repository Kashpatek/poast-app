"use client";

// Saved Prompts Library — store refined prompts the team has tuned. Each
// prompt has a name, tool affinity (which generator it's for), the prompt
// text, optional system text, and an "author + last used" trail. Sync to
// Supabase under projects/saved-prompts-master so everyone shares.

import React, { useCallback, useEffect, useState } from "react";
import { D, ft, gf, mn } from "./shared-constants";
import { useUser } from "./user-context";
import { confirmDialog } from "./dialog-context";

interface SavedPrompt {
  id: string;
  name: string;
  tool: string;        // free-form tag: sloptop, carousel, sa-weekly, headlines, etc.
  systemText?: string;
  promptText: string;
  description?: string;
  author?: string;
  createdAt: string;
  updatedAt?: string;
  uses?: number;
}

const TOOL_TAGS = [
  "any", "sloptop", "carousel", "sa-weekly", "press-to-premier",
  "headlines", "data-story", "newsletter", "outreach", "social",
];

export default function SavedPromptsLibrary() {
  const userCtx = useUser();
  const author = userCtx.user?.name || "Anonymous";
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("any");
  const [editing, setEditing] = useState<SavedPrompt | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/db?table=projects");
      const j = await res.json();
      const row = (j.data || []).find((r: { id: string; type: string }) => r.id === "saved-prompts-master" && r.type === "saved-prompts");
      setPrompts(row?.data?.prompts || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function persist(next: SavedPrompt[]) {
    setPrompts(next);
    try {
      await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: "projects", id: "saved-prompts-master", type: "saved-prompts", data: { prompts: next } }),
      });
    } catch { /* ignore */ }
  }

  function startNew() {
    setEditing({
      id: "sp-" + Date.now(),
      name: "",
      tool: tagFilter !== "any" ? tagFilter : "any",
      promptText: "",
      systemText: "",
      description: "",
      author,
      createdAt: new Date().toISOString(),
      uses: 0,
    });
  }

  async function save(p: SavedPrompt) {
    if (!p.name.trim() || !p.promptText.trim()) return;
    const exists = prompts.find((x) => x.id === p.id);
    const updated: SavedPrompt = { ...p, updatedAt: new Date().toISOString() };
    const next = exists ? prompts.map((x) => x.id === p.id ? updated : x) : [updated, ...prompts];
    await persist(next);
    setEditing(null);
  }

  async function remove(id: string) {
    const target = prompts.find((p) => p.id === id);
    const ok = await confirmDialog({
      title: "Remove prompt?",
      body: target ? `"${target.name}" affects the whole team — it will be gone for everyone.` : "This affects the whole team.",
      cta: "Remove",
      variant: "danger",
    });
    if (!ok) return;
    await persist(prompts.filter((p) => p.id !== id));
  }

  async function copy(p: SavedPrompt) {
    const text = p.systemText
      ? "System:\n" + p.systemText + "\n\nPrompt:\n" + p.promptText
      : p.promptText;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(p.id);
      setTimeout(() => setCopied(null), 1500);
      const next = prompts.map((x) => x.id === p.id ? { ...x, uses: (x.uses || 0) + 1 } : x);
      await persist(next);
    } catch { /* ignore */ }
  }

  const filtered = prompts.filter((p) => {
    if (tagFilter !== "any" && p.tool !== tagFilter) return false;
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return (p.name + " " + (p.description || "") + " " + p.promptText + " " + (p.tool || "")).toLowerCase().includes(q);
  });

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 32px" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 10px", borderRadius: 999, background: "rgba(11,134,209,0.10)", border: `1px solid ${D.blue}55`, marginBottom: 14 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: D.blue, boxShadow: `0 0 8px ${D.blue}` }} />
        <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.blue, textTransform: "uppercase" }}>Library</span>
      </div>
      <h1 style={{ fontFamily: gf, fontSize: 38, fontWeight: 900, letterSpacing: -1, margin: 0, marginBottom: 8, color: D.tx }}>Saved Prompts</h1>
      <div style={{ fontFamily: ft, fontSize: 15, color: D.txm, maxWidth: 720, lineHeight: 1.5, marginBottom: 28 }}>
        Share refined prompts across the team. Save what works, copy into any tool, track which ones get used.
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 18, flexWrap: "wrap" }}>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search prompts…"
          style={{ ...inputStyle, flex: 1, minWidth: 200 }}
        />
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          style={{ ...inputStyle, width: 180 }}
        >
          {TOOL_TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button
          type="button"
          onClick={startNew}
          style={{ background: D.amber, color: "#060608", border: "none", padding: "10px 20px", borderRadius: 8, fontFamily: ft, fontSize: 13, fontWeight: 800, cursor: "pointer" }}
        >
          + New prompt
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ fontFamily: mn, fontSize: 12, color: D.txm, padding: 20 }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={emptyBox}>
          No prompts yet. Click "+ New prompt" and save something the team can reuse.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
          {filtered.map((p) => (
            <div key={p.id} style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <div style={{ fontFamily: gf, fontSize: 16, fontWeight: 700, color: D.tx, letterSpacing: -0.3, flex: 1 }}>{p.name}</div>
                <span style={{ fontFamily: mn, fontSize: 9, padding: "2px 8px", background: D.amber + "1c", color: D.amber, border: `1px solid ${D.amber}55`, borderRadius: 4, letterSpacing: 0.6, textTransform: "uppercase" }}>{p.tool}</span>
              </div>
              {p.description ? (
                <div style={{ fontFamily: ft, fontSize: 12, color: D.txm, lineHeight: 1.5 }}>{p.description}</div>
              ) : null}
              <div style={{ fontFamily: mn, fontSize: 11, color: D.txd, lineHeight: 1.5, padding: 10, background: "rgba(255,255,255,0.02)", border: `1px solid ${D.border}`, borderRadius: 6, maxHeight: 110, overflow: "hidden", position: "relative" }}>
                {p.promptText.slice(0, 280)}{p.promptText.length > 280 ? "…" : ""}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
                <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.4 }}>
                  {p.author || "—"} · {p.uses || 0} use{(p.uses || 0) === 1 ? "" : "s"}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" onClick={() => setEditing(p)} style={ghostBtn}>Edit</button>
                  <button type="button" onClick={() => copy(p)} style={{ ...primaryBtn, background: copied === p.id ? D.teal : D.amber, color: "#060608" }}>
                    {copied === p.id ? "COPIED" : "COPY"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor modal */}
      {editing ? (
        <PromptEditor
          prompt={editing}
          onCancel={() => setEditing(null)}
          onSave={save}
          onRemove={() => remove(editing.id)}
        />
      ) : null}
    </div>
  );
}

function PromptEditor({ prompt, onCancel, onSave, onRemove }: { prompt: SavedPrompt; onCancel: () => void; onSave: (p: SavedPrompt) => void; onRemove: () => void }) {
  const [p, setP] = useState<SavedPrompt>(prompt);
  return (
    <div style={overlay} onClick={onCancel}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.amber, textTransform: "uppercase", marginBottom: 8 }}>Prompt</div>
        <input
          value={p.name}
          onChange={(e) => setP({ ...p, name: e.target.value })}
          placeholder="Name (e.g. Michelle's executive summary)"
          style={{ ...inputStyle, fontSize: 18, fontWeight: 700, fontFamily: ft, padding: "12px 14px", marginBottom: 12 }}
          autoFocus
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <select value={p.tool} onChange={(e) => setP({ ...p, tool: e.target.value })} style={inputStyle}>
            {TOOL_TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            value={p.description || ""}
            onChange={(e) => setP({ ...p, description: e.target.value })}
            placeholder="Description (optional)"
            style={inputStyle}
          />
        </div>
        <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 }}>System (optional)</div>
        <textarea
          value={p.systemText || ""}
          onChange={(e) => setP({ ...p, systemText: e.target.value })}
          placeholder="System message for the model"
          style={{ ...inputStyle, minHeight: 90, resize: "vertical", marginBottom: 12, fontFamily: mn, fontSize: 12 }}
        />
        <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 }}>Prompt</div>
        <textarea
          value={p.promptText}
          onChange={(e) => setP({ ...p, promptText: e.target.value })}
          placeholder="The actual prompt text…"
          style={{ ...inputStyle, minHeight: 200, resize: "vertical", marginBottom: 16, fontFamily: mn, fontSize: 12 }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button type="button" onClick={onRemove} style={{ background: "transparent", color: D.coral, border: "none", fontFamily: mn, fontSize: 11, cursor: "pointer" }}>Remove</button>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={onCancel} style={ghostBtn}>Cancel</button>
            <button
              type="button"
              onClick={() => onSave(p)}
              disabled={!p.name.trim() || !p.promptText.trim()}
              style={{ ...primaryBtn, opacity: !p.name.trim() || !p.promptText.trim() ? 0.5 : 1 }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  background: "rgba(255,255,255,0.03)",
  border: `1px solid ${D.border}`,
  borderRadius: 6,
  color: D.tx,
  fontFamily: ft,
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};

const primaryBtn: React.CSSProperties = {
  background: D.amber,
  color: "#060608",
  border: "none",
  padding: "8px 16px",
  borderRadius: 6,
  fontFamily: ft,
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
  letterSpacing: 0.4,
};

const ghostBtn: React.CSSProperties = {
  background: "transparent",
  color: D.tx,
  border: `1px solid ${D.border}`,
  padding: "8px 14px",
  borderRadius: 6,
  fontFamily: ft,
  fontSize: 12,
  cursor: "pointer",
};

const emptyBox: React.CSSProperties = {
  border: `1px dashed ${D.border}`,
  borderRadius: 12,
  padding: 28,
  background: D.surface,
  color: D.txm,
  fontFamily: ft,
  fontSize: 14,
  lineHeight: 1.5,
};

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(6,6,12,0.78)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  zIndex: 12000,
  display: "flex",
  alignItems: "safe center",
  justifyContent: "center",
  overflowY: "auto",
  padding: 24,
};

const panel: React.CSSProperties = {
  width: "min(720px, 96vw)",
  background: "#0A0A14",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  padding: "26px 28px 22px",
  boxShadow: "0 32px 80px rgba(0,0,0,0.55)",
  maxHeight: "calc(100vh - 48px)",
  overflowY: "auto",
};
