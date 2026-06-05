"use client";

// Episode Kit Builder — paste an episode title, guest name, and
// transcript. One call to /api/episode-kit returns show notes, a
// guest bio card, timestamped chapters, clip captions, and a guest
// thank-you email. Each card has its own SendToChip + Copy action.

import React, { useState, useRef } from "react";
import { D, ft, gf, mn, copyText } from "../shared-constants";
import { SendToChip } from "../components/send-to-chip";
import { showToast } from "../toast-context";

interface Chapter { timestamp: string; title: string }
interface ThankYouEmail { subject: string; body: string }
interface Kit {
  showNotes: string;
  guestBio: string;
  chapters: Chapter[];
  clipCaptions: string[];
  thankYouEmail: ThankYouEmail;
}

type Stage = "idle" | "calling" | "parsing" | "done" | "error";

interface CardProps {
  cardId: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  body: string;
  sourceTool: string;
  kind: "brief" | "caption" | "thread" | "other";
  children: React.ReactNode;
}

function Card(props: CardProps) {
  const [copied, setCopied] = useState(false);

  function copy() {
    const ok = copyText(props.body || "");
    if (ok) {
      setCopied(true);
      window.setTimeout(function() { setCopied(false); }, 1500);
      showToast("Copied " + props.title.toLowerCase() + ".", "success");
    } else {
      showToast("Copy failed.", "info");
    }
  }

  return (
    <div style={{ background: D.surface, border: "1px solid " + D.border, borderRadius: 10, marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: props.open ? "1px solid " + D.border : "none" }}>
        <button
          type="button"
          onClick={props.onToggle}
          style={{
            background: "transparent",
            border: "none",
            color: D.tx,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: 0,
            fontFamily: gf,
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: -0.3,
          }}
        >
          <span style={{ fontFamily: mn, fontSize: 11, color: D.amber, width: 14, display: "inline-block" }}>{props.open ? "−" : "+"}</span>
          <span>{props.title}</span>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={copy}
            style={{
              background: copied ? D.teal : "transparent",
              color: copied ? "#060608" : D.tx,
              border: "1px solid " + (copied ? D.teal : D.border),
              padding: "5px 12px",
              borderRadius: 6,
              fontFamily: mn,
              fontSize: 10,
              letterSpacing: 0.6,
              cursor: "pointer",
            }}
          >
            {copied ? "COPIED" : "COPY"}
          </button>
          <SendToChip text={props.body} sourceTool={props.sourceTool} kind={props.kind} />
        </div>
      </div>
      {props.open ? (
        <div style={{ padding: "14px 16px" }}>{props.children}</div>
      ) : null}
    </div>
  );
}

export default function EpisodeKitBuilder() {
  const [title, setTitle] = useState("");
  const [guest, setGuest] = useState("");
  const [transcript, setTranscript] = useState("");
  const [kit, setKit] = useState<Kit | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({
    showNotes: true,
    guestBio: true,
    chapters: true,
    clipCaptions: true,
    thankYouEmail: true,
  });
  const abortRef = useRef<AbortController | null>(null);

  function toggle(id: string) {
    setOpenCards(function(prev) { return { ...prev, [id]: !prev[id] }; });
  }

  async function build() {
    if (!title.trim() || !guest.trim() || !transcript.trim()) return;
    setStage("calling");
    setError(null);
    setKit(null);

    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/episode-kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), guest: guest.trim(), transcript: transcript.trim() }),
        signal: ctrl.signal,
      });
      setStage("parsing");
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "Kit build failed");
        setStage("error");
        return;
      }
      const k = j.kit as Kit;
      if (!k || typeof k !== "object") {
        setError("Malformed kit response");
        setStage("error");
        return;
      }
      setKit(k);
      setStage("done");
      showToast("Episode kit ready.", "success");
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(String(e));
      setStage("error");
    }
  }

  const busy = stage === "calling" || stage === "parsing";
  const canSubmit = title.trim() && guest.trim() && transcript.trim() && !busy;

  const stageLabel =
    stage === "calling" ? "Calling the model…" :
    stage === "parsing" ? "Parsing the kit…" :
    stage === "done" ? "Kit ready" :
    stage === "error" ? "Error" : "";

  const chaptersText = kit ? kit.chapters.map(function(c) { return c.timestamp + "  " + c.title; }).join("\n") : "";
  const clipCaptionsText = kit ? kit.clipCaptions.join("\n\n") : "";
  const thankYouText = kit ? "Subject: " + kit.thankYouEmail.subject + "\n\n" + kit.thankYouEmail.body : "";

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 32px" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 10px", borderRadius: 999, background: "rgba(46,173,142,0.10)", border: "1px solid " + D.teal + "55", marginBottom: 14 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: D.teal, boxShadow: "0 0 8px " + D.teal }} />
        <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.teal, textTransform: "uppercase" }}>Production Studio</span>
      </div>
      <h1 style={{ fontFamily: gf, fontSize: 38, fontWeight: 900, letterSpacing: -1, margin: 0, marginBottom: 8, color: D.tx }}>Episode Kit Builder</h1>
      <div style={{ fontFamily: ft, fontSize: 15, color: D.txm, maxWidth: 720, lineHeight: 1.5, marginBottom: 28 }}>
        After an episode wraps, paste the title, guest, and full transcript. One click produces show notes, a guest bio card, chapters, clip captions, and a guest thank-you email.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
        <div>
          <div style={lbl}>Episode title</div>
          <input
            value={title}
            onChange={function(e) { setTitle(e.target.value); }}
            placeholder="Ep. 42 - HBM Supply Pressure (Memory)"
            style={inputStyle}
          />
        </div>
        <div>
          <div style={lbl}>Guest name</div>
          <input
            value={guest}
            onChange={function(e) { setGuest(e.target.value); }}
            placeholder="Mark Liu, Senior Director, SK Hynix"
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={lbl}>Transcript</div>
        <textarea
          value={transcript}
          onChange={function(e) { setTranscript(e.target.value); }}
          placeholder="Paste the full transcript. Speaker labels welcome but optional."
          style={{ ...inputStyle, minHeight: 220, resize: "vertical", fontFamily: mn, fontSize: 12, lineHeight: 1.5 }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
        <button
          type="button"
          onClick={build}
          disabled={!canSubmit}
          style={{
            background: D.amber,
            color: "#060608",
            border: "none",
            padding: "12px 26px",
            borderRadius: 8,
            fontFamily: ft,
            fontSize: 13,
            fontWeight: 800,
            cursor: canSubmit ? "pointer" : "not-allowed",
            opacity: canSubmit ? 1 : 0.5,
          }}
        >
          {busy ? "Building…" : "Build the kit"}
        </button>
        {stageLabel ? (
          <span style={{
            fontFamily: mn,
            fontSize: 11,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            color: stage === "error" ? D.coral : stage === "done" ? D.teal : D.amber,
          }}>
            {stageLabel}
          </span>
        ) : null}
      </div>

      {error ? (
        <div style={{ marginBottom: 18, padding: "10px 14px", background: D.coral + "10", border: "1px solid " + D.coral + "55", borderRadius: 8, fontFamily: mn, fontSize: 11, color: D.coral }}>
          {error}
        </div>
      ) : null}

      {kit ? (
        <div>
          <Card
            cardId="showNotes"
            title="Show notes"
            open={!!openCards.showNotes}
            onToggle={function() { toggle("showNotes"); }}
            body={kit.showNotes}
            sourceTool="episode-kit-show-notes"
            kind="brief"
          >
            <pre style={proseStyle}>{kit.showNotes}</pre>
          </Card>

          <Card
            cardId="guestBio"
            title="Guest bio card"
            open={!!openCards.guestBio}
            onToggle={function() { toggle("guestBio"); }}
            body={kit.guestBio}
            sourceTool="episode-kit-guest-bio"
            kind="brief"
          >
            <div style={proseStyle}>{kit.guestBio}</div>
          </Card>

          <Card
            cardId="chapters"
            title={"Chapters (" + (kit.chapters?.length || 0) + ")"}
            open={!!openCards.chapters}
            onToggle={function() { toggle("chapters"); }}
            body={chaptersText}
            sourceTool="episode-kit-chapters"
            kind="other"
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(kit.chapters || []).map(function(c, i) {
                return (
                  <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "6px 0", borderBottom: "1px dashed " + D.border }}>
                    <span style={{ fontFamily: mn, fontSize: 11, color: D.amber, minWidth: 70, letterSpacing: 0.5 }}>{c.timestamp}</span>
                    <span style={{ fontFamily: ft, fontSize: 13, color: D.tx, lineHeight: 1.4 }}>{c.title}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card
            cardId="clipCaptions"
            title={"Clip captions (" + (kit.clipCaptions?.length || 0) + ")"}
            open={!!openCards.clipCaptions}
            onToggle={function() { toggle("clipCaptions"); }}
            body={clipCaptionsText}
            sourceTool="episode-kit-clip-captions"
            kind="caption"
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(kit.clipCaptions || []).map(function(c, i) {
                return (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <span style={{ fontFamily: mn, fontSize: 10, color: D.txd, minWidth: 22, paddingTop: 3 }}>{(i + 1).toString().padStart(2, "0")}</span>
                    <div style={{ flex: 1, padding: "10px 12px", background: D.bg, border: "1px solid " + D.border, borderRadius: 8 }}>
                      <div style={{ fontFamily: ft, fontSize: 13, color: D.tx, lineHeight: 1.45, marginBottom: 6 }}>{c}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <SendToChip text={c} sourceTool="episode-kit-clip-caption" kind="caption" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card
            cardId="thankYouEmail"
            title="Guest thank-you email"
            open={!!openCards.thankYouEmail}
            onToggle={function() { toggle("thankYouEmail"); }}
            body={thankYouText}
            sourceTool="episode-kit-thank-you"
            kind="other"
          >
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.2, color: D.txd, textTransform: "uppercase", marginBottom: 4 }}>Subject</div>
              <div style={{ fontFamily: ft, fontSize: 14, color: D.tx, fontWeight: 600 }}>{kit.thankYouEmail.subject}</div>
            </div>
            <div>
              <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.2, color: D.txd, textTransform: "uppercase", marginBottom: 4 }}>Body</div>
              <pre style={proseStyle}>{kit.thankYouEmail.body}</pre>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

const lbl: React.CSSProperties = {
  fontFamily: mn,
  fontSize: 10,
  letterSpacing: 1.4,
  textTransform: "uppercase",
  color: D.txd,
  marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  background: D.surface,
  border: "1px solid " + D.border,
  borderRadius: 8,
  color: D.tx,
  fontFamily: ft,
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

const proseStyle: React.CSSProperties = {
  fontFamily: ft,
  fontSize: 13,
  color: D.tx,
  lineHeight: 1.55,
  whiteSpace: "pre-wrap",
  margin: 0,
  fontWeight: 400,
};
