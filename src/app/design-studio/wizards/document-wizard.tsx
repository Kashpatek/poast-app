"use client";

// Four-step guided flow for creating a DocuDesign document project.
// 1) Category (what is it)
// 2) Size / platform (where will it live)
// 3) Brief (title, key points, tone)
// 4) Context (audience, source material, design system override)
// Routes to /design-studio/doc-editor with category + name + template on the
// query string; the Tiptap editor seeds a fresh ProjectRecord on first mount
// and rewrites the URL with the generated id so refreshes resume cleanly.

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
  initialCategoryId?: string;
  initialPresetId?: string;
}

export function DocumentWizard({ open, onClose, initialCategoryId, initialPresetId }: DocumentWizardProps) {
  const router = useRouter();
  const { showToast } = useToast();

  // Initial-state from deep-link preselection. The parent passes a `key`
  // that changes when these inputs change, so the wizard remounts fresh
  // and these initializers re-run.
  const initialCat = initialCategoryId ? findCategory(initialCategoryId) : undefined;
  const [step, setStep] = useState<number>(initialCat ? (initialPresetId ? 2 : 1) : 0);
  const [categoryId, setCategoryId] = useState<string>(initialCat?.id ?? "");
  const [presetId, setPresetId] = useState<string>(initialPresetId ?? initialCat?.defaultPreset ?? "");
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
      // Route into the new Tiptap doc editor. The editor seeds a fresh
      // ProjectRecord (kind="doc") from these query params on first mount
      // and rewrites the URL with the generated id, so refreshes resume.
      const qs = new URLSearchParams();
      qs.set("category", cat.id);
      qs.set("name", title.trim() || "Untitled document");
      const preset = presetId === "__custom__" ? null : findPreset(presetId);
      if (preset?.id) qs.set("template", preset.id);

      // Pipe the brief through so the doc editor can seed the body with a
      // structured outline. Each field is trimmed and capped at 200 chars
      // to keep the URL short. keyPoints is comma-joined (newlines become
      // commas) since it was collected as one-per-line in the textarea.
      const cap = (s: string) => s.trim().slice(0, 200);
      const subT = cap(subtitle);
      if (subT) qs.set("subtitle", subT);
      const kp = cap(
        keyPoints
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
          .join(", ")
      );
      if (kp) qs.set("keyPoints", kp);
      const toneT = cap(tone);
      if (toneT) qs.set("tone", toneT);
      const audT = cap(audience);
      if (audT) qs.set("audience", audT);
      const ctxT = cap(context);
      if (ctxT) qs.set("context", ctxT);

      reset();
      onClose();
      router.push(`/design-studio/doc-editor?${qs.toString()}`);
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

      {step === 1 && category ? (
        <SizeStep
          category={category}
          allPresets={SIZE_PRESETS}
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
// Curated UX: show a tight grid of category-recommended sizes first,
// with a "Show all sizes" toggle that reveals the full catalog grouped
// by platform. Custom dimensions live at the bottom either way.
function SizeStep({
  category,
  allPresets,
  groups,
  value,
  onChange,
  custom,
  onCustomChange,
}: {
  category: Category;
  allPresets: SizePreset[];
  groups: SizeGroup[];
  value: string;
  onChange: (id: string) => void;
  custom: { w: string; h: string };
  onCustomChange: (c: { w: string; h: string }) => void;
}) {
  const [showAll, setShowAll] = useState(false);

  const recommended: SizePreset[] = (category.recommendedPresets ?? [])
    .map((id) => findPreset(id))
    .filter((p): p is SizePreset => !!p);

  const orderedGroups = GROUP_ORDER.filter((g) => groups.includes(g.group));

  return (
    <div>
      <div style={{ fontFamily: ft, fontSize: 14, color: D.txm, marginBottom: 14, lineHeight: 1.5 }}>
        Pick a size for your {category.label.toLowerCase()}. We picked the most common ones —
        hit{" "}
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          style={{
            background: "transparent",
            border: "none",
            color: D.amber,
            fontFamily: ft,
            fontSize: 14,
            cursor: "pointer",
            padding: 0,
            textDecoration: "underline",
          }}
        >
          {showAll ? "show fewer" : "show all sizes"}
        </button>{" "}
        for the full list.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxHeight: 380, overflowY: "auto", paddingRight: 4 }}>
        {/* Recommended row — always visible */}
        {recommended.length ? (
          <div>
            <div style={wizardLabel}>Recommended</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
              {recommended.map((p) => (
                <PresetTile key={p.id} p={p} active={value === p.id} onClick={() => onChange(p.id)} />
              ))}
            </div>
          </div>
        ) : null}

        {/* Full catalog — collapsed by default */}
        {showAll
          ? orderedGroups.map((g) => {
              const items = allPresets.filter(
                (p) => p.group === g.group && !(category.recommendedPresets ?? []).includes(p.id)
              );
              if (!items.length) return null;
              return (
                <div key={g.group}>
                  <div style={wizardLabel}>{g.label}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
                    {items.map((p) => (
                      <PresetTile key={p.id} p={p} active={value === p.id} onClick={() => onChange(p.id)} />
                    ))}
                  </div>
                </div>
              );
            })
          : null}

        {/* Custom — always visible at the bottom */}
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

function PresetTile({ p, active, onClick }: { p: SizePreset; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: "10px 12px",
        background: active ? "rgba(247,176,65,0.10)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${active ? D.amber : D.border}`,
        borderRadius: 8,
        color: D.tx,
        cursor: "pointer",
        fontFamily: ft,
        transition: "background 0.15s ease, border-color 0.15s ease",
      }}
    >
      <div style={{ fontSize: 12.5, lineHeight: 1.3 }}>{p.label}</div>
      <div style={{ fontSize: 10, fontFamily: mn, color: D.txd, marginTop: 3, letterSpacing: 0.4 }}>
        {p.w} × {p.h} {p.units}{p.dpi ? ` · ${p.dpi}dpi` : ""}
      </div>
    </button>
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
