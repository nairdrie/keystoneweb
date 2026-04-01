import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { requireOpsAccess } from '@/lib/ops/access';
import { buildCreateTicketLog, insertOpsTicketLogs } from '@/lib/ops/kanban-log';
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

export async function GET(request: Request) {
  const access = await requireOpsAccess();
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get('status');
  const offset = Math.max(0, Number.parseInt(searchParams.get('offset') ?? '0', 10) || 0);
  const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get('limit') ?? '20', 10) || 20));
  const db = createAdminClient();
  const baseSelect =
    'id, name, description, status, priority, assignee_user_id, created_by_user_id, sort_order, created_at, updated_at';

  if (statusParam && isOpsTicketStatus(statusParam)) {
    const [{ data, error }, { count, error: countError }] = await Promise.all([
      db
        .from('ops_tickets')
        .select(baseSelect)
        .eq('status', statusParam)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1),
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
    .select('id, name, description, status, priority, assignee_user_id, created_by_user_id, sort_order, created_at, updated_at')
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
      created_by_user_id: access.userId,
      sort_order: sortOrder,
      updated_at: new Date().toISOString(),
    })
    .select('id, name, description, status, priority, assignee_user_id, created_by_user_id, sort_order, created_at, updated_at')
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
