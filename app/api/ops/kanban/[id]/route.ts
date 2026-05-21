import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { requireOpsAccess } from '@/lib/ops/access';
import {
  buildDeleteTicketLog,
  buildUpdateTicketLogs,
  insertOpsTicketLogs,
} from '@/lib/ops/kanban-log';
import {
  getNextSortOrder,
  isOpsTicketPriority,
  isOpsTicketStatus,
  type OpsAssigneeOption,
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
  })) as OpsAssigneeOption[]);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireOpsAccess();
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const db = createAdminClient();
  const { data: existingTicket, error: existingTicketError } = await db
    .from('ops_tickets')
    .select('id, name, description, status, priority, assignee_user_id, created_by_user_id, client_tag, sort_order, created_at, updated_at')
    .eq('id', id)
    .single();

  if (existingTicketError || !existingTicket) {
    console.error('[ops/kanban PATCH existing]', existingTicketError);
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if ('name' in body) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json({ error: 'Ticket name is required' }, { status: 400 });
    }
    update.name = name;
  }

  if ('description' in body) {
    update.description = cleanOptionalText(body.description);
  }

  if ('priority' in body) {
    if (typeof body.priority !== 'string' || !isOpsTicketPriority(body.priority)) {
      return NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
    }
    update.priority = body.priority as OpsTicketPriority;
  }

  if ('assignee_user_id' in body) {
    update.assignee_user_id = typeof body.assignee_user_id === 'string' && body.assignee_user_id
      ? body.assignee_user_id
      : null;
  }

  if ('client_tag' in body) {
    update.client_tag = cleanOptionalText(body.client_tag);
  }

  if ('sort_order' in body) {
    const parsedOrder = Number(body.sort_order);
    if (!Number.isFinite(parsedOrder) || parsedOrder < 0) {
      return NextResponse.json({ error: 'Invalid sort order' }, { status: 400 });
    }
    update.sort_order = Math.round(parsedOrder);
  }

  if ('status' in body) {
    if (typeof body.status !== 'string' || !isOpsTicketStatus(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const nextStatus = body.status as OpsTicketStatus;
    update.status = nextStatus;

    if (!('sort_order' in body)) {
      const { data: existingTickets, error: loadError } = await db
        .from('ops_tickets')
        .select('id, name, description, status, priority, assignee_user_id, created_by_user_id, client_tag, sort_order, created_at, updated_at')
        .eq('status', nextStatus)
        .neq('id', id);

      if (loadError) {
        console.error('[ops/kanban PATCH load]', loadError);
        return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 });
      }

      update.sort_order = getNextSortOrder((existingTickets ?? []) as OpsTicket[], nextStatus);
    }
  }

  const { data, error } = await db
    .from('ops_tickets')
    .update(update)
    .eq('id', id)
    .select('id, name, description, status, priority, assignee_user_id, created_by_user_id, client_tag, sort_order, created_at, updated_at')
    .single();

  if (error || !data) {
    console.error('[ops/kanban PATCH]', error);
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 });
  }

  try {
    const assignees = await loadOpsAssignees(db);
    const logEntries = buildUpdateTicketLogs(
      existingTicket as OpsTicket,
      data as OpsTicket,
      {
        userId: access.userId,
        userEmail: access.userEmail,
      },
      assignees
    );

    await insertOpsTicketLogs(db, logEntries);
  } catch (logError) {
    console.error('[ops/kanban PATCH log]', logError);
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireOpsAccess();
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const db = createAdminClient();
  const { data: existingTicket, error: existingTicketError } = await db
    .from('ops_tickets')
    .select('id, name, description, status, priority, assignee_user_id, created_by_user_id, client_tag, sort_order, created_at, updated_at')
    .eq('id', id)
    .single();

  if (existingTicketError || !existingTicket) {
    console.error('[ops/kanban DELETE existing]', existingTicketError);
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  const { error } = await db.from('ops_tickets').delete().eq('id', id);

  if (error) {
    console.error('[ops/kanban DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete ticket' }, { status: 500 });
  }

  try {
    await insertOpsTicketLogs(db, [
      buildDeleteTicketLog(existingTicket as OpsTicket, {
        userId: access.userId,
        userEmail: access.userEmail,
      }),
    ]);
  } catch (logError) {
    console.error('[ops/kanban DELETE log]', logError);
  }

  return NextResponse.json({ success: true });
}
