import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { requireOpsAccess } from '@/lib/ops/access';
import {
  getNextSortOrder,
  isOpsTicketPriority,
  isOpsTicketStatus,
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

export async function GET() {
  const access = await requireOpsAccess();
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('ops_tickets')
    .select('id, name, description, status, priority, assignee_user_id, created_by_user_id, sort_order, created_at, updated_at')
    .order('status', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[ops/kanban GET]', error);
    return NextResponse.json({ error: 'Failed to load tickets' }, { status: 500 });
  }

  return NextResponse.json({ tickets: sortOpsTickets((data ?? []) as OpsTicket[]) });
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

  return NextResponse.json(data);
}
