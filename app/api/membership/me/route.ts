import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import {
  verifyMemberTokenAny,
  hashToken,
  hashPassword,
  MEMBER_COOKIE_NAME,
} from '@/lib/membership/auth';

// Validate member token and return the member + session or null
async function authenticateMember(request: NextRequest) {
  const token = request.cookies.get(MEMBER_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifyMemberTokenAny(token);
  if (!payload) return null;

  const supabase = createAdminClient();

  // Verify session exists and is not expired
  const { data: session } = await supabase
    .from('member_sessions')
    .select('id')
    .eq('token_hash', hashToken(token))
    .gt('expires_at', new Date().toISOString())
    .single();

  if (!session) return null;

  return { payload, supabase };
}

/** GET /api/membership/me — Return current member profile */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateMember(request);
    if (!auth) {
      return NextResponse.json({ member: null }, { status: 200 });
    }

    const { payload, supabase } = auth;

    const { data: member } = await supabase
      .from('members')
      .select(`
        id, email, name, avatar_url, custom_fields, status,
        package_id, subscription_status, current_period_end,
        marketing_opt_in, signed_up_at, last_login_at,
        membership_packages(id, name, price_cents, currency, billing_interval, features)
      `)
      .eq('id', payload.memberId)
      .eq('site_id', payload.siteId)
      .single();

    if (!member || member.status === 'cancelled') {
      return NextResponse.json({ member: null }, { status: 200 });
    }

    return NextResponse.json({
      member: {
        id: member.id,
        email: member.email,
        name: member.name,
        avatarUrl: member.avatar_url,
        customFields: member.custom_fields,
        status: member.status,
        packageId: member.package_id,
        package: member.membership_packages,
        subscriptionStatus: member.subscription_status,
        currentPeriodEnd: member.current_period_end,
        marketingOptIn: member.marketing_opt_in,
        signedUpAt: member.signed_up_at,
        lastLoginAt: member.last_login_at,
      },
    });
  } catch (error: any) {
    console.error('Membership me GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** PATCH /api/membership/me — Update member profile */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateMember(request);
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { payload, supabase } = auth;
    const body = await request.json();
    const { name, avatarUrl, customFields, marketingOptIn, newPassword } = body;

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (avatarUrl !== undefined) updates.avatar_url = avatarUrl;
    if (customFields !== undefined) updates.custom_fields = customFields;
    if (marketingOptIn !== undefined) updates.marketing_opt_in = marketingOptIn;
    if (newPassword) {
      if (newPassword.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
      }
      updates.password_hash = await hashPassword(newPassword);
    }

    const { error } = await supabase
      .from('members')
      .update(updates)
      .eq('id', payload.memberId)
      .eq('site_id', payload.siteId);

    if (error) {
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Membership me PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** DELETE /api/membership/me — Delete member account (GDPR) */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticateMember(request);
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { payload, supabase } = auth;

    // Get member for Stripe cleanup
    const { data: member } = await supabase
      .from('members')
      .select('stripe_subscription_id, stripe_customer_id')
      .eq('id', payload.memberId)
      .eq('site_id', payload.siteId)
      .single();

    // TODO: Cancel Stripe subscription if active
    // if (member?.stripe_subscription_id) { ... }

    // Delete sessions first (FK cascade would handle this, but be explicit)
    await supabase
      .from('member_sessions')
      .delete()
      .eq('member_id', payload.memberId);

    // Delete the member record
    await supabase
      .from('members')
      .delete()
      .eq('id', payload.memberId)
      .eq('site_id', payload.siteId);

    const response = NextResponse.json({ success: true });
    response.cookies.set(MEMBER_COOKIE_NAME, '', { path: '/', maxAge: 0 });

    return response;
  } catch (error: any) {
    console.error('Membership me DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
