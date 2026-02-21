import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required' },
        { status: 400 }
      );
    }

    // Use Supabase client with anon key (for auth endpoint)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );

    // Sign up with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    });

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Failed to create account' },
        { status: 400 }
      );
    }

    // Return user data
    return NextResponse.json({
      success: true,
      user: data.user,
    });
  } catch (err) {
    console.error('Sign up error:', err);
    return NextResponse.json(
      { error: 'An error occurred during sign up' },
      { status: 500 }
    );
  }
}
