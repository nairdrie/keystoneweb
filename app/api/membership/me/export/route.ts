import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { verifyMemberTokenAny, hashToken, MEMBER_COOKIE_NAME } from '@/lib/membership/auth';

/** GET /api/membership/me/export — GDPR data export */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(MEMBER_COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const payload = await verifyMemberTokenAny(token);
    if (!payload) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Verify session
    const { data: session } = await supabase
      .from('member_sessions')
      .select('id')
      .eq('token_hash', hashToken(token))
      .gt('expires_at', new Date().toISOString())
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Fetch all member data
    const { data: member } = await supabase
      .from('members')
      .select(`
        id, email, name, avatar_url, custom_fields, status,
        email_verified, subscription_status, current_period_end,
        marketing_opt_in, signed_up_at, last_login_at, created_at,
        membership_packages(id, name, price_cents, currency, billing_interval)
      `)
      .eq('id', payload.memberId)
      .eq('site_id', payload.siteId)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Fetch session history
    const { data: sessions } = await supabase
      .from('member_sessions')
      .select('user_agent, ip_address, created_at, expires_at')
      .eq('member_id', payload.memberId)
      .order('created_at', { ascending: false });

    const exportData = {
      exportedAt: new Date().toISOString(),
      profile: {
        id: member.id,
        email: member.email,
        name: member.name,
        avatarUrl: member.avatar_url,
        customFields: member.custom_fields,
        status: member.status,
        emailVerified: member.email_verified,
        marketingOptIn: member.marketing_opt_in,
        signedUpAt: member.signed_up_at,
        lastLoginAt: member.last_login_at,
        createdAt: member.created_at,
      },
      subscription: {
        status: member.subscription_status,
        currentPeriodEnd: member.current_period_end,
        package: member.membership_packages,
      },
      loginHistory: sessions || [],
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="member-data-export-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error: any) {
    console.error('Membership export error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
