"use client";

// Voice Lab — two AIs in conversation distill your writing style into
// concrete voice rules another AI can follow. Three rounds:
//   1. Analyzer reads your good/bad examples + tone dials, proposes patterns
//   2. Critic challenges the analyzer's claims, finds gaps, suggests fixes
//   3. Analyzer synthesizes into JSON the editor merges back into your voice
//
// The point isn't to replace manual tuning. It's to surface the patterns
// you intuitively follow but haven't articulated yet — the things that
// separate "sounds like SemiAnalysis" from "sounds like a brand blog."

import React, { useMemo, useState } from "react";
import { D, ft, mn } from "../shared-constants";
import type { LLMProvider } from "@/lib/llm-provider";
import { TONE_LABELS, type Voice, type VoiceExample } from "@/lib/brand-voice";

interface TranscriptMsg {
  role: "analyzer" | "critic";
  provider: LLMProvider;
  content: string;
  round: number;
}

interface ProposedUpdate {
  encouraged: string[];
  banned: string[];
  notes: string;
  reasoning: string;
}

const PROVIDER_COLORS: Record<LLMProvider, string> = {
  claude: "#F7B041",
  gemini: "#0B86D1",
  grok: "#905CCB",
  openai: "#10A37F",
};

export function VoiceLab({ voice, onApply }: { voice: Voice; onApply: (patch: { encouraged?: string[]; banned?: string[]; notes?: string }) => void }) {
  const [analyzer, setAnalyzer] = useState<LLMProvider>("claude");
  const [critic, setCritic] = useState<LLMProvider>("gemini");
  const [focus, setFocus] = useState("");
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<"idle" | "round1" | "round2" | "round3">("idle");
  const [transcript, setTranscript] = useState<TranscriptMsg[]>([]);
  const [proposed, setProposed] = useState<ProposedUpdate | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const examples = voice.examples || [];
  const goods = useMemo(() => examples.filter((e) => e.kind === "good"), [examples]);
  const bads = useMemo(() => examples.filter((e) => e.kind === "bad"), [examples]);
  const canRun = goods.length >= 1 && !running;

  async function run() {
    if (!canRun) return;
    setRunning(true);
    setErr(null);
    setTranscript([]);
    setProposed(null);

    try {
      const exampleBlock = formatExamples(voice);

      setStage("round1");
      const r1 = await callRole({
        provider: analyzer,
        system: ANALYZER_SYSTEM,
        prompt: buildAnalyzerPrompt(voice, exampleBlock, focus),
      });
      setTranscript((t) => [...t, { role: "analyzer", provider: analyzer, content: r1, round: 1 }]);

      setStage("round2");
      const r2 = await callRole({
        provider: critic,
        system: CRITIC_SYSTEM,
        prompt: buildCriticPrompt(exampleBlock, r1),
      });
      setTranscript((t) => [...t, { role: "critic", provider: critic, content: r2, round: 2 }]);

      setStage("round3");
      const r3 = await callRole({
        provider: analyzer,
        system: SYNTHESIZE_SYSTEM,
        prompt: buildSynthesizePrompt(r1, r2),
      });
      setTranscript((t) => [...t, { role: "analyzer", provider: analyzer, content: r3, round: 3 }]);

      const parsed = parseFinalUpdate(r3);
      if (parsed) setProposed(parsed);
      else setErr("Round 3 didn't return parseable JSON. Re-run, or pull the rules manually from the transcript above.");
    } catch (e) {
      setErr(String(e));
    } finally {
      setRunning(false);
      setStage("idle");
    }
  }

  function applyAll() {
    if (!proposed) return;
    onApply({
      encouraged: dedupe([...(voice.encouraged || []), ...proposed.encouraged]),
      banned: dedupe([...(voice.banned || []), ...proposed.banned]),
      notes: voice.notes ? voice.notes.trim() + "\n\n— added by Voice Lab —\n" + proposed.notes : proposed.notes,
    });
    setProposed(null);
    setTranscript([]);
  }

  function dropProposed() {
    setProposed(null);
  }

  return (
    <div>
      <div style={hintBox}>
        Two AIs analyze your good/bad examples in three rounds. Round 1 the analyzer proposes voice rules.
        Round 2 the critic challenges them. Round 3 the analyzer synthesizes a final patch you can review
        and merge into <strong style={{ color: D.amber }}>{voice.name}</strong>.
      </div>

      {/* Setup */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <RolePicker label="Analyzer" sub="reads examples, proposes patterns" value={analyzer} onChange={setAnalyzer} />
        <RolePicker label="Critic" sub="challenges + finds gaps" value={critic} onChange={setCritic} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700, marginBottom: 4 }}>What should they focus on? (optional)</div>
        <textarea
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          placeholder="e.g. teach them why my hook tweets work — the specific rhythm of the first sentence, why I never use questions, what makes my numbers land"
          style={{ width: "100%", minHeight: 64, padding: "10px 12px", background: D.surface, border: `1px solid ${D.border}`, borderRadius: 8, color: D.tx, fontFamily: ft, fontSize: 13, lineHeight: 1.5, outline: "none", boxSizing: "border-box", resize: "vertical" }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ fontFamily: mn, fontSize: 11, color: D.txm, letterSpacing: 0.4 }}>
          Examples in this voice: <strong style={{ color: D.teal }}>{goods.length} good</strong> · <strong style={{ color: D.coral }}>{bads.length} bad</strong>
        </div>
        {goods.length === 0 ? (
          <div style={{ fontFamily: mn, fontSize: 10, color: D.coral, letterSpacing: 0.4 }}>add at least one GOOD example to the voice first</div>
        ) : null}
        <button
          type="button"
          onClick={run}
          disabled={!canRun}
          style={{ marginLeft: "auto", padding: "10px 22px", background: canRun ? D.amber : "transparent", color: canRun ? "#060608" : D.txd, border: `1px solid ${canRun ? D.amber : D.border}`, borderRadius: 8, fontFamily: ft, fontSize: 13, fontWeight: 800, cursor: canRun ? "pointer" : "not-allowed", letterSpacing: 0.3 }}
        >
          {running ? labelForStage(stage) : "▶ Run Lab"}
        </button>
      </div>

      {err ? (
        <div style={{ fontFamily: mn, fontSize: 11, color: D.coral, padding: "8px 12px", background: D.coral + "10", border: `1px solid ${D.coral}55`, borderRadius: 8, marginBottom: 12, whiteSpace: "pre-wrap" }}>{err}</div>
      ) : null}

      {/* Transcript */}
      {transcript.length > 0 || running ? (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Transcript</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {transcript.map((m, i) => (
              <TranscriptCard key={i} msg={m} />
            ))}
            {running && (stage === "round1" || stage === "round2" || stage === "round3") ? (
              <PendingCard stage={stage} analyzer={analyzer} critic={critic} />
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Proposed updates */}
      {proposed ? (
        <div style={{ background: "rgba(247,176,65,0.04)", border: `1px solid ${D.amber}55`, borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ fontFamily: mn, fontSize: 11, color: D.amber, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700, marginBottom: 10 }}>Proposed voice update</div>

          <UpdateSection label="Add to Lean Into" items={proposed.encouraged} accent={D.teal} />
          <UpdateSection label="Add to Never Use" items={proposed.banned} accent={D.coral} />

          {proposed.notes ? (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Notes to append</div>
              <div style={{ fontFamily: ft, fontSize: 12.5, color: D.tx, lineHeight: 1.55, background: D.bg, padding: "10px 12px", borderRadius: 8, border: `1px solid ${D.border}`, whiteSpace: "pre-wrap" }}>{proposed.notes}</div>
            </div>
          ) : null}

          {proposed.reasoning ? (
            <div style={{ marginBottom: 14, fontFamily: ft, fontSize: 12, color: D.txm, lineHeight: 1.5, fontStyle: "italic" }}>
              <strong style={{ color: D.txd, fontFamily: mn, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, fontStyle: "normal" }}>Why this update:</strong> {proposed.reasoning}
            </div>
          ) : null}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" onClick={dropProposed} style={ghostBtn}>Discard</button>
            <button type="button" onClick={applyAll} style={{ padding: "9px 18px", background: D.amber, color: "#060608", border: "none", borderRadius: 8, fontFamily: ft, fontSize: 13, fontWeight: 800, cursor: "pointer", letterSpacing: 0.3 }}>Merge into {voice.name}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────

function labelForStage(s: "idle" | "round1" | "round2" | "round3"): string {
  if (s === "round1") return "Round 1 · analyzing…";
  if (s === "round2") return "Round 2 · critiquing…";
  if (s === "round3") return "Round 3 · synthesizing…";
  return "Running…";
}

function dedupe(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    const k = s.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(s.trim());
  }
  return out;
}

function formatExamples(voice: Voice): string {
  const goods = (voice.examples || []).filter((e) => e.kind === "good");
  const bads = (voice.examples || []).filter((e) => e.kind === "bad");
  const fmt = (e: VoiceExample) => `• "${e.text.trim()}"` + (e.note?.trim() ? ` [user note: ${e.note.trim()}]` : "");
  const parts: string[] = [];
  if (goods.length) parts.push("GOOD examples (the user likes these — match this rhythm/density):\n" + goods.map(fmt).join("\n"));
  if (bads.length) parts.push("BAD examples (the user rejects these — figure out why):\n" + bads.map(fmt).join("\n"));
  return parts.join("\n\n");
}

const ANALYZER_SYSTEM = "You are a senior brand strategist analyzing a user's writing style from their examples. Extract the SPECIFIC patterns that make their good captions work and the patterns they reject in bad ones. Be concrete — name actual sentence structures, word choices, rhythm. Avoid generic advice like 'be concise' or 'use active voice' — assume the next AI already knows the basics. Hunt for the non-obvious patterns.";

function buildAnalyzerPrompt(voice: Voice, exampleBlock: string, focus: string): string {
  const t = voice.tone || { formality: 1, spice: 1, length: 1, vocab: 1 };
  const tonePretty = [
    "Formality: " + (TONE_LABELS.formality[t.formality] || "—"),
    "Stance: " + (TONE_LABELS.spice[t.spice] || "—"),
    "Length: " + (TONE_LABELS.length[t.length] || "—"),
    "Vocabulary: " + (TONE_LABELS.vocab[t.vocab] || "—"),
  ].join(" · ");
  return [
    `Voice profile: "${voice.name}"` + (voice.description ? ` — ${voice.description}` : ""),
    `Tone dials: ${tonePretty}`,
    voice.encouraged?.length ? `Already encouraged: ${voice.encouraged.join(", ")}` : "",
    voice.banned?.length ? `Already banned: ${voice.banned.join(", ")}` : "",
    "",
    exampleBlock,
    "",
    focus.trim() ? `User wants you to focus on: ${focus.trim()}` : "",
    "",
    "Your task:",
    "1. Identify 3-5 SPECIFIC patterns in the good captions (name sentence rhythms, word choices, structural moves you can point to in the actual text).",
    "2. Identify 3-5 SPECIFIC patterns in the bad ones that the user rejects. Be precise about what makes each one fail.",
    "3. Note 1-2 NON-OBVIOUS patterns about this voice that a generic style guide would miss.",
    "",
    "Output: 200-400 words of prose. For each claim, quote a phrase from the actual examples as evidence. No headers, no markdown — flowing analysis.",
  ].filter(Boolean).join("\n");
}

const CRITIC_SYSTEM = "You are a brand strategist with a different lens, critiquing another strategist's analysis. Your job: find what they MISSED, generic claims, or contradictions with the actual examples. Be specific and constructive. Don't be polite — be useful.";

function buildCriticPrompt(exampleBlock: string, r1: string): string {
  return [
    "The same examples:",
    exampleBlock,
    "",
    "The first strategist's analysis:",
    "\"\"\"",
    r1,
    "\"\"\"",
    "",
    "Your critique:",
    "1. What pattern in the GOOD examples did they miss? Quote the phrase that proves it.",
    "2. Which of their claims are too generic to be actionable? (replace with concrete advice)",
    "3. Anything in their analysis that the actual examples contradict?",
    "4. Propose 2-3 SPECIFIC additions or corrections.",
    "",
    "Output: 150-300 words of prose. Direct and concrete. No headers.",
  ].join("\n");
}

const SYNTHESIZE_SYSTEM = "You synthesize an analysis and a critique into a final, actionable voice profile update. Output ONLY valid JSON, no markdown fences, no preamble, no trailing text.";

function buildSynthesizePrompt(r1: string, r2: string): string {
  return [
    "Original analysis:",
    "\"\"\"",
    r1,
    "\"\"\"",
    "",
    "Critic's response:",
    "\"\"\"",
    r2,
    "\"\"\"",
    "",
    "Synthesize. Output JSON in this exact format with no other text:",
    "{",
    '  "encouraged": ["specific phrase pattern", "another pattern", "..."],',
    '  "banned": ["specific phrase or pattern to avoid", "..."],',
    '  "notes": "1-2 paragraph synthesis of the voice essence, naming the specific patterns identified",',
    '  "reasoning": "1 short paragraph explaining what the critic added and how you incorporated it"',
    "}",
    "",
    "Rules for the arrays:",
    "- 3-6 items each",
    '- CONCRETE enough that another AI reading them would produce specifically-styled output (e.g. "open with a number + named entity in the first 7 words" not "be specific")',
    "- Use actual phrasing from the analysis where it nails the pattern",
    "- Strip duplicates with what's already in the voice (don't repeat banned phrases the user already added)",
  ].join("\n");
}

function parseFinalUpdate(raw: string): ProposedUpdate | null {
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    // Find the first { and last } in case the model added preamble despite instructions.
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    const json = cleaned.slice(start, end + 1);
    const p = JSON.parse(json);
    return {
      encouraged: Array.isArray(p.encouraged) ? p.encouraged.filter((s: unknown) => typeof s === "string") : [],
      banned: Array.isArray(p.banned) ? p.banned.filter((s: unknown) => typeof s === "string") : [],
      notes: typeof p.notes === "string" ? p.notes : "",
      reasoning: typeof p.reasoning === "string" ? p.reasoning : "",
    };
  } catch {
    return null;
  }
}

async function callRole(opts: { provider: LLMProvider; system: string; prompt: string }): Promise<string> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system: opts.system,
      prompt: opts.prompt,
      provider: opts.provider,
      applyBrandVoice: false, // Lab calls are meta-analysis — never inject voice into them
      maxTokens: 3000,
    }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error((j.error && (j.error.message || j.error)) || `Provider ${opts.provider} returned ${res.status}`);
  return (j.content || []).map((c: { text?: string }) => c.text || "").join("");
}

// ── Subcomponents ──────────────────────────────────────────────────

function RolePicker({ label, sub, value, onChange }: { label: string; sub: string; value: LLMProvider; onChange: (v: LLMProvider) => void }) {
  return (
    <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700, marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: mn, fontSize: 9.5, color: D.txd, letterSpacing: 0.4, marginBottom: 6 }}>{sub}</div>
      <div style={{ display: "flex", gap: 4 }}>
        {(["claude", "gemini", "grok", "openai"] as LLMProvider[]).map((p) => {
          const on = value === p;
          const c = PROVIDER_COLORS[p];
          return (
            <button key={p} type="button" onClick={() => onChange(p)} style={{
              flex: 1,
              padding: "6px 10px",
              background: on ? c + "22" : "transparent",
              color: on ? c : D.txm,
              border: `1px solid ${on ? c + "66" : D.border}`,
              borderRadius: 6,
              fontFamily: mn,
              fontSize: 10.5,
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: 0.5,
              textTransform: "uppercase",
            }}>{p}</button>
          );
        })}
      </div>
    </div>
  );
}

function TranscriptCard({ msg }: { msg: TranscriptMsg }) {
  const c = PROVIDER_COLORS[msg.provider];
  return (
    <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderLeft: `3px solid ${c}`, borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />
        <span style={{ fontFamily: mn, fontSize: 10, color: c, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700 }}>{msg.provider}</span>
        <span style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.4, textTransform: "uppercase" }}>· Round {msg.round} · {msg.role === "analyzer" ? (msg.round === 3 ? "synthesis" : "analyzing") : "critique"}</span>
      </div>
      <div style={{ fontFamily: ft, fontSize: 13, color: D.tx, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{msg.content}</div>
    </div>
  );
}

function PendingCard({ stage, analyzer, critic }: { stage: "round1" | "round2" | "round3"; analyzer: LLMProvider; critic: LLMProvider }) {
  const which = stage === "round2" ? critic : analyzer;
  const c = PROVIDER_COLORS[which];
  const label = stage === "round1" ? "analyzing examples…" : stage === "round2" ? "challenging the analysis…" : "synthesizing the final voice update…";
  return (
    <div style={{ background: D.surface, border: `1px dashed ${c}55`, borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, animation: "vlPulse 1.1s ease-in-out infinite" }} />
      <span style={{ fontFamily: mn, fontSize: 11, color: c, letterSpacing: 0.5, fontWeight: 700, textTransform: "uppercase" }}>{which}</span>
      <span style={{ fontFamily: mn, fontSize: 11, color: D.txm, letterSpacing: 0.4 }}>{label}</span>
      <style dangerouslySetInnerHTML={{ __html: "@keyframes vlPulse{0%,100%{opacity:0.3}50%{opacity:1}}" }} />
    </div>
  );
}

function UpdateSection({ label, items, accent }: { label: string; items: string[]; accent: string }) {
  if (!items.length) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {items.map((t, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", background: accent + "1c", color: accent, border: `1px solid ${accent}55`, borderRadius: 999, fontFamily: ft, fontSize: 12, letterSpacing: 0.2, lineHeight: 1.4 }}>{t}</span>
        ))}
      </div>
    </div>
  );
}

const hintBox: React.CSSProperties = { fontFamily: ft, fontSize: 13, color: D.txm, lineHeight: 1.55, padding: "12px 14px", background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10, marginBottom: 18 };
const ghostBtn: React.CSSProperties = { padding: "9px 16px", background: "transparent", color: D.tx, border: `1px solid ${D.border}`, borderRadius: 8, fontFamily: ft, fontSize: 12, cursor: "pointer", letterSpacing: 0.3 };
