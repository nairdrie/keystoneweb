import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { requireOpsAccess } from '@/lib/ops/access';
import type { OpsTicketLogEntry } from '@/lib/ops/kanban';

export async function GET(request: Request) {
  const access = await requireOpsAccess();
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(500, Math.max(1, Number.parseInt(searchParams.get('limit') ?? '200', 10) || 200));

  const db = createAdminClient();
  const { data, error } = await db
    .from('ops_ticket_logs')
    .select(
      'id, ticket_id, ticket_name, actor_user_id, actor_email, action, field_name, old_value, new_value, old_label, new_label, created_at'
    )
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[api/ops/kanban/logs]', error);
    return NextResponse.json({ error: 'Failed to load logs' }, { status: 500 });
  }

  return NextResponse.json({ logs: (data ?? []) as OpsTicketLogEntry[] });
}
