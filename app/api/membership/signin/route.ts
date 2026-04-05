import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import {
  verifyPassword,
  signMemberToken,
  hashToken,
  getTokenExpiresAt,
  MEMBER_COOKIE_NAME,
  getMemberCookieOptions,
} from '@/lib/membership/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { siteId, email, password } = body;

    if (!siteId || !email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const emailLower = email.trim().toLowerCase();
    const supabase = createAdminClient();

    // Look up member
    const { data: member } = await supabase
      .from('members')
      .select('id, email, password_hash, name, status, email_verified, avatar_url, package_id')
      .eq('site_id', siteId)
      .eq('email', emailLower)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Check password
    const valid = await verifyPassword(password, member.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Check status
    if (member.status === 'suspended') {
      return NextResponse.json({ error: 'Your account has been suspended' }, { status: 403 });
    }
    if (member.status === 'cancelled') {
      return NextResponse.json({ error: 'Your account has been cancelled' }, { status: 403 });
    }
    if (member.status === 'pending' && !member.email_verified) {
      return NextResponse.json({ error: 'Please verify your email before signing in' }, { status: 403 });
    }

    // Issue JWT
    const token = await signMemberToken({
      memberId: member.id,
      siteId,
      email: member.email,
    });

    // Store session
    const expiresAt = getTokenExpiresAt();
    await supabase.from('member_sessions').insert({
      member_id: member.id,
      site_id: siteId,
      token_hash: hashToken(token),
      user_agent: request.headers.get('user-agent') || null,
      ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      expires_at: expiresAt.toISOString(),
    });

    // Update last login
    await supabase
      .from('members')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', member.id);

    const response = NextResponse.json({
      success: true,
      member: {
        id: member.id,
        email: member.email,
        name: member.name,
        avatarUrl: member.avatar_url,
        packageId: member.package_id,
      },
    });

    response.cookies.set(MEMBER_COOKIE_NAME, token, getMemberCookieOptions());

    return response;
  } catch (error: any) {
    console.error('Membership signin error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
