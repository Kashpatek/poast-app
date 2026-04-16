"use client";
import React, { useState, useEffect } from "react";

// ═══ TYPES ═══
interface Idea {
  id: string;
  title: string;
  content_type: string;
  platforms?: string[];
  description: string;
  based_on?: string;
}

interface ContentType {
  key: string;
  label: string;
  color: string;
}

interface TopicArea {
  key: string;
  label: string;
}

interface PlatformTag {
  key: string;
  label: string;
  color: string;
}

interface TrendItem {
  title?: string;
  topic?: string;
  name?: string;
  [key: string]: unknown;
}

interface GenerateConfig {
  types: string[];
  topics: string[];
  angle: string;
}

interface OrbConfig {
  color: string;
  size: number;
  top?: string;
  left?: string;
  right?: string;
  anim: string;
  dur: string;
}

interface TypeConfigEntry {
  section: string;
  label: string;
  icon: string;
  color: string;
}

interface IdeaCardProps {
  idea: Idea;
  onSendSlopTop: (idea: Idea) => void;
  onSendCapper: (idea: Idea) => void;
  onExport: (idea: Idea) => void;
  onDismiss: (idea: Idea) => void;
  onSave: ((idea: Idea) => void) | null;
  showToast: (msg: string) => void;
}

interface WizardOverlayProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (config: GenerateConfig) => void;
  loading: boolean;
}

interface ProgressBarProps {
  label?: string;
}

// ═══ DESIGN ═══
var D = {
  bg: "#060608", card: "#09090D", border: "rgba(255,255,255,0.06)",
  surface: "#0D0D12", tx: "#E8E4DD", txm: "#8A8690", txd: "#4E4B56",
  amber: "#F7B041", blue: "#0B86D1", teal: "#2EAD8E", coral: "#E06347",
  violet: "#905CCB", cyan: "#26C9D8",
};
var ft = "'Outfit',sans-serif";
var mn = "'JetBrains Mono',monospace";
var gf = "'Grift','Outfit',sans-serif";

var CONTENT_TYPES = [
  { key: "short_video", label: "Short Video", color: D.coral },
  { key: "meme", label: "Meme / Image", color: D.violet },
  { key: "thread", label: "Thread", color: D.blue },
  { key: "carousel", label: "Carousel", color: D.cyan },
  { key: "article", label: "Long-form Article", color: D.teal },
  { key: "podcast", label: "Podcast Topic", color: D.amber },
];

var TOPIC_AREAS = [
  { key: "ai", label: "AI" },
  { key: "semiconductors", label: "Semiconductors" },
  { key: "data_centers", label: "Data Centers" },
  { key: "memory", label: "Memory" },
  { key: "geopolitics", label: "Geopolitics" },
  { key: "general_tech", label: "General Tech" },
  { key: "finance", label: "Finance" },
  { key: "cloud", label: "Cloud" },
];

var PLATFORM_TAGS = [
  { key: "x", label: "X", color: "#1DA1F2" },
  { key: "instagram", label: "Instagram", color: "#E4405F" },
  { key: "linkedin", label: "LinkedIn", color: "#0A66C2" },
  { key: "tiktok", label: "TikTok", color: "#00F2EA" },
  { key: "youtube", label: "YouTube", color: "#FF0000" },
];

var TYPE_BADGE_COLORS: Record<string, string> = {
  "Video": D.coral, "Short Video": D.coral, "Meme": D.violet, "Thread": D.blue,
  "Carousel": D.cyan, "Article": D.teal, "Podcast": D.amber,
};

var BORDER_GRADIENTS: Record<string, string> = {
  "Video": "linear-gradient(180deg, " + D.coral + ", " + D.coral + "30)",
  "Short Video": "linear-gradient(180deg, " + D.coral + ", " + D.coral + "30)",
  "Meme": "linear-gradient(180deg, " + D.violet + ", " + D.violet + "30)",
  "Thread": "linear-gradient(180deg, " + D.blue + ", " + D.blue + "30)",
  "Carousel": "linear-gradient(180deg, " + D.cyan + ", " + D.cyan + "30)",
  "Article": "linear-gradient(180deg, " + D.teal + ", " + D.teal + "30)",
  "Podcast": "linear-gradient(180deg, " + D.amber + ", " + D.amber + "30)",
};

var SYS_IDEATION = "You are a creative content strategist for SemiAnalysis, a semiconductor and AI infrastructure research firm. Your job is to generate compelling, timely content ideas based on current industry trends. Rules: Never use em dashes, use commas or periods. No emojis. Be specific and actionable, not vague. Each idea should have a clear hook and angle. RESPOND ONLY IN VALID JSON. No markdown fences. No preamble.";

var CSS_ANIMATIONS = [
  "@keyframes idFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }",
  "@keyframes idFloat2 { 0%,100% { transform: translateY(0) translateX(0); } 25% { transform: translateY(-15px) translateX(10px); } 50% { transform: translateY(-25px) translateX(-5px); } 75% { transform: translateY(-10px) translateX(8px); } }",
  "@keyframes idFloat3 { 0%,100% { transform: translateY(0) translateX(0); } 33% { transform: translateY(-18px) translateX(-12px); } 66% { transform: translateY(-8px) translateX(15px); } }",
  "@keyframes idSparkle { 0% { opacity: 0; transform: translateY(20px) scale(0.5); } 30% { opacity: 1; transform: translateY(0) scale(1); } 100% { opacity: 0; transform: translateY(-40px) scale(0.3); } }",
  "@keyframes idGlow { 0%,100% { box-shadow: 0 0 20px rgba(247,176,65,0.2); } 50% { box-shadow: 0 0 40px rgba(247,176,65,0.4), 0 0 60px rgba(11,134,209,0.2); } }",
  "@keyframes idPulse { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }",
  "@keyframes idThinkDot { 0%,80%,100% { transform: scale(0.4); opacity: 0.3; } 40% { transform: scale(1); opacity: 1; } }",
  "@keyframes toastFadeIn { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }",
  "@keyframes ideaSlide { 0% { transform: translateX(-100%); } 100% { transform: translateX(250%); } }",
  "@keyframes heroShimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }",
  "@media (max-width: 900px) { .ideation-hero { height: 250px !important; } }",
].join("\n");

// ═══ HELPERS ═══
function copyText(str: string): boolean {
  try { var ta = document.createElement("textarea"); ta.value = str; ta.style.position = "fixed"; ta.style.left = "-9999px"; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); return true; } catch (e) { try { navigator.clipboard.writeText(str); return true; } catch (e2) { return false; } }
}

async function askAPI(sys: string, prompt: string): Promise<Record<string, unknown> | null> {
  try {
    var r = await fetch("/api/generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: sys, prompt: prompt }),
    });
    var d = await r.json();
    if (d.error) { console.error("API Error:", d.error); return null; }
    if (!d.content) { return null; }
    var t = (d.content || []).map(function(c: { text?: string }) { return c.text || ""; }).join("");
    try {
      return JSON.parse(t.replace(/```json|```/g, "").trim());
    } catch (pe) { console.error("Parse error:", t); return null; }
  } catch (e) { console.error("API:", e); return null; }
}

async function fetchTrends(): Promise<TrendItem[] | { trends?: TrendItem[] }> {
  try {
    var r = await fetch("/api/trends-feed?source=all");
    var d = await r.json();
    return d;
  } catch (e) { console.error("Trends fetch failed:", e); return []; }
}

// ═══ DB SYNC ═══
async function dbSyncIdeas(ideas: Idea[], saved: Idea[]): Promise<void> {
  fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ table: "projects", data: { id: "ideation-master", name: "IdeationNation", data: { ideas: ideas, saved: saved }, type: "ideation", updated_at: new Date().toISOString() } }),
  }).catch(function() {});
}

async function dbLoadIdeas(): Promise<{ ideas?: Idea[]; saved?: Idea[] } | null> {
  try {
    var r = await fetch("/api/db?table=projects");
    var res = await r.json();
    if (res.data && res.data.length > 0) {
      var row = res.data.find(function(r: Record<string, unknown>) { return r.type === "ideation" && r.id === "ideation-master"; });
      if (row && row.data) return row.data;
    }
    return null;
  } catch (e) { return null; }
}

// ═══ SPARKLE PARTICLES ═══
function SparkleParticles() {
  var particles = [];
  for (var i = 0; i < 18; i++) {
    var left = Math.random() * 100;
    var delay = Math.random() * 5;
    var duration = 3 + Math.random() * 4;
    var size = 1.5 + Math.random() * 2.5;
    var colors = [D.amber, D.blue, D.teal, D.coral, D.violet, D.cyan, "#fff"];
    var color = colors[Math.floor(Math.random() * colors.length)];
    particles.push(
      <div key={"sp" + i} style={{
        position: "absolute", bottom: Math.random() * 60 + "%", left: left + "%",
        width: size, height: size, borderRadius: "50%",
        background: color, boxShadow: "0 0 6px " + color + "80",
        animation: "idSparkle " + duration + "s " + delay + "s ease-in-out infinite",
        pointerEvents: "none", opacity: 0,
      }} />
    );
  }
  return <>{particles}</>;
}

// ═══ FLOATING ORBS ═══
function FloatingOrbs() {
  var orbs = [
    { color: D.amber, size: 120, top: "10%", left: "8%", anim: "idFloat", dur: "7s" },
    { color: D.blue, size: 90, top: "20%", right: "12%", anim: "idFloat2", dur: "9s" },
    { color: D.teal, size: 70, top: "50%", left: "30%", anim: "idFloat3", dur: "8s" },
    { color: D.coral, size: 100, top: "15%", right: "35%", anim: "idFloat", dur: "10s" },
    { color: D.violet, size: 85, top: "40%", left: "65%", anim: "idFloat2", dur: "11s" },
    { color: D.cyan, size: 60, top: "60%", right: "20%", anim: "idFloat3", dur: "6s" },
    { color: D.amber, size: 50, top: "70%", left: "15%", anim: "idFloat2", dur: "8.5s" },
  ];
  return <>{orbs.map(function(o: OrbConfig, i: number) {
    var pos: React.CSSProperties = { position: "absolute", width: o.size, height: o.size, borderRadius: "50%", pointerEvents: "none", opacity: 0.12, filter: "blur(40px)", background: "radial-gradient(circle, " + o.color + ", transparent 70%)", animation: o.anim + " " + o.dur + " ease-in-out infinite" };
    if (o.top) pos.top = o.top;
    if (o.left) pos.left = o.left;
    if (o.right) pos.right = o.right;
    return <div key={"orb" + i} style={pos} />;
  })}</>;
}

// ═══ PROGRESS BAR ═══
function ProgressBar({ label }: ProgressBarProps) {
  return <div style={{ margin: "22px 0" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <div style={{ fontFamily: mn, fontSize: 11, color: D.amber, letterSpacing: "2px", textTransform: "uppercase" }}>{label || "Generating..."}</div>
    </div>
    <div style={{ width: "100%", height: 2, background: "rgba(255,255,255,0.06)", borderRadius: 1, overflow: "hidden", position: "relative" }}>
      <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: "40%", borderRadius: 1, background: "linear-gradient(90deg, transparent, " + D.amber + ", transparent)", animation: "ideaSlide 1.5s ease-in-out infinite" }} />
    </div>
  </div>;
}

// ═══ THINKING DOTS ═══
function ThinkingDots() {
  return <div style={{ display: "flex", gap: 8, justifyContent: "center", padding: "20px 0" }}>
    {[0, 1, 2].map(function(i) {
      return <div key={i} style={{
        width: 10, height: 10, borderRadius: "50%",
        background: i === 0 ? D.amber : i === 1 ? D.blue : D.teal,
        animation: "idThinkDot 1.4s " + (i * 0.2) + "s ease-in-out infinite",
        boxShadow: "0 0 12px " + (i === 0 ? D.amber : i === 1 ? D.blue : D.teal) + "60",
      }} />;
    })}
  </div>;
}

// ═══ WIZARD OVERLAY ═══
function WizardOverlay({ open, onClose, onGenerate, loading }: WizardOverlayProps) {
  var _step = useState<number>(1), step = _step[0], setStep = _step[1];
  var _types = useState<string[]>([]), types = _types[0], setTypes = _types[1];
  var _topics = useState<string[]>([]), topics = _topics[0], setTopics = _topics[1];
  var _angle = useState<string>(""), angle = _angle[0], setAngle = _angle[1];

  // Pick up routed context from News Flow
  useEffect(function() {
    if (open) {
      try {
        var routed = localStorage.getItem("ideation-routed-angle");
        if (routed) { setAngle(routed); localStorage.removeItem("ideation-routed-angle"); }
      } catch (e) {}
    }
  }, [open]);

  var toggleType = function(key: string) {
    setTypes(function(p: string[]) { return p.indexOf(key) > -1 ? p.filter(function(k: string) { return k !== key; }) : p.concat([key]); });
  };
  var toggleTopic = function(key: string) {
    setTopics(function(p: string[]) { return p.indexOf(key) > -1 ? p.filter(function(k: string) { return k !== key; }) : p.concat([key]); });
  };

  var handleGenerate = function() {
    onGenerate({ types: types, topics: topics, angle: angle });
    setStep(1); setTypes([]); setTopics([]); setAngle("");
  };

  var handleClose = function() {
    setStep(1); setTypes([]); setTopics([]); setAngle("");
    onClose();
  };

  if (!open) return null;

  var stepLabels = ["Content Type", "Topic Area", "Angle", "Generate"];
  var stepColors = [D.coral, D.blue, D.teal, D.amber];

  return <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
    {/* Backdrop */}
    <div onClick={handleClose} style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse at center, rgba(144,92,203,0.08) 0%, rgba(6,6,8,0.96) 60%)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }} />

    {/* Wizard card */}
    <div style={{ position: "relative", width: 560, maxWidth: "100%", maxHeight: "80vh", overflow: "auto", background: "linear-gradient(135deg, #0F0F18 0%, #0A0A12 100%)", borderRadius: 18, padding: "36px 40px", boxShadow: "0 0 80px rgba(144,92,203,0.08), 0 0 120px rgba(247,176,65,0.04), 0 24px 60px rgba(0,0,0,0.7)" }}>
      {/* Gradient border effect */}
      <div style={{ position: "absolute", inset: -1, borderRadius: 19, background: "linear-gradient(135deg, " + D.amber + "40, " + D.violet + "30, " + D.blue + "20, " + D.teal + "30)", zIndex: -1, padding: 1 }}>
        <div style={{ width: "100%", height: "100%", borderRadius: 18, background: "linear-gradient(135deg, #0F0F18 0%, #0A0A12 100%)" }} />
      </div>

      {/* Ambient orbs */}
      <div style={{ position: "absolute", top: -80, right: -80, width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle, " + D.violet + "10, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -60, left: -60, width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle, " + D.blue + "08, transparent 70%)", pointerEvents: "none" }} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <div style={{ fontFamily: gf, fontSize: 24, fontWeight: 900, color: D.tx, letterSpacing: -0.5 }}>Generate Ideas</div>
          <div style={{ fontFamily: mn, fontSize: 10, color: stepColors[step - 1], marginTop: 6, letterSpacing: "1px" }}>Step {step} of 4 -- {stepLabels[step - 1]}</div>
        </div>
        <div onClick={handleClose} style={{ width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "rgba(255,255,255,0.04)", border: "1px solid " + D.border, color: D.txd, fontFamily: ft, fontSize: 16, transition: "all 0.2s" }}>x</div>
      </div>

      {/* Colored step indicators */}
      <div style={{ display: "flex", gap: 6, marginBottom: 32 }}>
        {[1, 2, 3, 4].map(function(s) {
          var active = s === step;
          var done = s < step;
          var c = stepColors[s - 1];
          return <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: active ? c : done ? c + "60" : "rgba(255,255,255,0.06)", transition: "all 0.3s ease", boxShadow: active ? "0 0 12px " + c + "50" : "none" }} />;
        })}
      </div>

      {/* Step 1: Content Type */}
      {step === 1 && <div>
        <div style={{ fontFamily: mn, fontSize: 11, color: D.coral, textTransform: "uppercase", letterSpacing: "2px", marginBottom: 16 }}>What type of content?</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {CONTENT_TYPES.map(function(ct) {
            var on = types.indexOf(ct.key) > -1;
            return <div key={ct.key} onClick={function() { toggleType(ct.key); }} style={{ padding: "18px 20px", borderRadius: 12, cursor: "pointer", background: on ? ct.color + "12" : D.card, border: "1px solid " + (on ? ct.color + "50" : D.border), boxShadow: on ? "0 0 24px " + ct.color + "18" : "none", transition: "all 0.25s ease" }}>
              <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: on ? ct.color : D.tx }}>{ct.label}</div>
            </div>;
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 28 }}>
          <div onClick={function() { if (types.length > 0) setStep(2); }} style={{ padding: "12px 28px", borderRadius: 12, cursor: types.length > 0 ? "pointer" : "not-allowed", background: types.length > 0 ? "linear-gradient(135deg, " + D.coral + ", " + D.coral + "CC)" : "rgba(255,255,255,0.04)", color: types.length > 0 ? "#fff" : D.txd, fontFamily: ft, fontSize: 13, fontWeight: 800, transition: "all 0.2s", boxShadow: types.length > 0 ? "0 0 20px " + D.coral + "30" : "none" }}>Next</div>
        </div>
      </div>}

      {/* Step 2: Topic Area */}
      {step === 2 && <div>
        <div style={{ fontFamily: mn, fontSize: 11, color: D.blue, textTransform: "uppercase", letterSpacing: "2px", marginBottom: 16 }}>What topic area?</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {TOPIC_AREAS.map(function(ta) {
            var on = topics.indexOf(ta.key) > -1;
            return <div key={ta.key} onClick={function() { toggleTopic(ta.key); }} style={{ padding: "16px 20px", borderRadius: 12, cursor: "pointer", background: on ? D.blue + "12" : D.card, border: "1px solid " + (on ? D.blue + "50" : D.border), boxShadow: on ? "0 0 20px " + D.blue + "15" : "none", transition: "all 0.25s ease" }}>
              <div style={{ fontFamily: ft, fontSize: 13, fontWeight: 700, color: on ? D.blue : D.tx }}>{ta.label}</div>
            </div>;
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28 }}>
          <div onClick={function() { setStep(1); }} style={{ padding: "12px 22px", borderRadius: 12, cursor: "pointer", background: "transparent", border: "1px solid " + D.border, color: D.txm, fontFamily: ft, fontSize: 13, fontWeight: 600, transition: "all 0.2s" }}>Back</div>
          <div onClick={function() { if (topics.length > 0) setStep(3); }} style={{ padding: "12px 28px", borderRadius: 12, cursor: topics.length > 0 ? "pointer" : "not-allowed", background: topics.length > 0 ? "linear-gradient(135deg, " + D.blue + ", " + D.blue + "CC)" : "rgba(255,255,255,0.04)", color: topics.length > 0 ? "#fff" : D.txd, fontFamily: ft, fontSize: 13, fontWeight: 800, transition: "all 0.2s", boxShadow: topics.length > 0 ? "0 0 20px " + D.blue + "30" : "none" }}>Next</div>
        </div>
      </div>}

      {/* Step 3: Angle */}
      {step === 3 && <div>
        <div style={{ fontFamily: mn, fontSize: 11, color: D.teal, textTransform: "uppercase", letterSpacing: "2px", marginBottom: 16 }}>Any specific angle? (optional)</div>
        <textarea value={angle} onChange={function(e) { setAngle(e.target.value); }} rows={5} placeholder="e.g. Focus on how TSMC's CoWoS capacity affects AI chip supply, or contrast NVIDIA vs AMD datacenter strategies..." style={{ width: "100%", padding: "16px 18px", background: D.card, border: "1px solid " + D.border, borderRadius: 12, color: D.tx, fontFamily: mn, fontSize: 12, outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.7, transition: "border-color 0.2s ease" }} onFocus={function(e) { e.target.style.borderColor = D.teal; }} onBlur={function(e) { e.target.style.borderColor = D.border; }} />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28 }}>
          <div onClick={function() { setStep(2); }} style={{ padding: "12px 22px", borderRadius: 12, cursor: "pointer", background: "transparent", border: "1px solid " + D.border, color: D.txm, fontFamily: ft, fontSize: 13, fontWeight: 600, transition: "all 0.2s" }}>Back</div>
          <div onClick={function() { setStep(4); }} style={{ padding: "12px 28px", borderRadius: 12, cursor: "pointer", background: "linear-gradient(135deg, " + D.teal + ", " + D.teal + "CC)", color: "#fff", fontFamily: ft, fontSize: 13, fontWeight: 800, transition: "all 0.2s", boxShadow: "0 0 20px " + D.teal + "30" }}>Next</div>
        </div>
      </div>}

      {/* Step 4: Generate */}
      {step === 4 && <div>
        <div style={{ fontFamily: mn, fontSize: 11, color: D.amber, textTransform: "uppercase", letterSpacing: "2px", marginBottom: 20 }}>Ready to generate</div>

        {/* Summary */}
        <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 12, padding: "20px 22px", marginBottom: 24 }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>Content Types</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {types.map(function(t) {
                var ct = CONTENT_TYPES.find(function(c) { return c.key === t; });
                return <span key={t} style={{ fontFamily: ft, fontSize: 11, fontWeight: 700, color: ct ? ct.color : D.tx, background: (ct ? ct.color : D.amber) + "18", padding: "4px 12px", borderRadius: 8 }}>{ct ? ct.label : t}</span>;
              })}
            </div>
          </div>
          <div style={{ marginBottom: angle ? 14 : 0 }}>
            <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>Topics</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {topics.map(function(t) {
                var ta = TOPIC_AREAS.find(function(a) { return a.key === t; });
                return <span key={t} style={{ fontFamily: ft, fontSize: 11, fontWeight: 600, color: D.tx, background: "rgba(255,255,255,0.06)", padding: "4px 12px", borderRadius: 8 }}>{ta ? ta.label : t}</span>;
              })}
            </div>
          </div>
          {angle && <div>
            <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>Angle</div>
            <div style={{ fontFamily: ft, fontSize: 12, color: D.txm, lineHeight: 1.6 }}>{angle}</div>
          </div>}
        </div>

        {loading && <div>
          <ThinkingDots />
          <ProgressBar label="Generating ideas from trends data..." />
        </div>}

        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div onClick={function() { setStep(3); }} style={{ padding: "12px 22px", borderRadius: 12, cursor: "pointer", background: "transparent", border: "1px solid " + D.border, color: D.txm, fontFamily: ft, fontSize: 13, fontWeight: 600, transition: "all 0.2s" }}>Back</div>
          <div onClick={loading ? undefined : handleGenerate} style={{ padding: "14px 36px", borderRadius: 12, cursor: loading ? "wait" : "pointer", background: loading ? D.txd : "linear-gradient(135deg, " + D.amber + ", #E8A020)", color: loading ? D.card : "#060608", fontFamily: ft, fontSize: 14, fontWeight: 900, letterSpacing: -0.3, transition: "all 0.2s", boxShadow: loading ? "none" : "0 0 30px " + D.amber + "40", animation: loading ? "none" : "idGlow 3s ease-in-out infinite" }}>
            {loading ? "Generating..." : "Generate Ideas"}
          </div>
        </div>
      </div>}
    </div>
  </div>;
}

// ═══ TYPE CONFIG ═══
var TYPE_CONFIG: Record<string, TypeConfigEntry> = {
  "Video": { section: "p2p", label: "Send to Press to Premier", icon: "\uD83C\uDFA5", color: D.coral },
  "Short Video": { section: "p2p", label: "Send to Press to Premier", icon: "\uD83C\uDFA5", color: D.coral },
  "Meme": { section: "sloptop", label: "Send to Slop Top", icon: "\u2728", color: D.violet },
  "Meme / Image": { section: "sloptop", label: "Send to Slop Top", icon: "\u2728", color: D.violet },
  "Thread": { section: "capper", label: "Send to Capper", icon: "\uD83D\uDD17", color: D.blue },
  "Carousel": { section: "carousel", label: "Send to Carousel", icon: "\uD83D\uDDC2", color: D.cyan },
  "Article": { section: "export", label: "Export as .txt", icon: "\uD83D\uDCC4", color: D.teal },
  "Long-form Article": { section: "export", label: "Export as .txt", icon: "\uD83D\uDCC4", color: D.teal },
  "Podcast": { section: "fabknowledge", label: "Send to Fab Knowledge", icon: "\uD83C\uDF99", color: D.amber },
  "Podcast Topic": { section: "fabknowledge", label: "Send to Fab Knowledge", icon: "\uD83C\uDF99", color: D.amber },
};

function routeIdeaToTool(idea: Idea, showToast: (msg: string) => void) {
  var cfg = TYPE_CONFIG[idea.content_type];
  if (!cfg) {
    showToast("Unknown content type: " + idea.content_type);
    return;
  }
  var payload: Record<string, string> = { prompt: idea.title + ": " + idea.description };
  if (cfg.section === "export") {
    var content = idea.title + "\n\nType: " + idea.content_type + "\nPlatforms: " + (idea.platforms || []).join(", ") + "\n\n" + idea.description + "\n\nBased on: " + (idea.based_on || "N/A");
    var blob = new Blob([content], { type: "text/plain" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = idea.title.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40) + ".txt";
    a.click();
    URL.revokeObjectURL(url);
    showToast("Exported '" + idea.title + "' as .txt");
    return;
  }
  if (cfg.section === "capper") {
    payload.threadLength = "auto";
    payload.content = idea.title + "\n\n" + idea.description;
  }
  if (cfg.section === "carousel") {
    payload.articleText = idea.title + "\n\n" + idea.description;
  }
  if (cfg.section === "fabknowledge") {
    payload.topicSuggestion = idea.title + ": " + idea.description;
  }
  try {
    localStorage.setItem("poast-route-to", JSON.stringify({ section: cfg.section, data: payload }));
  } catch (e) {}
  window.location.hash = "#" + cfg.section;
  showToast("Idea sent to " + cfg.label.replace("Send to ", "") + "! Switch to that section.");
}

// ═══ IDEA CARD ═══
function IdeaCard({ idea, onSendSlopTop, onSendCapper, onExport, onDismiss, onSave, showToast }: IdeaCardProps) {
  var _hovered = useState<boolean>(false), hovered = _hovered[0], setHovered = _hovered[1];
  var _copied = useState<boolean>(false), copied = _copied[0], setCopied = _copied[1];

  var badgeColor = TYPE_BADGE_COLORS[idea.content_type] || D.amber;
  var borderGrad = BORDER_GRADIENTS[idea.content_type] || "linear-gradient(180deg, " + D.amber + ", " + D.amber + "30)";

  var handleCopy = function() {
    var txt = idea.title + "\n\n" + idea.description + "\n\nBased on: " + idea.based_on;
    copyText(txt);
    setCopied(true);
    setTimeout(function() { setCopied(false); }, 1200);
  };

  return <div
    onMouseEnter={function() { setHovered(true); }}
    onMouseLeave={function() { setHovered(false); }}
    style={{
      background: hovered ? "linear-gradient(135deg, #0F0F18 0%, #0C0C14 100%)" : D.card,
      border: "1px solid " + (hovered ? badgeColor + "35" : D.border),
      borderRadius: 12,
      padding: 0,
      marginBottom: 14,
      transition: "all 0.3s ease",
      boxShadow: hovered ? "0 8px 40px rgba(0,0,0,0.5), 0 0 30px " + badgeColor + "10" : "0 2px 12px rgba(0,0,0,0.3)",
      position: "relative",
      overflow: "hidden",
      display: "flex",
      transform: hovered ? "translateY(-2px)" : "translateY(0)",
    }}>
    {/* Left color gradient border */}
    <div style={{ width: 4, minHeight: "100%", background: borderGrad, borderRadius: "12px 0 0 12px", flexShrink: 0 }} />

    <div style={{ flex: 1, padding: "22px 24px", position: "relative" }}>
      {/* Gradient border glow on hover */}
      {hovered && <div style={{ position: "absolute", top: -1, left: -1, right: -1, bottom: -1, borderRadius: 13, background: "linear-gradient(135deg, " + badgeColor + "15, transparent 40%, " + D.violet + "08 80%, transparent)", pointerEvents: "none", zIndex: 0 }} />}

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Top row: badge + platforms */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: ft, fontSize: 10, fontWeight: 800, color: badgeColor, background: badgeColor + "18", padding: "4px 12px", borderRadius: 8, letterSpacing: 0.5, border: "1px solid " + badgeColor + "25", display: "inline-flex", alignItems: "center", gap: 5 }}>{(TYPE_CONFIG[idea.content_type] || {}).icon || ""} {idea.content_type}</span>
            {idea.platforms && idea.platforms.map(function(p: string) {
              var pt = PLATFORM_TAGS.find(function(t: PlatformTag) { return t.key === p || t.label.toLowerCase() === p.toLowerCase(); });
              var c = pt ? pt.color : D.txd;
              var label = pt ? pt.label : p;
              return <span key={p} style={{ fontFamily: mn, fontSize: 9, color: c, background: c + "12", padding: "3px 9px", borderRadius: 6, border: "1px solid " + c + "18" }}>{label}</span>;
            })}
          </div>
          <span onClick={handleCopy} style={{ fontFamily: mn, fontSize: 9, color: copied ? D.amber : D.txd, cursor: "pointer", padding: "3px 10px", borderRadius: 6, border: "1px solid " + D.border, transition: "all 0.2s" }}>{copied ? "Copied" : "Copy"}</span>
        </div>

        {/* Title */}
        <div style={{ fontFamily: ft, fontSize: 17, fontWeight: 800, color: D.tx, marginBottom: 10, lineHeight: 1.4, letterSpacing: -0.3 }}>{idea.title}</div>

        {/* Description */}
        <div style={{ fontFamily: ft, fontSize: 13, color: D.txm, lineHeight: 1.7, marginBottom: 14 }}>{idea.description}</div>

        {/* Based on */}
        {idea.based_on && <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, marginBottom: 18, padding: "10px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 10, borderLeft: "3px solid " + badgeColor + "50", display: "inline-block" }}>
          <span style={{ color: badgeColor + "90", fontWeight: 700 }}>Based on: </span>{idea.based_on}
        </div>}

        {/* Action buttons */}
        {(function() {
          var cfg = TYPE_CONFIG[idea.content_type] || { label: "Send to Slop Top", color: D.amber, icon: "", section: "sloptop" };
          var primaryColor = cfg.color;
          return <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div onClick={function() { routeIdeaToTool(idea, showToast); }} style={{ padding: "8px 18px", borderRadius: 8, cursor: "pointer", background: "linear-gradient(135deg, " + primaryColor + ", " + primaryColor + "CC)", fontFamily: ft, fontSize: 11, fontWeight: 800, color: "#fff", transition: "all 0.2s", boxShadow: "0 0 16px " + primaryColor + "30", display: "flex", alignItems: "center", gap: 6 }}>
              <span>{cfg.icon}</span> {cfg.label}
            </div>
            {onSave && <div onClick={function() { onSave(idea); }} style={{ padding: "8px 16px", borderRadius: 8, cursor: "pointer", background: D.violet + "12", border: "1px solid " + D.violet + "30", fontFamily: ft, fontSize: 11, fontWeight: 700, color: D.violet, transition: "all 0.2s" }}>Save</div>}
            <div onClick={function() { onExport(idea); }} style={{ padding: "8px 16px", borderRadius: 8, cursor: "pointer", background: D.teal + "12", border: "1px solid " + D.teal + "30", fontFamily: ft, fontSize: 11, fontWeight: 700, color: D.teal, transition: "all 0.2s" }}>Export .txt</div>
            <div onClick={function() { onDismiss(idea); }} style={{ padding: "8px 16px", borderRadius: 8, cursor: "pointer", background: "rgba(255,255,255,0.03)", border: "1px solid " + D.border, fontFamily: ft, fontSize: 11, fontWeight: 600, color: D.txd, transition: "all 0.2s", marginLeft: "auto" }}>Dismiss</div>
          </div>;
        })()}
      </div>
    </div>
  </div>;
}

// ═══ MAIN COMPONENT ═══
export default function IdeationNation() {
  var _ideas = useState<Idea[]>([]), ideas = _ideas[0], setIdeas = _ideas[1];
  var _saved = useState<Idea[]>([]), saved = _saved[0], setSaved = _saved[1];
  var _view = useState<string>("feed"), view = _view[0], setView = _view[1];
  var _wizard = useState<boolean>(false), wizardOpen = _wizard[0], setWizardOpen = _wizard[1];
  var _loading = useState<boolean>(false), loading = _loading[0], setLoading = _loading[1];
  var _trends = useState<TrendItem[]>([]), trends = _trends[0], setTrends = _trends[1];
  var _toast = useState<string | null>(null), toast = _toast[0], setToast = _toast[1];
  var _loaded = useState<boolean>(false), loaded = _loaded[0], setLoaded = _loaded[1];

  // Load ideas from Supabase, fall back to localStorage
  useEffect(function() {
    var settled = false;
    var timer = setTimeout(function() {
      if (settled) return;
      settled = true;
      // Fallback to localStorage
      try {
        var raw = localStorage.getItem("ideation-saved");
        if (raw) setSaved(JSON.parse(raw));
      } catch (e) {}
      setLoaded(true);
    }, 800);

    dbLoadIdeas().then(function(data) {
      if (settled) return;
      clearTimeout(timer);
      settled = true;
      if (data) {
        if (data.ideas && Array.isArray(data.ideas)) setIdeas(data.ideas);
        if (data.saved && Array.isArray(data.saved)) setSaved(data.saved);
      } else {
        // Fallback to localStorage
        try {
          var raw = localStorage.getItem("ideation-saved");
          if (raw) setSaved(JSON.parse(raw));
        } catch (e) {}
      }
      setLoaded(true);
    }).catch(function() {
      if (settled) return;
      clearTimeout(timer);
      settled = true;
      try {
        var raw = localStorage.getItem("ideation-saved");
        if (raw) setSaved(JSON.parse(raw));
      } catch (e) {}
      setLoaded(true);
    });

    // Load trends
    fetchTrends().then(function(data: TrendItem[] | { trends?: TrendItem[] }) {
      if (data && Array.isArray(data)) setTrends(data);
      else if (data && 'trends' in data && data.trends) setTrends(data.trends);
    });

    return function() { clearTimeout(timer); };
  }, []);

  // Check for routed context from News Flow
  useEffect(function() {
    try {
      var raw = localStorage.getItem("poast-route-to");
      if (raw) {
        var route = JSON.parse(raw);
        if (route.section === "ideation" && route.data) {
          localStorage.removeItem("poast-route-to");
          setWizardOpen(true);
          showToast("News item loaded -- generate ideas from it");
          // Store the context so the wizard can use it as the angle
          try { localStorage.setItem("ideation-routed-angle", route.data.prompt || ""); } catch (e) {}
        }
      }
    } catch (e) {}
  }, []);

  // Persist saved ideas to localStorage + Supabase
  useEffect(function() {
    if (!loaded) return;
    try { localStorage.setItem("ideation-saved", JSON.stringify(saved)); } catch (e) {}
    dbSyncIdeas(ideas, saved);
  }, [ideas, saved, loaded]);

  var showToast = function(msg: string) {
    setToast(msg);
    setTimeout(function() { setToast(null); }, 3000);
  };

  var handleGenerate = async function(config: GenerateConfig) {
    setLoading(true);

    var trendsSummary = "";
    if (trends.length > 0) {
      var trendSlice = trends.slice(0, 20);
      trendsSummary = "CURRENT TRENDING TOPICS:\n" + trendSlice.map(function(t: TrendItem, i: number) {
        return (i + 1) + ". " + (t.title || t.topic || t.name || JSON.stringify(t).slice(0, 120));
      }).join("\n");
    }

    var typeLabels = config.types.map(function(k: string) {
      var ct = CONTENT_TYPES.find(function(c: ContentType) { return c.key === k; });
      return ct ? ct.label : k;
    }).join(", ");

    var topicLabels = config.topics.map(function(k: string) {
      var ta = TOPIC_AREAS.find(function(a: TopicArea) { return a.key === k; });
      return ta ? ta.label : k;
    }).join(", ");

    var prompt = [
      "Generate 8 compelling content ideas for SemiAnalysis based on current trends.",
      "",
      "CONTENT TYPES REQUESTED: " + typeLabels,
      "TOPIC AREAS: " + topicLabels,
      config.angle ? "SPECIFIC ANGLE: " + config.angle : "",
      "",
      trendsSummary,
      "",
      "For each idea, return a JSON array of objects with these fields:",
      '- "title": a catchy, specific title (not generic)',
      '- "content_type": one of "Video", "Meme", "Thread", "Carousel", "Article", "Podcast"',
      '- "platforms": array of target platforms (from: "x", "instagram", "linkedin", "tiktok", "youtube")',
      '- "description": 2-3 sentences describing the idea, hook, and what makes it timely',
      '- "based_on": which trend or insight inspired this idea',
      "",
      'Return format: {"ideas": [...]}',
    ].filter(Boolean).join("\n");

    var result = await askAPI(SYS_IDEATION, prompt);

    if (result && result.ideas && Array.isArray(result.ideas)) {
      var newIdeas = (result.ideas as Idea[]).map(function(idea: Idea, i: number) {
        return Object.assign({}, idea, { id: Date.now() + "_" + i });
      });
      setIdeas(function(prev: Idea[]) { return newIdeas.concat(prev); });
      showToast("Generated " + newIdeas.length + " new ideas");
    } else {
      showToast("Failed to generate ideas. Try again.");
    }

    setLoading(false);
    setWizardOpen(false);
  };

  var handleSendSlopTop = function(idea: Idea) {
    showToast("Sent '" + idea.title + "' to Slop Top queue");
  };

  var handleSendCapper = function(idea: Idea) {
    showToast("Sent '" + idea.title + "' to Capper");
  };

  var handleExport = function(idea: Idea) {
    var content = idea.title + "\n\nType: " + idea.content_type + "\nPlatforms: " + (idea.platforms || []).join(", ") + "\n\n" + idea.description + "\n\nBased on: " + (idea.based_on || "N/A");
    var blob = new Blob([content], { type: "text/plain" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = idea.title.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40) + ".txt";
    a.click();
    URL.revokeObjectURL(url);
    showToast("Exported idea");
  };

  var handleDismiss = function(idea: Idea) {
    setIdeas(function(prev: Idea[]) { return prev.filter(function(i: Idea) { return i.id !== idea.id; }); });
  };

  var handleSave = function(idea: Idea) {
    setSaved(function(prev: Idea[]) { return [idea].concat(prev.filter(function(s: Idea) { return s.id !== idea.id; })); });
    showToast("Saved '" + idea.title + "'");
  };

  var handleUnsave = function(idea: Idea) {
    setSaved(function(prev: Idea[]) { return prev.filter(function(s: Idea) { return s.id !== idea.id; }); });
  };

  var displayIdeas = view === "saved" ? saved : ideas;

  var statsIdeas = ideas.length;
  var statsSaved = saved.length;
  var statsTrending = trends.length;

  return <div style={{ position: "relative" }}>
    {/* Global CSS animations */}
    <style dangerouslySetInnerHTML={{ __html: CSS_ANIMATIONS }} />

    {/* ═══ IMMERSIVE HERO HEADER ═══ */}
    <div className="ideation-hero" style={{
      position: "relative", width: "calc(100% + 48px)", marginLeft: -24, marginTop: -24,
      height: 300, overflow: "hidden",
      background: "linear-gradient(135deg, #0B1A2E 0%, #1A0B2E 30%, #0B2E1A 60%, #2E1A0B 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      marginBottom: 28,
    }}>
      {/* Floating orbs */}
      <FloatingOrbs />

      {/* Sparkle particles */}
      <SparkleParticles />

      {/* Radial light overlay */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 40%, rgba(247,176,65,0.06) 0%, transparent 60%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 30% 60%, rgba(144,92,203,0.05) 0%, transparent 50%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 70% 30%, rgba(11,134,209,0.04) 0%, transparent 50%)", pointerEvents: "none" }} />

      {/* Title */}
      <div style={{ position: "relative", zIndex: 2, textAlign: "center" }}>
        <div style={{
          fontFamily: gf, fontSize: 48, fontWeight: 900, color: "#fff", letterSpacing: -2,
          textShadow: "0 0 30px rgba(247,176,65,0.3), 0 0 60px rgba(144,92,203,0.2), 0 0 90px rgba(11,134,209,0.15), 0 0 120px rgba(46,173,142,0.1)",
          marginBottom: 8,
        }}>IdeationNation</div>

        <div style={{
          fontFamily: ft, fontSize: 16, color: "rgba(255,255,255,0.55)", fontWeight: 400, letterSpacing: 1,
          marginBottom: 28,
        }}>Where ideas come alive</div>

        {/* Stats bar */}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 24, flexWrap: "wrap" }}>
          {[
            { label: statsIdeas + " ideas generated", color: D.amber },
            { label: statsSaved + " saved", color: D.violet },
            { label: statsTrending + " trending topics", color: D.teal },
          ].map(function(stat, i) {
            return <div key={i} style={{
              fontFamily: mn, fontSize: 10, fontWeight: 600, color: stat.color,
              background: stat.color + "15", border: "1px solid " + stat.color + "30",
              padding: "5px 14px", borderRadius: 20, letterSpacing: 0.5,
            }}>{stat.label}</div>;
          })}
        </div>

        {/* Big Generate Button */}
        <div onClick={function() { setWizardOpen(true); }} style={{
          display: "inline-block", padding: "18px 40px", borderRadius: 14, cursor: "pointer",
          background: "linear-gradient(135deg, " + D.amber + ", #E8A020)",
          color: "#060608", fontFamily: gf, fontSize: 17, fontWeight: 900, letterSpacing: -0.3,
          boxShadow: "0 0 40px " + D.amber + "30, 0 0 80px " + D.amber + "15, 0 6px 24px rgba(0,0,0,0.5)",
          transition: "all 0.2s ease", animation: "idGlow 3s ease-in-out infinite",
        }}>Generate Ideas</div>
      </div>

      {/* Bottom fade into page bg */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60, background: "linear-gradient(to bottom, transparent, " + D.bg + ")", pointerEvents: "none" }} />
    </div>

    {/* ═══ FEED TOGGLE ═══ */}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, position: "relative", zIndex: 1 }}>
      <div style={{ display: "flex", background: D.card, borderRadius: 12, border: "1px solid " + D.border, padding: 3 }}>
        {[
          { key: "feed", label: "All Ideas", count: ideas.length },
          { key: "saved", label: "Saved", count: saved.length },
        ].map(function(v) {
          var on = view === v.key;
          return <div key={v.key} onClick={function() { setView(v.key); }} style={{
            padding: "9px 22px", borderRadius: 10, cursor: "pointer",
            background: on ? "linear-gradient(135deg, " + D.amber + "18, " + D.violet + "10)" : "transparent",
            border: on ? "1px solid " + D.amber + "30" : "1px solid transparent",
            fontFamily: ft, fontSize: 13, fontWeight: on ? 700 : 500,
            color: on ? D.amber : D.txd, transition: "all 0.2s ease",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            {v.label}
            <span style={{
              fontFamily: mn, fontSize: 9, fontWeight: 700,
              color: on ? D.amber : D.txd,
              background: on ? D.amber + "20" : "rgba(255,255,255,0.04)",
              padding: "2px 8px", borderRadius: 6, minWidth: 18, textAlign: "center",
            }}>{v.count}</span>
          </div>;
        })}
      </div>
      {trends.length > 0 && <div style={{ fontFamily: mn, fontSize: 9, color: D.teal, display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: D.teal, boxShadow: "0 0 10px " + D.teal + "60", animation: "idPulse 2s ease-in-out infinite" }} />
        {trends.length} trends live
      </div>}
    </div>

    {/* ═══ CONTENT ═══ */}
    <div style={{ position: "relative", zIndex: 1 }}>
      {displayIdeas.length === 0 && !loading && <div style={{ textAlign: "center", padding: "80px 0" }}>
        <div style={{ fontFamily: ft, fontSize: 18, fontWeight: 700, color: D.txd, marginBottom: 10 }}>
          {view === "saved" ? "No saved ideas yet" : "No ideas generated yet"}
        </div>
        <div style={{ fontFamily: mn, fontSize: 11, color: D.txd, marginBottom: 24 }}>
          {view === "saved" ? "Save ideas from your feed to see them here." : "Click 'Generate Ideas' to get AI-powered content suggestions based on live trends."}
        </div>
        {view === "feed" && <div onClick={function() { setWizardOpen(true); }} style={{
          display: "inline-block", padding: "12px 28px", borderRadius: 12, cursor: "pointer",
          background: D.amber + "15", border: "1px solid " + D.amber + "40",
          fontFamily: ft, fontSize: 13, fontWeight: 700, color: D.amber, transition: "all 0.2s",
        }}>Get Started</div>}
      </div>}

      {loading && ideas.length === 0 && <ProgressBar label="Generating ideas from trends data..." />}

      {displayIdeas.map(function(idea) {
        var isSaved = saved.some(function(s) { return s.id === idea.id; });
        return <div key={idea.id} style={{ position: "relative" }}>
          {/* Save button */}
          {view === "feed" && <div onClick={function() { if (isSaved) handleUnsave(idea); else handleSave(idea); }} style={{
            position: "absolute", top: 22, right: 16, zIndex: 2,
            fontFamily: mn, fontSize: 9, color: isSaved ? D.amber : D.txd, cursor: "pointer",
            padding: "4px 12px", borderRadius: 8,
            border: "1px solid " + (isSaved ? D.amber + "40" : D.border),
            background: isSaved ? D.amber + "12" : "transparent",
            transition: "all 0.2s",
          }}>{isSaved ? "Saved" : "Save"}</div>}

          <IdeaCard
            idea={idea}
            onSendSlopTop={handleSendSlopTop}
            onSendCapper={handleSendCapper}
            onExport={handleExport}
            onDismiss={view === "saved" ? handleUnsave : handleDismiss}
            onSave={view === "feed" ? handleSave : null}
            showToast={showToast}
          />
        </div>;
      })}
    </div>

    {/* Wizard */}
    <WizardOverlay
      open={wizardOpen}
      onClose={function() { setWizardOpen(false); }}
      onGenerate={handleGenerate}
      loading={loading}
    />

    {/* Toast */}
    {toast && <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 10000,
      padding: "12px 22px", background: D.card,
      border: "1px solid " + D.amber + "40", borderRadius: 12,
      fontFamily: mn, fontSize: 11, color: D.amber,
      boxShadow: "0 0 24px " + D.amber + "18, 0 4px 20px rgba(0,0,0,0.5)",
      animation: "toastFadeIn 0.2s ease",
    }}>{toast}</div>}
  </div>;
}
