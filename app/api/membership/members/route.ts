import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

/** GET /api/membership/members?siteId=xxx — List members (admin) */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const siteId = request.nextUrl.searchParams.get('siteId');
    if (!siteId) {
      return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    // Verify ownership (RLS handles this but be explicit)
    const { data: site } = await supabase
      .from('sites')
      .select('id')
      .eq('id', siteId)
      .eq('user_id', user.id)
      .single();

    if (!site) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const status = request.nextUrl.searchParams.get('status');
    const search = request.nextUrl.searchParams.get('search');
    const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '50'), 100);
    const offset = (page - 1) * limit;

    const sortByParam = request.nextUrl.searchParams.get('sortBy') || 'signed_up_at';
    const sortDirParam = request.nextUrl.searchParams.get('sortDir') || 'desc';
    const ascending = sortDirParam === 'asc';

    // Map frontend sort keys to actual DB columns
    const SORT_COLUMN_MAP: Record<string, string> = {
      name: 'name',
      email: 'email',
      status: 'status',
      signed_up_at: 'signed_up_at',
      last_login_at: 'last_login_at',
      subscription_status: 'subscription_status',
      package: 'package_id',
    };
    const sortColumn = SORT_COLUMN_MAP[sortByParam] || 'signed_up_at';

    let query = supabase
      .from('members')
      .select(`
        id, email, name, avatar_url, status, email_verified,
        custom_fields, package_id, subscription_status, current_period_end,
        marketing_opt_in, signed_up_at, last_login_at, created_at,
        membership_packages(id, name)
      `, { count: 'exact' })
      .eq('site_id', siteId)
      .eq('is_archived', false)
      .order(sortColumn, { ascending })
      .range(offset, offset + limit - 1);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (search) {
      query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%,custom_fields::text.ilike.%${search}%`);
    }

    const { data: members, count, error } = await query;

    if (error) {
      console.error('Members list error:', error);
      return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
    }

    return NextResponse.json({
      members: members || [],
      total: count || 0,
      page,
      limit,
    });
  } catch (error: any) {
    console.error('Members list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** PATCH /api/membership/members — Update member status (admin) */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { siteId, memberId, status, packageId } = await request.json();
    if (!siteId || !memberId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify ownership
    const { data: site } = await supabase
      .from('sites')
      .select('id')
      .eq('id', siteId)
      .eq('user_id', user.id)
      .single();

    if (!site) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (packageId !== undefined) updates.package_id = packageId;

    const { error } = await supabase
      .from('members')
      .update(updates)
      .eq('id', memberId)
      .eq('site_id', siteId);

    if (error) {
      return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Member update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** DELETE /api/membership/members — Delete member (admin) */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { siteId, memberId } = await request.json();
    if (!siteId || !memberId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: site } = await supabase
      .from('sites')
      .select('id')
      .eq('id', siteId)
      .eq('user_id', user.id)
      .single();

    if (!site) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Invalidate any active sessions so an archived member can't keep using them.
    await supabase
      .from('member_sessions')
      .delete()
      .eq('member_id', memberId)
      .eq('site_id', siteId);

    // Soft-delete the member record (recoverable; preserves order/subscription history).
    const { error } = await supabase
      .from('members')
      .update({ is_archived: true, archived_on: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', memberId)
      .eq('site_id', siteId);

    if (error) {
      return NextResponse.json({ error: 'Failed to delete member' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Member delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
