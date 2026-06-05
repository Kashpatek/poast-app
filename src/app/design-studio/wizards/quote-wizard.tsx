"use client";

// Three-step Quote card factory:
// 1) Pick size (square / portrait / landscape — quote category presets)
// 2) Enter quote / attribution / source
// 3) Pick template, see live preview, submit → server-composes the SVG
//    and saves it as a single-artboard quote project.

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { D, ft, mn } from "../../shared-constants";
import { useToast } from "../../toast-context";
import {
  WizardShell,
  wizardLabel,
  wizardInput,
  wizardTextarea,
} from "./wizard-shell";
import {
  QUOTE_CATEGORIES,
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
import {
  QUOTE_TEMPLATES,
  composeQuoteSvg,
  type QuoteTemplateId,
} from "./quote-templates";

interface QuoteWizardProps {
  open: boolean;
  onClose: () => void;
  initialCategoryId?: string;
  initialPresetId?: string;
  initialTemplateId?: QuoteTemplateId;
}

export function QuoteWizard({ open, onClose, initialCategoryId, initialPresetId, initialTemplateId }: QuoteWizardProps) {
  const router = useRouter();
  const { showToast } = useToast();

  const [step, setStep] = useState<number>(initialPresetId ? 1 : 0);
  const [categoryId, setCategoryId] = useState<string>(
    initialCategoryId && findCategory(initialCategoryId) ? initialCategoryId : "quote-card"
  );
  const [presetId, setPresetId] = useState<string>(initialPresetId ?? "ig-square");
  const [showAllSizes, setShowAllSizes] = useState(false);
  const [quote, setQuote] = useState("");
  const [attribution, setAttribution] = useState("");
  const [source, setSource] = useState("");
  const [templateId, setTemplateId] = useState<QuoteTemplateId>(initialTemplateId ?? "amber-on-dark");
  const [submitting, setSubmitting] = useState(false);

  const category: Category | undefined = useMemo(() => findCategory(categoryId), [categoryId]);
  const visibleGroups: SizeGroup[] = useMemo(() => category?.sizeGroups ?? [], [category]);
  const recommendedPresets: SizePreset[] = useMemo(
    () =>
      (category?.recommendedPresets ?? [])
        .map((id) => findPreset(id))
        .filter((p): p is SizePreset => !!p),
    [category]
  );
  const preset = useMemo(() => findPreset(presetId), [presetId]);

  function reset() {
    setStep(0);
    setCategoryId("quote-card");
    setPresetId("ig-square");
    setShowAllSizes(false);
    setQuote("");
    setAttribution("");
    setSource("");
    setTemplateId("amber-on-dark");
    setSubmitting(false);
  }

  function close() {
    if (submitting) return;
    reset();
    onClose();
  }

  const canGoNext = (() => {
    if (step === 0) return !!presetId;
    if (step === 1) return quote.trim().length >= 4 && attribution.trim().length > 0;
    if (step === 2) return !submitting && !!templateId;
    return false;
  })();

  async function submit() {
    if (submitting) return;
    if (!preset) return;
    setSubmitting(true);
    try {
      const svg = composeQuoteSvg(templateId, {
        quote: quote.trim(),
        attribution: attribution.trim(),
        source: source.trim() || undefined,
        w: preset.w,
        h: preset.h,
      });
      const artboard = {
        id: "p1",
        w: preset.w,
        h: preset.h,
        label: "Quote card",
        svg,
      };
      const payload = {
        name: quote.trim().slice(0, 60) || "Quote card",
        type: "quote" as const,
        fidelity: "high" as const,
        size_preset: preset.id,
        category: categoryId,
        purpose: categoryId,
        brief: {
          title: quote.trim(),
          subtitle: attribution.trim(),
          context: source.trim() || undefined,
          tone: templateId,
        },
        format: "svg",
        artboards: [artboard],
      };
      const res = await fetch("/api/docu-design/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) {
        showToast(j.error || "Couldn't save quote card");
        setSubmitting(false);
        return;
      }
      const id = j.data?.id;
      reset();
      onClose();
      const params = new URLSearchParams({
        category: "quote",
        w: String(preset.w),
        h: String(preset.h),
        name: quote.trim().slice(0, 60) || "Quote card",
        template: preset.w === preset.h ? "quote-minimal" : "quote-big-text",
      });
      if (id) params.set("project", id);
      router.push(`/design-studio/canvas-editor?${params.toString()}`);
    } catch (e) {
      showToast(String(e));
      setSubmitting(false);
    }
  }

  return (
    <WizardShell
      open={open}
      title={WIZARD_TITLES[step]}
      badge="QUOTE CARD"
      step={step}
      totalSteps={3}
      canGoNext={canGoNext}
      isFinalStep={step === 2}
      finalLabel={submitting ? "Creating…" : "Create card"}
      onBack={() => setStep((s) => Math.max(0, s - 1))}
      onNext={() => (step === 2 ? submit() : setStep((s) => Math.min(2, s + 1)))}
      onClose={close}
    >
      {step === 0 ? (
        <SizeStep
          categoryId={categoryId}
          setCategoryId={(id) => {
            setCategoryId(id);
            const c = findCategory(id);
            if (c?.defaultPreset) setPresetId(c.defaultPreset);
          }}
          allCategories={QUOTE_CATEGORIES}
          recommended={recommendedPresets}
          allGroups={visibleGroups}
          presetId={presetId}
          setPresetId={setPresetId}
          showAll={showAllSizes}
          setShowAll={setShowAllSizes}
        />
      ) : null}

      {step === 1 ? (
        <CopyStep
          quote={quote}
          setQuote={setQuote}
          attribution={attribution}
          setAttribution={setAttribution}
          source={source}
          setSource={setSource}
        />
      ) : null}

      {step === 2 && preset ? (
        <TemplateStep
          quote={quote.trim()}
          attribution={attribution.trim()}
          source={source.trim() || undefined}
          w={preset.w}
          h={preset.h}
          selected={templateId}
          onSelect={setTemplateId}
        />
      ) : null}
    </WizardShell>
  );
}

const WIZARD_TITLES = ["Pick a size", "What's the quote?", "Pick a style"];

// ─── Step 0 — Size ──────────────────────────────────────────────────
function SizeStep({
  categoryId,
  setCategoryId,
  allCategories,
  recommended,
  allGroups,
  presetId,
  setPresetId,
  showAll,
  setShowAll,
}: {
  categoryId: string;
  setCategoryId: (id: string) => void;
  allCategories: Category[];
  recommended: SizePreset[];
  allGroups: SizeGroup[];
  presetId: string;
  setPresetId: (id: string) => void;
  showAll: boolean;
  setShowAll: (v: boolean) => void;
}) {
  const orderedGroups = GROUP_ORDER.filter((g) => allGroups.includes(g.group));
  return (
    <div>
      <div style={wizardLabel}>Format</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        {allCategories.map((c) => {
          const active = categoryId === c.id;
          return (
            <button
              type="button"
              key={c.id}
              onClick={() => setCategoryId(c.id)}
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
              <div style={{ fontSize: 13 }}>{c.label}</div>
              <div style={{ fontSize: 11, color: D.txm, marginTop: 2 }}>{c.sub}</div>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <div style={wizardLabel}>Size</div>
        <button type="button" onClick={() => setShowAll(!showAll)} style={{ background: "transparent", border: "none", color: D.amber, fontFamily: ft, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>
          {showAll ? "show fewer" : "show all sizes"}
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
        {recommended.map((p) => (
          <PresetTile key={p.id} p={p} active={presetId === p.id} onClick={() => setPresetId(p.id)} />
        ))}
      </div>

      {showAll
        ? orderedGroups.map((g) => {
            const set = new Set(recommended.map((r) => r.id));
            const items = SIZE_PRESETS.filter((p) => p.group === g.group && !set.has(p.id));
            if (!items.length) return null;
            return (
              <div key={g.group} style={{ marginTop: 12 }}>
                <div style={wizardLabel}>{g.label}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
                  {items.map((p) => (
                    <PresetTile key={p.id} p={p} active={presetId === p.id} onClick={() => setPresetId(p.id)} />
                  ))}
                </div>
              </div>
            );
          })
        : null}
    </div>
  );
}

function PresetTile({ p, active, onClick }: { p: SizePreset; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
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
      <div style={{ fontSize: 12, lineHeight: 1.3 }}>{p.label}</div>
      <div style={{ fontSize: 10, fontFamily: mn, color: D.txd, marginTop: 2, letterSpacing: 0.4 }}>
        {p.w} × {p.h} {p.units}
      </div>
    </button>
  );
}

// ─── Step 1 — Copy ──────────────────────────────────────────────────
function CopyStep({
  quote,
  setQuote,
  attribution,
  setAttribution,
  source,
  setSource,
}: {
  quote: string;
  setQuote: (v: string) => void;
  attribution: string;
  setAttribution: (v: string) => void;
  source: string;
  setSource: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <label style={wizardLabel}>Quote</label>
        <textarea
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          placeholder="The most important thing for the GPU market over the next 18 months isn't compute density — it's substrate."
          style={{ ...wizardTextarea, minHeight: 110 }}
          autoFocus
        />
      </div>
      <div>
        <label style={wizardLabel}>Attribution</label>
        <input
          type="text"
          value={attribution}
          onChange={(e) => setAttribution(e.target.value)}
          placeholder="Dylan Patel · SemiAnalysis"
          style={wizardInput}
        />
      </div>
      <div>
        <label style={wizardLabel}>Source (optional)</label>
        <input
          type="text"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="SA Weekly Ep. 42 · May 2026"
          style={wizardInput}
        />
      </div>
    </div>
  );
}

// ─── Step 2 — Template ──────────────────────────────────────────────
function TemplateStep({
  quote,
  attribution,
  source,
  w,
  h,
  selected,
  onSelect,
}: {
  quote: string;
  attribution: string;
  source?: string;
  w: number;
  h: number;
  selected: QuoteTemplateId;
  onSelect: (id: QuoteTemplateId) => void;
}) {
  return (
    <div>
      <div style={{ fontFamily: ft, fontSize: 13, color: D.txm, marginBottom: 14, lineHeight: 1.5 }}>
        Pick a style. The preview uses your exact quote — what you see is what you get.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {QUOTE_TEMPLATES.map((t) => {
          const svg = composeQuoteSvg(t.id, { quote, attribution, source, w, h });
          const active = selected === t.id;
          return (
            <button
              type="button"
              key={t.id}
              onClick={() => onSelect(t.id)}
              style={{
                padding: 0,
                background: "transparent",
                border: `2px solid ${active ? D.amber : D.border}`,
                borderRadius: 12,
                cursor: "pointer",
                overflow: "hidden",
                textAlign: "left",
              }}
            >
              <div
                style={{ width: "100%", aspectRatio: `${w} / ${h}`, background: "#06060C" }}
                dangerouslySetInnerHTML={{ __html: svg }}
              />
              <div style={{ padding: "8px 10px", background: D.card, borderTop: `1px solid ${D.border}` }}>
                <div style={{ fontFamily: ft, fontSize: 13, color: D.tx, marginBottom: 2 }}>{t.label}</div>
                <div style={{ fontFamily: ft, fontSize: 11, color: D.txm }}>{t.sub}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
