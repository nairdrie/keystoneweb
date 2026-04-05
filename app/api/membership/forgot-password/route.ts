import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { generateSecureToken, getPasswordResetExpiresAt } from '@/lib/membership/auth';

/** POST /api/membership/forgot-password */
export async function POST(request: NextRequest) {
  try {
    const { siteId, email } = await request.json();

    if (!siteId || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const emailLower = email.trim().toLowerCase();
    const supabase = createAdminClient();

    const { data: member } = await supabase
      .from('members')
      .select('id, name')
      .eq('site_id', siteId)
      .eq('email', emailLower)
      .in('status', ['active', 'pending'])
      .single();

    // Always return success to prevent email enumeration
    if (!member) {
      return NextResponse.json({ success: true });
    }

    const resetToken = generateSecureToken();
    const expiresAt = getPasswordResetExpiresAt();

    await supabase
      .from('members')
      .update({
        password_reset_token: resetToken,
        password_reset_expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', member.id);

    // TODO: Send password reset email via Resend
    // The email should contain a link like:
    // https://{siteDomain}/forgot-password?token={resetToken}&siteId={siteId}&action=reset

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
