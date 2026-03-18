import { createBrowserClient } from '@supabase/ssr';

// Browser-side Supabase client (automatically handles cookies for SSR)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables not set. Database operations will fail.');
}

const cookieDomain =
  typeof window !== 'undefined' && window.location.hostname.endsWith('keystoneweb.ca')
    ? '.keystoneweb.ca'
    : undefined;

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  cookieOptions: {
    domain: cookieDomain,
  },
});

// For server-side operations, we can also use direct connection if needed
export const getDatabaseUrl = () => {
  return process.env.DATABASE_URL;
};
