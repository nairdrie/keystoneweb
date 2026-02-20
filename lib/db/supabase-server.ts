import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server-side Supabase client for use in:
 * - Middleware
 * - Server Components
 * - Route Handlers (API endpoints)
 * - Server Actions
 *
 * This client automatically handles token refresh using cookies.
 * IMPORTANT: Always use supabase.auth.getUser() for authorization checks,
 * NOT getSession(), which doesn't cryptographically verify tokens.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            // Handle errors during cookie setting (e.g., in middleware)
            console.error('Error setting cookies:', error);
          }
        },
      },
    }
  );
}
