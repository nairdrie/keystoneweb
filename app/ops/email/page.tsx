import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import EmailComposer from './EmailComposer';
import Link from 'next/link';

const ALL_FROM_EMAILS = [
  'ops@keystoneweb.ca',
  'support@keystoneweb.ca',
  'hello@keystoneweb.ca',
  'contact@keystoneweb.ca',
  'sales@keystoneweb.ca',
  'info@keystoneweb.ca',
];

const STATUS_STYLES: Record<string, string> = {
  open: 'text-amber-400 bg-amber-400/10',
  in_progress: 'text-sky-400 bg-sky-400/10',
  resolved: 'text-emerald-400 bg-emerald-400/10',
  closed: 'text-gray-500 bg-gray-800',
};

/** Derive a display name from an email address, e.g. "nick.smith@gmail.com" → "Nick Smith" */
function nameFromEmail(email: string): string {
  const username = email.split('@')[0];
  return username
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default async function OpsEmailPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const adminEmails = (process.env.OPS_ADMIN_EMAILS || '')
    .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

  const isAdmin = adminEmails.includes(user?.email?.toLowerCase() ?? '');

  // Fetch contact email for all users (admins and agents alike)
  let agentContactEmail: string | null = null;
  if (user) {
    const db = createAdminClient();
    const { data: profile } = await db
      .from('users')
      .select('agent_contact_email')
      .eq('id', user.id)
      .single();
    agentContactEmail = profile?.agent_contact_email ?? null;
  }

  // Admins get all standard addresses + their personal one (if set)
  // Agents can only use their own contact email
  const availableFromEmails = isAdmin
    ? [
        ...(agentContactEmail ? [agentContactEmail] : []),
        ...ALL_FROM_EMAILS,
      ]
    : agentContactEmail
      ? [agentContactEmail]
      : [];

  const senderName = nameFromEmail(user?.email ?? '');

  // Fetch support replies from people this user has emailed
  let inboxThreads: any[] = [];
  if (user) {
    const db = createAdminClient();

    // Get unique recipient emails this user has previously emailed
    const { data: sentEmails } = await db
      .from('ops_sent_emails')
      .select('to_email')
      .eq('sent_by_user_id', user.id);

    const contactedEmails = [...new Set((sentEmails ?? []).map((r: any) => r.to_email))];

    if (contactedEmails.length > 0) {
      const { data: threads } = await db
        .from('support_requests')
        .select('id, from_email, from_name, subject, body_text, status, created_at')
        .is('thread_id', null)
        .in('from_email', contactedEmails)
        .order('created_at', { ascending: false })
        .limit(50);

      inboxThreads = threads ?? [];
    }
  }

  return (
    <div className="max-w-2xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-white">Email</h1>
        <p className="mt-1 text-sm text-gray-500">
          Send an email from a @keystoneweb.ca address.
        </p>
      </div>

      <EmailComposer availableFromEmails={availableFromEmails} senderName={senderName} />

      {/* Inbox: support replies from people you've emailed */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Inbox</h2>
        {inboxThreads.length === 0 ? (
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-8 text-center text-gray-600 text-sm">
            No replies yet from people you&apos;ve emailed.
          </div>
        ) : (
          <div className="space-y-2">
            {inboxThreads.map((thread: any) => (
              <Link
                key={thread.id}
                href={`/support/${thread.id}`}
                className="block rounded-lg border border-gray-800 bg-gray-900 p-4 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[thread.status] ?? STATUS_STYLES.open}`}
                      >
                        {thread.status.replace('_', ' ')}
                      </span>
                      <span className="text-sm font-medium text-white truncate">
                        {thread.subject || '(no subject)'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      From{' '}
                      <span className="text-gray-400">
                        {thread.from_name
                          ? `${thread.from_name} <${thread.from_email}>`
                          : thread.from_email}
                      </span>
                    </p>
                    {thread.body_text && (
                      <p className="mt-1.5 text-xs text-gray-500 line-clamp-2">
                        {thread.body_text.slice(0, 180)}
                      </p>
                    )}
                  </div>
                  <time className="shrink-0 text-xs text-gray-600">
                    {new Date(thread.created_at).toLocaleDateString('en-CA', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </time>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
