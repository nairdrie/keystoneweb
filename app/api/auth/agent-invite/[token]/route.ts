import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';

// GET /api/auth/agent-invite/[token] — validate an invite token
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const db = createAdminClient();

    const { data: invite, error } = await db
      .from('agent_invites')
      .select('id, personal_email, contact_email, accepted_at, expires_at')
      .eq('token', token)
      .single();

    if (error || !invite) {
      return NextResponse.json({ valid: false, error: 'Invite not found' }, { status: 404 });
    }

    if (invite.accepted_at) {
      return NextResponse.json({ valid: false, error: 'Invite already accepted' }, { status: 410 });
    }

    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ valid: false, error: 'Invite has expired' }, { status: 410 });
    }

    return NextResponse.json({
      valid: true,
      personal_email: invite.personal_email,
      contact_email: invite.contact_email,
    });
  } catch (err) {
    console.error('[agent-invite]', err);
    return NextResponse.json({ valid: false, error: 'Server error' }, { status: 500 });
  }
}
