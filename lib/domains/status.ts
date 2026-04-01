import { createAdminClient } from '@/lib/db/supabase-admin';
import { sendDomainTransferCompleteEmail } from '@/lib/email';

const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
const VERCEL_API_BASE = 'https://api.vercel.com';

/**
 * Checks the status of a specific domain transfer with Vercel and updates the DB.
 * Returns true if the transfer was just completed, false otherwise.
 */
export async function checkAndPromoteTransfer(domain: string, siteId: string, userId: string): Promise<boolean> {
  const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;
  const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;

  if (!VERCEL_API_TOKEN) {
    console.error('checkAndPromoteTransfer: VERCEL_API_TOKEN is missing');
    return false;
  }

  const supabase = createAdminClient();
  const teamParam = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : '';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://keystoneweb.ca';

  console.log(`Checking transfer status for ${domain} (Team: ${VERCEL_TEAM_ID || 'Personal'})`);

  try {
    const vercelRes = await fetch(
      `${VERCEL_API_BASE}/v4/domains/${encodeURIComponent(domain)}${teamParam}`,
      { headers: { Authorization: `Bearer ${VERCEL_API_TOKEN}` } }
    );

    let isComplete = false;

    if (vercelRes.status === 404) {
      // Domain not in main list yet, check if it's in the middle of a transfer
      console.log(`checkAndPromoteTransfer: ${domain} not found in main domains list. Checking registrar transfer status...`);
      
      const transferRes = await fetch(
        `${VERCEL_API_BASE}/v1/registrar/domains/${encodeURIComponent(domain)}/transfer${teamParam}`,
        { headers: { Authorization: `Bearer ${VERCEL_API_TOKEN}` } }
      );

      if (transferRes.status === 404) {
        console.warn(`checkAndPromoteTransfer: Domain ${domain} not found in domains OR registrar transfers. Check if VERCEL_TEAM_ID is correct.`);
        return false;
      }

      const transferData = await transferRes.json();
      console.log(`checkAndPromoteTransfer: Registrar status for ${domain}: ${transferData.status}`);
      
      // If registrar says completed, we can proceed to promote
      if (transferData.status === 'completed') {
        isComplete = true;
      } else if (transferData.status === 'failed' || transferData.status === 'canceled') {
        console.warn(`checkAndPromoteTransfer: Domain transfer ${domain} failed/canceled on Vercel: ${transferData.status}`);
        
        // 1. Mark transfer as failed in DB
        await supabase
          .from('domain_purchases')
          .update({ 
            transfer_status: 'failed', 
            status: 'failed',
            updated_at: new Date().toISOString() 
          })
          .eq('site_id', siteId)
          .eq('domain', domain);

        // 2. Clear pending_custom_domain on site
        await supabase
          .from('sites')
          .update({ pending_custom_domain: null })
          .eq('id', siteId);

        return false;
      } else {
        // Still pending/initiating/etc.
        return false;
      }
    } else if (!vercelRes.ok) {
      console.error(`checkAndPromoteTransfer: Vercel API error for ${domain}:`, vercelRes.status);
      return false;
    } else {
        const result = await vercelRes.json();
        console.log(`DEBUG: Vercel domain data for ${domain}:`, JSON.stringify(result, null, 2));
        
        // Vercel v4 returns { domain: { ... } }
        const domainData = result.domain || result;
        
        const isVerified = domainData.verified === true;
        const isVercelRegistrar = domainData.serviceType === 'zeit.world';
        const hasExpiresAt = !!domainData.expiresAt;
        
        // COMPLETION LOGIC:
        // 1. If Vercel is the registrar (Transfer/Purchase): 
        //    Must be verified AND have an expiration date.
        // 2. If it's an external domain (DNS link only):
        //    Must be verified.
        if (isVercelRegistrar) {
            isComplete = isVerified && hasExpiresAt;
        } else {
            isComplete = isVerified;
        }
        
        console.log(`DEBUG: ${domain} check: isComplete=${isComplete} (verified=${isVerified}, vercelRegistrar=${isVercelRegistrar}, hasExpiresAt=${hasExpiresAt})`);

        // SELF-HEALING: If DB is 'completed' but Vercel says it's NOT ready (either transferring or not verified)
        // we demote it back to 'initiated' so we can keep tracking it correctly.
        if (!isComplete) {
            const { data: currentPurchase } = await supabase
                .from('domain_purchases')
                .select('transfer_status')
                .eq('site_id', siteId)
                .eq('domain', domain)
                .single();

            if (currentPurchase?.transfer_status === 'completed') {
                console.log(`DEMOTING: ${domain} was promoted prematurely. Moving back to initiated status.`);
                
                await supabase
                    .from('domain_purchases')
                    .update({ transfer_status: 'initiated', updated_at: new Date().toISOString() })
                    .eq('site_id', siteId)
                    .eq('domain', domain);
                
                await supabase
                    .from('sites')
                    .update({ pending_custom_domain: domain, custom_domain: null })
                    .eq('id', siteId);
                
                return false;
            }
        }
    }

    if (!isComplete) return false;

    // 1. Update domain_purchases
    const { data: purchase } = await supabase
      .from('domain_purchases')
      .update({ transfer_status: 'completed', updated_at: new Date().toISOString() })
      .eq('site_id', siteId)
      .eq('domain', domain)
      .eq('transfer_status', 'initiated')
      .select('id')
      .single();

    if (!purchase) {
        // Already completed or not found
        return false;
    }

    // 2. Promote site custom_domain
    await supabase
      .from('sites')
      .update({ custom_domain: domain, pending_custom_domain: null })
      .eq('id', siteId);

    // 3. Send notification email
    const { data: { user } } = await supabase.auth.admin.getUserById(userId);
    const userEmail = user?.email;

    if (userEmail) {
      await sendDomainTransferCompleteEmail({
        userEmail,
        domain,
        siteId,
        appUrl,
      });
    }

    console.log(`checkAndPromoteTransfer: Successfully promoted ${domain} for site ${siteId} and notified ${userEmail}`);
    return true;
  } catch (err) {
    console.error(`checkAndPromoteTransfer: Unexpected error for ${domain}:`, err);
    return false;
  }
}
