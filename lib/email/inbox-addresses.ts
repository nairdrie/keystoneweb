import { SupabaseClient } from '@supabase/supabase-js';
import { getUserEffectiveLimits } from '@/lib/addons';

export interface SiteInboxAddress {
  id: string;
  site_id: string;
  address: string;
  kind: 'kswd_subdomain' | 'custom_domain';
  is_primary: boolean;
  resend_domain_id: string | null;
  created_at: string;
  updated_at: string;
}

const DEFAULT_FROM_FALLBACK = 'contact@keystoneweb.ca';

/**
 * Ensure a kswd_subdomain inbox address row exists for a published site.
 * Idempotent — safe to call on every page load. Returns the row if one exists
 * after the call.
 */
export async function ensureKswdInboxAddress(
  db: SupabaseClient,
  siteId: string,
  publishedDomain: string | null,
): Promise<SiteInboxAddress | null> {
  if (!publishedDomain) return null;
  const address = `${publishedDomain.toLowerCase()}@kswd.ca`;

  const { data: existing } = await db
    .from('site_inbox_addresses')
    .select('*')
    .eq('site_id', siteId)
    .eq('address', address)
    .maybeSingle();

  if (existing) return existing as SiteInboxAddress;

  // No primary set on this site? Make this one the primary.
  const { data: primaryExists } = await db
    .from('site_inbox_addresses')
    .select('id')
    .eq('site_id', siteId)
    .eq('is_primary', true)
    .maybeSingle();

  const { data: row } = await db
    .from('site_inbox_addresses')
    .insert({
      site_id: siteId,
      address,
      kind: 'kswd_subdomain',
      is_primary: !primaryExists,
    })
    .select('*')
    .single();

  return (row as SiteInboxAddress) ?? null;
}

/**
 * Return all inbox addresses for a site, sorted with primary first then by address.
 */
export async function listSiteInboxAddresses(
  db: SupabaseClient,
  siteId: string,
): Promise<SiteInboxAddress[]> {
  const { data } = await db
    .from('site_inbox_addresses')
    .select('*')
    .eq('site_id', siteId)
    .order('is_primary', { ascending: false })
    .order('address', { ascending: true });
  return (data as SiteInboxAddress[]) ?? [];
}

/**
 * Resolve the inbox address that should be used to send mail when the caller
 * hasn't specified one. Order: explicit primary → any custom_domain → kswd → null.
 */
export function resolvePrimaryAddress(
  addresses: SiteInboxAddress[],
): SiteInboxAddress | null {
  if (addresses.length === 0) return null;
  return (
    addresses.find(a => a.is_primary) ??
    addresses.find(a => a.kind === 'custom_domain') ??
    addresses[0]
  );
}

/**
 * Decide what From address Resend should use for an outbound message.
 * - kswd subdomain addresses cannot send From their own domain (we don't own
 *   per-subdomain SPF/DKIM at @kswd.ca for arbitrary site-slug subdomains),
 *   so we send From contact@keystoneweb.ca and put the inbox address in Reply-To.
 * - Custom-domain addresses (with a verified Resend domain) send From themselves.
 */
export function buildSendFrom(
  address: SiteInboxAddress | null,
  fromName: string,
): { from: string; replyTo: string } {
  if (!address) {
    return {
      from: `${fromName} <${DEFAULT_FROM_FALLBACK}>`,
      replyTo: DEFAULT_FROM_FALLBACK,
    };
  }

  if (address.kind === 'custom_domain' && address.resend_domain_id) {
    return {
      from: `${fromName} <${address.address}>`,
      replyTo: address.address,
    };
  }

  // kswd subdomain or custom_domain not yet verified — use the shared sender.
  return {
    from: `${fromName} <${DEFAULT_FROM_FALLBACK}>`,
    replyTo: address.address,
  };
}

/**
 * How many custom_domain inbox addresses can this user own across all sites?
 * Plan default = 1 if Pro & has at least one site with a custom domain,
 * plus extra_inbox_email addon units.
 */
export async function getCustomInboxAddressLimit(
  db: SupabaseClient,
  userId: string,
): Promise<number> {
  const limits = await getUserEffectiveLimits(userId, db);
  return 1 + (limits.extraInboxEmails ?? 0);
}
