import { createBrowserClient } from '@supabase/ssr';

// Browser-side Supabase client (automatically handles cookies for SSR)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables not set. Database operations will fail.');
}

// Browser can't read server env vars, so derive the cookie domain from the
// hostname it's actually running on. This keeps staging cookies scoped to
// .staging.keystoneweb.ca and prod cookies to .keystoneweb.ca.
function browserCookieDomain(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const host = window.location.hostname;
  if (host.endsWith('.staging.keystoneweb.ca') || host === 'staging.keystoneweb.ca') {
    return '.staging.keystoneweb.ca';
  }
  if (host.endsWith('.keystoneweb.ca') || host === 'keystoneweb.ca') {
    return '.keystoneweb.ca';
  }
  return undefined;
}

const cookieDomain = browserCookieDomain();

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  cookieOptions: {
    domain: cookieDomain,
  },
});

// For server-side operations, we can also use direct connection if needed
export const getDatabaseUrl = () => {
  return process.env.DATABASE_URL;
};
