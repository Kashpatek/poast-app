// Tour content. Plain data — components consume this and render.

export const STEP_WELCOME = "welcome";
export const STEP_CHART2_DEEP = "chart2-deep";
// Per-tool steps. Naming convention: "tool-<sec-id>". The OnboardingHost
// builds the step ID from the current sec at render time.
export const STEP_TOOL_SLOPTOP = "tool-sloptop";
export const STEP_TOOL_CAROUSEL = "tool-carousel";
export const STEP_TOOL_CAPTIONS = "tool-captions";
export const STEP_TOOL_CHART2 = "tool-chart2";

export interface WelcomeStep {
  title: string;
  subtitle?: string;
  body: string;
  bullets?: { label: string; text: string }[];
}

// Welcome shown to FIRST-TIME analysts. Mentions the four analyst tools.
export const WELCOME_STEPS_ANALYST: WelcomeStep[] = [
  {
    title: "Welcome to POAST!",
    subtitle: "The content production studio for SemiAnalysis.",
    body: "Quick tour, about 60 seconds. Skip any time, replay later from Settings.",
  },
  {
    title: "Your studio has four tools",
    body: "Each one is built for a specific job.",
    bullets: [
      { label: "Slop Top", text: "Drop a link or topic, pick a vibe, get a content shotgun across platforms." },
      { label: "Carousel", text: "Turn an SA article into Instagram carousels — three structurally different versions per run." },
      { label: "Capper", text: "Per-platform captions with the SA brand rules already enforced." },
      { label: "Chart Maker 2", text: "Real spreadsheet, real charts, real export. Has its own deeper tour when you open it." },
    ],
  },
  {
    title: "Two things worth knowing",
    body: "Save these for later.",
    bullets: [
      { label: "Bug button", text: "Bottom of the sidebar. Hit it whenever something feels off — it captures the tool you were on automatically." },
      { label: "Asset Library", text: "Logos, fonts, OneDrive links. Open it before starting a project." },
    ],
  },
  {
    title: "You're in.",
    body: "Pick a tool from the sidebar and start. Tips will pop up the first time you open each one.",
  },
];

// Welcome shown to FIRST-TIME marketing users (Brand and Creative Director,
// Chief of Staff, Social Media Manager, Intern). Different cast of tools
// than the analyst rail, plus DocuDesign + the SA Weekly podcast pipeline.
export const WELCOME_STEPS_MARKETING: WelcomeStep[] = [
  {
    title: "Welcome to POAST!",
    subtitle: "The marketing studio for SemiAnalysis.",
    body: "Two-minute lay of the land. Skip any time, replay from Settings → Onboarding.",
  },
  {
    title: "What's in here, briefly",
    body: "Your sidebar has every tool. Quick orientation by group:",
    bullets: [
      { label: "Produce", text: "Slop Top, Carousel, Capper, Press to Premier, B-Roll, Chart Maker, DesignStudio — make the content." },
      { label: "Podcast", text: "SA Weekly, Fab Knowledge, Outreach — full launch kit, prep, guest comms." },
      { label: "Prepare", text: "Trends, IdeationNation, News Flow, GTC Flow — find the angle." },
      { label: "Premier", text: "Schedule, Asset Library — ship it, find the assets." },
    ],
  },
  {
    title: "Things to know",
    body: "Couple of useful pieces.",
    bullets: [
      { label: "Tips on first use", text: "Each tool greets you with a one-paragraph intro the first time you open it. Dismiss + don't show again whenever you're ready." },
      { label: "Bug button", text: "Bottom of the sidebar. Use it freely — it captures the tool you were on automatically." },
      { label: "Settings → Onboarding", text: "Replay this tour or any tool's tip whenever you need it." },
    ],
  },
  {
    title: "You're in.",
    body: "Pick a tool. The home grid groups them by category if you'd rather start there than the sidebar.",
  },
];

export interface CoachContent {
  title: string;
  body: string;
  tip?: string;
}

// Per-tool intros. Keys match the App's `sec` IDs so OnboardingHost can
// look up content by current section. Add a new tool? Add a key here.
export const TOOL_COACH: Record<string, CoachContent> = {
  // ─── Produce ──────────────────────────────────────────────────────
  sloptop: {
    title: "Slop Top",
    body: "Drop a link, or write a quick brief. Generate produces three different angles at once — pick the one that lands instead of regenerating from scratch.",
    tip: "Tip: the trend reference field at the bottom helps anchor the model on something current.",
  },
  carousel: {
    title: "Carousel",
    body: "Paste an SA article URL. Images are fetched automatically — you choose which to include. Generate produces three structurally different carousels.",
    tip: "Tip: the 'page count' picker lets you force exactly N slides.",
  },
  captions: {
    title: "Capper",
    body: "Paste any text and get captions per platform — IG, X, TikTok, LinkedIn, YouTube. SA voice rules are baked in: X never gets hashtags, TikTok stays caption-only and lowercase.",
  },
  p2p: {
    title: "Press to Premier",
    body: "Convert an SA article or briefing into a video production kit — script, b-roll prompts, thumbnail concepts, per-platform launch copy. Hands directly to a video editor.",
    tip: "Tip: pick a duration first; the brief shapes itself around it.",
  },
  broll: {
    title: "B-Roll Library",
    body: "All generated b-roll clips, indexed and searchable. Reuse across episodes instead of regenerating the same skyline shot for the third time.",
  },
  chart: {
    title: "Chart Maker",
    body: "Quick-and-dirty chart maker — paste data, pick a type, export. For deeper work, jump to Chart Maker 2.",
  },
  chart2: {
    title: "Chart Maker 2",
    body: "Real spreadsheet, real charts, real export. There's a dedicated walkthrough when you're ready.",
    tip: "Click 'Take the tour' in the top-right of the chart workspace any time.",
  },
  docu: {
    title: "DesignStudio",
    body: "Your creative suite — DocuDesign for docs and flyers, Graphics for Canva-style design, Image Studio for AI-generated visuals, plus motion and programmatic video. All powered by your SA design system.",
    tip: "Tip: set up your Design System first (logos + brand assets) so every project ships on-brand.",
  },
  "production-studio": {
    title: "ProductionSTUDIO",
    body: "The unified video production hub — absorbs Press to Premier, B-Roll Library, and Render Queue into one workspace. Brief in, edited cut out, with shared assets and queue across the whole pipeline.",
    tip: "Tip: the legacy Press to Premier and B-Roll Library entries still work — bookmarks won't break while the hub takes over.",
  },
  "intelligence-suite": {
    title: "IntelligenceSUITE",
    body: "Your shared signal layer — Trends, IdeationNation, and News Flow merged into one feed-and-brief surface. Spot the angle, draft the brief, hand off to Produce.",
    tip: "Tip: the legacy Trends / IdeationNation / News Flow sidebar items still work during the migration.",
  },
  // ─── Podcast ──────────────────────────────────────────────────────
  fk: {
    title: "Fab Knowledge",
    body: "Doug's interview pipeline — pre-show research, briefing docs, prep kits, post-show transcripts and clip prompts. One guest, end-to-end.",
  },
  weekly: {
    title: "SA Weekly",
    body: "Full episode launch flow: titles + descriptions + thumbnails → review + A/B test → social captions → clip kit. Each step saves to a draft so you can come back.",
    tip: "Tip: clips can be developed AFTER launch from the Activity Log — click 'Develop Clips' on any past episode.",
  },
  outreach: {
    title: "Outreach",
    body: "Cold-email guests for the podcast. Templates pull from FK's database; tone matches Doug's voice.",
  },
  // ─── Prepare ──────────────────────────────────────────────────────
  trends: {
    title: "Trends",
    body: "Live feed of what's trending in the AI / semis space. Filter by topic, sort by velocity, click a trend to spawn a content brief.",
  },
  ideation: {
    title: "IdeationNation",
    body: "Spark sessions for stuck moments. Picks a domain, returns concrete content angles tied to current SA research.",
  },
  news: {
    title: "News Flow",
    body: "Headlines from the SA reading list, queued for drafts. Click 'Draft' on any item to get social posts in the SA voice across every platform.",
  },
  gtc: {
    title: "GTC Flow",
    body: "Conference desk — guest schedules, talking points, content angles, live coverage prep. Built around GTC week but works for any conference.",
  },
  // ─── Premier ──────────────────────────────────────────────────────
  schedule: {
    title: "Schedule",
    body: "Buffer queue, but readable. See what's posting today, this week, by platform. Edit drafts inline; rewrite with one click.",
  },
  assets: {
    title: "Asset Library",
    body: "Logos, fonts, OneDrive links, brand palettes — everything you need to start a deck or design without hunting. The promo ribbon up top will hand you the full brand kit.",
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
    body: "The top half is a working data sheet. Type values, drag to fill, paste from Excel. Formulas work: =SUM(A1:A10), =AVG, =MIN, =MAX, =IF. Autocomplete pops below the formula bar as you type.",
    tip: "Press Tab to commit + move right. Enter commits + moves down.",
  },
  {
    title: "Pick a chart type",
    body: "Click the chart-type icon in the top toolbar. Clustered + stacked columns, lines, pie, scatter, bubble, waterfall, mekko, gantt, combo — your data carries across when you switch.",
  },
  {
    title: "Click anything on the chart",
    body: "Bars, lines, slices, labels — click directly on the chart to recolor or rename inline. Right-click for the radial menu with format options.",
    tip: "The selection popup follows what you click — bar, series, label, axis all get different controls.",
  },
  {
    title: "Annotations",
    body: "Drop callouts on any value point. Drag to reposition, double-click to edit text. Use them to spotlight the moment in the chart that matters.",
  },
  {
    title: "Themes",
    body: "Toggle dark / light / SA-branded. The whole chart swaps including watermark, gridlines, and label colors. Exports preserve the active theme.",
  },
  {
    title: "Export",
    body: "PNG for slides, SVG for Illustrator (vectors stay editable, layers stay grouped), copy-as-image for quick paste. Use the split button in the top-right.",
  },
  {
    title: "Shortcuts",
    body: "Press ? at any time for the cheat sheet. Or just click around — most things are discoverable.",
    tip: "You can replay this tour from Settings → Replay onboarding.",
  },
];
