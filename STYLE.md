# POAST · Style Guide

Reusable design system for POAST and any sibling site that wants the same dashboard look. Source of truth is [src/app/shared-constants.ts](src/app/shared-constants.ts) — this file mirrors it in a portable form so external sites (and AI assistants) can apply the look without depending on this repo.

The aesthetic in three words: **dark, institutional, glow-accented.** Near-black surfaces with a single warm accent (amber by default), confident geometric type, sharp corners on small chrome and softer corners on cards, and a restrained colored-glow shadow used for hover and active states.

---

## 1. Quick start (copy/paste)

Drop this `<style>` block into any HTML page and you're 80% on-brand:

```html
<link rel="preload" href="/fonts/Grift-Bold.woff2" as="font" type="font/woff2" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">

<style>
:root {
  /* Surfaces */
  --bg: #06060C;
  --surface: #0D0D12;
  --card: #09090D;
  --hover: #0D0D12;
  --border: rgba(255,255,255,0.06);
  --border-hover: rgba(255,255,255,0.12);

  /* Text */
  --tx: #E8E4DD;        /* primary */
  --tx-muted: #8A8690;  /* secondary */
  --tx-dim: #4E4B56;    /* tertiary, captions, timestamps */

  /* Accents */
  --amber: #F7B041;     /* primary accent / CTA */
  --blue: #0B86D1;
  --teal: #2EAD8E;
  --coral: #E06347;     /* danger / toasts */
  --violet: #905CCB;
  --cyan: #26C9D8;
  --crimson: #D1334A;

  /* Platform brand colors */
  --x: #1DA1F2;
  --linkedin: #0A66C2;
  --facebook: #1877F2;
  --instagram: #E4405F;
  --youtube: #FF0000;
  --tiktok: #00F2EA;
  --spotify: #1DB954;

  /* Tier (S/A/B/C) */
  --tier-s: #F7B041;
  --tier-a: #0B86D1;
  --tier-b: #2EAD8E;
  --tier-c: #8A8690;

  /* Type */
  --ft-display: 'Grift', 'Outfit', sans-serif;
  --ft-body: 'Outfit', sans-serif;
  --ft-mono: 'JetBrains Mono', monospace;

  /* Shadows */
  --shadow-card:   0 2px 12px rgba(0,0,0,0.4);
  --shadow-hover:  0 8px 30px rgba(0,0,0,0.5), 0 0 20px rgba(247,176,65,0.08);
  --shadow-glow:   0 0 24px rgba(247,176,65,0.06);
  --shadow-modal:  0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(247,176,65,0.05);

  /* Gradients */
  --grad-card:    linear-gradient(135deg, #09090D 0%, #0D0D12 100%);
  --grad-surface: linear-gradient(135deg, #0D0D12 0%, #09090D 100%);
  --grad-cta:     linear-gradient(135deg, #F7B041, #26C9D8);
}

html, body { background: var(--bg); color: var(--tx); font-family: var(--ft-body); }
</style>
```

---

## 2. Color palette

### Surfaces (use top-to-bottom)
| Token | Hex | Where it goes |
|---|---|---|
| `--bg` | `#06060C` | Page background, the deepest plane |
| `--card` | `#09090D` | Default card background |
| `--surface` | `#0D0D12` | Inputs, elevated panels, drop-zones |
| `--hover` | `#0D0D12` | Row/tile hover background |
| `--border` | `rgba(255,255,255,0.06)` | All resting borders |
| `--border-hover` | `rgba(255,255,255,0.12)` | Inputs and interactive borders on hover |

Rule: never put pure white on pure black. Bodies sit on `--bg`, cards on `--card`, inputs on `--surface`. Two surfaces of the same value next to each other use a 1px `--border` line, not a value bump.

### Text
| Token | Hex | Use |
|---|---|---|
| `--tx` | `#E8E4DD` | Body copy, headings — the only "white" |
| `--tx-muted` | `#8A8690` | Secondary text, labels |
| `--tx-dim` | `#4E4B56` | Timestamps, character counts, footnotes |

`#E8E4DD` is intentionally warm-off-white so it doesn't scream against amber. Don't use `#FFFFFF`.

### Accents (semantic)
| Token | Hex | Default semantics |
|---|---|---|
| `--amber` | `#F7B041` | Primary CTA, brand accent, success-of-positive-energy |
| `--blue` | `#0B86D1` | Information, secondary CTA |
| `--teal` | `#2EAD8E` | Confirmation, success, "saved" |
| `--coral` | `#E06347` | Danger, destructive, toast errors |
| `--violet` | `#905CCB` | Admin / studio modes, novelty |
| `--cyan` | `#26C9D8` | Highlights inside the amber→cyan CTA gradient |
| `--crimson` | `#D1334A` | Hard alerts only — use sparingly |

### Platform colors (only for platform-tagged UI)
X `#1DA1F2`, LinkedIn `#0A66C2`, Facebook `#1877F2`, Instagram `#E4405F`, YouTube `#FF0000`, TikTok `#00F2EA`, Spotify `#1DB954`.

### Alpha-tint pattern
The codebase rarely uses solid accent backgrounds. The pattern: `accent + alpha-suffix-hex` on the existing accent. Common suffixes:
- `08` (3%) — barely-visible tint, used for active rows
- `12` (7%) — chip/pill background
- `25` / `40` (15% / 25%) — borders, focus rings
- `55` / `60` (33% / 38%) — emphasized borders on selected state

Example: `background: var(--amber)12; border: 1px solid var(--amber)40;` reads as "amber tint card with a stronger amber border."

---

## 3. Typography

Three families, each a different role.

| Family | Variable | Role | Weights used |
|---|---|---|---|
| **Grift** | `--ft-display` | Page titles, marquee labels, large numbers | 500–900 |
| **Outfit** | `--ft-body` | All body, buttons, inputs | 400, 500, 700, 800 |
| **JetBrains Mono** | `--ft-mono` | Tiny labels, char counts, codes, timestamps, hash IDs | 400, 700 |

Weight is heavy here on purpose. **Body text is 500 by default**, never 400. Headings are 700 or 800. The display weight goes to 900 for the largest type.

### Type scale (used in app, sample)
| Use | Family | Size | Weight | Letter-spacing |
|---|---|---|---|---|
| Page H1 | display | 42px | 900 | -2 |
| Section H2 | display | 28px | 800 | -0.5 to 0.4 |
| Card title | body | 16px | 800 | -0.2 |
| Body | body | 13–14px | 500 | 0 |
| Small label | mono | 11–12px | 700 | 1.5–2 |
| Caption | mono | 9–10px | 400 | 1 |
| Tiny tag | mono | 8–9px | 700 | 2–3 |

### Caps labels
Small mono labels above sections are uppercase, 700 weight, 1.5–2px letter-spacing, in `--tx-muted` or an accent color. They *replace* h3/h4 in this system.

```html
<div style="font-family: var(--ft-mono); font-size: 11px; font-weight: 700;
            letter-spacing: 1.5px; text-transform: uppercase; color: var(--tx-muted);">
  Your Selections
</div>
```

---

## 4. Spacing & radius

Spacing is the standard 4-multiple scale: 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 48. Avoid arbitrary numbers.

Border-radius scale (very deliberate):
- **2** — micro (the small accent stripe at the left of an active sidebar item)
- **4** — small chips, copy buttons, tier badges
- **6** — pills, redo button, mono tags
- **8** — buttons, inputs, drop-zone outline
- **10–12** — cards, panels
- **14** — modals (the dialog panel)
- **50%** — avatars, status dots, radio buttons

Cards always have **12px** radius unless they're interactive tiles (then 14). Buttons always **8**. Pills always **6**.

---

## 5. Shadows & glows (the signature)

Three shadows do most of the work:

```css
/* Resting card — subtle depth, no color */
box-shadow: 0 2px 12px rgba(0,0,0,0.4);

/* Hover — slight lift + colored bloom */
box-shadow: 0 8px 30px rgba(0,0,0,0.5), 0 0 20px rgba(247,176,65,0.08);

/* Selected/active — colored glow only, no lift */
box-shadow: 0 0 24px rgba(247,176,65,0.06);
```

Modal shadow is heavier with a hairline accent ring:
```css
box-shadow: 0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(247,176,65,0.05);
```

Rule: the colored part of the glow is **never above 10% alpha**. It's atmosphere, not highlighting. If something needs to scream, change the border color, not the shadow.

Active sidebar items also paint a `text-shadow` glow on the label itself:
```css
text-shadow: 0 0 20px rgba(247,176,65,0.5), 0 0 40px rgba(247,176,65,0.12);
```

---

## 6. Gradients

Only three gradients are blessed.

```css
/* Card gradient — subtle, internal depth */
background: linear-gradient(135deg, #09090D 0%, #0D0D12 100%);

/* Surface gradient — same colors reversed, for nested elevation */
background: linear-gradient(135deg, #0D0D12 0%, #09090D 100%);

/* CTA gradient — amber → cyan, used for the highest-energy buttons */
background: linear-gradient(135deg, #F7B041, #26C9D8);
```

The CTA gradient has black text (`#060608`) at 800–900 weight on top. It's the *only* place we use a multicolor gradient. Don't invent new ones.

---

## 7. Component patterns

### Card
```html
<div style="background: var(--card); border: 1px solid var(--border);
            border-radius: 12px; padding: 16px 20px;
            box-shadow: var(--shadow-card);">
  …
</div>
```
Selected card: swap `border` for `1px solid var(--amber)60` and add `box-shadow: var(--shadow-glow)`.

### Tile (clickable card with category color)
3px colored top or left border, accent-tinted background on hover, glowing shadow on selected.
```html
<div style="background: var(--card); border: 1px solid var(--border);
            border-left: 3px solid var(--amber); border-radius: 12px;
            padding: 18px 20px; transition: all 0.2s ease; cursor: pointer;">…</div>
```

### Primary button
```html
<button style="background: var(--amber); color: #000; border: none;
               padding: 8px 14px; border-radius: 8px;
               font-family: var(--ft-body); font-size: 13px; font-weight: 600;">
  + New
</button>
```

### Secondary button
```html
<button style="background: transparent; color: var(--tx);
               border: 1px solid var(--border); padding: 8px 14px;
               border-radius: 8px; font-family: var(--ft-body); font-size: 13px;">
  Cancel
</button>
```

### Danger button (subtle — the danger is in the color, not the weight)
```html
<button style="background: transparent; color: var(--coral);
               border: 1px solid var(--border); padding: 4px 10px;
               border-radius: 6px; font-family: var(--ft-mono); font-size: 11px;">
  Delete
</button>
```

### Input
```html
<input style="width: 100%; background: var(--bg); border: 1px solid var(--border);
              border-radius: 8px; color: var(--tx); padding: 8px 10px;
              font-family: var(--ft-mono); font-size: 12px; outline: none;">
```
Focus state: `border-color: var(--amber); box-shadow: var(--shadow-glow);`.

### Pill / tag / badge
```html
<span style="font-family: var(--ft-mono); font-size: 10px; font-weight: 700;
             letter-spacing: 0.6px; text-transform: uppercase;
             padding: 2px 6px; border-radius: 4px;
             color: var(--amber); background: rgba(247,176,65,0.12);
             border: 1px solid var(--amber);">DOC</span>
```

### Dialog (modal)
- Backdrop: `rgba(6,6,12,0.72)` with `backdrop-filter: blur(6px)`.
- Panel: `min(420px, 92vw)`, `background: #0A0A14`, `border-radius: 14px`, padding `22px 22px 18px`, `box-shadow: var(--shadow-modal)`.
- Animation: 180ms fade for backdrop, 220ms cubic-bezier(0.16, 1, 0.3, 1) pop for panel.

```css
@keyframes dlgFade { from { opacity: 0 } to { opacity: 1 } }
@keyframes dlgPop  { 0% { opacity: 0; transform: translateY(8px) scale(0.98) }
                     100% { opacity: 1; transform: translateY(0) scale(1) } }
```

### Toast
Bottom-right, coral-tinted, mono font, 6s auto-dismiss, click-to-dismiss.
```html
<div style="position: fixed; bottom: 24px; right: 24px; z-index: 10000;
            max-width: 420px; padding: 14px 20px;
            background: rgba(224,99,71,0.13); border: 1px solid var(--coral);
            border-radius: 8px; font-family: var(--ft-mono);
            font-size: 11px; color: var(--coral);
            box-shadow: 0 0 20px rgba(224,99,71,0.2);">
  Saved.
</div>
```

### Sidebar nav item (active)
- 3px-wide colored bar absolutely positioned at the left edge.
- 0.05 alpha-tint background.
- Label gets text-shadow glow as above.

---

## 8. Motion

Three transitions cover the app:

| When | Duration | Easing |
|---|---|---|
| Hover state changes (color, border, shadow) | 200ms | `ease` |
| Tab/route swaps inside the dashboard | 250ms | `ease-in-out` |
| Modal/popover open | 220ms | `cubic-bezier(0.16, 1, 0.3, 1)` |

Two named keyframes you can copy:
```css
@keyframes asFade  { 0% { opacity: 0; transform: translateY(14px) } 100% { opacity: 1; transform: translateY(0) } }
@keyframes asPulse { 0%,100% { opacity: 0.5 } 50% { opacity: 0.85 } }
```
Used for splash entry and ambient orb backgrounds respectively.

---

## 9. Iconography

`lucide-react` icons, stroke-width **1.8** at rest, **2.2** when active. 15–16px in nav rows, 20px in tile centers. Color matches the surrounding accent. **Never** use filled icon styles.

---

## 10. Voice & copy

The visual style is one half; copy discipline is the other. These rules ride along with the look:

- **No em dashes.** Use commas, periods, or colons.
- **No emojis** in product copy.
- **No hype words**: revolutionary, unleashed, game-changing, next-gen, transform, dive into, unlock, seamless.
- **Direct and specific.** Plain declarative sentences. Lead with a concrete fact.
- **Sentence case** for body, **Title Case** only for proper nouns and tile labels.

If the look has a sentence, this is it.

---

## 11. AI pairing — coordinated skills

If you're applying this style with an AI coding assistant (Claude Code, Cursor, Copilot, etc.), paste the block below as the system prompt or rule set. It encodes the rules in a form models follow well.

```markdown
# POAST visual style — apply to any web UI you build.

Surfaces: page background #06060C; cards #09090D; inputs/elevated surfaces #0D0D12.
Borders: rgba(255,255,255,0.06) at rest, rgba(255,255,255,0.12) on hover. No solid lines.
Text: primary #E8E4DD (warm off-white, never #FFFFFF), secondary #8A8690, dim #4E4B56.
Accents: amber #F7B041 is primary; teal #2EAD8E for success; coral #E06347 for danger.
Tints: use accent + low alpha (`#F7B04112`) for backgrounds, accent + ~25-40% alpha for borders.

Type: 'Outfit' for body (500 weight default, 800 for emphasis); 'Grift' for display headings; 'JetBrains Mono' for tiny caps labels, char counts, IDs. Body copy is 13-14px. Headings are 700+. Caps labels are 9-11px mono, uppercase, 1.5-2px letter-spacing.

Radius: 4 chips, 6 pills, 8 buttons/inputs, 10-12 cards, 14 modals, 50% avatars/dots.

Shadows: cards `0 2px 12px rgba(0,0,0,0.4)`. Hover adds a 0 0 20px colored bloom at <=10% alpha — never higher. Modals get a subtle 0 0 0 1px accent ring.

Gradients (only three allowed):
- Card: linear-gradient(135deg, #09090D 0%, #0D0D12 100%)
- Surface: linear-gradient(135deg, #0D0D12 0%, #09090D 100%)
- High-energy CTA: linear-gradient(135deg, #F7B041, #26C9D8) with black 800-weight text

Motion: 200ms ease for hover, 220ms cubic-bezier(0.16, 1, 0.3, 1) for modal pop. Don't animate everything; reserve motion for state changes.

Voice: no em dashes, no emojis, no hype words, no "dive into" / "Why X matters" / "deep dive". Direct, specific, technical sentences. Sentence case for body, Title Case for proper nouns.

Icons: lucide-react, stroke 1.8 at rest, 2.2 active. Never filled.

When in doubt: dark surfaces, single warm accent, low-alpha colored shadows, off-white type. Restraint over decoration.
```

For Claude Code projects specifically, consider pairing this with a `CLAUDE.md` that imports this file:
```
@STYLE.md
```

---

## 12. Minimal reference page

A single-file demonstration. Save as `index.html` and open it — every component on this page uses only the tokens above.

```html
<!doctype html>
<meta charset="utf-8">
<title>POAST style demo</title>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
  :root {
    --bg:#06060C;--card:#09090D;--surface:#0D0D12;--border:rgba(255,255,255,0.06);
    --tx:#E8E4DD;--tx-muted:#8A8690;--tx-dim:#4E4B56;
    --amber:#F7B041;--coral:#E06347;
    --ft-body:'Outfit',sans-serif;--ft-mono:'JetBrains Mono',monospace;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--tx);font-family:var(--ft-body);font-size:14px;font-weight:500;padding:48px}
  .h1{font-size:42px;font-weight:900;letter-spacing:-2px;margin:0 0 8px}
  .lede{color:var(--tx-muted);font-size:15px;margin:0 0 32px}
  .label{font-family:var(--ft-mono);font-size:11px;font-weight:700;letter-spacing:1.5px;
         text-transform:uppercase;color:var(--tx-muted);margin-bottom:10px}
  .card{background:var(--card);border:1px solid var(--border);border-radius:12px;
        padding:18px 20px;margin-bottom:16px;box-shadow:0 2px 12px rgba(0,0,0,0.4);transition:all .2s ease}
  .card:hover{border-color:var(--amber);box-shadow:0 8px 30px rgba(0,0,0,0.5),0 0 20px rgba(247,176,65,0.08)}
  .btn{background:var(--amber);color:#000;border:none;padding:8px 14px;border-radius:8px;
       font-family:var(--ft-body);font-size:13px;font-weight:600;cursor:pointer;margin-right:8px}
  .btn-secondary{background:transparent;color:var(--tx);border:1px solid var(--border)}
  .btn-danger{background:transparent;color:var(--coral);border:1px solid var(--border);
              padding:4px 10px;border-radius:6px;font-family:var(--ft-mono);font-size:11px;cursor:pointer}
  .pill{display:inline-block;font-family:var(--ft-mono);font-size:10px;font-weight:700;
        letter-spacing:.6px;text-transform:uppercase;padding:2px 6px;border-radius:4px;
        color:var(--amber);background:rgba(247,176,65,.12);border:1px solid var(--amber)}
</style>

<h1 class="h1">Dashboard</h1>
<p class="lede">A reference page using only the POAST design tokens.</p>

<div class="label">Projects</div>
<div class="card">
  <span class="pill">DOC</span>
  <div style="font-size:16px;font-weight:800;margin:8px 0 4px">Blackwell GPU yields one-pager</div>
  <div style="font-family:var(--ft-mono);font-size:11px;color:var(--tx-dim)">Updated 2 hours ago</div>
</div>
<div class="card">
  <span class="pill">GFX</span>
  <div style="font-size:16px;font-weight:800;margin:8px 0 4px">TSMC capex poster</div>
  <div style="font-family:var(--ft-mono);font-size:11px;color:var(--tx-dim)">Updated yesterday</div>
</div>

<div style="margin-top:24px">
  <button class="btn">+ New project</button>
  <button class="btn btn-secondary">Cancel</button>
  <button class="btn-danger">Delete</button>
</div>
```

---

## 13. What's intentionally not here

- A semantic spacing scale (`--space-1`, `-2`...). The codebase uses raw 4-multiples and Outfit's metrics handle the rest. Adding tokens for spacing would over-formalize an already-restrained system.
- Light mode. POAST is dark-only by design. Don't fork to add it without a strong reason — the contrast/glow logic falls apart on light surfaces.
- Form-validation states. They're done per-component with the existing palette (border turns coral on error). No `--error-bg` token exists.

---

## Maintenance

When you change tokens here, mirror them in [src/app/shared-constants.ts](src/app/shared-constants.ts) (the `D` object, `ft`/`gf`/`mn` consts, `PL`, `TIER_COLORS`). The runtime uses those; this file is the doc.
