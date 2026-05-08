import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import { createAdminClient } from './supabase-admin';
import { COOKIE_DOMAIN } from '@/lib/env/domain';

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
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, { ...options, domain: COOKIE_DOMAIN });
            });
          } catch (error) {
            console.error('Error setting cookies:', error);
          }
        },
      },
    }
  );

  // If impersonation is active, override the client to use service role
  // so that queries bypass RLS and we can actually see the target user's data.
  if (impersonatedUserId) {
    // First verify the ACTUAL user is logged in via the anon client
    const { data: { user: actualUser } } = await supabase.auth.getUser();

    if (actualUser) {
      const adminClient = createAdminClient();
      const { data: actualProfile } = await adminClient
        .from('users')
        .select('is_admin')
        .eq('id', actualUser.id)
        .single();

      if (actualProfile?.is_admin) {
        const { data: { user: targetUser }, error } = await adminClient.auth.admin.getUserById(impersonatedUserId);

        if (targetUser && !error) {
          console.log(`[Impersonation] Active: Admin ${actualUser.email} is impersonating ${targetUser.email}`);
          // Return the admin client but with auth.getUser() overridden to return the target user
          // tagged with impersonation metadata.
          const originalGetUser = adminClient.auth.getUser.bind(adminClient.auth);
          adminClient.auth.getUser = async (token?: string) => {
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

          return adminClient;
        }
      }
    }
  }

  return supabase;
}
