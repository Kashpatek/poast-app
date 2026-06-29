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
  TriangleAlert, ChevronRight, ChevronDown, Clapperboard, Layers, Rocket, Radio,
  ArrowUpRight, DollarSign, MousePointerClick, Eye, Target, Sparkles,
  Activity, Flame, Hash, Pencil, Trash2, Mic, ListChecks, MessageSquare, Flag,
} from "lucide-react";
import { D, ft, gf, mn } from "../../shared-constants";
import {
  STATUS_COLOR, STATUS_LABEL, channelOf, adPlatform, adPayload,
  AD_PLATFORMS, AD_OBJECTIVES, campaignCategory,
  eventSeries, eventRollout, eventStage, eventRelease, eventEpisodeNo,
  eventPhase, eventProjectName, PODCAST_LIFECYCLE, BUILD_STAGES, SA_FREQUENT_GUESTS, episodeTitles,
  type Campaign, type MarketingEvent, type EventStatus, type CampaignStatus,
  type SeriesDef, type BoardTaskLite,
} from "../marketing-constants";
import type { ViewProps } from "../use-marketing";
import { useBoardStore } from "../board-store";
import { useCreate } from "../create-context";
import { DatePicker } from "../components/date-picker";
import PageHeader from "../components/page-header";

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

// A release unit grouped by payload.rollout — a building-block "project" until a
// premiere is locked, then a "rollout".
type Group = {
  id: string; phase: "project" | "rollout"; release: string | null;
  episodeNo: number | null; name: string | null; events: MarketingEvent[];
};

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

  // ── Edit campaign → reopen the same modal in edit mode (prefill.editId).
  function editCampaign(c: Campaign) {
    openCreate("campaign", {
      editId: c.id, name: c.name,
      type: (c.payload as { type?: string })?.type || "Launch",
      status: c.status, goal: c.goal || "",
      start: c.start ? toDateInput(c.start) : "",
      end: c.end ? toDateInput(c.end) : "",
      color: c.color, payload: c.payload,
    });
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
      <PageHeader
        id="campaigns"
        title="Campaigns"
        subtitle="The container that turns scattered dots into a story — campaigns, the ads that ride inside them, and recurring series."
        right={<>
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
        </>}
      />

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
          m={m}
          campaign={featured}
          events={eventsFor(featured.id)}
          ads={adsFor(featured.id)}
          onNewAd={(plat) => newAd(featured.id, plat)}
          onOpenAd={(id) => onOpenView?.("kiosk", id)}
          onEdit={() => editCampaign(featured)}
          onDelete={() => { m.removeCampaign(featured.id); setSelectedId(null); }}
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
function Feature({ m, campaign, events, ads, onNewAd, onOpenAd, onEdit, onDelete }: {
  m: ViewProps["m"]; campaign: Campaign; events: MarketingEvent[]; ads: MarketingEvent[];
  onNewAd: (platform?: string) => void; onOpenAd: (id: string) => void;
  onEdit: () => void; onDelete: () => void;
}) {
  const st = CAMP_STATUS[campaign.status];
  const [confirm, setConfirm] = useState(false);
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

  // A campaign's release units, grouped by payload.rollout. Each is in one of
  // two phases: "project" (building block, no premiere) or "rollout" (green-lit,
  // premiere locked). Split so the panel shows building blocks vs what's live.
  const groups = useMemo(() => {
    const byId = new Map<string, Group>();
    events.forEach((e) => {
      const r = eventRollout(e);
      if (!r) return;
      let g = byId.get(r);
      if (!g) { g = { id: r, phase: "project", release: null, episodeNo: null, name: null, events: [] }; byId.set(r, g); }
      g.events.push(e);
      if (!g.release) g.release = eventRelease(e);
      if (g.episodeNo == null) g.episodeNo = eventEpisodeNo(e);
      if (!g.name) g.name = eventProjectName(e);
      if (eventPhase(e) === "rollout") g.phase = "rollout";
    });
    return Array.from(byId.values());
  }, [events]);
  const projects = useMemo(
    () => groups.filter((g) => g.phase !== "rollout").sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [groups],
  );
  const rollouts = useMemo(
    () => groups.filter((g) => g.phase === "rollout").sort((a, b) => (a.release ? +new Date(a.release) : 0) - (b.release ? +new Date(b.release) : 0)),
    [groups],
  );

  return (
    <div style={featureWrap}>
      <div style={{ position: "absolute", inset: "0 0 auto 0", height: 3, background: `linear-gradient(90deg, ${campaign.color}, ${campaign.color}33)` }} />

      {/* edit / delete actions */}
      <div style={{ position: "absolute", top: 14, right: 16, display: "flex", alignItems: "center", gap: 7, zIndex: 2 }}>
        {!confirm ? (
          <>
            <button title="Edit campaign" onClick={onEdit} style={featureIconBtn}
              onMouseEnter={(e) => (e.currentTarget.style.color = D.tx)} onMouseLeave={(e) => (e.currentTarget.style.color = D.txm)}>
              <Pencil size={14} />
            </button>
            <button title="Delete campaign" onClick={() => setConfirm(true)} style={featureIconBtn}
              onMouseEnter={(e) => (e.currentTarget.style.color = D.coral)} onMouseLeave={(e) => (e.currentTarget.style.color = D.txm)}>
              <Trash2 size={14} />
            </button>
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: D.surface, border: `1px solid ${D.coral}55`, borderRadius: 10, padding: "6px 10px" }}>
            <span style={{ fontFamily: mn, fontSize: 10.5, color: D.txm }}>
              Delete <b style={{ color: D.tx }}>{campaign.name}</b>{events.length ? ` + ${events.length} item${events.length === 1 ? "" : "s"}` : ""}?
            </span>
            <button onClick={() => { setConfirm(false); onDelete(); }} style={{ ...confBtn, color: "#15100a", background: D.coral, border: "none" }}>Delete</button>
            <button onClick={() => setConfirm(false)} style={confBtn}>Cancel</button>
          </div>
        )}
      </div>

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

        {/* projects — building blocks; promote to a rollout by locking a premiere */}
        <div style={{ fontFamily: mn, fontSize: 9, letterSpacing: 1, color: D.txd, margin: "20px 0 8px", display: "flex", alignItems: "center", gap: 6 }}>
          <GitBranch size={11} color={D.violet} /> PROJECTS · {projects.length}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {projects.map((p) => (
            <ProjectRow key={p.id} project={p} onFinalize={(iso) => m.finalizeRollout(p.id, iso)} />
          ))}
          <NewProjectForm onAdd={(opts) => m.addProject(campaign.id, opts)} />
        </div>

        {/* rollouts — green-lit & locked (lead-up → release → clips) */}
        {rollouts.length > 0 && (
          <>
            <div style={{ fontFamily: mn, fontSize: 9, letterSpacing: 1, color: D.txd, margin: "20px 0 8px", display: "flex", alignItems: "center", gap: 6 }}>
              <Rocket size={11} color={D.cyan} /> ROLLOUTS · {rollouts.length}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rollouts.map((r) => <RolloutRow key={r.id} rollout={r} />)}
            </div>
          </>
        )}

        {/* tasks — the master-board tasks filed under this campaign's NAME, fully
            editable here (done · subtasks · notes · due) and synced to the board */}
        <CampaignTasks campaignName={campaign.name} />
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

/* ══════════════ Rollout row (per-release lifecycle segment) ══════════════ */
function RolloutRow({ rollout }: {
  rollout: { id: string; release: string | null; episodeNo: number | null; events: MarketingEvent[] };
}) {
  const total = rollout.events.length || 1;
  const advanced = rollout.events.filter((e) => e.status === "live" || e.status === "done").length;
  const pct = Math.round((advanced / total) * 100);
  const stageMap = new Map(rollout.events.map((e) => [eventStage(e), e] as const));
  const hasStages = PODCAST_LIFECYCLE.some((st) => stageMap.has(st.key));
  const label = rollout.episodeNo != null ? `EP${rollout.episodeNo}` : "Rollout";
  return (
    <div style={{ border: `1px solid ${D.border}`, borderRadius: 10, padding: "9px 11px", background: D.card }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: hasStages ? 7 : 0 }}>
        <span style={{ fontFamily: mn, fontSize: 11, color: D.tx, fontWeight: 600 }}>{label}</span>
        <span style={{ fontFamily: mn, fontSize: 9.5, color: D.txd }}>
          {rollout.release ? `releases ${fmtShort(rollout.release)}` : "no release date"}
        </span>
        <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 9.5, color: pct === 100 ? D.teal : D.txm }}>{pct}%</span>
      </div>
      {hasStages && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {PODCAST_LIFECYCLE.map((st) => {
            const ev = stageMap.get(st.key);
            const c = ev ? STATUS_COLOR[ev.status] : D.border;
            return (
              <span key={st.key} title={ev ? `${st.label} · ${STATUS_LABEL[ev.status]}` : `${st.label} · not planned`} style={{
                fontFamily: mn, fontSize: 9.5, letterSpacing: 0.2, borderRadius: 999, padding: "3px 8px",
                border: `1px solid ${ev ? c + "55" : D.border}`, color: ev ? c : D.txd, opacity: ev ? 1 : 0.45,
                display: "inline-flex", alignItems: "center", gap: 5,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: ev ? c : D.txd }} />
                {st.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════ Project row (building block → finalize premiere) ══════════════ */
function ProjectRow({ project, onFinalize }: { project: Group; onFinalize: (premiereISO: string) => void }) {
  const [date, setDate] = useState("");
  const [open, setOpen] = useState(false);
  const label = project.name || (project.episodeNo != null ? `EP${project.episodeNo}` : "Project");
  const stageMap = new Map(project.events.map((e) => [eventStage(e), e] as const));
  const done = project.events.filter((e) => e.status === "done").length;
  const total = project.events.length || 1;
  function finalize() {
    if (!date) return;
    onFinalize(new Date(date + "T09:00:00").toISOString());
    setOpen(false); setDate("");
  }
  return (
    <div style={{ border: `1px solid ${D.violet}33`, borderRadius: 10, padding: "9px 11px", background: D.card }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <GitBranch size={12} color={D.violet} />
        <span style={{ fontFamily: mn, fontSize: 11, color: D.tx, fontWeight: 600 }}>{label}</span>
        <span style={{ fontFamily: mn, fontSize: 9.5, color: D.txd }}>building · {done}/{total}</span>
        <button onClick={() => setOpen((v) => !v)} title="Lock a premiere date → promote to a rollout"
          style={{ ...confBtn, marginLeft: "auto", color: D.violet, borderColor: D.violet + "55", display: "inline-flex", alignItems: "center", gap: 5 }}>
          <Rocket size={11} /> Finalize premiere
        </button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 7 }}>
        {BUILD_STAGES.map((st) => {
          const ev = stageMap.get(st.key);
          const c = ev ? STATUS_COLOR[ev.status] : D.border;
          return (
            <span key={st.key} title={ev ? `${st.label} · ${STATUS_LABEL[ev.status]}` : `${st.label} · not planned`} style={{
              fontFamily: mn, fontSize: 9.5, letterSpacing: 0.2, borderRadius: 999, padding: "3px 8px",
              border: `1px solid ${ev ? c + "55" : D.border}`, color: ev ? c : D.txd, opacity: ev ? 1 : 0.45,
              display: "inline-flex", alignItems: "center", gap: 5,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: ev ? c : D.txd }} />
              {st.label}
            </span>
          );
        })}
      </div>
      {open && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9 }}>
          <div style={{ flex: 1 }}>
            <DatePicker value={date} onChange={setDate} accent={D.violet} placeholder="Premiere date" />
          </div>
          <button onClick={finalize} disabled={!date}
            style={{ ...primaryBtn, background: `linear-gradient(135deg, ${D.violet}, ${D.blue})`, color: "#fff", opacity: date ? 1 : 0.5, cursor: date ? "pointer" : "not-allowed" }}>
            <Rocket size={12} style={{ verticalAlign: -2, marginRight: 5 }} /> Lock &amp; roll out
          </button>
        </div>
      )}
    </div>
  );
}

/* ══════════════ New project (building block) inline form ══════════════ */
function NewProjectForm({ onAdd }: { onAdd: (opts: { title: string; episodeNo?: number }) => void }) {
  const [title, setTitle] = useState("");
  function add() {
    const t = title.trim();
    if (!t) return;
    const num = t.match(/(\d+)\s*$/);   // trailing number → episodeNo ("EP21" → 21)
    onAdd({ title: t, episodeNo: num ? parseInt(num[1], 10) : undefined });
    setTitle("");
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, border: `1px dashed ${D.border}`, borderRadius: 10, padding: "8px 10px" }}>
      <GitBranch size={12} color={D.txd} />
      <input value={title} onChange={(e) => setTitle(e.target.value)}
        placeholder="New project — e.g. The HBM4 Deep-Dive"
        onKeyDown={(e) => { if (e.key === "Enter") add(); }}
        style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: D.tx, fontFamily: ft, fontSize: 13 }} />
      <button onClick={add} disabled={!title.trim()}
        style={{ ...confBtn, color: D.violet, borderColor: D.violet + "55", opacity: title.trim() ? 1 : 0.5, display: "inline-flex", alignItems: "center", gap: 4 }}>
        <Plus size={11} /> Add
      </button>
    </div>
  );
}

/* ══════════════ In-campaign tasks (name-grouped) ══════════════ */
// Tasks the master board files under THIS campaign's name (category === name)
// — the same "XYZ" you'd see in Taskboard. Editable here and synced to the board
// (mode-gated by the store: demo edits stay in the sandbox).
const PRI_COLOR: Record<string, string> = {
  HIGH: D.coral, MEDIUM: D.amber, "THIS WEEK": D.cyan, ONGOING: D.violet, DONE: D.txd,
};
const PRIORITIES = ["HIGH", "MEDIUM", "THIS WEEK", "ONGOING"];
const sid = () => "s-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 5);
const nid = () => "n-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 5);
const fmtDue = (d: string) => fmtShort(d.length === 10 ? d + "T12:00:00" : d);

function CampaignTasks({ campaignName }: { campaignName: string }) {
  const store = useBoardStore();
  const cat = campaignCategory(campaignName);
  const tasks = useMemo(
    () => store.tasks.filter((t) => (t.category || "") === cat),
    [store.tasks, cat],
  );
  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  const [showDone, setShowDone] = useState(false);

  return (
    <>
      <div style={{ fontFamily: mn, fontSize: 9, letterSpacing: 1, color: D.txd, margin: "20px 0 8px", display: "flex", alignItems: "center", gap: 6 }}>
        <ListChecks size={11} color={D.amber} /> TASKS · {open.length}
        {done.length > 0 && (
          <button onClick={() => setShowDone((v) => !v)}
            style={{ marginLeft: "auto", ...confBtn, fontSize: 9.5, padding: "3px 8px", color: D.txm }}>
            {showDone ? "Hide" : "Show"} {done.length} done
          </button>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {tasks.length === 0 && (
          <div style={{ fontFamily: mn, fontSize: 10.5, color: D.txd, padding: "2px 2px 4px" }}>
            No tasks under <b style={{ color: D.txm }}>{cat}</b> yet — add one and it appears on the board as “{cat}”.
          </div>
        )}
        {open.map((t) => (
          <TaskEditRow key={t.id} task={t} onUpdate={(patch) => store.updateBoardTask(t.id, patch)} />
        ))}
        {showDone && done.map((t) => (
          <TaskEditRow key={t.id} task={t} onUpdate={(patch) => store.updateBoardTask(t.id, patch)} />
        ))}
        <AddCampaignTask onAdd={(title) => store.createBoardTask({ title, category: cat, priority: "MEDIUM" })} />
      </div>
    </>
  );
}

/* ══════════════ Editable task row (done · subtasks · notes · due · priority) ══════════════ */
function TaskEditRow({ task, onUpdate }: { task: BoardTaskLite; onUpdate: (patch: Partial<BoardTaskLite>) => void }) {
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState("");
  const [note, setNote] = useState("");
  const [dueOpen, setDueOpen] = useState(false);
  const [subDateOpen, setSubDateOpen] = useState<string | null>(null);
  const subs = task.subtasks || [];
  const doneSubs = subs.filter((s) => s.done).length;
  const notes = task.notesLog || [];
  const pc = PRI_COLOR[task.priority || "MEDIUM"] || D.txm;
  // The naming-agent prefix for a dated subtask's calendar event: the campaign /
  // project name (the board category) when present, else the parent task.
  const subPrefix = task.category || task.title;

  const addSub = () => { const v = sub.trim(); if (!v) return; onUpdate({ subtasks: [...subs, { id: sid(), title: v }] }); setSub(""); };
  const toggleSub = (id: string) => onUpdate({ subtasks: subs.map((s) => (s.id === id ? { ...s, done: !s.done } : s)) });
  const delSub = (id: string) => onUpdate({ subtasks: subs.filter((s) => s.id !== id) });
  // Setting a subtask's due date is all it takes — the sync reconciler spawns
  // "subPrefix: subtask" on the Calendar and keeps it aligned.
  const setSubDate = (id: string, v: string) => onUpdate({ subtasks: subs.map((s) => (s.id === id ? { ...s, dueDate: v || undefined } : s)) });
  const addNote = () => { const v = note.trim(); if (!v) return; onUpdate({ notesLog: [...notes, { id: nid(), ts: new Date().toISOString(), author: "Akash", text: v }] }); setNote(""); };

  return (
    <div style={{ border: `1px solid ${task.done ? D.border : D.border}`, borderRadius: 10, background: D.card, opacity: task.done ? 0.62 : 1 }}>
      {/* collapsed row */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 11px" }}>
        <button onClick={() => onUpdate({ done: !task.done })} title={task.done ? "Mark not done" : "Mark done"}
          style={{ flex: "none", width: 17, height: 17, borderRadius: "50%", cursor: "pointer", padding: 0,
            border: `1.6px solid ${task.done ? D.teal : D.txd}`, background: task.done ? D.teal : "transparent",
            display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          {task.done && <svg width={9} height={9} viewBox="0 0 12 12" fill="none"><path d="M2 6.5L5 9.5L10 3.5" stroke="#0A0A0F" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </button>
        <button onClick={() => setOpen((v) => !v)} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "transparent", border: "none", cursor: "pointer", padding: 0,
          color: D.tx, fontFamily: ft, fontSize: 12.5, textDecoration: task.done ? "line-through" : "none",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {task.title}
        </button>
        {/* meta chips */}
        <span style={{ ...miniTag, color: pc, borderColor: pc + "55" }}>{task.priority || "MEDIUM"}</span>
        {task.dueDate && <span style={{ ...miniTag, color: D.cyan, borderColor: D.cyan + "44" }}>{fmtDue(task.dueDate)}</span>}
        {subs.length > 0 && (
          <span title="subtasks" style={{ fontFamily: mn, fontSize: 9.5, color: doneSubs === subs.length ? D.teal : D.txm, display: "inline-flex", alignItems: "center", gap: 3 }}>
            <ListChecks size={11} /> {doneSubs}/{subs.length}
          </span>
        )}
        {notes.length > 0 && (
          <span title="notes" style={{ fontFamily: mn, fontSize: 9.5, color: D.txm, display: "inline-flex", alignItems: "center", gap: 3 }}>
            <MessageSquare size={11} /> {notes.length}
          </span>
        )}
        <button onClick={() => setOpen((v) => !v)} style={{ flex: "none", background: "transparent", border: "none", cursor: "pointer", color: D.txd, padding: 2, display: "inline-flex" }}>
          <ChevronDown size={14} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
        </button>
      </div>

      {/* expanded editor */}
      {open && (
        <div style={{ borderTop: `1px solid ${D.border}`, padding: "10px 11px 11px", display: "flex", flexDirection: "column", gap: 11 }}>
          {/* subtasks */}
          <div>
            <div style={editLabel}><ListChecks size={10} color={D.amber} /> SUBTASKS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 6 }}>
              {subs.map((s) => (
                <div key={s.id} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={() => toggleSub(s.id)} style={{ flex: "none", width: 14, height: 14, borderRadius: 4, cursor: "pointer", padding: 0,
                      border: `1.4px solid ${s.done ? D.teal : D.txd}`, background: s.done ? D.teal : "transparent",
                      display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                      {s.done && <svg width={8} height={8} viewBox="0 0 12 12" fill="none"><path d="M2 6.5L5 9.5L10 3.5" stroke="#0A0A0F" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </button>
                    <span style={{ flex: 1, minWidth: 0, fontFamily: ft, fontSize: 12, color: s.done ? D.txd : D.tx, textDecoration: s.done ? "line-through" : "none" }}>{s.title}</span>
                    {/* date toggle — when set, the subtask surfaces on the Calendar as "name: subtask" */}
                    <button onClick={() => setSubDateOpen(subDateOpen === s.id ? null : s.id)}
                      title={s.dueDate ? "On the calendar — change the date" : "Add a due date — shows on the calendar"}
                      style={{ ...miniTag, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3,
                        color: s.dueDate ? D.cyan : D.txd, borderColor: s.dueDate ? D.cyan + "55" : D.border }}>
                      <CalendarDays size={10} /> {s.dueDate ? fmtDue(s.dueDate) : "date"}
                    </button>
                    <button onClick={() => delSub(s.id)} title="Remove subtask" style={{ flex: "none", background: "transparent", border: "none", cursor: "pointer", color: D.txd, padding: 2 }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = D.coral)} onMouseLeave={(e) => (e.currentTarget.style.color = D.txd)}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                  {subDateOpen === s.id && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 22, flexWrap: "wrap" }}>
                      <div style={{ minWidth: 150 }}>
                        <DatePicker value={s.dueDate || ""} accent={D.cyan} placeholder="Subtask due date"
                          onChange={(v) => { setSubDate(s.id, v); setSubDateOpen(null); }} />
                      </div>
                      {s.dueDate && (
                        <button onClick={() => { setSubDate(s.id, ""); setSubDateOpen(null); }} style={{ ...confBtn, padding: "4px 9px", color: D.coral, borderColor: D.coral + "44" }}>
                          Clear
                        </button>
                      )}
                      <span style={{ fontFamily: mn, fontSize: 8.5, color: D.txd }}>calendar: “{subPrefix}: {s.title}”</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input value={sub} onChange={(e) => setSub(e.target.value)} placeholder="Add a subtask…"
                onKeyDown={(e) => { if (e.key === "Enter") addSub(); }}
                style={{ flex: 1, background: D.surface, border: `1px solid ${D.border}`, borderRadius: 7, padding: "6px 9px", color: D.tx, fontFamily: ft, fontSize: 12, outline: "none" }} />
              <button onClick={addSub} disabled={!sub.trim()} style={{ ...confBtn, padding: "5px 9px", color: D.amber, borderColor: D.amber + "55", opacity: sub.trim() ? 1 : 0.5 }}>
                <Plus size={11} />
              </button>
            </div>
          </div>

          {/* notes */}
          <div>
            <div style={editLabel}><MessageSquare size={10} color={D.violet} /> NOTES</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 6 }}>
              {notes.map((n) => (
                <div key={n.id} style={{ fontFamily: ft, fontSize: 12, color: D.txm, lineHeight: 1.4, borderLeft: `2px solid ${D.violet}55`, paddingLeft: 8 }}>
                  {n.text}
                  <span style={{ fontFamily: mn, fontSize: 9, color: D.txd, marginLeft: 6 }}>{fmtShort(n.ts)}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…"
                onKeyDown={(e) => { if (e.key === "Enter") addNote(); }}
                style={{ flex: 1, background: D.surface, border: `1px solid ${D.border}`, borderRadius: 7, padding: "6px 9px", color: D.tx, fontFamily: ft, fontSize: 12, outline: "none" }} />
              <button onClick={addNote} disabled={!note.trim()} style={{ ...confBtn, padding: "5px 9px", color: D.violet, borderColor: D.violet + "55", opacity: note.trim() ? 1 : 0.5 }}>
                <Plus size={11} />
              </button>
            </div>
          </div>

          {/* due date + priority */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={editLabel}><CalendarDays size={10} color={D.cyan} /> DUE</span>
              {dueOpen ? (
                <div style={{ minWidth: 150 }}>
                  <DatePicker value={task.dueDate || ""} accent={D.cyan} placeholder="Due date"
                    onChange={(v) => { onUpdate({ dueDate: v || undefined }); setDueOpen(false); }} />
                </div>
              ) : (
                <button onClick={() => setDueOpen(true)} style={{ ...confBtn, padding: "5px 9px", color: task.dueDate ? D.cyan : D.txm, borderColor: task.dueDate ? D.cyan + "55" : D.border }}>
                  {task.dueDate ? fmtDue(task.dueDate) : "Set date"}
                </button>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={editLabel}><Flag size={10} color={pc} /> PRIORITY</span>
              <div style={{ display: "flex", gap: 4 }}>
                {PRIORITIES.map((p) => {
                  const on = (task.priority || "MEDIUM") === p;
                  const c = PRI_COLOR[p];
                  return (
                    <button key={p} onClick={() => onUpdate({ priority: p })} style={{
                      fontFamily: mn, fontSize: 9, letterSpacing: 0.3, borderRadius: 999, padding: "3px 8px", cursor: "pointer",
                      border: `1px solid ${on ? c + "88" : D.border}`, background: on ? c + "1a" : "transparent", color: on ? c : D.txd,
                    }}>{p}</button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════ Add a task to this campaign (category = name) ══════════════ */
function AddCampaignTask({ onAdd }: { onAdd: (title: string) => void }) {
  const [title, setTitle] = useState("");
  function add() { const t = title.trim(); if (!t) return; onAdd(t); setTitle(""); }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, border: `1px dashed ${D.border}`, borderRadius: 10, padding: "8px 10px" }}>
      <ListChecks size={12} color={D.txd} />
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New task for this campaign…"
        onKeyDown={(e) => { if (e.key === "Enter") add(); }}
        style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: D.tx, fontFamily: ft, fontSize: 13 }} />
      <button onClick={add} disabled={!title.trim()}
        style={{ ...confBtn, color: D.amber, borderColor: D.amber + "55", opacity: title.trim() ? 1 : 0.5, display: "inline-flex", alignItems: "center", gap: 4 }}>
        <Plus size={11} /> Add
      </button>
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
function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 32) || "series";
}

function SeriesScheduler({ m, campaign }: { m: ViewProps["m"]; campaign?: Campaign }) {
  const [name, setName] = useState("SemiAnalysis Weekly");
  const [freq, setFreq] = useState(7);
  const [date, setDate] = useState(() => toDateInput(new Date(Date.now() + 8 * 86400000).toISOString()));
  const [count, setCount] = useState(5);
  const [channel, setChannel] = useState("youtube");
  const [podcast, setPodcast] = useState(true);
  const [baseTitle, setBaseTitle] = useState("");
  const [guests, setGuests] = useState<string[]>([]);
  const [lastSeriesId, setLastSeriesId] = useState<string | null>(null);

  // Reflect the selected campaign's existing series so Re-project replaces it.
  React.useEffect(() => {
    const s = campaign?.series[0];
    if (!s) { setLastSeriesId(null); return; }
    setName(s.name); setFreq(s.frequencyDays); setCount(s.count);
    setChannel(s.channel || "youtube"); setDate(toDateInput(s.firstRelease));
    setPodcast(s.kind === "podcast"); setBaseTitle(s.baseTitle || ""); setGuests(s.guests || []);
    setLastSeriesId(s.id);
  }, [campaign?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Projected rollouts: distinct (rollout → release date) for this series.
  const projected = useMemo(() => {
    if (!campaign || !lastSeriesId) return [];
    const byRollout = new Map<string, string>();
    m.events.forEach((e) => {
      if (e.campaignId !== campaign.id || eventSeries(e) !== lastSeriesId) return;
      const r = eventRollout(e) || e.id;
      const rel = eventRelease(e) || (eventStage(e) === "release" ? e.start : e.start);
      if (!byRollout.has(r)) byRollout.set(r, rel);
    });
    return Array.from(byRollout.values()).sort((a, b) => +new Date(a) - +new Date(b));
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

  const chips = projected.length
    ? projected.map((iso) => ({ iso, locked: true }))
    : preview.map((iso) => ({ iso, locked: false }));

  const disabled = !campaign;
  const titles = useMemo(() => episodeTitles(baseTitle.trim() || name.trim() || "Episode", guests), [baseTitle, name, guests]);

  function project() {
    if (!campaign) return;
    const base = new Date(date + "T12:00:00");
    if (isNaN(base.getTime())) return;
    // Stable id → re-projecting REPLACES the same series in place (no dupes).
    const id = lastSeriesId || `s-${campaign.id}-${slugify(name)}`;
    const def: SeriesDef = {
      id, name: name.trim() || "Series", frequencyDays: freq,
      firstRelease: base.toISOString(), count: Math.max(1, Math.min(16, count || 1)), channel,
    };
    if (podcast) {
      def.kind = "podcast"; def.stages = PODCAST_LIFECYCLE;
      def.baseTitle = baseTitle.trim() || name.trim() || "Episode"; def.guests = guests;
    }
    m.addSeries(campaign.id, def);
    setLastSeriesId(id);
  }

  const epLabel = (name.trim() || "Ep").split(" ")[0];
  const lastChip = chips[chips.length - 1];
  const toggleGuest = (g: string) => setGuests((p) => p.includes(g) ? p.filter((x) => x !== g) : [...p, g]);

  return (
    <div style={seriesWrap}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <p style={{ fontFamily: mn, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: D.cyan, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 7 }}>
          <CalendarPlus size={12} /> Rollout scheduler
        </p>
        {/* Podcast-lifecycle toggle: fans each release into topic→film→edit→release→clips */}
        <button onClick={() => setPodcast((p) => !p)} title="Each release fans into a full lifecycle rollout"
          style={{
            display: "inline-flex", alignItems: "center", gap: 7, fontFamily: mn, fontSize: 10.5, cursor: "pointer",
            borderRadius: 999, padding: "5px 11px", border: `1px solid ${podcast ? D.cyan + "88" : D.border}`,
            background: podcast ? "rgba(38,201,216,0.1)" : "transparent", color: podcast ? D.cyan : D.txm,
          }}>
          <Mic size={12} /> Podcast lifecycle
          <span style={{
            width: 22, height: 12, borderRadius: 999, background: podcast ? D.cyan : D.border, position: "relative", flex: "none",
          }}>
            <span style={{ position: "absolute", top: 1, left: podcast ? 11 : 1, width: 10, height: 10, borderRadius: 999, background: "#06121a", transition: "left .15s" }} />
          </span>
        </button>
      </div>
      <div style={{ color: D.txm, fontSize: 13, marginBottom: 14 }}>
        Set a cadence + first release. Projecting locks the rollouts into{" "}
        <b style={{ color: campaign?.color || D.tx, fontWeight: 600 }}>{campaign?.name || "a campaign"}</b>{" "}
        — {podcast ? "each release fans into topic → film → edit → release → clips" : "each release becomes a dated item"}, synced across Calendar, Agenda &amp; Timeline.
      </div>

      <div style={seriesForm}>
        <Field label="Show name">
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
          <DatePicker value={date} onChange={setDate} accent={D.cyan} placeholder="First release" />
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
          {projected.length ? "Re-project" : "Project"}
        </button>
      </div>

      {/* Podcast lifecycle options — base title + frequent-guest quick-pick */}
      {podcast && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) 1.4fr", gap: 14, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${D.border}` }}>
          <Field label="Episode base title">
            <input style={input} value={baseTitle} onChange={(e) => setBaseTitle(e.target.value)} placeholder="e.g. The Memory Wars" />
            <span style={{ display: "block", marginTop: 5, fontFamily: mn, fontSize: 9.5, color: D.txd }}>
              YT: {titles.youtube.length}/100 · Spotify: {titles.spotify.length}/200
            </span>
          </Field>
          <Field label="Guests (frequent)">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {SA_FREQUENT_GUESTS.map((g) => {
                const on = guests.includes(g);
                return (
                  <button key={g} onClick={() => toggleGuest(g)} style={{
                    fontFamily: mn, fontSize: 10.5, borderRadius: 999, padding: "5px 10px", cursor: "pointer",
                    border: `1px solid ${on ? D.cyan + "88" : D.border}`, background: on ? "rgba(38,201,216,0.12)" : "transparent",
                    color: on ? D.cyan : D.txm,
                  }}>{g}</button>
                );
              })}
            </div>
          </Field>
        </div>
      )}

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
        {projected.length ? (
          <span>
            Locked into <b style={{ color: D.tx, fontWeight: 600 }}>{campaign?.name}</b> — {projected.length} rollouts now synced, last on {lastChip ? fmtShort(lastChip.iso) : "—"}.
          </span>
        ) : (
          <span>
            {campaign
              ? `Preview cadence — ${chips.length} rollouts through ${lastChip ? fmtShort(lastChip.iso) : "—"}. Hit Project to lock them in.`
              : "Select a campaign to project a rollout series into it."}
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
const featureIconBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 8, flex: "none", cursor: "pointer",
  border: `1px solid ${D.border}`, background: "rgba(10,10,16,0.6)", color: D.txm,
  display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "color .15s",
};
const confBtn: React.CSSProperties = {
  fontFamily: mn, fontSize: 10.5, letterSpacing: 0.3, borderRadius: 7, padding: "5px 10px", cursor: "pointer",
  border: `1px solid ${D.border}`, background: "transparent", color: D.txm,
};
const statusPill: React.CSSProperties = {
  fontFamily: mn, fontSize: 9, letterSpacing: 1, padding: "3px 9px", borderRadius: 999, border: "1px solid currentColor",
};
const chPill: React.CSSProperties = {
  fontFamily: mn, fontSize: 9, letterSpacing: 0.5, padding: "2px 7px", borderRadius: 6, border: "1px solid currentColor",
};
const miniTag: React.CSSProperties = {
  fontFamily: mn, fontSize: 9, letterSpacing: 0.2, padding: "2px 6px", borderRadius: 6, border: "1px solid currentColor", flex: "none",
};
const editLabel: React.CSSProperties = {
  fontFamily: mn, fontSize: 9, letterSpacing: 1, color: D.txd, display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 5,
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
