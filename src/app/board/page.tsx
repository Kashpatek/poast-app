// Full-screen Studio Task Board.
//
// Standalone route — no POAST shell wrapping. Opens like its own app.
// Same Supabase row as the embedded summary in POAST, so changes here
// reflect there and vice versa.

import TaskBoardStudio from "./task-board-studio";

export default function BoardPage() {
  return <TaskBoardStudio />;
}
