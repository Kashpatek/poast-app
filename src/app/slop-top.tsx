// @ts-nocheck
"use client";
import { useState } from "react";

// ═══ DESIGN ═══
var D = {
  bg: "#060608", card: "#09090D", border: "rgba(255,255,255,0.06)",
  surface: "#0D0D12", tx: "#E8E4DD", txm: "#8A8690", txd: "#4E4B56",
  amber: "#F7B041", blue: "#0B86D1", teal: "#2EAD8E", coral: "#E06347",
  violet: "#905CCB", cyan: "#26C9D8",
};
var ft = "'Outfit',sans-serif";
var mn = "'JetBrains Mono',monospace";

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

  function handleSlopGenerate() {
    if (!slopUrl.trim()) return;
    setSlopLoading(true);
    setSlopError(null);
    setSlopResults(null);

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

  return <div style={{
    minHeight: "100vh", background: D.bg, padding: "32px 40px",
    fontFamily: ft, color: D.tx,
  }}>
    {/* Header */}
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontFamily: ft, fontSize: 28, fontWeight: 900, color: D.tx, letterSpacing: -1 }}>Slop Top</div>
      <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, marginTop: 4, letterSpacing: 1 }}>
        Content brief generator // Tell the team what to make
      </div>
    </div>

    {/* ═══ LINK-TO-SLOP SECTION ═══ */}
    <div style={{
      background: "linear-gradient(135deg, " + D.amber + "08 0%, " + D.card + " 40%, " + D.violet + "06 100%)",
      border: "1px solid " + D.amber + "25",
      borderRadius: 12, padding: 32, marginBottom: 32,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <div style={{ fontFamily: ft, fontSize: 20, fontWeight: 800, color: D.amber }}>Link to Slop</div>
        <div style={{
          fontFamily: mn, fontSize: 9, fontWeight: 700, color: D.bg,
          background: D.amber, padding: "3px 10px", borderRadius: 20,
          letterSpacing: 1, textTransform: "uppercase",
        }}>NEW</div>
      </div>
      <div style={{ fontFamily: mn, fontSize: 11, color: D.txm, marginBottom: 20 }}>
        Paste any link. Get meme captions, video hooks, thread ideas, and image prompts.
      </div>

      {/* Input bar + button */}
      <div style={{ display: "flex", gap: 12, marginBottom: 0 }}>
        <input
          type="text"
          value={slopUrl}
          onChange={function(e) { setSlopUrl(e.target.value); }}
          onKeyDown={function(e) { if (e.key === "Enter") handleSlopGenerate(); }}
          placeholder="Paste any link to get slop..."
          style={{
            flex: 1, padding: "14px 20px", borderRadius: 12,
            background: D.surface, border: "2px solid " + D.border,
            color: D.tx, fontFamily: ft, fontSize: 16,
            outline: "none", boxSizing: "border-box", transition: "border 0.2s",
          }}
          onFocus={function(e) { e.target.style.borderColor = D.amber; }}
          onBlur={function(e) { e.target.style.borderColor = D.border; }}
        />
        <button
          onClick={handleSlopGenerate}
          disabled={slopLoading || !slopUrl.trim()}
          style={{
            padding: "14px 32px", borderRadius: 12,
            border: "none", cursor: slopLoading || !slopUrl.trim() ? "not-allowed" : "pointer",
            background: !slopUrl.trim() ? D.border : slopLoading ? D.amber + "80" : "linear-gradient(135deg, " + D.amber + " 0%, #E09520 100%)",
            color: D.bg, fontFamily: ft, fontSize: 15, fontWeight: 800,
            letterSpacing: 0.5, transition: "all 0.2s",
            display: "flex", alignItems: "center", gap: 10,
            opacity: !slopUrl.trim() ? 0.4 : 1,
            flexShrink: 0,
            boxShadow: slopUrl.trim() && !slopLoading ? "0 4px 20px " + D.amber + "30" : "none",
          }}
        >
          {slopLoading && <Spinner />}
          {slopLoading ? "Generating..." : "Generate Slop"}
        </button>
      </div>

      {/* Error */}
      {slopError && <div style={{
        marginTop: 16, padding: "12px 16px", borderRadius: 8,
        background: D.coral + "12", border: "1px solid " + D.coral + "30",
        fontFamily: mn, fontSize: 11, color: D.coral, lineHeight: 1.5,
        wordBreak: "break-word",
      }}>{slopError}</div>}

      {/* Loading state */}
      {slopLoading && <div style={{
        marginTop: 24, padding: "40px 20px", textAlign: "center",
        background: D.card, borderRadius: 12, border: "1px solid " + D.border,
      }}>
        <style dangerouslySetInnerHTML={{ __html: "@keyframes slopPulse{0%,100%{opacity:0.3}50%{opacity:1}}" }} />
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 16 }}>
          {[0, 1, 2].map(function(i) {
            return <div key={i} style={{
              width: 8, height: 8, borderRadius: "50%", background: D.amber,
              animation: "slopPulse 1.4s ease-in-out infinite",
              animationDelay: i * 0.2 + "s",
            }} />;
          })}
        </div>
        <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 600, color: D.txm }}>Generating slop...</div>
        <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, marginTop: 6 }}>
          Fetching content and generating meme captions, video hooks, threads, and image prompts
        </div>
      </div>}

      {/* ═══ SLOP RESULTS ═══ */}
      {slopResults && <div style={{ marginTop: 24 }}>

        {/* Meme Captions */}
        {slopResults.meme_captions && slopResults.meme_captions.length > 0 && <div style={{ marginBottom: 24 }}>
          <div style={{
            fontFamily: mn, fontSize: 10, fontWeight: 700, color: D.amber,
            letterSpacing: 2, textTransform: "uppercase", marginBottom: 12,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ display: "inline-block", width: 16, height: 2, background: D.amber, borderRadius: 1 }} />
            Meme Captions
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {slopResults.meme_captions.map(function(cap, i) {
              return <SlopCard key={i} title={"Caption " + (i + 1)} content={cap} />;
            })}
          </div>
        </div>}

        {/* Video Hooks */}
        {slopResults.video_hooks && slopResults.video_hooks.length > 0 && <div style={{ marginBottom: 24 }}>
          <div style={{
            fontFamily: mn, fontSize: 10, fontWeight: 700, color: D.cyan,
            letterSpacing: 2, textTransform: "uppercase", marginBottom: 12,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ display: "inline-block", width: 16, height: 2, background: D.cyan, borderRadius: 1 }} />
            Video Hooks (first 3 seconds)
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {slopResults.video_hooks.map(function(hook, i) {
              return <SlopCard key={i} title={"Hook " + (i + 1)} content={hook} />;
            })}
          </div>
        </div>}

        {/* Thread Idea */}
        {slopResults.thread_idea && <div style={{ marginBottom: 24 }}>
          <div style={{
            fontFamily: mn, fontSize: 10, fontWeight: 700, color: D.violet,
            letterSpacing: 2, textTransform: "uppercase", marginBottom: 12,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ display: "inline-block", width: 16, height: 2, background: D.violet, borderRadius: 1 }} />
            Thread Idea
          </div>
          <div style={{
            background: D.card, border: "1px solid " + D.border,
            borderRadius: 12, padding: 20,
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(Array.isArray(slopResults.thread_idea) ? slopResults.thread_idea : [slopResults.thread_idea]).map(function(post, i) {
                return <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                    background: D.violet + "20", border: "1px solid " + D.violet + "40",
                    color: D.violet, display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: mn, fontSize: 10, fontWeight: 800,
                  }}>{i + 1}</div>
                  <div style={{ fontFamily: ft, fontSize: 13, color: D.tx, lineHeight: 1.7 }}>{post}</div>
                </div>;
              })}
            </div>
            <div style={{ marginTop: 14 }}>
              <button onClick={function() {
                var text = (Array.isArray(slopResults.thread_idea) ? slopResults.thread_idea : [slopResults.thread_idea]).map(function(p, i) { return (i + 1) + ". " + p; }).join("\n\n");
                copyText(text);
              }} style={{
                padding: "6px 14px", borderRadius: 8, border: "1px solid " + D.border,
                background: "transparent", color: D.txm,
                cursor: "pointer", fontFamily: mn, fontSize: 10, fontWeight: 600,
                transition: "all 0.15s",
              }}>Copy Thread</button>
            </div>
          </div>
        </div>}

        {/* Image Prompt */}
        {slopResults.image_prompt && <div style={{ marginBottom: 0 }}>
          <div style={{
            fontFamily: mn, fontSize: 10, fontWeight: 700, color: D.teal,
            letterSpacing: 2, textTransform: "uppercase", marginBottom: 12,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ display: "inline-block", width: 16, height: 2, background: D.teal, borderRadius: 1 }} />
            Image Prompt (for Grok)
          </div>
          <SlopCard
            content={slopResults.image_prompt}
            extraButton={
              <button onClick={function() { sendToImageCreator(slopResults.image_prompt); }} style={{
                padding: "6px 14px", borderRadius: 8,
                border: "1px solid " + D.teal + "50",
                background: D.teal + "18",
                color: D.teal,
                cursor: "pointer", fontFamily: ft, fontSize: 10, fontWeight: 700,
                transition: "all 0.15s",
              }}>Copy Prompt</button>
            }
          />
        </div>}
      </div>}
    </div>

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
          <style dangerouslySetInnerHTML={{ __html: "@keyframes slopPulse{0%,100%{opacity:0.3}50%{opacity:1}}" }} />
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
  </div>;
}
