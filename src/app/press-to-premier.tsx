// @ts-nocheck
"use client";
import { useState, useEffect, useRef } from "react";

// ═══ DESIGN ═══
var D = {
  bg: "#060608", surface: "#09090D", elevated: "#0D0D12",
  border: "rgba(255,255,255,0.06)", borderHover: "rgba(255,255,255,0.12)",
  amber: "#F7B041", blue: "#0B86D1", teal: "#2EAD8E", coral: "#E06347", violet: "#905CCB",
  tx: "#ffffff", txb: "rgba(255,255,255,0.55)", txl: "rgba(255,255,255,0.25)", txh: "rgba(255,255,255,0.12)",
};
var ft = "'Outfit',sans-serif";
var mn = "'JetBrains Mono',monospace";

// ═══ TOAST ═══
var _toast = { current: null };
function toast(msg, type, code) { if (_toast.current) _toast.current(msg, type, code); }
function Toasts() {
  var _l = useState([]), l = _l[0], sl = _l[1];
  _toast.current = function(m, t, code) { var id = Date.now(); sl(function(p) { return [{ id: id, m: m, t: t || "success", code: code }].concat(p).slice(0, 5); }); setTimeout(function() { sl(function(p) { return p.filter(function(x) { return x.id !== id; }); }); }, 5000); };
  return <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 10000, display: "flex", flexDirection: "column", gap: 8 }}>
    <style dangerouslySetInnerHTML={{ __html: "@keyframes tIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes tDr{from{width:100%}to{width:0}}" }} />
    {l.map(function(t) { var c = t.t === "error" ? D.coral : t.t === "info" ? D.amber : D.teal; return <div key={t.id} style={{ background: D.elevated, border: "1px solid " + D.border, borderLeft: "3px solid " + c, borderRadius: 10, padding: "14px 18px", minWidth: 300, boxShadow: "0 4px 24px rgba(0,0,0,0.5)", animation: "tIn 0.25s ease" }}>
      <div style={{ fontFamily: ft, fontSize: 13, fontWeight: 500, color: D.tx, marginBottom: 4 }}>{t.m}</div>
      {t.code && <div style={{ fontFamily: mn, fontSize: 10, color: D.txl, padding: "3px 6px", background: D.bg, borderRadius: 4, display: "inline-block", marginBottom: 4 }}>Error {t.code} // {new Date(t.id).toLocaleTimeString()}</div>}
      <div style={{ height: 2, background: D.border, borderRadius: 1, marginTop: 6 }}><div style={{ height: "100%", background: c, borderRadius: 1, animation: "tDr 5s linear forwards" }} /></div>
    </div>; })}
  </div>;
}

// ═══ STEP TRACKER (gradient fill) ═══
function StepTracker({ current, steps }) {
  var progress = ((current + 1) / steps.length) * 100;
  return <div style={{ marginBottom: 40 }}>
    {/* Progress bar */}
    <div style={{ height: 4, background: D.border, borderRadius: 2, marginBottom: 20, overflow: "hidden" }}>
      <div style={{ height: "100%", width: progress + "%", background: "linear-gradient(90deg, " + D.amber + ", " + D.teal + ")", borderRadius: 2, transition: "width 0.5s cubic-bezier(0.16, 1, 0.3, 1)" }} />
    </div>
    {/* Step labels */}
    <div style={{ display: "flex", gap: 0 }}>
      {steps.map(function(s, i) {
        var done = i < current; var active = i === current; var future = i > current;
        return <div key={i} style={{ flex: 1, textAlign: "center", cursor: done ? "pointer" : "default", opacity: future ? 0.3 : 1, transition: "opacity 0.2s" }}>
          <div style={{ fontFamily: mn, fontSize: 24, fontWeight: 900, color: done ? D.teal : active ? D.amber : D.txl, transition: "color 0.3s", textShadow: active ? "0 0 20px " + D.amber + "40" : "none" }}>{done ? "\u2713" : i + 1}</div>
          <div style={{ fontFamily: ft, fontSize: 12, fontWeight: active ? 700 : 500, color: active ? D.tx : D.txl, marginTop: 4, letterSpacing: active ? 0.5 : 0 }}>{s}</div>
        </div>;
      })}
    </div>
  </div>;
}

// ═══ OPTION CARD ═══
function OptionCards({ options, selected, onSelect, label }) {
  return <div style={{ marginBottom: 28 }}>
    <div style={{ fontFamily: ft, fontSize: 10, fontWeight: 600, color: D.txl, letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 }}>{label}</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {options.map(function(opt, i) {
        var on = selected === i;
        return <div key={i} onClick={function() { onSelect(i); }} style={{ padding: "18px 22px", background: on ? D.elevated : D.surface, border: "1px solid " + (on ? D.amber + "40" : D.border), borderLeft: on ? "3px solid " + D.amber : "1px solid " + D.border, borderRadius: 10, cursor: "pointer", transition: "all 0.2s", boxShadow: on ? "0 0 20px " + D.amber + "08" : "none" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid " + (on ? D.amber : D.border), background: on ? D.amber : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: D.bg, fontWeight: 700, flexShrink: 0, marginTop: 2, transition: "all 0.2s" }}>{on ? "\u2713" : ""}</div>
            <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 500, color: D.txb, lineHeight: 1.7 }}>{opt}</div>
          </div>
        </div>;
      })}
    </div>
  </div>;
}

// ═══ STEP 1: INPUT ═══
function Step1({ data, setData, onNext }) {
  var _mode = useState(data.mode || "url"), mode = _mode[0], setMode = _mode[1];
  return <div>
    <div style={{ fontFamily: ft, fontSize: 42, fontWeight: 900, color: D.tx, letterSpacing: -2, marginBottom: 8 }}>New Project</div>
    <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 500, color: D.txb, marginBottom: 32 }}>Paste an article URL or text to begin production.</div>
    <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
      {[{ id: "url", l: "Paste URL" }, { id: "text", l: "Paste Text" }].map(function(m) {
        var on = mode === m.id;
        return <span key={m.id} onClick={function() { setMode(m.id); setData(function(p) { return Object.assign({}, p, { mode: m.id }); }); }} style={{ flex: 1, padding: "14px", borderRadius: 10, cursor: "pointer", textAlign: "center", background: on ? D.amber : "transparent", border: on ? "none" : "1px solid " + D.border, color: on ? D.bg : D.txl, fontFamily: ft, fontSize: 14, fontWeight: on ? 800 : 500, transition: "all 0.15s" }}>{m.l}</span>;
      })}
    </div>
    {mode === "url" ? <input value={data.url || ""} onChange={function(e) { setData(function(p) { return Object.assign({}, p, { url: e.target.value }); }); }} placeholder="https://semianalysis.com/..." style={{ width: "100%", height: 52, padding: "0 20px", background: D.surface, border: "1px solid " + D.border, borderRadius: 10, color: D.tx, fontFamily: ft, fontSize: 15, outline: "none", boxSizing: "border-box", marginBottom: 24 }} />
    : <textarea value={data.text || ""} onChange={function(e) { setData(function(p) { return Object.assign({}, p, { text: e.target.value }); }); }} rows={8} placeholder="Paste article text..." style={{ width: "100%", minHeight: 180, padding: "16px 20px", background: D.surface, border: "1px solid " + D.border, borderRadius: 10, color: D.tx, fontFamily: ft, fontSize: 15, outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.7, marginBottom: 24 }} />}
    <button onClick={onNext} disabled={!(data.url || data.text)} style={{ width: "100%", height: 52, background: "linear-gradient(135deg, " + D.amber + ", #E8A020)", color: D.bg, border: "none", borderRadius: 10, fontFamily: ft, fontSize: 16, fontWeight: 800, cursor: "pointer", opacity: (data.url || data.text) ? 1 : 0.35, boxShadow: (data.url || data.text) ? "0 4px 20px " + D.amber + "30" : "none", transition: "all 0.2s" }}>Generate Options</button>
  </div>;
}

// ═══ STEP 2: OPTIONS ═══
function Step2({ data, setData, onNext, onBack }) {
  if (!data.options) return <div style={{ textAlign: "center", padding: 60, color: D.txl, fontFamily: ft, fontSize: 15 }}>Generating options...</div>;
  return <div>
    <div style={{ fontFamily: ft, fontSize: 42, fontWeight: 900, color: D.tx, letterSpacing: -2, marginBottom: 8 }}>Choose Direction</div>
    <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 500, color: D.txb, marginBottom: 32 }}>Pick one title, one hook, and one description.</div>
    <OptionCards label="Title" options={data.options.titles || []} selected={data.selTitle || 0} onSelect={function(i) { setData(function(p) { return Object.assign({}, p, { selTitle: i }); }); }} />
    <OptionCards label="Hook" options={data.options.hooks || []} selected={data.selHook || 0} onSelect={function(i) { setData(function(p) { return Object.assign({}, p, { selHook: i }); }); }} />
    <OptionCards label="Description" options={data.options.descriptions || []} selected={data.selDesc || 0} onSelect={function(i) { setData(function(p) { return Object.assign({}, p, { selDesc: i }); }); }} />
    <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
      <button onClick={onBack} style={{ padding: "14px 24px", background: "transparent", border: "1px solid " + D.border, color: D.txl, borderRadius: 10, fontFamily: ft, fontSize: 14, cursor: "pointer" }}>Back</button>
      <button onClick={onNext} style={{ flex: 1, height: 52, background: "linear-gradient(135deg, " + D.amber + ", #E8A020)", color: D.bg, border: "none", borderRadius: 10, fontFamily: ft, fontSize: 16, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 20px " + D.amber + "30" }}>Build Script</button>
    </div>
  </div>;
}

// ═══ STEP 3: SCRIPT (SCREENPLAY FORMAT) ═══
function Step3({ data, setData, onNext, onBack }) {
  var _dur = useState(data.duration || 60), dur = _dur[0], setDur = _dur[1];
  if (!data.scripts) return <div style={{ textAlign: "center", padding: 60, color: D.txl, fontFamily: ft, fontSize: 15 }}>Writing scripts...</div>;
  return <div>
    <div style={{ fontFamily: ft, fontSize: 42, fontWeight: 900, color: D.tx, letterSpacing: -2, marginBottom: 8 }}>Script</div>
    <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 500, color: D.txb, marginBottom: 24 }}>Choose duration and pick a script version.</div>
    {/* Duration */}
    <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
      {[{ v: 30, l: "30s", sub: "Short" }, { v: 60, l: "60s", sub: "Standard" }, { v: 120, l: "120s", sub: "Long" }].map(function(d) {
        var on = dur === d.v;
        return <div key={d.v} onClick={function() { setDur(d.v); setData(function(p) { return Object.assign({}, p, { duration: d.v }); }); }} style={{ flex: 1, padding: "18px 14px", borderRadius: 10, cursor: "pointer", textAlign: "center", background: on ? D.elevated : D.surface, border: "1px solid " + (on ? D.amber + "40" : D.border), transition: "all 0.15s" }}>
          <div style={{ fontFamily: mn, fontSize: 24, fontWeight: 900, color: on ? D.amber : D.txl }}>{d.l}</div>
          <div style={{ fontFamily: ft, fontSize: 12, color: D.txl, marginTop: 4 }}>{d.sub}</div>
        </div>;
      })}
    </div>
    {/* Script versions as screenplays */}
    {(data.scripts || []).map(function(s, si) {
      var on = (data.selScript || 0) === si;
      return <div key={si} onClick={function() { setData(function(p) { return Object.assign({}, p, { selScript: si }); }); }} style={{ marginBottom: 16, padding: "24px 28px", background: on ? D.elevated : D.surface, border: "1px solid " + (on ? D.amber + "30" : D.border), borderLeft: on ? "3px solid " + D.amber : "1px solid " + D.border, borderRadius: 12, cursor: "pointer", transition: "all 0.2s", boxShadow: on ? "0 0 24px " + D.amber + "06" : "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid " + (on ? D.amber : D.border), background: on ? D.amber : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: D.bg, fontWeight: 700 }}>{on ? "\u2713" : ""}</div>
          <span style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: on ? D.amber : D.txl }}>Version {si + 1}</span>
        </div>
        {/* Screenplay format */}
        <div style={{ fontFamily: mn, fontSize: 13, lineHeight: 2, color: D.txb }}>
          {/* Scene heading */}
          <div style={{ color: D.txl, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>INT. VIDEO - HOOK</div>
          <div style={{ paddingLeft: 0, marginBottom: 16 }}>
            <div style={{ color: D.amber, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 2, marginBottom: 2 }}>NARRATOR (V.O.)</div>
            <div style={{ paddingLeft: 20, color: D.tx, fontWeight: 500, fontFamily: ft, fontSize: 15 }}>{s.hook}</div>
          </div>
          <div style={{ color: D.txl, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>INT. VIDEO - INTRO</div>
          <div style={{ paddingLeft: 0, marginBottom: 16 }}>
            <div style={{ color: D.amber, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 2, marginBottom: 2 }}>NARRATOR (V.O.)</div>
            <div style={{ paddingLeft: 20, color: D.txb, fontFamily: ft, fontSize: 14 }}>{s.intro}</div>
          </div>
          {(s.body || []).map(function(b, bi) {
            return <div key={bi}>
              <div style={{ color: D.txl, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>INT. VIDEO - BODY {bi + 1}</div>
              <div style={{ paddingLeft: 0, marginBottom: 16 }}>
                <div style={{ color: D.blue, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 2, marginBottom: 2 }}>NARRATOR (V.O.)</div>
                <div style={{ paddingLeft: 20, color: D.txb, fontFamily: ft, fontSize: 14 }}>{b}</div>
                {s.broll && s.broll[bi] && <div style={{ paddingLeft: 20, marginTop: 6 }}>
                  <span style={{ fontFamily: mn, fontSize: 10, color: D.txh, fontStyle: "italic" }}>B-ROLL: {s.broll[bi].description}</span>
                </div>}
              </div>
            </div>;
          })}
          <div style={{ color: D.txl, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>INT. VIDEO - OUTRO</div>
          <div style={{ paddingLeft: 0 }}>
            <div style={{ color: D.teal, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 2, marginBottom: 2 }}>NARRATOR (V.O.)</div>
            <div style={{ paddingLeft: 20, color: D.txb, fontFamily: ft, fontSize: 14 }}>{s.outro}</div>
          </div>
        </div>
      </div>;
    })}
    <div style={{ display: "flex", gap: 12 }}>
      <button onClick={onBack} style={{ padding: "14px 24px", background: "transparent", border: "1px solid " + D.border, color: D.txl, borderRadius: 10, fontFamily: ft, fontSize: 14, cursor: "pointer" }}>Back</button>
      <button onClick={onNext} style={{ flex: 1, height: 52, background: "linear-gradient(135deg, " + D.amber + ", #E8A020)", color: D.bg, border: "none", borderRadius: 10, fontFamily: ft, fontSize: 16, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 20px " + D.amber + "30" }}>Review</button>
    </div>
  </div>;
}

// ═══ STEP 4: REVIEW ═══
function Step4({ data, onNext, onBack }) {
  var script = data.scripts && data.scripts[data.selScript || 0];
  if (!script) return null;
  return <div>
    <div style={{ fontFamily: ft, fontSize: 42, fontWeight: 900, color: D.tx, letterSpacing: -2, marginBottom: 8 }}>Review</div>
    <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 500, color: D.txb, marginBottom: 28 }}>Script and b-roll side by side.</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      {/* VO Script */}
      <div>
        <div style={{ fontFamily: ft, fontSize: 10, fontWeight: 600, color: D.amber, letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 }}>Voiceover</div>
        {[{ l: "HOOK", t: script.hook, c: D.amber }, { l: "INTRO", t: script.intro, c: D.txl }].concat(
          (script.body || []).map(function(b, i) { return { l: "BODY " + (i + 1), t: b, c: D.txl }; }),
          [{ l: "OUTRO", t: script.outro, c: D.teal }]
        ).map(function(s, i) {
          return <div key={i} style={{ padding: "16px 20px", background: D.surface, border: "1px solid " + D.border, borderRadius: 10, marginBottom: 10 }}>
            <div style={{ fontFamily: mn, fontSize: 10, fontWeight: 600, color: s.c, letterSpacing: 2, marginBottom: 6 }}>{s.l}</div>
            <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 500, color: D.txb, lineHeight: 1.8 }}>{s.t}</div>
          </div>;
        })}
      </div>
      {/* B-Roll */}
      <div>
        <div style={{ fontFamily: ft, fontSize: 10, fontWeight: 600, color: D.blue, letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 }}>B-Roll Shots</div>
        {(script.broll || []).map(function(shot, i) {
          return <div key={i} style={{ padding: "16px 20px", background: D.surface, border: "1px solid " + D.border, borderRadius: 10, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontFamily: mn, fontSize: 10, fontWeight: 600, color: D.blue, letterSpacing: 1 }}>SHOT {i + 1}</span>
              <span style={{ fontFamily: mn, fontSize: 10, color: D.txh }}>{shot.timing}</span>
            </div>
            <div style={{ fontFamily: ft, fontSize: 13, fontWeight: 500, color: D.txb, fontStyle: "italic", marginBottom: 6 }}>{shot.description}</div>
            <div style={{ fontFamily: mn, fontSize: 11, color: D.txl, padding: "10px 12px", background: D.bg, borderRadius: 6 }}>{shot.prompt}</div>
            {shot.camera && <div style={{ fontFamily: mn, fontSize: 10, color: D.txh, marginTop: 4 }}>CAMERA: {shot.camera}</div>}
          </div>;
        })}
      </div>
    </div>
    <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
      <button onClick={onBack} style={{ padding: "14px 24px", background: "transparent", border: "1px solid " + D.border, color: D.txl, borderRadius: 10, fontFamily: ft, fontSize: 14, cursor: "pointer" }}>Back</button>
      <button onClick={onNext} style={{ flex: 1, height: 52, background: "linear-gradient(135deg, " + D.amber + ", #E8A020)", color: D.bg, border: "none", borderRadius: 10, fontFamily: ft, fontSize: 16, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 20px " + D.amber + "30" }}>Choose Format</button>
    </div>
  </div>;
}

// ═══ STEP 5: FORMAT ═══
function Step5({ data, setData, onNext, onBack }) {
  var _aspect = useState(data.aspect || "16:9"), aspect = _aspect[0], setAspect = _aspect[1];
  var formats = [
    { id: "16:9", l: "Landscape", sub: "YouTube, LinkedIn, X", w: 160, h: 90 },
    { id: "9:16", l: "Vertical", sub: "Shorts, Reels, TikTok", w: 56, h: 100 },
    { id: "1:1", l: "Square", sub: "Instagram, Facebook", w: 100, h: 100 },
  ];
  return <div>
    <div style={{ fontFamily: ft, fontSize: 42, fontWeight: 900, color: D.tx, letterSpacing: -2, marginBottom: 8 }}>Format</div>
    <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 500, color: D.txb, marginBottom: 28 }}>Select aspect ratio.</div>
    <div style={{ display: "flex", gap: 16, marginBottom: 32 }}>
      {formats.map(function(f) {
        var on = aspect === f.id;
        return <div key={f.id} onClick={function() { setAspect(f.id); setData(function(p) { return Object.assign({}, p, { aspect: f.id }); }); }} style={{ flex: 1, padding: "24px 16px", borderRadius: 12, cursor: "pointer", background: D.surface, border: on ? "2px solid " + D.amber : "1px solid " + D.border, textAlign: "center", transition: "all 0.2s", boxShadow: on ? "0 0 24px " + D.amber + "10" : "none" }}>
          <div style={{ width: f.w * 0.7, height: f.h * 0.7, margin: "0 auto 14px", background: D.bg, border: "1px solid " + D.border, borderRadius: 6 }} />
          <div style={{ fontFamily: ft, fontSize: 16, fontWeight: 800, color: on ? D.amber : D.tx }}>{f.l}</div>
          <div style={{ fontFamily: ft, fontSize: 12, fontWeight: 500, color: D.txl, marginTop: 4 }}>{f.id} // {f.sub}</div>
        </div>;
      })}
    </div>
    <div style={{ display: "flex", gap: 12 }}>
      <button onClick={onBack} style={{ padding: "14px 24px", background: "transparent", border: "1px solid " + D.border, color: D.txl, borderRadius: 10, fontFamily: ft, fontSize: 14, cursor: "pointer" }}>Back</button>
      <button onClick={onNext} style={{ flex: 1, height: 52, background: "linear-gradient(135deg, " + D.amber + ", #E8A020)", color: D.bg, border: "none", borderRadius: 10, fontFamily: ft, fontSize: 16, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 20px " + D.amber + "30" }}>Produce</button>
    </div>
  </div>;
}

// ═══ STEP 6: PRODUCE (REAL API CALLS) ═══
function Step6({ data, setData, onNext, onBack }) {
  var _phase = useState("idle"), phase = _phase[0], setPhase = _phase[1]; // idle, vo, broll, music, done, error
  var _log = useState([]), log = _log[0], setLog = _log[1];
  var _assets = useState({ voiceover: null, clips: [], music: null }), assets = _assets[0], setAssets = _assets[1];
  var logRef = useRef(null);
  var started = useRef(false);
  // Use refs to track final values since setState is async
  var voRef = useRef(null);
  var musicRef = useRef(null);

  var addLog = function(msg, type) { setLog(function(p) { return p.concat([{ msg: msg, type: type || "info", ts: new Date().toLocaleTimeString() }]); }); };

  useEffect(function() { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log]);

  var script = data.scripts && data.scripts[data.selScript || 0];
  var fullScript = script ? (script.hook || "") + "\n\n" + (script.intro || "") + "\n\n" + (script.body || []).join("\n\n") + "\n\n" + (script.outro || "") : "";

  var startProduction = async function() {
    if (started.current) return;
    started.current = true;

    // ═══ STEP 1: VOICEOVER ═══
    setPhase("vo");
    addLog("Starting voiceover generation...", "info");
    addLog("Script length: " + fullScript.length + " chars", "dim");
    try {
      var voR = await fetch("/api/generate-voiceover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: fullScript }) });
      var voD = await voR.json();
      if (voD.audio) {
        voRef.current = voD.audio;
        setAssets(function(p) { return Object.assign({}, p, { voiceover: voD.audio }); });
        addLog("Voiceover generated successfully (" + Math.round(voD.audio.length / 1024) + "KB)", "success");
      } else {
        addLog("Voiceover error: " + (voD.error || "Unknown"), "error");
      }
    } catch (e) { addLog("Voiceover failed: " + String(e).slice(0, 80), "error"); }

    // ═══ STEP 2: B-ROLL ═══
    setPhase("broll");
    var brollShots = script && script.broll ? script.broll : [];
    addLog("Submitting all " + brollShots.length + " b-roll shots in parallel...", "info");

    // Submit ALL clips at once (parallel)
    var clips = await Promise.all(brollShots.map(async function(shot, idx) {
      try {
        var r = await fetch("/api/generate-clip", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "generate", prompt: shot.prompt, engine: "grok" }) });
        var d = await r.json();
        if (d.task && d.task.task_id) {
          addLog("Shot " + (idx + 1) + " submitted (ID: " + d.task.task_id.slice(0, 10) + "...)", "success");
          return { taskId: d.task.task_id, shot: idx + 1, pending: true, provider: "grok", progress: 0 };
        }
        addLog("Shot " + (idx + 1) + " error: " + (d.error || "Unknown"), "error");
        return { error: d.error, shot: idx + 1 };
      } catch (e) {
        addLog("Shot " + (idx + 1) + " failed: " + String(e).slice(0, 50), "error");
        return { error: String(e), shot: idx + 1 };
      }
    }));

    addLog(clips.filter(function(c) { return c.taskId; }).length + " shots submitted. Polling...", "info");

    // Poll ALL clips together until done or 3 min timeout
    var pollStart = Date.now();
    while (Date.now() - pollStart < 180000) {
      var stillPending = clips.filter(function(c) { return c.pending; });
      if (stillPending.length === 0) break;

      await new Promise(function(res) { setTimeout(res, 8000); });

      for (var pi = 0; pi < clips.length; pi++) {
        if (!clips[pi].pending) continue;
        try {
          var stR = await fetch("/api/generate-clip", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status", taskId: clips[pi].taskId, engine: "grok" }) });
          var stD = await stR.json();
          if (stD.task && stD.task.task_status === "succeed" && stD.task.task_result && stD.task.task_result.videos) {
            clips[pi] = Object.assign({}, clips[pi], { videoUrl: stD.task.task_result.videos[0].url, pending: false, progress: 100 });
            addLog("Shot " + clips[pi].shot + " ready!", "success");
          } else if (stD.task && stD.task.task_status === "failed") {
            clips[pi] = Object.assign({}, clips[pi], { pending: false, error: "Failed" });
            addLog("Shot " + clips[pi].shot + " failed.", "error");
          } else {
            var pct = stD.task && stD.task.progress ? stD.task.progress : 0;
            clips[pi] = Object.assign({}, clips[pi], { progress: pct });
          }
        } catch (pe) { /* keep polling */ }
      }

      var done = clips.filter(function(c) { return c.videoUrl; }).length;
      var left = clips.filter(function(c) { return c.pending; }).length;
      var elapsed = Math.round((Date.now() - pollStart) / 1000);
      if (left > 0) addLog(done + "/" + clips.length + " done, " + left + " rendering... (" + elapsed + "s)", "dim");
    }

    var completed = clips.filter(function(c) { return c.videoUrl; }).length;
    var pendingLeft = clips.filter(function(c) { return c.pending; }).length;
    addLog(completed + " clips ready" + (pendingLeft > 0 ? ", " + pendingLeft + " still rendering" : " -- all done!"), completed === clips.length ? "success" : "warn");
    setAssets(function(p) { return Object.assign({}, p, { clips: clips }); });

    // ═══ STEP 3: MUSIC ═══
    setPhase("music");
    addLog("Generating background music...", "info");
    try {
      var muR = await fetch("/api/generate-music", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: "seamless loopable ambient tech background music, cinematic, minimal, dark tone, smooth fade in and fade out for perfect loop, suitable for semiconductor industry video", duration: 30 }) });
      var muD = await muR.json();
      if (muD.audio) {
        musicRef.current = muD.audio;
        setAssets(function(p) { return Object.assign({}, p, { music: muD.audio }); });
        addLog("Music generated (" + Math.round(muD.audio.length / 1024) + "KB)", "success");
      } else {
        addLog("Music: " + (muD.error || "Not available"), "warn");
      }
    } catch (e) { addLog("Music failed: " + String(e).slice(0, 60), "warn"); }

    // ═══ DONE ═══
    setPhase("done");
    addLog("Production complete.", "success");

    // Save assets to data using refs (state may not be updated yet)
    setData(function(p) { return Object.assign({}, p, { assets: { voiceover: voRef.current, clips: clips, music: musicRef.current } }); });
  };

  var stepList = [
    { id: "vo", l: "Voiceover", sub: "ElevenLabs TTS" },
    { id: "broll", l: "B-Roll Clips", sub: "Grok Imagine Video" },
    { id: "music", l: "Background Music", sub: "ElevenLabs" },
  ];
  var phaseOrder = ["idle", "vo", "broll", "music", "done"];
  var phaseIdx = phaseOrder.indexOf(phase);

  return <div>
    <div style={{ fontFamily: ft, fontSize: 42, fontWeight: 900, color: D.tx, letterSpacing: -2, marginBottom: 8 }}>Producing</div>
    <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 500, color: D.txb, marginBottom: 28 }}>Generating assets for your video.</div>

    <style dangerouslySetInnerHTML={{ __html: "@keyframes pp{0%,100%{opacity:0.3}50%{opacity:1}}" }} />

    {/* Steps */}
    <div style={{ marginBottom: 24 }}>
      {stepList.map(function(s, i) {
        var stepPhaseIdx = i + 1; // vo=1, broll=2, music=3
        var done = phaseIdx > stepPhaseIdx;
        var active = phaseIdx === stepPhaseIdx;
        var waiting = phaseIdx < stepPhaseIdx;
        return <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 20px", background: active ? D.surface : "transparent", border: active ? "1px solid " + D.amber + "20" : "1px solid transparent", borderRadius: 10, marginBottom: 8, transition: "all 0.2s" }}>
          <div style={{ width: 20, height: 20, borderRadius: "50%", background: done ? D.teal : active ? D.amber : D.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", animation: active ? "pp 1.2s ease infinite" : "none", flexShrink: 0, boxShadow: done ? "0 0 10px " + D.teal + "40" : active ? "0 0 10px " + D.amber + "40" : "none" }}>{done ? "\u2713" : ""}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 600, color: done ? D.teal : active ? D.amber : D.txl }}>{s.l}</div>
            <div style={{ fontFamily: ft, fontSize: 11, fontWeight: 500, color: D.txh }}>{s.sub}</div>
          </div>
          {done && <span style={{ fontFamily: ft, fontSize: 11, fontWeight: 600, color: D.teal }}>Complete</span>}
          {active && <span style={{ fontFamily: ft, fontSize: 11, fontWeight: 600, color: D.amber }}>In progress...</span>}
        </div>;
      })}
    </div>

    {/* Start button or completion */}
    {phase === "idle" && <button onClick={startProduction} style={{ width: "100%", height: 52, background: "linear-gradient(135deg, " + D.amber + ", #E8A020)", color: D.bg, border: "none", borderRadius: 10, fontFamily: ft, fontSize: 16, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 20px " + D.amber + "30", marginBottom: 20 }}>Start Production</button>}

    {phase === "done" && <button onClick={onNext} style={{ width: "100%", height: 52, background: "linear-gradient(135deg, " + D.amber + ", " + D.teal + ")", color: D.bg, border: "none", borderRadius: 10, fontFamily: ft, fontSize: 16, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 20px " + D.teal + "30", marginBottom: 20 }}>Review Output</button>}

    {/* Live log */}
    <div style={{ background: D.bg, border: "1px solid " + D.border, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid " + D.border, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: ft, fontSize: 10, fontWeight: 600, color: D.txl, letterSpacing: 2, textTransform: "uppercase" }}>Production Log</span>
        <span style={{ fontFamily: mn, fontSize: 9, color: D.txh }}>{log.length} entries</span>
      </div>
      <div ref={logRef} style={{ maxHeight: 240, overflow: "auto", padding: "8px 16px" }}>
        {log.length === 0 && <div style={{ fontFamily: ft, fontSize: 12, fontWeight: 500, color: D.txh, padding: "12px 0" }}>Click "Start Production" to begin.</div>}
        {log.map(function(entry, i) {
          var colors = { info: D.txb, success: D.teal, error: D.coral, warn: D.amber, dim: D.txl };
          return <div key={i} style={{ display: "flex", gap: 8, padding: "4px 0", fontFamily: mn, fontSize: 11 }}>
            <span style={{ color: D.txh, flexShrink: 0 }}>{entry.ts}</span>
            <span style={{ color: colors[entry.type] || D.txb }}>{entry.msg}</span>
          </div>;
        })}
      </div>
    </div>

    {phase !== "idle" && phase !== "done" && <div style={{ marginTop: 16, textAlign: "center" }}>
      <span style={{ fontFamily: ft, fontSize: 12, fontWeight: 500, color: D.txh }}>Do not close this page. Production in progress.</span>
    </div>}
  </div>;
}

// ═══ CLIP GRID WITH RETRY ═══
function ClipGrid({ clips, script, onUpdate }) {
  var _checking = useState({}), checking = _checking[0], setChecking = _checking[1];

  var checkClip = async function(idx) {
    var clip = clips[idx];
    if (!clip.taskId) return;
    setChecking(function(p) { var n = Object.assign({}, p); n[idx] = true; return n; });
    try {
      var r = await fetch("/api/generate-clip", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status", taskId: clip.taskId, engine: clip.provider || "grok" }) });
      var d = await r.json();
      if (d.task && d.task.task_status === "succeed" && d.task.task_result && d.task.task_result.videos) {
        var updated = clips.slice();
        updated[idx] = Object.assign({}, clip, { videoUrl: d.task.task_result.videos[0].url, pending: false });
        onUpdate(updated);
        toast("Shot " + clip.shot + " ready!", "success");
      } else if (d.task && d.task.task_status === "failed") {
        toast("Shot " + clip.shot + " failed to render", "error");
      } else {
        toast("Shot " + clip.shot + " still rendering...", "info");
      }
    } catch (e) { toast("Check failed: " + String(e).slice(0, 50), "error"); }
    setChecking(function(p) { var n = Object.assign({}, p); n[idx] = false; return n; });
  };

  var checkAll = async function() {
    for (var i = 0; i < clips.length; i++) {
      if (clips[i].pending || (clips[i].taskId && !clips[i].videoUrl)) await checkClip(i);
    }
  };

  var pendingCount = clips.filter(function(c) { return c.pending || (c.taskId && !c.videoUrl && !c.error); }).length;

  return <div>
    {pendingCount > 0 && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <span style={{ fontFamily: ft, fontSize: 12, fontWeight: 500, color: D.amber }}>{pendingCount} clip{pendingCount > 1 ? "s" : ""} still rendering</span>
      <button onClick={checkAll} style={{ padding: "8px 16px", background: "transparent", border: "1px solid " + D.amber + "30", color: D.amber, borderRadius: 8, fontFamily: ft, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Check All</button>
    </div>}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
      {clips.map(function(clip, i) {
        var isChecking = checking[i];
        return <div key={i} style={{ background: D.bg, border: "1px solid " + D.border, borderRadius: 8, padding: 12, transition: "all 0.2s" }}>
          <div style={{ aspectRatio: "16/9", background: D.elevated, borderRadius: 6, marginBottom: 8, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {clip.videoUrl ? <video controls src={clip.videoUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span style={{ fontFamily: ft, fontSize: 11, fontWeight: 500, color: clip.pending ? D.amber : clip.error ? D.coral : D.teal }}>{clip.pending ? "Rendering..." : clip.error ? "Failed" : "Submitted"}</span>}
          </div>
          <div style={{ fontFamily: ft, fontSize: 12, fontWeight: 600, color: D.tx }}>Shot {clip.shot}</div>
          {clip.taskId && <div style={{ fontFamily: mn, fontSize: 9, color: D.txh, marginTop: 2 }}>ID: {clip.taskId.slice(0, 16)}...</div>}
          {clip.error && <div style={{ fontFamily: ft, fontSize: 10, fontWeight: 500, color: D.coral, marginTop: 2 }}>{String(clip.error).slice(0, 40)}</div>}
          {script && script.broll && script.broll[i] && <div style={{ fontFamily: ft, fontSize: 10, fontWeight: 500, color: D.txl, marginTop: 4 }}>{script.broll[i].description}</div>}
          {/* Retry/Check button for pending or submitted clips */}
          {(clip.pending || (clip.taskId && !clip.videoUrl)) && <button onClick={function() { checkClip(i); }} disabled={isChecking} style={{ marginTop: 8, width: "100%", padding: "6px", background: "transparent", border: "1px solid " + D.amber + "30", color: D.amber, borderRadius: 6, fontFamily: ft, fontSize: 11, fontWeight: 600, cursor: isChecking ? "wait" : "pointer", opacity: isChecking ? 0.5 : 1 }}>{isChecking ? "Checking..." : "Check Status"}</button>}
          {clip.videoUrl && <a href={clip.videoUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", marginTop: 8, textAlign: "center", padding: "6px", background: "transparent", border: "1px solid " + D.teal + "30", color: D.teal, borderRadius: 6, fontFamily: ft, fontSize: 11, fontWeight: 600, textDecoration: "none" }}>Download</a>}
        </div>;
      })}
    </div>
  </div>;
}

// ═══ VOICE SELECTOR ═══
function VoiceSelector({ assets, data, setData }) {
  var _voices = useState([]), voices = _voices[0], setVoices = _voices[1];
  var _selVoice = useState("JBFqnCBsd6RMkjVDRZzb"), selVoice = _selVoice[0], setSelVoice = _selVoice[1];
  var _regenning = useState(false), regenning = _regenning[0], setRegenning = _regenning[1];

  useEffect(function() {
    fetch("/api/generate-voiceover").then(function(r) { return r.json(); }).then(function(d) { if (d.voices) setVoices(d.voices.slice(0, 8)); });
  }, []);

  var regen = async function() {
    setRegenning(true);
    var script = data.scripts && data.scripts[data.selScript || 0];
    var fullScript = script ? (script.hook || "") + "\n\n" + (script.intro || "") + "\n\n" + (script.body || []).join("\n\n") + "\n\n" + (script.outro || "") : "";
    try {
      var r = await fetch("/api/generate-voiceover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: fullScript, voiceId: selVoice }) });
      var d = await r.json();
      if (d.audio) {
        setData(function(p) { var a = Object.assign({}, p.assets || {}, { voiceover: d.audio }); return Object.assign({}, p, { assets: a }); });
        toast("Voiceover regenerated!", "success");
      } else { toast(d.error || "Failed", "error"); }
    } catch (e) { toast("Failed: " + String(e).slice(0, 50), "error"); }
    setRegenning(false);
  };

  return <div style={{ background: D.surface, border: "1px solid " + D.border, borderRadius: 12, padding: 20, marginBottom: 20 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <div style={{ fontFamily: ft, fontSize: 10, fontWeight: 600, color: D.amber, letterSpacing: 3, textTransform: "uppercase" }}>Voiceover</div>
      <button onClick={regen} disabled={regenning} style={{ padding: "6px 14px", background: "transparent", border: "1px solid " + D.amber + "30", color: D.amber, borderRadius: 8, fontFamily: ft, fontSize: 11, fontWeight: 600, cursor: regenning ? "wait" : "pointer", opacity: regenning ? 0.5 : 1 }}>{regenning ? "Regenerating..." : "Regenerate"}</button>
    </div>
    {assets.voiceover ? <audio controls src={assets.voiceover} style={{ width: "100%", height: 44, marginBottom: 12 }} />
    : <div style={{ fontFamily: ft, fontSize: 13, color: D.txl, marginBottom: 12 }}>No voiceover yet.</div>}
    {voices.length > 0 && <div>
      <div style={{ fontFamily: ft, fontSize: 10, fontWeight: 600, color: D.txl, letterSpacing: 2, marginBottom: 8 }}>CHANGE VOICE</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
        {voices.map(function(v) {
          var on = selVoice === v.id;
          return <div key={v.id} onClick={function() { setSelVoice(v.id); }} style={{ padding: "8px 6px", borderRadius: 8, cursor: "pointer", textAlign: "center", background: on ? D.amber + "12" : D.bg, border: on ? "1px solid " + D.amber + "40" : "1px solid " + D.border, transition: "all 0.15s" }}>
            <div style={{ fontFamily: ft, fontSize: 11, fontWeight: on ? 700 : 500, color: on ? D.amber : D.txb }}>{v.name.split(" - ")[0]}</div>
            <div style={{ fontFamily: ft, fontSize: 8, color: D.txl }}>{(v.name.split(" - ")[1] || "").slice(0, 20)}</div>
          </div>;
        })}
      </div>
    </div>}
  </div>;
}

// ═══ STEP 7: SELECT CLIPS ═══
function Step7({ data, setData, onNext, onBack }) {
  var assets = data.assets || {};
  var clips = assets.clips || [];
  var script = data.scripts && data.scripts[data.selScript || 0];
  var brollShots = script && script.broll ? script.broll : [];

  // Group clips by shot number
  var shotGroups = {};
  clips.forEach(function(c) { var s = c.shot || 1; if (!shotGroups[s]) shotGroups[s] = []; shotGroups[s].push(c); });

  var _sel = useState(data.selectedClips || {}), sel = _sel[0], setSel = _sel[1];

  var selectClip = function(shotNum, clipIdx) {
    setSel(function(p) { var n = Object.assign({}, p); n[shotNum] = clipIdx; return n; });
    setData(function(p) { var n = Object.assign({}, p); n.selectedClips = Object.assign({}, sel, {}); n.selectedClips[shotNum] = clipIdx; return n; });
  };

  return <div>
    <div style={{ fontFamily: ft, fontSize: 42, fontWeight: 900, color: D.tx, letterSpacing: -2, marginBottom: 8 }}>Select Clips</div>
    <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 500, color: D.txb, marginBottom: 28 }}>Choose which variation to use for each shot.</div>

    {/* Voiceover with voice swap */}
    <VoiceSelector assets={assets} data={data} setData={setData} addLog={function() {}} />

    {/* Clips grouped by shot */}
    {Object.keys(shotGroups).sort(function(a, b) { return a - b; }).map(function(shotNum) {
      var group = shotGroups[shotNum];
      var shotIdx = parseInt(shotNum) - 1;
      var shotInfo = brollShots[shotIdx];
      var selected = sel[shotNum] !== undefined ? sel[shotNum] : 0;

      return <div key={shotNum} style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <span style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: D.tx }}>Shot {shotNum}</span>
          {shotInfo && <span style={{ fontFamily: ft, fontSize: 12, fontWeight: 500, color: D.txl }}>// {shotInfo.description}</span>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(" + group.length + ", 1fr)", gap: 10 }}>
          {group.map(function(clip, ci) {
            var isSelected = selected === ci;
            return <div key={ci} onClick={function() { selectClip(shotNum, ci); }} style={{ background: isSelected ? D.elevated : D.surface, border: isSelected ? "2px solid " + D.amber : "1px solid " + D.border, borderRadius: 10, padding: 10, cursor: "pointer", transition: "all 0.2s", boxShadow: isSelected ? "0 0 16px " + D.amber + "10" : "none" }}>
              <div style={{ aspectRatio: "16/9", background: D.bg, borderRadius: 6, marginBottom: 8, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {clip.videoUrl ? <video src={clip.videoUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} onMouseEnter={function(e) { e.target.play(); }} onMouseLeave={function(e) { e.target.pause(); e.target.currentTime = 0; }} muted />
                : <span style={{ fontFamily: ft, fontSize: 11, color: clip.pending ? D.amber : D.coral }}>{clip.pending ? "Rendering..." : "Failed"}</span>}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: ft, fontSize: 11, fontWeight: 600, color: isSelected ? D.amber : D.txl }}>V{clip.variation || ci + 1}</span>
                {isSelected && <span style={{ fontFamily: ft, fontSize: 9, fontWeight: 700, color: D.amber, padding: "2px 6px", background: D.amber + "15", borderRadius: 4 }}>Selected</span>}
              </div>
            </div>;
          })}
        </div>
      </div>;
    })}

    {/* Music */}
    {assets.music && <div style={{ background: D.surface, border: "1px solid " + D.border, borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <div style={{ fontFamily: ft, fontSize: 10, fontWeight: 600, color: D.violet, letterSpacing: 3, textTransform: "uppercase", marginBottom: 10 }}>Background Music</div>
      <audio controls loop src={assets.music} style={{ width: "100%", height: 44 }} />
    </div>}

    <div style={{ display: "flex", gap: 12 }}>
      <button onClick={onBack} style={{ padding: "14px 24px", background: "transparent", border: "1px solid " + D.border, color: D.txl, borderRadius: 10, fontFamily: ft, fontSize: 14, cursor: "pointer" }}>Back</button>
      <button onClick={onNext} style={{ flex: 1, height: 52, background: "linear-gradient(135deg, " + D.amber + ", #E8A020)", color: D.bg, border: "none", borderRadius: 10, fontFamily: ft, fontSize: 16, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 20px " + D.amber + "30" }}>Preview Video</button>
    </div>
  </div>;
}

// ═══ STEP 8: PREVIEW ═══
function Step8({ data, onNext, onBack }) {
  var assets = data.assets || {};
  var script = data.scripts && data.scripts[data.selScript || 0];
  var aspect = data.aspect || "16:9";

  return <div>
    <div style={{ fontFamily: ft, fontSize: 42, fontWeight: 900, color: D.tx, letterSpacing: -2, marginBottom: 8 }}>Preview</div>
    <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 500, color: D.txb, marginBottom: 28 }}>Watch your assembled video.</div>

    {/* Assembled preview */}
    <div style={{ background: D.surface, border: "1px solid " + D.border, borderRadius: 12, padding: 24, marginBottom: 20 }}>
      <div style={{ width: aspect === "9:16" ? "35%" : "100%", margin: "0 auto", aspectRatio: aspect === "9:16" ? "9/16" : aspect === "1:1" ? "1/1" : "16/9", background: D.bg, borderRadius: 10, border: "1px solid " + D.border, overflow: "hidden", position: "relative" }}>
        {/* Show first selected clip as preview */}
        {assets.clips && assets.clips[0] && assets.clips[0].videoUrl ? <video controls src={assets.clips[0].videoUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
          <span style={{ fontFamily: ft, fontSize: 15, fontWeight: 500, color: D.txl }}>Preview ({aspect})</span>
        </div>}
      </div>
      {assets.voiceover && <div style={{ marginTop: 16 }}>
        <div style={{ fontFamily: ft, fontSize: 10, fontWeight: 600, color: D.txl, letterSpacing: 2, marginBottom: 6 }}>VOICEOVER</div>
        <audio controls src={assets.voiceover} style={{ width: "100%", height: 40 }} />
      </div>}
      {assets.music && <div style={{ marginTop: 12 }}>
        <div style={{ fontFamily: ft, fontSize: 10, fontWeight: 600, color: D.txl, letterSpacing: 2, marginBottom: 6 }}>MUSIC</div>
        <audio controls loop src={assets.music} style={{ width: "100%", height: 40 }} />
      </div>}
    </div>

    {/* Metadata */}
    {data.options && <div style={{ background: D.surface, border: "1px solid " + D.border, borderRadius: 12, padding: 24, marginBottom: 20 }}>
      <div style={{ fontFamily: ft, fontSize: 10, fontWeight: 600, color: D.txl, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Metadata</div>
      <div style={{ fontFamily: ft, fontSize: 18, fontWeight: 800, color: D.tx, marginBottom: 8 }}>{data.options.titles[data.selTitle || 0]}</div>
      <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 500, color: D.txb, lineHeight: 1.7 }}>{data.options.descriptions[data.selDesc || 0]}</div>
    </div>}

    <div style={{ display: "flex", gap: 12 }}>
      <button onClick={onBack} style={{ padding: "14px 24px", background: "transparent", border: "1px solid " + D.border, color: D.txl, borderRadius: 10, fontFamily: ft, fontSize: 14, cursor: "pointer" }}>Back to Select</button>
      <button onClick={onNext} style={{ flex: 1, height: 52, background: "linear-gradient(135deg, " + D.amber + ", " + D.teal + ")", color: D.bg, border: "none", borderRadius: 10, fontFamily: ft, fontSize: 16, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 20px " + D.teal + "30" }}>Premier</button>
    </div>
  </div>;
}

// ═══ STEP 9: PREMIER ═══
function Step9({ data, onPremier, onDraft }) {
  var assets = data.assets || {};
  var title = data.options ? data.options.titles[data.selTitle || 0] : "Untitled";

  var downloadAll = function() {
    // Download voiceover
    if (assets.voiceover) { var a = document.createElement("a"); a.href = assets.voiceover; a.download = "voiceover.mp3"; a.click(); }
    // Download music
    if (assets.music) { setTimeout(function() { var a = document.createElement("a"); a.href = assets.music; a.download = "music.mp3"; a.click(); }, 500); }
    // Download clips
    (assets.clips || []).forEach(function(c, i) {
      if (c.videoUrl) { setTimeout(function() { var a = document.createElement("a"); a.href = c.videoUrl; a.download = "shot-" + c.shot + "-v" + (c.variation || 1) + ".mp4"; a.target = "_blank"; a.click(); }, 1000 + i * 500); }
    });
    toast("Downloading all assets...", "info");
  };

  var sendToBuffer = function() {
    var desc = data.options ? data.options.descriptions[data.selDesc || 0] : "";
    // Save to localStorage for Buffer schedule to pick up
    try {
      var bufferDraft = { text: title + "\n\n" + desc, source: "Press to Premier", ts: Date.now() };
      localStorage.setItem("p2p-to-buffer", JSON.stringify(bufferDraft));
    } catch (e) {}
    toast("Saved for Buffer. Go to Schedule to post.", "success");
  };

  return <div>
    <div style={{ fontFamily: ft, fontSize: 42, fontWeight: 900, color: D.tx, letterSpacing: -2, marginBottom: 8 }}>Premier</div>
    <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 500, color: D.txb, marginBottom: 28 }}>Finalize and launch your video.</div>

    {/* Summary card */}
    <div style={{ background: "linear-gradient(135deg, " + D.elevated + ", " + D.surface + ")", border: "1px solid " + D.amber + "20", borderRadius: 12, padding: 28, marginBottom: 24 }}>
      <div style={{ fontFamily: ft, fontSize: 10, fontWeight: 600, color: D.amber, letterSpacing: 3, textTransform: "uppercase", marginBottom: 10 }}>Project Summary</div>
      <div style={{ fontFamily: ft, fontSize: 22, fontWeight: 800, color: D.tx, marginBottom: 8 }}>{title}</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        {[
          { l: "Duration", v: (data.duration || 60) + "s" },
          { l: "Format", v: data.aspect || "16:9" },
          { l: "VO", v: assets.voiceover ? "Ready" : "Missing", c: assets.voiceover ? D.teal : D.coral },
          { l: "Clips", v: (assets.clips || []).filter(function(c) { return c.videoUrl; }).length + " ready", c: D.teal },
          { l: "Music", v: assets.music ? "Ready" : "Missing", c: assets.music ? D.teal : D.coral },
        ].map(function(s, i) {
          return <div key={i} style={{ padding: "8px 14px", background: D.bg, borderRadius: 8, border: "1px solid " + D.border }}>
            <div style={{ fontFamily: ft, fontSize: 9, fontWeight: 600, color: D.txh, letterSpacing: 1 }}>{s.l}</div>
            <div style={{ fontFamily: ft, fontSize: 13, fontWeight: 700, color: s.c || D.tx }}>{s.v}</div>
          </div>;
        })}
      </div>
      {data.options && <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 500, color: D.txb, lineHeight: 1.7 }}>{data.options.descriptions[data.selDesc || 0]}</div>}
    </div>

    {/* Actions */}
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
      <button onClick={downloadAll} style={{ width: "100%", height: 52, background: D.surface, border: "1px solid " + D.border, borderRadius: 10, fontFamily: ft, fontSize: 15, fontWeight: 700, color: D.tx, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.15s" }} onMouseEnter={function(e) { e.currentTarget.style.borderColor = D.amber + "40"; }} onMouseLeave={function(e) { e.currentTarget.style.borderColor = D.border; }}>
        Download All Assets
      </button>
      <button onClick={function() {
        toast("Submitting render job to GitHub Actions...", "info");
        var script = data.scripts && data.scripts[data.selScript || 0];
        var selectedClips = data.selectedClips || {};
        var clipUrls = [];
        if (assets.clips) {
          var shotGroups = {};
          assets.clips.forEach(function(c) { var s = c.shot || 1; if (!shotGroups[s]) shotGroups[s] = []; shotGroups[s].push(c); });
          Object.keys(shotGroups).sort().forEach(function(s) { var sel = selectedClips[s] || 0; var clip = shotGroups[s][sel]; if (clip && clip.videoUrl) clipUrls.push(clip.videoUrl); });
        }
        fetch("/api/render-video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          hook: data.options ? data.options.hooks[data.selHook || 0] : "",
          scriptSections: script ? [{ label: "INTRO", text: script.intro }].concat((script.body || []).map(function(b, i) { return { label: "BODY " + (i + 1), text: b }; })).concat([{ label: "OUTRO", text: script.outro }]) : [],
          dataPoints: [],
          thumbnailHeadline: data.options ? data.options.titles[data.selTitle || 0] : "",
          audioUrl: assets.voiceover || "",
          clipUrls: clipUrls,
          musicUrl: assets.music || "",
          duration: data.duration || 60,
          aspectRatio: data.aspect || "16:9",
        }) }).then(function(r) { return r.json(); }).then(function(d) {
          if (d.renderId) toast("Render submitted! ID: " + d.renderId + ". Check GitHub Actions.", "success");
          else toast("Render error: " + (d.error || "Unknown"), "error");
        }).catch(function(e) { toast("Render failed: " + String(e).slice(0, 60), "error"); });
      }} style={{ width: "100%", height: 52, background: D.surface, border: "1px solid " + D.border, borderRadius: 10, fontFamily: ft, fontSize: 15, fontWeight: 700, color: D.tx, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.15s" }} onMouseEnter={function(e) { e.currentTarget.style.borderColor = D.violet + "40"; }} onMouseLeave={function(e) { e.currentTarget.style.borderColor = D.border; }}>
        Render MP4 (GitHub Actions)
      </button>
      <button onClick={sendToBuffer} style={{ width: "100%", height: 52, background: D.surface, border: "1px solid " + D.border, borderRadius: 10, fontFamily: ft, fontSize: 15, fontWeight: 700, color: D.tx, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.15s" }} onMouseEnter={function(e) { e.currentTarget.style.borderColor = D.blue + "40"; }} onMouseLeave={function(e) { e.currentTarget.style.borderColor = D.border; }}>
        Send to Buffer Schedule
      </button>
    </div>

    <div style={{ display: "flex", gap: 12 }}>
      <button onClick={onDraft} style={{ padding: "14px 24px", background: "transparent", border: "1px solid " + D.border, color: D.txl, borderRadius: 10, fontFamily: ft, fontSize: 14, cursor: "pointer" }}>Save as Draft</button>
      <button onClick={onPremier} style={{ flex: 1, height: 52, background: "linear-gradient(135deg, " + D.amber + ", " + D.teal + ")", color: D.bg, border: "none", borderRadius: 10, fontFamily: ft, fontSize: 16, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 20px " + D.teal + "30" }}>Confirm Premier</button>
    </div>
  </div>;
}

// ═══ PROJECT LIST ═══
function ProjectList({ projects, onOpen, onNew }) {
  var drafts = projects.filter(function(p) { return p.status === "draft"; });
  var production = projects.filter(function(p) { return p.status === "production"; });
  var premiered = projects.filter(function(p) { return p.status === "premiered"; });
  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
      <div>
        <div style={{ fontFamily: ft, fontSize: 48, fontWeight: 900, color: D.tx, letterSpacing: -2 }}>Press to Premier</div>
        <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 500, color: D.txb, marginTop: 4 }}>Article to video production suite.</div>
      </div>
      <button onClick={onNew} style={{ padding: "14px 24px", background: "linear-gradient(135deg, " + D.amber + ", #E8A020)", color: D.bg, border: "none", borderRadius: 10, fontFamily: ft, fontSize: 14, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 20px " + D.amber + "25" }}>+ New Project</button>
    </div>
    {[{ l: "In Production", items: production, c: D.amber }, { l: "Drafts", items: drafts, c: D.txl }, { l: "Premiered", items: premiered, c: D.teal }].map(function(sec) {
      if (sec.items.length === 0) return null;
      return <div key={sec.l} style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: ft, fontSize: 10, fontWeight: 600, color: sec.c, letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 }}>{sec.l} ({sec.items.length})</div>
        {sec.items.map(function(p, i) {
          return <div key={i} onClick={function() { onOpen(p); }} style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 22px", background: D.surface, border: "1px solid " + D.border, borderRadius: 10, marginBottom: 10, cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={function(e) { e.currentTarget.style.borderColor = D.borderHover; e.currentTarget.style.background = D.elevated; }} onMouseLeave={function(e) { e.currentTarget.style.borderColor = D.border; e.currentTarget.style.background = D.surface; }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 700, color: D.tx }}>{p.title || "Untitled"}</div>
              <div style={{ fontFamily: ft, fontSize: 12, fontWeight: 500, color: D.txl, marginTop: 2 }}>{new Date(p.ts).toLocaleDateString("en-US", { month: "short", day: "numeric" })} // Step {(p.step || 0) + 1} of 7</div>
            </div>
            <span style={{ fontFamily: ft, fontSize: 10, fontWeight: 600, color: sec.c, padding: "4px 10px", borderRadius: 8, background: sec.c + "12", letterSpacing: 1 }}>{p.status}</span>
          </div>;
        })}
      </div>;
    })}
    {projects.length === 0 && <div style={{ textAlign: "center", padding: 80 }}>
      <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.15 }}>{"\uD83C\uDFAC"}</div>
      <div style={{ fontFamily: ft, fontSize: 20, fontWeight: 700, color: D.txl }}>No projects yet.</div>
      <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 500, color: D.txh, marginTop: 6 }}>Click "New Project" to start your first video.</div>
    </div>}
  </div>;
}

// ═══ MAIN ═══
export default function PressToPremi() {
  var _projects = useState([]), projects = _projects[0], setProjects = _projects[1];
  var _active = useState(null), active = _active[0], setActive = _active[1];
  var _step = useState(0), step = _step[0], setStep = _step[1];
  var _data = useState({}), data = _data[0], setData = _data[1];
  var _loading = useState(false), loading = _loading[0], setLoading = _loading[1];

  useEffect(function() { try { var p = localStorage.getItem("p2p-projects"); if (p) setProjects(JSON.parse(p)); } catch (e) {} }, []);
  useEffect(function() { try { localStorage.setItem("p2p-projects", JSON.stringify(projects)); } catch (e) {} }, [projects]);

  var stepNames = ["Input", "Options", "Script", "Review", "Format", "Produce", "Select", "Preview", "Premier"];
  var startNew = function() { setActive("new"); setStep(0); setData({ mode: "url" }); };
  var openProject = function(p) { setActive(p.id); setStep(p.step || 0); setData(p.data || {}); };
  var saveProject = function(status) {
    var title = data.options ? data.options.titles[data.selTitle || 0] : "Untitled";
    var proj = { id: active === "new" ? "p" + Date.now() : active, title: title, status: status, step: step, data: data, ts: Date.now() };
    setProjects(function(p) { var f = p.filter(function(x) { return x.id !== proj.id; }); return [proj].concat(f).slice(0, 5); });
    if (status === "premiered" || status === "draft") { setActive(null); }
  };

  var genOptions = async function() {
    setLoading(true); setStep(1);
    try {
      var r = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system: "You are a video production strategist for SemiAnalysis. Never use em dashes. No emojis. RESPOND ONLY IN VALID JSON.", prompt: "Generate 3 title options, 3 hook options (under 12 words each), and 3 description options for a video about this article.\n\nArticle: " + (data.text || data.url || "") + "\n\nReturn JSON: {\"titles\":[\"t1\",\"t2\",\"t3\"],\"hooks\":[\"h1\",\"h2\",\"h3\"],\"descriptions\":[\"d1\",\"d2\",\"d3\"]}" }) });
      var d = await r.json(); var txt = (d.content || []).map(function(c) { return c.text || ""; }).join("");
      var parsed = JSON.parse(txt.replace(/```json|```/g, "").trim());
      setData(function(p) { return Object.assign({}, p, { options: parsed }); });
    } catch (e) { toast("Failed: " + String(e).slice(0, 80), "error", 500); setStep(0); }
    setLoading(false);
  };

  var genScripts = async function() {
    setLoading(true); setStep(2);
    var title = data.options.titles[data.selTitle || 0];
    var hook = data.options.hooks[data.selHook || 0];
    try {
      var r = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system: "You are a video scriptwriter for SemiAnalysis. Never use em dashes. No emojis. RESPOND ONLY IN VALID JSON.", prompt: "Write 3 script versions for a " + (data.duration || 60) + "-second video.\nTitle: " + title + "\nHook: " + hook + "\n\nEach version: different approach, different b-roll.\n\nReturn JSON: {\"scripts\":[{\"hook\":\"...\",\"intro\":\"first 8s\",\"body\":[\"p1\",\"p2\"],\"outro\":\"CTA\",\"broll\":[{\"shot\":1,\"timing\":\"0-5s\",\"description\":\"what we see\",\"prompt\":\"cinematic prompt 30-50 words\",\"camera\":\"movement\"}]}]}" }) });
      var d = await r.json(); var txt = (d.content || []).map(function(c) { return c.text || ""; }).join("");
      var parsed = JSON.parse(txt.replace(/```json|```/g, "").trim());
      setData(function(p) { return Object.assign({}, p, { scripts: parsed.scripts || [] }); });
    } catch (e) { toast("Failed: " + String(e).slice(0, 80), "error", 500); setStep(1); }
    setLoading(false);
  };

  if (!active) return <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 32px" }}><Toasts /><ProjectList projects={projects} onOpen={openProject} onNew={startNew} /></div>;

  return <div style={{ maxWidth: 960, margin: "0 auto", padding: "40px 32px" }}>
    <Toasts />
    <StepTracker current={step} steps={stepNames} />

    {loading && <div style={{ textAlign: "center", padding: 60 }}>
      <style dangerouslySetInnerHTML={{ __html: "@keyframes ldSpin{to{transform:rotate(360deg)}}" }} />
      <div style={{ width: 28, height: 28, border: "3px solid " + D.border, borderTopColor: D.amber, borderRadius: "50%", animation: "ldSpin 0.8s linear infinite", margin: "0 auto 14px" }} />
      <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 500, color: D.amber }}>Working...</div>
    </div>}

    {!loading && step === 0 && <Step1 data={data} setData={setData} onNext={genOptions} />}
    {!loading && step === 1 && <Step2 data={data} setData={setData} onNext={genScripts} onBack={function() { setStep(0); }} />}
    {!loading && step === 2 && <Step3 data={data} setData={setData} onNext={function() { setStep(3); }} onBack={function() { setStep(1); }} />}
    {!loading && step === 3 && <Step4 data={data} onNext={function() { setStep(4); }} onBack={function() { setStep(2); }} />}
    {!loading && step === 4 && <Step5 data={data} setData={setData} onNext={function() { setStep(5); saveProject("production"); }} onBack={function() { setStep(3); }} />}
    {!loading && step === 5 && <Step6 data={data} setData={setData} onNext={function() { setStep(6); }} onBack={function() { setStep(4); }} />}
    {!loading && step === 6 && <Step7 data={data} setData={setData} onNext={function() { setStep(7); }} onBack={function() { setStep(5); }} />}
    {!loading && step === 7 && <Step8 data={data} onNext={function() { setStep(8); }} onBack={function() { setStep(6); }} />}
    {!loading && step === 8 && <Step9 data={data} onPremier={function() { saveProject("premiered"); toast("Premiered! Project archived.", "success"); }} onDraft={function() { saveProject("draft"); toast("Draft saved", "info"); }} />}

    {step > 0 && step < 8 && !loading && <div style={{ marginTop: 24, textAlign: "center" }}>
      <span onClick={function() { saveProject("draft"); toast("Draft saved", "info"); }} style={{ fontFamily: ft, fontSize: 12, fontWeight: 500, color: D.txl, cursor: "pointer", padding: "8px 16px", borderRadius: 8, border: "1px solid " + D.border }}>Save Draft & Exit</span>
    </div>}
  </div>;
}
// force rebuild 1776125949
