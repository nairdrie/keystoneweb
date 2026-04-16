import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { requireOpsAccess } from '@/lib/ops/access';

/**
 * GET /api/ops/accounting/categories
 * List all accounting categories.
 */
export async function GET() {
  const access = await requireOpsAccess();
  if (!access || (!access.isAdmin && !access.isAgent)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('accounting_categories')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('[accounting/categories GET]', error);
    return NextResponse.json({ error: 'Failed to load categories' }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
