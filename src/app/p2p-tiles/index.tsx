"use client";

// Premier Suite tile sub-views. Each tile gets a focused experience here
// instead of bloating press-to-premier.tsx. The hub dispatches to one of
// these via a `view` switch.
//
// Design goal: each tile is independently useful even before the full
// implementation lands. Stock and Editor are the highest-priority tiles
// per the user's feedback (clip matching + in-suite editing).

import React, { useEffect, useState } from "react";
import { D, ft, gf, mn } from "../shared-constants";
import { StockLibraryView } from "./stock-library";
import { PremierEditorView } from "./premier-editor";
import { EpisodeHighlightsView } from "./episode-highlights";
import { DataStoryView } from "./data-story";
import { ContentClipperView } from "./content-clipper";
import { RenderQueueView } from "./render-queue";

export type SuiteView = "stock" | "editor" | "highlights" | "data-story" | "clipper" | "queue";

export interface TileProps {
  onBack: () => void;
}

export function TileShell({ title, badge, sub, onBack, children }: {
  title: string;
  badge: string;
  sub?: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <span onClick={onBack} style={{ fontFamily: mn, fontSize: 11, color: D.txm, cursor: "pointer", letterSpacing: 0.6 }}>
          ← Premier Suite
        </span>
      </div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 10px", borderRadius: 999, background: "rgba(247,176,65,0.10)", border: `1px solid ${D.amber}55`, marginBottom: 14 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: D.amber, boxShadow: `0 0 8px ${D.amber}` }} />
        <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.amber, textTransform: "uppercase" }}>{badge}</span>
      </div>
      <h1 style={{ fontFamily: gf, fontSize: 38, fontWeight: 900, letterSpacing: -1, margin: 0, marginBottom: 8, color: D.tx }}>{title}</h1>
      {sub ? <div style={{ fontFamily: ft, fontSize: 15, color: D.txm, maxWidth: 720, lineHeight: 1.5, marginBottom: 28 }}>{sub}</div> : null}
      {children}
    </div>
  );
}

export function TileDispatcher({ view, onBack }: { view: SuiteView; onBack: () => void }) {
  if (view === "stock")      return <StockLibraryView onBack={onBack} />;
  if (view === "editor")     return <PremierEditorView onBack={onBack} />;
  if (view === "highlights") return <EpisodeHighlightsView onBack={onBack} />;
  if (view === "data-story") return <DataStoryView onBack={onBack} />;
  if (view === "clipper")    return <ContentClipperView onBack={onBack} />;
  if (view === "queue")      return <RenderQueueView onBack={onBack} />;
  return null;
}
