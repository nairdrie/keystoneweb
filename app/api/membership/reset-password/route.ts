import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { hashPassword } from '@/lib/membership/auth';

/** POST /api/membership/reset-password */
export async function POST(request: NextRequest) {
  try {
    const { siteId, token, newPassword } = await request.json();

    if (!siteId || !token || !newPassword) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: member } = await supabase
      .from('members')
      .select('id, password_reset_expires_at')
      .eq('site_id', siteId)
      .eq('password_reset_token', token)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 });
    }

    if (member.password_reset_expires_at && new Date(member.password_reset_expires_at) < new Date()) {
      return NextResponse.json({ error: 'Reset link has expired. Please request a new one.' }, { status: 400 });
    }

    const passwordHash = await hashPassword(newPassword);

    await supabase
      .from('members')
      .update({
        password_hash: passwordHash,
        password_reset_token: null,
        password_reset_expires_at: null,
        status: 'active',
        email_verified: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', member.id);

    // Invalidate all existing sessions for security
    await supabase
      .from('member_sessions')
      .delete()
      .eq('member_id', member.id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
