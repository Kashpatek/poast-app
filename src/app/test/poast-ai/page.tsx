// @ts-nocheck
"use client";
import { useState, useRef, useEffect } from "react";

var A = "#F7B041";
var BG = "#06060C";
var ft = "'Outfit',sans-serif";
var mn = "'JetBrains Mono',monospace";

var SUGGESTIONS = [
  "Write an X thread about NVIDIA earnings",
  "Draft a LinkedIn post for our latest episode",
  "5 content ideas about AI infrastructure",
  "Summarize the latest SemiAnalysis article",
  "Create an outreach email for podcast guests",
  "What should we post about TSMC this week?",
];

// ═══ VARIANT A: COMMAND LINE ═══
function VariantA({ onClose }) {
  var _input = useState(""), input = _input[0], setInput = _input[1];
  var _msgs = useState([
    { role: "system", text: "POAST AI v0.7 // Ready" },
    { role: "assistant", text: "What are we building today?" },
  ]);
  var msgs = _msgs[0]; var setMsgs = _msgs[1];
  var _thinking = useState(false), thinking = _thinking[0], setThinking = _thinking[1];

  var send = function() {
    if (!input.trim()) return;
    setMsgs(function(p) { return p.concat([{ role: "user", text: input }]); });
    setInput("");
    setThinking(true);
    setTimeout(function() {
      setMsgs(function(p) { return p.concat([{ role: "assistant", text: "Here's a draft X thread about semiconductor supply chains:\n\n1/5 TSMC's Arizona fab just hit a milestone most people missed.\n\n2/5 Equipment install in Fab 2 is ahead of schedule. Not behind, ahead.\n\n3/5 The CoWoS capacity expansion means NVIDIA's Blackwell supply chain is actually decoupling from the Taiwan concentration risk.\n\n4/5 Intel's Ohio fabs are 18 months behind. Samsung Pyeongtaek is struggling with 3nm yields. TSMC Arizona is the real story.\n\n5/5 The reshoring narrative is no longer hypothetical. It's steel and silicon in the Arizona desert." }]); });
      setThinking(false);
    }, 2000);
  };

  return <div style={{ position: "fixed", inset: 0, background: BG + "F0", backdropFilter: "blur(20px)", zIndex: 9999, display: "flex", flexDirection: "column" }}>
    <style dangerouslySetInnerHTML={{ __html: "@keyframes termBlink{0%,100%{opacity:1}50%{opacity:0}}@keyframes msgIn{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:translateY(0)}}@keyframes thinkPulse{0%,100%{opacity:0.3}50%{opacity:1}}" }} />

    {/* Header */}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", borderBottom: "1px solid #1A1A28" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2EAD8E", boxShadow: "0 0 8px #2EAD8E60" }} />
        <span style={{ fontFamily: mn, fontSize: 12, color: A, fontWeight: 700 }}>POAST AI</span>
        <span style={{ fontFamily: mn, fontSize: 9, color: "#444" }}>v0.7 // claude-sonnet-4</span>
      </div>
      <span onClick={onClose} style={{ fontFamily: mn, fontSize: 14, color: "#555", cursor: "pointer", padding: "4px 8px" }}>&times;</span>
    </div>

    {/* Messages */}
    <div style={{ flex: 1, overflow: "auto", padding: "20px 24px", fontFamily: mn, fontSize: 13 }}>
      {msgs.map(function(m, i) {
        if (m.role === "system") return <div key={i} style={{ color: "#333", fontSize: 10, marginBottom: 12 }}>{m.text}</div>;
        if (m.role === "user") return <div key={i} style={{ marginBottom: 16, animation: "msgIn 0.2s ease" }}>
          <span style={{ color: A }}>{">"} </span><span style={{ color: "#E8E4DD" }}>{m.text}</span>
        </div>;
        return <div key={i} style={{ marginBottom: 20, paddingLeft: 16, borderLeft: "2px solid #1A1A28", animation: "msgIn 0.3s ease" }}>
          <div style={{ fontFamily: ft, fontSize: 13, color: "#E8E4DD", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{m.text}</div>
        </div>;
      })}
      {thinking && <div style={{ paddingLeft: 16, borderLeft: "2px solid " + A + "40" }}>
        <span style={{ fontFamily: mn, fontSize: 12, color: A, animation: "thinkPulse 1s ease-in-out infinite" }}>thinking</span>
        <span style={{ color: A, animation: "termBlink 0.6s step-end infinite" }}>_</span>
      </div>}
    </div>

    {/* Input */}
    <div style={{ padding: "16px 24px", borderTop: "1px solid #1A1A28", background: "#08080F" }}>
      {msgs.length <= 2 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {SUGGESTIONS.slice(0, 4).map(function(s, i) {
          return <span key={i} onClick={function() { setInput(s); }} style={{ fontFamily: ft, fontSize: 10, color: "#6B6878", padding: "5px 10px", borderRadius: 5, border: "1px solid #1E1E2E", cursor: "pointer", transition: "all 0.15s" }} onMouseEnter={function(e) { e.currentTarget.style.borderColor = A + "40"; e.currentTarget.style.color = A; }} onMouseLeave={function(e) { e.currentTarget.style.borderColor = "#1E1E2E"; e.currentTarget.style.color = "#6B6878"; }}>{s}</span>;
        })}
      </div>}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ fontFamily: mn, fontSize: 14, color: A }}>{">"}</span>
        <input value={input} onChange={function(e) { setInput(e.target.value); }} onKeyDown={function(e) { if (e.key === "Enter") send(); }} placeholder="Ask anything..." style={{ flex: 1, padding: "10px 0", background: "transparent", border: "none", color: "#E8E4DD", fontFamily: mn, fontSize: 13, outline: "none" }} />
        <span onClick={send} style={{ fontFamily: mn, fontSize: 10, color: input.trim() ? A : "#333", cursor: input.trim() ? "pointer" : "default", padding: "6px 12px", borderRadius: 5, background: input.trim() ? A + "15" : "transparent", border: "1px solid " + (input.trim() ? A + "30" : "transparent"), transition: "all 0.15s" }}>SEND</span>
      </div>
    </div>
  </div>;
}

// ═══ VARIANT B: GLASS PANEL (PREMIUM) ═══
function VariantB({ onClose }) {
  var _input = useState(""), input = _input[0], setInput = _input[1];
  var _msgs = useState([]);
  var msgs = _msgs[0]; var setMsgs = _msgs[1];
  var _thinking = useState(false), thinking = _thinking[0], setThinking = _thinking[1];
  var _ready = useState(false), ready = _ready[0], setReady = _ready[1];
  var scrollRef = useRef(null);

  useEffect(function() { setTimeout(function() { setReady(true); }, 50); }, []);
  useEffect(function() { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [msgs]);

  var send = function() {
    if (!input.trim()) return;
    setMsgs(function(p) { return p.concat([{ role: "user", text: input }]); });
    setInput("");
    setThinking(true);
    setTimeout(function() {
      setMsgs(function(p) { return p.concat([{ role: "assistant", text: "Here's what I'd suggest for the LinkedIn post:\n\nGB200 NVL72 benchmarks are in. The numbers aren't just better than Hopper, they're categorically different.\n\nWhen we ran InferenceX against a fully optimized Hopper baseline with MTP, disaggregated prefill, and wide expert parallelism, Blackwell wasn't 35x faster. It was over 50x.\n\nJensen's GTC 2024 claim was dismissed as marketing. The data says otherwise.\n\nLink in comments." }]); });
      setThinking(false);
    }, 2000);
  };

  return <div style={{ position: "fixed", bottom: 24, right: 24, width: 460, height: 600, zIndex: 9999, borderRadius: 20, display: "flex", flexDirection: "column", transform: ready ? "translateY(0) scale(1)" : "translateY(30px) scale(0.92)", opacity: ready ? 1 : 0, transition: "all 0.45s cubic-bezier(0.16, 1, 0.3, 1)", overflow: "hidden" }}>
    <style dangerouslySetInnerHTML={{ __html: [
      "@keyframes orbFloat{0%{transform:translate(0,0) scale(1)}50%{transform:translate(10px,-10px) scale(1.15)}100%{transform:translate(0,0) scale(1)}}",
      "@keyframes dotWave{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}",
      "@keyframes msgSlide{0%{opacity:0;transform:translateY(10px) scale(0.98)}100%{opacity:1;transform:translateY(0) scale(1)}}",
      "@keyframes borderGlow{0%,100%{border-color:rgba(247,176,65,0.15)}50%{border-color:rgba(247,176,65,0.3)}}",
      "@keyframes logoPulse{0%,100%{box-shadow:0 0 16px rgba(247,176,65,0.15)}50%{box-shadow:0 0 28px rgba(247,176,65,0.25),0 0 48px rgba(247,176,65,0.08)}}",
      "@keyframes inputGlow{0%,100%{box-shadow:0 0 0 0 rgba(247,176,65,0)}50%{box-shadow:0 0 12px rgba(247,176,65,0.06)}}",
      "@keyframes suggestionIn{0%{opacity:0;transform:translateY(6px)}100%{opacity:1;transform:translateY(0)}}",
    ].join("") }} />

    {/* Outer glow shell */}
    <div style={{ position: "absolute", inset: -1, borderRadius: 21, background: "linear-gradient(135deg, " + A + "20, transparent 40%, " + A + "10)", zIndex: 0, animation: "borderGlow 4s ease-in-out infinite" }} />

    {/* Glass body */}
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, rgba(12,12,22,0.95) 0%, rgba(8,8,14,0.97) 50%, rgba(10,10,18,0.96) 100%)", backdropFilter: "blur(30px)", WebkitBackdropFilter: "blur(30px)", borderRadius: 20, boxShadow: "0 0 50px rgba(247,176,65,0.06), 0 24px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03)", zIndex: 1 }} />

    {/* Inner ambient orbs */}
    <div style={{ position: "absolute", top: -30, right: -30, width: 140, height: 140, borderRadius: "50%", background: "radial-gradient(circle, " + A + "12, transparent 70%)", filter: "blur(30px)", animation: "orbFloat 8s ease-in-out infinite", zIndex: 1, pointerEvents: "none" }} />
    <div style={{ position: "absolute", bottom: 40, left: -20, width: 100, height: 100, borderRadius: "50%", background: "radial-gradient(circle, rgba(11,134,209,0.08), transparent 70%)", filter: "blur(25px)", animation: "orbFloat 10s ease-in-out infinite reverse", zIndex: 1, pointerEvents: "none" }} />

    {/* Header */}
    <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid rgba(247,176,65,0.08)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, " + A + "30, " + A + "10)", border: "1px solid " + A + "30", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: ft, fontSize: 16, fontWeight: 900, color: A, animation: "logoPulse 3s ease-in-out infinite" }}>P</div>
        <div>
          <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: "#E8E4DD", letterSpacing: 0.3 }}>Poast</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#2EAD8E", boxShadow: "0 0 6px #2EAD8E60" }} />
            <span style={{ fontFamily: mn, fontSize: 8, color: "#4A4858" }}>online // sonnet-4</span>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 5 }}>
        <span style={{ fontFamily: mn, fontSize: 8, color: "#555", padding: "4px 8px", borderRadius: 4, border: "1px solid #1A1A28", cursor: "pointer", transition: "all 0.15s" }} onMouseEnter={function(e) { e.currentTarget.style.borderColor = A + "30"; e.currentTarget.style.color = A; }} onMouseLeave={function(e) { e.currentTarget.style.borderColor = "#1A1A28"; e.currentTarget.style.color = "#555"; }}>Export</span>
        <span onClick={onClose} style={{ fontFamily: mn, fontSize: 16, color: "#444", cursor: "pointer", padding: "2px 6px", transition: "color 0.15s" }} onMouseEnter={function(e) { e.currentTarget.style.color = "#E8E4DD"; }} onMouseLeave={function(e) { e.currentTarget.style.color = "#444"; }}>&times;</span>
      </div>
    </div>

    {/* Messages */}
    <div ref={scrollRef} style={{ position: "relative", zIndex: 2, flex: 1, overflow: "auto", padding: "18px 20px" }}>
      {msgs.length === 0 && <div style={{ textAlign: "center", padding: "40px 16px" }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: "linear-gradient(135deg, " + A + "22, " + A + "0A)", border: "1px solid " + A + "20", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontFamily: ft, fontSize: 24, fontWeight: 900, color: A, animation: "logoPulse 3s ease-in-out infinite" }}>P</div>
        <div style={{ fontFamily: ft, fontSize: 16, fontWeight: 700, color: "#E8E4DD", marginBottom: 6 }}>How can I help?</div>
        <div style={{ fontFamily: ft, fontSize: 12, color: "#6B6878", marginBottom: 22, lineHeight: 1.6 }}>SA brand rules, platform formats, content drafts, ideas, and more.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {SUGGESTIONS.slice(0, 4).map(function(s, i) {
            return <span key={i} onClick={function() { setInput(s); }} style={{ fontFamily: ft, fontSize: 11, color: "#8A8690", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid #1A1A28", cursor: "pointer", textAlign: "left", transition: "all 0.2s", animation: "suggestionIn 0.3s ease " + (i * 0.08) + "s forwards", opacity: 0 }} onMouseEnter={function(e) { e.currentTarget.style.borderColor = A + "30"; e.currentTarget.style.color = "#E8E4DD"; e.currentTarget.style.background = A + "06"; e.currentTarget.style.boxShadow = "0 0 12px " + A + "08"; }} onMouseLeave={function(e) { e.currentTarget.style.borderColor = "#1A1A28"; e.currentTarget.style.color = "#8A8690"; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.boxShadow = "none"; }}>{s}</span>;
          })}
        </div>
      </div>}

      {msgs.map(function(m, i) {
        var isUser = m.role === "user";
        return <div key={i} style={{ marginBottom: 16, display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", animation: "msgSlide 0.3s ease" }}>
          {!isUser && <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
            <div style={{ width: 20, height: 20, borderRadius: 6, background: A + "18", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: ft, fontSize: 9, fontWeight: 900, color: A }}>P</div>
            <span style={{ fontFamily: mn, fontSize: 8, color: "#4A4858" }}>Poast</span>
          </div>}
          <div style={{ maxWidth: "88%", padding: "12px 16px", borderRadius: isUser ? "16px 16px 4px 16px" : "4px 16px 16px 16px", background: isUser ? "linear-gradient(135deg, " + A + "15, " + A + "08)" : "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))", border: "1px solid " + (isUser ? A + "20" : "#1A1A28"), boxShadow: isUser ? "0 2px 12px " + A + "08" : "0 2px 8px rgba(0,0,0,0.2)" }}>
            <div style={{ fontFamily: ft, fontSize: 13, color: "#E8E4DD", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{m.text}</div>
          </div>
          {!isUser && <div style={{ display: "flex", gap: 4, marginTop: 6, marginLeft: 26 }}>
            <span style={{ fontFamily: mn, fontSize: 8, color: "#444", padding: "3px 7px", borderRadius: 4, border: "1px solid #1A1A28", cursor: "pointer", transition: "all 0.15s" }} onMouseEnter={function(e) { e.currentTarget.style.color = A; e.currentTarget.style.borderColor = A + "25"; }} onMouseLeave={function(e) { e.currentTarget.style.color = "#444"; e.currentTarget.style.borderColor = "#1A1A28"; }}>Copy</span>
            <span style={{ fontFamily: mn, fontSize: 8, color: "#444", padding: "3px 7px", borderRadius: 4, border: "1px solid #1A1A28", cursor: "pointer", transition: "all 0.15s" }} onMouseEnter={function(e) { e.currentTarget.style.color = A; e.currentTarget.style.borderColor = A + "25"; }} onMouseLeave={function(e) { e.currentTarget.style.color = "#444"; e.currentTarget.style.borderColor = "#1A1A28"; }}>Regenerate</span>
          </div>}
        </div>;
      })}

      {thinking && <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 0" }}>
        <div style={{ width: 20, height: 20, borderRadius: 6, background: A + "18", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: ft, fontSize: 9, fontWeight: 900, color: A }}>P</div>
        <div style={{ display: "flex", gap: 4 }}>
          {[0, 1, 2].map(function(i) { return <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: A, opacity: 0.6, animation: "dotWave 1.2s ease-in-out " + (i * 0.15) + "s infinite" }} />; })}
        </div>
      </div>}
    </div>

    {/* Input */}
    <div style={{ position: "relative", zIndex: 2, padding: "14px 16px 16px", borderTop: "1px solid rgba(247,176,65,0.06)" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", background: "linear-gradient(135deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01))", border: "1px solid #1E1E2E", borderRadius: 12, padding: "5px 5px 5px 16px", transition: "all 0.25s", animation: "inputGlow 4s ease-in-out infinite" }} onFocus={function(e) { e.currentTarget.style.borderColor = A + "40"; e.currentTarget.style.boxShadow = "0 0 20px " + A + "10, inset 0 0 12px " + A + "04"; }} onBlur={function(e) { e.currentTarget.style.borderColor = "#1E1E2E"; e.currentTarget.style.boxShadow = "none"; }}>
        <input value={input} onChange={function(e) { setInput(e.target.value); }} onKeyDown={function(e) { if (e.key === "Enter") send(); }} placeholder="Ask anything..." style={{ flex: 1, padding: "10px 0", background: "transparent", border: "none", color: "#E8E4DD", fontFamily: ft, fontSize: 13, outline: "none" }} />
        <span onClick={send} style={{ padding: "9px 16px", background: input.trim() ? "linear-gradient(135deg, " + A + ", #E8A020)" : "#1A1A28", color: input.trim() ? BG : "#444", borderRadius: 8, fontFamily: ft, fontSize: 12, fontWeight: 700, cursor: input.trim() ? "pointer" : "default", transition: "all 0.2s", boxShadow: input.trim() ? "0 4px 14px " + A + "30, 0 0 20px " + A + "10" : "none", transform: input.trim() ? "scale(1)" : "scale(0.98)" }}>Send</span>
      </div>
    </div>
  </div>;
}

// ═══ VARIANT C: SIDE PANEL TAKEOVER ═══
function VariantC({ onClose }) {
  var _input = useState(""), input = _input[0], setInput = _input[1];
  var _msgs = useState([]);
  var msgs = _msgs[0]; var setMsgs = _msgs[1];
  var _thinking = useState(false), thinking = _thinking[0], setThinking = _thinking[1];

  var send = function() {
    if (!input.trim()) return;
    setMsgs(function(p) { return p.concat([{ role: "user", text: input }]); });
    setInput("");
    setThinking(true);
    setTimeout(function() {
      setMsgs(function(p) { return p.concat([{ role: "assistant", text: "Here's your X thread about NVIDIA earnings:\n\n1/5 NVIDIA just reported $44B in quarterly revenue. That's not a record. That's a category.\n\n2/5 Data center revenue alone was $39.2B. That's more than AMD's entire annual revenue across all segments.\n\n3/5 The real number nobody's talking about: inference revenue now exceeds training revenue for the first time. The deployment wave is here.\n\n4/5 Blackwell is fully ramped. GB200 NVL72 orders are booked through Q3 2027. Jensen called it \"insane demand.\" The data backs it up.\n\n5/5 At this run rate, NVIDIA will surpass Apple as the most profitable technology company on earth within 18 months. Not market cap. Profit." }]); });
      setThinking(false);
    }, 2500);
  };

  return <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "50vw", maxWidth: 640, zIndex: 9999, display: "flex", flexDirection: "column" }}>
    <style dangerouslySetInnerHTML={{ __html: "@keyframes panelIn{0%{transform:translateX(100%)}100%{transform:translateX(0)}}@keyframes typeIn{0%{opacity:0;transform:translateY(6px)}100%{opacity:1;transform:translateY(0)}}@keyframes breathe{0%,100%{box-shadow:0 0 20px rgba(247,176,65,0.08)}50%{box-shadow:0 0 30px rgba(247,176,65,0.15)}}" }} />
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #0A0A14, #08080F)", borderLeft: "1px solid " + A + "15", boxShadow: "-20px 0 60px rgba(0,0,0,0.5), 0 0 40px " + A + "06", animation: "panelIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)" }} />
    {/* Ambient glow inside panel */}
    <div style={{ position: "absolute", top: 0, left: 0, width: "50%", height: "40%", background: "radial-gradient(ellipse, " + A + "06, transparent 70%)", pointerEvents: "none" }} />

    {/* Header */}
    <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid #1A1A28" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, " + A + "20, " + A + "08)", border: "1px solid " + A + "30", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: ft, fontSize: 18, fontWeight: 900, color: A, boxShadow: "0 0 20px " + A + "15", animation: "breathe 3s ease-in-out infinite" }}>P</div>
        <div>
          <div style={{ fontFamily: ft, fontSize: 16, fontWeight: 800, color: "#E8E4DD" }}>Ask Poast</div>
          <div style={{ fontFamily: mn, fontSize: 9, color: "#4A4858" }}>AI co-pilot // claude-sonnet-4</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <span style={{ fontFamily: mn, fontSize: 9, color: "#555", padding: "4px 10px", borderRadius: 5, border: "1px solid #1E1E2E", cursor: "pointer" }}>Export</span>
        <span style={{ fontFamily: mn, fontSize: 9, color: "#555", padding: "4px 10px", borderRadius: 5, border: "1px solid #1E1E2E", cursor: "pointer" }}>Clear</span>
        <span onClick={onClose} style={{ fontFamily: mn, fontSize: 16, color: "#555", cursor: "pointer", padding: "2px 8px" }}>&times;</span>
      </div>
    </div>

    {/* Messages */}
    <div style={{ position: "relative", flex: 1, overflow: "auto", padding: "24px" }}>
      {msgs.length === 0 && <div style={{ padding: "40px 20px" }}>
        <div style={{ fontFamily: ft, fontSize: 24, fontWeight: 800, color: "#E8E4DD", marginBottom: 6 }}>What should we make?</div>
        <div style={{ fontFamily: ft, fontSize: 14, color: "#6B6878", marginBottom: 28, lineHeight: 1.6 }}>I know SemiAnalysis brand rules, every platform format, and can draft posts, scripts, threads, emails, and ideas.</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {SUGGESTIONS.map(function(s, i) {
            return <div key={i} onClick={function() { setInput(s); }} style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid #1E1E2E", cursor: "pointer", transition: "all 0.15s" }} onMouseEnter={function(e) { e.currentTarget.style.borderColor = A + "35"; e.currentTarget.style.background = A + "06"; e.currentTarget.style.boxShadow = "0 0 12px " + A + "08"; }} onMouseLeave={function(e) { e.currentTarget.style.borderColor = "#1E1E2E"; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.boxShadow = "none"; }}>
              <div style={{ fontFamily: ft, fontSize: 12, color: "#E8E4DD", lineHeight: 1.4 }}>{s}</div>
            </div>;
          })}
        </div>
      </div>}

      {msgs.map(function(m, i) {
        var isUser = m.role === "user";
        return <div key={i} style={{ marginBottom: 20, animation: "typeIn 0.3s ease" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            {isUser ? <div style={{ width: 22, height: 22, borderRadius: 6, background: "#1E1E2E", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: ft, fontSize: 10, fontWeight: 700, color: "#8A8690" }}>A</div>
            : <div style={{ width: 22, height: 22, borderRadius: 6, background: A + "20", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: ft, fontSize: 10, fontWeight: 900, color: A }}>P</div>}
            <span style={{ fontFamily: ft, fontSize: 11, fontWeight: 600, color: isUser ? "#8A8690" : A }}>{isUser ? "You" : "Poast"}</span>
          </div>
          <div style={{ paddingLeft: 30 }}>
            <div style={{ fontFamily: ft, fontSize: 14, color: "#E8E4DD", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{m.text}</div>
            {!isUser && <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <span style={{ fontFamily: mn, fontSize: 9, color: "#555", padding: "3px 8px", borderRadius: 4, border: "1px solid #1E1E2E", cursor: "pointer" }} onMouseEnter={function(e) { e.currentTarget.style.color = A; e.currentTarget.style.borderColor = A + "30"; }} onMouseLeave={function(e) { e.currentTarget.style.color = "#555"; e.currentTarget.style.borderColor = "#1E1E2E"; }}>Copy</span>
              <span style={{ fontFamily: mn, fontSize: 9, color: "#555", padding: "3px 8px", borderRadius: 4, border: "1px solid #1E1E2E", cursor: "pointer" }} onMouseEnter={function(e) { e.currentTarget.style.color = A; e.currentTarget.style.borderColor = A + "30"; }} onMouseLeave={function(e) { e.currentTarget.style.color = "#555"; e.currentTarget.style.borderColor = "#1E1E2E"; }}>Send to Capper</span>
              <span style={{ fontFamily: mn, fontSize: 9, color: "#555", padding: "3px 8px", borderRadius: 4, border: "1px solid #1E1E2E", cursor: "pointer" }} onMouseEnter={function(e) { e.currentTarget.style.color = A; e.currentTarget.style.borderColor = A + "30"; }} onMouseLeave={function(e) { e.currentTarget.style.color = "#555"; e.currentTarget.style.borderColor = "#1E1E2E"; }}>Regenerate</span>
            </div>}
          </div>
        </div>;
      })}

      {thinking && <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0 8px 30px" }}>
        <div style={{ width: 22, height: 22, borderRadius: 6, background: A + "20", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: ft, fontSize: 10, fontWeight: 900, color: A }}>P</div>
        <div style={{ display: "flex", gap: 4 }}>
          {[0, 1, 2].map(function(i) { return <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: A, animation: "dotWave 1.2s ease-in-out " + (i * 0.15) + "s infinite" }} />; })}
        </div>
      </div>}
    </div>

    {/* Input */}
    <div style={{ position: "relative", padding: "16px 24px 20px", borderTop: "1px solid #1A1A28" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", background: "#0C0C16", border: "1px solid #1E1E2E", borderRadius: 12, padding: "6px 6px 6px 16px", transition: "all 0.2s" }}>
        <textarea value={input} onChange={function(e) { setInput(e.target.value); }} onKeyDown={function(e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Ask Poast anything..." rows={1} style={{ flex: 1, padding: "10px 0", background: "transparent", border: "none", color: "#E8E4DD", fontFamily: ft, fontSize: 14, outline: "none", resize: "none", lineHeight: 1.5 }} />
        <span onClick={send} style={{ padding: "10px 18px", background: input.trim() ? "linear-gradient(135deg, " + A + ", #E8A020)" : "#1A1A28", color: input.trim() ? BG : "#444", borderRadius: 8, fontFamily: ft, fontSize: 13, fontWeight: 700, cursor: input.trim() ? "pointer" : "default", boxShadow: input.trim() ? "0 4px 14px " + A + "25" : "none", transition: "all 0.2s", marginBottom: 2 }}>Send</span>
      </div>
      <div style={{ fontFamily: mn, fontSize: 8, color: "#333", textAlign: "center", marginTop: 6 }}>Shift+Enter for new line // Knows all SA brand rules</div>
    </div>
  </div>;
}

// ═══ TEST PAGE ═══
export default function PoastAITest() {
  // TODO(akash): centralize this prod-guard into a shared <DevOnly/> wrapper or middleware-level redirect.
  if (typeof process !== "undefined" && process.env.NODE_ENV === "production") {
    return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#06060C",color:"#4A4858",fontFamily:"'Outfit',sans-serif"}}>404</div>;
  }
  var _variant = useState(null), variant = _variant[0], setVariant = _variant[1];

  return <div style={{ background: BG, minHeight: "100vh", fontFamily: ft, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40 }}>
    <style dangerouslySetInnerHTML={{ __html: "@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');@keyframes dotWave{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}" }} />

    {!variant && <div style={{ textAlign: "center" }}>
      <div style={{ fontFamily: ft, fontSize: 28, fontWeight: 900, color: "#E8E4DD", marginBottom: 6 }}>Ask Poast</div>
      <div style={{ fontFamily: ft, fontSize: 14, color: "#6B6878", marginBottom: 40 }}>Pick a variant to preview. Click send to see a mock response.</div>
      <div style={{ display: "flex", gap: 16 }}>
        {[
          { id: "A", l: "Command Line", d: "Terminal-inspired. Minimal, power user.", ic: ">" },
          { id: "B", l: "Glass Panel", d: "Floating frosted panel. Futuristic HUD.", ic: "P" },
          { id: "C", l: "Side Panel", d: "50% takeover. Co-pilot. Rich actions.", ic: "\u2B1C" },
        ].map(function(v) {
          return <div key={v.id} onClick={function() { setVariant(v.id); }} style={{ width: 200, padding: "28px 20px", borderRadius: 14, cursor: "pointer", background: "#0A0A14", border: "1px solid #1E1E2E", textAlign: "center", transition: "all 0.2s" }} onMouseEnter={function(e) { e.currentTarget.style.borderColor = A + "50"; e.currentTarget.style.boxShadow = "0 0 24px " + A + "10"; e.currentTarget.style.transform = "translateY(-4px)"; }} onMouseLeave={function(e) { e.currentTarget.style.borderColor = "#1E1E2E"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}>
            <div style={{ fontFamily: mn, fontSize: 28, color: A, marginBottom: 10 }}>{v.ic}</div>
            <div style={{ fontFamily: ft, fontSize: 16, fontWeight: 700, color: "#E8E4DD", marginBottom: 4 }}>Variant {v.id}</div>
            <div style={{ fontFamily: ft, fontSize: 13, fontWeight: 600, color: A, marginBottom: 6 }}>{v.l}</div>
            <div style={{ fontFamily: ft, fontSize: 11, color: "#6B6878" }}>{v.d}</div>
          </div>;
        })}
      </div>
    </div>}

    {variant === "A" && <VariantA onClose={function() { setVariant(null); }} />}
    {variant === "B" && <VariantB onClose={function() { setVariant(null); }} />}
    {variant === "C" && <VariantC onClose={function() { setVariant(null); }} />}
  </div>;
}
