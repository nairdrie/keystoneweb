import { NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { randomBytes } from 'crypto';
import { APP_URL } from '@/lib/env/domain';
import { resend } from '@/lib/email/resend';

function assertAdmin(userEmail: string | undefined) {
  const adminEmails = (process.env.OPS_ADMIN_EMAILS || '')
    .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!userEmail || !adminEmails.includes(userEmail.toLowerCase())) {
    throw new Error('Forbidden');
  }
}

// GET /api/ops/agents — list all agents
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    assertAdmin(user?.email);

    const db = createAdminClient();

    // Fetch agents
    const { data: agents, error } = await db
      .from('users')
      .select('id, email, business_name, agent_contact_email, created_at')
      .eq('is_agent', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Fetch pending invites
    const { data: invites } = await db
      .from('agent_invites')
      .select('id, personal_email, contact_email, token, created_at, expires_at, accepted_at')
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    return NextResponse.json({ agents: agents ?? [], invites: invites ?? [] });
  } catch (err: any) {
    if (err.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[ops/agents GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/ops/agents — create an agent invite
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    assertAdmin(user?.email);

    const { personal_email, contact_email } = await request.json();

    if (!personal_email || !contact_email) {
      return NextResponse.json(
        { error: 'personal_email and contact_email are required' },
        { status: 400 }
      );
    }

    if (!contact_email.endsWith('@keystoneweb.ca')) {
      return NextResponse.json(
        { error: 'contact_email must be a @keystoneweb.ca address' },
        { status: 400 }
      );
    }

    const token = randomBytes(32).toString('hex');
    const db = createAdminClient();

    const { data: invite, error } = await db
      .from('agent_invites')
      .insert({
        personal_email: personal_email.toLowerCase().trim(),
        contact_email: contact_email.toLowerCase().trim(),
        token,
        created_by: user!.id,
      })
      .select()
      .single();

    if (error) throw error;

    const inviteUrl = `${APP_URL}/agent-signup/${token}`;

    // Send invite email via Resend
    await resend.emails.send({
      from: 'Keystone Operations <ops@keystoneweb.ca>',
      to: personal_email,
      subject: 'You\'ve been invited to join Keystone Operations',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f9fafb; border-radius: 12px;">
          <h2 style="color: #111827; margin: 0 0 16px;">Welcome to Keystone Operations</h2>
          <p style="color: #374151; margin: 0 0 12px;">
            You've been invited to create a Keystone sales agent account.
            Your assigned contact email will be <strong>${contact_email}</strong>.
          </p>
          <p style="color: #374151; margin: 0 0 24px;">
            Click the button below to set up your account. This link expires in 7 days.
          </p>
          <a href="${inviteUrl}" style="display: inline-block; background: #10b981; color: #fff; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 15px;">
            Create Your Account
          </a>
          <p style="margin: 24px 0 0; font-size: 12px; color: #9ca3af;">
            If you weren't expecting this invitation, you can ignore this email.
          </p>
        </div>
      `,
    });

    return NextResponse.json({ invite, invite_url: inviteUrl });
  } catch (err: any) {
    if (err.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[ops/agents POST]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
