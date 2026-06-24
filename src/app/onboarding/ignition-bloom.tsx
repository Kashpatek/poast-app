"use client";

import { useEffect, useRef, useState } from "react";
import { ft, gf, mn } from "../shared-constants";

// ─── Ignition Bloom — the first-run welcome reveal ───────────────────────────
// A faithful React port of ~/poast-welcome-3.0/welcomeonboarding (concept
// onboard-test-b.html). A timeline state machine drives phase flags
// (booting → lit → dawned/hero → sweep → collapse → greet → typewriter → prefs);
// CSS keyframes + transitions render most layers, while the three center layers
// (bloom / aurora / rays) are driven imperatively via the Web Animations API for
// the one-shot ignition. Respects prefers-reduced-motion (snaps to the end), and
// audio (if any) is best-effort. "Let's go" hands the (possibly edited) name back.

// SemiAnalysis palette (verbatim from the mockup reveal :root).
const AMBER = "#F7B041";
const COBALT = "#0B86D1";
const MINT = "#2EAD8E";
const CORAL = "#E06347";
const NAME_ACCENT = "#56C0F0"; // light cobalt — the greeting name color

const CSS = `
@keyframes ibAuraSpin { to { transform: translate(-50%,-50%) rotate(360deg); } }
@keyframes ibAuraSpinR { to { transform: translate(-50%,-50%) rotate(-360deg); } }
@keyframes ibAuraPulse { 0%,100% { filter: blur(52px) saturate(1.55); } 50% { filter: blur(38px) saturate(2.05); } }
@keyframes ibScanBeam { 0% { top: -32%; } 100% { top: 100%; } }
@keyframes ibBootFlick { 0%,100% { opacity: .85; } 50% { opacity: .35; } }
@keyframes ibBoom { 0% { opacity: 0; } 16% { opacity: .6; } 100% { opacity: 0; } }
@keyframes ibBoomPop { 0% { transform: scale(.96); } 55% { transform: scale(1.015); } 100% { transform: scale(1); } }
@keyframes ibSweep { 0% { background-position: 120% 0; opacity: 0; } 12% { opacity: 1; } 100% { background-position: -60% 0; opacity: 0; } }
@keyframes ibCaret { 0%,49% { opacity: 1; } 50%,100% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .ib-auraloop, .ib-tech-beam, .ib-boot-txt { animation: none !important; }
}
`;

const LETTERS = ["P", "O", "A", "S", "T"];

export default function IgnitionBloom({
  name,
  returning,
  onLetsGo,
}: {
  name: string;
  returning?: boolean;
  onLetsGo: (typedName: string) => void;
}) {
  // Phase flags (mirror the .stage classes). Driven by the timeline below.
  const [booting, setBooting] = useState(true);
  const [lit, setLit] = useState(false);
  const [dawned, setDawned] = useState(false);
  const [showEyebrow, setShowEyebrow] = useState(false);
  const [showPoast, setShowPoast] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [greetPhase, setGreetPhase] = useState(false);
  const [heroGone, setHeroGone] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [typingDone, setTypingDone] = useState(false);
  const [showSub, setShowSub] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [nameInput, setNameInput] = useState(name);
  const [entering, setEntering] = useState(false);

  const bloomRef = useRef<HTMLDivElement | null>(null);
  const auroraRef = useRef<HTMLDivElement | null>(null);
  const raysRef = useRef<HTMLDivElement | null>(null);
  const timers = useRef<number[]>([]);

  const greetLead = returning ? "Welcome back," : "Welcome,";

  // ── Timeline ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const reduce =
      typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      // Snap to the end state — greeting fully shown, no animation.
      setBooting(false); setLit(true); setDawned(true); setShowEyebrow(true);
      setShowPoast(true); setHeroGone(true); setGreetPhase(true);
      setTypedName(name); setTypingDone(true); setShowSub(true); setShowPrefs(true);
      return;
    }

    const at = (ms: number, fn: () => void) => {
      timers.current.push(window.setTimeout(fn, ms));
    };

    // t0 boot → t950 ignition
    at(950, () => {
      setBooting(false);
      setLit(true);
      // Fire the three center layers via WAAPI (one-shot ignition).
      const ease = "cubic-bezier(.18,.7,.25,1)";
      bloomRef.current?.animate(
        [
          { opacity: 0, transform: "translate(-50%,-50%) scale(.18)", filter: "blur(2px)" },
          { opacity: 1, transform: "translate(-50%,-50%) scale(.55)", filter: "blur(6px)", offset: 0.18 },
          { opacity: 0.85, transform: "translate(-50%,-50%) scale(1)", filter: "blur(10px)", offset: 0.5 },
          { opacity: 0.45, transform: "translate(-50%,-50%) scale(1.5)", filter: "blur(16px)" },
        ],
        { duration: 1500, easing: ease, fill: "forwards" }
      );
      auroraRef.current?.animate(
        [
          { opacity: 0, transform: "translate(-50%,-50%) scale(.4) rotate(0deg)" },
          { opacity: 0.9, transform: "translate(-50%,-50%) scale(1) rotate(16deg)", offset: 0.4 },
          { opacity: 0.7, transform: "translate(-50%,-50%) scale(1.18) rotate(34deg)" },
        ],
        { duration: 2600, easing: "ease-out", fill: "forwards" }
      );
      raysRef.current?.animate(
        [
          { opacity: 0, transform: "translate(-50%,-50%) rotate(-8deg) scale(.4)" },
          { opacity: 0.5, transform: "translate(-50%,-50%) rotate(4deg) scale(.85)", offset: 0.35 },
          { opacity: 0, transform: "translate(-50%,-50%) rotate(14deg) scale(1.25)" },
        ],
        { duration: 1900, easing: "ease-out", fill: "forwards" }
      );
    });

    // t1310 dawned + hero, eyebrow
    at(1310, () => { setDawned(true); setShowEyebrow(true); });
    // t1730 POAST letters
    at(1730, () => setShowPoast(true));
    // t2470 chromatic sweep
    at(2470, () => setSweeping(true));
    // t3520 sweep end + hold to t4340
    at(3520, () => setSweeping(false));
    // t4340 collapse the hero toward the greeting
    at(4340, () => setCollapsed(true));
    // t5060 greet-phase
    at(5060, () => setGreetPhase(true));
    // t5320 hide hero, begin typewriter
    at(5320, () => {
      setHeroGone(true);
      typeName(name);
    });

    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Typewriter for the greeting name, then reveal sub + prefs.
  function typeName(full: string) {
    let i = 0;
    const step = () => {
      i += 1;
      setTypedName(full.slice(0, i));
      if (i < full.length) {
        timers.current.push(window.setTimeout(step, 70 + Math.random() * 55));
      } else {
        timers.current.push(window.setTimeout(() => {
          setTypingDone(true);
          timers.current.push(window.setTimeout(() => setShowSub(true), 120));
          timers.current.push(window.setTimeout(() => setShowPrefs(true), 340));
        }, 280));
      }
    };
    if (full.length === 0) {
      setTypingDone(true); setShowSub(true); setShowPrefs(true); return;
    }
    timers.current.push(window.setTimeout(step, 60));
  }

  // Live name edit (only after typing completes, like the mockup).
  const displayName = typingDone ? (nameInput.trim() || name) : typedName;

  function letsGo() {
    if (entering) return;
    setEntering(true);
    const typed = (nameInput || "").trim() || name;
    window.setTimeout(() => onLetsGo(typed), 220);
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999, overflow: "hidden",
        background: "#000", color: "#EDE9E2", fontFamily: ft,
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* base field */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(60% 50% at 50% 42%, rgba(20,16,30,.9), #06060C 78%)", opacity: lit ? 1 : 0, transition: "opacity 1.2s ease" }} />

      {/* two permanent aura loops (lit once dawned) */}
      <div className="ib-auraloop" style={{ position: "absolute", left: "50%", top: "50%", width: "150vmax", height: "150vmax", transform: "translate(-50%,-50%)", borderRadius: "50%", mixBlendMode: "screen", opacity: dawned ? (greetPhase ? 1 : 0.9) : 0, transition: "opacity 1.2s ease", background: `conic-gradient(from 0deg, ${AMBER}, ${COBALT}, ${MINT}, ${CORAL}, ${AMBER})`, filter: "blur(50px) saturate(1.7)", animation: "ibAuraSpin 20s linear infinite, ibAuraPulse 7s ease-in-out infinite" }} />
      <div className="ib-auraloop" style={{ position: "absolute", left: "50%", top: "50%", width: "126vmax", height: "126vmax", transform: "translate(-50%,-50%)", borderRadius: "50%", mixBlendMode: "screen", opacity: dawned ? (greetPhase ? 0.95 : 0.8) : 0, transition: "opacity 1.2s ease", background: `conic-gradient(from 90deg, ${COBALT}, ${MINT}, ${CORAL}, ${AMBER}, ${COBALT})`, filter: "blur(70px) saturate(1.75)", animation: "ibAuraSpinR 31s linear infinite" }} />

      {/* horizon dawn glow */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "44%", background: `radial-gradient(120% 100% at 50% 100%, ${COBALT}22, transparent 70%)`, opacity: dawned ? 1 : 0, transition: "opacity 1s ease" }} />

      {/* center ignition layers (WAAPI) */}
      <div ref={bloomRef} style={{ position: "absolute", left: "50%", top: "50%", width: "60vmax", height: "60vmax", transform: "translate(-50%,-50%) scale(.18)", borderRadius: "50%", opacity: 0, background: `radial-gradient(circle, rgba(255,251,242,.98), ${AMBER} 26%, ${COBALT} 52%, ${MINT} 70%, transparent 78%)`, mixBlendMode: "screen", pointerEvents: "none" }} />
      <div ref={auroraRef} style={{ position: "absolute", left: "50%", top: "50%", width: "120vmax", height: "120vmax", transform: "translate(-50%,-50%) scale(.4)", borderRadius: "50%", opacity: 0, background: `conic-gradient(from 0deg, ${AMBER}, ${COBALT}, ${MINT}, ${CORAL}, ${COBALT}, ${AMBER})`, filter: "blur(60px)", mixBlendMode: "screen", pointerEvents: "none" }} />
      <div ref={raysRef} style={{ position: "absolute", left: "50%", top: "50%", width: "120vmax", height: "120vmax", transform: "translate(-50%,-50%) scale(.4)", borderRadius: "50%", opacity: 0, background: "repeating-conic-gradient(rgba(255,255,255,.5) 0deg 2deg, transparent 2deg 10deg)", WebkitMaskImage: "radial-gradient(#000 0%, transparent 42%)", maskImage: "radial-gradient(#000 0%, transparent 42%)", mixBlendMode: "screen", pointerEvents: "none" }} />

      {/* boot tech layer */}
      <div style={{ position: "absolute", inset: 0, opacity: booting ? 0.92 : 0, filter: booting ? "none" : "blur(16px)", transition: "opacity 1s ease, filter 1s ease", background: `linear-gradient(${COBALT}1f 1px, transparent 1px) 0 0/40px 40px, linear-gradient(90deg, ${COBALT}1f 1px, transparent 1px) 0 0/40px 40px, radial-gradient(60% 50% at 50% 45%, ${COBALT}22, transparent 70%)`, WebkitMaskImage: "radial-gradient(120% 100% at 50% 45%, #000 40%, transparent 85%)", maskImage: "radial-gradient(120% 100% at 50% 45%, #000 40%, transparent 85%)", pointerEvents: "none" }}>
        <div className="ib-tech-beam" style={{ position: "absolute", left: 0, right: 0, height: "32%", background: `linear-gradient(180deg, transparent, ${MINT}2e, transparent)`, animation: "ibScanBeam 2.4s linear infinite" }} />
      </div>
      <div className="ib-boot-txt" style={{ position: "absolute", left: "50%", top: "calc(50% + 120px)", transform: "translateX(-50%)", fontFamily: mn, fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", color: "#9aa3b2", opacity: booting ? 1 : 0, transition: "opacity .5s ease", animation: booting ? "ibBootFlick 1.05s steps(1) infinite" : "none" }}>
        POAST 3.0 · initializing
      </div>

      {/* focus scrim behind greeting */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(50% 40% at 50% 50%, rgba(6,5,12,.6), transparent 70%)", opacity: greetPhase ? 1 : 0, transition: "opacity 1s ease", pointerEvents: "none" }} />
      {/* boom flash on greet land */}
      {greetPhase && <div style={{ position: "absolute", inset: 0, background: `radial-gradient(50% 40% at 50% 50%, ${AMBER}55, transparent 70%)`, animation: "ibBoom .85s ease-out", pointerEvents: "none" }} />}

      {/* HERO — eyebrow + giant POAST */}
      {!heroGone && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: collapsed ? 0 : 1, transform: collapsed ? "scale(.18)" : "scale(1)", transition: "opacity .7s ease, transform 1.05s cubic-bezier(.55,.06,.2,1)", zIndex: 4 }}>
          <div style={{ fontFamily: mn, fontSize: 13, letterSpacing: "0.5em", textTransform: "uppercase", color: "#8A8690", marginBottom: 26, opacity: showEyebrow ? 1 : 0, transform: showEyebrow ? "translateY(0)" : "translateY(10px)", transition: "opacity .7s ease, transform .7s cubic-bezier(.2,.7,.3,1)" }}>
            Welcome to
          </div>
          <div style={{ display: "flex", width: "92vw", maxWidth: 1500, justifyContent: "space-between", position: "relative" }}>
            {LETTERS.map((ch, i) => (
              <span key={i} style={{ fontFamily: gf, fontWeight: 800, fontSize: "clamp(80px, 21.5vw, 340px)", lineHeight: 0.9, letterSpacing: "-0.02em", background: "linear-gradient(180deg, #FFFDF8, #F3ECE0 48%, #C9B89C)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", filter: `drop-shadow(0 0 40px ${AMBER}47) drop-shadow(0 0 14px rgba(255,250,240,.25))`, opacity: showPoast ? 1 : 0, transform: showPoast ? "translateY(0) scale(1)" : "translateY(34px) scale(.92)", transition: `opacity .9s cubic-bezier(.2,.7,.3,1) ${i * 0.06}s, transform 1s cubic-bezier(.2,.7,.3,1) ${i * 0.06}s` }}>
                {ch}
              </span>
            ))}
            {/* chromatic sweep band */}
            {sweeping && <div style={{ position: "absolute", inset: 0, background: `linear-gradient(105deg, transparent 30%, ${CORAL}73 44%, rgba(255,255,255,.95) 50%, ${"#905CCB"}73 56%, transparent 70%)`, backgroundSize: "220% 100%", mixBlendMode: "screen", filter: "blur(1px)", WebkitBackgroundClip: "text", animation: "ibSweep 1.05s cubic-bezier(.35,.1,.25,1) forwards", pointerEvents: "none" }} />}
          </div>
        </div>
      )}

      {/* GREETING + prefs */}
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 24px", opacity: greetPhase ? 1 : 0, transition: "opacity .5s ease .05s", zIndex: 4, pointerEvents: greetPhase ? "auto" : "none" }}>
        <div style={{ fontFamily: gf, fontWeight: 600, fontSize: "clamp(40px, 7vw, 86px)", letterSpacing: "-0.02em", color: "#FBF7EF", lineHeight: 1.05, animation: greetPhase ? "ibBoomPop .7s cubic-bezier(.2,.9,.3,1)" : "none" }}>
          <span>{displayName ? greetLead : greetLead.replace(",", "")}</span>{" "}
          {displayName && (
            <span style={{ color: NAME_ACCENT, fontWeight: 700, textShadow: `0 0 26px ${COBALT}8c` }}>
              {displayName}
              {!typingDone && <span style={{ display: "inline-block", width: "0.06em", height: "0.9em", marginLeft: "0.04em", background: NAME_ACCENT, boxShadow: `0 0 10px ${COBALT}b3`, verticalAlign: "-0.06em", animation: "ibCaret 1.05s steps(1) infinite" }} />}
            </span>
          )}
        </div>

        <div style={{ marginTop: 18, fontFamily: ft, fontWeight: 300, fontSize: "clamp(15px, 1.6vw, 19px)", color: "rgba(244,239,231,.84)", opacity: showSub ? 1 : 0, transform: showSub ? "translateY(0)" : "translateY(8px)", transition: "opacity .6s ease, transform .6s cubic-bezier(.2,.7,.3,1)" }}>
          POAST 3.0 — your content ops, reimagined.
        </div>

        <div style={{ marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, opacity: showPrefs ? 1 : 0, transform: showPrefs ? "translateY(0)" : "translateY(10px)", transition: "opacity .6s ease, transform .6s cubic-bezier(.2,.7,.3,1)", pointerEvents: showPrefs ? "auto" : "none" }}>
          <span style={{ fontFamily: mn, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "#8A8690" }}>What should we call you?</span>
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") letsGo(); }}
            placeholder="Your name"
            style={{ width: 240, padding: "12px 16px", textAlign: "center", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 12, color: "#FBF7EF", fontFamily: gf, fontSize: 17, fontWeight: 600, outline: "none" }}
          />
          <button
            onClick={letsGo}
            style={{ marginTop: 4, display: "inline-flex", alignItems: "center", gap: 9, padding: "13px 26px", borderRadius: 14, border: "none", cursor: "pointer", color: "#04121C", fontFamily: gf, fontWeight: 700, fontSize: 16, background: `linear-gradient(135deg, #34A6E6, ${COBALT})`, boxShadow: `0 8px 26px ${COBALT}6b, inset 0 1px 0 rgba(255,255,255,.34)` }}
          >
            {entering ? "Entering…" : "Let's go"} {!entering && <span>→</span>}
          </button>
        </div>
      </div>

      {/* version chip */}
      <div style={{ position: "absolute", left: "50%", bottom: 22, transform: "translateX(-50%)", fontFamily: mn, fontSize: 10, letterSpacing: "0.26em", textTransform: "uppercase", color: "#4E4B56", opacity: dawned && !greetPhase ? 1 : 0, transition: "opacity .8s ease" }}>
        POAST · 3.0
      </div>

      {/* vignette + grain (static) */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 120% at 50% 40%, transparent 55%, rgba(0,0,0,.6))", pointerEvents: "none" }} />
    </div>
  );
}
