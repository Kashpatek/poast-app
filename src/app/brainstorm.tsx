"use client";

// ═══ BRAINSTORM · TENNIS ═══
// Phase 3 of POAST 4.0. Iterative round-based ideation tool.
//
// Round 1 (Cast wide): User pastes a topic + optional source-type
// context. We generate 10 angles. Each angle has a hook, a 1-line
// body, an audience-fit estimate, the LLM provider that produced
// it, and an id. Star 1-4 to keep.
//
// Round 2 (Go deep): For each starred angle we generate 5 follow-up
// takes (variations on framing). Star a subset.
//
// Round 3 (Productize): For each surviving angle we generate a
// shareable package — thread + caption + hook — ready to push out
// to Capper / SA Weekly / Brief Builder / Approval Queue / Saved
// Prompts via the cross-tool routing bus (src/app/lib/store.ts).
//
// Persistence: every meaningful state change debounces a write to
// Supabase via /api/db with row id "brainstorm-<sessionId>" in the
// `projects` table. Mirrors the SA Weekly weeklyDbSync pattern.
//
// Provider: every /api/generate call sends the resolved provider
// (per-surface override falling back to global default). Each angle
// records its own provider so the user can see which LLM produced
// which take. Multi-provider riff toggle fans Round 1 / Round 2
// across all three providers, badging each card.

import React, { useState, useEffect, useRef } from "react";
import { D, ft, gf, mn, getSurfaceProvider, getPreferredProvider, type LLMProviderName } from "./shared-constants";
import { ProviderChips } from "./provider-chips";
import { CAPPER_SOURCES, type CapperSource } from "./poast-client";
import { useUser } from "./user-context";
import { useStore, type ToolOutput } from "./lib/store";
import { showToast } from "./toast-context";

// ─── Types ────────────────────────────────────────────────────────────

type AudienceFit = "niche" | "broad" | "bullseye" | "scroll-stopper";

interface Angle {
  id: string;
  hook: string;          // 5-12 words
  body: string;          // 1 sentence
  audienceFit: AudienceFit;
  provider: LLMProviderName;
  // Round 3 productize-output. Only present once productized.
  packaged?: AnglePackage;
}

interface AnglePackage {
  thread: string;        // multi-line thread, post-per-line
  caption: string;       // single-post caption
  hook: string;          // sharpest one-line hook
}

interface Round {
  number: 1 | 2 | 3;
  angles: Angle[];       // Round 1 = wide; Round 2 = follow-ups; Round 3 = productized survivors
  starredIds: string[];
  // For Round 2 we group follow-ups by their parent angle id (the
  // Round 1 starred angle they riff on). Round 3 also uses this to
  // know which parent each productized output came from.
  parentByAngle?: Record<string, string>;
}

interface BrainstormSession {
  sessionId: string;
  title: string;
  sourceType: string;       // CAPPER_SOURCES key
  topic: string;            // raw user input
  multiProviderRiff: boolean;
  rounds: Round[];          // sparse — only completed rounds are present
  updatedAt: string;
  createdBy: string;
}

// ─── Constants ────────────────────────────────────────────────────────

const ALL_PROVIDERS: LLMProviderName[] = ["claude", "gemini", "grok"];

const AUDIENCE_FIT_VALUES: AudienceFit[] = ["niche", "broad", "bullseye", "scroll-stopper"];

const AUDIENCE_FIT_COLORS: Record<AudienceFit, string> = {
  "niche": D.violet,
  "broad": D.blue,
  "bullseye": D.amber,
  "scroll-stopper": D.crimson,
};

const PROVIDER_COLORS: Record<LLMProviderName, string> = {
  claude: D.amber,
  gemini: D.blue,
  grok: D.violet,
};

const DESTINATIONS = [
  { id: "captions",  label: "Capper",          kind: "caption" as const },
  { id: "approval",  label: "Approval Queue",  kind: "other"   as const },
  { id: "prompts",   label: "Saved Prompts",   kind: "other"   as const },
  { id: "weekly",    label: "SA Weekly",       kind: "other"   as const },
  { id: "p2p",       label: "Brief Builder",   kind: "brief"   as const },
];

// ─── ID helpers ───────────────────────────────────────────────────────

function makeId(prefix: string): string {
  return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

// ─── System prompts ───────────────────────────────────────────────────

const SYS_R1 = "You generate angles for SemiAnalysis content brainstorms. Output ONLY valid JSON (no markdown fences, no preamble). " +
  "Schema: { \"angles\": [ { \"hook\": string, \"body\": string, \"audienceFit\": \"niche\" | \"broad\" | \"bullseye\" | \"scroll-stopper\" } ] }. " +
  "Hook is 5-12 words, a sharp opener (not a question, no clickbait). " +
  "Body is exactly one sentence, plain language, no em dashes. " +
  "AudienceFit picks ONE label that matches the angle's reach: " +
  "  - niche (deep-tech crowd only), " +
  "  - broad (general tech audience), " +
  "  - bullseye (SA's exact audience), " +
  "  - scroll-stopper (stops thumbs in any feed). " +
  "Never repeat the same hook framing twice in one batch.";

const SYS_R2 = "You generate follow-up framings for a single SemiAnalysis content angle. Output ONLY valid JSON (no fences, no preamble). " +
  "Schema: { \"angles\": [ { \"hook\": string, \"body\": string, \"audienceFit\": \"niche\" | \"broad\" | \"bullseye\" | \"scroll-stopper\" } ] }. " +
  "Each follow-up reframes the SAME core idea differently (e.g. contrarian take, numbers-first, story lede, hot take, methodology-first). " +
  "Hook is 5-12 words. Body is one sentence. No em dashes. Pick a different audienceFit per follow-up when possible.";

const SYS_R3 = "You productize a SemiAnalysis content angle into a shareable package. Output ONLY valid JSON (no fences, no preamble). " +
  "Schema: { \"thread\": string, \"caption\": string, \"hook\": string }. " +
  "thread: 3-5 posts, separated by literal \\n\\n (blank line between posts). First post is the hook, last post wraps with a takeaway. No hashtags. No em dashes. " +
  "caption: a single ~2-3 sentence post, brand-safe, suitable for LinkedIn / X. " +
  "hook: the single sharpest one-line opener (5-12 words).";

// ─── Provider resolution ──────────────────────────────────────────────

function resolveProvider(): LLMProviderName {
  return getSurfaceProvider("brainstorm") || getPreferredProvider();
}

// ─── API call ─────────────────────────────────────────────────────────

interface RawAngle { hook?: unknown; body?: unknown; audienceFit?: unknown }
interface RawAngleResponse { angles?: RawAngle[] }
interface RawPackage { thread?: unknown; caption?: unknown; hook?: unknown }

async function generateJSON<T>(system: string, prompt: string, provider: LLMProviderName): Promise<T | null> {
  try {
    const r = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: system,
        prompt: prompt,
        provider: provider,
        applyBrandVoice: true,
      }),
    });
    const d = await r.json();
    if (d.error) {
      const msg = (typeof d.error === "object" && d.error !== null) ? (d.error.message || JSON.stringify(d.error)) : String(d.error);
      showToast("Brainstorm · " + provider.toUpperCase() + " error: " + msg);
      return null;
    }
    if (!d.content) return null;
    const raw = (d.content || []).map(function(c: { text?: string }) { return c.text || ""; }).join("");
    const cleaned = raw.replace(/```json|```/g, "").trim();
    try { return JSON.parse(cleaned) as T; } catch (e) { console.error("Brainstorm parse:", cleaned); return null; }
  } catch (e) {
    console.error("Brainstorm network:", e);
    return null;
  }
}

// Sanity-coerce a raw angle JSON to our Angle type, slapping on an id + provider.
function coerceAngle(raw: RawAngle, provider: LLMProviderName): Angle | null {
  if (!raw || typeof raw !== "object") return null;
  const hook = typeof raw.hook === "string" ? raw.hook.trim() : "";
  const body = typeof raw.body === "string" ? raw.body.trim() : "";
  const fit = typeof raw.audienceFit === "string" ? raw.audienceFit.trim().toLowerCase() : "broad";
  if (!hook || !body) return null;
  const audienceFit: AudienceFit = (AUDIENCE_FIT_VALUES as string[]).includes(fit) ? fit as AudienceFit : "broad";
  return { id: makeId("angle"), hook: hook, body: body, audienceFit: audienceFit, provider: provider };
}

// ─── Persistence (debounced) ──────────────────────────────────────────

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function persistSession(session: BrainstormSession): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(function() {
    fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        table: "projects",
        data: {
          id: "brainstorm-" + session.sessionId,
          name: session.title || "Untitled Brainstorm",
          type: "brainstorm",
          updated_at: new Date().toISOString(),
          data: {
            sessionId: session.sessionId,
            title: session.title,
            sourceType: session.sourceType,
            topic: session.topic,
            multiProviderRiff: session.multiProviderRiff,
            rounds: session.rounds,
            updatedAt: session.updatedAt,
            createdBy: session.createdBy,
          },
        },
      }),
    }).catch(function() { /* swallow — non-blocking */ });
  }, 1000);
}

// ─── Send-to chip ─────────────────────────────────────────────────────

function SendToMenu({ payload, preview, kind, provider }: {
  payload: unknown;
  preview: string;
  kind: ToolOutput["kind"];
  provider?: LLMProviderName;
}) {
  const [open, setOpen] = useState(false);
  const setPendingRoute = useStore(function(s) { return s.setPendingRoute; });
  const pushOutput = useStore(function(s) { return s.pushOutput; });
  const ref = useRef<HTMLDivElement | null>(null);

  // Close on outside click
  useEffect(function() {
    if (!open) return;
    const onDocClick = function(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return function() { document.removeEventListener("mousedown", onDocClick); };
  }, [open]);

  function pick(dest: { id: string; label: string; kind: ToolOutput["kind"] }) {
    // Honor each destination's preferred kind (Capper → "caption",
    // Brief Builder → "brief", others → fall back to the source card's
    // kind so the outer chip semantics stay correct).
    var resolvedKind: ToolOutput["kind"] = dest.kind === "other" ? kind : dest.kind;
    setPendingRoute({
      destinationTool: dest.id,
      sourceTool: "brainstorm",
      payload: payload,
      kind: resolvedKind,
    });
    pushOutput({
      sourceTool: "brainstorm",
      kind: resolvedKind,
      payload: payload,
      preview: preview,
      provider: provider,
    });
    setOpen(false);
    showToast("Sent to " + dest.label);
  }

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <span
        onClick={function() { setOpen(function(v) { return !v; }); }}
        style={{
          padding: "3px 8px",
          borderRadius: 4,
          cursor: "pointer",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid " + D.border,
          color: D.txm,
          fontFamily: mn,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 0.5,
          textTransform: "uppercase",
          userSelect: "none",
        }}
      >Send to →</span>
      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 4px)",
          right: 0,
          minWidth: 160,
          background: D.surface,
          border: "1px solid " + D.border,
          borderRadius: 6,
          boxShadow: "0 8px 28px rgba(0,0,0,0.55)",
          zIndex: 50,
          padding: 4,
        }}>
          {DESTINATIONS.map(function(dest) {
            return (
              <div
                key={dest.id}
                onClick={function() { pick(dest); }}
                style={{
                  padding: "6px 10px",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontFamily: ft,
                  fontSize: 11,
                  color: D.tx,
                  fontWeight: 500,
                  letterSpacing: 0.2,
                }}
                onMouseEnter={function(e: React.MouseEvent<HTMLDivElement>) { e.currentTarget.style.background = "rgba(247,176,65,0.08)"; e.currentTarget.style.color = D.amber; }}
                onMouseLeave={function(e: React.MouseEvent<HTMLDivElement>) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = D.tx; }}
              >{dest.label}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Angle card ───────────────────────────────────────────────────────

function AngleCard({ angle, starred, onToggleStar, onTrash, showSendTo }: {
  angle: Angle;
  starred: boolean;
  onToggleStar: () => void;
  onTrash: () => void;
  showSendTo: boolean;
}) {
  const fitColor = AUDIENCE_FIT_COLORS[angle.audienceFit];
  const provColor = PROVIDER_COLORS[angle.provider];

  return (
    <div style={{
      background: D.surface,
      border: "1px solid " + (starred ? D.amber + "55" : D.border),
      borderLeft: "3px solid " + (starred ? D.amber : provColor),
      borderRadius: 10,
      padding: "14px 16px",
      transition: "border-color 0.2s ease, transform 0.15s ease",
      boxShadow: starred ? "0 0 18px rgba(247,176,65,0.06)" : "0 2px 10px rgba(0,0,0,0.3)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
        <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 700, color: D.tx, lineHeight: 1.35 }}>{angle.hook}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span
            onClick={onToggleStar}
            title={starred ? "Unstar" : "Star (keep for next round)"}
            style={{
              cursor: "pointer",
              fontSize: 16,
              color: starred ? D.amber : D.txd,
              userSelect: "none",
              lineHeight: 1,
              transition: "color 0.15s",
            }}
          >{starred ? "★" : "☆"}</span>
          <span
            onClick={onTrash}
            title="Discard"
            style={{
              cursor: "pointer",
              fontFamily: mn,
              fontSize: 11,
              color: D.txd,
              padding: "0 4px",
              userSelect: "none",
            }}
            onMouseEnter={function(e: React.MouseEvent<HTMLElement>) { e.currentTarget.style.color = D.crimson; }}
            onMouseLeave={function(e: React.MouseEvent<HTMLElement>) { e.currentTarget.style.color = D.txd; }}
          >✕</span>
        </div>
      </div>

      <div style={{ fontFamily: ft, fontSize: 12, color: D.txm, lineHeight: 1.5, marginBottom: 10 }}>{angle.body}</div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
        <span style={{
          padding: "2px 8px",
          borderRadius: 3,
          background: fitColor + "18",
          color: fitColor,
          fontFamily: mn,
          fontSize: 8.5,
          fontWeight: 800,
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}>{angle.audienceFit}</span>
        <span style={{
          padding: "2px 8px",
          borderRadius: 3,
          background: provColor + "18",
          color: provColor,
          fontFamily: mn,
          fontSize: 8.5,
          fontWeight: 800,
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}>{angle.provider}</span>
        {showSendTo && (
          <div style={{ marginLeft: "auto" }}>
            <SendToMenu
              payload={{ hook: angle.hook, body: angle.body, audienceFit: angle.audienceFit, provider: angle.provider }}
              preview={angle.hook}
              kind="idea"
              provider={angle.provider}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Package card (Round 3) ───────────────────────────────────────────

function PackageCard({ angle }: { angle: Angle }) {
  const pkg = angle.packaged;
  if (!pkg) return null;
  const provColor = PROVIDER_COLORS[angle.provider];
  return (
    <div style={{
      background: D.surface,
      border: "1px solid " + D.border,
      borderLeft: "3px solid " + provColor,
      borderRadius: 10,
      padding: "16px 18px",
      marginBottom: 14,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontFamily: mn, fontSize: 9, fontWeight: 800, color: D.txm, letterSpacing: 1.2, textTransform: "uppercase" }}>
          Productized · <span style={{ color: provColor }}>{angle.provider}</span>
        </div>
        <SendToMenu
          payload={{ hook: pkg.hook, caption: pkg.caption, thread: pkg.thread, provider: angle.provider }}
          preview={pkg.hook}
          kind="thread"
          provider={angle.provider}
        />
      </div>

      <Section label="Hook">{pkg.hook}</Section>
      <Section label="Caption">{pkg.caption}</Section>
      <Section label="Thread">
        <div style={{ whiteSpace: "pre-wrap", fontFamily: ft, fontSize: 12.5, color: D.tx, lineHeight: 1.6 }}>{pkg.thread}</div>
      </Section>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontFamily: mn, fontSize: 8.5, fontWeight: 800, color: D.amber, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
      <div style={{ fontFamily: ft, fontSize: 13, color: D.tx, lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

// ─── Buttons ──────────────────────────────────────────────────────────

function PrimaryButton({ children, onClick, disabled, loading }: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const off = disabled || loading;
  return (
    <button
      onClick={off ? undefined : onClick}
      disabled={off}
      style={{
        padding: "11px 22px",
        borderRadius: 8,
        background: off ? "rgba(247,176,65,0.10)" : "linear-gradient(135deg, " + D.amber + " 0%, #E89A2B 100%)",
        border: "1px solid " + (off ? "rgba(247,176,65,0.18)" : D.amber),
        color: off ? D.txd : "#0A0A14",
        fontFamily: mn,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: 1.2,
        textTransform: "uppercase",
        cursor: off ? "not-allowed" : "pointer",
        boxShadow: off ? "none" : "0 4px 16px rgba(247,176,65,0.25)",
        transition: "all 0.2s ease",
      }}
    >{loading ? "Working..." : children}</button>
  );
}

// ─── Main component ───────────────────────────────────────────────────

export default function Brainstorm() {
  const userCtx = useUser();

  // Single in-flight session. Reset to start a fresh one.
  const [sessionId] = useState(function() { return makeId("bsn"); });
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [sourceType, setSourceType] = useState<string>("sa_podcast");
  const [multiProviderRiff, setMultiProviderRiff] = useState(false);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loadingRound, setLoadingRound] = useState<1 | 2 | 3 | null>(null);

  // Pull starred ids out of the rounds for breadcrumb display.
  const currentRoundNumber: 1 | 2 | 3 = rounds.length === 0 ? 1 : rounds.length === 1 ? 2 : rounds.length === 2 ? 3 : 3;
  const latestRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;
  const starredCount = latestRound ? latestRound.starredIds.length : 0;

  // Persistence — fire on every meaningful state change. Debounced
  // inside persistSession so a burst of edits collapses to one write.
  useEffect(function() {
    if (rounds.length === 0 && !topic && !title) return;
    const session: BrainstormSession = {
      sessionId: sessionId,
      title: title || (topic ? topic.slice(0, 60) : "Untitled Brainstorm"),
      sourceType: sourceType,
      topic: topic,
      multiProviderRiff: multiProviderRiff,
      rounds: rounds,
      updatedAt: new Date().toISOString(),
      createdBy: userCtx.user ? userCtx.user.name : "Unknown",
    };
    persistSession(session);
  }, [sessionId, title, topic, sourceType, multiProviderRiff, rounds, userCtx.user]);

  // ─── Round 1: cast wide ─────────────────────────────────────────────

  async function runRound1() {
    if (!topic.trim() || loadingRound !== null) return;
    setLoadingRound(1);
    try {
      const src: CapperSource = CAPPER_SOURCES.find(function(s) { return s.key === sourceType; }) || CAPPER_SOURCES[0];
      const userPrompt =
        "TOPIC: " + topic.trim() + "\n\n" +
        "SOURCE-TYPE CONTEXT: " + src.label + "\n" + src.voicePrompt + "\n\n" +
        "Generate exactly 10 distinct angles. Vary the framings (data, story, contrarian, hot take, methodology, etc.).";

      const providers = multiProviderRiff
        ? ALL_PROVIDERS
        : [resolveProvider()];

      // Fan out across providers. If single-provider, we ask for all 10.
      // If multi-provider, each provider produces ~4 angles so the total
      // sits around 10-12 (we then trim to 12 to keep the grid tidy).
      const perProvider = multiProviderRiff ? 4 : 10;
      const calls = providers.map(function(p) {
        return generateJSON<RawAngleResponse>(
          SYS_R1,
          userPrompt + "\n\nReturn exactly " + perProvider + " angles.",
          p,
        ).then(function(res) {
          if (!res || !Array.isArray(res.angles)) return [] as Angle[];
          return res.angles
            .map(function(a) { return coerceAngle(a, p); })
            .filter(function(a): a is Angle { return a !== null; });
        });
      });

      const buckets = await Promise.all(calls);
      const angles = buckets.flat().slice(0, multiProviderRiff ? 12 : 10);

      if (angles.length === 0) {
        showToast("Brainstorm · Round 1 returned no angles. Try again.");
        return;
      }

      const r1: Round = { number: 1, angles: angles, starredIds: [] };
      setRounds([r1]);
    } finally {
      setLoadingRound(null);
    }
  }

  // ─── Round 2: go deep on starred ────────────────────────────────────

  async function runRound2() {
    if (loadingRound !== null) return;
    const r1 = rounds[0];
    if (!r1 || r1.starredIds.length === 0) {
      showToast("Star 1-4 angles in Round 1 first.");
      return;
    }
    const starred = r1.angles.filter(function(a) { return r1.starredIds.includes(a.id); });
    setLoadingRound(2);
    try {
      const src: CapperSource = CAPPER_SOURCES.find(function(s) { return s.key === sourceType; }) || CAPPER_SOURCES[0];
      const providers = multiProviderRiff ? ALL_PROVIDERS : [resolveProvider()];

      // For each starred parent, generate 5 follow-ups. If multi-
      // provider riff is on, we shard the 5 across providers (2+2+1).
      const childPromises = starred.map(function(parent) {
        const parentPrompt =
          "TOPIC: " + topic.trim() + "\n" +
          "SOURCE-TYPE: " + src.label + "\n" + src.voicePrompt + "\n\n" +
          "PARENT ANGLE TO RIFF ON:\n" +
          "  Hook: " + parent.hook + "\n" +
          "  Body: " + parent.body + "\n\n" +
          "Generate 5 follow-up framings of THE SAME core idea. Different angles, not different topics.";

        if (!multiProviderRiff) {
          return generateJSON<RawAngleResponse>(SYS_R2, parentPrompt, providers[0]).then(function(res) {
            if (!res || !Array.isArray(res.angles)) return { parentId: parent.id, angles: [] as Angle[] };
            const out = res.angles
              .map(function(a) { return coerceAngle(a, providers[0]); })
              .filter(function(a): a is Angle { return a !== null; })
              .slice(0, 5);
            return { parentId: parent.id, angles: out };
          });
        }

        // Multi-provider: distribute across the 3 providers.
        const split: Record<LLMProviderName, number> = { claude: 2, gemini: 2, grok: 1 };
        const calls = providers.map(function(p) {
          const n = split[p] || 1;
          return generateJSON<RawAngleResponse>(SYS_R2, parentPrompt + "\n\nReturn exactly " + n + " follow-ups.", p)
            .then(function(res) {
              if (!res || !Array.isArray(res.angles)) return [] as Angle[];
              return res.angles
                .map(function(a) { return coerceAngle(a, p); })
                .filter(function(a): a is Angle { return a !== null; })
                .slice(0, n);
            });
        });
        return Promise.all(calls).then(function(buckets) {
          return { parentId: parent.id, angles: buckets.flat().slice(0, 5) };
        });
      });

      const childResults = await Promise.all(childPromises);
      const r2Angles: Angle[] = [];
      const parentByAngle: Record<string, string> = {};
      childResults.forEach(function(cr) {
        cr.angles.forEach(function(a) {
          r2Angles.push(a);
          parentByAngle[a.id] = cr.parentId;
        });
      });

      if (r2Angles.length === 0) {
        showToast("Brainstorm · Round 2 returned no follow-ups. Try again.");
        return;
      }

      const r2: Round = { number: 2, angles: r2Angles, starredIds: [], parentByAngle: parentByAngle };
      setRounds([r1, r2]);
    } finally {
      setLoadingRound(null);
    }
  }

  // ─── Round 3: productize survivors ──────────────────────────────────

  async function runRound3() {
    if (loadingRound !== null) return;
    const r2 = rounds[1];
    if (!r2 || r2.starredIds.length === 0) {
      showToast("Star at least one Round 2 angle to productize.");
      return;
    }
    const survivors = r2.angles.filter(function(a) { return r2.starredIds.includes(a.id); });
    setLoadingRound(3);
    try {
      const src: CapperSource = CAPPER_SOURCES.find(function(s) { return s.key === sourceType; }) || CAPPER_SOURCES[0];

      const calls = survivors.map(function(angle) {
        const provider = angle.provider; // honor the provider that produced the angle
        const prompt =
          "TOPIC: " + topic.trim() + "\n" +
          "SOURCE-TYPE: " + src.label + "\n" + src.voicePrompt + "\n\n" +
          "ANGLE TO PRODUCTIZE:\n" +
          "  Hook: " + angle.hook + "\n" +
          "  Body: " + angle.body + "\n" +
          "  Audience fit: " + angle.audienceFit + "\n\n" +
          "Generate a thread + caption + hook package.";

        return generateJSON<RawPackage>(SYS_R3, prompt, provider).then(function(res) {
          if (!res) return null;
          const thread = typeof res.thread === "string" ? res.thread.trim() : "";
          const caption = typeof res.caption === "string" ? res.caption.trim() : "";
          const hook = typeof res.hook === "string" ? res.hook.trim() : "";
          if (!thread && !caption && !hook) return null;
          const packaged: AnglePackage = { thread: thread, caption: caption, hook: hook };
          const next: Angle = Object.assign({}, angle, { id: makeId("angle"), packaged: packaged });
          return next;
        });
      });

      const results = (await Promise.all(calls)).filter(function(a): a is Angle { return a !== null; });
      if (results.length === 0) {
        showToast("Brainstorm · Round 3 returned no packages. Try again.");
        return;
      }

      const parentByAngle: Record<string, string> = {};
      results.forEach(function(a, i) {
        const parentR2 = survivors[i];
        if (parentR2) parentByAngle[a.id] = parentR2.id;
      });

      const r3: Round = { number: 3, angles: results, starredIds: results.map(function(a) { return a.id; }), parentByAngle: parentByAngle };
      setRounds([rounds[0], rounds[1], r3]);
    } finally {
      setLoadingRound(null);
    }
  }

  // ─── Mutators ───────────────────────────────────────────────────────

  function toggleStar(roundIdx: number, angleId: string) {
    setRounds(function(prev) {
      const next = prev.slice();
      const r = Object.assign({}, next[roundIdx]);
      const isStarred = r.starredIds.includes(angleId);
      if (isStarred) {
        r.starredIds = r.starredIds.filter(function(id) { return id !== angleId; });
      } else {
        // Round 1: cap at 4 stars to keep R2 fan-out tractable.
        if (r.number === 1 && r.starredIds.length >= 4) {
          showToast("Round 1 cap: 4 stars.");
          return prev;
        }
        r.starredIds = r.starredIds.concat([angleId]);
      }
      next[roundIdx] = r;
      return next;
    });
  }

  function trashAngle(roundIdx: number, angleId: string) {
    setRounds(function(prev) {
      const next = prev.slice();
      const r = Object.assign({}, next[roundIdx]);
      r.angles = r.angles.filter(function(a) { return a.id !== angleId; });
      r.starredIds = r.starredIds.filter(function(id) { return id !== angleId; });
      next[roundIdx] = r;
      return next;
    });
  }

  function resetSession() {
    setRounds([]);
    setTopic("");
    setTitle("");
  }

  // ─── Render ────────────────────────────────────────────────────────

  const r1 = rounds[0] || null;
  const r2 = rounds[1] || null;
  const r3 = rounds[2] || null;
  const hasAnything = rounds.length > 0;

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 32px 64px", fontFamily: ft, color: D.tx }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{ fontFamily: gf, fontSize: 44, fontWeight: 900, color: D.tx, letterSpacing: -1.5, lineHeight: 1 }}>Brainstorm</div>
          <span style={{
            padding: "3px 9px",
            borderRadius: 4,
            background: D.amber + "15",
            color: D.amber,
            fontFamily: mn,
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: 1.4,
            textTransform: "uppercase",
            border: "1px solid " + D.amber + "30",
          }}>Tennis</span>
        </div>
        <div style={{ fontFamily: ft, fontSize: 14, color: D.txm, marginBottom: 16 }}>
          Three rounds. Cast wide, go deep, productize. Star what survives.
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{
            fontFamily: mn,
            fontSize: 10,
            color: D.txm,
            letterSpacing: 1.4,
            textTransform: "uppercase",
            padding: "5px 10px",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid " + D.border,
            borderRadius: 6,
          }}>
            Round {currentRoundNumber} of 3 · {starredCount} starred
          </span>
          <ProviderChips surface="brainstorm" compact />
          <label style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontFamily: mn,
            fontSize: 9.5,
            color: multiProviderRiff ? D.amber : D.txm,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            padding: "5px 10px",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid " + (multiProviderRiff ? D.amber + "55" : D.border),
            borderRadius: 6,
            cursor: "pointer",
            userSelect: "none",
          }}>
            <input
              type="checkbox"
              checked={multiProviderRiff}
              onChange={function(e) { setMultiProviderRiff(e.target.checked); }}
              style={{ accentColor: D.amber, cursor: "pointer" }}
            />
            Multi-provider riff
          </label>
          {hasAnything && (
            <span
              onClick={resetSession}
              style={{
                marginLeft: "auto",
                padding: "5px 10px",
                cursor: "pointer",
                fontFamily: mn,
                fontSize: 9.5,
                color: D.txd,
                letterSpacing: 0.8,
                textTransform: "uppercase",
                border: "1px solid " + D.border,
                borderRadius: 6,
                userSelect: "none",
              }}
              onMouseEnter={function(e: React.MouseEvent<HTMLSpanElement>) { e.currentTarget.style.color = D.crimson; }}
              onMouseLeave={function(e: React.MouseEvent<HTMLSpanElement>) { e.currentTarget.style.color = D.txd; }}
            >Reset</span>
          )}
        </div>
      </div>

      {/* ── Setup card ── */}
      <div style={{
        background: D.cardGrad,
        border: "1px solid " + D.border,
        borderRadius: 14,
        padding: "22px 24px",
        marginBottom: 28,
      }}>
        <FieldLabel>Topic</FieldLabel>
        <textarea
          value={topic}
          onChange={function(e) { setTopic(e.target.value); }}
          placeholder="Paste a topic to begin (e.g. 'Trainium 3 vs Blackwell FP4 advantage')"
          rows={3}
          style={{
            width: "100%",
            padding: "12px 14px",
            background: D.surface,
            border: "1px solid " + D.border,
            borderRadius: 10,
            color: D.tx,
            fontFamily: ft,
            fontSize: 13,
            outline: "none",
            resize: "vertical",
            transition: "border-color 0.2s",
            marginBottom: 14,
            lineHeight: 1.5,
          }}
          onFocus={function(e) { e.target.style.borderColor = D.amber; }}
          onBlur={function(e) { e.target.style.borderColor = D.border; }}
        />

        <FieldLabel>Title (optional)</FieldLabel>
        <input
          value={title}
          onChange={function(e) { setTitle(e.target.value); }}
          placeholder="e.g. 'Trainium 3 launch coverage'"
          style={{
            width: "100%",
            padding: "10px 14px",
            background: D.surface,
            border: "1px solid " + D.border,
            borderRadius: 10,
            color: D.tx,
            fontFamily: ft,
            fontSize: 13,
            outline: "none",
            transition: "border-color 0.2s",
            marginBottom: 18,
          }}
          onFocus={function(e) { e.target.style.borderColor = D.amber; }}
          onBlur={function(e) { e.target.style.borderColor = D.border; }}
        />

        <FieldLabel>Source-type voice</FieldLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
          {CAPPER_SOURCES.map(function(s) {
            const on = sourceType === s.key;
            return (
              <div
                key={s.key}
                onClick={function() { setSourceType(s.key); }}
                title={s.example}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  cursor: "pointer",
                  background: on ? s.color + "18" : D.surface,
                  border: "1px solid " + (on ? s.color + "60" : D.border),
                  fontFamily: ft,
                  fontSize: 11.5,
                  fontWeight: on ? 700 : 500,
                  color: on ? s.color : D.txm,
                  transition: "all 0.15s",
                }}
              >{s.label}</div>
            );
          })}
        </div>

        <PrimaryButton
          onClick={runRound1}
          disabled={!topic.trim()}
          loading={loadingRound === 1}
        >Cast wide → 10 angles</PrimaryButton>
      </div>

      {/* ── Empty state ── */}
      {!hasAnything && !loadingRound && (
        <div style={{
          padding: "40px 24px",
          textAlign: "center",
          background: "rgba(255,255,255,0.015)",
          border: "1px dashed " + D.border,
          borderRadius: 12,
        }}>
          <div style={{ fontFamily: ft, fontSize: 15, color: D.txd, fontWeight: 500 }}>
            Paste a topic to begin
          </div>
        </div>
      )}

      {/* ── Round 1 ── */}
      {r1 && (
        <RoundBlock
          number={1}
          title="Cast wide"
          subtitle={r1.angles.length + " angles · star 1-4 to keep"}
          starredCount={r1.starredIds.length}
        >
          <Grid>
            {r1.angles.map(function(a) {
              return (
                <AngleCard
                  key={a.id}
                  angle={a}
                  starred={r1.starredIds.includes(a.id)}
                  onToggleStar={function() { toggleStar(0, a.id); }}
                  onTrash={function() { trashAngle(0, a.id); }}
                  showSendTo={false}
                />
              );
            })}
          </Grid>
          {!r2 && (
            <div style={{ marginTop: 20 }}>
              <PrimaryButton
                onClick={runRound2}
                disabled={r1.starredIds.length === 0}
                loading={loadingRound === 2}
              >Go deep on starred</PrimaryButton>
            </div>
          )}
        </RoundBlock>
      )}

      {/* ── Round 2 ── */}
      {r2 && (
        <RoundBlock
          number={2}
          title="Go deep"
          subtitle={r2.angles.length + " follow-ups · star survivors to productize"}
          starredCount={r2.starredIds.length}
        >
          <Grid>
            {r2.angles.map(function(a) {
              return (
                <AngleCard
                  key={a.id}
                  angle={a}
                  starred={r2.starredIds.includes(a.id)}
                  onToggleStar={function() { toggleStar(1, a.id); }}
                  onTrash={function() { trashAngle(1, a.id); }}
                  showSendTo={true}
                />
              );
            })}
          </Grid>
          {!r3 && (
            <div style={{ marginTop: 20 }}>
              <PrimaryButton
                onClick={runRound3}
                disabled={r2.starredIds.length === 0}
                loading={loadingRound === 3}
              >Productize</PrimaryButton>
            </div>
          )}
        </RoundBlock>
      )}

      {/* ── Round 3 ── */}
      {r3 && (
        <RoundBlock
          number={3}
          title="Productize"
          subtitle={r3.angles.length + " packages ready to push"}
          starredCount={r3.starredIds.length}
        >
          {r3.angles.map(function(a) { return <PackageCard key={a.id} angle={a} />; })}
        </RoundBlock>
      )}
    </div>
  );
}

// ─── Layout helpers ───────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: mn,
      fontSize: 10,
      color: D.amber,
      letterSpacing: 1.6,
      textTransform: "uppercase",
      fontWeight: 800,
      marginBottom: 8,
    }}>{children}</div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
      gap: 12,
    }}>{children}</div>
  );
}

function RoundBlock({ number, title, subtitle, starredCount, children }: {
  number: 1 | 2 | 3;
  title: string;
  subtitle: string;
  starredCount: number;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid " + D.border }}>
        <div style={{
          fontFamily: mn,
          fontSize: 10,
          color: D.amber,
          letterSpacing: 1.6,
          textTransform: "uppercase",
          fontWeight: 800,
        }}>Round {number}</div>
        <div style={{ fontFamily: gf, fontSize: 22, fontWeight: 800, color: D.tx, letterSpacing: -0.5 }}>{title}</div>
        <div style={{ fontFamily: ft, fontSize: 12, color: D.txm }}>· {subtitle}</div>
        {starredCount > 0 && (
          <div style={{
            marginLeft: "auto",
            fontFamily: mn,
            fontSize: 9,
            color: D.amber,
            letterSpacing: 1.2,
            textTransform: "uppercase",
          }}>★ {starredCount}</div>
        )}
      </div>
      {children}
    </div>
  );
}
