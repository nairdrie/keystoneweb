import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import { createAdminClient } from './supabase-admin';

/**
 * Server-side Supabase client for use in:
 * - Middleware
 * - Server Components
 * - Route Handlers (API endpoints)
 * - Server Actions
 *
 * This client automatically handles token refresh using cookies.
 * Supports impersonation for admins via the x-impersonated-user-id header.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const headerList = await headers();
  const impersonatedUserId = headerList.get('x-impersonated-user-id');

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          const cookieDomain =
            process.env.NODE_ENV === 'production' ? '.keystoneweb.ca' : undefined;
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, { ...options, domain: cookieDomain });
            });
          } catch (error) {
            console.error('Error setting cookies:', error);
          }
        },
      },
    }
  );

  // If impersonation is active, override auth.getUser()
  if (impersonatedUserId) {
    const originalGetUser = supabase.auth.getUser.bind(supabase.auth);
    
    supabase.auth.getUser = async (token?: string) => {
      // First, we must still verify the ACTUAL user is logged in (via originalGetUser)
      // to ensure the session is valid, though the middleware already did this.
      const { data: { user: actualUser } } = await originalGetUser(token);
      if (!actualUser) return { data: { user: null }, error: null };

      // Now fetch the impersonated user using the admin client
      const adminClient = createAdminClient();
      const { data: { user: targetUser }, error } = await adminClient.auth.admin.getUserById(impersonatedUserId);
      
      if (error || !targetUser) {
        console.error('[Impersonation] Failed to fetch target user:', impersonatedUserId, error);
        return { data: { user: null }, error: error as any };
      }

      // Return the target user but tagged as impersonated
      return { 
        data: { 
          user: { 
            ...targetUser, 
            is_impersonated: true,
            original_admin_id: actualUser.id 
          } as any 
        }, 
        error: null 
      };
    };
  }

  return supabase;
}
