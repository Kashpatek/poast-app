"use client";
import { useState, useEffect, useRef } from "react";

// ═══ TYPES ═══
interface ToastEntry {
  id: number;
  m: string;
  t: "success" | "error" | "info" | "warn";
  code?: number;
}

interface BRollShot {
  description: string;
  prompt: string;
  timing?: string;
  camera?: string;
  shot?: number;
}

interface Script {
  hook: string;
  intro: string;
  body: string[];
  outro: string;
  broll?: BRollShot[];
}

interface OptionsData {
  titles: string[];
  hooks: string[];
  descriptions: string[];
}

interface Clip {
  taskId?: string;
  videoUrl?: string;
  shot: number;
  pending?: boolean;
  provider?: string;
  progress?: number;
  error?: string;
  variation?: number;
}

interface Assets {
  voiceover: string | null;
  clips: Clip[];
  music: string | null;
}

interface AudioMixData {
  clipVol: number;
  voVol: number;
  musicVol: number;
}

interface ProjectData {
  mode?: string;
  url?: string;
  text?: string;
  options?: OptionsData;
  selTitle?: number;
  selHook?: number;
  selDesc?: number;
  scripts?: Script[];
  selScript?: number;
  duration?: number;
  aspect?: string;
  captionStyle?: string;
  fontId?: string;
  fontFamily?: string;
  fontSize?: number;
  assets?: Assets;
  selectedClips?: Record<string, number>;
  audioMix?: AudioMixData;
}

interface Project {
  id: string;
  title: string;
  status: string;
  step: number;
  data: ProjectData;
  ts: number;
}

interface LogEntry {
  msg: string;
  type: string;
  ts: string;
}

interface BRollAsset {
  id: string;
  type: string;
  url: string;
  thumbnail?: string;
  filename?: string;
  description?: string;
  source?: string;
  category?: string;
}

interface Voice {
  id: string;
  name: string;
}

interface RenderVideo {
  url: string;
  name?: string;
  size?: number;
}

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
var _toast: { current: ((msg: string, type?: string, code?: number) => void) | null } = { current: null };
function toast(msg: string, type?: string, code?: number) { if (_toast.current) _toast.current(msg, type, code); }
function Toasts() {
  var _l = useState<ToastEntry[]>([]), l = _l[0], sl = _l[1];
  _toast.current = function(m: string, t?: string, code?: number) { var id = Date.now(); sl(function(p) { var entry: ToastEntry = { id: id, m: m, t: (t || "success") as ToastEntry["t"], code: code }; return [entry].concat(p).slice(0, 5); }); setTimeout(function() { sl(function(p) { return p.filter(function(x) { return x.id !== id; }); }); }, 5000); };
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
function StepTracker({ current, steps }: { current: number; steps: string[] }) {
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
        return <div key={i} style={{ flex: 1, textAlign: "center", cursor: "default", opacity: future ? 0.3 : 1, transition: "opacity 0.2s" }}>
          <div style={{ fontFamily: mn, fontSize: 24, fontWeight: 900, color: done ? D.teal : active ? D.amber : D.txl, transition: "color 0.3s", textShadow: active ? "0 0 20px " + D.amber + "40" : "none" }}>{done ? "\u2713" : i + 1}</div>
          <div style={{ fontFamily: ft, fontSize: 12, fontWeight: active ? 700 : 500, color: active ? D.tx : D.txl, marginTop: 4, letterSpacing: active ? 0.5 : 0 }}>{s}</div>
        </div>;
      })}
    </div>
  </div>;
}

// ═══ OPTION CARD ═══
function OptionCards({ options, selected, onSelect, label }: { options: string[]; selected: number; onSelect: (i: number) => void; label: string }) {
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
function Step1({ data, setData, onNext }: { data: ProjectData; setData: React.Dispatch<React.SetStateAction<ProjectData>>; onNext: () => void }) {
  var _mode = useState<string>(data.mode || "url"), mode = _mode[0], setMode = _mode[1];
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
function Step2({ data, setData, onNext, onBack }: { data: ProjectData; setData: React.Dispatch<React.SetStateAction<ProjectData>>; onNext: () => void; onBack: () => void }) {
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

// ═══ B-ROLL BROWSER OVERLAY ═══
var BROLL_CATEGORIES = ["All", "AI", "Semiconductors", "Data Centers", "Networking", "Memory", "Cloud", "Energy", "Packaging", "Software", "Other"];

function BRollBrowser({ open, onClose, onSelect, filterType }: { open: boolean; onClose: () => void; onSelect: (a: BRollAsset) => void; filterType?: string }) {
  var _assets = useState<BRollAsset[]>([]), assets = _assets[0], setAssets = _assets[1];
  var _search = useState(""), search = _search[0], setSearch = _search[1];
  var _cat = useState("All"), cat = _cat[0], setCat = _cat[1];
  var _loading = useState(true), loading = _loading[0], setLoading = _loading[1];
  var _hover = useState<string | null>(null), hover = _hover[0], setHover = _hover[1];

  useEffect(function() {
    if (!open) return;
    setLoading(true);
    fetch("/api/db?table=projects").then(function(r) { return r.json(); }).then(function(res: { data?: Array<{ type: string; id: string; data?: { assets?: BRollAsset[] } }> }) {
      if (res.data) {
        var row = res.data.find(function(r) { return r.type === "broll-asset" && r.id === "broll-master"; });
        if (row && row.data && row.data.assets) {
          var a = row.data.assets;
          if (filterType) a = a.filter(function(x) { return x.type === filterType; });
          setAssets(a);
        }
      }
      setLoading(false);
    }).catch(function() { setLoading(false); });
  }, [open]);

  if (!open) return null;

  var filtered = assets.filter(function(a) {
    if (cat !== "All" && a.category !== cat) return false;
    if (search) {
      var q = search.toLowerCase();
      var hay = ((a.filename || "") + " " + (a.description || "") + " " + (a.source || "") + " " + (a.category || "")).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  });

  return <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }} />
    <div style={{ position: "relative", width: "90%", maxWidth: 800, maxHeight: "80vh", background: D.surface, border: "1px solid " + D.border, borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }} onClick={function(e) { e.stopPropagation(); }}>
      {/* Header */}
      <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid " + D.border, flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: ft, fontSize: 20, fontWeight: 800, color: D.tx, letterSpacing: -0.5 }}>Browse B-Roll</div>
            <div style={{ fontFamily: mn, fontSize: 10, color: D.txl, marginTop: 2 }}>{assets.length} asset{assets.length !== 1 ? "s" : ""} available{filterType ? " // " + filterType + " only" : ""}</div>
          </div>
          <div onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid " + D.border, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: D.txl, fontSize: 16, fontFamily: ft, transition: "all 0.15s" }} onMouseEnter={function(e: React.MouseEvent<HTMLDivElement>) { e.currentTarget.style.borderColor = D.coral; e.currentTarget.style.color = D.coral; }} onMouseLeave={function(e: React.MouseEvent<HTMLDivElement>) { e.currentTarget.style.borderColor = D.border; e.currentTarget.style.color = D.txl; }}>{"\u2715"}</div>
        </div>
        {/* Search + filter */}
        <div style={{ display: "flex", gap: 8 }}>
          <input value={search} onChange={function(e) { setSearch(e.target.value); }} placeholder="Search assets..." style={{ flex: 1, padding: "8px 14px", borderRadius: 8, border: "1px solid " + D.border, background: D.elevated || D.bg, color: D.tx, fontFamily: ft, fontSize: 12, outline: "none" }} />
          <select value={cat} onChange={function(e) { setCat(e.target.value); }} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid " + D.border, background: D.elevated || D.bg, color: D.tx, fontFamily: ft, fontSize: 11, outline: "none", cursor: "pointer" }}>
            {BROLL_CATEGORIES.map(function(c) { return <option key={c} value={c}>{c === "All" ? "All Categories" : c}</option>; })}
          </select>
        </div>
      </div>
      {/* Grid */}
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        {loading && <div style={{ textAlign: "center", padding: 48, color: D.txl, fontFamily: ft, fontSize: 14 }}>Loading assets...</div>}
        {!loading && filtered.length === 0 && <div style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.15 }}>{"\uD83C\uDFA5"}</div>
          <div style={{ fontFamily: ft, fontSize: 14, color: D.txl }}>{assets.length === 0 ? "No assets in B-Roll Library" : "No matching assets"}</div>
          <div style={{ fontFamily: ft, fontSize: 12, color: D.txh || D.txl, marginTop: 4 }}>Upload assets via the B-Roll Library module.</div>
        </div>}
        {!loading && filtered.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          {filtered.map(function(a) {
            var isHover = hover === a.id;
            var isVideo = a.type === "video";
            return <div key={a.id} onClick={function() { onSelect(a); onClose(); }} onMouseEnter={function() { setHover(a.id); }} onMouseLeave={function() { setHover(null); }} style={{ background: D.elevated || D.bg, border: "1px solid " + (isHover ? D.amber + "50" : D.border), borderRadius: 10, overflow: "hidden", cursor: "pointer", transition: "all 0.2s", boxShadow: isHover ? "0 4px 20px " + D.amber + "15" : "none", transform: isHover ? "translateY(-2px)" : "none" }}>
              {/* Thumbnail */}
              <div style={{ position: "relative", width: "100%", paddingTop: "56.25%", background: D.bg || "#000", overflow: "hidden" }}>
                {isVideo ? (
                  isHover ? <video src={a.url} autoPlay muted loop playsInline style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                  : <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {a.thumbnail ? <img src={a.thumbnail} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 24, opacity: 0.2 }}>{"\uD83C\uDFA5"}</span>}
                    </div>
                ) : (
                  <img src={a.url} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                )}
                <span style={{ position: "absolute", top: 4, left: 4, padding: "2px 6px", borderRadius: 4, background: isVideo ? (D.blue || "#0B86D1") + "CC" : (D.teal || "#2EAD8E") + "CC", color: "#fff", fontFamily: mn, fontSize: 8, fontWeight: 700, textTransform: "uppercase" }}>{a.type}</span>
                {a.category && a.category !== "Other" && <span style={{ position: "absolute", top: 4, right: 4, padding: "2px 6px", borderRadius: 4, background: D.amber + "CC", color: D.bg, fontFamily: ft, fontSize: 8, fontWeight: 700 }}>{a.category}</span>}
              </div>
              {/* Info */}
              <div style={{ padding: "8px 10px" }}>
                <div style={{ fontFamily: ft, fontSize: 11, fontWeight: 600, color: D.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.filename || "Untitled"}</div>
                {a.description && <div style={{ fontFamily: ft, fontSize: 10, color: D.txl || D.txb, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.description}</div>}
              </div>
            </div>;
          })}
        </div>}
      </div>
    </div>
  </div>;
}

// ═══ CHOP SENTENCES HELPER ═══
function chopSentences(text: string): string[] {
  if (!text) return [];
  return text.split(/(?<=[.!?])\s+/).filter(function(s) { return s.trim().length > 0; });
}

function ChoppedText({ text, chopped, color }: { text: string; chopped: boolean; color?: string }) {
  if (!chopped) return <span>{text}</span>;
  var sentences = chopSentences(text);
  if (sentences.length <= 1) return <span>{text}</span>;
  return <span>{sentences.map(function(s, i) {
    return <span key={i}>
      {i > 0 && <br />}
      <span style={{ display: "inline", borderLeft: i > 0 ? "2px solid " + (color || D.amber) + "30" : "none", paddingLeft: i > 0 ? 8 : 0, marginLeft: i > 0 ? 4 : 0 }}>{s}</span>
    </span>;
  })}</span>;
}

// ═══ STEP 3: SCRIPT (SCREENPLAY FORMAT) ═══
function Step3({ data, setData, onNext, onBack }: { data: ProjectData; setData: React.Dispatch<React.SetStateAction<ProjectData>>; onNext: () => void; onBack: () => void }) {
  var _dur = useState<number>(data.duration || 60), dur = _dur[0], setDur = _dur[1];
  var _chopped = useState(false), chopped = _chopped[0], setChopped = _chopped[1];
  var _browseOpen = useState(false), browseOpen = _browseOpen[0], setBrowseOpen = _browseOpen[1];
  var _browseIdx = useState<number | null>(null), browseIdx = _browseIdx[0], setBrowseIdx = _browseIdx[1];
  var _selectedBroll = useState<Record<string, BRollAsset>>({}), selectedBroll = _selectedBroll[0], setSelectedBroll = _selectedBroll[1];
  if (!data.scripts) return <div style={{ textAlign: "center", padding: 60, color: D.txl, fontFamily: ft, fontSize: 15 }}>Writing scripts...</div>;
  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
      <div style={{ fontFamily: ft, fontSize: 42, fontWeight: 900, color: D.tx, letterSpacing: -2 }}>Script</div>
      {/* Chop toggle */}
      <div onClick={function() { setChopped(!chopped); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 8, cursor: "pointer", background: chopped ? D.coral + "12" : D.surface, border: "1px solid " + (chopped ? D.coral + "40" : D.border), transition: "all 0.2s" }}>
        <div style={{ width: 32, height: 18, borderRadius: 9, background: chopped ? D.coral : D.border, position: "relative", transition: "all 0.2s" }}>
          <div style={{ width: 14, height: 14, borderRadius: 7, background: "#fff", position: "absolute", top: 2, left: chopped ? 16 : 2, transition: "all 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
        </div>
        <span style={{ fontFamily: mn, fontSize: 10, color: chopped ? D.coral : D.txl, textTransform: "uppercase", letterSpacing: 1 }}>Chop</span>
      </div>
    </div>
    <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 500, color: D.txb, marginBottom: 24 }}>Choose duration and pick a script version.{chopped ? " Sentences are split for punchier delivery." : ""}</div>
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
            <div style={{ paddingLeft: 20, color: D.tx, fontWeight: 500, fontFamily: ft, fontSize: 15, lineHeight: chopped ? 1.8 : undefined }}><ChoppedText text={s.hook} chopped={chopped} color={D.amber} /></div>
          </div>
          <div style={{ color: D.txl, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>INT. VIDEO - INTRO</div>
          <div style={{ paddingLeft: 0, marginBottom: 16 }}>
            <div style={{ color: D.amber, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 2, marginBottom: 2 }}>NARRATOR (V.O.)</div>
            <div style={{ paddingLeft: 20, color: D.txb, fontFamily: ft, fontSize: 14, lineHeight: chopped ? 1.8 : undefined }}><ChoppedText text={s.intro} chopped={chopped} color={D.amber} /></div>
          </div>
          {(s.body || []).map(function(b, bi) {
            return <div key={bi}>
              <div style={{ color: D.txl, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>INT. VIDEO - BODY {bi + 1}</div>
              <div style={{ paddingLeft: 0, marginBottom: 16 }}>
                <div style={{ color: D.blue, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 2, marginBottom: 2 }}>NARRATOR (V.O.)</div>
                <div style={{ paddingLeft: 20, color: D.txb, fontFamily: ft, fontSize: 14, lineHeight: chopped ? 1.8 : undefined }}><ChoppedText text={b} chopped={chopped} color={D.blue} /></div>
                {s.broll && s.broll[bi] && <div style={{ paddingLeft: 20, marginTop: 6 }}>
                  <span style={{ fontFamily: mn, fontSize: 10, color: D.txh, fontStyle: "italic" }}>B-ROLL: {s.broll[bi].description}</span>
                </div>}
              </div>
            </div>;
          })}
          <div style={{ color: D.txl, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>INT. VIDEO - OUTRO</div>
          <div style={{ paddingLeft: 0 }}>
            <div style={{ color: D.teal, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 2, marginBottom: 2 }}>NARRATOR (V.O.)</div>
            <div style={{ paddingLeft: 20, color: D.txb, fontFamily: ft, fontSize: 14, lineHeight: chopped ? 1.8 : undefined }}><ChoppedText text={s.outro} chopped={chopped} color={D.teal} /></div>
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
function Step4({ data, onNext, onBack }: { data: ProjectData; onNext: () => void; onBack: () => void }) {
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
var CAPTION_STYLES = [
  { id: "overlay", l: "Overlay Cards", desc: "Text on dark cards over b-roll", icon: "\u25A3" },
  { id: "subtitles", l: "Subtitles", desc: "Bottom-of-screen, word-by-word", icon: "\u2261" },
  { id: "minimal", l: "Minimal", desc: "Hook and outro only, no mid-video text", icon: "\u25AB" },
];
var FONT_OPTIONS = [
  { id: "outfit", l: "Outfit", family: "'Outfit',sans-serif" },
  { id: "grift", l: "Grift", family: "'Grift',sans-serif" },
  { id: "inter", l: "Inter", family: "'Inter',sans-serif" },
  { id: "jetbrains", l: "JetBrains Mono", family: "'JetBrains Mono',monospace" },
  { id: "roboto", l: "Roboto", family: "'Roboto',sans-serif" },
  { id: "poppins", l: "Poppins", family: "'Poppins',sans-serif" },
  { id: "space-grotesk", l: "Space Grotesk", family: "'Space Grotesk',sans-serif" },
];

function Step5({ data, setData, onNext, onBack }: { data: ProjectData; setData: React.Dispatch<React.SetStateAction<ProjectData>>; onNext: () => void; onBack: () => void }) {
  var _aspect = useState(data.aspect || "16:9"), aspect = _aspect[0], setAspect = _aspect[1];
  var _captionStyle = useState(data.captionStyle || "overlay"), captionStyle = _captionStyle[0], setCaptionStyle = _captionStyle[1];
  var _fontId = useState(data.fontId || "outfit"), fontId = _fontId[0], setFontId = _fontId[1];
  var _fontSize = useState(data.fontSize || 48), fontSize = _fontSize[0], setFontSize = _fontSize[1];
  var formats = [
    { id: "16:9", l: "Landscape", sub: "YouTube, LinkedIn, X", w: 160, h: 90 },
    { id: "9:16", l: "Vertical", sub: "Shorts, Reels, TikTok", w: 56, h: 100 },
    { id: "1:1", l: "Square", sub: "Instagram, Facebook", w: 100, h: 100 },
  ];
  var currentFont = FONT_OPTIONS.find(function(f) { return f.id === fontId; }) || FONT_OPTIONS[0];
  return <div>
    <div style={{ fontFamily: ft, fontSize: 42, fontWeight: 900, color: D.tx, letterSpacing: -2, marginBottom: 8 }}>Format</div>
    <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 500, color: D.txb, marginBottom: 28 }}>Aspect ratio, caption style, and font.</div>

    {/* Aspect Ratio */}
    <div style={{ fontFamily: mn, fontSize: 10, color: D.amber, textTransform: "uppercase", letterSpacing: 2, marginBottom: 10 }}>Aspect Ratio</div>
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

    {/* Caption Style */}
    <div style={{ fontFamily: mn, fontSize: 10, color: D.blue, textTransform: "uppercase", letterSpacing: 2, marginBottom: 10 }}>Caption Style</div>
    <div style={{ display: "flex", gap: 12, marginBottom: 32 }}>
      {CAPTION_STYLES.map(function(cs) {
        var on = captionStyle === cs.id;
        return <div key={cs.id} onClick={function() { setCaptionStyle(cs.id); setData(function(p) { return Object.assign({}, p, { captionStyle: cs.id }); }); }} style={{ flex: 1, padding: "18px 16px", borderRadius: 10, cursor: "pointer", background: on ? D.blue + "0C" : D.surface, border: "1px solid " + (on ? D.blue + "40" : D.border), transition: "all 0.2s", boxShadow: on ? "0 0 16px " + D.blue + "10" : "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 18, opacity: on ? 1 : 0.4 }}>{cs.icon}</span>
            <span style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: on ? D.blue : D.tx }}>{cs.l}</span>
          </div>
          <div style={{ fontFamily: ft, fontSize: 11, color: D.txl }}>{cs.desc}</div>
        </div>;
      })}
    </div>

    {/* Font Controls */}
    <div style={{ fontFamily: mn, fontSize: 10, color: D.teal, textTransform: "uppercase", letterSpacing: 2, marginBottom: 10 }}>Font</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
      {/* Font Family */}
      <div>
        <div style={{ fontFamily: mn, fontSize: 9, color: D.txl, marginBottom: 6 }}>Family</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {FONT_OPTIONS.map(function(f) {
            var on = fontId === f.id;
            return <div key={f.id} onClick={function() { setFontId(f.id); setData(function(p) { return Object.assign({}, p, { fontId: f.id, fontFamily: f.family }); }); }} style={{ padding: "10px 12px", borderRadius: 8, cursor: "pointer", background: on ? D.teal + "0C" : D.surface, border: "1px solid " + (on ? D.teal + "40" : D.border), display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all 0.15s" }}>
              <span style={{ fontFamily: f.family, fontSize: 13, color: on ? D.teal : D.tx }}>{f.l}</span>
              {on && <div style={{ width: 8, height: 8, borderRadius: "50%", background: D.teal, boxShadow: "0 0 6px " + D.teal + "60" }} />}
            </div>;
          })}
        </div>
      </div>
      {/* Font Size + Preview */}
      <div>
        <div style={{ fontFamily: mn, fontSize: 9, color: D.txl, marginBottom: 6 }}>Size: {fontSize}px</div>
        <input type="range" min={24} max={72} value={fontSize} onChange={function(e) { var v = parseInt(e.target.value); setFontSize(v); setData(function(p) { return Object.assign({}, p, { fontSize: v }); }); }} style={{ width: "100%", accentColor: D.teal, marginBottom: 14 }} />
        {/* Preview */}
        <div style={{ background: D.bg, border: "1px solid " + D.border, borderRadius: 10, padding: "20px 16px", textAlign: "center", minHeight: 140, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div>
            <div style={{ fontFamily: currentFont.family, fontSize: Math.min(fontSize * 0.55, 36), fontWeight: 700, color: D.tx, lineHeight: 1.3, marginBottom: 8 }}>Sample Heading</div>
            <div style={{ fontFamily: currentFont.family, fontSize: Math.min(fontSize * 0.35, 20), color: D.txb, lineHeight: 1.5 }}>This is how your captions will look in the final video.</div>
            {captionStyle === "subtitles" && <div style={{ marginTop: 12, padding: "6px 12px", background: "rgba(0,0,0,0.7)", borderRadius: 4, display: "inline-block" }}>
              <span style={{ fontFamily: currentFont.family, fontSize: Math.min(fontSize * 0.35, 20), color: "#fff", fontWeight: 600 }}>Subtitle preview</span>
            </div>}
          </div>
        </div>
      </div>
    </div>

    <div style={{ height: 20 }} />
    <div style={{ display: "flex", gap: 12 }}>
      <button onClick={onBack} style={{ padding: "14px 24px", background: "transparent", border: "1px solid " + D.border, color: D.txl, borderRadius: 10, fontFamily: ft, fontSize: 14, cursor: "pointer" }}>Back</button>
      <button onClick={onNext} style={{ flex: 1, height: 52, background: "linear-gradient(135deg, " + D.amber + ", #E8A020)", color: D.bg, border: "none", borderRadius: 10, fontFamily: ft, fontSize: 16, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 20px " + D.amber + "30" }}>Produce</button>
    </div>
  </div>;
}

// ═══ STEP 6: PRODUCE (REAL API CALLS) ═══
function Step6({ data, setData, onNext, onBack }: { data: ProjectData; setData: React.Dispatch<React.SetStateAction<ProjectData>>; onNext: () => void; onBack: () => void }) {
  var _phase = useState<string>("idle"), phase = _phase[0], setPhase = _phase[1]; // idle, vo, broll, music, done, error
  var _log = useState<LogEntry[]>([]), log = _log[0], setLog = _log[1];
  var _assets = useState<Assets>({ voiceover: null, clips: [], music: null }), assets = _assets[0], setAssets = _assets[1];
  var logRef = useRef<HTMLDivElement>(null);
  var started = useRef(false);
  // Use refs to track final values since setState is async
  var voRef = useRef<string | null>(null);
  var musicRef = useRef<string | null>(null);

  var addLog = function(msg: string, type?: string) { setLog(function(p) { return p.concat([{ msg: msg, type: type || "info", ts: new Date().toLocaleTimeString() }]); }); };

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
      var voD = await voR.json() as { audio?: string; error?: string };
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

    // Submit clips with 1.5s delay between each (Grok rate limit: 1/sec)
    var clips: Clip[] = [];
    for (var ci = 0; ci < brollShots.length; ci++) {
      if (ci > 0) await new Promise<void>(function(res) { setTimeout(res, 1500); });
      var shot = brollShots[ci];
      try {
        var r = await fetch("/api/generate-clip", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "generate", prompt: shot.prompt, engine: "grok" }) });
        var d = await r.json() as { task?: { task_id: string }; error?: string };
        if (d.task && d.task.task_id) {
          addLog("Shot " + (ci + 1) + " submitted (ID: " + d.task.task_id.slice(0, 10) + "...)", "success");
          clips.push({ taskId: d.task.task_id, shot: ci + 1, pending: true, provider: "grok", progress: 0 });
        } else {
          addLog("Shot " + (ci + 1) + " error: " + (d.error || "Unknown"), "error");
          clips.push({ error: d.error, shot: ci + 1 });
        }
      } catch (e) {
        addLog("Shot " + (ci + 1) + " failed: " + String(e).slice(0, 50), "error");
        clips.push({ error: String(e), shot: ci + 1 });
      }
    }

    addLog(clips.filter(function(c) { return c.taskId; }).length + " shots submitted. Polling...", "info");

    // Poll ALL clips together until done or 3 min timeout
    var pollStart = Date.now();
    while (Date.now() - pollStart < 180000) {
      var stillPending = clips.filter(function(c) { return c.pending; });
      if (stillPending.length === 0) break;

      await new Promise<void>(function(res) { setTimeout(res, 8000); });

      for (var pi = 0; pi < clips.length; pi++) {
        if (!clips[pi].pending) continue;
        try {
          var stR = await fetch("/api/generate-clip", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status", taskId: clips[pi].taskId, engine: "grok" }) });
          var stD = await stR.json() as { task?: { task_status: string; task_result?: { videos?: Array<{ url: string }> }; progress?: number } };
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
      var muD = await muR.json() as { audio?: string; error?: string };
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
          var colors: Record<string, string> = { info: D.txb, success: D.teal, error: D.coral, warn: D.amber, dim: D.txl };
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
function ClipGrid({ clips, script, onUpdate }: { clips: Clip[]; script: Script | undefined; onUpdate: (clips: Clip[]) => void }) {
  var _checking = useState<Record<number, boolean>>({}), checking = _checking[0], setChecking = _checking[1];

  var checkClip = async function(idx: number) {
    var clip = clips[idx];
    if (!clip.taskId) return;
    setChecking(function(p) { var n = Object.assign({}, p); n[idx] = true; return n; });
    try {
      var r = await fetch("/api/generate-clip", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status", taskId: clip.taskId, engine: clip.provider || "grok" }) });
      var d = await r.json() as { task?: { task_status: string; task_result?: { videos?: Array<{ url: string }> } } };
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
function VoiceSelector({ assets, data, setData }: { assets: Assets; data: ProjectData; setData: React.Dispatch<React.SetStateAction<ProjectData>> }) {
  var _voices = useState<Voice[]>([]), voices = _voices[0], setVoices = _voices[1];
  var _selVoice = useState("JBFqnCBsd6RMkjVDRZzb"), selVoice = _selVoice[0], setSelVoice = _selVoice[1];
  var _regenning = useState(false), regenning = _regenning[0], setRegenning = _regenning[1];

  useEffect(function() {
    fetch("/api/generate-voiceover").then(function(r) { return r.json(); }).then(function(d: { voices?: Voice[] }) { if (d.voices) setVoices(d.voices.slice(0, 8)); });
  }, []);

  var regen = async function() {
    setRegenning(true);
    var script = data.scripts && data.scripts[data.selScript || 0];
    var fullScript = script ? (script.hook || "") + "\n\n" + (script.intro || "") + "\n\n" + (script.body || []).join("\n\n") + "\n\n" + (script.outro || "") : "";
    try {
      var r = await fetch("/api/generate-voiceover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: fullScript, voiceId: selVoice }) });
      var d = await r.json() as { audio?: string; error?: string };
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
function Step7({ data, setData, onNext, onBack }: { data: ProjectData; setData: React.Dispatch<React.SetStateAction<ProjectData>>; onNext: () => void; onBack: () => void }) {
  var assets: Assets = data.assets || { voiceover: null, clips: [], music: null };
  var clips = assets.clips || [];
  var script = data.scripts && data.scripts[data.selScript || 0];
  var brollShots = script && script.broll ? script.broll : [];

  // Group clips by shot number
  var shotGroups: Record<string, Clip[]> = {};
  clips.forEach(function(c) { var s = c.shot || 1; if (!shotGroups[s]) shotGroups[s] = []; shotGroups[s].push(c); });

  var _sel = useState<Record<string, number>>(data.selectedClips || {}), sel = _sel[0], setSel = _sel[1];
  var _regen = useState<Record<string, { loading: boolean; progress: number }>>({}), regen = _regen[0], setRegen = _regen[1]; // { shotNum: { loading, progress } }

  var selectClip = function(shotNum: string, clipIdx: number) {
    setSel(function(p) { var n = Object.assign({}, p); n[shotNum] = clipIdx; return n; });
    setData(function(p) { var n = Object.assign({}, p); n.selectedClips = Object.assign({}, sel, {}); n.selectedClips[shotNum] = clipIdx; return n; });
  };

  var repromptShot = async function(shotNum: string) {
    var shotIdx = parseInt(shotNum) - 1;
    var shotInfo = brollShots[shotIdx];
    if (!shotInfo) return;
    setRegen(function(p) { var n = Object.assign({}, p); n[shotNum] = { loading: true, progress: 0 }; return n; });

    try {
      // Submit
      var r = await fetch("/api/generate-clip", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "generate", prompt: shotInfo.prompt + ", alternative creative interpretation", engine: "grok" }) });
      var d = await r.json() as { task?: { task_id: string }; error?: string };
      if (!d.task || !d.task.task_id) { toast("Shot " + shotNum + " submit failed", "error"); setRegen(function(p) { var n = Object.assign({}, p); delete n[shotNum]; return n; }); return; }

      // Poll
      var taskId = d.task.task_id;
      var pollStart = Date.now();
      while (Date.now() - pollStart < 180000) {
        await new Promise<void>(function(res) { setTimeout(res, 8000); });
        try {
          var stR = await fetch("/api/generate-clip", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status", taskId: taskId, engine: "grok" }) });
          var stD = await stR.json() as { task?: { task_status: string; task_result?: { videos?: Array<{ url: string }> }; progress?: number } };
          if (stD.task && stD.task.task_status === "succeed" && stD.task.task_result && stD.task.task_result.videos) {
            var newClip = { taskId: taskId, videoUrl: stD.task.task_result.videos[0].url, shot: parseInt(shotNum), provider: "grok" };
            setData(function(p) { var a: Assets = Object.assign({}, p.assets || { voiceover: null, clips: [], music: null }); a.clips = (a.clips || []).concat([newClip]); return Object.assign({}, p, { assets: a }); });
            toast("Shot " + shotNum + " new version ready!", "success");
            setRegen(function(p) { var n = Object.assign({}, p); delete n[shotNum]; return n; });
            return;
          } else if (stD.task && stD.task.task_status === "failed") {
            toast("Shot " + shotNum + " failed", "error"); break;
          } else {
            var pct = stD.task && stD.task.progress ? stD.task.progress : 0;
            setRegen(function(p) { var n = Object.assign({}, p); n[shotNum] = { loading: true, progress: pct }; return n; });
          }
        } catch (pe) { /* keep polling */ }
      }
    } catch (e) { toast("Reprompt failed", "error"); }
    setRegen(function(p) { var n = Object.assign({}, p); delete n[shotNum]; return n; });
  };

  return <div>
    <div style={{ fontFamily: ft, fontSize: 42, fontWeight: 900, color: D.tx, letterSpacing: -2, marginBottom: 8 }}>Select Clips</div>
    <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 500, color: D.txb, marginBottom: 28 }}>Choose clips, swap voices, or regenerate shots.</div>

    <VoiceSelector assets={assets} data={data} setData={setData} />

    {Object.keys(shotGroups).sort(function(a, b) { return Number(a) - Number(b); }).map(function(shotNum) {
      var group = shotGroups[shotNum];
      var shotIdx = parseInt(shotNum) - 1;
      var shotInfo = brollShots[shotIdx];
      var selected = sel[shotNum] !== undefined ? sel[shotNum] : 0;
      var regenState = regen[shotNum];

      return <div key={shotNum} style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: D.tx }}>Shot {shotNum}</span>
          {shotInfo && <span style={{ fontFamily: ft, fontSize: 12, fontWeight: 500, color: D.txl }}>// {shotInfo.description}</span>}
          <button onClick={function() { repromptShot(shotNum); }} disabled={regenState && regenState.loading} style={{ marginLeft: "auto", padding: "4px 12px", background: "transparent", border: "1px solid " + D.amber + "25", color: D.amber, borderRadius: 6, fontFamily: ft, fontSize: 10, fontWeight: 600, cursor: regenState ? "wait" : "pointer", opacity: regenState ? 0.5 : 1 }}>{regenState ? "Rendering..." : "Regenerate"}</button>
        </div>
        {/* Progress bar for regenerating shot */}
        {regenState && regenState.loading && <div style={{ height: 3, background: D.border, borderRadius: 2, marginBottom: 8, overflow: "hidden" }}>
          <div style={{ height: "100%", width: (regenState.progress || 5) + "%", background: D.amber, borderRadius: 2, transition: "width 0.5s ease" }} />
        </div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(" + group.length + ", 1fr)", gap: 10 }}>
          {group.map(function(clip, ci) {
            var isSelected = selected === ci;
            return <div key={ci} onClick={function() { selectClip(shotNum, ci); }} style={{ background: isSelected ? D.elevated : D.surface, border: isSelected ? "2px solid " + D.amber : "1px solid " + D.border, borderRadius: 10, padding: 10, cursor: "pointer", transition: "all 0.2s", boxShadow: isSelected ? "0 0 16px " + D.amber + "10" : "none" }}>
              <div style={{ aspectRatio: "16/9", background: D.bg, borderRadius: 6, marginBottom: 8, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {clip.videoUrl ? <video src={clip.videoUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} onMouseEnter={function(e: React.MouseEvent<HTMLVideoElement>) { e.currentTarget.play(); }} onMouseLeave={function(e: React.MouseEvent<HTMLVideoElement>) { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }} muted />
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

// ═══ AUDIO MIXER ═══
function AudioMixer({ videoRef, voRef, musicRef, assets, onMixChange }: { videoRef: React.RefObject<HTMLVideoElement | null>; voRef: React.RefObject<HTMLAudioElement | null>; musicRef: React.RefObject<HTMLAudioElement | null>; assets: Assets; onMixChange?: (mix: AudioMixData) => void }) {
  var _clipVol = useState(30), clipVol = _clipVol[0], setClipVol = _clipVol[1];
  var _voVol = useState(100), voVol = _voVol[0], setVoVol = _voVol[1];
  var _musicVol = useState(15), musicVol = _musicVol[0], setMusicVol = _musicVol[1];

  // Report mix levels up to parent for render export
  useEffect(function() { if (onMixChange) onMixChange({ clipVol: clipVol, voVol: voVol, musicVol: musicVol }); }, [clipVol, voVol, musicVol]);
  var _clipMuted = useState(false), clipMuted = _clipMuted[0], setClipMuted = _clipMuted[1];
  var _voMuted = useState(false), voMuted = _voMuted[0], setVoMuted = _voMuted[1];
  var _musicMuted = useState(false), musicMuted = _musicMuted[0], setMusicMuted = _musicMuted[1];

  // Apply volumes in real time
  useEffect(function() { if (videoRef.current) videoRef.current.volume = clipMuted ? 0 : clipVol / 100; }, [clipVol, clipMuted]);
  useEffect(function() { if (voRef.current) voRef.current.volume = voMuted ? 0 : voVol / 100; }, [voVol, voMuted]);
  useEffect(function() { if (musicRef.current) musicRef.current.volume = musicMuted ? 0 : musicVol / 100; }, [musicVol, musicMuted]);

  var tracks = [
    { l: "B-Roll Audio", vol: clipVol, setVol: setClipVol, muted: clipMuted, setMuted: setClipMuted, color: D.blue, has: true },
    { l: "Voiceover", vol: voVol, setVol: setVoVol, muted: voMuted, setMuted: setVoMuted, color: D.amber, has: !!assets.voiceover },
    { l: "Music", vol: musicVol, setVol: setMusicVol, muted: musicMuted, setMuted: setMusicMuted, color: D.violet, has: !!assets.music },
  ];

  return <div style={{ marginTop: 16, padding: "16px 18px", background: D.bg, border: "1px solid " + D.border, borderRadius: 10 }}>
    <div style={{ fontFamily: ft, fontSize: 10, fontWeight: 600, color: D.txl, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>Audio Mixer</div>
    {tracks.map(function(t) {
      return <div key={t.l} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, opacity: t.has ? 1 : 0.3 }}>
        {/* Mute toggle */}
        <span onClick={function() { if (t.has) t.setMuted(!t.muted); }} style={{ width: 28, height: 28, borderRadius: 6, background: t.muted ? D.coral + "20" : D.surface, border: "1px solid " + (t.muted ? D.coral + "40" : D.border), display: "flex", alignItems: "center", justifyContent: "center", cursor: t.has ? "pointer" : "default", fontFamily: ft, fontSize: 10, color: t.muted ? D.coral : D.txl, transition: "all 0.15s" }}>{t.muted ? "M" : "V"}</span>
        {/* Label */}
        <div style={{ width: 80, fontFamily: ft, fontSize: 11, fontWeight: 600, color: t.color }}>{t.l}</div>
        {/* Slider */}
        <div style={{ flex: 1, position: "relative", height: 24, display: "flex", alignItems: "center" }}>
          <div style={{ position: "absolute", left: 0, right: 0, height: 4, background: D.border, borderRadius: 2 }}>
            <div style={{ height: "100%", width: (t.muted ? 0 : t.vol) + "%", background: t.muted ? D.coral + "40" : t.color, borderRadius: 2, transition: "width 0.1s" }} />
          </div>
          <input type="range" min={0} max={100} value={t.vol} onChange={function(e) { t.setVol(parseInt(e.target.value)); }} disabled={!t.has} style={{ position: "absolute", left: 0, right: 0, width: "100%", height: 24, opacity: 0, cursor: t.has ? "pointer" : "default", margin: 0 }} />
        </div>
        {/* Value */}
        <span style={{ fontFamily: mn, fontSize: 10, color: t.muted ? D.coral : D.txl, width: 32, textAlign: "right" }}>{t.muted ? "OFF" : t.vol + "%"}</span>
      </div>;
    })}
  </div>;
}

// ═══ STEP 8: ASSEMBLED PREVIEW ═══
function Step8({ data, setData, onNext, onBack }: { data: ProjectData; setData: React.Dispatch<React.SetStateAction<ProjectData>>; onNext: () => void; onBack: () => void }) {
  var assets: Assets = data.assets || { voiceover: null, clips: [], music: null };
  var script = data.scripts && data.scripts[data.selScript || 0];
  var aspect = data.aspect || "16:9";
  var selectedClips = data.selectedClips || {};

  // Build ordered clip list from selections
  var orderedClips: Clip[] = [];
  if (assets.clips) {
    var shotGroups: Record<string, Clip[]> = {};
    assets.clips.forEach(function(c) { var s = c.shot || 1; if (!shotGroups[s]) shotGroups[s] = []; shotGroups[s].push(c); });
    Object.keys(shotGroups).sort(function(a, b) { return Number(a) - Number(b); }).forEach(function(s) {
      var sel = selectedClips[s] || 0;
      var clip = shotGroups[s][sel];
      if (clip && clip.videoUrl) orderedClips.push(clip);
    });
  }

  // Sequential video player
  var _currentClip = useState(0), currentClip = _currentClip[0], setCurrentClip = _currentClip[1];
  var _playing = useState(false), playing = _playing[0], setPlaying = _playing[1];
  var _assembling = useState(true), assembling = _assembling[0], setAssembling = _assembling[1];
  var _log = useState<LogEntry[]>([]), alog = _log[0], setAlog = _log[1];
  var videoRef = useRef<HTMLVideoElement>(null);
  var voRef = useRef<HTMLAudioElement>(null);
  var musicRef = useRef<HTMLAudioElement>(null);

  var addLog = function(msg: string, type?: string) { setAlog(function(p) { return p.concat([{ msg: msg, type: type || "info", ts: new Date().toLocaleTimeString() }]); }); };

  // Assembly simulation
  useEffect(function() {
    var steps = [
      { msg: "Loading " + orderedClips.length + " selected clips...", delay: 300 },
      { msg: "Clips: " + orderedClips.map(function(c) { return "Shot " + c.shot; }).join(", "), delay: 600 },
      { msg: "Voiceover: " + (assets.voiceover ? "Ready" : "Missing"), delay: 900 },
      { msg: "Music: " + (assets.music ? "Ready (looping)" : "None"), delay: 1200 },
      { msg: "Syncing audio tracks...", delay: 1500 },
      { msg: "Assembly complete. Press play to preview.", delay: 2000 },
    ];
    steps.forEach(function(s) { setTimeout(function() { addLog(s.msg, s.msg.includes("Missing") ? "warn" : "success"); }, s.delay); });
    setTimeout(function() { setAssembling(false); }, 2200);
  }, []);

  var playAll = function() {
    setPlaying(true);
    setCurrentClip(0);
    if (voRef.current) { voRef.current.currentTime = 0; voRef.current.play(); }
    if (musicRef.current) { musicRef.current.currentTime = 0; musicRef.current.volume = 0.15; musicRef.current.play(); }
    if (videoRef.current) { videoRef.current.currentTime = 0; videoRef.current.play(); }
  };

  var stopAll = function() {
    setPlaying(false);
    if (voRef.current) voRef.current.pause();
    if (musicRef.current) musicRef.current.pause();
    if (videoRef.current) videoRef.current.pause();
  };

  var handleClipEnd = function() {
    if (currentClip < orderedClips.length - 1) {
      setCurrentClip(function(c) { return c + 1; });
      // Next clip will autoplay via effect
    } else {
      stopAll();
      addLog("Playback complete.", "success");
    }
  };

  // When currentClip changes, play the new clip
  useEffect(function() {
    if (playing && videoRef.current && orderedClips[currentClip]) {
      videoRef.current.src = orderedClips[currentClip].videoUrl || "";
      videoRef.current.play().catch(function() {});
    }
  }, [currentClip]);

  var dimStyle = { width: aspect === "9:16" ? "40%" : "100%", margin: "0 auto" };

  return <div>
    <div style={{ fontFamily: ft, fontSize: 42, fontWeight: 900, color: D.tx, letterSpacing: -2, marginBottom: 8 }}>Preview</div>
    <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 500, color: D.txb, marginBottom: 28 }}>Assembled preview with all your selected assets.</div>

    {/* Video player */}
    <div style={{ background: D.surface, border: "1px solid " + D.border, borderRadius: 12, padding: 24, marginBottom: 20 }}>
      <div style={Object.assign({}, dimStyle, { aspectRatio: aspect === "9:16" ? "9/16" : aspect === "1:1" ? "1/1" : "16/9", background: D.bg, borderRadius: 10, border: "1px solid " + D.border, overflow: "hidden" as const, position: "relative" as const })}>
        {orderedClips.length > 0 ? <video ref={videoRef} src={orderedClips[currentClip] ? orderedClips[currentClip].videoUrl || "" : ""} onEnded={handleClipEnd} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
          <span style={{ fontFamily: ft, fontSize: 14, color: D.txl }}>No clips available</span>
        </div>}
        {/* Shot indicator */}
        {playing && orderedClips[currentClip] && <div style={{ position: "absolute", top: 10, left: 10, padding: "4px 10px", background: D.bg + "CC", borderRadius: 6, fontFamily: mn, fontSize: 10, color: D.amber }}>Shot {orderedClips[currentClip].shot} of {orderedClips.length}</div>}
        {/* Progress bar */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: D.border }}>
          <div style={{ height: "100%", width: orderedClips.length > 0 ? ((currentClip + (playing ? 0.5 : 0)) / orderedClips.length * 100) + "%" : "0%", background: D.amber, transition: "width 0.3s" }} />
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
        <button onClick={playing ? stopAll : playAll} disabled={assembling || orderedClips.length === 0} style={{ padding: "10px 24px", background: playing ? D.surface : "linear-gradient(135deg, " + D.amber + ", #E8A020)", color: playing ? D.tx : D.bg, border: playing ? "1px solid " + D.border : "none", borderRadius: 8, fontFamily: ft, fontSize: 14, fontWeight: 700, cursor: assembling ? "wait" : "pointer", opacity: assembling ? 0.4 : 1, boxShadow: playing ? "none" : "0 4px 14px " + D.amber + "25" }}>{assembling ? "Assembling..." : playing ? "Stop" : "Play Preview"}</button>
        <span style={{ fontFamily: mn, fontSize: 11, color: D.txl }}>Shot {currentClip + 1} / {orderedClips.length}</span>
      </div>

      {/* Audio mixer */}
      <AudioMixer videoRef={videoRef} voRef={voRef} musicRef={musicRef} assets={assets} onMixChange={function(mix) { setData(function(p) { return Object.assign({}, p, { audioMix: mix }); }); }} />

      {/* Hidden audio elements */}
      {assets.voiceover && <audio ref={voRef} src={assets.voiceover} />}
      {assets.music && <audio ref={musicRef} src={assets.music} loop />}
    </div>

    {/* Assembly log */}
    <div style={{ background: D.bg, border: "1px solid " + D.border, borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
      <div style={{ padding: "8px 14px", borderBottom: "1px solid " + D.border, display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontFamily: ft, fontSize: 10, fontWeight: 600, color: D.txl, letterSpacing: 2, textTransform: "uppercase" }}>Assembly Log</span>
        <span style={{ fontFamily: mn, fontSize: 9, color: D.txh }}>{alog.length} entries</span>
      </div>
      <div style={{ maxHeight: 140, overflow: "auto", padding: "6px 14px" }}>
        {alog.map(function(e, i) {
          var colors: Record<string, string> = { info: D.txb, success: D.teal, warn: D.amber, error: D.coral };
          return <div key={i} style={{ display: "flex", gap: 8, padding: "3px 0", fontFamily: mn, fontSize: 10 }}>
            <span style={{ color: D.txh, flexShrink: 0 }}>{e.ts}</span>
            <span style={{ color: colors[e.type] || D.txb }}>{e.msg}</span>
          </div>;
        })}
      </div>
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

// ═══ RENDER POLL (progressive status: queued -> in_progress -> uploading -> complete) ═══
function RenderPoll({ renderId, onComplete }: { renderId: string | undefined; onComplete?: (video: RenderVideo) => void }) {
  var _status = useState<string>("polling"), status = _status[0], setStatus = _status[1];
  var _video = useState<RenderVideo | null>(null), video = _video[0], setVideo = _video[1];
  var _elapsed = useState(0), elapsed = _elapsed[0], setElapsed = _elapsed[1];
  var _runStatus = useState("queued"), runStatus = _runStatus[0], setRunStatus = _runStatus[1];
  var _progressPct = useState(-1), progressPct = _progressPct[0], setProgressPct = _progressPct[1];
  var _runUrl = useState(""), runUrl = _runUrl[0], setRunUrl = _runUrl[1];
  var _message = useState("Dispatched, waiting for workflow..."), message = _message[0], setMessage = _message[1];

  useEffect(function() {
    if (!renderId) return;
    var start = Date.now();
    var dead = false;

    // Tick elapsed every second for a responsive timer
    var tick = setInterval(function() {
      if (!dead) setElapsed(Math.round((Date.now() - start) / 1000));
    }, 1000);

    // Poll the unified API every 5 seconds
    var poll = function() {
      if (dead) return;
      fetch("/api/render-video?id=" + renderId).then(function(r) { return r.json(); }).then(function(d: { status?: string; runStatus?: string; message?: string; runUrl?: string; progressPct?: number; assets?: RenderVideo[] }) {
        if (dead) return;

        if (d.runStatus) setRunStatus(d.runStatus);
        if (d.message) setMessage(d.message);
        if (d.runUrl) setRunUrl(d.runUrl);
        if (typeof d.progressPct === "number") setProgressPct(d.progressPct);

        if (d.status === "complete" && d.assets && d.assets.length > 0) {
          dead = true;
          setStatus("done");
          setVideo(d.assets[0]);
          setRunStatus("complete");
          clearInterval(tick);
          toast("MP4 ready!", "success");
          if (onComplete) onComplete(d.assets[0]);
          return;
        }

        if (d.status === "failure") {
          dead = true;
          setStatus("error");
          setRunStatus("failure");
          clearInterval(tick);
          toast("Render failed: " + (d.message || "unknown error"), "error");
          return;
        }

        // Schedule next poll
        setTimeout(poll, 5000);
      }).catch(function() {
        if (!dead) setTimeout(poll, 5000);
      });
    };

    // First poll immediately, then every 5s
    poll();

    return function() { dead = true; clearInterval(tick); };
  }, [renderId]);

  if (!renderId) return null;

  // Determine bar color and style per status
  var barColor = runStatus === "queued" ? D.amber
    : runStatus === "in_progress" ? D.violet
    : runStatus === "uploading" ? D.blue
    : runStatus === "complete" ? D.teal
    : runStatus === "failure" ? D.coral
    : D.txl;

  var statusLabel = runStatus === "queued" ? "Queued"
    : runStatus === "in_progress" ? (progressPct >= 0 ? "Rendering " + progressPct + "%" : "In Progress")
    : runStatus === "uploading" ? "Uploading"
    : runStatus === "complete" ? "Complete"
    : runStatus === "failure" ? "Failed"
    : "Waiting";

  var showIndeterminate = runStatus === "queued" || (runStatus === "in_progress" && progressPct < 0) || runStatus === "uploading";
  var showDeterminate = runStatus === "in_progress" && progressPct >= 0;

  var formatElapsed = function(s: number) {
    var m = Math.floor(s / 60);
    var sec = s % 60;
    return m > 0 ? m + "m " + sec + "s" : sec + "s";
  };

  return <div style={{ marginTop: 12 }}>
    <style dangerouslySetInnerHTML={{ __html: [
      "@keyframes rpSpin{to{transform:rotate(360deg)}}",
      "@keyframes rpPulse{0%,100%{opacity:0.4}50%{opacity:1}}",
      "@keyframes rpSlide{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}",
      "@keyframes rpGlow{0%,100%{box-shadow:0 0 8px " + barColor + "40}50%{box-shadow:0 0 20px " + barColor + "60}}",
    ].join("") }} />

    {/* Active polling state */}
    {status === "polling" && <div style={{ padding: "18px 20px", background: D.surface, border: "1px solid " + barColor + "30", borderLeft: "3px solid " + barColor, borderRadius: 10, animation: "rpGlow 2s ease-in-out infinite" }}>

      {/* Header row: spinner + status label */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ width: 18, height: 18, border: "2px solid " + D.border, borderTopColor: barColor, borderRadius: "50%", animation: "rpSpin 0.8s linear infinite", flexShrink: 0 }} />
        <span style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: D.tx }}>{statusLabel}</span>
        <span style={{ fontFamily: mn, fontSize: 10, color: D.txl, marginLeft: "auto" }}>{formatElapsed(elapsed)}</span>
      </div>

      {/* Message */}
      <div style={{ fontFamily: ft, fontSize: 12, fontWeight: 500, color: D.txb, marginBottom: 12 }}>{message}</div>

      {/* Progress bar */}
      <div style={{ height: 4, background: D.border, borderRadius: 2, overflow: "hidden", marginBottom: 10 }}>
        {showIndeterminate && <div style={{ width: "35%", height: "100%", background: "linear-gradient(90deg, transparent, " + barColor + ", transparent)", borderRadius: 2, animation: "rpSlide 1.5s ease-in-out infinite" }} />}
        {showDeterminate && <div style={{ width: progressPct + "%", height: "100%", background: "linear-gradient(90deg, " + D.violet + ", " + D.teal + ")", borderRadius: 2, transition: "width 0.5s ease" }} />}
        {runStatus === "complete" && <div style={{ width: "100%", height: "100%", background: D.teal, borderRadius: 2 }} />}
        {runStatus === "failure" && <div style={{ width: "100%", height: "100%", background: D.coral, borderRadius: 2 }} />}
      </div>

      {/* Status steps indicator */}
      <div style={{ display: "flex", gap: 0, marginBottom: 10 }}>
        {[
          { key: "queued", l: "Queued" },
          { key: "in_progress", l: "Rendering" },
          { key: "uploading", l: "Uploading" },
          { key: "complete", l: "Complete" },
        ].map(function(phase, i) {
          var order = ["queued", "in_progress", "uploading", "complete"];
          var currentIdx = order.indexOf(runStatus);
          var phaseIdx = order.indexOf(phase.key);
          var isDone = phaseIdx < currentIdx;
          var isActive = phaseIdx === currentIdx;
          return <div key={phase.key} style={{ flex: 1, textAlign: "center", padding: "6px 0" }}>
            <div style={{ fontFamily: mn, fontSize: 9, fontWeight: isActive ? 700 : 500, color: isDone ? D.teal : isActive ? barColor : D.txh, letterSpacing: 0.5, transition: "color 0.3s", animation: isActive ? "rpPulse 1.5s ease-in-out infinite" : "none" }}>{isDone ? "\u2713 " : ""}{phase.l}</div>
            <div style={{ height: 2, background: isDone ? D.teal : isActive ? barColor : D.border, borderRadius: 1, marginTop: 4, transition: "background 0.3s" }} />
          </div>;
        })}
      </div>

      {/* Link to GitHub */}
      <a href={runUrl || "https://github.com/Kashpatek/poast-app/actions"} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", fontFamily: mn, fontSize: 10, color: D.violet, textDecoration: "none" }}>Watch on GitHub Actions</a>
    </div>}

    {/* Error state */}
    {status === "error" && <div style={{ padding: "18px 20px", background: D.surface, border: "1px solid " + D.coral + "30", borderLeft: "3px solid " + D.coral, borderRadius: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <span style={{ fontFamily: ft, fontSize: 16, fontWeight: 900, color: D.coral }}>x</span>
        <span style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: D.coral }}>Render Failed</span>
      </div>
      <div style={{ fontFamily: ft, fontSize: 12, fontWeight: 500, color: D.txb, marginBottom: 8 }}>{message}</div>
      <a href={runUrl || "https://github.com/Kashpatek/poast-app/actions"} target="_blank" rel="noopener noreferrer" style={{ fontFamily: mn, fontSize: 10, color: D.coral, textDecoration: "none" }}>View logs on GitHub</a>
    </div>}

    {/* Done state */}
    {status === "done" && video && <div style={{ padding: "18px", background: D.surface, border: "1px solid " + D.teal + "30", borderRadius: 10 }}>
      <div style={{ fontFamily: ft, fontSize: 10, fontWeight: 600, color: D.teal, letterSpacing: 3, textTransform: "uppercase", marginBottom: 10 }}>MP4 Ready</div>
      <video controls src={video.url} style={{ width: "100%", borderRadius: 8, marginBottom: 10 }} />
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <a href={video.url} download={video.name || "sa-video.mp4"} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", height: 44, background: "linear-gradient(135deg, " + D.teal + ", " + D.blue + ")", color: D.bg, borderRadius: 8, fontFamily: ft, fontSize: 14, fontWeight: 700, textDecoration: "none" }}>Download MP4</a>
        <span style={{ fontFamily: mn, fontSize: 10, color: D.txl }}>{video.size ? Math.round(video.size / 1024 / 1024 * 10) / 10 + " MB" : ""}</span>
      </div>
    </div>}
  </div>;
}

// ═══ RENDER BUTTON (uploads assets, then triggers GitHub Actions) ═══
function RenderButton({ data, assets, onComplete }: { data: ProjectData; assets: Assets; onComplete?: (video: RenderVideo) => void }) {
  var _status = useState<string>("idle"), status = _status[0], setStatus = _status[1]; // idle, uploading, dispatching, done, error
  var _progress = useState(""), progress = _progress[0], setProgress = _progress[1];

  var render = async function() {
    setStatus("uploading"); setProgress("Uploading voiceover...");
    var voUrl = "";
    var musicUrl = "";

    // Upload voiceover
    if (assets.voiceover) {
      try {
        var r = await fetch("/api/upload-asset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: assets.voiceover, filename: "vo-" + Date.now() + ".mp3", contentType: "audio/mpeg" }) });
        var d = await r.json() as { url?: string; size?: number; error?: string };
        if (d.url) { voUrl = d.url; setProgress("Voiceover uploaded (" + Math.round((d.size || 0) / 1024) + "KB)"); }
        else { toast("VO upload failed: " + (d.error || ""), "error"); }
      } catch (e) { toast("VO upload failed", "error"); }
    }

    // Upload music
    if (assets.music) {
      setProgress("Uploading music...");
      try {
        var r2 = await fetch("/api/upload-asset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: assets.music, filename: "music-" + Date.now() + ".mp3", contentType: "audio/mpeg" }) });
        var d2 = await r2.json() as { url?: string; size?: number; error?: string };
        if (d2.url) { musicUrl = d2.url; setProgress("Music uploaded (" + Math.round((d2.size || 0) / 1024) + "KB)"); }
        else { toast("Music upload failed: " + (d2.error || ""), "warn"); }
      } catch (e) { toast("Music upload failed", "warn"); }
    }

    // Build clip URLs
    setStatus("dispatching"); setProgress("Sending to GitHub Actions...");
    var script = data.scripts && data.scripts[data.selScript || 0];
    var selectedClips = data.selectedClips || {};
    var clipUrls: string[] = [];
    if (assets.clips) {
      var shotGroups: Record<string, Clip[]> = {};
      assets.clips.forEach(function(c) { var s = c.shot || 1; if (!shotGroups[s]) shotGroups[s] = []; shotGroups[s].push(c); });
      Object.keys(shotGroups).sort().forEach(function(s) { var sel = selectedClips[s] || 0; var clip = shotGroups[s][sel]; if (clip && clip.videoUrl) clipUrls.push(clip.videoUrl); });
    }

    try {
      var r3 = await fetch("/api/render-video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        hook: data.options ? data.options.hooks[data.selHook || 0] : "",
        scriptSections: script ? [{ label: "INTRO", text: script.intro }].concat((script.body || []).map(function(b, i) { return { label: "BODY " + (i + 1), text: b }; })).concat([{ label: "OUTRO", text: script.outro }]) : [],
        dataPoints: [],
        thumbnailHeadline: data.options ? data.options.titles[data.selTitle || 0] : "",
        audioUrl: voUrl,
        clipUrls: clipUrls,
        musicUrl: musicUrl,
        duration: data.duration || 60,
        aspectRatio: data.aspect || "16:9",
        fontFamily: data.fontFamily || "'Outfit',sans-serif",
        fontSize: data.fontSize || 48,
        captionStyle: data.captionStyle || "overlay",
        clipVolume: data.audioMix ? data.audioMix.clipVol / 100 : 0.3,
        voVolume: data.audioMix ? data.audioMix.voVol / 100 : 1.0,
        musicVolume: data.audioMix ? data.audioMix.musicVol / 100 : 0.15,
      }) });
      var d3 = await r3.json() as { renderId?: string; error?: string };
      if (d3.renderId) {
        setStatus("done"); setProgress("Render submitted! ID: " + d3.renderId);
        toast("Render job dispatched to GitHub Actions.", "success");
      } else {
        setStatus("error"); setProgress(d3.error || "Dispatch failed");
        toast("Render error: " + (d3.error || "Unknown"), "error");
      }
    } catch (e) {
      setStatus("error"); setProgress(String(e).slice(0, 60));
      toast("Render failed", "error");
    }
  };

  return <div>
    <button onClick={status === "idle" || status === "error" ? render : undefined} disabled={status === "uploading" || status === "dispatching"} style={{ width: "100%", height: 52, background: status === "done" ? D.teal + "15" : D.surface, border: "1px solid " + (status === "done" ? D.teal + "40" : D.border), borderRadius: 10, fontFamily: ft, fontSize: 15, fontWeight: 700, color: status === "done" ? D.teal : D.tx, cursor: status === "uploading" || status === "dispatching" ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.15s" }} onMouseEnter={function(e: React.MouseEvent<HTMLButtonElement>) { if (status === "idle") e.currentTarget.style.borderColor = D.violet + "40"; }} onMouseLeave={function(e: React.MouseEvent<HTMLButtonElement>) { e.currentTarget.style.borderColor = status === "done" ? D.teal + "40" : D.border; }}>
      {status === "idle" && "Render MP4 (GitHub Actions)"}
      {status === "uploading" && "Uploading assets..."}
      {status === "dispatching" && "Dispatching render..."}
      {status === "done" && "Render dispatched!"}
      {status === "error" && "Retry Render"}
    </button>
    {progress && <div style={{ fontFamily: mn, fontSize: 10, color: status === "error" ? D.coral : status === "done" ? D.teal : D.txl, marginTop: 6, textAlign: "center" }}>{progress}</div>}
    {status === "done" && <RenderPoll renderId={progress.split("ID: ")[1]} />}
  </div>;
}

// ═══ STEP 9: PREMIER ═══
function Step9({ data, onPremier, onDraft }: { data: ProjectData; onPremier: () => void; onDraft: () => void }) {
  var assets: Assets = data.assets || { voiceover: null, clips: [], music: null };
  var title = data.options ? data.options.titles[data.selTitle || 0] : "Untitled";
  var _renderDone = useState(false), renderDone = _renderDone[0], setRenderDone = _renderDone[1];
  var _renderVideo = useState<RenderVideo | null>(null), renderVideo = _renderVideo[0], setRenderVideo = _renderVideo[1];

  var downloadAll = function() {
    var count = 0;
    // VO -- base64 data URL, direct download works
    if (assets.voiceover) { var a = document.createElement("a"); a.href = assets.voiceover; a.download = "voiceover.mp3"; document.body.appendChild(a); a.click(); document.body.removeChild(a); count++; }
    // Music -- base64 data URL
    if (assets.music) { setTimeout(function() { var a = document.createElement("a"); a.href = assets.music!; a.download = "music.mp3"; document.body.appendChild(a); a.click(); document.body.removeChild(a); }, 800); count++; }
    // Clips -- external URLs, open in new tabs for download
    (assets.clips || []).forEach(function(c, i) {
      if (c.videoUrl) {
        setTimeout(function() { window.open(c.videoUrl, "_blank"); }, 1500 + i * 800);
        count++;
      }
    });
    toast("Downloading " + count + " assets...", "info");
  };

  var sendToBuffer = function() {
    var desc = data.options ? data.options.descriptions[data.selDesc || 0] : "";
    try { localStorage.setItem("p2p-to-buffer", JSON.stringify({ text: title + "\n\n" + desc, source: "Press to Premier", ts: Date.now() })); } catch (e) {}
    toast("Saved for Buffer. Go to Schedule to post.", "success");
  };

  return <div>
    <div style={{ fontFamily: ft, fontSize: 42, fontWeight: 900, color: D.tx, letterSpacing: -2, marginBottom: 8 }}>Premier</div>
    <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 500, color: D.txb, marginBottom: 28 }}>Render, review, and finalize.</div>

    {/* Summary */}
    <div style={{ background: "linear-gradient(135deg, " + D.elevated + ", " + D.surface + ")", border: "1px solid " + D.amber + "20", borderRadius: 12, padding: 28, marginBottom: 24 }}>
      <div style={{ fontFamily: ft, fontSize: 10, fontWeight: 600, color: D.amber, letterSpacing: 3, textTransform: "uppercase", marginBottom: 10 }}>Project Summary</div>
      <div style={{ fontFamily: ft, fontSize: 22, fontWeight: 800, color: D.tx, marginBottom: 8 }}>{title}</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        {[{ l: "Duration", v: (data.duration || 60) + "s" }, { l: "Format", v: data.aspect || "16:9" }, { l: "VO", v: assets.voiceover ? "Ready" : "Missing", c: assets.voiceover ? D.teal : D.coral }, { l: "Clips", v: (assets.clips || []).filter(function(c) { return c.videoUrl; }).length + " ready", c: D.teal }, { l: "Music", v: assets.music ? "Ready" : "Missing", c: assets.music ? D.teal : D.coral }].map(function(s, i) {
          return <div key={i} style={{ padding: "8px 14px", background: D.bg, borderRadius: 8, border: "1px solid " + D.border }}>
            <div style={{ fontFamily: ft, fontSize: 9, fontWeight: 600, color: D.txh, letterSpacing: 1 }}>{s.l}</div>
            <div style={{ fontFamily: ft, fontSize: 13, fontWeight: 700, color: s.c || D.tx }}>{s.v}</div>
          </div>;
        })}
      </div>
    </div>

    {/* Step 1: Render */}
    <div style={{ fontFamily: ft, fontSize: 10, fontWeight: 600, color: D.txl, letterSpacing: 3, textTransform: "uppercase", marginBottom: 10 }}>Step 1: Render Video</div>
    <RenderButton data={data} assets={assets} onComplete={function(video) { setRenderDone(true); setRenderVideo(video); }} />

    {/* Step 2: After render -- preview + download + buffer */}
    {renderDone && <div style={{ marginTop: 24 }}>
      <div style={{ fontFamily: ft, fontSize: 10, fontWeight: 600, color: D.teal, letterSpacing: 3, textTransform: "uppercase", marginBottom: 10 }}>Step 2: Review & Distribute</div>

      {renderVideo && <div style={{ background: D.surface, border: "1px solid " + D.teal + "30", borderRadius: 12, padding: 18, marginBottom: 16 }}>
        <video controls src={renderVideo.url} style={{ width: "100%", borderRadius: 8, marginBottom: 10 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <a href={renderVideo.url} download={"poast-video.mp4"} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", height: 44, background: "linear-gradient(135deg, " + D.teal + ", " + D.blue + ")", color: D.bg, borderRadius: 8, fontFamily: ft, fontSize: 14, fontWeight: 700, textDecoration: "none" }}>Download MP4</a>
          <span style={{ fontFamily: mn, fontSize: 10, color: D.txl, alignSelf: "center" }}>{renderVideo.size ? Math.round(renderVideo.size / 1024 / 1024 * 10) / 10 + " MB" : ""}</span>
        </div>
      </div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        <button onClick={downloadAll} style={{ width: "100%", height: 48, background: D.surface, border: "1px solid " + D.border, borderRadius: 10, fontFamily: ft, fontSize: 14, fontWeight: 700, color: D.tx, cursor: "pointer", transition: "all 0.15s" }}>Download All Raw Assets</button>
        <button onClick={sendToBuffer} style={{ width: "100%", height: 48, background: D.surface, border: "1px solid " + D.border, borderRadius: 10, fontFamily: ft, fontSize: 14, fontWeight: 700, color: D.tx, cursor: "pointer", transition: "all 0.15s" }}>Send to Buffer Schedule</button>
      </div>
    </div>}

    {/* Manual fallback */}
    <div style={{ marginTop: 16, textAlign: "center" }}>
      <a href="https://github.com/Kashpatek/poast-app/releases" target="_blank" rel="noopener noreferrer" style={{ fontFamily: mn, fontSize: 10, color: D.txh, textDecoration: "none" }}>Manual download from GitHub Releases</a>
    </div>

    {/* Finalize */}
    <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
      <button onClick={onDraft} style={{ padding: "14px 24px", background: "transparent", border: "1px solid " + D.border, color: D.txl, borderRadius: 10, fontFamily: ft, fontSize: 14, cursor: "pointer" }}>Save as Draft</button>
      <button onClick={onPremier} style={{ flex: 1, height: 52, background: "linear-gradient(135deg, " + D.amber + ", " + D.teal + ")", color: D.bg, border: "none", borderRadius: 10, fontFamily: ft, fontSize: 16, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 20px " + D.teal + "30" }}>Confirm Premier</button>
    </div>
  </div>;
}

// ═══ PROJECT LIST ═══
function ProjectList({ projects, onOpen, onNew }: { projects: Project[]; onOpen: (p: Project) => void; onNew: () => void }) {
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
          return <div key={i} onClick={function() { onOpen(p); }} style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 22px", background: D.surface, border: "1px solid " + D.border, borderRadius: 10, marginBottom: 10, cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={function(e: React.MouseEvent<HTMLDivElement>) { e.currentTarget.style.borderColor = D.borderHover; e.currentTarget.style.background = D.elevated; }} onMouseLeave={function(e: React.MouseEvent<HTMLDivElement>) { e.currentTarget.style.borderColor = D.border; e.currentTarget.style.background = D.surface; }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 700, color: D.tx }}>{p.title || "Untitled"}</div>
              <div style={{ fontFamily: ft, fontSize: 12, fontWeight: 500, color: D.txl, marginTop: 2 }}>{new Date(p.ts).toLocaleDateString("en-US", { month: "short", day: "numeric" })} // Step {(p.step || 0) + 1} of 9</div>
            </div>
            <span style={{ fontFamily: ft, fontSize: 10, fontWeight: 600, color: sec.c, padding: "4px 10px", borderRadius: 8, background: sec.c + "12", letterSpacing: 1 }}>{p.status}</span>
          </div>;
        })}
      </div>;
    })}
    {projects.length === 0 && <div style={{ textAlign: "center", padding: 80 }}>
      <div style={{ fontFamily: mn, fontSize: 48, marginBottom: 16, opacity: 0.15 }}>//</div>
      <div style={{ fontFamily: ft, fontSize: 20, fontWeight: 700, color: D.txl }}>No projects yet.</div>
      <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 500, color: D.txh, marginTop: 6 }}>Click "New Project" to start your first video.</div>
    </div>}
  </div>;
}

// ═══ SUPABASE SYNC ═══
function p2pDbSync(projects: Project[]) {
  fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ table: "projects", data: { id: "p2p-master", name: "P2P Projects", data: { projects: projects }, type: "p2p", updated_at: new Date().toISOString() } }),
  }).catch(function() {});
}

// ═══ MAIN ═══
export default function PressToPremi() {
  var _projects = useState<Project[]>([]), projects = _projects[0], setProjects = _projects[1];
  var _active = useState<string | null>(null), active = _active[0], setActive = _active[1];
  var _step = useState(0), step = _step[0], setStep = _step[1];
  var _data = useState<ProjectData>({}), data = _data[0], setData = _data[1];
  var _loading = useState(false), loading = _loading[0], setLoading = _loading[1];
  var _loaded = useState(false), loaded = _loaded[0], setLoaded = _loaded[1];

  // On mount: fetch from Supabase first, fall back to localStorage
  useEffect(function() {
    var settled = false;
    // Quick localStorage load while Supabase fetches
    var timer = setTimeout(function() {
      if (settled) return;
      settled = true;
      try { var p = localStorage.getItem("p2p-projects"); if (p) setProjects(JSON.parse(p)); } catch (e) {}
      setLoaded(true);
    }, 800);

    fetch("/api/db?table=projects").then(function(r) { return r.json(); }).then(function(res: { data?: Array<{ type: string; id: string; data?: { projects?: Project[] } }> }) {
      if (settled) return;
      clearTimeout(timer);
      settled = true;
      if (res.data && res.data.length > 0) {
        var p2pRow = res.data.find(function(r) { return r.type === "p2p" && r.id === "p2p-master"; });
        if (p2pRow && p2pRow.data && p2pRow.data.projects && p2pRow.data.projects.length > 0) {
          setProjects(p2pRow.data.projects);
          setLoaded(true);
          return;
        }
      }
      // Supabase empty -- fall back to localStorage
      try { var p = localStorage.getItem("p2p-projects"); if (p) setProjects(JSON.parse(p)); } catch (e) {}
      setLoaded(true);
    }).catch(function() {
      if (settled) return;
      clearTimeout(timer);
      settled = true;
      try { var p = localStorage.getItem("p2p-projects"); if (p) setProjects(JSON.parse(p)); } catch (e) {}
      setLoaded(true);
    });

    return function() { clearTimeout(timer); };
  }, []);

  // On projects change: write to localStorage + fire-and-forget Supabase sync
  useEffect(function() {
    if (!loaded) return; // Don't write until initial load completes
    try { localStorage.setItem("p2p-projects", JSON.stringify(projects)); } catch (e) {}
    p2pDbSync(projects);
  }, [projects, loaded]);

  var stepNames = ["Input", "Options", "Script", "Review", "Format", "Produce", "Select", "Preview", "Premier"];
  var startNew = function() { setActive("new"); setStep(0); setData({ mode: "url" }); };
  var openProject = function(p: Project) { setActive(p.id); setStep(p.step || 0); setData(p.data || {}); };
  var saveProject = function(status: string) {
    var title = data.options ? data.options.titles[data.selTitle || 0] : "Untitled";
    var proj: Project = { id: active === "new" ? "p" + Date.now() : active || "unknown", title: title, status: status, step: step, data: data, ts: Date.now() };
    setProjects(function(p) { var f = p.filter(function(x) { return x.id !== proj.id; }); return [proj].concat(f).slice(0, 5); });
    if (status === "premiered" || status === "draft") { setActive(null); }
  };

  // Auto-save: persist project data whenever step or data changes
  useEffect(function() {
    if (!active || active === "new" && step === 0) return; // Don't auto-save empty new projects
    var title = data.options ? data.options.titles[data.selTitle || 0] : "Untitled";
    var id = active === "new" ? "p-auto-" + Date.now() : active;
    if (active === "new") setActive(id); // Give it a real ID on first auto-save
    var proj: Project = { id: id, title: title, status: "production", step: step, data: data, ts: Date.now() };
    setProjects(function(p) { var f = p.filter(function(x) { return x.id !== proj.id; }); return [proj].concat(f).slice(0, 5); });
  }, [step, data.assets, data.options, data.scripts, data.selectedClips]);

  var genOptions = async function() {
    setLoading(true); setStep(1);
    try {
      var r = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system: "You are a video production strategist for SemiAnalysis. Never use em dashes. No emojis. RESPOND ONLY IN VALID JSON.", prompt: "Generate 3 title options, 3 hook options (under 12 words each), and 3 description options for a video about this article.\n\nArticle: " + (data.text || data.url || "") + "\n\nReturn JSON: {\"titles\":[\"t1\",\"t2\",\"t3\"],\"hooks\":[\"h1\",\"h2\",\"h3\"],\"descriptions\":[\"d1\",\"d2\",\"d3\"]}" }) });
      var d = await r.json() as { content?: Array<{ text?: string }> }; var txt = (d.content || []).map(function(c) { return c.text || ""; }).join("");
      var parsed = JSON.parse(txt.replace(/```json|```/g, "").trim());
      setData(function(p) { return Object.assign({}, p, { options: parsed }); });
    } catch (e) { toast("Failed: " + String(e).slice(0, 80), "error", 500); setStep(0); }
    setLoading(false);
  };

  var genScripts = async function() {
    setLoading(true); setStep(2);
    var title = data.options!.titles[data.selTitle || 0];
    var hook = data.options!.hooks[data.selHook || 0];
    try {
      var r = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system: "You are a video scriptwriter for SemiAnalysis. Never use em dashes. No emojis. RESPOND ONLY IN VALID JSON.", prompt: "Write 3 script versions for a " + (data.duration || 60) + "-second video.\nTitle: " + title + "\nHook: " + hook + "\n\nEach version: different approach, different b-roll.\n\nIMPORTANT: The outro MUST be a complete, conclusive sentence that clearly ends the video. End with a definitive call to action like 'Read the full analysis at semianalysis.com' or 'Subscribe for more.' The script must feel finished, not cut off.\n\nReturn JSON: {\"scripts\":[{\"hook\":\"...\",\"intro\":\"first 8s\",\"body\":[\"p1\",\"p2\"],\"outro\":\"complete conclusive CTA sentence ending the video definitively\",\"broll\":[{\"shot\":1,\"timing\":\"0-5s\",\"description\":\"what we see\",\"prompt\":\"cinematic prompt 30-50 words\",\"camera\":\"movement\"}]}]}" }) });
      var d = await r.json() as { content?: Array<{ text?: string }> }; var txt = (d.content || []).map(function(c) { return c.text || ""; }).join("");
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
    {!loading && step === 7 && <Step8 data={data} setData={setData} onNext={function() { setStep(8); }} onBack={function() { setStep(6); }} />}
    {!loading && step === 8 && <Step9 data={data} onPremier={function() { saveProject("premiered"); toast("Premiered! Project archived.", "success"); }} onDraft={function() { saveProject("draft"); toast("Draft saved", "info"); }} />}

    {step > 0 && step < 8 && !loading && <div style={{ marginTop: 24, textAlign: "center" }}>
      <span onClick={function() { saveProject("draft"); toast("Draft saved", "info"); }} style={{ fontFamily: ft, fontSize: 12, fontWeight: 500, color: D.txl, cursor: "pointer", padding: "8px 16px", borderRadius: 8, border: "1px solid " + D.border }}>Save Draft & Exit</span>
    </div>}
  </div>;
}
