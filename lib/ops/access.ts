import { createAdminClient } from '@/lib/db/supabase-admin';
import { createClient } from '@/lib/db/supabase-server';

export interface OpsAccessContext {
  userId: string;
  userEmail: string | null;
  isAdmin: boolean;
  isAgent: boolean;
  agentContactEmail: string | null;
}

export async function getOpsAccessContext(): Promise<OpsAccessContext | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const db = createAdminClient();
    const { data: profile } = await db
      .from('users')
      .select('is_admin, is_agent, agent_contact_email')
      .eq('id', user.id)
      .single();

    return {
      userId: user.id,
      userEmail: user.email?.toLowerCase() ?? null,
      isAdmin: profile?.is_admin ?? false,
      isAgent: profile?.is_agent ?? false,
      agentContactEmail: profile?.agent_contact_email ?? null,
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

export async function assertOpsAdmin(): Promise<boolean> {
  const context = await getOpsAccessContext();
  return Boolean(context?.isAdmin);
}

export async function getOpsAdminEmailList(): Promise<string[]> {
  const db = createAdminClient();
  const { data } = await db
    .from('users')
    .select('email')
    .eq('is_admin', true);
  return (data ?? [])
    .map((row) => row.email?.toLowerCase())
    .filter((email): email is string => Boolean(email));
}
