"use client";
import { createContext, useContext, useState, ReactNode, useEffect } from "react";

export type UserRole =
  | "Brand and Creative Director"
  | "Chief of Staff"
  | "Social Media Manager"
  | "Intern"
  | "Analyst";

export interface User {
  name: string;
  role: UserRole;
}

const USERS: Record<string, User> = {
  Akash: { name: "Akash", role: "Brand and Creative Director" },
  Michelle: { name: "Michelle", role: "Chief of Staff" },
  Vansh: { name: "Vansh", role: "Social Media Manager" },
  Daksh: { name: "Daksh", role: "Intern" },
  Analyst: { name: "Analyst", role: "Analyst" },
};

// Canonical @semianalysis.com email → POAST user key. Any verified address that
// isn't a named teammate maps to the shared Analyst seat. This is the single
// source of truth used by BOTH the onboarding (first-run.tsx) and the session
// gate (poast-client.tsx) so a Google identity always resolves the same way.
const EMAIL_TO_USER: Record<string, string> = {
  "akash@semianalysis.com": "Akash",
  "michelle@semianalysis.com": "Michelle",
  "vansh@semianalysis.com": "Vansh",
  "daksh@semianalysis.com": "Daksh",
};
export function emailToUserName(email: string): string {
  return EMAIL_TO_USER[(email || "").trim().toLowerCase()] || "Analyst";
}
export const ADMIN_USER = "Akash";
export function isValidUserName(name: string | null | undefined): boolean {
  return !!name && Object.prototype.hasOwnProperty.call(USERS, name);
}

interface UserContextValue {
  user: User | null;
  // Set the current user. If `remember=true` we persist to localStorage
  // (survives browser restarts on this computer). Otherwise we use
  // sessionStorage (cleared when the tab closes).
  setUser: (name: string | null, remember?: boolean) => void;
}

const UserContext = createContext<UserContextValue>({ user: null, setUser: () => {} });

// Same key in both storages — only one will be set at a time. Reads
// check localStorage first (persistent wins), then sessionStorage.
const STORAGE_KEY = "poast-current-user";

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);

  // Hydrate on mount: localStorage (persistent) first, then sessionStorage.
  useEffect(() => {
    try {
      let stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored && USERS[stored]) setUserState(USERS[stored]);
    } catch {}
  }, []);

  const setUser = (name: string | null, remember = true) => {
    if (!name || !USERS[name]) {
      setUserState(null);
      try { localStorage.removeItem(STORAGE_KEY); sessionStorage.removeItem(STORAGE_KEY); } catch {}
      return;
    }
    setUserState(USERS[name]);
    try {
      // Always clear the other storage so we don't keep stale identities.
      if (remember) {
        localStorage.setItem(STORAGE_KEY, name);
        sessionStorage.removeItem(STORAGE_KEY);
      } else {
        sessionStorage.setItem(STORAGE_KEY, name);
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {}
  };

  return <UserContext.Provider value={{ user, setUser }}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  return useContext(UserContext);
}

export function isAnalyst(user: User | null): boolean {
  return user?.role === "Analyst";
}

// The whole marketing team gets DocuDesign — Brand and Creative Director,
// Chief of Staff, Social Media Manager, and Intern. Analyst is excluded.
export function canUseDocuDesign(user: User | null): boolean {
  if (!user) return false;
  return (
    user.role === "Brand and Creative Director" ||
    user.role === "Chief of Staff" ||
    user.role === "Social Media Manager" ||
    user.role === "Intern"
  );
}

// Akash's personal task board. Single-user gate by name; everyone else
// who tries to load the route gets bounced to the home grid.
export function isAkash(user: User | null): boolean {
  return user?.name === "Akash" && user?.role === "Brand and Creative Director";
}
