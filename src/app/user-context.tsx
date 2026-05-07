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

interface UserContextValue {
  user: User | null;
  setUser: (name: string | null) => void;
}

const UserContext = createContext<UserContextValue>({ user: null, setUser: () => {} });

const STORAGE_KEY = "poast-current-user";

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && USERS[stored]) setUserState(USERS[stored]);
    } catch {}
  }, []);

  const setUser = (name: string | null) => {
    if (!name || !USERS[name]) {
      setUserState(null);
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      return;
    }
    setUserState(USERS[name]);
    try { localStorage.setItem(STORAGE_KEY, name); } catch {}
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
