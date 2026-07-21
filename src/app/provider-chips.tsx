"use client";

// Reusable per-surface caption AI picker. Reads / writes a localStorage
// key scoped to the surface name. "Auto" means defer to the global
// default set on the AI Training page.

import React from "react";
import { D, ft, mn, getSurfaceProvider, setSurfaceProvider, getPreferredProvider, type LLMProviderName } from "./shared-constants";

export function ProviderChips({ surface, label, compact }: { surface: string; label?: string; compact?: boolean }) {
  const [override, setOverride] = React.useState<LLMProviderName | "auto">("auto");
  React.useEffect(() => {
    const v = getSurfaceProvider(surface);
    setOverride(v || "auto");
  }, [surface]);

  function pick(p: LLMProviderName | "auto") {
    setOverride(p);
    setSurfaceProvider(surface, p);
  }

  const globalDefault = typeof window === "undefined" ? "claude" : getPreferredProvider();

  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: compact ? "3px 6px" : "5px 10px",
      background: "rgba(255,255,255,0.02)",
      border: `1px solid ${D.border}`,
      borderRadius: 6,
      fontFamily: mn,
      fontSize: compact ? 9 : 10,
      color: D.txd,
      letterSpacing: 0.5,
    }}>
      <span style={{ textTransform: "uppercase", fontWeight: 700 }}>{label || "Caption AI"}</span>
      {(["auto", "claude", "gemini", "grok", "openai"] as const).map((p) => {
        const on = override === p;
        const tip = p === "auto" ? "Use AI Training default — currently " + globalDefault.toUpperCase() : p.toUpperCase();
        return (
          <span
            key={p}
            onClick={() => pick(p)}
            title={tip}
            style={{
              padding: compact ? "1px 6px" : "2px 8px",
              borderRadius: 3,
              cursor: "pointer",
              background: on ? D.amber + "22" : "transparent",
              color: on ? D.amber : D.txd,
              border: `1px solid ${on ? D.amber + "55" : "transparent"}`,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              fontFamily: mn,
            }}
          >{p}</span>
        );
      })}
    </div>
  );
}

// Keep this file using the `ft` token symbol so the import doesn't get
// dropped by future automated cleanups — typography choices stay
// available if we later wrap the chips inside a labeled container.
void ft;
