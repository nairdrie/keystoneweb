import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { EmailOtpType } from '@supabase/supabase-js';
import { COOKIE_DOMAIN } from '@/lib/env/domain';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get('next') ?? '/';

  // --- Path 1: token_hash flow (used when Supabase email template sends
  //     ?token_hash=...&type=recovery, which avoids PKCE code_verifier cookies
  //     and works reliably when the link opens in a mobile in-app browser).
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;

  // --- Path 2: PKCE code flow (Supabase default for server-side resetPasswordForEmail,
  //     and for OAuth providers like Google/Apple).
  const code = searchParams.get('code');

  if (!token_hash && !code) {
    return NextResponse.redirect(`${origin}/signin?error=auth_failed`);
  }

  // Collect cookies that Supabase wants to set, then apply them directly to the
  // redirect response. If we used cookieStore.set() (next/headers) instead, those
  // mutations would NOT be carried over to a NextResponse.redirect() — the two are
  // separate response objects — so the session cookies would never reach the browser
  // and getSession() on the next page would always return null.
  const cookieStore = await cookies();
  const pendingCookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  const cookieDomain =
    process.env.NODE_ENV === 'production' ? '.keystoneweb.ca' : undefined;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          pendingCookies.push(...cookiesToSet);
        },
      },
    }
  );

  let redirectUrl: string;

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });

    if (!error) {
      redirectUrl = `${origin}${next}`;
    } else {
      console.error('Auth callback token_hash verification error:', error);
      redirectUrl = `${origin}/forgot-password?error=link_expired`;
    }
  } else {
    // code is guaranteed non-null here
    const { error } = await supabase.auth.exchangeCodeForSession(code!);

    if (!error) {
      redirectUrl = `${origin}${next}`;
    } else {
      console.error('Auth callback code exchange error:', error);
      if (next.startsWith('/forgot-password') || next.startsWith('/reset-password')) {
        redirectUrl = `${origin}/forgot-password?error=link_expired`;
      } else {
        redirectUrl = `${origin}/signin?error=auth_failed`;
      }
    }
  }

  const response = NextResponse.redirect(redirectUrl);

  // Apply the session cookies directly to the redirect response so the browser
  // receives them and getSession() works on the destination page.
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, { ...(options as any), domain: cookieDomain });
  });

  return response;
}
