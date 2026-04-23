"use client";
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { D as C, ft, mn } from "./shared-constants";

interface ConfirmOpts { title?: string; body: string; cta?: string; cancel?: string; variant?: "danger" | "primary" }
interface PromptOpts { title?: string; body?: string; placeholder?: string; initial?: string; cta?: string }

interface DialogContextValue {
  confirm: (o: ConfirmOpts) => Promise<boolean>;
  prompt: (o: PromptOpts) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

// Module-level ref so non-hook code can call these directly
const _global: { current: DialogContextValue | null } = { current: null };
export function confirmDialog(o: ConfirmOpts): Promise<boolean> {
  return _global.current ? _global.current.confirm(o) : Promise.resolve(false);
}
export function promptDialog(o: PromptOpts): Promise<string | null> {
  return _global.current ? _global.current.prompt(o) : Promise.resolve(null);
}
export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within a DialogProvider");
  return ctx;
}

interface ConfirmState extends ConfirmOpts { resolve: (v: boolean) => void }
interface PromptState extends PromptOpts { resolve: (v: string | null) => void; value: string }

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [cs, setCs] = useState<ConfirmState | null>(null);
  const [ps, setPs] = useState<PromptState | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const confirm = useCallback(
    (o: ConfirmOpts) =>
      new Promise<boolean>((resolve) => {
        setCs({ ...o, resolve });
      }),
    [],
  );
  const prompt = useCallback(
    (o: PromptOpts) =>
      new Promise<string | null>((resolve) => {
        setPs({ ...o, resolve, value: o.initial || "" });
      }),
    [],
  );

  // Keep the global ref in sync
  _global.current = { confirm, prompt };

  const closeConfirm = (result: boolean) => {
    if (!cs) return;
    cs.resolve(result);
    setCs(null);
  };
  const closePrompt = (result: string | null) => {
    if (!ps) return;
    ps.resolve(result);
    setPs(null);
  };

  // Global Escape handler while either dialog is open
  useEffect(() => {
    if (!cs && !ps) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (cs) closeConfirm(false);
        if (ps) closePrompt(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cs, ps]);

  // Autofocus prompt input
  useEffect(() => {
    if (ps) setTimeout(() => inputRef.current?.select(), 20);
  }, [ps]);

  const overlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(6,6,12,0.72)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    zIndex: 11000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    animation: "dlgFade 0.18s ease forwards",
  };
  const panel: React.CSSProperties = {
    width: "min(420px, 92vw)",
    background: "#0A0A14",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: "22px 22px 18px",
    boxShadow: "0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(247,176,65,0.05)",
    animation: "dlgPop 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards",
    opacity: 0,
  };
  const titleStyle: React.CSSProperties = {
    fontFamily: ft,
    fontSize: 16,
    fontWeight: 800,
    color: "#E8E4DD",
    marginBottom: 8,
    letterSpacing: -0.2,
  };
  const bodyStyle: React.CSSProperties = {
    fontFamily: ft,
    fontSize: 13,
    fontWeight: 500,
    color: "rgba(232,228,221,0.75)",
    lineHeight: 1.5,
    marginBottom: 18,
  };
  const actionRow: React.CSSProperties = { display: "flex", gap: 8, justifyContent: "flex-end" };
  const cancelBtn: React.CSSProperties = {
    padding: "10px 16px",
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 7,
    color: "rgba(255,255,255,0.7)",
    fontFamily: ft,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: 0.3,
  };
  const primaryBtn: React.CSSProperties = {
    padding: "10px 18px",
    background: C.amber,
    border: "none",
    borderRadius: 7,
    color: "#060608",
    fontFamily: ft,
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    letterSpacing: 0.3,
  };
  const dangerBtn: React.CSSProperties = { ...primaryBtn, background: "#E06347", color: "#ffffff" };
  const inputBox: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    background: "#060610",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8,
    color: "#E8E4DD",
    fontFamily: mn,
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
    marginBottom: 14,
  };

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}
      <style dangerouslySetInnerHTML={{ __html: "@keyframes dlgFade{from{opacity:0}to{opacity:1}}@keyframes dlgPop{0%{opacity:0;transform:translateY(8px) scale(0.98)}100%{opacity:1;transform:translateY(0) scale(1)}}" }} />

      {cs && (
        <div style={overlay} onClick={() => closeConfirm(false)}>
          <div style={panel} onClick={(e) => e.stopPropagation()}>
            {cs.title && <div style={titleStyle}>{cs.title}</div>}
            <div style={bodyStyle}>{cs.body}</div>
            <div style={actionRow}>
              <button onClick={() => closeConfirm(false)} style={cancelBtn}>{cs.cancel || "Cancel"}</button>
              <button
                onClick={() => closeConfirm(true)}
                style={cs.variant === "danger" ? dangerBtn : primaryBtn}
                autoFocus
              >
                {cs.cta || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {ps && (
        <div style={overlay} onClick={() => closePrompt(null)}>
          <div style={panel} onClick={(e) => e.stopPropagation()}>
            {ps.title && <div style={titleStyle}>{ps.title}</div>}
            {ps.body && <div style={{ ...bodyStyle, marginBottom: 10 }}>{ps.body}</div>}
            <input
              ref={inputRef}
              value={ps.value}
              placeholder={ps.placeholder}
              onChange={(e) => setPs((prev) => (prev ? { ...prev, value: e.target.value } : prev))}
              onKeyDown={(e) => {
                if (e.key === "Enter") closePrompt(ps.value);
                if (e.key === "Escape") closePrompt(null);
              }}
              autoFocus
              style={inputBox}
            />
            <div style={actionRow}>
              <button onClick={() => closePrompt(null)} style={cancelBtn}>Cancel</button>
              <button onClick={() => closePrompt(ps.value)} style={primaryBtn}>{ps.cta || "OK"}</button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}
