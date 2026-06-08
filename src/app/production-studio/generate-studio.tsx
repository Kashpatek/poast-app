"use client";

// Generate Studio — direct playground for every image + video provider
// POAST has API access to. The provider registry (src/lib/generation-
// providers.ts) drives the knob panel + live cost preview, so adding a
// new vendor is two file changes (registry entry + backend dispatch).

import { useEffect, useMemo, useRef, useState } from "react";
import {
  PROVIDERS,
  providersByKind,
  getProvider,
  estimateCost,
  formatCost,
  type Provider,
  type Kind,
  type KnobValues,
} from "@/lib/generation-providers";
import { D as C, ft, gf, mn } from "../shared-constants";
import { showToast } from "../toast-context";

interface GenerationRecord {
  id: string;
  providerId: string;
  providerName: string;
  kind: Kind;
  prompt: string;
  knobs: KnobValues;
  costEstimate: number;
  results: Array<{ url: string; type: "image" | "video" }>;
  taskId?: string;
  status: "processing" | "succeeded" | "failed";
  progress: number;
  createdAt: number;
}

const HISTORY_KEY = "poast-generate-studio-history-v1";
const HISTORY_CAP = 30;

function loadHistory(): GenerationRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as GenerationRecord[];
  } catch {
    return [];
  }
}

function saveHistory(records: GenerationRecord[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(records.slice(0, HISTORY_CAP)));
  } catch {}
}

function uid(): string {
  return "g-" + Math.random().toString(36).slice(2, 10);
}

export default function GenerateStudio() {
  const [kind, setKind] = useState<Kind>("image");
  const imageProviders = useMemo(() => providersByKind("image"), []);
  const videoProviders = useMemo(() => providersByKind("video"), []);

  const [providerId, setProviderId] = useState<string>(imageProviders[0].id);
  const [prompt, setPrompt] = useState("");
  const [knobs, setKnobs] = useState<KnobValues>({});
  const [generating, setGenerating] = useState(false);
  const [active, setActive] = useState<GenerationRecord | null>(null);
  const [history, setHistory] = useState<GenerationRecord[]>([]);
  const [refUploadDrag, setRefUploadDrag] = useState(false);

  const provider = getProvider(providerId)!;
  const cost = useMemo(() => estimateCost(provider, knobs), [provider, knobs]);

  // Bootstrap from localStorage on mount.
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // Whenever the kind tab flips, jump to its first provider + reset knobs.
  useEffect(() => {
    const first = (kind === "image" ? imageProviders : videoProviders)[0];
    setProviderId(first.id);
    setKnobs(defaultKnobsFor(first));
  }, [kind, imageProviders, videoProviders]);

  // When provider changes (same kind), reset knobs to that provider's defaults.
  useEffect(() => {
    setKnobs(defaultKnobsFor(provider));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId]);

  // Persist history on every update.
  useEffect(() => {
    saveHistory(history);
  }, [history]);

  const pollRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  function startPoll(record: GenerationRecord) {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      try {
        const r = await fetch("/api/generate-studio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "status",
            providerId: record.providerId,
            taskId: record.taskId,
          }),
        });
        const d = await r.json();
        if (!r.ok || d.error) {
          showToast("Status check failed: " + (d.error || r.statusText));
          if (pollRef.current) window.clearInterval(pollRef.current);
          return;
        }
        const task = d.task || {};
        const progress = typeof task.progress === "number" ? task.progress : record.progress;
        const status = task.status as "processing" | "succeeded" | "failed";
        if (status === "succeeded") {
          const items = (task.images || task.videos || []) as { url: string }[];
          const results = items.map((it) => ({
            url: it.url,
            type: record.kind === "image" ? "image" as const : "video" as const,
          }));
          const next: GenerationRecord = { ...record, results, progress: 100, status: "succeeded" };
          setActive(next);
          setHistory((h) => [next, ...h.filter((x) => x.id !== record.id)]);
          setGenerating(false);
          if (pollRef.current) window.clearInterval(pollRef.current);
        } else if (status === "failed") {
          const next: GenerationRecord = { ...record, progress: 100, status: "failed" };
          setActive(next);
          setHistory((h) => [next, ...h.filter((x) => x.id !== record.id)]);
          setGenerating(false);
          showToast("Generation failed.");
          if (pollRef.current) window.clearInterval(pollRef.current);
        } else {
          const updated: GenerationRecord = { ...record, progress };
          setActive(updated);
        }
      } catch (e) {
        showToast("Poll error: " + String(e));
      }
    }, 5000);
  }

  async function handleGenerate() {
    if (!prompt.trim()) { showToast("Prompt required."); return; }
    if (provider.knobs.supportsReferenceImage && !knobs.referenceImageDataUrl && provider.id === "runway-video") {
      showToast("Runway video needs a reference image.");
      return;
    }
    setGenerating(true);
    const rec: GenerationRecord = {
      id: uid(),
      providerId: provider.id,
      providerName: provider.name,
      kind: provider.kind,
      prompt: prompt.trim(),
      knobs,
      costEstimate: cost.dollars,
      results: [],
      status: "processing",
      progress: 5,
      createdAt: Date.now(),
    };
    setActive(rec);

    try {
      const r = await fetch("/api/generate-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          providerId: provider.id,
          prompt: prompt.trim(),
          knobs,
        }),
      });
      const d = await r.json();
      if (!r.ok || d.error) {
        showToast("Generate failed: " + (d.error || r.statusText));
        const next: GenerationRecord = { ...rec, status: "failed", progress: 100 };
        setActive(next);
        setHistory((h) => [next, ...h]);
        setGenerating(false);
        return;
      }
      // Sync image response (Imagen / Grok image).
      if (d.images && Array.isArray(d.images)) {
        const results = (d.images as { url: string }[]).map((it) => ({ url: it.url, type: "image" as const }));
        const next: GenerationRecord = { ...rec, results, status: "succeeded", progress: 100 };
        setActive(next);
        setHistory((h) => [next, ...h]);
        setGenerating(false);
        return;
      }
      // Async task — start polling.
      if (d.task && d.task.taskId) {
        const next: GenerationRecord = { ...rec, taskId: d.task.taskId, progress: d.task.progress || 5 };
        setActive(next);
        setHistory((h) => [next, ...h]);
        startPoll(next);
        return;
      }
      showToast("Unexpected response shape.");
      setGenerating(false);
    } catch (e) {
      showToast("Network error: " + String(e));
      setGenerating(false);
    }
  }

  function handleRefImageDrop(file: File | null | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { showToast("Only image files."); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target ? (e.target.result as string) : "";
      setKnobs((k) => ({ ...k, referenceImageDataUrl: url }));
    };
    reader.readAsDataURL(file);
  }

  function reuseHistory(rec: GenerationRecord) {
    setKind(rec.kind);
    setProviderId(rec.providerId);
    setPrompt(rec.prompt);
    setKnobs(rec.knobs);
    setActive(rec);
    showToast("Loaded from history.");
  }

  function clearHistory() {
    if (!confirm("Clear all generation history?")) return;
    setHistory([]);
  }

  return (
    <div style={{ minHeight: "calc(100vh - 56px)", background: C.bg, color: C.tx, padding: "28px 24px 56px" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <Header kind={kind} setKind={setKind} cost={cost.dollars} provider={provider} />

        <div style={{ display: "grid", gridTemplateColumns: "300px minmax(0, 1fr) 280px", gap: 18, marginTop: 22 }}>
          <ProviderPanel
            providers={kind === "image" ? imageProviders : videoProviders}
            providerId={providerId}
            setProviderId={setProviderId}
            cost={cost.dollars}
            estimate={cost.formula}
            costNotes={provider.pricing.notes}
            isEstimate={cost.isEstimate}
          />

          <div>
            <PromptPanel
              prompt={prompt}
              setPrompt={setPrompt}
              provider={provider}
              knobs={knobs}
              setKnobs={setKnobs}
              refUploadDrag={refUploadDrag}
              setRefUploadDrag={setRefUploadDrag}
              onRefDrop={handleRefImageDrop}
              onGenerate={handleGenerate}
              generating={generating}
              costLabel={formatCost(cost.dollars)}
            />
            <ActivePanel active={active} provider={provider} />
          </div>

          <HistoryPanel history={history} active={active} onPick={reuseHistory} onClear={clearHistory} />
        </div>

        <KnobLegend provider={provider} knobs={knobs} setKnobs={setKnobs} />
      </div>
    </div>
  );
}

// ─── HELPERS ───────────────────────────────────────────────────────────

function defaultKnobsFor(p: Provider): KnobValues {
  const k: KnobValues = {};
  if (p.knobs.aspectRatios && p.knobs.aspectRatios[0]) k.aspectRatio = p.knobs.aspectRatios[0].id;
  if (p.knobs.durations && p.knobs.durations[0]) k.duration = p.knobs.durations[0];
  k.count = p.knobs.defaultCount || 1;
  if (p.knobs.personGenerationOptions && p.knobs.personGenerationOptions[0]) {
    k.personGeneration = p.knobs.personGenerationOptions[0].id;
  }
  return k;
}

// ─── HEADER + KIND TABS ───────────────────────────────────────────────

function Header({ kind, setKind, cost, provider }: { kind: Kind; setKind: (k: Kind) => void; cost: number; provider: Provider }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 2, color: C.amber, textTransform: "uppercase", marginBottom: 6 }}>
          Generate Studio
        </div>
        <h1 style={{ fontFamily: gf, fontSize: 36, fontWeight: 900, letterSpacing: -0.8, margin: 0, color: C.tx }}>
          Spin up images and video from your API keys.
        </h1>
        <div style={{ fontFamily: ft, fontSize: 14, color: C.txm, marginTop: 6, maxWidth: 760 }}>
          Every provider POAST has an API key for. Knobs match what each model exposes — when the vendor doesn&apos;t support a setting, it&apos;s hidden.
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, padding: 4, background: C.card, borderRadius: 999, border: "1px solid " + C.border }}>
        {(["image", "video"] as Kind[]).map((k) => {
          const sel = kind === k;
          return (
            <button
              key={k}
              onClick={() => setKind(k)}
              style={{
                padding: "8px 18px",
                background: sel ? C.amber : "transparent",
                color: sel ? C.bg : C.txm,
                border: "none",
                borderRadius: 999,
                fontFamily: ft,
                fontSize: 13,
                fontWeight: 800,
                cursor: "pointer",
                letterSpacing: 0.3,
                textTransform: "uppercase",
              }}
            >
              {k}
            </button>
          );
        })}
        <div style={{ padding: "8px 14px 8px 12px", borderLeft: "1px solid " + C.border, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontFamily: mn, fontSize: 9, color: C.txd, letterSpacing: 1 }}>EST</span>
          <span style={{ fontFamily: mn, fontSize: 14, fontWeight: 800, color: C.teal }}>{formatCost(cost)}</span>
          <span style={{ fontFamily: mn, fontSize: 9, color: C.txd }}>{provider.vendor}</span>
        </div>
      </div>
    </div>
  );
}

// ─── PROVIDER PANEL ───────────────────────────────────────────────────

function ProviderPanel({
  providers,
  providerId,
  setProviderId,
  cost,
  estimate,
  costNotes,
  isEstimate,
}: {
  providers: Provider[];
  providerId: string;
  setProviderId: (id: string) => void;
  cost: number;
  estimate: string;
  costNotes?: string;
  isEstimate: boolean;
}) {
  return (
    <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 14, padding: "18px 16px", height: "fit-content" }}>
      <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>Provider</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {providers.map((p) => {
          const sel = providerId === p.id;
          return (
            <div
              key={p.id}
              onClick={() => setProviderId(p.id)}
              style={{
                padding: "12px 14px",
                background: sel ? C.amber + "10" : C.bg,
                border: "1px solid " + (sel ? C.amber + "60" : C.border),
                borderRadius: 10,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <div style={{ fontFamily: ft, fontSize: 13, fontWeight: 800, color: sel ? C.amber : C.tx, letterSpacing: -0.2 }}>{p.name}</div>
                <div style={{ fontFamily: mn, fontSize: 10, color: C.txd, letterSpacing: 0.4 }}>{p.vendor}</div>
              </div>
              <div style={{ fontFamily: ft, fontSize: 11, color: C.txm, lineHeight: 1.45, marginBottom: 6 }}>{p.description}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontFamily: mn, fontSize: 10, color: C.txd, letterSpacing: 0.5 }}>{priceLabel(p)}</span>
                {p.pricing.isEstimate && <span style={{ fontFamily: mn, fontSize: 8, color: C.coral, letterSpacing: 0.6 }}>~ EST</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16, padding: "14px 14px 12px", background: C.bg, border: "1px solid " + C.border, borderRadius: 10 }}>
        <div style={{ fontFamily: mn, fontSize: 9, color: C.teal, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 6 }}>Estimated cost</div>
        <div style={{ fontFamily: gf, fontSize: 26, fontWeight: 900, color: C.tx, letterSpacing: -0.4 }}>{formatCost(cost)}</div>
        <div style={{ fontFamily: mn, fontSize: 10, color: C.txm, marginTop: 4 }}>{estimate}</div>
        {isEstimate && <div style={{ fontFamily: mn, fontSize: 9, color: C.coral, marginTop: 6, lineHeight: 1.4 }}>~ Vendor pricing is preview / estimate.</div>}
        {costNotes && <div style={{ fontFamily: ft, fontSize: 10.5, color: C.txd, marginTop: 6, lineHeight: 1.4 }}>{costNotes}</div>}
      </div>
    </div>
  );
}

function priceLabel(p: Provider): string {
  if (p.pricing.unit === "image") return formatCost(p.pricing.basePerUnit) + " / image";
  if (p.pricing.unit === "video-second") return formatCost(p.pricing.basePerUnit) + " / sec";
  return formatCost(p.pricing.basePerUnit) + " / clip";
}

// ─── PROMPT + KNOBS PANEL ─────────────────────────────────────────────

function PromptPanel({
  prompt,
  setPrompt,
  provider,
  knobs,
  setKnobs,
  refUploadDrag,
  setRefUploadDrag,
  onRefDrop,
  onGenerate,
  generating,
  costLabel,
}: {
  prompt: string;
  setPrompt: (s: string) => void;
  provider: Provider;
  knobs: KnobValues;
  setKnobs: (k: KnobValues) => void;
  refUploadDrag: boolean;
  setRefUploadDrag: (b: boolean) => void;
  onRefDrop: (f: File | null | undefined) => void;
  onGenerate: () => void;
  generating: boolean;
  costLabel: string;
}) {
  return (
    <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 14, padding: 18 }}>
      <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Prompt</div>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={
          provider.kind === "image"
            ? "Describe the image. Be concrete: subject, environment, light, mood, composition."
            : "Describe the motion. Specify camera move, subject action, pacing, atmosphere."
        }
        rows={5}
        style={{
          width: "100%",
          padding: "14px 16px",
          background: C.bg,
          border: "1px solid " + C.border,
          borderRadius: 10,
          color: C.tx,
          fontFamily: ft,
          fontSize: 14,
          lineHeight: 1.55,
          resize: "vertical",
          outline: "none",
          boxSizing: "border-box",
        }}
      />

      {provider.knobs.supportsNegativePrompt && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 6 }}>Negative prompt</div>
          <input
            value={knobs.negativePrompt || ""}
            onChange={(e) => setKnobs({ ...knobs, negativePrompt: e.target.value })}
            placeholder="What to AVOID (warps, extra fingers, text, low quality...)"
            style={{
              width: "100%",
              padding: "10px 14px",
              background: C.bg,
              border: "1px solid " + C.border,
              borderRadius: 8,
              color: C.tx,
              fontFamily: ft,
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      )}

      {provider.knobs.supportsReferenceImage && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 6 }}>
            Reference image {provider.id === "runway-video" ? "· required" : "· optional"}
          </div>
          <label
            onDragOver={(e) => { e.preventDefault(); setRefUploadDrag(true); }}
            onDragLeave={() => setRefUploadDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setRefUploadDrag(false);
              if (e.dataTransfer.files.length) onRefDrop(e.dataTransfer.files[0]);
            }}
            style={{
              display: "block",
              padding: "16px",
              background: refUploadDrag ? C.amber + "10" : C.bg,
              border: "1px dashed " + (refUploadDrag ? C.amber : C.border),
              borderRadius: 8,
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            {knobs.referenceImageDataUrl ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <img src={knobs.referenceImageDataUrl} alt="reference" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6 }} />
                <div style={{ fontFamily: mn, fontSize: 10, color: C.txm }}>Click to swap, or drop a new image.</div>
              </div>
            ) : (
              <div>
                <div style={{ fontFamily: ft, fontSize: 12.5, fontWeight: 700, color: C.tx }}>Drop a reference image</div>
                <div style={{ fontFamily: mn, fontSize: 10, color: C.txd, marginTop: 4 }}>PNG, JPG, WEBP — embedded as a data URL</div>
              </div>
            )}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => onRefDrop(e.target.files && e.target.files[0])}
              style={{ display: "none" }}
            />
          </label>
        </div>
      )}

      <KnobsRow provider={provider} knobs={knobs} setKnobs={setKnobs} />

      <button
        onClick={onGenerate}
        disabled={generating || !prompt.trim()}
        style={{
          marginTop: 16,
          width: "100%",
          padding: "14px 18px",
          background: generating || !prompt.trim() ? C.surface : C.amber,
          color: generating || !prompt.trim() ? C.txd : C.bg,
          border: "none",
          borderRadius: 10,
          fontFamily: ft,
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: 0.4,
          cursor: generating || !prompt.trim() ? "not-allowed" : "pointer",
        }}
      >
        {generating ? "Generating..." : `Generate · ${costLabel}`}
      </button>
    </div>
  );
}

// ─── KNOBS ROW ────────────────────────────────────────────────────────

function KnobsRow({ provider, knobs, setKnobs }: { provider: Provider; knobs: KnobValues; setKnobs: (k: KnobValues) => void }) {
  return (
    <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
      {provider.knobs.aspectRatios && (
        <KnobSelect
          label="Aspect ratio"
          value={knobs.aspectRatio}
          onChange={(v) => setKnobs({ ...knobs, aspectRatio: v })}
          options={provider.knobs.aspectRatios.map((a) => ({ id: a.id, label: a.label }))}
        />
      )}
      {provider.knobs.durations && (
        <KnobSelect
          label="Duration (sec)"
          value={knobs.duration ? String(knobs.duration) : undefined}
          onChange={(v) => setKnobs({ ...knobs, duration: Number(v) })}
          options={provider.knobs.durations.map((d) => ({ id: String(d), label: `${d}s` }))}
        />
      )}
      {provider.knobs.countMax && provider.knobs.countMax > 1 && (
        <KnobSelect
          label={`Count (max ${provider.knobs.countMax})`}
          value={String(knobs.count || provider.knobs.defaultCount || 1)}
          onChange={(v) => setKnobs({ ...knobs, count: Number(v) })}
          options={Array.from({ length: provider.knobs.countMax }).map((_, i) => ({ id: String(i + 1), label: String(i + 1) }))}
        />
      )}
      {provider.knobs.personGenerationOptions && (
        <KnobSelect
          label="People"
          value={knobs.personGeneration}
          onChange={(v) => setKnobs({ ...knobs, personGeneration: v })}
          options={provider.knobs.personGenerationOptions}
        />
      )}
      {provider.knobs.supportsSeed && (
        <KnobNumber
          label="Seed (blank = random)"
          value={knobs.seed}
          onChange={(v) => setKnobs({ ...knobs, seed: v })}
        />
      )}
    </div>
  );
}

function KnobSelect({ label, value, onChange, options }: { label: string; value?: string; onChange: (v: string) => void; options: { id: string; label: string }[] }) {
  return (
    <div>
      <div style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", padding: "8px 12px", background: C.bg, border: "1px solid " + C.border, borderRadius: 6, color: C.tx, fontFamily: ft, fontSize: 12.5, outline: "none" }}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function KnobNumber({ label, value, onChange }: { label: string; value?: number; onChange: (v: number | undefined) => void }) {
  return (
    <div>
      <div style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        placeholder="random"
        style={{ width: "100%", padding: "8px 12px", background: C.bg, border: "1px solid " + C.border, borderRadius: 6, color: C.tx, fontFamily: ft, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
      />
    </div>
  );
}

// ─── ACTIVE / RESULT PANEL ────────────────────────────────────────────

function ActivePanel({ active, provider }: { active: GenerationRecord | null; provider: Provider }) {
  if (!active) return null;
  const failed = active.status === "failed";
  return (
    <div style={{ marginTop: 16, background: C.card, border: "1px solid " + (failed ? C.coral + "40" : C.border), borderRadius: 14, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, letterSpacing: 1.5, textTransform: "uppercase" }}>
          {active.status === "succeeded" ? "Result" : active.status === "processing" ? "Generating..." : "Failed"}
        </div>
        <div style={{ fontFamily: mn, fontSize: 10, color: C.txm }}>{active.providerName} · {formatCost(active.costEstimate)}</div>
      </div>
      {active.status === "processing" && (
        <div style={{ background: C.bg, border: "1px solid " + C.border, borderRadius: 10, padding: 14 }}>
          <div style={{ height: 4, background: C.surface, borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
            <div style={{ height: "100%", width: `${active.progress}%`, background: C.amber, transition: "width 0.3s" }} />
          </div>
          <div style={{ fontFamily: mn, fontSize: 10, color: C.txd }}>{active.progress}% · async {provider.kind} usually takes 30-90s.</div>
        </div>
      )}
      {active.status === "succeeded" && (
        <div style={{ display: "grid", gridTemplateColumns: active.results.length > 1 ? "1fr 1fr" : "1fr", gap: 10 }}>
          {active.results.map((r, i) => (
            <ResultTile key={i} url={r.url} type={r.type} />
          ))}
        </div>
      )}
      {active.status === "failed" && (
        <div style={{ fontFamily: ft, fontSize: 12, color: C.coral }}>The vendor returned a failure. Try a different prompt or provider.</div>
      )}
    </div>
  );
}

function ResultTile({ url, type }: { url: string; type: "image" | "video" }) {
  return (
    <div style={{ background: C.bg, border: "1px solid " + C.border, borderRadius: 10, overflow: "hidden", position: "relative" }}>
      {type === "image" ? (
        <img src={url} alt="result" style={{ width: "100%", display: "block" }} />
      ) : (
        <video src={url} controls style={{ width: "100%", display: "block" }} />
      )}
      <div style={{ display: "flex", gap: 6, padding: 8, borderTop: "1px solid " + C.border }}>
        <a
          href={url}
          download
          target="_blank"
          rel="noopener noreferrer"
          style={{ flex: 1, padding: "8px 12px", background: C.amber + "12", border: "1px solid " + C.amber + "40", borderRadius: 6, fontFamily: mn, fontSize: 10, color: C.amber, fontWeight: 700, textAlign: "center", textDecoration: "none", letterSpacing: 0.5 }}
        >
          DOWNLOAD
        </a>
        <button
          onClick={() => { navigator.clipboard.writeText(url); showToast("URL copied."); }}
          style={{ padding: "8px 12px", background: "transparent", border: "1px solid " + C.border, borderRadius: 6, fontFamily: mn, fontSize: 10, color: C.txm, fontWeight: 700, cursor: "pointer", letterSpacing: 0.5 }}
        >
          COPY URL
        </button>
      </div>
    </div>
  );
}

// ─── HISTORY PANEL ────────────────────────────────────────────────────

function HistoryPanel({ history, active, onPick, onClear }: { history: GenerationRecord[]; active: GenerationRecord | null; onPick: (r: GenerationRecord) => void; onClear: () => void }) {
  return (
    <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 14, padding: "16px 14px", height: "fit-content", maxHeight: "calc(100vh - 200px)", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, letterSpacing: 1.5, textTransform: "uppercase" }}>History</div>
        {history.length > 0 && (
          <button onClick={onClear} style={{ padding: "4px 8px", background: "transparent", border: "1px solid " + C.border, borderRadius: 4, fontFamily: mn, fontSize: 8, color: C.txd, cursor: "pointer", letterSpacing: 0.5, textTransform: "uppercase" }}>Clear</button>
        )}
      </div>
      {history.length === 0 && (
        <div style={{ fontFamily: ft, fontSize: 11.5, color: C.txd, lineHeight: 1.5 }}>Past generations show up here. Each entry preserves the prompt + knobs so you can re-roll or iterate.</div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {history.map((rec) => {
          const sel = active?.id === rec.id;
          const thumb = rec.results[0];
          return (
            <div
              key={rec.id}
              onClick={() => onPick(rec)}
              style={{
                padding: 8,
                background: sel ? C.amber + "10" : C.bg,
                border: "1px solid " + (sel ? C.amber + "40" : C.border),
                borderRadius: 8,
                cursor: "pointer",
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 6, background: C.surface, overflow: "hidden", flexShrink: 0, position: "relative" }}>
                {thumb && thumb.type === "image" && <img src={thumb.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                {thumb && thumb.type === "video" && <video src={thumb.url} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                {!thumb && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mn, fontSize: 8, color: C.txd }}>{rec.status === "failed" ? "✕" : "..."}</div>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: ft, fontSize: 11.5, color: C.tx, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rec.prompt}</div>
                <div style={{ fontFamily: mn, fontSize: 8.5, color: C.txd, marginTop: 2, letterSpacing: 0.3 }}>{rec.providerName} · {formatCost(rec.costEstimate)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── KNOB LEGEND (BOTTOM) ─────────────────────────────────────────────

function KnobLegend({ provider }: { provider: Provider; knobs: KnobValues; setKnobs: (k: KnobValues) => void }) {
  return (
    <div style={{ marginTop: 28, padding: "18px 20px", background: C.card, border: "1px solid " + C.border, borderRadius: 14 }}>
      <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>What {provider.name} exposes</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, fontFamily: ft, fontSize: 12.5, color: C.txm, lineHeight: 1.5 }}>
        <LegendItem label="Vendor" value={provider.vendor} />
        <LegendItem label="Model" value={provider.modelId} mono />
        <LegendItem
          label="Aspect ratios"
          value={(provider.knobs.aspectRatios || []).map((a) => a.id).join(" · ") || "fixed"}
        />
        <LegendItem
          label={provider.kind === "video" ? "Durations" : "Output count"}
          value={
            provider.kind === "video"
              ? (provider.knobs.durations || []).map((d) => `${d}s`).join(" · ") || "fixed"
              : `up to ${provider.knobs.countMax || 1}`
          }
        />
        <LegendItem label="Negative prompt" value={provider.knobs.supportsNegativePrompt ? "supported" : "not supported"} />
        <LegendItem label="Seed control" value={provider.knobs.supportsSeed ? "supported" : "not supported"} />
        <LegendItem label="Reference image" value={provider.knobs.supportsReferenceImage ? (provider.id === "runway-video" ? "required" : "optional") : "not supported"} />
        <LegendItem label="Pricing source" value={provider.pricing.publishedUrl || "vendor docs"} link={provider.pricing.publishedUrl} />
      </div>
      {provider.pricing.notes && (
        <div style={{ marginTop: 12, padding: "10px 14px", background: C.bg, border: "1px solid " + C.border, borderRadius: 8, fontFamily: ft, fontSize: 12, color: C.txm, lineHeight: 1.5 }}>
          {provider.pricing.notes}
        </div>
      )}
    </div>
  );
}

function LegendItem({ label, value, mono, link }: { label: string; value: string; mono?: boolean; link?: string }) {
  return (
    <div>
      <div style={{ fontFamily: mn, fontSize: 8.5, color: C.txd, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" style={{ fontFamily: mono ? mn : ft, fontSize: 12.5, color: C.amber, textDecoration: "none" }}>{value}</a>
      ) : (
        <div style={{ fontFamily: mono ? mn : ft, fontSize: 12.5, color: C.tx }}>{value}</div>
      )}
    </div>
  );
}
