import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';

const COOKIE_DOMAIN =
  process.env.NODE_ENV === 'production' ? '.keystoneweb.ca' : undefined;

// POST /api/auth/agent-signup
// Body: { token, password, name }
// Creates the Supabase auth user, marks them as an agent in the public.users table,
// and marks the invite as accepted.
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const pendingCookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          pendingCookies.push(...cookiesToSet);
        },
      },
    }
  );

  function jsonWithPendingCookies(body: unknown, init?: ResponseInit) {
    const response = NextResponse.json(body, init);
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, { ...(options as any), domain: COOKIE_DOMAIN });
    });
    return response;
  }

  try {
    const { token, password, name } = await request.json();

    if (!token || !password || !name) {
      return NextResponse.json(
        { error: 'token, password, and name are required' },
        { status: 400 }
      );
    }

    const db = createAdminClient();

    // Validate the invite
    const { data: invite, error: inviteError } = await db
      .from('agent_invites')
      .select('id, personal_email, contact_email, accepted_at, expires_at')
      .eq('token', token)
      .single();

    if (inviteError || !invite) {
      return NextResponse.json({ error: 'Invalid invite token' }, { status: 400 });
    }

    if (invite.accepted_at) {
      return NextResponse.json({ error: 'Invite already used' }, { status: 410 });
    }

    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invite has expired' }, { status: 410 });
    }

    // Create Supabase auth user
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: invite.personal_email,
      password,
      options: { data: { name } },
    });

    if (signUpError) {
      return NextResponse.json({ error: signUpError.message }, { status: 400 });
    }

    const userId = authData.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    // Mark as agent in public.users (upsert because trigger may have already created the row)
    const { error: profileError } = await db
      .from('users')
      .upsert({
        id: userId,
        email: invite.personal_email,
        business_name: name,
        is_agent: true,
        agent_contact_email: invite.contact_email,
      }, { onConflict: 'id' });

    if (profileError) {
      console.error('[agent-signup] profile upsert error:', profileError);
      // Non-fatal — user is created, we can fix the profile later
    }

    // Mark invite as accepted
    await db
      .from('agent_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id);

    return jsonWithPendingCookies({ success: true });
  } catch (err: any) {
    console.error('[agent-signup]', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
