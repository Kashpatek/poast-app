"use client";

// Custom canvas (Excalidraw) wizard — two simple steps: pick a size +
// name your sketch, then jump straight into /design-studio/custom-canvas.
// Modeled after graphic-wizard.tsx but stripped down to a fixed set of
// presets (Excalidraw is an infinite-canvas sketch tool — size is mostly
// advisory for export framing) plus a custom-size escape hatch.

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { D, ft, gf, mn } from "../../shared-constants";
import {
  WizardShell,
  wizardLabel,
  wizardInput,
} from "./wizard-shell";

interface CustomWizardProps {
  open: boolean;
  onClose: () => void;
  initialPresetId?: string;
}

interface CustomPreset {
  id: string;
  label: string;
  w: number;
  h: number;
  note?: string;
}

const CUSTOM_PRESETS: CustomPreset[] = [
  { id: "square-1080",     label: "Square",                w: 1080, h: 1080, note: "Instagram / LinkedIn post" },
  { id: "landscape-1080p", label: "Landscape 1080p",       w: 1920, h: 1080, note: "Standard HD frame" },
  { id: "landscape-1200",  label: "Landscape · letterbox", w: 1920, h: 1200, note: "Slide / presentation" },
  { id: "landscape-1440p", label: "Landscape 1440p",       w: 2560, h: 1440, note: "Retina / hi-res export" },
];

export function CustomWizard({ open, onClose, initialPresetId }: CustomWizardProps) {
  const router = useRouter();

  const [step, setStep] = useState<number>(0);
  const [presetId, setPresetId] = useState<string>(initialPresetId || CUSTOM_PRESETS[0].id);
  const [customW, setCustomW] = useState<string>("");
  const [customH, setCustomH] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const isCustom = presetId === "custom";

  const selectedPreset: CustomPreset | undefined = useMemo(
    () => CUSTOM_PRESETS.find(p => p.id === presetId),
    [presetId]
  );

  const customWNum = Number(customW);
  const customHNum = Number(customH);
  const customValid = isCustom
    ? Number.isFinite(customWNum) && customWNum > 0 && Number.isFinite(customHNum) && customHNum > 0
    : true;

  function reset() {
    setStep(0);
    setPresetId(initialPresetId || CUSTOM_PRESETS[0].id);
    setCustomW("");
    setCustomH("");
    setName("");
    setSubmitting(false);
  }
  function close() {
    if (submitting) return;
    reset();
    onClose();
  }

  const canGoNext = (() => {
    if (step === 0) return !!presetId && customValid;
    if (step === 1) return name.trim().length > 0 && !submitting;
    return false;
  })();

  function submit() {
    if (submitting) return;
    setSubmitting(true);
    const w = isCustom ? customWNum : (selectedPreset?.w ?? 1920);
    const h = isCustom ? customHNum : (selectedPreset?.h ?? 1080);
    const params = new URLSearchParams({
      w: String(w),
      h: String(h),
      name: name.trim(),
    });
    reset();
    onClose();
    router.push(`/design-studio/custom-canvas?${params.toString()}`);
  }

  return (
    <WizardShell
      open={open}
      title={step === 0 ? "Pick a canvas size" : "Name your sketch"}
      badge="CUSTOM CANVAS"
      step={step}
      totalSteps={2}
      canGoNext={canGoNext}
      isFinalStep={step === 1}
      finalLabel={submitting ? "Opening…" : "Open artboard"}
      onBack={() => setStep((s) => Math.max(0, s - 1))}
      onNext={() => (step === 1 ? submit() : setStep((s) => Math.min(1, s + 1)))}
      onClose={close}
    >
      {step === 0 ? (
        <SizeStep
          presetId={presetId}
          setPresetId={setPresetId}
          customW={customW}
          setCustomW={setCustomW}
          customH={customH}
          setCustomH={setCustomH}
          isCustom={isCustom}
        />
      ) : null}

      {step === 1 ? (
        <div>
          <label style={wizardLabel}>Sketch name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Inference cluster architecture"
            style={wizardInput}
            autoFocus
          />
          <div style={{ marginTop: 10, fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4 }}>
            Excalidraw opens with a {isCustom ? `${customWNum} × ${customHNum}` : selectedPreset?.label || "1920 × 1080"} export frame in mind — the actual artboard is infinite.
          </div>
        </div>
      ) : null}
    </WizardShell>
  );
}

function SizeStep({
  presetId,
  setPresetId,
  customW,
  setCustomW,
  customH,
  setCustomH,
  isCustom,
}: {
  presetId: string;
  setPresetId: (id: string) => void;
  customW: string;
  setCustomW: (v: string) => void;
  customH: string;
  setCustomH: (v: string) => void;
  isCustom: boolean;
}) {
  return (
    <div>
      <div style={wizardLabel}>Size preset</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8, marginBottom: 14 }}>
        {CUSTOM_PRESETS.map(p => {
          const active = presetId === p.id;
          return (
            <button
              type="button"
              key={p.id}
              onClick={() => setPresetId(p.id)}
              style={{
                textAlign: "left",
                padding: "10px 12px",
                background: active ? "rgba(46,173,142,0.10)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${active ? D.teal : D.border}`,
                borderRadius: 8,
                color: D.tx,
                cursor: "pointer",
                fontFamily: ft,
              }}
            >
              <div style={{ fontFamily: gf, fontSize: 13, marginBottom: 2 }}>{p.label}</div>
              <div style={{ fontSize: 10, fontFamily: mn, color: D.txd, marginTop: 2, letterSpacing: 0.4 }}>
                {p.w} × {p.h} px
              </div>
              {p.note ? (
                <div style={{ fontSize: 11, color: D.txm, marginTop: 4 }}>{p.note}</div>
              ) : null}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setPresetId("custom")}
          style={{
            textAlign: "left",
            padding: "10px 12px",
            background: isCustom ? "rgba(46,173,142,0.10)" : "rgba(255,255,255,0.02)",
            border: `1px solid ${isCustom ? D.teal : D.border}`,
            borderRadius: 8,
            color: D.tx,
            cursor: "pointer",
            fontFamily: ft,
          }}
        >
          <div style={{ fontFamily: gf, fontSize: 13, marginBottom: 2 }}>Custom</div>
          <div style={{ fontSize: 11, color: D.txm }}>Set your own dimensions</div>
        </button>
      </div>

      {isCustom ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={wizardLabel}>Width (px)</label>
            <input
              type="number"
              inputMode="numeric"
              value={customW}
              onChange={(e) => setCustomW(e.target.value)}
              placeholder="1920"
              style={wizardInput}
              min={1}
            />
          </div>
          <div>
            <label style={wizardLabel}>Height (px)</label>
            <input
              type="number"
              inputMode="numeric"
              value={customH}
              onChange={(e) => setCustomH(e.target.value)}
              placeholder="1080"
              style={wizardInput}
              min={1}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
