/**
 * Who may start a membership checkout, and where Stripe may send them back.
 * Used by POST /api/membership/checkout.
 */
import { verifyCheckoutToken } from '@/lib/membership/auth';

/**
 * A checkout is bound to one member and package. Allowed with the token that
 * /api/membership/signup returned for exactly that member + package, or for
 * the member themself while signed in (sessionMemberId from their cookie).
 */
export async function isCheckoutAuthorized(input: {
  siteId: string;
  memberId: string;
  packageId: string;
  checkoutToken?: string | null;
  sessionMemberId?: string | null;
}): Promise<boolean> {
  if (input.sessionMemberId && input.sessionMemberId === input.memberId) return true;
  if (!input.checkoutToken) return false;
  const claims = await verifyCheckoutToken(input.checkoutToken, input.siteId);
  return !!claims && claims.memberId === input.memberId && claims.packageId === input.packageId;
}

/** Only absolute http(s) URLs on the host that made the request (the site itself). */
export function sameHostUrl(url: unknown, host: string | null | undefined): string | null {
  if (typeof url !== 'string' || !host) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (parsed.host.toLowerCase() !== host.toLowerCase()) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
