"use client";
// Create layer — one host for every "Add" in the suite. Any component calls
// useCreate().openCreate(kind, prefill?) and the matching rich modal opens
// pre-filled. The Assistant routes here too. Campaign/Ad currently deep-link to
// their views (Phase 2/3 swap in full modals); task/schedule are full modals.
import React, { createContext, useCallback, useContext, useState } from "react";
import type { MarketingState } from "./use-marketing";
import type { CreateKind } from "./marketing-constants";
import { TaskModal, ScheduleModal } from "./components/create-modals";
import { CampaignModal } from "./components/campaign-modal";

interface CreateApi {
  openCreate: (kind: CreateKind, prefill?: Record<string, unknown>) => void;
}
const Ctx = createContext<CreateApi>({ openCreate: () => {} });
export function useCreate() { return useContext(Ctx); }

export function CreateProvider({
  m, onOpenView, children,
}: {
  m: MarketingState;
  onOpenView?: (v: string, focusId?: string) => void;
  children: React.ReactNode;
}) {
  const [kind, setKind] = useState<CreateKind | null>(null);
  const [prefill, setPrefill] = useState<Record<string, unknown>>({});

  const openCreate = useCallback((k: CreateKind, pf?: Record<string, unknown>) => {
    if (k === "ad") { onOpenView?.("kiosk"); return; } // Phase 3: full ad modal
    setPrefill(pf || {});
    setKind(k);
  }, [onOpenView]);

  const close = useCallback(() => setKind(null), []);

  return (
    <Ctx.Provider value={{ openCreate }}>
      {children}
      <TaskModal open={kind === "task"} prefill={prefill} m={m} onOpenView={onOpenView} onClose={close} />
      <ScheduleModal open={kind === "schedule"} prefill={prefill} m={m} onOpenView={onOpenView} onClose={close} />
      <CampaignModal open={kind === "campaign"} prefill={prefill} m={m} onOpenView={onOpenView} onClose={close} />
    </Ctx.Provider>
  );
}
