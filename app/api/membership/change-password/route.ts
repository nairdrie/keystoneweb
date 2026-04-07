import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import {
  verifyMemberTokenAny,
  hashToken,
  verifyPassword,
  hashPassword,
  MEMBER_COOKIE_NAME,
} from '@/lib/membership/auth';

/** POST /api/membership/change-password — Verify current password then set new one */
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(MEMBER_COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const payload = await verifyMemberTokenAny(token);
    if (!payload) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const supabase = createAdminClient();

    // Verify active session
    const { data: session } = await supabase
      .from('member_sessions')
      .select('id')
      .eq('token_hash', hashToken(token))
      .gt('expires_at', new Date().toISOString())
      .single();

    if (!session) return NextResponse.json({ error: 'Session expired' }, { status: 401 });

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Both current and new password are required' }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
    }

    // Fetch current password hash
    const { data: member } = await supabase
      .from('members')
      .select('password_hash')
      .eq('id', payload.memberId)
      .eq('site_id', payload.siteId)
      .single();

    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

    const valid = await verifyPassword(currentPassword, member.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }

    const newHash = await hashPassword(newPassword);

    const { error } = await supabase
      .from('members')
      .update({ password_hash: newHash, updated_at: new Date().toISOString() })
      .eq('id', payload.memberId)
      .eq('site_id', payload.siteId);

    if (error) return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Change password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
