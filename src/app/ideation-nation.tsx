// @ts-nocheck
"use client";
import { useState, useEffect } from "react";

// ═══ DESIGN ═══
var D = {
  bg: "#060608", card: "#09090D", border: "rgba(255,255,255,0.06)", hover: "#0D0D12",
  surface: "#0D0D12", tx: "#E8E4DD", txm: "#8A8690", txd: "#4E4B56",
  amber: "#F7B041", blue: "#0B86D1", teal: "#2EAD8E", coral: "#E06347",
  violet: "#905CCB", cyan: "#26C9D8",
};
var ft = "'Outfit',sans-serif";
var mn = "'JetBrains Mono',monospace";

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

var TYPE_BADGE_COLORS = {
  "Video": D.coral, "Meme": D.violet, "Thread": D.blue,
  "Carousel": D.cyan, "Article": D.teal, "Podcast": D.amber,
};

var SYS_IDEATION = "You are a creative content strategist for SemiAnalysis, a semiconductor and AI infrastructure research firm. Your job is to generate compelling, timely content ideas based on current industry trends. Rules: Never use em dashes, use commas or periods. No emojis. Be specific and actionable, not vague. Each idea should have a clear hook and angle. RESPOND ONLY IN VALID JSON. No markdown fences. No preamble.";

// ═══ HELPERS ═══
function copyText(str) {
  try { var ta = document.createElement("textarea"); ta.value = str; ta.style.position = "fixed"; ta.style.left = "-9999px"; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); return true; } catch (e) { try { navigator.clipboard.writeText(str); return true; } catch (e2) { return false; } }
}

async function askAPI(sys, prompt) {
  try {
    var r = await fetch("/api/generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: sys, prompt: prompt }),
    });
    var d = await r.json();
    if (d.error) { console.error("API Error:", d.error); return null; }
    if (!d.content) { return null; }
    var t = (d.content || []).map(function(c) { return c.text || ""; }).join("");
    try {
      return JSON.parse(t.replace(/```json|```/g, "").trim());
    } catch (pe) { console.error("Parse error:", t); return null; }
  } catch (e) { console.error("API:", e); return null; }
}

async function fetchTrends() {
  try {
    var r = await fetch("/api/trends-feed?source=all");
    var d = await r.json();
    return d;
  } catch (e) { console.error("Trends fetch failed:", e); return []; }
}

// ═══ PROGRESS BAR ═══
function ProgressBar({ label }) {
  return <div style={{ margin: "22px 0" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <div style={{ fontFamily: mn, fontSize: 11, color: D.amber, letterSpacing: "2px", textTransform: "uppercase" }}>{label || "Generating..."}</div>
    </div>
    <div style={{ width: "100%", height: 2, background: "rgba(255,255,255,0.06)", borderRadius: 1, overflow: "hidden", position: "relative" }}>
      <style dangerouslySetInnerHTML={{ __html: "@keyframes ideaSlide{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}" }} />
      <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: "40%", borderRadius: 1, background: "linear-gradient(90deg, transparent, " + D.amber + ", transparent)", animation: "ideaSlide 1.5s ease-in-out infinite" }} />
    </div>
  </div>;
}

// ═══ WIZARD OVERLAY ═══
function WizardOverlay({ open, onClose, onGenerate, loading }) {
  var _step = useState(1), step = _step[0], setStep = _step[1];
  var _types = useState([]), types = _types[0], setTypes = _types[1];
  var _topics = useState([]), topics = _topics[0], setTopics = _topics[1];
  var _angle = useState(""), angle = _angle[0], setAngle = _angle[1];

  var toggleType = function(key) {
    setTypes(function(p) { return p.indexOf(key) > -1 ? p.filter(function(k) { return k !== key; }) : p.concat([key]); });
  };
  var toggleTopic = function(key) {
    setTopics(function(p) { return p.indexOf(key) > -1 ? p.filter(function(k) { return k !== key; }) : p.concat([key]); });
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

  return <div style={{ position: "fixed", inset: 0, zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center" }}>
    {/* Backdrop with ambient glow */}
    <div onClick={handleClose} style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, rgba(247,176,65,0.06) 0%, rgba(6,6,8,0.95) 60%)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }} />

    {/* Wizard card */}
    <div style={{ position: "relative", width: 540, maxHeight: "80vh", overflow: "auto", background: "linear-gradient(135deg, #0F0F18 0%, #0A0A12 100%)", border: "1px solid " + D.amber + "25", borderRadius: 16, padding: "32px 36px", boxShadow: "0 0 80px rgba(247,176,65,0.06), 0 24px 60px rgba(0,0,0,0.6)" }}>
      {/* Ambient glow orb */}
      <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, " + D.amber + "08, transparent 70%)", pointerEvents: "none" }} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div>
          <div style={{ fontFamily: ft, fontSize: 22, fontWeight: 900, color: D.tx, letterSpacing: -0.5 }}>Generate Ideas</div>
          <div style={{ fontFamily: mn, fontSize: 10, color: D.txm, marginTop: 4 }}>Step {step} of 4 -- {stepLabels[step - 1]}</div>
        </div>
        <div onClick={handleClose} style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "rgba(255,255,255,0.04)", border: "1px solid " + D.border, color: D.txd, fontFamily: ft, fontSize: 16, transition: "all 0.2s" }}>x</div>
      </div>

      {/* Step indicator */}
      <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
        {[1, 2, 3, 4].map(function(s) {
          var active = s === step;
          var done = s < step;
          return <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: active ? D.amber : done ? D.amber + "60" : "rgba(255,255,255,0.06)", transition: "all 0.3s ease", boxShadow: active ? "0 0 10px " + D.amber + "40" : "none" }} />;
        })}
      </div>

      {/* Step 1: Content Type */}
      {step === 1 && <div>
        <div style={{ fontFamily: mn, fontSize: 11, color: D.amber, textTransform: "uppercase", letterSpacing: "2px", marginBottom: 14 }}>What type of content?</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {CONTENT_TYPES.map(function(ct) {
            var on = types.indexOf(ct.key) > -1;
            return <div key={ct.key} onClick={function() { toggleType(ct.key); }} style={{ padding: "16px 18px", borderRadius: 12, cursor: "pointer", background: on ? ct.color + "10" : D.card, border: "1px solid " + (on ? ct.color + "50" : D.border), boxShadow: on ? "0 0 20px " + ct.color + "15" : "none", transition: "all 0.2s ease" }}>
              <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: on ? ct.color : D.tx }}>{ct.label}</div>
            </div>;
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
          <div onClick={function() { if (types.length > 0) setStep(2); }} style={{ padding: "10px 24px", borderRadius: 10, cursor: types.length > 0 ? "pointer" : "not-allowed", background: types.length > 0 ? "linear-gradient(135deg, " + D.amber + ", #E8A020)" : "rgba(255,255,255,0.04)", color: types.length > 0 ? "#060608" : D.txd, fontFamily: ft, fontSize: 13, fontWeight: 800, transition: "all 0.2s" }}>Next</div>
        </div>
      </div>}

      {/* Step 2: Topic Area */}
      {step === 2 && <div>
        <div style={{ fontFamily: mn, fontSize: 11, color: D.amber, textTransform: "uppercase", letterSpacing: "2px", marginBottom: 14 }}>What topic area?</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {TOPIC_AREAS.map(function(ta) {
            var on = topics.indexOf(ta.key) > -1;
            return <div key={ta.key} onClick={function() { toggleTopic(ta.key); }} style={{ padding: "14px 18px", borderRadius: 12, cursor: "pointer", background: on ? D.amber + "10" : D.card, border: "1px solid " + (on ? D.amber + "50" : D.border), boxShadow: on ? "0 0 16px " + D.amber + "12" : "none", transition: "all 0.2s ease" }}>
              <div style={{ fontFamily: ft, fontSize: 13, fontWeight: 700, color: on ? D.amber : D.tx }}>{ta.label}</div>
            </div>;
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
          <div onClick={function() { setStep(1); }} style={{ padding: "10px 20px", borderRadius: 10, cursor: "pointer", background: "transparent", border: "1px solid " + D.border, color: D.txm, fontFamily: ft, fontSize: 13, fontWeight: 600, transition: "all 0.2s" }}>Back</div>
          <div onClick={function() { if (topics.length > 0) setStep(3); }} style={{ padding: "10px 24px", borderRadius: 10, cursor: topics.length > 0 ? "pointer" : "not-allowed", background: topics.length > 0 ? "linear-gradient(135deg, " + D.amber + ", #E8A020)" : "rgba(255,255,255,0.04)", color: topics.length > 0 ? "#060608" : D.txd, fontFamily: ft, fontSize: 13, fontWeight: 800, transition: "all 0.2s" }}>Next</div>
        </div>
      </div>}

      {/* Step 3: Angle */}
      {step === 3 && <div>
        <div style={{ fontFamily: mn, fontSize: 11, color: D.amber, textTransform: "uppercase", letterSpacing: "2px", marginBottom: 14 }}>Any specific angle? (optional)</div>
        <textarea value={angle} onChange={function(e) { setAngle(e.target.value); }} rows={4} placeholder="e.g. Focus on how TSMC's CoWoS capacity affects AI chip supply, or contrast NVIDIA vs AMD datacenter strategies..." style={{ width: "100%", padding: "14px 16px", background: D.card, border: "1px solid " + D.border, borderRadius: 10, color: D.tx, fontFamily: mn, fontSize: 12, outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.7, transition: "border-color 0.2s ease" }} onFocus={function(e) { e.target.style.borderColor = D.amber; }} onBlur={function(e) { e.target.style.borderColor = D.border; }} />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
          <div onClick={function() { setStep(2); }} style={{ padding: "10px 20px", borderRadius: 10, cursor: "pointer", background: "transparent", border: "1px solid " + D.border, color: D.txm, fontFamily: ft, fontSize: 13, fontWeight: 600, transition: "all 0.2s" }}>Back</div>
          <div onClick={function() { setStep(4); }} style={{ padding: "10px 24px", borderRadius: 10, cursor: "pointer", background: "linear-gradient(135deg, " + D.amber + ", #E8A020)", color: "#060608", fontFamily: ft, fontSize: 13, fontWeight: 800, transition: "all 0.2s" }}>Next</div>
        </div>
      </div>}

      {/* Step 4: Generate */}
      {step === 4 && <div>
        <div style={{ fontFamily: mn, fontSize: 11, color: D.amber, textTransform: "uppercase", letterSpacing: "2px", marginBottom: 18 }}>Ready to generate</div>

        {/* Summary */}
        <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 12, padding: "18px 20px", marginBottom: 20 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 6 }}>Content Types</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {types.map(function(t) {
                var ct = CONTENT_TYPES.find(function(c) { return c.key === t; });
                return <span key={t} style={{ fontFamily: ft, fontSize: 11, fontWeight: 700, color: ct ? ct.color : D.tx, background: (ct ? ct.color : D.amber) + "15", padding: "3px 10px", borderRadius: 6 }}>{ct ? ct.label : t}</span>;
              })}
            </div>
          </div>
          <div style={{ marginBottom: angle ? 12 : 0 }}>
            <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 6 }}>Topics</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {topics.map(function(t) {
                var ta = TOPIC_AREAS.find(function(a) { return a.key === t; });
                return <span key={t} style={{ fontFamily: ft, fontSize: 11, fontWeight: 600, color: D.tx, background: "rgba(255,255,255,0.06)", padding: "3px 10px", borderRadius: 6 }}>{ta ? ta.label : t}</span>;
              })}
            </div>
          </div>
          {angle && <div>
            <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 6 }}>Angle</div>
            <div style={{ fontFamily: ft, fontSize: 12, color: D.txm, lineHeight: 1.6 }}>{angle}</div>
          </div>}
        </div>

        {loading && <ProgressBar label="Generating ideas from trends data..." />}

        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div onClick={function() { setStep(3); }} style={{ padding: "10px 20px", borderRadius: 10, cursor: "pointer", background: "transparent", border: "1px solid " + D.border, color: D.txm, fontFamily: ft, fontSize: 13, fontWeight: 600, transition: "all 0.2s" }}>Back</div>
          <div onClick={loading ? undefined : handleGenerate} style={{ padding: "12px 32px", borderRadius: 10, cursor: loading ? "wait" : "pointer", background: loading ? D.txd : "linear-gradient(135deg, " + D.amber + ", #E8A020)", color: loading ? D.card : "#060608", fontFamily: ft, fontSize: 14, fontWeight: 900, letterSpacing: -0.3, transition: "all 0.2s", boxShadow: loading ? "none" : "0 0 24px " + D.amber + "30" }}>
            {loading ? "Generating..." : "Generate Ideas"}
          </div>
        </div>
      </div>}
    </div>
  </div>;
}

// ═══ IDEA CARD ═══
function IdeaCard({ idea, onSendSlopTop, onSendCapper, onExport, onDismiss }) {
  var _hovered = useState(false), hovered = _hovered[0], setHovered = _hovered[1];
  var _copied = useState(false), copied = _copied[0], setCopied = _copied[1];

  var badgeColor = TYPE_BADGE_COLORS[idea.content_type] || D.amber;

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
      border: "1px solid " + (hovered ? D.amber + "30" : D.border),
      borderRadius: 14,
      padding: "22px 24px",
      marginBottom: 14,
      transition: "all 0.3s ease",
      boxShadow: hovered ? "0 0 30px " + D.amber + "08, 0 8px 40px rgba(0,0,0,0.4)" : "0 2px 12px rgba(0,0,0,0.3)",
      position: "relative",
      overflow: "hidden",
    }}>
    {/* Gradient border glow on hover */}
    {hovered && <div style={{ position: "absolute", top: -1, left: -1, right: -1, bottom: -1, borderRadius: 15, background: "linear-gradient(135deg, " + D.amber + "20, transparent 40%, " + D.violet + "10 80%, transparent)", pointerEvents: "none", zIndex: 0 }} />}

    <div style={{ position: "relative", zIndex: 1 }}>
      {/* Top row: badge + platforms */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: ft, fontSize: 10, fontWeight: 800, color: badgeColor, background: badgeColor + "18", padding: "3px 10px", borderRadius: 6, letterSpacing: 0.5 }}>{idea.content_type}</span>
          {idea.platforms && idea.platforms.map(function(p) {
            var pt = PLATFORM_TAGS.find(function(t) { return t.key === p || t.label.toLowerCase() === p.toLowerCase(); });
            var c = pt ? pt.color : D.txd;
            var label = pt ? pt.label : p;
            return <span key={p} style={{ fontFamily: mn, fontSize: 9, color: c, background: c + "12", padding: "2px 8px", borderRadius: 4 }}>{label}</span>;
          })}
        </div>
        <span onClick={handleCopy} style={{ fontFamily: mn, fontSize: 9, color: copied ? D.amber : D.txd, cursor: "pointer", padding: "3px 8px", borderRadius: 6, border: "1px solid " + D.border, transition: "all 0.2s" }}>{copied ? "Copied" : "Copy"}</span>
      </div>

      {/* Title */}
      <div style={{ fontFamily: ft, fontSize: 17, fontWeight: 800, color: D.tx, marginBottom: 10, lineHeight: 1.4, letterSpacing: -0.3 }}>{idea.title}</div>

      {/* Description */}
      <div style={{ fontFamily: ft, fontSize: 13, color: D.txm, lineHeight: 1.7, marginBottom: 14 }}>{idea.description}</div>

      {/* Based on */}
      {idea.based_on && <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, marginBottom: 18, padding: "8px 12px", background: "rgba(255,255,255,0.02)", borderRadius: 8, borderLeft: "2px solid " + D.amber + "40" }}>
        <span style={{ color: D.amber + "80", fontWeight: 700 }}>Based on: </span>{idea.based_on}
      </div>}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <div onClick={function() { onSendSlopTop(idea); }} style={{ padding: "7px 14px", borderRadius: 8, cursor: "pointer", background: D.coral + "12", border: "1px solid " + D.coral + "30", fontFamily: ft, fontSize: 11, fontWeight: 700, color: D.coral, transition: "all 0.2s" }}>Send to Slop Top</div>
        <div onClick={function() { onSendCapper(idea); }} style={{ padding: "7px 14px", borderRadius: 8, cursor: "pointer", background: D.blue + "12", border: "1px solid " + D.blue + "30", fontFamily: ft, fontSize: 11, fontWeight: 700, color: D.blue, transition: "all 0.2s" }}>Send to Capper</div>
        <div onClick={function() { onExport(idea); }} style={{ padding: "7px 14px", borderRadius: 8, cursor: "pointer", background: D.teal + "12", border: "1px solid " + D.teal + "30", fontFamily: ft, fontSize: 11, fontWeight: 700, color: D.teal, transition: "all 0.2s" }}>Export (.docx)</div>
        <div onClick={function() { onDismiss(idea); }} style={{ padding: "7px 14px", borderRadius: 8, cursor: "pointer", background: "rgba(255,255,255,0.03)", border: "1px solid " + D.border, fontFamily: ft, fontSize: 11, fontWeight: 600, color: D.txd, transition: "all 0.2s", marginLeft: "auto" }}>Dismiss</div>
      </div>
    </div>
  </div>;
}

// ═══ MAIN COMPONENT ═══
export default function IdeationNation() {
  var _ideas = useState([]), ideas = _ideas[0], setIdeas = _ideas[1];
  var _saved = useState([]), saved = _saved[0], setSaved = _saved[1];
  var _view = useState("feed"), view = _view[0], setView = _view[1];
  var _wizard = useState(false), wizardOpen = _wizard[0], setWizardOpen = _wizard[1];
  var _loading = useState(false), loading = _loading[0], setLoading = _loading[1];
  var _trends = useState([]), trends = _trends[0], setTrends = _trends[1];
  var _toast = useState(null), toast = _toast[0], setToast = _toast[1];

  // Load trends on mount
  useEffect(function() {
    fetchTrends().then(function(data) {
      if (data && Array.isArray(data)) setTrends(data);
      else if (data && data.trends) setTrends(data.trends);
    });
    // Load saved ideas from localStorage
    try {
      var raw = localStorage.getItem("ideation-saved");
      if (raw) setSaved(JSON.parse(raw));
    } catch (e) {}
  }, []);

  // Persist saved ideas
  useEffect(function() {
    try { localStorage.setItem("ideation-saved", JSON.stringify(saved)); } catch (e) {}
  }, [saved]);

  var showToast = function(msg) {
    setToast(msg);
    setTimeout(function() { setToast(null); }, 3000);
  };

  var handleGenerate = async function(config) {
    setLoading(true);

    var trendsSummary = "";
    if (trends.length > 0) {
      var trendSlice = trends.slice(0, 20);
      trendsSummary = "CURRENT TRENDING TOPICS:\n" + trendSlice.map(function(t, i) {
        return (i + 1) + ". " + (t.title || t.topic || t.name || JSON.stringify(t).slice(0, 120));
      }).join("\n");
    }

    var typeLabels = config.types.map(function(k) {
      var ct = CONTENT_TYPES.find(function(c) { return c.key === k; });
      return ct ? ct.label : k;
    }).join(", ");

    var topicLabels = config.topics.map(function(k) {
      var ta = TOPIC_AREAS.find(function(a) { return a.key === k; });
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
      var newIdeas = result.ideas.map(function(idea, i) {
        return Object.assign({}, idea, { id: Date.now() + "_" + i });
      });
      setIdeas(function(prev) { return newIdeas.concat(prev); });
      showToast("Generated " + newIdeas.length + " new ideas");
    } else {
      showToast("Failed to generate ideas. Try again.");
    }

    setLoading(false);
    setWizardOpen(false);
  };

  var handleSendSlopTop = function(idea) {
    showToast("Sent '" + idea.title + "' to Slop Top queue");
  };

  var handleSendCapper = function(idea) {
    showToast("Sent '" + idea.title + "' to Capper");
  };

  var handleExport = function(idea) {
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

  var handleDismiss = function(idea) {
    setIdeas(function(prev) { return prev.filter(function(i) { return i.id !== idea.id; }); });
  };

  var handleSave = function(idea) {
    setSaved(function(prev) { return [idea].concat(prev.filter(function(s) { return s.id !== idea.id; })); });
    showToast("Saved '" + idea.title + "'");
  };

  var handleUnsave = function(idea) {
    setSaved(function(prev) { return prev.filter(function(s) { return s.id !== idea.id; }); });
  };

  var displayIdeas = view === "saved" ? saved : ideas;

  return <div style={{ position: "relative" }}>
    {/* Ambient background glow */}
    <div style={{ position: "fixed", top: 0, right: 0, width: "40vw", height: "40vh", background: "radial-gradient(ellipse at top right, " + D.amber + "04, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

    {/* Header */}
    <div style={{ padding: "28px 0 0", marginBottom: 28, position: "relative", zIndex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontFamily: ft, fontSize: 28, fontWeight: 900, color: D.tx, letterSpacing: -1 }}>IdeationNation</div>
          <div style={{ fontFamily: mn, fontSize: 11, color: D.txm, marginTop: 4, letterSpacing: "1px" }}>AI-powered content idea hub. Fueled by live trends.</div>
        </div>
        <div onClick={function() { setWizardOpen(true); }} style={{ padding: "12px 28px", borderRadius: 12, cursor: "pointer", background: "linear-gradient(135deg, " + D.amber + ", #E8A020)", color: "#060608", fontFamily: ft, fontSize: 14, fontWeight: 900, letterSpacing: -0.3, boxShadow: "0 0 30px " + D.amber + "25, 0 4px 20px rgba(0,0,0,0.4)", transition: "all 0.2s ease" }}>Generate Ideas</div>
      </div>

      {/* View toggle + stats */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
        <div style={{ display: "flex", gap: 4 }}>
          {[
            { key: "feed", label: "Idea Feed", count: ideas.length },
            { key: "saved", label: "Saved Ideas", count: saved.length },
          ].map(function(v) {
            var on = view === v.key;
            return <div key={v.key} onClick={function() { setView(v.key); }} style={{ padding: "8px 18px", borderRadius: 8, cursor: "pointer", background: on ? D.amber + "12" : "transparent", border: "1px solid " + (on ? D.amber + "40" : "transparent"), fontFamily: ft, fontSize: 12, fontWeight: on ? 700 : 500, color: on ? D.amber : D.txd, transition: "all 0.2s ease", display: "flex", alignItems: "center", gap: 8 }}>
              {v.label}
              <span style={{ fontFamily: mn, fontSize: 9, color: on ? D.amber + "80" : D.txd, background: on ? D.amber + "10" : "rgba(255,255,255,0.04)", padding: "1px 6px", borderRadius: 4 }}>{v.count}</span>
            </div>;
          })}
        </div>
        {trends.length > 0 && <div style={{ fontFamily: mn, fontSize: 9, color: D.teal, display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: D.teal, boxShadow: "0 0 8px " + D.teal + "60" }} />
          {trends.length} trends loaded
        </div>}
      </div>
    </div>

    {/* Content */}
    <div style={{ position: "relative", zIndex: 1 }}>
      {displayIdeas.length === 0 && !loading && <div style={{ textAlign: "center", padding: "80px 0" }}>
        <div style={{ fontFamily: ft, fontSize: 18, fontWeight: 700, color: D.txd, marginBottom: 10 }}>
          {view === "saved" ? "No saved ideas yet" : "No ideas generated yet"}
        </div>
        <div style={{ fontFamily: mn, fontSize: 11, color: D.txd, marginBottom: 24 }}>
          {view === "saved" ? "Save ideas from your feed to see them here." : "Click 'Generate Ideas' to get AI-powered content suggestions based on live trends."}
        </div>
        {view === "feed" && <div onClick={function() { setWizardOpen(true); }} style={{ display: "inline-block", padding: "10px 24px", borderRadius: 10, cursor: "pointer", background: D.amber + "15", border: "1px solid " + D.amber + "40", fontFamily: ft, fontSize: 13, fontWeight: 700, color: D.amber, transition: "all 0.2s" }}>Get Started</div>}
      </div>}

      {loading && ideas.length === 0 && <ProgressBar label="Generating ideas from trends data..." />}

      {displayIdeas.map(function(idea) {
        var isSaved = saved.some(function(s) { return s.id === idea.id; });
        return <div key={idea.id} style={{ position: "relative" }}>
          {/* Save button */}
          {view === "feed" && <div onClick={function() { if (isSaved) handleUnsave(idea); else handleSave(idea); }} style={{ position: "absolute", top: 22, right: 60, zIndex: 2, fontFamily: mn, fontSize: 9, color: isSaved ? D.amber : D.txd, cursor: "pointer", padding: "3px 10px", borderRadius: 6, border: "1px solid " + (isSaved ? D.amber + "40" : D.border), background: isSaved ? D.amber + "10" : "transparent", transition: "all 0.2s" }}>{isSaved ? "Saved" : "Save"}</div>}

          <IdeaCard
            idea={idea}
            onSendSlopTop={handleSendSlopTop}
            onSendCapper={handleSendCapper}
            onExport={handleExport}
            onDismiss={view === "saved" ? handleUnsave : handleDismiss}
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
    {toast && <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 10000, padding: "12px 20px", background: D.card, border: "1px solid " + D.amber + "40", borderRadius: 10, fontFamily: mn, fontSize: 11, color: D.amber, boxShadow: "0 0 20px " + D.amber + "15, 0 4px 20px rgba(0,0,0,0.5)", animation: "toastFadeIn 0.2s ease" }}>
      <style dangerouslySetInnerHTML={{ __html: "@keyframes toastFadeIn{from{transform:translateY(10px);opacity:0}to{transform:translateY(0);opacity:1}}" }} />
      {toast}
    </div>}
  </div>;
}
