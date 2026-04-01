import { createAdminClient } from '@/lib/db/supabase-admin';
import { createClient } from '@/lib/db/supabase-server';

export interface OpsAccessContext {
  userId: string;
  userEmail: string | null;
  isAdmin: boolean;
  isAgent: boolean;
  agentContactEmail: string | null;
}

export function getOpsAdminEmails() {
  return (process.env.OPS_ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function getOpsAccessContext(): Promise<OpsAccessContext | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const adminEmails = getOpsAdminEmails();
    const userEmail = user.email?.toLowerCase() ?? null;
    const isAdmin = userEmail ? adminEmails.includes(userEmail) : false;

    let isAgent = false;
    let agentContactEmail: string | null = null;

    if (!isAdmin) {
      const db = createAdminClient();
      const { data: profile } = await db
        .from('users')
        .select('is_agent, agent_contact_email')
        .eq('id', user.id)
        .single();

      isAgent = profile?.is_agent ?? false;
      agentContactEmail = profile?.agent_contact_email ?? null;
    }

    return {
      userId: user.id,
      userEmail,
      isAdmin,
      isAgent,
      agentContactEmail,
    };
  } catch {
    return null;
  }
}

export async function requireOpsAccess() {
  const context = await getOpsAccessContext();
  if (!context || (!context.isAdmin && !context.isAgent)) {
    return null;
  }

  return context;
}
