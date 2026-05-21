import { NextResponse } from 'next/server';
import { assertOpsAdmin } from '@/lib/ops/access';
import { createAdminClient } from '@/lib/db/supabase-admin';

/**
 * GET /api/ops/users/[id]/sites
 * Returns the target user's sites for the manage-site popover.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await assertOpsAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;
  const db = createAdminClient();
  const { data, error } = await db
    .from('sites')
    .select('id, site_slug, business_type, is_published, published_domain, custom_domain, created_at, updated_at')
    .eq('user_id', id)
    .order('updated_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sites: data ?? [] });
}
