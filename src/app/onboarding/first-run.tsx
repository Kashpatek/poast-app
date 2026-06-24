"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, UserPlus, Lock, Check } from "lucide-react";
import { useUser } from "../user-context";
import { useTheme } from "../theme-context";
import { D as C, ft, gf, mn } from "../shared-constants";
import IgnitionBloom from "./ignition-bloom";

// ─── First-run onboarding (ported from ~/poast-welcome-3.0/onboarding) ───────
// landing → [real Google OAuth] → theme → detail → bloom. Runs INSIDE the Intro
// gate so the app shell only mounts on completion. "Continue with Google" does a
// full-page redirect to /api/auth/google/start (real consent, or a guarded local
// dev sign-in); Google bounces back to /?signed_in=1, where this component reads
// /api/auth/me for the SERVER-VERIFIED email and resumes at the theme picker.
// That verified email maps to a canonical user; identity + theme are committed
// on the reveal's "Let's go", then onDone("home") renders the themed home (where
// OnboardingHost auto-fires the welcome tour). The legacy in-page Google chooser
// (`google` phase) is retained but no longer reached in the normal flow.

type Phase = "landing" | "google" | "theme" | "detail" | "bloom";

// Email → canonical poast-app user (USERS keys). Unmapped → the shared Analyst
// seat (mirrors the mockup ROLE_MAP collapsed onto named users).
const EMAIL_USER: Record<string, string> = {
  "akash@semianalysis.com": "Akash",
  "michelle@semianalysis.com": "Michelle",
  "vansh@semianalysis.com": "Vansh",
  "daksh@semianalysis.com": "Daksh",
};
// Nice display names for the seeded Google account card.
const EMAIL_DISPLAY: Record<string, string> = {
  "akash@semianalysis.com": "Akash Patel",
  "michelle@semianalysis.com": "Michelle",
  "vansh@semianalysis.com": "Vansh",
  "daksh@semianalysis.com": "Daksh",
};
function userForEmail(email: string): string {
  return EMAIL_USER[email.trim().toLowerCase()] || "Analyst";
}
function firstNameOf(name: string): string {
  return (name || "").trim().split(/\s+/)[0] || "";
}
function initialsOf(name: string): string {
  return (name || "").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "A";
}

const AURORA_BG =
  `radial-gradient(680px 460px at 20% 12%, ${C.amber}33, transparent 70%),` +
  `radial-gradient(760px 520px at 86% 88%, ${C.violet}2b, transparent 72%),` +
  `radial-gradient(520px 420px at 70% 18%, ${C.cyan}17, transparent 70%),` +
  `#06060C`;

export default function Onboarding({
  seedName,
  seedEmail,
  onDone,
}: {
  seedName?: string | null;
  seedEmail?: string | null;
  onDone: (sec?: string) => void;
}) {
  const userCtx = useUser();
  const themeCtx = useTheme();

  const [phase, setPhase] = useState<Phase>("landing");
  const [acct, setAcct] = useState<{ name: string; email: string } | null>(null);
  const [theme, setThemeSel] = useState<"stock" | "glass" | null>(null);
  const [bg, setBgSel] = useState<"aurora" | "iridescent" | "cockpit" | null>(null);
  const [layout, setLayoutSel] = useState<"clarity" | "depth" | null>(null);

  // The pre-seeded Google account (overridable via the per-role launcher).
  const initialEmail = (seedEmail || "akash@semianalysis.com").trim().toLowerCase();
  const initialName = (seedName || EMAIL_DISPLAY[initialEmail] || firstNameOf(initialEmail.split("@")[0])).trim() || "Akash Patel";

  // "Use another account" inline form (legacy stub chooser; unreached in the
  // real-OAuth flow but kept so the component stays self-contained).
  const [useOther, setUseOther] = useState(false);
  const [otherName, setOtherName] = useState("");
  const [otherEmail, setOtherEmail] = useState("");

  // We arrive back from Google at /?signed_in=1 — resolve the server-verified
  // identity and resume at the theme picker. ?auth=<code> reports a failure.
  const [resolving, setResolving] = useState<boolean>(() => {
    try { return new URLSearchParams(window.location.search).get("signed_in") === "1"; } catch { return false; }
  });
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const qs = new URLSearchParams(window.location.search);
    const strip = () => { try { window.history.replaceState({}, "", window.location.pathname + window.location.hash); } catch {} };
    const ae = qs.get("auth");
    if (ae) { setAuthError(ae); strip(); return; }
    if (qs.get("signed_in") !== "1") return;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d && d.signedIn && d.email) {
          setAcct({ name: (d.name || "").trim() || firstNameOf(d.email.split("@")[0]), email: String(d.email).toLowerCase() });
          setPhase("theme");
        } else {
          setAuthError("error");
        }
      })
      .catch(() => setAuthError("error"))
      .finally(() => { setResolving(false); strip(); });
  }, []);

  function signIn(name: string, email: string) {
    setAcct({ name: name.trim(), email: email.trim() });
    setPhase("theme");
  }

  function commitAndReveal() {
    setPhase("bloom");
  }

  function letsGo(typedName: string) {
    const email = acct ? acct.email : initialEmail;
    const userName = userForEmail(email);
    // Identity FIRST so the theme persist's currentOwner() resolves correctly.
    userCtx.setUser(userName, true);
    if (userName === "Analyst") {
      try { localStorage.setItem("poast-analyst-name", typedName || firstNameOf(acct?.name || "")); } catch {}
    }
    // Theme set before the app shell mounts (we're still inside the Intro gate).
    // Atomic setters avoid the stale-closure clobber two sequential setters hit.
    if (theme === "glass") themeCtx.setThemeMat("glass", layout || "clarity");
    else themeCtx.setThemeBg("stock", bg || "aurora");
    onDone("home");
  }

  // ── Bloom phase short-circuits the chrome ──
  if (phase === "bloom") {
    return (
      <IgnitionBloom
        name={firstNameOf(acct?.name || initialName)}
        returning={false}
        onLetsGo={letsGo}
      />
    );
  }

  // ── Resolving the Google round-trip (/?signed_in=1 → /api/auth/me) ──
  if (resolving && phase === "landing") {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: AURORA_BG, color: C.tx, fontFamily: ft, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
        <span style={{ width: 30, height: 30, borderRadius: "50%", border: "2.5px solid " + C.border, borderTopColor: C.amber, animation: "obSpin .8s linear infinite" }} />
        <div style={{ fontFamily: mn, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: C.txm }}>Signing you in…</div>
        <style dangerouslySetInnerHTML={{ __html: "@keyframes obSpin{to{transform:rotate(360deg)}}" }} />
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, overflow: "auto", background: AURORA_BG, color: C.tx, fontFamily: ft }}>
      <style dangerouslySetInnerHTML={{ __html:
        "@keyframes obFade{0%{opacity:0;transform:translateY(16px)}100%{opacity:1;transform:translateY(0)}}" +
        ".ob-screen{animation:obFade .5s cubic-bezier(.2,.7,.3,1) forwards}" +
        ".ob-opt{transition:transform .2s ease, border-color .2s ease, box-shadow .2s ease}" +
        ".ob-opt:hover{transform:translateY(-4px)}" +
        ".ob-gacct:hover{background:#f5f6f8}"
      }} />

      {/* top bar */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, padding: "22px 30px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 5, pointerEvents: "none" }}>
        <span style={{ fontFamily: gf, fontWeight: 800, fontSize: 19, letterSpacing: "0.04em", background: "linear-gradient(180deg,#FFFDF8,#C9B89C)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>POAST</span>
        <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: "0.26em", textTransform: "uppercase", color: C.txd, border: "1px solid " + C.border, borderRadius: 999, padding: "4px 12px", background: "rgba(255,255,255,.02)" }}>3.0 · test screening</span>
      </div>

      {/* back chevron */}
      {phase !== "landing" && (
        <button
          onClick={() => setPhase(phase === "google" ? "landing" : phase === "theme" ? "landing" : "theme")}
          style={{ position: "fixed", top: 84, left: 30, zIndex: 6, display: "inline-flex", alignItems: "center", gap: 6, fontFamily: mn, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: C.txm, background: "rgba(255,255,255,.03)", border: "1px solid " + C.border, borderRadius: 999, padding: "8px 14px", cursor: "pointer" }}
        >
          <ChevronLeft size={13} /> Back
        </button>
      )}

      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "96px 24px 64px" }}>

        {/* ── LANDING ── */}
        {phase === "landing" && (
          <div className="ob-screen" style={{ maxWidth: 780, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontFamily: mn, fontSize: 11, letterSpacing: "0.5em", textTransform: "uppercase", color: C.txm, marginBottom: 26 }}>Content operations, reimagined</div>
            <div style={{ fontFamily: gf, fontWeight: 800, fontSize: "clamp(64px,12vw,150px)", lineHeight: 0.9, letterSpacing: "-0.02em", background: "linear-gradient(180deg,#FFFDF8 0%,#F3ECE0 48%,#C0AE92 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", filter: "drop-shadow(0 0 50px rgba(247,176,65,.22))" }}>POAST</div>
            <div style={{ fontFamily: gf, fontWeight: 600, fontSize: "clamp(22px,3.1vw,38px)", maxWidth: "16ch", marginTop: 28, lineHeight: 1.1 }}>
              One home for everything you <span style={{ color: C.amber }}>produce, prep &amp; premier</span>.
            </div>
            <div style={{ fontSize: "clamp(14px,1.5vw,17px)", color: C.txm, fontWeight: 300, maxWidth: "48ch", marginTop: 18, lineHeight: 1.55 }}>
              Plan podcasts, draft posts, brief the team and ship — across every SemiAnalysis surface, in one calm cockpit.
            </div>
            <div style={{ marginTop: 38, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
              <button onClick={() => { window.location.href = "/api/auth/google/start"; }} style={{ display: "inline-flex", alignItems: "center", gap: 12, fontFamily: ft, fontWeight: 600, fontSize: 16, color: "#1f1f1f", background: "#fff", border: "none", borderRadius: 14, padding: "15px 26px", cursor: "pointer", boxShadow: "0 10px 34px rgba(0,0,0,.4)" }}>
                <GoogleG /> Continue with Google
              </button>
              {authError && (
                <div role="alert" style={{ fontFamily: ft, fontSize: 13, color: C.coral, background: C.coral + "14", border: "1px solid " + C.coral + "44", borderRadius: 10, padding: "9px 14px", maxWidth: "44ch", lineHeight: 1.45 }}>
                  {authError === "denied"
                    ? "That account isn’t allowed. Use your @semianalysis.com Google account."
                    : authError === "unconfigured"
                    ? "Google sign-in isn’t configured yet. Contact your admin."
                    : "Sign-in didn’t complete. Please try again."}
                </div>
              )}
              <div style={{ fontFamily: mn, fontSize: 10.5, letterSpacing: "0.1em", color: C.txd, maxWidth: "42ch" }}>
                Sign in with your <b style={{ color: C.amber, fontWeight: 500 }}>@semianalysis.com</b> account. Your workspace &amp; access are set up automatically.
              </div>
            </div>
          </div>
        )}

        {/* ── GOOGLE CHOOSER (stub) ── */}
        {phase === "google" && (
          <div className="ob-screen" style={{ maxWidth: 420, width: "100%" }}>
            <div style={{ background: "#fff", color: "#202124", borderRadius: 18, boxShadow: "0 24px 70px rgba(0,0,0,.55)", overflow: "hidden", fontFamily: "Roboto, Arial, " + ft }}>
              <div style={{ padding: "30px 28px 10px" }}>
                <GoogleWordmark />
                <div style={{ fontSize: 22, fontWeight: 400, marginTop: 16 }}>Choose an account</div>
                <div style={{ fontSize: 14, color: "#5f6368", marginTop: 4 }}>to continue to <b style={{ color: "#202124" }}>POAST</b></div>
              </div>
              <div>
                {!useOther && (
                  <div className="ob-gacct" onClick={() => signIn(initialName, initialEmail)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 28px", cursor: "pointer" }}>
                    <span style={{ width: 38, height: 38, borderRadius: "50%", display: "grid", placeItems: "center", color: "#fff", fontWeight: 700, fontSize: 14, background: "linear-gradient(135deg,#0B86D1,#2EAD8E)" }}>{initialsOf(initialName)}</span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 14, fontWeight: 500 }}>{initialName}</span>
                      <span style={{ display: "block", fontSize: 13, color: "#5f6368", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{initialEmail}</span>
                    </span>
                  </div>
                )}
                {!useOther ? (
                  <div onClick={() => setUseOther(true)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 28px", cursor: "pointer", borderTop: "1px solid #ecedef" }}>
                    <span style={{ width: 38, height: 38, borderRadius: "50%", display: "grid", placeItems: "center", border: "1px solid #dadce0", color: "#5f6368" }}><UserPlus size={18} /></span>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>Use another account</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "6px 28px 24px" }}>
                    <label style={{ fontSize: 12, color: "#5f6368" }}>Name</label>
                    <input autoFocus value={otherName} onChange={(e) => setOtherName(e.target.value)} placeholder="Jane Doe" style={gfield} />
                    <label style={{ fontSize: 12, color: "#5f6368" }}>Email</label>
                    <input type="email" value={otherEmail} onChange={(e) => setOtherEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submitOther(); }} placeholder="jane@company.com" style={gfield} />
                    <button onClick={submitOther} style={{ alignSelf: "flex-end", marginTop: 4, padding: "9px 22px", borderRadius: 8, border: "none", background: "#1a73e8", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Continue</button>
                  </div>
                )}
              </div>
              <div style={{ padding: "16px 28px 22px", fontSize: 12, color: "#5f6368", lineHeight: 1.5 }}>
                To continue, Google will share your name and email address with POAST. Before using this app, review POAST&apos;s <a style={{ color: "#1a73e8" }}>privacy policy</a> and <a style={{ color: "#1a73e8" }}>terms of service</a>.
              </div>
            </div>
            <div style={{ marginTop: 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: mn, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: C.txd }}>
              <Lock size={12} /> Demo sign-in · no real Google account used
            </div>
          </div>
        )}

        {/* ── THEME PICKER ── */}
        {phase === "theme" && (
          <div className="ob-screen" style={{ maxWidth: 920, width: "100%", textAlign: "center" }}>
            <div style={{ fontFamily: mn, fontSize: 10.5, letterSpacing: "0.32em", textTransform: "uppercase", color: C.txd }}>Step 1 of 2 · Your vibe</div>
            <div style={{ fontFamily: gf, fontWeight: 600, fontSize: "clamp(26px,3.6vw,42px)", marginTop: 10 }}>Choose how POAST feels.</div>
            <div style={{ fontSize: 15, color: C.txm, fontWeight: 300, maxWidth: "52ch", margin: "12px auto 0" }}>Two looks, same powerful cockpit. You can switch anytime in Settings.</div>
            <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap", marginTop: 40 }}>
              <OptTile
                on={theme === "stock"} onClick={() => setThemeSel("stock")} dot={C.amber} title="Studio" tag="· Fresh"
                desc="Focused & editorial. A sidebar, clean rows, and calm aurora backdrops that adapt to your role."
                preview={<div style={{ position: "absolute", inset: 0, background: `radial-gradient(120% 90% at 20% 0%, ${C.amber}38, transparent 60%), radial-gradient(120% 95% at 95% 100%, ${C.violet}33, transparent 62%), #0a0a12` }}>
                  <div style={{ position: "absolute", inset: 14, display: "flex", gap: 8 }}>
                    <div style={{ width: 34, background: "rgba(255,255,255,.05)", borderRadius: 8, display: "flex", flexDirection: "column", gap: 8, alignItems: "center", paddingTop: 10 }}>{[0, 1, 2].map((i) => <span key={i} style={{ width: 16, height: 16, borderRadius: 5, background: "rgba(255,255,255,.12)" }} />)}</div>
                    <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{[0, 1, 2, 3].map((i) => <span key={i} style={{ borderRadius: 8, background: i === 0 ? `linear-gradient(135deg, ${C.amber}66, transparent)` : "rgba(255,255,255,.06)" }} />)}</div>
                  </div>
                </div>}
              />
              <OptTile
                on={theme === "glass"} onClick={() => setThemeSel("glass")} dot={C.blue} title="Liquid Glass" tag="· Reflect"
                desc="Translucent depth & ambient light. A glass nav bar floats over a living, frosted workspace."
                preview={<div style={{ position: "absolute", inset: 0, background: `radial-gradient(120% 100% at 50% 0%, ${C.blue}42, transparent 64%), radial-gradient(120% 100% at 50% 100%, ${C.teal}2e, transparent 64%), #0b0c14` }}>
                  <div style={{ position: "absolute", inset: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ height: 18, borderRadius: 7, background: "rgba(255,255,255,.1)", backdropFilter: "blur(6px)" }} />
                    <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>{[0, 1, 2].map((i) => <span key={i} style={{ borderRadius: 8, background: "rgba(255,255,255,.09)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.18)" }} />)}</div>
                  </div>
                </div>}
              />
            </div>
            <NextBtn disabled={!theme} onClick={() => { setBgSel(null); setLayoutSel(null); setPhase("detail"); }} label="Continue" />
          </div>
        )}

        {/* ── DETAIL PICKER (theme-conditional) ── */}
        {phase === "detail" && (
          <div className="ob-screen" style={{ maxWidth: 920, width: "100%", textAlign: "center" }}>
            <div style={{ fontFamily: mn, fontSize: 10.5, letterSpacing: "0.32em", textTransform: "uppercase", color: C.txd }}>Step 2 of 2</div>
            <div style={{ fontFamily: gf, fontWeight: 600, fontSize: "clamp(26px,3.6vw,42px)", marginTop: 10 }}>{theme === "glass" ? "Pick your layout." : "Pick your backdrop."}</div>
            <div style={{ fontSize: 15, color: C.txm, fontWeight: 300, maxWidth: "52ch", margin: "12px auto 0" }}>{theme === "glass" ? "How your glass workspace opens. Switch anytime in Settings." : "Each one recolors to your role. Purely cosmetic — change it whenever."}</div>
            <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap", marginTop: 40 }}>
              {theme === "stock" ? (
                <>
                  <OptTile on={bg === "aurora"} onClick={() => setBgSel("aurora")} dot={C.amber} title="Aurora" desc="Frosted, smoky flow — the calm default." preview={<div style={{ position: "absolute", inset: 0, background: "linear-gradient(120deg,#2a1d3a,#102236 52%,#3a2a12)", filter: "saturate(1.15)" }} />} />
                  <OptTile on={bg === "iridescent"} onClick={() => setBgSel("iridescent")} dot={C.teal} title="Iridescent" desc="A slow oil-slick sheen. Quiet and luminous." preview={<div style={{ position: "absolute", inset: 0, background: "conic-gradient(from 120deg,#2a1330,#0f2a26 30%,#102236 60%,#2a1330)", filter: "saturate(1.35)" }} />} />
                  <OptTile on={bg === "cockpit"} onClick={() => setBgSel("cockpit")} dot={C.blue} title="Cockpit" desc="Command-center HUD — grid, glow & scan line." preview={<div style={{ position: "absolute", inset: 0, background: `radial-gradient(120% 90% at 30% 0%, ${C.blue}57, transparent 64%), #0a0a12` }}><div style={{ position: "absolute", inset: 0, background: `linear-gradient(${C.blue}29 1px, transparent 1px) 0 0/22px 22px, linear-gradient(90deg, ${C.blue}29 1px, transparent 1px) 0 0/22px 22px`, WebkitMaskImage: "radial-gradient(120% 100% at 50% 40%, #000 50%, transparent 90%)", maskImage: "radial-gradient(120% 100% at 50% 40%, #000 50%, transparent 90%)" }} /></div>} />
                </>
              ) : (
                <>
                  <OptTile on={layout === "clarity"} onClick={() => setLayoutSel("clarity")} dot={C.blue} title="Glass home" desc="A glass nav bar over your shelves. Bright & direct." preview={<div style={{ position: "absolute", inset: 0, background: `radial-gradient(120% 100% at 50% 0%, ${C.blue}42, transparent 64%), #0b0c14` }}><div style={{ position: "absolute", inset: 14, display: "flex", flexDirection: "column", gap: 8 }}><div style={{ height: 18, borderRadius: 7, background: "rgba(255,255,255,.1)" }} /><div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>{[0, 1, 2].map((i) => <span key={i} style={{ borderRadius: 8, background: "rgba(255,255,255,.09)" }} />)}</div></div></div>} />
                  <OptTile on={layout === "depth"} onClick={() => setLayoutSel("depth")} dot={C.teal} title="Ambient lock" desc="A lock-screen feel — clock, then scroll to your shelves." preview={<div style={{ position: "absolute", inset: 0, background: `radial-gradient(120% 100% at 50% 0%, ${C.teal}33, transparent 64%), #0b0c14`, display: "grid", placeItems: "center" }}><div style={{ fontFamily: gf, fontWeight: 600, fontSize: 34, color: "rgba(255,255,255,.92)" }}>9:41</div></div>} />
                </>
              )}
            </div>
            <NextBtn disabled={theme === "stock" ? !bg : !layout} onClick={commitAndReveal} label="Reveal my POAST" />
          </div>
        )}
      </div>

      {/* footer */}
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 18, textAlign: "center", fontFamily: mn, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: C.txd, zIndex: 5 }}>
        POAST 3.0 — test screening
      </div>
    </div>
  );

  function submitOther() {
    const n = otherName.trim();
    if (!n) return;
    const e = otherEmail.trim() || (firstNameOf(n).toLowerCase() + "@gmail.com");
    signIn(n, e);
  }
}

const gfield: React.CSSProperties = {
  width: "100%", padding: "10px 12px", border: "1px solid #dadce0", borderRadius: 6,
  fontSize: 14, color: "#202124", outline: "none", boxSizing: "border-box",
};

function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function GoogleWordmark() {
  return (
    <span style={{ display: "inline-flex", gap: 1, fontFamily: "Arial, sans-serif", fontWeight: 500, fontSize: 22, letterSpacing: "-0.5px" }}>
      <span style={{ color: "#4285F4" }}>G</span>
      <span style={{ color: "#EA4335" }}>o</span>
      <span style={{ color: "#FBBC05" }}>o</span>
      <span style={{ color: "#4285F4" }}>g</span>
      <span style={{ color: "#34A853" }}>l</span>
      <span style={{ color: "#EA4335" }}>e</span>
    </span>
  );
}

function OptTile({ on, onClick, dot, title, tag, desc, preview }: { on: boolean; onClick: () => void; dot: string; title: string; tag?: string; desc: string; preview: React.ReactNode }) {
  return (
    <div className="ob-opt" onClick={onClick} style={{ width: 300, background: C.card, border: "1px solid " + (on ? C.amber : C.border), borderRadius: 20, cursor: "pointer", overflow: "hidden", boxShadow: on ? `0 0 0 1px ${C.amber}, 0 18px 50px ${C.amber}29` : "0 2px 12px rgba(0,0,0,.3)" }}>
      <div style={{ position: "relative", height: 158 }}>
        {preview}
        <span style={{ position: "absolute", top: 12, right: 12, width: 24, height: 24, borderRadius: 8, display: on ? "grid" : "none", placeItems: "center", background: C.amber, color: "#1a1208" }}><Check size={15} strokeWidth={3} /></span>
      </div>
      <div style={{ padding: "16px 18px", textAlign: "left" }}>
        <div style={{ fontFamily: gf, fontWeight: 700, fontSize: 18, display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: dot }} />{title}{tag && <span style={{ color: C.txm, fontWeight: 400, fontSize: 14 }}>{tag}</span>}
        </div>
        <div style={{ fontSize: 13.5, color: C.txm, fontWeight: 300, marginTop: 7, lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  );
}

function NextBtn({ disabled, onClick, label }: { disabled: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={() => { if (!disabled) onClick(); }} disabled={disabled} style={{ marginTop: 40, display: "inline-flex", alignItems: "center", gap: 9, fontFamily: gf, fontWeight: 600, fontSize: 16, color: "#1a1208", background: `linear-gradient(135deg,#FFC766,${C.amber})`, border: "none", borderRadius: 14, padding: "15px 30px", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1, boxShadow: disabled ? "none" : `0 12px 34px ${C.amber}52, inset 0 1px 0 rgba(255,255,255,.4)` }}>
      {label} <span>→</span>
    </button>
  );
}
