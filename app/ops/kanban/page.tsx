import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getOpsAccessContext, getOpsAdminEmails } from '@/lib/ops/access';
import type { OpsAssigneeOption, OpsTicket } from '@/lib/ops/kanban';
import KanbanBoard from './KanbanBoard';

export const metadata = { title: 'Keystone Ops Kanban' };

export default async function OpsKanbanPage() {
  const access = await getOpsAccessContext();
  if (!access || (!access.isAdmin && !access.isAgent)) {
    redirect('https://keystoneweb.ca');
  }

  const db = createAdminClient();
  const adminEmails = getOpsAdminEmails();

  const [ticketsResult, agentsResult, flaggedAdminsResult, envAdminsResult] = await Promise.all([
    db
      .from('ops_tickets')
      .select('id, name, description, status, priority, assignee_user_id, created_by_user_id, sort_order, created_at, updated_at')
      .order('status', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    db
      .from('users')
      .select('id, email, business_name, is_agent, is_admin')
      .eq('is_agent', true)
      .order('email', { ascending: true }),
    db
      .from('users')
      .select('id, email, business_name, is_agent, is_admin')
      .eq('is_admin', true)
      .order('email', { ascending: true }),
    adminEmails.length > 0
      ? db
          .from('users')
          .select('id, email, business_name, is_agent, is_admin')
          .in('email', adminEmails)
          .order('email', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (ticketsResult.error) {
    console.error('[ops/kanban page tickets]', ticketsResult.error);
  }
  if (agentsResult.error) {
    console.error('[ops/kanban page agents]', agentsResult.error);
  }
  if (flaggedAdminsResult.error) {
    console.error('[ops/kanban page admins]', flaggedAdminsResult.error);
  }
  if (envAdminsResult.error) {
    console.error('[ops/kanban page env admins]', envAdminsResult.error);
  }

  const peopleById = new Map<string, {
    id: string;
    email: string;
    business_name: string | null;
    is_agent: boolean;
    is_admin: boolean;
  }>();

  for (const row of [
    ...(agentsResult.data ?? []),
    ...(flaggedAdminsResult.data ?? []),
    ...(envAdminsResult.data ?? []),
  ]) {
    if (!row?.id || !row.email) continue;
    const email = row.email.toLowerCase();
    const existing = peopleById.get(row.id);

    peopleById.set(row.id, {
      id: row.id,
      email,
      business_name: row.business_name ?? existing?.business_name ?? null,
      is_agent: Boolean(row.is_agent || existing?.is_agent),
      is_admin: Boolean(row.is_admin || existing?.is_admin || adminEmails.includes(email)),
    });
  }

  const assignees: OpsAssigneeOption[] = [...peopleById.values()]
    .map((person) => ({
      id: person.id,
      email: person.email,
      name: person.business_name,
      kind: person.is_admin && person.is_agent
        ? 'admin_agent'
        : person.is_admin
          ? 'admin'
          : 'agent',
    }))
    .sort((left, right) => {
      const leftRank = left.kind === 'admin' ? 0 : left.kind === 'admin_agent' ? 1 : 2;
      const rightRank = right.kind === 'admin' ? 0 : right.kind === 'admin_agent' ? 1 : 2;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return left.email.localeCompare(right.email);
    });

  return (
    <KanbanBoard
      initialTickets={(ticketsResult.data ?? []) as OpsTicket[]}
      assignees={assignees}
      currentUserId={access.userId}
      canDelete={access.isAdmin}
    />
  );
}
