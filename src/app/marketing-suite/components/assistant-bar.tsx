"use client";
// Assistant omnibox — type or paste anything; Claude figures out whether it's a
// task / schedule / campaign / ad and opens the right pre-filled modal, or
// answers a "help me think" question inline. Lives in the shell top bar.
import React, { useEffect, useRef, useState } from "react";
import { Sparkles, CornerDownLeft, Loader2, X } from "lucide-react";
import { D, ft, mn } from "../../shared-constants";
import { useCreate } from "../create-context";
import type { CreateKind } from "../marketing-constants";

interface ParseResult {
  kind: CreateKind | "help";
  summary?: string;
  answer?: string;
  fields?: Record<string, unknown>;
}

export default function AssistantBar() {
  const { openCreate } = useCreate();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // ⌘K / Ctrl-K focuses the bar from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function run() {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true); setErr(null); setAnswer(null);
    try {
      const res = await fetch("/api/assistant/parse", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t, today: new Date().toISOString().slice(0, 10) }),
      });
      const j: ParseResult & { error?: string } = await res.json();
      if (!res.ok) throw new Error(j.error || "Assistant unavailable");
      if (j.kind === "help") {
        setAnswer(j.answer || "I'm not sure how to help with that yet.");
      } else {
        openCreate(j.kind, j.fields || {});
        setText("");
      }
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: "relative", flex: 1, maxWidth: 460, minWidth: 180 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, height: 34, padding: "0 10px",
        borderRadius: 10, border: `1px solid ${focused ? D.amber + "66" : D.border}`,
        background: focused ? D.amber + "0c" : D.card, transition: "border-color 0.15s, background 0.15s",
      }}>
        {busy ? <Loader2 size={14} color={D.amber} style={{ animation: "spin 1s linear infinite" }} />
              : <Sparkles size={14} color={D.amber} />}
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => { if (e.key === "Enter") run(); if (e.key === "Escape") { setAnswer(null); setErr(null); } }}
          placeholder="Ask or add anything — task, schedule, campaign, ad…  (⌘K)"
          style={{
            flex: 1, border: "none", outline: "none", background: "transparent",
            fontFamily: ft, fontSize: 12.5, color: D.tx,
          }}
        />
        {text && (
          <button onClick={run} disabled={busy} title="Run (Enter)" style={{
            display: "inline-flex", alignItems: "center", gap: 4, cursor: busy ? "default" : "pointer",
            border: "none", background: "transparent", color: D.txm, fontFamily: mn, fontSize: 10,
          }}>
            <CornerDownLeft size={13} />
          </button>
        )}
      </div>

      {/* Help answer / error popover */}
      {(answer || err) && (
        <div style={{
          position: "absolute", top: 42, left: 0, right: 0, zIndex: 40,
          background: D.surface, border: `1px solid ${(err ? D.coral : D.amber)}55`, borderRadius: 11,
          padding: "12px 13px", boxShadow: "0 18px 50px rgba(0,0,0,0.55)", fontFamily: ft,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontFamily: mn, fontSize: 9.5, letterSpacing: 0.5, textTransform: "uppercase", color: err ? D.coral : D.amber }}>
              {err ? "Assistant error" : "Assistant"}
            </span>
            <button onClick={() => { setAnswer(null); setErr(null); }} style={{ border: "none", background: "transparent", color: D.txm, cursor: "pointer", display: "inline-flex" }}>
              <X size={14} />
            </button>
          </div>
          <div style={{ fontSize: 13, color: err ? D.coral : D.tx, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
            {err || answer}
          </div>
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
