# Carousel 2.0 — Asset Ingestion Contract (SVG-in-HTML)

This is the spec for authoring assets that the Carousel 2.0 library can parse
into **fillable products**. Assets are authored as **SVG embedded in an HTML
file** and dropped into `public/carousel-2-assets/`. The parser
(`catalog/parser.ts`) turns each file into one or more catalog products with an
AI-readable `fields[]` schema.

You do **not** have to annotate anything to be ingested — a raw SVG works via
the heuristic fallback (§4). But annotating (§3) makes fields precise,
stable, and correctly named, which is strongly preferred for anything the AI or
Verbatim will fill.

---

## 1. File layout

```
public/carousel-2-assets/
  manifest.json                 # lists every asset file to ingest
  backgrounds/  <name>.html
  templates/    <name>.html
  modules/      <name>.html
```

`manifest.json`:

```json
{
  "version": 1,
  "files": [
    { "path": "backgrounds/grid-amber.html", "kind": "background", "id": "bg-grid-amber" },
    { "path": "modules/stat-callout.html",   "kind": "module",     "id": "mod-stat-callout" },
    { "path": "templates/quote-hero.html",   "kind": "template",   "id": "tpl-quote-hero" }
  ]
}
```

The `kind`/`id` here are hints; the **first-line marker inside the file wins**
if present.

---

## 2. File → product

**Default: one HTML file → one product.** Put a first-line HTML comment marker
at the very top of the file:

```html
<!-- @carouselAsset kind="template" id="tpl-quote-hero" category="editorial" tags="dark,quote,cover" coverEligible -->
```

Attributes: `kind` (`background|template|module`), `id` (stable, kebab-case),
`category` (free string), `tags` (comma-separated), `moduleType`
(`chart|text-box|stat|quote|logo-lockup|element`, modules only), and the bare
flag `coverEligible` (templates only).

**Multiple products per file:** give each top-level `<svg>` a
`data-product-id` and `data-kind` (+ optional `data-category`, `data-tags`,
`data-module-type`); the parser emits one product per annotated `<svg>`.

The SVG must be **fixed 1080×1350** (`<svg viewBox="0 0 1080 1350" width="1080"
height="1350">`). Put any CSS in a `<style>` inside the `<svg>` (or in
`<head>`; the parser inlines `<head><style>` into the svg so the product is
self-contained). Use the brand font stack — `'Grift'`, `'Outfit'`,
`'JetBrains Mono'` — which resolve against the app's loaded fonts.

---

## 3. Field annotation (preferred)

Mark any fillable node with `data-field` (its unique name) and `data-role`
(its semantic role). Example:

```html
<text data-field="headline" data-role="headline"
      data-maxlen="60" data-minfont="48" data-maxfont="120">Sample headline</text>

<text data-field="eyebrow" data-role="eyebrow" data-maxlen="24">INFRASTRUCTURE</text>

<image data-field="photo" data-role="image" href="placeholder.jpg"
       x="0" y="0" width="1080" height="620"/>

<g data-field="chart" data-role="chart" data-module="chart"></g>
```

Recognized attributes → schema:

| attribute            | maps to                              |
| -------------------- | ------------------------------------ |
| `data-field`         | `field.name` + `locator.dataField`   |
| `data-role`          | `locator.role` (+ infers `type`)     |
| `data-type`          | overrides inferred `field.type`      |
| `data-maxlen`        | `constraints.maxLen`                 |
| `data-minfont`       | `constraints.minFont`                |
| `data-maxfont`       | `constraints.maxFont`                |
| `data-required`      | `constraints.required = true`        |
| element text / `href`| `defaultValue` + `placeholder`       |

Type inference from role: `image`→`image`, `chart`→`chart`, `stat`→`number`,
`color`→`color`, everything else → `text`. `id="field:headline"` or a plain
`id="headline"` matching a known role is also honored, but `data-*` wins.

**Roles:** `headline · subhead · body · eyebrow · stat · label · quote ·
attribution · image · logo · chart · footer · page-number`.

---

## 4. Heuristic fallback (un-annotated SVG)

If a node has no annotations, the parser infers fields so raw SVGs still work:

- `<text>` groups → `text` fields. Largest font → `headline`, next → `subhead`,
  mono/small-caps/wide-tracking → `eyebrow`/`footer`, remaining → `body-1`,
  `body-2`, … Locator = `objectIndex`.
- `<image>` / `<use href*=".jpg|.png|.webp">` → `image` fields (`photo-1`, …).
- A group whose id/class matches `/chart|graph|plot/i`, **or** containing ≥3
  varying-height `<rect>` (bar-chart shape) → a `chart` field.
- Decorative nodes (no text/href, id/class matching `/bg|deco|frame|accent/i`)
  → skipped.

Inferred products/fields are flagged `meta.inferred = true` and surfaced in the
Field Inspector so a human can confirm/rename. **Annotated always beats
heuristic.** Prefer annotations for anything important.

---

## 4b. Slots (overlays) & anchors (modules) — the composition layer

Overlays are **blocking / rules**: a layout of named **slots** that widget
**modules** get assigned into. A design is then just layers: background →
overlay → assigned widgets.

**Declare a slot** on any region element (usually an invisible or dashed guide
`<rect>`), on a **template**:

```html
<rect data-slot="chart" data-accepts="chart" data-label="Chart"
      x="76" y="440" width="928" height="520" fill="none"
      stroke="#26C9D8" stroke-opacity="0.3" stroke-dasharray="10 8" />
```

- `data-slot` — unique slot id (required).
- `data-accepts` — comma list of module kinds that may drop here:
  `chart · text-box · stat · quote · logo-lockup · element`, or the generics
  `text` (any text-ish widget) / `module` (anything).
- geometry — from `data-x/data-y/data-w/data-h` or the element's own
  `x/y/width/height` (1080×1350 space).
- `data-role`, `data-required` optional.

**Modules should declare an `anchor`** (their content box) so they scale
cleanly into a slot rather than as a full 1080×1350 frame:

```html
<!-- @carouselAsset kind="module" moduleType="chart" id="mod-bar-mini" anchor="120,300,840,760" -->
```

(or `data-anchor="120,300,840,760"` on a per-svg root in a multi-product file).
Author modules on a transparent canvas (no full-bleed background rect) so they
layer over the overlay.

## 5. SVG subset constraints (please follow)

Fabric's SVG parser (the ingestion engine) does **not** round-trip every SVG
feature. To keep thumbnails and future canvas editing faithful:

- ✅ Use: `<rect>`, `<circle>`, `<ellipse>`, `<line>`, `<polygon>`, `<path>`,
  `<text>`/`<tspan>`, `<image>`, `<g>`, linear/radial `<gradient>`, solid fills,
  strokes, opacity, `transform`.
- ⚠️ Avoid / use sparingly: SVG `<filter>` effects (blur/turbulence),
  `clip-path`, `mask`, `<foreignObject>`, CSS not expressible as presentation
  attributes. These may not survive parsing; keep them decorative if used.
- Keep text as real `<text>` (not outlined paths) so it stays fillable.
- One canvas, 1080×1350, origin top-left.

The Field Inspector shows exactly which fields were detected, so you can verify
an asset parsed correctly right after dropping it in.
