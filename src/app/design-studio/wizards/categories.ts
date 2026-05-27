// What the user is making → which sizes/tools fit.
// Wizards filter size presets by `sizeGroups` for the category the user picks.
// The doc wizard, graphic wizard, and image wizard all read from this catalog.

import type { SizeGroup } from "./size-presets";

export type StudioTool = "doc" | "graphic" | "image" | "motion" | "programmatic" | "quote" | "event" | "custom" | "rebuild";

export interface Category {
  id: string;
  label: string;
  sub: string;
  // Which DesignStudio tool this category lives in.
  tool: StudioTool;
  // Which size groups should appear when the user opens "Show all sizes."
  sizeGroups: SizeGroup[];
  // Default size preset id (must exist in size-presets.ts).
  defaultPreset?: string;
  // Curated "you probably want one of these" set — shown first as a tight
  // grid before the full size catalog. 3-5 preset ids typically.
  recommendedPresets?: string[];
  // Used by wizard step 2 to pre-fill copy fields.
  hints?: {
    audience?: string;
    tone?: string;
    suggestedSections?: string[];
  };
}

// Documents — multi-page or single-page paginated outputs.
export const DOC_CATEGORIES: Category[] = [
  {
    id: "one-pager",
    label: "One-pager",
    sub: "Single page, headline + 3-5 sections, optional chart",
    tool: "doc",
    sizeGroups: ["print", "presentation"],
    defaultPreset: "us-letter-screen",
    recommendedPresets: ["us-letter-screen", "a4", "slide-16-9"],
    hints: { suggestedSections: ["Headline", "Context", "Key data", "Implications", "Next step"] },
  },
  {
    id: "report",
    label: "Report / brief",
    sub: "Multi-page research write-up",
    tool: "doc",
    sizeGroups: ["print"],
    defaultPreset: "us-letter",
    recommendedPresets: ["us-letter", "a4"],
    hints: { tone: "institutional", suggestedSections: ["Executive summary", "Findings", "Methodology", "Appendix"] },
  },
  {
    id: "memo",
    label: "Internal memo",
    sub: "Letter-format note for the team",
    tool: "doc",
    sizeGroups: ["print"],
    defaultPreset: "us-letter",
    recommendedPresets: ["us-letter", "a4"],
    hints: { audience: "Internal", tone: "direct" },
  },
  {
    id: "sponsor-deck",
    label: "Sponsor / pitch deck",
    sub: "16:9 deck with title master + content slides",
    tool: "doc",
    sizeGroups: ["presentation"],
    defaultPreset: "slide-16-9",
    recommendedPresets: ["slide-16-9", "slide-16-9-4k", "slide-square"],
    hints: { suggestedSections: ["Cover", "Problem", "Solution", "Why SA", "Ask"] },
  },
  {
    id: "conference-handout",
    label: "Conference handout",
    sub: "Single-sheet takeaway, A4 or US Letter",
    tool: "doc",
    sizeGroups: ["print", "event"],
    defaultPreset: "a4",
    recommendedPresets: ["a4", "us-letter", "event-flyer-letter"],
  },
  {
    id: "flyer",
    label: "Flyer",
    sub: "Single-sheet event or product flyer",
    tool: "doc",
    sizeGroups: ["print", "event", "story-vertical"],
    defaultPreset: "flyer-letter",
    recommendedPresets: ["flyer-letter", "event-flyer-a4", "event-flyer-vert", "ig-story"],
  },
  {
    id: "brochure",
    label: "Brochure",
    sub: "Letter tri-fold or bi-fold layout",
    tool: "doc",
    sizeGroups: ["print"],
    defaultPreset: "brochure-trifold",
    recommendedPresets: ["brochure-trifold"],
  },
  {
    id: "booklet",
    label: "Booklet / zine",
    sub: "Saddle-stitched short-run booklet",
    tool: "doc",
    sizeGroups: ["print"],
    defaultPreset: "booklet-half",
    recommendedPresets: ["booklet-half", "a5"],
  },
  {
    id: "newsletter",
    label: "Newsletter section",
    sub: "Web/email-width vertical block",
    tool: "doc",
    sizeGroups: ["email", "web"],
    defaultPreset: "email-newsletter",
    recommendedPresets: ["email-newsletter", "email-header"],
  },
  {
    id: "resume-bio",
    label: "Resume / bio sheet",
    sub: "Personal one-pager or guest bio",
    tool: "doc",
    sizeGroups: ["print"],
    defaultPreset: "us-letter",
    recommendedPresets: ["us-letter", "a4"],
  },
  {
    id: "wireframe",
    label: "Mockup / wireframe",
    sub: "Low-fidelity screen layout",
    tool: "doc",
    sizeGroups: ["presentation", "web"],
    defaultPreset: "slide-16-9",
    recommendedPresets: ["slide-16-9", "web-hero"],
    hints: { tone: "neutral" },
  },
];

// Graphics — single-artboard visuals (or carousels).
export const GRAPHIC_CATEGORIES: Category[] = [
  { id: "social-post",    label: "Social post",        sub: "Single post for IG / LinkedIn / X / Facebook", tool: "graphic", sizeGroups: ["social-square","social-portrait","social-landscape"], defaultPreset: "ig-square" },
  { id: "story-reel",     label: "Story / Reel cover", sub: "9:16 vertical for stories and short-form",     tool: "graphic", sizeGroups: ["story-vertical"], defaultPreset: "ig-story" },
  { id: "carousel-set",   label: "Carousel set",       sub: "3–10 slides with a consistent master",         tool: "graphic", sizeGroups: ["carousel"], defaultPreset: "ig-carousel" },
  { id: "thumbnail",      label: "Video thumbnail",    sub: "YouTube / LinkedIn article cover",             tool: "graphic", sizeGroups: ["thumbnail"], defaultPreset: "yt-thumb" },
  { id: "header-banner",  label: "Header / banner",    sub: "Profile and channel banners",                  tool: "graphic", sizeGroups: ["header-banner"], defaultPreset: "li-banner" },
  { id: "web-ad",         label: "Web display ad",     sub: "Programmatic ad sizes",                        tool: "graphic", sizeGroups: ["ad"], defaultPreset: "ad-300x250" },
  { id: "avatar",         label: "Avatar",             sub: "Profile pictures",                             tool: "graphic", sizeGroups: ["avatar"], defaultPreset: "avatar-400" },
  { id: "workspace-cover",label: "Workspace cover",    sub: "Notion / Slack / Confluence headers",          tool: "graphic", sizeGroups: ["workspace"], defaultPreset: "notion-cover" },
  { id: "ecommerce",      label: "Product graphic",    sub: "Product photo / lifestyle / card",             tool: "graphic", sizeGroups: ["ecommerce"], defaultPreset: "product-square" },
];

// Image Studio — AI-generated images.
export const IMAGE_CATEGORIES: Category[] = [
  { id: "cover-art",        label: "Cover art",        sub: "Podcast, episode, article cover",     tool: "image", sizeGroups: ["podcast","social-square","thumbnail"], defaultPreset: "podcast-cover" },
  { id: "social-image",     label: "Social image",     sub: "AI-generated post background",        tool: "image", sizeGroups: ["social-square","social-portrait","story-vertical"], defaultPreset: "ig-square" },
  { id: "thumbnail-image",  label: "Thumbnail",        sub: "YouTube / blog hero",                 tool: "image", sizeGroups: ["thumbnail"], defaultPreset: "yt-thumb" },
  { id: "hero-banner",      label: "Hero / banner",    sub: "Web hero or large header",            tool: "image", sizeGroups: ["web","header-banner"], defaultPreset: "web-hero" },
  { id: "backdrop",         label: "Brand backdrop",   sub: "Generic SA-styled background",        tool: "image", sizeGroups: ["presentation","web"], defaultPreset: "slide-16-9" },
];

// Motion — animated graphics (Motionity).
export const MOTION_CATEGORIES: Category[] = [
  { id: "animated-post", label: "Animated social post", sub: "Loop or short animation for feed",  tool: "motion", sizeGroups: ["social-square","social-portrait","story-vertical"], defaultPreset: "ig-square" },
  { id: "lower-third",   label: "Lower-third overlay",  sub: "Title bar to drop into video edits", tool: "motion", sizeGroups: ["presentation"], defaultPreset: "slide-16-9" },
  { id: "logo-sting",    label: "Animated logo",        sub: "Short ID animation",                 tool: "motion", sizeGroups: ["presentation","social-square"], defaultPreset: "slide-16-9" },
];

// Programmatic — Remotion compositions.
export const PROGRAMMATIC_CATEGORIES: Category[] = [
  { id: "quote-card-video", label: "Quote card (video)", sub: "5-10s SA quote card with fade-ins", tool: "programmatic", sizeGroups: ["presentation","social-square","story-vertical"], defaultPreset: "slide-16-9" },
  { id: "audiogram",        label: "Audiogram",          sub: "Waveform + captions for a clip",    tool: "programmatic", sizeGroups: ["social-square","story-vertical"], defaultPreset: "audiogram-square" },
  { id: "episode-trailer",  label: "Episode trailer",    sub: "30s SA Weekly teaser",              tool: "programmatic", sizeGroups: ["presentation","story-vertical"], defaultPreset: "slide-16-9" },
];

// Quote card factory.
export const QUOTE_CATEGORIES: Category[] = [
  { id: "quote-card",   label: "Quote card",   sub: "1080² SA-styled quote with attribution", tool: "quote", sizeGroups: ["social-square","social-portrait"], defaultPreset: "ig-square" },
  { id: "quote-banner", label: "Quote banner", sub: "Landscape quote for headers and slides", tool: "quote", sizeGroups: ["social-landscape","presentation"], defaultPreset: "li-post-landscape" },
];

// Event one-pagers.
export const EVENT_CATEGORIES: Category[] = [
  { id: "event-flyer",    label: "Event flyer",       sub: "Print or social flyer for an event",  tool: "event", sizeGroups: ["print","event","story-vertical"], defaultPreset: "event-flyer-letter" },
  { id: "sponsor-slide",  label: "Sponsor deck slide",sub: "16:9 slide for sponsor pitch",        tool: "event", sizeGroups: ["presentation","event"], defaultPreset: "sponsor-deck-slide" },
  { id: "conf-badge",     label: "Conference badge",  sub: "Wearable name badge",                 tool: "event", sizeGroups: ["event","print"], defaultPreset: "conf-badge" },
  { id: "trade-backdrop", label: "Trade-show backdrop",sub: "8×10 ft booth backdrop",             tool: "event", sizeGroups: ["event","print"], defaultPreset: "trade-show-8x10" },
];

export const ALL_CATEGORIES: Category[] = [
  ...DOC_CATEGORIES,
  ...GRAPHIC_CATEGORIES,
  ...IMAGE_CATEGORIES,
  ...MOTION_CATEGORIES,
  ...PROGRAMMATIC_CATEGORIES,
  ...QUOTE_CATEGORIES,
  ...EVENT_CATEGORIES,
];

export function categoriesForTool(tool: StudioTool): Category[] {
  return ALL_CATEGORIES.filter((c) => c.tool === tool);
}

export function findCategory(id: string | null | undefined): Category | undefined {
  if (!id) return undefined;
  return ALL_CATEGORIES.find((c) => c.id === id);
}

export const TONES = [
  { id: "institutional", label: "Institutional", sub: "Direct, data-forward, sober" },
  { id: "friendly",      label: "Friendly",      sub: "Warmer copy, still on-brand" },
  { id: "urgent",        label: "Urgent",        sub: "Time-sensitive, action-oriented" },
  { id: "celebratory",   label: "Celebratory",   sub: "Milestone, launch, anniversary" },
];
