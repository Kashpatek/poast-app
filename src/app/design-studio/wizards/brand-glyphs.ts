// Inline SVG fragments for SA brand glyphs that quote templates and
// other server-rendered cards can embed. Keeping them as pure functions
// of size so we don't depend on any external asset paths.

// Simple SA box lettermark — amber box with white "SA" letterforms.
// Not pixel-perfect to the real lettermark but visually on-brand and zero
// network dependency.
export function SA_LOGO_LETTERMARK_SVG(size: number): string {
  const s = Math.round(size);
  const fs = Math.round(s * 0.5);
  return `<g>
  <rect x="0" y="0" width="${s}" height="${s}" rx="${Math.round(s * 0.12)}" fill="#F7B041"/>
  <text x="${s / 2}" y="${s / 2 + fs * 0.36}" font-family="Outfit, sans-serif" font-size="${fs}" font-weight="900" fill="#060608" text-anchor="middle" letter-spacing="-1">SA</text>
</g>`;
}
