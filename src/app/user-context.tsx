"use client";
import { createContext, useContext, useState, ReactNode, useEffect } from "react";

export type UserRole = "Director" | "Social Media Manager" | "Analyst";

export interface User {
  name: string;
  role: UserRole;
}

const USERS: Record<string, User> = {
  Akash: { name: "Akash", role: "Director" },
  Vansh: { name: "Vansh", role: "Social Media Manager" },
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
