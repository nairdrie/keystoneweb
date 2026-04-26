import { redirect } from 'next/navigation';

// Email + Support are merged into a single inbox at /ops/support.
// Keep this route as a redirect so old links / bookmarks continue to work.
export default function OpsEmailPage() {
  redirect('/support');
}
