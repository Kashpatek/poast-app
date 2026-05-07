// Tour content. Plain data — components consume this and render.

export const STEP_WELCOME = "welcome";
export const STEP_TOOL_SLOPTOP = "tool-sloptop";
export const STEP_TOOL_CAROUSEL = "tool-carousel";
export const STEP_TOOL_CAPTIONS = "tool-captions";
export const STEP_TOOL_CHART2 = "tool-chart2";
export const STEP_CHART2_DEEP = "chart2-deep";

export interface WelcomeStep {
  title: string;
  subtitle?: string;
  body: string;
  bullets?: { label: string; text: string }[];
}

export const WELCOME_STEPS: WelcomeStep[] = [
  {
    title: "Welcome to POAST!",
    subtitle: "The app for all your marketing needs. More to come.",
    body:
      "Quick tour, about 60 seconds. You can skip any time and replay it from Settings if you change your mind.",
  },
  {
    title: "Your studio has four tools",
    body: "Each one is built for a specific job. Pick whichever fits the moment.",
    bullets: [
      { label: "Slop Top", text: "Brief generator. Drop a link or topic, pick a vibe, get a content shotgun across platforms." },
      { label: "Carousel", text: "Turn an SA article into Instagram carousels. Three structurally different versions per run." },
      { label: "Capper", text: "Per-platform captions with the SA brand rules already enforced (no em dashes, no emojis, you know)." },
      { label: "Chart Maker 2", text: "Real spreadsheet, real charts, real export. Has its own deeper tour when you open it." },
    ],
  },
  {
    title: "Two things worth knowing",
    body: "Save these for when you need them.",
    bullets: [
      { label: "Bug button", text: "Bottom of the sidebar. Hit it whenever something feels off — it captures what tool you were on automatically." },
      { label: "Asset Library", text: "Logos, fonts, OneDrive links. Open it before starting a project so the brand assets are within reach." },
    ],
  },
  {
    title: "You're in!",
    body: "Pick a tool from the sidebar and start. Settings → Replay tour if you want to see this again.",
  },
];

export interface CoachContent {
  title: string;
  body: string;
  tip?: string;
}

export const TOOL_COACH: Record<string, CoachContent> = {
  sloptop: {
    title: "Slop Top",
    body:
      "Drop a link, or write a quick brief. Generate produces three different angles at once — pick the one that lands instead of regenerating from scratch.",
    tip: "Tip: the trend reference field at the bottom helps the model anchor on something current.",
  },
  carousel: {
    title: "Carousel",
    body:
      "Paste an SA article URL. Images are fetched automatically — you choose which to include. Generate produces three structurally different carousels (concise, deep dive, image-heavy or list).",
    tip: "Tip: the 'page count' picker lets you force exactly N slides if you have a target length.",
  },
  captions: {
    title: "Capper",
    body:
      "Paste any text and get captions per platform — IG, X, TikTok, LinkedIn, YouTube. SA voice rules are baked in. X never gets hashtags. TikTok stays caption-only and lowercase.",
  },
  chart2: {
    title: "Chart Maker 2",
    body:
      "This one is intricate — real spreadsheet, real charts, real export. There's a dedicated walkthrough when you're ready.",
    tip: "Click 'Take the tour' in the top-right of the chart workspace any time.",
  },
};

export interface ChartTourStep {
  title: string;
  body: string;
  tip?: string;
}

export const CHART_TOUR_STEPS: ChartTourStep[] = [
  {
    title: "It's a real spreadsheet",
    body:
      "The top half is a working data sheet. Type values, drag to fill, paste from Excel. Formulas work: =SUM(A1:A10), =AVG, =MIN, =MAX, =IF. Autocomplete pops below the formula bar as you type.",
    tip: "Press Tab to commit + move right. Enter commits + moves down.",
  },
  {
    title: "Pick a chart type",
    body:
      "Click the chart-type icon in the top toolbar. Clustered + stacked columns, lines, pie, scatter, bubble, waterfall, mekko, gantt, combo — your data carries across when you switch.",
  },
  {
    title: "Click anything on the chart",
    body:
      "Bars, lines, slices, labels — click directly on the chart to recolor or rename inline. Right-click for the radial menu with format options.",
    tip: "The selection popup follows what you click — bar, series, label, axis all get different controls.",
  },
  {
    title: "Annotations",
    body:
      "Drop callouts on any value point. Drag to reposition, double-click to edit text. Use them to spotlight the moment in the chart that matters.",
  },
  {
    title: "Themes",
    body:
      "Toggle dark / light / SA-branded. The whole chart swaps including watermark, gridlines, and label colors. Exports preserve the active theme.",
  },
  {
    title: "Export",
    body:
      "PNG for slides, SVG for Illustrator (vectors stay editable, layers stay grouped), copy-as-image for quick paste. Use the split button in the top-right.",
  },
  {
    title: "Shortcuts",
    body:
      "Press ? at any time for the cheat sheet. Or just click around — most things are discoverable.",
    tip: "You can replay this tour from Settings → Replay onboarding.",
  },
];
