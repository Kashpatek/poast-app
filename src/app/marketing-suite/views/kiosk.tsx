"use client";
// Ad Kiosk — a full ad-development + live-ad-ops cockpit.
// ───────────────────────────────────────────────────────────────────────────
// Two modes via the top toggle:
//   • BUILD     — a guided ad builder: platform → objective → audience →
//                 budget → creative copy, with PLATFORM-AWARE "what to put in"
//                 guidance and a LIVE PREVIEW that mimics the selected platform's
//                 ad unit. Save writes/updates a type:'ad' marketing event.
//   • LIVE ADS  — the tracker: every type:'ad' event grouped by platform, each a
//                 card with status / budget / a derived METRICS panel and an
//                 inline "Update metrics" editor (spend / impr / clicks / conv →
//                 CTR / CPC / CPA computed on save). The two running ads (OpenAI +
//                 Meta) are surfaced prominently up top.
//
// House rules: inline React.CSSProperties + D tokens only; lucide 1.8 has NO
// brand glyphs, so platforms render as adPlatform() color dot + short code.
import React, { useEffect, useMemo, useState } from "react";
import {
  Wand2, Radio, Plus, Sparkles, Target, Users, DollarSign, Megaphone,
  Eye, MousePointerClick, Activity, Gauge, TrendingUp, Pencil, Check, X,
  Flame, Pause, Play, Save, Layers, Hash, ArrowRight, ChevronRight,
} from "lucide-react";
import { D, ft, gf, mn } from "../../shared-constants";
import {
  STATUS_COLOR, STATUS_LABEL,
  AD_PLATFORMS, adPlatform, AD_OBJECTIVES, adPayload,
  type MarketingEvent, type EventStatus, type AdPayload, type AdMetrics,
} from "../marketing-constants";
import type { ViewProps } from "../use-marketing";

// ─── Per-platform creative guidance (the "what to put in" block) ───
interface PlatGuide {
  preview: string;        // preview unit label
  hLimit: number;         // headline char limit
  bLimit: number;         // body char limit
  format: string;
  tips: string[];
}
const GUIDE: Record<string, PlatGuide> = {
  openai: {
    preview: "Sponsored answer card", hLimit: 60, bLimit: 150, format: "Text + link unit",
    tips: [
      "Lead with the technical claim — this audience scans for substance.",
      "No hype words. State the number, then the stakes.",
      "Landing page should match the answer's intent 1:1.",
    ],
  },
  x: {
    preview: "Promoted post", hLimit: 70, bLimit: 240, format: "280-char post + card",
    tips: [
      "Hook in the first 12 words — feed scroll is brutal.",
      "One idea per post. Thread the rest organically.",
      "A bold number or contrarian take beats a question.",
    ],
  },
  meta: {
    preview: "FB / IG feed ad", hLimit: 40, bLimit: 125, format: "1:1 or 4:5 image + primary text",
    tips: [
      "Primary text truncates ~125 chars — front-load the value.",
      "First frame must work muted. Caption the hook.",
      "Test 3 creatives per ad set; let the algorithm pick.",
    ],
  },
  linkedin: {
    preview: "Sponsored content", hLimit: 70, bLimit: 150, format: "Single image + intro text",
    tips: [
      "Speak to the role, not the person — decision-makers scan titles.",
      "Lead with an industry insight, close with a soft CTA.",
      "Document/carousel ads outperform single images here.",
    ],
  },
  adsense: {
    preview: "Display banner", hLimit: 30, bLimit: 90, format: "Responsive display unit",
    tips: [
      "Headlines auto-truncate hard — keep them ≤30 chars.",
      "High-contrast, one focal point. No fine print.",
      "Let responsive ads test combinations across placements.",
    ],
  },
};
function guideFor(key: string): PlatGuide {
  return GUIDE[key] || GUIDE.meta;
}

// ─── Formatting helpers ───
const fmtInt = (n?: number) => (n == null ? "—" : n >= 1000 ? n.toLocaleString("en-US") : String(n));
const fmtMoney = (n?: number) => (n == null ? "—" : "$" + n.toLocaleString("en-US", { maximumFractionDigits: n < 100 ? 2 : 0 }));
const fmtPct = (n?: number) => (n == null ? "—" : n.toFixed(2) + "%");
const fmtX = (n?: number) => (n == null ? "—" : n.toFixed(1) + "×");
const cleanNum = (s: string): number | undefined => {
  const v = parseFloat(s.replace(/[^0-9.]/g, ""));
  return Number.isFinite(v) ? v : undefined;
};

// Compute derived metrics (CTR / CPC / CPA / ROAS) from the raw inputs.
function deriveMetrics(raw: AdMetrics): AdMetrics {
  const { spend, impressions, clicks, conversions } = raw;
  const ctr = impressions && clicks != null ? (clicks / impressions) * 100 : raw.ctr;
  const cpc = clicks && spend != null ? spend / clicks : raw.cpc;
  const cpa = conversions && spend != null ? spend / conversions : raw.cpa;
  return { ...raw, ctr, cpc, cpa };
}

// ════════════════════════════════════════════════════════════════════════════
export default function KioskView({ m, onOpenView, focusId }: ViewProps) {
  const [mode, setMode] = useState<"build" | "live">("build");

  // All ad events, freshest data straight off the spine.
  const ads = useMemo(() => m.events.filter((e) => e.type === "ad"), [m.events]);

  // If a focusId points at an existing ad, default to Build and load it.
  const focusAd = useMemo(
    () => (focusId ? ads.find((a) => a.id === focusId) : undefined),
    [ads, focusId],
  );

  return (
    <div style={page}>
      {/* ── Header + mode toggle ── */}
      <div style={headRow}>
        <div>
          <h1 style={h1Style}>
            <Megaphone size={22} color={D.violet} /> Ad Kiosk
          </h1>
          <div style={subStyle}>
            Build, ship and read your live ad flights across OpenAI, X, Meta, LinkedIn and AdSense — one cockpit.
          </div>
        </div>
        <div style={modeToggle}>
          <ModeBtn on={mode === "build"} onClick={() => setMode("build")} icon={<Wand2 size={14} />} label="Build" accent={D.violet} />
          <ModeBtn on={mode === "live"} onClick={() => setMode("live")} icon={<Radio size={14} />} label="Live ads" accent={D.teal} count={ads.length} />
        </div>
      </div>

      {mode === "build"
        ? <BuildMode m={m} focusAd={focusAd} onSaved={() => setMode("live")} onOpenView={onOpenView} />
        : <LiveMode m={m} onBuild={() => setMode("build")} onOpenView={onOpenView} focusId={focusId} />}
    </div>
  );
}

// ════════════════════════ BUILD MODE ════════════════════════
function BuildMode({
  m, focusAd, onSaved, onOpenView,
}: {
  m: ViewProps["m"];
  focusAd?: MarketingEvent;
  onSaved: () => void;
  onOpenView?: ViewProps["onOpenView"];
}) {
  void onOpenView;
  const seed = focusAd ? adPayload(focusAd) : ({} as AdPayload);

  const [platform, setPlatform] = useState<string>(seed.platform || "meta");
  const [objective, setObjective] = useState<string>(seed.objective || AD_OBJECTIVES[0]);
  const [audience, setAudience] = useState<string>(seed.audience || "");
  const [budget, setBudget] = useState<string>(seed.budget != null ? String(seed.budget) : "60");
  const [budgetType, setBudgetType] = useState<"daily" | "lifetime">(seed.budgetType || "daily");
  const [headline, setHeadline] = useState<string>(seed.headline || "");
  const [body, setBody] = useState<string>(seed.body || "");
  const [cta, setCta] = useState<string>(seed.cta || "");
  const [landing, setLanding] = useState<string>(seed.landing || "");
  const [saved, setSaved] = useState(false);

  // Re-seed when the deep-link target changes mid-session.
  useEffect(() => {
    if (!focusAd) return;
    const p = adPayload(focusAd);
    setPlatform(p.platform || "meta");
    setObjective(p.objective || AD_OBJECTIVES[0]);
    setAudience(p.audience || "");
    setBudget(p.budget != null ? String(p.budget) : "60");
    setBudgetType(p.budgetType || "daily");
    setHeadline(p.headline || "");
    setBody(p.body || "");
    setCta(p.cta || "");
    setLanding(p.landing || "");
  }, [focusAd]);

  const plat = adPlatform(platform);
  const guide = guideFor(platform);
  const editing = !!focusAd;

  function save() {
    const payload: AdPayload = {
      ...(focusAd ? adPayload(focusAd) : {}),
      platform, objective, audience: audience.trim(),
      budget: cleanNum(budget) ?? 0, budgetType,
      headline: headline.trim(), body: body.trim(), cta: cta.trim(), landing: landing.trim(),
    };
    const title = headline.trim()
      ? `${plat.n} · ${headline.trim().slice(0, 40)}`
      : `${plat.n} · ${objective} ad`;
    const payloadRec = payload as Record<string, unknown>;
    if (focusAd) {
      m.updateEvent(focusAd.id, { title, channel: platform, payload: payloadRec });
    } else {
      m.addEvent({
        type: "ad", status: "idea", title, channel: platform, source: "manual",
        campaignId: "camp-ad", start: new Date().toISOString(), payload: payloadRec,
      });
    }
    setSaved(true);
    setTimeout(() => { setSaved(false); onSaved(); }, 650);
  }

  return (
    <div style={buildGrid}>
      {/* ─── LEFT: the builder form ─── */}
      <div style={builderCol}>
        {editing && (
          <div style={editBanner}>
            <Pencil size={13} color={D.amber} />
            <span>Editing <b style={{ color: D.tx }}>{focusAd!.title}</b></span>
          </div>
        )}

        {/* Platform */}
        <Section icon={<Layers size={13} />} label="Platform" accent={plat.c}>
          <div style={chipWrap}>
            {AD_PLATFORMS.map((p) => (
              <button key={p.key} onClick={() => setPlatform(p.key)} style={platChip(platform === p.key, p.c)}>
                <span style={{ ...dot, background: p.c, boxShadow: platform === p.key ? `0 0 8px ${p.c}aa` : "none" }} />
                <span style={{ fontFamily: mn, fontSize: 9.5, color: p.c, letterSpacing: 0.4 }}>{p.s}</span>
                <span style={{ color: platform === p.key ? D.tx : D.txm }}>{p.n}</span>
              </button>
            ))}
          </div>
        </Section>

        {/* Objective */}
        <Section icon={<Target size={13} />} label="Objective" accent={D.violet}>
          <div style={chipWrap}>
            {AD_OBJECTIVES.map((o) => (
              <button key={o} onClick={() => setObjective(o)} style={pill(objective === o, D.violet)}>{o}</button>
            ))}
          </div>
        </Section>

        {/* Audience */}
        <Section icon={<Users size={13} />} label="Audience" accent={D.blue}>
          <input
            value={audience} onChange={(e) => setAudience(e.target.value)}
            placeholder="e.g. AI / infra decision-makers · lookalike 1% · site visitors 30d"
            style={inputStyle}
            onFocus={(e) => { e.currentTarget.style.borderColor = D.blue + "66"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = D.border; }}
          />
        </Section>

        {/* Budget */}
        <Section icon={<DollarSign size={13} />} label="Budget" accent={D.teal}>
          <div style={{ display: "flex", gap: 10, alignItems: "stretch", flexWrap: "wrap" }}>
            <div style={budgetField}>
              <span style={{ fontFamily: mn, fontSize: 14, color: D.txm }}>$</span>
              <input
                value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal" style={budgetInput}
              />
            </div>
            <div style={segTwo}>
              {(["daily", "lifetime"] as const).map((t) => (
                <button key={t} onClick={() => setBudgetType(t)} style={segTwoBtn(budgetType === t)}>{t}</button>
              ))}
            </div>
            <span style={{ fontFamily: mn, fontSize: 10.5, color: D.txd, alignSelf: "center" }}>
              {budgetType === "daily" ? "per day" : "total flight"}
            </span>
          </div>
        </Section>

        {/* Creative copy */}
        <Section icon={<Sparkles size={13} />} label="Creative" accent={D.amber}>
          <CharField label="Headline" value={headline} onChange={setHeadline} limit={guide.hLimit} placeholder="The memory wall is the AI wall" />
          <CharField label="Body" value={body} onChange={setBody} limit={guide.bLimit} placeholder="Why HBM4 decides who ships frontier models." multiline />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 2 }}>
            <div style={{ flex: "1 1 150px" }}>
              <FieldLabel>CTA</FieldLabel>
              <input value={cta} onChange={(e) => setCta(e.target.value)} placeholder="Read the analysis" style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = D.amber + "66"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = D.border; }} />
            </div>
            <div style={{ flex: "2 1 220px" }}>
              <FieldLabel>Landing URL</FieldLabel>
              <input value={landing} onChange={(e) => setLanding(e.target.value)} placeholder="semianalysis.com/subscribe" style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = D.amber + "66"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = D.border; }} />
            </div>
          </div>
        </Section>

        {/* Save bar */}
        <div style={saveBar}>
          <button onClick={save} style={{ ...saveBtn, background: saved ? D.teal : D.amber, color: "#160f02" }}>
            {saved ? <Check size={15} /> : <Save size={15} />}
            {saved ? "Saved" : editing ? "Update ad" : "Save ad"}
          </button>
          <span style={{ fontFamily: mn, fontSize: 10.5, color: D.txd }}>
            {editing ? "Updates the existing flight" : "Lands as an idea in Live ads → set live when ready"}
          </span>
        </div>
      </div>

      {/* ─── RIGHT: preview + guidance ─── */}
      <div style={previewCol}>
        <AdPreview plat={plat} guide={guide} headline={headline} body={body} cta={cta} landing={landing} objective={objective} />

        {/* Platform guidance */}
        <div style={guideCard}>
          <div style={guideHead}>
            <span style={{ ...dot, width: 9, height: 9, background: plat.c, boxShadow: `0 0 8px ${plat.c}88` }} />
            <span style={{ fontFamily: gf, fontSize: 14, color: D.tx }}>What works on {plat.n}</span>
          </div>
          <div style={guideMetaRow}>
            <GuideMeta label="Unit" value={guide.preview} />
            <GuideMeta label="Format" value={guide.format} />
            <GuideMeta label="Headline" value={`≤ ${guide.hLimit}`} />
            <GuideMeta label="Body" value={`≤ ${guide.bLimit}`} />
          </div>
          <ul style={tipList}>
            {guide.tips.map((t, i) => (
              <li key={i} style={tipItem}>
                <ChevronRight size={12} color={plat.c} style={{ flex: "none", marginTop: 2 }} />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// Platform-aware live preview that mimics the ad unit.
function AdPreview({
  plat, guide, headline, body, cta, landing, objective,
}: {
  plat: ReturnType<typeof adPlatform>;
  guide: PlatGuide;
  headline: string; body: string; cta: string; landing: string; objective: string;
}) {
  const host = (landing || "semianalysis.com").replace(/^https?:\/\//, "").split("/")[0];
  return (
    <div style={previewWrap}>
      <div style={previewBar}>
        <span style={{ ...dot, width: 8, height: 8, background: plat.c }} />
        <span style={{ fontFamily: mn, fontSize: 9.5, color: plat.c, letterSpacing: 0.5 }}>{plat.s}</span>
        <span style={{ fontFamily: mn, fontSize: 9.5, color: D.txd, letterSpacing: 0.5 }}>LIVE PREVIEW · {guide.preview}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: mn, fontSize: 9, color: D.txd }}>{objective}</span>
      </div>

      <div style={{ ...adUnit, borderColor: plat.c + "33" }}>
        {/* "advertiser" row */}
        <div style={advRow}>
          <div style={{ ...advLogo, background: `linear-gradient(135deg, ${plat.c}, ${plat.c}55)` }}>SA</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: D.tx }}>SemiAnalysis</div>
            <div style={{ fontFamily: mn, fontSize: 9.5, color: D.txd }}>Sponsored · {plat.n}</div>
          </div>
        </div>

        {/* body copy */}
        {body
          ? <div style={{ fontSize: 12.5, color: D.tx, lineHeight: 1.5, margin: "2px 0 10px" }}>{body}</div>
          : <div style={{ fontSize: 12.5, color: D.txd, lineHeight: 1.5, margin: "2px 0 10px", fontStyle: "italic" }}>Body copy preview…</div>}

        {/* hero / image stand-in */}
        <div style={{ ...heroBox, background: `linear-gradient(135deg, ${plat.c}1a, ${D.bg})` }}>
          <span style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.5 }}>creative · {guide.format}</span>
        </div>

        {/* link card footer */}
        <div style={linkCard}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: mn, fontSize: 9.5, color: D.txd, textTransform: "uppercase", letterSpacing: 0.5 }}>{host}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: headline ? D.tx : D.txd, marginTop: 3, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {headline || "Headline preview"}
            </div>
          </div>
          <span style={{ ...ctaBtn, borderColor: plat.c + "66", color: plat.c }}>{cta || "Learn more"}</span>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════ LIVE MODE ════════════════════════
function LiveMode({
  m, onBuild, onOpenView, focusId,
}: {
  m: ViewProps["m"];
  onBuild: () => void;
  onOpenView?: ViewProps["onOpenView"];
  focusId?: string;
}) {
  const ads = useMemo(() => m.events.filter((e) => e.type === "ad"), [m.events]);

  // The two running ads to surface prominently.
  const running = useMemo(() => {
    const byId = new Map(ads.map((a) => [a.id, a]));
    const hero = ["ad-oai", "ad-meta"].map((id) => byId.get(id)).filter(Boolean) as MarketingEvent[];
    if (hero.length) return hero;
    return ads.filter((a) => a.status === "live").slice(0, 2);
  }, [ads]);
  const heroIds = new Set(running.map((a) => a.id));

  // Portfolio totals across all ads with metrics.
  const totals = useMemo(() => {
    let spend = 0, impressions = 0, clicks = 0, conversions = 0, live = 0;
    ads.forEach((a) => {
      const mt = adPayload(a).metrics || {};
      spend += mt.spend || 0; impressions += mt.impressions || 0;
      clicks += mt.clicks || 0; conversions += mt.conversions || 0;
      if (a.status === "live") live++;
    });
    const ctr = impressions ? (clicks / impressions) * 100 : 0;
    const cpa = conversions ? spend / conversions : 0;
    return { spend, impressions, clicks, conversions, ctr, cpa, live, count: ads.length };
  }, [ads]);

  // Group the rest by platform.
  const grouped = useMemo(() => {
    const map = new Map<string, MarketingEvent[]>();
    ads.forEach((a) => {
      const key = adPayload(a).platform || a.channel || "meta";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    return AD_PLATFORMS.map((p) => ({ plat: p, items: map.get(p.key) || [] }))
      .filter((g) => g.items.length > 0);
  }, [ads]);

  return (
    <div style={liveWrap}>
      {/* Portfolio strip */}
      <div style={portfolioStrip}>
        <PortStat icon={<DollarSign size={14} />} label="Total spend" value={fmtMoney(totals.spend)} accent={D.amber} />
        <PortStat icon={<Eye size={14} />} label="Impressions" value={fmtInt(totals.impressions)} accent={D.blue} />
        <PortStat icon={<MousePointerClick size={14} />} label="Clicks" value={fmtInt(totals.clicks)} accent={D.cyan} />
        <PortStat icon={<Activity size={14} />} label="Blended CTR" value={fmtPct(totals.ctr || undefined)} accent={D.teal} />
        <PortStat icon={<Target size={14} />} label="Conversions" value={fmtInt(totals.conversions)} accent={D.violet} />
        <PortStat icon={<Gauge size={14} />} label="Blended CPA" value={fmtMoney(totals.cpa || undefined)} accent={D.coral} />
        <div style={{ flex: 1 }} />
        <button onClick={onBuild} style={newAdBtn}
          onMouseEnter={(e) => { e.currentTarget.style.background = D.amber; e.currentTarget.style.color = "#160f02"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = D.amber; }}>
          <Plus size={14} /> New ad
        </button>
      </div>

      {/* Running ads — hero row */}
      {running.length > 0 && (
        <div>
          <div style={sectionLabel}>
            <Flame size={13} color={D.coral} /> Running now
            <span style={{ fontFamily: mn, fontSize: 10, color: D.txd, marginLeft: 6 }}>{running.length} active</span>
          </div>
          <div style={heroGrid}>
            {running.map((a) => (
              <AdCard key={a.id} e={a} m={m} hero onEdit={() => onOpenView?.("kiosk", a.id)} autoEdit={focusId === a.id} />
            ))}
          </div>
        </div>
      )}

      {/* All ads, grouped by platform */}
      {grouped.map((g) => {
        const rest = g.items.filter((a) => !heroIds.has(a.id));
        if (rest.length === 0) return null;
        return (
          <div key={g.plat.key}>
            <div style={sectionLabel}>
              <span style={{ ...dot, width: 9, height: 9, background: g.plat.c, boxShadow: `0 0 8px ${g.plat.c}88` }} />
              <span style={{ fontFamily: mn, fontSize: 9.5, color: g.plat.c, letterSpacing: 0.5 }}>{g.plat.s}</span>
              <span style={{ color: D.tx, fontFamily: gf, fontSize: 13 }}>{g.plat.n}</span>
              <span style={{ fontFamily: mn, fontSize: 10, color: D.txd, marginLeft: 4 }}>{rest.length}</span>
            </div>
            <div style={cardGrid}>
              {rest.map((a) => (
                <AdCard key={a.id} e={a} m={m} onEdit={() => onOpenView?.("kiosk", a.id)} autoEdit={focusId === a.id} />
              ))}
            </div>
          </div>
        );
      })}

      {ads.length === 0 && (
        <div style={emptyState}>
          <Megaphone size={26} color={D.txd} />
          <div style={{ fontFamily: gf, fontSize: 15, color: D.tx, marginTop: 10 }}>No ads yet</div>
          <div style={{ fontSize: 12.5, color: D.txm, marginTop: 4 }}>Build your first flight in the Build tab.</div>
          <button onClick={onBuild} style={{ ...newAdBtn, marginTop: 14 }}>
            <Wand2 size={14} /> Open the builder
          </button>
        </div>
      )}
    </div>
  );
}

// ─── A single ad card: status, budget, metrics panel + inline metric editor ───
function AdCard({
  e, m, hero, onEdit, autoEdit,
}: {
  e: MarketingEvent;
  m: ViewProps["m"];
  hero?: boolean;
  onEdit: () => void;
  autoEdit?: boolean;
}) {
  const p = adPayload(e);
  const plat = adPlatform(p.platform || e.channel);
  const sColor = STATUS_COLOR[e.status];
  const mt = p.metrics || {};
  const [editing, setEditing] = useState(false);

  // Inline metric draft (raw inputs only — derived ones recompute on save).
  const [d, setD] = useState({
    spend: mt.spend != null ? String(mt.spend) : "",
    impressions: mt.impressions != null ? String(mt.impressions) : "",
    clicks: mt.clicks != null ? String(mt.clicks) : "",
    conversions: mt.conversions != null ? String(mt.conversions) : "",
  });

  useEffect(() => { if (autoEdit) setEditing(true); }, [autoEdit]);

  function commit() {
    const raw: AdMetrics = {
      ...mt,
      spend: cleanNum(d.spend),
      impressions: cleanNum(d.impressions),
      clicks: cleanNum(d.clicks),
      conversions: cleanNum(d.conversions),
    };
    const next = deriveMetrics(raw);
    m.updateEvent(e.id, { payload: { ...p, metrics: next } });
    setEditing(false);
  }

  function setStatus(s: EventStatus) {
    m.updateEvent(e.id, { status: s });
  }
  const isLive = e.status === "live";

  return (
    <div style={{ ...adCard, ...(hero ? heroCardExtra : {}) }}
      onMouseEnter={(ev) => { ev.currentTarget.style.borderColor = plat.c + "44"; ev.currentTarget.style.boxShadow = D.glowHover; }}
      onMouseLeave={(ev) => { ev.currentTarget.style.borderColor = D.border; ev.currentTarget.style.boxShadow = D.glow; }}>
      {/* head */}
      <div style={cardHead}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ ...dot, width: 9, height: 9, background: plat.c, boxShadow: `0 0 8px ${plat.c}88`, flex: "none" }} />
          <span style={{ fontFamily: mn, fontSize: 9, color: plat.c, letterSpacing: 0.4, flex: "none" }}>{plat.s}</span>
          <span style={cardTitle}>{p.headline || e.title}</span>
        </div>
        <span style={{ ...statusPill, color: sColor, borderColor: sColor + "44", background: sColor + "16" }}>
          {isLive && <span style={{ ...dot, width: 5, height: 5, background: sColor }} />}
          {STATUS_LABEL[e.status]}
        </span>
      </div>

      {/* meta line */}
      <div style={metaLine}>
        {p.objective && <span style={metaChip}><Target size={10} /> {p.objective}</span>}
        {p.budget ? <span style={metaChip}><DollarSign size={10} /> {fmtMoney(p.budget)}/{p.budgetType === "lifetime" ? "total" : "day"}</span> : null}
        {p.audience && <span style={{ ...metaChip, color: D.txm }}><Users size={10} /> {p.audience}</span>}
      </div>

      {/* metrics OR editor */}
      {editing ? (
        <div style={editorBox}>
          <div style={editorGrid}>
            <NumField label="Spend $" value={d.spend} onChange={(v) => setD((x) => ({ ...x, spend: v }))} />
            <NumField label="Impressions" value={d.impressions} onChange={(v) => setD((x) => ({ ...x, impressions: v }))} />
            <NumField label="Clicks" value={d.clicks} onChange={(v) => setD((x) => ({ ...x, clicks: v }))} />
            <NumField label="Conversions" value={d.conversions} onChange={(v) => setD((x) => ({ ...x, conversions: v }))} />
          </div>
          <div style={{ fontFamily: mn, fontSize: 9.5, color: D.txd, margin: "8px 0 6px" }}>
            CTR · CPC · CPA compute automatically on save.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={commit} style={editSaveBtn}><Check size={13} /> Save metrics</button>
            <button onClick={() => setEditing(false)} style={editCancelBtn}><X size={13} /> Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <div style={metricsGrid}>
            <Metric label="Spend" value={fmtMoney(mt.spend)} icon={<DollarSign size={11} />} accent={D.amber} />
            <Metric label="Impr." value={fmtInt(mt.impressions)} icon={<Eye size={11} />} accent={D.blue} />
            <Metric label="Clicks" value={fmtInt(mt.clicks)} icon={<MousePointerClick size={11} />} accent={D.cyan} />
            <Metric label="CTR" value={fmtPct(mt.ctr)} icon={<Activity size={11} />} accent={D.teal} />
            <Metric label="CPC" value={fmtMoney(mt.cpc)} icon={<Hash size={11} />} accent={D.violet} />
            <Metric label="Conv." value={fmtInt(mt.conversions)} icon={<Target size={11} />} accent={D.violet} />
            <Metric label="CPA" value={fmtMoney(mt.cpa)} icon={<Gauge size={11} />} accent={D.coral} />
            <Metric label="ROAS" value={fmtX(mt.roas)} icon={<TrendingUp size={11} />} accent={mt.roas && mt.roas >= 1 ? D.teal : D.coral} />
          </div>

          {/* actions */}
          <div style={cardActions}>
            <button onClick={() => setEditing(true)} style={actionBtn}
              onMouseEnter={(ev) => { ev.currentTarget.style.borderColor = D.amber + "55"; ev.currentTarget.style.color = D.amber; }}
              onMouseLeave={(ev) => { ev.currentTarget.style.borderColor = D.border; ev.currentTarget.style.color = D.txm; }}>
              <Pencil size={12} /> Update metrics
            </button>
            {isLive
              ? <button onClick={() => setStatus("scheduled")} style={actionBtn}
                  onMouseEnter={(ev) => { ev.currentTarget.style.borderColor = D.amber + "55"; ev.currentTarget.style.color = D.amber; }}
                  onMouseLeave={(ev) => { ev.currentTarget.style.borderColor = D.border; ev.currentTarget.style.color = D.txm; }}>
                  <Pause size={12} /> Pause
                </button>
              : <button onClick={() => setStatus("live")} style={actionBtn}
                  onMouseEnter={(ev) => { ev.currentTarget.style.borderColor = D.teal + "55"; ev.currentTarget.style.color = D.teal; }}
                  onMouseLeave={(ev) => { ev.currentTarget.style.borderColor = D.border; ev.currentTarget.style.color = D.txm; }}>
                  <Play size={12} /> Set live
                </button>}
            <button onClick={onEdit} style={{ ...actionBtn, marginLeft: "auto" }}
              onMouseEnter={(ev) => { ev.currentTarget.style.borderColor = D.violet + "55"; ev.currentTarget.style.color = D.violet; }}
              onMouseLeave={(ev) => { ev.currentTarget.style.borderColor = D.border; ev.currentTarget.style.color = D.txm; }}>
              <Wand2 size={12} /> Edit creative <ArrowRight size={11} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════ small components ════════════════════════
function ModeBtn({ on, onClick, icon, label, accent, count }: {
  on: boolean; onClick: () => void; icon: React.ReactNode; label: string; accent: string; count?: number;
}) {
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 15px",
      borderRadius: 9, border: "none", cursor: "pointer", transition: "all 0.16s",
      fontFamily: mn, fontSize: 11.5, letterSpacing: 0.4, textTransform: "uppercase",
      background: on ? accent + "1f" : "transparent", color: on ? accent : D.txm, fontWeight: 600,
    }}>
      {icon}{label}
      {count != null && (
        <span style={{
          fontFamily: mn, fontSize: 9.5, padding: "1px 6px", borderRadius: 999,
          background: on ? accent + "26" : D.surface, color: on ? accent : D.txd,
        }}>{count}</span>
      )}
    </button>
  );
}

function Section({ icon, label, accent, children }: {
  icon: React.ReactNode; label: string; accent: string; children: React.ReactNode;
}) {
  return (
    <div style={sectionWrap}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
        <span style={{ color: accent, display: "inline-flex" }}>{icon}</span>
        <span style={{ ...microLabel, color: accent }}>{label}</span>
      </div>
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: mn, fontSize: 9.5, color: D.txd, letterSpacing: 0.5, margin: "0 0 5px" }}>{children}</div>;
}

function CharField({ label, value, onChange, limit, placeholder, multiline }: {
  label: string; value: string; onChange: (v: string) => void; limit: number; placeholder: string; multiline?: boolean;
}) {
  const over = value.length > limit;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "0 0 5px" }}>
        <span style={{ fontFamily: mn, fontSize: 9.5, color: D.txd, letterSpacing: 0.5 }}>{label}</span>
        <span style={{ fontFamily: mn, fontSize: 9.5, color: over ? D.coral : D.txd }}>{value.length}/{limit}</span>
      </div>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          style={{ ...inputStyle, minHeight: 64, resize: "vertical", lineHeight: 1.5, borderColor: over ? D.coral + "66" : D.border }}
          onFocus={(e) => { if (!over) e.currentTarget.style.borderColor = D.amber + "66"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = over ? D.coral + "66" : D.border; }} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          style={{ ...inputStyle, borderColor: over ? D.coral + "66" : D.border }}
          onFocus={(e) => { if (!over) e.currentTarget.style.borderColor = D.amber + "66"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = over ? D.coral + "66" : D.border; }} />
      )}
    </div>
  );
}

function GuideMeta({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: "1 1 auto", minWidth: 0 }}>
      <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 11.5, color: D.tx, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
    </div>
  );
}

function PortStat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div style={portStat}>
      <span style={{ color: accent, display: "inline-flex" }}>{icon}</span>
      <div>
        <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</div>
        <div style={{ fontFamily: gf, fontSize: 16, color: D.tx, fontWeight: 700, lineHeight: 1.1 }}>{value}</div>
      </div>
    </div>
  );
}

function Metric({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent: string }) {
  return (
    <div style={metricCell}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, color: D.txd }}>
        <span style={{ color: accent, display: "inline-flex" }}>{icon}</span>
        <span style={{ fontFamily: mn, fontSize: 8.5, letterSpacing: 0.4, textTransform: "uppercase" }}>{label}</span>
      </div>
      <div style={{ fontFamily: mn, fontSize: 13, color: value === "—" ? D.txd : D.tx, fontWeight: 600, marginTop: 3 }}>{value}</div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input value={value} onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal"
        placeholder="0" style={{ ...inputStyle, fontFamily: mn, fontSize: 13, padding: "8px 10px" }}
        onFocus={(e) => { e.currentTarget.style.borderColor = D.teal + "66"; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = D.border; }} />
    </div>
  );
}

// ════════════════════════ styles ════════════════════════
const page: React.CSSProperties = { padding: "22px 26px 48px" };
const headRow: React.CSSProperties = {
  display: "flex", alignItems: "flex-start", justifyContent: "space-between",
  gap: 16, marginBottom: 22, flexWrap: "wrap",
};
const h1Style: React.CSSProperties = {
  margin: 0, fontFamily: gf, fontSize: 26, fontWeight: 700, letterSpacing: 0.3,
  display: "flex", alignItems: "center", gap: 10, color: D.tx,
};
const subStyle: React.CSSProperties = { marginTop: 6, fontSize: 12.5, color: D.txm, maxWidth: 640, lineHeight: 1.5 };
const modeToggle: React.CSSProperties = {
  display: "inline-flex", gap: 3, padding: 3, borderRadius: 12,
  border: `1px solid ${D.border}`, background: D.card,
};
const microLabel: React.CSSProperties = { fontFamily: mn, fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase" };
const dot: React.CSSProperties = { width: 7, height: 7, borderRadius: 999, flex: "none", display: "inline-block" };

// ── Build layout ──
const buildGrid: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "minmax(340px, 1fr) minmax(320px, 460px)",
  gap: 20, alignItems: "start",
};
const builderCol: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 14,
  borderRadius: 16, border: `1px solid ${D.border}`, background: D.cardGrad, padding: 20, boxShadow: D.glow,
};
const editBanner: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 10,
  border: `1px solid ${D.amber}33`, background: D.amber + "0d", fontSize: 12, color: D.txm,
};
const sectionWrap: React.CSSProperties = {
  paddingBottom: 14, borderBottom: `1px solid ${D.border}`,
};
const chipWrap: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 7 };
function platChip(on: boolean, c: string): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 12px",
    borderRadius: 9, cursor: "pointer", transition: "all 0.15s", fontSize: 12, fontFamily: ft,
    border: `1px solid ${on ? c + "66" : D.border}`, background: on ? c + "14" : "transparent",
  };
}
function pill(on: boolean, c: string): React.CSSProperties {
  return {
    padding: "7px 13px", borderRadius: 999, cursor: "pointer", transition: "all 0.15s",
    fontSize: 12, fontFamily: ft, color: on ? D.tx : D.txm,
    border: `1px solid ${on ? c + "55" : D.border}`, background: on ? c + "18" : "transparent",
  };
}
const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", borderRadius: 9, border: `1px solid ${D.border}`,
  background: D.bg, color: D.tx, fontFamily: ft, fontSize: 12.5, padding: "9px 11px",
  outline: "none", transition: "border-color 0.15s",
};
const budgetField: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 4, padding: "0 11px", borderRadius: 9,
  border: `1px solid ${D.border}`, background: D.bg, flex: "0 0 130px",
};
const budgetInput: React.CSSProperties = {
  width: "100%", border: "none", outline: "none", background: "transparent",
  color: D.tx, fontFamily: mn, fontSize: 16, fontWeight: 600, padding: "9px 0",
};
const segTwo: React.CSSProperties = {
  display: "inline-flex", gap: 2, padding: 3, borderRadius: 9, border: `1px solid ${D.border}`, background: D.card,
};
function segTwoBtn(on: boolean): React.CSSProperties {
  return {
    padding: "7px 13px", borderRadius: 7, border: "none", cursor: "pointer", transition: "all 0.15s",
    fontFamily: mn, fontSize: 10.5, letterSpacing: 0.4, textTransform: "uppercase",
    background: on ? D.teal + "20" : "transparent", color: on ? D.teal : D.txm,
  };
}
const saveBar: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginTop: 2,
};
const saveBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 10,
  border: "none", cursor: "pointer", transition: "all 0.18s",
  fontFamily: mn, fontSize: 12.5, fontWeight: 700, letterSpacing: 0.4,
};

// ── Preview column ──
const previewCol: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 16,
};
const previewWrap: React.CSSProperties = {
  borderRadius: 16, border: `1px solid ${D.border}`, background: D.surfGrad, padding: 16, boxShadow: D.glow,
};
const previewBar: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 7, marginBottom: 12,
  paddingBottom: 11, borderBottom: `1px solid ${D.border}`,
};
const adUnit: React.CSSProperties = {
  borderRadius: 12, border: "1px solid", background: D.card, padding: 14, overflow: "hidden",
};
const advRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 9, marginBottom: 10 };
const advLogo: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 9, flex: "none", display: "flex", alignItems: "center",
  justifyContent: "center", fontFamily: gf, fontSize: 13, fontWeight: 800, color: "#0c0a06",
};
const heroBox: React.CSSProperties = {
  borderRadius: 10, minHeight: 120, display: "flex", alignItems: "center", justifyContent: "center",
  border: `1px solid ${D.border}`, marginBottom: 11,
};
const linkCard: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 10,
  border: `1px solid ${D.border}`, background: D.bg,
};
const ctaBtn: React.CSSProperties = {
  flex: "none", padding: "7px 13px", borderRadius: 8, border: "1px solid",
  fontFamily: mn, fontSize: 10.5, fontWeight: 600, letterSpacing: 0.3, whiteSpace: "nowrap",
};
const guideCard: React.CSSProperties = {
  borderRadius: 16, border: `1px solid ${D.border}`, background: D.cardGrad, padding: 16, boxShadow: D.glow,
};
const guideHead: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
  paddingBottom: 11, borderBottom: `1px solid ${D.border}`,
};
const guideMetaRow: React.CSSProperties = {
  display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 12,
};
const tipList: React.CSSProperties = { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 };
const tipItem: React.CSSProperties = {
  display: "flex", alignItems: "flex-start", gap: 7, fontSize: 12, color: D.txm, lineHeight: 1.45,
};

// ── Live layout ──
const liveWrap: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 22 };
const portfolioStrip: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
  borderRadius: 16, border: `1px solid ${D.border}`, background: D.cardGrad, padding: "14px 18px", boxShadow: D.glow,
};
const portStat: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 9, padding: "2px 16px 2px 0",
  borderRight: `1px solid ${D.border}`,
};
const newAdBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 15px", borderRadius: 9,
  border: `1px solid ${D.amber}55`, background: "transparent", color: D.amber,
  fontFamily: mn, fontSize: 11.5, fontWeight: 600, letterSpacing: 0.3, cursor: "pointer", transition: "all 0.16s",
};
const sectionLabel: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 12.5, color: D.tx,
};
const heroGrid: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 16,
};
const cardGrid: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 16,
};
const adCard: React.CSSProperties = {
  borderRadius: 16, border: `1px solid ${D.border}`, background: D.cardGrad, padding: 16,
  boxShadow: D.glow, transition: "all 0.18s", display: "flex", flexDirection: "column", gap: 11,
};
const heroCardExtra: React.CSSProperties = {
  background: D.surfGrad, borderColor: "rgba(255,255,255,0.09)",
};
const cardHead: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
};
const cardTitle: React.CSSProperties = {
  fontSize: 13.5, fontWeight: 600, color: D.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};
const statusPill: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5, flex: "none",
  fontFamily: mn, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, padding: "4px 9px",
  borderRadius: 999, border: "1px solid", textTransform: "uppercase",
};
const metaLine: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 7 };
const metaChip: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 4, fontFamily: mn, fontSize: 10, color: D.txm,
  padding: "3px 8px", borderRadius: 7, border: `1px solid ${D.border}`, background: D.bg,
  maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};
const metricsGrid: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1,
  borderRadius: 11, overflow: "hidden", border: `1px solid ${D.border}`, background: D.border,
};
const metricCell: React.CSSProperties = {
  padding: "9px 11px", background: D.bg,
};
const cardActions: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" };
const actionBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 8,
  border: `1px solid ${D.border}`, background: "transparent", color: D.txm,
  fontFamily: mn, fontSize: 10.5, letterSpacing: 0.3, cursor: "pointer", transition: "all 0.15s",
};
const editorBox: React.CSSProperties = {
  borderRadius: 12, border: `1px solid ${D.teal}33`, background: D.teal + "0a", padding: 13,
};
const editorGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 };
const editSaveBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8,
  border: "none", background: D.teal, color: "#06120e", fontFamily: mn, fontSize: 11, fontWeight: 700,
  letterSpacing: 0.3, cursor: "pointer",
};
const editCancelBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8,
  border: `1px solid ${D.border}`, background: "transparent", color: D.txm,
  fontFamily: mn, fontSize: 11, letterSpacing: 0.3, cursor: "pointer",
};
const emptyState: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
  padding: "60px 20px", borderRadius: 16, border: `1px dashed ${D.border}`, background: D.card,
};
