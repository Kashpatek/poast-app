"use client";
import { useEffect, useRef } from "react";
import type { BgName } from "./theme-context";

// ═══ STOCK BACKDROP ═══
// Faithful port of the mockup (~/poast-welcome-3.0 index.html) Stock backgrounds.
//   aurora      → WebGL fbm-noise smoke (the "smokey" look) — the real fluid shader
//   cockpit     → command-center HUD: grid field + corner glows + scanline
//   iridescent  → calm oil-slick conic sheen, blurred + drifting
// The 3 vibes share one role palette (--bg0/1/2). Rendered as a fixed full-screen
// layer behind the Stock home content (which sits at z-index 1).

// Shared smokey palette (matches the mockup admin home the user referenced:
// red + cobalt + violet → dark purple/magenta smoke).
const PAL: [string, string, string] = ["#D1334A", "#2E6BE6", "#905CCB"];

function hexN(h: string): [number, number, number] {
  const n = parseInt(h.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// The Noomo-style flowing-gradient smoke — ported verbatim from the mockup's
// #fluid WebGL shader. Colored by the 3 palette colors; falls back to nothing
// if WebGL is unavailable (the parent's dark base shows through).
function FluidCanvas({ colors }: { colors: [string, string, string] }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    let gl: WebGLRenderingContext | null = null;
    try { gl = (cv.getContext("webgl") || cv.getContext("experimental-webgl")) as WebGLRenderingContext | null; } catch { gl = null; }
    if (!gl) { cv.style.display = "none"; return; }
    const glc = gl;

    const vs = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
    const fs = "precision highp float;uniform vec2 u_res;uniform float u_time;uniform vec3 u_c1,u_c2,u_c3;"
      + "float hash(vec2 p){p=fract(p*vec2(123.34,345.45));p+=dot(p,p+34.345);return fract(p.x*p.y);}"
      + "float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);"
      + "return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}"
      + "float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.0+vec2(1.7,9.2);a*=.5;}return v;}"
      + "void main(){vec2 uv=gl_FragCoord.xy/u_res.xy;vec2 p=uv;p.x*=u_res.x/u_res.y;p*=2.1;"
      + "float t=u_time*0.05;vec2 q=vec2(fbm(p+t),fbm(p+vec2(5.2,1.3)-t));"
      + "vec2 r=vec2(fbm(p+1.8*q+vec2(1.7,9.2)+t*0.7),fbm(p+1.8*q+vec2(8.3,2.8)-t*0.6));"
      + "float f=fbm(p+2.0*r);vec3 col=mix(u_c2,u_c1,clamp(f*f*2.2,0.,1.));"
      + "col=mix(col,u_c3,clamp(length(q)*0.95,0.,1.));col=mix(col,u_c1,clamp(r.y*0.6,0.,1.));"
      + "col*=0.42+0.80*f;col=mix(vec3(0.024,0.024,0.047),col,0.92);gl_FragColor=vec4(col,1.0);}";

    function sh(type: number, src: string): WebGLShader | null {
      const s = glc.createShader(type);
      if (!s) return null;
      glc.shaderSource(s, src); glc.compileShader(s);
      return glc.getShaderParameter(s, glc.COMPILE_STATUS) ? s : null;
    }
    const v = sh(glc.VERTEX_SHADER, vs), f = sh(glc.FRAGMENT_SHADER, fs);
    if (!v || !f) { cv.style.display = "none"; return; }
    const prog = glc.createProgram();
    if (!prog) { cv.style.display = "none"; return; }
    glc.attachShader(prog, v); glc.attachShader(prog, f); glc.linkProgram(prog);
    if (!glc.getProgramParameter(prog, glc.LINK_STATUS)) { cv.style.display = "none"; return; }
    glc.useProgram(prog);
    const buf = glc.createBuffer();
    glc.bindBuffer(glc.ARRAY_BUFFER, buf);
    glc.bufferData(glc.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), glc.STATIC_DRAW);
    const loc = glc.getAttribLocation(prog, "p");
    glc.enableVertexAttribArray(loc);
    glc.vertexAttribPointer(loc, 2, glc.FLOAT, false, 0, 0);
    const uRes = glc.getUniformLocation(prog, "u_res");
    const uT = glc.getUniformLocation(prog, "u_time");
    const c = colors.map(hexN);
    glc.uniform3fv(glc.getUniformLocation(prog, "u_c1"), c[0]);
    glc.uniform3fv(glc.getUniformLocation(prog, "u_c2"), c[1]);
    glc.uniform3fv(glc.getUniformLocation(prog, "u_c3"), c[2]);

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      cv!.width = Math.floor(window.innerWidth * dpr);
      cv!.height = Math.floor(window.innerHeight * dpr);
      glc.viewport(0, 0, cv!.width, cv!.height);
    }
    window.addEventListener("resize", resize);
    resize();
    let raf = 0;
    const start = performance.now();
    (function loop() {
      const tm = (performance.now() - start) / 1000;
      glc.uniform2f(uRes, cv!.width, cv!.height);
      glc.uniform1f(uT, tm);
      glc.drawArrays(glc.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(loop);
    })();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [colors]);

  return <canvas ref={ref} style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 0, display: "block" }} />;
}

const GRAIN = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/></svg>\")";

// Cockpit detection marker — an octagonal target-lock box with corner ticks +
// center crosshair. These pop up at random spots ("detecting something") on
// staggered loops, like a radar/TV tracking interface. Color is pre-URL-encoded
// (%23rrggbb). Drawn as a CSS background-image so it animates cheaply.
const octa = (c: string) =>
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>"
  + "<g fill='none' stroke='" + c + "'>"
  + "<path d='M44 8 76 8 112 44 112 76 76 112 44 112 8 76 8 44Z' stroke-opacity='0.85' stroke-width='1.4'/>"
  + "<path d='M44 8 76 8 112 44 112 76 76 112 44 112 8 76 8 44Z' stroke-opacity='0.14' stroke-width='5'/></g>"
  + "<g stroke='" + c + "' stroke-width='1.4' stroke-opacity='0.9'>"
  + "<line x1='60' y1='42' x2='60' y2='52'/><line x1='60' y1='68' x2='60' y2='78'/>"
  + "<line x1='42' y1='60' x2='52' y2='60'/><line x1='68' y1='60' x2='78' y2='60'/></g>"
  + "<circle cx='60' cy='60' r='2.2' fill='" + c + "' fill-opacity='0.9'/></svg>\")";

// Fixed scatter of detection markers — center coords, size, color, cycle length
// and stagger. Long durations + a mostly-invisible tail make them feel random.
const OCT_AMBER = "%23F7B041", OCT_TEAL = "%232EAD8E", OCT_BLUE = "%230B86D1";
const OCTS: { x: string; y: string; s: number; c: string; d: string; dl: string }[] = [
  { x: "16%", y: "31%", s: 78, c: OCT_AMBER, d: "9s", dl: "0s" },
  { x: "69%", y: "23%", s: 108, c: OCT_TEAL, d: "12s", dl: "3.4s" },
  { x: "83%", y: "59%", s: 70, c: OCT_BLUE, d: "10s", dl: "6.1s" },
  { x: "34%", y: "67%", s: 124, c: OCT_AMBER, d: "13s", dl: "1.8s" },
  { x: "53%", y: "41%", s: 62, c: OCT_TEAL, d: "11s", dl: "8.2s" },
  { x: "24%", y: "52%", s: 56, c: OCT_BLUE, d: "14s", dl: "4.9s" },
];

// Low-poly "map" mesh for Iridescent — a deterministically-jittered triangle
// grid (no Math.random ⇒ no SSR/hydration mismatch). Edge points stay on the
// grid so the tile seams cleanly when repeated. Screen/overlay-blended with a
// slow warp + hue cycle, it reads as a refracting, wave-displaced faceted sheet.
function buildPolyMesh(): string {
  const W = 600, H = 600, cols = 6, rows = 6;
  const cw = W / cols, ch = H / rows;
  const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const pts: [number, number][] = [];
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const k = r * (cols + 1) + c;
      const edge = c === 0 || c === cols || r === 0 || r === rows;
      const jx = edge ? 0 : (rnd(k) - 0.5) * cw * 0.7;
      const jy = edge ? 0 : (rnd(k + 97) - 0.5) * ch * 0.7;
      pts.push([+(c * cw + jx).toFixed(1), +(r * ch + jy).toFixed(1)]);
    }
  }
  const P = (c: number, r: number) => pts[r * (cols + 1) + c];
  const tri = (i: number, A: [number, number], B: [number, number], C: [number, number]) => {
    const h = rnd(i);
    const op = (0.015 + h * 0.06).toFixed(3);
    const fill = h > 0.84 ? "%23bfe8ff" : h < 0.16 ? "%23e9c9ff" : "%23ffffff";
    return "<path d='M" + A[0] + " " + A[1] + "L" + B[0] + " " + B[1] + "L" + C[0] + " " + C[1] + "Z' fill='" + fill + "' fill-opacity='" + op + "'/>";
  };
  let tris = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = P(c, r), b = P(c + 1, r), d = P(c, r + 1), e = P(c + 1, r + 1);
      tris += tri(r * cols + c, a, b, e) + tri(r * cols + c + 50, a, e, d);
    }
  }
  const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='" + W + "' height='" + H + "'>"
    + "<g stroke='%23ffffff' stroke-opacity='0.07' stroke-width='1'>" + tris + "</g></svg>";
  return "url(\"data:image/svg+xml;utf8," + svg + "\")";
}
const POLY = buildPolyMesh();

// Tiled starfields (two parallax layers). Dense small dots + sparser large/tinted
// dots — used by Iridescent (cosmic aura) and the Glass lock screen (night sky).
const STARS = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><g fill='%23ffffff'><circle cx='28' cy='46' r='0.9' opacity='0.85'/><circle cx='96' cy='22' r='0.6' opacity='0.6'/><circle cx='150' cy='90' r='1' opacity='0.9'/><circle cx='210' cy='40' r='0.7' opacity='0.7'/><circle cx='270' cy='110' r='0.8' opacity='0.75'/><circle cx='330' cy='60' r='0.6' opacity='0.55'/><circle cx='380' cy='130' r='1.1' opacity='0.9'/><circle cx='60' cy='140' r='0.7' opacity='0.65'/><circle cx='120' cy='180' r='0.9' opacity='0.8'/><circle cx='190' cy='150' r='0.6' opacity='0.5'/><circle cx='250' cy='200' r='1' opacity='0.85'/><circle cx='310' cy='170' r='0.7' opacity='0.6'/><circle cx='360' cy='230' r='0.8' opacity='0.7'/><circle cx='40' cy='250' r='1' opacity='0.8'/><circle cx='100' cy='300' r='0.7' opacity='0.6'/><circle cx='170' cy='270' r='0.9' opacity='0.75'/><circle cx='230' cy='330' r='0.6' opacity='0.55'/><circle cx='290' cy='290' r='1' opacity='0.85'/><circle cx='350' cy='340' r='0.8' opacity='0.7'/><circle cx='30' cy='360' r='0.7' opacity='0.6'/><circle cx='140' cy='360' r='0.9' opacity='0.8'/><circle cx='200' cy='390' r='0.6' opacity='0.5'/><circle cx='380' cy='380' r='0.9' opacity='0.75'/><circle cx='70' cy='200' r='0.5' opacity='0.45'/></g></svg>\")";
const STARS2 = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='760' height='760'><circle cx='80' cy='120' r='1.4' fill='%23ffffff' opacity='0.8'/><circle cx='300' cy='80' r='1.2' fill='%23cdbdf2' opacity='0.7'/><circle cx='520' cy='200' r='1.5' fill='%23ffffff' opacity='0.85'/><circle cx='660' cy='120' r='1.1' fill='%23ffffff' opacity='0.6'/><circle cx='180' cy='300' r='1.3' fill='%23cdbdf2' opacity='0.75'/><circle cx='440' cy='360' r='1.4' fill='%23ffffff' opacity='0.8'/><circle cx='620' cy='420' r='1.2' fill='%23ffffff' opacity='0.65'/><circle cx='120' cy='520' r='1.5' fill='%23cdbdf2' opacity='0.85'/><circle cx='360' cy='560' r='1.2' fill='%23ffffff' opacity='0.7'/><circle cx='560' cy='620' r='1.4' fill='%23ffffff' opacity='0.8'/><circle cx='700' cy='680' r='1.1' fill='%23cdbdf2' opacity='0.6'/><circle cx='260' cy='700' r='1.3' fill='%23ffffff' opacity='0.75'/><circle cx='40' cy='360' r='1' fill='%23ffffff' opacity='0.55'/><circle cx='700' cy='300' r='1.2' fill='%23ffffff' opacity='0.65'/></svg>\")";

export default function StockBackdrop({ bg }: { bg: BgName }) {
  // Two-plane architecture so text always reads:
  //   .sbk-fx   — the colorful backdrop, carries the brightness/saturate "pop"
  //   .sbk-readscrim — a TRUE-dark legibility scrim rendered OUTSIDE that filter,
  //                    so it can't be brightened away. Left-anchored (behind the
  //                    hero copy) + a soft bottom/vignette. Applies to every vibe.
  // The pop is intentionally modest now (brightness ~1.05) — the user wanted the
  // darkness back; legibility comes from the scrim, not from dimming the art.
  const rootStyle = {
    position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden",
    background: "#08060F",
    ["--bg0" as string]: PAL[0], ["--bg1" as string]: PAL[1], ["--bg2" as string]: PAL[2],
  } as React.CSSProperties;

  return (
    <div style={rootStyle} aria-hidden="true">
      <style>{`
        @keyframes sbk-ckscan{0%{transform:translateY(0)}100%{transform:translateY(120vh)}}
        @keyframes sbk-ckscan2{0%{transform:translateY(40vh)}100%{transform:translateY(140vh)}}
        @keyframes sbk-irid{0%{transform:scale(1.1) rotate(0deg)}100%{transform:scale(1.2) rotate(12deg)}}
        @keyframes sbk-irid2{0%{transform:scale(1.12) rotate(0deg)}100%{transform:scale(1.24) rotate(-16deg)}}
        @keyframes sbk-ckdrift{0%{transform:translate3d(-1.6%,-1%,0) scale(1.02)}100%{transform:translate3d(2.2%,1.6%,0) scale(1.09)}}
        @keyframes sbk-ckgrid{from{background-position:0 0}to{background-position:0 60px}}
        @keyframes sbk-ckdetect{0%{opacity:0;transform:scale(.6)}6%{opacity:0;transform:scale(.62)}10%{opacity:.9;transform:scale(1.06)}14%{opacity:.4;transform:scale(.99)}18%{opacity:.72;transform:scale(1.01)}24%{opacity:.3;transform:scale(1)}30%{opacity:.58;transform:scale(1)}40%{opacity:0;transform:scale(1)}100%{opacity:0;transform:scale(1)}}
        @keyframes sbk-cktv{0%,100%{opacity:.5}48%{opacity:.34}50%{opacity:.62}52%{opacity:.4}}
        @keyframes sbk-iridwarp{0%{transform:translate(-3%,-2%) skewX(0deg) skewY(0deg) scale(1.06)}25%{transform:translate(2%,-1%) skewX(2deg) skewY(-1.4deg) scale(1.1)}50%{transform:translate(3%,3%) skewX(0deg) skewY(1.4deg) scale(1.08)}75%{transform:translate(-1%,2%) skewX(-2deg) skewY(1deg) scale(1.12)}100%{transform:translate(-3%,-2%) skewX(0deg) skewY(0deg) scale(1.06)}}
        @keyframes sbk-iridwarp2{0%{transform:translate(2%,1%) skewX(-1.5deg) scale(1.12)}50%{transform:translate(-2%,-2%) skewX(1.6deg) scale(1.16)}100%{transform:translate(2%,1%) skewX(-1.5deg) scale(1.12)}}
        @keyframes sbk-iridhue{0%{filter:hue-rotate(0deg)}100%{filter:hue-rotate(38deg)}}
        @keyframes sbk-iridsweep{0%{transform:translateX(-42%) rotate(8deg)}100%{transform:translateX(42%) rotate(8deg)}}
        @keyframes sbk-twinkle{0%,100%{opacity:.35}50%{opacity:.8}}
        @keyframes sbk-twinkle2{0%,100%{opacity:.55}50%{opacity:.28}}
        @keyframes sbk-stardrift{0%{transform:translate3d(0,0,0)}100%{transform:translate3d(-2.4%,-3.2%,0)}}
        @keyframes sbk-iridflow{0%{transform:translate(-4%,2%) scale(1.04)}50%{transform:translate(3%,-3%) scale(1.12)}100%{transform:translate(-4%,2%) scale(1.04)}}
        .sbk-layer{position:absolute;inset:0;pointer-events:none}
        .sbk-fx{position:absolute;inset:0;filter:brightness(var(--sbk-bright,1.05)) saturate(var(--sbk-sat,1.08)) contrast(var(--sbk-contrast,1))}
        .sbk-grain{opacity:.26;mix-blend-mode:overlay;background-image:${GRAIN}}
        .sbk-scrim{background:radial-gradient(ellipse 76% 66% at 50% 40%, rgb(8 6 16 / var(--sbk-scrim-c,.05)), rgb(8 6 16 / var(--sbk-scrim-e,.46)) 100%)}
        .sbk-lift{background:radial-gradient(56% 46% at 50% 37%, rgba(255,255,255,.05), rgba(170,120,235,.05) 40%, transparent 72%);mix-blend-mode:screen}
        /* LEGIBILITY — true-dark scrim OUTSIDE the brightness filter; every vibe. */
        .sbk-readscrim{background:linear-gradient(90deg, rgba(7,5,15,.72) 0%, rgba(7,5,15,.46) 27%, rgba(7,5,15,.12) 55%, transparent 74%),linear-gradient(0deg, rgba(7,5,15,.48) 0%, rgba(7,5,15,.10) 22%, transparent 38%),radial-gradient(135% 95% at 50% -8%, transparent 50%, rgba(7,5,15,.32) 100%)}
        /* COCKPIT — command-center HUD: receding perspective grid (floor+ceiling),
           rotating targeting reticle, corner brackets, scan sweeps, tech glows */
        .sbk-ckglows{background:radial-gradient(680px 680px at 8% -10%, rgba(11,134,209,.42), transparent 60%),radial-gradient(560px 560px at 94% -6%, rgba(46,173,142,.34), transparent 60%),radial-gradient(820px 520px at 50% 116%, rgba(11,134,209,.40), transparent 64%),radial-gradient(440px 440px at 82% 70%, rgba(247,176,65,.16), transparent 70%);animation:sbk-ckdrift 20s ease-in-out infinite alternate}
        .sbk-ckfloor{left:-30%;right:-30%;bottom:-12%;top:auto;height:62%;background-image:linear-gradient(to right, rgba(11,134,209,.5) 1px, transparent 1px),linear-gradient(to bottom, rgba(11,134,209,.5) 1px, transparent 1px);background-size:60px 60px;transform:perspective(420px) rotateX(66deg);transform-origin:50% 100%;-webkit-mask-image:linear-gradient(to top,#000 2%,transparent 82%);mask-image:linear-gradient(to top,#000 2%,transparent 82%);opacity:.6;animation:sbk-ckgrid 5.5s linear infinite}
        .sbk-ckceil{left:-30%;right:-30%;top:-12%;bottom:auto;height:52%;background-image:linear-gradient(to right, rgba(247,176,65,.26) 1px, transparent 1px),linear-gradient(to bottom, rgba(247,176,65,.26) 1px, transparent 1px);background-size:60px 60px;transform:perspective(420px) rotateX(-66deg);transform-origin:50% 0%;-webkit-mask-image:linear-gradient(to bottom,#000 2%,transparent 80%);mask-image:linear-gradient(to bottom,#000 2%,transparent 80%);opacity:.42;animation:sbk-ckgrid 7s linear infinite}
        .sbk-ckoct{position:absolute;background-repeat:no-repeat;background-position:center;background-size:contain;opacity:0;transform-origin:50% 50%;animation:sbk-ckdetect var(--d,11s) ease-in-out infinite;animation-delay:var(--dl,0s);filter:drop-shadow(0 0 6px rgba(120,200,255,.25));will-change:opacity,transform}
        .sbk-cktv{background-image:repeating-linear-gradient(to bottom, rgba(180,220,255,.05) 0px, rgba(180,220,255,.05) 1px, transparent 1px, transparent 3px);mix-blend-mode:overlay;animation:sbk-cktv 5s ease-in-out infinite}
        .sbk-ckhud{position:absolute;inset:24px;pointer-events:none}
        .sbk-ckbk{position:absolute;width:42px;height:42px;border:2px solid rgba(247,176,65,.5);box-shadow:0 0 14px rgba(247,176,65,.25)}
        .sbk-ckbk.tl{top:0;left:0;border-right:none;border-bottom:none}
        .sbk-ckbk.tr{top:0;right:0;border-left:none;border-bottom:none}
        .sbk-ckbk.bl{bottom:0;left:0;border-right:none;border-top:none}
        .sbk-ckbk.br{bottom:0;right:0;border-left:none;border-top:none}
        .sbk-ckscan{left:0;right:0;top:-220px;height:200px;background:linear-gradient(180deg,transparent,rgba(46,173,142,.22),transparent);animation:sbk-ckscan 9s linear infinite}
        .sbk-ckscan2{left:0;right:0;top:-160px;height:140px;background:linear-gradient(180deg,transparent,rgba(11,134,209,.2),transparent);animation:sbk-ckscan2 13s linear infinite}
        /* IRIDESCENT — calmer oil-slick conics + cosmic starfield + soft fluid bloom */
        .sbk-irid{background:conic-gradient(from 120deg at 38% 32%, color-mix(in srgb,var(--bg0) 58%,transparent), color-mix(in srgb,var(--bg2) 50%,transparent) 26%, color-mix(in srgb,var(--bg1) 54%,transparent) 54%, color-mix(in srgb,var(--bg0) 58%,transparent));filter:blur(70px) saturate(1.2);opacity:.8;animation:sbk-irid 34s ease-in-out infinite alternate}
        .sbk-irid2{background:conic-gradient(from -40deg at 66% 70%, color-mix(in srgb,var(--bg1) 44%,transparent), transparent 30%, color-mix(in srgb,var(--bg2) 42%,transparent) 60%, transparent 86%);filter:blur(92px) saturate(1.2);mix-blend-mode:screen;opacity:.7;animation:sbk-irid2 48s ease-in-out infinite alternate}
        .sbk-iridflow{width:62%;height:58%;left:40%;top:28%;background:radial-gradient(closest-side, rgba(180,140,240,.16), rgba(70,120,220,.06) 60%, transparent);filter:blur(70px);mix-blend-mode:screen;animation:sbk-iridflow 26s ease-in-out infinite}
        .sbk-iridbloom{background:radial-gradient(52% 44% at 50% 44%, rgba(184,132,242,.12), rgba(46,107,230,.05) 46%, transparent 72%);mix-blend-mode:screen}
        /* low-poly refracting "map": two parallax facet sheets that slowly warp +
           hue-shift, plus a sweeping iridescent band ⇒ wave-displacement feel */
        .sbk-iridpoly{background-image:${POLY};background-repeat:repeat;background-size:62vw 62vw;mix-blend-mode:screen;opacity:.6;transform-origin:50% 50%;animation:sbk-iridwarp 32s ease-in-out infinite, sbk-iridhue 22s ease-in-out infinite alternate;will-change:transform,filter}
        .sbk-iridpoly2{background-image:${POLY};background-repeat:repeat;background-size:44vw 44vw;mix-blend-mode:overlay;opacity:.42;transform-origin:50% 50%;animation:sbk-iridwarp2 26s ease-in-out infinite, sbk-iridhue 18s ease-in-out infinite alternate-reverse;will-change:transform,filter}
        .sbk-iridrefract{left:-30%;right:-30%;top:-20%;bottom:-20%;background:linear-gradient(72deg, transparent 30%, rgba(120,220,255,.06) 44%, rgba(200,150,255,.085) 50%, rgba(255,200,150,.05) 56%, transparent 70%);mix-blend-mode:screen;animation:sbk-iridsweep 22s ease-in-out infinite alternate;will-change:transform}
        @media (prefers-reduced-motion: reduce){.sbk-ckoct,.sbk-cktv,.sbk-iridpoly,.sbk-iridpoly2,.sbk-iridrefract{animation:none}.sbk-iridpoly{opacity:.4}.sbk-iridpoly2{opacity:.3}}
        .sbk-stars{background-image:${STARS};background-repeat:repeat;background-size:480px 480px;animation:sbk-twinkle 4.6s ease-in-out infinite, sbk-stardrift 70s linear infinite alternate}
        .sbk-stars2{background-image:${STARS2};background-repeat:repeat;background-size:760px 760px;animation:sbk-twinkle2 6.8s ease-in-out infinite, sbk-stardrift 110s linear infinite alternate-reverse}
      `}</style>

      {/* colorful plane — carries the brightness "pop" */}
      <div className="sbk-fx">
        {bg === "aurora" && (
          <>
            <FluidCanvas colors={PAL} />
            <div className="sbk-layer sbk-lift" />
            <div className="sbk-layer sbk-scrim" />
            <div className="sbk-layer sbk-grain" />
          </>
        )}
        {bg === "cockpit" && (
          <>
            <div className="sbk-layer sbk-ckglows" />
            <div className="sbk-layer sbk-ckceil" />
            <div className="sbk-layer sbk-ckfloor" />
            {OCTS.map((o, i) => (
              <span
                key={i}
                className="sbk-ckoct"
                style={{
                  left: o.x, top: o.y, width: o.s, height: o.s,
                  marginLeft: -o.s / 2, marginTop: -o.s / 2,
                  backgroundImage: octa(o.c),
                  ["--d" as string]: o.d, ["--dl" as string]: o.dl,
                }}
              />
            ))}
            <div className="sbk-ckhud">
              <span className="sbk-ckbk tl" />
              <span className="sbk-ckbk tr" />
              <span className="sbk-ckbk bl" />
              <span className="sbk-ckbk br" />
            </div>
            <div className="sbk-layer sbk-ckscan" />
            <div className="sbk-layer sbk-ckscan2" />
            <div className="sbk-layer sbk-cktv" />
            <div className="sbk-layer sbk-grain" />
          </>
        )}
        {bg === "iridescent" && (
          <>
            <div className="sbk-layer sbk-irid" />
            <div className="sbk-layer sbk-irid2" />
            <div className="sbk-layer sbk-iridpoly" />
            <div className="sbk-layer sbk-iridpoly2" />
            <div className="sbk-layer sbk-iridrefract" />
            <div className="sbk-layer sbk-stars" />
            <div className="sbk-layer sbk-stars2" />
            <div className="sbk-layer sbk-iridflow" />
            <div className="sbk-layer sbk-iridbloom" />
            <div className="sbk-layer sbk-grain" />
          </>
        )}
      </div>
      {/* legibility plane — TRUE dark, outside the filter, on every vibe */}
      <div className="sbk-layer sbk-readscrim" />
    </div>
  );
}

// ═══ GLASS BACKDROP (Reflect · Clarity) ═══
// The live liquid-glass refraction backdrop ported from the mockup glass.html
// `#fluid` canvas (~/poast-welcome-3.0 concepts/glass.html §1–2). Reuses the SAME
// fbm-smoke shader as the Stock aurora (identical red/blue/violet PAL), then lays
// the glass.html scrim (radial vignette + vertical fade for legibility) and a
// grain plane over it. This is what was missing — without it the Reflect/Clarity
// home floated glass tiles over a flat dark base (the "dark aura page"). Mounted
// only for Clarity; Depth paints its own night-sky.
export function GlassBackdrop() {
  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
      <FluidCanvas colors={PAL} />
      {/* scrim — radial vignette + top/bottom vertical fade (glass.html §2.1) */}
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none",
          background:
            "radial-gradient(120% 90% at 50% 28%, transparent 42%, rgba(6,4,14,.5) 100%)," +
            "linear-gradient(180deg, rgba(6,4,14,.42) 0%, transparent 22%, transparent 70%, rgba(6,4,14,.5) 100%)",
        }}
      />
      {/* grain — subtle film overlay (glass.html §2.2) */}
      <div style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none", backgroundImage: GRAIN, opacity: 0.16, mixBlendMode: "overlay" }} />
    </div>
  );
}
