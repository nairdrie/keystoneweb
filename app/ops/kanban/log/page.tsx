import { redirect } from 'next/navigation';

// Kanban Log is now accessible as a modal from the Kanban board.
// Keep this route as a redirect so old links / bookmarks continue to work.
export default function OpsKanbanLogPage() {
  redirect('/kanban');
}
