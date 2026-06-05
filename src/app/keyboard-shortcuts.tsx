"use client";

import React, { useState, useEffect } from "react";
import { tinykeys } from "tinykeys";
import { D as C, ft, gf, mn } from "./shared-constants";

export interface ShortcutEntry {
  description: string;
  handler: () => void;
}

export type ShortcutMap = Record<string, ShortcutEntry>;

interface RegistryEntry {
  scope: string;
  binding: string;
  description: string;
}

var registry: RegistryEntry[] = [];
var listeners: Array<() => void> = [];

function notify(): void {
  for (var i = 0; i < listeners.length; i++) listeners[i]();
}

function subscribe(fn: () => void): () => void {
  listeners.push(fn);
  return function() {
    var idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

function snapshot(): RegistryEntry[] {
  return registry.slice();
}

function isEditableTarget(t: EventTarget | null): boolean {
  if (!t || !(t as HTMLElement).tagName) return false;
  var el = t as HTMLElement;
  var tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

export function useShortcuts(map: ShortcutMap, options?: { scope?: string }): void {
  useEffect(function() {
    var scope = (options && options.scope) || "General";
    var bindings: Record<string, (e: KeyboardEvent) => void> = {};
    var entries: RegistryEntry[] = [];
    var keys = Object.keys(map);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var entry = map[k];
      entries.push({ scope: scope, binding: k, description: entry.description });
      bindings[k] = (function(h: () => void) {
        return function(e: KeyboardEvent) {
          if (isEditableTarget(e.target)) return;
          e.preventDefault();
          h();
        };
      })(entry.handler);
    }
    for (var j = 0; j < entries.length; j++) registry.push(entries[j]);
    notify();
    var unbind = tinykeys(window, bindings);
    return function() {
      unbind();
      for (var k2 = 0; k2 < entries.length; k2++) {
        var idx = registry.indexOf(entries[k2]);
        if (idx >= 0) registry.splice(idx, 1);
      }
      notify();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function formatBinding(b: string): string[] {
  var sequences = b.split(" ");
  var parts: string[] = [];
  var isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  for (var s = 0; s < sequences.length; s++) {
    var seq = sequences[s];
    var keys = seq.split("+");
    var human: string[] = [];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k === "$mod") human.push(isMac ? "⌘" : "Ctrl");
      else if (k === "Meta") human.push("⌘");
      else if (k === "Control") human.push("Ctrl");
      else if (k === "Alt") human.push(isMac ? "⌥" : "Alt");
      else if (k === "Shift") human.push("⇧");
      else if (k === "Enter") human.push("Enter");
      else if (k === "Escape") human.push("Esc");
      else if (k === "ArrowUp") human.push("↑");
      else if (k === "ArrowDown") human.push("↓");
      else if (k === "ArrowLeft") human.push("←");
      else if (k === "ArrowRight") human.push("→");
      else human.push(k.length === 1 ? k.toUpperCase() : k);
    }
    parts.push(human.join("+"));
  }
  return parts;
}

export function ShortcutCheatSheet({ open, onClose }: { open: boolean; onClose: () => void }): React.ReactElement | null {
  var _e = useState<RegistryEntry[]>(snapshot()), entries = _e[0], setEntries = _e[1];
  useEffect(function() {
    if (!open) return;
    setEntries(snapshot());
    var unsub = subscribe(function() { setEntries(snapshot()); });
    return unsub;
  }, [open]);

  useEffect(function() {
    if (!open) return;
    var onKey = function(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return function() { window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  if (!open) return null;

  var groups: Record<string, RegistryEntry[]> = {};
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    if (!groups[e.scope]) groups[e.scope] = [];
    groups[e.scope].push(e);
  }
  var scopeNames = Object.keys(groups).sort(function(a, b) {
    if (a === "Global") return -1;
    if (b === "Global") return 1;
    return a.localeCompare(b);
  });

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: "10vh",
        zIndex: 10001,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        animation: "fadeIn 0.15s ease",
      }}
    >
      <div
        onClick={function(ev) { ev.stopPropagation(); }}
        style={{
          width: 640, maxWidth: "92vw",
          maxHeight: "76vh",
          display: "flex", flexDirection: "column",
          background: "linear-gradient(180deg, #0B0B0F, #08080C)",
          border: "1px solid " + C.amber + "35",
          borderRadius: 14,
          boxShadow: "0 24px 64px rgba(0,0,0,0.7), 0 0 48px " + C.amber + "18",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "18px 22px", borderBottom: "1px solid " + C.border, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: gf, fontSize: 22, fontWeight: 700, color: C.tx, letterSpacing: -0.4 }}>Keyboard Shortcuts</div>
            <div style={{ fontFamily: ft, fontSize: 12, color: C.txm, marginTop: 2 }}>
              Press <span style={{ fontFamily: mn, color: C.amber }}>Esc</span> to close
            </div>
          </div>
          <div style={{ fontFamily: mn, fontSize: 10, color: C.txd, letterSpacing: 2 }}>?</div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 22px 22px" }}>
          {scopeNames.length === 0 && (
            <div style={{ fontFamily: ft, fontSize: 13, color: C.txm, padding: "30px 0", textAlign: "center" }}>
              No shortcuts registered.
            </div>
          )}
          {scopeNames.map(function(scope) {
            return (
              <div key={scope} style={{ marginTop: 16 }}>
                <div style={{ fontFamily: mn, fontSize: 10, color: C.amber, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
                  {scope}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {groups[scope].map(function(entry, ix) {
                    var pills = formatBinding(entry.binding);
                    return (
                      <div key={scope + "-" + ix + "-" + entry.binding} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "8px 12px",
                        background: C.card,
                        border: "1px solid " + C.border,
                        borderRadius: 8,
                      }}>
                        <div style={{ fontFamily: ft, fontSize: 13, color: C.tx }}>{entry.description}</div>
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          {pills.map(function(p, pi) {
                            return (
                              <span key={pi} style={{
                                fontFamily: mn, fontSize: 11, fontWeight: 500,
                                color: C.tx,
                                padding: "3px 8px",
                                background: "rgba(255,255,255,0.04)",
                                border: "1px solid " + C.border,
                                borderRadius: 6,
                                boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.3)",
                              }}>{p}</span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ShortcutsProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  var _o = useState(false), open = _o[0], setOpen = _o[1];

  useEffect(function() {
    var onKey = function(e: KeyboardEvent) {
      if (e.key !== "?") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
      setOpen(function(o) { return !o; });
    };
    window.addEventListener("keydown", onKey);
    return function() { window.removeEventListener("keydown", onKey); };
  }, []);

  return (
    <>
      {children}
      <ShortcutCheatSheet open={open} onClose={function() { setOpen(false); }} />
    </>
  );
}
