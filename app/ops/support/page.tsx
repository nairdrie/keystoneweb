import { redirect } from 'next/navigation';
import { APP_URL } from '@/lib/env/domain';
import { getOpsAccessContext } from '@/lib/ops/access';
import { nameFromEmail } from '@/lib/email/signature';
import OpsEmailClient from './OpsEmailClient';

const ALL_FROM_EMAILS = [
  'ops@keystoneweb.ca',
  'support@keystoneweb.ca',
  'hello@keystoneweb.ca',
  'contact@keystoneweb.ca',
  'sales@keystoneweb.ca',
  'info@keystoneweb.ca',
];

export default async function OpsSupportPage() {
  const access = await getOpsAccessContext();
  if (!access || (!access.isAdmin && !access.isAgent)) {
    redirect(APP_URL);
  }

  const { userEmail, isAdmin, agentContactEmail } = access;

  // Admins can send from any team alias; agents can only send from their own
  // assigned contact email.
  const availableFromEmails = isAdmin
    ? [...(agentContactEmail ? [agentContactEmail] : []), ...ALL_FROM_EMAILS]
    : agentContactEmail
      ? [agentContactEmail]
      : [];

  const senderName = nameFromEmail(userEmail ?? '');

  return (
    <OpsEmailClient
      availableFromEmails={availableFromEmails}
      senderName={senderName}
      scopedTo={isAdmin ? null : agentContactEmail}
      isAdmin={isAdmin}
    />
  );
}
