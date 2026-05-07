import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import JSZip from "jszip";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// POAST brand-kit ZIP. Built fresh on every request from /public/fonts +
// /public/*.svg|.png + a hand-written tokens block. Small enough that
// rebuilding is fine; cached at the CDN edge for 5min anyway.

const PUBLIC_DIR = path.join(process.cwd(), "public");

// CSS variables — kept inline so this route never depends on importing
// from style-guide.html. Mirrors the [data-theme] tokens exactly.
const TOKENS_CSS = `/* POAST Design Tokens · v3
   Drop this at the top of any stylesheet. Default = dark. Add
   data-theme="light" to <html> for the light theme. */

:root, [data-theme="dark"] {
  /* Surfaces */
  --bg:           #06060C;
  --surface:      #0D0D12;
  --card:         #09090D;
  --hover:        #11111A;
  --border:       rgba(255,255,255,0.06);
  --border-hover: rgba(255,255,255,0.12);

  /* Text */
  --tx:           #E8E4DD;
  --tx-muted:     #8A8690;
  --tx-dim:       #4E4B56;

  /* Shadows */
  --shadow-card:  0 2px 12px rgba(0,0,0,0.4);
  --shadow-hover: 0 8px 30px rgba(0,0,0,0.5), 0 0 20px rgba(247,176,65,0.08);
  --shadow-glow:  0 0 24px rgba(247,176,65,0.10);
  --shadow-modal: 0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(247,176,65,0.05);
  --shadow-focus: 0 0 0 3px rgba(247,176,65,0.20), 0 0 16px rgba(247,176,65,0.08);
}

[data-theme="light"] {
  --bg:           #FAFAF6;
  --surface:      #F2F1EC;
  --card:         #FFFFFF;
  --hover:        #F6F5F0;
  --border:       rgba(0,0,0,0.08);
  --border-hover: rgba(0,0,0,0.16);

  --tx:           #1C1A18;
  --tx-muted:     #6A6770;
  --tx-dim:       #A29DA8;

  --shadow-card:  0 1px 3px rgba(0,0,0,0.05);
  --shadow-hover: 0 6px 20px rgba(0,0,0,0.08), 0 0 20px rgba(247,176,65,0.18);
  --shadow-glow:  0 0 0 1px rgba(247,176,65,0.40), 0 4px 16px rgba(247,176,65,0.18);
  --shadow-modal: 0 24px 64px rgba(0,0,0,0.16), 0 0 0 1px rgba(247,176,65,0.15);
  --shadow-focus: 0 0 0 3px rgba(247,176,65,0.20), 0 0 12px rgba(247,176,65,0.18);
}

/* Accents — same in both themes. Brand stays brand. */
:root {
  --amber:    #F7B041;
  --blue:     #0B86D1;
  --teal:     #2EAD8E;
  --coral:    #E06347;
  --violet:   #905CCB;
  --cyan:     #26C9D8;
  --crimson:  #D1334A;

  --x:         #1DA1F2;
  --linkedin:  #0A66C2;
  --facebook:  #1877F2;
  --instagram: #E4405F;
  --youtube:   #FF0000;
  --tiktok:    #00F2EA;
  --spotify:   #1DB954;

  --ft-display:  'Grift', 'Outfit', sans-serif;
  --ft-body:     'Outfit', sans-serif;
  --ft-mono:     'JetBrains Mono', monospace;

  --grad-card:    linear-gradient(135deg, var(--card) 0%, var(--surface) 100%);
  --grad-surface: linear-gradient(135deg, var(--surface) 0%, var(--card) 100%);
  --grad-cta:     linear-gradient(135deg, #F7B041, #26C9D8);
}
`;

const TOKENS_SCSS = `// POAST Design Tokens · SCSS
// Source: poast-app · /style-guide.html

// Surfaces (dark)
$bg:           #06060C;
$surface:      #0D0D12;
$card:         #09090D;
$hover:        #11111A;
$border:       rgba(255,255,255,0.06);
$border-hover: rgba(255,255,255,0.12);

// Text (dark)
$tx:           #E8E4DD;
$tx-muted:     #8A8690;
$tx-dim:       #4E4B56;

// Surfaces (light)
$bg-light:     #FAFAF6;
$surface-light: #F2F1EC;
$card-light:   #FFFFFF;
$hover-light:  #F6F5F0;
$border-light: rgba(0,0,0,0.08);
$tx-light:     #1C1A18;
$tx-muted-light: #6A6770;
$tx-dim-light: #A29DA8;

// Accents (constant)
$amber:    #F7B041;
$blue:     #0B86D1;
$teal:     #2EAD8E;
$coral:    #E06347;
$violet:   #905CCB;
$cyan:     #26C9D8;
$crimson:  #D1334A;

// Type
$ft-display:  'Grift', 'Outfit', sans-serif;
$ft-body:     'Outfit', sans-serif;
$ft-mono:     'JetBrains Mono', monospace;

// Shadows (dark)
$shadow-card:  0 2px 12px rgba(0,0,0,0.4);
$shadow-hover: 0 8px 30px rgba(0,0,0,0.5), 0 0 20px rgba(247,176,65,0.08);
$shadow-glow:  0 0 24px rgba(247,176,65,0.10);

// Gradients
$grad-cta: linear-gradient(135deg, #F7B041, #26C9D8);
`;

const TOKENS_JSON = {
  meta: { name: "POAST Design Tokens", version: "3", source: "https://poast-app.vercel.app/style-guide.html" },
  themes: {
    dark: {
      bg: "#06060C",
      surface: "#0D0D12",
      card: "#09090D",
      hover: "#11111A",
      border: "rgba(255,255,255,0.06)",
      borderHover: "rgba(255,255,255,0.12)",
      tx: "#E8E4DD",
      txMuted: "#8A8690",
      txDim: "#4E4B56",
    },
    light: {
      bg: "#FAFAF6",
      surface: "#F2F1EC",
      card: "#FFFFFF",
      hover: "#F6F5F0",
      border: "rgba(0,0,0,0.08)",
      borderHover: "rgba(0,0,0,0.16)",
      tx: "#1C1A18",
      txMuted: "#6A6770",
      txDim: "#A29DA8",
    },
  },
  accents: {
    amber: "#F7B041",
    blue: "#0B86D1",
    teal: "#2EAD8E",
    coral: "#E06347",
    violet: "#905CCB",
    cyan: "#26C9D8",
    crimson: "#D1334A",
  },
  platforms: {
    x: "#1DA1F2",
    linkedin: "#0A66C2",
    facebook: "#1877F2",
    instagram: "#E4405F",
    youtube: "#FF0000",
    tiktok: "#00F2EA",
    spotify: "#1DB954",
  },
  type: {
    display: { family: "Grift", fallback: "Outfit, sans-serif", weights: [400, 500, 600, 700, 800, 900] },
    body: { family: "Outfit", weights: [300, 400, 500, 600, 700, 800, 900], defaultWeight: 500 },
    mono: { family: "JetBrains Mono", weights: [400, 500, 700] },
  },
  scale: {
    spacing: [4, 8, 12, 16, 20, 24, 32, 48, 64],
    radius: { micro: 2, chip: 4, pill: 6, button: 8, card: 12, modal: 14, full: "50%" },
  },
  shadows: {
    card: "0 2px 12px rgba(0,0,0,0.4)",
    hover: "0 8px 30px rgba(0,0,0,0.5), 0 0 20px rgba(247,176,65,0.08)",
    glow: "0 0 24px rgba(247,176,65,0.10)",
    focus: "0 0 0 3px rgba(247,176,65,0.20), 0 0 16px rgba(247,176,65,0.08)",
  },
  gradients: {
    card: "linear-gradient(135deg, #09090D 0%, #0D0D12 100%)",
    cta: "linear-gradient(135deg, #F7B041, #26C9D8)",
  },
};

// GIMP / Inkscape palette — plain text, easy to write.
const PALETTE_GPL = `GIMP Palette
Name: POAST
Columns: 4
#
247 176  65	Amber          F7B041
 11 134 209	Blue           0B86D1
 46 173 142	Teal           2EAD8E
224  99  71	Coral          E06347
144  92 203	Violet         905CCB
 38 201 216	Cyan           26C9D8
209  51  74	Crimson        D1334A
  6   6  12	Background     06060C
  9   9  13	Card           09090D
 13  13  18	Surface        0D0D12
232 228 221	Text Primary   E8E4DD
138 134 144	Text Muted     8A8690
 78  75  86	Text Dim       4E4B56
250 250 246	Bg (Light)     FAFAF6
255 255 255	Card (Light)   FFFFFF
 28  26  24	Tx (Light)     1C1A18
`;

const README = `# POAST Brand Kit

Everything you need to apply the POAST aesthetic to a sibling site, dashboard, deck, or marketing page. Drop, copy, paste — no build step.

## Contents

- **fonts/** — Grift (the SA display font, all 6 weights as woff2) plus pointers to Outfit + JetBrains Mono on Google Fonts.
- **logos/** — SA box logo, box + text, box + lettermark, full lockup. PNG + SVG variants.
- **tokens/** — \`tokens.css\` (drop into any stylesheet), \`tokens.scss\` (SCSS vars), \`tokens.json\` (machine-readable, for Style Dictionary etc.).
- **palette/** — \`poast-palette.gpl\` opens directly in GIMP / Inkscape.
- **style-guide.html** — offline copy of the live style guide.
- **STYLE.md** — the markdown-format reference if you prefer reading.

## Quick start

1. Copy \`fonts/\` into your \`public/fonts/\` directory.
2. Add the \`@font-face\` block from \`fonts/grift.css\` to your global CSS.
3. Add this line to your global CSS so Outfit + JetBrains Mono load from Google:
   \`\`\`css
   @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
   \`\`\`
4. Drop \`tokens/tokens.css\` at the top of your stylesheet.
5. Use the variables: \`background: var(--bg); color: var(--tx); font-family: var(--ft-body);\`

## The hard rules (read these)

- Never use \`#FFFFFF\` for text. Use \`var(--tx)\` (warm off-white \`#E8E4DD\`).
- Never use solid accent backgrounds for fills. Use accent + low alpha (e.g. \`rgba(247,176,65,0.12)\`).
- Three blessed gradients only: \`--grad-card\`, \`--grad-surface\`, \`--grad-cta\`. Don't invent more.
- The colored part of any glow shadow is never above 10% alpha (dark mode) or 18% alpha (light mode).
- No em dashes, no emojis, no hype words ("revolutionary", "unleash", "next-gen", "dive into") in product copy.

## License

Internal SemiAnalysis use. Don't redistribute outside the company.

— Generated automatically from poast-app/api/brand-kit · See https://poast-app.vercel.app/style-guide.html for the live reference.
`;

const GRIFT_CSS = `/* Grift — local SA display font. Copy /fonts/*.woff2 into your public/fonts/. */
@font-face { font-family: 'Grift'; src: url('/fonts/Grift-Regular.woff2') format('woff2'); font-weight: 400; font-display: swap; }
@font-face { font-family: 'Grift'; src: url('/fonts/Grift-Medium.woff2') format('woff2'); font-weight: 500; font-display: swap; }
@font-face { font-family: 'Grift'; src: url('/fonts/Grift-SemiBold.woff2') format('woff2'); font-weight: 600; font-display: swap; }
@font-face { font-family: 'Grift'; src: url('/fonts/Grift-Bold.woff2') format('woff2'); font-weight: 700; font-display: swap; }
@font-face { font-family: 'Grift'; src: url('/fonts/Grift-ExtraBold.woff2') format('woff2'); font-weight: 800; font-display: swap; }
@font-face { font-family: 'Grift'; src: url('/fonts/Grift-Black.woff2') format('woff2'); font-weight: 900; font-display: swap; }
`;

async function safeReadFile(rel: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(path.join(PUBLIC_DIR, rel));
  } catch {
    return null;
  }
}

export async function GET() {
  const zip = new JSZip();

  // tokens/
  zip.file("tokens/tokens.css", TOKENS_CSS);
  zip.file("tokens/tokens.scss", TOKENS_SCSS);
  zip.file("tokens/tokens.json", JSON.stringify(TOKENS_JSON, null, 2));

  // palette/
  zip.file("palette/poast-palette.gpl", PALETTE_GPL);
  zip.file("palette/palette.json", JSON.stringify(TOKENS_JSON.accents, null, 2));

  // fonts/
  zip.file("fonts/grift.css", GRIFT_CSS);
  const fontFiles = [
    "Grift-Regular.woff2",
    "Grift-Medium.woff2",
    "Grift-SemiBold.woff2",
    "Grift-Bold.woff2",
    "Grift-ExtraBold.woff2",
    "Grift-Black.woff2",
  ];
  for (const f of fontFiles) {
    const buf = await safeReadFile(`fonts/${f}`);
    if (buf) zip.file(`fonts/${f}`, buf);
  }

  // logos/ — every SA logo we have on disk.
  const logoFiles = [
    "sa-logo.svg",
    "sa-logo-full.svg",
    "sa-box-lettermark.svg",
    "sa-box-lettermark.png",
    "box-logo.png",
    "poast-logo.png",
  ];
  for (const f of logoFiles) {
    const buf = await safeReadFile(f);
    if (buf) zip.file(`logos/${f}`, buf);
  }

  // Offline style guide.
  const styleGuide = await safeReadFile("style-guide.html");
  if (styleGuide) zip.file("style-guide.html", styleGuide);

  zip.file("README.md", README);

  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="poast-brand-kit.zip"',
      "Cache-Control": "public, max-age=300, must-revalidate",
    },
  });
}
