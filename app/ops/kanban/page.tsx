import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getOpsAccessContext } from '@/lib/ops/access';
import { OPS_TICKET_STATUSES, type OpsAssigneeOption, type OpsTicket, type OpsTicketStatus } from '@/lib/ops/kanban';
import { APP_URL } from '@/lib/env/domain';
import KanbanBoardClient from './KanbanBoardClient';

export const metadata = { title: 'Keystone Ops Kanban' };
const INITIAL_STATUS_PAGE_SIZE = 20;

export default async function OpsKanbanPage() {
  const access = await getOpsAccessContext();
  if (!access || (!access.isAdmin && !access.isAgent)) {
    redirect(APP_URL);
  }

  const db = createAdminClient();

  // Initial load uses priority order to match the default client sort mode.
  // The priority_rank computed column is defined in migration 037_ops_priority_rank.sql.
  const ticketBatchQueries = OPS_TICKET_STATUSES.map((status) =>
    db
      .from('ops_tickets')
      .select('id, name, description, status, priority, assignee_user_id, created_by_user_id, sort_order, created_at, updated_at')
      .eq('status', status.value)
      .order('priority_rank' as unknown as 'priority', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .range(0, INITIAL_STATUS_PAGE_SIZE - 1)
  );

  const ticketCountQueries = OPS_TICKET_STATUSES.map((status) =>
    db
      .from('ops_tickets')
      .select('id', { count: 'exact', head: true })
      .eq('status', status.value)
  );

  const [ticketBatchResults, ticketCountResults, agentsResult, adminsResult] = await Promise.all([
    Promise.all(ticketBatchQueries),
    Promise.all(ticketCountQueries),
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
  ]);

  for (const [index, result] of ticketBatchResults.entries()) {
    if (result.error) {
      console.error('[ops/kanban page tickets]', OPS_TICKET_STATUSES[index]?.value, result.error);
    }
  }
  for (const [index, result] of ticketCountResults.entries()) {
    if (result.error) {
      console.error('[ops/kanban page counts]', OPS_TICKET_STATUSES[index]?.value, result.error);
    }
  }
  if (agentsResult.error) {
    console.error('[ops/kanban page agents]', agentsResult.error);
  }
  if (adminsResult.error) {
    console.error('[ops/kanban page admins]', adminsResult.error);
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
    ...(adminsResult.data ?? []),
  ]) {
    if (!row?.id || !row.email) continue;
    const email = row.email.toLowerCase();
    const existing = peopleById.get(row.id);

    peopleById.set(row.id, {
      id: row.id,
      email,
      business_name: row.business_name ?? existing?.business_name ?? null,
      is_agent: Boolean(row.is_agent || existing?.is_agent),
      is_admin: Boolean(row.is_admin || existing?.is_admin),
    });
  }

  const assignees: OpsAssigneeOption[] = [...peopleById.values()]
    .map((person): OpsAssigneeOption => ({
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

  const initialTickets = ticketBatchResults.flatMap((result) => (result.data ?? []) as OpsTicket[]);
  const statusCounts = Object.fromEntries(
    OPS_TICKET_STATUSES.map((status, index) => [status.value, ticketCountResults[index]?.count ?? 0])
  ) as Record<OpsTicketStatus, number>;

  return (
    <KanbanBoardClient
      initialTickets={initialTickets}
      statusCounts={statusCounts}
      assignees={assignees}
      currentUserId={access.userId}
      canDelete={access.isAdmin || access.isAgent}
    />
  );
}
