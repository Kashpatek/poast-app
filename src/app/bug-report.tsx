"use client";
import { useState } from "react";
import { Bug, X } from "lucide-react";
import { D as C, ft, mn, gf } from "./shared-constants";
import { useUser } from "./user-context";
import { showToast } from "./toast-context";
import { trackEvent } from "../lib/poast-track";

// Sidebar bug button — visible to everyone, but the main use case is
// analysts capturing issues during their workflow. Submissions land in
// the POAST Settings · Bugs tab.
export function BugButton({ sec }: { sec: string }) {
  var _o = useState(false), open = _o[0], setOpen = _o[1];
  return (
    <>
      <div
        onClick={function() { setOpen(true); }}
        title="Report a bug"
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 12px", marginBottom: 10,
          borderRadius: 8, cursor: "pointer",
          background: "rgba(224,99,71,0.06)",
          border: "1px solid rgba(224,99,71,0.18)",
          transition: "background 0.18s",
        }}
        onMouseEnter={function(e: React.MouseEvent<HTMLElement>) { e.currentTarget.style.background = "rgba(224,99,71,0.14)"; }}
        onMouseLeave={function(e: React.MouseEvent<HTMLElement>) { e.currentTarget.style.background = "rgba(224,99,71,0.06)"; }}
      >
        <Bug size={14} strokeWidth={1.9} color="#E06347" />
        <span style={{ fontFamily: ft, fontSize: 11, fontWeight: 700, color: "#E06347", letterSpacing: 0.6 }}>Report a bug</span>
      </div>
      {open && <BugModal sec={sec} onClose={function() { setOpen(false); }} />}
    </>
  );
}

function BugModal({ sec, onClose }: { sec: string; onClose: () => void }) {
  var userCtx = useUser();
  var _t = useState(""), title = _t[0], setTitle = _t[1];
  var _b = useState(""), body = _b[0], setBody = _b[1];
  var _s = useState(false), submitting = _s[0], setSubmitting = _s[1];

  var submit = async function() {
    if (!body.trim()) { showToast("Describe the issue first."); return; }
    setSubmitting(true);
    try {
      var res = await fetch("/api/bugs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || "(untitled)",
          body: body.trim(),
          user: userCtx.user ? userCtx.user.name : "anon",
          role: userCtx.user ? userCtx.user.role : "anon",
          sec: sec,
        }),
      });
      var data = await res.json() as { ok?: boolean };
      if (data.ok) {
        showToast("Bug reported. Thanks!");
        trackEvent("bug", { title: title.trim(), bodyLen: body.trim().length }, sec);
        onClose();
      } else {
        showToast("Couldn't submit. Try again.");
      }
    } catch (e) {
      showToast("Couldn't submit. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(6,6,12,0.72)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", zIndex: 11500, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={function(e: React.MouseEvent<HTMLElement>) { e.stopPropagation(); }} style={{ width: "min(480px, 92vw)", background: "#0A0A14", border: "1px solid rgba(224,99,71,0.30)", borderRadius: 14, padding: "22px 24px", boxShadow: "0 24px 60px rgba(0,0,0,0.55)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Bug size={18} strokeWidth={1.9} color="#E06347" />
            <span style={{ fontFamily: gf, fontSize: 16, fontWeight: 800, color: "#E8E4DD", letterSpacing: -0.2 }}>Report a bug</span>
          </div>
          <span onClick={onClose} style={{ cursor: "pointer", color: "rgba(255,255,255,0.45)", display: "flex", padding: 4 }}>
            <X size={16} />
          </span>
        </div>
        <div style={{ fontFamily: ft, fontSize: 12, color: "rgba(232,228,221,0.55)", lineHeight: 1.5, marginBottom: 14 }}>
          Describe what you saw and what you expected. Visible on the POAST Settings dashboard.
        </div>
        <input
          autoFocus
          placeholder="Short title (optional)"
          value={title}
          onChange={function(e: React.ChangeEvent<HTMLInputElement>) { setTitle(e.target.value); }}
          style={{ width: "100%", padding: "10px 14px", background: "#06060A", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, color: "#E8E4DD", fontFamily: ft, fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 10 }}
        />
        <textarea
          placeholder="What broke? Steps to reproduce, what you expected, etc."
          value={body}
          onChange={function(e: React.ChangeEvent<HTMLTextAreaElement>) { setBody(e.target.value); }}
          rows={6}
          style={{ width: "100%", padding: "12px 14px", background: "#06060A", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, color: "#E8E4DD", fontFamily: mn, fontSize: 12, outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.5, marginBottom: 12 }}
        />
        <div style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.32)", marginBottom: 14, letterSpacing: 0.6 }}>
          Auto-included · {userCtx.user ? userCtx.user.name : "anon"} · {sec || "n/a"} · timestamp
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "10px 16px", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, color: "rgba(255,255,255,0.7)", fontFamily: ft, fontSize: 12, fontWeight: 700, cursor: "pointer", letterSpacing: 0.3 }}>Cancel</button>
          <button
            onClick={submit}
            disabled={submitting}
            style={{ padding: "10px 18px", background: "#E06347", border: "none", borderRadius: 7, color: "#fff", fontFamily: ft, fontSize: 12, fontWeight: 800, cursor: submitting ? "not-allowed" : "pointer", letterSpacing: 0.3, opacity: submitting ? 0.6 : 1 }}
          >
            {submitting ? "Sending..." : "Submit bug"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Re-export for convenience
export { Bug };

// Used in C imports — here just to silence unused warnings if any.
void C;
