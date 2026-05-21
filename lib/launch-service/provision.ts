/**
 * Provisioning entry point invoked by the Stripe webhook after a successful
 * launch-service payment. Handles domain attachment (subdomain / external /
 * owned / purchase) and publishes the site so the client lands on a live page.
 */
import { createAdminClient } from '@/lib/db/supabase-admin';
import { completeDomainPurchase } from '@/app/api/domains/purchase/route';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

interface DomainConfig {
  mode?: 'subdomain' | 'purchase' | 'external' | 'owned';
  subdomain?: string;
  domainName?: string;
  vercelPriceUsd?: number;
  billToClient?: boolean;
  ownedPurchaseId?: string;
  externalVerified?: boolean;
}

interface LaunchConfig {
  planTier?: 'basic' | 'pro';
  billingInterval?: 'monthly' | 'yearly';
  domain?: DomainConfig;
  skipPreview?: boolean;
}

export async function provisionLaunch(launchRequestId: string): Promise<{ ok: boolean; error?: string }> {
  const db = createAdminClient();

  const { data: req, error } = await db
    .from('launch_requests')
    .select('id, site_id, onboarding_user_id, launch_config')
    .eq('id', launchRequestId)
    .single();

  if (error || !req) {
    return { ok: false, error: 'Launch request not found' };
  }
  if (!req.site_id || !req.onboarding_user_id) {
    return { ok: false, error: 'Site or user not set on launch request' };
  }

  const config = (req.launch_config ?? {}) as LaunchConfig;
  const domain = config.domain;
  if (!domain?.mode) {
    return { ok: false, error: 'Domain mode is not configured' };
  }

  // Mark as launching while we work.
  await db.from('launch_requests').update({ onboarding_status: 'launching', status: 'paid' }).eq('id', req.id);

  try {
    let publishedDomain: string | null = null;
    let customDomain: string | null = null;

    if (domain.mode === 'subdomain') {
      if (!domain.subdomain) return failLaunch(db, req.id, 'Subdomain missing');
      publishedDomain = domain.subdomain;
    } else if (domain.mode === 'external') {
      if (!domain.domainName) return failLaunch(db, req.id, 'External domain missing');
      // Operator pre-verified DNS in ops. Promote straight to custom_domain.
      customDomain = domain.domainName;
      publishedDomain = domain.domainName.replace(/[^a-z0-9]/gi, '').slice(0, 20).toLowerCase() || 'site';
    } else if (domain.mode === 'owned') {
      if (!domain.ownedPurchaseId) return failLaunch(db, req.id, 'Owned domain selection missing');
      const { data: purchase } = await db
        .from('domain_purchases')
        .select('id, domain_name, domain, user_id')
        .eq('id', domain.ownedPurchaseId)
        .single();
      const owned = purchase as { id: string; domain_name?: string; domain?: string; user_id: string } | null;
      const ownedName = owned?.domain_name ?? owned?.domain;
      if (!ownedName) {
        return failLaunch(db, req.id, 'Owned domain not found');
      }
      // Re-assign domain to the new owner + site
      await db
        .from('domain_purchases')
        .update({ user_id: req.onboarding_user_id, site_id: req.site_id })
        .eq('id', owned!.id);
      customDomain = ownedName;
      publishedDomain = ownedName.replace(/[^a-z0-9]/gi, '').slice(0, 20).toLowerCase() || 'site';
    } else if (domain.mode === 'purchase') {
      if (!domain.domainName) return failLaunch(db, req.id, 'Domain name missing');

      // Insert a domain_purchases row in pending state
      const { data: inserted, error: insertErr } = await db
        .from('domain_purchases')
        .insert({
          user_id: req.onboarding_user_id,
          site_id: req.site_id,
          domain_name: domain.domainName,
          status: 'pending',
        })
        .select('id')
        .single();

      if (insertErr || !inserted) {
        console.error('Failed to insert domain_purchases:', insertErr);
        return failLaunch(db, req.id, 'Failed to record domain purchase');
      }

      const result = await completeDomainPurchase(
        inserted.id,
        domain.domainName,
        req.site_id,
        req.onboarding_user_id,
        false,
      );

      if (!result.success) {
        return failLaunch(db, req.id, `Domain purchase failed: ${result.error}`);
      }

      customDomain = domain.domainName;
      publishedDomain = domain.domainName.replace(/[^a-z0-9]/gi, '').slice(0, 20).toLowerCase() || 'site';
    } else {
      return failLaunch(db, req.id, `Unsupported domain mode: ${domain.mode}`);
    }

    // ── Publish the site ─────────────────────────────────────────
    const publishResult = await publishSite(db, req.site_id, publishedDomain!, customDomain);
    if (!publishResult.ok) {
      return failLaunch(db, req.id, publishResult.error ?? 'Publish failed');
    }

    // ── Mark launched ─────────────────────────────────────────
    await db
      .from('launch_requests')
      .update({
        onboarding_status: 'launched',
        status: 'launched',
        launched_at: new Date().toISOString(),
      })
      .eq('id', req.id);

    // Clear the active flag so editor/publish behave normally going forward.
    await db
      .from('users')
      .update({ launch_service_active: false })
      .eq('id', req.onboarding_user_id);

    return { ok: true };
  } catch (e) {
    console.error('Unexpected provisioning error:', e);
    return failLaunch(db, req.id, e instanceof Error ? e.message : 'Unexpected error');
  }
}

async function failLaunch(db: SupabaseAdmin, launchRequestId: string, error: string) {
  console.error(`[launch-service] provisioning failed for ${launchRequestId}: ${error}`);
  await db.from('launch_requests').update({ onboarding_status: 'failed' }).eq('id', launchRequestId);
  return { ok: false, error };
}

/**
 * Minimal publish: marks the site published, copies each page's draft
 * design_data into published_data, sets the resolved domain fields.
 */
async function publishSite(
  db: SupabaseAdmin,
  siteId: string,
  publishedDomain: string,
  customDomain: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const now = new Date().toISOString();

  const { data: site } = await db
    .from('sites')
    .select('design_data')
    .eq('id', siteId)
    .single();

  const update: Record<string, unknown> = {
    is_published: true,
    published_domain: publishedDomain,
    published_at: now,
    published_data: site?.design_data ?? null,
  };
  if (customDomain) update.custom_domain = customDomain;

  const { error: siteErr } = await db.from('sites').update(update).eq('id', siteId);
  if (siteErr) {
    console.error('Failed to update site for publish:', siteErr);
    return { ok: false, error: 'Site publish update failed' };
  }

  // Copy each page's draft → published.
  const { data: pages } = await db.from('pages').select('id, design_data').eq('site_id', siteId);
  if (pages && pages.length > 0) {
    await Promise.all(
      pages.map((p) =>
        db
          .from('pages')
          .update({ published_data: p.design_data, published_at: now })
          .eq('id', p.id),
      ),
    );
  }

  return { ok: true };
}
