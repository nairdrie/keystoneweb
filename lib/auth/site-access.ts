import { NextRequest, NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';

/**
 * Centralized site-access authorization for site-scoped API endpoints.
 *
 * Replaces the pattern:
 *   if (site.user_id !== user.id) return 403
 *
 * Adds an admin "Manage Site" mode where an admin can act on a site they
 * don't own, gated by the `ksw_admin_site` cookie naming exactly that site.
 *
 * - Owner mode:   returns the user-scoped client (RLS still applies).
 * - Admin mode:   returns the service-role client (RLS bypassed). The admin's
 *                 real identity is preserved — auth.getUser() is NOT overridden,
 *                 unlike impersonation.
 *
 * Mutating requests in admin mode are recorded in `admin_site_action_log`.
 */

export const ADMIN_SITE_COOKIE = 'ksw_admin_site';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export class SiteAccessDeniedError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'SiteAccessDeniedError';
  }
}

export interface SiteAccess {
  supabase: SupabaseClient;
  user: User;
  isAdminMode: boolean;
  targetUserId: string;
  siteId: string;
}

export async function requireSiteAccess(
  siteId: string | null | undefined,
  request: NextRequest
): Promise<SiteAccess> {
  if (!siteId) {
    throw new SiteAccessDeniedError(400, 'Missing siteId');
  }

  const userClient = await createClient();
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    throw new SiteAccessDeniedError(401, 'Unauthorized');
  }

  const admin = createAdminClient();
  const { data: site, error: siteErr } = await admin
    .from('sites')
    .select('id, user_id')
    .eq('id', siteId)
    .single();

  if (siteErr || !site) {
    throw new SiteAccessDeniedError(404, 'Site not found');
  }

  // Owner path — keep the user-scoped client so RLS continues to apply on
  // subsequent reads. Includes the impersonation case (createClient() may
  // have already swapped user.id to the impersonated target).
  if (site.user_id === user.id) {
    return {
      supabase: userClient,
      user,
      isAdminMode: false,
      targetUserId: site.user_id,
      siteId: site.id,
    };
  }

  // Admin manage-mode path — disabled while impersonation is active so the
  // two flows never combine. Cookie must point at THIS site, and the calling
  // user must be a real admin.
  const headerList = await headers();
  const isImpersonating = !!headerList.get('x-impersonated-user-id');
  if (!isImpersonating) {
    const cookieStore = await cookies();
    const cookieSiteId = cookieStore.get(ADMIN_SITE_COOKIE)?.value;
    if (cookieSiteId && cookieSiteId === site.id) {
      const { data: profile } = await admin
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (profile?.is_admin) {
        if (MUTATING_METHODS.has(request.method.toUpperCase())) {
          const { error: logErr } = await admin
            .from('admin_site_action_log')
            .insert({
              admin_user_id: user.id,
              target_user_id: site.user_id,
              site_id: site.id,
              http_method: request.method.toUpperCase(),
              request_path: request.nextUrl.pathname,
            });
          if (logErr) {
            console.error('[manage-site] audit log failed:', logErr.message);
          }
        }

        return {
          supabase: admin,
          user,
          isAdminMode: true,
          targetUserId: site.user_id,
          siteId: site.id,
        };
      }
    }
  }

  throw new SiteAccessDeniedError(403, 'Forbidden');
}

export function siteAccessErrorResponse(err: unknown): NextResponse {
  if (err instanceof SiteAccessDeniedError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error('[requireSiteAccess] unexpected error:', err);
  return NextResponse.json({ error: 'Internal error' }, { status: 500 });
}
