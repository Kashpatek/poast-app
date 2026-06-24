"use client";

import { useEffect } from "react";

// ═══ LIQUID-GLASS LENS ENGINE (Reflect) ═══
// Faithful port of the mockup glass.html §4–5. Any element tagged `.lglass`
// becomes real liquid glass:
//   • refraction — a per-size SDF "bezel" displacement map drives an SVG
//     feDisplacementMap that bends the backdrop hardest at the rim (the lens).
//   • spectral rim — `.lglass::before`: a masked white-specular + chromatic
//     conic border (the glass edge sheen).
//   • cursor glow — `.lglass.glow::after`: a radial that illuminates from under
//     the pointer (tracked via --mx/--my). Per-element tint via --lgac.
// The base frost blur lives on the class so React inline styles never fight the
// imperatively-set refraction filter on hover re-renders. Degrades gracefully:
// no JS / no WebGL-less-canvas / reduced-transparency → still blur + rim.

const BEZEL = 20;        // bezel width (px) of the refractive rim
const MAXSCALE = 26;     // refraction 1.0 → 26px max displacement
// The mockup's "clear" preset — the refractive favorite.
const P = { refraction: 0.6, frost: 2, spec: 0.62, specSat: 0.46 };

const LENS_CSS = `
.lglass{position:relative;isolation:isolate;backdrop-filter:blur(var(--frost,2px)) saturate(150%) brightness(1.04);-webkit-backdrop-filter:blur(var(--frost,2px)) saturate(150%) brightness(1.04)}
.lglass::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:2;padding:1.3px;
  background:
    linear-gradient(135deg, rgba(255,255,255,calc(.75*var(--spec,0.62))), transparent 40%, transparent 60%, rgba(255,255,255,calc(.25*var(--spec,0.62)))),
    conic-gradient(from 130deg,
      hsla(330,100%,62%,calc(.6*var(--spec-sat,0.46))), hsla(265,100%,66%,calc(.6*var(--spec-sat,0.46))),
      hsla(195,100%,58%,calc(.6*var(--spec-sat,0.46))), hsla(140,90%,60%,calc(.6*var(--spec-sat,0.46))),
      hsla(45,100%,58%,calc(.6*var(--spec-sat,0.46))),  hsla(330,100%,62%,calc(.6*var(--spec-sat,0.46))));
  -webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);-webkit-mask-composite:xor;
  mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);mask-composite:exclude}
.lglass::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:1;opacity:0;transition:opacity .3s;
  background:radial-gradient(230px circle at var(--mx,50%) var(--my,50%), color-mix(in srgb,var(--lgac,#A06BE0) 42%, transparent), transparent 62%)}
.lglass.glow:hover::after{opacity:.9}
.lglass>*{position:relative;z-index:3}
@media (prefers-reduced-transparency: reduce){.lglass{backdrop-filter:none !important;-webkit-backdrop-filter:none !important;background:rgba(20,16,32,.94) !important}}
`;

// Pre-computed displacement map (squircle bezel SDF → rim refraction), per size.
function genMap(w: number, h: number, r: number, cache: Map<string, string>): string {
  w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h)); r = Math.min(r, Math.min(w, h) / 2 - 1);
  const key = w + "x" + h + "x" + r;
  const hit = cache.get(key); if (hit) return hit;
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d"); if (!ctx) return "";
  const img = ctx.createImageData(w, h); const data = img.data;
  const cx = w / 2, cy = h / 2, rx = w / 2 - r, ry = h / 2 - r;
  const sdf = (x: number, y: number) => {
    const dx = Math.abs(x - cx) - rx, dy = Math.abs(y - cy) - ry;
    const ax = Math.max(dx, 0), ay = Math.max(dy, 0);
    return Math.min(Math.max(dx, dy), 0) + Math.hypot(ax, ay) - r;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const depth = -sdf(x + 0.5, y + 0.5); let dx = 0, dy = 0;
      if (depth > 0 && depth < BEZEL) {
        const t = depth / BEZEL;
        const mag = Math.pow(1 - t, 1.45);
        const nx = sdf(x + 1.5, y + 0.5) - sdf(x - 0.5, y + 0.5);
        const ny = sdf(x + 0.5, y + 1.5) - sdf(x + 0.5, y - 0.5);
        const nl = Math.hypot(nx, ny) || 1;
        dx = -(nx / nl) * mag; dy = -(ny / nl) * mag;
      }
      const i = (y * w + x) * 4;
      data[i] = Math.max(0, Math.min(255, 128 + dx * 127));
      data[i + 1] = Math.max(0, Math.min(255, 128 + dy * 127));
      data[i + 2] = 128; data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const url = cv.toDataURL();
  cache.set(key, url);
  return url;
}

export default function GlassLens() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const SVGNS = "http://www.w3.org/2000/svg";
    const reduceTransparency = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-transparency: reduce)").matches;
    const useRefraction = !reduceTransparency && P.refraction > 0.015;

    // root spec vars (rim strength) — fallbacks in CSS cover pre-effect paint.
    const rs = document.documentElement.style;
    rs.setProperty("--spec", String(P.spec));
    rs.setProperty("--spec-sat", String(P.specSat));

    // hidden <svg><defs> holding the per-element filters
    let svg = document.getElementById("lgdefs-svg");
    if (!svg) {
      svg = document.createElementNS(SVGNS, "svg") as unknown as HTMLElement;
      svg.setAttribute("id", "lgdefs-svg");
      svg.setAttribute("aria-hidden", "true");
      svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
      const defs = document.createElementNS(SVGNS, "defs");
      defs.setAttribute("id", "lgdefs");
      svg.appendChild(defs);
      document.body.appendChild(svg);
    }
    const defs = document.getElementById("lgdefs");
    const cache = new Map<string, string>();
    let idc = 0;

    function ensureFilter(el: HTMLElement): string | null {
      if (!defs) return null;
      const r = el.getBoundingClientRect();
      const w = Math.round(r.width), h = Math.round(r.height);
      if (w < 8 || h < 8) return null;
      const rad = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 24;
      let id = el.dataset.lgf;
      if (!id) {
        id = "lgf" + (++idc); el.dataset.lgf = id;
        const f = document.createElementNS(SVGNS, "filter");
        f.setAttribute("id", id); f.setAttribute("color-interpolation-filters", "sRGB");
        f.setAttribute("x", "-20%"); f.setAttribute("y", "-20%"); f.setAttribute("width", "140%"); f.setAttribute("height", "140%");
        f.innerHTML = '<feImage result="m"/><feDisplacementMap in="SourceGraphic" in2="m" xChannelSelector="R" yChannelSelector="G"/>';
        defs.appendChild(f);
      }
      const f = document.getElementById(id);
      if (!f) return null;
      const feImg = f.querySelector("feImage"), feDisp = f.querySelector("feDisplacementMap");
      if (!feImg || !feDisp) return null;
      const key = w + "x" + h + "x" + rad;
      if (el.dataset.lgkey !== key) {
        const url = genMap(w, h, rad, cache);
        feImg.setAttribute("href", url);
        feImg.setAttributeNS("http://www.w3.org/1999/xlink", "href", url);
        feImg.setAttribute("width", String(w)); feImg.setAttribute("height", String(h));
        feImg.setAttribute("x", "0"); feImg.setAttribute("y", "0");
        el.dataset.lgkey = key;
      }
      feDisp.setAttribute("scale", (P.refraction * MAXSCALE).toFixed(2));
      return id;
    }

    function applyTo(el: HTMLElement) {
      if (!useRefraction) return;
      const frost = getComputedStyle(el).getPropertyValue("--frost").trim() || P.frost + "px";
      const fb = `blur(${frost}) saturate(150%) brightness(1.04)`;
      const id = ensureFilter(el);
      el.style.backdropFilter = (id ? `url(#${id}) ` : "") + fb;
      (el.style as unknown as Record<string, string>).webkitBackdropFilter = fb;
    }

    function applyAll() {
      document.querySelectorAll<HTMLElement>(".lglass").forEach(applyTo);
    }

    applyAll();
    const warm = [setTimeout(applyAll, 140), setTimeout(applyAll, 480)];

    let rz: ReturnType<typeof setTimeout> | null = null;
    const reflow = () => { if (rz) clearTimeout(rz); rz = setTimeout(applyAll, 180); };
    window.addEventListener("resize", reflow);

    const ro = "ResizeObserver" in window ? new ResizeObserver(reflow) : null;
    if (ro) document.querySelectorAll<HTMLElement>(".lglass").forEach((el) => ro.observe(el));

    // catch tiles that mount after first paint (section/home swaps)
    const mo = new MutationObserver(() => reflow());
    mo.observe(document.body, { childList: true, subtree: true });

    function onPointer(e: PointerEvent) {
      const t = (e.target as HTMLElement | null)?.closest?.(".lglass.glow") as HTMLElement | null;
      if (!t) return;
      const r = t.getBoundingClientRect();
      t.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 100) + "%");
      t.style.setProperty("--my", ((e.clientY - r.top) / r.height * 100) + "%");
    }
    document.addEventListener("pointermove", onPointer, { passive: true });

    return () => {
      warm.forEach(clearTimeout);
      if (rz) clearTimeout(rz);
      window.removeEventListener("resize", reflow);
      if (ro) ro.disconnect();
      mo.disconnect();
      document.removeEventListener("pointermove", onPointer);
    };
  }, []);

  return <style dangerouslySetInnerHTML={{ __html: LENS_CSS }} />;
}
