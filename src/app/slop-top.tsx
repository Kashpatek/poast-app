// @ts-nocheck
"use client";
import { useState, useEffect } from "react";

// ═══ DESIGN ═══
var D = {
  bg: "#060608", card: "#09090D", border: "rgba(255,255,255,0.06)",
  surface: "#0D0D12", tx: "#E8E4DD", txm: "#8A8690", txd: "#4E4B56",
  amber: "#F7B041", blue: "#0B86D1", teal: "#2EAD8E", coral: "#E06347",
  violet: "#905CCB", cyan: "#26C9D8",
};
var ft = "'Outfit',sans-serif";
var mn = "'JetBrains Mono',monospace";

// ═══ BRAINROT DATA ═══
var ROTATING_PHRASES = [
  "no cap fr fr",
  "it's giving semiconductor",
  "this goes hard",
  "absolute cinema",
  "lowkey bussin",
  "rent free in your head",
  "understood the assignment",
  "main character energy",
];

var ROTATING_EMOJIS = ["\uD83D\uDC80", "\uD83D\uDD25", "\uD83D\uDCAF", "\uD83D\uDDFF", "\u26A1", "\uD83E\uDDE0", "\uD83D\uDE24", "\uD83E\uDEE0"];

var BRAINROT_PRESETS = [
  { label: "\uD83D\uDC80 skibidi sigma", text: "skibidi toilet sigma male grindset energy, maximum aura" },
  { label: "\uD83D\uDCAF no cap fr fr", text: "deadass no cap, this is real, certified hood classic moment" },
  { label: "\u2728 it's giving...", text: "it's giving main character energy, the vibes are immaculate" },
  { label: "\uD83C\uDF1F understood the assignment", text: "absolutely understood the assignment, ate and left no crumbs" },
  { label: "\uD83C\uDFE0 rent free", text: "living rent free in everyone's head, obsession era" },
  { label: "\uD83D\uDD25 certified banger", text: "this goes hard, feel free to screenshot, absolute cinema" },
  { label: "\uD83C\uDF3D Ohio moment", text: "only in Ohio, cursed timeline energy, what is this" },
  { label: "\uD83D\uDCC9 ratio + L", text: "ratio + L + didn't ask + touch grass + cope + seethe" },
  { label: "\uD83D\uDE0B lowkey bussin", text: "lowkey bussin no cap, the flavor profile is insane" },
  { label: "\uD83D\uDCAB delulu is the solulu", text: "manifesting, delusional but make it fashion" },
  { label: "\uD83D\uDC85 slay era", text: "serving looks, slay era, mother is mothering" },
  { label: "\uD83D\uDE33 GYATT", text: "maximum gyatt energy, absolutely unhinged" },
  { label: "\uD83E\uDD16 NPC behavior", text: "NPC energy, running on a script, glitched out" },
  { label: "\uD83D\uDCA6 hawk tuah", text: "hawk tuah energy, spit on that thang" },
  { label: "\uD83E\uDEE1 mewing", text: "mewing arc, looksmaxxing, jawline check" },
];

var ITALIAN_BRAINROT_PRESETS = [
  { label: "\uD83D\uDC0A Bombardino Coccodrillo", text: "bombardino crocodile, cursed 3D Italian brainrot creature, Spore energy" },
  { label: "\uD83D\uDD7A Tralalero Tralala", text: "tralalero tralala, Italian shitpost creature, dancing cursed 3D animal" },
  { label: "\uD83E\uDD41 Tung Tung Sahur", text: "tung tung sahur, drumming brainrot creature, chaotic 3D energy" },
  { label: "\u2744\uFE0F Brr Brr Patapim", text: "brr brr patapim, freezing Italian meme creature, cursed vibes" },
  { label: "\uD83C\uDFA4 Lirili Larila", text: "lirili larila, singing cursed creature, Italian internet fever dream" },
  { label: "\u2615 Cappuccino Assassino", text: "cappuccino assassino, coffee-themed Italian brainrot, espresso violence" },
  { label: "\uD83C\uDF5D Spaghettino Serpentino", text: "spaghetti snake, cursed Italian pasta creature, noodle arms" },
  { label: "\uD83D\uDC4B Bonjourno Cocaino", text: "bonjourno italian brainrot greeting, chaotic 3D character energy" },
  { label: "\uD83D\uDC04 La Vacca Saturno", text: "la vacca saturno, saturn cow, Italian space creature brainrot" },
  { label: "\uD83E\uDEBF Bombombini Gusini", text: "bombombini gusini, explosive goose, Italian chaos creature" },
  { label: "\uD83D\uDC12 Chimpanzini Bananini", text: "chimpanzini bananini, monkey banana Italian brainrot, primate chaos" },
  { label: "\uD83D\uDC7E Glorbo", text: "glorbo, the legendary cursed creature, peak brainrot form" },
];

var BRAINROT_LEVEL_LABELS = {
  1: "sane", 2: "quirky", 3: "weird", 4: "cursed", 5: "brainrot",
  6: "cooked", 7: "COOKED", 8: "brain damage", 9: "lobotomy", 10: "BOMBARDINO",
};

var BRAINROT_LEVEL_PROMPTS = {
  1: "slightly unhinged, a little weird",
  2: "slightly unhinged, a little weird",
  3: "slightly unhinged, a little weird",
  4: "definitely brainrotted, cursed energy, chaotic",
  5: "definitely brainrotted, cursed energy, chaotic",
  6: "definitely brainrotted, cursed energy, chaotic",
  7: "maximum brainrot, completely unhinged, looks like it was made by someone having a stroke",
  8: "maximum brainrot, completely unhinged, looks like it was made by someone having a stroke",
  9: "maximum brainrot, completely unhinged, looks like it was made by someone having a stroke",
  10: "peak brain damage, this should not exist, cursed beyond comprehension, Italian Spore creature energy, bombardino core",
};

var SUCCESS_MESSAGES = [
  "BOMBARDINO ACQUIRED \uD83D\uDC0A",
  "the creature has been born",
  "what have we created",
  "this is peak content",
  "certified Italian moment",
  "\uD83D\uDD25 this goes HARD \uD83D\uDCAF",
  "\uD83D\uDC80 slop acquired",
];

var LOADING_PHRASES = [
  "cooking rn...",
  "hold up this boutta go crazy...",
  "generating pure slop...",
  "the slopification is in progress...",
  "brainrot loading...",
  "sigma grindset activating...",
  "summoning the bombardino...",
  "the creature is forming...",
  "italiano brainrot loading...",
  "spore creature detected...",
  "this should not exist...",
  "we've gone too far...",
  "the slop is slopping...",
  "tralalero intensifies...",
  "maximum cursed energy...",
];

var NEON_HUES = [
  "#FF6B9D", "#C471ED", "#12FFF7", "#F8D800", "#FF6347",
  "#00FF88", "#FF00FF", "#00BFFF", "#FFD700", "#FF4500",
  "#7CFC00", "#FF1493", "#00CED1", "#FF8C00", "#ADFF2F",
];

// ═══ PLATFORM CONFIG ═══
var PLATFORMS = [
  { id: "tiktok", label: "TikTok", color: "#00F2EA" },
  { id: "igreels", label: "IG Reels", color: "#E4405F" },
  { id: "ytshorts", label: "YT Shorts", color: "#FF0000" },
  { id: "x", label: "X", color: "#1DA1F2" },
  { id: "multi", label: "Multi-platform", color: D.amber },
];

var VIBES = ["Educational", "Hype", "Humorous", "Informational", "Provocative"];
var HOSTS = ["Dylan", "Doug", "Jordan", "Vansh", "B-roll only"];
var LABELS = ["A", "B", "C"];

// ═══ SPINNER ═══
function Spinner() {
  return <div style={{ display: "inline-block", position: "relative" }}>
    <style dangerouslySetInnerHTML={{ __html: "@keyframes slopSpin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}" }} />
    <div style={{
      width: 18, height: 18, border: "2px solid " + D.border,
      borderTop: "2px solid " + D.amber, borderRadius: "50%",
      animation: "slopSpin 0.8s linear infinite",
    }} />
  </div>;
}

// ═══ COPY HELPER ═══
function copyBrief(brief, label, platform) {
  var lines = [];
  lines.push("=== BRIEF " + label + " ===");
  lines.push("");
  lines.push("HOOK (0-3s): " + (brief.hook || ""));
  lines.push("");
  lines.push("CORE MESSAGE: " + (brief.core_message || ""));
  lines.push("");
  lines.push("VISUAL STRUCTURE:");
  if (brief.visual_structure) {
    brief.visual_structure.forEach(function(v) {
      lines.push("  [" + v.time + "] " + v.shot);
    });
  }
  lines.push("");
  lines.push("ON-SCREEN TEXT:");
  if (brief.onscreen_text) {
    brief.onscreen_text.forEach(function(t) {
      lines.push("  [" + t.time + "] " + t.text);
    });
  }
  lines.push("");
  lines.push("AUDIO: " + (brief.audio || ""));
  lines.push("");
  lines.push("CAPTION:");
  if (brief.captions) {
    Object.keys(brief.captions).forEach(function(k) {
      lines.push("  " + k + ": " + brief.captions[k]);
    });
  }
  lines.push("");
  lines.push("EST. PRODUCTION TIME: " + (brief.est_time || ""));
  navigator.clipboard.writeText(lines.join("\n"));
}

// ═══ BRIEF CARD ═══
function BriefCard({ brief, label, selected, onSelect, assetSwapUrl }) {
  var _h = useState(false), hov = _h[0], setHov = _h[1];
  var _copied = useState(false), copied = _copied[0], setCopied = _copied[1];
  var isOn = selected === label;

  function handleCopy() {
    copyBrief(brief, label);
    setCopied(true);
    setTimeout(function() { setCopied(false); }, 2000);
  }

  return <div
    onMouseEnter={function() { setHov(true); }}
    onMouseLeave={function() { setHov(false); }}
    style={{
      background: isOn ? D.card : D.surface,
      border: "1px solid " + (isOn ? D.amber + "60" : hov ? "rgba(255,255,255,0.1)" : D.border),
      borderLeft: isOn ? "3px solid " + D.amber : "1px solid " + (hov ? D.amber + "30" : D.border),
      borderRadius: 12, padding: 24, transition: "all 0.2s",
      boxShadow: isOn ? "0 0 24px " + D.amber + "10" : "none",
    }}
  >
    {/* Card Header */}
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: isOn ? D.amber : D.border,
          color: isOn ? D.bg : D.txm,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: ft, fontSize: 14, fontWeight: 800,
        }}>{label}</div>
        <span style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: isOn ? D.amber : D.txm }}>
          Variation {label}
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={handleCopy} style={{
          padding: "6px 14px", borderRadius: 8, border: "1px solid " + D.border,
          background: copied ? D.teal + "20" : "transparent",
          color: copied ? D.teal : D.txm,
          cursor: "pointer", fontFamily: mn, fontSize: 10, fontWeight: 600,
          transition: "all 0.15s",
        }}>{copied ? "Copied" : "Copy Brief"}</button>
        <button onClick={function() { onSelect(label); }} style={{
          padding: "6px 14px", borderRadius: 8,
          border: isOn ? "1px solid " + D.amber : "1px solid " + D.border,
          background: isOn ? D.amber + "18" : "transparent",
          color: isOn ? D.amber : D.txm,
          cursor: "pointer", fontFamily: ft, fontSize: 11, fontWeight: 600,
          transition: "all 0.15s",
        }}>{isOn ? "Selected" : "Select"}</button>
      </div>
    </div>

    {/* Hook Line */}
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontFamily: mn, fontSize: 9, fontWeight: 600, color: D.txd, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Hook // 0-3s</div>
      <div style={{
        fontFamily: ft, fontSize: 16, fontWeight: 700, color: D.amber,
        padding: "12px 16px", background: D.amber + "0A", borderRadius: 8,
        borderLeft: "3px solid " + D.amber,
      }}>{brief.hook || ""}</div>
    </div>

    {/* Core Message */}
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontFamily: mn, fontSize: 9, fontWeight: 600, color: D.txd, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Core Message</div>
      <div style={{ fontFamily: ft, fontSize: 13, fontWeight: 500, color: D.tx, lineHeight: 1.6 }}>{brief.core_message || ""}</div>
    </div>

    {/* Visual Structure */}
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontFamily: mn, fontSize: 9, fontWeight: 600, color: D.txd, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Visual Structure</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {(brief.visual_structure || []).map(function(v, i) {
          return <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{
              fontFamily: mn, fontSize: 10, fontWeight: 700, color: D.cyan,
              background: D.cyan + "12", padding: "2px 8px", borderRadius: 4,
              flexShrink: 0, minWidth: 36, textAlign: "center",
            }}>{v.time}</span>
            <span style={{ fontFamily: ft, fontSize: 12, color: D.txm, lineHeight: 1.5 }}>{v.shot}</span>
          </div>;
        })}
      </div>
    </div>

    {/* On-Screen Text */}
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontFamily: mn, fontSize: 9, fontWeight: 600, color: D.txd, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>On-Screen Text</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {(brief.onscreen_text || []).map(function(t, i) {
          return <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{
              fontFamily: mn, fontSize: 10, fontWeight: 700, color: D.violet,
              background: D.violet + "12", padding: "2px 8px", borderRadius: 4,
              flexShrink: 0, minWidth: 36, textAlign: "center",
            }}>{t.time}</span>
            <span style={{ fontFamily: ft, fontSize: 12, color: D.tx, lineHeight: 1.5, fontStyle: "italic" }}>"{t.text}"</span>
          </div>;
        })}
      </div>
    </div>

    {/* Audio Recommendation */}
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontFamily: mn, fontSize: 9, fontWeight: 600, color: D.txd, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Audio Recommendation</div>
      <div style={{
        fontFamily: ft, fontSize: 12, color: D.txm, padding: "10px 14px",
        background: D.bg, borderRadius: 8, border: "1px solid " + D.border,
      }}>{brief.audio || ""}</div>
    </div>

    {/* Caption Kit */}
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontFamily: mn, fontSize: 9, fontWeight: 600, color: D.txd, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Caption Kit</div>
      {brief.captions && Object.keys(brief.captions).map(function(k) {
        return <div key={k} style={{ marginBottom: 8 }}>
          <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, marginBottom: 4 }}>{k}</div>
          <div style={{
            fontFamily: ft, fontSize: 12, color: D.tx, padding: "10px 14px",
            background: D.bg, borderRadius: 8, border: "1px solid " + D.border,
            lineHeight: 1.6, whiteSpace: "pre-wrap",
          }}>{brief.captions[k]}</div>
        </div>;
      })}
    </div>

    {/* Asset Swap URL */}
    {assetSwapUrl && <div style={{ marginBottom: 16 }}>
      <div style={{ fontFamily: mn, fontSize: 9, fontWeight: 600, color: D.txd, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Asset Swap URL</div>
      <a href={assetSwapUrl} target="_blank" rel="noopener noreferrer" style={{
        fontFamily: mn, fontSize: 11, color: D.blue, textDecoration: "none",
        padding: "8px 14px", background: D.blue + "0A", borderRadius: 8,
        border: "1px solid " + D.blue + "30", display: "inline-block",
      }}>{assetSwapUrl}</a>
    </div>}

    {/* Est. Production Time */}
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <span style={{
        fontFamily: mn, fontSize: 10, fontWeight: 700, color: D.teal,
        background: D.teal + "14", padding: "4px 12px", borderRadius: 6,
        border: "1px solid " + D.teal + "30",
      }}>{brief.est_time || "TBD"}</span>
    </div>
  </div>;
}

// ═══ COPY TEXT HELPER ═══
function copyText(text) {
  navigator.clipboard.writeText(text);
}

// ═══ SLOP RESULT CARD ═══
function SlopCard({ title, content, onCopy, copyLabel, extraButton }) {
  var _h = useState(false), hov = _h[0], setHov = _h[1];
  var _copied = useState(false), copied = _copied[0], setCopied = _copied[1];

  function handleCopy() {
    if (onCopy) onCopy();
    else copyText(content);
    setCopied(true);
    setTimeout(function() { setCopied(false); }, 2000);
  }

  return <div
    onMouseEnter={function() { setHov(true); }}
    onMouseLeave={function() { setHov(false); }}
    style={{
      background: D.card, border: "1px solid " + (hov ? D.amber + "40" : D.border),
      borderRadius: 12, padding: 20, transition: "all 0.2s",
      flex: "1 1 280px", minWidth: 0,
    }}
  >
    {title && <div style={{ fontFamily: mn, fontSize: 9, fontWeight: 600, color: D.txd, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>{title}</div>}
    <div style={{ fontFamily: ft, fontSize: 13, fontWeight: 500, color: D.tx, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{content}</div>
    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
      <button onClick={handleCopy} style={{
        padding: "6px 14px", borderRadius: 8, border: "1px solid " + D.border,
        background: copied ? D.teal + "20" : "transparent",
        color: copied ? D.teal : D.txm,
        cursor: "pointer", fontFamily: mn, fontSize: 10, fontWeight: 600,
        transition: "all 0.15s",
      }}>{copied ? "Copied" : (copyLabel || "Copy")}</button>
      {extraButton}
    </div>
  </div>;
}

// ═══ MAIN COMPONENT ═══
export default function SlopTop() {
  // Rotating brainrot phrase
  var _phraseIdx = useState(0), phraseIdx = _phraseIdx[0], setPhraseIdx = _phraseIdx[1];
  var _emojiIdx = useState(0), emojiIdx = _emojiIdx[0], setEmojiIdx = _emojiIdx[1];

  useEffect(function() {
    var interval = setInterval(function() {
      setPhraseIdx(function(prev) { return (prev + 1) % ROTATING_PHRASES.length; });
      setEmojiIdx(function(prev) { return (prev + 1) % ROTATING_EMOJIS.length; });
    }, 3000);
    return function() { clearInterval(interval); };
  }, []);

  // Brainrot level state
  var _brainrotLevel = useState(5), brainrotLevel = _brainrotLevel[0], setBrainrotLevel = _brainrotLevel[1];

  // Link-to-slop state
  var _slopUrl = useState(""), slopUrl = _slopUrl[0], setSlopUrl = _slopUrl[1];
  var _slopLoading = useState(false), slopLoading = _slopLoading[0], setSlopLoading = _slopLoading[1];
  var _slopError = useState(null), slopError = _slopError[0], setSlopError = _slopError[1];
  var _slopResults = useState(null), slopResults = _slopResults[0], setSlopResults = _slopResults[1];

  // Input state
  var _topic = useState(""), topic = _topic[0], setTopic = _topic[1];
  var _platform = useState("multi"), platform = _platform[0], setPlatform = _platform[1];
  var _vibe = useState("Educational"), vibe = _vibe[0], setVibe = _vibe[1];
  var _trendRef = useState(""), trendRef = _trendRef[0], setTrendRef = _trendRef[1];
  var _host = useState("B-roll only"), host = _host[0], setHost = _host[1];
  var _assetSwapUrl = useState(""), assetSwapUrl = _assetSwapUrl[0], setAssetSwapUrl = _assetSwapUrl[1];

  // Output state
  var _briefs = useState(null), briefs = _briefs[0], setBriefs = _briefs[1];
  var _loading = useState(false), loading = _loading[0], setLoading = _loading[1];
  var _error = useState(null), error = _error[0], setError = _error[1];
  var _selected = useState(null), selected = _selected[0], setSelected = _selected[1];

  // Video generation state
  var _videoLoading = useState(false), videoLoading = _videoLoading[0], setVideoLoading = _videoLoading[1];
  var _videoUrl = useState(null), videoUrl = _videoUrl[0], setVideoUrl = _videoUrl[1];
  var _videoError = useState(null), videoError = _videoError[0], setVideoError = _videoError[1];
  var _videoStatus = useState(null), videoStatus = _videoStatus[0], setVideoStatus = _videoStatus[1];

  // Random loading phrase
  var _loadingPhrase = useState(LOADING_PHRASES[0]), loadingPhrase = _loadingPhrase[0], setLoadingPhrase = _loadingPhrase[1];

  function pickLoadingPhrase() {
    setLoadingPhrase(LOADING_PHRASES[Math.floor(Math.random() * LOADING_PHRASES.length)]);
  }

  function handleSlopGenerate() {
    if (!slopUrl.trim()) return;
    setSlopLoading(true);
    setSlopError(null);
    setSlopResults(null);
    pickLoadingPhrase();

    fetch("/api/slob-top", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "link-to-slop", url: slopUrl.trim(), brainrotLevel: brainrotLevel, brainrotModifier: BRAINROT_LEVEL_PROMPTS[brainrotLevel] }),
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.error) {
        setSlopError(data.error + (data.raw ? " // " + data.raw : ""));
      } else if (data.results) {
        setSlopResults(data.results);
      } else {
        setSlopError("Unexpected response format");
      }
      setSlopLoading(false);
    })
    .catch(function(err) {
      setSlopError(String(err));
      setSlopLoading(false);
    });
  }

  function sendToImageCreator(prompt) {
    copyText(prompt);
  }

  function handleGenerate() {
    if (!topic.trim()) return;
    setLoading(true);
    setError(null);
    setBriefs(null);
    setSelected(null);

    fetch("/api/slob-top", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: topic, platform: platform, vibe: vibe,
        trendRef: trendRef, host: host, assetSwapUrl: assetSwapUrl,
      }),
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.error) {
        setError(data.error + (data.raw ? " // " + data.raw : ""));
      } else if (data.briefs) {
        setBriefs(data.briefs);
      } else {
        setError("Unexpected response format");
      }
      setLoading(false);
    })
    .catch(function(err) {
      setError(String(err));
      setLoading(false);
    });
  }

  // Tab state
  var _tab = useState("meme"), tab = _tab[0], setTab = _tab[1];
  // Meme maker state
  var _memeMode = useState("link"), memeMode = _memeMode[0], setMemeMode = _memeMode[1];
  var _memeIdea = useState(""), memeIdea = _memeIdea[0], setMemeIdea = _memeIdea[1];
  var _memeStyle = useState("meme"), memeStyle = _memeStyle[0], setMemeStyle = _memeStyle[1];
  var _memeImg = useState(null), memeImg = _memeImg[0], setMemeImg = _memeImg[1];
  var _memeImgLoading = useState(false), memeImgLoading = _memeImgLoading[0], setMemeImgLoading = _memeImgLoading[1];

  var MEME_STYLES = [
    { id: "meme", l: "Classic Meme \uD83D\uDC80", prompt: "internet meme format, bold impact font, funny" },
    { id: "infographic", l: "Infographic \uD83D\uDCCA", prompt: "clean infographic, data visualization, professional" },
    { id: "reaction", l: "Reaction \uD83D\uDE31", prompt: "reaction image, expressive, social media ready" },
    { id: "screenshot", l: "Fake Screenshot \uD83D\uDCF1", prompt: "fake tweet or post screenshot, realistic UI mockup" },
    { id: "chart", l: "Chart Meme \uD83D\uDCC8", prompt: "funny chart or graph, data humor, tech satire" },
    { id: "sa-branded", l: "SA Branded \u26A1", prompt: "SemiAnalysis branded, dark theme, amber accents, professional tech" },
  ];

  var handleMemeGenerate = function() {
    var prompt = "";
    if (memeMode === "link" && slopResults && slopResults.image_prompt) {
      prompt = slopResults.image_prompt;
    } else if (memeMode === "idea" && memeIdea.trim()) {
      prompt = memeIdea.trim();
    } else return;

    var styleInfo = MEME_STYLES.find(function(s) { return s.id === memeStyle; });
    var fullPrompt = prompt + ". Style: " + (styleInfo ? styleInfo.prompt : "meme format") + ". Brainrot energy: " + BRAINROT_LEVEL_PROMPTS[brainrotLevel];

    setMemeImgLoading(true);
    setMemeImg(null);
    pickLoadingPhrase();
    fetch("/api/generate-thumbnail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concept: fullPrompt, style: "cinematic" }),
    }).then(function(r) { return r.json(); }).then(function(d) {
      if (d.url) setMemeImg(d.url);
      else if (d.error) setSlopError(d.error);
      setMemeImgLoading(false);
    }).catch(function(e) { setSlopError(String(e)); setMemeImgLoading(false); });
  };

  var handleVideoGenerate = function() {
    var prompt = "";
    if (memeMode === "link" && slopResults && slopResults.image_prompt) {
      prompt = slopResults.image_prompt;
    } else if (memeMode === "idea" && memeIdea.trim()) {
      prompt = memeIdea.trim();
    } else return;

    var styleInfo = MEME_STYLES.find(function(s) { return s.id === memeStyle; });
    var fullPrompt = prompt + ". Style: " + (styleInfo ? styleInfo.prompt : "meme format") + ". Brainrot energy: " + BRAINROT_LEVEL_PROMPTS[brainrotLevel];

    setVideoLoading(true);
    setVideoUrl(null);
    setVideoError(null);
    setVideoStatus("cooking rn...");
    pickLoadingPhrase();

    fetch("/api/generate-clip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate", prompt: fullPrompt, engine: "grok" }),
    }).then(function(r) { return r.json(); }).then(function(d) {
      if (d.video && d.video.url) {
        setVideoUrl(d.video.url);
        setVideoStatus(null);
        setVideoLoading(false);
      } else if (d.task && d.task.task_id) {
        setVideoStatus("still cooking... video submitted");
        var taskId = d.task.task_id;
        var pollInterval = setInterval(function() {
          fetch("/api/generate-clip", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "status", taskId: taskId, engine: "grok" }),
          }).then(function(r2) { return r2.json(); }).then(function(d2) {
            if (d2.video && d2.video.url) {
              setVideoUrl(d2.video.url);
              setVideoStatus(null);
              setVideoLoading(false);
              clearInterval(pollInterval);
            } else if (d2.error) {
              setVideoError(d2.error);
              setVideoLoading(false);
              clearInterval(pollInterval);
            } else {
              setVideoStatus("still cooking... " + (d2.status || d2.progress || ""));
            }
          }).catch(function(e2) {
            setVideoError(String(e2));
            setVideoLoading(false);
            clearInterval(pollInterval);
          });
        }, 5000);
      } else if (d.error) {
        setVideoError(d.error);
        setVideoLoading(false);
      } else {
        setVideoError("Unexpected response format");
        setVideoLoading(false);
      }
    }).catch(function(e) {
      setVideoError(String(e));
      setVideoLoading(false);
    });
  };

  var handlePresetClick = function(presetText) {
    if (memeMode === "idea") {
      setMemeIdea(function(prev) { return prev ? prev + " " + presetText : presetText; });
    }
  };

  // Arxiv queue state
  var _arxivInput = useState(""), arxivInput = _arxivInput[0], setArxivInput = _arxivInput[1];
  var _arxivQueue = useState([]), arxivQueue = _arxivQueue[0], setArxivQueue = _arxivQueue[1];
  var _arxivMsg = useState(null), arxivMsg = _arxivMsg[0], setArxivMsg = _arxivMsg[1];
  var _arxivToast = useState(null), arxivToast = _arxivToast[0], setArxivToast = _arxivToast[1];
  var _arxivReadyCount = useState(0), arxivReadyCount = _arxivReadyCount[0], setArxivReadyCount = _arxivReadyCount[1];

  // Factory state
  var _factoryPhase = useState("idle"), factoryPhase = _factoryPhase[0], setFactoryPhase = _factoryPhase[1];
  var _factoryFormat = useState("lego"), factoryFormat = _factoryFormat[0], setFactoryFormat = _factoryFormat[1];
  var _factoryInput = useState(""), factoryInput = _factoryInput[0], setFactoryInput = _factoryInput[1];
  var _factoryImagePrompt = useState(""), factoryImagePrompt = _factoryImagePrompt[0], setFactoryImagePrompt = _factoryImagePrompt[1];
  var _factoryVideoPrompt = useState(""), factoryVideoPrompt = _factoryVideoPrompt[0], setFactoryVideoPrompt = _factoryVideoPrompt[1];
  var _factoryImageUrl = useState(null), factoryImageUrl = _factoryImageUrl[0], setFactoryImageUrl = _factoryImageUrl[1];
  var _factoryVideoUrl = useState(null), factoryVideoUrl = _factoryVideoUrl[0], setFactoryVideoUrl = _factoryVideoUrl[1];
  var _factoryCredits = useState(0), factoryCredits = _factoryCredits[0], setFactoryCredits = _factoryCredits[1];
  var _factoryError = useState(null), factoryError = _factoryError[0], setFactoryError = _factoryError[1];
  var _factoryPromptEditing = useState(false), factoryPromptEditing = _factoryPromptEditing[0], setFactoryPromptEditing = _factoryPromptEditing[1];
  var _factoryVideoPromptEditing = useState(false), factoryVideoPromptEditing = _factoryVideoPromptEditing[0], setFactoryVideoPromptEditing = _factoryVideoPromptEditing[1];
  var _factoryProgress = useState(0), factoryProgress = _factoryProgress[0], setFactoryProgress = _factoryProgress[1];

  var FACTORY_FORMATS = [
    { id: "lego", label: "Lego World", emoji: "\uD83E\uDDF1", color: "#FFD700", cost: 1,
      placeholder: "A CEO giving a keynote speech...",
      imageSystem: "You are a creative prompt engineer for Grok image generation. The user wants their subject placed in a Lego universe. Write a detailed Grok image prompt (100 words) that transforms the subject into Lego minifigure form in a fully Lego-built environment. Include Lego brick textures, stud details on surfaces, bright primary colors, dramatic Lego lighting. Make it look like an official Lego set box art photo. Include specific Lego details: brick walls, baseplate ground, minifigure proportions with claw hands and C-shaped grip. The scene should be cinematic and high quality.",
      videoSystem: "You are a creative prompt engineer for video generation. The user has an approved Lego-style image. Write a video animation prompt that brings this Lego scene to life with stop-motion style movement, slight wobble of minifigures, bricks clicking into place, smooth camera pan across the Lego diorama. Keep the charming stop-motion aesthetic throughout." },
    { id: "minecraft", label: "Minecraft Day", emoji: "\u26CF\uFE0F", color: "#5B8731", cost: 1,
      placeholder: "A scientist discovering a new element...",
      imageSystem: "You are a creative prompt engineer for Grok image generation. The user wants their subject in a Minecraft block world. Write a detailed Grok image prompt (100 words) that transforms everything into Minecraft voxel art style. Blocky terrain, pixelated textures, 16x16 texture resolution feel, cubic trees and clouds, torch lighting with warm glow, inventory bar at bottom. The subject should be rendered as a Minecraft skin/character in a recognizable biome. Include details like block types, ore veins, crafting elements, and dramatic Minecraft sunset/sunrise lighting.",
      videoSystem: "You are a creative prompt engineer for video generation. The user has an approved Minecraft-style image. Write a video prompt that animates this scene with Minecraft-style movement: blocky walking animations, block-breaking particles, day/night cycle transition, smooth camera rotation around the scene. Include ambient Minecraft sounds description." },
    { id: "subway", label: "Subway Surfers Split", emoji: "\uD83D\uDD79\uFE0F", color: "#FF4500", cost: 1,
      placeholder: "An explanation of quantum computing...",
      imageSystem: "You are a creative prompt engineer for Grok image generation. The user wants a vertical split-screen image: meaningful content on top, Subway Surfers gameplay on the bottom third. Write a detailed Grok image prompt (100 words) for the TOP portion showing the subject in crisp, attention-grabbing style with bold text overlays and bright colors. The bottom third should show a stylized Subway Surfers-inspired endless runner scene with colorful trains, coins, and a running character. The split should look like a TikTok screen recording with the gameplay keeping viewers watching.",
      videoSystem: "You are a creative prompt engineer for video generation. Write a video prompt for a vertical split-screen: the top shows the main content with text animations and transitions, while the bottom third has endless runner gameplay with a character dodging trains and collecting coins. Fast-paced, ADHD-optimized visual flow." },
    { id: "npc", label: "NPC Skit", emoji: "\uD83E\uDD16", color: "#00BFFF", cost: 1,
      placeholder: "A tech CEO announcing layoffs...",
      imageSystem: "You are a creative prompt engineer for Grok image generation. The user wants their subject as an RPG NPC with game UI overlay. Write a detailed Grok image prompt (100 words) showing the subject as a video game NPC with a dialogue box at the bottom, health bar, quest marker floating above their head, inventory slots visible. Style it like a mix of Skyrim and retro JRPG aesthetics. Include XP counter, minimap in corner, quest log notification. The character should have slightly robotic NPC energy with that classic thousand-yard NPC stare. Add pixel art UI elements and a glowing interaction prompt.",
      videoSystem: "You are a creative prompt engineer for video generation. Write a video prompt showing this NPC scene coming to life: the character does a subtle idle animation loop, dialogue text types out letter by letter, UI elements pulse and animate, quest marker bobs up and down. Camera slowly zooms in as if the player is approaching the NPC." },
    { id: "sigma", label: "Sigma Grindset", emoji: "\uD83E\uDD85", color: "#C0A060", cost: 1,
      placeholder: "Waking up at 4am to code...",
      imageSystem: "You are a creative prompt engineer for Grok image generation. The user wants a cinematic lone wolf sigma aesthetic. Write a detailed Grok image prompt (100 words) showing the subject in ultra-cinematic, desaturated teal-and-orange color grading. Dramatic backlit silhouette, rain or city lights in background, stoic expression. Add motivational text overlay in bold sans-serif font. Think Patrick Bateman meets hustle culture. Include lens flare, shallow depth of field, and that specific sigma male energy of someone who chose this path. Dark, moody, but powerful. The composition should scream 'different breed'.",
      videoSystem: "You are a creative prompt engineer for video generation. Write a video prompt for a sigma grindset edit: slow-motion walk with dramatic music cues, camera orbiting the subject, text overlays appearing with impact, desaturated color that shifts to full color at the climax. Cinematic letterbox bars, lens flares tracking across frame." },
    { id: "ghibli", label: "Ghibli Day", emoji: "\uD83C\uDF3F", color: "#88C070", cost: 1,
      placeholder: "A programmer debugging at midnight...",
      imageSystem: "You are a creative prompt engineer for Grok image generation. The user wants their subject in Studio Ghibli animated style. Write a detailed Grok image prompt (100 words) that transforms the scene into a Hayao Miyazaki film frame. Soft watercolor backgrounds, gentle lighting with visible light rays, lush green nature elements, puffy cumulus clouds, warm nostalgic color palette. The subject should look like a Ghibli protagonist with large expressive eyes and simple but emotive features. Include signature Ghibli details: detailed food, cozy interiors, magical floating elements, and that specific peaceful-yet-wondrous atmosphere. Hand-painted texture throughout.",
      videoSystem: "You are a creative prompt engineer for video generation. Write a video prompt that animates this Ghibli scene with gentle wind blowing through hair and grass, soft camera pan across a detailed landscape, magical particles floating in sunbeams, smooth character animation with Ghibli-style expressiveness. Peaceful, contemplative movement." },
    { id: "lore", label: "Lore Drop", emoji: "\uD83D\uDCDC", color: "#DAA520", cost: 1,
      placeholder: "The real reason GPU prices are rising...",
      imageSystem: "You are a creative prompt engineer for Grok image generation. The user wants their subject presented as ancient lore or prophecy. Write a detailed Grok image prompt (100 words) showing the subject as if it were an ancient manuscript discovery, illuminated manuscript style with gold leaf borders, aged parchment texture, medieval illustrations, mysterious symbols and runes. Include a dramatic aged paper texture, wax seal, quill marks, and the content presented as a sacred text or prophecy scroll. Mix ancient aesthetic with the modern subject for comedic contrast. Dark academia meets shitpost energy.",
      videoSystem: "You are a creative prompt engineer for video generation. Write a video prompt showing this ancient scroll being dramatically unrolled, camera slowly panning across illuminated text that glows, dust particles floating in candlelight, mysterious chanting ambiance, zoom into key prophecy text with dramatic reveal timing." },
    { id: "brainrot_news", label: "Brain Rot News", emoji: "\uD83D\uDCFA", color: "#FF0000", cost: 1,
      placeholder: "Scientists discover new form of matter...",
      imageSystem: "You are a creative prompt engineer for Grok image generation. The user wants a breaking news broadcast aesthetic. Write a detailed Grok image prompt (100 words) showing the subject as a BREAKING NEWS broadcast: red and white news lower third banner, dramatic headline text, news anchor desk composition, live feed camera angle, 'BREAKING' and 'LIVE' badges, scrolling ticker at bottom, channel logo in corner. Make it look like a legitimate but absurd news broadcast. Include dramatic news lighting, teleprompter reflection in eyes, and that specific cable news urgency energy. The content should look like it interrupted regular programming.",
      videoSystem: "You are a creative prompt engineer for video generation. Write a video prompt for a breaking news broadcast: camera shake as if something big just happened, news ticker scrolling, BREAKING NEWS banner animating in, dramatic zoom on the anchor, graphics flying in from sides. Fast cuts between angles, live feed static glitches." },
  ];

  var factoryAsk = function(systemPrompt, userPrompt) {
    return fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: systemPrompt, prompt: userPrompt }),
    }).then(function(r) { return r.json(); }).then(function(d) {
      if (d.error) throw new Error(d.error.message || d.error || "API ERROR");
      var text = (d.content || []).map(function(c) { return c.text || ""; }).join("");
      if (!text && d.text) text = d.text;
      if (!text && typeof d === "string") text = d;
      if (!text) throw new Error("THE MACHINE RETURNED NOTHING. TRY AGAIN.");
      return text;
    });
  };

  var handleFactoryCraftPrompt = function() {
    if (!factoryInput.trim()) return;
    var fmt = FACTORY_FORMATS.find(function(f) { return f.id === factoryFormat; });
    if (!fmt) return;
    setFactoryPhase("crafting");
    setFactoryError(null);
    setFactoryImagePrompt("");
    setFactoryPromptEditing(false);
    factoryAsk(fmt.imageSystem, factoryInput.trim()).then(function(text) {
      setFactoryImagePrompt(text);
      setFactoryPhase("image_ready");
    }).catch(function(e) {
      setFactoryError(String(e.message || e));
      setFactoryPhase("error");
    });
  };

  var handleFactoryGenerateImage = function() {
    if (!factoryImagePrompt.trim()) return;
    setFactoryPhase("image_generating");
    setFactoryError(null);
    setFactoryImageUrl(null);
    setFactoryProgress(0);
    var progInterval = setInterval(function() {
      setFactoryProgress(function(p) { return p < 90 ? p + Math.random() * 8 : p; });
    }, 400);
    fetch("/api/generate-thumbnail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concept: factoryImagePrompt, style: "cinematic" }),
    }).then(function(r) { return r.json(); }).then(function(d) {
      clearInterval(progInterval);
      setFactoryProgress(100);
      if (d.url) {
        setFactoryImageUrl(d.url);
        setFactoryCredits(function(c) { return c + 1; });
        setFactoryPhase("image_ready");
      } else {
        setFactoryError(d.error || "THE MACHINE RETURNED NOTHING. TRY AGAIN.");
        setFactoryPhase("error");
      }
    }).catch(function(e) {
      clearInterval(progInterval);
      setFactoryError("CONNECTION LOST. CHECK YOUR SIGNAL.");
      setFactoryPhase("error");
    });
  };

  var handleFactoryVideoConfirm = function() {
    setFactoryPhase("video_crafting");
    setFactoryError(null);
    setFactoryVideoPrompt("");
    setFactoryVideoPromptEditing(false);
    var fmt = FACTORY_FORMATS.find(function(f) { return f.id === factoryFormat; });
    if (!fmt) return;
    var combined = "The user described: " + factoryInput + "\n\nThe approved image prompt was: " + factoryImagePrompt + "\n\nNow write the video animation prompt.";
    factoryAsk(fmt.videoSystem, combined).then(function(text) {
      setFactoryVideoPrompt(text);
      setFactoryPhase("video_ready");
    }).catch(function(e) {
      setFactoryError(String(e.message || e));
      setFactoryPhase("error");
    });
  };

  var handleFactoryGenerateVideo = function() {
    if (!factoryVideoPrompt.trim()) return;
    setFactoryPhase("video_generating");
    setFactoryError(null);
    setFactoryVideoUrl(null);
    setFactoryProgress(0);
    var progInterval = setInterval(function() {
      setFactoryProgress(function(p) { return p < 85 ? p + Math.random() * 5 : p; });
    }, 600);
    fetch("/api/generate-clip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate", prompt: factoryVideoPrompt, engine: "grok" }),
    }).then(function(r) { return r.json(); }).then(function(d) {
      if (d.video && d.video.url) {
        clearInterval(progInterval);
        setFactoryProgress(100);
        setFactoryVideoUrl(d.video.url);
        setFactoryCredits(function(c) { return c + 3; });
        setFactoryPhase("video_done");
      } else if (d.task && d.task.task_id) {
        var factoryTaskId = d.task.task_id;
        var pollInterval = setInterval(function() {
          fetch("/api/generate-clip", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "status", taskId: factoryTaskId, engine: "grok" }),
          }).then(function(r2) { return r2.json(); }).then(function(d2) {
            if (d2.video && d2.video.url) {
              clearInterval(progInterval);
              clearInterval(pollInterval);
              setFactoryProgress(100);
              setFactoryVideoUrl(d2.video.url);
              setFactoryCredits(function(c) { return c + 3; });
              setFactoryPhase("video_done");
            } else if (d2.error) {
              clearInterval(progInterval);
              clearInterval(pollInterval);
              setFactoryError(d2.error);
              setFactoryPhase("error");
            }
          }).catch(function() {
            clearInterval(progInterval);
            clearInterval(pollInterval);
            setFactoryError("CONNECTION LOST. CHECK YOUR SIGNAL.");
            setFactoryPhase("error");
          });
        }, 5000);
      } else if (d.error) {
        clearInterval(progInterval);
        setFactoryError(d.error);
        setFactoryPhase("error");
      } else {
        clearInterval(progInterval);
        setFactoryError("THE MACHINE RETURNED NOTHING. TRY AGAIN.");
        setFactoryPhase("error");
      }
    }).catch(function(e) {
      clearInterval(progInterval);
      setFactoryError("CONNECTION LOST. CHECK YOUR SIGNAL.");
      setFactoryPhase("error");
    });
  };

  var handleFactoryReset = function() {
    setFactoryPhase("idle");
    setFactoryInput("");
    setFactoryImagePrompt("");
    setFactoryVideoPrompt("");
    setFactoryImageUrl(null);
    setFactoryVideoUrl(null);
    setFactoryError(null);
    setFactoryPromptEditing(false);
    setFactoryVideoPromptEditing(false);
    setFactoryProgress(0);
  };

  var factoryProgressBar = function(pct) {
    var filled = Math.floor(pct / 5);
    var empty = 20 - filled;
    var bar = "";
    for (var i = 0; i < filled; i++) bar += "\u2588";
    for (var j = 0; j < empty; j++) bar += "\u2591";
    return bar + " " + Math.floor(pct) + "%";
  };

  // Load arxiv queue from localStorage on mount
  useEffect(function() {
    try {
      var stored = localStorage.getItem("sloptop-arxiv-queue");
      if (stored) {
        var parsed = JSON.parse(stored);
        setArxivQueue(parsed);
        var rc = parsed.filter(function(j) { return j.status === "ready"; }).length;
        setArxivReadyCount(rc);
      }
    } catch (e) { /* ignore */ }
  }, []);

  // Save arxiv queue to localStorage on change
  useEffect(function() {
    if (arxivQueue.length > 0) {
      try { localStorage.setItem("sloptop-arxiv-queue", JSON.stringify(arxivQueue)); } catch (e) { /* ignore */ }
    } else {
      try { localStorage.removeItem("sloptop-arxiv-queue"); } catch (e) { /* ignore */ }
    }
    var rc = arxivQueue.filter(function(j) { return j.status === "ready"; }).length;
    setArxivReadyCount(rc);
  }, [arxivQueue]);

  // Polling: every 60s, check processing jobs
  useEffect(function() {
    var interval = setInterval(function() {
      setArxivQueue(function(prev) {
        var processing = prev.filter(function(j) { return j.status === "processing"; });
        if (processing.length === 0) return prev;
        processing.forEach(function(job) {
          fetch("/api/arxiv-check?paperId=" + encodeURIComponent(job.paperId))
            .then(function(r) { return r.json(); })
            .then(function(data) {
              if (data.ready) {
                setArxivQueue(function(curr) {
                  return curr.map(function(j) {
                    if (j.paperId === job.paperId && j.status === "processing") {
                      return Object.assign({}, j, { status: "ready", title: data.title || j.title });
                    }
                    return j;
                  });
                });
                setArxivToast("Your arxiv slop is ready! Paper " + job.paperId);
                setTimeout(function() { setArxivToast(null); }, 8000);
              }
            })
            .catch(function() { /* ignore polling errors */ });
        });
        return prev;
      });
    }, 60000);
    return function() { clearInterval(interval); };
  }, []);

  function extractPaperId(input) {
    var trimmed = input.trim();
    // Strip common arxiv URL prefixes
    var prefixes = ["https://arxiv.org/abs/", "http://arxiv.org/abs/", "https://arxiv.org/pdf/", "http://arxiv.org/pdf/", "https://arxiv.lol/", "http://arxiv.lol/"];
    for (var i = 0; i < prefixes.length; i++) {
      if (trimmed.startsWith(prefixes[i])) {
        trimmed = trimmed.slice(prefixes[i].length);
        break;
      }
    }
    // Remove trailing .pdf or slashes
    trimmed = trimmed.replace(/\.pdf$/, "").replace(/\/$/, "");
    return trimmed;
  }

  function handleArxivSubmit() {
    if (!arxivInput.trim()) return;
    var paperId = extractPaperId(arxivInput);
    if (!paperId) return;

    // Open the arxiv.lol page in a new tab
    window.open("https://arxiv.lol/" + paperId, "_blank");

    // Add to queue
    var newJob = {
      paperId: paperId,
      status: "processing",
      submittedAt: Date.now(),
      title: null,
    };
    setArxivQueue(function(prev) { return [newJob].concat(prev); });
    setArxivInput("");
    setArxivMsg("Submitted! arxiv.lol takes 5-10 minutes to generate. We'll check automatically.");
    setTimeout(function() { setArxivMsg(null); }, 10000);
  }

  function handleArxivRemove(paperId) {
    setArxivQueue(function(prev) { return prev.filter(function(j) { return j.paperId !== paperId; }); });
  }

  function handleArxivCheckNow(paperId) {
    window.open("https://arxiv.lol/" + paperId, "_blank");
  }

  function getTimeAgo(ts) {
    var diff = Date.now() - ts;
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins === 1) return "1 min ago";
    if (mins < 60) return mins + " min ago";
    var hrs = Math.floor(mins / 60);
    if (hrs === 1) return "1 hr ago";
    return hrs + " hrs ago";
  }

  var TABS = [
    { id: "meme", l: "Meme Maker \uD83D\uDC80" },
    { id: "brief", l: "Brief Generator \uD83D\uDCCB" },
    { id: "arxiv", l: "arxiv.lol \uD83D\uDCC4", ic: "" },
    { id: "factory", l: "FACTORY \u2699", ic: "" },
  ];

  // ═══ GLOBAL ANIMATIONS ═══
  var globalStyles = [
    "@keyframes slopSpin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}",
    "@keyframes slopPulse{0%,100%{opacity:0.3}50%{opacity:1}}",
    "@keyframes rainbowShimmer{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}",
    "@keyframes glowPulse{0%,100%{box-shadow:0 0 5px rgba(247,176,65,0.3),0 0 10px rgba(247,176,65,0.1)}50%{box-shadow:0 0 20px rgba(247,176,65,0.6),0 0 40px rgba(247,176,65,0.3),0 0 60px rgba(144,92,203,0.2)}}",
    "@keyframes textGlow{0%,100%{text-shadow:0 0 10px rgba(247,176,65,0.5)}50%{text-shadow:0 0 20px rgba(247,176,65,0.8),0 0 40px rgba(144,92,203,0.4)}}",
    "@keyframes floatEmoji{0%,100%{transform:translateY(0px) rotate(0deg)}25%{transform:translateY(-3px) rotate(5deg)}75%{transform:translateY(3px) rotate(-5deg)}}",
    "@keyframes phraseSlide{0%{opacity:0;transform:translateY(10px)}10%{opacity:1;transform:translateY(0)}90%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-10px)}}",
    "@keyframes gradientText{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}",
    "@keyframes buttonGlow{0%,100%{box-shadow:0 4px 20px rgba(247,176,65,0.25)}50%{box-shadow:0 4px 30px rgba(247,176,65,0.5),0 0 60px rgba(144,92,203,0.3)}}",
    "@keyframes neonFlicker{0%,100%{opacity:1}92%{opacity:1}93%{opacity:0.8}94%{opacity:1}96%{opacity:0.9}97%{opacity:1}}",
    "@keyframes successPop{0%{transform:scale(0.8);opacity:0}50%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}",
    "@keyframes italianShimmer{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}",
    "@keyframes brainrotPulse{0%,100%{opacity:0.4;transform:scale(1)}50%{opacity:0.8;transform:scale(1.01)}}",
    "@keyframes cursedPulse{0%,100%{box-shadow:0 0 8px rgba(224,99,71,0.1)}50%{box-shadow:0 0 24px rgba(224,99,71,0.3),0 0 48px rgba(144,92,203,0.2)}}",
    "@keyframes sliderThumbPulse{0%,100%{transform:scale(1);box-shadow:0 0 6px rgba(247,176,65,0.5)}50%{transform:scale(1.15);box-shadow:0 0 16px rgba(247,176,65,0.9),0 0 32px rgba(144,92,203,0.5)}}",
    "@keyframes level10Pulse{0%,100%{background-color:rgba(224,99,71,0.02)}50%{background-color:rgba(224,99,71,0.06)}}",
    "input[type=range].brainrot-slider{-webkit-appearance:none;appearance:none;width:100%;height:8px;border-radius:4px;background:linear-gradient(90deg,#2EAD8E,#F7B041,#E06347,#905CCB,#FF00FF,#00BFFF,#FF6347,#C471ED,#12FFF7,#FF6B9D);outline:none;opacity:0.9;transition:opacity 0.2s}",
    "input[type=range].brainrot-slider:hover{opacity:1}",
    "input[type=range].brainrot-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#F7B041,#E06347);cursor:pointer;border:2px solid #fff;animation:sliderThumbPulse 1.5s ease-in-out infinite}",
    "input[type=range].brainrot-slider::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#F7B041,#E06347);cursor:pointer;border:2px solid #fff;animation:sliderThumbPulse 1.5s ease-in-out infinite}",
    "@keyframes amberPulse{0%,100%{opacity:0.6;box-shadow:0 0 4px rgba(247,176,65,0.3)}50%{opacity:1;box-shadow:0 0 12px rgba(247,176,65,0.6)}}",
    "@keyframes greenGlow{0%,100%{box-shadow:0 0 8px rgba(46,173,142,0.2)}50%{box-shadow:0 0 20px rgba(46,173,142,0.5),0 0 40px rgba(46,173,142,0.2)}}",
    "@keyframes toastSlide{0%{transform:translateY(-20px);opacity:0}10%{transform:translateY(0);opacity:1}90%{transform:translateY(0);opacity:1}100%{transform:translateY(-20px);opacity:0}}",
    "@keyframes paperFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}",
    "@keyframes readyBounce{0%{transform:scale(1)}50%{transform:scale(1.05)}100%{transform:scale(1)}}",
    "@keyframes factoryGlitch{0%,100%{text-shadow:2px 0 #ff0040,-2px 0 #00ffff}25%{text-shadow:-2px 0 #ff0040,2px 0 #00ffff}50%{text-shadow:4px 0 #ff0040,-4px 0 #00ffff}75%{text-shadow:-4px 0 #ff0040,0 0 #00ffff}}",
    "@keyframes factoryCrt{0%,100%{opacity:1}92%{opacity:1}93%{opacity:0.85}94%{opacity:1}96%{opacity:0.9}97%{opacity:1}}",
    "@keyframes factoryBlink{0%,100%{opacity:1}50%{opacity:0}}",
    "@keyframes factoryScanline{0%{background-position:0 0}100%{background-position:0 4px}}",
  ].join("\n");

  return <div style={{
    minHeight: "100vh", background: D.bg, padding: "32px 40px",
    fontFamily: ft, color: D.tx,
  }}>
    <style dangerouslySetInnerHTML={{ __html: globalStyles }} />

    {/* ═══ HEADER ═══ */}
    <div style={{
      marginBottom: 24, padding: "24px 28px", borderRadius: 16,
      background: "linear-gradient(135deg, rgba(247,176,65,0.08), rgba(144,92,203,0.06), rgba(38,201,216,0.04), rgba(247,176,65,0.08))",
      backgroundSize: "300% 300%",
      animation: "rainbowShimmer 8s ease infinite",
      border: "1px solid rgba(247,176,65,0.15)",
      position: "relative", overflow: "hidden",
    }}>
      {/* Shimmer overlay */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.02), transparent)",
        backgroundSize: "200% 100%",
        animation: "rainbowShimmer 4s linear infinite",
        pointerEvents: "none",
      }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              fontFamily: ft, fontSize: 32, fontWeight: 900, letterSpacing: -1,
              background: "linear-gradient(135deg, " + D.amber + ", " + D.violet + ", " + D.cyan + ", " + D.amber + ")",
              backgroundSize: "300% 300%",
              animation: "gradientText 4s ease infinite",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>SLOP TOP</div>
            <span style={{
              fontSize: 28,
              animation: "floatEmoji 2s ease-in-out infinite",
              display: "inline-block",
            }}>{ROTATING_EMOJIS[emojiIdx]}</span>
          </div>
          <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, marginTop: 4, letterSpacing: 1 }}>
            certified brainrot factory // making slop since birth
          </div>
          <div style={{
            fontFamily: ft, fontSize: 12, fontWeight: 600, marginTop: 8,
            color: D.violet, letterSpacing: 0.5,
            animation: "phraseSlide 3s ease-in-out infinite",
            minHeight: 18,
          }}>
            {ROTATING_PHRASES[phraseIdx]}
          </div>
        </div>
      </div>
    </div>

    {/* ═══ TOAST NOTIFICATION ═══ */}
    {arxivToast && <div style={{
      position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 9999,
      padding: "14px 28px", borderRadius: 12,
      background: "linear-gradient(135deg, " + D.teal + "20, " + D.card + "F0)",
      border: "1px solid " + D.teal + "60",
      boxShadow: "0 8px 32px rgba(46,173,142,0.3), 0 0 60px rgba(46,173,142,0.1)",
      fontFamily: ft, fontSize: 14, fontWeight: 700, color: D.teal,
      animation: "toastSlide 8s ease-in-out forwards",
      display: "flex", alignItems: "center", gap: 10,
      backdropFilter: "blur(12px)",
    }}>
      <span style={{ fontSize: 20 }}>{"\uD83D\uDCC4"}</span>
      {arxivToast}
      <span onClick={function() { setArxivToast(null); }} style={{ cursor: "pointer", marginLeft: 8, color: D.txm, fontSize: 16 }}>{"\u2715"}</span>
    </div>}

    {/* ═══ TABS ═══ */}
    <div style={{ display: "flex", gap: 0, marginBottom: 28, borderBottom: "1px solid " + D.border }}>
      {TABS.map(function(t) {
        var on = tab === t.id;
        var isMemeMaker = t.id === "meme";
        var isArxiv = t.id === "arxiv";
        return <div key={t.id} onClick={function() { setTab(t.id); }} style={{
          padding: "12px 24px", cursor: "pointer", fontFamily: ft, fontSize: 14, fontWeight: on ? 800 : 500,
          color: on ? D.amber : D.txm, borderBottom: on ? "2px solid " + D.amber : "2px solid transparent",
          transition: "all 0.2s", display: "flex", alignItems: "center", gap: 6,
          background: on && isMemeMaker ? "linear-gradient(135deg, rgba(247,176,65,0.05), transparent)" : "transparent",
          position: "relative",
        }}>
          {isMemeMaker && on ? <span style={{
            background: "linear-gradient(135deg, " + D.amber + ", " + D.violet + ")",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            fontWeight: 900,
          }}>{t.l}</span> : t.l}
          {isArxiv && arxivReadyCount > 0 && <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginLeft: 6, padding: "2px 8px", borderRadius: 10,
            background: D.teal + "20", border: "1px solid " + D.teal + "50",
            fontFamily: mn, fontSize: 9, fontWeight: 800, color: D.teal,
            animation: "readyBounce 2s ease-in-out infinite",
          }}>{arxivReadyCount + " ready"}</span>}
        </div>;
      })}
    </div>

    {/* ═══ TAB: MEME MAKER ═══ */}
    {tab === "meme" && <div style={{
      animation: brainrotLevel >= 10 ? "level10Pulse 2.5s ease-in-out infinite" : "none",
      borderRadius: 16, padding: brainrotLevel >= 10 ? 4 : 0,
      transition: "all 0.3s",
    }}>
      {/* Mode toggle: Link to Slop / Idea to Meme */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        <div onClick={function() { setMemeMode("link"); }} style={{
          flex: 1, padding: "16px 20px", borderRadius: 12, cursor: "pointer",
          background: memeMode === "link" ? D.amber + "10" : D.card,
          border: "1px solid " + (memeMode === "link" ? D.amber + "40" : D.border),
          transition: "all 0.2s",
        }}>
          <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 700, color: memeMode === "link" ? D.amber : D.tx }}>Link to Slop \uD83D\uDD17</div>
          <div style={{ fontFamily: ft, fontSize: 11, color: D.txm, marginTop: 2 }}>Paste a URL, get meme content + image</div>
        </div>
        <div onClick={function() { setMemeMode("idea"); }} style={{
          flex: 1, padding: "16px 20px", borderRadius: 12, cursor: "pointer",
          background: memeMode === "idea" ? D.violet + "10" : D.card,
          border: "1px solid " + (memeMode === "idea" ? D.violet + "40" : D.border),
          transition: "all 0.2s",
        }}>
          <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 700, color: memeMode === "idea" ? D.violet : D.tx }}>Idea to Meme \uD83E\uDDE0</div>
          <div style={{ fontFamily: ft, fontSize: 11, color: D.txm, marginTop: 2 }}>Describe an idea, generate a meme image directly</div>
        </div>
      </div>

      {/* ═══ BRAINROT PRESETS ═══ */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: mn, fontSize: 10, color: D.cyan, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <span>{"\uD83E\uDDE0"}</span> Brainrot Presets <span style={{ fontSize: 8, color: D.txd }}>(click to add to prompt)</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {BRAINROT_PRESETS.map(function(preset, idx) {
            var hue = NEON_HUES[idx % NEON_HUES.length];
            return <button key={idx} onClick={function() { handlePresetClick(preset.text); }} style={{
              padding: "6px 14px", borderRadius: 20, cursor: "pointer",
              background: hue + "12", border: "1px solid " + hue + "40",
              color: hue, fontFamily: ft, fontSize: 11, fontWeight: 600,
              transition: "all 0.2s", animation: "neonFlicker 3s ease-in-out infinite",
              animationDelay: (idx * 0.2) + "s",
              whiteSpace: "nowrap",
            }}>{preset.label}</button>;
          })}
        </div>

        {/* Italian Brainrot Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0 12px" }}>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #009246, #fff, #CE2B37)" }} />
          <span style={{
            fontFamily: ft, fontSize: 12, fontWeight: 900, letterSpacing: 2,
            background: "linear-gradient(90deg, #009246, #ffffff, #CE2B37)",
            backgroundSize: "200% 200%",
            animation: "italianShimmer 3s ease infinite",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            whiteSpace: "nowrap",
          }}>{"ITALIAN BRAINROT \uD83C\uDDEE\uD83C\uDDF9\uD83D\uDC0A"}</span>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #CE2B37, #fff, #009246)" }} />
        </div>

        {/* Italian Brainrot Presets */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {ITALIAN_BRAINROT_PRESETS.map(function(preset, idx) {
            var italianColors = ["#009246", "#CE2B37", "#009246", "#CE2B37", "#009246", "#CE2B37"];
            var ic = italianColors[idx % italianColors.length];
            return <button key={"it-" + idx} onClick={function() { handlePresetClick(preset.text); }} style={{
              padding: "6px 14px", borderRadius: 20, cursor: "pointer",
              background: "linear-gradient(135deg, rgba(0,146,70,0.10), rgba(255,255,255,0.03), rgba(206,43,55,0.10))",
              backgroundSize: "200% 200%",
              border: "1px solid " + ic + "60",
              color: "#E8E4DD",
              fontFamily: ft, fontSize: 11, fontWeight: 700,
              transition: "all 0.2s",
              animation: "neonFlicker 3s ease-in-out infinite",
              animationDelay: (idx * 0.15) + "s",
              whiteSpace: "nowrap",
              position: "relative",
              boxShadow: "0 0 8px " + ic + "20, inset 0 0 12px rgba(0,146,70,0.06), inset 0 0 12px rgba(206,43,55,0.06)",
              textShadow: "0 0 8px " + ic + "40",
            }}>{preset.label}</button>;
          })}
        </div>
      </div>

      {/* ═══ BRAINROT LEVEL SLIDER ═══ */}
      <div style={{
        marginBottom: 24, padding: "20px 24px", borderRadius: 12,
        background: brainrotLevel >= 10
          ? "linear-gradient(135deg, rgba(224,99,71,0.08), rgba(144,92,203,0.06), rgba(224,99,71,0.08))"
          : brainrotLevel >= 7
          ? "linear-gradient(135deg, rgba(224,99,71,0.05), rgba(144,92,203,0.04))"
          : "linear-gradient(135deg, rgba(46,173,142,0.04), rgba(247,176,65,0.04))",
        border: "1px solid " + (brainrotLevel >= 7 ? D.coral + "30" : D.border),
        animation: brainrotLevel >= 10
          ? "cursedPulse 1.5s ease-in-out infinite"
          : brainrotLevel >= 7
          ? "cursedPulse 3s ease-in-out infinite"
          : "none",
        transition: "all 0.3s",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontFamily: mn, fontSize: 10, color: brainrotLevel >= 7 ? D.coral : D.amber, letterSpacing: 2, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
            <span>{brainrotLevel >= 7 ? "\uD83D\uDC80" : brainrotLevel >= 4 ? "\uD83E\uDDE0" : "\uD83D\uDE36"}</span>{" Brainrot Level"}
          </div>
          <div style={{
            fontFamily: ft, fontSize: 16, fontWeight: 900,
            color: brainrotLevel >= 10 ? D.coral : brainrotLevel >= 7 ? "#FF6B9D" : brainrotLevel >= 4 ? D.amber : D.teal,
            animation: brainrotLevel >= 7 ? "textGlow 1.5s ease-in-out infinite" : "none",
            textTransform: "uppercase",
            letterSpacing: 1,
          }}>
            {brainrotLevel} / 10 — {BRAINROT_LEVEL_LABELS[brainrotLevel]}
          </div>
        </div>
        <input
          type="range"
          className="brainrot-slider"
          min={1}
          max={10}
          value={brainrotLevel}
          onChange={function(e) { setBrainrotLevel(Number(e.target.value)); }}
          style={{ width: "100%", marginBottom: 8 }}
        />
        <div style={{
          fontFamily: mn, fontSize: 9, color: brainrotLevel >= 7 ? D.coral + "CC" : D.txd,
          textAlign: "center", marginTop: 4,
          animation: brainrotLevel >= 8 ? "slopPulse 2s ease-in-out infinite" : "none",
        }}>
          {brainrotLevel <= 3 ? "// mildly unhinged, a little weird"
          : brainrotLevel <= 6 ? "// definitely brainrotted, cursed energy"
          : brainrotLevel <= 9 ? "// MAXIMUM BRAINROT, COMPLETELY UNHINGED"
          : "// PEAK BRAIN DAMAGE. THIS SHOULD NOT EXIST. BOMBARDINO CORE."}
        </div>
      </div>

      {/* Link to Meme mode */}
      {memeMode === "link" && <div>
        {/* Link input */}
        <div style={{
          background: "linear-gradient(135deg, " + D.amber + "08, " + D.card + ", " + D.violet + "06)",
          border: "1px solid " + D.amber + "25", borderRadius: 12, padding: 28, marginBottom: 24,
        }}>
          <div style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <span>{"\uD83D\uDD17"}</span>{" Paste Link "}<span style={{ color: D.txd, fontSize: 8, textTransform: "none" }}>// drop the url bro</span>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <input type="text" value={slopUrl} onChange={function(e) { setSlopUrl(e.target.value); }} onKeyDown={function(e) { if (e.key === "Enter") handleSlopGenerate(); }} placeholder="Paste any link to get slop..." style={{
              flex: 1, padding: "14px 20px", borderRadius: 10, background: D.surface, border: "2px solid " + D.border,
              color: D.tx, fontFamily: ft, fontSize: 15, outline: "none", boxSizing: "border-box", transition: "border 0.2s",
            }} onFocus={function(e) { e.target.style.borderColor = D.amber; }} onBlur={function(e) { e.target.style.borderColor = D.border; }} />
            <button onClick={handleSlopGenerate} disabled={slopLoading || !slopUrl.trim()} style={{
              padding: "14px 28px", borderRadius: 10, border: "none", cursor: slopLoading || !slopUrl.trim() ? "not-allowed" : "pointer",
              background: !slopUrl.trim() ? D.border : "linear-gradient(135deg, " + D.amber + ", #E09520)",
              color: D.bg, fontFamily: ft, fontSize: 14, fontWeight: 800, opacity: !slopUrl.trim() ? 0.4 : 1, flexShrink: 0,
              boxShadow: slopUrl.trim() && !slopLoading ? "0 4px 16px " + D.amber + "30" : "none",
              animation: slopUrl.trim() && !slopLoading ? "buttonGlow 2s ease-in-out infinite" : "none",
            }}>{slopLoading ? "\uD83D\uDD25 " + loadingPhrase : "Generate Slop \uD83D\uDC80"}</button>
          </div>
          {slopError && <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: D.coral + "12", border: "1px solid " + D.coral + "30", fontFamily: mn, fontSize: 11, color: D.coral }}>{slopError}</div>}
        </div>

        {/* Slop results */}
        {slopLoading && <div style={{ padding: 40, textAlign: "center", background: D.card, borderRadius: 12, border: "1px solid " + D.border, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 16 }}>{[0, 1, 2].map(function(i) { return <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: D.amber, animation: "slopPulse 1.4s ease-in-out infinite", animationDelay: i * 0.2 + "s" }} />; })}</div>
          <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 600, color: D.txm }}>{loadingPhrase}</div>
        </div>}

        {slopResults && <div style={{ marginBottom: 24, animation: "successPop 0.4s ease-out" }}>
          <div style={{ fontFamily: ft, fontSize: 12, fontWeight: 700, color: D.teal, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            {SUCCESS_MESSAGES[Math.floor(Math.random() * SUCCESS_MESSAGES.length)]}
          </div>
          {/* Meme Captions */}
          {slopResults.meme_captions && slopResults.meme_captions.length > 0 && <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: mn, fontSize: 10, fontWeight: 700, color: D.amber, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>{"\uD83D\uDC80 Meme Captions"}</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>{slopResults.meme_captions.map(function(cap, i) { return <SlopCard key={i} title={"Caption " + (i + 1)} content={cap} />; })}</div>
          </div>}
          {/* Video Hooks */}
          {slopResults.video_hooks && slopResults.video_hooks.length > 0 && <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: mn, fontSize: 10, fontWeight: 700, color: D.cyan, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>{"\u26A1 Video Hooks"}</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>{slopResults.video_hooks.map(function(hook, i) { return <SlopCard key={i} title={"Hook " + (i + 1)} content={hook} />; })}</div>
          </div>}
          {/* Thread Idea */}
          {slopResults.thread_idea && <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: mn, fontSize: 10, fontWeight: 700, color: D.violet, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>{"\uD83E\uDDE0 Thread Idea"}</div>
            <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 12, padding: 18 }}>
              {(Array.isArray(slopResults.thread_idea) ? slopResults.thread_idea : [slopResults.thread_idea]).map(function(post, i) {
                return <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, background: D.violet + "20", border: "1px solid " + D.violet + "40", color: D.violet, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mn, fontSize: 9, fontWeight: 800 }}>{i + 1}</div>
                  <div style={{ fontFamily: ft, fontSize: 13, color: D.tx, lineHeight: 1.6 }}>{post}</div>
                </div>;
              })}
            </div>
          </div>}
          {/* Image Prompt */}
          {slopResults.image_prompt && <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: mn, fontSize: 10, fontWeight: 700, color: D.teal, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>{"\uD83D\uDD25 Image Prompt"}</div>
            <SlopCard content={slopResults.image_prompt} />
          </div>}
        </div>}
      </div>}

      {/* Idea to Meme mode */}
      {memeMode === "idea" && <div style={{
        background: "linear-gradient(135deg, " + D.violet + "08, " + D.card + ", " + D.cyan + "06)",
        border: "1px solid " + D.violet + "25", borderRadius: 12, padding: 28, marginBottom: 24,
      }}>
        <div style={{ fontFamily: mn, fontSize: 10, color: D.violet, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <span>{"\uD83D\uDE24"}</span>{" What's the prompt bro "}<span style={{ color: D.txd, fontSize: 8, textTransform: "none" }}>// describe your masterpiece</span>
        </div>
        <textarea value={memeIdea} onChange={function(e) { setMemeIdea(e.target.value); }} placeholder="e.g. Jensen Huang holding a GPU like it's the holy grail, NVIDIA cathedral lighting... \uD83D\uDD25" rows={4} style={{
          width: "100%", padding: "14px 16px", borderRadius: 10, background: D.surface, border: "1px solid " + D.border,
          color: D.tx, fontFamily: ft, fontSize: 14, lineHeight: 1.6, resize: "vertical", outline: "none", boxSizing: "border-box",
        }} onFocus={function(e) { e.target.style.borderColor = D.violet; }} onBlur={function(e) { e.target.style.borderColor = D.border; }} />
      </div>}

      {/* Vibe Check (Style selector) - both modes */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <span>{"\uD83D\uDCAF"}</span>{" Vibe Check "}<span style={{ color: D.txd, fontSize: 8, textTransform: "none" }}>// pick your aesthetic</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {MEME_STYLES.map(function(s) {
            var on = memeStyle === s.id;
            return <div key={s.id} onClick={function() { setMemeStyle(s.id); }} style={{
              padding: "8px 16px", borderRadius: 8, cursor: "pointer",
              background: on ? D.amber + "14" : D.card, border: "1px solid " + (on ? D.amber + "50" : D.border),
              fontFamily: ft, fontSize: 12, fontWeight: on ? 700 : 500, color: on ? D.amber : D.txm,
              transition: "all 0.15s",
              boxShadow: on ? "0 0 12px " + D.amber + "20" : "none",
            }}>{s.l}</div>;
          })}
        </div>
      </div>

      {/* Generate Buttons Row */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
        {/* Generate Meme Image button */}
        <button onClick={handleMemeGenerate} disabled={memeImgLoading || (memeMode === "link" ? !slopResults : !memeIdea.trim())} style={{
          padding: "14px 32px", borderRadius: 10, border: "none", fontFamily: ft, fontSize: 15, fontWeight: 800,
          background: memeImgLoading ? D.amber + "60" : "linear-gradient(135deg, " + D.amber + ", " + D.violet + ")",
          color: "#fff", cursor: memeImgLoading ? "wait" : "pointer", letterSpacing: 0.5,
          transition: "all 0.2s",
          opacity: (memeMode === "link" ? !slopResults : !memeIdea.trim()) ? 0.4 : 1,
          animation: !(memeMode === "link" ? !slopResults : !memeIdea.trim()) && !memeImgLoading ? "buttonGlow 2s ease-in-out infinite" : "none",
        }}>{memeImgLoading ? "\uD83C\uDF73 " + loadingPhrase : "\uD83D\uDDBC\uFE0F Generate Meme Image"}</button>

        {/* Generate Video button */}
        <button onClick={handleVideoGenerate} disabled={videoLoading || (memeMode === "link" ? !slopResults : !memeIdea.trim())} style={{
          padding: "14px 32px", borderRadius: 10, border: "none", fontFamily: ft, fontSize: 15, fontWeight: 800,
          background: videoLoading ? D.cyan + "60" : "linear-gradient(135deg, " + D.cyan + ", " + D.teal + ")",
          color: "#fff", cursor: videoLoading ? "wait" : "pointer", letterSpacing: 0.5,
          transition: "all 0.2s",
          opacity: (memeMode === "link" ? !slopResults : !memeIdea.trim()) ? 0.4 : 1,
          animation: !(memeMode === "link" ? !slopResults : !memeIdea.trim()) && !videoLoading ? "glowPulse 2s ease-in-out infinite" : "none",
        }}>{videoLoading ? "\uD83C\uDFA5 " + (videoStatus || loadingPhrase) : "\uD83C\uDFA5 Generate Video"}</button>
      </div>

      {/* Generated meme image */}
      {memeImgLoading && <div style={{ marginTop: 24, padding: 40, textAlign: "center", background: D.card, borderRadius: 12, border: "1px solid " + D.border }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid " + D.border, borderTopColor: D.violet, margin: "0 auto 16px", animation: "slopSpin 1s linear infinite" }} />
        <div style={{ fontFamily: ft, fontSize: 14, color: D.txm }}>{loadingPhrase} \uD83D\uDD25</div>
      </div>}

      {memeImg && <div style={{ marginTop: 24, animation: "successPop 0.4s ease-out" }}>
        <div style={{ fontFamily: mn, fontSize: 10, color: D.teal, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          {SUCCESS_MESSAGES[Math.floor(Math.random() * SUCCESS_MESSAGES.length)]}
        </div>
        <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 12, padding: 16, textAlign: "center" }}>
          <img src={memeImg} style={{ maxWidth: "100%", maxHeight: 500, borderRadius: 8 }} />
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16 }}>
            <a href={memeImg} download="slop-meme.png" style={{
              padding: "10px 20px", borderRadius: 8, background: D.teal + "18", border: "1px solid " + D.teal + "40",
              color: D.teal, fontFamily: ft, fontSize: 12, fontWeight: 700, textDecoration: "none", cursor: "pointer",
            }}>{"Download \uD83D\uDC80"}</a>
            <button onClick={handleMemeGenerate} style={{
              padding: "10px 20px", borderRadius: 8, background: "transparent", border: "1px solid " + D.border,
              color: D.txm, fontFamily: ft, fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>{"Regenerate \uD83D\uDD04"}</button>
          </div>
        </div>
      </div>}

      {/* Generated video */}
      {videoLoading && !videoUrl && <div style={{ marginTop: 24, padding: 40, textAlign: "center", background: D.card, borderRadius: 12, border: "1px solid " + D.cyan + "20" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid " + D.border, borderTopColor: D.cyan, margin: "0 auto 16px", animation: "slopSpin 1s linear infinite" }} />
        <div style={{ fontFamily: ft, fontSize: 14, color: D.txm }}>{videoStatus || loadingPhrase} \uD83C\uDFA5</div>
      </div>}

      {videoError && <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 8, background: D.coral + "12", border: "1px solid " + D.coral + "30", fontFamily: mn, fontSize: 11, color: D.coral }}>
        \uD83D\uDC80 Video error: {videoError}
      </div>}

      {videoUrl && <div style={{ marginTop: 24, animation: "successPop 0.4s ease-out" }}>
        <div style={{ fontFamily: mn, fontSize: 10, color: D.cyan, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <span>{"\uD83C\uDFA5"}</span>{" absolute cinema "}<span>{"\uD83D\uDD25"}</span>
        </div>
        <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 12, padding: 16, textAlign: "center" }}>
          <video src={videoUrl} controls style={{ maxWidth: "100%", maxHeight: 500, borderRadius: 8 }} />
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16 }}>
            <a href={videoUrl} download="slop-video.mp4" style={{
              padding: "10px 20px", borderRadius: 8, background: D.cyan + "18", border: "1px solid " + D.cyan + "40",
              color: D.cyan, fontFamily: ft, fontSize: 12, fontWeight: 700, textDecoration: "none", cursor: "pointer",
            }}>{"Download \uD83C\uDFA5"}</a>
            <button onClick={handleVideoGenerate} style={{
              padding: "10px 20px", borderRadius: 8, background: "transparent", border: "1px solid " + D.border,
              color: D.txm, fontFamily: ft, fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>{"Regenerate \uD83D\uDD04"}</button>
          </div>
        </div>
      </div>}
    </div>}

    {/* ═══ TAB: BRIEF GENERATOR ═══ */}
    {tab === "brief" && <div>

    {/* Two-Panel Layout */}
    <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>

      {/* ═══ INPUT PANEL (left, ~40%) ═══ */}
      <div style={{
        width: "40%", flexShrink: 0,
        background: D.card, border: "1px solid " + D.border,
        borderRadius: 12, padding: 28,
      }}>
        {/* Topic */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: mn, fontSize: 9, fontWeight: 600, color: D.txd, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Topic</div>
          <textarea
            value={topic}
            onChange={function(e) { setTopic(e.target.value); }}
            placeholder="Paste from SA article or type topic..."
            rows={5}
            style={{
              width: "100%", padding: "14px 16px", borderRadius: 10,
              background: D.surface, border: "1px solid " + D.border,
              color: D.tx, fontFamily: ft, fontSize: 13, lineHeight: 1.6,
              resize: "vertical", outline: "none", boxSizing: "border-box",
              transition: "border 0.15s",
            }}
            onFocus={function(e) { e.target.style.borderColor = D.amber + "60"; }}
            onBlur={function(e) { e.target.style.borderColor = D.border; }}
          />
        </div>

        {/* Platform */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: mn, fontSize: 9, fontWeight: 600, color: D.txd, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Platform</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {PLATFORMS.map(function(p) {
              var isOn = platform === p.id;
              return <button key={p.id} onClick={function() { setPlatform(p.id); }} style={{
                padding: "8px 16px", borderRadius: 8,
                border: "1px solid " + (isOn ? p.color + "60" : D.border),
                background: isOn ? p.color + "18" : "transparent",
                color: isOn ? p.color : D.txm,
                cursor: "pointer", fontFamily: ft, fontSize: 12, fontWeight: isOn ? 700 : 500,
                transition: "all 0.15s",
              }}>{p.label}</button>;
            })}
          </div>
        </div>

        {/* Vibe */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: mn, fontSize: 9, fontWeight: 600, color: D.txd, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Vibe</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {VIBES.map(function(v) {
              var isOn = vibe === v;
              return <button key={v} onClick={function() { setVibe(v); }} style={{
                padding: "6px 14px", borderRadius: 20,
                border: "1px solid " + (isOn ? D.amber + "60" : D.border),
                background: isOn ? D.amber + "14" : "transparent",
                color: isOn ? D.amber : D.txm,
                cursor: "pointer", fontFamily: ft, fontSize: 11, fontWeight: isOn ? 700 : 500,
                transition: "all 0.15s",
              }}>{v}</button>;
            })}
          </div>
        </div>

        {/* Host/Face */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: mn, fontSize: 9, fontWeight: 600, color: D.txd, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Host / Face</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {HOSTS.map(function(h) {
              var isOn = host === h;
              return <button key={h} onClick={function() { setHost(h); }} style={{
                padding: "6px 14px", borderRadius: 8,
                border: "1px solid " + (isOn ? D.amber + "60" : D.border),
                background: isOn ? D.amber + "14" : "transparent",
                color: isOn ? D.amber : D.txm,
                cursor: "pointer", fontFamily: ft, fontSize: 11, fontWeight: isOn ? 700 : 500,
                transition: "all 0.15s",
              }}>{h}</button>;
            })}
          </div>
        </div>

        {/* Trend Reference */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: mn, fontSize: 9, fontWeight: 600, color: D.txd, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Trend Reference <span style={{ color: D.txd, fontWeight: 400 }}>(optional)</span></div>
          <input
            type="text"
            value={trendRef}
            onChange={function(e) { setTrendRef(e.target.value); }}
            placeholder="Paste URL or describe trend..."
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 8,
              background: D.surface, border: "1px solid " + D.border,
              color: D.tx, fontFamily: ft, fontSize: 12,
              outline: "none", boxSizing: "border-box", transition: "border 0.15s",
            }}
            onFocus={function(e) { e.target.style.borderColor = D.amber + "60"; }}
            onBlur={function(e) { e.target.style.borderColor = D.border; }}
          />
        </div>

        {/* Asset Swap URL */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: mn, fontSize: 9, fontWeight: 600, color: D.txd, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Asset Swap URL <span style={{ color: D.txd, fontWeight: 400 }}>(optional)</span></div>
          <input
            type="text"
            value={assetSwapUrl}
            onChange={function(e) { setAssetSwapUrl(e.target.value); }}
            placeholder="https://..."
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 8,
              background: D.surface, border: "1px solid " + D.border,
              color: D.tx, fontFamily: mn, fontSize: 11,
              outline: "none", boxSizing: "border-box", transition: "border 0.15s",
            }}
            onFocus={function(e) { e.target.style.borderColor = D.amber + "60"; }}
            onBlur={function(e) { e.target.style.borderColor = D.border; }}
          />
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={loading || !topic.trim()}
          style={{
            width: "100%", padding: "14px 0", borderRadius: 10,
            border: "none", cursor: loading || !topic.trim() ? "not-allowed" : "pointer",
            background: !topic.trim() ? D.border : loading ? D.amber + "80" : D.amber,
            color: D.bg, fontFamily: ft, fontSize: 14, fontWeight: 800,
            letterSpacing: 0.5, transition: "all 0.2s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            opacity: !topic.trim() ? 0.4 : 1,
          }}
        >
          {loading && <Spinner />}
          {loading ? "Generating..." : "Generate Brief"}
        </button>

        {/* Error */}
        {error && <div style={{
          marginTop: 16, padding: "12px 16px", borderRadius: 8,
          background: D.coral + "12", border: "1px solid " + D.coral + "30",
          fontFamily: mn, fontSize: 11, color: D.coral, lineHeight: 1.5,
          wordBreak: "break-word",
        }}>{error}</div>}
      </div>

      {/* ═══ OUTPUT PANEL (right, ~60%) ═══ */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Empty state */}
        {!briefs && !loading && <div style={{
          background: D.card, border: "1px solid " + D.border, borderRadius: 12,
          padding: "80px 40px", textAlign: "center",
        }}>
          <div style={{ fontFamily: mn, fontSize: 48, color: D.border, marginBottom: 16, opacity: 0.4 }}>//</div>
          <div style={{ fontFamily: ft, fontSize: 16, fontWeight: 600, color: D.txd }}>No briefs generated yet</div>
          <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, marginTop: 8 }}>
            Fill in the inputs and hit Generate Brief
          </div>
        </div>}

        {/* Loading state */}
        {loading && <div style={{
          background: D.card, border: "1px solid " + D.border, borderRadius: 12,
          padding: "80px 40px", textAlign: "center",
        }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 20 }}>
            {[0, 1, 2].map(function(i) {
              return <div key={i} style={{
                width: 8, height: 8, borderRadius: "50%", background: D.amber,
                animation: "slopPulse 1.4s ease-in-out infinite",
                animationDelay: i * 0.2 + "s",
              }} />;
            })}
          </div>
          <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 600, color: D.txm }}>Generating briefs...</div>
          <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, marginTop: 6 }}>
            Claude is crafting 3 variations for your content team
          </div>
        </div>}

        {/* Brief Cards */}
        {briefs && <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Selection summary */}
          {selected && <div style={{
            padding: "10px 18px", borderRadius: 8,
            background: D.amber + "0C", border: "1px solid " + D.amber + "30",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: "50%", background: D.amber,
              color: D.bg, display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: ft, fontSize: 11, fontWeight: 800,
            }}>{selected}</div>
            <span style={{ fontFamily: ft, fontSize: 12, fontWeight: 600, color: D.amber }}>
              Variation {selected} selected
            </span>
            <span style={{ fontFamily: mn, fontSize: 10, color: D.txd, marginLeft: "auto" }}>
              Ready for production handoff
            </span>
          </div>}

          {/* Render each variation */}
          {LABELS.map(function(label) {
            var brief = briefs[label];
            if (!brief) return null;
            return <BriefCard
              key={label}
              brief={brief}
              label={label}
              selected={selected}
              onSelect={setSelected}
              assetSwapUrl={assetSwapUrl}
            />;
          })}
        </div>}
      </div>
    </div>
    </div>}

    {/* ═══ TAB: ARXIV.LOL ═══ */}
    {tab === "arxiv" && <div style={{
      background: "linear-gradient(180deg, rgba(255,253,245,0.02) 0%, rgba(247,176,65,0.03) 50%, rgba(144,92,203,0.02) 100%)",
      borderRadius: 16, padding: 4,
    }}>
      {/* Academic Header */}
      <div style={{
        padding: "28px 32px", borderRadius: 14, marginBottom: 24,
        background: "linear-gradient(135deg, rgba(247,176,65,0.06), " + D.card + ", rgba(144,92,203,0.04))",
        border: "1px solid " + D.amber + "20",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          background: "repeating-linear-gradient(0deg, transparent, transparent 28px, rgba(255,255,255,0.01) 28px, rgba(255,255,255,0.01) 29px)",
          pointerEvents: "none",
        }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 28, animation: "paperFloat 3s ease-in-out infinite" }}>{"\uD83D\uDCC4"}</span>
            <div style={{
              fontFamily: ft, fontSize: 26, fontWeight: 900, letterSpacing: -0.5,
              background: "linear-gradient(135deg, " + D.amber + ", " + D.violet + ")",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}>arxiv.lol</div>
            <span style={{ fontFamily: mn, fontSize: 10, color: D.txd, marginLeft: 4 }}>// peer reviewed by AI</span>
          </div>
          <div style={{ fontFamily: mn, fontSize: 11, color: D.txm, lineHeight: 1.6 }}>
            turn any research paper into a meme masterpiece. citation needed: this goes hard.
          </div>
        </div>
      </div>

      {/* Submit Section */}
      <div style={{
        background: D.card, border: "1px solid " + D.border, borderRadius: 14,
        padding: "24px 28px", marginBottom: 24,
      }}>
        <div style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 2, textTransform: "uppercase", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
          <span>{"\uD83D\uDD17"}</span> Submit Paper <span style={{ color: D.txd, fontSize: 8, textTransform: "none" }}>// your paper just got slopped</span>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <input
            type="text"
            value={arxivInput}
            onChange={function(e) { setArxivInput(e.target.value); }}
            onKeyDown={function(e) { if (e.key === "Enter") handleArxivSubmit(); }}
            placeholder="Paste arxiv URL or paper ID (e.g. 2506.05869)"
            style={{
              flex: 1, padding: "14px 20px", borderRadius: 10,
              background: D.surface, border: "2px solid " + D.border,
              color: D.tx, fontFamily: mn, fontSize: 14, outline: "none", boxSizing: "border-box",
              transition: "border 0.2s",
            }}
            onFocus={function(e) { e.target.style.borderColor = D.amber; }}
            onBlur={function(e) { e.target.style.borderColor = D.border; }}
          />
          <button
            onClick={handleArxivSubmit}
            disabled={!arxivInput.trim()}
            style={{
              padding: "14px 28px", borderRadius: 10, border: "none",
              cursor: !arxivInput.trim() ? "not-allowed" : "pointer",
              background: !arxivInput.trim() ? D.border : "linear-gradient(135deg, " + D.amber + ", " + D.violet + ")",
              color: "#fff", fontFamily: ft, fontSize: 14, fontWeight: 800,
              opacity: !arxivInput.trim() ? 0.4 : 1, flexShrink: 0,
              boxShadow: arxivInput.trim() ? "0 4px 16px " + D.amber + "30" : "none",
              animation: arxivInput.trim() ? "buttonGlow 2s ease-in-out infinite" : "none",
              transition: "all 0.2s",
            }}
          >Submit to arxiv.lol {"\uD83D\uDCC4"}</button>
        </div>
        {arxivMsg && <div style={{
          marginTop: 14, padding: "12px 16px", borderRadius: 8,
          background: D.teal + "10", border: "1px solid " + D.teal + "30",
          fontFamily: ft, fontSize: 12, fontWeight: 600, color: D.teal,
          animation: "successPop 0.4s ease-out",
        }}>{"\u2705"} {arxivMsg}</div>}
      </div>

      {/* Queue / Jobs Section */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: mn, fontSize: 10, color: D.violet, letterSpacing: 2, textTransform: "uppercase", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
          <span>{"\uD83D\uDCDA"}</span> Slop Queue <span style={{ color: D.txd, fontSize: 8, textTransform: "none" }}>// {arxivQueue.length} paper{arxivQueue.length !== 1 ? "s" : ""} in the lab</span>
        </div>

        {arxivQueue.length === 0 && <div style={{
          background: D.card, border: "1px solid " + D.border, borderRadius: 12,
          padding: "60px 40px", textAlign: "center",
        }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>{"\uD83D\uDCC4"}</div>
          <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 600, color: D.txd }}>No papers in the slop queue</div>
          <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, marginTop: 6 }}>submit a paper above to start the slopping process</div>
        </div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {arxivQueue.map(function(job) {
            var isReady = job.status === "ready";
            var isProcessing = job.status === "processing";
            return <div key={job.paperId + "-" + job.submittedAt} style={{
              background: D.card,
              border: "1px solid " + (isReady ? D.teal + "50" : D.border),
              borderRadius: 12, padding: "20px 24px",
              transition: "all 0.3s",
              animation: isReady ? "greenGlow 2s ease-in-out infinite" : "none",
              position: "relative", overflow: "hidden",
            }}>
              {/* Paper texture lines for academic vibe */}
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                background: isReady
                  ? "linear-gradient(135deg, rgba(46,173,142,0.03), transparent, rgba(46,173,142,0.02))"
                  : "linear-gradient(135deg, rgba(247,176,65,0.02), transparent)",
                pointerEvents: "none",
              }} />

              <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <span style={{
                      fontFamily: mn, fontSize: 16, fontWeight: 800,
                      color: isReady ? D.teal : D.amber,
                      letterSpacing: 0.5,
                    }}>{job.paperId}</span>
                    {/* Status Badge */}
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "3px 10px", borderRadius: 8,
                      background: isReady ? D.teal + "18" : D.amber + "14",
                      border: "1px solid " + (isReady ? D.teal + "40" : D.amber + "30"),
                      fontFamily: mn, fontSize: 10, fontWeight: 700,
                      color: isReady ? D.teal : D.amber,
                      animation: isProcessing ? "amberPulse 2s ease-in-out infinite" : "none",
                    }}>
                      {isReady ? "\u2705 Ready!" : "\u23F3 Processing..."}
                    </span>
                  </div>
                  {job.title && <div style={{
                    fontFamily: ft, fontSize: 12, color: D.tx, marginBottom: 4, fontWeight: 600,
                  }}>{job.title}</div>}
                  <div style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>
                    Submitted {getTimeAgo(job.submittedAt)}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  {isReady && <button onClick={function() { window.open("https://arxiv.lol/" + job.paperId, "_blank"); }} style={{
                    padding: "8px 16px", borderRadius: 8, border: "none",
                    background: "linear-gradient(135deg, " + D.teal + ", " + D.cyan + ")",
                    color: "#fff", fontFamily: ft, fontSize: 11, fontWeight: 800, cursor: "pointer",
                    boxShadow: "0 4px 12px " + D.teal + "30",
                    animation: "readyBounce 2s ease-in-out infinite",
                  }}>View Meme {"\uD83D\uDD25"}</button>}
                  {isProcessing && <button onClick={function() { handleArxivCheckNow(job.paperId); }} style={{
                    padding: "8px 16px", borderRadius: 8,
                    border: "1px solid " + D.amber + "40",
                    background: D.amber + "10",
                    color: D.amber, fontFamily: ft, fontSize: 11, fontWeight: 700, cursor: "pointer",
                    transition: "all 0.15s",
                  }}>Check Now {"\u2197\uFE0F"}</button>}
                  <button onClick={function() { handleArxivRemove(job.paperId); }} style={{
                    padding: "8px 16px", borderRadius: 8,
                    border: "1px solid " + D.border,
                    background: "transparent",
                    color: D.txm, fontFamily: ft, fontSize: 11, fontWeight: 600, cursor: "pointer",
                    transition: "all 0.15s",
                  }}>Remove</button>
                </div>
              </div>
            </div>;
          })}
        </div>
      </div>

      {/* Academic Chaos Footer */}
      <div style={{
        textAlign: "center", padding: "16px 0",
        fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 1,
      }}>
        // powered by brainrot // peer reviewed by nobody // citation needed: this goes hard //
      </div>
    </div>}

    {/* ═══ TAB: FACTORY ═══ */}
    {tab === "factory" && <div style={{
      background: "#0a0a0a", borderRadius: 16, padding: 4, position: "relative",
      animation: "factoryCrt 4s ease-in-out infinite",
    }}>
      {/* CRT Scanlines Overlay */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 16,
        background: "repeating-linear-gradient(0deg, rgba(0,255,65,0.03) 0px, rgba(0,255,65,0.03) 1px, transparent 1px, transparent 3px)",
        pointerEvents: "none", zIndex: 2,
      }} />

      {/* Factory Header */}
      <div style={{
        padding: "28px 32px", borderRadius: 14, marginBottom: 0,
        background: "linear-gradient(135deg, rgba(0,255,65,0.06), #0a0a0a, rgba(0,255,65,0.03))",
        border: "1px solid rgba(0,255,65,0.15)",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative", zIndex: 3 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
            <div style={{
              fontFamily: mn, fontSize: 11, fontWeight: 800, color: "rgba(0,255,65,0.3)",
              letterSpacing: 2, lineHeight: 1,
            }}>067</div>
            <div>
              <div style={{
                fontFamily: mn, fontSize: 28, fontWeight: 900, letterSpacing: 2,
                color: "#00FF41",
                animation: "factoryGlitch 3s ease-in-out infinite",
                textTransform: "uppercase",
              }}>SLOGTOP FACTORY</div>
              <div style={{ fontFamily: mn, fontSize: 10, color: "rgba(0,255,65,0.4)", marginTop: 4, letterSpacing: 1 }}>
                // MEME PRODUCTION PIPELINE v0.67 // SECTION 67 CLEARANCE
              </div>
            </div>
          </div>
          <div style={{
            fontFamily: mn, fontSize: 11, fontWeight: 700, color: "#00FF41",
            background: "rgba(0,255,65,0.08)", border: "1px solid rgba(0,255,65,0.2)",
            padding: "8px 16px", borderRadius: 6, letterSpacing: 1,
            animation: "factoryBlink 4s ease-in-out infinite",
          }}>SESSION CREDITS: {factoryCredits}</div>
        </div>
      </div>

      {/* Format Selector */}
      <div style={{
        padding: "20px 32px", position: "relative", zIndex: 3,
      }}>
        <div style={{ fontFamily: mn, fontSize: 10, color: "#00FF41", letterSpacing: 2, textTransform: "uppercase", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ animation: "factoryBlink 2s ease-in-out infinite" }}>{"\u25B6"}</span> SELECT FORMAT
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {FACTORY_FORMATS.map(function(fmt) {
            var on = factoryFormat === fmt.id;
            return <button key={fmt.id} onClick={function() { setFactoryFormat(fmt.id); }} style={{
              padding: "8px 16px", borderRadius: 20, cursor: "pointer",
              background: on ? fmt.color + "20" : "rgba(0,255,65,0.04)",
              border: "1px solid " + (on ? fmt.color + "80" : "rgba(0,255,65,0.15)"),
              color: on ? fmt.color : "rgba(0,255,65,0.6)",
              fontFamily: mn, fontSize: 11, fontWeight: on ? 800 : 500,
              transition: "all 0.2s", display: "flex", alignItems: "center", gap: 6,
              boxShadow: on ? "0 0 12px " + fmt.color + "30, inset 0 0 8px " + fmt.color + "10" : "none",
            }}>
              <span>{fmt.emoji}</span> {fmt.label}
            </button>;
          })}
        </div>
      </div>

      {/* Error Display */}
      {factoryError && <div style={{
        margin: "0 32px 16px", padding: "14px 20px", borderRadius: 8,
        background: "rgba(255,0,0,0.08)", border: "1px solid rgba(255,0,0,0.3)",
        fontFamily: mn, fontSize: 12, color: "#FF4444", position: "relative", zIndex: 3,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <span style={{ color: "#FF0000", fontWeight: 800 }}>ERR &gt; </span>
          {factoryError}
        </div>
        <button onClick={function() {
          setFactoryError(null);
          if (factoryPhase === "error") setFactoryPhase(factoryImageUrl ? "image_ready" : "idle");
        }} style={{
          padding: "6px 16px", borderRadius: 6, cursor: "pointer",
          background: "rgba(255,0,0,0.12)", border: "1px solid rgba(255,0,0,0.4)",
          color: "#FF4444", fontFamily: mn, fontSize: 10, fontWeight: 700,
        }}>RETRY</button>
      </div>}

      {/* PHASE 1: Input + Prompt Crafting */}
      {(factoryPhase === "idle" || factoryPhase === "crafting" || factoryPhase === "error") && !factoryImagePrompt && <div style={{
        padding: "0 32px 24px", position: "relative", zIndex: 3,
      }}>
        <div style={{ fontFamily: mn, fontSize: 10, color: "#00FF41", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
          STEP 1 // INPUT
        </div>
        <textarea
          value={factoryInput}
          onChange={function(e) { setFactoryInput(e.target.value); }}
          placeholder={(FACTORY_FORMATS.find(function(f) { return f.id === factoryFormat; }) || {}).placeholder || "Describe your subject..."}
          rows={4}
          style={{
            width: "100%", padding: "14px 16px", borderRadius: 8,
            background: "rgba(0,255,65,0.03)", border: "1px solid rgba(0,255,65,0.15)",
            color: "#00FF41", fontFamily: mn, fontSize: 13, lineHeight: 1.6,
            resize: "vertical", outline: "none", boxSizing: "border-box",
            transition: "border 0.2s",
          }}
          onFocus={function(e) { e.target.style.borderColor = "rgba(0,255,65,0.5)"; }}
          onBlur={function(e) { e.target.style.borderColor = "rgba(0,255,65,0.15)"; }}
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
          <div style={{
            fontFamily: mn, fontSize: 10, color: "rgba(0,255,65,0.4)",
            background: "rgba(0,255,65,0.05)", padding: "4px 12px", borderRadius: 4,
            border: "1px solid rgba(0,255,65,0.1)",
          }}>
            COST: 1 IMAGE CREDIT
          </div>
          <button onClick={handleFactoryCraftPrompt} disabled={factoryPhase === "crafting" || !factoryInput.trim()} style={{
            padding: "12px 28px", borderRadius: 8, border: "1px solid rgba(0,255,65,0.4)",
            background: factoryPhase === "crafting" ? "rgba(0,255,65,0.1)" : "rgba(0,255,65,0.15)",
            color: "#00FF41", fontFamily: mn, fontSize: 12, fontWeight: 800,
            cursor: factoryPhase === "crafting" || !factoryInput.trim() ? "wait" : "pointer",
            letterSpacing: 1, transition: "all 0.2s",
            opacity: !factoryInput.trim() ? 0.4 : 1,
            boxShadow: factoryInput.trim() && factoryPhase !== "crafting" ? "0 0 16px rgba(0,255,65,0.2)" : "none",
          }}>
            {factoryPhase === "crafting" ? "CRAFTING..." : "CRAFT PROMPT \u2192"}
          </button>
        </div>
        {factoryPhase === "crafting" && <div style={{
          marginTop: 16, padding: "12px 16px", borderRadius: 6,
          background: "rgba(0,255,65,0.04)", border: "1px solid rgba(0,255,65,0.1)",
          fontFamily: mn, fontSize: 11, color: "rgba(0,255,65,0.6)",
          animation: "factoryBlink 1.5s ease-in-out infinite",
        }}>
          {">"} CLAUDE IS CRAFTING YOUR GROK PROMPT...
        </div>}
      </div>}

      {/* PHASE 1: Prompt Preview / Edit */}
      {factoryImagePrompt && (factoryPhase === "image_ready" || factoryPhase === "image_generating") && <div style={{
        padding: "0 32px 24px", position: "relative", zIndex: 3,
      }}>
        <div style={{ fontFamily: mn, fontSize: 10, color: "#00FF41", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
          STEP 2 // PROMPT PREVIEW
        </div>
        {/* Terminal Box for prompt */}
        <div style={{
          background: "rgba(0,255,65,0.03)", border: "1px solid rgba(0,255,65,0.2)",
          borderRadius: 8, padding: 0, overflow: "hidden", marginBottom: 16,
        }}>
          {/* Terminal title bar */}
          <div style={{
            padding: "8px 14px", background: "rgba(0,255,65,0.08)",
            borderBottom: "1px solid rgba(0,255,65,0.15)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#FF5F56" }} />
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#FFBD2E" }} />
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#27C93F" }} />
            <span style={{ fontFamily: mn, fontSize: 9, color: "rgba(0,255,65,0.4)", marginLeft: 8 }}>grok-prompt.txt</span>
          </div>
          <div style={{ padding: "16px 18px" }}>
            {factoryPromptEditing ? <textarea
              value={factoryImagePrompt}
              onChange={function(e) { setFactoryImagePrompt(e.target.value); }}
              rows={6}
              style={{
                width: "100%", background: "transparent", border: "none",
                color: "#00FF41", fontFamily: mn, fontSize: 12, lineHeight: 1.7,
                resize: "vertical", outline: "none", boxSizing: "border-box",
              }}
            /> : <div style={{
              fontFamily: mn, fontSize: 12, color: "#00FF41", lineHeight: 1.7,
              whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>{factoryImagePrompt}</div>}
          </div>
        </div>
        {/* Action buttons */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={function() { setFactoryPromptEditing(!factoryPromptEditing); }} style={{
            padding: "10px 20px", borderRadius: 6, cursor: "pointer",
            background: "transparent", border: "1px solid rgba(0,255,65,0.3)",
            color: "#00FF41", fontFamily: mn, fontSize: 11, fontWeight: 600,
            transition: "all 0.2s",
          }}>{factoryPromptEditing ? "DONE EDITING" : "EDIT PROMPT"}</button>
          <button onClick={handleFactoryGenerateImage} disabled={factoryPhase === "image_generating"} style={{
            padding: "10px 24px", borderRadius: 6, cursor: factoryPhase === "image_generating" ? "wait" : "pointer",
            background: "rgba(0,255,65,0.15)", border: "1px solid rgba(0,255,65,0.5)",
            color: "#00FF41", fontFamily: mn, fontSize: 11, fontWeight: 800,
            letterSpacing: 1, transition: "all 0.2s",
            boxShadow: factoryPhase !== "image_generating" ? "0 0 16px rgba(0,255,65,0.2)" : "none",
          }}>{factoryPhase === "image_generating" ? "GENERATING..." : "GENERATE IMAGE \u2192"}</button>
          <button onClick={function() {
            setFactoryImagePrompt("");
            setFactoryPhase("idle");
            setFactoryPromptEditing(false);
          }} style={{
            padding: "10px 16px", borderRadius: 6, cursor: "pointer",
            background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.3)", fontFamily: mn, fontSize: 11, fontWeight: 500,
            transition: "all 0.2s",
          }}>BACK</button>
        </div>

        {/* ASCII Progress Bar */}
        {factoryPhase === "image_generating" && <div style={{
          marginTop: 16, padding: "14px 18px", borderRadius: 6,
          background: "rgba(0,255,65,0.04)", border: "1px solid rgba(0,255,65,0.1)",
          fontFamily: mn, fontSize: 13, color: "#00FF41", letterSpacing: 1,
        }}>
          {">"} {factoryProgressBar(factoryProgress)}
        </div>}
      </div>}

      {/* Generated Image Display */}
      {factoryImageUrl && (factoryPhase === "image_ready" || factoryPhase === "video_confirming" || factoryPhase === "video_crafting" || factoryPhase === "video_ready" || factoryPhase === "video_generating" || factoryPhase === "video_done") && <div style={{
        padding: "0 32px 24px", position: "relative", zIndex: 3,
      }}>
        <div style={{ fontFamily: mn, fontSize: 10, color: "#00FF41", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
          STEP 3 // OUTPUT
        </div>
        {/* CRT Monitor Frame */}
        <div style={{
          background: "#0D0D0D", border: "2px solid rgba(0,255,65,0.2)",
          borderRadius: 12, padding: 4, position: "relative", overflow: "hidden",
          boxShadow: "0 0 30px rgba(0,255,65,0.08), inset 0 0 60px rgba(0,0,0,0.5)",
        }}>
          {/* CRT scanline overlay on image */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
            background: "repeating-linear-gradient(0deg, rgba(0,255,65,0.02) 0px, rgba(0,255,65,0.02) 1px, transparent 1px, transparent 3px)",
            pointerEvents: "none", zIndex: 2, borderRadius: 10,
          }} />
          <img src={factoryImageUrl} style={{
            width: "100%", maxHeight: 500, objectFit: "contain", borderRadius: 10, display: "block",
          }} />
        </div>

        {/* Image Review Buttons */}
        {factoryPhase === "image_ready" && <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <button onClick={function() {
            setFactoryImageUrl(null);
            handleFactoryGenerateImage();
          }} style={{
            padding: "10px 18px", borderRadius: 6, cursor: "pointer",
            background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.3)",
            color: "#FF4444", fontFamily: mn, fontSize: 11, fontWeight: 600,
          }}>REGENERATE (1 credit)</button>
          <button onClick={function() {
            setFactoryPhase("idle");
            setFactoryImageUrl(null);
            setFactoryPromptEditing(true);
          }} style={{
            padding: "10px 18px", borderRadius: 6, cursor: "pointer",
            background: "transparent", border: "1px solid rgba(0,255,65,0.3)",
            color: "#00FF41", fontFamily: mn, fontSize: 11, fontWeight: 600,
          }}>EDIT PROMPT + RETRY</button>
          <button onClick={function() { setFactoryPhase("video_confirming"); }} style={{
            padding: "10px 24px", borderRadius: 6, cursor: "pointer",
            background: "rgba(0,255,65,0.15)", border: "1px solid rgba(0,255,65,0.5)",
            color: "#00FF41", fontFamily: mn, fontSize: 11, fontWeight: 800,
            letterSpacing: 1, boxShadow: "0 0 16px rgba(0,255,65,0.2)",
          }}>{"\u2713"} LOOKS GOOD {"\u2192"} MAKE VIDEO</button>
          <a href={factoryImageUrl} download="factory-image.png" style={{
            padding: "10px 18px", borderRadius: 6, textDecoration: "none",
            background: "transparent", border: "1px solid rgba(0,255,65,0.2)",
            color: "rgba(0,255,65,0.6)", fontFamily: mn, fontSize: 11, fontWeight: 600,
            display: "inline-flex", alignItems: "center",
          }}>DOWNLOAD</a>
        </div>}
      </div>}

      {/* PHASE 2: Video Confirmation Modal */}
      {factoryPhase === "video_confirming" && <div style={{
        padding: "0 32px 24px", position: "relative", zIndex: 3,
      }}>
        <div style={{
          background: "rgba(0,255,65,0.04)", border: "1px solid rgba(0,255,65,0.3)",
          borderRadius: 8, padding: "24px 28px", textAlign: "center",
        }}>
          <div style={{
            fontFamily: mn, fontSize: 14, fontWeight: 800, color: "#00FF41",
            marginBottom: 8, letterSpacing: 1,
          }}>GENERATE VIDEO?</div>
          <div style={{
            fontFamily: mn, fontSize: 11, color: "rgba(0,255,65,0.5)", marginBottom: 20,
          }}>This will use 3 video credits.</div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button onClick={handleFactoryVideoConfirm} style={{
              padding: "12px 32px", borderRadius: 6, cursor: "pointer",
              background: "rgba(0,255,65,0.15)", border: "1px solid rgba(0,255,65,0.5)",
              color: "#00FF41", fontFamily: mn, fontSize: 12, fontWeight: 800,
              letterSpacing: 1, boxShadow: "0 0 16px rgba(0,255,65,0.2)",
            }}>CONFIRM</button>
            <button onClick={function() { setFactoryPhase("image_ready"); }} style={{
              padding: "12px 32px", borderRadius: 6, cursor: "pointer",
              background: "transparent", border: "1px solid rgba(255,255,255,0.15)",
              color: "rgba(255,255,255,0.4)", fontFamily: mn, fontSize: 12, fontWeight: 600,
            }}>CANCEL</button>
          </div>
        </div>
      </div>}

      {/* PHASE 2: Video Prompt Crafting */}
      {factoryPhase === "video_crafting" && <div style={{
        padding: "0 32px 24px", position: "relative", zIndex: 3,
      }}>
        <div style={{
          padding: "16px 20px", borderRadius: 6,
          background: "rgba(0,255,65,0.04)", border: "1px solid rgba(0,255,65,0.1)",
          fontFamily: mn, fontSize: 12, color: "rgba(0,255,65,0.6)",
          animation: "factoryBlink 1.5s ease-in-out infinite",
        }}>
          {">"} CLAUDE IS CRAFTING YOUR VIDEO PROMPT...
        </div>
      </div>}

      {/* PHASE 2: Video Prompt Preview */}
      {factoryVideoPrompt && (factoryPhase === "video_ready" || factoryPhase === "video_generating") && <div style={{
        padding: "0 32px 24px", position: "relative", zIndex: 3,
      }}>
        <div style={{ fontFamily: mn, fontSize: 10, color: "#00FF41", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
          STEP 6 // VIDEO PROMPT
        </div>
        <div style={{
          background: "rgba(0,255,65,0.03)", border: "1px solid rgba(0,255,65,0.2)",
          borderRadius: 8, padding: 0, overflow: "hidden", marginBottom: 16,
        }}>
          <div style={{
            padding: "8px 14px", background: "rgba(0,255,65,0.08)",
            borderBottom: "1px solid rgba(0,255,65,0.15)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#FF5F56" }} />
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#FFBD2E" }} />
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#27C93F" }} />
            <span style={{ fontFamily: mn, fontSize: 9, color: "rgba(0,255,65,0.4)", marginLeft: 8 }}>video-prompt.txt</span>
          </div>
          <div style={{ padding: "16px 18px" }}>
            {factoryVideoPromptEditing ? <textarea
              value={factoryVideoPrompt}
              onChange={function(e) { setFactoryVideoPrompt(e.target.value); }}
              rows={5}
              style={{
                width: "100%", background: "transparent", border: "none",
                color: "#00FF41", fontFamily: mn, fontSize: 12, lineHeight: 1.7,
                resize: "vertical", outline: "none", boxSizing: "border-box",
              }}
            /> : <div style={{
              fontFamily: mn, fontSize: 12, color: "#00FF41", lineHeight: 1.7,
              whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>{factoryVideoPrompt}</div>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={function() { setFactoryVideoPromptEditing(!factoryVideoPromptEditing); }} style={{
            padding: "10px 20px", borderRadius: 6, cursor: "pointer",
            background: "transparent", border: "1px solid rgba(0,255,65,0.3)",
            color: "#00FF41", fontFamily: mn, fontSize: 11, fontWeight: 600,
          }}>{factoryVideoPromptEditing ? "DONE EDITING" : "EDIT PROMPT"}</button>
          <button onClick={handleFactoryGenerateVideo} disabled={factoryPhase === "video_generating"} style={{
            padding: "10px 24px", borderRadius: 6,
            cursor: factoryPhase === "video_generating" ? "wait" : "pointer",
            background: "rgba(0,255,65,0.15)", border: "1px solid rgba(0,255,65,0.5)",
            color: "#00FF41", fontFamily: mn, fontSize: 11, fontWeight: 800,
            letterSpacing: 1, boxShadow: factoryPhase !== "video_generating" ? "0 0 16px rgba(0,255,65,0.2)" : "none",
          }}>{factoryPhase === "video_generating" ? "GENERATING..." : "GENERATE VIDEO \u2192"}</button>
        </div>

        {/* ASCII Progress Bar */}
        {factoryPhase === "video_generating" && <div style={{
          marginTop: 16, padding: "14px 18px", borderRadius: 6,
          background: "rgba(0,255,65,0.04)", border: "1px solid rgba(0,255,65,0.1)",
          fontFamily: mn, fontSize: 13, color: "#00FF41", letterSpacing: 1,
        }}>
          {">"} {factoryProgressBar(factoryProgress)}
        </div>}
      </div>}

      {/* PHASE 2: Video Output */}
      {factoryVideoUrl && factoryPhase === "video_done" && <div style={{
        padding: "0 32px 24px", position: "relative", zIndex: 3,
      }}>
        <div style={{ fontFamily: mn, fontSize: 10, color: "#00FF41", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
          STEP 8 // VIDEO OUTPUT
        </div>
        {/* CRT Monitor Frame for video */}
        <div style={{
          background: "#0D0D0D", border: "2px solid rgba(0,255,65,0.2)",
          borderRadius: 12, padding: 4, position: "relative", overflow: "hidden",
          boxShadow: "0 0 30px rgba(0,255,65,0.08), inset 0 0 60px rgba(0,0,0,0.5)",
        }}>
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
            background: "repeating-linear-gradient(0deg, rgba(0,255,65,0.02) 0px, rgba(0,255,65,0.02) 1px, transparent 1px, transparent 3px)",
            pointerEvents: "none", zIndex: 2, borderRadius: 10,
          }} />
          <video src={factoryVideoUrl} controls style={{
            width: "100%", maxHeight: 500, borderRadius: 10, display: "block",
          }} />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <a href={factoryVideoUrl} download="factory-video.mp4" style={{
            padding: "10px 20px", borderRadius: 6, textDecoration: "none",
            background: "rgba(0,255,65,0.12)", border: "1px solid rgba(0,255,65,0.3)",
            color: "#00FF41", fontFamily: mn, fontSize: 11, fontWeight: 700,
            display: "inline-flex", alignItems: "center",
          }}>DOWNLOAD VIDEO</a>
          <button onClick={function() {
            setFactoryVideoUrl(null);
            setFactoryPhase("video_ready");
            setFactoryProgress(0);
          }} style={{
            padding: "10px 18px", borderRadius: 6, cursor: "pointer",
            background: "transparent", border: "1px solid rgba(0,255,65,0.3)",
            color: "#00FF41", fontFamily: mn, fontSize: 11, fontWeight: 600,
          }}>REGENERATE VIDEO</button>
          <button onClick={handleFactoryReset} style={{
            padding: "10px 18px", borderRadius: 6, cursor: "pointer",
            background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.4)", fontFamily: mn, fontSize: 11, fontWeight: 600,
          }}>NEW PROJECT</button>
        </div>
      </div>}

      {/* Factory Footer */}
      <div style={{
        textAlign: "center", padding: "20px 32px 24px",
        fontFamily: mn, fontSize: 9, color: "rgba(0,255,65,0.25)", letterSpacing: 1,
        position: "relative", zIndex: 3,
      }}>
        // SECTION 67 // SLOGTOP FACTORY // ALL CREDITS ARE IMAGINARY // THE MACHINE PROVIDES //
      </div>
    </div>}

  </div>;
}
