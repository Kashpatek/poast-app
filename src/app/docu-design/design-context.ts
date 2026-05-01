import { D, ft, gf, mn } from "../shared-constants";
import type { Artboard } from "./artboard-ops";

export type Fidelity = "wireframe" | "high";
export type ProjectType = "document" | "other";

export type DesignSystem = {
  id: string;
  name: string;
  status?: "published" | "draft";
  isDefault?: boolean;
  assets?: Array<{ url: string; kind: "logo" | "backdrop" | "font" | "other"; name?: string }>;
  analyzed?: {
    colors?: Array<{ name?: string; hex: string }>;
    typography?: { display?: string; body?: string; mono?: string; notes?: string };
    layoutNotes?: string;
    toneNotes?: string;
  };
  notes?: string;
};

export type ProjectMeta = {
  id: string;
  name: string;
  type: ProjectType;
  fidelity: Fidelity;
};

interface BuildOptions {
  project: ProjectMeta;
  designSystem: DesignSystem | null;
  artboards: Artboard[];
}

const OUTPUT_PROTOCOL = `## Output protocol (REQUIRED)

You write artboards using these markers. Anything outside markers is shown to the user as chat prose.

To create or fully replace an artboard:
<<<ARTBOARD op="write" id="UNIQUE_ID" w="WIDTH" h="HEIGHT" label="Human Label">>>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 WIDTH HEIGHT" width="WIDTH" height="HEIGHT">
  ...
</svg>
<<<END>>>

To delete an artboard:
<<<DELETE id="UNIQUE_ID">>>

Rules:
- IDs are stable. Use the same id for the same page across edits. New pages get new ids.
- Always emit a complete <svg> root inside a write block. Never emit partial SVG fragments.
- Set both width/height attributes AND a viewBox so the artboard scales cleanly in the preview.
- Group logical layers with <g id="layer-name"> so Illustrator imports them as separate layers.
- Use plain SVG elements only: <rect>, <circle>, <path>, <text>, <g>, <image>, <line>, <polyline>, <polygon>, <defs>, <linearGradient>, <radialGradient>, <filter>. No <foreignObject>, no <script>, no inline event handlers.
- For text, use <text> with explicit font-family, font-size, fill. Embed the actual font name from the design system.
- For images (logos, backdrops), use <image href="..." /> with the exact URLs provided in the design system.
- Brief prose between blocks should explain what changed and why. Keep it under two sentences per turn.
`;

const VOICE_RULES = `## Voice & copy rules
- No em dashes. Use commas, periods, or colons.
- No emojis.
- Confident, technical, institutional tone (SemiAnalysis voice).
- No hype words like "revolutionary", "game-changing", "unleash".
- Plain declarative sentences. Avoid bullets unless the design clearly calls for a bullet list.`;

const WIREFRAME_RULES = `## Fidelity: WIREFRAME
- Use a grayscale palette only: #FFFFFF, #F4F4F5, #D4D4D8, #71717A, #18181B.
- Replace images with dashed-stroke rectangles labelled "image" centered.
- Replace logos with a dashed-stroke rectangle labelled "logo".
- Use a single sans font: "Inter, system-ui, sans-serif".
- Use Lorem ipsum for body copy if real copy is missing.
- Skip decorative effects: no gradients, no glows, no filters.
- Goal: communicate layout structure, not visual polish.`;

const HIGH_FIDELITY_RULES = `## Fidelity: HIGH
- Use the design system's colors, typography, and assets faithfully.
- Reference logos and backdrops by their exact URL via <image href>.
- Apply gradients, glows, and decorative detail where they serve the design.
- Real copy. No placeholder text unless the user asks for it.`;

function buildDocTypeRules(type: ProjectType): string {
  if (type === "document") {
    return `## Document type: DOCUMENT
- This is a multi-page print document. Default page size: US Letter at 96dpi → w="816" h="1056". A4 if the user requests it → w="794" h="1123".
- Order pages by their position in the conversation: id "p1", "p2", "p3", … unless the user introduces other ids.
- Maintain consistent margins (default 64px on all sides) and a clear visual hierarchy across pages.
- The first page is typically a cover; the last page is typically a closer or summary.`;
  }
  return `## Document type: OTHER
- A free-form single-artboard graphic (poster, social tile, hero image, chart, illustration).
- Default to one artboard with id="main". Use a square 1080×1080 unless the user asks for another size.
- Compose for visual impact: clear focal point, strong type hierarchy, intentional negative space.`;
}

function summarizeDesignSystem(ds: DesignSystem | null): string {
  if (!ds) {
    return `## Design system: FALLBACK
No active design system. Use the SemiAnalysis fallback tokens:
${JSON.stringify(
  {
    colors: D,
    fonts: { display: gf, body: ft, mono: mn },
  },
  null,
  2
)}`;
  }

  const parts: string[] = [`## Design system: ${ds.name}${ds.isDefault ? " (default)" : ""}`];

  if (ds.analyzed?.colors?.length) {
    parts.push(
      "Colors:\n" +
        ds.analyzed.colors
          .map((c) => `  - ${c.hex}${c.name ? ` (${c.name})` : ""}`)
          .join("\n")
    );
  }

  if (ds.analyzed?.typography) {
    const t = ds.analyzed.typography;
    parts.push(
      "Typography:\n" +
        [
          t.display && `  - display: ${t.display}`,
          t.body && `  - body: ${t.body}`,
          t.mono && `  - mono: ${t.mono}`,
          t.notes && `  - notes: ${t.notes}`,
        ]
          .filter(Boolean)
          .join("\n")
    );
  }

  if (ds.assets?.length) {
    parts.push(
      "Assets (reference these by exact URL):\n" +
        ds.assets
          .map((a) => `  - [${a.kind}]${a.name ? ` ${a.name}` : ""}: ${a.url}`)
          .join("\n")
    );
  }

  if (ds.analyzed?.layoutNotes) parts.push(`Layout notes: ${ds.analyzed.layoutNotes}`);
  if (ds.analyzed?.toneNotes) parts.push(`Tone notes: ${ds.analyzed.toneNotes}`);
  if (ds.notes) parts.push(`Brand notes: ${ds.notes}`);

  parts.push(
    "\nFallback tokens (use only when the design system above is silent on a value):\n" +
      JSON.stringify({ colors: D, fonts: { display: gf, body: ft, mono: mn } }, null, 2)
  );

  return parts.join("\n\n");
}

function summarizeArtboards(artboards: Artboard[]): string {
  if (!artboards.length) return "## Current state\n(No artboards yet.)";
  const lines = artboards.map((a) => {
    const len = a.svg.length;
    return `  - id="${a.id}" ${a.w}×${a.h}${a.label ? ` "${a.label}"` : ""} (${len} chars)`;
  });
  return `## Current state\nThere are ${artboards.length} artboard(s) in this project:\n${lines.join("\n")}\n\nWhen iterating, only re-emit artboards you change. Use the same id to replace an existing artboard. Use <<<DELETE>>> to remove one.`;
}

export function buildSystemPrompt(opts: BuildOptions): string {
  const { project, designSystem, artboards } = opts;
  const fidelityRules = project.fidelity === "wireframe" ? WIREFRAME_RULES : HIGH_FIDELITY_RULES;

  return [
    `You are DocuDesign, an AI design partner. You help the user create on-brand SVG documents and graphics through conversation. You generate real SVG that opens cleanly in Adobe Illustrator. The user iterates with you in chat; you respond by emitting artboard write/delete operations using the protocol below, plus brief prose explaining what you changed.`,
    summarizeDesignSystem(designSystem),
    buildDocTypeRules(project.type),
    fidelityRules,
    VOICE_RULES,
    OUTPUT_PROTOCOL,
    summarizeArtboards(artboards),
    `Project name: "${project.name}". Stay focused on the user's intent and the existing artboards. If the user's request is ambiguous, make a confident choice and explain it briefly.`,
  ].join("\n\n");
}

const ANALYZE_BRAND_SYSTEM = `You analyze brand assets and infer a design system. Given a list of asset URLs (logos, backdrops, sample documents) and any user notes, return a strict JSON object describing the brand.

Return JSON only, no markdown fences. Schema:
{
  "colors": [{"name": "primary", "hex": "#RRGGBB"}, ...],   // 3-8 colors, hex strings
  "typography": {
    "display": "font name or family description",
    "body": "font name or family description",
    "mono": "font name or family description (optional)",
    "notes": "any typographic conventions observed"
  },
  "layoutNotes": "1-3 sentences on grid, spacing, composition tendencies",
  "toneNotes": "1-2 sentences on visual mood (dark/light, technical/playful, etc.)"
}

Rules:
- Use lowercase hex with leading #.
- If no clear value can be inferred, omit the key (do not invent).
- Be specific: instead of "modern sans-serif" prefer "geometric grotesque such as Outfit or Inter".`;

export function buildAnalyzeBrandPrompt(input: {
  assets: Array<{ url: string; kind: string; name?: string }>;
  notes?: string;
}): { system: string; prompt: string } {
  const assetLines = input.assets
    .map((a, i) => `${i + 1}. [${a.kind}]${a.name ? ` ${a.name}` : ""} ${a.url}`)
    .join("\n");
  return {
    system: ANALYZE_BRAND_SYSTEM,
    prompt: `Brand assets:\n${assetLines}\n\n${input.notes ? `User notes:\n${input.notes}\n\n` : ""}Return the JSON design system.`,
  };
}
