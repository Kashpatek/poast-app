"use client";

// Four-step guided flow for creating a DocuDesign document project.
// 1) Category (what is it)
// 2) Size / platform (where will it live)
// 3) Brief (title, key points, tone)
// 4) Context (audience, source material, design system override)
// Submits to /api/docu-design/projects with the full brief on the record,
// then routes to the canvas which will pre-shape the first artboard.

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { D, ft, gf, mn } from "../../shared-constants";
import { useToast } from "../../toast-context";
import {
  WizardShell,
  wizardFieldset,
  wizardLabel,
  wizardInput,
  wizardTextarea,
} from "./wizard-shell";
import {
  DOC_CATEGORIES,
  TONES,
  findCategory,
  type Category,
} from "./categories";
import {
  GROUP_ORDER,
  SIZE_PRESETS,
  findPreset,
  type SizePreset,
  type SizeGroup,
} from "./size-presets";

interface DocumentWizardProps {
  open: boolean;
  onClose: () => void;
}

export function DocumentWizard({ open, onClose }: DocumentWizardProps) {
  const router = useRouter();
  const { showToast } = useToast();

  const [step, setStep] = useState(0);
  const [categoryId, setCategoryId] = useState<string>("");
  const [presetId, setPresetId] = useState<string>("");
  const [customSize, setCustomSize] = useState<{ w: string; h: string }>({ w: "", h: "" });
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [keyPoints, setKeyPoints] = useState("");
  const [tone, setTone] = useState("institutional");
  const [audience, setAudience] = useState("");
  const [context, setContext] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const category: Category | undefined = useMemo(() => findCategory(categoryId), [categoryId]);
  const visibleGroups: SizeGroup[] = useMemo(() => category?.sizeGroups ?? [], [category]);
  const visiblePresets: SizePreset[] = useMemo(() => {
    const set = new Set(visibleGroups);
    return SIZE_PRESETS.filter((p) => set.has(p.group));
  }, [visibleGroups]);

  function reset() {
    setStep(0);
    setCategoryId("");
    setPresetId("");
    setCustomSize({ w: "", h: "" });
    setTitle("");
    setSubtitle("");
    setKeyPoints("");
    setTone("institutional");
    setAudience("");
    setContext("");
    setSubmitting(false);
  }

  function close() {
    if (submitting) return;
    reset();
    onClose();
  }

  // Step gating: each step's Next requires its mandatory fields.
  const canGoNext = (() => {
    if (step === 0) return !!categoryId;
    if (step === 1) {
      if (presetId === "__custom__") {
        const w = Number(customSize.w);
        const h = Number(customSize.h);
        return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0;
      }
      return !!presetId;
    }
    if (step === 2) return title.trim().length > 0;
    return true; // step 3 — everything optional
  })();

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const cat = category!;
      const preset = presetId === "__custom__"
        ? { id: `custom-${customSize.w}x${customSize.h}`, label: `Custom ${customSize.w}×${customSize.h}px`, w: Number(customSize.w), h: Number(customSize.h) }
        : findPreset(presetId);

      const payload = {
        name: title.trim(),
        type: "document" as const,
        fidelity: "high" as const,
        size_preset: preset?.id ?? null,
        purpose: cat.id,
        category: cat.id,
        brief: {
          title: title.trim(),
          subtitle: subtitle.trim() || undefined,
          audience: audience.trim() || undefined,
          tone,
          keyPoints: keyPoints
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          context: context.trim() || undefined,
        },
        format: "svg" as const,
      };

      const res = await fetch("/api/docu-design/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) {
        showToast(j.error || "Couldn't create project");
        setSubmitting(false);
        return;
      }
      // Reset and route. router.push tears the modal down naturally.
      const id = j.data?.id;
      reset();
      onClose();
      if (id) router.push(`/design-studio/p/${id}`);
    } catch (e) {
      showToast(String(e));
      setSubmitting(false);
    }
  }

  return (
    <WizardShell
      open={open}
      title={WIZARD_TITLES[step]}
      badge="DOCUDESIGN"
      step={step}
      totalSteps={4}
      canGoNext={canGoNext && !submitting}
      isFinalStep={step === 3}
      finalLabel={submitting ? "Creating…" : "Create project"}
      onBack={() => setStep((s) => Math.max(0, s - 1))}
      onNext={() => (step === 3 ? submit() : setStep((s) => Math.min(3, s + 1)))}
      onClose={close}
    >
      {step === 0 ? (
        <CategoryStep
          value={categoryId}
          onChange={(id) => {
            setCategoryId(id);
            // Pre-pick the category's default preset for step 2 convenience.
            const c = findCategory(id);
            if (c?.defaultPreset) setPresetId(c.defaultPreset);
          }}
        />
      ) : null}

      {step === 1 ? (
        <SizeStep
          presets={visiblePresets}
          groups={visibleGroups}
          value={presetId}
          onChange={setPresetId}
          custom={customSize}
          onCustomChange={setCustomSize}
        />
      ) : null}

      {step === 2 ? (
        <BriefStep
          category={category!}
          title={title}
          setTitle={setTitle}
          subtitle={subtitle}
          setSubtitle={setSubtitle}
          keyPoints={keyPoints}
          setKeyPoints={setKeyPoints}
          tone={tone}
          setTone={setTone}
        />
      ) : null}

      {step === 3 ? (
        <ContextStep
          audience={audience}
          setAudience={setAudience}
          context={context}
          setContext={setContext}
        />
      ) : null}
    </WizardShell>
  );
}

const WIZARD_TITLES = [
  "What kind of document?",
  "Where will it live?",
  "Tell me about it",
  "Anything else worth knowing?",
];

// ─── Step 0 — Category ──────────────────────────────────────────────
function CategoryStep({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div>
      <div style={{ fontFamily: ft, fontSize: 14, color: D.txm, marginBottom: 14, lineHeight: 1.5 }}>
        Pick the closest fit. Everything is customizable once the canvas opens.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
        {DOC_CATEGORIES.map((c) => {
          const active = value === c.id;
          return (
            <button
              type="button"
              key={c.id}
              onClick={() => onChange(c.id)}
              style={{
                textAlign: "left",
                padding: "12px 14px",
                background: active ? "rgba(247,176,65,0.10)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${active ? D.amber : D.border}`,
                borderRadius: 10,
                color: D.tx,
                cursor: "pointer",
                fontFamily: ft,
                transition: "background 0.15s ease, border-color 0.15s ease",
              }}
            >
              <div style={{ fontFamily: gf, fontSize: 14, marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontSize: 12, color: D.txm, lineHeight: 1.4 }}>{c.sub}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Step 1 — Size ──────────────────────────────────────────────────
function SizeStep({
  presets,
  groups,
  value,
  onChange,
  custom,
  onCustomChange,
}: {
  presets: SizePreset[];
  groups: SizeGroup[];
  value: string;
  onChange: (id: string) => void;
  custom: { w: string; h: string };
  onCustomChange: (c: { w: string; h: string }) => void;
}) {
  // Visible groups in the canonical order.
  const orderedGroups = GROUP_ORDER.filter((g) => groups.includes(g.group));

  return (
    <div>
      <div style={{ fontFamily: ft, fontSize: 14, color: D.txm, marginBottom: 14, lineHeight: 1.5 }}>
        Pick a platform or print size — or define a custom canvas at the bottom.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18, maxHeight: 360, overflowY: "auto", paddingRight: 4 }}>
        {orderedGroups.map((g) => {
          const items = presets.filter((p) => p.group === g.group);
          if (!items.length) return null;
          return (
            <div key={g.group}>
              <div style={wizardLabel}>{g.label}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
                {items.map((p) => {
                  const active = value === p.id;
                  return (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => onChange(p.id)}
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
                      <div style={{ fontSize: 12.5, lineHeight: 1.3 }}>{p.label}</div>
                      <div style={{ fontSize: 10, fontFamily: mn, color: D.txd, marginTop: 2, letterSpacing: 0.4 }}>
                        {p.w} × {p.h} {p.units}{p.dpi ? ` · ${p.dpi}dpi` : ""}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Custom */}
        <div>
          <div style={wizardLabel}>Custom</div>
          <button
            type="button"
            onClick={() => onChange("__custom__")}
            style={{
              textAlign: "left",
              padding: "10px 12px",
              background: value === "__custom__" ? "rgba(247,176,65,0.10)" : "rgba(255,255,255,0.02)",
              border: `1px solid ${value === "__custom__" ? D.amber : D.border}`,
              borderRadius: 8,
              color: D.tx,
              cursor: "pointer",
              fontFamily: ft,
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: 12.5 }}>Custom dimensions</span>
            <input
              type="number"
              value={custom.w}
              onChange={(e) => onCustomChange({ ...custom, w: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              placeholder="W"
              style={{ ...wizardInput, width: 90, padding: "6px 8px", fontSize: 12 }}
            />
            <span style={{ color: D.txd, fontFamily: mn, fontSize: 11 }}>×</span>
            <input
              type="number"
              value={custom.h}
              onChange={(e) => onCustomChange({ ...custom, h: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              placeholder="H"
              style={{ ...wizardInput, width: 90, padding: "6px 8px", fontSize: 12 }}
            />
            <span style={{ color: D.txd, fontFamily: mn, fontSize: 11 }}>px</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Step 2 — Brief ─────────────────────────────────────────────────
function BriefStep({
  category,
  title,
  setTitle,
  subtitle,
  setSubtitle,
  keyPoints,
  setKeyPoints,
  tone,
  setTone,
}: {
  category: Category;
  title: string;
  setTitle: (v: string) => void;
  subtitle: string;
  setSubtitle: (v: string) => void;
  keyPoints: string;
  setKeyPoints: (v: string) => void;
  tone: string;
  setTone: (v: string) => void;
}) {
  const placeholder = category.hints?.suggestedSections?.join("\n") ?? "Headline\nKey point\nKey point\nCTA";
  return (
    <div style={wizardFieldset}>
      <div>
        <label style={wizardLabel}>Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Blackwell yields — first 90 days"
          style={wizardInput}
          autoFocus
        />
      </div>
      <div>
        <label style={wizardLabel}>Subtitle / dek (optional)</label>
        <input
          type="text"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder="What the data says about ramp risk"
          style={wizardInput}
        />
      </div>
      <div>
        <label style={wizardLabel}>Key points · one per line (optional)</label>
        <textarea
          value={keyPoints}
          onChange={(e) => setKeyPoints(e.target.value)}
          placeholder={placeholder}
          style={wizardTextarea}
        />
      </div>
      <div>
        <label style={wizardLabel}>Tone</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
          {TONES.map((t) => {
            const active = tone === t.id;
            return (
              <button
                type="button"
                key={t.id}
                onClick={() => setTone(t.id)}
                style={{
                  textAlign: "left",
                  padding: "8px 10px",
                  background: active ? "rgba(247,176,65,0.10)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${active ? D.amber : D.border}`,
                  borderRadius: 8,
                  cursor: "pointer",
                  color: D.tx,
                  fontFamily: ft,
                }}
              >
                <div style={{ fontSize: 13 }}>{t.label}</div>
                <div style={{ fontSize: 11, color: D.txm, marginTop: 2 }}>{t.sub}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Step 3 — Context ────────────────────────────────────────────────
function ContextStep({
  audience,
  setAudience,
  context,
  setContext,
}: {
  audience: string;
  setAudience: (v: string) => void;
  context: string;
  setContext: (v: string) => void;
}) {
  return (
    <div style={wizardFieldset}>
      <div>
        <label style={wizardLabel}>Audience (optional)</label>
        <input
          type="text"
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          placeholder="SA clients · GPU procurement leads"
          style={wizardInput}
        />
      </div>
      <div>
        <label style={wizardLabel}>Source material / context (optional)</label>
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Paste the source brief, transcript, or URL. The canvas chat will use this as starting context."
          style={{ ...wizardTextarea, minHeight: 140 }}
        />
        <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, marginTop: 6, letterSpacing: 0.4 }}>
          Everything in this brief gets pinned to the canvas as your project brief.
        </div>
      </div>
    </div>
  );
}
