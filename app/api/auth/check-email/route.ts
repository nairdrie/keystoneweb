import { supabase } from '@/lib/db/supabase';

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return Response.json({ error: 'Email required' }, { status: 400 });
    }

    // Check if user exists in our users table (synced from auth.users via trigger)
    const { data, error } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned (not an error, user doesn't exist)
      console.error('Error checking email:', error);
      return Response.json({ error: 'Database error' }, { status: 500 });
    }

    return Response.json({
      exists: !!data,
      email: data?.email || null,
    });
  } catch (error) {
    console.error('Check email error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
