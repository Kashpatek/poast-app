"use client";
// Shared hook: the master board's tasks (for the Agenda task rail + Wizard).
// Fetches projects/akash-todo-master, falls back to the local cache.
import { useEffect, useState } from "react";
import { readBoardTasks, type BoardTaskLite } from "./marketing-constants";

export function useBoardTasks(): BoardTaskLite[] {
  const [tasks, setTasks] = useState<BoardTaskLite[]>(() => readBoardTasks());
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/db?table=projects&id=akash-todo-master");
        const j = await res.json();
        const arch = j?.data?.data;
        if (!alive || !arch?.boards) return;
        const out: BoardTaskLite[] = [];
        for (const b of arch.boards) for (const t of (b.tasks || [])) out.push(t);
        if (out.length) setTasks(out);
      } catch { /* keep cache */ }
    })();
    return () => { alive = false; };
  }, []);
  return tasks;
}
