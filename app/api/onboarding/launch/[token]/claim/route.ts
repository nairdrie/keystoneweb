import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';

/**
 * POST /api/onboarding/launch/[token]/claim
 * Body: { password: string }
 *
 * Idempotent first-step claim:
 *  - Looks up launch_requests by token
 *  - Creates a Supabase auth user with the intake email + chosen password
 *    (if one doesn't already exist for this onboarding)
 *  - Sets user flags (launch_service_active, suppress_designer_walkthrough)
 *  - Transfers site ownership to the new user
 *  - Advances onboarding_status to 'previewing' (or 'awaiting_payment' if skipPreview)
 *
 * Returns { email } so the client can sign in via supabase.auth.signInWithPassword.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: 'Invalid onboarding link' }, { status: 400 });
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const password = body.password?.trim();
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: req, error: reqError } = await db
    .from('launch_requests')
    .select('id, name, email, business_name, site_id, launch_config, onboarding_status, onboarding_user_id')
    .eq('onboarding_token', token)
    .single();

  if (reqError || !req) {
    return NextResponse.json({ error: 'Onboarding link not found' }, { status: 404 });
  }

  if (!req.site_id) {
    return NextResponse.json({ error: 'No site is attached to this launch yet' }, { status: 400 });
  }

  const launchConfig = (req.launch_config ?? {}) as { skipPreview?: boolean };
  const nextStatus = launchConfig.skipPreview ? 'awaiting_payment' : 'previewing';

  // If we've already claimed this token, just (re)set the password and return.
  if (req.onboarding_user_id) {
    const { error: updErr } = await db.auth.admin.updateUserById(req.onboarding_user_id, {
      password,
    });
    if (updErr) {
      console.error('Failed to update password on existing onboarding user:', updErr);
      return NextResponse.json({ error: 'Failed to set password' }, { status: 500 });
    }

    // Make sure the launch_request status reflects that they've now set a password.
    if (
      req.onboarding_status === 'sent' ||
      req.onboarding_status === 'not_sent' ||
      req.onboarding_status === 'account_claimed'
    ) {
      await db.from('launch_requests').update({ onboarding_status: nextStatus }).eq('id', req.id);
    }

    return NextResponse.json({ email: req.email, alreadyClaimed: true });
  }

  // Check that no other user is already using this email.
  const { data: existing } = await db
    .from('users')
    .select('id')
    .eq('email', req.email.toLowerCase())
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      {
        error:
          'An account with this email already exists. Please sign in instead — your launch will resume there.',
      },
      { status: 409 },
    );
  }

  // Create the auth user.
  const { data: created, error: createError } = await db.auth.admin.createUser({
    email: req.email,
    password,
    email_confirm: true,
    user_metadata: { name: req.name || undefined },
  });
  if (createError || !created.user) {
    console.error('Failed to create launch-service user:', createError);
    return NextResponse.json({ error: 'Failed to create your account' }, { status: 500 });
  }
  const newUserId = created.user.id;

  // Upsert public.users with launch-service flags.
  const { error: profileErr } = await db.from('users').upsert(
    {
      id: newUserId,
      email: req.email.toLowerCase(),
      business_name: req.business_name,
      launch_service_active: true,
      suppress_designer_walkthrough: true,
    },
    { onConflict: 'id' },
  );
  if (profileErr) {
    console.error('Failed to upsert user profile:', profileErr);
  }

  // Transfer site ownership.
  const { error: siteErr } = await db
    .from('sites')
    .update({ user_id: newUserId })
    .eq('id', req.site_id);
  if (siteErr) {
    console.error('Failed to transfer site ownership:', siteErr);
    return NextResponse.json({ error: 'Failed to transfer site ownership' }, { status: 500 });
  }

  // Advance launch_request.
  const { error: lrErr } = await db
    .from('launch_requests')
    .update({
      onboarding_user_id: newUserId,
      onboarding_status: nextStatus,
    })
    .eq('id', req.id);
  if (lrErr) {
    console.error('Failed to advance launch_request:', lrErr);
  }

  return NextResponse.json({ email: req.email });
}
