import { redirect } from 'next/navigation';

// Deep links to /support/[id] now open the conversation inside the unified
// inbox view via ?id=...
export default async function SupportTicketRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/support?id=${encodeURIComponent(id)}`);
}
