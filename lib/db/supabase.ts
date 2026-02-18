import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client using connection pooling
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables not set. Database operations will fail.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// For server-side operations, we can also use direct connection if needed
export const getDatabaseUrl = () => {
  return process.env.DATABASE_URL;
};
