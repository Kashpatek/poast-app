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

function verdictMatrixSheet(): TableSheet {
  return {
    schema: [
      { key: "c1", label: "Activity",  type: "text" },
      { key: "c2", label: "Produced",  type: "text" },
      { key: "c3", label: "Priced",    type: "text" },
      { key: "c4", label: "Measured",  type: "text" },
      { key: "c5", label: "Verdict",   type: "text" },
    ],
    rows: [
      { c1: "AI work inside a flat subscription", c2: "✓", c3: "—", c4: "—", c5: "Inside the gap" },
      { c1: "Household / unpaid care",            c2: "✓", c3: "—", c4: "—", c5: "Inside the gap" },
      { c1: "Informal & criminal economy",        c2: "✓", c3: "✓", c4: "—", c5: "Inside the gap" },
      { c1: "Government services (cost-based)",   c2: "✓", c3: "—", c4: "✓", c5: "Measured at cost" },
      { c1: "Owner-occupied housing (imputed)",   c2: "—", c3: "—", c4: "✓", c5: "Measured by imputation" },
      { c1: "Capital gains, transfers, sales",    c2: "—", c3: "✓", c4: "—", c5: "Priced but not output" },
      { c1: "Ordinary market output",             c2: "✓", c3: "✓", c4: "✓", c5: "Captured by GDP" },
    ],
  };
}

function tierLadderSheet(): TableSheet {
  return {
    schema: [
      { key: "c1", label: "Tier",        type: "text" },
      { key: "c2", label: "Name",        type: "text" },
      { key: "c3", label: "Description", type: "text" },
    ],
    rows: [
      { c1: "T6", c2: "Insured",               c3: "A professional liability insurer covers AI-generated output for this task class." },
      { c1: "T5", c2: "Adjudicated",           c3: "The output has been reviewed in a formal dispute or audit process and held up." },
      { c1: "T4", c2: "Production Deployment", c3: "The AI is performing this task in a real business workflow, generating revenue." },
      { c1: "T3", c2: "Professional Endorsement", c3: "A credentialed professional in the field confirmed the output meets practice standards." },
      { c1: "T2", c2: "Adversarial AI Eval",   c3: "A second AI model adversarially reviewed the output against professional standards." },
      { c1: "T1", c2: "AI Self-Assessment",    c3: "AI model attempted the task and produced output. Lowest confidence." },
      { c1: "T0", c2: "Unverified",            c3: "No verification evidence." },
    ],
  };
}

function roadmapSheet(): TableSheet {
  return {
    schema: [
      { key: "c1", label: "Generation",    type: "text" },
      { key: "c2", label: "Launch",        type: "text" },
      { key: "c3", label: "Headline",      type: "text" },
      { key: "c4", label: "Δ vs prior",    type: "text" },
    ],
    rows: [
      { c1: "Hopper H100",   c2: "Mar '23", c3: "Transformer engine, FP8",      c4: "+3.2× vs A100" },
      { c1: "Hopper H200",   c2: "Q4 '23",  c3: "141 GB HBM3e",                 c4: "+1.8× memory bandwidth" },
      { c1: "Blackwell B200", c2: "Q1 '25", c3: "Dual-die, 192 GB HBM3e",      c4: "+2.5× perf / W" },
      { c1: "Blackwell Ultra", c2: "Q3 '25", c3: "288 GB, NVLink 6th gen",    c4: "+1.5× HBM capacity" },
      { c1: "Rubin R100",    c2: "Q4 '26",  c3: "HBM4, CPO optical IO",         c4: "+3.4× throughput" },
    ],
  };
}

function bomSheet(): TableSheet {
  return {
    schema: [
      { key: "c1", label: "Component", type: "text" },
      { key: "c2", label: "Unit Cost", type: "number", numFmt: "usd" },
      { key: "c3", label: "Qty",       type: "number", numFmt: "int" },
      { key: "c4", label: "Subtotal",  type: "number", numFmt: "usd" },
    ],
    rows: [
      { c1: "GB200 NVL72 superchip", c2: 70_000,  c3: 36, c4: 2_520_000 },
      { c1: "Blackwell B200 GPU",    c2: 40_000,  c3: 72, c4: 2_880_000 },
      { c1: "NVLink switch tray",    c2: 12_500,  c3: 9,  c4: 112_500   },
      { c1: "Rack PSU + busbar",     c2: 8_200,   c3: 6,  c4: 49_200    },
      { c1: "Liquid cooling loop",   c2: 6_400,   c3: 1,  c4: 6_400     },
      { c1: "Network + optics",      c2: 24_000,  c3: 1,  c4: 24_000    },
    ],
  };
}

function specComparisonSheet(): TableSheet {
  return {
    schema: [
      { key: "c1", label: "Spec",   type: "text" },
      { key: "c2", label: "Gen 5",  type: "text" },
      { key: "c3", label: "Gen 6",  type: "text" },
      { key: "c4", label: "Δ",      type: "text" },
    ],
    rows: [
      { c1: "Process node",          c2: "5N",    c3: "3NE",  c4: "−40% logic area" },
      { c1: "Transistor count (B)",  c2: "208",   c3: "412",  c4: "+98%" },
      { c1: "Peak TDP (W)",          c2: "700",   c3: "1,200", c4: "+71%" },
      { c1: "HBM capacity",          c2: "141 GB", c3: "288 GB", c4: "+104%" },
      { c1: "HBM bandwidth (TB/s)",  c2: "4.8",   c3: "8.0",  c4: "+67%" },
      { c1: "NVLink BW (GB/s)",      c2: "900",   c3: "1,800", c4: "+100%" },
      { c1: "Launch price (kit)",    c2: "$30k",  c3: "$70k", c4: "+133%" },
    ],
  };
}

function capacityLedgerSheet(): TableSheet {
  return {
    schema: [
      { key: "c1", label: "Quarter", type: "text" },
      { key: "c2", label: "Region",  type: "text" },
      { key: "c3", label: "Wafer Starts", type: "number", numFmt: "k", suffix: "/mo" },
      { key: "c4", label: "Yield",   type: "percent" },
    ],
    rows: [
      { c1: "Q1 '26", c2: "Hsinchu",    c3: 92_000,  c4: 78 },
      { c1: "Q2 '26", c2: "Hsinchu",    c3: 98_000,  c4: 81 },
      { c1: "Q2 '26", c2: "Arizona",    c3: 22_000,  c4: 71 },
      { c1: "Q3 '26", c2: "Hsinchu",    c3: 105_000, c4: 84 },
      { c1: "Q3 '26", c2: "Arizona",    c3: 34_000,  c4: 76 },
      { c1: "Q4 '26", c2: "Hsinchu",    c3: 110_000, c4: 86 },
      { c1: "Q4 '26", c2: "Arizona",    c3: 48_000,  c4: 79 },
    ],
  };
}

function modelEloSheet(): TableSheet {
  return {
    schema: [
      { key: "c1", label: "Model",       type: "text" },
      { key: "c2", label: "Arena Elo",   type: "number", numFmt: "int" },
      { key: "c3", label: "30-day Δ",    type: "number", numFmt: "int" },
      { key: "c4", label: "Win-rate vs field", type: "percent" },
      { key: "c5", label: "Cost / 1M",   type: "number", numFmt: "usd" },
    ],
    rows: [
      { c1: "Claude Opus 4.7",     c2: 1428, c3: 22,  c4: 71, c5: 15 },
      { c1: "GPT-5",               c2: 1416, c3: 14,  c4: 69, c5: 12 },
      { c1: "Gemini 3 Pro",        c2: 1402, c3: 31,  c4: 67, c5: 8  },
      { c1: "Claude Sonnet 4.6",   c2: 1391, c3: 8,   c4: 65, c5: 3  },
      { c1: "Llama 4 405B",        c2: 1342, c3: -3,  c4: 59, c5: 1  },
      { c1: "Grok 4",              c2: 1320, c3: 18,  c4: 56, c5: 5  },
    ],
  };
}

function timelineEventSheet(): TableSheet {
  return {
    schema: [
      { key: "c1", label: "Year",        type: "text" },
      { key: "c2", label: "Milestone",   type: "text" },
      { key: "c3", label: "Cost / unit", type: "text" },
      { key: "c4", label: "Volume",      type: "text" },
    ],
    rows: [
      { c1: "1400", c2: "Hand-forged by armorers",       c3: "$15.00", c4: "~hundreds/yr" },
      { c1: "1700", c2: "Clockmaker blacksmith craft",   c3: "$8.00",  c4: "~thousands/yr" },
      { c1: "1800", c2: "Maudslay screw-cutting lathe",  c3: "$3.00",  c4: "~millions/yr" },
      { c1: "1850", c2: "Whitworth · American System",   c3: "$0.60",  c4: "~100s of millions/yr" },
      { c1: "1900", c2: "Bessemer steel, std parts",     c3: "$0.15",  c4: "~10s of billions/yr" },
      { c1: "1950", c2: "Post-war manufacturing automation", c3: "$0.05", c4: "~100s of billions/yr" },
      { c1: "2000", c2: "Global supply chains, containers",  c3: "$0.02", c4: "~1 trillion/yr" },
      { c1: "2025", c2: "Made in Asia, near-zero margin",    c3: "$0.01", c4: "~1–2 trillion/yr" },
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

// Spec Comparison — chip generations across HBM / NVLink / TDP /
// process / availability. Schema is single-tier for now; the eventual
// super-header row that groups columns by generation will be a
// follow-up renderer addition (see Tier 3 column-groups task).
function specComparisonAdvancedSheet(): TableSheet {
  return {
    schema: [
      { key: "c1", label: "Spec",            type: "text"   },
      { key: "c2", label: "H200 (Hopper)",   type: "text"   },
      { key: "c3", label: "B200 (Blackwell)",type: "text"   },
      { key: "c4", label: "R100 (Rubin)",    type: "text"   },
      { key: "c5", label: "F100 (Feynman)",  type: "text"   },
    ],
    rows: [
      { c1: "Process node",       c2: "TSMC 4N",  c3: "TSMC 4NP", c4: "TSMC N3P", c5: "TSMC N2 (est.)" },
      { c1: "Die area (mm²)",     c2: "814",      c3: "2×800",    c4: "2×750",    c5: "TBD"            },
      { c1: "FP8 dense (PFLOPS)", c2: "2.0",      c3: "4.5",      c4: "9.0",      c5: "≥15 (est.)"     },
      { c1: "HBM (capacity)",     c2: "141 GB",   c3: "192 GB",   c4: "288 GB",   c5: "≥384 GB"        },
      { c1: "HBM (bandwidth)",    c2: "4.8 TB/s", c3: "8.0 TB/s", c4: "13 TB/s",  c5: "≥18 TB/s"       },
      { c1: "NVLink (per GPU)",   c2: "900 GB/s", c3: "1.8 TB/s", c4: "3.6 TB/s", c5: "≥7.2 TB/s"      },
      { c1: "TDP (W)",            c2: "700",      c3: "1200",     c4: "1800",     c5: "≥2400"          },
      { c1: "Availability",       c2: "GA",       c3: "GA",       c4: "Sampling", c5: "Tape-out"       },
    ],
  };
}

// Feature Matrix — products × attributes with status & badge cells.
// Until badge column type lands, badges render as text values like
// "✓ Yes", "Q3 '26", "—". Designed to play well with heatmap mode for
// the numeric columns (TFLOPS, HBM, TDP).
function featureMatrixSheet(): TableSheet {
  return {
    schema: [
      { key: "c1", label: "Product",       type: "text"   },
      { key: "c2", label: "FP8 (PFLOPS)",  type: "number" },
      { key: "c3", label: "HBM (GB)",      type: "number" },
      { key: "c4", label: "TDP (W)",       type: "number" },
      { key: "c5", label: "Avail.",        type: "text"   },
      { key: "c6", label: "FP4 native",    type: "text"   },
    ],
    rows: [
      { c1: "H100 SXM",  c2: 2.0, c3: 80,  c4: 700,  c5: "GA",       c6: "—"     },
      { c1: "H200 SXM",  c2: 2.0, c3: 141, c4: 700,  c5: "GA",       c6: "—"     },
      { c1: "B200 SXM",  c2: 4.5, c3: 192, c4: 1000, c5: "GA",       c6: "✓ Yes" },
      { c1: "GB200 NVL", c2: 5.0, c3: 384, c4: 1200, c5: "GA",       c6: "✓ Yes" },
      { c1: "R100 SXM",  c2: 9.0, c3: 288, c4: 1800, c5: "Q3 '26",   c6: "✓ Yes" },
      { c1: "MI355X",    c2: 3.4, c3: 288, c4: 1400, c5: "GA",       c6: "✓ Yes" },
    ],
  };
}

// BoM / Cost Breakdown — section headers as data rows (full-row
// label, zero values), child rows beneath. Once "section-row" column
// type lands, these labeled rows will render as colored bands instead
// of normal cells.
function bomCostSheet(): TableSheet {
  return {
    schema: [
      { key: "c1", label: "Component",     type: "text"   },
      { key: "c2", label: "Unit cost ($)", type: "number" },
      { key: "c3", label: "Qty",           type: "number" },
      { key: "c4", label: "Extended ($)",  type: "number" },
      { key: "c5", label: "% of total",    type: "percent" },
    ],
    rows: [
      { c1: "── NVIDIA CONTENT ──", c2: 0,     c3: 0,  c4: 0,        c5: 0  },
      { c1: "Rubin GPU",            c2: 42000, c3: 72, c4: 3024000,  c5: 58 },
      { c1: "NVLink Switch 5",      c2: 28000, c3: 18, c4: 504000,   c5: 10 },
      { c1: "CX-9 NIC",             c2: 1900,  c3: 36, c4: 68400,    c5: 1.3 },
      { c1: "── NON-NVIDIA ──",     c2: 0,     c3: 0,  c4: 0,        c5: 0  },
      { c1: "HBM4 stacks",          c2: 1200,  c3: 576,c4: 691200,   c5: 13 },
      { c1: "PCB + substrate",      c2: 9500,  c3: 1,  c4: 9500,     c5: 0.2 },
      { c1: "Cooling (liquid)",     c2: 18000, c3: 1,  c4: 18000,    c5: 0.4 },
      { c1: "PSU + busbar",         c2: 25000, c3: 1,  c4: 25000,    c5: 0.5 },
      { c1: "Total rack BoM",       c2: 0,     c3: 0,  c4: 5200000,  c5: 100 },
    ],
  };
}

// Roadmap Timeline — items × time periods with text status cells
// ("Sampling", "GA", "EOL"). Status badges + Gantt-style spans are
// Tier 3 follow-ups; today we ship the data shape.
function roadmapTimelineSheet(): TableSheet {
  return {
    schema: [
      { key: "c1", label: "Product",   type: "text" },
      { key: "c2", label: "H1 '25",    type: "text" },
      { key: "c3", label: "H2 '25",    type: "text" },
      { key: "c4", label: "H1 '26",    type: "text" },
      { key: "c5", label: "H2 '26",    type: "text" },
      { key: "c6", label: "2027",      type: "text" },
      { key: "c7", label: "2028",      type: "text" },
    ],
    rows: [
      { c1: "Hopper (H100/H200)", c2: "GA",        c3: "GA",        c4: "GA",        c5: "Wind-down", c6: "EOL",      c7: "—" },
      { c1: "Blackwell (B200)",   c2: "Sampling",  c3: "GA ramp",   c4: "GA",        c5: "GA",        c6: "GA",       c7: "Wind-down" },
      { c1: "Blackwell Ultra",    c2: "—",         c3: "—",         c4: "Sampling",  c5: "GA ramp",   c6: "GA",       c7: "GA" },
      { c1: "Rubin (R100)",       c2: "—",         c3: "—",         c4: "—",         c5: "Tape-out",  c6: "Sampling", c7: "GA" },
      { c1: "Rubin Ultra",        c2: "—",         c3: "—",         c4: "—",         c5: "—",         c6: "Tape-out", c7: "Sampling" },
      { c1: "Feynman",            c2: "—",         c3: "—",         c4: "—",         c5: "—",         c6: "—",        c7: "Tape-out" },
    ],
  };
}

// Leaderboard / Ranking — pre-ranked rows with a score % column.
// Once "rank-number" auto-fill + bronze/silver/gold borders land we
// will hide column 1 and decorate rows 0–2; today rank is a number col.
function leaderboardSheet(): TableSheet {
  return {
    schema: [
      { key: "c1", label: "#",          type: "number"  },
      { key: "c2", label: "Provider",   type: "text"    },
      { key: "c3", label: "Score",      type: "number"  },
      { key: "c4", label: "Share",      type: "percent" },
      { key: "c5", label: "Δ vs Q1",    type: "text"    },
    ],
    rows: [
      { c1: 1, c2: "CoreWeave",        c3: 94.2, c4: 22, c5: "▲ +3.1" },
      { c1: 2, c2: "Lambda",           c3: 91.7, c4: 18, c5: "▲ +1.4" },
      { c1: 3, c2: "Crusoe",           c3: 89.5, c4: 14, c5: "▲ +0.8" },
      { c1: 4, c2: "Together",         c3: 87.0, c4: 11, c5: "▲ +2.0" },
      { c1: 5, c2: "Fireworks",        c3: 84.2, c4:  9, c5: "▼ −0.5" },
      { c1: 6, c2: "OCI",              c3: 82.6, c4:  8, c5: "▲ +0.2" },
      { c1: 7, c2: "AWS",              c3: 79.4, c4:  9, c5: "▼ −1.6" },
      { c1: 8, c2: "Azure",            c3: 77.1, c4:  9, c5: "▼ −2.2" },
    ],
  };
}

// TCO / Scenario Comparison — assumption rows × scenarios. Auto-delta
// column + green/red coloring will follow once conditional formatting
// lands; today the Δ column is a string with explicit signs.
function tcoScenarioSheet(): TableSheet {
  return {
    schema: [
      { key: "c1", label: "Assumption",  type: "text"   },
      { key: "c2", label: "Base",        type: "number" },
      { key: "c3", label: "Bull",        type: "number" },
      { key: "c4", label: "Bear",        type: "number" },
      { key: "c5", label: "Δ Bull→Bear", type: "text"   },
    ],
    rows: [
      { c1: "GPU price ($/unit)",    c2: 35000,  c3: 32000, c4: 39000, c5: "+$7,000"  },
      { c1: "Utilization (%)",       c2: 72,     c3: 85,    c4: 55,    c5: "−30 pts"  },
      { c1: "Power cost ($/MWh)",    c2: 65,     c3: 50,    c4: 95,    c5: "+$45"     },
      { c1: "Tokens / GPU-hr (k)",   c2: 480,    c3: 620,   c4: 340,   c5: "−280 k"   },
      { c1: "Useful life (yrs)",     c2: 4,      c3: 5,     c4: 3,     c5: "−2 yrs"   },
      { c1: "Cost / 1M tokens ($)",  c2: 0.42,   c3: 0.21,  c4: 1.08,  c5: "+$0.87"   },
      { c1: "Gross margin (%)",      c2: 58,     c3: 78,    c4: 12,    c5: "−66 pts"  },
    ],
  };
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
  {
    id: "verdict",
    label: "Verdict matrix",
    blurb: "Pass/fail gauntlet w/ verdict column",
    accent: SA.amber,
    glyph: "✓✗",
    build: () => ({
      engine: "standard",
      sheet: verdictMatrixSheet(),
      mode: "data",
      category: "SEMIANALYSIS — MEASUREMENT",
      titleWhite: "Three tests, one ledger ·",
      titleAmber: "what GDP sees",
      subtitle: "Each activity has to clear three columns to land in the headline",
      titleBar: "GDP TEST GAUNTLET",
      highlightRowIdx: 6,
      highlightFlagCol: 4,
      keyInsight: "Only **ordinary market output** clears all three tests. Everything else gets dropped, imputed at cost, or counted in the wrong sector.",
    }),
  },
  {
    id: "ladder",
    label: "Tier ladder",
    blurb: "Stacked categories w/ description",
    accent: SA.violet,
    glyph: "T6",
    build: () => ({
      engine: "standard",
      sheet: tierLadderSheet(),
      mode: "data",
      category: "SEMIANALYSIS — TAXONOMY",
      titleWhite: "Verification",
      titleAmber: "Ladder",
      subtitle: "Seven rungs of evidence · the headline counts only T4+",
      titleBar: "VERIFICATION TIERS",
      highlightRowIdx: 2,
      highlightFlagCol: 1,
      keyInsight: "**T4 — Production Deployment** is the headline floor. Below it the work is unverified or self-graded; above it has external attestation.",
    }),
  },
  {
    id: "roadmap",
    label: "Product roadmap",
    blurb: "Generation-over-generation features",
    accent: SA.blue,
    glyph: "→→",
    build: () => ({
      engine: "standard",
      sheet: roadmapSheet(),
      mode: "data",
      category: "SEMIANALYSIS — ROADMAP",
      titleWhite: "Nvidia Datacenter ·",
      titleAmber: "FY24–FY27",
      subtitle: "Generation cadence · headline accelerator features and the delta vs prior gen",
      titleBar: "ACCELERATOR ROADMAP",
      highlightRowIdx: 4,
      highlightFlagCol: 3,
      keyInsight: "Rubin's **+3.4× throughput** is the largest gen-over-gen step since Hopper — but launch slips to Q4 '26 push first-revenue out of FY26 plans.",
    }),
  },
  {
    id: "bom",
    label: "Bill of materials",
    blurb: "Component × cost × qty, w/ total",
    accent: SA.amber,
    glyph: "Σ$",
    build: () => ({
      engine: "standard",
      sheet: bomSheet(),
      mode: "data",
      category: "SEMIANALYSIS — UNIT ECONOMICS",
      titleWhite: "GB200 NVL72 ·",
      titleAmber: "Rack BOM",
      subtitle: "Per-rack bill of materials · superchip-dominated cost stack",
      titleBar: "BOM · GB200 NVL72",
      aggregate: "sum",
      aggregateLabel: "TOTAL",
      keyInsight: "Compute (superchip + GPUs) is **~92%** of the rack BOM. The remaining 8% — network, power, cooling — is where Nvidia's competitors get squeezed out.",
    }),
  },
  {
    id: "specs",
    label: "Spec comparison",
    blurb: "Generation Δ side-by-side",
    accent: SA.blue,
    glyph: "Δ",
    build: () => ({
      engine: "standard",
      sheet: specComparisonSheet(),
      mode: "data",
      category: "SEMIANALYSIS — SPEC SHEET",
      titleWhite: "Gen 5 → Gen 6 ·",
      titleAmber: "Spec Delta",
      subtitle: "Headline silicon, memory, IO, and price changes between successive gens",
      titleBar: "SPEC DELTA",
      highlightRowIdx: 6,
      highlightFlagCol: 3,
      keyInsight: "Capacity doubled, bandwidth scaled, but launch price moved **+133%** — the per-unit-of-compute price has barely budged.",
    }),
  },
  {
    id: "capacity",
    label: "Capacity ledger",
    blurb: "Quarterly volume × yield, multi-region",
    accent: SA.teal,
    glyph: "▭",
    build: () => ({
      engine: "standard",
      sheet: capacityLedgerSheet(),
      mode: "data",
      category: "SEMIANALYSIS — CAPACITY",
      titleWhite: "Leading-edge",
      titleAmber: "Wafer Starts",
      subtitle: "Quarter × region · wafer starts and yield trajectory",
      titleBar: "FOUNDRY CAPACITY · 2026",
      aggregate: "sum",
      aggregateLabel: "QUARTERLY",
      highlightRowIdx: 6,
      highlightFlagCol: 2,
      keyInsight: "Arizona ramp accelerates **~2.2×** across FY26, but Hsinchu still carries the floor — and Arizona yield is **7pp** below Hsinchu at every milestone.",
    }),
  },
  {
    id: "elo",
    label: "Model leaderboard",
    blurb: "Elo + Δ + win-rate + cost",
    accent: SA.violet,
    glyph: "♛",
    build: () => ({
      engine: "standard",
      sheet: modelEloSheet(),
      mode: "data",
      category: "SEMIANALYSIS — MODEL ECONOMY",
      titleWhite: "Frontier",
      titleAmber: "Leaderboard",
      subtitle: "Arena Elo · 30-day delta · win-rate vs field · API cost per million output tokens",
      titleBar: "ARENA · OUTPUT 1M COST",
      highlightRowIdx: 0,
      highlightFlagCol: 4,
      keyInsight: "**Sonnet 4.6** lands within 37 Elo of the #1 spot at **1/5 the cost** — the price/Elo curve has bent decisively over the last 90 days.",
    }),
  },
  {
    id: "timeline-events",
    label: "Timeline events",
    blurb: "Era-by-era cost + volume",
    accent: SA.amber,
    glyph: "│",
    build: () => ({
      engine: "standard",
      sheet: timelineEventSheet(),
      mode: "data",
      category: "SEMIANALYSIS — TIMELINE",
      titleWhite: "The price of a screw,",
      titleAmber: "1400 → 2025",
      subtitle: "Eight inventions retire the cost of joining metal · 1,500-fold decline",
      titleBar: "PRICE × VOLUME · 625 YEARS",
      highlightRowIdx: 7,
      highlightFlagCol: 2,
      keyInsight: "Screws are **~1,500×** cheaper today than in 1400. Each step on the ladder reads as a single invention retiring a labor cost.",
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
  // — New: chip/system templates per gap analysis —
  {
    id: "spec-compare",
    label: "Spec comparison",
    blurb: "Chip generations · 5-col cross-section",
    accent: SA.blue,
    glyph: "▤",
    build: () => ({
      engine: "standard",
      sheet: specComparisonAdvancedSheet(),
      mode: "data",
      category: "SEMIANALYSIS — HARDWARE",
      titleWhite: "Datacenter GPU",
      titleAmber: "Generations",
      subtitle: "Hopper → Blackwell → Rubin → Feynman · process, HBM, NVLink, TDP",
      titleBar: "MULTI-GEN SPEC SHEET",
    }),
  },
  {
    id: "feature-matrix",
    label: "Feature matrix",
    blurb: "Products × attributes · status pills",
    accent: SA.violet,
    glyph: "▩",
    build: () => ({
      engine: "standard",
      sheet: featureMatrixSheet(),
      mode: "data",
      category: "SEMIANALYSIS — COMPETITIVE",
      titleWhite: "AI Accelerator",
      titleAmber: "Feature Matrix",
      subtitle: "FP8 / HBM / TDP / availability across NVIDIA + AMD lineup",
      titleBar: "ACCELERATOR FEATURE MATRIX",
      highlightRowIdx: 4,
      highlightFlagCol: 0,
    }),
  },
  {
    id: "bom-cost",
    label: "BoM / cost stack",
    blurb: "Section headers · component cost rollup",
    accent: SA.amber,
    glyph: "Σ",
    build: () => ({
      engine: "standard",
      sheet: bomCostSheet(),
      mode: "data",
      category: "SEMIANALYSIS — BoM",
      titleWhite: "NVL144 Rack",
      titleAmber: "Bill of Materials",
      subtitle: "Cost by component · NVIDIA content vs. third-party",
      titleBar: "RACK BoM · 2026",
      highlightRowIdx: 9,
      highlightFlagCol: 3,
      keyInsight: "**$5.2M / rack** — Rubin GPUs alone account for ~58%; HBM4 supply represents ~13% and remains the second-largest swing factor.",
    }),
  },
  {
    id: "roadmap-table",
    label: "Roadmap timeline",
    blurb: "Items × periods · status per cell",
    accent: SA.teal,
    glyph: "▭▭▭",
    build: () => ({
      engine: "standard",
      sheet: roadmapTimelineSheet(),
      mode: "data",
      category: "SEMIANALYSIS — ROADMAP",
      titleWhite: "Datacenter GPU",
      titleAmber: "Schedule",
      subtitle: "Hopper through Feynman · sampling, GA, EOL by half-year",
      titleBar: "GPU PRODUCT ROADMAP",
    }),
  },
  {
    id: "leaderboard",
    label: "Leaderboard",
    blurb: "Ranked rows · share + delta",
    accent: SA.amber,
    glyph: "①②③",
    build: () => ({
      engine: "standard",
      sheet: leaderboardSheet(),
      mode: "data",
      category: "SEMIANALYSIS — CLUSTERMAX",
      titleWhite: "Neocloud",
      titleAmber: "ClusterMAX Rankings",
      subtitle: "Score · share · QoQ change · Q2 2026",
      titleBar: "Q2 '26 NEOCLOUD LEADERBOARD",
      highlightRowIdx: 0,
      highlightFlagCol: 2,
    }),
  },
  {
    id: "tco-scenario",
    label: "TCO scenarios",
    blurb: "Assumptions × Base / Bull / Bear",
    accent: SA.coral,
    glyph: "Δ",
    build: () => ({
      engine: "standard",
      sheet: tcoScenarioSheet(),
      mode: "data",
      category: "SEMIANALYSIS — TCO",
      titleWhite: "AI Cluster",
      titleAmber: "TCO Scenarios",
      subtitle: "Driver-level sensitivity · Base / Bull / Bear over 4 yrs",
      titleBar: "CLUSTER TCO SENSITIVITY",
      highlightRowIdx: 5,
      highlightFlagCol: 1,
      keyInsight: "Cost per **1M tokens** swings from **$0.21** (Bull) to **$1.08** (Bear) — a 5× spread driven primarily by utilization and tokens-per-GPU-hour, not GPU sticker price.",
    }),
  },
];

export function templateById(id: string): TableTemplate | null {
  return TABLE_TEMPLATES.find(t => t.id === id) || null;
}
