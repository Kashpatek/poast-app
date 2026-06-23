"use client";
// Ad Kiosk · Live stats dashboard — inline SVG/CSS charts (no chart lib, per
// house rules) giving an at-a-glance read of the live ad portfolio: spend share
// by platform, efficiency (CTR + ROAS) by platform, and a cumulative spend
// trend from each ad's metricsHistory. Pure presentational over the ad events.
import React, { useMemo } from "react";
import { TrendingUp, PieChart, Gauge, DollarSign } from "lucide-react";
import { D, ft, gf, mn } from "../../shared-constants";
import { adPlatform, adPayload, type MarketingEvent } from "../marketing-constants";

function fmtMoney(n?: number) { if (!n) return "$0"; return n >= 1000 ? "$" + (n / 1000).toFixed(1) + "k" : "$" + Math.round(n); }
function fmtInt(n?: number) { if (!n) return "0"; return n >= 1_000_000 ? (n / 1e6).toFixed(1) + "M" : n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n); }
function fmtPct(n?: number) { return n == null ? "—" : n.toFixed(2) + "%"; }

interface PlatAgg {
  key: string; name: string; short: string; color: string;
  spend: number; impressions: number; clicks: number; conversions: number; ctr: number; roas: number;
}

export function LiveStatsDashboard({ ads }: { ads: MarketingEvent[] }) {
  const per = useMemo<PlatAgg[]>(() => {
    const map = new Map<string, PlatAgg>();
    for (const a of ads) {
      const p = adPayload(a);
      const key = p.platform || a.channel || "meta";
      const plat = adPlatform(key);
      const mt = p.metrics || {};
      if (!map.has(key)) map.set(key, { key, name: plat.n, short: plat.s, color: plat.c, spend: 0, impressions: 0, clicks: 0, conversions: 0, ctr: 0, roas: 0 });
      const agg = map.get(key)!;
      agg.spend += mt.spend || 0; agg.impressions += mt.impressions || 0;
      agg.clicks += mt.clicks || 0; agg.conversions += mt.conversions || 0;
      // spend-weighted roas accumulator (finalized below)
      agg.roas += (mt.spend || 0) * (mt.roas || 0);
    }
    const out = [...map.values()].map((a) => ({
      ...a,
      ctr: a.impressions ? (a.clicks / a.impressions) * 100 : 0,
      roas: a.spend ? a.roas / a.spend : 0,
    }));
    return out.sort((x, y) => y.spend - x.spend);
  }, [ads]);

  // Cumulative spend trend from merged metricsHistory across all ads.
  const trend = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const a of ads) {
      const hist = adPayload(a).metricsHistory || [];
      for (const h of hist) {
        if (!h.date) continue;
        byDate.set(h.date, (byDate.get(h.date) || 0) + (h.spend || 0));
      }
    }
    const dates = [...byDate.keys()].sort();
    let cum = 0;
    return dates.map((dt) => { cum += byDate.get(dt) || 0; return { date: dt, value: cum }; });
  }, [ads]);

  if (!per.length) return null;
  const maxSpend = Math.max(...per.map((p) => p.spend), 1);
  const maxCtr = Math.max(...per.map((p) => p.ctr), 0.5);
  const maxRoas = Math.max(...per.map((p) => p.roas), 1);
  const totalSpend = per.reduce((n, p) => n + p.spend, 0);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
      {/* Spend share by platform */}
      <Panel title="Spend by platform" icon={<PieChart size={13} color={D.amber} />} accent={D.amber}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {per.map((p) => (
            <BarRow key={p.key} color={p.color}
              label={p.name} short={p.short}
              value={fmtMoney(p.spend)} sub={totalSpend ? Math.round((p.spend / totalSpend) * 100) + "%" : "—"}
              frac={p.spend / maxSpend} />
          ))}
        </div>
      </Panel>

      {/* Efficiency: ROAS + CTR per platform */}
      <Panel title="Efficiency by platform" icon={<Gauge size={13} color={D.teal} />} accent={D.teal}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {per.map((p) => (
            <div key={p.key}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: p.color, flex: "none" }} />
                <span style={{ fontFamily: mn, fontSize: 10.5, color: D.tx }}>{p.short}</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontFamily: mn, fontSize: 10, color: p.roas >= 1 ? D.teal : D.coral }}>{p.roas ? p.roas.toFixed(1) + "× ROAS" : "—"}</span>
                <span style={{ fontFamily: mn, fontSize: 10, color: D.txm, marginLeft: 8 }}>{fmtPct(p.ctr || undefined)} CTR</span>
              </div>
              <DualBar roasFrac={Math.min(1, p.roas / maxRoas)} ctrFrac={Math.min(1, p.ctr / maxCtr)} color={p.color} />
            </div>
          ))}
          <div style={{ display: "flex", gap: 14, marginTop: 2, fontFamily: mn, fontSize: 8.5, color: D.txd }}>
            <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: D.teal, marginRight: 4, verticalAlign: -1 }} />ROAS</span>
            <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: D.txm, marginRight: 4, verticalAlign: -1 }} />CTR (relative)</span>
          </div>
        </div>
      </Panel>

      {/* Cumulative spend trend */}
      <Panel title="Cumulative spend" icon={<TrendingUp size={13} color={D.cyan} />} accent={D.cyan} span2>
        {trend.length >= 2
          ? <TrendArea points={trend} />
          : <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "18px 4px", color: D.txd, fontFamily: mn, fontSize: 11 }}>
              <DollarSign size={15} color={D.txd} />
              Trend builds as you log daily metrics — update an ad’s numbers to start the line.
            </div>}
      </Panel>
    </div>
  );
}

function Panel({ title, icon, accent, span2, children }: { title: string; icon: React.ReactNode; accent: string; span2?: boolean; children: React.ReactNode }) {
  return (
    <div style={{
      gridColumn: span2 ? "1 / -1" : undefined,
      border: `1px solid ${D.border}`, borderRadius: 13, background: D.cardGrad, padding: "13px 15px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
        {icon}
        <span style={{ fontFamily: mn, fontSize: 9.5, letterSpacing: 0.6, textTransform: "uppercase", color: accent }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function BarRow({ color, label, short, value, sub, frac }: { color: string; label: string; short: string; value: string; sub: string; frac: number }) {
  void label;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: color, flex: "none", boxShadow: `0 0 6px ${color}77` }} />
        <span style={{ fontFamily: mn, fontSize: 10.5, color: D.tx }}>{short}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: gf, fontSize: 13, color: D.tx, fontWeight: 700 }}>{value}</span>
        <span style={{ fontFamily: mn, fontSize: 9.5, color: D.txd, marginLeft: 7, width: 30, textAlign: "right" }}>{sub}</span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
        <div style={{ width: `${Math.max(2, frac * 100)}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${color}, ${color}aa)`, boxShadow: `0 0 10px ${color}66` }} />
      </div>
    </div>
  );
}

function DualBar({ roasFrac, ctrFrac, color }: { roasFrac: number; ctrFrac: number; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ height: 7, borderRadius: 999, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
        <div style={{ width: `${Math.max(2, roasFrac * 100)}%`, height: "100%", background: `linear-gradient(90deg, ${D.teal}, ${D.teal}aa)` }} />
      </div>
      <div style={{ height: 7, borderRadius: 999, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
        <div style={{ width: `${Math.max(2, ctrFrac * 100)}%`, height: "100%", background: `linear-gradient(90deg, ${color}88, ${color}55)` }} />
      </div>
    </div>
  );
}

function TrendArea({ points }: { points: { date: string; value: number }[] }) {
  const W = 600, H = 120, pad = 6;
  const max = Math.max(...points.map((p) => p.value), 1);
  const stepX = (W - pad * 2) / Math.max(1, points.length - 1);
  const xy = points.map((p, i) => [pad + i * stepX, H - pad - (p.value / max) * (H - pad * 2)] as const);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${xy[xy.length - 1][0].toFixed(1)},${H - pad} L${xy[0][0].toFixed(1)},${H - pad} Z`;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 120, display: "block" }}>
        <defs>
          <linearGradient id="spendgrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={D.cyan} stopOpacity="0.35" />
            <stop offset="100%" stopColor={D.cyan} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#spendgrad)" />
        <path d={line} fill="none" stroke={D.cyan} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        {xy.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2.5} fill={D.cyan} />)}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontFamily: mn, fontSize: 8.5, color: D.txd }}>
        <span>{points[0].date}</span>
        <span style={{ fontFamily: ft, fontSize: 11, color: D.tx, fontWeight: 600 }}>{fmtMoney(points[points.length - 1].value)} total</span>
        <span>{points[points.length - 1].date}</span>
      </div>
    </div>
  );
}
