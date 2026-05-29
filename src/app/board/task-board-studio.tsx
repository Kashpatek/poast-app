"use client";

// Studio = TaskBoardSummary in standalone mode.
//
// All productivity features (⌘K palette, daily planner, activity log,
// ⌘Z undo, drag/drop, focus mode, combine dock, Claude merge, 9 views,
// group-by) live in one component. Standalone mode widens the canvas,
// swaps "Open Studio" → "← POAST hub", and prefixes the eyebrow with
// "Studio ·" so users know which surface they're on.

import TaskBoardSummary from "./task-board-summary";

export default function TaskBoardStudio() {
  return <TaskBoardSummary mode="standalone" />;
}
