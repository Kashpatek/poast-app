// @ts-nocheck
"use client";
import { useState } from "react";

var A = "#F7B041";
var BG = "#06060C";
var ft = "'Outfit',sans-serif";
var mn = "'JetBrains Mono',monospace";

var CATS = {
  produce: { label: "PRODUCE", color: "#F7B041", glow: "rgba(247,176,65,", items: [
    { id: "weekly", l: "SA Weekly", ic: "\uD83C\uDF99" },
    { id: "p2p", l: "Press to Premier", ic: "\uD83C\uDFAC" },
    { id: "captions", l: "Capper", ic: "\uD83C\uDFAC" },
  ]},
  prepare: { label: "PREPARE", color: "#0B86D1", glow: "rgba(11,134,209,", items: [
    { id: "news", l: "News Flow", ic: "\uD83D\uDCE1" },
    { id: "gtc", l: "GTC Flow", ic: "\uD83D\uDCCA" },
  ]},
  premier: { label: "PREMIER", color: "#2EAD8E", glow: "rgba(46,173,142,", items: [
    { id: "schedule", l: "Schedule", ic: "\uD83D\uDCC6" },
    { id: "launch", l: "Launch Kit", ic: "\uD83D\uDE80" },
  ]},
};

// ═══ SIDEBAR ═══
function Sidebar({ active, onNav, activeCategory }) {
  var _expanded = useState({ produce: true, prepare: true, premier: true });
  var expanded = _expanded[0]; var setExpanded = _expanded[1];
  var toggleCat = function(cat) { setExpanded(function(p) { var n = Object.assign({}, p); n[cat] = !n[cat]; return n; }); };

  return (
    <div style={{ width: 230, minHeight: "100vh", background: "linear-gradient(180deg, #08080F 0%, #0A0A14 100%)", borderRight: "1px solid #1A1A28", display: "flex", flexDirection: "column", position: "fixed", left: 0, top: 0, zIndex: 100 }}>
      {/* Logo */}
      <div style={{ padding: "24px 20px 18px", borderBottom: "1px solid #1A1A28" }}>
        <div style={{ fontFamily: ft, fontSize: 22, fontWeight: 900, color: A, letterSpacing: 2 }}>POAST</div>
        <div style={{ fontFamily: mn, fontSize: 8, color: "#3A3848", letterSpacing: 2, marginTop: 3, textTransform: "uppercase" }}>Content Command Center</div>
      </div>

      {/* Ask Poast */}
      <div style={{ padding: "14px 14px 0" }}>
        <div onClick={function() { onNav("askpoast"); }} style={{ padding: "12px 14px", borderRadius: 10, cursor: "pointer", background: active === "askpoast" ? "linear-gradient(135deg, " + A + "18, " + A + "08)" : "linear-gradient(135deg, #0E0E18, #0C0C16)", border: active === "askpoast" ? "1px solid " + A + "40" : "1px solid #1E1E2E", display: "flex", alignItems: "center", gap: 10, transition: "all 0.2s", boxShadow: active === "askpoast" ? "0 0 20px " + A + "15" : "none" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: A + "20", border: "1px solid " + A + "35", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: ft, fontSize: 15, fontWeight: 900, color: A, boxShadow: "0 0 12px " + A + "15" }}>P</div>
          <div>
            <div style={{ fontFamily: ft, fontSize: 13, fontWeight: 700, color: active === "askpoast" ? A : "#E8E4DD" }}>Ask Poast</div>
            <div style={{ fontFamily: mn, fontSize: 8, color: "#4A4858" }}>AI Assistant</div>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div style={{ padding: "10px 10px", flex: 1, overflow: "auto" }}>
        {Object.keys(CATS).map(function(catKey) {
          var cat = CATS[catKey];
          var isActiveCat = activeCategory === catKey;
          var isExpanded = expanded[catKey];

          return <div key={catKey} style={{ marginBottom: 6 }}>
            {/* Category header */}
            <div onClick={function() { toggleCat(catKey); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", cursor: "pointer", borderRadius: 8, transition: "all 0.2s", background: isActiveCat ? cat.color + "06" : "transparent" }} onMouseEnter={function(e) { if (!isActiveCat) e.currentTarget.style.background = "#0E0E18"; }} onMouseLeave={function(e) { if (!isActiveCat) e.currentTarget.style.background = "transparent"; }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 4, height: 18, borderRadius: 2, background: isActiveCat ? cat.color : "#2A2A3A", boxShadow: isActiveCat ? "0 0 10px " + cat.color + "60, 0 0 20px " + cat.color + "20" : "none", transition: "all 0.25s" }} />
                <span style={{ fontFamily: ft, fontSize: 13, fontWeight: 800, color: isActiveCat ? cat.color : "#666", letterSpacing: 1.5, textTransform: "uppercase", transition: "all 0.25s", textShadow: isActiveCat ? "0 0 16px " + cat.glow + "0.4), 0 0 30px " + cat.glow + "0.15)" : "none" }}>{cat.label}</span>
              </div>
              <span style={{ fontFamily: mn, fontSize: 9, color: "#3A3848", transition: "transform 0.2s", transform: isExpanded ? "rotate(0)" : "rotate(-90deg)" }}>{"\u25BE"}</span>
            </div>

            {/* Section items */}
            <div style={{ overflow: "hidden", maxHeight: isExpanded ? 250 : 0, opacity: isExpanded ? 1 : 0, transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)" }}>
              {cat.items.map(function(item) {
                var isActive = active === item.id;
                return <div key={item.id} onClick={function() { onNav(item.id); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px 10px 28px", borderRadius: 8, marginBottom: 3, cursor: "pointer", background: isActive ? cat.color + "0C" : "transparent", borderLeft: isActive ? "3px solid " + cat.color : "3px solid transparent", transition: "all 0.2s", position: "relative" }} onMouseEnter={function(e) { if (!isActive) { e.currentTarget.style.background = "#0E0E18"; e.currentTarget.style.paddingLeft = "32px"; } }} onMouseLeave={function(e) { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.paddingLeft = "28px"; } }}>
                  {/* Active glow bar */}
                  {isActive && <div style={{ position: "absolute", left: 0, top: "10%", width: 3, height: "80%", background: cat.color, borderRadius: 2, boxShadow: "0 0 12px " + cat.color + "70, 0 0 24px " + cat.color + "25" }} />}
                  {/* Active background aura */}
                  {isActive && <div style={{ position: "absolute", left: 0, top: 0, width: "50%", height: "100%", background: "radial-gradient(ellipse at left center, " + cat.color + "10, transparent 70%)", pointerEvents: "none" }} />}
                  <span style={{ fontSize: 16, filter: isActive ? "brightness(1.3) saturate(1.2)" : "brightness(0.6) saturate(0.5)", transition: "filter 0.2s" }}>{item.ic}</span>
                  <span style={{ fontFamily: ft, fontSize: 14, fontWeight: isActive ? 800 : 500, color: isActive ? cat.color : "#7A7688", transition: "all 0.2s", textShadow: isActive ? "0 0 20px " + cat.glow + "0.5), 0 0 40px " + cat.glow + "0.15)" : "none", letterSpacing: isActive ? 0.3 : 0 }}>{item.l}</span>
                  {isActive && <div style={{ width: 6, height: 6, borderRadius: "50%", background: cat.color, marginLeft: "auto", boxShadow: "0 0 8px " + cat.color + "70, 0 0 16px " + cat.color + "30" }} />}
                </div>;
              })}
            </div>
          </div>;
        })}
      </div>

      {/* Footer */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid #1A1A28" }}>
        <div style={{ fontFamily: mn, fontSize: 8, color: "#333", letterSpacing: 1 }}>v0.7 // SemiAnalysis</div>
      </div>
    </div>
  );
}

// ═══ MOCK SA WEEKLY CONTENT ═══
function MockSAWeekly() {
  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, padding: "16px 0", borderBottom: "1px solid #1E1E2E" }}>
      <div>
        <div style={{ fontFamily: ft, fontSize: 20, fontWeight: 800, color: "#E8E4DD", letterSpacing: -0.5 }}>SemiAnalysis Weekly</div>
        <div style={{ fontFamily: mn, fontSize: 9, color: "#6B6878", marginTop: 2 }}>Ep #009 . Dylan Patel . In Progress</div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <span className="pill pill-amber">Draft</span>
        <button className="glow-btn btn-ghost" style={{ padding: "6px 12px", fontSize: 11 }}>Load from Draft</button>
      </div>
    </div>
    {/* Tabs */}
    <div style={{ display: "flex", borderBottom: "1px solid #1E1E2E", marginBottom: 24 }}>
      {["Episode Setup", "Test Page", "Launch Rollout", "Clip Manager", "Activity Log"].map(function(t, i) {
        return <div key={i} className={"tab-item" + (i === 0 ? " tab-active" : "")}>{t}</div>;
      })}
    </div>
    {/* Form */}
    <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 14, marginBottom: 20 }}>
      <div><div style={{ fontFamily: mn, fontSize: 9, color: "#6B6878", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Episode #</div><input className="input-dark" value="009" readOnly style={{ fontFamily: mn }} /></div>
      <div><div style={{ fontFamily: mn, fontSize: 9, color: "#6B6878", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>YouTube Link</div><input className="input-dark" placeholder="https://youtube.com/watch?v=..." /></div>
    </div>
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontFamily: mn, fontSize: 9, color: "#6B6878", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Full Transcript</div>
      <div className="card-glow" style={{ padding: 0 }} onMouseMove={function(e) { var r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 100) + "%"); e.currentTarget.style.setProperty("--my", ((e.clientY - r.top) / r.height * 100) + "%"); }}>
        <textarea className="input-dark" rows={6} placeholder="Drop .txt or paste transcript" style={{ border: "none", background: "transparent", resize: "vertical" }} />
      </div>
    </div>
    <div style={{ display: "flex", gap: 10 }}>
      <button className="glow-btn btn-primary">Generate Options</button>
      <span style={{ fontFamily: mn, fontSize: 10, color: "#4A4858", alignSelf: "center" }}>Paste or upload a transcript first</span>
    </div>
  </div>;
}

// ═══ MOCK NEWS FLOW ═══
function MockNewsFlow() {
  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
      <div><div style={{ fontFamily: ft, fontSize: 20, fontWeight: 800, color: "#E8E4DD" }}>News Flow</div><div style={{ fontFamily: mn, fontSize: 9, color: "#6B6878" }}>Live feeds, stocks, streams, ideas.</div></div>
      <div style={{ display: "flex", gap: 6 }}><button className="glow-btn btn-secondary" style={{ padding: "6px 12px", fontSize: 11 }}>+ Add Widget</button><button className="glow-btn btn-ghost" style={{ padding: "6px 10px", fontSize: 13 }}>{"\u2699"}</button></div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
      <div className="card-glow" style={{ padding: 16 }} onMouseMove={function(e) { var r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 100) + "%"); e.currentTarget.style.setProperty("--my", ((e.clientY - r.top) / r.height * 100) + "%"); }}>
        <div style={{ fontFamily: ft, fontSize: 12, fontWeight: 700, color: "#E8E4DD", marginBottom: 10 }}>{"\uD83D\uDCF0"} News Feed</div>
        {["NVIDIA reportedly in talks for $40B custom chip deal with Saudi Arabia", "TSMC Arizona Fab 2 begins equipment install, ahead of schedule", "AMD MI355X benchmarks leak: 2.3x inference throughput vs MI300X"].map(function(t, i) {
          return <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid #1E1E2E", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontFamily: ft, fontSize: 12, color: "#E8E4DD", flex: 1 }}>{t}</div>
            <button className="glow-btn btn-ghost" style={{ padding: "2px 8px", fontSize: 9 }}>Draft</button>
          </div>;
        })}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="card-base" style={{ padding: 14 }}>
          <div style={{ fontFamily: ft, fontSize: 12, fontWeight: 700, color: "#E8E4DD", marginBottom: 8 }}>{"\uD83D\uDCC8"} Stocks</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {[{ s: "NVDA", p: "$142.50", c: "+2.4%", up: true }, { s: "AMD", p: "$118.30", c: "-0.8%", up: false }, { s: "TSM", p: "$186.20", c: "+1.1%", up: true }, { s: "ASML", p: "$892.40", c: "+0.6%", up: true }].map(function(s, i) {
              return <div key={i} style={{ padding: "6px 8px", borderRadius: 5, background: s.up ? "rgba(46,173,142,0.08)" : "rgba(224,99,71,0.08)", border: "1px solid " + (s.up ? "rgba(46,173,142,0.18)" : "rgba(224,99,71,0.18)") }}>
                <div style={{ fontFamily: mn, fontSize: 9, fontWeight: 700, color: "#E8E4DD" }}>{s.s}</div>
                <div style={{ fontFamily: mn, fontSize: 11, fontWeight: 700, color: "#E8E4DD" }}>{s.p}</div>
                <div style={{ fontFamily: mn, fontSize: 9, color: s.up ? "#2EAD8E" : "#E06347" }}>{s.c}</div>
              </div>;
            })}
          </div>
        </div>
        <div className="card-base" style={{ padding: 14 }}>
          <div style={{ fontFamily: ft, fontSize: 12, fontWeight: 700, color: "#E8E4DD", marginBottom: 6 }}>{"\uD83C\uDF45"} Pomodoro</div>
          <div style={{ fontFamily: mn, fontSize: 28, fontWeight: 900, color: "#E8E4DD", textAlign: "center" }}>24:38</div>
        </div>
      </div>
    </div>
  </div>;
}

// ═══ MOCK SCHEDULE ═══
function MockSchedule() {
  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
      <div><div style={{ fontFamily: ft, fontSize: 20, fontWeight: 800, color: "#E8E4DD" }}>Schedule</div><div style={{ fontFamily: mn, fontSize: 9, color: "#6B6878" }}>Buffer queue, calendar, analytics.</div></div>
      <div style={{ display: "flex", gap: 8 }}><button className="glow-btn btn-primary" style={{ padding: "7px 14px", fontSize: 12 }}>+ New Post</button><button className="glow-btn btn-secondary" style={{ padding: "7px 14px", fontSize: 12 }}>Open Buffer</button></div>
    </div>
    <div style={{ display: "flex", gap: 0, background: "linear-gradient(135deg,#14141E,#101018)", border: "1px solid #252535", borderRadius: 8, overflow: "hidden", marginBottom: 20 }}>
      {[{ l: "Scheduled", v: "12", c: A }, { l: "Sent", v: "248", c: "#2EAD8E" }, { l: "Drafts", v: "5", c: "#0B86D1" }, { l: "Channels", v: "8", c: "#905CCB" }].map(function(s, i) {
        return <div key={i} style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRight: i < 3 ? "1px solid #252535" : "none" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.c, boxShadow: "0 0 6px " + s.c + "40" }} />
          <span style={{ fontFamily: ft, fontSize: 12, color: "#6B6878" }}>{s.l}</span>
          <span style={{ fontFamily: mn, fontSize: 14, fontWeight: 700, color: "#E8E4DD", marginLeft: "auto" }}>{s.v}</span>
        </div>;
      })}
    </div>
    <div style={{ display: "flex", borderBottom: "1px solid #1E1E2E", marginBottom: 20 }}>
      {["Home", "Calendar", "Scheduled", "Sent", "Drafts", "Channels", "Stats"].map(function(t, i) {
        return <div key={i} className={"tab-item" + (i === 0 ? " tab-active" : "")}>{t}</div>;
      })}
    </div>
    <div style={{ fontFamily: ft, fontSize: 14, color: "#6B6878", textAlign: "center", padding: 40 }}>Home hub content would appear here</div>
  </div>;
}

// ═══ MAIN ═══
export default function DesignPage() {
  var _active = useState("weekly"), active = _active[0], setActive = _active[1];

  // Determine active category
  var activeCategory = null;
  Object.keys(CATS).forEach(function(k) { CATS[k].items.forEach(function(it) { if (it.id === active) activeCategory = k; }); });
  var catColor = activeCategory ? CATS[activeCategory].color : A;
  var catGlow = activeCategory ? CATS[activeCategory].glow : "rgba(247,176,65,";

  return <div style={{ background: BG, minHeight: "100vh", color: "#E8E4DD", fontFamily: ft, position: "relative", overflow: "hidden" }}>
    <style dangerouslySetInnerHTML={{ __html: [
      "@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');",
      "@keyframes orbDrift1{0%{transform:translate(0,0) scale(1)}33%{transform:translate(10vw,-8vh) scale(1.1)}66%{transform:translate(-5vw,5vh) scale(0.95)}100%{transform:translate(0,0) scale(1)}}",
      "@keyframes orbDrift2{0%{transform:translate(0,0) scale(1)}33%{transform:translate(-8vw,10vh) scale(1.05)}66%{transform:translate(6vw,-4vh) scale(0.9)}100%{transform:translate(0,0) scale(1)}}",
      ".bg-orb{position:absolute;border-radius:50%;filter:blur(100px);will-change:transform;transition:background 1.5s ease}",
      // Buttons
      ".glow-btn{position:relative;padding:12px 28px;border:none;border-radius:8px;font-family:'Outfit',sans-serif;font-size:14px;font-weight:700;cursor:pointer;transition:all 0.2s ease}",
      ".btn-primary{background:linear-gradient(135deg,#F7B041 0%,#E8A020 50%,#F7B041 100%);color:#06060C;box-shadow:0 4px 14px rgba(247,176,65,0.25),0 0 20px rgba(247,176,65,0.1)}",
      ".btn-primary:hover{box-shadow:0 6px 24px rgba(247,176,65,0.4),0 0 40px rgba(247,176,65,0.15);transform:translateY(-2px)}",
      ".btn-secondary{background:linear-gradient(135deg,#181822,#13131C);color:#E8E4DD;border:1px solid #2A2A3A;box-shadow:0 2px 8px rgba(0,0,0,0.4)}",
      ".btn-secondary:hover{border-color:rgba(247,176,65,0.5);box-shadow:0 4px 16px rgba(247,176,65,0.12);color:#F7B041}",
      ".btn-ghost{background:rgba(255,255,255,0.02);color:#8A8690;border:1px solid #2A2A3A}",
      ".btn-ghost:hover{border-color:rgba(247,176,65,0.4);color:#F7B041;background:rgba(247,176,65,0.04);box-shadow:0 0 12px rgba(247,176,65,0.08)}",
      // Cards
      ".card-base{background:linear-gradient(135deg,#14141E 0%,#101018 100%);border:1px solid #252535;border-radius:12px;transition:all 0.2s ease;box-shadow:0 2px 12px rgba(0,0,0,0.4)}",
      ".card-base:hover{border-color:rgba(247,176,65,0.35);box-shadow:0 8px 30px rgba(0,0,0,0.5),0 0 20px rgba(247,176,65,0.08);transform:translateY(-3px)}",
      ".card-glow{background:linear-gradient(135deg,#14141E,#101018);border:1px solid #252535;border-radius:12px;position:relative;overflow:hidden;transition:all 0.25s ease;box-shadow:0 2px 12px rgba(0,0,0,0.4)}",
      ".card-glow::after{content:'';position:absolute;inset:0;background:radial-gradient(circle at var(--mx,50%) var(--my,50%),rgba(247,176,65,0.08) 0%,transparent 50%);pointer-events:none;opacity:0;transition:opacity 0.3s}",
      ".card-glow:hover{border-color:rgba(247,176,65,0.4);box-shadow:0 8px 30px rgba(0,0,0,0.5),0 0 24px rgba(247,176,65,0.1)}",
      ".card-glow:hover::after{opacity:1}",
      // Inputs
      ".input-dark{width:100%;padding:12px 16px;background:#101018;border:1px solid #2A2A3A;border-radius:8px;color:#E8E4DD;font-family:'Outfit',sans-serif;font-size:14px;outline:none;transition:all 0.2s;box-shadow:inset 0 1px 3px rgba(0,0,0,0.3);box-sizing:border-box}",
      ".input-dark:focus{border-color:#F7B041;box-shadow:inset 0 1px 3px rgba(0,0,0,0.3),0 0 0 3px rgba(247,176,65,0.12),0 0 20px rgba(247,176,65,0.08)}",
      ".input-dark::placeholder{color:#4A4858}",
      // Pills
      ".pill{display:inline-flex;align-items:center;gap:4px;padding:5px 12px;border-radius:20px;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:600}",
      ".pill-amber{background:rgba(247,176,65,0.15);color:#F7B041;border:1px solid rgba(247,176,65,0.3);box-shadow:0 0 8px rgba(247,176,65,0.06)}",
      // Tabs
      ".tab-item{padding:10px 18px;cursor:pointer;font-family:'Outfit',sans-serif;font-size:13px;font-weight:500;color:#8A8690;border-bottom:2px solid transparent;transition:all 0.15s}",
      ".tab-item:hover{color:#E8E4DD}",
      ".tab-active{color:#F7B041!important;font-weight:700;border-bottom-color:#F7B041;text-shadow:0 0 12px rgba(247,176,65,0.3)}",
    ].join("\n") }} />

    {/* Animated background — colors morph with active category */}
    <style dangerouslySetInnerHTML={{ __html: [
      "@keyframes od1{0%{transform:translate(0,0) scale(1) rotate(0deg)}25%{transform:translate(8vw,-6vh) scale(1.2) rotate(5deg)}50%{transform:translate(-4vw,8vh) scale(0.85) rotate(-3deg)}75%{transform:translate(6vw,3vh) scale(1.1) rotate(2deg)}100%{transform:translate(0,0) scale(1) rotate(0deg)}}",
      "@keyframes od2{0%{transform:translate(0,0) scale(1) rotate(0deg)}25%{transform:translate(-10vw,5vh) scale(0.9) rotate(-4deg)}50%{transform:translate(5vw,-7vh) scale(1.15) rotate(6deg)}75%{transform:translate(-3vw,10vh) scale(0.95) rotate(-2deg)}100%{transform:translate(0,0) scale(1) rotate(0deg)}}",
      "@keyframes od3{0%{transform:translate(0,0) scale(1) rotate(0deg)}33%{transform:translate(7vw,6vh) scale(1.3) rotate(8deg)}66%{transform:translate(-8vw,-4vh) scale(0.8) rotate(-5deg)}100%{transform:translate(0,0) scale(1) rotate(0deg)}}",
      "@keyframes od4{0%{transform:translate(0,0) scale(1)}50%{transform:translate(-6vw,8vh) scale(1.25)}100%{transform:translate(0,0) scale(1)}}",
      "@keyframes od5{0%{transform:translate(0,0) scale(1) rotate(0deg)}40%{transform:translate(12vw,-3vh) scale(0.7) rotate(10deg)}80%{transform:translate(-5vw,6vh) scale(1.3) rotate(-4deg)}100%{transform:translate(0,0) scale(1) rotate(0deg)}}",
      "@keyframes pulse{0%,100%{opacity:0.6}50%{opacity:1}}",
    ].join("") }} />
    <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
      <div style={{ position: "absolute", inset: 0, background: BG }} />
      {/* Primary orb — large, follows category color */}
      <div className="bg-orb" style={{ width: "60vw", height: "60vw", top: "-20%", right: "-15%", background: "radial-gradient(ellipse, " + catGlow + "0.22) 0%, " + catGlow + "0.08) 35%, transparent 65%)", animation: "od1 20s ease-in-out infinite", borderRadius: "40% 60% 55% 45%" }} />
      {/* Secondary orb — medium, offset */}
      <div className="bg-orb" style={{ width: "45vw", height: "50vw", bottom: "-15%", left: "-8%", background: "radial-gradient(ellipse, " + catGlow + "0.18) 0%, " + catGlow + "0.05) 40%, transparent 65%)", animation: "od2 28s ease-in-out infinite", borderRadius: "55% 45% 50% 50%" }} />
      {/* Violet accent — always present, subtle */}
      <div className="bg-orb" style={{ width: "30vw", height: "35vw", top: "30%", left: "15%", background: "radial-gradient(ellipse, rgba(144,92,203,0.12) 0%, rgba(144,92,203,0.03) 40%, transparent 65%)", animation: "od3 18s ease-in-out infinite", borderRadius: "45% 55% 60% 40%" }} />
      {/* Small hot orb — intense, fast */}
      <div className="bg-orb" style={{ width: "20vw", height: "20vw", top: "15%", right: "25%", background: "radial-gradient(circle, " + catGlow + "0.15) 0%, transparent 60%)", animation: "od4 12s ease-in-out infinite, pulse 4s ease-in-out infinite", filter: "blur(60px)" }} />
      {/* Wandering accent */}
      <div className="bg-orb" style={{ width: "25vw", height: "30vw", bottom: "20%", right: "10%", background: "radial-gradient(ellipse, " + catGlow + "0.10) 0%, transparent 60%)", animation: "od5 24s ease-in-out infinite", borderRadius: "60% 40% 45% 55%" }} />
      {/* Tiny bright spot */}
      <div className="bg-orb" style={{ width: "12vw", height: "12vw", top: "60%", left: "40%", background: "radial-gradient(circle, " + catGlow + "0.2) 0%, transparent 50%)", animation: "od4 8s ease-in-out infinite reverse", filter: "blur(40px)" }} />
    </div>

    {/* Sidebar */}
    <Sidebar active={active} onNav={setActive} activeCategory={activeCategory} />

    {/* Content */}
    <div style={{ marginLeft: 230, position: "relative", zIndex: 1 }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 40px 60px" }}>
        {active === "weekly" && <MockSAWeekly />}
        {active === "news" && <MockNewsFlow />}
        {active === "schedule" && <MockSchedule />}
        {(active !== "weekly" && active !== "news" && active !== "schedule") && <div style={{ textAlign: "center", padding: "80px 0" }}>
          <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.3 }}>{"\uD83D\uDEA7"}</div>
          <div style={{ fontFamily: ft, fontSize: 18, fontWeight: 700, color: "#E8E4DD", marginBottom: 6 }}>{active}</div>
          <div style={{ fontFamily: ft, fontSize: 13, color: "#6B6878" }}>Select SA Weekly, News Flow, or Schedule to see a mockup</div>
        </div>}
      </div>
    </div>
  </div>;
}
