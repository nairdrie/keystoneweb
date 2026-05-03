import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { MEMBER_COOKIE_NAME, hashToken, verifyMemberTokenAny } from '@/lib/membership/auth';
import { createAdminClient } from '@/lib/db/supabase-admin';

export interface CurrentMember {
  memberId: string;
  siteId: string;
  packageId: string | null;
}

async function resolveFromToken(token: string | undefined, requiredSiteId?: string): Promise<CurrentMember | null> {
  if (!token) return null;
  const payload = await verifyMemberTokenAny(token);
  if (!payload) return null;
  if (requiredSiteId && payload.siteId !== requiredSiteId) return null;

  const supabase = createAdminClient();

  const { data: session } = await supabase
    .from('member_sessions')
    .select('id')
    .eq('token_hash', hashToken(token))
    .gt('expires_at', new Date().toISOString())
    .single();
  if (!session) return null;

  const { data: member } = await supabase
    .from('members')
    .select('id, site_id, package_id, status, is_archived')
    .eq('id', payload.memberId)
    .eq('site_id', payload.siteId)
    .single();
  if (!member || member.is_archived || member.status === 'cancelled') return null;

  return {
    memberId: member.id,
    siteId: member.site_id,
    packageId: member.package_id ?? null,
  };
}

/** Resolve the current member from the NextRequest cookie (API routes). */
export async function getCurrentMemberFromRequest(
  request: NextRequest,
  requiredSiteId?: string,
): Promise<CurrentMember | null> {
  return resolveFromToken(request.cookies.get(MEMBER_COOKIE_NAME)?.value, requiredSiteId);
}

/** Resolve the current member from next/headers cookies (server components). */
export async function getCurrentMember(requiredSiteId?: string): Promise<CurrentMember | null> {
  const store = await cookies();
  return resolveFromToken(store.get(MEMBER_COOKIE_NAME)?.value, requiredSiteId);
}
