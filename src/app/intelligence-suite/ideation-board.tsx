"use client";

// IdeationBoardPanel — IntelligenceSUITE absorption shell for the
// existing IdeationNation tool. We re-import IdeationNation as-is so
// the starfield hero, wizard, and idea generation stay intact and the
// /ideation-nation route keeps working unchanged. Around it we add:
//   - a "Based on signal:" context field (v1: visual only; the wiring
//     into IdeationNation's prompt is a follow-up since IdeationNation
//     owns its own wizard state today),
//   - a window listener for the "is-radar-to-ideation" event so Story
//     Radar can pre-fill the context with a topic name,
//   - per-idea action chips (Save / Brief Builder / Carousel / Thread
//     Composer) rendered as a parallel bar below the wrapped tool,
//     reading saved ideas from localStorage so we don't refactor
//     IdeationNation's internal IdeaCard.

import React, { useEffect, useState } from "react";
import IdeationNation from "../ideation-nation";
import { D, ft, gf, mn } from "../shared-constants";
import { useStore, type ToolOutput } from "../lib/store";
import { showToast } from "../toast-context";
import { SaveToLibrary } from "../components/save-to-library";

interface SavedIdea {
  id: string;
  title: string;
  content_type?: string;
  description?: string;
  based_on?: string;
}

interface RadarToIdeationDetail {
  topic?: string;
  name?: string;
  title?: string;
}

const IDEA_DESTINATIONS = [
  { id: "p2p",      label: "Brief Builder",    kind: "brief"  as ToolOutput["kind"] },
  { id: "carousel", label: "Carousel",         kind: "other"  as ToolOutput["kind"] },
  { id: "captions", label: "Thread Composer",  kind: "thread" as ToolOutput["kind"] },
];

function ideaToText(idea: SavedIdea): string {
  const parts = [idea.title];
  if (idea.description) parts.push("", idea.description);
  if (idea.based_on) parts.push("", "Based on: " + idea.based_on);
  return parts.join("\n");
}

interface SendIdeaChipProps {
  idea: SavedIdea;
  destId: string;
  destLabel: string;
  kind: ToolOutput["kind"];
}

function SendIdeaChip({ idea, destId, destLabel, kind }: SendIdeaChipProps) {
  const [hover, setHover] = useState(false);
  function send() {
    const body = ideaToText(idea);
    const store = useStore.getState();
    store.pushOutput({
      sourceTool: "ideation",
      kind,
      payload: body,
      preview: idea.title.slice(0, 140),
    });
    store.setPendingRoute({
      destinationTool: destId,
      sourceTool: "ideation",
      payload: body,
      kind,
    });
    window.dispatchEvent(new CustomEvent("poast-nav", { detail: destId }));
    showToast("Sent to " + destLabel + ".", "success");
  }
  return (
    <span
      onClick={send}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      role="button"
      title={"Send '" + idea.title + "' to " + destLabel}
      style={{
        fontFamily: mn,
        fontSize: 9,
        color: hover ? D.amber : "rgba(255,255,255,0.5)",
        cursor: "pointer",
        padding: "3px 8px",
        borderRadius: 6,
        border: "1px solid " + (hover ? D.amber + "55" : D.border),
        background: hover ? D.amber + "08" : "transparent",
        userSelect: "none",
        transition: "all 0.2s ease",
        whiteSpace: "nowrap",
      }}
    >
      Send to {destLabel}
    </span>
  );
}

export default function IdeationBoardPanel() {
  const [context, setContext] = useState("");
  const [tab, setTab] = useState<"all" | "saved">("all");
  const [savedIdeas, setSavedIdeas] = useState<SavedIdea[]>([]);

  // Listen for Story Radar -> Ideation handoff. The event detail can
  // arrive in a few shapes (topic / name / title) depending on which
  // surface dispatches; coalesce them.
  useEffect(() => {
    function onRadar(e: Event) {
      const detail = (e as CustomEvent<RadarToIdeationDetail>).detail || {};
      const topic = detail.topic || detail.name || detail.title || "";
      if (topic) setContext(topic);
    }
    window.addEventListener("is-radar-to-ideation", onRadar as EventListener);
    return () => window.removeEventListener("is-radar-to-ideation", onRadar as EventListener);
  }, []);

  // Mirror IdeationNation's saved ideas out of localStorage so we can
  // render action chips per idea without modifying IdeationNation's
  // internal IdeaCard.
  useEffect(() => {
    function load() {
      try {
        const raw = localStorage.getItem("ideation-saved");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setSavedIdeas(parsed as SavedIdea[]);
        }
      } catch (e) {}
    }
    load();
    const t = setInterval(load, 2000);
    function onStorage(e: StorageEvent) {
      if (e.key === "ideation-saved") load();
    }
    window.addEventListener("storage", onStorage);
    return () => {
      clearInterval(t);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Action-chips panel only surfaces saved ideas — they're the only
  // ones persisted to localStorage and stable across reloads. The
  // "All Ideas" tab still drives the hub header; chips below collapse
  // when it's active.
  const showChipPanel = tab === "saved";
  const visibleIdeas = savedIdeas;

  return (
    <div style={{ position: "relative" }}>
      {/* Hub header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, gap: 16, flexWrap: "wrap" }}>
        <div style={{ fontFamily: gf, fontSize: 28, fontWeight: 800, color: D.tx, letterSpacing: -0.6 }}>
          Ideation Board
        </div>
        <div style={{ display: "flex", background: D.card, borderRadius: 10, border: "1px solid " + D.border, padding: 3 }}>
          {([
            { key: "all", label: "All Ideas" },
            { key: "saved", label: "Saved" },
          ] as const).map((t) => {
            const on = tab === t.key;
            return (
              <div
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  padding: "7px 16px",
                  borderRadius: 8,
                  cursor: "pointer",
                  background: on ? D.amber + "18" : "transparent",
                  border: on ? "1px solid " + D.amber + "30" : "1px solid transparent",
                  fontFamily: ft,
                  fontSize: 12,
                  fontWeight: on ? 700 : 500,
                  color: on ? D.amber : D.txd,
                  transition: "all 0.2s ease",
                }}
              >
                {t.label}
              </div>
            );
          })}
        </div>
      </div>

      {/* Based on signal: context field */}
      <div style={{ marginBottom: 18, padding: "12px 14px", background: D.card, border: "1px solid " + D.border, borderRadius: 10, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontFamily: mn, fontSize: 10, color: D.txm, textTransform: "uppercase", letterSpacing: 0.6, whiteSpace: "nowrap" }}>
          Based on signal:
        </div>
        <input
          type="text"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Paste a trend, news headline, or topic to seed generations"
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            fontFamily: ft,
            fontSize: 13,
            color: D.tx,
          }}
        />
        {context && (
          <span
            onClick={() => setContext("")}
            role="button"
            title="Clear signal context"
            style={{
              fontFamily: mn,
              fontSize: 9,
              color: D.txd,
              cursor: "pointer",
              padding: "3px 8px",
              borderRadius: 6,
              border: "1px solid " + D.border,
              whiteSpace: "nowrap",
            }}
          >
            Clear
          </span>
        )}
      </div>

      {/* Wrapped IdeationNation — keeps its starfield hero + wizard intact */}
      <IdeationNation />

      {/* Per-idea action chips. Renders below the wrapped tool so we
          don't have to fork IdeationNation's IdeaCard. Pulls from the
          same localStorage key IdeationNation writes to. */}
      {showChipPanel && visibleIdeas.length > 0 && (
        <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid " + D.border }}>
          <div style={{ fontFamily: mn, fontSize: 10, color: D.txm, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>
            Idea actions
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {visibleIdeas.map((idea) => (
              <div
                key={idea.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  background: D.card,
                  border: "1px solid " + D.border,
                  borderRadius: 10,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: 1, minWidth: 200, fontFamily: ft, fontSize: 12, color: D.tx, fontWeight: 600 }}>
                  {idea.title}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <SaveToLibrary
                    title={idea.title}
                    prompt={ideaToText(idea)}
                    tool="ideation"
                  />
                  {IDEA_DESTINATIONS.map((dest) => (
                    <SendIdeaChip
                      key={dest.id}
                      idea={idea}
                      destId={dest.id}
                      destLabel={dest.label}
                      kind={dest.kind}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
