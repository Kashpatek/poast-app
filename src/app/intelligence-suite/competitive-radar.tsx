"use client";

// Competitive Radar — IntelligenceSUITE Phase 7F panel.
//
// Pulls competitor outlet RSS via /api/competitive-radar and renders
// each item as: title + source pill + time + one-line "SA angle"
// suggestion. Two actions per item: "Generate SA take" (push to the
// output bus + nav to brief-builder) and "Open" (link out).
//
// Source pills at the top toggle inclusion — flipping any pill kicks
// off a refetch with the active set.

import React, { useEffect, useMemo, useState } from "react";
import { ExternalLink, Sparkles, RefreshCw } from "lucide-react";
import { D, ft, mn, getSurfaceProvider, getPreferredProvider, type LLMProviderName } from "../shared-constants";
import { useStore } from "../lib/store";
import { showToast } from "../toast-context";

interface RadarItem {
  source: string;
  title: string;
  link: string;
  time: string;
  saAngle: string;
}

const ALL_SOURCES = [
  "Stratechery",
  "The Information",
  "Asianometry",
  "Doomberg",
  "Lex Fridman",
  "Acquired",
] as const;

// The Information has no public RSS so we never query for it server-side
// — but it's surfaced as a (disabled-feel) pill so the user knows where
// the gap is.
const NO_FEED_SOURCES = new Set(["The Information"]);

function pickProvider(): LLMProviderName {
  return getSurfaceProvider("competitive-radar") || getPreferredProvider();
}

function relTime(iso?: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!t || isNaN(t)) return "";
  const diff = Date.now() - t;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return Math.floor(diff / 60_000) + "m ago";
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + "h ago";
  return Math.floor(diff / 86_400_000) + "d ago";
}

export default function CompetitiveRadarPanel() {
  const [active, setActive] = useState<Set<string>>(
    () => new Set(ALL_SOURCES.filter((s) => !NO_FEED_SOURCES.has(s))),
  );
  const [items, setItems] = useState<RadarItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pushOutput = useStore((s) => s.pushOutput);
  const setPendingRoute = useStore((s) => s.setPendingRoute);

  const activeArr = useMemo(() => Array.from(active), [active]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const provider = pickProvider();
        const res = await fetch("/api/competitive-radar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider,
            sources: activeArr.filter((s) => !NO_FEED_SOURCES.has(s)),
          }),
        });
        const data = (await res.json()) as { items?: RadarItem[]; error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setErr(data.error || `Request failed (${res.status})`);
          setItems([]);
        } else {
          setItems(data.items || []);
        }
      } catch (e) {
        if (cancelled) return;
        setErr(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [activeArr]);

  function togglePill(src: string) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(src)) next.delete(src);
      else next.add(src);
      return next;
    });
  }

  function generateSATake(item: RadarItem) {
    const payload =
      item.title +
      "\n\nSource: " +
      item.source +
      "\nLink: " +
      item.link +
      (item.saAngle ? "\n\nSA angle (suggested): " + item.saAngle : "");
    pushOutput({
      sourceTool: "competitive-radar",
      kind: "brief",
      payload,
      preview: item.title.slice(0, 140),
    });
    setPendingRoute({
      destinationTool: "brief-builder",
      sourceTool: "competitive-radar",
      payload,
      kind: "brief",
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("poast-nav", { detail: "brief-builder" }));
    }
    showToast("Sent to Brief Builder.", "success");
  }

  function manualRefresh() {
    setActive((prev) => new Set(prev));
  }

  // Filter items by active source set so toggles feel instant even
  // while a background fetch is in flight (covers the brief window
  // between pill toggle and the refetched batch arriving).
  const visible = items.filter((it) => active.has(it.source));

  return (
    <div style={{ fontFamily: ft, color: D.tx, display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Source pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        {ALL_SOURCES.map((s) => {
          const on = active.has(s);
          const disabled = NO_FEED_SOURCES.has(s);
          return (
            <button
              key={s}
              onClick={() => togglePill(s)}
              title={disabled ? "No public RSS — pill is a stub" : "Toggle " + s}
              style={{
                fontFamily: mn,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.5,
                textTransform: "uppercase",
                padding: "5px 10px",
                borderRadius: 999,
                border: "1px solid " + (on ? D.amber + "70" : D.border),
                background: on ? D.amber + "18" : "transparent",
                color: on ? D.amber : disabled ? D.txd : D.txm,
                cursor: "pointer",
                opacity: disabled ? 0.55 : 1,
                transition: "all 0.15s ease",
              }}
            >
              {s}
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <button
          onClick={manualRefresh}
          disabled={loading}
          title="Refresh"
          style={{
            fontFamily: mn,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.5,
            textTransform: "uppercase",
            padding: "5px 10px",
            borderRadius: 6,
            border: "1px solid " + D.border,
            background: "transparent",
            color: loading ? D.txd : D.txm,
            cursor: loading ? "wait" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <RefreshCw size={10} strokeWidth={2.4} /> {loading ? "Loading" : "Refresh"}
        </button>
      </div>

      {/* Feed */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {loading && visible.length === 0 && (
          <div
            style={{
              padding: 16,
              border: "1px dashed " + D.border,
              borderRadius: 8,
              color: D.txd,
              fontFamily: mn,
              fontSize: 11,
              textAlign: "center",
            }}
          >
            Scanning competitor feeds…
          </div>
        )}

        {!loading && err && (
          <div
            style={{
              padding: 12,
              background: D.crimson + "12",
              border: "1px solid " + D.crimson + "44",
              borderRadius: 8,
              fontFamily: mn,
              fontSize: 11,
              color: D.crimson,
            }}
          >
            {err}
          </div>
        )}

        {!loading && !err && visible.length === 0 && (
          <div
            style={{
              padding: 16,
              border: "1px dashed " + D.border,
              borderRadius: 8,
              color: D.txd,
              fontFamily: mn,
              fontSize: 11,
              textAlign: "center",
            }}
          >
            No competitor items in the last 24h for the active sources.
          </div>
        )}

        {visible.map((it, i) => (
          <RadarRow key={it.link + ":" + i} item={it} onGenerate={generateSATake} />
        ))}
      </div>
    </div>
  );
}

function RadarRow({ item, onGenerate }: { item: RadarItem; onGenerate: (it: RadarItem) => void }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: 12,
        background: hov ? D.hover : D.surface,
        border: "1px solid " + (hov ? D.amber + "30" : D.border),
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        transition: "all 0.15s ease",
      }}
    >
      <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 600, color: D.tx, lineHeight: 1.35 }}>
        {item.title}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span
          style={{
            fontFamily: mn,
            fontSize: 10,
            color: D.amber,
            padding: "2px 7px",
            borderRadius: 4,
            background: D.amber + "12",
            border: "1px solid " + D.amber + "33",
            letterSpacing: 0.4,
            textTransform: "uppercase",
          }}
        >
          {item.source}
        </span>
        <span style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>{relTime(item.time)}</span>
      </div>

      <div
        style={{
          fontFamily: ft,
          fontSize: 12,
          color: D.amber,
          fontStyle: "italic",
          lineHeight: 1.4,
          display: "flex",
          gap: 6,
        }}
      >
        <span style={{ fontFamily: mn, fontStyle: "normal", color: D.txm, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, whiteSpace: "nowrap", paddingTop: 1 }}>
          SA angle:
        </span>
        <span style={{ flex: 1 }}>{item.saAngle}</span>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button
          onClick={() => onGenerate(item)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontFamily: mn,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.5,
            textTransform: "uppercase",
            color: D.amber,
            background: D.amber + "12",
            border: "1px solid " + D.amber + "44",
            borderRadius: 6,
            padding: "5px 10px",
            cursor: "pointer",
          }}
        >
          <Sparkles size={10} strokeWidth={2.4} /> Generate SA take
        </button>
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontFamily: mn,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.5,
            textTransform: "uppercase",
            color: D.txm,
            background: "transparent",
            border: "1px solid " + D.border,
            borderRadius: 6,
            padding: "5px 10px",
            textDecoration: "none",
          }}
        >
          <ExternalLink size={10} strokeWidth={2.4} /> Open
        </a>
      </div>
    </div>
  );
}
