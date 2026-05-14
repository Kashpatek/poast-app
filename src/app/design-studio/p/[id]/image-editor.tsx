"use client";

// Filerobot Image Editor wrapper for the Image Studio gallery.
// MIT-licensed React component (react-filerobot-image-editor) loaded
// dynamically so SSR doesn't fight its window-touching internals.
// The wrapper sits inside a fullscreen modal launched by the gallery's
// per-variant "Edit" button.

import React, { useCallback } from "react";
import dynamic from "next/dynamic";
import { D, ft, mn } from "../../../shared-constants";

// SSR-safe dynamic import. The library reaches for `window` at module
// load time, which is fine since we only mount it in the browser.
// We type the dynamic component loosely because the upstream types are
// strict but we feed a subset of props.
const FilerobotImageEditor = dynamic(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  () => import("react-filerobot-image-editor").then((mod) => mod.default as any),
  { ssr: false }
) as unknown as React.ComponentType<Record<string, unknown>>;

// Map from the library's tab string to the constants the SDK expects.
// Kept loose because the third-party types are not the cleanest.
const TABS = ["Adjust", "Filters", "Finetune", "Annotate", "Watermark", "Resize"] as const;

export interface ImageEditorModalProps {
  open: boolean;
  source: string;          // URL or data: URI of the variant being edited
  onClose: () => void;
  onSave: (editedDataUrl: string, name: string) => Promise<void> | void;
}

export function ImageEditorModal({ open, source, onClose, onSave }: ImageEditorModalProps) {
  const handleSave = useCallback(
    async (editedImageObject: { imageBase64?: string; fullName?: string }) => {
      if (!editedImageObject?.imageBase64) {
        onClose();
        return;
      }
      const name = editedImageObject.fullName || "edited.png";
      await onSave(editedImageObject.imageBase64, name);
      onClose();
    },
    [onSave, onClose]
  );

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 15000,
        background: "rgba(6,6,12,0.92)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 24px",
          borderBottom: `1px solid ${D.border}`,
          background: "rgba(6,6,12,0.9)",
        }}
      >
        <div style={{ fontFamily: mn, fontSize: 11, letterSpacing: 1.4, color: D.amber }}>
          IMAGE EDITOR
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: "transparent",
            color: D.tx,
            border: `1px solid ${D.border}`,
            padding: "8px 14px",
            borderRadius: 8,
            fontFamily: ft,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <FilerobotImageEditor
          source={source}
          onSave={handleSave}
          onClose={onClose}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tabsIds={TABS as any}
          defaultTabId={"Adjust" as unknown as undefined}
          defaultToolId={"Crop" as unknown as undefined}
          theme={{
            palette: {
              "bg-primary": D.bg,
              "bg-secondary": D.card,
              "accent-primary": D.amber,
              "icons-primary": D.tx,
              "icons-secondary": D.txm,
              "borders-primary": D.border,
              "borders-secondary": D.border,
              "light-shadow": "rgba(0,0,0,0.5)",
              "warning": D.coral,
            },
            typography: {
              fontFamily: ft,
            },
          }}
          // We force PNG output for now — easy to extend to JPEG/WebP later.
          savingPixelRatio={1}
          previewPixelRatio={window.devicePixelRatio || 1}
        />
      </div>
    </div>
  );
}
