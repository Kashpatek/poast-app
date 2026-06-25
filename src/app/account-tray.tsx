"use client";
// ─── Account tray ────────────────────────────────────────────────────────────
// Press the signed-in name/avatar → a frosted tray pops out (anchored to the
// trigger, scrollable, dismissed by clicking off or Esc). It carries:
//   • who you are (avatar + name + role)
//   • Appearance — a toggle that expands to the theme choices for a quick switch
//     (+ contextual backdrop/home options), with a link to full settings
//   • quick tools (open Settings, replay the guided tour)
//   • Sign out
// Self-contained: it renders its OWN trigger (variant: glass avatar pill vs
// sidebar footer row) so it can drop straight into GlassTopNav / Sidebar without
// lifting any state. Navigation is the existing window "poast-nav" event.
import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Palette, Settings, RotateCcw, LogOut, ChevronDown, Check, Lock } from "lucide-react";
import { D as C, ft, gf, mn } from "./shared-constants";
import { useUser, isAnalyst, isAkash } from "./user-context";
import { useTheme, playThemeTransitionAndReload, type ThemeName, type BgName, type GlassMat } from "./theme-context";

const THEME_CHOICES: { id: ThemeName; name: string; sw: string }[] = [
  { id: "stock", name: "Fresh", sw: "linear-gradient(135deg,#D1334A,#905CCB 55%,#2E6BE6)" },
  { id: "glass", name: "Reflect", sw: "linear-gradient(135deg,rgba(52,166,230,.55),rgba(46,173,142,.45))" },
  { id: "classic", name: "Classic", sw: "linear-gradient(135deg,#15151c,#09090d)" },
];
const BG_CHOICES: { id: BgName; name: string }[] = [
  { id: "aurora", name: "Aurora" },
  { id: "iridescent", name: "Iridescent" },
  { id: "cockpit", name: "Cockpit" },
];
const MAT_CHOICES: { id: GlassMat; name: string }[] = [
  { id: "clarity", name: "Clarity" },
  { id: "depth", name: "Depth" },
];

function initialsOf(name: string): string {
  const p = (name || "").trim().split(/\s+/);
  return (p.length > 1 ? p[0][0] + p[1][0] : (name || "").slice(0, 2)).toUpperCase() || "P";
}

export default function AccountTray({ variant }: { variant: "glass" | "sidebar" | "hero" }) {
  const userCtx = useUser();
  const themeCtx = useTheme();
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [pos, setPos] = useState<React.CSSProperties | null>(null);

  const user = userCtx.user;
  const analyst = isAnalyst(user);
  const name = user ? user.name : "";
  const role = user ? user.role : "";
  const initials = initialsOf(name);

  // Position the card from the trigger's rect: drop down from a top anchor (glass
  // avatar), pop up from a bottom anchor (sidebar footer); right-align when the
  // trigger sits on the right edge. Recomputed on open + resize/scroll.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth, vh = window.innerHeight, W = 300, gap = 10, pad = 12;
      const below = r.top < vh / 2;
      const alignRight = (r.left + r.right) / 2 > vw / 2;
      const s: React.CSSProperties = { position: "fixed", width: W };
      if (below) { s.top = Math.round(r.bottom + gap); s.maxHeight = Math.min(580, vh - r.bottom - gap - pad); }
      else { s.bottom = Math.round(vh - r.top + gap); s.maxHeight = Math.min(580, r.top - gap - pad); }
      if (alignRight) s.right = Math.round(Math.max(pad, vw - r.right)); else s.left = Math.round(Math.max(pad, r.left));
      setPos(s);
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open]);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);
  const navTo = (id: string) => { close(); setTimeout(() => window.dispatchEvent(new CustomEvent("poast-nav", { detail: id })), 0); };
  const replayTour = () => { close(); setTimeout(() => window.dispatchEvent(new Event("poast:replay-tour")), 60); };
  const signOut = () => { try { fetch("/api/auth/signout", { method: "POST" }); } catch { /* noop */ } userCtx.setUser(null); };

  const pickTheme = (t: ThemeName) => {
    if (t === themeCtx.theme) return;
    if (t === "glass") themeCtx.setThemeMat("glass", "clarity"); else themeCtx.setTheme(t);
    const nm = THEME_CHOICES.find((x) => x.id === t)?.name || "your look";
    playThemeTransitionAndReload("Switching to " + nm); // reloads to lock in the look
  };
  const pickBg = (b: BgName) => themeCtx.setBg(b); // live, no reload
  const pickMat = (m: GlassMat) => {
    if (m === themeCtx.glassMat) return;
    themeCtx.setGlassMat(m);
    playThemeTransitionAndReload("Switching to Reflect · " + (MAT_CHOICES.find((x) => x.id === m)?.name || ""));
  };

  if (!user) return null;

  // Short role label used on the home hero pill (Admin / Marketing / Analyst).
  const shortRole = analyst ? "Analyst" : isAkash(user) ? "Admin" : "Marketing";
  const toggle = () => setOpen((o) => !o);

  // ── Trigger (variant-specific, visually identical to the old name element) ──
  let trigger: React.ReactNode;
  if (variant === "glass") {
    trigger = (
      <div
        ref={triggerRef}
        className="gnav-user"
        onClick={toggle}
        title="Account"
        aria-haspopup="menu"
        aria-expanded={open}
        style={open ? { background: "rgba(255,255,255,.12)" } : undefined}
      >
        <span className="gnav-av">{initials}</span>
      </div>
    );
  } else if (variant === "hero") {
    trigger = (
      <div
        ref={triggerRef}
        onClick={toggle}
        title="Account"
        aria-haspopup="menu"
        aria-expanded={open}
        style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "7px 10px 7px 8px", borderRadius: 999, cursor: "pointer", background: open ? "rgba(13,12,22,0.8)" : "rgba(13,12,22,0.6)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", transition: "background .15s" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(13,12,22,0.82)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = open ? "rgba(13,12,22,0.8)" : "rgba(13,12,22,0.6)"; }}
      >
        <span style={{ width: 28, height: 28, borderRadius: 999, display: "grid", placeItems: "center", fontFamily: gf, fontWeight: 800, fontSize: 12, color: "#0b0b11", background: "linear-gradient(135deg, " + C.amber + ", " + C.coral + ")" }}>{initials}</span>
        <span style={{ lineHeight: 1.05 }}>
          <span style={{ display: "block", fontFamily: ft, fontWeight: 600, fontSize: 13, color: C.tx }}>{name || "POAST"}</span>
          <span style={{ display: "block", fontFamily: mn, fontSize: 8.5, letterSpacing: 1, textTransform: "uppercase", color: C.txm }}>{shortRole}</span>
        </span>
        <ChevronDown size={13} color={C.txm} style={{ marginLeft: 1, transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
      </div>
    );
  } else {
    trigger = (
      <div
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        title="Account"
        aria-haspopup="menu"
        aria-expanded={open}
        style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "6px 8px", borderRadius: 6, cursor: "pointer", background: open ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.04)" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = open ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)"; }}
      >
        <div style={{ width: 22, height: 22, borderRadius: 6, background: analyst ? "#905CCB20" : C.amber + "20", border: "1px solid " + (analyst ? "#905CCB40" : C.amber + "40"), display: "flex", alignItems: "center", justifyContent: "center", fontFamily: ft, fontSize: 10, fontWeight: 800, color: analyst ? "#905CCB" : C.amber }}>{name[0]}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: ft, fontSize: 11, fontWeight: 700, color: "#E8E4DD", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
          <div style={{ fontFamily: ft, fontSize: 8, fontWeight: 600, color: "rgba(255,255,255,0.35)", letterSpacing: 1 }}>{role}</div>
        </div>
        <ChevronDown size={13} color="rgba(255,255,255,0.4)" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
      </div>
    );
  }

  // ── Tray (portaled) ──
  const accent = analyst ? "#905CCB" : C.amber;
  const tray = open && typeof document !== "undefined" && pos
    ? createPortal(
      <>
        {/* click-off catcher */}
        <div onMouseDown={close} style={{ position: "fixed", inset: 0, zIndex: 2147483600, background: "transparent" }} aria-hidden />
        <div
          role="menu"
          data-glass
          style={{
            ...pos,
            zIndex: 2147483601,
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            borderRadius: 16,
            background: "linear-gradient(180deg, rgba(26,24,38,0.94), rgba(16,15,24,0.96))",
            backdropFilter: "blur(24px) saturate(1.5)",
            WebkitBackdropFilter: "blur(24px) saturate(1.5)",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 24px 70px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)",
            color: C.tx,
            fontFamily: ft,
            animation: "acctIn .16s cubic-bezier(.2,.7,.3,1)",
          }}
        >
          <style dangerouslySetInnerHTML={{ __html: "@keyframes acctIn{0%{opacity:0;transform:translateY(-6px) scale(.98)}100%{opacity:1;transform:none}}" }} />

          {/* header */}
          <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "15px 16px 13px" }}>
            <span style={{ width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", fontFamily: gf, fontWeight: 800, fontSize: 14, color: "#1a1206", background: "linear-gradient(150deg," + accent + ",#E06347)", flexShrink: 0 }}>{initials}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: gf, fontWeight: 700, fontSize: 15, lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
              <div style={{ fontFamily: mn, fontSize: 9.5, letterSpacing: ".12em", textTransform: "uppercase", color: C.txm, marginTop: 3 }}>{role}</div>
            </div>
          </div>

          <Divider />

          {/* Appearance — toggle reveals the quick theme choices */}
          <button onClick={() => setShowAppearance((v) => !v)} style={rowBtn}>
            <Palette size={15} color={C.txm} />
            <span style={{ flex: 1, textAlign: "left", fontWeight: 600, fontSize: 13 }}>Appearance</span>
            <span style={{ fontFamily: mn, fontSize: 10, color: C.txm, textTransform: "capitalize" }}>{THEME_CHOICES.find((t) => t.id === themeCtx.theme)?.name || themeCtx.theme}</span>
            <ChevronDown size={14} color={C.txm} style={{ transform: showAppearance ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
          </button>

          {showAppearance && (
            <div style={{ padding: "2px 14px 12px", animation: "acctIn .16s ease" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7 }}>
                {THEME_CHOICES.map((t) => {
                  const on = themeCtx.theme === t.id;
                  return (
                    <button key={t.id} onClick={() => pickTheme(t.id)} title={t.name} style={{ position: "relative", cursor: "pointer", borderRadius: 10, overflow: "hidden", padding: 0, border: "1px solid " + (on ? accent : C.border), boxShadow: on ? "0 0 0 1px " + accent : "none", background: "transparent" }}>
                      <div style={{ height: 40, background: t.sw }} />
                      <div style={{ padding: "5px 0 6px", fontFamily: ft, fontSize: 10.5, fontWeight: 600, color: on ? accent : C.txm, background: C.surface }}>{t.name}</div>
                      {on && <span style={{ position: "absolute", top: 5, right: 5, width: 16, height: 16, borderRadius: 999, background: accent, color: "#1a1206", display: "grid", placeItems: "center" }}><Check size={10} strokeWidth={3} /></span>}
                    </button>
                  );
                })}
              </div>

              {/* contextual sub-choice: Stock backdrop (live) or Glass home layout */}
              {themeCtx.theme === "stock" && (
                <SubRow label="Backdrop">
                  {BG_CHOICES.map((b) => (
                    <Chip key={b.id} on={themeCtx.bg === b.id} accent={accent} onClick={() => pickBg(b.id)}>{b.name}</Chip>
                  ))}
                </SubRow>
              )}
              {themeCtx.theme === "glass" && (
                <SubRow label="Home">
                  {MAT_CHOICES.map((m) => (
                    <Chip key={m.id} on={themeCtx.glassMat === m.id} accent={accent} onClick={() => pickMat(m.id)}>{m.name}</Chip>
                  ))}
                </SubRow>
              )}

              {!analyst && (
                <button onClick={() => navTo("settings")} style={{ marginTop: 11, width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", fontFamily: mn, fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: C.txm, padding: "2px 2px" }}>
                  All appearance settings →
                </button>
              )}
            </div>
          )}

          <Divider />

          {/* quick tools */}
          {!analyst && (
            <button onClick={() => navTo("settings")} style={rowBtn}>
              <Settings size={15} color={C.txm} />
              <span style={{ flex: 1, textAlign: "left", fontWeight: 600, fontSize: 13 }}>Settings</span>
            </button>
          )}
          <button onClick={replayTour} style={rowBtn}>
            <RotateCcw size={15} color={C.txm} />
            <span style={{ flex: 1, textAlign: "left", fontWeight: 600, fontSize: 13 }}>Replay the tour</span>
          </button>

          <Divider />

          {/* sign out */}
          <button onClick={signOut} style={{ ...rowBtn, color: "#E06347" }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(224,99,71,0.10)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
            {analyst ? <Lock size={15} color="#E06347" /> : <LogOut size={15} color="#E06347" />}
            <span style={{ flex: 1, textAlign: "left", fontWeight: 600, fontSize: 13 }}>{analyst ? "Lock studio" : "Sign out"}</span>
          </button>
          <div style={{ height: 6 }} />
        </div>
      </>,
      document.body
    )
    : null;

  return (
    <>
      {trigger}
      {tray}
    </>
  );
}

const rowBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 11, width: "100%",
  padding: "11px 16px", background: "transparent", border: "none", cursor: "pointer",
  color: "inherit", fontFamily: "var(--ft, sans-serif)", transition: "background .14s",
};

function Divider() {
  return <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "0 0" }} />;
}

function SubRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 11 }}>
      <div style={{ fontFamily: mn, fontSize: 9, letterSpacing: ".16em", textTransform: "uppercase", color: C.txd, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}

function Chip({ on, accent, onClick, children }: { on: boolean; accent: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ cursor: "pointer", borderRadius: 999, padding: "5px 12px", fontFamily: mn, fontSize: 10, letterSpacing: ".04em", fontWeight: 600, textTransform: "uppercase", border: "1px solid " + (on ? accent : C.border), background: on ? accent + "1c" : "transparent", color: on ? accent : C.txm }}>
      {children}
    </button>
  );
}
