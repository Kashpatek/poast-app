// SA-brand starter templates for the Fabric canvas editor.
// Each payload is a Fabric `canvas.toJSON()`-compatible object: a top-level
// `version` plus an `objects` array. The editor loads these directly via
// `canvas.loadFromJSON(template.payload)`. Fonts use the brand stack so
// Fabric falls back gracefully when Grift isn't loaded yet.

export interface DesignTemplate {
  id: string;
  category: string;
  title: string;
  preset: { width: number; height: number };
  thumb: string;
  payload: { version: string; objects: unknown[] };
}

// Brand palette — kept inline so this file is import-cheap and usable in a
// Web Worker if the editor ever offloads template rendering.
const C = {
  bg: "#06060C",
  card: "#0D0D12",
  white: "#EDEDED",
  cream: "#E8E4DD",
  muted: "#8A8690",
  amber: "#F7B041",
  teal: "#2EAD8E",
  coral: "#E06347",
  violet: "#905CCB",
  blue: "#0B86D1",
  cyan: "#26C9D8",
};

const HEAD_FONT = "Grift, Outfit, sans-serif";
const BODY_FONT = "Outfit, Arial, sans-serif";
const MONO_FONT = "JetBrains Mono, monospace";
const VERSION = "7.4.0";

// Fabric v7 Textbox defaults — we set only the keys that matter for v1
// (positioning, sizing, color, font, weight, alignment). Everything else
// Fabric supplies on load.
function textbox(opts: {
  left: number;
  top: number;
  width: number;
  text: string;
  fontFamily?: string;
  fontSize: number;
  fontWeight?: string | number;
  fill: string;
  textAlign?: "left" | "center" | "right";
  lineHeight?: number;
  charSpacing?: number;
  fontStyle?: "normal" | "italic";
}) {
  return {
    type: "Textbox",
    left: opts.left,
    top: opts.top,
    width: opts.width,
    text: opts.text,
    fontFamily: opts.fontFamily ?? BODY_FONT,
    fontSize: opts.fontSize,
    fontWeight: opts.fontWeight ?? "normal",
    fontStyle: opts.fontStyle ?? "normal",
    fill: opts.fill,
    textAlign: opts.textAlign ?? "left",
    lineHeight: opts.lineHeight ?? 1.16,
    charSpacing: opts.charSpacing ?? 0,
    splitByGrapheme: false,
  };
}

function rect(left: number, top: number, width: number, height: number, fill: string, opts: Partial<{ stroke: string; strokeWidth: number; rx: number; ry: number; opacity: number }> = {}) {
  return {
    type: "Rect",
    left,
    top,
    width,
    height,
    fill,
    stroke: opts.stroke ?? null,
    strokeWidth: opts.strokeWidth ?? 0,
    rx: opts.rx ?? 0,
    ry: opts.ry ?? 0,
    opacity: opts.opacity ?? 1,
  };
}

function line(coords: [number, number, number, number], stroke: string, strokeWidth = 2) {
  return {
    type: "Line",
    x1: coords[0],
    y1: coords[1],
    x2: coords[2],
    y2: coords[3],
    left: Math.min(coords[0], coords[2]),
    top: Math.min(coords[1], coords[3]),
    stroke,
    strokeWidth,
  };
}

// SA monogram block — square chip with "SA" in Grift.
function monogram(left: number, top: number, size: number, fg = C.white, bg = C.amber) {
  const chip = rect(left, top, size, size, bg, { rx: 4, ry: 4 });
  const label = textbox({
    left: left,
    top: top + size * 0.18,
    width: size,
    text: "SA",
    fontFamily: HEAD_FONT,
    fontSize: size * 0.6,
    fontWeight: 900,
    fill: fg,
    textAlign: "center",
    charSpacing: -40,
  });
  return [chip, label];
}

// ─── GRAPHICS · 1080 × 1080 ─────────────────────────────────────────
const tplBoldQuote: DesignTemplate = {
  id: "graphic-bold-quote",
  category: "graphics",
  title: "Bold quote",
  preset: { width: 1080, height: 1080 },
  thumb: "",
  payload: {
    version: VERSION,
    objects: [
      rect(0, 0, 1080, 1080, C.bg),
      rect(0, 0, 12, 1080, C.amber),
      textbox({ left: 80, top: 140, width: 920, text: "EDITORIAL", fontFamily: MONO_FONT, fontSize: 22, fill: C.amber, charSpacing: 400 }),
      textbox({ left: 80, top: 220, width: 920, text: "Substrate is the new bottleneck.", fontFamily: HEAD_FONT, fontSize: 110, fontWeight: 900, fill: C.white, lineHeight: 1.02, charSpacing: -30 }),
      textbox({ left: 80, top: 820, width: 920, text: "Dylan Patel  ·  SemiAnalysis", fontFamily: BODY_FONT, fontSize: 30, fill: C.cream }),
      line([80, 880, 240, 880], C.amber, 3),
      ...monogram(940, 940, 64, C.bg, C.amber),
    ],
  },
};

const tplDataCallout: DesignTemplate = {
  id: "graphic-data-callout",
  category: "graphics",
  title: "Data callout",
  preset: { width: 1080, height: 1080 },
  thumb: "",
  payload: {
    version: VERSION,
    objects: [
      rect(0, 0, 1080, 1080, C.bg),
      rect(80, 80, 920, 920, C.card, { stroke: C.amber, strokeWidth: 2, rx: 12, ry: 12 }),
      textbox({ left: 120, top: 140, width: 840, text: "Q2 · TSMC N3 yield", fontFamily: MONO_FONT, fontSize: 24, fill: C.teal, charSpacing: 300 }),
      textbox({ left: 120, top: 260, width: 840, text: "78%", fontFamily: HEAD_FONT, fontSize: 320, fontWeight: 900, fill: C.amber, lineHeight: 1.0, charSpacing: -60 }),
      textbox({ left: 120, top: 640, width: 840, text: "Up from 62% in Q1 — N3E ramp finally pacing N5 at the same wafer count.", fontFamily: BODY_FONT, fontSize: 36, fill: C.cream, lineHeight: 1.3 }),
      textbox({ left: 120, top: 920, width: 840, text: "SOURCE · SEMIANALYSIS FAB TRACKER", fontFamily: MONO_FONT, fontSize: 18, fill: C.muted, charSpacing: 300 }),
    ],
  },
};

const tplHeadshotQuote: DesignTemplate = {
  id: "graphic-headshot-quote",
  category: "graphics",
  title: "Headshot + quote",
  preset: { width: 1080, height: 1080 },
  thumb: "",
  payload: {
    version: VERSION,
    objects: [
      rect(0, 0, 1080, 1080, C.bg),
      rect(0, 0, 1080, 360, C.card),
      rect(80, 100, 200, 200, C.violet, { rx: 100, ry: 100 }),
      textbox({ left: 80, top: 175, width: 200, text: "DP", fontFamily: HEAD_FONT, fontSize: 88, fontWeight: 900, fill: C.white, textAlign: "center", charSpacing: -30 }),
      textbox({ left: 320, top: 150, width: 680, text: "Dylan Patel", fontFamily: HEAD_FONT, fontSize: 56, fontWeight: 900, fill: C.white, charSpacing: -10 }),
      textbox({ left: 320, top: 220, width: 680, text: "Chief Analyst · SemiAnalysis", fontFamily: BODY_FONT, fontSize: 26, fill: C.muted }),
      textbox({ left: 80, top: 440, width: 920, text: "“If you only watch flagship dies you'll miss where the margin actually lives — in the packaging line.”", fontFamily: HEAD_FONT, fontSize: 54, fontWeight: 900, fill: C.cream, lineHeight: 1.18, charSpacing: -10 }),
      line([80, 940, 200, 940], C.amber, 3),
      textbox({ left: 80, top: 960, width: 920, text: "SA WEEKLY · EPISODE 42", fontFamily: MONO_FONT, fontSize: 18, fill: C.amber, charSpacing: 400 }),
    ],
  },
};

// ─── QUOTE · 1080 × 1080 ────────────────────────────────────────────
const tplMinimalQuote: DesignTemplate = {
  id: "quote-minimal",
  category: "quote",
  title: "Minimal quote",
  preset: { width: 1080, height: 1080 },
  thumb: "",
  payload: {
    version: VERSION,
    objects: [
      rect(0, 0, 1080, 1080, C.bg),
      textbox({ left: 100, top: 340, width: 880, text: "“The map of compute is being redrawn by the substrate guys, not the model guys.”", fontFamily: HEAD_FONT, fontSize: 64, fontWeight: 900, fill: C.white, lineHeight: 1.2, charSpacing: -10 }),
      line([100, 760, 220, 760], C.amber, 3),
      textbox({ left: 100, top: 790, width: 880, text: "Dylan Patel", fontFamily: BODY_FONT, fontSize: 28, fontWeight: 600, fill: C.cream }),
      textbox({ left: 100, top: 830, width: 880, text: "SA Weekly · Ep. 42", fontFamily: MONO_FONT, fontSize: 18, fill: C.muted, charSpacing: 300 }),
    ],
  },
};

const tplBigTextQuote: DesignTemplate = {
  id: "quote-big-text",
  category: "quote",
  title: "Big-text quote card",
  preset: { width: 1080, height: 1080 },
  thumb: "",
  payload: {
    version: VERSION,
    objects: [
      rect(0, 0, 1080, 1080, C.amber),
      textbox({ left: 60, top: 120, width: 80, text: "“", fontFamily: HEAD_FONT, fontSize: 220, fontWeight: 900, fill: C.bg, charSpacing: 0 }),
      textbox({ left: 80, top: 280, width: 920, text: "Substrate is the new bottleneck.", fontFamily: HEAD_FONT, fontSize: 140, fontWeight: 900, fill: C.bg, lineHeight: 1.0, charSpacing: -40 }),
      line([80, 880, 200, 880], C.bg, 4),
      textbox({ left: 80, top: 920, width: 920, text: "Dylan Patel · SemiAnalysis", fontFamily: BODY_FONT, fontSize: 30, fontWeight: 600, fill: C.bg }),
    ],
  },
};

// ─── EVENT · 1080 × 1350 ────────────────────────────────────────────
const tplEventHeadliner: DesignTemplate = {
  id: "event-headliner",
  category: "event",
  title: "Event headliner",
  preset: { width: 1080, height: 1350 },
  thumb: "",
  payload: {
    version: VERSION,
    objects: [
      rect(0, 0, 1080, 1350, C.bg),
      rect(0, 0, 1080, 240, C.amber),
      textbox({ left: 80, top: 80, width: 920, text: "SA AT GTC", fontFamily: HEAD_FONT, fontSize: 96, fontWeight: 900, fill: C.bg, charSpacing: -30 }),
      textbox({ left: 80, top: 180, width: 920, text: "MARCH 17–20 · SAN JOSE", fontFamily: MONO_FONT, fontSize: 22, fill: C.bg, charSpacing: 400 }),
      textbox({ left: 80, top: 340, width: 920, text: "DYLAN PATEL  ·  KEYNOTE", fontFamily: MONO_FONT, fontSize: 20, fill: C.amber, charSpacing: 400 }),
      textbox({ left: 80, top: 400, width: 920, text: "Where compute actually scales next.", fontFamily: HEAD_FONT, fontSize: 78, fontWeight: 900, fill: C.white, lineHeight: 1.05, charSpacing: -20 }),
      textbox({ left: 80, top: 660, width: 920, text: "Doors 9:00 · Talk 10:15 · Q&A 10:50", fontFamily: BODY_FONT, fontSize: 32, fill: C.cream }),
      line([80, 1140, 240, 1140], C.amber, 4),
      textbox({ left: 80, top: 1170, width: 920, text: "VISIT BOOTH 42  ·  SEMIANALYSIS.COM", fontFamily: MONO_FONT, fontSize: 22, fill: C.amber, charSpacing: 400 }),
    ],
  },
};

const tplAgendaStrip: DesignTemplate = {
  id: "event-agenda-strip",
  category: "event",
  title: "Agenda strip",
  preset: { width: 1080, height: 1350 },
  thumb: "",
  payload: {
    version: VERSION,
    objects: [
      rect(0, 0, 1080, 1350, C.bg),
      textbox({ left: 80, top: 100, width: 920, text: "AGENDA", fontFamily: MONO_FONT, fontSize: 22, fill: C.amber, charSpacing: 400 }),
      textbox({ left: 80, top: 150, width: 920, text: "SA at Computex 2026", fontFamily: HEAD_FONT, fontSize: 72, fontWeight: 900, fill: C.white, charSpacing: -20 }),
      rect(80, 320, 920, 1, C.muted),
      textbox({ left: 80, top: 360, width: 200, text: "10:00", fontFamily: MONO_FONT, fontSize: 28, fill: C.amber }),
      textbox({ left: 300, top: 355, width: 700, text: "Opening: Why we came", fontFamily: HEAD_FONT, fontSize: 36, fontWeight: 900, fill: C.white, charSpacing: -5 }),
      rect(80, 460, 920, 1, C.muted),
      textbox({ left: 80, top: 500, width: 200, text: "11:30", fontFamily: MONO_FONT, fontSize: 28, fill: C.teal }),
      textbox({ left: 300, top: 495, width: 700, text: "Floor walk: TSMC pavilion", fontFamily: HEAD_FONT, fontSize: 36, fontWeight: 900, fill: C.white, charSpacing: -5 }),
      rect(80, 600, 920, 1, C.muted),
      textbox({ left: 80, top: 640, width: 200, text: "14:00", fontFamily: MONO_FONT, fontSize: 28, fill: C.violet }),
      textbox({ left: 300, top: 635, width: 700, text: "Panel: HBM4 supply", fontFamily: HEAD_FONT, fontSize: 36, fontWeight: 900, fill: C.white, charSpacing: -5 }),
      rect(80, 740, 920, 1, C.muted),
      textbox({ left: 80, top: 780, width: 200, text: "17:00", fontFamily: MONO_FONT, fontSize: 28, fill: C.coral }),
      textbox({ left: 300, top: 775, width: 700, text: "Closing reception", fontFamily: HEAD_FONT, fontSize: 36, fontWeight: 900, fill: C.white, charSpacing: -5 }),
      rect(80, 880, 920, 1, C.muted),
      textbox({ left: 80, top: 1200, width: 920, text: "BOOTH J0428  ·  SEMIANALYSIS.COM/EVENTS", fontFamily: MONO_FONT, fontSize: 20, fill: C.amber, charSpacing: 400 }),
    ],
  },
};

// ─── CAROUSEL · 1080 × 1350 ─────────────────────────────────────────
const tplCarouselCover: DesignTemplate = {
  id: "carousel-cover",
  category: "carousel",
  title: "Carousel — cover slide",
  preset: { width: 1080, height: 1350 },
  thumb: "",
  payload: {
    version: VERSION,
    objects: [
      rect(0, 0, 1080, 1350, C.bg),
      rect(0, 1200, 1080, 150, C.amber),
      textbox({ left: 80, top: 140, width: 920, text: "DEEP DIVE", fontFamily: MONO_FONT, fontSize: 22, fill: C.amber, charSpacing: 400 }),
      textbox({ left: 80, top: 220, width: 920, text: "Inside the HBM4 supply squeeze.", fontFamily: HEAD_FONT, fontSize: 102, fontWeight: 900, fill: C.white, lineHeight: 1.04, charSpacing: -30 }),
      textbox({ left: 80, top: 700, width: 920, text: "5 charts. 1 takeaway. SemiAnalysis.", fontFamily: BODY_FONT, fontSize: 34, fill: C.cream, lineHeight: 1.3 }),
      textbox({ left: 80, top: 1240, width: 920, text: "SWIPE →", fontFamily: MONO_FONT, fontSize: 30, fontWeight: 700, fill: C.bg, charSpacing: 600 }),
    ],
  },
};

const tplCarouselContent: DesignTemplate = {
  id: "carousel-content",
  category: "carousel",
  title: "Carousel — content slide",
  preset: { width: 1080, height: 1350 },
  thumb: "",
  payload: {
    version: VERSION,
    objects: [
      rect(0, 0, 1080, 1350, C.bg),
      textbox({ left: 80, top: 120, width: 80, text: "01", fontFamily: HEAD_FONT, fontSize: 96, fontWeight: 900, fill: C.amber, charSpacing: -20 }),
      line([80, 240, 200, 240], C.amber, 3),
      textbox({ left: 80, top: 280, width: 920, text: "The chokepoint isn't memory dies — it's TSV bonders.", fontFamily: HEAD_FONT, fontSize: 64, fontWeight: 900, fill: C.white, lineHeight: 1.1, charSpacing: -15 }),
      textbox({ left: 80, top: 700, width: 920, text: "Through-silicon-via tooling sits in three buildings on two continents. When one slips a quarter, everyone slips.", fontFamily: BODY_FONT, fontSize: 32, fill: C.cream, lineHeight: 1.4 }),
      textbox({ left: 80, top: 1240, width: 920, text: "SEMIANALYSIS  ·  01 / 05", fontFamily: MONO_FONT, fontSize: 18, fill: C.muted, charSpacing: 400 }),
    ],
  },
};

// ─── BANNER · 1500 × 500 ────────────────────────────────────────────
const tplBrandBanner: DesignTemplate = {
  id: "banner-brand",
  category: "banner",
  title: "Brand banner",
  preset: { width: 1500, height: 500 },
  thumb: "",
  payload: {
    version: VERSION,
    objects: [
      rect(0, 0, 1500, 500, C.bg),
      rect(0, 0, 24, 500, C.amber),
      textbox({ left: 80, top: 110, width: 1340, text: "SEMIANALYSIS", fontFamily: HEAD_FONT, fontSize: 120, fontWeight: 900, fill: C.white, charSpacing: -30 }),
      textbox({ left: 86, top: 260, width: 1340, text: "Where the silicon meets the strategy.", fontFamily: BODY_FONT, fontSize: 38, fill: C.cream }),
      line([86, 360, 280, 360], C.amber, 3),
      textbox({ left: 86, top: 380, width: 1340, text: "RESEARCH  ·  DATA  ·  INFRASTRUCTURE", fontFamily: MONO_FONT, fontSize: 20, fill: C.amber, charSpacing: 500 }),
    ],
  },
};

const tplEventBanner: DesignTemplate = {
  id: "banner-event",
  category: "banner",
  title: "Event banner",
  preset: { width: 1500, height: 500 },
  thumb: "",
  payload: {
    version: VERSION,
    objects: [
      rect(0, 0, 1500, 500, C.amber),
      rect(0, 0, 600, 500, C.bg),
      textbox({ left: 60, top: 130, width: 480, text: "SA AT GTC", fontFamily: HEAD_FONT, fontSize: 88, fontWeight: 900, fill: C.amber, charSpacing: -20 }),
      textbox({ left: 60, top: 240, width: 480, text: "March 17–20", fontFamily: HEAD_FONT, fontSize: 56, fontWeight: 900, fill: C.white, charSpacing: -10 }),
      textbox({ left: 60, top: 320, width: 480, text: "San Jose · Booth 42", fontFamily: BODY_FONT, fontSize: 26, fill: C.cream }),
      textbox({ left: 660, top: 120, width: 800, text: "Where compute actually scales next.", fontFamily: HEAD_FONT, fontSize: 64, fontWeight: 900, fill: C.bg, lineHeight: 1.05, charSpacing: -15 }),
      textbox({ left: 660, top: 380, width: 800, text: "DYLAN PATEL  ·  KEYNOTE  ·  10:15 AM", fontFamily: MONO_FONT, fontSize: 20, fill: C.bg, charSpacing: 400 }),
    ],
  },
};

// ─── COVER · 1640 × 924 ─────────────────────────────────────────────
const tplWorkspaceCover: DesignTemplate = {
  id: "cover-workspace",
  category: "cover",
  title: "Workspace cover",
  preset: { width: 1640, height: 924 },
  thumb: "",
  payload: {
    version: VERSION,
    objects: [
      rect(0, 0, 1640, 924, C.bg),
      rect(0, 700, 1640, 224, C.card),
      rect(80, 80, 12, 600, C.amber),
      textbox({ left: 130, top: 80, width: 1400, text: "RESEARCH WORKSPACE", fontFamily: MONO_FONT, fontSize: 24, fill: C.amber, charSpacing: 500 }),
      textbox({ left: 130, top: 160, width: 1400, text: "Compute Capex Tracker", fontFamily: HEAD_FONT, fontSize: 120, fontWeight: 900, fill: C.white, charSpacing: -30 }),
      textbox({ left: 130, top: 320, width: 1400, text: "Weekly updates · Datasets · Charts · Notes", fontFamily: BODY_FONT, fontSize: 32, fill: C.cream }),
      textbox({ left: 130, top: 760, width: 1400, text: "SEMIANALYSIS  ·  INTERNAL", fontFamily: MONO_FONT, fontSize: 22, fill: C.muted, charSpacing: 600 }),
    ],
  },
};

const tplPodcastCover: DesignTemplate = {
  id: "cover-podcast",
  category: "cover",
  title: "Podcast cover",
  preset: { width: 1640, height: 924 },
  thumb: "",
  payload: {
    version: VERSION,
    objects: [
      rect(0, 0, 1640, 924, C.bg),
      rect(0, 0, 600, 924, C.amber),
      textbox({ left: 60, top: 80, width: 480, text: "SA WEEKLY", fontFamily: HEAD_FONT, fontSize: 84, fontWeight: 900, fill: C.bg, charSpacing: -20 }),
      textbox({ left: 60, top: 200, width: 480, text: "EP. 042", fontFamily: MONO_FONT, fontSize: 30, fill: C.bg, charSpacing: 400 }),
      textbox({ left: 60, top: 760, width: 480, text: "JUNE 2026", fontFamily: MONO_FONT, fontSize: 22, fill: C.bg, charSpacing: 500 }),
      textbox({ left: 680, top: 200, width: 880, text: "HBM4 and the substrate squeeze.", fontFamily: HEAD_FONT, fontSize: 84, fontWeight: 900, fill: C.white, lineHeight: 1.08, charSpacing: -20 }),
      line([680, 560, 880, 560], C.amber, 3),
      textbox({ left: 680, top: 580, width: 880, text: "with Doug O'Laughlin", fontFamily: BODY_FONT, fontSize: 38, fill: C.cream }),
      textbox({ left: 680, top: 760, width: 880, text: "LISTEN  ·  YOUTUBE / SPOTIFY / APPLE", fontFamily: MONO_FONT, fontSize: 20, fill: C.amber, charSpacing: 500 }),
    ],
  },
};

// ─── AVATAR · 400 × 400 ─────────────────────────────────────────────
const tplAvatarMonogram: DesignTemplate = {
  id: "avatar-monogram",
  category: "avatar",
  title: "Monogram",
  preset: { width: 400, height: 400 },
  thumb: "",
  payload: {
    version: VERSION,
    objects: [
      rect(0, 0, 400, 400, C.amber),
      textbox({ left: 0, top: 70, width: 400, text: "SA", fontFamily: HEAD_FONT, fontSize: 280, fontWeight: 900, fill: C.bg, textAlign: "center", charSpacing: -50 }),
    ],
  },
};

// ─── PRODUCT · 1080 × 1080 ──────────────────────────────────────────
const tplProductFeature: DesignTemplate = {
  id: "product-feature",
  category: "product",
  title: "Product feature card",
  preset: { width: 1080, height: 1080 },
  thumb: "",
  payload: {
    version: VERSION,
    objects: [
      rect(0, 0, 1080, 1080, C.bg),
      rect(80, 80, 920, 540, C.card, { stroke: C.amber, strokeWidth: 1, rx: 12, ry: 12 }),
      textbox({ left: 120, top: 140, width: 840, text: "NEW · SA CAPITAL", fontFamily: MONO_FONT, fontSize: 24, fill: C.teal, charSpacing: 400 }),
      textbox({ left: 120, top: 220, width: 840, text: "Capex Tracker 2.0", fontFamily: HEAD_FONT, fontSize: 96, fontWeight: 900, fill: C.white, charSpacing: -30 }),
      textbox({ left: 120, top: 360, width: 840, text: "Every fab buildout, every backlog, every quarter.", fontFamily: BODY_FONT, fontSize: 34, fill: C.cream, lineHeight: 1.3 }),
      textbox({ left: 80, top: 680, width: 920, text: "$2,400/yr  ·  per seat", fontFamily: HEAD_FONT, fontSize: 58, fontWeight: 900, fill: C.amber, charSpacing: -10 }),
      textbox({ left: 80, top: 770, width: 920, text: "30-day institutional trial.", fontFamily: BODY_FONT, fontSize: 28, fill: C.cream }),
      rect(80, 880, 360, 80, C.amber, { rx: 6, ry: 6 }),
      textbox({ left: 80, top: 902, width: 360, text: "REQUEST ACCESS", fontFamily: MONO_FONT, fontSize: 22, fontWeight: 700, fill: C.bg, textAlign: "center", charSpacing: 300 }),
      textbox({ left: 80, top: 1010, width: 920, text: "SEMIANALYSIS.COM/CAPITAL", fontFamily: MONO_FONT, fontSize: 18, fill: C.muted, charSpacing: 400 }),
    ],
  },
};

// ─── AD · 1200 × 628 ────────────────────────────────────────────────
const tplLaunchAd: DesignTemplate = {
  id: "ad-launch",
  category: "ad",
  title: "Launch ad",
  preset: { width: 1200, height: 628 },
  thumb: "",
  payload: {
    version: VERSION,
    objects: [
      rect(0, 0, 1200, 628, C.bg),
      rect(0, 0, 8, 628, C.amber),
      textbox({ left: 60, top: 80, width: 1080, text: "NOW IN BETA", fontFamily: MONO_FONT, fontSize: 22, fill: C.amber, charSpacing: 500 }),
      textbox({ left: 60, top: 140, width: 1080, text: "Capex Tracker 2.0", fontFamily: HEAD_FONT, fontSize: 96, fontWeight: 900, fill: C.white, charSpacing: -25 }),
      textbox({ left: 60, top: 280, width: 1080, text: "Every fab buildout, every backlog, every quarter — in one workspace.", fontFamily: BODY_FONT, fontSize: 30, fill: C.cream, lineHeight: 1.35 }),
      rect(60, 460, 320, 76, C.amber, { rx: 6, ry: 6 }),
      textbox({ left: 60, top: 482, width: 320, text: "REQUEST ACCESS", fontFamily: MONO_FONT, fontSize: 20, fontWeight: 700, fill: C.bg, textAlign: "center", charSpacing: 300 }),
      textbox({ left: 60, top: 560, width: 1080, text: "SEMIANALYSIS.COM/CAPITAL", fontFamily: MONO_FONT, fontSize: 18, fill: C.muted, charSpacing: 400 }),
    ],
  },
};

export const TEMPLATES: DesignTemplate[] = [
  tplBoldQuote,
  tplDataCallout,
  tplHeadshotQuote,
  tplMinimalQuote,
  tplBigTextQuote,
  tplEventHeadliner,
  tplAgendaStrip,
  tplCarouselCover,
  tplCarouselContent,
  tplBrandBanner,
  tplEventBanner,
  tplWorkspaceCover,
  tplPodcastCover,
  tplAvatarMonogram,
  tplProductFeature,
  tplLaunchAd,
];

export function templatesByCategory(cat: string): DesignTemplate[] {
  return TEMPLATES.filter((t) => t.category === cat);
}
