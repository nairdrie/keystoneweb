import { createClient } from '@/lib/db/supabase-server';
import { NextResponse } from 'next/server';
import { EmailOtpType } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get('next') ?? '/';

  // --- Path 1: token_hash flow (used when Supabase email template sends
  //     ?token_hash=...&type=recovery, which avoids PKCE code_verifier cookies
  //     and works reliably when the link opens in a mobile in-app browser).
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    console.error('Auth callback token_hash verification error:', error);
    return NextResponse.redirect(`${origin}/forgot-password?error=link_expired`);
  }

  // --- Path 2: PKCE code flow (Supabase default for server-side resetPasswordForEmail,
  //     and for OAuth providers like Google/Apple).
  //     Doing the exchange server-side avoids the mobile issue where the code_verifier
  //     stored in localStorage is lost when the OAuth flow opens an external browser.
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    console.error('Auth callback code exchange error:', error);
    // If next points to a password-reset page, treat as an expired link; otherwise
    // send the user back to sign-in with a generic error.
    if (next.startsWith('/forgot-password') || next.startsWith('/reset-password')) {
      return NextResponse.redirect(`${origin}/forgot-password?error=link_expired`);
    }
    return NextResponse.redirect(`${origin}/signin?error=auth_failed`);
  }

  return NextResponse.redirect(`${origin}/signin?error=auth_failed`);
}
