/**
 * Publishing for v2 sites. Used by /api/sites/publish (owner), the Launch
 * Service provisioner and the MCP publish tool, so there is one v2 path.
 */
import { PUBLISHED_ROOT } from '@/lib/env/domain';
import { ensureKswdInboxAddress } from '@/lib/email/inbox-addresses';
import { getUserEffectiveLimits } from '@/lib/addons';
import { hasPaidAccess } from '@/lib/subscription/access';
import type { Actor } from './types';
import { opPublishRelease, OpError } from './ops';
import { loadSiteRow, type Db } from './store';

export interface V2PublishResult {
  releaseId: string;
  publishedDomain: string;
  publicUrl: string;
  warnings: unknown[];
}

/** Freeze the draft, make it live and mark the site published on `subdomain`. */
export async function publishV2Site(
  db: Db,
  input: { siteId: string; subdomain: string; actor: Actor; customDomain?: string | null },
): Promise<V2PublishResult> {
  const { releaseId, warnings } = await opPublishRelease({ db, siteId: input.siteId, actor: input.actor });

  const update: Record<string, unknown> = {
    is_published: true,
    published_domain: input.subdomain,
    published_at: new Date().toISOString(),
  };
  if (input.customDomain) update.custom_domain = input.customDomain;
  const { data: site, error } = await db.from('sites').update(update).eq('id', input.siteId).select('custom_domain').single();
  if (error) throw new OpError(`Failed to mark site published: ${error.message}`, 500);

  try {
    await ensureKswdInboxAddress(db, input.siteId, input.subdomain);
  } catch (err) {
    console.error('[v2 publish] inbox provisioning failed', err);
  }

  const host = site?.custom_domain || `${input.subdomain}.${PUBLISHED_ROOT}`;
  return { releaseId, publishedDomain: input.subdomain, publicUrl: `https://${host}`, warnings };
}

/** Billing + plan-limit checks for publishing on behalf of the owner (MCP path). */
export async function checkPublishEligibility(db: Db, siteId: string): Promise<{ ownerId: string }> {
  const site = await loadSiteRow(db, siteId);
  if (!site?.user_id) throw new OpError('Site has no owner', 400);

  const { data: subscription } = await db
    .from('user_subscriptions')
    .select('subscription_status, subscription_plan')
    .eq('user_id', site.user_id)
    .maybeSingle();
  if (!subscription || !hasPaidAccess(subscription)) {
    throw new OpError('The site owner needs an active subscription to publish. Use request_approval to send them the preview instead.', 402);
  }

  const limits = await getUserEffectiveLimits(site.user_id, db);
  const { count } = await db
    .from('sites')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', site.user_id)
    .eq('is_published', true)
    .neq('id', siteId);
  if ((count ?? 0) >= limits.publishLimit) {
    throw new OpError(`The owner has reached their plan's limit of ${limits.publishLimit} published site(s).`, 403);
  }
  return { ownerId: site.user_id };
}

/** Pick the site's subdomain: existing one, the requested one, or one derived from the name. */
export async function resolveSubdomain(db: Db, siteId: string, requested?: string): Promise<string> {
  const site = await loadSiteRow(db, siteId);
  if (!site) throw new OpError('Site not found', 404);
  if (site.published_domain && !requested) return site.published_domain;

  const base = slugify(requested || (site.design_data as Record<string, unknown> | null)?.siteTitle as string || site.site_slug || 'site');
  if (!base) throw new OpError('Could not derive a subdomain; pass one explicitly');
  for (let n = 0; n < 50; n++) {
    const candidate = n === 0 ? base : `${base}-${n + 1}`;
    const { data } = await db.from('sites').select('id').eq('published_domain', candidate).neq('id', siteId).maybeSingle();
    if (!data) return candidate;
    if (requested && n === 0) throw new OpError(`Subdomain "${candidate}" is taken`, 409);
  }
  throw new OpError('Could not find a free subdomain', 409);
}

function slugify(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}
