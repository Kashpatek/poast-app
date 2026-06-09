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

// ─── ASSET LIBRARY (Characters + Scenes) ──────────────────────────────

interface StudioAsset {
  id: string;
  kind: "character" | "scene";
  name: string;
  description: string;
  tags: string[];
  recommendations: string[];
  imageDataUrl: string;
  notes?: string;
  createdAt: number;
}

const ASSET_KEY = "poast-generate-studio-assets-v1";
const ASSET_CAP = 80;

function loadAssets(): StudioAsset[] {
  try {
    const raw = localStorage.getItem(ASSET_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StudioAsset[];
  } catch {
    return [];
  }
}

function saveAssets(records: StudioAsset[]) {
  try {
    localStorage.setItem(ASSET_KEY, JSON.stringify(records.slice(0, ASSET_CAP)));
  } catch {}
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target ? (e.target.result as string) : "");
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
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
  const [assets, setAssets] = useState<StudioAsset[]>([]);
  const [assetLibraryOpen, setAssetLibraryOpen] = useState(false);
  const [assetTab, setAssetTab] = useState<"character" | "scene">("character");
  const [developing, setDeveloping] = useState<{ imageDataUrl: string; kind: "character" | "scene"; loading: boolean; suggestion?: { name: string; description: string; tags: string[]; recommendations: string[] }; note: string } | null>(null);

  const provider = getProvider(providerId)!;
  const cost = useMemo(() => estimateCost(provider, knobs), [provider, knobs]);

  // Bootstrap from localStorage on mount.
  useEffect(() => {
    setHistory(loadHistory());
    setAssets(loadAssets());
  }, []);

  useEffect(() => {
    saveAssets(assets);
  }, [assets]);

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

  function setFrame(slot: "first" | "last", dataUrl: string) {
    setKnobs((k) => ({
      ...k,
      ...(slot === "first" ? { firstFrameDataUrl: dataUrl } : { lastFrameDataUrl: dataUrl }),
    }));
  }

  async function handleDevelopUpload(file: File | null | undefined, kind: "character" | "scene") {
    if (!file) return;
    if (!file.type.startsWith("image/")) { showToast("Only image files."); return; }
    const dataUrl = await fileToDataUrl(file);
    setDeveloping({ imageDataUrl: dataUrl, kind, loading: true, note: "" });
    try {
      const r = await fetch("/api/generate-studio/describe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: dataUrl, kind }),
      });
      const d = await r.json();
      if (!r.ok || d.error) {
        showToast("Describe failed: " + (d.error || r.statusText));
        setDeveloping((cur) => (cur ? { ...cur, loading: false } : cur));
        return;
      }
      setDeveloping((cur) => cur ? {
        ...cur,
        loading: false,
        suggestion: {
          name: d.name || "",
          description: d.description || "",
          tags: d.tags || [],
          recommendations: d.recommendations || [],
        },
      } : cur);
    } catch (e) {
      showToast("Describe error: " + String(e));
      setDeveloping((cur) => (cur ? { ...cur, loading: false } : cur));
    }
  }

  function saveAssetFromDevelop() {
    if (!developing || !developing.suggestion) return;
    const asset: StudioAsset = {
      id: uid(),
      kind: developing.kind,
      name: developing.suggestion.name || "Untitled",
      description: developing.suggestion.description,
      tags: developing.suggestion.tags,
      recommendations: developing.suggestion.recommendations,
      imageDataUrl: developing.imageDataUrl,
      notes: developing.note,
      createdAt: Date.now(),
    };
    setAssets((a) => [asset, ...a]);
    setDeveloping(null);
    setAssetTab(asset.kind);
    setAssetLibraryOpen(true);
    showToast("Saved to " + (asset.kind === "character" ? "Characters" : "Scenes"));
  }

  function deleteAsset(id: string) {
    setAssets((a) => a.filter((x) => x.id !== id));
  }

  function insertAssetToFrame(asset: StudioAsset, slot: "first" | "last" | "reference") {
    if (slot === "first") setKnobs((k) => ({ ...k, firstFrameDataUrl: asset.imageDataUrl }));
    else if (slot === "last") setKnobs((k) => ({ ...k, lastFrameDataUrl: asset.imageDataUrl }));
    else setKnobs((k) => ({ ...k, referenceImageDataUrl: asset.imageDataUrl }));
    showToast("Inserted " + asset.name + " as " + slot + " frame");
  }

  function appendRecommendationToPrompt(text: string) {
    setPrompt((p) => (p.trim() ? p + " " + text : text));
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
              onFrameSet={setFrame}
              onOpenLibrary={() => setAssetLibraryOpen(true)}
              onGenerate={handleGenerate}
              generating={generating}
              costLabel={formatCost(cost.dollars)}
            />
            <ActivePanel active={active} provider={provider} />
          </div>

          <HistoryPanel history={history} active={active} onPick={reuseHistory} onClear={clearHistory} />
        </div>

        <AssetLibraryPanel
          open={assetLibraryOpen}
          onClose={() => setAssetLibraryOpen(false)}
          tab={assetTab}
          setTab={setAssetTab}
          assets={assets}
          provider={provider}
          onDevelopUpload={handleDevelopUpload}
          onInsertFirst={(a) => insertAssetToFrame(a, "first")}
          onInsertLast={(a) => insertAssetToFrame(a, "last")}
          onInsertReference={(a) => insertAssetToFrame(a, "reference")}
          onAppendPrompt={appendRecommendationToPrompt}
          onDelete={deleteAsset}
        />

        <DevelopDialog
          state={developing}
          setState={setDeveloping}
          onSave={saveAssetFromDevelop}
        />

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
  if (p.models && p.models[0]) k.modelId = p.models[0].modelId;
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
  onFrameSet,
  onOpenLibrary,
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
  onFrameSet: (slot: "first" | "last", dataUrl: string) => void;
  onOpenLibrary: () => void;
  onGenerate: () => void;
  generating: boolean;
  costLabel: string;
}) {
  return (
    <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 14, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, letterSpacing: 1.5, textTransform: "uppercase" }}>Prompt</div>
        <button onClick={onOpenLibrary} style={{ padding: "5px 10px", background: C.violet + "12", border: "1px solid " + C.violet + "40", borderRadius: 6, fontFamily: mn, fontSize: 10, fontWeight: 700, color: C.violet, cursor: "pointer", letterSpacing: 0.5 }}>📚 ASSET LIBRARY</button>
      </div>
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

      {(provider.knobs.supportsFirstFrame || provider.knobs.supportsLastFrame) && (
        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: provider.knobs.supportsLastFrame ? "1fr 1fr" : "1fr", gap: 12 }}>
          {provider.knobs.supportsFirstFrame && (
            <FrameSlot
              label={"First frame" + (provider.knobs.firstFrameRequired ? " · required" : " · optional")}
              accent={C.amber}
              dataUrl={knobs.firstFrameDataUrl}
              onDrop={async (f) => onFrameSet("first", await fileToDataUrl(f))}
              onClear={() => onFrameSet("first", "")}
              hint="t = 0. The video starts on this image."
            />
          )}
          {provider.knobs.supportsLastFrame && (
            <FrameSlot
              label="Last frame · optional"
              accent={C.violet}
              dataUrl={knobs.lastFrameDataUrl}
              onDrop={async (f) => onFrameSet("last", await fileToDataUrl(f))}
              onClear={() => onFrameSet("last", "")}
              hint="t = end. The motion interpolates first → last."
            />
          )}
        </div>
      )}

      {provider.knobs.supportsReferenceImage && !provider.knobs.supportsFirstFrame && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 6 }}>
            Reference image · optional
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
      {provider.models && provider.models.length > 1 && (
        <KnobSelect
          label="Model · cost shifts here"
          value={knobs.modelId || provider.models[0].modelId}
          onChange={(v) => setKnobs({ ...knobs, modelId: v })}
          options={provider.models.map((m) => ({ id: m.modelId, label: `${m.label} · ${formatCost(m.pricing.basePerUnit)}${m.pricing.unit === "video-second" ? "/s" : m.pricing.unit === "image" ? "/img" : "/clip"}` }))}
        />
      )}
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

// ─── FRAME SLOT (first / last) ────────────────────────────────────────

function FrameSlot({ label, accent, dataUrl, onDrop, onClear, hint }: { label: string; accent: string; dataUrl?: string; onDrop: (f: File) => void; onClear: () => void; hint: string }) {
  const [drag, setDrag] = useState(false);
  return (
    <div>
      <div style={{ fontFamily: mn, fontSize: 9, color: accent, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer.files[0]) onDrop(e.dataTransfer.files[0]);
        }}
        style={{
          display: "block",
          padding: "14px 12px",
          background: drag ? accent + "10" : C.bg,
          border: "1px dashed " + (drag ? accent : C.border),
          borderRadius: 8,
          cursor: "pointer",
          textAlign: "center",
          minHeight: 84,
        }}
      >
        {dataUrl ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src={dataUrl} alt="frame" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 6, border: "1px solid " + accent + "40" }} />
            <div style={{ flex: 1, textAlign: "left" }}>
              <div style={{ fontFamily: mn, fontSize: 9, color: accent, fontWeight: 700, letterSpacing: 0.5 }}>SET</div>
              <div style={{ fontFamily: ft, fontSize: 11, color: C.txm, marginTop: 2 }}>Click to swap. Or open the Library to pick a saved asset.</div>
            </div>
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClear(); }} style={{ padding: "4px 8px", background: "transparent", border: "1px solid " + C.coral + "40", borderRadius: 4, color: C.coral, fontFamily: mn, fontSize: 9, fontWeight: 700, cursor: "pointer" }}>CLEAR</button>
          </div>
        ) : (
          <div>
            <div style={{ fontFamily: ft, fontSize: 12, fontWeight: 700, color: C.tx }}>Drop an image</div>
            <div style={{ fontFamily: mn, fontSize: 9, color: C.txd, marginTop: 4 }}>{hint}</div>
          </div>
        )}
        <input type="file" accept="image/*" onChange={(e) => e.target.files && e.target.files[0] && onDrop(e.target.files[0])} style={{ display: "none" }} />
      </label>
    </div>
  );
}

// ─── ASSET LIBRARY (Characters + Scenes) ──────────────────────────────

function AssetLibraryPanel({
  open,
  onClose,
  tab,
  setTab,
  assets,
  provider,
  onDevelopUpload,
  onInsertFirst,
  onInsertLast,
  onInsertReference,
  onAppendPrompt,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  tab: "character" | "scene";
  setTab: (t: "character" | "scene") => void;
  assets: StudioAsset[];
  provider: Provider;
  onDevelopUpload: (f: File | null | undefined, kind: "character" | "scene") => void;
  onInsertFirst: (a: StudioAsset) => void;
  onInsertLast: (a: StudioAsset) => void;
  onInsertReference: (a: StudioAsset) => void;
  onAppendPrompt: (text: string) => void;
  onDelete: (id: string) => void;
}) {
  if (!open) return null;
  const filtered = assets.filter((a) => a.kind === tab);
  const canFirst = !!provider.knobs.supportsFirstFrame;
  const canLast = !!provider.knobs.supportsLastFrame;
  const canRef = !!provider.knobs.supportsReferenceImage && !provider.knobs.supportsFirstFrame;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 1000 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(1100px, 96vw)", maxHeight: "92vh", background: C.card, border: "1px solid " + C.border, borderRadius: 16, padding: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid " + C.border, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>Asset library</div>
            <div style={{ fontFamily: gf, fontSize: 22, fontWeight: 900, color: C.tx, letterSpacing: -0.4 }}>Characters + scenes you can drop into any generation</div>
          </div>
          <button onClick={onClose} style={{ padding: "6px 10px", background: "transparent", border: "1px solid " + C.border, borderRadius: 6, fontFamily: mn, fontSize: 10, color: C.txm, cursor: "pointer", letterSpacing: 0.5 }}>CLOSE</button>
        </div>
        <div style={{ padding: "12px 22px", borderBottom: "1px solid " + C.border, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {(["character", "scene"] as const).map((t) => {
            const sel = tab === t;
            return (
              <button key={t} onClick={() => setTab(t)} style={{ padding: "8px 14px", background: sel ? C.amber + "15" : C.bg, border: "1px solid " + (sel ? C.amber + "55" : C.border), borderRadius: 999, fontFamily: ft, fontSize: 12, fontWeight: 800, color: sel ? C.amber : C.txm, cursor: "pointer", letterSpacing: 0.3, textTransform: "uppercase" }}>{t === "character" ? "Characters" : "Scenes"}</button>
            );
          })}
          <div style={{ flex: 1 }} />
          <label style={{ padding: "8px 14px", background: C.teal + "15", border: "1px solid " + C.teal + "55", borderRadius: 8, fontFamily: ft, fontSize: 12, fontWeight: 800, color: C.teal, cursor: "pointer", letterSpacing: 0.3 }}>
            ✨ DEVELOP NEW {tab.toUpperCase()}
            <input type="file" accept="image/*" onChange={(e) => onDevelopUpload(e.target.files && e.target.files[0], tab)} style={{ display: "none" }} />
          </label>
        </div>
        <div style={{ padding: "18px 22px 24px", overflowY: "auto", flex: 1 }}>
          {filtered.length === 0 && (
            <div style={{ padding: "40px 20px", textAlign: "center", background: C.bg, border: "1px dashed " + C.border, borderRadius: 12 }}>
              <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: C.tx, marginBottom: 6 }}>No {tab === "character" ? "characters" : "scenes"} yet</div>
              <div style={{ fontFamily: ft, fontSize: 12, color: C.txm }}>Click <strong style={{ color: C.teal }}>DEVELOP NEW</strong> to drop an image. Claude reads it, suggests a name + description + tags + prompt fragments you can reuse.</div>
            </div>
          )}
          {filtered.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
              {filtered.map((asset) => (
                <div key={asset.id} style={{ background: C.bg, border: "1px solid " + C.border, borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                  <div style={{ position: "relative", aspectRatio: "4/3", background: C.surface }}>
                    <img src={asset.imageDataUrl} alt={asset.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  </div>
                  <div style={{ padding: "12px 14px", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 800, color: C.tx, letterSpacing: -0.2 }}>{asset.name}</div>
                      <button onClick={() => onDelete(asset.id)} style={{ padding: "3px 7px", background: "transparent", border: "1px solid " + C.coral + "40", borderRadius: 4, color: C.coral, fontFamily: mn, fontSize: 9, fontWeight: 700, cursor: "pointer" }}>✕</button>
                    </div>
                    <div style={{ fontFamily: ft, fontSize: 11.5, color: C.txm, lineHeight: 1.45 }}>{asset.description}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {asset.tags.slice(0, 6).map((t, i) => (
                        <span key={i} style={{ padding: "2px 7px", background: C.surface, border: "1px solid " + C.border, borderRadius: 4, fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 0.3 }}>{t}</span>
                      ))}
                    </div>
                    {asset.recommendations.length > 0 && (
                      <div style={{ marginTop: 4, padding: "8px 10px", background: C.surface, borderRadius: 6, border: "1px solid " + C.border }}>
                        <div style={{ fontFamily: mn, fontSize: 8.5, color: C.txd, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 }}>Prompt fragments · click to append</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {asset.recommendations.slice(0, 4).map((rec, i) => (
                            <button key={i} onClick={() => onAppendPrompt(rec)} style={{ textAlign: "left", padding: "5px 8px", background: "transparent", border: "1px solid " + C.border, borderRadius: 4, fontFamily: ft, fontSize: 11, color: C.txm, cursor: "pointer", lineHeight: 1.4 }}>{rec}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                      {canFirst && <button onClick={() => onInsertFirst(asset)} style={{ flex: 1, padding: "7px 8px", background: C.amber + "12", border: "1px solid " + C.amber + "40", borderRadius: 6, fontFamily: mn, fontSize: 9.5, fontWeight: 800, color: C.amber, cursor: "pointer", letterSpacing: 0.5 }}>USE AS FIRST FRAME</button>}
                      {canLast && <button onClick={() => onInsertLast(asset)} style={{ flex: 1, padding: "7px 8px", background: C.violet + "12", border: "1px solid " + C.violet + "40", borderRadius: 6, fontFamily: mn, fontSize: 9.5, fontWeight: 800, color: C.violet, cursor: "pointer", letterSpacing: 0.5 }}>USE AS LAST FRAME</button>}
                      {canRef && <button onClick={() => onInsertReference(asset)} style={{ flex: 1, padding: "7px 8px", background: C.teal + "12", border: "1px solid " + C.teal + "40", borderRadius: 6, fontFamily: mn, fontSize: 9.5, fontWeight: 800, color: C.teal, cursor: "pointer", letterSpacing: 0.5 }}>USE AS REFERENCE</button>}
                      {!canFirst && !canLast && !canRef && <div style={{ flex: 1, padding: "7px 8px", fontFamily: mn, fontSize: 9.5, color: C.txd, letterSpacing: 0.4, textAlign: "center" }}>SELECT A PROVIDER THAT TAKES IMAGES</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── DEVELOP DIALOG ───────────────────────────────────────────────────

function DevelopDialog({ state, setState, onSave }: { state: { imageDataUrl: string; kind: "character" | "scene"; loading: boolean; suggestion?: { name: string; description: string; tags: string[]; recommendations: string[] }; note: string } | null; setState: (s: typeof state) => void; onSave: () => void }) {
  if (!state) return null;
  const { imageDataUrl, kind, loading, suggestion, note } = state;
  return (
    <div onClick={() => setState(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 1100 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(760px, 96vw)", maxHeight: "90vh", background: C.card, border: "1px solid " + C.border, borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid " + C.border, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: mn, fontSize: 10, color: C.teal, letterSpacing: 1.5, textTransform: "uppercase" }}>Develop new {kind}</div>
          <button onClick={() => setState(null)} style={{ padding: "5px 9px", background: "transparent", border: "1px solid " + C.border, borderRadius: 5, fontFamily: mn, fontSize: 9, color: C.txm, cursor: "pointer" }}>CLOSE</button>
        </div>
        <div style={{ padding: "18px 20px", overflowY: "auto", display: "grid", gridTemplateColumns: "240px 1fr", gap: 18 }}>
          <div>
            <img src={imageDataUrl} alt={kind} style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", borderRadius: 10, border: "1px solid " + C.border, display: "block" }} />
            <div style={{ marginTop: 10, padding: "10px 12px", background: C.bg, border: "1px solid " + C.border, borderRadius: 8 }}>
              <div style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 }}>Your note (optional)</div>
              <textarea
                value={note}
                onChange={(e) => setState({ ...state, note: e.target.value })}
                placeholder="What is this for? Anything Claude should know."
                rows={3}
                style={{ width: "100%", padding: "8px 10px", background: C.surface, border: "1px solid " + C.border, borderRadius: 6, color: C.tx, fontFamily: ft, fontSize: 12, resize: "vertical", outline: "none", boxSizing: "border-box" }}
              />
            </div>
          </div>
          <div>
            {loading && (
              <div style={{ padding: 30, textAlign: "center", background: C.bg, border: "1px solid " + C.border, borderRadius: 10 }}>
                <div style={{ fontFamily: ft, fontSize: 13, color: C.tx, marginBottom: 6 }}>Claude is reading the image...</div>
                <div style={{ fontFamily: mn, fontSize: 10, color: C.txd }}>~10 seconds. Returns name, description, tags, and 4-5 prompt fragments.</div>
              </div>
            )}
            {!loading && suggestion && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 }}>Name</div>
                  <input
                    value={suggestion.name}
                    onChange={(e) => setState({ ...state, suggestion: { ...suggestion, name: e.target.value } })}
                    style={{ width: "100%", padding: "10px 12px", background: C.bg, border: "1px solid " + C.amber + "40", borderRadius: 8, color: C.tx, fontFamily: ft, fontSize: 16, fontWeight: 800, outline: "none", boxSizing: "border-box", letterSpacing: -0.3 }}
                  />
                </div>
                <div>
                  <div style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 }}>Description</div>
                  <textarea
                    value={suggestion.description}
                    onChange={(e) => setState({ ...state, suggestion: { ...suggestion, description: e.target.value } })}
                    rows={3}
                    style={{ width: "100%", padding: "10px 12px", background: C.bg, border: "1px solid " + C.border, borderRadius: 8, color: C.tx, fontFamily: ft, fontSize: 13, lineHeight: 1.45, resize: "vertical", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <div style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 }}>Tags</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {suggestion.tags.map((t, i) => (
                      <span key={i} style={{ padding: "4px 10px", background: C.bg, border: "1px solid " + C.border, borderRadius: 6, fontFamily: mn, fontSize: 10, color: C.txm, letterSpacing: 0.3 }}>{t}</span>
                    ))}
                  </div>
                </div>
                {suggestion.recommendations.length > 0 && (
                  <div>
                    <div style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 }}>Suggested prompt fragments</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {suggestion.recommendations.map((r, i) => (
                        <div key={i} style={{ padding: "8px 10px", background: C.bg, border: "1px solid " + C.border, borderRadius: 6, fontFamily: ft, fontSize: 12, color: C.txm, lineHeight: 1.4 }}>{r}</div>
                      ))}
                    </div>
                  </div>
                )}
                <button onClick={onSave} style={{ marginTop: 4, padding: "12px 18px", background: C.amber, border: "none", borderRadius: 10, color: C.bg, fontFamily: ft, fontSize: 14, fontWeight: 800, cursor: "pointer", letterSpacing: 0.3 }}>Save to {kind === "character" ? "Characters" : "Scenes"}</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
