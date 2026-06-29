"use client";
// MarketingSUITE · Rollouts — the "live / green-lit" zone.
// One glance at everything locked-and-loaded across the whole suite: ad flights
// running right now, episode/release premieres that are green-lit (a Project that
// got a finalized premiere → a Rollout), and the campaigns those live inside.
// This view is read-only aggregation — it reads m.events / m.campaigns and groups
// by payload.rollout exactly like the Campaigns Feature panel, but across every
// campaign at once. Clicking through deep-links into Campaigns / Ad Kiosk.
import React, { useMemo } from "react";
import {
  Rocket, Radio, Flame, Clapperboard, DollarSign, CalendarDays, Megaphone,
  ArrowUpRight, Layers, Activity, ChevronRight, Sparkles, Zap,
} from "lucide-react";
import { D, ft, gf, mn } from "../../shared-constants";
import {
  STATUS_COLOR, STATUS_LABEL, channelOf, adPayload, adPlatform,
  eventRollout, eventStage, eventRelease, eventEpisodeNo, eventPhase, eventProjectName,
  PODCAST_LIFECYCLE,
  type Campaign, type MarketingEvent,
} from "../marketing-constants";
import type { ViewProps } from "../use-marketing";
import PageHeader from "../components/page-header";

// ─── Date helpers ───
const DAY = 86400000;
const fmtShort = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
// Whole-day delta from now (negative = in the past). Floors so "today" stays 0.
function dayDelta(iso: string): number {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const then = new Date(iso); then.setHours(0, 0, 0, 0);
  return Math.round((then.getTime() - now.getTime()) / DAY);
}
// "live · 2d in" / "today" / "in 3d" — the locked-and-loaded countdown.
function relLabel(iso: string): { text: string; color: string; live: boolean } {
  const d = dayDelta(iso);
  if (d < 0) return { text: `live · ${-d}d in`, color: D.teal, live: true };
  if (d === 0) return { text: "premieres today", color: D.coral, live: true };
  if (d === 1) return { text: "in 1 day", color: D.amber, live: false };
  if (d <= 7) return { text: `in ${d} days`, color: D.amber, live: false };
  return { text: `in ${d} days`, color: D.txm, live: false };
}
function compact(n?: number): string {
  if (n == null || isNaN(n)) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + "k";
  return String(n);
}
const isAd = (e: MarketingEvent) => e.type === "ad";
const isDone = (e: MarketingEvent) => e.status === "done";

// A release unit grouped by payload.rollout, tagged with its campaign.
type Premiere = {
  id: string; release: string | null; episodeNo: number | null; name: string | null;
  events: MarketingEvent[]; campaignId: string | null;
};

export default function RolloutsView({ m, onOpenView }: ViewProps) {
  const { campaigns, events } = m;
  const campById = useMemo(
    () => new Map(campaigns.map((c) => [c.id, c] as const)),
    [campaigns],
  );

  // ── Live ad flights (running right now) ──
  const liveAds = useMemo(
    () => events.filter((e) => isAd(e) && e.status === "live")
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()),
    [events],
  );

  // ── Green-lit premieres: rollout-phase groups not yet fully shipped ──
  const premieres = useMemo<Premiere[]>(() => {
    const byId = new Map<string, Premiere>();
    events.forEach((e) => {
      const r = eventRollout(e);
      if (!r) return;
      let g = byId.get(r);
      if (!g) { g = { id: r, release: null, episodeNo: null, name: null, events: [], campaignId: null }; byId.set(r, g); }
      g.events.push(e);
      if (!g.release) g.release = eventRelease(e);
      if (g.episodeNo == null) g.episodeNo = eventEpisodeNo(e);
      if (!g.name) g.name = eventProjectName(e);
      if (!g.campaignId && e.campaignId) g.campaignId = e.campaignId;
    });
    return Array.from(byId.values())
      // only green-lit (premiere locked) and still in flight (not fully done)
      .filter((g) => g.events.some((e) => eventPhase(e) === "rollout"))
      .filter((g) => !g.events.every(isDone))
      .sort((a, b) => (a.release ? +new Date(a.release) : Infinity) - (b.release ? +new Date(b.release) : Infinity));
  }, [events]);

  // ── Standalone live items (live, non-ad, not part of a rollout) ──
  const liveLoose = useMemo(
    () => events.filter((e) => e.status === "live" && !isAd(e) && !eventRollout(e)),
    [events],
  );

  // ── Running campaigns ──
  const running = useMemo(() => campaigns.filter((c) => c.status === "active"), [campaigns]);

  // ── Summary numbers ──
  const liveSpend = liveAds.reduce((s, a) => s + (adPayload(a).metrics?.spend || 0), 0);
  const launchingSoon = premieres.filter((p) => p.release && dayDelta(p.release) >= 0 && dayDelta(p.release) <= 14).length;
  const liveNowCount = liveAds.length + liveLoose.length;

  const nothingLive = liveNowCount === 0 && premieres.length === 0 && running.length === 0;

  return (
    <div style={page}>
      <PageHeader
        id="rollouts"
        title="Rollouts"
        subtitle="Everything green-lit and live — ad flights running, premieres locked and loaded, and the campaigns they ride inside. One glance, see it all."
      />

      {/* ── Summary strip ── */}
      <div style={summary}>
        <SumCell label="LIVE NOW" value={String(liveNowCount)} Icon={Radio} color={liveNowCount ? D.crimson : D.txm} />
        <SumCell label="LAUNCHING ≤14d" value={String(launchingSoon)} Icon={Rocket} color={launchingSoon ? D.amber : D.txm} />
        <SumCell label="CAMPAIGNS RUNNING" value={String(running.length)} Icon={Megaphone} color={running.length ? D.violet : D.txm} />
        <SumCell label="LIVE AD SPEND" value={liveSpend ? `$${compact(liveSpend)}` : "—"} Icon={DollarSign} color={liveSpend ? D.teal : D.txm} />
      </div>

      {nothingLive && (
        <div style={emptyWrap}>
          <Sparkles size={20} color={D.txd} />
          <div style={{ fontFamily: gf, fontSize: 17, color: D.tx, marginTop: 10 }}>Nothing green-lit yet</div>
          <div style={{ fontFamily: mn, fontSize: 12, color: D.txm, marginTop: 6, lineHeight: 1.6, maxWidth: 420 }}>
            Build a Project in Campaigns, then lock a premiere date to roll it out — it lands here the moment it&apos;s green-lit.
          </div>
          <button style={{ ...primaryBtn, marginTop: 16 }} onClick={() => onOpenView?.("campaigns")}>
            <Megaphone size={13} style={{ verticalAlign: -2, marginRight: 5 }} /> Go to Campaigns
          </button>
        </div>
      )}

      {/* ── LIVE NOW — ad flights + standalone live items ── */}
      {liveNowCount > 0 && (
        <Lane Icon={Radio} color={D.crimson} title="LIVE NOW" count={liveNowCount} pulse>
          <div style={grid}>
            {liveAds.map((a) => (
              <LiveAdCard key={a.id} ad={a} campaign={campById.get(a.campaignId || "")} onOpen={() => onOpenView?.("kiosk", a.id)} />
            ))}
            {liveLoose.map((e) => (
              <LiveItemCard key={e.id} ev={e} campaign={campById.get(e.campaignId || "")} onOpen={() => onOpenView?.("campaigns", e.campaignId || undefined)} />
            ))}
          </div>
        </Lane>
      )}

      {/* ── LOCKED & LOADED — green-lit premieres ── */}
      {premieres.length > 0 && (
        <Lane Icon={Rocket} color={D.amber} title="LOCKED & LOADED" count={premieres.length} sub="green-lit premieres">
          <div style={grid}>
            {premieres.map((p) => (
              <PremiereCard key={p.id} premiere={p} campaign={campById.get(p.campaignId || "")}
                onOpen={() => onOpenView?.("campaigns", p.campaignId || undefined)} />
            ))}
          </div>
        </Lane>
      )}

      {/* ── RUNNING CAMPAIGNS ── */}
      {running.length > 0 && (
        <Lane Icon={Megaphone} color={D.violet} title="RUNNING CAMPAIGNS" count={running.length}>
          <div style={grid}>
            {running.map((c) => {
              const evs = events.filter((e) => e.campaignId === c.id);
              return (
                <CampaignGlance key={c.id} campaign={c} events={evs} premieres={premieres.filter((p) => p.campaignId === c.id)}
                  onOpen={() => onOpenView?.("campaigns", c.id)} />
              );
            })}
          </div>
        </Lane>
      )}

      <style>{`@keyframes ms-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.7)}}`}</style>
    </div>
  );
}

/* ══════════════ Lane wrapper ══════════════ */
function Lane({ Icon, color, title, count, sub, pulse, children }: {
  Icon: typeof Rocket; color: string; title: string; count: number;
  sub?: string; pulse?: boolean; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, margin: "0 0 13px" }}>
        <span style={{ position: "relative", display: "inline-flex" }}>
          <Icon size={14} color={color} />
          {pulse && <span style={pulseDot(color)} />}
        </span>
        <span style={{ fontFamily: mn, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: D.tx }}>{title}</span>
        <span style={{ fontFamily: mn, fontSize: 10, color, padding: "1px 8px", borderRadius: 999, border: `1px solid ${color}55` }}>{count}</span>
        {sub && <span style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4 }}>· {sub}</span>}
        <div style={{ flex: 1, height: 1, background: D.border, marginLeft: 4 }} />
      </div>
      {children}
    </div>
  );
}

/* ══════════════ Live ad flight card ══════════════ */
function LiveAdCard({ ad, campaign, onOpen }: { ad: MarketingEvent; campaign?: Campaign; onOpen: () => void }) {
  const p = adPayload(ad);
  const plat = adPlatform(p.platform || ad.channel);
  const mt = p.metrics || {};
  const ranDays = Math.max(0, -dayDelta(ad.start));
  const leftDays = ad.end ? dayDelta(ad.end) : null;
  return (
    <button style={card} onClick={onOpen}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = plat.c + "77"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = D.border; e.currentTarget.style.transform = "none"; }}
    >
      <div style={{ position: "absolute", inset: "0 0 auto 0", height: 3, background: `linear-gradient(90deg, ${plat.c}, ${plat.c}33)` }} />
      <div style={cardHead}>
        <span style={{ ...dot, background: plat.c }} />
        <span style={{ fontFamily: mn, fontSize: 10, color: plat.c, letterSpacing: 0.5 }}>{plat.n}</span>
        <Flame size={12} color={D.crimson} />
        <span style={{ marginLeft: "auto", ...livePill }}>LIVE</span>
      </div>
      <div style={cardTitle}>{(p.headline || ad.title).replace(/^.*· /, "")}</div>
      {campaign && <CampTag campaign={campaign} />}
      <div style={metaRow}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Activity size={11} color={D.txd} /> running {ranDays}d</span>
        {leftDays != null && leftDays >= 0 && <span style={{ color: D.txm }}>· {leftDays}d left</span>}
        {mt.spend ? <span style={{ marginLeft: "auto", color: D.teal }}>${compact(mt.spend)}</span> : null}
      </div>
      <OpenRow color={plat.c} label="Open in Kiosk" />
    </button>
  );
}

/* ══════════════ Standalone live item card ══════════════ */
function LiveItemCard({ ev, campaign, onOpen }: { ev: MarketingEvent; campaign?: Campaign; onOpen: () => void }) {
  const ch = channelOf(ev.channel);
  return (
    <button style={card} onClick={onOpen}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = D.teal + "66"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = D.border; e.currentTarget.style.transform = "none"; }}
    >
      <div style={{ position: "absolute", inset: "0 0 auto 0", height: 3, background: `linear-gradient(90deg, ${D.teal}, ${D.teal}33)` }} />
      <div style={cardHead}>
        <Zap size={12} color={D.teal} />
        {ev.channel && <span style={{ fontFamily: mn, fontSize: 10, color: ch.c, letterSpacing: 0.5 }}>{ch.n}</span>}
        <span style={{ marginLeft: "auto", ...livePill }}>LIVE</span>
      </div>
      <div style={cardTitle}>{ev.title}</div>
      {campaign && <CampTag campaign={campaign} />}
      <OpenRow color={D.teal} label="Open campaign" />
    </button>
  );
}

/* ══════════════ Green-lit premiere card ══════════════ */
function PremiereCard({ premiere, campaign, onOpen }: { premiere: Premiere; campaign?: Campaign; onOpen: () => void }) {
  const rel = premiere.release ? relLabel(premiere.release) : { text: "no date", color: D.txd, live: false };
  const total = premiere.events.length || 1;
  const advanced = premiere.events.filter((e) => e.status === "live" || e.status === "done").length;
  const pct = Math.round((advanced / total) * 100);
  const stageMap = new Map(premiere.events.map((e) => [eventStage(e), e] as const));
  const label = premiere.name || (premiere.episodeNo != null ? `EP${premiere.episodeNo}` : "Rollout");
  return (
    <button style={card} onClick={onOpen}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = rel.color + "77"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = D.border; e.currentTarget.style.transform = "none"; }}
    >
      <div style={{ position: "absolute", inset: "0 0 auto 0", height: 3, background: `linear-gradient(90deg, ${rel.color}, ${rel.color}33)` }} />
      <div style={cardHead}>
        <Rocket size={12} color={rel.color} />
        {premiere.episodeNo != null && <span style={{ fontFamily: mn, fontSize: 10, color: D.txm }}>EP{premiere.episodeNo}</span>}
        <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 9.5, color: rel.color, display: "inline-flex", alignItems: "center", gap: 4 }}>
          {rel.live && <span style={pulseDot(rel.color)} />}
          {rel.text}
        </span>
      </div>
      <div style={cardTitle}>{label}</div>
      <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, marginTop: 2 }}>
        <CalendarDays size={10} style={{ verticalAlign: -2, marginRight: 4 }} />
        {premiere.release ? `premieres ${fmtShort(premiere.release)}` : "premiere unset"}
      </div>
      {campaign && <CampTag campaign={campaign} />}
      {/* lifecycle chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
        {PODCAST_LIFECYCLE.map((st) => {
          const ev = stageMap.get(st.key);
          const c = ev ? STATUS_COLOR[ev.status] : D.border;
          return (
            <span key={st.key} title={ev ? `${st.label} · ${STATUS_LABEL[ev.status]}` : `${st.label} · not planned`}
              style={{ ...chip, border: `1px solid ${ev ? c + "55" : D.border}`, color: ev ? c : D.txd, opacity: ev ? 1 : 0.4 }}>
              <span style={{ width: 5, height: 5, borderRadius: 999, background: ev ? c : D.txd }} />
              {st.label}
            </span>
          );
        })}
      </div>
      <div style={{ ...trackOuter, marginTop: 11 }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 6, background: `linear-gradient(90deg, ${rel.color}, ${D.coral})` }} />
      </div>
    </button>
  );
}

/* ══════════════ Running-campaign glance card ══════════════ */
function CampaignGlance({ campaign, events, premieres, onOpen }: {
  campaign: Campaign; events: MarketingEvent[]; premieres: Premiere[]; onOpen: () => void;
}) {
  const liveItems = events.filter((e) => e.status === "live");
  const liveAdN = events.filter((e) => isAd(e) && e.status === "live").length;
  const total = events.length || 1;
  const advanced = events.filter((e) => e.status === "live" || e.status === "done").length;
  const pct = Math.round((advanced / total) * 100);
  const nextPrem = premieres
    .filter((p) => p.release)
    .sort((a, b) => +new Date(a.release!) - +new Date(b.release!))[0];
  return (
    <button style={card} onClick={onOpen}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = campaign.color + "77"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = D.border; e.currentTarget.style.transform = "none"; }}
    >
      <div style={{ position: "absolute", inset: "0 0 auto 0", height: 3, background: `linear-gradient(90deg, ${campaign.color}, ${campaign.color}33)` }} />
      <div style={cardHead}>
        <span style={{ ...dot, background: campaign.color, borderRadius: 3 }} />
        <span style={{ fontFamily: gf, fontSize: 16, color: D.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{campaign.name}</span>
      </div>
      <div style={{ display: "flex", gap: 16, margin: "12px 0 2px", flexWrap: "wrap" }}>
        <Mini label="LIVE" value={String(liveItems.length)} Icon={Radio} color={liveItems.length ? D.teal : D.txm} />
        <Mini label="ADS" value={String(liveAdN)} Icon={Clapperboard} color={liveAdN ? D.crimson : D.txm} />
        <Mini label="PREMIERES" value={String(premieres.length)} Icon={Rocket} color={premieres.length ? D.amber : D.txm} />
      </div>
      <div style={{ fontFamily: mn, fontSize: 10, color: nextPrem ? D.amber : D.txd, marginTop: 8 }}>
        {nextPrem ? `next premiere ${fmtShort(nextPrem.release!)} · ${nextPrem.name || (nextPrem.episodeNo != null ? `EP${nextPrem.episodeNo}` : "rollout")}` : "no premiere locked"}
      </div>
      <div style={{ ...trackOuter, marginTop: 10 }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 6, background: `linear-gradient(90deg, ${campaign.color}, ${D.cyan})` }} />
      </div>
      <OpenRow color={campaign.color} label="Open campaign" />
    </button>
  );
}

/* ══════════════ Small shared pieces ══════════════ */
function CampTag({ campaign }: { campaign: Campaign }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: mn, fontSize: 9.5, color: D.txm, marginTop: 9 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: campaign.color, flex: "none" }} />
      {campaign.name}
    </div>
  );
}
function OpenRow({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 12, fontFamily: mn, fontSize: 10, color }}>
      {label} <ArrowUpRight size={12} />
    </div>
  );
}
function Mini({ label, value, Icon, color }: { label: string; value: string; Icon: typeof Layers; color: string }) {
  return (
    <div>
      <div style={{ fontFamily: mn, fontSize: 8.5, letterSpacing: 0.8, color: D.txd, display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
        <Icon size={10} color={color} /> {label}
      </div>
      <div style={{ fontFamily: gf, fontSize: 18, color, letterSpacing: -0.3 }}>{value}</div>
    </div>
  );
}
function SumCell({ label, value, Icon, color }: { label: string; value: string; Icon: typeof Layers; color: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: mn, fontSize: 9, letterSpacing: 1, color: D.txd, display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
        <Icon size={11} color={color} /> {label}
      </div>
      <div style={{ fontFamily: gf, fontSize: 23, color: D.tx, letterSpacing: -0.4 }}>{value}</div>
    </div>
  );
}

/* ══════════════ Style objects ══════════════ */
const pulseDot = (c: string): React.CSSProperties => ({
  position: "absolute", top: -2, right: -3, width: 6, height: 6, borderRadius: 999,
  background: c, boxShadow: `0 0 6px ${c}`, animation: "ms-pulse 1.6s ease-in-out infinite",
});
const page: React.CSSProperties = { padding: "22px 26px 48px", fontFamily: ft, width: "100%" };
const summary: React.CSSProperties = {
  display: "flex", gap: 30, flexWrap: "wrap", alignItems: "center",
  border: `1px solid ${D.border}`, borderRadius: 16, padding: "18px 22px", marginBottom: 24,
  background: "linear-gradient(135deg, rgba(224,99,71,.05), rgba(144,92,203,.03))",
};
const grid: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 14,
};
const card: React.CSSProperties = {
  position: "relative", textAlign: "left", width: "100%", cursor: "pointer",
  border: `1px solid ${D.border}`, borderRadius: 14, padding: "15px 16px 14px", overflow: "hidden",
  background: "linear-gradient(150deg, #0b0b12, #0d0d15)", color: D.tx,
  transition: "transform .16s, border-color .16s",
};
const cardHead: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8 };
const cardTitle: React.CSSProperties = {
  fontSize: 14.5, color: D.tx, fontWeight: 500, margin: "11px 0 0", lineHeight: 1.35,
  overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
};
const dot: React.CSSProperties = { width: 8, height: 8, borderRadius: "50%", flex: "none" };
const livePill: React.CSSProperties = {
  fontFamily: mn, fontSize: 8.5, letterSpacing: 1, padding: "2px 7px", borderRadius: 999,
  color: D.crimson, border: `1px solid ${D.crimson}66`,
};
const metaRow: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontFamily: mn, fontSize: 10, color: D.txd,
};
const chip: React.CSSProperties = {
  fontFamily: mn, fontSize: 9, letterSpacing: 0.2, borderRadius: 999, padding: "3px 7px",
  display: "inline-flex", alignItems: "center", gap: 4,
};
const trackOuter: React.CSSProperties = {
  height: 6, borderRadius: 6, background: "rgba(255,255,255,0.06)", overflow: "hidden",
};
const primaryBtn: React.CSSProperties = {
  fontFamily: mn, fontSize: 11, letterSpacing: 0.5, borderRadius: 9, padding: "9px 14px", cursor: "pointer",
  border: "none", background: `linear-gradient(135deg, ${D.violet}, ${D.blue})`, color: "#fff", fontWeight: 700,
};
const emptyWrap: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
  border: `1px dashed ${D.border}`, borderRadius: 18, padding: "44px 24px", marginBottom: 24,
};
