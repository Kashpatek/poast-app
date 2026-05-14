// Server-rendered SA quote-card templates. Each template returns a complete
// SVG string that drops into the artboard array as-is. Templates are pure
// functions of (quote, attribution, source, dimensions) so re-rendering is
// trivial — the user can re-pick a template in the canvas later.

import { SA_LOGO_LETTERMARK_SVG } from "./brand-glyphs";

export interface QuoteTemplateInput {
  quote: string;
  attribution: string;
  source?: string;
  w: number;
  h: number;
}

export type QuoteTemplateId =
  | "amber-on-dark"
  | "cobalt-rule"
  | "editorial-serif"
  | "lettermark-stamp";

export interface QuoteTemplateMeta {
  id: QuoteTemplateId;
  label: string;
  sub: string;
}

export const QUOTE_TEMPLATES: QuoteTemplateMeta[] = [
  { id: "amber-on-dark",     label: "Amber on dark",     sub: "Heavy display type, amber rule, single accent" },
  { id: "cobalt-rule",       label: "Cobalt grid",       sub: "Editorial grid, cobalt rule, restrained accent" },
  { id: "editorial-serif",   label: "Editorial",         sub: "Pull-quote feel, oversized open-quote glyph" },
  { id: "lettermark-stamp",  label: "Lettermark stamp",  sub: "SA box lettermark prominent, brand-forward" },
];

// XML-escape user input so no quote can ever break the SVG.
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Naive line-wrap by character count. Good enough for templated cards;
// users can edit type in the canvas chat afterward.
function wrap(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length <= maxChars) {
      cur = (cur + " " + w).trim();
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export function composeQuoteSvg(id: QuoteTemplateId, input: QuoteTemplateInput): string {
  if (id === "cobalt-rule") return cobaltRule(input);
  if (id === "editorial-serif") return editorialSerif(input);
  if (id === "lettermark-stamp") return lettermarkStamp(input);
  return amberOnDark(input);
}

// ─── Templates ──────────────────────────────────────────────────────

function amberOnDark({ quote, attribution, source, w, h }: QuoteTemplateInput): string {
  const padding = Math.round(Math.min(w, h) * 0.08);
  const maxChars = Math.max(18, Math.floor(w / 32));
  const lines = wrap(quote, maxChars);
  const fontSize = Math.min(
    Math.round((h - padding * 2 - 140) / Math.max(lines.length, 1) * 0.85),
    Math.round(w / 14)
  );
  const yStart = Math.round((h - lines.length * fontSize * 1.12) / 2 - fontSize * 0.2);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" style="max-width:100%;max-height:100%;height:auto;display:block;">
  <rect x="0" y="0" width="${w}" height="${h}" fill="#06060C"/>
  <rect x="${padding}" y="${padding}" width="${Math.round(fontSize * 0.4)}" height="${h - padding * 2}" fill="#F7B041"/>
  <g font-family="Outfit, 'Helvetica Neue', sans-serif" fill="#E8E4DD">
    ${lines.map((line, i) => `<text x="${padding * 2 + fontSize * 0.6}" y="${yStart + i * fontSize * 1.12 + fontSize}" font-size="${fontSize}" font-weight="800" letter-spacing="-0.5">${esc(line)}</text>`).join("\n    ")}
  </g>
  <g font-family="'JetBrains Mono', monospace" fill="#F7B041">
    <text x="${padding * 2 + fontSize * 0.6}" y="${h - padding - (source ? 22 : 6)}" font-size="${Math.round(fontSize * 0.28)}" font-weight="700" letter-spacing="2">— ${esc(attribution.toUpperCase())}</text>
    ${source ? `<text x="${padding * 2 + fontSize * 0.6}" y="${h - padding}" font-size="${Math.round(fontSize * 0.22)}" fill="#9B9588" letter-spacing="1">${esc(source.toUpperCase())}</text>` : ""}
  </g>
</svg>`;
}

function cobaltRule({ quote, attribution, source, w, h }: QuoteTemplateInput): string {
  const padding = Math.round(Math.min(w, h) * 0.08);
  const maxChars = Math.max(20, Math.floor(w / 30));
  const lines = wrap(quote, maxChars);
  const fontSize = Math.min(
    Math.round((h - padding * 2 - 140) / Math.max(lines.length, 1) * 0.78),
    Math.round(w / 16)
  );
  const yStart = Math.round((h - lines.length * fontSize * 1.15) / 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <rect x="0" y="0" width="${w}" height="${h}" fill="#0A0A14"/>
  <line x1="${padding}" y1="${padding * 0.7}" x2="${w - padding}" y2="${padding * 0.7}" stroke="#0B86D1" stroke-width="2"/>
  <line x1="${padding}" y1="${h - padding * 0.7}" x2="${w - padding}" y2="${h - padding * 0.7}" stroke="#0B86D1" stroke-width="2"/>
  <g font-family="Outfit, sans-serif" fill="#E8E4DD">
    ${lines.map((line, i) => `<text x="${w / 2}" y="${yStart + i * fontSize * 1.15 + fontSize}" font-size="${fontSize}" font-weight="700" text-anchor="middle" letter-spacing="-0.4">${esc(line)}</text>`).join("\n    ")}
  </g>
  <g font-family="'JetBrains Mono', monospace" text-anchor="middle">
    <text x="${w / 2}" y="${h - padding - (source ? 22 : 4)}" font-size="${Math.round(fontSize * 0.3)}" fill="#0B86D1" font-weight="700" letter-spacing="3">${esc(attribution.toUpperCase())}</text>
    ${source ? `<text x="${w / 2}" y="${h - padding + 8}" font-size="${Math.round(fontSize * 0.22)}" fill="#8a8a92" letter-spacing="1.5">${esc(source.toUpperCase())}</text>` : ""}
  </g>
</svg>`;
}

function editorialSerif({ quote, attribution, source, w, h }: QuoteTemplateInput): string {
  const padding = Math.round(Math.min(w, h) * 0.08);
  const maxChars = Math.max(22, Math.floor(w / 28));
  const lines = wrap(quote, maxChars);
  const fontSize = Math.min(
    Math.round((h - padding * 2 - 160) / Math.max(lines.length, 1) * 0.78),
    Math.round(w / 18)
  );
  const yStart = Math.round((h - lines.length * fontSize * 1.18) / 2 + fontSize * 0.4);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <rect x="0" y="0" width="${w}" height="${h}" fill="#F4EFE8"/>
  <text x="${padding}" y="${padding + Math.round(w / 6)}" font-family="Georgia, 'Times New Roman', serif" font-size="${Math.round(w / 5)}" fill="#E06347" font-weight="900" opacity="0.85">“</text>
  <g font-family="Georgia, 'Times New Roman', serif" fill="#1A1A1A">
    ${lines.map((line, i) => `<text x="${padding}" y="${yStart + i * fontSize * 1.18 + fontSize}" font-size="${fontSize}" font-style="italic">${esc(line)}</text>`).join("\n    ")}
  </g>
  <g font-family="'JetBrains Mono', monospace" fill="#1A1A1A">
    <text x="${padding}" y="${h - padding - (source ? 22 : 4)}" font-size="${Math.round(fontSize * 0.28)}" font-weight="700" letter-spacing="2">— ${esc(attribution.toUpperCase())}</text>
    ${source ? `<text x="${padding}" y="${h - padding + 4}" font-size="${Math.round(fontSize * 0.22)}" fill="#5b5b5b" letter-spacing="1">${esc(source.toUpperCase())}</text>` : ""}
  </g>
</svg>`;
}

function lettermarkStamp({ quote, attribution, source, w, h }: QuoteTemplateInput): string {
  const padding = Math.round(Math.min(w, h) * 0.07);
  const stampSize = Math.round(Math.min(w, h) * 0.18);
  const maxChars = Math.max(18, Math.floor(w / 30));
  const lines = wrap(quote, maxChars);
  const fontSize = Math.min(
    Math.round((h - padding * 2 - stampSize - 100) / Math.max(lines.length, 1) * 0.82),
    Math.round(w / 14)
  );
  const yStart = Math.round((h - lines.length * fontSize * 1.12) / 2 + stampSize * 0.5);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" style="max-width:100%;max-height:100%;height:auto;display:block;">
  <rect x="0" y="0" width="${w}" height="${h}" fill="#06060C"/>
  <g transform="translate(${padding}, ${padding})">
    ${SA_LOGO_LETTERMARK_SVG(stampSize)}
  </g>
  <g font-family="Outfit, sans-serif" fill="#E8E4DD">
    ${lines.map((line, i) => `<text x="${padding}" y="${yStart + i * fontSize * 1.12 + fontSize}" font-size="${fontSize}" font-weight="800" letter-spacing="-0.5">${esc(line)}</text>`).join("\n    ")}
  </g>
  <g font-family="'JetBrains Mono', monospace">
    <text x="${padding}" y="${h - padding - (source ? 22 : 4)}" font-size="${Math.round(fontSize * 0.28)}" fill="#F7B041" font-weight="700" letter-spacing="2">— ${esc(attribution.toUpperCase())}</text>
    ${source ? `<text x="${padding}" y="${h - padding + 4}" font-size="${Math.round(fontSize * 0.22)}" fill="#9B9588" letter-spacing="1">${esc(source.toUpperCase())}</text>` : ""}
  </g>
</svg>`;
}
