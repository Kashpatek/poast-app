"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

// ─── Appearance: theme + background, persisted per user ───
// theme swaps the CSS-variable surface tokens (tokens.css); bg picks the
// stock backdrop variant. Brand accents are constant across themes.
export type ThemeName = "classic" | "stock" | "glass";
export type BgName = "aurora" | "cockpit" | "iridescent";

const THEMES: ThemeName[] = ["classic", "stock", "glass"];
const BGS: BgName[] = ["aurora", "cockpit", "iridescent"];
const LS_KEY = "poast-theme";

interface ThemeContextValue {
  theme: ThemeName;
  bg: BgName;
  setTheme: (t: ThemeName) => void;
  setBg: (b: BgName) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "classic", bg: "aurora", setTheme: () => {}, setBg: () => {},
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

function apply(theme: ThemeName, bg: BgName) {
  if (typeof document === "undefined") return;
  const r = document.documentElement;
  r.setAttribute("data-theme", theme);
  r.setAttribute("data-bg", bg);
}

function readLocal(): { theme: ThemeName; bg: BgName } {
  try {
    const o = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    return {
      theme: THEMES.includes(o.theme) ? o.theme : "classic",
      bg: BGS.includes(o.bg) ? o.bg : "aurora",
    };
  } catch { return { theme: "classic", bg: "aurora" }; }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeS] = useState<ThemeName>("classic");
  const [bg, setBgS] = useState<BgName>("aurora");

  // hydrate: localStorage (already applied pre-paint by the inline script),
  // then reconcile with the durable server copy (cross-device).
  useEffect(() => {
    const p = readLocal();
    setThemeS(p.theme); setBgS(p.bg); apply(p.theme, p.bg);
    const owner = currentOwner();
    fetch("/api/prefs?owner=" + encodeURIComponent(owner))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || !d.stored) return; // no stored row ⇒ keep the local choice
        const t: ThemeName = THEMES.includes(d.theme) ? d.theme : p.theme;
        const b: BgName = BGS.includes(d.bg) ? d.bg : p.bg;
        if (t !== p.theme || b !== p.bg) {
          setThemeS(t); setBgS(b); apply(t, b);
          try { localStorage.setItem(LS_KEY, JSON.stringify({ theme: t, bg: b })); } catch {}
        }
      })
      .catch(() => {});
  }, []);

  function persist(t: ThemeName, b: BgName) {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ theme: t, bg: b })); } catch {}
    try {
      fetch("/api/prefs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: currentOwner(), theme: t, bg: b }),
      });
    } catch {}
  }

  const setTheme = (t: ThemeName) => { setThemeS(t); apply(t, bg); persist(t, bg); };
  const setBg = (b: BgName) => { setBgS(b); apply(theme, b); persist(theme, b); };

  return (
    <ThemeContext.Provider value={{ theme, bg, setTheme, setBg }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
