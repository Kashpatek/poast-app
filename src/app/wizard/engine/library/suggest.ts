// ═══════════════════════════════════════════════════════════════════════════
// Library mode · topic suggestion — deterministic local keyword scoring.
//
// suggestTopic is a DEFAULT the user confirms in CREATE (finalize pattern:
// same as backdrops — assigned automatically, finalized by the user, never a
// lock). Pure and synchronous: no LLM, no Math.random, no Date — the same
// text always suggests the same topic, so drafts resume identically.
//
// Keyword sets are hand-authored from each topic's `covers` prose in
// public/library/backdrop-topics.json plus SemiAnalysis domain vocabulary.
// Weights: 3 = unambiguous signal (tsmc, nvl72, cowos), 2 = strong,
// 1 = weak / generic-within-domain (rack, cloud, energy). Score = Σ hits × w
// over case-insensitive whole-word matches; ties or zero → "brand".
// ═══════════════════════════════════════════════════════════════════════════

import type { LibTopic, LibTopicKey } from "./data";

// [keyword, weight] per topic. "brand" is the fallback, never scored.
// Multi-word entries match across spaces OR hyphens ("gas turbine" also hits
// "gas-turbine"); single words are exact whole-word ("hbm" does NOT hit
// "hbm4" — both are listed where both matter).
var KEYWORDS: Partial<Record<LibTopicKey, [string, number][]>> = {
  datacenter: [
    ["datacenter", 3], ["datacenters", 3], ["data center", 3], ["data centers", 3],
    ["colo", 3], ["colocation", 3], ["buildout", 3], ["buildouts", 3],
    ["campus", 2], ["campuses", 2], ["hyperscale", 2], ["construction", 1], ["capacity", 1],
  ],
  power: [
    ["nuclear", 3], ["gas turbine", 3], ["gas turbines", 3], ["megawatt", 3], ["megawatts", 3],
    ["gigawatt", 3], ["gigawatts", 3], ["behind-the-meter", 3], ["substation", 3], ["substations", 3],
    ["liquid cooling", 3], ["grid", 2], ["cooling", 2], ["electricity", 2], ["smr", 2], ["smrs", 2],
    ["thermal", 1], ["energy", 1], ["utility", 1], ["utilities", 1], ["power", 1], ["mw", 1], ["gw", 1],
  ],
  accelerator: [
    ["nvidia", 3], ["amd", 3], ["asic", 3], ["asics", 3], ["nvl72", 3], ["nvl144", 3],
    ["blackwell", 3], ["rubin", 3], ["hopper", 3], ["h100", 3], ["h200", 3],
    ["b200", 3], ["gb200", 3], ["gb300", 3], ["mi300", 3], ["mi300x", 3], ["mi325x", 3], ["mi355x", 3],
    ["tpu", 3], ["tpus", 3], ["trainium", 3], ["accelerator", 3], ["accelerators", 3],
    ["gpu", 2], ["gpus", 2], ["chipbook", 2], ["rack", 1], ["racks", 1], ["bom", 1],
  ],
  memory: [
    ["hbm", 3], ["hbm3", 3], ["hbm3e", 3], ["hbm4", 3], ["hbm4e", 3],
    ["dram", 3], ["nand", 3], ["cxmt", 3], ["hynix", 3], ["micron", 3],
    ["ddr5", 3], ["gddr7", 3], ["memory", 2], ["ltas", 2], ["lta", 1],
  ],
  foundry: [
    ["tsmc", 3], ["smic", 3], ["intel foundry", 3], ["samsung foundry", 3],
    ["foundry", 3], ["foundries", 3], ["process node", 3], ["18a", 3], ["2nm", 3], ["3nm", 3],
    ["finfet", 3], ["yield", 2], ["yields", 2], ["wafer", 2], ["wafers", 2], ["gaa", 2], ["n2", 2], ["n3", 2],
    ["node", 1], ["nodes", 1], ["fab", 1], ["fabs", 1], ["intel", 1], ["samsung", 1],
  ],
  packaging: [
    ["cowos", 3], ["emib", 3], ["interposer", 3], ["interposers", 3],
    ["packaging", 3], ["advanced packaging", 3], ["base die", 3], ["base dies", 3],
    ["hybrid bonding", 3], ["osat", 3], ["foveros", 3],
    ["substrate", 2], ["substrates", 2], ["chiplet", 2], ["chiplets", 2], ["abf", 2],
  ],
  equipment: [
    ["asml", 3], ["euv", 3], ["duv", 3], ["litho", 3], ["lithography", 3],
    ["wfe", 3], ["metrology", 3], ["high-na", 3], ["applied materials", 3],
    ["lam research", 3], ["kla", 3], ["tokyo electron", 3],
    ["fab equipment", 3], ["wafer fab equipment", 3],
    ["etch", 2], ["deposition", 2], ["scanner", 2], ["scanners", 2], ["reticle", 2],
  ],
  networking: [
    ["nvlink", 3], ["ethernet", 3], ["infiniband", 3], ["co-packaged", 3],
    ["transceiver", 3], ["transceivers", 3], ["spectrum-x", 3], ["tomahawk", 3], ["networking", 3],
    ["optics", 2], ["fabric", 2], ["fabrics", 2], ["cpo", 2], ["photonics", 2],
    ["scale-up", 2], ["scale-out", 2], ["nics", 2],
    ["optical", 1], ["switch", 1], ["switches", 1], ["nic", 1],
  ],
  cloud: [
    ["neocloud", 3], ["neoclouds", 3], ["coreweave", 3], ["clustermax", 3],
    ["gpu cloud", 3], ["gpu clouds", 3], ["gpu pricing", 3], ["gpu rental", 3],
    ["nebius", 3], ["crusoe", 3], ["lambda labs", 3],
    ["tco", 2], ["rental", 1], ["rentals", 1], ["cloud", 1], ["clouds", 1],
    ["azure", 1], ["aws", 1], ["gcp", 1],
  ],
  "models-labs": [
    ["openai", 3], ["anthropic", 3], ["llama", 3], ["tokenomics", 3], ["inferencex", 3],
    ["deepseek", 3], ["mistral", 3], ["qwen", 3], ["frontier model", 3], ["frontier models", 3],
    ["pretraining", 3], ["post-training", 3], ["rlhf", 3],
    ["inference", 2], ["training", 2], ["claude", 2], ["gpt", 2], ["gemini", 2],
    ["grok", 2], ["xai", 2], ["agi", 2], ["reasoning", 1], ["tokens", 1],
  ],
  markets: [
    ["capex", 3], ["earnings", 3], ["ipo", 3], ["ipos", 3], ["supply chain", 3],
    ["revenue", 2], ["revenues", 2], ["valuation", 2], ["financing", 2], ["market cap", 2], ["opex", 2],
    ["guidance", 1], ["stock", 1], ["stocks", 1], ["hyperscaler", 1], ["hyperscalers", 1],
    ["margins", 1], ["quarter", 1], ["debt", 1],
  ],
  geopolitics: [
    ["export controls", 3], ["export control", 3], ["huawei", 3], ["sanctions", 3],
    ["entity list", 3], ["geopolitical", 3], ["geopolitics", 3],
    ["china", 2], ["chinese", 2], ["beijing", 2], ["sanction", 2],
    ["tariff", 2], ["tariffs", 2], ["loophole", 2], ["loopholes", 2], ["910b", 2],
    ["ascend", 1],
  ],
  "space-dc": [
    ["orbital", 3], ["space datacenter", 3], ["space datacenters", 3], ["space dc", 3], ["space-based", 3],
    ["orbit", 2], ["satellite", 2], ["satellites", 2], ["leo", 2], ["starship", 2],
    ["space", 1],
  ],
};

function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Compile once at module load. Whole-word, case-insensitive; internal
// space/hyphen separators are interchangeable so "gas turbine" ≡ "gas-turbine".
var COMPILED: Partial<Record<LibTopicKey, { re: RegExp; w: number }[]>> = {};
for (var tk in KEYWORDS) {
  COMPILED[tk as LibTopicKey] = (KEYWORDS[tk as LibTopicKey] as [string, number][]).map(function (pair) {
    var body = pair[0].split(/[\s-]+/).map(escRe).join("[\\s-]+");
    return { re: new RegExp("\\b" + body + "\\b", "gi"), w: pair[1] };
  });
}

/**
 * Suggest a topic for an article text. Highest weighted-hit score wins;
 * a tie between topics or no signal at all falls back to "brand" (the
 * universal pool). Iterates the passed topics so only topics present in
 * backdrop-topics.json are ever suggested.
 */
export function suggestTopic(text: string, topics: LibTopic[]): LibTopicKey {
  var best: LibTopicKey = "brand";
  var bestScore = 0;
  var tied = false;
  for (var i = 0; i < topics.length; i++) {
    var key = topics[i].key;
    if (key === "brand") continue; // fallback pool, never scored
    var rules = COMPILED[key];
    if (!rules) continue;
    var score = 0;
    for (var r = 0; r < rules.length; r++) {
      var m = text.match(rules[r].re);
      if (m) score += m.length * rules[r].w;
    }
    if (score > bestScore) { bestScore = score; best = key; tied = false; }
    else if (score === bestScore && score > 0) tied = true;
  }
  return bestScore > 0 && !tied ? best : "brand";
}
