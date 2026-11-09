/**
 * Server-side membership access for a site's pages.
 *
 * A visitor "has access" when they are signed in as an active member of the
 * site, their package is allowed (when the page lists packages) and, for paid
 * recurring packages, their subscription is in good standing. Pending
 * (unverified), suspended, cancelled and guest (checkout-only) members don't.
 */
import { hashToken, verifyMemberTokenAny } from '@/lib/membership/auth';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- works with the Supabase client and the test fake
type Db = { from: (table: string) => any };

export type AccessReason = 'signed-out' | 'inactive' | 'wrong-package' | 'unpaid';

export interface MemberVisitor {
  signedIn: boolean;
  hasAccess: boolean;
  reason: AccessReason | null;
  memberId?: string;
  packageId?: string | null;
}

export const SIGNED_OUT: MemberVisitor = { signedIn: false, hasAccess: false, reason: 'signed-out' };

/** Subscription states that keep a paid recurring package's access. */
const GOOD_SUBSCRIPTION = new Set(['active', 'trialing', 'past_due']);

export interface MemberRow {
  id: string;
  site_id: string;
  status: string | null;
  is_archived?: boolean | null;
  package_id: string | null;
  subscription_status?: string | null;
}

export interface PackageRow {
  id: string;
  price_cents: number | null;
  billing_interval: string | null;
}

/** The access rule itself (pure, so it can be tested and reused). */
export function evaluateAccess(member: MemberRow | null, pkg: PackageRow | null, allowedPackages?: string[] | null): MemberVisitor {
  if (!member || member.is_archived || member.status === 'cancelled') return SIGNED_OUT;
  const base = { signedIn: true, memberId: member.id, packageId: member.package_id ?? null };
  if (member.status !== 'active') return { ...base, hasAccess: false, reason: 'inactive' };
  if (allowedPackages && allowedPackages.length && !(member.package_id && allowedPackages.includes(member.package_id))) {
    return { ...base, hasAccess: false, reason: 'wrong-package' };
  }
  const recurringPaid = !!pkg && (pkg.price_cents || 0) > 0 && (pkg.billing_interval === 'month' || pkg.billing_interval === 'year');
  if (recurringPaid && !GOOD_SUBSCRIPTION.has(String(member.subscription_status || 'none'))) {
    return { ...base, hasAccess: false, reason: 'unpaid' };
  }
  return { ...base, hasAccess: true, reason: null };
}

/**
 * Resolve the visitor from the member session cookie value. `siteId` must be
 * the site being served: a token for another site never grants access.
 */
export async function resolveMemberVisitor(db: Db, siteId: string, token: string | undefined | null, allowedPackages?: string[] | null): Promise<MemberVisitor> {
  if (!token) return SIGNED_OUT;
  const payload = await verifyMemberTokenAny(token).catch(() => null);
  if (!payload || payload.siteId !== siteId) return SIGNED_OUT;

  const { data: session } = await db
    .from('member_sessions')
    .select('id')
    .eq('token_hash', hashToken(token))
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (!session) return SIGNED_OUT;

  const { data: member } = await db
    .from('members')
    .select('id, site_id, status, is_archived, package_id, subscription_status')
    .eq('id', payload.memberId)
    .eq('site_id', siteId)
    .maybeSingle();
  if (!member) return SIGNED_OUT;

  let pkg: PackageRow | null = null;
  if (member.package_id) {
    const { data } = await db.from('membership_packages').select('id, price_cents, billing_interval').eq('id', member.package_id).maybeSingle();
    pkg = data || null;
  }
  return evaluateAccess(member as MemberRow, pkg, allowedPackages);
}
