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
  Clapperboard, TrendingUp, BarChart3, Newspaper, CalendarClock, type LucideIcon,
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
  gcalEventId?: string | null;  // set once the event exists on Google
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
  // ─ Rollout lifecycle (optional, back-compatible) ─
  // A "podcast" series fans each release into a full lifecycle (a Rollout);
  // a "simple"/undefined series keeps the legacy one-event-per-release behavior.
  kind?: "podcast" | "simple";
  stages?: StageDef[];
  guests?: string[];
  baseTitle?: string;       // drives episodeTitles() for the release/clip events
}

// ─── Rollout lifecycle stages ───
// A Rollout is one release cycle of a campaign: a release date + the lead-up
// work (topic → film → edit) → release → post (clips). Offsets are relative to
// the release day (day 0). Stages reuse existing EventTypes + SCHEDULE_KINDS so
// no closed union changes are needed.
export type EpisodeStageKey = "topic" | "film" | "edit" | "release" | "clips";
export interface StageDef {
  key: EpisodeStageKey;
  label: string;
  type: EventType;
  scheduleKind?: string;
  offsetDays: number;       // relative to release (0 = release day)
  durationMins?: number;
  status: EventStatus;
}
export const PODCAST_LIFECYCLE: StageDef[] = [
  { key: "topic",   label: "Topic lock", type: "strategy",   offsetDays: -10, status: "idea" },
  { key: "film",    label: "Film",       type: "production", scheduleKind: "filming",  offsetDays: -7, durationMins: 180, status: "idea" },
  { key: "edit",    label: "Edit",       type: "production", scheduleKind: "editing",  offsetDays: -3, status: "idea" },
  { key: "release", label: "Release",    type: "launch",     scheduleKind: "deadline", offsetDays: 0,  status: "idea" },
  { key: "clips",   label: "Clips",      type: "clip",       offsetDays: 1,  status: "idea" },
];
export function stageOf(key?: string | null): StageDef | undefined {
  return PODCAST_LIFECYCLE.find((s) => s.key === key);
}

// SA Weekly title format (see memory sa_weekly_title_format): YouTube caps at
// 100 chars off the base title; Spotify appends ` | guest, guest…` up to 200.
export function episodeTitles(base: string, guests: string[] = []): { youtube: string; spotify: string } {
  const youtube = base.slice(0, 100);
  const spotify = (base + (guests.length ? ` | ${guests.join(", ")}` : "")).slice(0, 200);
  return { youtube, spotify };
}
// Canonical frequent-guest roster seeded into the lifecycle guest quick-pick.
export const SA_FREQUENT_GUESTS = [
  "Dylan Patel", "Daniel Nishball", "Doug O'Laughlin", "Jon Peddie", "Wei Chen",
];

// Spread `count` prep dates leading UP TO `releaseISO` (the last task lands the
// day before release, earlier tasks step back one day each). Earliest-first.
// This is the inverse of the old forward `start + i` spread.
export function leadUpDates(releaseISO: string, count: number): string[] {
  if (count <= 0) return [];
  const rel = new Date(releaseISO);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const back = count - i;           // i=count-1 → back=1 (day before release)
    const d = new Date(rel);
    d.setDate(d.getDate() - back);
    out.push(d.toISOString());
  }
  return out;
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
  | "today" | "schedule" | "calendar" | "timeline" | "board" | "campaigns"
  | "kiosk" | "trends" | "analytics" | "brief";
export interface ViewDef { id: ViewId; label: string; Icon: LucideIcon; accent: string; }
export const VIEWS: ViewDef[] = [
  { id: "today",     label: "Today",    Icon: LayoutDashboard, accent: D.amber },
  { id: "schedule",  label: "Agenda",   Icon: CalendarClock,   accent: D.amber },
  { id: "calendar",  label: "Calendar", Icon: CalendarDays,    accent: D.cyan },
  { id: "timeline",  label: "Timeline", Icon: GanttChart,      accent: D.teal },
  { id: "board",     label: "Board",    Icon: KanbanSquare,    accent: D.blue },
  { id: "campaigns", label: "Campaigns",Icon: Megaphone,       accent: D.violet },
  { id: "kiosk",     label: "Ad Kiosk", Icon: Clapperboard,    accent: D.violet },
  { id: "trends",    label: "Trends",   Icon: TrendingUp,      accent: D.coral },
  { id: "analytics", label: "Data",     Icon: BarChart3,       accent: D.teal },
  { id: "brief",     label: "Brief",    Icon: Newspaper,       accent: D.amber },
];

// ─── Omni-create contract (Assistant + Add buttons + modals) ───
// Every "add" in the suite routes through one create layer. CreateKind picks
// which rich modal opens; the Assistant classifies free text/paste into one of
// these (or "help" for a conversational answer).
export type CreateKind = "task" | "schedule" | "campaign" | "ad";

// Schedule items are marketing events carrying payload.scheduleKind. Each kind
// maps to an underlying EventType for the timeline/calendar lanes + a color.
export interface ScheduleKindDef { key: string; label: string; type: EventType; color: string; }
export const SCHEDULE_KINDS: ScheduleKindDef[] = [
  { key: "meeting",  label: "Meeting",    type: "manual",     color: D.blue },
  { key: "filming",  label: "Filming",    type: "production", color: D.amber },
  { key: "editing",  label: "Editing",    type: "production", color: D.violet },
  { key: "review",   label: "Review",     type: "manual",     color: D.violet },
  { key: "deadline", label: "Deadline",   type: "launch",     color: D.coral },
  { key: "block",    label: "Time block", type: "manual",     color: D.teal },
  { key: "booking",  label: "Booking",    type: "manual",     color: D.cyan },
];
export function scheduleKindOf(key?: string | null): ScheduleKindDef {
  return SCHEDULE_KINDS.find((k) => k.key === key)
    || { key: "block", label: "Scheduled", type: "manual", color: D.teal };
}

// Task categories mirror the master board's CATEGORIES so a task created here
// round-trips cleanly into projects/akash-todo-master.
export const TASK_CATEGORIES = [
  "GRAPHIC DESIGN", "MARKETING OPS", "VIDEO PRODUCTION", "BRAND / IDENTITY",
  "DEV / ACCESS", "CONTENT OPS", "PODCAST", "EVENTS", "RESEARCH", "ADMIN", "OTHER",
];
export const TASK_PRIORITIES = ["HIGH", "MEDIUM", "THIS WEEK", "ONGOING"];
export const TASK_ASSIGNEES = ["Akash", "Daksh", "Vansh", "Max", "Michelle", "Unassigned"];

// Target calendars for a scheduled item. Until Google Calendar is connected
// (Phase 4) only the in-app SA Marketing calendar exists; connected Google
// calendars get appended to this list at runtime.
export interface CalendarTarget { id: string; name: string; color: string; google?: boolean; }
export const DEFAULT_CALENDARS: CalendarTarget[] = [
  { id: "sa-marketing", name: "SA Marketing", color: D.amber },
];

// ─── Event field accessors ───
// Google-synced events stash their extra fields in payload; these read them
// safely so the editor, hover card and write-back all agree on one shape.
export function eventCalendarId(e: MarketingEvent): string {
  const c = e.payload?.calendarId;
  return typeof c === "string" && c ? c : "sa-marketing";
}
export function eventLocation(e: MarketingEvent): string {
  const v = e.payload?.location;
  return typeof v === "string" ? v : "";
}
export function eventAttendees(e: MarketingEvent): string[] {
  const v = e.payload?.attendees;
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
export function eventMeetLink(e: MarketingEvent): string {
  const v = e.payload?.meetLink ?? e.payload?.hangoutLink;
  return typeof v === "string" ? v : "";
}
export function eventHtmlLink(e: MarketingEvent): string {
  const v = e.payload?.gcalHtmlLink ?? e.payload?.htmlLink;
  return typeof v === "string" ? v : "";
}
// ─ Rollout / lifecycle accessors (parallel to payload.calendarId) ─
export function eventSeries(e: MarketingEvent): string | null {
  const v = e.payload?.series;
  return typeof v === "string" && v ? v : null;
}
export function eventRollout(e: MarketingEvent): string | null {
  const v = e.payload?.rollout;
  return typeof v === "string" && v ? v : null;
}
export function eventStage(e: MarketingEvent): string | null {
  const v = e.payload?.stage;
  return typeof v === "string" && v ? v : null;
}
export function eventEpisodeNo(e: MarketingEvent): number | null {
  const v = e.payload?.episodeNo;
  return typeof v === "number" ? v : null;
}
export function eventRelease(e: MarketingEvent): string | null {
  const v = e.payload?.release;
  return typeof v === "string" && v ? v : null;
}
// Prep tasks created with the "unassigned" toggle carry no real date.
export function isUnscheduled(e: MarketingEvent): boolean {
  return e.payload?.unscheduled === true;
}

// True for Google all-day events. Uses the explicit flag when present, else a
// heuristic for events synced before the flag existed (midnight start spanning
// ~a full day) so they don't render as a giant block over the whole grid.
export function isAllDayEvent(e: MarketingEvent): boolean {
  if (e.payload?.allDay === true) return true;
  const s = new Date(e.start);
  if (s.getHours() !== 0 || s.getMinutes() !== 0) return false;
  if (!e.end) return false;
  return new Date(e.end).getTime() - s.getTime() >= 23 * 3600_000;
}

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
      series: [{ id: "s1", name: "SemiAnalysis Weekly", frequencyDays: 7, firstRelease: atDay(now, 5, 9), count: 4,
        channel: "youtube", kind: "podcast", stages: PODCAST_LIFECYCLE, baseTitle: "The Memory Wars", guests: ["Dylan Patel"] }] },
    { id: "camp-launch", name: "Q3 Recap Launch", color: D.teal, status: "planning",
      goal: "Coordinated multi-channel recap drop", start: atDay(now, 8), end: atDay(now, 14), series: [] },
    { id: "camp-ad", name: "Always-On Acquisition", color: D.crimson, status: "active",
      goal: "Meta + OpenAI retargeting", start: atDay(now, -20), end: atDay(now, 30), series: [] },
  ];
  // EP18 — a demo Rollout (one release cycle) so the rollout views light up.
  const ep18 = { series: "s1", rollout: "s1-ep18", episodeNo: 18, release: atDay(now, 5, 9) };
  const events: MarketingEvent[] = [
    { id: "e1", title: "EP17 short → IG", type: "buffer", status: "scheduled", start: atDay(now, 0, 11), source: "buffer", channel: "instagram", campaignId: "camp-ep" },
    { id: "e2", title: "EP17 short → TikTok", type: "buffer", status: "scheduled", start: atDay(now, 0, 14), source: "buffer", channel: "tiktok", campaignId: "camp-ep" },
    { id: "e3", title: "EP17 hook → X", type: "buffer", status: "live", start: atDay(now, 0, 9), source: "buffer", channel: "x", campaignId: "camp-ep" },
    { id: "e-ep18-topic", title: "Topic lock: The Memory Wars", type: "strategy", status: "done", start: atDay(now, -5, 10), source: "poast", campaignId: "camp-ep", payload: { ...ep18, stage: "topic" } },
    { id: "e4", title: "Record EP18", type: "production", status: "scheduled", start: atDay(now, 2, 13), end: atDay(now, 2, 16), source: "poast", campaignId: "camp-ep", payload: { ...ep18, stage: "film", scheduleKind: "filming" } },
    { id: "e5", title: "Edit EP18", type: "production", status: "draft", start: atDay(now, 1, 15), source: "poast", campaignId: "camp-ep", payload: { ...ep18, stage: "edit", scheduleKind: "editing" } },
    { id: "e6", title: "Clip batch 14", type: "clip", status: "scheduled", start: atDay(now, 6, 10), source: "poast", campaignId: "camp-ep", payload: { ...ep18, stage: "clips" } },
    { id: "e7", title: "EP18 launch", type: "launch", status: "idea", start: atDay(now, 5, 9), source: "manual", campaignId: "camp-ep", payload: { ...ep18, stage: "release", scheduleKind: "deadline" } },
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
  estimateMins?: number; description?: string;
  subtasks?: { id: string; title: string; done?: boolean }[];
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
