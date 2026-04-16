"use client";
import React, { createContext, useContext, useState, useCallback, useRef } from "react";

interface ToastContextValue {
  showToast: (msg: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Module-level ref so non-component code (e.g. ask()) can call showToast
const _globalToast: { current: ((msg: string) => void) | null } = { current: null };

export function showToast(msg: string): void {
  if (_globalToast.current) _globalToast.current(msg);
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleShow = useCallback((m: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMsg(m);
    timerRef.current = setTimeout(() => {
      setMsg(null);
    }, 6000);
  }, []);

  // Keep the global ref in sync
  _globalToast.current = handleShow;

  return (
    <ToastContext.Provider value={{ showToast: handleShow }}>
      {children}
      {msg && (
        <div
          onClick={() => setMsg(null)}
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 10000,
            maxWidth: 420,
            padding: "14px 20px",
            background: "rgba(224,99,71,0.13)",
            border: "1px solid #E06347",
            borderRadius: 8,
            fontFamily: "'JetBrains Mono',monospace",
            fontSize: 11,
            color: "#E06347",
            cursor: "pointer",
            boxShadow: "0 0 20px rgba(224,99,71,0.2)",
            lineHeight: 1.5,
          }}
        >
          {msg}
        </div>
      )}
    </ToastContext.Provider>
  );
}
