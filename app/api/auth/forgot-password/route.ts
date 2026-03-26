import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // resetPasswordForEmail is unauthenticated — no session cookies needed.
  // Using a cookie-free client avoids stale/expired auth cookies in the request
  // (e.g. from a Gmail in-app browser after sign-out) causing internal refresh
  // failures that pollute the client and make this call error incorrectly.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );

  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
    });

    if (error) {
      console.error('Password reset error:', error);
      return NextResponse.json({ error: 'Failed to send reset email' }, { status: 500 });
    }

    // Always return success to avoid leaking whether the email exists
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Forgot password error:', err);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}
