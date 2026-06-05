"use client";

// HUB home for /intelligence-suite. Two stacked sections under the
// shell's sticky tab bar: an APP LAUNCHER grid (one large card per
// non-HUB app, accent-tinted) and the customizable HUB WIDGET DECK
// (see ./widget-deck). The shell owns the wordmark + eyebrow + tabs
// — this component only renders body content.

import Link from "next/link";
import { D, ft, gf } from "../shared-constants";
import { apps as APPS } from "./shell";
import { WidgetDeck } from "./widget-deck";

// Per-app accent overrides (the shell APPS list doesn't carry colors).
const ACCENT: Record<string, string> = {
  trends: D.amber,
  ideas: D.violet,
  signals: D.cyan,
  watchlist: D.teal,
  competitive: D.coral,
  brief: D.amber,
  notes: D.blue,
};

const SUBTITLE: Record<string, string> = {
  trends: "Heating, cooling, and emerging stories.",
  ideas: "Spatial canvas for new angles.",
  signals: "Live RSS triage by sector.",
  watchlist: "Pinned tickers and keyword alerts.",
  competitive: "Track rivals and benchmarks.",
  brief: "Daily AI-generated digest.",
  notes: "Pinned research capture.",
};

export function HubLanding() {
  // Drop HUB itself from the launcher grid — we're already on HUB.
  const launcherApps = APPS.filter(function (a) { return a.id !== "hub"; });

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "48px 32px 64px" }}>
      {/* ── Title block ────────────────────────────────────────── */}
      <div style={{ marginBottom: 36 }}>
        <h1 style={{
          margin: 0,
          fontFamily: gf, fontSize: 56, fontWeight: 900,
          color: D.tx, letterSpacing: -1.4, lineHeight: 1,
        }}>HUB</h1>
        <p style={{
          margin: "10px 0 0",
          fontFamily: ft, fontSize: 16, color: D.txm,
          letterSpacing: -0.1,
        }}>Command center for SemiAnalysis intelligence.</p>
      </div>

      {/* ── App launcher grid ──────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        gap: 14,
      }}>
        {launcherApps.map(function (app) {
          const accent = ACCENT[app.id] || D.amber;
          const sub = SUBTITLE[app.id] || "";
          const Icon = app.Icon;
          return (
            <Link
              key={app.id}
              href={app.path}
              style={{
                display: "block",
                background: D.card,
                border: "1px solid " + D.border,
                borderRadius: 14,
                padding: "28px 24px",
                textDecoration: "none",
                color: D.tx,
                transition: "transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease, background 160ms ease",
              }}
              onMouseEnter={function (e: React.MouseEvent<HTMLAnchorElement>) {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.borderColor = accent + "66";
                e.currentTarget.style.boxShadow = "0 14px 38px rgba(0,0,0,0.5), 0 0 28px " + accent + "22";
                e.currentTarget.style.background = "linear-gradient(180deg, " + D.card + " 0%, " + D.hover + " 100%)";
              }}
              onMouseLeave={function (e: React.MouseEvent<HTMLAnchorElement>) {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.borderColor = D.border;
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.background = D.card;
              }}
            >
              <Icon size={40} strokeWidth={1.6} color={accent} />
              <div style={{
                fontFamily: gf, fontSize: 18, fontWeight: 700,
                color: D.tx, letterSpacing: -0.2,
                marginTop: 16,
              }}>{app.label}</div>
              <div style={{
                fontFamily: ft, fontSize: 13, color: D.txm,
                marginTop: 4,
              }}>{sub}</div>
            </Link>
          );
        })}
      </div>

      {/* ── Widget deck ────────────────────────────────────────── */}
      <WidgetDeck />
    </div>
  );
}

// Default export keeps backward compatibility with anything still
// importing the file's default (e.g. older page.tsx variants).
export default HubLanding;
