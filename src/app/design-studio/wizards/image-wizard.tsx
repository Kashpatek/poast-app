"use client";

// Two-step Image Studio wizard:
// 1) Category + size (curated, with show-all toggle)
// 2) Prompt + style preset → generate 3 Grok variants → pick → save as
//    an image-type project. Project shows up in Recent and opens to a
//    gallery view (see project-client).

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { D, ft, gf, mn } from "../../shared-constants";
import { useToast } from "../../toast-context";
import {
  WizardShell,
  wizardLabel,
  wizardInput,
  wizardTextarea,
} from "./wizard-shell";
import {
  IMAGE_CATEGORIES,
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

interface ImageWizardProps {
  open: boolean;
  onClose: () => void;
  initialCategoryId?: string;
  initialPresetId?: string;
}

const STYLE_OPTIONS = [
  { id: "cinematic",      label: "Cinematic",      sub: "Film-still, dramatic lighting" },
  { id: "photorealistic", label: "Photorealistic", sub: "Studio-lit tech media" },
  { id: "abstract",       label: "Abstract",       sub: "Particles, neon, mood-led" },
  { id: "dataviz",        label: "Data viz",       sub: "Clean infographic energy" },
  { id: "editorial",      label: "Editorial",      sub: "Magazine-cover composition" },
];

export function ImageWizard({ open, onClose, initialCategoryId, initialPresetId }: ImageWizardProps) {
  const router = useRouter();
  const { showToast } = useToast();

  const initialCat = initialCategoryId ? findCategory(initialCategoryId) : undefined;
  const [step, setStep] = useState<number>(initialCat && initialPresetId ? 1 : 0);
  const [categoryId, setCategoryId] = useState(initialCat?.id ?? "");
  const [presetId, setPresetId] = useState(initialPresetId ?? initialCat?.defaultPreset ?? "");
  const [showAllSizes, setShowAllSizes] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("cinematic");
  const [name, setName] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [generating, setGenerating] = useState(false);
  const [variants, setVariants] = useState<string[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const category: Category | undefined = useMemo(() => findCategory(categoryId), [categoryId]);
  const visibleGroups: SizeGroup[] = useMemo(() => category?.sizeGroups ?? [], [category]);
  const recommendedPresets: SizePreset[] = useMemo(
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
    setPrompt("");
    setStyle("cinematic");
    setName("");
    setReferenceUrl("");
    setGenerating(false);
    setVariants([]);
    setPicked(null);
    setSaving(false);
  }

  function close() {
    if (generating || saving) return;
    reset();
    onClose();
  }

  const canGoNext = (() => {
    if (step === 0) return !!categoryId && !!presetId;
    if (step === 1) return prompt.trim().length > 4 && !generating && !saving;
    return false;
  })();

  async function generate() {
    if (generating) return;
    setGenerating(true);
    setVariants([]);
    setPicked(null);
    try {
      const res = await fetch("/api/generate-thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept: prompt.trim(),
          style,
          title: name.trim() || undefined,
          referenceImageUrl: referenceUrl.trim() || undefined,
          count: 3,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        showToast(j.error || "Generation failed");
        setGenerating(false);
        return;
      }
      setVariants((j.images as string[]) || []);
    } catch (e) {
      showToast(String(e));
    } finally {
      setGenerating(false);
    }
  }

  async function saveAndOpen() {
    if (saving || picked === null) return;
    setSaving(true);
    try {
      const preset = findPreset(presetId);
      const projectName = name.trim() || prompt.trim().slice(0, 60);
      // Route into the Fabric canvas editor — it owns the Uploads tab and
      // image layer that this wizard's variants will drop into. The
      // canvas-editor page seeds a fresh ProjectRecord (kind="canvas") from
      // these query params on first mount and rewrites the URL with the
      // generated id, so refreshes resume.
      const qs = new URLSearchParams();
      qs.set("category", "image");
      qs.set("name", projectName);
      if (preset?.w) qs.set("w", String(preset.w));
      if (preset?.h) qs.set("h", String(preset.h));
      if (preset?.id) qs.set("template", preset.id);
      reset();
      onClose();
      router.push(`/design-studio/canvas-editor?${qs.toString()}`);
    } catch (e) {
      showToast(String(e));
      setSaving(false);
    }
  }

  return (
    <WizardShell
      open={open}
      title={step === 0 ? "What kind of image?" : "Describe it"}
      badge="IMAGE STUDIO"
      step={step}
      totalSteps={2}
      canGoNext={canGoNext}
      isFinalStep={step === 1}
      nextLabel="Next"
      finalLabel={picked !== null ? (saving ? "Saving…" : "Use this image") : (generating ? "Generating…" : "Generate")}
      onBack={() => setStep((s) => Math.max(0, s - 1))}
      onNext={() => {
        if (step === 0) setStep(1);
        else if (picked !== null) saveAndOpen();
        else generate();
      }}
      onClose={close}
    >
      {step === 0 ? (
        <Step1
          category={categoryId}
          onCategory={(id) => {
            setCategoryId(id);
            const c = findCategory(id);
            if (c?.defaultPreset) setPresetId(c.defaultPreset);
          }}
          recommended={recommendedPresets}
          allGroups={visibleGroups}
          presetId={presetId}
          onPreset={setPresetId}
          showAll={showAllSizes}
          setShowAll={setShowAllSizes}
        />
      ) : null}

      {step === 1 ? (
        <Step2
          name={name}
          setName={setName}
          prompt={prompt}
          setPrompt={setPrompt}
          style={style}
          setStyle={setStyle}
          referenceUrl={referenceUrl}
          setReferenceUrl={setReferenceUrl}
          variants={variants}
          generating={generating}
          picked={picked}
          setPicked={setPicked}
          onRegen={generate}
        />
      ) : null}
    </WizardShell>
  );
}

// ─── Step 1 — Category + Size ─────────────────────────────────────────
function Step1({
  category,
  onCategory,
  recommended,
  allGroups,
  presetId,
  onPreset,
  showAll,
  setShowAll,
}: {
  category: string;
  onCategory: (id: string) => void;
  recommended: SizePreset[];
  allGroups: SizeGroup[];
  presetId: string;
  onPreset: (id: string) => void;
  showAll: boolean;
  setShowAll: (v: boolean) => void;
}) {
  const orderedGroups = GROUP_ORDER.filter((g) => allGroups.includes(g.group));

  return (
    <div>
      <div style={wizardLabel}>Category</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8, marginBottom: 18 }}>
        {IMAGE_CATEGORIES.map((c) => {
          const active = category === c.id;
          return (
            <button
              type="button"
              key={c.id}
              onClick={() => onCategory(c.id)}
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
              <div style={{ fontFamily: gf, fontSize: 13, marginBottom: 3 }}>{c.label}</div>
              <div style={{ fontSize: 11, color: D.txm, lineHeight: 1.35 }}>{c.sub}</div>
            </button>
          );
        })}
      </div>

      {category ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <div style={wizardLabel}>Aspect / size</div>
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              style={{ background: "transparent", border: "none", color: D.amber, fontFamily: ft, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}
            >
              {showAll ? "show fewer" : "show all sizes"}
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8, marginBottom: 12 }}>
            {recommended.map((p) => (
              <SizeTile key={p.id} p={p} active={presetId === p.id} onClick={() => onPreset(p.id)} />
            ))}
          </div>

          {showAll
            ? orderedGroups.map((g) => {
                const set = new Set((recommended ?? []).map((r) => r.id));
                const items = SIZE_PRESETS.filter((p) => p.group === g.group && !set.has(p.id));
                if (!items.length) return null;
                return (
                  <div key={g.group} style={{ marginTop: 12 }}>
                    <div style={wizardLabel}>{g.label}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
                      {items.map((p) => (
                        <SizeTile key={p.id} p={p} active={presetId === p.id} onClick={() => onPreset(p.id)} />
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

function SizeTile({ p, active, onClick }: { p: SizePreset; active: boolean; onClick: () => void }) {
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

// ─── Step 2 — Prompt + Generate ─────────────────────────────────────
function Step2({
  name,
  setName,
  prompt,
  setPrompt,
  style,
  setStyle,
  referenceUrl,
  setReferenceUrl,
  variants,
  generating,
  picked,
  setPicked,
  onRegen,
}: {
  name: string;
  setName: (v: string) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  style: string;
  setStyle: (v: string) => void;
  referenceUrl: string;
  setReferenceUrl: (v: string) => void;
  variants: string[];
  generating: boolean;
  picked: number | null;
  setPicked: (i: number | null) => void;
  onRegen: () => void;
}) {
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <label style={wizardLabel}>Project name (optional)</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Blackwell launch hero"
          style={wizardInput}
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={wizardLabel}>Prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the image. e.g. 'A glowing GPU die rendered as architectural blueprint over deep black, single amber accent line, technical and institutional mood.'"
          style={{ ...wizardTextarea, minHeight: 110 }}
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={wizardLabel}>Style</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
          {STYLE_OPTIONS.map((s) => {
            const active = style === s.id;
            return (
              <button
                type="button"
                key={s.id}
                onClick={() => setStyle(s.id)}
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
                <div style={{ fontSize: 13 }}>{s.label}</div>
                <div style={{ fontSize: 11, color: D.txm, marginTop: 2 }}>{s.sub}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={wizardLabel}>Reference image URL (optional)</label>
        <input
          type="text"
          value={referenceUrl}
          onChange={(e) => setReferenceUrl(e.target.value)}
          placeholder="https://… — passed through for future iterate-on-image flows"
          style={wizardInput}
        />
      </div>

      {variants.length ? (
        <div style={{ marginTop: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <div style={wizardLabel}>Variants — pick one to use</div>
            <button
              type="button"
              onClick={onRegen}
              disabled={generating}
              style={{ background: "transparent", border: "none", color: D.amber, fontFamily: ft, fontSize: 12, cursor: generating ? "wait" : "pointer", textDecoration: "underline" }}
            >
              {generating ? "Regenerating…" : "Regenerate"}
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {variants.map((url, i) => (
              <button
                type="button"
                key={i}
                onClick={() => setPicked(i)}
                style={{
                  padding: 0,
                  border: `2px solid ${picked === i ? D.amber : "transparent"}`,
                  borderRadius: 10,
                  background: "transparent",
                  cursor: "pointer",
                  overflow: "hidden",
                  position: "relative",
                  aspectRatio: "1 / 1",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Variant ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                {picked === i ? (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(247,176,65,0.18)" }} />
                ) : null}
                <div style={{ position: "absolute", bottom: 4, left: 6, fontFamily: mn, fontSize: 9, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,0.7)", letterSpacing: 0.4 }}>
                  V{i + 1}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {generating && !variants.length ? (
        <div style={{ fontFamily: mn, fontSize: 11, color: D.amber, marginTop: 16, letterSpacing: 0.4 }}>
          Generating 3 variants via Grok (~30-45 sec)…
        </div>
      ) : null}
    </div>
  );
}
