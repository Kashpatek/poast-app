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

var LOADING_PHRASES = [
  "cooking rn...",
  "hold up this boutta go crazy...",
  "generating pure slop...",
  "the slopification is in progress...",
  "brainrot loading...",
  "sigma grindset activating...",
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
      body: JSON.stringify({ action: "link-to-slop", url: slopUrl.trim() }),
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
    var fullPrompt = prompt + ". Style: " + (styleInfo ? styleInfo.prompt : "meme format");

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
    var fullPrompt = prompt + ". Style: " + (styleInfo ? styleInfo.prompt : "meme format");

    setVideoLoading(true);
    setVideoUrl(null);
    setVideoError(null);
    setVideoStatus("cooking rn...");
    pickLoadingPhrase();

    fetch("/api/generate-clip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: fullPrompt, engine: "grok" }),
    }).then(function(r) { return r.json(); }).then(function(d) {
      if (d.video && d.video.url) {
        setVideoUrl(d.video.url);
        setVideoStatus(null);
        setVideoLoading(false);
      } else if (d.status === "processing" || d.status === "pending") {
        setVideoStatus("still cooking... " + (d.status || ""));
        // Poll for completion
        var pollInterval = setInterval(function() {
          fetch("/api/generate-clip", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: fullPrompt, engine: "grok" }),
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

  var TABS = [
    { id: "meme", l: "Meme Maker \uD83D\uDC80" },
    { id: "brief", l: "Brief Generator \uD83D\uDCCB" },
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

    {/* ═══ TABS ═══ */}
    <div style={{ display: "flex", gap: 0, marginBottom: 28, borderBottom: "1px solid " + D.border }}>
      {TABS.map(function(t) {
        var on = tab === t.id;
        var isMemeMaker = t.id === "meme";
        return <div key={t.id} onClick={function() { setTab(t.id); }} style={{
          padding: "12px 24px", cursor: "pointer", fontFamily: ft, fontSize: 14, fontWeight: on ? 800 : 500,
          color: on ? D.amber : D.txm, borderBottom: on ? "2px solid " + D.amber : "2px solid transparent",
          transition: "all 0.2s", display: "flex", alignItems: "center", gap: 6,
          background: on && isMemeMaker ? "linear-gradient(135deg, rgba(247,176,65,0.05), transparent)" : "transparent",
        }}>
          {isMemeMaker && on ? <span style={{
            background: "linear-gradient(135deg, " + D.amber + ", " + D.violet + ")",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            fontWeight: 900,
          }}>{t.l}</span> : t.l}
        </div>;
      })}
    </div>

    {/* ═══ TAB: MEME MAKER ═══ */}
    {tab === "meme" && <div>
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
          <span>\uD83E\uDDE0</span> Brainrot Presets <span style={{ fontSize: 8, color: D.txd }}>(click to add to prompt)</span>
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
      </div>

      {/* Link to Meme mode */}
      {memeMode === "link" && <div>
        {/* Link input */}
        <div style={{
          background: "linear-gradient(135deg, " + D.amber + "08, " + D.card + ", " + D.violet + "06)",
          border: "1px solid " + D.amber + "25", borderRadius: 12, padding: 28, marginBottom: 24,
        }}>
          <div style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <span>\uD83D\uDD17</span> Paste Link <span style={{ color: D.txd, fontSize: 8, textTransform: "none" }}>// drop the url bro</span>
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
            <span>\uD83D\uDD25</span> slop acquired <span>\uD83D\uDCAF</span>
          </div>
          {/* Meme Captions */}
          {slopResults.meme_captions && slopResults.meme_captions.length > 0 && <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: mn, fontSize: 10, fontWeight: 700, color: D.amber, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>\uD83D\uDC80 Meme Captions</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>{slopResults.meme_captions.map(function(cap, i) { return <SlopCard key={i} title={"Caption " + (i + 1)} content={cap} />; })}</div>
          </div>}
          {/* Video Hooks */}
          {slopResults.video_hooks && slopResults.video_hooks.length > 0 && <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: mn, fontSize: 10, fontWeight: 700, color: D.cyan, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>\u26A1 Video Hooks</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>{slopResults.video_hooks.map(function(hook, i) { return <SlopCard key={i} title={"Hook " + (i + 1)} content={hook} />; })}</div>
          </div>}
          {/* Thread Idea */}
          {slopResults.thread_idea && <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: mn, fontSize: 10, fontWeight: 700, color: D.violet, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>\uD83E\uDDE0 Thread Idea</div>
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
            <div style={{ fontFamily: mn, fontSize: 10, fontWeight: 700, color: D.teal, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>\uD83D\uDD25 Image Prompt</div>
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
          <span>\uD83D\uDE24</span> What's the prompt bro <span style={{ color: D.txd, fontSize: 8, textTransform: "none" }}>// describe your masterpiece</span>
        </div>
        <textarea value={memeIdea} onChange={function(e) { setMemeIdea(e.target.value); }} placeholder="e.g. Jensen Huang holding a GPU like it's the holy grail, NVIDIA cathedral lighting... \uD83D\uDD25" rows={4} style={{
          width: "100%", padding: "14px 16px", borderRadius: 10, background: D.surface, border: "1px solid " + D.border,
          color: D.tx, fontFamily: ft, fontSize: 14, lineHeight: 1.6, resize: "vertical", outline: "none", boxSizing: "border-box",
        }} onFocus={function(e) { e.target.style.borderColor = D.violet; }} onBlur={function(e) { e.target.style.borderColor = D.border; }} />
      </div>}

      {/* Vibe Check (Style selector) - both modes */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <span>\uD83D\uDCAF</span> Vibe Check <span style={{ color: D.txd, fontSize: 8, textTransform: "none" }}>// pick your aesthetic</span>
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
          <span>\uD83D\uDD25</span> this goes HARD <span>\uD83D\uDCAF</span>
        </div>
        <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 12, padding: 16, textAlign: "center" }}>
          <img src={memeImg} style={{ maxWidth: "100%", maxHeight: 500, borderRadius: 8 }} />
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16 }}>
            <a href={memeImg} download="slop-meme.png" style={{
              padding: "10px 20px", borderRadius: 8, background: D.teal + "18", border: "1px solid " + D.teal + "40",
              color: D.teal, fontFamily: ft, fontSize: 12, fontWeight: 700, textDecoration: "none", cursor: "pointer",
            }}>Download \uD83D\uDC80</a>
            <button onClick={handleMemeGenerate} style={{
              padding: "10px 20px", borderRadius: 8, background: "transparent", border: "1px solid " + D.border,
              color: D.txm, fontFamily: ft, fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>Regenerate \uD83D\uDD04</button>
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
          <span>\uD83C\uDFA5</span> absolute cinema <span>\uD83D\uDD25</span>
        </div>
        <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 12, padding: 16, textAlign: "center" }}>
          <video src={videoUrl} controls style={{ maxWidth: "100%", maxHeight: 500, borderRadius: 8 }} />
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16 }}>
            <a href={videoUrl} download="slop-video.mp4" style={{
              padding: "10px 20px", borderRadius: 8, background: D.cyan + "18", border: "1px solid " + D.cyan + "40",
              color: D.cyan, fontFamily: ft, fontSize: 12, fontWeight: 700, textDecoration: "none", cursor: "pointer",
            }}>Download \uD83C\uDFA5</a>
            <button onClick={handleVideoGenerate} style={{
              padding: "10px 20px", borderRadius: 8, background: "transparent", border: "1px solid " + D.border,
              color: D.txm, fontFamily: ft, fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>Regenerate \uD83D\uDD04</button>
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
  </div>;
}
