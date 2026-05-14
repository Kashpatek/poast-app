"use client";

// One-step Programmatic wizard — captures name + composition kind, then
// routes to the Remotion Player editor where the user fills inputProps
// and renders.

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { D, ft, gf, mn } from "../../shared-constants";
import { useToast } from "../../toast-context";
import { WizardShell, wizardLabel, wizardInput } from "./wizard-shell";

interface ProgrammaticWizardProps { open: boolean; onClose: () => void }

const COMPS = [
  { id: "quote-card",      label: "Quote card",      sub: "5s · 1920×1080 · brand amber" },
  { id: "audiogram",       label: "Audiogram",       sub: "10s · square / vertical · waveform" },
  { id: "episode-trailer", label: "Episode trailer", sub: "30s · 1920×1080 · 4-scene structure" },
];

export function ProgrammaticWizard({ open, onClose }: ProgrammaticWizardProps) {
  const router = useRouter();
  const { showToast } = useToast();

  const [name, setName] = useState("");
  const [compId, setCompId] = useState("quote-card");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName("");
    setCompId("quote-card");
    setSubmitting(false);
  }
  function close() {
    if (submitting) return;
    reset();
    onClose();
  }

  async function submit() {
    if (submitting || !name.trim()) return;
    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        type: "programmatic" as const,
        fidelity: "high" as const,
        purpose: compId,
        brief: { title: name.trim(), tone: compId },
        format: "video",
      };
      const res = await fetch("/api/docu-design/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) {
        showToast(j.error || "Couldn't create programmatic project");
        setSubmitting(false);
        return;
      }
      const id = j.data?.id;
      reset();
      onClose();
      if (id) router.push(`/design-studio/programmatic/${id}`);
    } catch (e) {
      showToast(String(e));
      setSubmitting(false);
    }
  }

  return (
    <WizardShell
      open={open}
      title="New programmatic video"
      badge="PROGRAMMATIC"
      step={0}
      totalSteps={1}
      canGoNext={!!name.trim() && !submitting}
      isFinalStep
      finalLabel={submitting ? "Creating…" : "Open Player"}
      onNext={submit}
      onClose={close}
    >
      <div>
        <label style={wizardLabel}>Project name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. SA Weekly Ep. 42 quote loop"
          style={wizardInput}
          autoFocus
        />
      </div>
      <div style={{ marginTop: 14 }}>
        <label style={wizardLabel}>Starting composition</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 6 }}>
          {COMPS.map((c) => {
            const active = compId === c.id;
            return (
              <button
                type="button"
                key={c.id}
                onClick={() => setCompId(c.id)}
                style={{
                  textAlign: "left",
                  padding: "10px 12px",
                  background: active ? "rgba(247,176,65,0.10)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${active ? D.amber : D.border}`,
                  borderRadius: 8,
                  color: D.tx,
                  cursor: "pointer",
                  fontFamily: ft,
                }}
              >
                <div style={{ fontFamily: gf, fontSize: 14, marginBottom: 3 }}>{c.label}</div>
                <div style={{ fontFamily: mn, fontSize: 11, color: D.txd, letterSpacing: 0.4 }}>{c.sub}</div>
              </button>
            );
          })}
        </div>
      </div>
    </WizardShell>
  );
}
