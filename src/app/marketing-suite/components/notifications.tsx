"use client";
// MarketingSUITE · top-bar notifications. A bell IconButton with an unread
// badge; clicking toggles a fixed-position dropdown. The feed is built live
// from m.events (upcoming Buffer posts) with escalating time-to-live bands —
// LIVE (<=0) → :10 alert (<=10m) → :30 alert (<=30m) — plus a couple of
// cross-app demo items (a Slack handoff, an ad-flight warning). A 1s tick
// keeps the countdowns moving. Closes on outside click.
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell, Clock, CircleCheck, TriangleAlert, MessageSquare,
} from "lucide-react";
import { D, ft, mn } from "../../shared-constants";
import { STATUS_COLOR, channelOf, type MarketingEvent } from "../marketing-constants";
import type { MarketingState } from "../use-marketing";

// mm:ss countdown, floored at zero.
function mmss(ms: number): string {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return String(m).padStart(2, "0") + ":" + String(r).padStart(2, "0");
}

type Band = "live" | "b10" | "b30" | "soon";

interface Feed {
  id: string;
  kind: "buffer" | "slack" | "warn";
  band: Band;
  icon: React.ReactNode;
  accent: string;
  title: string;
  sub: string;          // static portion of the sub-label
  liveSub?: string;     // dynamic portion (recomputed each tick)
  unread: boolean;
}

const WIN_30 = 30 * 60 * 1000;
const WIN_10 = 10 * 60 * 1000;

export default function NotifBell({ m }: { m: MarketingState }) {
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // 1s heartbeat so every countdown band re-renders live.
  useEffect(() => {
    const t = setInterval(() => setTick((v) => (v + 1) % 100000), 1000);
    return () => clearInterval(t);
  }, []);

  // Close on outside click (ignore clicks inside the bell+dropdown wrapper).
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // ── Build the feed from live data. tick is in the dep list so countdowns
  //    and band classification refresh every second. ──
  const feed = useMemo<Feed[]>(() => {
    void tick;
    const now = Date.now();
    const out: Feed[] = [];

    // Upcoming Buffer posts (source==='buffer', start in the future), soonest first.
    const buffers = m.events
      .filter((e: MarketingEvent) => e.source === "buffer")
      .map((e) => ({ e, ms: new Date(e.start).getTime() - now }))
      .filter((x) => x.ms <= WIN_30)            // only ones close enough to matter
      .sort((a, b) => a.ms - b.ms)
      .slice(0, 4);

    for (const { e, ms } of buffers) {
      const ch = channelOf(e.channel);
      let band: Band;
      let liveSub: string;
      let icon: React.ReactNode;
      let accent: string;
      if (ms <= 0) {
        band = "live";
        accent = D.teal;
        liveSub = "LIVE now · just posted";
        icon = <CircleCheck size={15} color={D.teal} />;
      } else if (ms <= WIN_10) {
        band = "b10";
        accent = D.amber;
        liveSub = "in " + mmss(ms) + " · :10 alert";
        icon = <Clock size={15} color={D.amber} />;
      } else {
        band = "b30";
        accent = STATUS_COLOR[e.status] || D.cyan;
        liveSub = "in " + mmss(ms) + " · :30 alert";
        icon = <Clock size={15} color={D.cyan} />;
      }
      out.push({
        id: e.id,
        kind: "buffer",
        band,
        icon,
        accent,
        title: e.title,
        sub: ch.n + " · Buffer",
        liveSub,
        unread: band !== "b30",
      });
    }

    // ── Cross-app demo items: a Slack handoff + an ad-flight warning. ──
    out.push({
      id: "slack-vansh",
      kind: "slack",
      band: "soon",
      icon: <MessageSquare size={15} color={D.blue} />,
      accent: D.blue,
      title: "Vansh: EP18 thumbnail ready for review",
      sub: "4m ago · Slack",
      unread: true,
    });
    out.push({
      id: "ad-meta-flight",
      kind: "warn",
      band: "soon",
      icon: <TriangleAlert size={15} color={D.coral} />,
      accent: D.coral,
      title: "Meta flight 88% spent · orphan in ~4d",
      sub: "now · Ads",
      unread: true,
    });

    return out;
  }, [m.events, tick]);

  const unread = feed.filter((f) => f.unread).length;

  return (
    <div ref={wrapRef} style={{ display: "inline-flex", position: "relative" }}>
      {/* ── Bell ── */}
      <button
        type="button"
        title="Notifications"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
        style={{
          ...iconBtn,
          color: open ? D.amber : D.txm,
          borderColor: open ? D.amber + "55" : D.border,
          background: open ? D.amber + "12" : "transparent",
        }}
        onMouseEnter={(e) => { if (!open) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.background = "transparent"; }}
      >
        <Bell size={17} />
        {unread > 0 && (
          <span style={badge}>{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {/* ── Dropdown (fixed, pinned under the top bar at the right) ── */}
      {open && (
        <div style={dropdown}>
          <div style={header}>
            <span style={{ fontFamily: mn, fontSize: 11.5, letterSpacing: 0.5, color: D.tx, textTransform: "uppercase" }}>
              Notifications
            </span>
            <span style={{ fontFamily: mn, fontSize: 10, color: D.amber, border: `1px solid ${D.amber}44`, borderRadius: 999, padding: "2px 8px" }}>
              {unread} new
            </span>
          </div>

          <div style={{ maxHeight: 420, overflow: "auto" }}>
            {feed.length === 0 && (
              <div style={{ padding: "22px 16px", fontFamily: mn, fontSize: 11.5, color: D.txd, textAlign: "center" }}>
                Nothing scheduled in the next 30 minutes.
              </div>
            )}
            {feed.map((f) => (
              <div
                key={f.id}
                style={{
                  display: "flex", gap: 11, alignItems: "flex-start",
                  padding: "11px 14px", borderTop: `1px solid ${D.border}`,
                  background: f.band === "live"
                    ? D.teal + "0E"
                    : f.band === "b10"
                      ? D.amber + "0A"
                      : f.kind === "warn"
                        ? D.coral + "08"
                        : "transparent",
                  cursor: "default", transition: "background 0.15s",
                  borderLeft: `2px solid ${f.unread ? f.accent : "transparent"}`,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.025)"; }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background =
                    f.band === "live" ? D.teal + "0E"
                      : f.band === "b10" ? D.amber + "0A"
                        : f.kind === "warn" ? D.coral + "08" : "transparent";
                }}
              >
                <span style={{ marginTop: 1, flex: "none", display: "inline-flex" }}>{f.icon}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontFamily: ft, fontSize: 12.5, lineHeight: 1.35, color: D.tx,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {f.title}
                  </div>
                  <div style={{
                    fontFamily: mn, fontSize: 10, marginTop: 3,
                    color: f.band === "live" ? D.teal : f.band === "b10" ? D.amber : D.txm,
                  }}>
                    {f.liveSub ? f.liveSub + " · " + f.sub : f.sub}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Style objects (module scope — house pattern) ───
const iconBtn: React.CSSProperties = {
  position: "relative",
  width: 34, height: 34, borderRadius: 9,
  border: `1px solid ${D.border}`, background: "transparent", color: D.txm,
  cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
  transition: "all 0.16s",
};

const badge: React.CSSProperties = {
  position: "absolute", top: -5, right: -5,
  minWidth: 16, height: 16, padding: "0 4px", borderRadius: 999,
  background: D.coral, color: "#0A0A0E",
  fontFamily: mn, fontSize: 9.5, fontWeight: 700, lineHeight: "16px",
  textAlign: "center", boxShadow: "0 0 0 2px rgba(6,6,12,0.9)",
};

const dropdown: React.CSSProperties = {
  position: "fixed", top: 52, right: 14, zIndex: 200,
  width: 332, maxWidth: "calc(100vw - 28px)",
  background: D.cardGrad, border: `1px solid ${D.border}`, borderRadius: 14,
  boxShadow: "0 18px 50px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.4)",
  overflow: "hidden", fontFamily: ft,
};

const header: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "12px 14px", borderBottom: `1px solid ${D.border}`,
  background: D.surfGrad,
};
