"use client";

// SaveToLibrary — small chip button that quietly stores a generated prompt
// into the team Saved Prompts library. Used across every generation surface
// (Phase 9B wires Capper only; later phases spread it to Slop Top, Carousel,
// Headline Doctor, etc.). The chip does NOT open the Saved Prompts UI — it
// just saves and toasts. Idempotent: the same (prompt, tool) pair is never
// stored twice.

import React, { useState } from "react";
import { D, mn } from "../shared-constants";
import { useUser } from "../user-context";
import { showToast } from "../toast-context";

interface SaveToLibraryProps {
  // Optional display title. If absent we derive one from the prompt body.
  title?: string;
  // The generated text to save (caption, thread, headline, etc.).
  prompt: string;
  // Which tool produced this — drives tagging + filtering in Saved Prompts.
  tool: string;
  // Which LLM provider produced it (claude/gemini/grok) — tagged for filter.
  provider?: string;
}

interface SavedPromptRow {
  id: string;
  name: string;
  tool: string;
  systemText?: string;
  promptText: string;
  description?: string;
  author?: string;
  createdAt: string;
  updatedAt?: string;
  uses?: number;
  // Free-form tags surfaced for filter chips. We pack tool/provider/date
  // and the originating user here so library filters can pivot on any of
  // them without a schema change.
  tags?: string[];
}

interface SavedPromptsPayload {
  prompts: SavedPromptRow[];
  seedFlag?: boolean;
}

interface ProjectsRow {
  id: string;
  type: string;
  data?: SavedPromptsPayload;
}

// Truncate to a sensible name. The library card surfaces 280 chars of the
// prompt body separately, so the title is just a human-readable label.
function deriveName(title: string | undefined, prompt: string): string {
  if (title && title.trim()) return title.trim().slice(0, 80);
  const firstLine = (prompt.split("\n").find((s) => s.trim()) || "").trim();
  return firstLine.slice(0, 80) || "Saved prompt";
}

export function SaveToLibrary({ title, prompt, tool, provider }: SaveToLibraryProps) {
  const userCtx = useUser();
  const author = userCtx.user?.name || "Anonymous";
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    if (busy || saved) return;
    const body = (prompt || "").trim();
    if (!body) {
      showToast("Nothing to save yet.");
      return;
    }
    setBusy(true);
    try {
      // 1. Load existing library so we can dedupe.
      const res = await fetch("/api/db?table=projects");
      const j = await res.json();
      const rows: ProjectsRow[] = j.data || [];
      const row = rows.find((r) => r.id === "saved-prompts-master" && r.type === "saved-prompts");
      const prior: SavedPromptRow[] = (row && row.data && Array.isArray(row.data.prompts)) ? row.data.prompts : [];

      // 2. Idempotent: skip if the same prompt text + tool is already saved.
      // We compare on the trimmed prompt body so trivial whitespace shifts
      // don't double-add. (Different tools intentionally CAN share the
      // same body — the source tag distinguishes them.)
      const duplicate = prior.find((p) => p.tool === tool && (p.promptText || "").trim() === body);
      if (duplicate) {
        setSaved(true);
        showToast("Already in library.");
        setBusy(false);
        return;
      }

      // 3. Build the new row. Tags are [tool, provider, today, user] so
      // any of those become a one-click filter in the library UI.
      const today = new Date().toISOString().slice(0, 10);
      const tags = [tool, provider || "", today, author].filter(Boolean);
      const next: SavedPromptRow = {
        id: "sp-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
        name: deriveName(title, body),
        tool,
        promptText: body,
        description: provider ? "Saved from " + tool + " via " + provider : "Saved from " + tool,
        author,
        createdAt: new Date().toISOString(),
        uses: 0,
        tags,
      };

      const updated = [next, ...prior];
      const payload: SavedPromptsPayload = {
        prompts: updated,
        seedFlag: row?.data?.seedFlag === true,
      };

      await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: "projects", id: "saved-prompts-master", type: "saved-prompts", data: payload }),
      });
      setSaved(true);
      showToast("Saved to library.");
    } catch {
      showToast("Couldn't save to library — check your connection.");
    }
    setBusy(false);
  }

  const color = saved ? D.teal : "rgba(255,255,255,0.4)";
  const borderColor = saved ? D.teal + "55" : D.border;
  const label = busy ? "Saving..." : saved ? "Saved" : "Save";

  return (
    <span
      onClick={save}
      role="button"
      title={saved ? "Already saved to library" : "Save to Saved Prompts"}
      style={{
        fontFamily: mn,
        fontSize: 9,
        color,
        cursor: busy || saved ? "default" : "pointer",
        padding: "3px 8px",
        borderRadius: 6,
        border: "1px solid " + borderColor,
        background: saved ? D.teal + "08" : "transparent",
        opacity: busy ? 0.6 : 1,
        userSelect: "none",
        transition: "all 0.2s ease",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => {
        if (!busy && !saved) {
          e.currentTarget.style.borderColor = D.amber + "55";
          e.currentTarget.style.color = D.amber;
        }
      }}
      onMouseLeave={(e) => {
        if (!busy && !saved) {
          e.currentTarget.style.borderColor = D.border;
          e.currentTarget.style.color = "rgba(255,255,255,0.4)";
        }
      }}
    >
      {label}
    </span>
  );
}

export default SaveToLibrary;
