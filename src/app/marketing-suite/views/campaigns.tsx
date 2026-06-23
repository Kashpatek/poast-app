"use client";
// MarketingSUITE · Campaigns workspace (v2).
// The tracker + creation suite for three things at once — marketing CAMPAIGNS,
// the AD flights that ride inside them, and recurring SERIES. A single featured
// campaign reads as a story (brief · pipeline · mini-gantt · items · linked ads
// · series · rollout); a status-sectioned grid (active → planning → wrapping)
// selects it. The "+ New ad" flow mints a type:'ad' event and deep-links into
// the Ad Kiosk builder for it; the series scheduler projects a cadence and reads
// the generated dates back from the live events (m.addSeries → m.events).
import React, { useMemo, useState } from "react";
import {
  Megaphone, Plus, CalendarDays, CalendarPlus, Wand2, GitBranch, Repeat,
  TriangleAlert, ChevronRight, Clapperboard, Layers, Rocket, Radio,
  ArrowUpRight, DollarSign, MousePointerClick, Eye, Target, Sparkles,
  Activity, Flame, Hash,
} from "lucide-react";
import { D, ft, gf, mn } from "../../shared-constants";
import {
  STATUS_COLOR, STATUS_LABEL, channelOf, adPlatform, adPayload,
  AD_PLATFORMS, AD_OBJECTIVES,
  type Campaign, type MarketingEvent, type EventStatus, type CampaignStatus,
} from "../marketing-constants";
import type { ViewProps } from "../use-marketing";
import { useCreate } from "../create-context";

// ─── Static maps ───
const PIPELINE: { key: EventStatus; label: string }[] = [
  { key: "idea", label: "Idea" },
  { key: "draft", label: "Draft" },
  { key: "scheduled", label: "Scheduled" },
  { key: "live", label: "Live" },
  { key: "done", label: "Done" },
];
const CAMP_STATUS: Record<CampaignStatus, { label: string; color: string }> = {
  planning: { label: "Planned", color: D.violet },
  active: { label: "In Production", color: D.amber },
  wrapping: { label: "Wrapping", color: D.cyan },
  done: { label: "Wrapped", color: D.teal },
};
// Section ordering for the campaign grid: active first, then planning, then
// wrapping, then done — each its own labelled band.
const SECTIONS: { keys: CampaignStatus[]; label: string; color: string }[] = [
  { keys: ["active"], label: "Active", color: D.amber },
  { keys: ["planning"], label: "Planning", color: D.violet },
  { keys: ["wrapping", "done"], label: "Wrapping / Done", color: D.teal },
];
const FREQS = [
  { days: 7, label: "Weekly" },
  { days: 14, label: "Bi-weekly" },
  { days: 30, label: "Monthly" },
];
type Tab = "campaigns" | "ads" | "series";
const TABS: { v: Tab; label: string; Icon: typeof Megaphone }[] = [
  { v: "campaigns", label: "Campaigns", Icon: Megaphone },
  { v: "ads", label: "Ads", Icon: Clapperboard },
  { v: "series", label: "Series", Icon: Repeat },
];

// ─── Date helpers ───
const fmtShort = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fmtLong = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
function toDateInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}
function compact(n?: number): string {
  if (n == null || isNaN(n)) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + "k";
  return String(n);
}
const isAd = (e: MarketingEvent) => e.type === "ad";

export default function CampaignsView({ m, onOpenView }: ViewProps) {
  const { campaigns, events } = m;
  const { openCreate } = useCreate();

  const firstActive = campaigns.find((c) => c.status === "active") || campaigns[0];
  const [selectedId, setSelectedId] = useState<string | null>(firstActive?.id ?? null);
  const [tab, setTab] = useState<Tab>("campaigns");

  const featured = useMemo<Campaign | undefined>(
    () => campaigns.find((c) => c.id === selectedId) || firstActive,
    [campaigns, selectedId, firstActive],
  );

  const eventsFor = (id: string) => events.filter((e) => e.campaignId === id);
  const adsFor = (id: string) => events.filter((e) => e.campaignId === id && isAd(e));

  // Headline counts for the tab strip.
  const adCount = events.filter(isAd).length;
  const seriesCount = campaigns.reduce((n, c) => n + c.series.length, 0);

  function selectCampaign(id: string) {
    setSelectedId(id);
  }

  // ── + New campaign → open the full setup modal (name/type/dates/goal/tasks).
  function newCampaign() {
    setTab("campaigns");
    openCreate("campaign");
  }

  // ── + New ad → mint a type:'ad' event, then deep-link into the Ad Kiosk.
  function newAd(campaignId: string, platformKey = "meta") {
    const plat = adPlatform(platformKey);
    const ad = m.addEvent({
      type: "ad", status: "idea",
      title: `${plat.n} · new flight`,
      channel: platformKey, campaignId,
      source: "manual", start: new Date().toISOString(),
      payload: { platform: platformKey, objective: AD_OBJECTIVES[0], metrics: {} },
    });
    onOpenView?.("kiosk", ad.id);
  }

  return (
    <div style={page}>
      {/* ── Page head ── */}
      <div style={pheadRow}>
        <div>
          <h1 style={h1}>
            <Megaphone size={22} color={D.violet} style={{ verticalAlign: -4, marginRight: 8 }} />
            Campaigns
          </h1>
          <div style={sub}>
            The container that turns scattered dots into a story — campaigns, the ads that ride inside them, and recurring series.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button style={ghostBtn} onClick={() => featured && newAd(featured.id)}
            disabled={!featured}
            onMouseEnter={(e) => { if (featured) e.currentTarget.style.borderColor = D.crimson + "99"; }}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = D.border)}
          >
            <Clapperboard size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
            New ad
          </button>
          <button style={primaryBtn} onClick={newCampaign}
            onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.08)")}
            onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
          >
            <Plus size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
            New campaign
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={tabRow}>
        {TABS.map(({ v, label, Icon }) => {
          const on = v === tab;
          const n = v === "campaigns" ? campaigns.length : v === "ads" ? adCount : seriesCount;
          return (
            <button key={v} onClick={() => setTab(v)} style={{
              ...tabBtn,
              color: on ? D.tx : D.txm,
              borderColor: on ? D.violet + "88" : D.border,
              background: on ? "linear-gradient(135deg, rgba(144,92,203,.16), rgba(38,201,216,.06))" : "transparent",
            }}>
              <Icon size={13} color={on ? D.violet : D.txm} />
              {label}
              <span style={{ ...tabCount, color: on ? D.violet : D.txd, borderColor: on ? D.violet + "55" : D.border }}>{n}</span>
            </button>
          );
        })}
      </div>

      {/* ── Featured detail panel (shared across tabs) ── */}
      {featured && (
        <Feature
          campaign={featured}
          events={eventsFor(featured.id)}
          ads={adsFor(featured.id)}
          onNewAd={(plat) => newAd(featured.id, plat)}
          onOpenAd={(id) => onOpenView?.("kiosk", id)}
        />
      )}

      {/* ── Tab bodies ── */}
      {tab === "campaigns" && (
        <CampaignGrid
          campaigns={campaigns}
          eventsFor={eventsFor}
          featuredId={featured?.id}
          onSelect={selectCampaign}
        />
      )}

      {tab === "ads" && (
        <AdsTab
          campaigns={campaigns}
          events={events}
          onNewAd={newAd}
          onOpenAd={(id) => onOpenView?.("kiosk", id)}
          onOpenKiosk={() => onOpenView?.("kiosk")}
        />
      )}

      {tab === "series" && (
        <div style={{ marginTop: 4 }}>
          <SeriesScheduler m={m} campaign={featured} />
          <SeriesTracker campaigns={campaigns} events={events} onSelect={selectCampaign} />
        </div>
      )}
    </div>
  );
}

/* ══════════════ Featured campaign panel ══════════════ */
function Feature({ campaign, events, ads, onNewAd, onOpenAd }: {
  campaign: Campaign; events: MarketingEvent[]; ads: MarketingEvent[];
  onNewAd: (platform?: string) => void; onOpenAd: (id: string) => void;
}) {
  const st = CAMP_STATUS[campaign.status];
  const counts = useMemo(() => {
    const c: Record<string, number> = { idea: 0, draft: 0, scheduled: 0, live: 0, done: 0, blocked: 0 };
    events.forEach((e) => { c[e.status] = (c[e.status] || 0) + 1; });
    return c;
  }, [events]);

  const curIdx = useMemo(() => {
    let idx = 0;
    PIPELINE.forEach((s, i) => { if ((counts[s.key] || 0) > 0) idx = i; });
    return idx;
  }, [counts]);

  const total = events.length || 1;
  const advanced = (counts.live || 0) + (counts.done || 0);
  const pct = Math.round((advanced / total) * 100);
  const nextItem = events.find((e) => e.status === "scheduled" || e.status === "draft" || e.status === "idea");

  // Aggregate spend across this campaign's ads.
  const spend = ads.reduce((s, a) => s + (adPayload(a).metrics?.spend || 0), 0);
  const liveAds = ads.filter((a) => a.status === "live").length;
  const nonAdItems = events.filter((e) => !isAd(e));

  return (
    <div style={featureWrap}>
      <div style={{ position: "absolute", inset: "0 0 auto 0", height: 3, background: `linear-gradient(90deg, ${campaign.color}, ${campaign.color}33)` }} />
      {/* left */}
      <div style={{ padding: "26px 26px 24px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ ...statusPill, color: st.color, borderColor: st.color + "66" }}>
            {st.label.toUpperCase()}
          </span>
          <span style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>
            {campaign.end ? `wraps ${fmtLong(campaign.end)}` : campaign.start ? `started ${fmtLong(campaign.start)}` : "no dates set"}
          </span>
        </div>
        <h2 style={{ fontFamily: gf, fontSize: 29, letterSpacing: -0.7, margin: "12px 0 6px", color: D.tx }}>
          {campaign.name}
        </h2>
        <p style={{ color: D.txm, fontSize: 14, lineHeight: 1.55, margin: "0 0 4px", maxWidth: 560 }}>
          {campaign.goal || "No brief yet — describe the objective so the scattered dots read as one story."}
        </p>

        {/* stat row */}
        <div style={{ display: "flex", gap: 22, flexWrap: "wrap", margin: "18px 0 4px" }}>
          <Stat label="ITEMS" value={String(events.length)} Icon={Layers} color={D.tx} />
          <Stat label="ADS" value={`${ads.length}${liveAds ? ` · ${liveAds} live` : ""}`} Icon={Clapperboard} color={ads.length ? D.crimson : D.txm} />
          <Stat label="SERIES" value={String(campaign.series.length)} Icon={Repeat} color={campaign.series.length ? D.cyan : D.txm} />
          <Stat label="AD SPEND" value={spend ? `$${compact(spend)}` : "—"} Icon={DollarSign} color={spend ? D.teal : D.txm} />
        </div>

        {/* pipeline */}
        <div style={{ display: "flex", gap: 4, margin: "18px 0 6px" }}>
          {PIPELINE.map((s, i) => {
            const isCur = i === curIdx;
            const isDone = i < curIdx;
            const c = isCur ? D.amber : isDone ? D.teal : D.border;
            return (
              <div key={s.key} style={{ flex: 1, textAlign: "center", position: "relative", paddingTop: 10 }}>
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: 3, borderRadius: 2,
                  background: isCur || isDone ? c : D.border,
                  boxShadow: isCur ? `0 0 10px ${D.amber}` : "none",
                }} />
                <div style={{ fontFamily: mn, fontSize: 9, letterSpacing: 0.3, color: isCur ? D.amber : isDone ? D.teal : D.txd }}>
                  {s.label}
                </div>
                <div style={{ fontFamily: mn, fontSize: 11, color: isCur ? D.amber : D.txm, marginTop: 2, fontWeight: 600 }}>
                  {counts[s.key] || 0}
                </div>
              </div>
            );
          })}
        </div>

        {/* mini-gantt */}
        <div style={{ fontFamily: mn, fontSize: 9, letterSpacing: 1, color: D.txd, margin: "18px 0 4px" }}>TIMELINE</div>
        <MiniGantt events={events} campaign={campaign} />

        {/* rollout */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18 }}>
          <span style={{ fontFamily: mn, fontSize: 9, letterSpacing: 1, color: D.txd }}>ROLLOUT</span>
          <div style={{ ...trackOuter, flex: 1, margin: 0 }}>
            <div style={{ height: "100%", width: `${pct}%`, borderRadius: 6, background: `linear-gradient(90deg, ${D.amber}, ${D.coral})`, transition: "width .5s cubic-bezier(.2,.8,.2,1)" }} />
          </div>
          <span style={{ fontFamily: mn, fontSize: 11, color: D.txm }}>{pct}%</span>
        </div>
        <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, marginTop: 6 }}>
          {nextItem ? `next: ${nextItem.title}` : "all shipped"}
        </div>
      </div>

      {/* right: items + linked ads */}
      <div style={featureRight}>
        {/* items */}
        <div style={railHead}>
          <Layers size={11} color={D.txd} /> ITEMS · {nonAdItems.length}
        </div>
        <div style={{ maxHeight: 150, overflow: "auto", margin: "0 -2px 4px" }}>
          {nonAdItems.length === 0 && (
            <div style={{ color: D.txd, fontFamily: mn, fontSize: 11, padding: "8px 2px" }}>
              No items yet — add a series.
            </div>
          )}
          {nonAdItems.slice(0, 9).map((e) => {
            const ch = channelOf(e.channel);
            return (
              <div key={e.id} style={itemBar}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: STATUS_COLOR[e.status], flex: "none" }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</span>
                {e.channel && (
                  <span style={{ ...chPill, color: ch.c, borderColor: ch.c + "55" }}>{ch.s}</span>
                )}
                <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 9, color: STATUS_COLOR[e.status], paddingLeft: 8 }}>
                  {STATUS_LABEL[e.status]}
                </span>
              </div>
            );
          })}
        </div>

        {/* linked ads */}
        <div style={{ ...railHead, marginTop: 16, justifyContent: "space-between" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Clapperboard size={11} color={D.crimson} /> ADS · {ads.length}
          </span>
          <button style={miniAddBtn} onClick={() => onNewAd()}
            onMouseEnter={(e) => (e.currentTarget.style.color = D.tx)}
            onMouseLeave={(e) => (e.currentTarget.style.color = D.crimson)}
          >
            <Plus size={10} style={{ verticalAlign: -1 }} /> new
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {ads.length === 0 && (
            <div style={{ color: D.txd, fontFamily: mn, fontSize: 11, padding: "6px 2px" }}>
              No ads — launch a flight into the Kiosk.
            </div>
          )}
          {ads.slice(0, 4).map((a) => (
            <AdRow key={a.id} ad={a} onOpen={() => onOpenAd(a.id)} />
          ))}
        </div>

        {/* series chips */}
        {campaign.series.length > 0 && (
          <>
            <div style={{ ...railHead, marginTop: 16 }}>
              <Repeat size={11} color={D.cyan} /> SERIES · {campaign.series.length}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {campaign.series.map((s) => (
                <span key={s.id} style={seriesChip}>
                  {s.name} · {s.count}× / {s.frequencyDays}d
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ══════════════ Compact ad row (rail + ads tab) ══════════════ */
function AdRow({ ad, onOpen }: { ad: MarketingEvent; onOpen: () => void }) {
  const p = adPayload(ad);
  const plat = adPlatform(p.platform || ad.channel);
  const mt = p.metrics || {};
  return (
    <button onClick={onOpen} style={adRow}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = plat.c + "77"; e.currentTarget.style.background = "rgba(255,255,255,0.025)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = D.border; e.currentTarget.style.background = D.card; }}
    >
      <span style={{ ...platDot, background: plat.c }} />
      <span style={{ fontFamily: mn, fontSize: 9, color: plat.c, flex: "none", width: 34 }}>{plat.s}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, color: D.tx, flex: 1, textAlign: "left" }}>
        {(p.headline || ad.title).replace(/^.*· /, "")}
      </span>
      <span style={{ fontFamily: mn, fontSize: 9, color: STATUS_COLOR[ad.status], flex: "none" }}>
        {STATUS_LABEL[ad.status]}
      </span>
      <span style={{ fontFamily: mn, fontSize: 9, color: D.txm, flex: "none", minWidth: 40, textAlign: "right" }}>
        {mt.spend ? `$${compact(mt.spend)}` : "—"}
      </span>
      <ArrowUpRight size={12} color={D.txd} style={{ flex: "none" }} />
    </button>
  );
}

/* ══════════════ Ads tab — flights grouped by campaign ══════════════ */
function AdsTab({ campaigns, events, onNewAd, onOpenAd, onOpenKiosk }: {
  campaigns: Campaign[]; events: MarketingEvent[];
  onNewAd: (campaignId: string, platform?: string) => void;
  onOpenAd: (id: string) => void; onOpenKiosk: () => void;
}) {
  const ads = events.filter(isAd);
  const totals = useMemo(() => {
    let spend = 0, impr = 0, clicks = 0, conv = 0, live = 0;
    ads.forEach((a) => {
      const mt = adPayload(a).metrics || {};
      spend += mt.spend || 0; impr += mt.impressions || 0;
      clicks += mt.clicks || 0; conv += mt.conversions || 0;
      if (a.status === "live") live += 1;
    });
    return { spend, impr, clicks, conv, live };
  }, [ads]);

  return (
    <div style={{ marginTop: 4 }}>
      {/* portfolio summary */}
      <div style={adSummary}>
        <SumCell label="LIVE FLIGHTS" value={`${totals.live} / ${ads.length}`} Icon={Radio} color={D.crimson} />
        <SumCell label="SPEND" value={`$${compact(totals.spend)}`} Icon={DollarSign} color={D.teal} />
        <SumCell label="IMPRESSIONS" value={compact(totals.impr)} Icon={Eye} color={D.blue} />
        <SumCell label="CLICKS" value={compact(totals.clicks)} Icon={MousePointerClick} color={D.amber} />
        <SumCell label="CONVERSIONS" value={compact(totals.conv)} Icon={Target} color={D.violet} />
        <button style={{ ...primaryBtn, marginLeft: "auto", alignSelf: "center", background: `linear-gradient(135deg, ${D.crimson}, ${D.coral})`, color: D.tx }}
          onClick={onOpenKiosk}
          onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.1)")}
          onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
        >
          <Clapperboard size={13} style={{ verticalAlign: -2, marginRight: 5 }} /> Ad Kiosk
        </button>
      </div>

      {campaigns.map((c) => {
        const camps = events.filter((e) => e.campaignId === c.id && isAd(e));
        return (
          <div key={c.id} style={{ marginTop: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: c.color, flex: "none" }} />
              <span style={{ fontFamily: gf, fontSize: 16, color: D.tx }}>{c.name}</span>
              <span style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>{camps.length} ad{camps.length === 1 ? "" : "s"}</span>
              <button style={{ ...miniAddBtn, marginLeft: "auto" }} onClick={() => onNewAd(c.id)}
                onMouseEnter={(e) => (e.currentTarget.style.color = D.tx)}
                onMouseLeave={(e) => (e.currentTarget.style.color = D.crimson)}
              >
                <Plus size={11} style={{ verticalAlign: -2 }} /> New ad
              </button>
            </div>
            {camps.length === 0 ? (
              <div style={{ color: D.txd, fontFamily: mn, fontSize: 11, padding: "0 0 4px 18px" }}>
                No ad flights in this campaign yet.
              </div>
            ) : (
              <div style={adGrid}>
                {camps.map((a) => <AdCard key={a.id} ad={a} onOpen={() => onOpenAd(a.id)} />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════ Full ad card (ads tab) ══════════════ */
function AdCard({ ad, onOpen }: { ad: MarketingEvent; onOpen: () => void }) {
  const p = adPayload(ad);
  const plat = adPlatform(p.platform || ad.channel);
  const mt = p.metrics || {};
  const sc = STATUS_COLOR[ad.status];
  const live = ad.status === "live";
  const metricCells: { label: string; value: string; Icon: typeof Eye }[] = [
    { label: "spend", value: mt.spend ? `$${compact(mt.spend)}` : "—", Icon: DollarSign },
    { label: "impr", value: compact(mt.impressions), Icon: Eye },
    { label: "ctr", value: mt.ctr != null ? `${mt.ctr.toFixed(2)}%` : "—", Icon: MousePointerClick },
    { label: "conv", value: mt.conversions != null ? compact(mt.conversions) : "—", Icon: Target },
  ];
  return (
    <div style={adCardWrap} onClick={onOpen}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = plat.c + "66"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = D.border; e.currentTarget.style.transform = "none"; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ ...platDot, background: plat.c }} />
        <span style={{ fontFamily: mn, fontSize: 10, color: plat.c, letterSpacing: 0.5 }}>{plat.n}</span>
        {live && <Flame size={12} color={D.crimson} style={{ marginLeft: -1 }} />}
        <span style={{ marginLeft: "auto", ...statusPill, color: sc, borderColor: sc + "66" }}>{STATUS_LABEL[ad.status].toUpperCase()}</span>
      </div>
      <div style={{ fontSize: 14, color: D.tx, fontWeight: 500, margin: "11px 0 3px", lineHeight: 1.35 }}>
        {p.headline || ad.title.replace(/^.*· /, "")}
      </div>
      <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, display: "flex", gap: 7, flexWrap: "wrap" }}>
        <span>{p.objective || "—"}</span>
        {p.budget ? <span>· ${p.budget}/{p.budgetType === "lifetime" ? "life" : "day"}</span> : null}
      </div>
      <div style={adMetricRow}>
        {metricCells.map((c) => (
          <div key={c.label} style={{ textAlign: "center" }}>
            <div style={{ fontFamily: mn, fontSize: 13, color: c.value === "—" ? D.txd : D.tx, fontWeight: 600 }}>{c.value}</div>
            <div style={{ fontFamily: mn, fontSize: 8, letterSpacing: 0.5, color: D.txd, textTransform: "uppercase", marginTop: 2 }}>{c.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 12, fontFamily: mn, fontSize: 10, color: plat.c }}>
        Open in Kiosk <ArrowUpRight size={12} />
      </div>
    </div>
  );
}

/* ══════════════ Campaign grid (campaigns tab) — status-sectioned ══════════════ */
function CampaignGrid({ campaigns, eventsFor, featuredId, onSelect }: {
  campaigns: Campaign[]; eventsFor: (id: string) => MarketingEvent[];
  featuredId?: string; onSelect: (id: string) => void;
}) {
  return (
    <div style={{ marginTop: 6 }}>
      {SECTIONS.map((sec) => {
        const list = campaigns.filter((c) => sec.keys.includes(c.status));
        if (list.length === 0) return null;
        return (
          <div key={sec.label} style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, margin: "0 0 12px" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: sec.color, boxShadow: `0 0 8px ${sec.color}` }} />
              <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: D.txm }}>
                {sec.label}
              </span>
              <span style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>{list.length}</span>
              <div style={{ flex: 1, height: 1, background: D.border, marginLeft: 4 }} />
            </div>
            <div style={campsGrid}>
              {list.map((c) => (
                <CampCard key={c.id} campaign={c} events={eventsFor(c.id)}
                  active={featuredId === c.id} onSelect={() => onSelect(c.id)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════ Mini-gantt of a campaign's events ══════════════ */
function MiniGantt({ events, campaign }: { events: MarketingEvent[]; campaign: Campaign }) {
  const dated = useMemo(
    () => events.filter((e) => e.start).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()),
    [events],
  );
  const span = useMemo(() => {
    const ts = dated.map((e) => new Date(e.start).getTime());
    if (campaign.start) ts.push(new Date(campaign.start).getTime());
    if (campaign.end) ts.push(new Date(campaign.end).getTime());
    if (ts.length === 0) { const n = Date.now(); return { min: n, max: n + 1 }; }
    const min = Math.min(...ts);
    const max = Math.max(...ts, min + 1);
    return { min, max };
  }, [dated, campaign]);

  const range = span.max - span.min || 1;
  const xOf = (iso: string) => ((new Date(iso).getTime() - span.min) / range) * 100;
  const nowX = ((Date.now() - span.min) / range) * 100;

  return (
    <div style={ganttWrap}>
      {[25, 50, 75].map((l) => (
        <div key={l} style={{ position: "absolute", top: 0, bottom: 0, left: `${l}%`, width: 1, background: "rgba(255,255,255,0.04)" }} />
      ))}
      {nowX >= 0 && nowX <= 100 && (
        <div style={{ position: "absolute", top: 0, bottom: 0, left: `${nowX}%`, width: 2, background: `linear-gradient(180deg, ${D.cyan}, rgba(38,201,216,0))`, boxShadow: `0 0 10px ${D.cyan}`, zIndex: 4 }} />
      )}
      {dated.slice(0, 16).map((e, i) => {
        const left = Math.max(0, Math.min(98, xOf(e.start)));
        const hasEnd = e.end && new Date(e.end).getTime() > new Date(e.start).getTime();
        const w = hasEnd ? Math.max(4, Math.min(100 - left, xOf(e.end!) - left)) : 0;
        const color = isAd(e) ? D.crimson : STATUS_COLOR[e.status];
        const top = 8 + (i % 3) * 12;
        if (hasEnd) {
          return (
            <div key={e.id} title={`${e.title} · ${fmtShort(e.start)}`} style={{
              position: "absolute", left: `${left}%`, width: `${w}%`, top, height: 8,
              borderRadius: 5, background: `linear-gradient(90deg, ${color}, ${color}99)`,
            }} />
          );
        }
        return (
          <div key={e.id} title={`${e.title} · ${fmtShort(e.start)}`} style={{
            position: "absolute", left: `${left}%`, top, width: 8, height: 8,
            marginLeft: -4, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}aa`,
          }} />
        );
      })}
    </div>
  );
}

/* ══════════════ Series scheduler ══════════════ */
function SeriesScheduler({ m, campaign }: { m: ViewProps["m"]; campaign?: Campaign }) {
  const [name, setName] = useState("The Capex Reckoning");
  const [freq, setFreq] = useState(7);
  const [date, setDate] = useState(() => toDateInput(new Date(Date.now() + 8 * 86400000).toISOString()));
  const [count, setCount] = useState(5);
  const [channel, setChannel] = useState("youtube");
  const [lastSeriesId, setLastSeriesId] = useState<string | null>(null);

  const releaseEvents = useMemo(() => {
    if (!campaign || !lastSeriesId) return [];
    return m.events
      .filter((e) => e.campaignId === campaign.id && (e.payload as { series?: string } | undefined)?.series === lastSeriesId)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [m.events, campaign, lastSeriesId]);

  const preview = useMemo(() => {
    const base = new Date(date + "T12:00:00");
    if (isNaN(base.getTime())) return [];
    const n = Math.max(1, Math.min(16, count || 1));
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + freq * i);
      return d.toISOString();
    });
  }, [date, freq, count]);

  const chips = releaseEvents.length
    ? releaseEvents.map((e) => ({ iso: e.start, locked: true }))
    : preview.map((iso) => ({ iso, locked: false }));

  const disabled = !campaign;

  function project() {
    if (!campaign) return;
    const base = new Date(date + "T12:00:00");
    if (isNaN(base.getTime())) return;
    const id = "s-" + Date.now().toString(36);
    m.addSeries(campaign.id, {
      id,
      name: name.trim() || "Series",
      frequencyDays: freq,
      firstRelease: base.toISOString(),
      count: Math.max(1, Math.min(16, count || 1)),
      channel,
    });
    setLastSeriesId(id);
  }

  const epLabel = (name.trim() || "Ep").split(" ")[0];
  const lastChip = chips[chips.length - 1];

  return (
    <div style={seriesWrap}>
      <p style={{ fontFamily: mn, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: D.cyan, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 7 }}>
        <CalendarPlus size={12} /> Series scheduler
      </p>
      <div style={{ color: D.txm, fontSize: 13, marginBottom: 14 }}>
        Designate a cadence + first release. Projecting locks the dates into{" "}
        <b style={{ color: campaign?.color || D.tx, fontWeight: 600 }}>{campaign?.name || "a campaign"}</b>{" "}
        — they show up on the calendar &amp; launch rollouts.
      </div>

      <div style={seriesForm}>
        <Field label="Series name">
          <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Series name" />
        </Field>
        <Field label="Frequency">
          <div style={{ display: "flex", gap: 4 }}>
            {FREQS.map((f) => {
              const on = freq === f.days;
              return (
                <button key={f.days} onClick={() => setFreq(f.days)} title={f.label}
                  style={{
                    flex: 1, fontFamily: mn, fontSize: 11, padding: "9px 0", borderRadius: 8, cursor: "pointer",
                    border: `1px solid ${on ? D.cyan + "77" : D.border}`,
                    background: on ? "rgba(38,201,216,0.1)" : "transparent",
                    color: on ? D.cyan : D.txm, transition: "all .16s",
                  }}
                >
                  {f.days}d
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="First release">
          <input style={input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Channel">
          <select style={input} value={channel} onChange={(e) => setChannel(e.target.value)}>
            {["youtube", "tiktok", "instagram", "x", "linkedin", "facebook"].map((k) => (
              <option key={k} value={k}>{channelOf(k).n}</option>
            ))}
          </select>
        </Field>
        <Field label="Count">
          <input style={input} type="number" min={1} max={16} value={count}
            onChange={(e) => setCount(parseInt(e.target.value, 10) || 1)} />
        </Field>
        <button onClick={project} disabled={disabled}
          style={{ ...primaryBtn, height: 38, background: `linear-gradient(135deg, ${D.cyan}, ${D.blue})`, color: "#06121a", opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
          onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.filter = "brightness(1.08)"; }}
          onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
        >
          <Wand2 size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
          {releaseEvents.length ? "Re-project" : "Project"}
        </button>
      </div>

      {/* generated / projected release chips */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
        {chips.map((c, i) => (
          <div key={c.iso + i} style={{
            display: "inline-flex", flexDirection: "column", gap: 2, minWidth: 92,
            border: `1px solid ${i === 0 ? D.amber + "66" : c.locked ? D.teal + "44" : D.border}`,
            background: i === 0 ? "rgba(247,176,65,0.06)" : D.card,
            borderRadius: 10, padding: "9px 13px",
          }}>
            <span style={{ fontFamily: gf, fontSize: 14, color: D.tx }}>
              {epLabel} {i + 1}
            </span>
            <span style={{ fontFamily: mn, fontSize: 10, color: c.locked ? D.teal : D.cyan }}>
              {fmtShort(c.iso)}
            </span>
          </div>
        ))}
      </div>

      <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, marginTop: 12, display: "flex", alignItems: "center", gap: 6 }}>
        <GitBranch size={11} />
        {releaseEvents.length ? (
          <span>
            Locked into <b style={{ color: D.tx, fontWeight: 600 }}>{campaign?.name}</b> — {releaseEvents.length} releases now on the calendar, last on {lastChip ? fmtShort(lastChip.iso) : "—"}.
          </span>
        ) : (
          <span>
            {campaign
              ? `Preview cadence — ${chips.length} releases through ${lastChip ? fmtShort(lastChip.iso) : "—"}. Hit Project to lock them in.`
              : "Select a campaign to project a series into it."}
          </span>
        )}
      </div>
    </div>
  );
}

/* ══════════════ Series tracker (series tab) ══════════════ */
function SeriesTracker({ campaigns, events, onSelect }: {
  campaigns: Campaign[]; events: MarketingEvent[]; onSelect: (id: string) => void;
}) {
  const rows = campaigns.flatMap((c) => c.series.map((s) => ({ c, s })));
  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: D.txm, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 7 }}>
        <Activity size={12} color={D.cyan} /> All series · {rows.length}
      </div>
      {rows.length === 0 ? (
        <div style={{ color: D.txd, fontFamily: mn, fontSize: 12, padding: "8px 2px" }}>
          No series yet — project one above to start a recurring cadence.
        </div>
      ) : (
        <div style={campsGrid}>
          {rows.map(({ c, s }) => {
            const ev = events.filter((e) => e.campaignId === c.id && (e.payload as { series?: string } | undefined)?.series === s.id);
            const shipped = ev.filter((e) => e.status === "live" || e.status === "done").length;
            const pct = Math.round((shipped / (s.count || 1)) * 100);
            const ch = channelOf(s.channel);
            const next = ev.filter((e) => new Date(e.start).getTime() >= Date.now())
              .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0];
            return (
              <div key={s.id} style={seriesCard} onClick={() => onSelect(c.id)}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = D.cyan + "66"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = D.border; e.currentTarget.style.transform = "none"; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Repeat size={13} color={D.cyan} />
                  <span style={{ fontFamily: gf, fontSize: 16, color: D.tx }}>{s.name}</span>
                  <span style={{ marginLeft: "auto", ...chPill, color: ch.c, borderColor: ch.c + "55" }}>{ch.s}</span>
                </div>
                <div style={{ fontFamily: mn, fontSize: 10, color: D.txm, margin: "8px 0 2px", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.color }} /> {c.name}
                </div>
                <div style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>
                  {s.count}× · every {s.frequencyDays}d · from {fmtShort(s.firstRelease)}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, fontFamily: mn, fontSize: 10, color: D.txd }}>
                  <span>{shipped}/{s.count}</span>
                  <div style={{ ...trackOuter, flex: 1, margin: 0 }}>
                    <div style={{ height: "100%", width: `${pct}%`, borderRadius: 6, background: `linear-gradient(90deg, ${D.cyan}, ${D.teal})` }} />
                  </div>
                  <span style={{ color: D.txm }}>{pct}%</span>
                </div>
                <div style={{ fontFamily: mn, fontSize: 10, color: next ? D.cyan : D.txd, marginTop: 8 }}>
                  {next ? `next drop ${fmtShort(next.start)}` : "all dropped"}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════ Campaign card (grid) ══════════════ */
function CampCard({ campaign, events, active, onSelect }: {
  campaign: Campaign; events: MarketingEvent[]; active: boolean; onSelect: () => void;
}) {
  const st = CAMP_STATUS[campaign.status];
  const total = events.length || 1;
  const advanced = events.filter((e) => e.status === "live" || e.status === "done").length;
  const pct = Math.round((advanced / total) * 100);
  const isSeries = campaign.series.length > 0;
  const adCount = events.filter(isAd).length;
  const range = campaign.start && campaign.end
    ? `${fmtShort(campaign.start)} → ${fmtShort(campaign.end)}`
    : campaign.start ? `from ${fmtShort(campaign.start)}` : "no dates set";

  const channels = Array.from(new Set(events.map((e) => e.channel).filter(Boolean))) as string[];
  const stale = isSeries && events.length === 0;

  return (
    <div onClick={onSelect}
      style={{
        ...campCard,
        borderColor: active ? campaign.color + "88" : D.border,
        boxShadow: active ? `0 0 0 1px ${campaign.color}55, 0 18px 40px -24px rgba(0,0,0,.8)` : "none",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)";
        e.currentTarget.style.transform = "translateY(-3px)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.borderColor = D.border;
        e.currentTarget.style.transform = "none";
      }}
    >
      <div style={{ position: "absolute", inset: "0 0 auto 0", height: 3, background: `linear-gradient(90deg, ${campaign.color}, ${campaign.color}55)`, opacity: 0.95 }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ ...statusPill, color: st.color, borderColor: st.color + "66" }}>{st.label.toUpperCase()}</span>
        <span style={{ fontFamily: mn, fontSize: 10, color: D.txd, display: "flex", alignItems: "center", gap: 8 }}>
          {adCount > 0 && (
            <span style={{ color: D.crimson, display: "inline-flex", alignItems: "center", gap: 3 }}>
              <Clapperboard size={10} /> {adCount}
            </span>
          )}
          {isSeries ? `series · ${campaign.series.length}` : `${events.length} item${events.length === 1 ? "" : "s"}`}
        </span>
      </div>
      <h2 style={{ fontFamily: gf, fontSize: 20, margin: "10px 0 5px", letterSpacing: -0.3, color: D.tx }}>{campaign.name}</h2>
      <div style={{ fontFamily: mn, fontSize: 10, color: D.txm, display: "flex", alignItems: "center", gap: 5 }}>
        {isSeries ? <Repeat size={11} /> : <CalendarDays size={11} />} {range}
      </div>
      <div style={{ color: D.txm, fontSize: 13, lineHeight: 1.5, margin: "12px 0" }}>
        {campaign.goal || "No brief yet."}
      </div>

      {channels.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {channels.slice(0, 5).map((k) => {
            const ch = channelOf(k);
            return (
              <span key={k} style={{ ...chPill, color: ch.c, borderColor: ch.c + "55", display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: ch.c }} /> {ch.s}
              </span>
            );
          })}
        </div>
      )}

      {stale ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontFamily: mn, fontSize: 10, color: D.coral }}>
          <TriangleAlert size={12} /> stale · dates not locked yet
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, fontFamily: mn, fontSize: 10, color: D.txd }}>
          <span>rollout</span>
          <div style={{ ...trackOuter, flex: 1, margin: 0 }}>
            <div style={{ height: "100%", width: `${pct}%`, borderRadius: 6, background: `linear-gradient(90deg, ${D.teal}, ${D.cyan})` }} />
          </div>
          <span style={{ color: D.txm }}>{pct}%</span>
          <ChevronRight size={13} color={D.txd} />
        </div>
      )}
    </div>
  );
}

/* ══════════════ Small shared pieces ══════════════ */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontFamily: mn, fontSize: 9, letterSpacing: 1, color: D.txd, textTransform: "uppercase", marginBottom: 5 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Stat({ label, value, Icon, color }: { label: string; value: string; Icon: typeof Layers; color: string }) {
  return (
    <div>
      <div style={{ fontFamily: mn, fontSize: 9, letterSpacing: 1, color: D.txd, display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
        <Icon size={10} color={color} /> {label}
      </div>
      <div style={{ fontFamily: gf, fontSize: 17, color, letterSpacing: -0.2 }}>{value}</div>
    </div>
  );
}

function SumCell({ label, value, Icon, color }: { label: string; value: string; Icon: typeof Eye; color: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: mn, fontSize: 9, letterSpacing: 1, color: D.txd, display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
        <Icon size={11} color={color} /> {label}
      </div>
      <div style={{ fontFamily: gf, fontSize: 22, color: D.tx, letterSpacing: -0.4 }}>{value}</div>
    </div>
  );
}

/* ══════════════ Style objects ══════════════ */
const page: React.CSSProperties = { padding: "22px 26px 48px", fontFamily: ft, width: "100%" };
const pheadRow: React.CSSProperties = { display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 16, flexWrap: "wrap" };
const h1: React.CSSProperties = { fontFamily: gf, fontWeight: 700, fontSize: 30, letterSpacing: -0.8, margin: 0, color: D.tx };
const sub: React.CSSProperties = { color: D.txm, fontSize: 13, marginTop: 3, maxWidth: 620 };
const tabRow: React.CSSProperties = { display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" };
const tabBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 7, fontFamily: mn, fontSize: 12, letterSpacing: 0.3,
  padding: "8px 14px", borderRadius: 10, border: `1px solid ${D.border}`, cursor: "pointer", transition: "all .16s",
};
const tabCount: React.CSSProperties = {
  fontFamily: mn, fontSize: 10, padding: "1px 7px", borderRadius: 999, border: "1px solid currentColor",
};
const primaryBtn: React.CSSProperties = {
  fontFamily: mn, fontSize: 11, letterSpacing: 0.5, borderRadius: 9, padding: "9px 14px", cursor: "pointer",
  border: "none", background: `linear-gradient(135deg, ${D.amber}, #d88f2c)`, color: "#1a1206", fontWeight: 700,
  transition: "filter .16s",
};
const ghostBtn: React.CSSProperties = {
  fontFamily: mn, fontSize: 11, letterSpacing: 0.5, borderRadius: 9, padding: "9px 14px", cursor: "pointer",
  border: `1px solid ${D.border}`, background: "transparent", color: D.txm, transition: "border-color .16s",
};
const miniAddBtn: React.CSSProperties = {
  fontFamily: mn, fontSize: 10, letterSpacing: 0.3, color: D.crimson, background: "transparent",
  border: "none", cursor: "pointer", padding: 0, transition: "color .15s",
};
const statusPill: React.CSSProperties = {
  fontFamily: mn, fontSize: 9, letterSpacing: 1, padding: "3px 9px", borderRadius: 999, border: "1px solid currentColor",
};
const chPill: React.CSSProperties = {
  fontFamily: mn, fontSize: 9, letterSpacing: 0.5, padding: "2px 7px", borderRadius: 6, border: "1px solid currentColor",
};
const featureWrap: React.CSSProperties = {
  position: "relative", border: `1px solid ${D.border}`, borderRadius: 20, overflow: "hidden",
  background: "linear-gradient(135deg, #0c0c14, #0e0e17)", marginBottom: 22,
  display: "grid", gridTemplateColumns: "minmax(0, 1.55fr) minmax(280px, 1fr)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.04), 0 20px 50px -28px rgba(0,0,0,.8)",
};
const featureRight: React.CSSProperties = {
  borderLeft: `1px solid ${D.border}`, padding: "26px 22px", background: "rgba(255,255,255,0.014)", minWidth: 0,
};
const railHead: React.CSSProperties = {
  fontFamily: mn, fontSize: 9, letterSpacing: 1, color: D.txd, marginBottom: 9,
  display: "flex", alignItems: "center", gap: 6,
};
const itemBar: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, padding: "8px 2px",
  borderBottom: `1px solid ${D.border}`, fontSize: 12.5, color: D.tx,
};
const adRow: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left",
  padding: "8px 10px", borderRadius: 9, border: `1px solid ${D.border}`, background: D.card,
  cursor: "pointer", transition: "border-color .15s, background .15s",
};
const platDot: React.CSSProperties = { width: 8, height: 8, borderRadius: "50%", flex: "none" };
const trackOuter: React.CSSProperties = {
  height: 7, borderRadius: 6, background: "rgba(255,255,255,0.06)", overflow: "hidden", margin: "5px 0",
};
const ganttWrap: React.CSSProperties = {
  position: "relative", height: 50, border: `1px solid ${D.border}`, borderRadius: 10,
  background: "#0a0a10", overflow: "hidden", marginTop: 6,
};
const seriesWrap: React.CSSProperties = {
  border: `1px solid ${D.cyan}40`, borderRadius: 18, padding: 20, marginBottom: 4,
  background: "linear-gradient(150deg, rgba(38,201,216,.06), rgba(144,92,203,.03))",
};
const seriesForm: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "minmax(160px, 1.5fr) 1.1fr 1fr 1fr .7fr auto", gap: 10, alignItems: "end",
};
const input: React.CSSProperties = {
  width: "100%", background: D.surface, border: `1px solid ${D.border}`, borderRadius: 9,
  padding: "9px 11px", color: D.tx, fontFamily: ft, fontSize: 13, outline: "none",
};
const campsGrid: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 16,
};
const campCard: React.CSSProperties = {
  position: "relative", border: `1px solid ${D.border}`, borderRadius: 16, padding: 18, overflow: "hidden",
  background: "linear-gradient(150deg, #0b0b12, #0d0d15)", transition: "transform .18s, border-color .18s, box-shadow .18s",
};
const adSummary: React.CSSProperties = {
  display: "flex", gap: 28, flexWrap: "wrap", alignItems: "center",
  border: `1px solid ${D.border}`, borderRadius: 16, padding: "18px 22px",
  background: "linear-gradient(135deg, rgba(209,51,74,.05), rgba(224,99,71,.02))",
};
const adGrid: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14,
};
const adCardWrap: React.CSSProperties = {
  border: `1px solid ${D.border}`, borderRadius: 14, padding: 16, cursor: "pointer",
  background: "linear-gradient(150deg, #0b0b12, #0d0d15)", transition: "transform .16s, border-color .16s",
};
const adMetricRow: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 14,
  paddingTop: 12, borderTop: `1px solid ${D.border}`,
};
const seriesChip: React.CSSProperties = {
  fontFamily: mn, fontSize: 9.5, color: D.cyan, padding: "4px 9px", borderRadius: 8,
  border: `1px solid ${D.cyan}44`, background: "rgba(38,201,216,0.05)",
};
const seriesCard: React.CSSProperties = {
  border: `1px solid ${D.border}`, borderRadius: 16, padding: 18, cursor: "pointer",
  background: "linear-gradient(150deg, #0b0b12, #0d0d15)", transition: "transform .18s, border-color .18s",
};
