import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import EmailComposer from './EmailComposer';

const ALL_FROM_EMAILS = [
  'ops@keystoneweb.ca',
  'support@keystoneweb.ca',
  'hello@keystoneweb.ca',
  'contact@keystoneweb.ca',
  'sales@keystoneweb.ca',
  'info@keystoneweb.ca',
];

export default async function OpsEmailPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const adminEmails = (process.env.OPS_ADMIN_EMAILS || '')
    .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

  const isAdmin = adminEmails.includes(user?.email?.toLowerCase() ?? '');

  let agentContactEmail: string | null = null;
  if (!isAdmin && user) {
    const db = createAdminClient();
    const { data: profile } = await db
      .from('users')
      .select('agent_contact_email')
      .eq('id', user.id)
      .single();
    agentContactEmail = profile?.agent_contact_email ?? null;
  }

  // Agents can only use their own contact email as the sender
  const availableFromEmails = isAdmin
    ? ALL_FROM_EMAILS
    : agentContactEmail
      ? [agentContactEmail]
      : [];

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Send Email</h1>
        <p className="mt-1 text-sm text-gray-500">
          Send an email to any address from a @keystoneweb.ca address.
        </p>
      </div>

      <EmailComposer availableFromEmails={availableFromEmails} />
    </div>
  );
}
