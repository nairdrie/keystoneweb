import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getOpsAccessContext } from '@/lib/ops/access';

export async function POST(request: NextRequest) {
  const access = await getOpsAccessContext();
  if (!access?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const businessName = typeof body.businessName === 'string' ? body.businessName.trim() : '';
  const status = typeof body.status === 'string' ? body.status : 'building';
  const siteId = typeof body.siteId === 'string' ? body.siteId : null;

  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
  }

  const db = createAdminClient();

  if (siteId) {
    const { data: site } = await db
      .from('sites')
      .select('id, user_id')
      .eq('id', siteId)
      .single();
    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 400 });
    }
    if (site.user_id !== access.userId) {
      return NextResponse.json(
        { error: 'You can only attach sites that belong to you' },
        { status: 400 },
      );
    }
  }

  const { data, error } = await db
    .from('launch_requests')
    .insert({
      name,
      email,
      business_name: businessName || null,
      status,
      site_id: siteId,
      assignee_user_id: access.userId,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to create launch_request:', error);
    return NextResponse.json({ error: 'Create failed' }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}

export async function GET() {
  const access = await getOpsAccessContext();
  if (!access?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('sites')
    .select('id, site_slug, business_type, is_published, published_domain, custom_domain')
    .eq('user_id', access.userId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch sites' }, { status: 500 });
  }

  return NextResponse.json({ sites: data ?? [] });
}
