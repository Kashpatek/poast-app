"use client";
// Board view = the REAL POAST task board (TaskBoardSummary), embedded against
// the SAME Supabase row (projects/akash-todo-master). This is not a clone —
// edits here, on /board, and on the POAST hub are the same live board.
import TaskBoardSummary from "../../board/task-board-summary";

export default function BoardView() {
  return <TaskBoardSummary mode="embed" />;
}
