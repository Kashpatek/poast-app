// ═══ MarketingSUITE · shared contract ═══
// Types, color maps, the view registry, and the demo dataset every view
// renders from. This is the single source of truth the shell + all views
// import — keep it stable so the views compose cleanly.
//
// Styling rule for this module: inline React.CSSProperties + the D tokens
// only (no Tailwind / CSS modules). Icons come from lucide-react PascalCase
// components — NOTE lucide-react@1.8 has NO brand icons (Facebook/Twitter/
// Instagram/YouTube), so channels use a color dot + short code, never a
// brand glyph.

import { D, PL } from "../shared-constants";
import {
  LayoutDashboard, CalendarDays, GanttChart, KanbanSquare, Megaphone,
  Clapperboard, TrendingUp, BarChart3, Newspaper, type LucideIcon,
} from "lucide-react";

// ─── Core types ───
export type EventType =
  | "campaign" | "buffer" | "production" | "clip" | "launch"
  | "ad" | "strategy" | "kiosk" | "manual";
export type EventStatus = "idea" | "draft" | "scheduled" | "live" | "done" | "blocked";
export type EventSource = "manual" | "buffer" | "poast" | "brianna" | "gcal";

export interface MarketingEvent {
  id: string;
  title: string;
  type: EventType;
  status: EventStatus;
  start: string;            // ISO datetime
  end?: string | null;      // ISO datetime
  campaignId?: string | null;
  channel?: string | null;  // tiktok | youtube | x | instagram | linkedin | facebook
  source: EventSource;
  notes?: string | null;
  payload?: Record<string, unknown>;
}

export interface SeriesDef {
  id: string;
  name: string;
  frequencyDays: number;    // 7 | 14 | 30 ...
  firstRelease: string;     // ISO date
  count: number;
  channel?: string;
}

export type CampaignStatus = "planning" | "active" | "wrapping" | "done";
export interface Campaign {
  id: string;
  name: string;
  color: string;
  status: CampaignStatus;
  goal?: string | null;
  start?: string | null;
  end?: string | null;
  series: SeriesDef[];
  payload?: Record<string, unknown>;
}

// ─── Color maps ───
export const STATUS_COLOR: Record<EventStatus, string> = {
  idea: D.txm, draft: D.blue, scheduled: D.amber, live: D.teal, done: D.txd, blocked: D.coral,
};
export const STATUS_LABEL: Record<EventStatus, string> = {
  idea: "Idea", draft: "Draft", scheduled: "Scheduled", live: "Live", done: "Done", blocked: "Blocked",
};
export const TYPE_COLOR: Record<EventType, string> = {
  campaign: D.violet, buffer: D.cyan, production: D.amber, clip: D.coral,
  launch: D.teal, ad: D.crimson, strategy: D.blue, kiosk: D.violet, manual: D.txm,
};
// Channel → {color, short code}. No brand icons in lucide 1.8 — use these.
export const CHANNEL: Record<string, { c: string; s: string; n: string }> = {
  tiktok: { c: PL.tt, s: "TT", n: "TikTok" },
  youtube: { c: PL.yt, s: "YT", n: "YouTube" },
  x: { c: PL.x, s: "X", n: "X / Twitter" },
  twitter: { c: PL.x, s: "X", n: "X / Twitter" },
  instagram: { c: PL.ig, s: "IG", n: "Instagram" },
  ig: { c: PL.ig, s: "IG", n: "Instagram" },
  linkedin: { c: PL.li, s: "LI", n: "LinkedIn" },
  facebook: { c: PL.fb, s: "FB", n: "Facebook" },
  meta: { c: PL.fb, s: "M", n: "Meta" },
};
export function channelOf(key?: string | null) {
  if (!key) return { c: D.txm, s: "•", n: "—" };
  return CHANNEL[key.toLowerCase()] || { c: D.txm, s: key.slice(0, 2).toUpperCase(), n: key };
}

// ─── View registry (shell left-nav order) ───
export type ViewId =
  | "today" | "calendar" | "timeline" | "board" | "campaigns"
  | "kiosk" | "trends" | "analytics" | "brief";
export interface ViewDef { id: ViewId; label: string; Icon: LucideIcon; accent: string; }
export const VIEWS: ViewDef[] = [
  { id: "today",     label: "Today",    Icon: LayoutDashboard, accent: D.amber },
  { id: "calendar",  label: "Calendar", Icon: CalendarDays,    accent: D.cyan },
  { id: "timeline",  label: "Timeline", Icon: GanttChart,      accent: D.teal },
  { id: "board",     label: "Board",    Icon: KanbanSquare,    accent: D.blue },
  { id: "campaigns", label: "Campaigns",Icon: Megaphone,       accent: D.violet },
  { id: "kiosk",     label: "Ad Kiosk", Icon: Clapperboard,    accent: D.violet },
  { id: "trends",    label: "Trends",   Icon: TrendingUp,      accent: D.coral },
  { id: "analytics", label: "Data",     Icon: BarChart3,       accent: D.teal },
  { id: "brief",     label: "Brief",    Icon: Newspaper,       accent: D.amber },
];

// ─── Date helpers (demo data anchors to "now" so views stay meaningful) ───
function atDay(base: Date, deltaDays: number, hour = 9, min = 0): string {
  const d = new Date(base);
  d.setDate(d.getDate() + deltaDays);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
}

// ─── Demo dataset ───
// Used until the Supabase tables exist / egress is restored, so the suite is
// fully reviewable. Dates are relative to today.
export function makeDemoData(): { events: MarketingEvent[]; campaigns: Campaign[] } {
  const now = new Date();
  const campaigns: Campaign[] = [
    { id: "camp-ep", name: "EP Series · Memory Wars", color: D.amber, status: "active",
      goal: "Drive subs off the HBM4 episode arc", start: atDay(now, -6), end: atDay(now, 20),
      series: [{ id: "s1", name: "Weekly short", frequencyDays: 7, firstRelease: atDay(now, 1, 11), count: 6, channel: "tiktok" }] },
    { id: "camp-launch", name: "Q3 Recap Launch", color: D.teal, status: "planning",
      goal: "Coordinated multi-channel recap drop", start: atDay(now, 8), end: atDay(now, 14), series: [] },
    { id: "camp-ad", name: "Always-On Acquisition", color: D.crimson, status: "active",
      goal: "Meta + OpenAI retargeting", start: atDay(now, -20), end: atDay(now, 30), series: [] },
  ];
  const events: MarketingEvent[] = [
    { id: "e1", title: "EP17 short → IG", type: "buffer", status: "scheduled", start: atDay(now, 0, 11), source: "buffer", channel: "instagram", campaignId: "camp-ep" },
    { id: "e2", title: "EP17 short → TikTok", type: "buffer", status: "scheduled", start: atDay(now, 0, 14), source: "buffer", channel: "tiktok", campaignId: "camp-ep" },
    { id: "e3", title: "EP17 hook → X", type: "buffer", status: "live", start: atDay(now, 0, 9), source: "buffer", channel: "x", campaignId: "camp-ep" },
    { id: "e4", title: "Record EP18", type: "production", status: "scheduled", start: atDay(now, 2, 13), end: atDay(now, 2, 16), source: "poast" },
    { id: "e5", title: "EP18 thumbnail review", type: "production", status: "draft", start: atDay(now, 1, 15), source: "poast" },
    { id: "e6", title: "Clip batch 14", type: "clip", status: "scheduled", start: atDay(now, 1, 10), source: "poast", campaignId: "camp-ep" },
    { id: "e7", title: "EP18 launch", type: "launch", status: "idea", start: atDay(now, 5, 9), source: "manual", campaignId: "camp-ep" },
    { id: "e8", title: "Meta flight · EP series", type: "ad", status: "live", start: atDay(now, -3, 9), end: atDay(now, 12, 9), source: "manual", channel: "meta", campaignId: "camp-ad" },
    { id: "e9", title: "OpenAI retarget flight", type: "ad", status: "live", start: atDay(now, -1, 9), end: atDay(now, 9, 9), source: "manual", channel: "meta", campaignId: "camp-ad" },
    { id: "e10", title: "Q3 recap thread → X", type: "buffer", status: "draft", start: atDay(now, 3, 12), source: "buffer", channel: "x", campaignId: "camp-launch" },
    { id: "e11", title: "Q3 recap carousel → LinkedIn", type: "buffer", status: "idea", start: atDay(now, 8, 10), source: "buffer", channel: "linkedin", campaignId: "camp-launch" },
    { id: "e12", title: "Afrobeat hook clip", type: "clip", status: "idea", start: atDay(now, 4, 11), source: "manual", campaignId: "camp-ep" },
    { id: "e13", title: "Kiosk: HBM4 ad v2", type: "kiosk", status: "draft", start: atDay(now, 2, 10), source: "manual", channel: "meta", campaignId: "camp-ad" },
    { id: "e14", title: "Strategy: Q4 calendar", type: "strategy", status: "idea", start: atDay(now, 6, 14), source: "manual" },
    { id: "e15", title: "EP19 record", type: "production", status: "idea", start: atDay(now, 9, 13), end: atDay(now, 9, 16), source: "poast" },
    { id: "e16", title: "Weekly short #2 → TikTok", type: "buffer", status: "scheduled", start: atDay(now, 8, 11), source: "buffer", channel: "tiktok", campaignId: "camp-ep" },
    { id: "e17", title: "BRIANNA: retention dip flag", type: "strategy", status: "blocked", start: atDay(now, -1, 16), source: "brianna" },
    { id: "e18", title: "EP16 recap → YouTube", type: "buffer", status: "done", start: atDay(now, -2, 12), source: "buffer", channel: "youtube" },
  ];
  return { events: [...events, ...demoAds(now)], campaigns };
}

// ═══ Ads ═══
// Ads are persisted as marketing events with type 'ad': channel = platform key,
// payload = AdPayload (objective, budget, creative, and user-entered metrics).
// The Ad Kiosk is the builder + live tracker; Campaigns links into it.
export const AD_PLATFORMS: { key: string; n: string; s: string; c: string }[] = [
  { key: "openai",   n: "OpenAI",         s: "OAI",  c: D.coral },
  { key: "x",        n: "X",              s: "X",    c: PL.x },
  { key: "meta",     n: "Meta · FB/IG",   s: "META", c: PL.fb },
  { key: "linkedin", n: "LinkedIn",       s: "LI",   c: PL.li },
  { key: "adsense",  n: "Google AdSense", s: "ADS",  c: D.teal },
];
export function adPlatform(key?: string | null) {
  if (!key) return { key: "", n: "—", s: "•", c: D.txm };
  return AD_PLATFORMS.find((p) => p.key === key.toLowerCase()) || { key, n: key, s: key.slice(0, 3).toUpperCase(), c: D.txm };
}
export interface AdMetrics {
  spend?: number; impressions?: number; clicks?: number; ctr?: number;
  cpc?: number; conversions?: number; cpa?: number; roas?: number;
}
export interface AdPayload {
  platform?: string; objective?: string; budget?: number; budgetType?: "daily" | "lifetime";
  audience?: string; creativeBrief?: string; headline?: string; body?: string; cta?: string;
  landing?: string; metrics?: AdMetrics; metricsHistory?: (AdMetrics & { date: string })[];
}
export function adPayload(e: MarketingEvent): AdPayload { return (e.payload || {}) as AdPayload; }
export const AD_OBJECTIVES = ["Awareness", "Traffic", "Engagement", "Conversions", "Leads", "App installs"];

// ═══ Today launchboard — editable module catalog ═══
export interface ModuleDef { id: string; label: string; desc: string; span?: 1 | 2; }
export const MODULE_CATALOG: ModuleDef[] = [
  { id: "schedule",   label: "Today's schedule", desc: "Everything going out today", span: 2 },
  { id: "weekheat",   label: "Week heat",        desc: "Next 7 days at a glance", span: 1 },
  { id: "campaigns",  label: "Active campaigns", desc: "What's in flight", span: 1 },
  { id: "ads",        label: "Live ads",         desc: "Running flights + pacing", span: 1 },
  { id: "trends",     label: "Trends pulse",     desc: "Rising signals teaser", span: 1 },
  { id: "tasks",      label: "Tasks",            desc: "Board snapshot", span: 1 },
  { id: "efficiency", label: "Efficiency",       desc: "Throughput snapshot", span: 1 },
  { id: "deadlines",  label: "Deadlines",        desc: "Soonest ticking", span: 1 },
  { id: "brief",      label: "Daily brief",      desc: "Standup summary", span: 2 },
  { id: "kiosk",      label: "Ad Kiosk",         desc: "Jump to the ad builder", span: 1 },
  { id: "notes",      label: "Notes",            desc: "Scratchpad", span: 1 },
];
export const DEFAULT_MODULES = ["schedule", "weekheat", "campaigns", "ads", "deadlines", "trends", "tasks", "kiosk"];

// ═══ Efficiency — read the REAL task board cache when present ═══
// Mirrors the board's localStorage key so the Data view can compute real
// throughput / cycle-time; falls back to [] (the view supplies demo data).
export interface BoardTaskLite {
  id: string; title: string; category?: string; assignee?: string; priority?: string;
  done?: boolean; addedAt?: string; updatedAt?: string; dueDate?: string;
}
export function readBoardTasks(): BoardTaskLite[] {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem("akash-todo-master-cache") : null;
    if (!raw) return [];
    const arch = JSON.parse(raw);
    const out: BoardTaskLite[] = [];
    (arch.boards || []).forEach((b: { tasks?: BoardTaskLite[] }) => (b.tasks || []).forEach((t) => out.push(t)));
    return out;
  } catch { return []; }
}

// ═══ Demo ads (rich payloads; merged into demo events) ═══
export function demoAds(now: Date): MarketingEvent[] {
  const d = (delta: number, h = 9) => atDay(now, delta, h);
  return [
    { id: "ad-oai", title: "OpenAI · 'Memory margins' awareness", type: "ad", status: "live", start: d(-4), end: d(10), source: "manual", channel: "openai", campaignId: "camp-ad",
      payload: { platform: "openai", objective: "Awareness", budget: 80, budgetType: "daily", audience: "AI / infra decision-makers",
        headline: "The memory wall is the AI wall", body: "Why HBM4 decides who ships frontier models.", cta: "Read the analysis", landing: "semianalysis.com",
        metrics: { spend: 2360, impressions: 412000, clicks: 1880, ctr: 0.46, cpc: 1.26, conversions: 64, cpa: 36.9, roas: 1.1 } } },
    { id: "ad-meta", title: "Meta · EP series retarget", type: "ad", status: "live", start: d(-3), end: d(12), source: "manual", channel: "meta", campaignId: "camp-ad",
      payload: { platform: "meta", objective: "Conversions", budget: 60, budgetType: "daily", audience: "Site visitors 30d · lookalike 1%",
        headline: "Catch the Memory Wars series", body: "Three episodes on the HBM4 arc.", cta: "Subscribe", landing: "semianalysis.com/subscribe",
        metrics: { spend: 940, impressions: 286000, clicks: 3120, ctr: 1.09, cpc: 0.30, conversions: 142, cpa: 6.6, roas: 3.4 } } },
    { id: "ad-x", title: "X · Q3 recap promote", type: "ad", status: "idea", start: d(3), source: "manual", channel: "x", campaignId: "camp-launch",
      payload: { platform: "x", objective: "Engagement", budget: 40, budgetType: "daily", audience: "Followers + semis keywords",
        headline: "Q3 in semis: the numbers", cta: "View thread", metrics: {} } },
  ];
}
