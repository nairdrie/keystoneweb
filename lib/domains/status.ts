import { createAdminClient } from '@/lib/db/supabase-admin';
import { sendDomainTransferCompleteEmail } from '@/lib/email';

const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const VERCEL_API_BASE = 'https://api.vercel.com';

/**
 * Links a domain to the Vercel project so it can be served.
 * This is required for Vercel to manage DNS and SSL for the domain.
 */
async function addDomainToProject(domain: string): Promise<{ success: boolean; error?: string }> {
  console.log("ADD DOMAIN TO PROJECT");
  if (!VERCEL_PROJECT_ID) {
    console.error('addDomainToProject: VERCEL_PROJECT_ID is missing');
    return { success: false, error: 'VERCEL_PROJECT_ID is missing' };
  }

  const teamParam = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : '';
  
  try {
    const res = await fetch(
      `${VERCEL_API_BASE}/v9/projects/${VERCEL_PROJECT_ID}/domains${teamParam}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${VERCEL_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: domain }),
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      // 409 means it's already added, which we can treat as success
      if (res.status === 409) return { success: true };
      
      console.error(`addDomainToProject: Failed to add ${domain} to project:`, res.status, errorData);
      return { success: false, error: errorData.error?.message || 'Failed to add domain to project' };
    }

    console.log(`addDomainToProject: Successfully added ${domain} to project ${VERCEL_PROJECT_ID}`);
    return { success: true };
  } catch (err) {
    console.error(`addDomainToProject: Unexpected error for ${domain}:`, err);
    return { success: false, error: 'Unexpected error linking domain' };
  }
}

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
      `${VERCEL_API_BASE}/v5/domains/${encodeURIComponent(domain)}${teamParam}`,
      { headers: { Authorization: `Bearer ${VERCEL_API_TOKEN}` } }
    );

    let isComplete = false;

    if (vercelRes.status === 404) {
      console.warn(`checkAndPromoteTransfer: Domain ${domain} not found in Vercel account.`);
      return false;
    } else if (!vercelRes.ok) {
      console.error(`checkAndPromoteTransfer: Vercel API error for ${domain}:`, vercelRes.status);
      return false;
    } else {
        const result = await vercelRes.json();
        console.log(`DEBUG: Vercell v5 domain data for ${domain}:`, JSON.stringify(result, null, 2));
        
        const domainData = result.domain || result;
        
        const isVerified = domainData.verified === true || domainData.verified === 'true';
        const isVercelRegistrar = domainData.serviceType === 'zeit.world';
        const isTransferred = !!domainData.transferredAt;
        
        // Nameserver check: Ensure current nameservers match intended ones
        const ns = domainData.nameservers || [];
        const intendedNs = domainData.intendedNameservers || [];
        const nsMatch = intendedNs.length > 0 && 
                        intendedNs.every((ins: string) => ns.includes(ins));

        // COMPLETION LOGIC (v5):
        // 1. If Vercel is the registrar (Transfer/Purchase): 
        //    Must be verified AND transferredAt must exist AND nameservers must match.
        // 2. If it's an external domain (DNS link only):
        //    Must be verified AND nameservers must match.
        if (isVercelRegistrar) {
            isComplete = isVerified && isTransferred && nsMatch;
        } else {
            isComplete = isVerified && nsMatch;
        }
        
        console.log(`DEBUG: ${domain} check: isComplete=${isComplete} (verified=${isVerified}, transferred=${isTransferred}, nsMatch=${nsMatch})`);

        // SELF-HEALING: If DB is 'completed' but Vercel says it's NOT ready
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
        console.log("checkAndPromoteTransfer: Purchase not found or already completed", siteId, domain);
        return false;
    }

    // 2. Promote site custom_domain
    await supabase
      .from('sites')
      .update({ custom_domain: domain, pending_custom_domain: null })
      .eq('id', siteId);

    // 2.5 Link to Vercel project (automates DNS setup for Vercel Registrar domains)
    await addDomainToProject(domain);

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
