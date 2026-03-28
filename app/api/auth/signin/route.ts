import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const pendingCookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];

  // Create server-side Supabase client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
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

  function jsonWithPendingCookies(body: unknown, init?: ResponseInit) {
    const response = NextResponse.json(body, init);
    const domain =
      process.env.NODE_ENV === 'production' ? '.keystoneweb.ca' : undefined;
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, { ...(options as any), domain });
    });
    return response;
  }

  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json(
        { error: 'Incorrect email or password' },
        { status: 401 }
      );
    }

    return jsonWithPendingCookies({
      success: true,
      user: data.user,
    });
  } catch (err) {
    console.error('Sign in error:', err);
    return NextResponse.json(
      { error: 'An error occurred during sign in' },
      { status: 500 }
    );
  }
}
