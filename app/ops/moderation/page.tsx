import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getOpsAccessContext } from '@/lib/ops/access';
import { APP_URL } from '@/lib/env/domain';
import ModerationQueue from './ModerationQueue';

export const metadata = { title: 'Keystone Ops — Content Moderation' };

export type ModerationEvent = {
  id: string;
  created_at: string;
  site_id: string | null;
  user_id: string | null;
  ip_address: string | null;
  content_type: 'image' | 'pdf' | 'text';
  content_ref: string | null;
  detection_method: 'arachnid_hash' | 'vision_classifier' | 'text_classifier';
  severity: 'csaem' | 'adult' | 'review';
  action_taken: 'blocked' | 'quarantined' | 'reported';
  cybertip_report_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_action: 'approved' | 'removed' | 'escalated' | null;
  notes: string | null;
  // Joined
  site_slug?: string | null;
  user_email?: string | null;
};

export default async function OpsModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ reviewed?: string }>;
}) {
  const access = await getOpsAccessContext();
  if (!access || (!access.isAdmin && !access.isAgent)) {
    redirect(APP_URL);
  }

  const { reviewed } = await searchParams;
  const showReviewed = reviewed === 'true';

  const db = createAdminClient();

  let query = db
    .from('moderation_events')
    .select(`
      id, created_at, site_id, user_id, ip_address,
      content_type, content_ref, detection_method,
      severity, action_taken, cybertip_report_id,
      reviewed_by, reviewed_at, review_action, notes
    `)
    .order('created_at', { ascending: false })
    .limit(100);

  if (!showReviewed) {
    query = query.is('reviewed_at', null);
  }

  const { data: events, error } = await query;

  if (error) {
    console.error('Failed to fetch moderation events:', error);
  }

  // Enrich with site slugs and user emails
  const enriched: ModerationEvent[] = await Promise.all(
    (events ?? []).map(async (ev) => {
      let site_slug: string | null = null;
      let user_email: string | null = null;

      if (ev.site_id) {
        const { data: site } = await db
          .from('sites')
          .select('site_slug')
          .eq('id', ev.site_id)
          .single();
        site_slug = site?.site_slug ?? null;
      }

      if (ev.user_id) {
        const { data: user } = await db
          .from('users')
          .select('email')
          .eq('id', ev.user_id)
          .single();
        user_email = user?.email ?? null;
      }

      return { ...ev, site_slug, user_email };
    })
  );

  const pendingCount = enriched.filter((e) => !e.reviewed_at).length;
  const csaemCount = enriched.filter((e) => e.severity === 'csaem').length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Content Moderation Queue</h1>
        <p className="text-sm text-gray-400">
          All content flagged by automated detection. CSAEM incidents require reporting to{' '}
          <a
            href="https://www.cybertip.ca"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 underline"
          >
            Cybertip.ca
          </a>{' '}
          under the Mandatory Reporting Act (S.C. 2011, c. 4).
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-white">{enriched.length}</div>
          <div className="text-sm text-gray-400">
            {showReviewed ? 'Total events (incl. reviewed)' : 'Pending review'}
          </div>
        </div>
        <div className={`rounded-lg p-4 ${csaemCount > 0 ? 'bg-red-900/60 border border-red-600' : 'bg-gray-800'}`}>
          <div className={`text-2xl font-bold ${csaemCount > 0 ? 'text-red-300' : 'text-white'}`}>
            {csaemCount}
          </div>
          <div className="text-sm text-gray-400">CSAEM detections</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-white">{pendingCount}</div>
          <div className="text-sm text-gray-400">Awaiting review</div>
        </div>
      </div>

      {csaemCount > 0 && (
        <div className="mb-6 p-4 bg-red-900/40 border border-red-600 rounded-lg">
          <p className="text-red-300 font-semibold">
            ACTION REQUIRED: {csaemCount} CSAEM detection{csaemCount !== 1 ? 's' : ''} present.
          </p>
          <p className="text-red-400 text-sm mt-1">
            Check Cybertip.ca report status below. If report ID is missing, file a manual report at{' '}
            <a href="https://www.cybertip.ca" target="_blank" rel="noopener noreferrer" className="underline">
              cybertip.ca
            </a>{' '}
            immediately. Do NOT delete the associated content — preservation is legally required.
          </p>
        </div>
      )}

      <ModerationQueue events={enriched} showReviewed={showReviewed} isAdmin={access.isAdmin} />
    </div>
  );
}
