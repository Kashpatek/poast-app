"use client";
import React, { createContext, useContext } from "react";
import { Toaster, toast as sonnerToast } from "sonner";
import { D, mn } from "./shared-constants";

type ToastKind = "info" | "success" | "error";

interface ToastContextValue {
  showToast: (msg: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function dispatch(msg: string, kind?: ToastKind): void {
  if (kind === "success") sonnerToast.success(msg);
  else if (kind === "error") sonnerToast.error(msg);
  else sonnerToast(msg);
}

export function showToast(msg: string, kind?: ToastKind): void {
  dispatch(msg, kind);
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <ToastContext.Provider value={{ showToast: dispatch }}>
      {children}
      <Toaster
        position="bottom-center"
        theme="dark"
        richColors
        closeButton
        duration={6000}
        toastOptions={{
          style: {
            background: D.card,
            border: "1px solid " + D.border,
            color: D.tx,
            fontFamily: mn,
            fontSize: 11,
            lineHeight: 1.5,
            boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
          },
        }}
        style={{
          // @ts-expect-error sonner reads these CSS vars to theme richColors
          "--normal-bg": D.card,
          "--normal-border": D.border,
          "--normal-text": D.tx,
          "--success-bg": D.card,
          "--success-border": D.teal,
          "--success-text": D.teal,
          "--error-bg": D.card,
          "--error-border": D.coral,
          "--error-text": D.coral,
        }}
      />
    </ToastContext.Provider>
  );
}
