// Comprehensive size catalog for every artifact DesignStudio can produce.
// One source of truth — wizards filter from here by `group`. Add to this
// file when a new platform or print size becomes a thing we ship.

export type SizeUnit = "px" | "mm" | "in";

export type SizeGroup =
  | "social-square"
  | "social-portrait"
  | "social-landscape"
  | "story-vertical"
  | "header-banner"
  | "thumbnail"
  | "carousel"
  | "print"
  | "presentation"
  | "web"
  | "email"
  | "ad"
  | "avatar"
  | "podcast"
  | "ecommerce"
  | "workspace"
  | "event";

export interface SizePreset {
  id: string;
  label: string;
  w: number;
  h: number;
  units: SizeUnit;
  dpi?: number;
  group: SizeGroup;
  platform?: string;
  notes?: string;
}

// Helper for printing physical sizes at print-ready DPI.
const inAt = (inches: number, dpi = 300) => Math.round(inches * dpi);
const mmAt = (mm: number, dpi = 300) => Math.round((mm / 25.4) * dpi);

export const SIZE_PRESETS: SizePreset[] = [
  // ─── Instagram ─────────────────────────────────────────────────────
  { id: "ig-square",          label: "Instagram · Post (Square)",     w: 1080, h: 1080, units: "px", group: "social-square",    platform: "Instagram" },
  { id: "ig-portrait",        label: "Instagram · Post (Portrait)",   w: 1080, h: 1350, units: "px", group: "social-portrait",  platform: "Instagram" },
  { id: "ig-landscape",       label: "Instagram · Post (Landscape)",  w: 1080, h: 566,  units: "px", group: "social-landscape", platform: "Instagram" },
  { id: "ig-story",           label: "Instagram · Story / Reel",      w: 1080, h: 1920, units: "px", group: "story-vertical",   platform: "Instagram" },
  { id: "ig-carousel",        label: "Instagram · Carousel slide",    w: 1080, h: 1350, units: "px", group: "carousel",         platform: "Instagram" },

  // ─── Facebook ──────────────────────────────────────────────────────
  { id: "fb-post",            label: "Facebook · Post",               w: 1200, h: 630,  units: "px", group: "social-landscape", platform: "Facebook" },
  { id: "fb-cover",           label: "Facebook · Cover",              w: 820,  h: 312,  units: "px", group: "header-banner",    platform: "Facebook" },
  { id: "fb-event",           label: "Facebook · Event cover",        w: 1920, h: 1005, units: "px", group: "header-banner",    platform: "Facebook" },

  // ─── LinkedIn ──────────────────────────────────────────────────────
  { id: "li-post-square",     label: "LinkedIn · Post (Square)",      w: 1200, h: 1200, units: "px", group: "social-square",    platform: "LinkedIn" },
  { id: "li-post-landscape",  label: "LinkedIn · Post (Landscape)",   w: 1200, h: 627,  units: "px", group: "social-landscape", platform: "LinkedIn" },
  { id: "li-carousel-square", label: "LinkedIn · Carousel (Square)",  w: 1080, h: 1080, units: "px", group: "carousel",         platform: "LinkedIn" },
  { id: "li-carousel-portrait", label: "LinkedIn · Carousel (Portrait)", w: 1080, h: 1350, units: "px", group: "carousel",      platform: "LinkedIn" },
  { id: "li-banner",          label: "LinkedIn · Personal banner",    w: 1584, h: 396,  units: "px", group: "header-banner",    platform: "LinkedIn" },
  { id: "li-company-banner",  label: "LinkedIn · Company banner",     w: 1128, h: 191,  units: "px", group: "header-banner",    platform: "LinkedIn" },
  { id: "li-article",         label: "LinkedIn · Article cover",      w: 1280, h: 720,  units: "px", group: "thumbnail",        platform: "LinkedIn" },

  // ─── X / Twitter ───────────────────────────────────────────────────
  { id: "x-post-landscape",   label: "X · Post (Landscape)",          w: 1200, h: 675,  units: "px", group: "social-landscape", platform: "X" },
  { id: "x-post-square",      label: "X · Post (Square)",             w: 1200, h: 1200, units: "px", group: "social-square",    platform: "X" },
  { id: "x-header",           label: "X · Header",                    w: 1500, h: 500,  units: "px", group: "header-banner",    platform: "X" },
  { id: "x-card",             label: "X · Summary card",              w: 1200, h: 628,  units: "px", group: "social-landscape", platform: "X" },

  // ─── TikTok / Threads / Pinterest ─────────────────────────────────
  { id: "tt-cover",           label: "TikTok · Cover",                w: 1080, h: 1920, units: "px", group: "story-vertical",   platform: "TikTok" },
  { id: "threads-post",       label: "Threads · Post",                w: 1080, h: 1080, units: "px", group: "social-square",    platform: "Threads" },
  { id: "pin-standard",       label: "Pinterest · Pin",               w: 1000, h: 1500, units: "px", group: "social-portrait",  platform: "Pinterest" },
  { id: "pin-idea",           label: "Pinterest · Idea Pin",          w: 1080, h: 1920, units: "px", group: "story-vertical",   platform: "Pinterest" },

  // ─── YouTube ───────────────────────────────────────────────────────
  { id: "yt-thumb",           label: "YouTube · Thumbnail",           w: 1280, h: 720,  units: "px", group: "thumbnail",        platform: "YouTube" },
  { id: "yt-banner",          label: "YouTube · Channel banner",      w: 2560, h: 1440, units: "px", group: "header-banner",    platform: "YouTube" },
  { id: "yt-end-screen",      label: "YouTube · End screen",          w: 1920, h: 1080, units: "px", group: "presentation",     platform: "YouTube" },
  { id: "yt-shorts",          label: "YouTube · Shorts cover",        w: 1080, h: 1920, units: "px", group: "story-vertical",   platform: "YouTube" },

  // ─── Print / PDF ───────────────────────────────────────────────────
  { id: "us-letter",          label: "US Letter (8.5 × 11 in)",       w: inAt(8.5),  h: inAt(11),   units: "px", dpi: 300, group: "print" },
  { id: "us-letter-screen",   label: "US Letter (screen, 816×1056)",  w: 816,        h: 1056,       units: "px", group: "print" },
  { id: "a4",                 label: "A4 (210 × 297 mm)",             w: mmAt(210),  h: mmAt(297),  units: "px", dpi: 300, group: "print" },
  { id: "a5",                 label: "A5 (148 × 210 mm)",             w: mmAt(148),  h: mmAt(210),  units: "px", dpi: 300, group: "print" },
  { id: "a3",                 label: "A3 (297 × 420 mm)",             w: mmAt(297),  h: mmAt(420),  units: "px", dpi: 300, group: "print" },
  { id: "tabloid",            label: "Tabloid (11 × 17 in)",          w: inAt(11),   h: inAt(17),   units: "px", dpi: 300, group: "print" },
  { id: "legal",              label: "Legal (8.5 × 14 in)",           w: inAt(8.5),  h: inAt(14),   units: "px", dpi: 300, group: "print" },
  { id: "business-card",      label: "Business Card (3.5 × 2 in)",    w: inAt(3.5),  h: inAt(2),    units: "px", dpi: 300, group: "print" },
  { id: "postcard-4x6",       label: "Postcard (4 × 6 in)",           w: inAt(4),    h: inAt(6),    units: "px", dpi: 300, group: "print" },
  { id: "postcard-6x9",       label: "Postcard (6 × 9 in)",           w: inAt(6),    h: inAt(9),    units: "px", dpi: 300, group: "print" },
  { id: "flyer-letter",       label: "Flyer · US Letter",             w: inAt(8.5),  h: inAt(11),   units: "px", dpi: 300, group: "print" },
  { id: "brochure-trifold",   label: "Brochure · Letter tri-fold",    w: inAt(11),   h: inAt(8.5),  units: "px", dpi: 300, group: "print" },
  { id: "booklet-half",       label: "Booklet · 5.5 × 8.5 in",        w: inAt(5.5),  h: inAt(8.5),  units: "px", dpi: 300, group: "print" },
  { id: "poster-18x24",       label: "Poster (18 × 24 in)",           w: inAt(18),   h: inAt(24),   units: "px", dpi: 300, group: "print" },
  { id: "poster-24x36",       label: "Poster (24 × 36 in)",           w: inAt(24),   h: inAt(36),   units: "px", dpi: 300, group: "print" },
  { id: "sticker-3in",        label: "Sticker (3 × 3 in)",            w: inAt(3),    h: inAt(3),    units: "px", dpi: 300, group: "print" },
  { id: "banner-3x6ft",       label: "Banner (3 × 6 ft)",             w: inAt(36),   h: inAt(72),   units: "px", dpi: 150, group: "print" },

  // ─── Presentation ──────────────────────────────────────────────────
  { id: "slide-16-9",         label: "Slide · 16:9 (1920 × 1080)",    w: 1920, h: 1080, units: "px", group: "presentation" },
  { id: "slide-16-9-4k",      label: "Slide · 16:9 4K (3840 × 2160)", w: 3840, h: 2160, units: "px", group: "presentation" },
  { id: "slide-4-3",          label: "Slide · 4:3 (1024 × 768)",      w: 1024, h: 768,  units: "px", group: "presentation" },
  { id: "slide-vertical",     label: "Slide · Vertical (1080 × 1920)",w: 1080, h: 1920, units: "px", group: "presentation" },
  { id: "slide-square",       label: "Slide · Square (1080 × 1080)",  w: 1080, h: 1080, units: "px", group: "presentation" },

  // ─── Web ───────────────────────────────────────────────────────────
  { id: "web-og",             label: "Web · Open Graph card",         w: 1200, h: 630,  units: "px", group: "web" },
  { id: "web-hero",           label: "Web · Hero banner",             w: 1920, h: 1080, units: "px", group: "web" },
  { id: "web-blog-hero",      label: "Web · Blog hero",               w: 1920, h: 600,  units: "px", group: "web" },

  // ─── Email ─────────────────────────────────────────────────────────
  { id: "email-header",       label: "Email · Header",                w: 600,  h: 200,  units: "px", group: "email" },
  { id: "email-signature",    label: "Email · Signature",             w: 300,  h: 100,  units: "px", group: "email" },
  { id: "email-newsletter",   label: "Email · Newsletter section",    w: 600,  h: 800,  units: "px", group: "email" },

  // ─── Ads ───────────────────────────────────────────────────────────
  { id: "ad-300x250",         label: "Ad · Medium Rectangle (300×250)",w: 300,  h: 250,  units: "px", group: "ad" },
  { id: "ad-728x90",          label: "Ad · Leaderboard (728×90)",     w: 728,  h: 90,   units: "px", group: "ad" },
  { id: "ad-160x600",         label: "Ad · Wide Skyscraper (160×600)",w: 160,  h: 600,  units: "px", group: "ad" },
  { id: "ad-320x50",          label: "Ad · Mobile Banner (320×50)",   w: 320,  h: 50,   units: "px", group: "ad" },
  { id: "ad-970x250",         label: "Ad · Billboard (970×250)",      w: 970,  h: 250,  units: "px", group: "ad" },

  // ─── Avatar ────────────────────────────────────────────────────────
  { id: "avatar-400",         label: "Avatar · 400 × 400",            w: 400,  h: 400,  units: "px", group: "avatar" },
  { id: "avatar-800",         label: "Avatar · 800 × 800",            w: 800,  h: 800,  units: "px", group: "avatar" },

  // ─── Podcast / Audio ──────────────────────────────────────────────
  { id: "podcast-cover",      label: "Podcast · Cover art (3000²)",   w: 3000, h: 3000, units: "px", group: "podcast", notes: "Spotify · Apple Podcasts" },
  { id: "audiogram-square",   label: "Audiogram · Square",            w: 1080, h: 1080, units: "px", group: "podcast" },
  { id: "audiogram-vertical", label: "Audiogram · Vertical",          w: 1080, h: 1920, units: "px", group: "podcast" },
  { id: "spotify-canvas",     label: "Spotify · Canvas",              w: 1080, h: 1920, units: "px", group: "podcast" },

  // ─── E-commerce / Product ─────────────────────────────────────────
  { id: "product-square",     label: "Product photo (2000²)",         w: 2000, h: 2000, units: "px", group: "ecommerce" },
  { id: "product-lifestyle",  label: "Product · Lifestyle shot",      w: 1920, h: 1080, units: "px", group: "ecommerce" },
  { id: "product-card",       label: "Product card (800²)",           w: 800,  h: 800,  units: "px", group: "ecommerce" },

  // ─── Workspace covers ─────────────────────────────────────────────
  { id: "slack-header",       label: "Slack · Channel header",        w: 1920, h: 480,  units: "px", group: "workspace" },
  { id: "notion-cover",       label: "Notion · Page cover",           w: 1500, h: 600,  units: "px", group: "workspace" },
  { id: "confluence-header",  label: "Confluence · Header",           w: 3000, h: 1064, units: "px", group: "workspace" },

  // ─── Event / Conference ───────────────────────────────────────────
  { id: "event-flyer-letter", label: "Event Flyer · US Letter",       w: inAt(8.5),  h: inAt(11),   units: "px", dpi: 300, group: "event" },
  { id: "event-flyer-a4",     label: "Event Flyer · A4",              w: mmAt(210),  h: mmAt(297),  units: "px", dpi: 300, group: "event" },
  { id: "event-flyer-vert",   label: "Event Flyer · Vertical 9:16",   w: 1080,       h: 1920,       units: "px", group: "event" },
  { id: "sponsor-deck-slide", label: "Sponsor Deck · 16:9 slide",     w: 1920,       h: 1080,       units: "px", group: "event" },
  { id: "conf-badge",         label: "Conference Badge (4 × 6 in)",   w: inAt(4),    h: inAt(6),    units: "px", dpi: 300, group: "event" },
  { id: "trade-show-8x10",    label: "Trade-show Backdrop (8 × 10 ft)", w: inAt(96), h: inAt(120),  units: "px", dpi: 100, group: "event" },
];

// Quick lookup helpers.
export function findPreset(id: string): SizePreset | undefined {
  return SIZE_PRESETS.find((p) => p.id === id);
}

export function presetsByGroup(groups: SizeGroup[]): SizePreset[] {
  const set = new Set(groups);
  return SIZE_PRESETS.filter((p) => set.has(p.group));
}

export function presetLabel(id: string | null | undefined): string {
  if (!id) return "Custom";
  return findPreset(id)?.label ?? id;
}

// Default group ordering for the size-picker UI.
export const GROUP_ORDER: { group: SizeGroup; label: string }[] = [
  { group: "social-square",    label: "Social · Square" },
  { group: "social-portrait",  label: "Social · Portrait" },
  { group: "social-landscape", label: "Social · Landscape" },
  { group: "story-vertical",   label: "Story / Reel · Vertical 9:16" },
  { group: "carousel",         label: "Carousel slides" },
  { group: "header-banner",    label: "Headers & banners" },
  { group: "thumbnail",        label: "Thumbnails" },
  { group: "presentation",     label: "Presentation / Slide" },
  { group: "print",            label: "Print / PDF" },
  { group: "event",            label: "Event & conference" },
  { group: "podcast",          label: "Podcast / Audio" },
  { group: "web",              label: "Web" },
  { group: "email",            label: "Email" },
  { group: "ad",               label: "Web ads" },
  { group: "ecommerce",        label: "E-commerce" },
  { group: "workspace",        label: "Workspace covers" },
  { group: "avatar",           label: "Avatars" },
];
