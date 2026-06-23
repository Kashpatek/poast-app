"use client";
// Running Now — auto-appears at the top of the widget rail whenever something is
// live or about to start. Shows a LIVE elapsed/remaining timer for what's
// running, and a 10-minute PREGAME countdown for each thing starting next —
// back-to-back events stack their pregames below. Ticks every second.
import React, { useEffect, useMemo, useState } from "react";
import { Radio, Hourglass, AlertTriangle } from "lucide-react";
import { D, ft, gf, mn } from "../../shared-constants";
import { scheduleKindOf, TYPE_COLOR, type MarketingEvent } from "../marketing-constants";
import type { MarketingState } from "../use-marketing";

const PREGAME_MS = 10 * 60 * 1000;
const DEFAULT_DUR = 30 * 60 * 1000;
const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");
function clock(ms: number) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  return (h > 0 ? h + ":" : "") + pad((s % 3600) / 60) + ":" + pad(s % 60);
}
function accentOf(e: MarketingEvent) {
  const k = typeof e.payload?.scheduleKind === "string" ? (e.payload.scheduleKind as string) : null;
  return (k && k !== "task" ? scheduleKindOf(k).color : null) || TYPE_COLOR[e.type];
}

export default function RunningNow({ m }: { m: MarketingState }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  const { live, pregame } = useMemo(() => {
    const live: { e: MarketingEvent; start: number; end: number }[] = [];
    const pregame: { e: MarketingEvent; start: number }[] = [];
    for (const e of m.events) {
      if (!e.start) continue;
      const start = new Date(e.start).getTime();
      const end = e.end ? new Date(e.end).getTime() : start + DEFAULT_DUR;
      if (e.status === "done") continue;
      if (now >= start && now < end) live.push({ e, start, end });
      else if (start > now && start - now <= PREGAME_MS) pregame.push({ e, start });
    }
    live.sort((a, b) => a.start - b.start);
    pregame.sort((a, b) => a.start - b.start);
    return { live, pregame };
  }, [m.events, now]);

  if (!live.length && !pregame.length) return null;

  return (
    <div style={{ marginBottom: 12, border: `1px solid ${D.coral}44`, borderRadius: 12, overflow: "hidden", background: `linear-gradient(180deg, ${D.coral}10, ${D.cardGrad})`, boxShadow: D.glow }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 11px", borderBottom: `1px solid ${D.border}`, fontFamily: mn, fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase", color: D.coral }}>
        <Radio size={12} /> Running now
        <span style={{ flex: 1 }} />
        <span style={{ width: 7, height: 7, borderRadius: 999, background: D.coral, boxShadow: `0 0 8px ${D.coral}`, animation: "pulse 1.4s ease-in-out infinite" }} />
      </div>
      <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        {live.map(({ e, start, end }) => {
          const accent = accentOf(e);
          const dur = end - start;
          const elapsed = now - start;
          const remaining = end - now;
          const overran = remaining < 0;
          const pct = Math.min(100, Math.max(0, (elapsed / dur) * 100));
          return (
            <div key={e.id} style={{ border: `1px solid ${accent}55`, borderRadius: 10, padding: "10px 11px", background: D.card }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontFamily: mn, fontSize: 8.5, letterSpacing: 0.5, color: overran ? D.coral : D.teal, border: `1px solid ${(overran ? D.coral : D.teal)}66`, borderRadius: 4, padding: "1px 5px" }}>
                  {overran ? "OVERRAN" : "LIVE"}
                </span>
                <span style={{ fontFamily: ft, fontSize: 13, fontWeight: 600, color: D.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 7 }}>
                <span style={{ fontFamily: gf, fontSize: 24, fontWeight: 700, color: overran ? D.coral : D.tx, letterSpacing: 0.5 }}>{clock(elapsed)}</span>
                <span style={{ fontFamily: mn, fontSize: 10, color: overran ? D.coral : D.txm }}>
                  {overran ? `+${clock(-remaining)} over` : `${clock(remaining)} left`}
                </span>
                {overran && <AlertTriangle size={12} color={D.coral} />}
              </div>
              <div style={{ marginTop: 7, height: 5, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: overran ? D.coral : `linear-gradient(90deg, ${accent}, ${accent}aa)`, transition: "width 1s linear" }} />
              </div>
            </div>
          );
        })}

        {pregame.map(({ e, start }) => {
          const accent = accentOf(e);
          const tminus = start - now;
          return (
            <div key={e.id} style={{ border: `1px solid ${D.amber}44`, borderRadius: 10, padding: "8px 11px", background: D.card, display: "flex", alignItems: "center", gap: 9 }}>
              <Hourglass size={14} color={D.amber} style={{ flex: "none" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: mn, fontSize: 8.5, letterSpacing: 0.5, color: D.amber }}>STARTING SOON</div>
                <div style={{ fontFamily: ft, fontSize: 12.5, color: D.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</div>
              </div>
              <div style={{ textAlign: "right", flex: "none" }}>
                <div style={{ fontFamily: gf, fontSize: 16, fontWeight: 700, color: D.amber }}>T-{clock(tminus)}</div>
                <div style={{ fontFamily: mn, fontSize: 8.5, color: D.txd }}>{new Date(start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</div>
              </div>
              <span style={{ width: 3, alignSelf: "stretch", borderRadius: 2, background: accent }} />
            </div>
          );
        })}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.35}}`}</style>
    </div>
  );
}
