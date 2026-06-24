"use client";
// Appearance & personal settings — theme (Classic/Stock/Glass), background,
// and a "Replay tour" action. Wired to ThemeProvider (localStorage + Neon).
import { createPortal } from "react-dom";
import { X, Check, RotateCcw, Lock, Unlock } from "lucide-react";
import { D, ft, gf, mn } from "../../shared-constants";
import { useTheme, playThemeTransitionAndReload, type ThemeName, type BgName, type GlassMat, type GlassVars } from "../../theme-context";

const THEMES: { id: ThemeName; name: string; desc: string; sw: string }[] = [
  { id: "classic", name: "Classic", desc: "The original POAST look — flat, focused, dark.", sw: "linear-gradient(135deg,#0D0D12,#09090D)" },
  { id: "stock", name: "Fresh", desc: "Smokey aurora — pick from three backdrops.", sw: "linear-gradient(135deg,#D1334A,#905CCB 55%,#2E6BE6)" },
  { id: "glass", name: "Reflect", desc: "Translucent liquid-glass surfaces over ambient light.", sw: "linear-gradient(135deg,rgba(52,166,230,.5),rgba(46,173,142,.4))" },
];
const BGS: { id: BgName; name: string }[] = [
  { id: "aurora", name: "Aurora" },
  { id: "iridescent", name: "Iridescent" },
  { id: "cockpit", name: "Cockpit" },
];
// Reflect home layouts (the "home screen choice" the user picks while on Glass).
// Switching *into* Reflect always lands on Clarity; Depth is opt-in here.
const MATS: { id: GlassMat; name: string; desc: string }[] = [
  { id: "clarity", name: "Clarity", desc: "Liquid-glass home — welcome hero, dock + tool tiles." },
  { id: "depth", name: "Depth", desc: "Ambient night-sky lock screen — live clock, stars + shooting stars." },
];
// Glass material sliders + presets — faithful to the mockup gpanel (glass.html).
const GLASS_SLIDERS: { key: keyof GlassVars; label: string; min: number; max: number; step: number }[] = [
  { key: "refraction", label: "Refraction", min: 0, max: 1, step: 0.01 },
  { key: "frost", label: "Frost / blur", min: 0, max: 20, step: 0.1 },
  { key: "glassOp", label: "Glass / dark", min: 0, max: 1, step: 0.01 },
  { key: "spec", label: "Specular", min: 0, max: 1, step: 0.01 },
  { key: "specSat", label: "Specular sat", min: 0, max: 1, step: 0.01 },
];
const GLASS_PRESETS: { id: string; name: string; v: GlassVars }[] = [
  { id: "clear", name: "Clear", v: { refraction: 0.61, frost: 1.9, glassOp: 0.18, spec: 0.58, specSat: 0.43 } },
  { id: "frost", name: "Frost", v: { refraction: 0.0, frost: 18.3, glassOp: 0.02, spec: 0.29, specSat: 0.21 } },
  { id: "dark", name: "Dark", v: { refraction: 0.0, frost: 10.9, glassOp: 0.66, spec: 0.53, specSat: 0.50 } },
];

// The inner theme/backdrop controls — reusable both inline (e.g. a Settings
// tab) and inside the modal below. `onReplayTour`, when supplied, renders the
// Help · Replay-tour action (the modal wires it to close-then-replay; surfaces
// that own their own tour replay just omit it).
export function AppearancePanel({ onReplayTour }: { onReplayTour?: () => void }) {
  const { theme, bg, glassMat, glass, glassLocked, setTheme, setBg, setGlassMat, setThemeMat, setGlass, setGlassLocked } = useTheme();
  // Picking a *theme* swaps the whole home + chrome, so it "locks in" with a
  // brief branded transition then a hard refresh (per the product model: choose
  // your theme → cool animation → reload). Backdrop vibes stay live-preview.
  const pickTheme = (t: ThemeName) => {
    if (t === theme) return;
    // Entering Glass always opens the Glass Home (clarity); the Lock screen is
    // an opt-in choice below — never the landing screen on a theme switch.
    if (t === "glass") setThemeMat("glass", "clarity");
    else setTheme(t);
    const name = THEMES.find((x) => x.id === t)?.name || "your look";
    playThemeTransitionAndReload("Switching to " + name);
  };
  // Glass home (clarity dock ↔ depth ambient) is a full home swap, so it gets
  // the same cool transition + reload rather than a hard jump.
  const pickMat = (m: GlassMat) => {
    if (m === glassMat) return;
    setGlassMat(m);
    const name = MATS.find((x) => x.id === m)?.name || "Reflect";
    playThemeTransitionAndReload("Switching to Reflect · " + name);
  };
  return (
    <>
      <div style={lbl}>Appearance · Theme</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 10 }}>
        {THEMES.map((t) => {
          const on = theme === t.id;
          return (
            <button key={t.id} onClick={() => pickTheme(t.id)} style={{
              textAlign: "left", cursor: "pointer", borderRadius: 14, overflow: "hidden",
              border: `1px solid ${on ? D.amber : D.border}`,
              boxShadow: on ? `0 0 0 1px ${D.amber}, 0 10px 30px ${D.amber}1c` : "none",
              background: D.surface, color: D.tx, padding: 0, transition: "all .16s",
            }}>
              <div style={{ height: 64, background: t.sw, position: "relative" }}>
                {on && <div style={{ position: "absolute", top: 8, right: 8, width: 22, height: 22, borderRadius: 999, background: D.amber, color: "#1a1208", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={13} /></div>}
              </div>
              <div style={{ padding: "10px 12px 12px" }}>
                <div style={{ fontFamily: gf, fontWeight: 700, fontSize: 14 }}>{t.name}</div>
                <div style={{ fontSize: 11.5, color: D.txm, marginTop: 4, lineHeight: 1.45 }}>{t.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {theme === "stock" && (
        <>
          <div style={{ ...lbl, marginTop: 22 }}>Fresh · Backdrop</div>
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            {BGS.map((b) => {
              const on = bg === b.id;
              return (
                <button key={b.id} onClick={() => setBg(b.id)} style={{
                  flex: 1, cursor: "pointer", borderRadius: 11, padding: "10px 8px",
                  border: `1px solid ${on ? D.amber : D.border}`,
                  background: on ? D.amber + "14" : D.surface, color: on ? D.amber : D.txm,
                  fontFamily: mn, fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 600,
                }}>{b.name}</button>
              );
            })}
          </div>
        </>
      )}

      {theme === "glass" && (
        <>
          <div style={{ ...lbl, marginTop: 22 }}>Reflect · Home screen</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
            {MATS.map((m) => {
              const on = glassMat === m.id;
              return (
                <button key={m.id} onClick={() => pickMat(m.id)} style={{
                  textAlign: "left", cursor: "pointer", borderRadius: 12, padding: "12px 14px",
                  border: `1px solid ${on ? D.amber : D.border}`,
                  boxShadow: on ? `0 0 0 1px ${D.amber}, 0 8px 24px ${D.amber}1c` : "none",
                  background: on ? D.amber + "10" : D.surface, color: D.tx, transition: "all .16s",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: gf, fontWeight: 700, fontSize: 14, color: on ? D.amber : D.tx }}>{m.name}</span>
                    {on && <span style={{ marginLeft: "auto", width: 18, height: 18, borderRadius: 999, background: D.amber, color: "#1a1208", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Check size={11} /></span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: D.txm, marginTop: 4, lineHeight: 1.45 }}>{m.desc}</div>
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 22 }}>
            <div style={lbl}>Reflect · Material</div>
            <button onClick={() => setGlassLocked(!glassLocked)} title={glassLocked ? "Unlock to adjust" : "Lock these settings"} style={{
              display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", borderRadius: 999,
              padding: "4px 10px", fontFamily: mn, fontSize: 9.5, letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 700,
              border: `1px solid ${glassLocked ? D.amber : D.border}`, background: glassLocked ? D.amber + "18" : "transparent", color: glassLocked ? D.amber : D.txm,
            }}>{glassLocked ? <Lock size={11} /> : <Unlock size={11} />}{glassLocked ? "Locked" : "Unlocked"}</button>
          </div>

          {/* presets */}
          <div style={{ display: "flex", gap: 7, marginTop: 10, opacity: glassLocked ? 0.45 : 1, pointerEvents: glassLocked ? "none" : "auto" }}>
            {GLASS_PRESETS.map((p) => {
              const on = GLASS_SLIDERS.every((s) => Math.abs((glass[s.key] as number) - p.v[s.key]) < 0.001);
              return (
                <button key={p.id} onClick={() => setGlass(p.v)} style={{
                  flex: 1, cursor: "pointer", borderRadius: 10, padding: "8px 8px",
                  border: `1px solid ${on ? D.amber : D.border}`, background: on ? D.amber + "14" : D.surface,
                  color: on ? D.amber : D.txm, fontFamily: mn, fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 600,
                }}>{p.name}</button>
              );
            })}
          </div>

          {/* sliders */}
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 13, opacity: glassLocked ? 0.45 : 1, pointerEvents: glassLocked ? "none" : "auto" }}>
            {GLASS_SLIDERS.map((s) => {
              const val = glass[s.key] as number;
              return (
                <div key={s.key} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 4, alignItems: "center" }}>
                  <label style={{ fontFamily: ft, fontSize: 12.5, color: D.tx, fontWeight: 600 }}>{s.label}</label>
                  <output style={{ fontFamily: mn, fontSize: 11, color: D.txm }}>{s.step < 1 && s.max <= 1 ? val.toFixed(2) : val.toFixed(1)}</output>
                  <input type="range" min={s.min} max={s.max} step={s.step} value={val} disabled={glassLocked}
                    onChange={(e) => setGlass({ [s.key]: parseFloat(e.target.value) } as Partial<GlassVars>)}
                    style={{ gridColumn: "1 / -1", width: "100%", accentColor: D.amber, cursor: glassLocked ? "default" : "pointer" }} />
                </div>
              );
            })}
          </div>
        </>
      )}

      {onReplayTour && (
        <>
          <div style={{ ...lbl, marginTop: 24 }}>Help</div>
          <button onClick={onReplayTour} style={{
            marginTop: 10, display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer",
            fontFamily: ft, fontWeight: 600, fontSize: 13, color: D.tx,
            background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10, padding: "10px 16px",
          }}><RotateCcw size={14} /> Replay the guided tour</button>
        </>
      )}

      <div style={{ marginTop: 22, fontSize: 11, color: D.txd, fontFamily: mn, lineHeight: 1.6 }}>
        Your theme is saved to your account and follows you across devices.
      </div>
    </>
  );
}

export default function AppearanceSettings({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open || typeof document === "undefined") return null;

  const ui = (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 8500, display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(4,4,8,0.6)", backdropFilter: "blur(6px)", fontFamily: ft, padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} data-glass style={{
        width: 560, maxWidth: "100%", maxHeight: "88vh", overflow: "auto",
        background: D.card, border: `1px solid ${D.border}`, borderRadius: 18,
        boxShadow: "0 30px 80px rgba(0,0,0,0.6)", color: D.tx,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: `1px solid ${D.border}` }}>
          <span style={{ fontFamily: gf, fontWeight: 700, fontSize: 18 }}>Settings</span>
          <button onClick={onClose} style={iconBtn} title="Close"><X size={16} /></button>
        </div>

        <div style={{ padding: 22 }}>
          <AppearancePanel onReplayTour={() => { onClose(); setTimeout(() => window.dispatchEvent(new Event("poast:replay-tour")), 60); }} />
        </div>
      </div>
    </div>
  );
  return createPortal(ui, document.body);
}

const lbl: React.CSSProperties = { fontFamily: mn, fontSize: 10, letterSpacing: ".22em", textTransform: "uppercase", color: D.txd };
const iconBtn: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8, border: `1px solid ${D.border}`,
  background: "transparent", color: D.txm, cursor: "pointer",
  display: "inline-flex", alignItems: "center", justifyContent: "center",
};
