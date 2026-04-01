import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { requireOpsAccess } from '@/lib/ops/access';
import {
  getNextSortOrder,
  isOpsTicketPriority,
  isOpsTicketStatus,
  type OpsTicket,
  type OpsTicketPriority,
  type OpsTicketStatus,
} from '@/lib/ops/kanban';

function cleanOptionalText(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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
        .select('id, name, description, status, priority, assignee_user_id, created_by_user_id, sort_order, created_at, updated_at')
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
    .select('id, name, description, status, priority, assignee_user_id, created_by_user_id, sort_order, created_at, updated_at')
    .single();

  if (error || !data) {
    console.error('[ops/kanban PATCH]', error);
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireOpsAccess();
  if (!access || !access.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const db = createAdminClient();
  const { error } = await db.from('ops_tickets').delete().eq('id', id);

  if (error) {
    console.error('[ops/kanban DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete ticket' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
