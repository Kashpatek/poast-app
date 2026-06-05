"use client";

// SendToChip — shared dropdown chip that routes a generated text payload
// to another tool via the Zustand output bus + the existing window
// "poast-nav" navigation event. Extracted from the brainstorm.tsx
// SendToMenu pattern so every output card across the suite can offer
// the same handoff vocabulary without duplicating the popover.
//
// Destination ids in the public DESTINATIONS list use the task-spec
// vocabulary ("capper", "distribution", ...). The internal navSec maps
// each to the real sidebar section the poast-nav listener in
// poast-client.tsx switches on ("captions", "distpack", ...), which
// would silently no-op otherwise.

import React, { useEffect, useRef, useState } from "react";
import { D, ft, mn, type LLMProviderName } from "../shared-constants";
import { useStore, type ToolOutput } from "../lib/store";
import { showToast } from "../toast-context";

export interface Destination {
  id: string;
  label: string;
  desc: string;
  navSec: string;
  autoConsume: boolean;
}

export const DESTINATIONS: Destination[] = [
  { id: "approval",     label: "Approval Queue",   desc: "Queue for sign-off",           navSec: "approval", autoConsume: true  },
  { id: "weekly",       label: "SA Weekly",        desc: "Drop into the weekly kit",     navSec: "weekly",   autoConsume: true  },
  { id: "perf",         label: "Perf Tracker",     desc: "Track this post's numbers",    navSec: "perf",     autoConsume: false },
  { id: "distribution", label: "Distribution Pack",desc: "Bundle into a launch pack",    navSec: "distpack", autoConsume: true  },
  { id: "capper",       label: "Capper",           desc: "Spin captions from this",      navSec: "captions", autoConsume: true  },
  { id: "brief-builder",label: "Brief Builder",    desc: "Seed a production brief",      navSec: "brief-builder", autoConsume: false },
];

interface SendToChipProps {
  text: string;
  sourceTool: string;
  provider?: LLMProviderName;
  kind?: ToolOutput["kind"];
  excludeDestinations?: string[];
}

export function SendToChip({ text, sourceTool, provider, kind, excludeDestinations }: SendToChipProps) {
  var _open = useState(false), open = _open[0], setOpen = _open[1];
  var _hover = useState(false), hover = _hover[0], setHover = _hover[1];
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(function() {
    if (!open) return;
    const onDocClick = function(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return function() { document.removeEventListener("mousedown", onDocClick); };
  }, [open]);

  const visible = DESTINATIONS.filter(function(d) {
    if (d.id === sourceTool) return false;
    if (excludeDestinations && excludeDestinations.indexOf(d.id) !== -1) return false;
    return true;
  });

  function pick(dest: Destination) {
    const body = (text || "").trim();
    if (!body) {
      showToast("Nothing to send yet.", "info");
      setOpen(false);
      return;
    }
    const resolvedKind: ToolOutput["kind"] = kind || "caption";
    const store = useStore.getState();
    store.pushOutput({
      sourceTool: sourceTool,
      kind: resolvedKind,
      payload: body,
      preview: body.slice(0, 140),
      provider: provider,
    });
    if (dest.autoConsume) {
      store.setPendingRoute({
        destinationTool: dest.navSec,
        sourceTool: sourceTool,
        payload: body,
        kind: resolvedKind,
      });
      window.dispatchEvent(new CustomEvent("poast-nav", { detail: dest.navSec }));
    }
    setOpen(false);
    showToast("Sent to " + dest.label + ".", "success");
  }

  const chipColor = open || hover ? D.amber : "rgba(255,255,255,0.4)";
  const chipBorder = open || hover ? D.amber + "55" : D.border;

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <span
        onClick={function() { setOpen(function(v) { return !v; }); }}
        onMouseEnter={function() { setHover(true); }}
        onMouseLeave={function() { setHover(false); }}
        role="button"
        title="Send this to another tool"
        style={{
          fontFamily: mn,
          fontSize: 9,
          color: chipColor,
          cursor: "pointer",
          padding: "3px 8px",
          borderRadius: 6,
          border: "1px solid " + chipBorder,
          background: open ? D.amber + "08" : "transparent",
          userSelect: "none",
          transition: "all 0.2s ease",
          whiteSpace: "nowrap",
          display: "inline-block",
        }}
      >Send to {"→"}</span>
      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 4px)",
          right: 0,
          minWidth: 200,
          background: D.surface,
          border: "1px solid " + D.border,
          borderRadius: 8,
          boxShadow: "0 8px 28px rgba(0,0,0,0.55)",
          zIndex: 50,
          padding: 4,
        }}>
          {visible.length === 0 && (
            <div style={{ padding: "8px 10px", fontFamily: ft, fontSize: 11, color: D.txd }}>
              No destinations available.
            </div>
          )}
          {visible.map(function(dest) {
            return (
              <div
                key={dest.id}
                onClick={function() { pick(dest); }}
                style={{
                  padding: "8px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                  transition: "background 0.15s ease, color 0.15s ease",
                }}
                onMouseEnter={function(e: React.MouseEvent<HTMLDivElement>) {
                  e.currentTarget.style.background = D.amber + "10";
                }}
                onMouseLeave={function(e: React.MouseEvent<HTMLDivElement>) {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <div style={{ fontFamily: mn, fontSize: 10, fontWeight: 700, color: D.tx, letterSpacing: 0.4, textTransform: "uppercase" }}>{dest.label}</div>
                <div style={{ fontFamily: ft, fontSize: 11, color: D.txm, marginTop: 2 }}>{dest.desc}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SendToChip;
