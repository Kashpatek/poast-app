"use client";
// Shared page header for every MarketingSUITE view. One consistent title block —
// an accent-tinted icon chip + title (+ optional muted aside) + subtitle — with a
// right-aligned slot for each view's own controls. Icon and accent default to the
// VIEWS metadata so the header always matches the nav rail the user clicked to get
// here; pass `title`/`icon`/`accent` only to override.
import React from "react";
import type { LucideIcon } from "lucide-react";
import { D, ft, gf } from "../../shared-constants";
import { VIEWS, type ViewId } from "../marketing-constants";

interface PageHeaderProps {
  id: ViewId;
  title?: string; // descriptive title; defaults to the rail label
  aside?: React.ReactNode; // muted text rendered right after the title (e.g. "· Mon Jun 29")
  subtitle?: React.ReactNode;
  right?: React.ReactNode; // view-specific controls, right-aligned
  icon?: LucideIcon; // override the rail icon (rare)
  accent?: string; // override the rail accent (rare)
  style?: React.CSSProperties; // wrapper overrides (e.g. marginBottom)
}

export default function PageHeader({ id, title, aside, subtitle, right, icon, accent, style }: PageHeaderProps) {
  const def = VIEWS.find((v) => v.id === id);
  const Icon = icon || def?.Icon;
  const ac = accent || def?.accent || D.amber;
  const label = title ?? def?.label ?? "";
  return (
    <div
      style={{
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        gap: 16, marginBottom: 18, flexWrap: "wrap", fontFamily: ft, ...style,
      }}
    >
      <div style={{ flex: 1, minWidth: 240 }}>
        <h1 style={{ margin: 0, fontFamily: gf, fontSize: 27, fontWeight: 800, letterSpacing: -0.4, display: "inline-flex", alignItems: "center", gap: 12, color: D.tx, lineHeight: 1.1 }}>
          {Icon && (
            <span style={{ width: 36, height: 36, borderRadius: 10, flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", background: ac + "14", border: `1px solid ${ac}33` }}>
              <Icon size={20} color={ac} />
            </span>
          )}
          <span>
            {label}
            {aside != null && <span style={{ color: D.txm, fontWeight: 400 }}> {aside}</span>}
          </span>
        </h1>
        {subtitle != null && (
          <div style={{ marginTop: 7, fontSize: 13, color: D.txm, maxWidth: 640, lineHeight: 1.45 }}>{subtitle}</div>
        )}
      </div>
      {right != null && (
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>{right}</div>
      )}
    </div>
  );
}
