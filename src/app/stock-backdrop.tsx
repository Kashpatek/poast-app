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

// The SemiAnalysis chip-octagon die-frame motif (matches the SA box-logo
// silhouette) — amber outline + a cobalt "via" dot per cell. Tiles 40×46 as the
// cockpit's structural grid (the "octagon look" from the brand pattern memory).
const OCTA = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='46'><polygon points='12,2 28,2 38,12 38,34 28,44 12,44 2,34 2,12' fill='none' stroke='%23F7B041' stroke-opacity='0.5' stroke-width='1'/><circle cx='20' cy='23' r='1.3' fill='%230B86D1' fill-opacity='0.55'/></svg>\")";

export default function StockBackdrop({ bg }: { bg: BgName }) {
  // Brightness/scrim are var-driven so the "pop" is tunable (defaults below are
  // the lifted look — a touch brighter + more saturated than the raw shader, a
  // lighter scrim, and a soft center lift glow). Overridable via --sbk-* vars.
  const rootStyle = {
    position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden",
    background: "#0A0816",
    ["--bg0" as string]: PAL[0], ["--bg1" as string]: PAL[1], ["--bg2" as string]: PAL[2],
    filter: "brightness(var(--sbk-bright,1.18)) saturate(var(--sbk-sat,1.14)) contrast(var(--sbk-contrast,1.02))",
  } as React.CSSProperties;

  return (
    <div style={rootStyle} aria-hidden="true">
      <style>{`
        @keyframes sbk-ckscan{0%{transform:translateY(0)}100%{transform:translateY(120vh)}}
        @keyframes sbk-ckscan2{0%{transform:translateY(40vh)}100%{transform:translateY(140vh)}}
        @keyframes sbk-irid{0%{transform:scale(1.12) rotate(0deg)}100%{transform:scale(1.28) rotate(16deg)}}
        @keyframes sbk-irid2{0%{transform:scale(1.14) rotate(0deg)}100%{transform:scale(1.34) rotate(-22deg)}}
        @keyframes sbk-ckdrift{0%{transform:translate3d(-1.6%,-1%,0) scale(1.02)}100%{transform:translate3d(2.2%,1.6%,0) scale(1.09)}}
        @keyframes sbk-octapulse{0%,100%{opacity:.42}50%{opacity:.62}}
        .sbk-layer{position:absolute;inset:0;pointer-events:none}
        .sbk-grain{opacity:.28;mix-blend-mode:overlay;background-image:${GRAIN}}
        .sbk-scrim{background:radial-gradient(ellipse 76% 66% at 50% 40%, rgb(8 6 16 / var(--sbk-scrim-c,.03)), rgb(8 6 16 / var(--sbk-scrim-e,.40)) 100%)}
        .sbk-lift{background:radial-gradient(56% 46% at 50% 37%, rgba(255,255,255,.07), rgba(170,120,235,.06) 40%, transparent 72%);mix-blend-mode:screen}
        /* COCKPIT — SA chip-octagon die-grid + vivid drifting glows + dual scan */
        .sbk-ckocta{background-image:${OCTA};background-size:40px 46px;mask-image:radial-gradient(132% 100% at 50% 8%,#000 30%,transparent 88%);-webkit-mask-image:radial-gradient(132% 100% at 50% 8%,#000 30%,transparent 88%);animation:sbk-octapulse 7s ease-in-out infinite}
        .sbk-ckglows{background:radial-gradient(640px 640px at 6% -8%, color-mix(in srgb,var(--bg0) 72%,transparent), transparent 60%),radial-gradient(580px 580px at 96% -6%, color-mix(in srgb,var(--bg1) 68%,transparent), transparent 60%),radial-gradient(720px 460px at 50% 114%, color-mix(in srgb,var(--bg2) 60%,transparent), transparent 64%),radial-gradient(460px 460px at 80% 66%, color-mix(in srgb,var(--bg0) 34%,transparent), transparent 70%),radial-gradient(420px 420px at 18% 78%, color-mix(in srgb,var(--bg1) 30%,transparent), transparent 72%);animation:sbk-ckdrift 18s ease-in-out infinite alternate}
        .sbk-ckscan{left:0;right:0;top:-220px;height:200px;background:linear-gradient(180deg,transparent,color-mix(in srgb,var(--bg1) 30%,transparent),transparent);animation:sbk-ckscan 9s linear infinite}
        .sbk-ckscan2{left:0;right:0;top:-160px;height:140px;background:linear-gradient(180deg,transparent,color-mix(in srgb,var(--bg0) 26%,transparent),transparent);animation:sbk-ckscan2 13s linear infinite}
        /* IRIDESCENT — layered counter-drifting oil-slick conics + central bloom */
        .sbk-irid{background:conic-gradient(from 120deg at 38% 32%, color-mix(in srgb,var(--bg0) 72%,transparent), color-mix(in srgb,var(--bg2) 62%,transparent) 26%, color-mix(in srgb,var(--bg1) 66%,transparent) 54%, color-mix(in srgb,var(--bg0) 72%,transparent));filter:blur(60px) saturate(1.5);animation:sbk-irid 28s ease-in-out infinite alternate}
        .sbk-irid2{background:conic-gradient(from -40deg at 66% 70%, color-mix(in srgb,var(--bg1) 56%,transparent), transparent 28%, color-mix(in srgb,var(--bg2) 52%,transparent) 58%, transparent 84%);filter:blur(82px) saturate(1.4);mix-blend-mode:screen;animation:sbk-irid2 40s ease-in-out infinite alternate}
        .sbk-iridbloom{background:radial-gradient(52% 44% at 50% 44%, rgba(184,132,242,.18), rgba(46,107,230,.08) 46%, transparent 72%);mix-blend-mode:screen}
      `}</style>

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
          <div className="sbk-layer sbk-ckocta" />
          <div className="sbk-layer sbk-ckscan" />
          <div className="sbk-layer sbk-ckscan2" />
          <div className="sbk-layer sbk-grain" />
        </>
      )}
      {bg === "iridescent" && (
        <>
          <div className="sbk-layer sbk-irid" />
          <div className="sbk-layer sbk-irid2" />
          <div className="sbk-layer sbk-iridbloom" />
          <div className="sbk-layer sbk-grain" />
        </>
      )}
    </div>
  );
}
