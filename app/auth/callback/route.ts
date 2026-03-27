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

  // --- Path 2: PKCE code flow (Supabase default for server-side resetPasswordForEmail).
  //     This can fail on mobile when the email link opens in an in-app browser that
  //     doesn't share the code_verifier cookie with the browser that made the request.
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    console.error('Auth callback code exchange error:', error);
    return NextResponse.redirect(`${origin}/forgot-password?error=link_expired`);
  }

  return NextResponse.redirect(`${origin}/forgot-password?error=link_expired`);
}
