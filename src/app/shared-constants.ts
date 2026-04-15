// @ts-nocheck
// ═══ POAST SHARED CONSTANTS ═══

// ─── Design Tokens ───
export var D = {
  bg: "#06060C", card: "#09090D", border: "rgba(255,255,255,0.06)", hover: "#0D0D12",
  surface: "#0D0D12", tx: "#E8E4DD", txm: "#8A8690", txd: "#4E4B56",
  amber: "#F7B041", blue: "#0B86D1", teal: "#2EAD8E", coral: "#E06347",
  violet: "#905CCB", cyan: "#26C9D8", crimson: "#D1334A",
  glow: "0 2px 12px rgba(0,0,0,0.4), 0 0 0 0 rgba(247,176,65,0)",
  glowHover: "0 8px 30px rgba(0,0,0,0.5), 0 0 20px rgba(247,176,65,0.08)",
  cardGrad: "linear-gradient(135deg, #09090D 0%, #0D0D12 100%)",
  surfGrad: "linear-gradient(135deg, #0D0D12 0%, #09090D 100%)",
};

// ─── Font Constants ───
export var ft = "'Outfit',sans-serif";
export var gf = "'Grift','Outfit',sans-serif";
export var mn = "'JetBrains Mono',monospace";

// ─── Platform Colors ───
export var PL = { x: "#1DA1F2", li: "#0A66C2", fb: "#1877F2", ig: "#E4405F", yt: "#FF0000", tt: "#00F2EA" };

// ─── Platform Configs ───
export var PLATS = {
  twitter: { n: "X / Twitter", i: "\uD83D\uDC26", c: "#1DA1F2", s: "X", lim: 280 },
  linkedin: { n: "LinkedIn", i: "\uD83D\uDCBC", c: "#0A66C2", s: "LI", lim: 3000 },
  facebook: { n: "Facebook", i: "\uD83D\uDCD8", c: "#1877F2", s: "FB", lim: 63206 },
  instagram: { n: "Instagram", i: "\uD83D\uDCF7", c: "#E4405F", s: "IG", lim: 2200 },
  youtube: { n: "YouTube", i: "\u25B6\uFE0F", c: "#FF0000", s: "YT", lim: 5000 },
  tiktok: { n: "TikTok", i: "\uD83C\uDFB5", c: "#00F2EA", s: "TT", lim: 2200 },
  threads: { n: "Threads", i: "\uD83E\uDDF5", c: "#999", s: "TH", lim: 500 },
  bluesky: { n: "Bluesky", i: "\u2601\uFE0F", c: "#0085FF", s: "BS", lim: 300 },
};

// ─── Team Roster ───
export var TEAM = [
  { id: "dp", name: "Dylan Patel", role: "Chief Analyst", initials: "DP", color: "#F7B041", expertise: ["Semiconductors", "AI Infrastructure", "Supply Chain", "Geopolitics", "Capex Analysis"] },
  { id: "do", name: "Doug O'Laughlin", role: "Senior Analyst", initials: "DO", color: "#0B86D1", expertise: ["Memory", "Compute", "Data Centers", "Financial Analysis", "HBM"] },
  { id: "jn", name: "Jordan Nanos", role: "Analyst", initials: "JN", color: "#2EAD8E", expertise: ["AI Models", "ML Infrastructure", "Cloud Computing", "Inference"] },
  { id: "dn", name: "Dan Nishball", role: "Analyst", initials: "DN", color: "#E06347", expertise: ["Hardware Design", "Chip Architecture", "Manufacturing", "Defense"] },
  { id: "kc", name: "Kimbo Chen", role: "Analyst", initials: "KC", color: "#26C9D8", expertise: ["Semiconductors", "Process Technology", "Foundry", "Advanced Packaging"] },
  { id: "cq", name: "Cameron Quilici", role: "Analyst", initials: "CQ", color: "#8B5CF6", expertise: ["AI Infrastructure", "Networking", "Optics", "Datacenter Design"] },
  { id: "wc", name: "Wega Chu", role: "Analyst", initials: "WC", color: "#EC4899", expertise: ["Memory", "NAND", "Storage", "Supply Chain"] },
];

// ─── Topic Categories ───
export var TOPIC_CATEGORIES = ["Semiconductors", "AI Infra", "Data Center", "Memory", "Geopolitics", "Compute", "Other"];

// ─── Tier Constants ───
export var TIERS = ["S", "A", "B", "C"];
export var TIER_COLORS = { S: "#F7B041", A: "#0B86D1", B: "#2EAD8E", C: "#8A8690" };

// ─── Shared Utilities ───
export function copyText(str) {
  try { var ta = document.createElement("textarea"); ta.value = str; ta.style.position = "fixed"; ta.style.left = "-9999px"; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); return true; } catch (e) { try { navigator.clipboard.writeText(str); return true; } catch (e2) { return false; } }
}

export function uid(prefix) { return (prefix || "id") + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8); }

// ─── API Helpers ───
export async function askAPI(sys, prompt) {
  try {
    var r = await fetch("/api/generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: sys, prompt: prompt }),
    });
    var d = await r.json();
    if (d.error) { console.error("API Error:", d.error); return null; }
    if (!d.content) { return null; }
    var t = (d.content || []).map(function(c) { return c.text || ""; }).join("");
    try {
      return JSON.parse(t.replace(/\`\`\`json|\`\`\`/g, "").trim());
    } catch (pe) { console.error("Parse error:", t); return null; }
  } catch (e) { console.error("API:", e); return null; }
}

export async function askAPIRaw(sys, prompt) {
  try {
    var r = await fetch("/api/generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: sys, prompt: prompt }),
    });
    var d = await r.json();
    if (d.error) return null;
    if (!d.content) return null;
    return (d.content || []).map(function(c) { return c.text || ""; }).join("");
  } catch (e) { return null; }
}

// ─── DB Helpers ───
export async function dbGet(table, id) {
  try {
    var url = "/api/db?table=" + table;
    if (id) url += "&id=" + id;
    var r = await fetch(url);
    var d = await r.json();
    return d.data || [];
  } catch (e) { return []; }
}

export async function dbSave(table, data) {
  try {
    await fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: table, data: data }),
    });
  } catch (e) {}
}

export async function dbDelete(table, id) {
  try {
    await fetch("/api/db", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: table, id: id }),
    });
  } catch (e) {}
}
