"use client";
// MarketingSUITE · Brief — the calm, editorial read of the same spine the
// launchboard renders. This is the digest: a hero with a one-line state of
// the day + a day-load ring, an hourly morning→evening arc with a live now
// marker, editorial section cards (launching, in production, live ads with
// real adPayload metrics, priorities/at-risk, wins, what-to-watch), a live
// lead-story pull (POST /api/morning-brief, demo fallback), and a
// "copy as standup" button that synthesizes a plain-text summary from `m`.
import React, { useEffect, useMemo, useState } from "react";
import {
  Copy, RefreshCw, Rocket, Clapperboard, Radio, CheckCircle2,
  TriangleAlert, Sparkles, ExternalLink, Clock, Sunrise, Sun, CloudSun, Moon,
  Megaphone, Eye, Flame, ArrowUpRight, ArrowRight, Target, DollarSign,
  MousePointerClick, Gauge, CircleCheck, AlarmClock, Activity,
} from "lucide-react";
import { D, ft, gf, mn, copyText } from "../../shared-constants";
import {
  STATUS_LABEL, TYPE_COLOR, channelOf, adPlatform, adPayload,
  type MarketingEvent, type EventType,
} from "../marketing-constants";
import type { ViewProps } from "../use-marketing";
import PageHeader from "../components/page-header";

// ─── Lead-story payload (subset of /api/morning-brief) ───
interface LeadStory {
  headline: string;
  body: string;
  whyItMatters: string;
  sourceUrl?: string;
}
interface BriefResponse {
  leadStory?: LeadStory | null;
  topSignals?: string[];
  moveFastAlert?: string | null;
}

// Demo fallback so the editorial layout always has a lead story.
const DEMO_LEAD: LeadStory = {
  headline: "HBM4 qualification slips push memory pricing into 2027 capex math",
  body: "The memory supply story tightened again this week as qualification timelines for HBM4 stretched against accelerator roadmaps. Pricing leverage is consolidating with the two suppliers who can hit yield at volume, and the hyperscalers are already re-cutting their 2027 buildout assumptions around it.\n\nThe read for the channel: the audience that cares about this is the same audience that subscribed off the last episode arc. The window to ride the narrative is this week, not next.",
  whyItMatters: "Memory is the gating input for the entire AI training buildout. Whoever explains the supply shape first owns the conversation for the next quarter.",
};

const DEMO_SIGNALS = [
  "Two HBM suppliers control the qualified volume curve",
  "Hyperscaler 2027 capex assumptions being re-cut around memory",
  "Advanced packaging remains the second gate after memory",
];

const PROD_TYPES: EventType[] = ["production", "clip", "strategy"];

// Hourly day-arc window (the editorial timeline runs 6a → 10p).
const ARC_START = 6;
const ARC_END = 22;

interface ArcBand { label: string; Icon: typeof Sun; from: number; accent: string; }
const ARC_BANDS: ArcBand[] = [
  { label: "Morning",   Icon: Sunrise,  from: 6,  accent: D.amber },
  { label: "Midday",    Icon: Sun,      from: 11, accent: D.cyan },
  { label: "Afternoon", Icon: CloudSun, from: 14, accent: D.teal },
  { label: "Evening",   Icon: Moon,     from: 18, accent: D.violet },
];

function isToday(iso: string): boolean {
  const d = new Date(iso); const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}
function hourOf(iso: string): number {
  const d = new Date(iso);
  return d.getHours() + d.getMinutes() / 60;
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase().replace(" ", "");
}
function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString([], { weekday: "short" });
}
function relDay(iso: string): string {
  const d = withinDays(iso, 0, 0) ? "today" : withinDays(iso, 1, 1) ? "tomorrow" : fmtDay(iso);
  return d;
}

export default function BriefView({ m, onOpenView }: ViewProps) {
  const [lead, setLead] = useState<LeadStory>(DEMO_LEAD);
  const [signals, setSignals] = useState<string[]>(DEMO_SIGNALS);
  const [moveFast, setMoveFast] = useState<string | null>(null);
  const [leadState, setLeadState] = useState<"demo" | "live" | "loading">("loading");
  const [copied, setCopied] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [now, setNow] = useState(() => new Date());

  // Keep the now-marker honest without a heavy ticker.
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  // ── Derive the day from the spine ──
  const today = useMemo(() => m.events.filter((e) => isToday(e.start)), [m.events]);
  const todaySorted = useMemo(
    () => [...today].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()),
    [today],
  );

  // Day load: weight scheduled/live > draft/blocked > idea, capped to a ceiling.
  const dayLoad = useMemo(() => {
    let w = 0;
    for (const e of today) {
      w += e.status === "live" || e.status === "scheduled" ? 2.2
        : e.status === "blocked" ? 1.8
        : e.status === "draft" ? 1.4
        : 1;
    }
    return Math.min(100, Math.round((w / 11) * 100));
  }, [today]);

  // Posts going out today (buffer/launch).
  const posts = useMemo(
    () => todaySorted.filter((e) => e.type === "buffer" || e.type === "launch"),
    [todaySorted],
  );
  // Production-side work today + the near horizon (next 2 days).
  const production = useMemo(
    () => m.events
      .filter((e) => PROD_TYPES.includes(e.type) && withinDays(e.start, 0, 2) && e.status !== "done")
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()),
    [m.events],
  );
  // Ads live right now + active campaigns.
  const liveAds = useMemo(() => m.events.filter((e) => e.type === "ad" && e.status === "live"), [m.events]);
  const activeCampaigns = useMemo(() => m.campaigns.filter((c) => c.status === "active"), [m.campaigns]);

  // Roll up the real ad metrics from each live flight's payload.
  const adRoll = useMemo(() => {
    let spend = 0, impressions = 0, clicks = 0, conversions = 0, n = 0;
    let cpcSum = 0, cpcN = 0, roasSum = 0, roasN = 0;
    for (const a of liveAds) {
      const mt = adPayload(a).metrics || {};
      if (mt.spend != null) { spend += mt.spend; n++; }
      if (mt.impressions != null) impressions += mt.impressions;
      if (mt.clicks != null) clicks += mt.clicks;
      if (mt.conversions != null) conversions += mt.conversions;
      if (mt.cpc != null) { cpcSum += mt.cpc; cpcN++; }
      if (mt.roas != null) { roasSum += mt.roas; roasN++; }
    }
    const ctr = impressions ? (clicks / impressions) * 100 : 0;
    return {
      spend, impressions, clicks, conversions, ctr,
      cpc: cpcN ? cpcSum / cpcN : 0,
      roas: roasN ? roasSum / roasN : 0,
      has: n > 0,
    };
  }, [liveAds]);

  // Priorities / at risk: blocked anywhere + overdue (past, not done).
  const blocked = useMemo(() => m.events.filter((e) => e.status === "blocked"), [m.events]);
  const overdue = useMemo(
    () => m.events
      .filter((e) => e.status !== "done" && e.status !== "blocked" && new Date(e.start).getTime() < now.getTime() - 36e5 && !isToday(e.start))
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 4),
    [m.events, now],
  );
  const atRisk = useMemo(() => [...blocked, ...overdue], [blocked, overdue]);

  // Wins: anything marked done today.
  const wins = useMemo(() => m.events.filter((e) => e.status === "done" && isToday(e.start)), [m.events]);

  // What to watch: the next 3 days of notable events.
  const horizon = useMemo(
    () => m.events
      .filter((e) => withinDays(e.start, 1, 3) && (e.type === "launch" || e.type === "clip" || e.type === "production" || e.type === "strategy"))
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 5),
    [m.events],
  );

  const firstName = "Akash";
  const greeting = useMemo(() => {
    const h = now.getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  }, [now]);

  // ── Live lead story (best-effort; never crashes the view) ──
  useEffect(() => {
    let cancelled = false;
    setLeadState("loading");
    (async () => {
      try {
        const res = await fetch("/api/morning-brief", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: "claude" }),
        });
        if (!res.ok) throw new Error("brief unavailable");
        const j: BriefResponse = await res.json();
        if (cancelled) return;
        if (j.leadStory && j.leadStory.headline) {
          setLead({
            headline: j.leadStory.headline,
            body: j.leadStory.body || DEMO_LEAD.body,
            whyItMatters: j.leadStory.whyItMatters || DEMO_LEAD.whyItMatters,
            sourceUrl: j.leadStory.sourceUrl,
          });
          if (Array.isArray(j.topSignals) && j.topSignals.length) setSignals(j.topSignals.slice(0, 4));
          setMoveFast(j.moveFastAlert ?? null);
          setLeadState("live");
        } else {
          setLeadState("demo");
        }
      } catch {
        if (!cancelled) setLeadState("demo");
      }
    })();
    return () => { cancelled = true; };
  }, [reloadKey]);

  // ── Copy as standup ──
  function buildStandup(): string {
    const dateStr = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
    const lines: string[] = [];
    lines.push(`MARKETING STANDUP — ${dateStr}`);
    lines.push(`Day load: ${dayLoad}%  ·  ${today.length} item${today.length === 1 ? "" : "s"} today`);
    lines.push("");
    lines.push("SHIPPING TODAY");
    if (posts.length) {
      for (const p of posts) {
        const ch = channelOf(p.channel);
        lines.push(`  • ${p.title} — ${ch.n} · ${fmtTime(p.start)} (${STATUS_LABEL[p.status]})`);
      }
    } else lines.push("  • nothing scheduled to publish");
    lines.push("");
    lines.push("IN PRODUCTION");
    if (production.length) {
      for (const e of production) lines.push(`  • ${e.title} — ${relDay(e.start)} (${STATUS_LABEL[e.status]})`);
    } else lines.push("  • clear");
    lines.push("");
    lines.push("ADS / CAMPAIGNS");
    if (adRoll.has) lines.push(`  • ${liveAds.length} live flight${liveAds.length === 1 ? "" : "s"} — $${Math.round(adRoll.spend).toLocaleString()} spent · ${adRoll.ctr.toFixed(2)}% CTR · ${adRoll.conversions} conv`);
    else for (const a of liveAds) lines.push(`  • LIVE: ${a.title}`);
    for (const c of activeCampaigns) lines.push(`  • ${c.name}${c.goal ? ` — ${c.goal}` : ""}`);
    if (!liveAds.length && !activeCampaigns.length) lines.push("  • none active");
    lines.push("");
    lines.push("AT RISK");
    if (atRisk.length) {
      for (const e of blocked) lines.push(`  ! BLOCKED: ${e.title}`);
      for (const e of overdue) lines.push(`  ! OVERDUE: ${e.title} (${relDay(e.start)})`);
    } else lines.push("  • nothing flagged");
    if (wins.length) {
      lines.push("");
      lines.push("WINS TODAY");
      for (const w of wins) lines.push(`  ✓ ${w.title}`);
    }
    lines.push("");
    lines.push("WHAT TO WATCH");
    for (const h of horizon) lines.push(`  → ${relDay(h.start)}: ${h.title}`);
    if (!horizon.length) lines.push("  • clear horizon");
    if (leadState === "live") {
      lines.push("");
      lines.push(`LEAD STORY — ${lead.headline}`);
    }
    return lines.join("\n");
  }

  function handleCopy() {
    const ok = copyText(buildStandup());
    if (ok) { setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
  }

  function go(view: string, focusId?: string) {
    onOpenView?.(view, focusId);
  }

  const headerDate = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  const nowH = now.getHours() + now.getMinutes() / 60;
  const nowInArc = nowH >= ARC_START && nowH <= ARC_END;
  const nowPct = clamp(((nowH - ARC_START) / (ARC_END - ARC_START)) * 100, 0, 100);

  return (
    <div style={wrap}>
      {/* ── Page head ── */}
      <PageHeader
        id="brief"
        title="Daily Brief"
        subtitle={`${headerDate} · the calm read — same spine as the launchboard, set to digest.`}
        right={<>
          <button style={btn(copied ? D.teal : undefined)} onClick={handleCopy} onMouseEnter={hov} onMouseLeave={unhov}>
            {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy as standup"}
          </button>
          <button style={btn()} onClick={() => setReloadKey((k) => k + 1)} onMouseEnter={hov} onMouseLeave={unhov}>
            <RefreshCw size={14} style={leadState === "loading" ? { animation: "bf-spin 0.9s linear infinite" } : undefined} />
            Regenerate
          </button>
        </>}
      />

      {/* ── Hero: greeting + state of the day + day-load ring ── */}
      <section style={hero}>
        <div style={heroSheen} />
        <div style={{ minWidth: 0, position: "relative", zIndex: 1 }}>
          <div style={heroKicker}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: D.amber, boxShadow: `0 0 8px ${D.amber}` }} />
            Editorial brief · {headerDate}
          </div>
          <h2 style={heroTitle}>
            {greeting}, <span style={shine}>{firstName}.</span>
          </h2>
          <p style={heroLede}>{stateOfDay(today, posts, production, atRisk, wins)}</p>
          <div style={heroStats}>
            <HeroStat n={posts.length} label="shipping" accent={D.amber} />
            <span style={statDiv} />
            <HeroStat n={production.length} label="in production" accent={D.blue} />
            <span style={statDiv} />
            <HeroStat n={liveAds.length} label="live ads" accent={D.teal} />
            <span style={statDiv} />
            <HeroStat n={atRisk.length} label="at risk" accent={atRisk.length ? D.coral : D.txd} />
          </div>
        </div>
        <DayLoadRing pct={dayLoad} count={today.length} />
      </section>

      {/* ── Hourly day arc with now marker ── */}
      <section style={arcCard}>
        <div style={arcHeadRow}>
          <span style={kicker}>
            <Activity size={12} color={D.amber} style={{ verticalAlign: -2, marginRight: 6 }} />
            The shape of today
          </span>
          <span style={{ fontFamily: mn, fontSize: 9.5, color: D.txd, letterSpacing: 0.5 }}>
            {ARC_START}:00 → {ARC_END}:00
          </span>
        </div>

        {/* band labels */}
        <div style={arcBands}>
          {ARC_BANDS.map((b, i) => {
            const next = ARC_BANDS[i + 1]?.from ?? ARC_END;
            const w = ((next - b.from) / (ARC_END - ARC_START)) * 100;
            const active = nowH >= b.from && nowH < next;
            return (
              <div key={b.label} style={{ width: `${w}%`, display: "flex", alignItems: "center", gap: 5, color: active ? b.accent : D.txd }}>
                <b.Icon size={12} />
                <span style={{ fontFamily: mn, fontSize: 9, letterSpacing: 0.6, textTransform: "uppercase" }}>{b.label}</span>
              </div>
            );
          })}
        </div>

        {/* the track */}
        <div style={arcTrack}>
          {/* band shading */}
          {ARC_BANDS.map((b, i) => {
            const next = ARC_BANDS[i + 1]?.from ?? ARC_END;
            const left = ((b.from - ARC_START) / (ARC_END - ARC_START)) * 100;
            const w = ((next - b.from) / (ARC_END - ARC_START)) * 100;
            return <div key={b.label} style={{ position: "absolute", top: 0, bottom: 0, left: `${left}%`, width: `${w}%`, background: i % 2 ? "transparent" : "rgba(255,255,255,0.018)" }} />;
          })}
          {/* baseline */}
          <div style={arcBaseline} />
          {/* now marker */}
          {nowInArc && (
            <div style={{ ...arcNow, left: `${nowPct}%` }}>
              <span style={arcNowLabel}>now</span>
            </div>
          )}
          {/* event pins */}
          {todaySorted.map((e, idx) => {
            const h = hourOf(e.start);
            if (h < ARC_START || h > ARC_END) return null;
            const left = clamp(((h - ARC_START) / (ARC_END - ARC_START)) * 100, 0, 100);
            const up = idx % 2 === 0;
            const color = TYPE_COLOR[e.type];
            const past = h < nowH;
            return (
              <button
                key={e.id}
                onClick={() => go("calendar", e.id)}
                title={`${e.title} · ${fmtTime(e.start)}`}
                style={{ ...arcPin, left: `${left}%`, opacity: past ? 0.55 : 1 }}
              >
                <span style={{ ...arcPinDot, background: color, boxShadow: e.status === "live" ? `0 0 8px ${color}` : "none" }} />
                <span style={{ ...arcPinCard, ...(up ? { bottom: 18 } : { top: 18 }), borderColor: color + "44" }}>
                  <span style={{ fontFamily: mn, fontSize: 8.5, color, letterSpacing: 0.4 }}>{fmtTime(e.start)}</span>
                  <span style={arcPinTitle}>{e.title}</span>
                </span>
              </button>
            );
          })}
          {!todaySorted.length && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: D.txd, fontStyle: "italic", fontSize: 12 }}>
              A clear board today — nothing on the wire.
            </div>
          )}
        </div>
      </section>

      {/* ── Editorial body: lead column + side rail ── */}
      <section style={edGrid}>
        {/* ── lead column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          {/* Lead story */}
          <article style={leadCard}>
            <div style={leadHead}>
              <span style={leadKicker}>
                <Flame size={12} color={D.amber} style={{ verticalAlign: -2, marginRight: 5 }} />
                Lead story
              </span>
              <span style={leadBadge(leadState)}>
                {leadState === "live" ? "● live pull" : leadState === "loading" ? "◷ fetching…" : "◷ demo"}
              </span>
            </div>
            <h3 style={leadHeadline}>{lead.headline}</h3>
            <div style={leadBody}>
              {lead.body.split("\n\n").map((para, i) => (
                <p key={i} style={{ margin: "0 0 12px" }}>{para}</p>
              ))}
            </div>
            <div style={whyBox}>
              <span style={whyLabel}>Why it matters</span>
              <p style={{ margin: "5px 0 0", color: D.tx, fontSize: 13.5, lineHeight: 1.55 }}>{lead.whyItMatters}</p>
            </div>
            <div style={signalRow}>
              {signals.slice(0, 4).map((s, i) => (
                <span key={i} style={signalChip}>
                  <Sparkles size={10} color={D.cyan} style={{ verticalAlign: -1, marginRight: 4 }} />
                  {s}
                </span>
              ))}
            </div>
            {(moveFast || lead.sourceUrl) && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
                {moveFast && (
                  <span style={moveFastChip}>
                    <Clock size={11} style={{ verticalAlign: -2, marginRight: 5 }} />
                    Move fast: {moveFast}
                  </span>
                )}
                {lead.sourceUrl && (
                  <a href={lead.sourceUrl} target="_blank" rel="noreferrer" style={srcLink}>
                    source <ExternalLink size={11} style={{ verticalAlign: -1 }} />
                  </a>
                )}
              </div>
            )}
          </article>

          {/* Launching today */}
          <SectionCard accent={D.amber} Icon={Rocket} label="Launching today"
            sub={`${posts.length} post${posts.length === 1 ? "" : "s"}`}
            action={posts.length ? { label: "Calendar", onClick: () => go("calendar") } : undefined}>
            {posts.length ? posts.slice(0, 6).map((p) => <PostRow key={p.id} e={p} onClick={() => go("calendar", p.id)} />)
              : <Empty>Nothing scheduled to publish.</Empty>}
          </SectionCard>

          {/* Priorities / at risk */}
          <SectionCard accent={D.coral} Icon={TriangleAlert} label="Priorities — what's at risk"
            sub={`${atRisk.length} flag${atRisk.length === 1 ? "" : "s"}`}
            action={atRisk.length ? { label: "Board", onClick: () => go("board") } : undefined}>
            {blocked.map((f) => (
              <button key={f.id} style={riskRow} onClick={() => go("board", f.id)} onMouseEnter={rowHov} onMouseLeave={rowUnhov}>
                <span style={riskTag(D.coral)}>blocked</span>
                <span style={{ ...rowTitle, color: D.tx }}>{f.title}</span>
                <ArrowRight size={12} color={D.txd} style={{ flex: "none" }} />
              </button>
            ))}
            {overdue.map((o) => (
              <button key={o.id} style={riskRow} onClick={() => go("calendar", o.id)} onMouseEnter={rowHov} onMouseLeave={rowUnhov}>
                <span style={riskTag(D.amber)}>overdue</span>
                <span style={{ ...rowTitle, color: D.tx }}>{o.title}</span>
                <span style={{ fontFamily: mn, fontSize: 9.5, color: D.txd, flex: "none" }}>{relDay(o.start)}</span>
              </button>
            ))}
            {!atRisk.length && <Empty>Calm ahead. Nothing flagged or overdue.</Empty>}
          </SectionCard>
        </div>

        {/* ── side rail ── */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          {/* Live ads at a glance — real metrics */}
          <div style={{ ...sectionCard, borderTop: `2px solid ${D.teal}` }}>
            <CardHead accent={D.teal} Icon={Radio} label="Ads at a glance"
              sub={`${liveAds.length} live · ${activeCampaigns.length} campaign${activeCampaigns.length === 1 ? "" : "s"}`}
              action={{ label: "Kiosk", onClick: () => go("kiosk") }} />
            {adRoll.has ? (
              <>
                <div style={adMetricGrid}>
                  <AdMetric Icon={DollarSign} label="Spend" value={`$${Math.round(adRoll.spend).toLocaleString()}`} accent={D.amber} />
                  <AdMetric Icon={Eye} label="Impr." value={compact(adRoll.impressions)} accent={D.cyan} />
                  <AdMetric Icon={MousePointerClick} label="CTR" value={`${adRoll.ctr.toFixed(2)}%`} accent={D.blue} />
                  <AdMetric Icon={Target} label="Conv." value={String(adRoll.conversions)} accent={D.teal} />
                  <AdMetric Icon={Gauge} label="Avg CPC" value={`$${adRoll.cpc.toFixed(2)}`} accent={D.violet} />
                  <AdMetric Icon={ArrowUpRight} label="ROAS" value={`${adRoll.roas.toFixed(1)}×`} accent={adRoll.roas >= 1 ? D.teal : D.coral} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 12 }}>
                  {liveAds.slice(0, 4).map((a) => {
                    const pf = adPlatform(adPayload(a).platform || a.channel);
                    return (
                      <button key={a.id} style={adFlightRow} onClick={() => go("kiosk", a.id)} onMouseEnter={rowHov} onMouseLeave={rowUnhov}>
                        <span style={{ ...platPill, background: pf.c + "1F", color: pf.c, borderColor: pf.c + "40" }}>{pf.s}</span>
                        <span style={rowTitle}>{a.title}</span>
                        <span style={liveDot} />
                      </button>
                    );
                  })}
                </div>
              </>
            ) : liveAds.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {liveAds.map((a) => (
                  <div key={a.id} style={rowFlex}>
                    <span style={liveDot} />
                    <span style={rowTitle}>{a.title}</span>
                    <span style={{ fontFamily: mn, fontSize: 9, color: D.teal, flex: "none" }}>LIVE</span>
                  </div>
                ))}
              </div>
            ) : <Empty>No live flights.</Empty>}

            {activeCampaigns.length > 0 && (
              <div style={{ marginTop: 13, paddingTop: 12, borderTop: `1px solid ${D.border}`, display: "flex", flexDirection: "column", gap: 7 }}>
                {activeCampaigns.map((c) => (
                  <button key={c.id} style={adFlightRow} onClick={() => go("campaigns", c.id)} onMouseEnter={rowHov} onMouseLeave={rowUnhov}>
                    <span style={{ ...dot, background: c.color }} />
                    <span style={rowTitle}>{c.name}</span>
                    <Megaphone size={11} color={D.txd} style={{ flex: "none" }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* In production */}
          <SectionCard accent={D.blue} Icon={Clapperboard} label="In production" sub="next 2 days"
            action={production.length ? { label: "Timeline", onClick: () => go("timeline") } : undefined}>
            {production.length ? production.slice(0, 5).map((e) => (
              <button key={e.id} style={prodRow} onClick={() => go("calendar", e.id)} onMouseEnter={rowHov} onMouseLeave={rowUnhov}>
                <span style={{ ...dot, background: TYPE_COLOR[e.type] }} />
                <span style={rowTitle}>{e.title}</span>
                <span style={{ ...statusPill, flex: "none" }}>{relDay(e.start)}</span>
              </button>
            )) : <Empty>Production slate is clear.</Empty>}
          </SectionCard>

          {/* Wins today */}
          {wins.length > 0 && (
            <SectionCard accent={D.teal} Icon={CircleCheck} label="Wins today"
              sub={`${wins.length} shipped`}>
              {wins.map((w) => (
                <div key={w.id} style={rowFlex}>
                  <CircleCheck size={13} color={D.teal} style={{ flex: "none" }} />
                  <span style={{ ...rowTitle, color: D.txm, textDecoration: "line-through", textDecorationColor: D.txd }}>{w.title}</span>
                </div>
              ))}
            </SectionCard>
          )}

          {/* What to watch */}
          <SectionCard accent={D.violet} Icon={Eye} label="What to watch" sub="next 3 days"
            action={{ label: "Trends", onClick: () => go("trends") }}>
            {horizon.length ? horizon.map((h) => (
              <button key={h.id} style={watchRow} onClick={() => go("calendar", h.id)} onMouseEnter={rowHov} onMouseLeave={rowUnhov}>
                <span style={{ fontFamily: mn, fontSize: 9, color: D.txd, width: 34, flex: "none", textTransform: "uppercase" }}>{relDay(h.start)}</span>
                <span style={rowTitle}>{h.title}</span>
                <span style={{ ...dot, background: TYPE_COLOR[h.type] }} />
              </button>
            )) : <Empty>Clear horizon — nothing notable queued.</Empty>}
            <div style={watchLine}>
              <AlarmClock size={11} color={D.amber} style={{ flex: "none", verticalAlign: -1 }} />
              <span>{signals[0] || "Memory remains the gating narrative this week."}</span>
            </div>
          </SectionCard>
        </aside>
      </section>

      <style>{`@keyframes bf-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── Subcomponents ───
function HeroStat({ n, label, accent }: { n: number; label: string; accent: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <b style={{ fontFamily: gf, fontSize: 22, lineHeight: 1, color: accent }}>{n}</b>
      <span style={{ fontFamily: mn, fontSize: 8.5, letterSpacing: 0.6, textTransform: "uppercase", color: D.txm }}>{label}</span>
    </div>
  );
}

function DayLoadRing({ pct, count }: { pct: number; count: number }) {
  const R = 52, C = 2 * Math.PI * R;
  const off = C * (1 - pct / 100);
  const color = pct >= 80 ? D.coral : pct >= 55 ? D.amber : D.cyan;
  const tone = pct >= 80 ? "Heavy" : pct >= 55 ? "Full" : pct >= 25 ? "Steady" : "Light";
  return (
    <div style={{ flex: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 7, position: "relative", zIndex: 1 }}>
      <div style={{ position: "relative", width: 132, height: 132 }}>
        <svg width={132} height={132} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={66} cy={66} r={R} fill="none" stroke={D.border} strokeWidth={9} />
          <circle cx={66} cy={66} r={R} fill="none" stroke={color} strokeWidth={9}
            strokeLinecap="round" strokeDasharray={C} strokeDashoffset={off}
            style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(.4,0,.2,1)", filter: `drop-shadow(0 0 6px ${color}66)` }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1 }}>
          <b style={{ fontFamily: gf, fontSize: 32, lineHeight: 1, color }}>{pct}%</b>
          <span style={{ fontFamily: mn, fontSize: 8.5, letterSpacing: 0.8, textTransform: "uppercase", color: D.txm }}>day load</span>
        </div>
      </div>
      <span style={{ fontFamily: mn, fontSize: 9.5, color: D.txd, letterSpacing: 0.4 }}>
        {tone} · {count} item{count === 1 ? "" : "s"}
      </span>
    </div>
  );
}

interface CardAction { label: string; onClick: () => void; }

function CardHead({ accent, Icon, label, sub, action }: {
  accent: string; Icon: typeof Rocket; label: string; sub: string; action?: CardAction;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
      <span style={{ width: 30, height: 30, borderRadius: 8, background: accent + "18", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
        <Icon size={15} color={accent} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: gf, fontSize: 14, color: D.tx, letterSpacing: 0.2 }}>{label}</div>
        <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, textTransform: "uppercase", letterSpacing: 0.5 }}>{sub}</div>
      </div>
      {action && (
        <button style={cardAction} onClick={action.onClick}
          onMouseEnter={(e) => { e.currentTarget.style.color = D.amber; e.currentTarget.style.borderColor = D.amber + "55"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = D.txm; e.currentTarget.style.borderColor = D.border; }}>
          {action.label}<ArrowUpRight size={11} />
        </button>
      )}
    </div>
  );
}

function SectionCard({ accent, Icon, label, sub, action, children }: {
  accent: string; Icon: typeof Rocket; label: string; sub: string; action?: CardAction; children: React.ReactNode;
}) {
  return (
    <div style={{ ...sectionCard, borderTop: `2px solid ${accent}` }}>
      <CardHead accent={accent} Icon={Icon} label={label} sub={sub} action={action} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </div>
  );
}

function AdMetric({ Icon, label, value, accent }: { Icon: typeof DollarSign; label: string; value: string; accent: string }) {
  return (
    <div style={adMetricCell}>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <Icon size={11} color={accent} />
        <span style={{ fontFamily: mn, fontSize: 8, letterSpacing: 0.5, textTransform: "uppercase", color: D.txd }}>{label}</span>
      </div>
      <b style={{ fontFamily: gf, fontSize: 16, color: D.tx, lineHeight: 1 }}>{value}</b>
    </div>
  );
}

function PostRow({ e, onClick }: { e: MarketingEvent; onClick: () => void }) {
  const ch = channelOf(e.channel);
  return (
    <button style={prodRow} onClick={onClick} onMouseEnter={rowHov} onMouseLeave={rowUnhov}>
      <span style={{ ...chanPill, background: ch.c + "1F", color: ch.c, borderColor: ch.c + "40" }}>{ch.s}</span>
      <span style={{ ...rowTitle, fontWeight: 500 }}>{e.title}</span>
      <span style={{ fontFamily: mn, fontSize: 10, color: e.status === "live" ? D.teal : D.txm, flex: "none" }}>{fmtTime(e.start)}</span>
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ color: D.txd, fontSize: 12, fontStyle: "italic", padding: "2px 0" }}>{children}</div>;
}

// ─── Pure helpers ───
function clamp(n: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, n)); }
function compact(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}
function withinDays(iso: string, lo: number, hi: number): boolean {
  const d = new Date(iso); const n = new Date();
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const b = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  const delta = Math.round((a - b) / 86400000);
  return delta >= lo && delta <= hi;
}
function stateOfDay(
  today: MarketingEvent[], posts: MarketingEvent[], production: MarketingEvent[],
  atRisk: MarketingEvent[], wins: MarketingEvent[],
): string {
  const launches = today.filter((e) => e.type === "launch").length;
  const parts: string[] = [];
  if (posts.length) parts.push(`${posts.length} post${posts.length === 1 ? "" : "s"} out the door`);
  if (launches) parts.push(`${launches} launch${launches === 1 ? "" : "es"} in the chamber`);
  if (production.length) parts.push(`${production.length} in production close behind`);
  if (wins.length) parts.push(`${wins.length} already shipped`);
  const lead = parts.length ? capitalize(parts.join(", ")) + "." : "A quiet board today.";
  const tail = atRisk.length
    ? ` ${atRisk.length} thing${atRisk.length === 1 ? "" : "s"} actually need${atRisk.length === 1 ? "s" : ""} you — read it top to bottom, then ship.`
    : " Nothing's flagged — read it top to bottom, then ship.";
  return lead + tail;
}
function capitalize(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }

// ─── Styles ───
const wrap: React.CSSProperties = {
  padding: "22px 26px 48px", maxWidth: 1320, margin: "0 auto", fontFamily: ft, color: D.tx,
  display: "flex", flexDirection: "column", gap: 18,
};

const hero: React.CSSProperties = {
  position: "relative", overflow: "hidden",
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 28,
  background: `radial-gradient(120% 160% at 100% 0%, ${D.amber}10 0%, transparent 55%), ${D.cardGrad}`,
  border: `1px solid ${D.border}`, borderRadius: 18, padding: "28px 30px", boxShadow: D.glow, flexWrap: "wrap",
};
const heroSheen: React.CSSProperties = {
  position: "absolute", top: -120, right: -80, width: 320, height: 320, borderRadius: "50%",
  background: `radial-gradient(circle, ${D.amber}0E 0%, transparent 70%)`, pointerEvents: "none",
};
const heroKicker: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 7, fontFamily: mn, fontSize: 9.5,
  letterSpacing: 1, textTransform: "uppercase", color: D.txm, marginBottom: 11,
};
const heroTitle: React.CSSProperties = {
  fontFamily: gf, fontWeight: 500, fontSize: 44, letterSpacing: -0.8, margin: "0 0 9px", color: D.tx, lineHeight: 1.04,
};
const shine: React.CSSProperties = {
  fontStyle: "italic",
  background: `linear-gradient(92deg, ${D.amber}, ${D.coral})`,
  WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", color: D.amber,
};
const heroLede: React.CSSProperties = { color: D.txm, fontSize: 15.5, lineHeight: 1.55, maxWidth: 600, margin: "0 0 18px" };
const heroStats: React.CSSProperties = { display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" };
const statDiv: React.CSSProperties = { width: 1, height: 26, background: D.border, flex: "none" };

const kicker: React.CSSProperties = {
  fontFamily: mn, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: D.amber,
};

const arcCard: React.CSSProperties = {
  background: D.cardGrad, border: `1px solid ${D.border}`, borderRadius: 16, padding: "16px 20px 30px", boxShadow: D.glow,
};
const arcHeadRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 };
const arcBands: React.CSSProperties = { display: "flex", marginBottom: 8 };
const arcTrack: React.CSSProperties = { position: "relative", height: 78, marginTop: 36, marginBottom: 30 };
const arcBaseline: React.CSSProperties = {
  position: "absolute", left: 0, right: 0, top: "50%", height: 2, borderRadius: 2,
  background: `linear-gradient(90deg, ${D.amber}33, ${D.cyan}33, ${D.teal}33, ${D.violet}33)`,
};
const arcNow: React.CSSProperties = {
  position: "absolute", top: -34, bottom: -26, width: 2, background: D.amber, transform: "translateX(-1px)", zIndex: 4,
  boxShadow: `0 0 8px ${D.amber}88`,
};
const arcNowLabel: React.CSSProperties = {
  position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)",
  fontFamily: mn, fontSize: 8, letterSpacing: 0.6, textTransform: "uppercase", color: D.amber,
  background: D.bg, border: `1px solid ${D.amber}55`, borderRadius: 999, padding: "2px 7px", whiteSpace: "nowrap",
};
const arcPin: React.CSSProperties = {
  position: "absolute", top: "50%", transform: "translate(-50%, -50%)", zIndex: 3,
  background: "none", border: "none", padding: 0, cursor: "pointer",
};
const arcPinDot: React.CSSProperties = {
  display: "block", width: 11, height: 11, borderRadius: 999, border: `2px solid ${D.bg}`,
};
const arcPinCard: React.CSSProperties = {
  position: "absolute", left: "50%", transform: "translateX(-50%)",
  display: "flex", flexDirection: "column", gap: 1, width: 116, padding: "5px 8px",
  background: D.surface, border: "1px solid", borderRadius: 8, textAlign: "left",
};
const arcPinTitle: React.CSSProperties = {
  color: D.tx, fontSize: 10.5, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis",
  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
};

const edGrid: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 16, alignItems: "start",
};

const sectionCard: React.CSSProperties = {
  background: D.cardGrad, border: `1px solid ${D.border}`, borderRadius: 14, padding: "16px 17px 17px", boxShadow: D.glow,
};
const rowFlex: React.CSSProperties = { display: "flex", alignItems: "center", gap: 9, minWidth: 0 };
const rowTitle: React.CSSProperties = {
  flex: 1, color: D.tx, fontSize: 12.5, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left",
};
const dot: React.CSSProperties = { width: 8, height: 8, borderRadius: 999, flex: "none" };
const liveDot: React.CSSProperties = { width: 8, height: 8, borderRadius: 999, flex: "none", background: D.teal, boxShadow: `0 0 8px ${D.teal}` };
const chanPill: React.CSSProperties = {
  fontFamily: mn, fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 6, border: "1px solid",
  flex: "none", minWidth: 22, textAlign: "center", letterSpacing: 0.3,
};
const platPill: React.CSSProperties = { ...chanPill };

const prodRow: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 9, minWidth: 0, width: "100%",
  background: "none", border: "1px solid transparent", borderRadius: 8, padding: "5px 7px",
  cursor: "pointer", transition: "background 0.14s, border-color 0.14s",
};
const riskRow: React.CSSProperties = { ...prodRow };
const watchRow: React.CSSProperties = { ...prodRow };
const adFlightRow: React.CSSProperties = { ...prodRow, padding: "5px 7px" };

function rowHov(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.background = D.hover;
  e.currentTarget.style.borderColor = D.border;
}
function rowUnhov(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.background = "none";
  e.currentTarget.style.borderColor = "transparent";
}

function riskTag(c: string): React.CSSProperties {
  return {
    fontFamily: mn, fontSize: 8, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
    color: c, background: c + "16", border: `1px solid ${c}33`, borderRadius: 5, padding: "2px 6px", flex: "none",
  };
}
const statusPill: React.CSSProperties = { fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.4, textTransform: "uppercase" };

const adMetricGrid: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8,
};
const adMetricCell: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 6, padding: "9px 10px",
  background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10,
};

const watchLine: React.CSSProperties = {
  display: "flex", alignItems: "flex-start", gap: 7, marginTop: 4, padding: "9px 11px",
  background: D.amber + "0A", border: `1px solid ${D.amber}1F`, borderRadius: 9,
  fontSize: 11.5, lineHeight: 1.45, color: D.txm,
};

const leadCard: React.CSSProperties = {
  background: `radial-gradient(120% 140% at 0% 0%, ${D.amber}0C 0%, transparent 55%), ${D.cardGrad}`,
  border: `1px solid ${D.border}`, borderRadius: 16, padding: "22px 24px 24px", boxShadow: D.glow,
};
const leadHead: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 };
const leadKicker: React.CSSProperties = {
  fontFamily: mn, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: D.amber,
};
function leadBadge(state: "demo" | "live" | "loading"): React.CSSProperties {
  const c = state === "live" ? D.teal : state === "loading" ? D.cyan : D.txm;
  return { fontFamily: mn, fontSize: 9.5, color: c, border: `1px solid ${c}40`, borderRadius: 999, padding: "3px 9px" };
}
const leadHeadline: React.CSSProperties = {
  fontFamily: gf, fontWeight: 600, fontSize: 28, letterSpacing: -0.4, lineHeight: 1.12, margin: "0 0 14px", color: D.tx,
};
const leadBody: React.CSSProperties = { color: D.txm, fontSize: 14.5, lineHeight: 1.62 };
const whyBox: React.CSSProperties = {
  marginTop: 6, padding: "12px 14px", borderRadius: 10, background: D.amber + "0E", border: `1px solid ${D.amber}22`,
  borderLeft: `2px solid ${D.amber}`,
};
const whyLabel: React.CSSProperties = {
  fontFamily: mn, fontSize: 9.5, letterSpacing: 0.6, textTransform: "uppercase", color: D.amber,
};
const signalRow: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 };
const signalChip: React.CSSProperties = {
  fontSize: 11.5, color: D.tx, background: D.surface, border: `1px solid ${D.border}`, borderRadius: 999, padding: "5px 11px",
};
const moveFastChip: React.CSSProperties = {
  fontSize: 11.5, color: D.coral, background: D.coral + "12", border: `1px solid ${D.coral}33`, borderRadius: 8, padding: "6px 11px",
};
const srcLink: React.CSSProperties = {
  fontFamily: mn, fontSize: 11, color: D.cyan, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4,
};

const cardAction: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 4, fontFamily: mn, fontSize: 9.5, letterSpacing: 0.4,
  color: D.txm, background: "none", border: `1px solid ${D.border}`, borderRadius: 7, padding: "4px 8px",
  cursor: "pointer", transition: "color 0.15s, border-color 0.15s", flex: "none", textTransform: "uppercase",
};

function btn(active?: string): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 7, fontFamily: ft, fontSize: 12.5, fontWeight: 500,
    color: active || D.tx, background: D.surface, border: `1px solid ${active ? active + "55" : D.border}`,
    borderRadius: 9, padding: "8px 13px", cursor: "pointer", transition: "all 0.16s",
  };
}
function hov(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.background = D.hover;
  e.currentTarget.style.borderColor = D.amber + "55";
}
function unhov(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.background = D.surface;
  e.currentTarget.style.borderColor = D.border;
}
