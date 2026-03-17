import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { createClient } from '@/lib/db/supabase-server';

async function assertAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const adminEmails = (process.env.OPS_ADMIN_EMAILS || '')
      .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    return adminEmails.includes(user.email?.toLowerCase() ?? '');
  } catch {
    return false;
  }
}

/**
 * GET /api/ops/support?status=open&page=1&limit=50
 * Returns support requests, most recent first.
 */
export async function GET(request: NextRequest) {
  if (!await assertAdmin()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const statusFilter = params.get('status') ?? '';
  const page = Math.max(parseInt(params.get('page') ?? '1', 10), 1);
  const limit = Math.min(parseInt(params.get('limit') ?? '50', 10), 200);
  const offset = (page - 1) * limit;

  const db = createAdminClient();

  let query = db
    .from('support_requests')
    .select('id, from_email, from_name, subject, body_text, status, priority, notes, created_at, updated_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  return NextResponse.json({ requests: data ?? [], total: count ?? 0, page, limit });
}
