"use client";

// AI Training hub. Four tabs:
//   Voice — tuning bench for one or more named voices, with live preview
//   Headline Doctor — existing tool, embedded
//   Voice Scorer  — existing tool, embedded
//   Playground   — quick prompt bench across providers

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { D, ft, mn, getPreferredProvider, setPreferredProvider, type LLMProviderName } from "../shared-constants";
import { useToast } from "../toast-context";
import HeadlineDoctor from "../headline-doctor";
import VoiceScorer from "../voice-scorer";
import type { LLMProvider } from "@/lib/llm-provider";
import { TONE_LABELS, type Voice, type VoiceTone, type VoiceExample, type VoicesArchive, defaultArchive } from "@/lib/brand-voice";

type Tab = "voice" | "headline" | "voice-scorer" | "playground";

export default function AITrainingPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>("voice");
  const [pref, setPref] = useState<LLMProviderName>(() =>
    typeof window === "undefined" ? "claude" : getPreferredProvider()
  );

  function pickGlobal(p: LLMProviderName) {
    setPref(p);
    setPreferredProvider(p);
    showToast("Default caption AI set to " + p.toUpperCase());
  }

  return (
    <div style={{ maxWidth: 1320, margin: "0 auto", padding: "40px 32px" }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 10px", borderRadius: 999, background: "rgba(247,176,65,0.10)", border: `1px solid ${D.amber}55`, marginBottom: 14 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: D.amber, boxShadow: `0 0 8px ${D.amber}` }} />
          <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.amber, textTransform: "uppercase" }}>AI Training</span>
        </div>
        <h1 style={{ fontFamily: ft, fontSize: 44, fontWeight: 900, letterSpacing: -1.4, margin: 0, marginBottom: 6, color: D.tx }}>Train the AI</h1>
        <div style={{ fontFamily: ft, fontSize: 14, color: D.txm, maxWidth: 720, lineHeight: 1.5 }}>
          Tune named voices. Live-preview captions as you adjust. Switch providers. Make the captioner sound human, not botted.
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap", padding: "10px 14px", background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10 }}>
        <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: D.txd, fontWeight: 700 }}>Default caption AI</div>
        {(["claude", "gemini", "grok"] as LLMProviderName[]).map((p) => {
          const active = pref === p;
          return (
            <button key={p} type="button" onClick={() => pickGlobal(p)} style={{ padding: "6px 14px", background: active ? D.amber + "20" : "transparent", color: active ? D.amber : D.tx, border: `1px solid ${active ? D.amber + "55" : D.border}`, borderRadius: 6, fontFamily: mn, fontSize: 11, fontWeight: 700, letterSpacing: 0.6, cursor: "pointer", textTransform: "uppercase" }}>{p}</button>
          );
        })}
        <div style={{ marginLeft: "auto", fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4 }}>applies to every caption-gen tool</div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 22, flexWrap: "wrap" }}>
        {([
          { id: "voice",        label: "Brand voice" },
          { id: "headline",     label: "Headline Doctor" },
          { id: "voice-scorer", label: "Voice Scorer" },
          { id: "playground",   label: "Playground" },
        ] as Array<{ id: Tab; label: string }>).map((t) => {
          const active = tab === t.id;
          return (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} style={{ padding: "8px 16px", background: active ? D.amber : "transparent", color: active ? "#060608" : D.tx, border: `1px solid ${active ? D.amber : D.border}`, borderRadius: 8, fontFamily: ft, fontSize: 13, fontWeight: active ? 800 : 500, cursor: "pointer", letterSpacing: 0.3 }}>{t.label}</button>
          );
        })}
      </div>

      {tab === "voice" ? <VoiceTuner onToast={showToast} /> : null}
      {tab === "headline" ? <HeadlineDoctor /> : null}
      {tab === "voice-scorer" ? <VoiceScorer /> : null}
      {tab === "playground" ? <Playground onToast={showToast} /> : null}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Voice tuner — the bench
// ════════════════════════════════════════════════════════════════════

interface Scenario {
  id: string;
  label: string;
  system: string;
  prompt: string;
}

const SCENARIOS: Scenario[] = [
  {
    id: "carousel-cover",
    label: "Instagram carousel cover",
    system: "You write Instagram carousel cover captions for SemiAnalysis. 120-180 chars. Hook the reader to swipe. No hashtags here.",
    prompt: "Topic: NVIDIA Blackwell GB200 yields just crossed 90%, six months ahead of TSMC's internal Q1 schedule. Microsoft and Meta absorbed the first slack. Write the cover caption.",
  },
  {
    id: "linkedin",
    label: "LinkedIn post",
    system: "You write LinkedIn posts for SemiAnalysis. 600-900 chars. Lead with a specific claim, two-to-three supporting points, end with 'Link in comments.' No hashtags. No emojis.",
    prompt: "Topic: Our new report breaks down which hyperscalers actually own the most HBM3e supply through end of 2026. Microsoft is #1 but not by the margin everyone assumes. Meta is closer than Amazon to the lead.",
  },
  {
    id: "x-hook",
    label: "X / Twitter hook tweet",
    system: "You write hook tweets for X. Under 270 chars. No hashtags. No link in this tweet (a reply will carry the link). One specific claim that makes the reader want to know more.",
    prompt: "Topic: SK hynix HBM4 samples are running 18% faster than spec on early validation at Samsung and TSMC packaging lines. The thermal envelope is also better than the data sheet.",
  },
  {
    id: "yt-desc",
    label: "YouTube episode description (first paragraph)",
    system: "You write the opening paragraph of a YouTube episode description for SA Weekly. 3-4 sentences. Names the guest, names the topics, leaves room for chapters below.",
    prompt: "Episode: Dylan Patel sits down with Jordan Nanos to discuss training-cluster economics, the H200 ramp at Microsoft, and why Meta's MTIA program is finally catching real production workloads.",
  },
  {
    id: "tiktok",
    label: "TikTok caption",
    system: "You write TikTok captions for SemiAnalysis. All lowercase. No emojis. Under 150 chars. 4-6 lowercase hashtags after the caption (e.g. #chips #ai #semianalysis).",
    prompt: "Clip: behind-the-scenes from filming at Samsung's HBM4 line. Sparks, robots, very clean rooms. Drop the caption + tags.",
  },
];

function VoiceTuner({ onToast }: { onToast: (m: string) => void }) {
  const [archive, setArchive] = useState<VoicesArchive>(defaultArchive());
  const [activeId, setActiveId] = useState<string>(archive.defaultId);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Live-preview state, keyed by scenario id.
  const [scenarioId, setScenarioId] = useState<string>(SCENARIOS[0].id);
  const [previewProvider, setPreviewProvider] = useState<LLMProvider>("claude");
  const [withOut, setWithOut] = useState<string>("");
  const [withVoice, setWithVoice] = useState<string>("");
  const [withOutLoading, setWithOutLoading] = useState(false);
  const [withVoiceLoading, setWithVoiceLoading] = useState(false);
  const [withOutErr, setWithOutErr] = useState<string | null>(null);
  const [withVoiceErr, setWithVoiceErr] = useState<string | null>(null);
  const [voiceStaleAt, setVoiceStaleAt] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/brand-voice").then((r) => r.json()).then((j) => {
      if (cancelled) return;
      const a: VoicesArchive = j?.archive || defaultArchive();
      setArchive(a);
      setActiveId(a.defaultId);
    }).catch(() => {}).finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const activeVoice: Voice | undefined = useMemo(() => archive.voices.find((v) => v.id === activeId), [archive, activeId]);
  const activeVoiceJson = useMemo(() => JSON.stringify(activeVoice || null), [activeVoice]);
  const scenario = useMemo(() => SCENARIOS.find((s) => s.id === scenarioId) || SCENARIOS[0], [scenarioId]);

  function updateActive(patch: Partial<Voice> | ((v: Voice) => Voice)) {
    setArchive((cur) => {
      const next = { ...cur, voices: cur.voices.map((v) => {
        if (v.id !== activeId) return v;
        return typeof patch === "function" ? patch(v) : { ...v, ...patch };
      }) };
      return next;
    });
    setDirty(true);
  }

  // ── Live preview runners ─────────────────────────────────────────
  const runWithoutVoice = useCallback(async (forced = false) => {
    if (withOutLoading && !forced) return;
    setWithOutLoading(true);
    setWithOutErr(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: scenario.system,
          prompt: scenario.prompt,
          provider: previewProvider,
          applyBrandVoice: false,
        }),
      });
      const j = await res.json();
      if (!res.ok) { setWithOutErr(j.error?.message || j.error || "Generation failed"); return; }
      setWithOut((j.content || []).map((c: { text?: string }) => c.text || "").join(""));
    } catch (e) {
      setWithOutErr(String(e));
    } finally {
      setWithOutLoading(false);
    }
  }, [scenario, previewProvider, withOutLoading]);

  const runWithVoice = useCallback(async () => {
    if (!activeVoice) return;
    setWithVoiceLoading(true);
    setWithVoiceErr(null);
    try {
      // We send the in-flight (possibly unsaved) voice as the system prompt
      // suffix so the preview reflects the editor state, not the persisted
      // copy. Falling back to /api/generate's server-side injection would
      // require a save first.
      const previewSystem = scenario.system + buildLocalVoiceBlock(activeVoice);
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: previewSystem,
          prompt: scenario.prompt,
          provider: previewProvider,
          applyBrandVoice: false,
        }),
      });
      const j = await res.json();
      if (!res.ok) { setWithVoiceErr(j.error?.message || j.error || "Generation failed"); return; }
      setWithVoice((j.content || []).map((c: { text?: string }) => c.text || "").join(""));
      setVoiceStaleAt(activeVoiceJson);
    } catch (e) {
      setWithVoiceErr(String(e));
    } finally {
      setWithVoiceLoading(false);
    }
  }, [activeVoice, scenario, previewProvider, activeVoiceJson]);

  // Auto-run without-voice when scenario or provider changes (and on first load).
  useEffect(() => {
    if (!loaded) return;
    runWithoutVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioId, previewProvider, loaded]);

  // Debounced re-run of with-voice when voice changes.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!loaded || !activeVoice) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { runWithVoice(); }, 1200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVoiceJson, scenarioId, previewProvider, loaded]);

  // ── Voice mutations ──────────────────────────────────────────────
  function newVoice() {
    const id = "v-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
    const v: Voice = {
      id,
      name: "Untitled voice",
      description: "",
      tone: { formality: 1, spice: 1, length: 1, vocab: 1 },
      banned: [],
      encouraged: [],
      examples: [],
      notes: "",
    };
    setArchive((cur) => ({ ...cur, voices: [...cur.voices, v] }));
    setActiveId(id);
    setDirty(true);
  }

  function duplicateVoice() {
    if (!activeVoice) return;
    const id = "v-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
    const dup: Voice = { ...activeVoice, id, name: activeVoice.name + " (copy)" };
    setArchive((cur) => ({ ...cur, voices: [...cur.voices, dup] }));
    setActiveId(id);
    setDirty(true);
  }

  function deleteVoice() {
    if (!activeVoice) return;
    if (archive.voices.length === 1) { onToast("You need at least one voice."); return; }
    if (!confirm(`Delete "${activeVoice.name}"?`)) return;
    setArchive((cur) => {
      const next = cur.voices.filter((v) => v.id !== activeId);
      const def = cur.defaultId === activeId ? next[0].id : cur.defaultId;
      return { voices: next, defaultId: def };
    });
    setActiveId((cur) => archive.voices.find((v) => v.id !== cur)?.id || archive.voices[0].id);
    setDirty(true);
  }

  function setAsDefault() {
    setArchive((cur) => ({ ...cur, defaultId: activeId }));
    setDirty(true);
    onToast(`"${activeVoice?.name}" is now the default voice.`);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/brand-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archive }),
      });
      const j = await res.json();
      if (!res.ok) { onToast(j.error || "Save failed"); return; }
      setDirty(false);
      onToast("Voices saved. Captions everywhere use these now.");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <div style={muted}>Loading voices…</div>;
  if (!activeVoice) return <div style={muted}>No voice selected.</div>;

  const voiceChanged = activeVoiceJson !== voiceStaleAt;

  return (
    <div>
      {/* Voice tabs */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 14 }}>
        {archive.voices.map((v) => {
          const active = v.id === activeId;
          const isDefault = v.id === archive.defaultId;
          return (
            <button key={v.id} type="button" onClick={() => setActiveId(v.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", background: active ? D.amber : "transparent", color: active ? "#060608" : D.tx, border: `1px solid ${active ? D.amber : D.border}`, borderRadius: 8, fontFamily: ft, fontSize: 13, fontWeight: active ? 800 : 500, cursor: "pointer", letterSpacing: 0.3 }}>
              {v.name}
              {isDefault ? <span style={{ fontFamily: mn, fontSize: 9, padding: "1px 5px", borderRadius: 3, background: active ? "rgba(0,0,0,0.18)" : D.amber + "22", color: active ? "#060608" : D.amber, letterSpacing: 0.5 }}>DEFAULT</span> : null}
            </button>
          );
        })}
        <button type="button" onClick={newVoice} style={{ padding: "7px 14px", background: "transparent", color: D.txm, border: `1px dashed ${D.border}`, borderRadius: 8, fontFamily: ft, fontSize: 13, cursor: "pointer", letterSpacing: 0.3 }}>+ New voice</button>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button type="button" onClick={duplicateVoice} style={ghostBtn}>Duplicate</button>
          {archive.defaultId !== activeId ? <button type="button" onClick={setAsDefault} style={ghostBtn}>Set as default</button> : null}
          <button type="button" onClick={deleteVoice} style={{ ...ghostBtn, color: D.coral, borderColor: D.coral + "55" }}>Delete</button>
          <button type="button" onClick={save} disabled={saving || !dirty} style={{ padding: "8px 16px", background: dirty ? D.amber : D.surface, color: dirty ? "#060608" : D.txd, border: `1px solid ${dirty ? D.amber : D.border}`, borderRadius: 8, fontFamily: ft, fontSize: 13, fontWeight: 800, cursor: dirty && !saving ? "pointer" : "not-allowed", letterSpacing: 0.3 }}>{saving ? "Saving…" : dirty ? "Save voice" : "Saved"}</button>
        </div>
      </div>

      {/* Two-column bench */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 5fr) minmax(0, 6fr)", gap: 18 }}>
        {/* Editor */}
        <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <Field label="Voice name" value={activeVoice.name} onChange={(v) => updateActive({ name: v })} />
            <Field label="When to use it" value={activeVoice.description || ""} onChange={(v) => updateActive({ description: v })} placeholder="e.g. behind-the-scenes / casual" />
          </div>

          <div style={{ marginBottom: 16 }}>
            <SectionLabel>Tone dials</SectionLabel>
            <ToneSlider name="formality" tone={activeVoice.tone} onChange={(t) => updateActive({ tone: t })} />
            <ToneSlider name="spice"     tone={activeVoice.tone} onChange={(t) => updateActive({ tone: t })} />
            <ToneSlider name="length"    tone={activeVoice.tone} onChange={(t) => updateActive({ tone: t })} />
            <ToneSlider name="vocab"     tone={activeVoice.tone} onChange={(t) => updateActive({ tone: t })} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <SectionLabel>Lean into</SectionLabel>
            <TagInput value={activeVoice.encouraged} onChange={(v) => updateActive({ encouraged: v })} accent={D.teal} placeholder="add a phrase, then Enter" />
          </div>

          <div style={{ marginBottom: 16 }}>
            <SectionLabel>Never use</SectionLabel>
            <TagInput value={activeVoice.banned} onChange={(v) => updateActive({ banned: v })} accent={D.coral} placeholder="banned phrase, then Enter" />
          </div>

          <div style={{ marginBottom: 16 }}>
            <SectionLabel>Examples</SectionLabel>
            <ExamplesEditor value={activeVoice.examples} onChange={(v) => updateActive({ examples: v })} />
          </div>

          <div>
            <SectionLabel>Notes</SectionLabel>
            <textarea value={activeVoice.notes || ""} onChange={(e) => updateActive({ notes: e.target.value })} placeholder="Anything that doesn't fit above" style={{ ...inputStyle, minHeight: 64, resize: "vertical" }} />
          </div>
        </div>

        {/* Live preview */}
        <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: "16px 18px", position: "sticky", top: 16, alignSelf: "start" }}>
          <SectionLabel>Live preview</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "7px 10px" }}>
              {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <div style={{ display: "flex", gap: 4 }}>
              {(["claude", "gemini", "grok"] as LLMProvider[]).map((p) => {
                const active = previewProvider === p;
                return <button key={p} type="button" onClick={() => setPreviewProvider(p)} style={{ padding: "5px 10px", background: active ? D.amber + "20" : "transparent", color: active ? D.amber : D.txm, border: `1px solid ${active ? D.amber + "55" : D.border}`, borderRadius: 6, fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 0.6, cursor: "pointer", textTransform: "uppercase" }}>{p}</button>;
              })}
            </div>
            <button type="button" onClick={() => { runWithoutVoice(true); runWithVoice(); }} style={{ ...ghostBtn, marginLeft: "auto" }}>↻ Run both</button>
          </div>

          <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4, marginBottom: 8, lineHeight: 1.5 }}>
            <span style={{ color: D.amber }}>Prompt:</span> {scenario.prompt}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <PreviewPane
              title="Without voice"
              subtitle="Raw model output, anti-bot rules off"
              text={withOut}
              loading={withOutLoading}
              err={withOutErr}
              onRerun={() => runWithoutVoice(true)}
              tone={D.txm}
            />
            <PreviewPane
              title="With voice"
              subtitle={`Using "${activeVoice.name}"` + (voiceChanged ? " · re-running…" : "")}
              text={withVoice}
              loading={withVoiceLoading}
              err={withVoiceErr}
              onRerun={runWithVoice}
              tone={D.amber}
              highlight
            />
          </div>

          <div style={{ marginTop: 10, fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4 }}>
            Edits debounce 1.2s before re-running. Switch scenarios to test different surfaces.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tone slider ─────────────────────────────────────────────────────
function ToneSlider({ name, tone, onChange }: { name: keyof VoiceTone; tone: VoiceTone; onChange: (t: VoiceTone) => void }) {
  const labels = TONE_LABELS[name];
  const max = labels.length - 1;
  const v = tone[name];
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ fontFamily: mn, fontSize: 10, color: D.txd, textTransform: "uppercase", letterSpacing: 1.1, fontWeight: 700 }}>{name}</span>
        <span style={{ fontFamily: ft, fontSize: 12, color: D.amber, fontWeight: 700 }}>{labels[v]}</span>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {labels.map((lbl, i) => {
          const active = i === v;
          return (
            <button key={lbl} type="button" onClick={() => onChange({ ...tone, [name]: i })} style={{ flex: 1, padding: "5px 6px", background: active ? D.amber + "20" : "rgba(255,255,255,0.02)", color: active ? D.amber : D.txd, border: `1px solid ${active ? D.amber + "55" : D.border}`, borderRadius: 6, fontFamily: mn, fontSize: 9.5, fontWeight: active ? 800 : 500, cursor: "pointer", letterSpacing: 0.4 }} title={`${name} = ${i} of ${max}`}>{lbl}</button>
          );
        })}
      </div>
    </div>
  );
}

// ── Tag input ──────────────────────────────────────────────────────
function TagInput({ value, onChange, accent, placeholder }: { value: string[]; onChange: (v: string[]) => void; accent: string; placeholder: string }) {
  const [draft, setDraft] = useState("");
  function add() {
    const v = draft.trim();
    if (!v) return;
    if (value.includes(v)) { setDraft(""); return; }
    onChange([...value, v]);
    setDraft("");
  }
  function remove(t: string) { onChange(value.filter((x) => x !== t)); }
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
        {value.length === 0 ? <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4, padding: "4px 2px" }}>nothing yet</div> : null}
        {value.map((t) => (
          <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px 3px 10px", background: accent + "1c", color: accent, border: `1px solid ${accent}55`, borderRadius: 999, fontFamily: mn, fontSize: 11, letterSpacing: 0.2 }}>
            {t}
            <button type="button" onClick={() => remove(t)} style={{ background: "transparent", border: "none", color: accent, cursor: "pointer", padding: 0, lineHeight: 1, fontSize: 13, opacity: 0.7 }}>×</button>
          </span>
        ))}
      </div>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        placeholder={placeholder}
        style={inputStyle}
      />
    </div>
  );
}

// ── Examples editor ─────────────────────────────────────────────────
function ExamplesEditor({ value, onChange }: { value: VoiceExample[]; onChange: (v: VoiceExample[]) => void }) {
  const [draft, setDraft] = useState<{ text: string; kind: "good" | "bad"; note: string }>({ text: "", kind: "good", note: "" });

  function add() {
    if (!draft.text.trim()) return;
    const ex: VoiceExample = {
      id: "ex-" + Date.now().toString(36),
      text: draft.text.trim(),
      kind: draft.kind,
      note: draft.note.trim() || undefined,
    };
    onChange([...value, ex]);
    setDraft({ text: "", kind: "good", note: "" });
  }

  function remove(id: string) { onChange(value.filter((e) => e.id !== id)); }
  function flip(id: string) { onChange(value.map((e) => e.id === id ? { ...e, kind: e.kind === "good" ? "bad" : "good" } : e)); }

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
        {value.map((e) => {
          const c = e.kind === "good" ? D.teal : D.coral;
          return (
            <div key={e.id} style={{ background: D.bg, border: `1px solid ${D.border}`, borderLeft: `3px solid ${c}`, borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <button type="button" onClick={() => flip(e.id)} title="Flip good/bad" style={{ fontFamily: mn, fontSize: 9, padding: "1px 6px", background: c + "20", color: c, border: `1px solid ${c}55`, borderRadius: 3, cursor: "pointer", letterSpacing: 0.5, textTransform: "uppercase", fontWeight: 700 }}>
                  {e.kind === "good" ? "👍 good" : "👎 bad"}
                </button>
                {e.note ? <span style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.3 }}>{e.note}</span> : null}
                <button type="button" onClick={() => remove(e.id)} style={{ marginLeft: "auto", background: "transparent", border: "none", color: D.txd, cursor: "pointer", fontFamily: mn, fontSize: 10, letterSpacing: 0.4 }}>remove</button>
              </div>
              <div style={{ fontFamily: ft, fontSize: 12.5, color: D.tx, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{e.text}</div>
            </div>
          );
        })}
        {value.length === 0 ? <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4, padding: "4px 2px" }}>no examples yet — paste one below</div> : null}
      </div>

      <div style={{ background: D.bg, border: `1px dashed ${D.border}`, borderRadius: 8, padding: "8px 10px" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          {(["good", "bad"] as const).map((k) => {
            const active = draft.kind === k;
            const c = k === "good" ? D.teal : D.coral;
            return <button key={k} type="button" onClick={() => setDraft({ ...draft, kind: k })} style={{ padding: "3px 10px", background: active ? c + "20" : "transparent", color: active ? c : D.txd, border: `1px solid ${active ? c + "55" : D.border}`, borderRadius: 4, fontFamily: mn, fontSize: 10, cursor: "pointer", letterSpacing: 0.5, textTransform: "uppercase", fontWeight: 700 }}>{k}</button>;
          })}
        </div>
        <textarea value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} placeholder="Paste a real caption that hit (or missed). Multiple sentences OK." style={{ ...inputStyle, minHeight: 52, resize: "vertical", marginBottom: 6 }} />
        <div style={{ display: "flex", gap: 6 }}>
          <input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="why this is good/bad (optional)" style={{ ...inputStyle, flex: 1 }} />
          <button type="button" onClick={add} disabled={!draft.text.trim()} style={{ padding: "8px 14px", background: draft.text.trim() ? D.amber : "transparent", color: draft.text.trim() ? "#060608" : D.txd, border: `1px solid ${draft.text.trim() ? D.amber : D.border}`, borderRadius: 6, fontFamily: ft, fontSize: 12, fontWeight: 800, cursor: draft.text.trim() ? "pointer" : "not-allowed", letterSpacing: 0.3 }}>+ Add</button>
        </div>
      </div>
    </div>
  );
}

// ── Preview pane ───────────────────────────────────────────────────
function PreviewPane({ title, subtitle, text, loading, err, onRerun, tone, highlight }: { title: string; subtitle: string; text: string; loading: boolean; err: string | null; onRerun: () => void; tone: string; highlight?: boolean }) {
  return (
    <div style={{ background: D.bg, border: `1px solid ${highlight ? D.amber + "55" : D.border}`, borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", minHeight: 200 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <div>
          <div style={{ fontFamily: mn, fontSize: 10, color: tone, letterSpacing: 1.1, textTransform: "uppercase", fontWeight: 700 }}>{title}</div>
          <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.3 }}>{subtitle}</div>
        </div>
        <button type="button" onClick={onRerun} title="Re-run" style={{ background: "transparent", border: "none", color: D.txm, cursor: "pointer", fontFamily: mn, fontSize: 12, padding: "0 4px" }}>↻</button>
      </div>
      <div style={{ flex: 1, fontFamily: ft, fontSize: 13.5, color: D.tx, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
        {err ? <span style={{ color: D.coral, fontSize: 11.5 }}>{err}</span> : loading ? <span style={{ color: D.txd, fontFamily: mn, fontSize: 11 }}>generating…</span> : text || <span style={{ color: D.txd, fontFamily: mn, fontSize: 11 }}>—</span>}
      </div>
      {text ? (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <span style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.4 }}>{text.length} chars</span>
          <button type="button" onClick={() => navigator.clipboard?.writeText(text)} style={{ background: "transparent", border: "none", color: D.txd, fontFamily: mn, fontSize: 9, cursor: "pointer", letterSpacing: 0.4 }}>copy</button>
        </div>
      ) : null}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Playground (kept from earlier — quick prompt bench)
// ════════════════════════════════════════════════════════════════════

function Playground({ onToast }: { onToast: (m: string) => void }) {
  const [system, setSystem] = useState("You write Instagram captions for SemiAnalysis. Under 220 chars. No hashtags here. No em dashes, no hype.");
  const [prompt, setPrompt] = useState("Caption for a carousel cover about NVIDIA Blackwell yields hitting 90%, written for GPU procurement leads.");
  const [provider, setProvider] = useState<LLMProvider>("claude");
  const [withVoice, setWithVoice] = useState(true);
  const [running, setRunning] = useState(false);
  const [out, setOut] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    if (!prompt.trim() || running) return;
    setRunning(true);
    setOut("");
    setErr(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system, prompt, provider, applyBrandVoice: withVoice }),
      });
      const j = await res.json();
      if (!res.ok) { setErr(j.error?.message || j.error || "Generation failed"); return; }
      setOut((j.content || []).map((c: { text?: string }) => c.text || "").join(""));
    } catch (e) {
      setErr(String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <div style={hintBox}>Run any system + user prompt across providers. Toggle the brand voice to see how much your rules change the output.</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div>
          <SectionLabel>System prompt</SectionLabel>
          <textarea value={system} onChange={(e) => setSystem(e.target.value)} style={{ ...inputStyle, minHeight: 110, resize: "vertical" }} />
        </div>
        <div>
          <SectionLabel>User prompt</SectionLabel>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} style={{ ...inputStyle, minHeight: 110, resize: "vertical" }} />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <SectionLabel>Provider</SectionLabel>
        {(["claude", "gemini", "grok"] as LLMProvider[]).map((p) => {
          const active = provider === p;
          return <button key={p} type="button" onClick={() => setProvider(p)} style={{ padding: "6px 14px", background: active ? D.amber + "20" : "transparent", color: active ? D.amber : D.tx, border: `1px solid ${active ? D.amber + "55" : D.border}`, borderRadius: 6, fontFamily: mn, fontSize: 11, fontWeight: 700, letterSpacing: 0.6, cursor: "pointer", textTransform: "uppercase" }}>{p}</button>;
        })}
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: mn, fontSize: 11, color: D.txm, cursor: "pointer", marginLeft: 12 }}>
          <input type="checkbox" checked={withVoice} onChange={(e) => setWithVoice(e.target.checked)} style={{ accentColor: D.amber }} />
          Apply default voice
        </label>
        <button type="button" onClick={run} disabled={!prompt.trim() || running} style={{ marginLeft: "auto", padding: "10px 20px", background: prompt.trim() && !running ? D.amber : "transparent", color: prompt.trim() && !running ? "#060608" : D.txd, border: `1px solid ${prompt.trim() && !running ? D.amber : D.border}`, borderRadius: 8, fontFamily: ft, fontSize: 13, fontWeight: 800, cursor: prompt.trim() && !running ? "pointer" : "not-allowed", letterSpacing: 0.3 }}>{running ? "Generating…" : "Run"}</button>
      </div>
      {err ? <div style={{ fontFamily: mn, fontSize: 11, color: D.coral, padding: "8px 12px", background: "rgba(224,99,71,0.08)", border: `1px solid ${D.coral}55`, borderRadius: 8, marginBottom: 12 }}>{err}</div> : null}
      <SectionLabel>Output</SectionLabel>
      <div style={{ minHeight: 120, background: D.bg, border: `1px solid ${D.border}`, borderRadius: 8, padding: "12px 14px", fontFamily: ft, fontSize: 13.5, color: D.tx, whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{out || (running ? "…" : <span style={{ color: D.txd }}>Run something to see output here.</span>)}</div>
      {out ? <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}><button type="button" onClick={() => navigator.clipboard?.writeText(out).then(() => onToast("Copied"))} style={{ padding: "6px 12px", background: "transparent", border: `1px solid ${D.border}`, borderRadius: 6, color: D.tx, fontFamily: mn, fontSize: 10, cursor: "pointer", letterSpacing: 0.6 }}>Copy</button></div> : null}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Local voice-block builder (mirrors lib/brand-voice.ts buildVoiceBlock)
// so the preview reflects unsaved edits without requiring a save first.
// ════════════════════════════════════════════════════════════════════

const ANTI_BOT_BASELINE =
  "Anti-bot rules (always apply):\n" +
  "- No em dashes. Use periods or commas.\n" +
  "- No emojis.\n" +
  "- No three-dot ellipses.\n" +
  "- Vary sentence length: mix short (5-9 words) with medium (12-20).\n" +
  "- Don't begin two adjacent sentences with the same word.\n" +
  "- One concrete claim per sentence. Specific numbers and named entities beat generic adjectives.\n" +
  "- Active voice. Direct verbs.\n" +
  "- Permit fragments when a writer would use them.\n" +
  "- Avoid: game-changer, unlock, leverage, harness, revolutionize, cutting-edge, transform, synergy, deep dive, dive into, in conclusion, it's worth noting, in today's fast-paced.\n" +
  "- Never start with: In the world of, In an era where, As we know.\n" +
  "- If a sentence could appear on any company's blog without changes, rewrite it.";

const FORMALITY_PROSE = [
  "Institutional — full sentences, sober register, no contractions",
  "Direct — short sentences, no fluff, contractions OK",
  "Casual — conversational, contractions, occasional fragments",
  "Playful — willing to break rhythm, use a wink, never cringe",
];
const SPICE_PROSE = [
  "Sober — let the data speak, no editorializing",
  "Confident — say what you think, no hedging",
  "Sharp — name names, pick sides, make claims falsifiable",
  "Spicy — willing to provoke; never below the belt",
];
const LENGTH_PROSE = [
  "Terse — one or two short sentences",
  "Standard — 2-4 sentences, every one earning its place",
  "Verbose — fully developed paragraph but no padding",
];
const VOCAB_PROSE = [
  "Technical — assume reader knows the domain, name parts and processes",
  "Mixed — explain just enough that an informed outsider follows",
  "Accessible — translate jargon; metaphors OK if accurate",
];

function buildLocalVoiceBlock(voice: Voice): string {
  const t = voice.tone;
  const tone = [
    "- " + FORMALITY_PROSE[Math.min(3, Math.max(0, t.formality))],
    "- " + SPICE_PROSE[Math.min(3, Math.max(0, t.spice))],
    "- " + LENGTH_PROSE[Math.min(2, Math.max(0, t.length))],
    "- " + VOCAB_PROSE[Math.min(2, Math.max(0, t.vocab))],
  ].join("\n");
  const parts: string[] = [];
  parts.push("\n\n--- VOICE GUIDELINES ---");
  parts.push(ANTI_BOT_BASELINE);
  parts.push(`Voice profile: ${voice.name}` + (voice.description ? ` — ${voice.description}` : ""));
  parts.push("Tone & rhythm:\n" + tone);
  if (voice.encouraged.length) parts.push("Lean into: " + voice.encouraged.join(", "));
  if (voice.banned.length) parts.push("Never use (in addition to baseline): " + voice.banned.join(", "));
  const goods = voice.examples.filter((e) => e.kind === "good" && e.text.trim());
  const bads = voice.examples.filter((e) => e.kind === "bad" && e.text.trim());
  if (goods.length) parts.push("GOOD examples (match this rhythm and density):\n" + goods.map((e) => `• "${e.text.trim()}"` + (e.note ? ` [why: ${e.note}]` : "")).join("\n"));
  if (bads.length) parts.push("BAD examples (avoid this style):\n" + bads.map((e) => `• "${e.text.trim()}"` + (e.note ? ` [why: ${e.note}]` : "")).join("\n"));
  if (voice.notes?.trim()) parts.push("Notes: " + voice.notes.trim());
  parts.push("--- END VOICE ---");
  return "\n" + parts.join("\n\n");
}

// ── shared bits ────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: D.txd, fontWeight: 700, marginBottom: 6 }}>{children}</div>;
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  );
}

const muted: React.CSSProperties = { fontFamily: mn, fontSize: 12, color: D.txm, padding: 20 };
const hintBox: React.CSSProperties = { fontFamily: ft, fontSize: 13, color: D.txm, lineHeight: 1.5, padding: "12px 14px", background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10, marginBottom: 18 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.03)", border: `1px solid ${D.border}`, borderRadius: 6, color: D.tx, fontFamily: ft, fontSize: 13, outline: "none", boxSizing: "border-box" };
const ghostBtn: React.CSSProperties = { padding: "8px 14px", background: "transparent", color: D.tx, border: `1px solid ${D.border}`, borderRadius: 8, fontFamily: ft, fontSize: 12, cursor: "pointer", letterSpacing: 0.3 };
