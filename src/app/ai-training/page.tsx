"use client";

// AI Training hub. Four tabs:
//   Voice — brand voice editor (rules, examples, banned phrases). Saved
//   to projects/brand-voice-master; auto-injected into caption-gen
//   prompts when callers set applyBrandVoice on /api/generate.
//   Headline Doctor — existing tool, embedded as a section.
//   Voice Scorer  — existing tool, embedded as a section.
//   Playground   — quick test bench: pick a provider, run a prompt,
//   compare outputs with and without the brand voice.

import React, { useEffect, useState } from "react";
import { D, ft, mn, getPreferredProvider, setPreferredProvider, type LLMProviderName } from "../shared-constants";
import { useToast } from "../toast-context";
import HeadlineDoctor from "../headline-doctor";
import VoiceScorer from "../voice-scorer";
import type { LLMProvider } from "@/lib/llm-provider";

type Tab = "voice" | "headline" | "voice-scorer" | "playground";

interface BrandVoice {
  tone?: string;
  banned?: string;
  encouraged?: string;
  goodExamples?: string;
  badExamples?: string;
  notes?: string;
  updatedAt?: string;
}

export default function AITrainingPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>("voice");
  const [pref, setPref] = useState<LLMProviderName>("claude");

  useEffect(() => { setPref(getPreferredProvider()); }, []);

  function pickGlobal(p: LLMProviderName) {
    setPref(p);
    setPreferredProvider(p);
    showToast("Default caption provider set to " + p.toUpperCase() + ". Every caption tool will use this now.");
  }

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 32px" }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 10px", borderRadius: 999, background: "rgba(247,176,65,0.10)", border: `1px solid ${D.amber}55`, marginBottom: 14 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: D.amber, boxShadow: `0 0 8px ${D.amber}` }} />
          <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.amber, textTransform: "uppercase" }}>AI Training</span>
        </div>
        <h1 style={{ fontFamily: ft, fontSize: 44, fontWeight: 900, letterSpacing: -1.4, margin: 0, marginBottom: 6, color: D.tx }}>Train the AI</h1>
        <div style={{ fontFamily: ft, fontSize: 14, color: D.txm, maxWidth: 720, lineHeight: 1.5 }}>
          Teach the captioner what we sound like. Score voiceovers. Doctor headlines. Test prompts across Claude, Gemini, and Grok side by side.
        </div>
      </div>

      {/* Global default-provider picker. Persists to localStorage and is
          read by shared askAPI/askAPIRaw helpers across the app. */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap", padding: "10px 14px", background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10 }}>
        <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: D.txd, fontWeight: 700 }}>Default caption AI</div>
        {(["claude", "gemini", "grok"] as LLMProviderName[]).map((p) => {
          const active = pref === p;
          return (
            <button key={p} type="button" onClick={() => pickGlobal(p)} style={{ padding: "6px 14px", background: active ? D.amber + "20" : "transparent", color: active ? D.amber : D.tx, border: `1px solid ${active ? D.amber + "55" : D.border}`, borderRadius: 6, fontFamily: mn, fontSize: 11, fontWeight: 700, letterSpacing: 0.6, cursor: "pointer", textTransform: "uppercase" }}>
              {p}
            </button>
          );
        })}
        <div style={{ marginLeft: "auto", fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4 }}>
          applies to every caption-gen tool — overrideable per call
        </div>
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
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                padding: "8px 16px",
                background: active ? D.amber : "transparent",
                color: active ? "#060608" : D.tx,
                border: `1px solid ${active ? D.amber : D.border}`,
                borderRadius: 8,
                fontFamily: ft,
                fontSize: 13,
                fontWeight: active ? 800 : 500,
                cursor: "pointer",
                letterSpacing: 0.3,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "voice" ? <BrandVoiceEditor onToast={showToast} /> : null}
      {tab === "headline" ? <div><HeadlineDoctor /></div> : null}
      {tab === "voice-scorer" ? <div><VoiceScorer /></div> : null}
      {tab === "playground" ? <Playground onToast={showToast} /> : null}
    </div>
  );
}

// ── Brand Voice editor ─────────────────────────────────────────────
function BrandVoiceEditor({ onToast }: { onToast: (m: string) => void }) {
  const [voice, setVoice] = useState<BrandVoice>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/brand-voice")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.voice) setVoice(j.voice);
        if (j.updated_at) setLastSaved(j.updated_at);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function set<K extends keyof BrandVoice>(k: K, v: BrandVoice[K]) {
    setVoice((cur) => ({ ...cur, [k]: v }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/brand-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice }),
      });
      const j = await res.json();
      if (!res.ok) { onToast(j.error || "Couldn't save brand voice"); return; }
      setLastSaved(new Date().toISOString());
      onToast("Brand voice saved. New captions will use this on the next generate.");
    } catch (e) {
      onToast(String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={muted}>Loading…</div>;

  return (
    <div>
      <div style={hintBox}>
        These rules get injected into the system prompt for any caption-gen call that opts in with <code style={code}>applyBrandVoice: true</code>.
        Saved here once → used everywhere captions are produced. No restarts needed.
      </div>

      <BVField label="Tone" hint="What does our voice sound like? (e.g. direct, data-forward, sober. No hype, no em dashes.)" value={voice.tone || ""} onChange={(v) => set("tone", v)} />
      <BVField label="Lean into" hint="Patterns to encourage (e.g. specific numbers, named vendors, clear takeaway in the first line)." value={voice.encouraged || ""} onChange={(v) => set("encouraged", v)} />
      <BVField label="Never use" hint='Phrases / patterns the model must avoid (e.g. "game-changer", "unlock", em dashes, three-dot ellipses).' value={voice.banned || ""} onChange={(v) => set("banned", v)} />
      <BVField label="Good examples" hint="Paste a few real captions that worked well. The model copies the structure and tone." value={voice.goodExamples || ""} onChange={(v) => set("goodExamples", v)} minHeight={120} />
      <BVField label="Bad examples" hint="Paste captions that missed. The model treats these as anti-patterns." value={voice.badExamples || ""} onChange={(v) => set("badExamples", v)} minHeight={120} />
      <BVField label="Notes" hint="Anything else worth telling the model — context that doesn't fit above." value={voice.notes || ""} onChange={(v) => set("notes", v)} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 18 }}>
        <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.6 }}>
          {lastSaved ? "Last saved " + new Date(lastSaved).toLocaleString() : "Not saved yet"}
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{ padding: "10px 20px", background: D.amber, color: "#060608", border: "none", borderRadius: 8, fontFamily: ft, fontSize: 13, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", letterSpacing: 0.3, opacity: saving ? 0.5 : 1 }}
        >
          {saving ? "Saving…" : "Save brand voice"}
        </button>
      </div>
    </div>
  );
}

function BVField({ label, hint, value, onChange, minHeight = 64 }: { label: string; hint: string; value: string; onChange: (v: string) => void; minHeight?: number }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: D.txd, fontWeight: 700 }}>{label}</div>
        <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4 }}>{value.length} chars</div>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={hint}
        style={{ width: "100%", padding: "10px 12px", background: D.surface, border: `1px solid ${D.border}`, borderRadius: 8, color: D.tx, fontFamily: ft, fontSize: 13, outline: "none", boxSizing: "border-box", minHeight, resize: "vertical", lineHeight: 1.5 }}
      />
    </div>
  );
}

// ── Playground ─────────────────────────────────────────────────────
function Playground({ onToast }: { onToast: (m: string) => void }) {
  const [system, setSystem] = useState("You write Instagram captions for SemiAnalysis. Keep it under 220 chars. No hashtags, no em dashes, no hype.");
  const [prompt, setPrompt] = useState("Caption for a carousel cover about NVIDIA Blackwell yields hitting 90%, written for an audience of GPU procurement leads.");
  const [provider, setProvider] = useState<LLMProvider>("claude");
  const [withVoice, setWithVoice] = useState(true);
  const [running, setRunning] = useState(false);
  const [out, setOut] = useState<string>("");
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
      const text = (j.content || []).map((c: { text?: string }) => c.text || "").join("");
      setOut(text);
    } catch (e) {
      setErr(String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <div style={hintBox}>
        Run any system + user prompt across the three providers. Toggle the brand voice on/off to see how much your rules are changing the output.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: D.txd, fontWeight: 700, marginBottom: 4 }}>System prompt</div>
          <textarea value={system} onChange={(e) => setSystem(e.target.value)} style={{ width: "100%", padding: "10px 12px", background: D.surface, border: `1px solid ${D.border}`, borderRadius: 8, color: D.tx, fontFamily: ft, fontSize: 13, outline: "none", boxSizing: "border-box", minHeight: 110, resize: "vertical", lineHeight: 1.5 }} />
        </div>
        <div>
          <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: D.txd, fontWeight: 700, marginBottom: 4 }}>User prompt</div>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} style={{ width: "100%", padding: "10px 12px", background: D.surface, border: `1px solid ${D.border}`, borderRadius: 8, color: D.tx, fontFamily: ft, fontSize: 13, outline: "none", boxSizing: "border-box", minHeight: 110, resize: "vertical", lineHeight: 1.5 }} />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: D.txd, fontWeight: 700 }}>Provider</div>
        {(["claude", "gemini", "grok"] as LLMProvider[]).map((p) => {
          const active = provider === p;
          return (
            <button key={p} type="button" onClick={() => setProvider(p)} style={{ padding: "6px 14px", background: active ? D.amber + "20" : "transparent", color: active ? D.amber : D.tx, border: `1px solid ${active ? D.amber + "55" : D.border}`, borderRadius: 6, fontFamily: mn, fontSize: 11, fontWeight: 700, letterSpacing: 0.6, cursor: "pointer", textTransform: "uppercase" }}>
              {p}
            </button>
          );
        })}
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: mn, fontSize: 11, color: D.txm, cursor: "pointer", marginLeft: 12 }}>
          <input type="checkbox" checked={withVoice} onChange={(e) => setWithVoice(e.target.checked)} style={{ accentColor: D.amber }} />
          Apply brand voice
        </label>
        <button type="button" onClick={run} disabled={!prompt.trim() || running} style={{ marginLeft: "auto", padding: "10px 20px", background: prompt.trim() && !running ? D.amber : "transparent", color: prompt.trim() && !running ? "#060608" : D.txd, border: `1px solid ${prompt.trim() && !running ? D.amber : D.border}`, borderRadius: 8, fontFamily: ft, fontSize: 13, fontWeight: 800, cursor: prompt.trim() && !running ? "pointer" : "not-allowed", letterSpacing: 0.3 }}>
          {running ? "Generating…" : "Run"}
        </button>
      </div>

      {err ? <div style={{ fontFamily: mn, fontSize: 11, color: D.coral, padding: "8px 12px", background: "rgba(224,99,71,0.08)", border: `1px solid ${D.coral}55`, borderRadius: 8, marginBottom: 12 }}>{err}</div> : null}

      <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: D.txd, fontWeight: 700, marginBottom: 4 }}>Output</div>
      <div style={{ minHeight: 120, background: D.bg, border: `1px solid ${D.border}`, borderRadius: 8, padding: "12px 14px", fontFamily: ft, fontSize: 13.5, color: D.tx, whiteSpace: "pre-wrap", lineHeight: 1.55 }}>
        {out || (running ? "…" : <span style={{ color: D.txd }}>Run something to see output here.</span>)}
      </div>
      {out ? (
        <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
          <button type="button" onClick={() => { navigator.clipboard?.writeText(out).then(() => onToast("Copied")); }} style={{ padding: "6px 12px", background: "transparent", border: `1px solid ${D.border}`, borderRadius: 6, color: D.tx, fontFamily: mn, fontSize: 10, cursor: "pointer", letterSpacing: 0.6 }}>Copy</button>
        </div>
      ) : null}
    </div>
  );
}

// ── shared bits ────────────────────────────────────────────────────
const muted: React.CSSProperties = { fontFamily: mn, fontSize: 12, color: D.txm, padding: 20 };
const hintBox: React.CSSProperties = { fontFamily: ft, fontSize: 13, color: D.txm, lineHeight: 1.5, padding: "12px 14px", background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10, marginBottom: 18 };
const code: React.CSSProperties = { fontFamily: mn, fontSize: 11.5, background: D.bg, padding: "1px 6px", borderRadius: 3, border: `1px solid ${D.border}` };
