"use client";

// One-step Motion wizard — just captures a project name and platform/size,
// then routes to the Motionity iframe.

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { D, ft, mn } from "../../shared-constants";
import { useToast } from "../../toast-context";
import { WizardShell, wizardLabel, wizardInput } from "./wizard-shell";
import { findPreset } from "./size-presets";

interface MotionWizardProps { open: boolean; onClose: () => void }

const PRESETS = [
  { id: "ig-square",  label: "Square 1080²",     w: 1080, h: 1080 },
  { id: "ig-story",   label: "Vertical 9:16",     w: 1080, h: 1920 },
  { id: "slide-16-9", label: "Landscape 16:9",    w: 1920, h: 1080 },
];

export function MotionWizard({ open, onClose }: MotionWizardProps) {
  const router = useRouter();
  const { showToast } = useToast();

  const [name, setName] = useState("");
  const [presetId, setPresetId] = useState("ig-square");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName("");
    setPresetId("ig-square");
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
      const preset = findPreset(presetId);
      const payload = {
        name: name.trim(),
        type: "motion" as const,
        fidelity: "high" as const,
        size_preset: preset?.id ?? presetId,
        brief: { title: name.trim() },
        format: "motion",
      };
      const res = await fetch("/api/docu-design/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) {
        showToast(j.error || "Couldn't create motion project");
        setSubmitting(false);
        return;
      }
      const id = j.data?.id;
      reset();
      onClose();
      if (id) router.push(`/design-studio/motion/${id}`);
    } catch (e) {
      showToast(String(e));
      setSubmitting(false);
    }
  }

  return (
    <WizardShell
      open={open}
      title="New motion project"
      badge="MOTION"
      step={0}
      totalSteps={1}
      canGoNext={!!name.trim() && !submitting}
      isFinalStep
      finalLabel={submitting ? "Creating…" : "Open Motionity"}
      onNext={submit}
      onClose={close}
    >
      <div>
        <label style={wizardLabel}>Project name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Q3 brand sting"
          style={wizardInput}
          autoFocus
        />
      </div>
      <div style={{ marginTop: 14 }}>
        <label style={wizardLabel}>Canvas size</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {PRESETS.map((p) => {
            const active = presetId === p.id;
            return (
              <button
                type="button"
                key={p.id}
                onClick={() => setPresetId(p.id)}
                style={{
                  textAlign: "left",
                  padding: "8px 10px",
                  background: active ? "rgba(247,176,65,0.10)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${active ? D.amber : D.border}`,
                  borderRadius: 8,
                  color: D.tx,
                  cursor: "pointer",
                  fontFamily: ft,
                }}
              >
                <div style={{ fontSize: 13 }}>{p.label}</div>
                <div style={{ fontSize: 10, fontFamily: mn, color: D.txd, marginTop: 2, letterSpacing: 0.4 }}>
                  {p.w} × {p.h}
                </div>
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 10, fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4 }}>
          Opens Motionity (hosted) in an embedded iframe. Self-hosted build coming.
        </div>
      </div>
    </WizardShell>
  );
}
