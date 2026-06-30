"use client";
// Appearance & personal settings — theme (Classic/Stock/Glass), background,
// and a "Replay tour" action. Wired to ThemeProvider (localStorage + Neon).
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Check, RotateCcw, Lock, Unlock, Star, ArrowRight } from "lucide-react";
import { D, ft, gf, mn } from "../../shared-constants";
import { useTheme, playThemeTransitionAndReload, type ThemeName, type BgName, type GlassMat, type GlassVars } from "../../theme-context";
import { useGoogle, calendarTargets, getDefaultCalendarId, setDefaultCalendarId, resolveDefaultCalendarId } from "../use-google";
import { eventCalendarId, type MarketingEvent } from "../marketing-constants";
import type { MarketingState } from "../use-marketing";

// An event that lives only in-app (not synced from Google) — safe to re-target
// its calendar lane without a Google-side move.
function isInAppEvent(e: MarketingEvent): boolean {
  return !e.gcalEventId && e.source !== "gcal" && typeof e.payload?.gcalEventId !== "string";
}

// Demo ⇄ Live data mode — moved here from the top bar. "Live" reads/writes this
// user's real saved data; "Demo" is a safe in-memory sandbox.
function DataModeSection({ m }: { m: MarketingState }) {
  const OPTS = [
    { key: "demo", label: "Demo", desc: "Sample data — a safe sandbox, never saved.", color: D.amber },
    { key: "live", label: "Live", desc: "Your real saved data.", color: D.teal },
  ] as const;
  return (
    <>
      <div style={lbl}>Data</div>
      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        {OPTS.map((opt) => {
          const on = m.mode === opt.key;
          return (
            <button key={opt.key} onClick={() => m.setMode(opt.key)} style={{
              flex: 1, textAlign: "left", cursor: "pointer", borderRadius: 12, padding: "12px 14px",
              border: `1px solid ${on ? opt.color : D.border}`,
              boxShadow: on ? `0 0 0 1px ${opt.color}, 0 8px 24px ${opt.color}1c` : "none",
              background: on ? opt.color + "12" : D.surface, color: D.tx, transition: "all .16s",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: opt.color, boxShadow: on ? `0 0 8px ${opt.color}` : "none" }} />
                <span style={{ fontFamily: gf, fontWeight: 700, fontSize: 14, color: on ? opt.color : D.tx }}>{opt.label}</span>
                {on && <span style={{ marginLeft: "auto", width: 18, height: 18, borderRadius: 999, background: opt.color, color: "#0c0c14", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Check size={11} /></span>}
              </div>
              <div style={{ fontSize: 11.5, color: D.txm, marginTop: 4, lineHeight: 1.45 }}>{opt.desc}</div>
            </button>
          );
        })}
      </div>
      <div style={{ height: 1, background: D.border, margin: "22px 0 0" }} />
    </>
  );
}

// Default calendar — mirror of the Calendars-panel gate, so the choice can be
// changed any time. Change-on-select persists immediately (per owner). When the
// default changes and in-app items still sit on the previous calendar, we OFFER
// to move them (opt-in, never automatic) — the user's chosen merge-on-change.
function DefaultCalendarSection({ m }: { m?: MarketingState }) {
  const { status, owner, loading } = useGoogle();
  const targets = calendarTargets(status);
  const [val, setVal] = useState<string>(() => resolveDefaultCalendarId());
  const [merge, setMerge] = useState<{ from: string; to: string } | null>(null);
  useEffect(() => { setVal(resolveDefaultCalendarId(owner)); }, [owner, status.connected]);
  const isSet = !!getDefaultCalendarId(owner);
  const current = targets.find((t) => t.id === val);
  const nameOf = (id: string) => targets.find((t) => t.id === id)?.name || id;

  // In-app items currently sitting on the previous default (candidates to move).
  const movable = m && merge ? m.events.filter((e) => isInAppEvent(e) && eventCalendarId(e) === merge.from) : [];

  function choose(id: string) {
    const prev = val;
    setVal(id);
    setDefaultCalendarId(owner, id);
    // Offer to bring existing in-app items along (only if any actually live on
    // the previous calendar). Purely opt-in — nothing moves until confirmed.
    if (m && prev && prev !== id) {
      const has = m.events.some((e) => isInAppEvent(e) && eventCalendarId(e) === prev);
      setMerge(has ? { from: prev, to: id } : null);
    }
  }
  function doMerge() {
    if (!m || !merge) return;
    movable.forEach((e) => m.updateEvent(e.id, { payload: { ...(e.payload || {}), calendarId: merge.to } }));
    setMerge(null);
  }

  return (
    <>
      <div style={lbl}>Default calendar</div>
      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: ft, fontSize: 13, color: D.tx }}>
          <Star size={13} color={isSet ? D.teal : D.amber} fill={isSet ? D.teal : D.amber} />
          {current ? <><span style={{ width: 9, height: 9, borderRadius: 3, background: current.color }} />{current.name}{current.google ? " · Google" : ""}</> : "—"}
        </span>
        <span style={{ flex: 1 }} />
        <select value={val} onChange={(e) => choose(e.target.value)} style={{
          fontFamily: mn, fontSize: 12, color: D.tx, background: D.surface,
          border: `1px solid ${D.border}`, borderRadius: 9, padding: "8px 11px", cursor: "pointer", maxWidth: 240,
        }}>
          {targets.map((t) => <option key={t.id} value={t.id}>{t.name}{t.google ? " · Google" : ""}</option>)}
        </select>
      </div>
      <div style={{ fontSize: 11.5, color: D.txm, marginTop: 8, lineHeight: 1.45 }}>
        New events, content and dated tasks are added here.
        {!loading && !status.connected && " Connect Google Calendar from the Agenda to target a Google calendar."}
      </div>

      {/* Merge-on-change offer (opt-in) */}
      {merge && movable.length > 0 && (
        <div style={{
          marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          border: `1px solid ${D.amber}44`, background: D.amber + "10", borderRadius: 11, padding: "11px 13px",
        }}>
          <span style={{ fontFamily: mn, fontSize: 11.5, color: D.tx, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: D.amber, fontWeight: 700 }}>{movable.length}</span> item{movable.length === 1 ? "" : "s"} on {nameOf(merge.from)}
            <ArrowRight size={12} color={D.txm} /> {nameOf(merge.to)}?
          </span>
          <span style={{ flex: 1 }} />
          <button onClick={doMerge} style={{
            fontFamily: mn, fontSize: 11, fontWeight: 700, cursor: "pointer", borderRadius: 8, padding: "6px 12px",
            border: `1px solid ${D.amber}77`, background: D.amber + "18", color: D.amber,
          }}>Move them here</button>
          <button onClick={() => setMerge(null)} style={{
            fontFamily: mn, fontSize: 11, cursor: "pointer", borderRadius: 8, padding: "6px 11px",
            border: `1px solid ${D.border}`, background: "transparent", color: D.txm,
          }}>Leave</button>
        </div>
      )}
      <div style={{ height: 1, background: D.border, margin: "22px 0 0" }} />
    </>
  );
}

// Calendar status events — Google's working location ("Office"), out-of-office
// and focus-time blocks. Working location recurs daily, so left unchecked it
// carpets every day of the suite; hence OFF by default. The toggle pulls them in
// (on) or purges every mirror row (off), applied live. Legacy rows pulled before
// the hide existed are cleared automatically on suite load (see shell.tsx) — this
// is just the manual control.
function StatusEventsSection({ m }: { m?: MarketingState }) {
  const { status, loading, showStatusEvents, setShowStatusEvents } = useGoogle();
  const [busy, setBusy] = useState(false);

  if (!loading && !status.connected) return null;

  const on = showStatusEvents;
  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    await setShowStatusEvents(!on);
    m?.refresh();
    setBusy(false);
  };

  return (
    <>
      <div style={{ ...lbl, marginTop: 22 }}>Calendar status events</div>
      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: ft, fontSize: 13, color: D.tx }}>Working location, out of office &amp; focus time</div>
          <div style={{ fontSize: 11.5, color: D.txm, marginTop: 3, lineHeight: 1.45 }}>
            Google&apos;s “where I&apos;m working” and status blocks. Off keeps them out of your calendar, timeline and agenda; on shows them everywhere.
          </div>
        </div>
        <button onClick={toggle} disabled={busy} role="switch" aria-checked={on} title={on ? "Hide status events" : "Show status events"} style={{
          flex: "none", width: 46, height: 26, borderRadius: 999, cursor: busy ? "default" : "pointer", position: "relative",
          border: `1px solid ${on ? D.teal : D.border}`, background: on ? D.teal + "33" : D.surface, transition: "all .16s", opacity: busy ? 0.6 : 1,
        }}>
          <span style={{
            position: "absolute", top: 2, left: on ? 22 : 2, width: 20, height: 20, borderRadius: 999,
            background: on ? D.teal : D.txd, transition: "left .16s, background .16s",
          }} />
        </button>
      </div>
      <div style={{ height: 1, background: D.border, margin: "22px 0 0" }} />
    </>
  );
}

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

export default function AppearanceSettings({ open, onClose, m }: { open: boolean; onClose: () => void; m?: MarketingState }) {
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
          {m && <DataModeSection m={m} />}
          <div style={{ marginTop: m ? 22 : 0 }}>
            <DefaultCalendarSection m={m} />
          </div>
          <StatusEventsSection m={m} />
          <div style={{ marginTop: 22 }}>
            <AppearancePanel onReplayTour={() => { onClose(); setTimeout(() => window.dispatchEvent(new Event("poast:replay-tour")), 60); }} />
          </div>
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
