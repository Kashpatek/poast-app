"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useUser } from "./user-context";

const STORAGE_PREFIX = "poast-onboarding-v1";

function storageKey(userName: string | null | undefined): string {
  return STORAGE_PREFIX + "-" + (userName || "anon");
}

interface OnboardingState {
  seen: string[];
}

function readState(userName: string | null | undefined): OnboardingState {
  if (typeof window === "undefined") return { seen: [] };
  try {
    var raw = localStorage.getItem(storageKey(userName));
    if (!raw) return { seen: [] };
    var parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.seen)) return { seen: parsed.seen };
    return { seen: [] };
  } catch {
    return { seen: [] };
  }
}

function writeState(userName: string | null | undefined, state: OnboardingState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(userName), JSON.stringify(state));
  } catch {}
}

interface OnboardingContextValue {
  hasSeen: (stepId: string) => boolean;
  markSeen: (stepId: string) => void;
  reset: () => void;
  // The current "active" step the host should render (or null if nothing is active).
  activeStep: string | null;
  setActiveStep: (s: string | null) => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding(): OnboardingContextValue {
  var ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const userName = user?.name;

  const [seen, setSeen] = useState<string[]>([]);
  const [activeStep, setActiveStep] = useState<string | null>(null);

  // Hydrate from localStorage when the user changes (or first becomes available).
  useEffect(() => {
    var s = readState(userName);
    setSeen(s.seen);
  }, [userName]);

  const hasSeen = useCallback((stepId: string) => seen.indexOf(stepId) !== -1, [seen]);

  const markSeen = useCallback(
    (stepId: string) => {
      setSeen((prev) => {
        if (prev.indexOf(stepId) !== -1) return prev;
        var next = prev.concat([stepId]);
        writeState(userName, { seen: next });
        return next;
      });
    },
    [userName]
  );

  const reset = useCallback(() => {
    setSeen([]);
    writeState(userName, { seen: [] });
    setActiveStep(null);
  }, [userName]);

  const value = useMemo<OnboardingContextValue>(
    () => ({ hasSeen, markSeen, reset, activeStep, setActiveStep }),
    [hasSeen, markSeen, reset, activeStep]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}
