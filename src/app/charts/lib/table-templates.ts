// Table starter templates — each one a self-contained TableDocPayload
// that opens straight into the editor. The set covers the patterns the
// sa-data-tables skill catalogs (cost breakdowns, comparisons, KPI
// trackers, three-color sensitivity grids, two-color savings matrices,
// scoring matrices, etc.) plus a few wider-format variations.

import { TableDocPayload, TableSheet } from "../studio-types";

export interface TableTemplate {
  id: string;
  label: string;            // user-facing card label
  blurb: string;            // 1-line subtitle on the card
  accent: string;           // tile accent color
  // Glyph hint for the gallery card (single char or short symbol).
  glyph: string;
  // Concrete payload the editor opens to. id/createdAt etc. are added by
  // the shell when it mints the doc.
  build: () => Omit<TableDocPayload, "kind" | "version">;
}

const SA = {
  amber:  "#F7B041",
  blue:   "#0B86D1",
  teal:   "#2EAD8E",
  coral:  "#E06347",
  violet: "#905CCB",
};

// ──────────────────────────────────────────────────────────────────────
//  DATA TABLES
// ──────────────────────────────────────────────────────────────────────

function blankSheet(): TableSheet {
  return {
    schema: [
      { key: "c1", label: "Item",   type: "text" },
      { key: "c2", label: "Value A", type: "number" },
      { key: "c3", label: "Value B", type: "number" },
    ],
    rows: [
      { c1: "Row 1", c2: 0, c3: 0 },
      { c1: "Row 2", c2: 0, c3: 0 },
      { c1: "Row 3", c2: 0, c3: 0 },
    ],
  };
}

function kpiTrackerSheet(): TableSheet {
  return {
    schema: [
      { key: "c1", label: "Quarter",   type: "text" },
      { key: "c2", label: "Revenue ($M)", type: "number" },
      { key: "c3", label: "Margin (%)",   type: "percent" },
      { key: "c4", label: "ARR ($M)",     type: "number" },
      { key: "c5", label: "Headcount",    type: "number" },
    ],
    rows: [
      { c1: "Q1 '26", c2: 18.4, c3: 32, c4: 76,  c5: 42 },
      { c1: "Q2 '26", c2: 21.1, c3: 34, c4: 84,  c5: 47 },
      { c1: "Q3 '26", c2: 23.6, c3: 36, c4: 92,  c5: 51 },
      { c1: "Q4 '26", c2: 26.2, c3: 38, c4: 100, c5: 56 },
    ],
  };
}

function cogsBreakdownSheet(): TableSheet {
  return {
    schema: [
      { key: "c1", label: "Component",       type: "text" },
      { key: "c2", label: "Per-User Cost",   type: "number" },
      { key: "c3", label: "Share of Total",  type: "percent" },
    ],
    rows: [
      { c1: "Inference compute",        c2: 6.42, c3: 47 },
      { c1: "Storage + DB",             c2: 1.85, c3: 14 },
      { c1: "CDN + egress",             c2: 1.10, c3: 8 },
      { c1: "Support + ops",            c2: 1.50, c3: 11 },
      { c1: "Tooling, licenses, misc.", c2: 1.05, c3: 8 },
      { c1: "Total COGS",               c2: 11.92, c3: 88 },
    ],
  };
}

function pricingTiersSheet(): TableSheet {
  return {
    schema: [
      { key: "c1", label: "Tier",         type: "text" },
      { key: "c2", label: "Price / mo",   type: "number" },
      { key: "c3", label: "Seats",        type: "number" },
      { key: "c4", label: "API Calls",    type: "number" },
      { key: "c5", label: "Storage (GB)", type: "number" },
    ],
    rows: [
      { c1: "Solo",       c2: 19,  c3: 1,   c4: 25_000,  c5: 5 },
      { c1: "Team",       c2: 49,  c3: 5,   c4: 100_000, c5: 25 },
      { c1: "Business",   c2: 99,  c3: 25,  c4: 500_000, c5: 250 },
      { c1: "Enterprise", c2: 299, c3: 100, c4: 2_500_000, c5: 1000 },
    ],
  };
}

function vendorMatrixSheet(): TableSheet {
  return {
    schema: [
      { key: "c1", label: "Vendor",        type: "text" },
      { key: "c2", label: "Tokens / $",    type: "number" },
      { key: "c3", label: "Context (K)",   type: "number" },
      { key: "c4", label: "p95 Latency (ms)", type: "number" },
      { key: "c5", label: "Frontier?",     type: "text" },
    ],
    rows: [
      { c1: "Anthropic Sonnet 4.6",  c2: 320_000, c3: 200,  c4: 240, c5: "Yes" },
      { c1: "Anthropic Opus 4.7",    c2: 110_000, c3: 200,  c4: 720, c5: "Yes" },
      { c1: "OpenAI GPT-5",          c2: 280_000, c3: 128,  c4: 310, c5: "Yes" },
      { c1: "Google Gemini 3 Pro",   c2: 340_000, c3: 1000, c4: 280, c5: "Yes" },
      { c1: "Meta Llama 4",          c2: 850_000, c3: 128,  c4: 180, c5: "No"  },
    ],
  };
}

function adoptionFunnelSheet(): TableSheet {
  return {
    schema: [
      { key: "c1", label: "Stage",         type: "text" },
      { key: "c2", label: "Users (000s)",  type: "number" },
      { key: "c3", label: "Conversion",    type: "percent" },
      { key: "c4", label: "Drop-off",      type: "percent" },
    ],
    rows: [
      { c1: "Landed",       c2: 184.2, c3: 100, c4: 0 },
      { c1: "Trial start",  c2: 72.5,  c3: 39,  c4: 61 },
      { c1: "First export", c2: 41.8,  c3: 23,  c4: 42 },
      { c1: "Paid plan",    c2: 14.3,  c3: 8,   c4: 66 },
      { c1: "Retained 30d", c2: 9.7,   c3: 5,   c4: 32 },
    ],
  };
}

// ──────────────────────────────────────────────────────────────────────
//  HEATMAPS
// ──────────────────────────────────────────────────────────────────────

// Generic helper: build a heatmap sheet with row labels + N numeric columns
// from a 2D values array.
function buildHeatSheet(rowLabel: string, rowNames: string[], colNames: string[], values: number[][]): TableSheet {
  const schema = [
    { key: "c1", label: rowLabel, type: "text" as const },
    ...colNames.map((label, i) => ({ key: "c" + (i + 2), label, type: "number" as const })),
  ];
  const rows = rowNames.map((name, ri) => {
    const row: Record<string, string | number> = { c1: name };
    values[ri].forEach((v, ci) => { row["c" + (ci + 2)] = v; });
    return row;
  });
  return { schema, rows };
}

function fleetMathSheet(): TableSheet {
  return buildHeatSheet(
    "Throughput",
    ["100%", "83%", "67%", "50%", "33%"],
    ["20%", "33%", "50%", "67%", "83%"],
    [
      [11.45, 6.93, 4.55, 3.39, 2.74],
      [9.51,  5.74, 3.78, 2.81, 2.27],
      [7.56,  4.55, 3.00, 2.23, 1.80],   // baseline row
      [5.62,  3.36, 2.22, 1.65, 1.33],
      [3.68,  2.18, 1.43, 1.06, 0.86],
    ],
  );
}

function paybackMatrixSheet(): TableSheet {
  return buildHeatSheet(
    "Annual savings",
    ["$8k", "$16k", "$24k", "$32k", "$40k"],
    ["$40k", "$80k", "$120k", "$160k", "$200k"],
    [
      [ 5.0, 10.0, 15.0, 20.0, 25.0 ],
      [ 2.5,  5.0,  7.5, 10.0, 12.5 ],
      [ 1.7,  3.3,  5.0,  6.7,  8.3 ],
      [ 1.3,  2.5,  3.8,  5.0,  6.3 ],
      [ 1.0,  2.0,  3.0,  4.0,  5.0 ],
    ],
  );
}

function savingsMatrixSheet(): TableSheet {
  // Two-color (negative coral / positive teal) sensitivity grid.
  return buildHeatSheet(
    "Adoption rate",
    ["10%", "25%", "50%", "75%", "100%"],
    ["$5/mo", "$10/mo", "$20/mo", "$40/mo", "$80/mo"],
    [
      [-12.4, -9.8, -4.6, 3.2, 14.8 ],
      [-9.6,  -5.8,  0.8, 11.0, 28.4 ],
      [-5.2,   0.4,  9.2, 22.4, 49.6 ],
      [-2.0,   4.8, 16.8, 35.2, 72.4 ],
      [ 1.2,   9.4, 24.6, 48.4, 96.0 ],
    ],
  );
}

function riskMatrixSheet(): TableSheet {
  return buildHeatSheet(
    "Probability",
    ["≥80%", "60–80%", "40–60%", "20–40%", "<20%"],
    ["Trivial", "Low", "Moderate", "High", "Critical"],
    [
      [ 4,  8, 12, 18, 25 ],
      [ 3,  6,  9, 14, 20 ],
      [ 2,  4,  6, 10, 15 ],
      [ 1,  3,  5,  8, 12 ],
      [ 1,  2,  3,  5,  8 ],
    ],
  );
}

function scoreMatrixSheet(): TableSheet {
  return buildHeatSheet(
    "Initiative",
    ["G1 fleet pilot", "Inference shrink", "Brand refresh", "API v3", "Voice SDK"],
    ["Strategic Fit", "Effort", "Time to Win", "Revenue", "Risk"],
    [
      [9, 4, 7, 8, 3],
      [7, 3, 8, 6, 4],
      [6, 5, 5, 4, 2],
      [8, 6, 6, 9, 5],
      [5, 7, 4, 7, 6],
    ],
  );
}

function hourlyCostSheet(): TableSheet {
  return buildHeatSheet(
    "Utilization",
    ["20%", "33%", "50%", "67%", "83%", "100%"],
    ["$40/hr", "$30/hr", "$22/hr", "$15/hr", "$10/hr"],
    [
      [ 92, 70, 56, 42, 32 ],
      [ 56, 42, 33, 25, 19 ],
      [ 36, 27, 22, 16, 12 ],
      [ 28, 21, 16, 12,  9 ],
      [ 22, 17, 13, 10,  7 ],
      [ 19, 14, 11,  8,  6 ],
    ],
  );
}

// ──────────────────────────────────────────────────────────────────────
//  Templates
// ──────────────────────────────────────────────────────────────────────

export const TABLE_TEMPLATES: TableTemplate[] = [
  // — Data tables —
  {
    id: "blank",
    label: "Blank table",
    blurb: "5×3 starter — minimal",
    accent: SA.teal,
    glyph: "▦",
    build: () => ({
      engine: "standard",
      sheet: blankSheet(),
      mode: "data",
      category: "SEMIANALYSIS — DRAFT",
      titleWhite: "Untitled",
      titleAmber: "",
      subtitle: "Replace this with your subtitle",
      titleBar: "DATA TABLE",
    }),
  },
  {
    id: "kpi",
    label: "KPI tracker",
    blurb: "Quarterly metrics, highlight latest",
    accent: SA.blue,
    glyph: "Σ",
    build: () => ({
      engine: "standard",
      sheet: kpiTrackerSheet(),
      mode: "data",
      category: "SEMIANALYSIS — PERFORMANCE",
      titleWhite: "Bookings KPIs ·",
      titleAmber: "FY '26",
      subtitle: "Quarterly view · revenue, margin, ARR, headcount",
      titleBar: "FY26 KPI SNAPSHOT",
      highlightRowIdx: 3,
      highlightFlagCol: 1,
      keyInsight: "Q4 close lands at $26.2M with 38% margin — first quarter above the 36% steady-state target the model assumes for FY27.",
    }),
  },
  {
    id: "cogs",
    label: "COGS breakdown",
    blurb: "Cost stack with punchline row",
    accent: SA.amber,
    glyph: "$",
    build: () => ({
      engine: "standard",
      sheet: cogsBreakdownSheet(),
      mode: "data",
      category: "SEMIANALYSIS — UNIT ECONOMICS",
      titleWhite: "COGS Behind a",
      titleAmber: "$20 Subscription",
      subtitle: "Per-user run-rate · 2026 cost stack",
      titleBar: "WHERE THE $20 GOES",
      highlightRowIdx: 5,
      highlightFlagCol: 1,
      keyInsight: "**$11.92** of every $20 sub becomes COGS — leaving $8.08 of contribution margin before sales, G&A, and R&D. Inference compute alone is the punchline, half the total.",
    }),
  },
  {
    id: "pricing",
    label: "Pricing tiers",
    blurb: "Plan × feature comparison",
    accent: SA.amber,
    glyph: "★",
    build: () => ({
      engine: "standard",
      sheet: pricingTiersSheet(),
      mode: "data",
      category: "SEMIANALYSIS — PRICING",
      titleWhite: "Pricing Tiers ·",
      titleAmber: "v2 Launch",
      subtitle: "Per-seat pricing with API + storage limits",
      titleBar: "TIER COMPARISON",
      highlightRowIdx: 2,
      highlightFlagCol: 0,
      keyInsight: "Business at $99/mo is the recommended tier — covers 80% of inbound, with API + seat ratios that fit most teams of 10–25.",
    }),
  },
  {
    id: "vendors",
    label: "Model comparison",
    blurb: "Wide vendor scan, no highlight",
    accent: SA.violet,
    glyph: "▣",
    build: () => ({
      engine: "standard",
      sheet: vendorMatrixSheet(),
      mode: "data",
      category: "SEMIANALYSIS — MODEL ECONOMY",
      titleWhite: "Frontier Model",
      titleAmber: "Bang-for-Buck",
      subtitle: "Tokens per dollar · context · p95 latency · frontier classification",
      titleBar: "MODEL COMPARISON · Q2 2026",
    }),
  },
  {
    id: "funnel",
    label: "Adoption funnel",
    blurb: "Stage drop-off with flagged end",
    accent: SA.coral,
    glyph: "↓",
    build: () => ({
      engine: "standard",
      sheet: adoptionFunnelSheet(),
      mode: "data",
      category: "SEMIANALYSIS — GROWTH",
      titleWhite: "Trial-to-Paid",
      titleAmber: "Funnel",
      subtitle: "FY26 inbound · 184k landed → 9.7k retained @ 30 days",
      titleBar: "ADOPTION FUNNEL",
      highlightRowIdx: 4,
      highlightFlagCol: 3,
      keyInsight: "Retention at 30 days is the cliff — only **5%** of landed users stick, with the biggest drop-off (66%) happening between paid signup and 30-day check-in.",
    }),
  },

  // — Heatmaps —
  {
    id: "fleet-math",
    label: "Sensitivity grid",
    blurb: "5×5 three-color with baseline",
    accent: SA.amber,
    glyph: "▩",
    build: () => ({
      engine: "standard",
      sheet: fleetMathSheet(),
      mode: "heatmap",
      category: "SEMIANALYSIS — ROBOTICS",
      titleWhite: "G1 Fleet Math ·",
      titleAmber: "Bots per Human",
      subtitle: "Utilization × throughput · baseline scenario boxed in amber",
      threshold: 3,
      yellowBand: 0.5,
      topAxisLabel: "UTILIZATION",
      leftAxisLabel: "THROUGHPUT",
      baselineRow: 2,
      baselineCol: 2,
      panelKind: "inputs",
      panelItems: [
        { label: "Bot uptime:",   value: "4,380 hr/yr" },
        { label: "Human shift:",  value: "2,000 hr/yr" },
        { label: "Task swap:",    value: "12 sec" },
        { label: "Bot fleet OK?:", value: "≥ 3 humans/bot" },
        { label: "Hardware cost:", value: "$140k / bot" },
        { label: "Service cost:",  value: "$8k / yr" },
      ],
    }),
  },
  {
    id: "payback",
    label: "Payback matrix",
    blurb: "Years to break even, w/ formula",
    accent: SA.teal,
    glyph: "⏳",
    build: () => ({
      engine: "standard",
      sheet: paybackMatrixSheet(),
      mode: "heatmap",
      category: "SEMIANALYSIS — UNIT ECONOMICS",
      titleWhite: "Fleet Payback ·",
      titleAmber: "Years to Break Even",
      subtitle: "Capex × annual savings · baseline scenario shown",
      threshold: 3,
      yellowBand: 0.4,
      topAxisLabel: "CAPEX PER UNIT",
      leftAxisLabel: "ANNUAL SAVINGS",
      baselineRow: 2,
      baselineCol: 2,
      panelKind: "inputs",
      panelItems: [
        { label: "Service cost:",  value: "$8k/yr" },
        { label: "Discount rate:", value: "8%" },
        { label: "Useful life:",   value: "7 yrs" },
        { label: "Tax shield:",    value: "21%" },
      ],
      formula: "payback = capex / (annual_savings − service_cost)",
      formulaBaseline: "120k / (24k − 8k)",
      formulaResult: "5.0 yrs",
    }),
  },
  {
    id: "savings",
    label: "Savings matrix",
    blurb: "Two-color: gain/loss vs status quo",
    accent: SA.coral,
    glyph: "±",
    build: () => ({
      engine: "standard",
      sheet: savingsMatrixSheet(),
      mode: "heatmap",
      category: "SEMIANALYSIS — PRICING",
      titleWhite: "Cash Savings ·",
      titleAmber: "Adoption × Plan",
      subtitle: "Coral = loss vs status quo · teal = gain · break-even band in yellow",
      threshold: 0,
      yellowBand: 1.5,
      topAxisLabel: "PRICE TIER",
      leftAxisLabel: "ADOPTION",
      panelKind: "caveats",
      panelItems: [
        { label: "Status quo:",    value: "all users on $10/mo, 50% adoption" },
        { label: "Adoption gain:",  value: "linear assumption — no churn modelled" },
        { label: "Margin:",         value: "62% blended, constant across tiers" },
        { label: "Sensitivity:",    value: "results assume no competitive response" },
      ],
    }),
  },
  {
    id: "risk",
    label: "Risk matrix",
    blurb: "Probability × impact, w/ caveats",
    accent: SA.coral,
    glyph: "⚠",
    build: () => ({
      engine: "standard",
      sheet: riskMatrixSheet(),
      mode: "heatmap",
      category: "SEMIANALYSIS — OPS",
      titleWhite: "Launch Risk ·",
      titleAmber: "Probability × Impact",
      subtitle: "Pre-launch risk register · score = expected loss in $M",
      threshold: 10,
      yellowBand: 2,
      topAxisLabel: "IMPACT",
      leftAxisLabel: "PROBABILITY",
      panelKind: "caveats",
      panelItems: [
        { label: "Score = ",     value: "probability midpoint × impact dollars" },
        { label: "Above 15:",     value: "trigger a war-room before launch" },
        { label: "Yellow band:",  value: "watch list — review weekly" },
        { label: "Under 5:",      value: "log only — no active mitigation" },
      ],
    }),
  },
  {
    id: "score",
    label: "Score matrix",
    blurb: "Initiative scoring 1–10",
    accent: SA.violet,
    glyph: "◆",
    build: () => ({
      engine: "standard",
      sheet: scoreMatrixSheet(),
      mode: "heatmap",
      category: "SEMIANALYSIS — STRATEGY",
      titleWhite: "FY26 Initiatives ·",
      titleAmber: "Score Matrix",
      subtitle: "1–10 across five dimensions · 7+ is a green light",
      threshold: 6,
      yellowBand: 0.5,
      topAxisLabel: "DIMENSION",
      leftAxisLabel: "INITIATIVE",
      panelKind: "inputs",
      panelItems: [
        { label: "Scorers:",     value: "Akash, Michelle, Vansh" },
        { label: "Cycle:",       value: "Q1 '26 portfolio review" },
        { label: "Greenlight:",  value: "≥ 7 on Strategic Fit + Revenue" },
      ],
    }),
  },
  {
    id: "hourly",
    label: "Cost grid (6×5)",
    blurb: "Wider heatmap, 6 rows",
    accent: SA.blue,
    glyph: "⏱",
    build: () => ({
      engine: "standard",
      sheet: hourlyCostSheet(),
      mode: "heatmap",
      category: "SEMIANALYSIS — ROBOTICS",
      titleWhite: "Hourly Cost ·",
      titleAmber: "Robot vs Labor",
      subtitle: "Labor wage × utilization · break-even band in yellow at $30/hr labor",
      threshold: 30,
      yellowBand: 4,
      topAxisLabel: "LABOR WAGE",
      leftAxisLabel: "UTILIZATION",
      baselineRow: 2,
      baselineCol: 2,
      panelKind: "inputs",
      panelItems: [
        { label: "Bot capex:",    value: "$140k" },
        { label: "Useful life:",  value: "5 yrs" },
        { label: "Service:",      value: "$8k/yr" },
        { label: "Energy:",       value: "$0.20/kWh" },
        { label: "Loaded labor:", value: "1.42× wage" },
      ],
      formula: "robot_hourly = (capex/life + service + energy) / hours_per_yr",
      formulaResult: "$11.40 / hr @ 50% util",
    }),
  },
];

export function templateById(id: string): TableTemplate | null {
  return TABLE_TEMPLATES.find(t => t.id === id) || null;
}
