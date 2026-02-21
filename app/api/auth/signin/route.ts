import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Use Supabase client with anon key (for auth endpoint)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );

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

    // Return session data (tokens will be set in httpOnly cookies by middleware)
    return NextResponse.json({
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
