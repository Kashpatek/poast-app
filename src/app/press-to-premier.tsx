// @ts-nocheck
"use client";
import { useState, useEffect, useRef } from "react";

// ═══ DESIGN ═══
var D = {
  bg: "#0B0B12", card: "#111118", border: "#1E1E2E", hover: "#141420", active: "#16161F",
  amber: "#F7B041", blue: "#0B86D1", teal: "#2EAD8E", coral: "#E06347", violet: "#905CCB",
  tx: "#E8E4DD", txs: "#6B6878", dim: "#4E4B56",
};
var ft = "'Outfit',sans-serif";
var mn = "'JetBrains Mono',monospace";

// ═══ TOAST (with error codes) ═══
var _toast = { current: null };
function toast(msg, type, code) { if (_toast.current) _toast.current(msg, type, code); }
function Toasts() {
  var _l = useState([]), l = _l[0], sl = _l[1];
  _toast.current = function(m, t, code) { var id = Date.now(); sl(function(p) { return [{ id: id, m: m, t: t || "success", code: code }].concat(p).slice(0, 5); }); setTimeout(function() { sl(function(p) { return p.filter(function(x) { return x.id !== id; }); }); }, 5000); };
  return <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 10000, display: "flex", flexDirection: "column", gap: 8 }}>
    <style dangerouslySetInnerHTML={{ __html: "@keyframes tIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes tDr{from{width:100%}to{width:0}}" }} />
    {l.map(function(t) { var c = t.t === "error" ? D.coral : t.t === "info" ? D.amber : D.teal; return <div key={t.id} style={{ background: D.card, border: "1px solid " + D.border, borderLeft: "3px solid " + c, borderRadius: 10, padding: "12px 16px", minWidth: 300, maxWidth: 420, boxShadow: "0 4px 24px rgba(0,0,0,0.5)", animation: "tIn 0.25s ease", overflow: "hidden" }}>
      <div style={{ fontFamily: ft, fontSize: 12, color: D.tx, marginBottom: 4 }}>{t.m}</div>
      {t.code && <div style={{ fontFamily: mn, fontSize: 9, color: D.txs, padding: "3px 6px", background: D.bg, borderRadius: 3, display: "inline-block", marginBottom: 4 }}>Error {t.code} // {new Date(t.id).toLocaleTimeString()}</div>}
      <div style={{ height: 2, background: D.border, borderRadius: 1 }}><div style={{ height: "100%", background: c, borderRadius: 1, animation: "tDr 5s linear forwards" }} /></div>
    </div>; })}
  </div>;
}
function copy(t) { navigator.clipboard.writeText(t); toast("Copied", "info"); }

// ═══ COST CALCULATOR ═══
function CostBar({ step, options }) {
  var costs = { fetch: 0, brief: 0.02, thumbnails: 0.04, voiceover: 0.03, broll: 0, music: 0.02, render: 0 };
  var brollCount = options.brollCount || 5;
  costs.broll = brollCount * 0.30;
  var total = 0;
  var steps = ["fetch", "brief", "thumbnails", "voiceover", "broll", "music", "render"];
  steps.forEach(function(s, i) { if (i <= step) total += costs[s]; });
  var fullTotal = Object.values(costs).reduce(function(a, b) { return a + b; }, 0);

  return <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 16px", background: D.card, border: "1px solid " + D.border, borderRadius: 8, marginBottom: 16 }}>
    <div style={{ fontFamily: mn, fontSize: 9, color: D.txs }}>EST. COST</div>
    <div style={{ fontFamily: mn, fontSize: 14, fontWeight: 700, color: D.amber }}>${total.toFixed(2)}</div>
    <div style={{ flex: 1, height: 3, background: D.border, borderRadius: 2 }}>
      <div style={{ height: "100%", width: (total / fullTotal * 100) + "%", background: D.amber, borderRadius: 2, transition: "width 0.3s" }} />
    </div>
    <div style={{ fontFamily: mn, fontSize: 9, color: D.dim }}>of ~${fullTotal.toFixed(2)} total</div>
  </div>;
}

// ═══ STEP INDICATOR ═══
function StepNav({ current, steps, onStep }) {
  return <div style={{ display: "flex", gap: 0, marginBottom: 24, background: D.card, border: "1px solid " + D.border, borderRadius: 8, overflow: "hidden" }}>
    {steps.map(function(s, i) {
      var done = i < current; var active = i === current; var future = i > current;
      return <div key={i} onClick={function() { if (done) onStep(i); }} style={{ flex: 1, padding: "10px 8px", textAlign: "center", cursor: done ? "pointer" : "default", background: active ? D.active : "transparent", borderBottom: active ? "2px solid " + D.amber : "2px solid transparent", borderRight: i < steps.length - 1 ? "1px solid " + D.border : "none", opacity: future ? 0.35 : 1, transition: "all 0.15s" }}>
        <div style={{ fontFamily: mn, fontSize: 9, color: done ? D.teal : active ? D.amber : D.txs, fontWeight: 700 }}>{done ? "\u2713" : i + 1}</div>
        <div style={{ fontFamily: ft, fontSize: 10, color: active ? D.amber : D.txs, marginTop: 2 }}>{s}</div>
      </div>;
    })}
  </div>;
}

// ═══ OPTION CARD (select 1 of 3) ═══
function OptionCards({ options, selected, onSelect, label }) {
  return <div>
    <div style={{ fontFamily: mn, fontSize: 10, color: D.amber, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>{label}</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {options.map(function(opt, i) {
        var on = selected === i;
        return <div key={i} onClick={function() { onSelect(i); }} style={{ padding: "14px 18px", background: on ? D.active : D.card, border: on ? "1px solid " + D.amber : "1px solid " + D.border, borderLeft: on ? "3px solid " + D.amber : "1px solid " + D.border, borderRadius: 8, cursor: "pointer", transition: "all 0.15s" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid " + (on ? D.amber : D.border), background: on ? D.amber : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: D.bg, fontWeight: 700, flexShrink: 0 }}>{on ? "\u2713" : ""}</div>
            <div style={{ fontFamily: ft, fontSize: 13, color: D.tx, lineHeight: 1.6 }}>{opt}</div>
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
    <div style={{ fontFamily: ft, fontSize: 20, fontWeight: 800, color: D.tx, marginBottom: 4 }}>Start a Project</div>
    <div style={{ fontFamily: ft, fontSize: 13, color: D.txs, marginBottom: 20 }}>Paste an article URL or text to begin.</div>
    <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
      {[{ id: "url", l: "Paste URL" }, { id: "text", l: "Paste Text" }].map(function(m) {
        var on = mode === m.id;
        return <span key={m.id} onClick={function() { setMode(m.id); setData(function(p) { return Object.assign({}, p, { mode: m.id }); }); }} style={{ flex: 1, padding: "10px", borderRadius: 6, cursor: "pointer", textAlign: "center", background: on ? D.amber : "transparent", border: on ? "none" : "1px solid " + D.border, color: on ? D.bg : D.txs, fontFamily: ft, fontSize: 13, fontWeight: on ? 600 : 400 }}>{m.l}</span>;
      })}
    </div>
    {mode === "url" ? <input value={data.url || ""} onChange={function(e) { setData(function(p) { return Object.assign({}, p, { url: e.target.value }); }); }} placeholder="https://semianalysis.com/..." style={{ width: "100%", padding: "12px 16px", background: D.card, border: "1px solid " + D.border, borderRadius: 8, color: D.tx, fontFamily: ft, fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 16 }} />
    : <textarea value={data.text || ""} onChange={function(e) { setData(function(p) { return Object.assign({}, p, { text: e.target.value }); }); }} rows={8} placeholder="Paste article text..." style={{ width: "100%", padding: "12px 16px", background: D.card, border: "1px solid " + D.border, borderRadius: 8, color: D.tx, fontFamily: ft, fontSize: 14, outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.6, marginBottom: 16 }} />}
    <button onClick={onNext} disabled={!(data.url || data.text)} style={{ width: "100%", padding: "12px", background: D.amber, color: D.bg, border: "none", borderRadius: 8, fontFamily: ft, fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: (data.url || data.text) ? 1 : 0.4 }}>Generate Options</button>
  </div>;
}

// ═══ STEP 2: SELECT TITLE / HOOK / DESCRIPTION ═══
function Step2({ data, setData, onNext, onBack }) {
  if (!data.options) return <div style={{ textAlign: "center", padding: 40, color: D.txs }}>Loading options...</div>;
  var o = data.options;
  return <div>
    <div style={{ fontFamily: ft, fontSize: 20, fontWeight: 800, color: D.tx, marginBottom: 4 }}>Choose Your Direction</div>
    <div style={{ fontFamily: ft, fontSize: 13, color: D.txs, marginBottom: 20 }}>Select one title, one hook, and one description.</div>
    <OptionCards label="Title" options={o.titles || []} selected={data.selTitle || 0} onSelect={function(i) { setData(function(p) { return Object.assign({}, p, { selTitle: i }); }); }} />
    <div style={{ height: 20 }} />
    <OptionCards label="Hook" options={o.hooks || []} selected={data.selHook || 0} onSelect={function(i) { setData(function(p) { return Object.assign({}, p, { selHook: i }); }); }} />
    <div style={{ height: 20 }} />
    <OptionCards label="Description" options={o.descriptions || []} selected={data.selDesc || 0} onSelect={function(i) { setData(function(p) { return Object.assign({}, p, { selDesc: i }); }); }} />
    <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
      <button onClick={onBack} style={{ padding: "10px 20px", background: "transparent", border: "1px solid " + D.border, color: D.txs, borderRadius: 8, fontFamily: ft, fontSize: 13, cursor: "pointer" }}>Back</button>
      <button onClick={onNext} style={{ flex: 1, padding: "10px", background: D.amber, color: D.bg, border: "none", borderRadius: 8, fontFamily: ft, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Build Script</button>
    </div>
  </div>;
}

// ═══ STEP 3: SCRIPT + DURATION ═══
function Step3({ data, setData, onNext, onBack }) {
  var _dur = useState(data.duration || 60), dur = _dur[0], setDur = _dur[1];
  if (!data.scripts) return <div style={{ textAlign: "center", padding: 40, color: D.txs }}>Generating scripts...</div>;
  return <div>
    <div style={{ fontFamily: ft, fontSize: 20, fontWeight: 800, color: D.tx, marginBottom: 4 }}>Script & Duration</div>
    <div style={{ fontFamily: ft, fontSize: 13, color: D.txs, marginBottom: 16 }}>Choose duration, then pick a script version.</div>
    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
      {[{ v: 30, l: "30s Short" }, { v: 60, l: "60s Standard" }, { v: 120, l: "120s Long" }].map(function(d) {
        var on = dur === d.v;
        return <span key={d.v} onClick={function() { setDur(d.v); setData(function(p) { return Object.assign({}, p, { duration: d.v }); }); }} style={{ flex: 1, padding: "12px", borderRadius: 8, cursor: "pointer", textAlign: "center", background: on ? D.amber + "15" : D.card, border: on ? "1px solid " + D.amber : "1px solid " + D.border, fontFamily: ft, fontSize: 13, fontWeight: on ? 700 : 400, color: on ? D.amber : D.txs }}>{d.l}</span>;
      })}
    </div>
    <OptionCards label="Script Version" options={(data.scripts || []).map(function(s) { return "HOOK: " + s.hook + "\n\n" + s.intro + "\n\n" + (s.body || []).join("\n\n") + "\n\n" + s.outro; })} selected={data.selScript || 0} onSelect={function(i) { setData(function(p) { return Object.assign({}, p, { selScript: i }); }); }} />
    <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
      <button onClick={onBack} style={{ padding: "10px 20px", background: "transparent", border: "1px solid " + D.border, color: D.txs, borderRadius: 8, fontFamily: ft, fontSize: 13, cursor: "pointer" }}>Back</button>
      <button onClick={onNext} style={{ flex: 1, padding: "10px", background: D.amber, color: D.bg, border: "none", borderRadius: 8, fontFamily: ft, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Review B-Roll</button>
    </div>
  </div>;
}

// ═══ STEP 4: REVIEW SCRIPT + B-ROLL ═══
function Step4({ data, onNext, onBack }) {
  var script = data.scripts && data.scripts[data.selScript || 0];
  if (!script) return <div style={{ textAlign: "center", padding: 40, color: D.txs }}>No script selected</div>;
  return <div>
    <div style={{ fontFamily: ft, fontSize: 20, fontWeight: 800, color: D.tx, marginBottom: 4 }}>Review Script & B-Roll</div>
    <div style={{ fontFamily: ft, fontSize: 13, color: D.txs, marginBottom: 20 }}>Voiceover on the left, b-roll prompts on the right.</div>
    {/* Script + B-roll side by side */}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <div>
        <div style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 1, marginBottom: 8 }}>VOICEOVER SCRIPT</div>
        {[{ l: "HOOK", t: script.hook }, { l: "INTRO", t: script.intro }].concat(
          (script.body || []).map(function(b, i) { return { l: "BODY " + (i + 1), t: b }; }),
          [{ l: "OUTRO", t: script.outro }]
        ).map(function(s, i) {
          return <div key={i} style={{ padding: "10px 14px", background: D.card, border: "1px solid " + D.border, borderRadius: 6, marginBottom: 6 }}>
            <div style={{ fontFamily: mn, fontSize: 9, color: D.amber, marginBottom: 4 }}>{s.l}</div>
            <div style={{ fontFamily: ft, fontSize: 12, color: D.tx, lineHeight: 1.7 }}>{s.t}</div>
          </div>;
        })}
      </div>
      <div>
        <div style={{ fontFamily: mn, fontSize: 10, color: D.blue, letterSpacing: 1, marginBottom: 8 }}>B-ROLL SHOTS</div>
        {(script.broll || []).map(function(shot, i) {
          return <div key={i} style={{ padding: "10px 14px", background: D.card, border: "1px solid " + D.border, borderRadius: 6, marginBottom: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontFamily: mn, fontSize: 9, color: D.blue }}>SHOT {i + 1} // {shot.timing}</span>
              <span style={{ fontFamily: mn, fontSize: 8, color: D.dim }}>{shot.camera}</span>
            </div>
            <div style={{ fontFamily: ft, fontSize: 11, color: D.txs, fontStyle: "italic", marginBottom: 4 }}>{shot.description}</div>
            <div style={{ fontFamily: mn, fontSize: 10, color: D.tx, padding: "6px 8px", background: D.bg, borderRadius: 4 }}>{shot.prompt}</div>
          </div>;
        })}
      </div>
    </div>
    <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
      <button onClick={onBack} style={{ padding: "10px 20px", background: "transparent", border: "1px solid " + D.border, color: D.txs, borderRadius: 8, fontFamily: ft, fontSize: 13, cursor: "pointer" }}>Back</button>
      <button onClick={onNext} style={{ flex: 1, padding: "10px", background: D.amber, color: D.bg, border: "none", borderRadius: 8, fontFamily: ft, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Choose Format</button>
    </div>
  </div>;
}

// ═══ STEP 5: FORMAT ═══
function Step5({ data, setData, onNext, onBack }) {
  var _aspect = useState(data.aspect || "16:9"), aspect = _aspect[0], setAspect = _aspect[1];
  var _abTest = useState(data.abTest || false), abTest = _abTest[0], setAbTest = _abTest[1];
  var formats = [
    { id: "16:9", l: "Landscape", sub: "YouTube, LinkedIn, X", w: 160, h: 90 },
    { id: "9:16", l: "Vertical", sub: "Shorts, Reels, TikTok", w: 56, h: 100 },
    { id: "1:1", l: "Square", sub: "Instagram, Facebook", w: 100, h: 100 },
  ];
  return <div>
    <div style={{ fontFamily: ft, fontSize: 20, fontWeight: 800, color: D.tx, marginBottom: 4 }}>Choose Format</div>
    <div style={{ fontFamily: ft, fontSize: 13, color: D.txs, marginBottom: 20 }}>Select aspect ratio and confirm.</div>
    <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
      {formats.map(function(f) {
        var on = aspect === f.id;
        return <div key={f.id} onClick={function() { setAspect(f.id); setData(function(p) { return Object.assign({}, p, { aspect: f.id }); }); }} style={{ flex: 1, padding: "16px", borderRadius: 8, cursor: "pointer", background: D.card, border: on ? "2px solid " + D.amber : "1px solid " + D.border, textAlign: "center" }}>
          <div style={{ width: f.w * 0.8, height: f.h * 0.8, margin: "0 auto 10px", background: D.bg, border: "1px solid " + D.border, borderRadius: 4 }} />
          <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: on ? D.amber : D.tx }}>{f.l}</div>
          <div style={{ fontFamily: mn, fontSize: 10, color: D.txs }}>{f.id} // {f.sub}</div>
        </div>;
      })}
    </div>
    <div onClick={function() { setAbTest(!abTest); setData(function(p) { return Object.assign({}, p, { abTest: !abTest }); }); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: D.card, border: "1px solid " + D.border, borderRadius: 8, cursor: "pointer", marginBottom: 20 }}>
      <div style={{ width: 18, height: 18, borderRadius: 4, border: "2px solid " + (abTest ? D.amber : D.border), background: abTest ? D.amber : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: D.bg }}>{abTest ? "\u2713" : ""}</div>
      <div>
        <div style={{ fontFamily: ft, fontSize: 13, color: D.tx }}>Create A/B variant</div>
        <div style={{ fontFamily: mn, fontSize: 10, color: D.txs }}>Second version with different hook + b-roll (~$0.80 extra)</div>
      </div>
    </div>
    <div style={{ display: "flex", gap: 10 }}>
      <button onClick={onBack} style={{ padding: "10px 20px", background: "transparent", border: "1px solid " + D.border, color: D.txs, borderRadius: 8, fontFamily: ft, fontSize: 13, cursor: "pointer" }}>Back</button>
      <button onClick={onNext} style={{ flex: 1, padding: "12px", background: D.amber, color: D.bg, border: "none", borderRadius: 8, fontFamily: ft, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Produce</button>
    </div>
  </div>;
}

// ═══ STEP 6: PRODUCE ═══
function Step6({ data, onNext, onBack }) {
  var _producing = useState(true), producing = _producing[0], setProducing = _producing[1];
  var _progress = useState([]), progress = _progress[0], setProgress = _progress[1];

  useEffect(function() {
    var steps = ["Generating voiceover", "Generating b-roll clips", "Adding music", "Assembling video"];
    var i = 0;
    var iv = setInterval(function() {
      if (i < steps.length) { setProgress(function(p) { return p.concat([steps[i]]); }); i++; }
      else { clearInterval(iv); setProducing(false); }
    }, 2000);
    return function() { clearInterval(iv); };
  }, []);

  return <div>
    <div style={{ fontFamily: ft, fontSize: 20, fontWeight: 800, color: D.tx, marginBottom: 4 }}>Producing</div>
    <div style={{ fontFamily: ft, fontSize: 13, color: D.txs, marginBottom: 20 }}>Your video is being assembled.</div>

    <style dangerouslySetInnerHTML={{ __html: "@keyframes prodPulse{0%,100%{opacity:0.4}50%{opacity:1}}" }} />
    {["Generating voiceover", "Generating b-roll clips", "Adding music", "Assembling video"].map(function(s, i) {
      var done = progress.length > i;
      var active = progress.length === i && producing;
      return <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid " + D.border }}>
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: done ? D.teal : active ? D.amber : D.border, animation: active ? "prodPulse 1.2s ease infinite" : "none", flexShrink: 0 }}>{done ? <span style={{ fontSize: 8, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>{"\u2713"}</span> : null}</div>
        <span style={{ fontFamily: ft, fontSize: 13, color: done ? D.teal : active ? D.amber : D.txs }}>{s}</span>
      </div>;
    })}

    {!producing && <div style={{ marginTop: 24 }}>
      <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: D.teal, marginBottom: 16 }}>Production complete.</div>
      <button onClick={onNext} style={{ width: "100%", padding: "12px", background: D.amber, color: D.bg, border: "none", borderRadius: 8, fontFamily: ft, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Review Output</button>
    </div>}
  </div>;
}

// ═══ STEP 7: REVIEW + REFINE ═══
function Step7({ data, onPremier, onDraft }) {
  var script = data.scripts && data.scripts[data.selScript || 0];
  var aspect = data.aspect || "16:9";
  var isHoriz = aspect === "16:9";

  return <div>
    <div style={{ fontFamily: ft, fontSize: 20, fontWeight: 800, color: D.tx, marginBottom: 4 }}>Review & Refine</div>
    <div style={{ fontFamily: ft, fontSize: 13, color: D.txs, marginBottom: 20 }}>Preview your video, edit clips, or approve.</div>

    {/* Video preview */}
    <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 10, padding: 20, marginBottom: 16 }}>
      <div style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 1, marginBottom: 8 }}>VIDEO PREVIEW</div>
      <div style={{ width: aspect === "9:16" ? "40%" : "100%", margin: "0 auto", aspectRatio: aspect === "9:16" ? "9/16" : aspect === "1:1" ? "1/1" : "16/9", background: D.bg, borderRadius: 8, border: "1px solid " + D.border, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: ft, fontSize: 14, color: D.txs }}>Preview ({aspect})</span>
      </div>
    </div>

    {/* Sample title/description */}
    <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 10, padding: 16, marginBottom: 16 }}>
      <div style={{ fontFamily: mn, fontSize: 10, color: D.txs, letterSpacing: 1, marginBottom: 6 }}>{isHoriz ? "YOUTUBE" : "INSTAGRAM"} METADATA</div>
      <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 700, color: D.tx, marginBottom: 6 }}>{data.options ? data.options.titles[data.selTitle || 0] : ""}</div>
      <div style={{ fontFamily: ft, fontSize: 12, color: D.txs, lineHeight: 1.6 }}>{data.options ? data.options.descriptions[data.selDesc || 0] : ""}</div>
    </div>

    {/* B-roll clips */}
    {script && script.broll && <div style={{ marginBottom: 16 }}>
      <div style={{ fontFamily: mn, fontSize: 10, color: D.blue, letterSpacing: 1, marginBottom: 10 }}>B-ROLL CLIPS</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
        {script.broll.map(function(shot, i) {
          return <div key={i} style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 8, padding: 10 }}>
            <div style={{ aspectRatio: "16/9", background: D.bg, borderRadius: 4, marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: mn, fontSize: 9, color: D.txs }}>Shot {i + 1}</span>
            </div>
            <div style={{ fontFamily: ft, fontSize: 10, color: D.tx, marginBottom: 4 }}>{shot.description}</div>
            <span style={{ fontFamily: mn, fontSize: 8, color: D.amber, cursor: "pointer", padding: "2px 6px", borderRadius: 3, border: "1px solid " + D.amber + "30" }}>Regenerate</span>
          </div>;
        })}
      </div>
    </div>}

    {/* Actions */}
    <div style={{ display: "flex", gap: 10 }}>
      <button onClick={onDraft} style={{ padding: "12px 20px", background: "transparent", border: "1px solid " + D.border, color: D.txs, borderRadius: 8, fontFamily: ft, fontSize: 13, cursor: "pointer" }}>Save Draft</button>
      <button onClick={onPremier} style={{ flex: 1, padding: "12px", background: D.amber, color: D.bg, border: "none", borderRadius: 8, fontFamily: ft, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Premier</button>
    </div>
  </div>;
}

// ═══ PROJECT LIST ═══
function ProjectList({ projects, onOpen, onNew }) {
  var drafts = projects.filter(function(p) { return p.status === "draft"; });
  var production = projects.filter(function(p) { return p.status === "production"; });
  var premiered = projects.filter(function(p) { return p.status === "premiered"; });

  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
      <div>
        <div style={{ fontFamily: ft, fontSize: 22, fontWeight: 800, color: D.tx }}>Press to Premier</div>
        <div style={{ fontFamily: ft, fontSize: 13, color: D.txs }}>Article to video production suite.</div>
      </div>
      <button onClick={onNew} style={{ padding: "10px 20px", background: D.amber, color: D.bg, border: "none", borderRadius: 8, fontFamily: ft, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ New Project</button>
    </div>

    {[{ l: "In Production", items: production, c: D.amber }, { l: "Drafts", items: drafts, c: D.txs }, { l: "Premiered", items: premiered, c: D.teal }].map(function(sec) {
      if (sec.items.length === 0) return null;
      return <div key={sec.l} style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: mn, fontSize: 10, color: sec.c, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>{sec.l} ({sec.items.length})</div>
        {sec.items.map(function(p, i) {
          return <div key={i} onClick={function() { onOpen(p); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", background: D.card, border: "1px solid " + D.border, borderRadius: 8, marginBottom: 8, cursor: "pointer", transition: "all 0.15s" }} onMouseEnter={function(e) { e.currentTarget.style.borderColor = D.amber + "40"; }} onMouseLeave={function(e) { e.currentTarget.style.borderColor = D.border; }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: ft, fontSize: 13, fontWeight: 700, color: D.tx }}>{p.title || "Untitled"}</div>
              <div style={{ fontFamily: mn, fontSize: 9, color: D.txs }}>{new Date(p.ts).toLocaleDateString("en-US", { month: "short", day: "numeric" })} // Step {(p.step || 0) + 1} of 7</div>
            </div>
            <span style={{ fontFamily: mn, fontSize: 8, color: sec.c, padding: "2px 8px", borderRadius: 4, background: sec.c + "15" }}>{p.status}</span>
          </div>;
        })}
      </div>;
    })}

    {projects.length === 0 && <div style={{ textAlign: "center", padding: 60 }}>
      <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.3 }}>{"\uD83C\uDFAC"}</div>
      <div style={{ fontFamily: ft, fontSize: 16, color: D.txs }}>No projects yet.</div>
      <div style={{ fontFamily: ft, fontSize: 13, color: D.dim, marginTop: 4 }}>Click "New Project" to start your first video.</div>
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

  // Load projects
  useEffect(function() { try { var p = localStorage.getItem("p2p-projects"); if (p) setProjects(JSON.parse(p)); } catch (e) {} }, []);
  useEffect(function() { try { localStorage.setItem("p2p-projects", JSON.stringify(projects)); } catch (e) {} }, [projects]);

  var stepNames = ["Input", "Options", "Script", "Review", "Format", "Produce", "Refine"];

  var startNew = function() { setActive("new"); setStep(0); setData({ mode: "url" }); };

  var openProject = function(p) { setActive(p.id); setStep(p.step || 0); setData(p.data || {}); };

  var saveProject = function(status) {
    var title = data.options ? data.options.titles[data.selTitle || 0] : "Untitled";
    var proj = { id: active === "new" ? "p" + Date.now() : active, title: title, status: status, step: step, data: data, ts: Date.now() };
    setProjects(function(p) {
      var filtered = p.filter(function(x) { return x.id !== proj.id; });
      return [proj].concat(filtered);
    });
    if (status === "premiered" || status === "draft") { setActive(null); }
  };

  // Step 1 -> Step 2: generate 3 options each
  var genOptions = async function() {
    setLoading(true); setStep(1);
    try {
      var r = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        system: "You are a video production strategist for SemiAnalysis. Never use em dashes. No emojis. RESPOND ONLY IN VALID JSON.",
        prompt: "Generate 3 title options, 3 hook options (under 12 words each, scroll-stopping), and 3 description options for a video about this article.\n\nArticle: " + (data.text || data.url || "") + "\n\nReturn JSON: {\"titles\":[\"t1\",\"t2\",\"t3\"],\"hooks\":[\"h1\",\"h2\",\"h3\"],\"descriptions\":[\"d1\",\"d2\",\"d3\"]}"
      }) });
      var d = await r.json();
      var txt = (d.content || []).map(function(c) { return c.text || ""; }).join("");
      var parsed = JSON.parse(txt.replace(/```json|```/g, "").trim());
      setData(function(p) { return Object.assign({}, p, { options: parsed }); });
    } catch (e) { toast("Failed to generate options: " + String(e).slice(0, 100), "error", 500); setStep(0); }
    setLoading(false);
  };

  // Step 2 -> Step 3: generate 3 script versions
  var genScripts = async function() {
    setLoading(true); setStep(2);
    var title = data.options.titles[data.selTitle || 0];
    var hook = data.options.hooks[data.selHook || 0];
    var desc = data.options.descriptions[data.selDesc || 0];
    try {
      var r = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        system: "You are a video scriptwriter for SemiAnalysis. Never use em dashes. No emojis. Be data-forward. RESPOND ONLY IN VALID JSON.",
        prompt: "Write 3 different script versions for a " + (data.duration || 60) + "-second video.\nTitle: " + title + "\nHook: " + hook + "\nDescription: " + desc + "\n\nEach version should have a different creative approach and different b-roll concepts.\n\nReturn JSON: {\"scripts\":[{\"hook\":\"...\",\"intro\":\"first 8 seconds\",\"body\":[\"paragraph 1\",\"paragraph 2\"],\"outro\":\"CTA\",\"broll\":[{\"shot\":1,\"timing\":\"0-5s\",\"description\":\"what we see\",\"prompt\":\"cinematic generation prompt 30-50 words\",\"camera\":\"camera movement\"}]}]}"
      }) });
      var d = await r.json();
      var txt = (d.content || []).map(function(c) { return c.text || ""; }).join("");
      var parsed = JSON.parse(txt.replace(/```json|```/g, "").trim());
      setData(function(p) { return Object.assign({}, p, { scripts: parsed.scripts || [] }); });
    } catch (e) { toast("Failed to generate scripts: " + String(e).slice(0, 100), "error", 500); setStep(1); }
    setLoading(false);
  };

  // If not in a project, show project list
  if (!active) return <div><Toasts /><ProjectList projects={projects} onOpen={openProject} onNew={startNew} /></div>;

  return (<div>
    <Toasts />
    <CostBar step={step} options={{ brollCount: 5 }} />
    <StepNav current={step} steps={stepNames} onStep={setStep} />

    {loading && <div style={{ textAlign: "center", padding: 40 }}>
      <style dangerouslySetInnerHTML={{ __html: "@keyframes ldSpin{to{transform:rotate(360deg)}}" }} />
      <div style={{ width: 24, height: 24, border: "3px solid " + D.border, borderTopColor: D.amber, borderRadius: "50%", animation: "ldSpin 0.8s linear infinite", margin: "0 auto 12px" }} />
      <div style={{ fontFamily: mn, fontSize: 11, color: D.amber }}>Working...</div>
    </div>}

    {!loading && step === 0 && <Step1 data={data} setData={setData} onNext={genOptions} />}
    {!loading && step === 1 && <Step2 data={data} setData={setData} onNext={genScripts} onBack={function() { setStep(0); }} />}
    {!loading && step === 2 && <Step3 data={data} setData={setData} onNext={function() { setStep(3); }} onBack={function() { setStep(1); }} />}
    {!loading && step === 3 && <Step4 data={data} onNext={function() { setStep(4); }} onBack={function() { setStep(2); }} />}
    {!loading && step === 4 && <Step5 data={data} setData={setData} onNext={function() { setStep(5); saveProject("production"); }} onBack={function() { setStep(3); }} />}
    {!loading && step === 5 && <Step6 data={data} onNext={function() { setStep(6); }} onBack={function() { setStep(4); }} />}
    {!loading && step === 6 && <Step7 data={data} onPremier={function() { saveProject("premiered"); toast("Premiered!", "success"); }} onDraft={function() { saveProject("draft"); toast("Saved as draft", "info"); }} />}

    {/* Save draft button always visible */}
    {step > 0 && step < 6 && !loading && <div style={{ marginTop: 20, textAlign: "center" }}>
      <span onClick={function() { saveProject("draft"); toast("Draft saved", "info"); }} style={{ fontFamily: mn, fontSize: 10, color: D.txs, cursor: "pointer", padding: "6px 12px", borderRadius: 4, border: "1px solid " + D.border }}>Save Draft & Exit</span>
    </div>}
  </div>);
}
