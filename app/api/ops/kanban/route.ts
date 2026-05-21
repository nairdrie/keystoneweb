import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { requireOpsAccess } from '@/lib/ops/access';
import {
  buildCreateTicketLog,
  buildUpdateTicketLogs,
  insertOpsTicketLogs,
} from '@/lib/ops/kanban-log';
import {
  getNextSortOrder,
  isOpsTicketPriority,
  isOpsTicketStatus,
  OPS_TICKET_STATUSES,
  sortOpsTickets,
  type OpsTicket,
  type OpsTicketPriority,
  type OpsTicketStatus,
} from '@/lib/ops/kanban';

function cleanOptionalText(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function loadOpsAssignees(db: ReturnType<typeof createAdminClient>) {
  const { data, error } = await db
    .from('users')
    .select('id, email, business_name, is_agent, is_admin')
    .or('is_agent.eq.true,is_admin.eq.true')
    .order('email', { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []).filter((row) => row.id && row.email).map((row) => ({
    id: row.id as string,
    email: String(row.email).toLowerCase(),
    name: row.business_name ? String(row.business_name) : null,
    kind: row.is_admin && row.is_agent
      ? 'admin_agent'
      : row.is_admin
        ? 'admin'
        : 'agent',
  })) as import('@/lib/ops/kanban').OpsAssigneeOption[]);
}

export async function GET(request: Request) {
  const access = await requireOpsAccess();
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get('status');
  const sortParam = searchParams.get('sort') ?? 'manual';
  const offset = Math.max(0, Number.parseInt(searchParams.get('offset') ?? '0', 10) || 0);
  const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get('limit') ?? '20', 10) || 20));
  const db = createAdminClient();
  const baseSelect =
    'id, name, description, status, priority, assignee_user_id, created_by_user_id, client_tag, sort_order, created_at, updated_at';

  if (statusParam && isOpsTicketStatus(statusParam)) {
    let ticketsQuery = db
      .from('ops_tickets')
      .select(baseSelect)
      .eq('status', statusParam);

    if (sortParam === 'priority') {
      ticketsQuery = ticketsQuery
        .order('priority_rank' as unknown as 'priority', { ascending: true })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
    } else {
      ticketsQuery = ticketsQuery
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
    }

    const [{ data, error }, { count, error: countError }] = await Promise.all([
      ticketsQuery.range(offset, offset + limit - 1),
      db
        .from('ops_tickets')
        .select('id', { count: 'exact', head: true })
        .eq('status', statusParam),
    ]);

    if (error || countError) {
      console.error('[ops/kanban GET paged]', error || countError);
      return NextResponse.json({ error: 'Failed to load tickets' }, { status: 500 });
    }

    return NextResponse.json({
      tickets: (data ?? []) as OpsTicket[],
      status: statusParam,
      total: count ?? 0,
      offset,
      limit,
      hasMore: offset + (data?.length ?? 0) < (count ?? 0),
    });
  }

  const { data, error } = await db
    .from('ops_tickets')
    .select(baseSelect)
    .order('status', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[ops/kanban GET]', error);
    return NextResponse.json({ error: 'Failed to load tickets' }, { status: 500 });
  }

  const counts = Object.fromEntries(
    OPS_TICKET_STATUSES.map((status) => [status.value, 0])
  ) as Record<OpsTicketStatus, number>;

  for (const ticket of (data ?? []) as OpsTicket[]) {
    counts[ticket.status] = (counts[ticket.status] ?? 0) + 1;
  }

  return NextResponse.json({ tickets: sortOpsTickets((data ?? []) as OpsTicket[]), counts });
}

export async function POST(request: Request) {
  const access = await requireOpsAccess();
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const status = typeof body.status === 'string' && isOpsTicketStatus(body.status)
    ? (body.status as OpsTicketStatus)
    : 'backlog';
  const priority = typeof body.priority === 'string' && isOpsTicketPriority(body.priority)
    ? (body.priority as OpsTicketPriority)
    : 'medium';

  if (!name) {
    return NextResponse.json({ error: 'Ticket name is required' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: existingTickets, error: loadError } = await db
    .from('ops_tickets')
    .select('id, name, description, status, priority, assignee_user_id, created_by_user_id, client_tag, sort_order, created_at, updated_at')
    .eq('status', status);

  if (loadError) {
    console.error('[ops/kanban POST load]', loadError);
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 });
  }

  const sortOrder = getNextSortOrder((existingTickets ?? []) as OpsTicket[], status);

  const { data, error } = await db
    .from('ops_tickets')
    .insert({
      name,
      description: cleanOptionalText(body.description),
      status,
      priority,
      assignee_user_id: typeof body.assignee_user_id === 'string' && body.assignee_user_id
        ? body.assignee_user_id
        : null,
      client_tag: cleanOptionalText(body.client_tag),
      created_by_user_id: access.userId,
      sort_order: sortOrder,
      updated_at: new Date().toISOString(),
    })
    .select('id, name, description, status, priority, assignee_user_id, created_by_user_id, client_tag, sort_order, created_at, updated_at')
    .single();

  if (error || !data) {
    console.error('[ops/kanban POST]', error);
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 });
  }

  try {
    await insertOpsTicketLogs(db, [
      buildCreateTicketLog(data as OpsTicket, {
        userId: access.userId,
        userEmail: access.userEmail,
      }),
    ]);
  } catch (logError) {
    console.error('[ops/kanban POST log]', logError);
  }

  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const access = await requireOpsAccess();
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body: unknown = await request.json();
  const rawUpdates = (
    typeof body === 'object' &&
    body !== null &&
    'updates' in body &&
    Array.isArray(body.updates)
  )
    ? body.updates
    : null;
  if (!rawUpdates || rawUpdates.length === 0) {
    return NextResponse.json({ error: 'At least one update is required' }, { status: 400 });
  }

  const updates = rawUpdates.map((entry: unknown) => {
    const candidate = typeof entry === 'object' && entry !== null
      ? (entry as Record<string, unknown>)
      : {};
    const id = typeof candidate.id === 'string' ? candidate.id : '';
    const status = typeof candidate.status === 'string' && isOpsTicketStatus(candidate.status)
      ? (candidate.status as OpsTicketStatus)
      : null;
    const sortOrder = Number(candidate.sort_order);

    return {
      id,
      status,
      sort_order: Number.isFinite(sortOrder) && sortOrder >= 0 ? Math.round(sortOrder) : null,
    };
  });

  if (updates.some((entry) => !entry.id || !entry.status || entry.sort_order === null)) {
    return NextResponse.json({ error: 'Invalid reorder payload' }, { status: 400 });
  }

  const validUpdates = updates as Array<{
    id: string;
    status: OpsTicketStatus;
    sort_order: number;
  }>;

  const db = createAdminClient();
  const ids = [...new Set(validUpdates.map((entry) => entry.id))];
  const { data: existingTickets, error: loadError } = await db
    .from('ops_tickets')
    .select('id, name, description, status, priority, assignee_user_id, created_by_user_id, client_tag, sort_order, created_at, updated_at')
    .in('id', ids);

  if (loadError) {
    console.error('[ops/kanban PATCH batch load]', loadError);
    return NextResponse.json({ error: 'Failed to update tickets' }, { status: 500 });
  }

  const existingTicketMap = new Map(((existingTickets ?? []) as OpsTicket[]).map((ticket) => [ticket.id, ticket]));
  if (ids.some((id) => !existingTicketMap.has(id))) {
    return NextResponse.json({ error: 'One or more tickets were not found' }, { status: 404 });
  }

  const updatedAt = new Date().toISOString();

  try {
    await Promise.all(
      validUpdates.map((entry) =>
        db
          .from('ops_tickets')
          .update({
            status: entry.status,
            sort_order: entry.sort_order,
            updated_at: updatedAt,
          })
          .eq('id', entry.id)
      )
    );
  } catch (error) {
    console.error('[ops/kanban PATCH batch]', error);
    return NextResponse.json({ error: 'Failed to update tickets' }, { status: 500 });
  }

  try {
    const assignees = await loadOpsAssignees(db);
    const logEntries = validUpdates.flatMap((entry) => {
      const previousTicket = existingTicketMap.get(entry.id);
      if (!previousTicket) return [];

      const nextTicket: OpsTicket = {
        ...previousTicket,
        status: entry.status,
        sort_order: entry.sort_order,
        updated_at: updatedAt,
      };

      return buildUpdateTicketLogs(
        previousTicket,
        nextTicket,
        {
          userId: access.userId,
          userEmail: access.userEmail,
        },
        assignees
      );
    });

    await insertOpsTicketLogs(db, logEntries);
  } catch (logError) {
    console.error('[ops/kanban PATCH batch log]', logError);
  }

  return NextResponse.json({ success: true, updatedAt, updated: validUpdates.length });
}
