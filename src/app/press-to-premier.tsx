// @ts-nocheck
"use client";
import { useState, useEffect, useRef } from "react";

var D = {
  bg: "#0B0B12", card: "#111118", border: "#1E1E2E", cardHover: "#141420", cardActive: "#16161F",
  amber: "#F7B041", blue: "#0B86D1", teal: "#2EAD8E", coral: "#E06347", violet: "#905CCB", crimson: "#D1334A",
  tx: "#E8E4DD", txs: "#6B6878", dim: "#4E4B56",
};
var ft = "'Outfit',sans-serif";
var mn = "'JetBrains Mono',monospace";
var PC = { x: { c: "#1DA1F2", n: "X / Twitter", i: "\uD83D\uDC26" }, linkedin: { c: "#0A66C2", n: "LinkedIn", i: "\uD83D\uDCBC" }, instagram: { c: "#E4405F", n: "Instagram Reels", i: "\uD83D\uDCF7" }, tiktok: { c: "#00F2EA", n: "TikTok", i: "\uD83C\uDFB5" }, youtube: { c: "#FF0000", n: "YouTube", i: "\u25B6\uFE0F" } };

// Toast
var _toast = { current: null };
function toast(msg, type) { if (_toast.current) _toast.current(msg, type); }
function Toasts() {
  var _l = useState([]), l = _l[0], sl = _l[1];
  _toast.current = function(m, t) { var id = Date.now(); sl(function(p) { return [{ id: id, m: m, t: t || "success" }].concat(p).slice(0, 4); }); setTimeout(function() { sl(function(p) { return p.filter(function(x) { return x.id !== id; }); }); }, 3200); };
  return <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 10000, display: "flex", flexDirection: "column", gap: 8 }}>
    <style dangerouslySetInnerHTML={{ __html: "@keyframes tIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes tDr{from{width:100%}to{width:0}}" }} />
    {l.map(function(t) { var c = t.t === "error" ? D.coral : t.t === "info" ? D.amber : D.teal; return <div key={t.id} style={{ background: D.card, border: "1px solid " + D.border, borderLeft: "3px solid " + c, borderRadius: 10, padding: "12px 16px", minWidth: 260, boxShadow: "0 4px 24px rgba(0,0,0,0.5)", animation: "tIn 0.25s ease", overflow: "hidden" }}><div style={{ fontFamily: ft, fontSize: 12, color: D.tx, marginBottom: 6 }}>{t.m}</div><div style={{ height: 2, background: D.border, borderRadius: 1 }}><div style={{ height: "100%", background: c, borderRadius: 1, animation: "tDr 3s linear forwards" }} /></div></div>; })}
  </div>;
}

function copy(text) { navigator.clipboard.writeText(text); toast("Copied to clipboard", "info"); }

function CopyBtn({ text }) {
  var _ok = useState(false), ok = _ok[0], setOk = _ok[1];
  return <span onClick={function() { copy(text); setOk(true); setTimeout(function() { setOk(false); }, 1500); }} style={{ fontFamily: mn, fontSize: 9, color: ok ? D.teal : D.txs, cursor: "pointer", padding: "3px 8px", borderRadius: 4, border: "1px solid " + (ok ? D.teal + "40" : D.border), transition: "all 0.15s" }}>{ok ? "\u2713 Copied" : "Copy"}</span>;
}

function Tab({ l, active, onClick }) { return <div onClick={onClick} style={{ padding: "10px 16px", cursor: "pointer", fontFamily: ft, fontSize: 12, fontWeight: active ? 700 : 500, color: active ? D.amber : D.txs, borderBottom: active ? "2px solid " + D.amber : "2px solid transparent", transition: "all 0.15s" }}>{l}</div>; }

// ═══ BRIEF TAB ═══
function BriefTab({ b }) {
  return (<div>
    {/* Hook */}
    <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 12, padding: "20px 24px", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>HOOK</div>
        <CopyBtn text={b.hook} />
      </div>
      <div style={{ fontFamily: ft, fontSize: 24, color: D.tx, lineHeight: 1.4, fontWeight: 500 }}>{b.hook}</div>
    </div>

    {/* Logline */}
    <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
      <div style={{ fontFamily: mn, fontSize: 10, color: D.txs, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>LOGLINE</div>
      <div style={{ fontFamily: ft, fontSize: 15, color: D.tx, lineHeight: 1.6 }}>{b.logline}</div>
    </div>

    {/* Metadata chips */}
    <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
      {[{ l: "Duration", v: b.duration + "s" }, { l: "Format", v: b.format }, { l: "Tone", v: "Data-driven" }, { l: "Aspect", v: b.aspectRatio }].map(function(c, i) {
        return <div key={i} style={{ background: D.border, borderRadius: 6, padding: "6px 12px" }}>
          <div style={{ fontFamily: mn, fontSize: 10, color: D.txs, textTransform: "uppercase" }}>{c.l}</div>
          <div style={{ fontFamily: mn, fontSize: 12, color: D.tx }}>{c.v}</div>
        </div>;
      })}
    </div>

    {/* Thumbnail concept */}
    {b.thumbnail && <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
      <div style={{ fontFamily: mn, fontSize: 10, color: D.txs, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>THUMBNAIL CONCEPT</div>
      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ width: 200, aspectRatio: "16/9", background: D.bg, borderRadius: 8, border: "1px solid " + D.border, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 12, flexShrink: 0 }}>
          <div style={{ fontFamily: ft, fontSize: 13, fontWeight: 700, color: D.amber, textAlign: "center", marginBottom: 4 }}>{b.thumbnail.headline}</div>
          <div style={{ fontFamily: ft, fontSize: 9, color: D.tx, textAlign: "center" }}>{b.thumbnail.subtext}</div>
          <div style={{ fontFamily: mn, fontSize: 7, color: D.amber, marginTop: "auto" }}>SA</div>
        </div>
        <div>
          <div style={{ marginBottom: 8 }}><div style={{ fontFamily: mn, fontSize: 9, color: D.txs }}>Headline</div><div style={{ fontFamily: ft, fontSize: 13, color: D.tx }}>{b.thumbnail.headline}</div><CopyBtn text={b.thumbnail.headline} /></div>
          <div style={{ marginBottom: 8 }}><div style={{ fontFamily: mn, fontSize: 9, color: D.txs }}>Subtext</div><div style={{ fontFamily: ft, fontSize: 13, color: D.tx }}>{b.thumbnail.subtext}</div><CopyBtn text={b.thumbnail.subtext} /></div>
          <div><div style={{ fontFamily: mn, fontSize: 9, color: D.txs }}>Concept</div><div style={{ fontFamily: ft, fontSize: 12, color: D.txs }}>{b.thumbnail.concept}</div></div>
        </div>
      </div>
    </div>}

    {/* Data points */}
    {b.dataPoints && b.dataPoints.length > 0 && <div>
      <div style={{ fontFamily: mn, fontSize: 10, color: D.txs, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>KEY DATA POINTS</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
        {b.dataPoints.map(function(dp, i) {
          return <div key={i} style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 8, padding: "14px 16px" }}>
            <div style={{ fontFamily: mn, fontSize: 32, fontWeight: 900, color: D.amber }}>{dp.value}</div>
            <div style={{ fontFamily: ft, fontSize: 13, color: D.txs, marginTop: 2 }}>{dp.label}</div>
            <div style={{ fontFamily: mn, fontSize: 11, color: D.dim, marginTop: 2 }}>{dp.source}</div>
          </div>;
        })}
      </div>
    </div>}
  </div>);
}

// ═══ SCRIPT TAB ═══
function ScriptTab({ b }) {
  var full = (b.script.intro || "") + "\n\n" + (b.script.body || []).join("\n\n") + "\n\n" + (b.script.outro || "");
  var words = full.split(/\s+/).length;
  var time = Math.round(words / 150 * 60);
  var ssml = full.replace(/\n\n/g, '\n<break time="0.5s"/>\n');

  return (<div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
      <div style={{ fontFamily: mn, fontSize: 11, color: D.txs }}>{words} words // ~{Math.floor(time / 60)}m {time % 60}s at 150wpm</div>
      <div style={{ display: "flex", gap: 6 }}>
        <CopyBtn text={full} />
        <span onClick={function() { copy(ssml); }} style={{ fontFamily: mn, fontSize: 9, color: D.txs, cursor: "pointer", padding: "3px 8px", borderRadius: 4, border: "1px solid " + D.border }}>Copy for ElevenLabs</span>
      </div>
    </div>
    {[{ l: "INTRO", t: b.script.intro, timing: "0-8s" }].concat(
      (b.script.body || []).map(function(p, i) { return { l: "BODY " + (i + 1), t: p, timing: "" }; }),
      [{ l: "OUTRO", t: b.script.outro, timing: "" }]
    ).map(function(s, i) {
      return <div key={i} style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 8, padding: "16px 20px", marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 1 }}>{s.l}</span>
            {s.timing && <span style={{ fontFamily: mn, fontSize: 9, color: D.txs, background: D.border, padding: "2px 6px", borderRadius: 4 }}>{s.timing}</span>}
          </div>
          <CopyBtn text={s.t} />
        </div>
        <div style={{ fontFamily: ft, fontSize: 15, color: D.tx, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{s.t}</div>
      </div>;
    })}
  </div>);
}

// ═══ B-ROLL TAB ═══
function BrollTab({ b }) {
  var allPrompts = (b.broll || []).map(function(s) { return s.prompt; }).join("\n\n");
  return (<div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
      <span style={{ fontFamily: mn, fontSize: 11, color: D.txs }}>{(b.broll || []).length} shots generated</span>
      <span onClick={function() { copy(allPrompts); }} style={{ fontFamily: mn, fontSize: 9, color: D.txs, cursor: "pointer", padding: "3px 8px", borderRadius: 4, border: "1px solid " + D.border }}>Copy All Prompts</span>
    </div>
    {(b.broll || []).map(function(shot, i) {
      var _model = useState("kling"); var model = _model[0]; var setModel = _model[1];
      return <div key={i} style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 8, padding: "16px 20px", marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontFamily: mn, fontSize: 10, color: D.amber }}>SHOT {String(shot.shot).padStart(2, "0")}</span>
            <span style={{ fontFamily: mn, fontSize: 9, background: D.border, padding: "2px 6px", borderRadius: 4, color: D.txs }}>{shot.timing}</span>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {["kling", "veo", "fal"].map(function(m) { return <span key={m} onClick={function() { setModel(m); }} style={{ fontFamily: mn, fontSize: 9, padding: "2px 8px", borderRadius: 4, cursor: "pointer", background: model === m ? D.amber : "transparent", color: model === m ? D.bg : D.txs, border: model === m ? "none" : "1px solid " + D.border, textTransform: "capitalize" }}>{m}</span>; })}
          </div>
        </div>
        <div style={{ fontFamily: ft, fontSize: 13, color: D.txs, fontStyle: "italic", marginBottom: 8 }}>{shot.description}</div>
        <div style={{ background: D.bg, border: "1px solid " + D.border, borderRadius: 6, padding: "12px 14px", position: "relative" }}>
          <div style={{ fontFamily: mn, fontSize: 12, color: D.tx, lineHeight: 1.6 }}>{shot.prompt}</div>
          <div style={{ position: "absolute", top: 8, right: 8 }}><CopyBtn text={shot.prompt} /></div>
        </div>
        {shot.camera && <div style={{ fontFamily: mn, fontSize: 10, color: D.dim, marginTop: 6 }}>CAMERA: {shot.camera}</div>}
      </div>;
    })}
  </div>);
}

// ═══ SOCIAL KIT TAB ═══
function SocialTab({ b }) {
  var s = b.social || {};
  var renderHashtags = function(t) {
    return t.split(/(#\w+)/g).map(function(p, i) {
      if (p.startsWith("#")) return <span key={i} style={{ display: "inline-block", fontFamily: mn, fontSize: 11, color: D.amber, background: D.amber + "12", border: "1px solid " + D.amber + "25", padding: "2px 8px", borderRadius: 4, margin: "1px 2px" }}>{p}</span>;
      return <span key={i}>{p}</span>;
    });
  };

  var platforms = [
    { key: "x", pc: PC.x, content: s.x ? <div><div style={{ fontFamily: mn, fontSize: 9, color: D.txs, marginBottom: 4 }}>HOOK TWEET</div><div style={{ fontFamily: ft, fontSize: 13, color: D.tx, lineHeight: 1.6, marginBottom: 8 }}>{s.x.hook}</div><div style={{ fontFamily: mn, fontSize: 9, color: D.txs, marginBottom: 4 }}>REPLY WITH LINK</div><div style={{ fontFamily: ft, fontSize: 13, color: D.tx, lineHeight: 1.6 }}>{s.x.reply}</div></div> : null, copyText: s.x ? s.x.hook + "\n\n" + s.x.reply : "" },
    { key: "linkedin", pc: PC.linkedin, content: <div style={{ fontFamily: ft, fontSize: 13, color: D.tx, lineHeight: 1.6 }}>{s.linkedin}</div>, copyText: s.linkedin || "" },
    { key: "instagram", pc: PC.instagram, content: <div style={{ fontFamily: ft, fontSize: 13, color: D.tx, lineHeight: 1.6 }}>{s.instagram ? renderHashtags(s.instagram) : ""}</div>, copyText: s.instagram || "" },
    { key: "tiktok", pc: PC.tiktok, content: <div style={{ fontFamily: ft, fontSize: 13, color: D.tx, lineHeight: 1.6 }}>{s.tiktok ? renderHashtags(s.tiktok) : ""}</div>, copyText: s.tiktok || "" },
    { key: "youtube", pc: PC.youtube, content: s.youtube ? <div><div style={{ fontFamily: mn, fontSize: 9, color: D.txs, marginBottom: 4 }}>TITLE</div><div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: D.tx, marginBottom: 8 }}>{s.youtube.title}</div><div style={{ fontFamily: mn, fontSize: 9, color: D.txs, marginBottom: 4 }}>DESCRIPTION</div><div style={{ fontFamily: ft, fontSize: 13, color: D.tx, lineHeight: 1.6 }}>{s.youtube.description}</div></div> : null, copyText: s.youtube ? s.youtube.title + "\n\n" + s.youtube.description : "" },
  ];

  return (<div>
    <div style={{ fontFamily: mn, fontSize: 10, color: D.txs, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>VIDEO SOCIAL KIT</div>
    <div style={{ fontFamily: ft, fontSize: 13, color: D.txs, marginBottom: 16 }}>Captions for when you post the finished video.</div>
    {platforms.map(function(p) {
      return <div key={p.key} style={{ background: D.card, border: "1px solid " + D.border, borderLeft: "3px solid " + p.pc.c, borderRadius: 8, padding: "16px 20px", marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 14 }}>{p.pc.i}</span><span style={{ fontFamily: ft, fontSize: 13, fontWeight: 700, color: p.pc.c }}>{p.pc.n}</span></div>
          <CopyBtn text={p.copyText} />
        </div>
        {p.content}
        <div style={{ fontFamily: mn, fontSize: 11, color: p.copyText.length > 280 && p.key === "x" ? D.coral : D.dim, textAlign: "right", marginTop: 6 }}>{p.copyText.length} chars</div>
      </div>;
    })}
  </div>);
}

// ═══ PIPELINE TAB ═══
function PipelineTab() {
  var steps = [
    { l: "Article Fetch", ic: "\uD83C\uDF10", model: "Gemini 2.0 Flash", status: "complete", desc: "Fetches and extracts article content" },
    { l: "Brief + Script", ic: "\uD83D\uDCC4", model: "Claude Sonnet 4", status: "complete", desc: "Generates hook, script, b-roll prompts, social captions" },
    { l: "Voiceover", ic: "\uD83C\uDF99", model: "ElevenLabs TTS", status: "soon", desc: "Script to audio .mp3 // ~$0.15/video" },
    { l: "B-Roll Generation", ic: "\uD83C\uDFA5", model: "FAL.ai (Kling / Veo)", status: "soon", desc: "5 cinematic clips // ~$0.75-2.00/video" },
    { l: "Assembly", ic: "\uD83D\uDDC2", model: "Remotion + FFmpeg", status: "soon", desc: "Composite VO + b-roll + SA overlays + text animations" },
    { l: "Export", ic: "\u2B07\uFE0F", model: "MP4 // 16:9 // 9:16 // 1:1", status: "soon", desc: "Multi-format export, ready to post" },
  ];
  return (<div>
    <div style={{ fontFamily: mn, fontSize: 10, color: D.txs, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>AUTOMATION PIPELINE</div>
    <div style={{ fontFamily: ft, fontSize: 13, color: D.txs, marginBottom: 20 }}>Full article to video for ~$1.50</div>
    {steps.map(function(s, i) {
      var done = s.status === "complete";
      return <div key={i}>
        <div style={{ display: "flex", gap: 14, padding: "14px 16px", background: D.card, border: "1px solid " + D.border, borderRadius: 8, marginBottom: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: done ? D.teal + "15" : D.amber + "10", border: "1px solid " + (done ? D.teal + "30" : D.amber + "20"), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{s.ic}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <span style={{ fontFamily: ft, fontSize: 13, fontWeight: 700, color: D.tx }}>{s.l}</span>
              <span style={{ fontFamily: mn, fontSize: 8, color: done ? D.teal : D.amber, padding: "1px 6px", borderRadius: 3, background: (done ? D.teal : D.amber) + "12", textTransform: "uppercase" }}>{done ? "Complete" : "Coming Soon"}</span>
            </div>
            <div style={{ fontFamily: mn, fontSize: 10, color: D.txs }}>{s.model}</div>
            <div style={{ fontFamily: ft, fontSize: 11, color: D.dim, marginTop: 2 }}>{s.desc}</div>
          </div>
        </div>
        {i < steps.length - 1 && <div style={{ width: 1, height: 16, background: D.border, marginLeft: 34 }} />}
      </div>;
    })}
    <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 8, padding: "12px 16px", textAlign: "center", marginTop: 16 }}>
      <div style={{ fontFamily: mn, fontSize: 12, color: D.tx }}>Estimated total: ~$1.00-2.50 per finished video</div>
    </div>
  </div>);
}

// ═══ LOADING STEPS ═══
function LoadingSteps({ mode, step }) {
  var steps = mode === "url" ? [
    "Fetching article with Gemini", "Extracting key data points", "Writing script with Claude", "Generating b-roll prompts", "Building social captions"
  ] : [
    "Extracting key data points", "Writing script with Claude", "Generating b-roll prompts", "Building social captions"
  ];
  return (<div style={{ padding: "40px 20px" }}>
    {steps.map(function(s, i) {
      var active = i === step;
      var done = i < step;
      return <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0" }}>
        <style dangerouslySetInnerHTML={{ __html: "@keyframes stepPulse{0%,100%{opacity:0.4}50%{opacity:1}}" }} />
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: done ? D.teal : active ? D.amber : D.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "#fff", animation: active ? "stepPulse 1.2s ease-in-out infinite" : "none", flexShrink: 0 }}>{done ? "\u2713" : ""}</div>
        <span style={{ fontFamily: ft, fontSize: 13, color: done ? D.teal : active ? D.amber : D.txs }}>{s}</span>
      </div>;
    })}
  </div>);
}

// ═══ MAIN ═══
export default function PressToPremi() {
  var _mode = useState("url"), mode = _mode[0], setMode = _mode[1];
  var _url = useState(""), url = _url[0], setUrl = _url[1];
  var _text = useState(""), text = _text[0], setText = _text[1];
  var _format = useState("standard"), format = _format[0], setFormat = _format[1];
  var _tone = useState("data"), tone = _tone[0], setTone = _tone[1];
  var _brief = useState(null), brief = _brief[0], setBrief = _brief[1];
  var _loading = useState(false), loading = _loading[0], setLoading = _loading[1];
  var _step = useState(0), step = _step[0], setStep = _step[1];
  var _tab = useState("brief"), tab = _tab[0], setTab = _tab[1];
  var _history = useState([]), history = _history[0], setHistory = _history[1];

  useEffect(function() { try { var h = localStorage.getItem("p2p-history"); if (h) setHistory(JSON.parse(h)); } catch (e) {} }, []);
  useEffect(function() { try { localStorage.setItem("p2p-history", JSON.stringify(history)); } catch (e) {} }, [history]);

  var formats = [{ id: "short", l: "Short", dur: "15-30s", plat: "Reels / TikTok / Shorts" }, { id: "standard", l: "Standard", dur: "45-60s", plat: "LinkedIn / X" }, { id: "long", l: "Long", dur: "90-120s", plat: "YouTube" }];
  var tones = [{ id: "data", l: "Data-driven" }, { id: "explainer", l: "Explainer" }, { id: "hype", l: "Hype" }, { id: "breaking", l: "Breaking" }];
  var durMap = { short: 30, standard: 60, long: 120 };

  var generate = async function() {
    var input = mode === "url" ? url : text;
    if (!input.trim()) return;
    setLoading(true); setBrief(null); setStep(0); setTab("brief");

    // Simulate step progression
    var totalSteps = mode === "url" ? 5 : 4;
    var iv = setInterval(function() { setStep(function(s) { if (s < totalSteps - 1) return s + 1; clearInterval(iv); return s; }); }, 2200);

    try {
      var r = await fetch("/api/press-to-premier", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: mode, url: mode === "url" ? url : undefined, text: mode === "text" ? text : undefined, format: formats.find(function(f) { return f.id === format; }).l, duration: durMap[format], tone: tones.find(function(t) { return t.id === tone; }).l }),
      });
      clearInterval(iv); setStep(totalSteps);
      var d = await r.json();
      if (d.error) { toast(d.error, "error"); } else if (d.brief) {
        setBrief(d.brief);
        toast("Brief generated.", "success");
        // Add to history
        var entry = { hook: (d.brief.hook || "").slice(0, 40), ts: Date.now(), brief: d.brief };
        setHistory(function(p) { return [entry].concat(p).slice(0, 5); });
      }
    } catch (e) { clearInterval(iv); toast("Generation failed.", "error"); }
    setLoading(false);
  };

  var hasInput = mode === "url" ? url.trim() : text.trim();

  return (<div style={{ display: "flex", gap: 0, minHeight: "calc(100vh - 120px)" }}>
    <style dangerouslySetInnerHTML={{ __html: "@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');" }} />
    <Toasts />

    {/* LEFT PANEL */}
    <div style={{ width: "38%", flexShrink: 0, padding: "0 20px 20px 0", borderRight: "1px solid " + D.border, overflow: "hidden" }}>
      <div style={{ fontFamily: ft, fontSize: 22, fontWeight: 500, color: D.tx, marginBottom: 4 }}>Press to Premier</div>
      <div style={{ fontFamily: ft, fontSize: 13, color: D.txs, marginBottom: 16 }}>Article to video brief in seconds.</div>
      <div style={{ height: 1, background: D.border, marginBottom: 16 }} />

      {/* Mode toggle */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[{ id: "url", l: "Paste URL" }, { id: "text", l: "Paste Text" }].map(function(m) {
          var on = mode === m.id;
          return <span key={m.id} onClick={function() { setMode(m.id); }} style={{ flex: 1, padding: "8px 12px", borderRadius: 6, cursor: "pointer", textAlign: "center", background: on ? D.amber : "transparent", border: on ? "none" : "1px solid " + D.border, color: on ? D.bg : D.txs, fontFamily: ft, fontSize: 12, fontWeight: on ? 600 : 400, transition: "all 0.15s" }}>{m.l}</span>;
        })}
      </div>

      {/* Input */}
      {mode === "url" ? <div style={{ marginBottom: 16 }}>
        <input value={url} onChange={function(e) { setUrl(e.target.value); }} placeholder="https://semianalysis.com/article..." style={{ width: "100%", padding: "10px 14px", background: D.card, border: "1px solid " + D.border, borderRadius: 8, color: D.tx, fontFamily: ft, fontSize: 13, outline: "none", boxSizing: "border-box" }} onFocus={function(e) { e.target.style.borderColor = D.amber; }} onBlur={function(e) { e.target.style.borderColor = D.border; }} />
        <div style={{ fontFamily: mn, fontSize: 11, color: D.txs, marginTop: 6 }}>Gemini fetches the article. Claude writes everything else.</div>
      </div>
      : <div style={{ marginBottom: 16 }}>
        <textarea value={text} onChange={function(e) { setText(e.target.value); }} placeholder="Paste the full article text here..." rows={8} style={{ width: "100%", minHeight: 160, maxHeight: 280, padding: "10px 14px", background: D.card, border: "1px solid " + D.border, borderRadius: 8, color: D.tx, fontFamily: ft, fontSize: 13, outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.6 }} onFocus={function(e) { e.target.style.borderColor = D.amber; }} onBlur={function(e) { e.target.style.borderColor = D.border; }} />
        <div style={{ fontFamily: mn, fontSize: 11, color: D.txs, textAlign: "right", marginTop: 4 }}>{text.length} chars</div>
      </div>}

      {/* Format */}
      <div style={{ fontFamily: mn, fontSize: 10, color: D.txs, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>VIDEO FORMAT</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {formats.map(function(f) {
          var on = format === f.id;
          return <div key={f.id} onClick={function() { setFormat(f.id); }} style={{ flex: 1, padding: "12px 10px", borderRadius: 8, cursor: "pointer", background: D.card, border: on ? "1px solid " + D.amber : "1px solid " + D.border, borderLeft: on ? "3px solid " + D.amber : "1px solid " + (on ? D.amber : D.border), textAlign: "center", transition: "all 0.15s" }}>
            <div style={{ fontFamily: mn, fontSize: 16, fontWeight: 700, color: D.amber }}>{f.dur}</div>
            <div style={{ fontFamily: ft, fontSize: 11, color: D.txs, marginTop: 2 }}>{f.plat}</div>
          </div>;
        })}
      </div>

      {/* Tone */}
      <div style={{ fontFamily: mn, fontSize: 10, color: D.txs, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>TONE</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {tones.map(function(t) {
          var on = tone === t.id;
          return <span key={t.id} onClick={function() { setTone(t.id); }} style={{ padding: "6px 14px", borderRadius: 6, cursor: "pointer", background: on ? D.amber : "transparent", border: on ? "none" : "1px solid " + D.border, color: on ? D.bg : D.txs, fontFamily: ft, fontSize: 12, fontWeight: on ? 600 : 400, transition: "all 0.15s" }}>{t.l}</span>;
        })}
      </div>

      {/* Generate */}
      <button onClick={generate} disabled={!hasInput || loading} style={{ width: "100%", height: 44, borderRadius: 8, border: "none", background: D.amber, color: D.bg, fontFamily: ft, fontSize: 14, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", cursor: !hasInput || loading ? "not-allowed" : "pointer", opacity: !hasInput || loading ? 0.4 : 1, transition: "all 0.15s" }}>{loading ? "Generating..." : "Generate Brief"}</button>
      <div style={{ fontFamily: mn, fontSize: 11, color: D.dim, textAlign: "center", marginTop: 8 }}>~$0.02 per brief // Claude + Gemini</div>

      {/* History */}
      {history.length > 0 && <div style={{ marginTop: 20 }}>
        <div style={{ fontFamily: mn, fontSize: 10, color: D.txs, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>RECENT</div>
        {history.map(function(h, i) {
          return <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", marginBottom: 4, borderRadius: 6, cursor: "pointer", background: D.card, border: "1px solid " + D.border }} onClick={function() { setBrief(h.brief); setTab("brief"); }}>
            <div style={{ flex: 1, fontFamily: ft, fontSize: 11, color: D.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.hook || "Brief"}</div>
            <span style={{ fontFamily: mn, fontSize: 8, color: D.dim }}>{new Date(h.ts).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
            <span onClick={function(e) { e.stopPropagation(); setHistory(function(p) { return p.filter(function(_, j) { return j !== i; }); }); }} style={{ fontFamily: mn, fontSize: 10, color: D.dim, cursor: "pointer" }}>x</span>
          </div>;
        })}
      </div>}
    </div>

    {/* RIGHT PANEL */}
    <div style={{ flex: 1, padding: "0 0 20px 20px", overflow: "auto" }}>
      {!brief && !loading && <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 400 }}>
        <div style={{ fontSize: 48, opacity: 0.3, marginBottom: 16 }}>{"\uD83C\uDFAC"}</div>
        <div style={{ fontFamily: ft, fontSize: 16, color: D.txs }}>Paste an article to get started.</div>
        <div style={{ fontFamily: ft, fontSize: 13, color: D.dim, marginTop: 6 }}>Brief, script, b-roll prompts, and social captions generated in one shot.</div>
      </div>}

      {loading && <LoadingSteps mode={mode} step={step} />}

      {brief && !loading && <div>
        <div style={{ display: "flex", borderBottom: "1px solid " + D.border, marginBottom: 20 }}>
          {["brief", "script", "broll", "social", "pipeline"].map(function(t) {
            var labels = { brief: "Brief", script: "Script", broll: "B-Roll", social: "Social Kit", pipeline: "Pipeline" };
            return <Tab key={t} l={labels[t]} active={tab === t} onClick={function() { setTab(t); }} />;
          })}
        </div>
        {tab === "brief" && <BriefTab b={brief} />}
        {tab === "script" && <ScriptTab b={brief} />}
        {tab === "broll" && <BrollTab b={brief} />}
        {tab === "social" && <SocialTab b={brief} />}
        {tab === "pipeline" && <PipelineTab />}
      </div>}
    </div>
  </div>);
}
