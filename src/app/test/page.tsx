// @ts-nocheck
"use client";
import { useState, useEffect } from "react";

var A = "#F7B041";
var BG = "#06060C";
var ft = "'Outfit',sans-serif";
var mn = "'JetBrains Mono',monospace";

// ═══ USER SELECT (shared) ═══
function UserSelect({ onSelect }) {
  var _h = useState(null), h = _h[0], sh = _h[1];
  return (
    <div style={{ position: "fixed", inset: 0, background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <style dangerouslySetInnerHTML={{ __html: "@keyframes ufi{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}" }} />
      <div style={{ position: "absolute", width: "50vw", height: "50vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(247,176,65,0.03), transparent 60%)" }} />
      <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: A, letterSpacing: 4, marginBottom: 6, animation: "ufi 0.4s ease forwards", opacity: 0 }}>POAST</div>
      <div style={{ fontFamily: mn, fontSize: 10, color: "#444", letterSpacing: 2, marginBottom: 40, animation: "ufi 0.4s ease 0.1s forwards", opacity: 0 }}>SELECT USER</div>
      <div style={{ display: "flex", gap: 20 }}>
        {["Akash", "Vansh"].map(function(name, i) {
          var on = h === i;
          return <div key={name} onClick={function() { onSelect(name); }} onMouseEnter={function() { sh(i); }} onMouseLeave={function() { sh(null); }} style={{ width: 160, padding: "28px 20px", borderRadius: 12, cursor: "pointer", background: on ? "#111118" : "#0A0A14", border: on ? "1px solid " + A + "60" : "1px solid #1A1A28", textAlign: "center", transition: "all 0.15s", boxShadow: on ? "0 0 20px " + A + "15" : "none", animation: "ufi 0.4s ease " + (0.2 + i * 0.1) + "s forwards", opacity: 0 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: on ? A + "20" : "#111118", border: "1px solid " + (on ? A + "40" : "#1A1A28"), display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontFamily: ft, fontSize: 20, fontWeight: 900, color: on ? A : "#555" }}>{name[0]}</div>
            <div style={{ fontFamily: ft, fontSize: 16, fontWeight: 700, color: on ? A : "#E8E4DD" }}>{name}</div>
            <div style={{ fontFamily: mn, fontSize: 9, color: "#444", marginTop: 4 }}>{name === "Akash" ? "Producer" : "Analyst"}</div>
          </div>;
        })}
      </div>
    </div>
  );
}

// ═══ TERMINAL BOOT (shared) ═══
function TerminalBoot({ user, onDone }) {
  var _lines = useState([]), lines = _lines[0], setLines = _lines[1];
  var bootLines = [
    { t: "POAST OS v0.7.2 // SemiAnalysis", c: "#444" },
    { t: "Auth: " + user, c: "#444" }, { t: "  [OK] identity", c: "#2EAD8E" },
    { t: "Loading modules...", c: "#444" },
    { t: "  [OK] content-engine", c: "#2EAD8E" }, { t: "  [OK] social-matrix", c: "#2EAD8E" },
    { t: "  [OK] claude-sonnet-4.brain", c: "#2EAD8E" }, { t: "  [OK] grok-imagine.gpu", c: "#2EAD8E" },
    user === "Vansh" ? { t: "  [ALERT] vansh-just-farted.exe", c: "#E06347" } : { t: "  [WARN] max-charisma-detected", c: A },
    { t: "  [FAIL] sleep-schedule: not found", c: "#E06347" },
    { t: "  [OK] vibes.essential", c: "#2EAD8E" },
    { t: "", c: "#444" }, { t: "Systems nominal. Welcome, " + user + ".", c: A },
  ];
  useEffect(function() {
    var d = 0;
    bootLines.forEach(function(l, i) { d += 50; setTimeout(function() { setLines(function(p) { return p.concat([l]); }); }, d); });
    setTimeout(onDone, d + 400);
  }, []);
  return <div style={{ padding: "30px 40px", fontFamily: mn, fontSize: 11, lineHeight: 1.9 }}>
    <style dangerouslySetInnerHTML={{ __html: "@keyframes cb{0%,100%{opacity:1}50%{opacity:0}}" }} />
    {lines.map(function(l, i) { return <div key={i} style={{ color: l.c }}>{l.t || "\u00A0"}</div>; })}
    <span style={{ display: "inline-block", width: 7, height: 14, background: A, animation: "cb 0.8s step-end infinite" }} />
  </div>;
}

// ═══ GLITCH (shared) ═══
function Glitch({ onDone }) {
  useEffect(function() { setTimeout(onDone, 350); }, []);
  return <div style={{ position: "fixed", inset: 0, zIndex: 20, pointerEvents: "none" }}>
    <style dangerouslySetInnerHTML={{ __html: "@keyframes gShake{0%{transform:translate(0)}25%{transform:translate(-3px,2px)}50%{transform:translate(3px,-2px)}75%{transform:translate(-2px,3px)}100%{transform:translate(0)}}@keyframes gFade{to{opacity:0}}" }} />
    <div style={{ position: "absolute", inset: 0, background: "white", opacity: 0.06, animation: "gFade 0.2s ease forwards" }} />
    <div style={{ position: "absolute", inset: 0, animation: "gShake 0.25s linear" }}>
      {[20, 45, 70, 85].map(function(t, i) { return <div key={i} style={{ position: "absolute", left: 0, right: 0, top: t + "%", height: 2 + Math.random() * 3, background: i % 2 === 0 ? "#ff000030" : "#00ff0030" }} />; })}
    </div>
  </div>;
}

// ═══ VARIANT A: Card Grid (current concept) ═══
function SplashA() {
  var _h = useState(null), h = _h[0], sh = _h[1];
  var cards = [
    { w: "PRODUCE", d: "Create content, scripts, video briefs", items: ["SA Weekly", "Press to Premier", "Capper"], c: A, ic: "\u26A1" },
    { w: "PREPARE", d: "Monitor, plan, strategize", items: ["News Flow", "GTC Flow", "Schedule"], c: "#0B86D1", ic: "\uD83D\uDCE1" },
    { w: "PREMIER", d: "Distribute, launch, ship", items: ["Buffer Queue", "Launch Kit", "Analytics"], c: "#2EAD8E", ic: "\uD83D\uDE80" },
  ];
  return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "40px 6vw" }}>
    <style dangerouslySetInnerHTML={{ __html: "@keyframes sIn{0%{opacity:0;transform:translateY(24px);filter:blur(6px)}100%{opacity:1;transform:translateY(0);filter:blur(0)}}" }} />
    <div style={{ fontFamily: ft, fontSize: 16, fontWeight: 800, color: A, letterSpacing: 6, marginBottom: 6, animation: "sIn 0.4s ease forwards", opacity: 0 }}>POAST</div>
    <div style={{ fontFamily: mn, fontSize: 9, color: "#444", letterSpacing: 3, marginBottom: 50, animation: "sIn 0.4s ease 0.1s forwards", opacity: 0 }}>CONTENT COMMAND CENTER</div>
    <div style={{ display: "flex", gap: "3vw", width: "100%", maxWidth: 1100 }}>
      {cards.map(function(card, ci) {
        var on = h === ci;
        return <div key={ci} onMouseEnter={function() { sh(ci); }} onMouseLeave={function() { sh(null); }} style={{ flex: 1, background: "#0A0A14", border: "1px solid " + (on ? card.c + "50" : "#1A1A28"), borderRadius: 16, padding: "36px 28px", textAlign: "center", cursor: "pointer", transition: "all 0.2s", boxShadow: on ? "0 0 40px " + card.c + "12" : "none", transform: on ? "translateY(-6px)" : "none", animation: "sIn 0.5s ease " + (0.2 + ci * 0.12) + "s forwards", opacity: 0 }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>{card.ic}</div>
          <div style={{ fontFamily: ft, fontSize: "min(4vw, 48px)", fontWeight: 900, color: on ? card.c : "#E8E4DD", transition: "color 0.2s", letterSpacing: "-0.02em" }}>{card.w}</div>
          <div style={{ width: 30, height: 2, background: card.c, margin: "12px auto", opacity: on ? 1 : 0.3, transform: on ? "scaleX(2)" : "scaleX(1)", transition: "all 0.2s" }} />
          <div style={{ fontFamily: ft, fontSize: 12, color: "#6B6878", marginBottom: 16 }}>{card.d}</div>
          {card.items.map(function(it, ii) { return <div key={ii} style={{ fontFamily: ft, fontSize: 11, color: "#555", padding: "4px 0" }}>{it}</div>; })}
        </div>;
      })}
    </div>
    <div style={{ fontFamily: ft, fontSize: 14, color: "#3A3848", marginTop: 40, animation: "sIn 0.4s ease 0.8s forwards", opacity: 0 }}>The content production suite for SemiAnalysis</div>
  </div>;
}

// ═══ VARIANT B: Minimal Full-Width ═══
function SplashB() {
  return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "0 8vw" }}>
    <style dangerouslySetInnerHTML={{ __html: "@keyframes bIn{0%{opacity:0;transform:translateY(20px)}100%{opacity:1;transform:translateY(0)}}@keyframes bLine{0%{transform:scaleX(0)}100%{transform:scaleX(1)}}" }} />
    <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: A, letterSpacing: 5, marginBottom: 60, animation: "bIn 0.5s ease forwards", opacity: 0 }}>POAST</div>

    {/* Three massive words stacked */}
    <div style={{ width: "100%", textAlign: "center" }}>
      {["PRODUCE", "PREPARE", "PREMIER"].map(function(w, i) {
        var colors = [A, "#0B86D1", "#2EAD8E"];
        return <div key={i} style={{ animation: "bIn 0.6s ease " + (0.1 + i * 0.15) + "s forwards", opacity: 0 }}>
          <div style={{ fontFamily: ft, fontSize: "min(12vw, 140px)", fontWeight: 900, color: "#E8E4DD", letterSpacing: "-0.03em", lineHeight: 0.95, position: "relative", display: "inline-block" }}>
            {w}
            <span style={{ position: "absolute", left: -20, top: "50%", transform: "translateY(-50%)", width: 4, height: "60%", background: colors[i], borderRadius: 2 }} />
          </div>
        </div>;
      })}
    </div>

    <div style={{ width: 60, height: 1, background: "linear-gradient(90deg, transparent, " + A + ", transparent)", margin: "40px auto", animation: "bLine 0.6s ease 0.7s forwards", transform: "scaleX(0)", transformOrigin: "center" }} />
    <div style={{ fontFamily: mn, fontSize: 11, color: "#444", letterSpacing: 3, animation: "bIn 0.4s ease 0.9s forwards", opacity: 0 }}>SEMIANALYSIS // CONTENT COMMAND CENTER</div>
  </div>;
}

// ═══ VARIANT C: Dashboard Preview ═══
function SplashC() {
  var sections = [
    { l: "SA Weekly", ic: "\uD83C\uDF99", cat: "PRODUCE", c: A },
    { l: "Press to Premier", ic: "\uD83C\uDFAC", cat: "PRODUCE", c: A },
    { l: "Capper", ic: "\uD83C\uDFAC", cat: "PRODUCE", c: A },
    { l: "News Flow", ic: "\uD83D\uDCE1", cat: "PREPARE", c: "#0B86D1" },
    { l: "GTC Flow", ic: "\uD83D\uDCCA", cat: "PREPARE", c: "#0B86D1" },
    { l: "Schedule", ic: "\uD83D\uDCC6", cat: "PREMIER", c: "#2EAD8E" },
  ];
  return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "40px 6vw" }}>
    <style dangerouslySetInnerHTML={{ __html: "@keyframes cIn{0%{opacity:0;transform:scale(0.95)}100%{opacity:1;transform:scale(1)}}" }} />

    {/* Hero */}
    <div style={{ textAlign: "center", marginBottom: 50 }}>
      <div style={{ fontFamily: ft, fontSize: "min(8vw, 80px)", fontWeight: 900, color: "#E8E4DD", letterSpacing: "-0.02em", animation: "cIn 0.6s ease forwards", opacity: 0 }}>
        <span style={{ color: A }}>P</span>OAST
      </div>
      <div style={{ display: "flex", gap: 24, justifyContent: "center", marginTop: 12 }}>
        {["PRODUCE", "PREPARE", "PREMIER"].map(function(w, i) {
          var colors = [A, "#0B86D1", "#2EAD8E"];
          return <span key={i} style={{ fontFamily: mn, fontSize: 11, color: colors[i], letterSpacing: 3, animation: "cIn 0.4s ease " + (0.2 + i * 0.1) + "s forwards", opacity: 0 }}>{w}</span>;
        })}
      </div>
    </div>

    {/* Grid of section cards */}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, width: "100%", maxWidth: 800 }}>
      {sections.map(function(s, i) {
        return <div key={i} style={{ background: "#0A0A14", border: "1px solid #1A1A28", borderLeft: "3px solid " + s.c, borderRadius: 10, padding: "18px 16px", cursor: "pointer", transition: "all 0.15s", animation: "cIn 0.4s ease " + (0.3 + i * 0.06) + "s forwards", opacity: 0 }} onMouseEnter={function(e) { e.currentTarget.style.borderColor = s.c + "50"; e.currentTarget.style.background = "#0E0E1A"; }} onMouseLeave={function(e) { e.currentTarget.style.borderColor = "#1A1A28"; e.currentTarget.style.background = "#0A0A14"; }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>{s.ic}</span>
            <div>
              <div style={{ fontFamily: ft, fontSize: 13, fontWeight: 700, color: "#E8E4DD" }}>{s.l}</div>
              <div style={{ fontFamily: mn, fontSize: 8, color: s.c }}>{s.cat}</div>
            </div>
          </div>
        </div>;
      })}
    </div>

    <div style={{ fontFamily: mn, fontSize: 10, color: "#333", marginTop: 30, animation: "cIn 0.4s ease 0.8s forwards", opacity: 0 }}>Click any section to begin // Ask Poast available everywhere</div>
  </div>;
}

// ═══ MAIN TEST PAGE ═══
export default function TestPage() {
  // TODO(akash): centralize this prod-guard into a shared <DevOnly/> wrapper or middleware-level redirect.
  if (typeof process !== "undefined" && process.env.NODE_ENV === "production") {
    return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#06060C",color:"#4A4858",fontFamily:"'Outfit',sans-serif"}}>404</div>;
  }
  var _phase = useState("select"), phase = _phase[0], setPhase = _phase[1];
  var _user = useState(null), user = _user[0], setUser = _user[1];
  var _variant = useState("A"), variant = _variant[0], setVariant = _variant[1];
  var _glitching = useState(false), glitching = _glitching[0], setGlitching = _glitching[1];
  var _k = useState(0), k = _k[0], sk = _k[1];

  var pick = function(name) { setUser(name); setPhase("boot"); };
  var bootDone = function() { setGlitching(true); setTimeout(function() { setGlitching(false); setPhase("splash"); }, 350); };
  var replay = function() { setPhase("select"); setUser(null); sk(k + 1); };

  return <div key={k} style={{ background: BG, minHeight: "100vh", position: "relative" }}>
    <style dangerouslySetInnerHTML={{ __html: "@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');" }} />

    {phase === "select" && <UserSelect onSelect={pick} />}
    {phase === "boot" && <div style={{ position: "fixed", inset: 0, background: BG }}><TerminalBoot user={user} onDone={bootDone} /></div>}
    {glitching && <Glitch onDone={function() {}} />}

    {phase === "splash" && <div>
      {/* Variant selector */}
      <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 100, display: "flex", gap: 6, padding: "6px 10px", background: "#111118", border: "1px solid #1A1A28", borderRadius: 8 }}>
        {["A", "B", "C"].map(function(v) {
          var on = variant === v;
          return <span key={v} onClick={function() { setVariant(v); }} style={{ padding: "4px 14px", borderRadius: 5, cursor: "pointer", background: on ? A : "transparent", color: on ? BG : "#6B6878", fontFamily: mn, fontSize: 11, fontWeight: on ? 700 : 400, transition: "all 0.15s" }}>Variant {v}</span>;
        })}
        <span onClick={replay} style={{ padding: "4px 14px", borderRadius: 5, cursor: "pointer", border: "1px solid #1A1A28", color: "#6B6878", fontFamily: mn, fontSize: 11, marginLeft: 8 }}>Replay</span>
      </div>

      {variant === "A" && <SplashA />}
      {variant === "B" && <SplashB />}
      {variant === "C" && <SplashC />}
    </div>}
  </div>;
}
