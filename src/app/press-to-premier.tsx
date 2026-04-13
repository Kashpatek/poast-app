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

// ═══ STEP 6: PRODUCE ═══
function Step6({ onNext, onBack }) {
  var _producing = useState(true), producing = _producing[0], setProducing = _producing[1];
  var _progress = useState([]), progress = _progress[0], setProgress = _progress[1];
  var steps = ["Generating voiceover", "Generating b-roll clips", "Adding music", "Assembling video"];
  useEffect(function() {
    var i = 0; var iv = setInterval(function() { if (i < steps.length) { setProgress(function(p) { return p.concat([steps[i]]); }); i++; } else { clearInterval(iv); setProducing(false); } }, 2000);
    return function() { clearInterval(iv); };
  }, []);
  return <div>
    <div style={{ fontFamily: ft, fontSize: 42, fontWeight: 900, color: D.tx, letterSpacing: -2, marginBottom: 8 }}>Producing</div>
    <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 500, color: D.txb, marginBottom: 32 }}>Your video is being assembled.</div>
    <style dangerouslySetInnerHTML={{ __html: "@keyframes pp{0%,100%{opacity:0.3}50%{opacity:1}}" }} />
    {steps.map(function(s, i) {
      var done = progress.length > i; var active = progress.length === i && producing;
      return <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 0", borderBottom: "1px solid " + D.border }}>
        <div style={{ width: 16, height: 16, borderRadius: "50%", background: done ? D.teal : active ? D.amber : D.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#fff", animation: active ? "pp 1.2s ease infinite" : "none", flexShrink: 0, boxShadow: done ? "0 0 8px " + D.teal + "40" : active ? "0 0 8px " + D.amber + "40" : "none" }}>{done ? "\u2713" : ""}</div>
        <span style={{ fontFamily: ft, fontSize: 15, fontWeight: 500, color: done ? D.teal : active ? D.amber : D.txl }}>{s}</span>
      </div>;
    })}
    {!producing && <button onClick={onNext} style={{ width: "100%", height: 52, marginTop: 28, background: "linear-gradient(135deg, " + D.amber + ", #E8A020)", color: D.bg, border: "none", borderRadius: 10, fontFamily: ft, fontSize: 16, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 20px " + D.amber + "30" }}>Review Output</button>}
  </div>;
}

// ═══ STEP 7: REVIEW ═══
function Step7({ data, onPremier, onDraft }) {
  var aspect = data.aspect || "16:9";
  return <div>
    <div style={{ fontFamily: ft, fontSize: 42, fontWeight: 900, color: D.tx, letterSpacing: -2, marginBottom: 8 }}>Review</div>
    <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 500, color: D.txb, marginBottom: 28 }}>Preview, edit, or approve.</div>
    <div style={{ background: D.surface, border: "1px solid " + D.border, borderRadius: 12, padding: 24, marginBottom: 20 }}>
      <div style={{ width: aspect === "9:16" ? "35%" : "100%", margin: "0 auto", aspectRatio: aspect === "9:16" ? "9/16" : aspect === "1:1" ? "1/1" : "16/9", background: D.bg, borderRadius: 10, border: "1px solid " + D.border, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: ft, fontSize: 15, fontWeight: 500, color: D.txl }}>Preview ({aspect})</span>
      </div>
    </div>
    {data.options && <div style={{ background: D.surface, border: "1px solid " + D.border, borderRadius: 12, padding: 24, marginBottom: 20 }}>
      <div style={{ fontFamily: ft, fontSize: 10, fontWeight: 600, color: D.txl, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Metadata</div>
      <div style={{ fontFamily: ft, fontSize: 18, fontWeight: 800, color: D.tx, marginBottom: 8 }}>{data.options.titles[data.selTitle || 0]}</div>
      <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 500, color: D.txb, lineHeight: 1.7 }}>{data.options.descriptions[data.selDesc || 0]}</div>
    </div>}
    <div style={{ display: "flex", gap: 12 }}>
      <button onClick={onDraft} style={{ padding: "14px 24px", background: "transparent", border: "1px solid " + D.border, color: D.txl, borderRadius: 10, fontFamily: ft, fontSize: 14, cursor: "pointer" }}>Save Draft</button>
      <button onClick={onPremier} style={{ flex: 1, height: 52, background: "linear-gradient(135deg, " + D.amber + ", " + D.teal + ")", color: D.bg, border: "none", borderRadius: 10, fontFamily: ft, fontSize: 16, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 20px " + D.teal + "30" }}>Premier</button>
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

  var stepNames = ["Input", "Options", "Script", "Review", "Format", "Produce", "Refine"];
  var startNew = function() { setActive("new"); setStep(0); setData({ mode: "url" }); };
  var openProject = function(p) { setActive(p.id); setStep(p.step || 0); setData(p.data || {}); };
  var saveProject = function(status) {
    var title = data.options ? data.options.titles[data.selTitle || 0] : "Untitled";
    var proj = { id: active === "new" ? "p" + Date.now() : active, title: title, status: status, step: step, data: data, ts: Date.now() };
    setProjects(function(p) { var f = p.filter(function(x) { return x.id !== proj.id; }); return [proj].concat(f); });
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

  if (!active) return <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px" }}><Toasts /><ProjectList projects={projects} onOpen={openProject} onNew={startNew} /></div>;

  return <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px" }}>
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
    {!loading && step === 5 && <Step6 onNext={function() { setStep(6); }} onBack={function() { setStep(4); }} />}
    {!loading && step === 6 && <Step7 data={data} onPremier={function() { saveProject("premiered"); toast("Premiered!", "success"); }} onDraft={function() { saveProject("draft"); toast("Draft saved", "info"); }} />}

    {step > 0 && step < 6 && !loading && <div style={{ marginTop: 24, textAlign: "center" }}>
      <span onClick={function() { saveProject("draft"); toast("Draft saved", "info"); }} style={{ fontFamily: ft, fontSize: 12, fontWeight: 500, color: D.txl, cursor: "pointer", padding: "8px 16px", borderRadius: 8, border: "1px solid " + D.border }}>Save Draft & Exit</span>
    </div>}
  </div>;
}
