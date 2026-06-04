import { notFound, redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { mapAuction } from '@/lib/auctions/types';
import RegisterForm from './RegisterForm';

const ERROR_MESSAGES: Record<string, string> = {
  missing_session: 'No payment session was returned. Try again.',
  not_found: 'This auction no longer exists.',
  session_expired: 'Your session expired. Please re-enter your details.',
  stripe_misconfigured: 'This auction isn\'t fully set up to take payments. Contact the organiser.',
  bad_session: 'The payment session was invalid.',
  card_not_captured: 'Your card couldn\'t be saved. Please try a different card.',
  no_customer: 'Something went wrong on Stripe\'s end. Please try again.',
  registration_save_failed: 'Your card was saved but we couldn\'t finalise your registration. Contact the organiser.',
};

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cancelled?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const db = createAdminClient();
  const { data: auctionRow } = await db.from('auctions').select('*').eq('id', id).single();
  if (!auctionRow || auctionRow.status === 'draft') notFound();
  if (auctionRow.status === 'ended' || auctionRow.status === 'cancelled') {
    redirect(`/auctions/${id}/lobby`);
  }
  const auction = mapAuction(auctionRow);

  const errorMessage = sp.error ? (ERROR_MESSAGES[sp.error] || 'Something went wrong. Please try again.') : null;
  const cancelled = sp.cancelled === '1';

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-amber-400 mb-2">Live auction</p>
          <h1 className="text-3xl font-bold mb-2">{auction.title}</h1>
          <p className="text-sm text-slate-400">
            Starts {new Date(auction.scheduledStart).toLocaleString()}
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-200">
            {errorMessage}
          </div>
        )}
        {cancelled && !errorMessage && (
          <div className="mb-4 rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-sm text-amber-200">
            You cancelled the card capture. Try again when you&apos;re ready.
          </div>
        )}

        <RegisterForm auctionId={id} />

        <div className="mt-6 rounded-lg border border-slate-800 bg-slate-900/50 p-4 text-xs text-slate-400 leading-relaxed space-y-2">
          <p className="font-semibold text-slate-200">How it works</p>
          <p>1. Create your account and add a card.</p>
          <p>2. Your card is <strong className="text-slate-200">held, not charged</strong>. We only charge if you win a lot.</p>
          <p>3. Once registered, you&apos;ll see a randomly-assigned anonymous alias (e.g. &ldquo;Crimson Wolf&rdquo;). Other bidders only ever see your alias.</p>
        </div>
      </div>
    </div>
  );
}
