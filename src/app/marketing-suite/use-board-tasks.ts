"use client";
// Shared hook: the master board's tasks (Agenda rail + Wizard + in-campaign
// panel). Now a thin read over the mode-aware board store (board-store.ts) — in
// DEMO it returns the in-memory sandbox, in LIVE the real akash-todo-master
// board. The shell drives the mode via boardSetMode(); writes go through
// useBoardStore().{createBoardTask,updateBoardTask}.
import { useBoardStore } from "./board-store";
import type { BoardTaskLite } from "./marketing-constants";

export function useBoardTasks(): BoardTaskLite[] {
  return useBoardStore().tasks;
}
