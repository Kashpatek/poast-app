"use client";
// Chrome.tsx — shared shell chrome for the SA Carousel 2.0 wizard.
// THE FOUNDRY chrome per docs/THEME-FOUNDRY.md §7: one forged crossbar
// (wordmark + CAROUSEL 2.0 hairline chip, station rail with // connectors,
// right cluster: mint saved chip, provider chip, user chip, ESC HOME kbd).
// All navigation state flows through useWizard (src/app/wizard/store.ts).
// Handlers, gating (maxStation), and ESC behavior are unchanged from v1.

import React, { ReactNode, useEffect, useState } from "react";
import { useWizard, type Station } from "../store";
import { useUser } from "../../user-context";
import {
  getSurfaceProvider,
  setSurfaceProvider,
  getPreferredProvider,
  type LLMProviderName,
} from "../../shared-constants";


/* ================= station rail ================= */

const STOPS: { ord: number; num: string; label: string; station: Station }[] = [
  { ord: 1, num: "01", label: "CREATE", station: "create" },
  { ord: 2, num: "02", label: "CHOOSE", station: "choose" },
  { ord: 3, num: "03", label: "EDIT", station: "edit" },
  { ord: 4, num: "04", label: "PUBLISH", station: "publish" },
];

/** Rail ordinal for a station. GENERATING is the CREATE to CHOOSE transit
 *  overlay, not a rail stop: CREATE reads done, CHOOSE reads now. */
function stationOrd(st: Station): number {
  switch (st) {
    case "create": return 1;
    case "generating": return 2;
    case "choose": return 2;
    case "edit": return 3;
    case "publish": return 4;
    default: return 0; // home
  }
}

export function StationRail() {
  const station = useWizard((s) => s.station);
  const maxStation = useWizard((s) => s.maxStation);
  const go = useWizard((s) => s.go);
  if (station === "home") return null;
  const nowOrd = stationOrd(station);
  return (
    <nav className="stations" aria-label="Stations">
      {STOPS.map((stop, i) => {
        const done = stop.ord < nowOrd;
        const now = stop.ord === nowOrd;
        const clickable = stop.ord <= maxStation && !now;
        return (
          <React.Fragment key={stop.station}>
            {i > 0 && <span className={"st-link" + (stop.ord <= nowOrd ? " done" : "")} />}
            <span
              className={"st" + (done ? " done" : now ? " now" : "")}
              onClick={clickable ? () => go(stop.station) : undefined}
              role={clickable ? "button" : undefined}
              style={clickable ? { cursor: "pointer" } : undefined}
            >
              <i>{stop.num}</i>
              {stop.label}
            </span>
          </React.Fragment>
        );
      })}
    </nav>
  );
}

/* ================= provider rack ================= */

// Wizard-local restyle of the shared caption-AI picker. The source component
// (src/app/provider-chips.tsx) is frozen per THEME-FOUNDRY.md §9, and its
// inline styles set JetBrains Mono word labels + an amber-filled active chip —
// both foundry breaches (mono is numerals-only; amber is spent on actions,
// selection is the cobalt quench). Strings, tooltips, and the per-surface
// localStorage behavior are IDENTICAL to the shared component; only the
// skin differs (theme.css .provwrap/.prov-chip).
function ProviderRack({ surface, label }: { surface: string; label: string }) {
  const [override, setOverride] = useState<LLMProviderName | "auto">("auto");
  useEffect(() => {
    const v = getSurfaceProvider(surface);
    setOverride(v || "auto");
  }, [surface]);

  function pick(p: LLMProviderName | "auto") {
    setOverride(p);
    setSurfaceProvider(surface, p);
  }

  const globalDefault = typeof window === "undefined" ? "claude" : getPreferredProvider();

  return (
    <div className="provwrap">
      <span className="prov-label">{label}</span>
      {(["auto", "claude", "gemini", "grok"] as const).map((p) => {
        const on = override === p;
        const tip =
          p === "auto"
            ? "Use AI Training default — currently " + globalDefault.toUpperCase()
            : p.toUpperCase();
        return (
          <span
            key={p}
            className={"prov-chip" + (on ? " on" : "")}
            onClick={() => pick(p)}
            title={tip}
          >
            {p}
          </span>
        );
      })}
    </div>
  );
}

/* ================= user chip ================= */

// Display-only. In poast-app the seat comes from real sign-in and the main
// POAST settings; the wizard must never change it (Akash, 2026-07-15). The
// standalone sandbox this was ported from had a SWITCH SEAT dropdown here --
// deliberately removed, not lost.
function UserChip() {
  const { user } = useUser();
  return (
    <div
      className="chip"
      title={user?.role || ""}
      style={{ textTransform: "uppercase", userSelect: "none" }}
    >
      <span
        style={{
          width: 6, height: 6, borderRadius: "50%", display: "inline-block",
          background: "var(--cobalt)", boxShadow: "0 0 6px rgba(11,134,209,.6)",
        }}
      />
      {user?.name || "\u00b7"}
    </div>
  );
}

/* ================= topbar ================= */

export function Topbar() {
  const station = useWizard((s) => s.station);
  const resetToHome = useWizard((s) => s.resetToHome);
  const draftSavedAt = useWizard((s) => s.draftSavedAt);

  // ESC returns home from any station. Guards: skip when a modal has marked
  // <body data-modal-open>, when another handler already claimed the key, or
  // during GENERATING (that overlay owns ESC as "Cancel run" per design spec).
  useEffect(() => {
    if (station === "home" || station === "generating") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (document.body.hasAttribute("data-modal-open")) return;
      resetToHome();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [station, resetToHome]);

  const savedLabel =
    draftSavedAt == null
      ? null
      : new Date(draftSavedAt).toLocaleTimeString("en-GB", { hour12: false });

  return (
    <header className="pillnav">
      <div className="wm" onClick={resetToHome} style={{ cursor: "pointer" }} title="Back to home">
        <span className="c">semi</span>
        <span className="a">analysis</span>
      </div>
      <div className="appname">CAROUSEL 2.0</div>
      <StationRail />
      <div className="topright">
        {savedLabel && <span className="save">SAVED {savedLabel}</span>}
        <ProviderRack surface="carousel" label="AI" />
        <UserChip />
        {/* Register-1 word; only the ESC keycap stays mono (.kbd). The space
            text node keeps the frozen probe string "ESC HOME" intact. */}
        <button type="button" className="esc-home" onClick={resetToHome}>
          <span className="kbd">ESC</span> HOME
        </button>
      </div>
    </header>
  );
}

/* ================= plate frame ================= */

export function Plate({
  label,
  children,
  titleblock,
}: {
  label: ReactNode;
  children: ReactNode;
  titleblock?: ReactNode;
}) {
  return (
    <section className="plate">
      <i className="tick" />
      <div className="plate-label">{label}</div>
      {children}
      {titleblock}
    </section>
  );
}

export function TitleBlock({ cells, stamp }: { cells: { k: string; v: string }[]; stamp?: string }) {
  return (
    <div className="titleblock">
      {cells.map((c) => (
        <div key={c.k}>
          <span>{c.k}</span>
          {/* mono survives only as tabular numerals: purely numeric values
              (dates, 02 / 04 indices) opt in; word values stay Register 1 */}
          <b className={/^[\d\s./:·×-]+$/.test(c.v) ? "mono" : undefined}>{c.v}</b>
        </div>
      ))}
      <span className="stamp">{stamp || "SA·26"}</span>
    </div>
  );
}

/* ================= small primitives ================= */

export function SectionHeader({ label, accent }: { label: string; accent?: string }) {
  return (
    <div className="ph">
      {label}
      {accent ? <b>{accent}</b> : null}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <span className="kbd mono">{children}</span>;
}

export function Chip({ tone, children }: { tone?: "ok" | "warn"; children: ReactNode }) {
  return <span className={"chip" + (tone ? " " + tone : "")}>{children}</span>;
}
