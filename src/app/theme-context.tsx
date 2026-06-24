"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

// ─── Appearance: theme + background + glass material, persisted per user ───
// theme swaps the CSS-variable surface tokens (tokens.css); bg picks the stock
// backdrop variant; glassMat picks which Glass home layout (clarity dock vs
// depth ambient-lock) and the glass slider values tune the liquid-glass
// material live. Brand accents are constant across themes.
export type ThemeName = "classic" | "stock" | "glass";
export type BgName = "aurora" | "cockpit" | "iridescent";
export type GlassMat = "clarity" | "depth";
export interface GlassVars { frost: number; glassOp: number; spec: number; specSat: number; refraction: number }

const THEMES: ThemeName[] = ["classic", "stock", "glass"];
const BGS: BgName[] = ["aurora", "cockpit", "iridescent"];
const MATS: GlassMat[] = ["clarity", "depth"];
const GLASS_DEFAULT: GlassVars = { frost: 2, glassOp: 0.18, spec: 0.58, specSat: 0.43, refraction: 0.61 };
const LS_KEY = "poast-theme";

interface ThemeContextValue {
  theme: ThemeName;
  bg: BgName;
  glassMat: GlassMat;
  glass: GlassVars;
  glassLocked: boolean;
  setTheme: (t: ThemeName) => void;
  setBg: (b: BgName) => void;
  setGlassMat: (m: GlassMat) => void;
  setThemeMat: (t: ThemeName, m: GlassMat) => void;
  setGlass: (patch: Partial<GlassVars>) => void;
  setGlassLocked: (v: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "classic", bg: "aurora", glassMat: "clarity", glass: GLASS_DEFAULT, glassLocked: false,
  setTheme: () => {}, setBg: () => {}, setGlassMat: () => {}, setThemeMat: () => {}, setGlass: () => {}, setGlassLocked: () => {},
});

// the signed-in identity key the rest of the app uses (poast-current-user)
function currentOwner(): string {
  if (typeof window === "undefined") return "shared";
  try {
    return localStorage.getItem("poast-current-user")
      || sessionStorage.getItem("poast-current-user")
      || "shared";
  } catch { return "shared"; }
}

function apply(theme: ThemeName, bg: BgName, glassMat: GlassMat, glass: GlassVars) {
  if (typeof document === "undefined") return;
  const r = document.documentElement;
  r.setAttribute("data-theme", theme);
  r.setAttribute("data-bg", bg);
  r.setAttribute("data-glass-mat", glassMat);
  // Glass slider values feed the liquid-glass material (read via var() in the
  // glass surfaces). Set post-hydration in JS so there's no SSR style mismatch.
  r.style.setProperty("--frost", glass.frost + "px");
  r.style.setProperty("--glass-op", String(glass.glassOp));
  r.style.setProperty("--spec", String(glass.spec));
  r.style.setProperty("--spec-sat", String(glass.specSat));
  r.style.setProperty("--refraction", String(glass.refraction));
}

function readLocal(): { theme: ThemeName; bg: BgName; glassMat: GlassMat; glass: GlassVars; glassLocked: boolean } {
  try {
    const o = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    return {
      theme: THEMES.includes(o.theme) ? o.theme : "classic",
      bg: BGS.includes(o.bg) ? o.bg : "aurora",
      glassMat: MATS.includes(o.glassMat) ? o.glassMat : "clarity",
      glass: o.glass && typeof o.glass === "object" ? { ...GLASS_DEFAULT, ...o.glass } : GLASS_DEFAULT,
      glassLocked: !!o.glassLocked,
    };
  } catch { return { theme: "classic", bg: "aurora", glassMat: "clarity", glass: GLASS_DEFAULT, glassLocked: false }; }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeS] = useState<ThemeName>("classic");
  const [bg, setBgS] = useState<BgName>("aurora");
  const [glassMat, setGlassMatS] = useState<GlassMat>("clarity");
  const [glass, setGlassS] = useState<GlassVars>(GLASS_DEFAULT);
  const [glassLocked, setGlassLockedS] = useState<boolean>(false);

  // hydrate: localStorage (already applied pre-paint by the inline script),
  // then reconcile with the durable server copy (cross-device).
  useEffect(() => {
    const p = readLocal();
    setThemeS(p.theme); setBgS(p.bg); setGlassMatS(p.glassMat); setGlassS(p.glass); setGlassLockedS(p.glassLocked);
    apply(p.theme, p.bg, p.glassMat, p.glass);
    const owner = currentOwner();
    fetch("/api/prefs?owner=" + encodeURIComponent(owner))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || !d.stored) return; // no stored row ⇒ keep the local choice
        const t: ThemeName = THEMES.includes(d.theme) ? d.theme : p.theme;
        const b: BgName = BGS.includes(d.bg) ? d.bg : p.bg;
        const m: GlassMat = MATS.includes(d.glassMat) ? d.glassMat : p.glassMat;
        if (t !== p.theme || b !== p.bg || m !== p.glassMat) {
          setThemeS(t); setBgS(b); setGlassMatS(m); apply(t, b, m, p.glass);
          try { localStorage.setItem(LS_KEY, JSON.stringify({ ...p, theme: t, bg: b, glassMat: m })); } catch {}
        }
      })
      .catch(() => {});
  }, []);

  function persist(next: { theme: ThemeName; bg: BgName; glassMat: GlassMat; glass: GlassVars; glassLocked: boolean }) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
    try {
      fetch("/api/prefs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: currentOwner(), theme: next.theme, bg: next.bg, glassMat: next.glassMat }),
      });
    } catch {}
  }

  const setTheme = (t: ThemeName) => { setThemeS(t); apply(t, bg, glassMat, glass); persist({ theme: t, bg, glassMat, glass, glassLocked }); };
  const setBg = (b: BgName) => { setBgS(b); apply(theme, b, glassMat, glass); persist({ theme, bg: b, glassMat, glass, glassLocked }); };
  const setGlassMat = (m: GlassMat) => { setGlassMatS(m); apply(theme, bg, m, glass); persist({ theme, bg, glassMat: m, glass, glassLocked }); };
  // Atomic theme+home swap — used when entering Glass so it always lands on the
  // Glass Home (clarity). Doing both in one persist avoids the stale-closure race
  // two separate setters would hit (each persists the *other* field as stale).
  const setThemeMat = (t: ThemeName, m: GlassMat) => { setThemeS(t); setGlassMatS(m); apply(t, bg, m, glass); persist({ theme: t, bg, glassMat: m, glass, glassLocked }); };
  const setGlass = (patch: Partial<GlassVars>) => {
    if (glassLocked) return; // locked ⇒ frozen
    const g = { ...glass, ...patch };
    setGlassS(g); apply(theme, bg, glassMat, g); persist({ theme, bg, glassMat, glass: g, glassLocked });
  };
  const setGlassLocked = (v: boolean) => { setGlassLockedS(v); persist({ theme, bg, glassMat, glass, glassLocked: v }); };

  return (
    <ThemeContext.Provider value={{ theme, bg, glassMat, glass, glassLocked, setTheme, setBg, setGlassMat, setThemeMat, setGlass, setGlassLocked }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

// Play a brief branded transition, then hard-reload so the newly-saved theme
// mounts fresh (this is the "refresh to lock in the look" after Save). A hard
// reload also sidesteps any live re-theming fragility.
export function playThemeTransitionAndReload(label?: string) {
  if (typeof document === "undefined") { return; }
  const ov = document.createElement("div");
  ov.setAttribute("data-theme-transition", "1");
  ov.style.cssText = [
    "position:fixed", "inset:0", "z-index:99999", "display:flex",
    "align-items:center", "justify-content:center", "flex-direction:column", "gap:22px",
    "background:#06060C", "opacity:0", "transition:opacity .26s ease",
    "font-family:var(--ft,sans-serif)", "color:#E8E4DD", "overflow:hidden",
  ].join(";");
  ov.innerHTML =
    // expanding brand wash
    '<div style="position:absolute;inset:0;background:radial-gradient(900px 900px at 50% 42%, rgba(247,176,65,0.20), rgba(144,92,203,0.12) 40%, transparent 66%);animation:ptt-wash 1.05s cubic-bezier(.2,.7,.2,1) forwards"></div>' +
    // the mark: gradient chip that scales + rotates in, with a shimmer sweep
    '<div style="position:relative;width:58px;height:58px;border-radius:16px;background:linear-gradient(135deg,#F7B041,#905CCB);box-shadow:0 0 50px rgba(247,176,65,.45),0 10px 30px rgba(0,0,0,.5);overflow:hidden;animation:ptt-mark 1.05s cubic-bezier(.2,.8,.2,1) forwards">' +
      '<div style="position:absolute;inset:0;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.55) 50%,transparent 70%);transform:translateX(-120%);animation:ptt-shine .85s .18s ease-out forwards"></div></div>' +
    // label
    '<div style="position:relative;font-family:var(--mn,monospace);font-size:11px;letter-spacing:3px;text-transform:uppercase;opacity:0;animation:ptt-fade .4s .12s ease forwards">' + (label || "Applying your look") + "</div>" +
    // progress sweep
    '<div style="position:relative;width:130px;height:2px;border-radius:2px;background:rgba(255,255,255,.1);overflow:hidden"><div style="position:absolute;inset:0;width:40%;border-radius:2px;background:linear-gradient(90deg,transparent,#F7B041,transparent);animation:ptt-bar 1.05s ease-in-out forwards"></div></div>' +
    '<style>' +
      '@keyframes ptt-wash{0%{transform:scale(.6);opacity:0}40%{opacity:1}100%{transform:scale(1.25);opacity:1}}' +
      '@keyframes ptt-mark{0%{transform:scale(.5) rotate(-14deg);opacity:0}55%{transform:scale(1.06) rotate(2deg);opacity:1}100%{transform:scale(1) rotate(0)}}' +
      '@keyframes ptt-shine{0%{transform:translateX(-120%)}100%{transform:translateX(120%)}}' +
      '@keyframes ptt-fade{to{opacity:.9}}' +
      '@keyframes ptt-bar{0%{left:-40%}100%{left:120%}}' +
    "</style>";
  document.body.appendChild(ov);
  requestAnimationFrame(() => { ov.style.opacity = "1"; });
  setTimeout(() => { try { window.location.reload(); } catch { /* noop */ } }, 1080);
}
