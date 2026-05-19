"use client";

// Two-step Graphics wizard — creates a graphic-type project that opens
// directly in the Polotno Canva-style editor (under /design-studio/graphics/[id]).
// Steps: category + size → quick brief. Polotno picks up size_preset and
// renders a blank artboard at the right dimensions.

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { D, ft, gf, mn } from "../../shared-constants";
import { useToast } from "../../toast-context";
import {
  WizardShell,
  wizardLabel,
  wizardInput,
} from "./wizard-shell";
import {
  GRAPHIC_CATEGORIES,
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

interface GraphicWizardProps {
  open: boolean;
  onClose: () => void;
  initialCategoryId?: string;
  initialPresetId?: string;
}

export function GraphicWizard({ open, onClose, initialCategoryId, initialPresetId }: GraphicWizardProps) {
  const router = useRouter();
  const { showToast } = useToast();

  const initialCat = initialCategoryId ? findCategory(initialCategoryId) : undefined;
  const [step, setStep] = useState<number>(initialCat && initialPresetId ? 1 : 0);
  const [categoryId, setCategoryId] = useState(initialCat?.id ?? "");
  const [presetId, setPresetId] = useState(initialPresetId ?? initialCat?.defaultPreset ?? "");
  const [showAllSizes, setShowAllSizes] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const category: Category | undefined = useMemo(() => findCategory(categoryId), [categoryId]);
  const visibleGroups: SizeGroup[] = useMemo(() => category?.sizeGroups ?? [], [category]);
  const recommended: SizePreset[] = useMemo(
    () =>
      (category?.recommendedPresets ?? [])
        .map((id) => findPreset(id))
        .filter((p): p is SizePreset => !!p),
    [category]
  );

  function reset() {
    setStep(0);
    setCategoryId("");
    setPresetId("");
    setShowAllSizes(false);
    setName("");
    setSubmitting(false);
  }
  function close() {
    if (submitting) return;
    reset();
    onClose();
  }

  const canGoNext = (() => {
    if (step === 0) return !!categoryId && !!presetId;
    if (step === 1) return name.trim().length > 0 && !submitting;
    return false;
  })();

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const preset = findPreset(presetId);
      const payload = {
        name: name.trim(),
        type: "graphic" as const,
        fidelity: "high" as const,
        size_preset: preset?.id ?? null,
        category: categoryId,
        purpose: categoryId,
        brief: { title: name.trim() },
        format: "svg",
      };
      const res = await fetch("/api/docu-design/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) {
        showToast(j.error || "Couldn't create graphic");
        setSubmitting(false);
        return;
      }
      const id = j.data?.id;
      reset();
      onClose();
      if (id) router.push(`/design-studio/graphics/${id}`);
    } catch (e) {
      showToast(String(e));
      setSubmitting(false);
    }
  }

  return (
    <WizardShell
      open={open}
      title={step === 0 ? "What are you making?" : "Name your project"}
      badge="GRAPHICS"
      step={step}
      totalSteps={2}
      canGoNext={canGoNext}
      isFinalStep={step === 1}
      finalLabel={submitting ? "Creating…" : "Open editor"}
      onBack={() => setStep((s) => Math.max(0, s - 1))}
      onNext={() => (step === 1 ? submit() : setStep((s) => Math.min(1, s + 1)))}
      onClose={close}
    >
      {step === 0 ? (
        <Step1
          categoryId={categoryId}
          setCategoryId={(id) => {
            setCategoryId(id);
            const c = findCategory(id);
            if (c?.defaultPreset) setPresetId(c.defaultPreset);
          }}
          recommended={recommended}
          allGroups={visibleGroups}
          presetId={presetId}
          setPresetId={setPresetId}
          showAll={showAllSizes}
          setShowAll={setShowAllSizes}
        />
      ) : null}

      {step === 1 ? (
        <div>
          <label style={wizardLabel}>Project name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Q2 LinkedIn campaign cover"
            style={wizardInput}
            autoFocus
          />
          <div style={{ marginTop: 10, fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4 }}>
            The Graphics editor opens with a blank {findPreset(presetId)?.label || "canvas"}.
          </div>
        </div>
      ) : null}
    </WizardShell>
  );
}

function Step1({
  categoryId,
  setCategoryId,
  recommended,
  allGroups,
  presetId,
  setPresetId,
  showAll,
  setShowAll,
}: {
  categoryId: string;
  setCategoryId: (id: string) => void;
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
      <div style={wizardLabel}>Category</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8, marginBottom: 16 }}>
        {GRAPHIC_CATEGORIES.map((c) => {
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
              <div style={{ fontFamily: gf, fontSize: 13, marginBottom: 2 }}>{c.label}</div>
              <div style={{ fontSize: 11, color: D.txm }}>{c.sub}</div>
            </button>
          );
        })}
      </div>

      {categoryId ? (
        <>
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
        </>
      ) : null}
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
