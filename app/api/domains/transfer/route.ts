import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { FREE_DOMAIN_MAX_USD, calculateDomainPrice, priceToCents } from '@/lib/domains/pricing';
import Stripe from 'stripe';

const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
const VERCEL_API_BASE = 'https://api.vercel.com';

/**
 * Normalize a phone number to E.164 format (+19058579771).
 * Handles common formats: 905-857-9771, (905) 857-9771, +1 905 857 9771, etc.
 * Assumes NANP (North American) if 10 digits with no country code.
 */
function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  // Already has country code (>11 digits or non-NANP)
  return `+${digits}`;
}

const getStripeClient = () => {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set');
  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

interface TransferContact {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

interface TransferRequest {
  siteId: string;
  domain: string;
  authCode: string;
  contact: TransferContact;
}

/**
 * Call the Vercel transfer API and update the domain_purchases record.
 * Called directly for free transfers, or from the Stripe webhook for paid ones.
 */
export async function initiateVercelTransfer(
  purchaseId: string,
  domain: string,
  authCode: string,
  contact: TransferContact,
  transferPrice: number,
): Promise<{ success: boolean; transferId?: string; error?: string }> {
  const supabase = await createClient();
  const teamParam = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : '';

  const res = await fetch(
    `${VERCEL_API_BASE}/v1/registrar/domains/${encodeURIComponent(domain)}/transfer${teamParam}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${VERCEL_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        authCode,
        years: 1,
        autoRenew: true,
        expectedPrice: transferPrice,
        contactInformation: {
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          phone: toE164(contact.phone),
          address1: contact.address1,
          city: contact.city,
          state: contact.state,
          zip: contact.zip,
          country: contact.country,
        },
      }),
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    console.error('Vercel transfer failed:', res.status, errorData);

    await supabase
      .from('domain_purchases')
      .update({ status: 'failed', transfer_status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', purchaseId);

    const code = errorData?.code;
    if (code === 'domain_not_available') return { success: false, error: 'This domain cannot be transferred at this time.' };
    if (code === 'expected_price_mismatch') return { success: false, error: 'Transfer price has changed. Please try again.' };
    if (code === 'tld_not_supported') return { success: false, error: 'This domain extension is not supported for transfer.' };
    if (code === 'dnssec_enabled') return { success: false, error: 'Please disable DNSSEC at your current registrar before transferring.' };
    return { success: false, error: 'Transfer initiation failed. Please check your EPP code and try again.' };
  }

  const data = await res.json();
  const transferId = data.orderId as string | undefined;

  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  await supabase
    .from('domain_purchases')
    .update({
      vercel_transfer_id: transferId,
      transfer_status: 'initiated',
      status: 'completed',
      updated_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      // Clear the auth code now that it's been used
      transfer_auth_code: null,
      // Track what Vercel bills us (for reconciliation — may differ from amount_cents on free transfers)
      vercel_cost_cents: Math.round(transferPrice * 100),
    })
    .eq('id', purchaseId);

  // Set pending_custom_domain on the site (not active yet — transfer takes 5-7 days)
  const { data: purchase } = await supabase
    .from('domain_purchases')
    .select('site_id')
    .eq('id', purchaseId)
    .single();

  if (purchase?.site_id) {
    await supabase
      .from('sites')
      .update({ pending_custom_domain: domain })
      .eq('id', purchase.site_id);
  }

  return { success: true, transferId };
}

/**
 * POST /api/domains/transfer
 *
 * Initiates a domain transfer in. Three cases:
 *   1. Free (transferPrice ≤ $20, free credit unclaimed) → call Vercel immediately
 *   2. Partial (transferPrice > $20, free credit unclaimed) → charge user (price - $20) via Stripe
 *   3. Full (free credit already used) → charge user full retail price via Stripe
 *
 * For cases 2 & 3, the Stripe webhook calls initiateVercelTransfer after payment.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify Pro plan
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('subscription_status, subscription_plan, stripe_customer_id, stripe_subscription_id, free_domain_claimed, last_domain_claimed_at')
      .eq('user_id', user.id)
      .single();

    const isPro = subscription?.subscription_status === 'active' &&
      subscription?.subscription_plan?.toLowerCase().includes('pro');

    if (!isPro) {
      return NextResponse.json({ error: 'Pro plan required for domain transfers' }, { status: 403 });
    }

    const body: TransferRequest = await request.json();
    const { siteId, domain, authCode, contact } = body;

    if (!siteId || !domain || !authCode || !contact) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!VERCEL_API_TOKEN) {
      return NextResponse.json({ error: 'Domain transfers are not configured. Contact support.' }, { status: 503 });
    }

    // Verify site ownership
    const { data: site } = await supabase
      .from('sites')
      .select('id, user_id')
      .eq('id', siteId)
      .single();

    if (!site || site.user_id !== user.id) {
      return NextResponse.json({ error: 'Site not found or access denied' }, { status: 404 });
    }

    // Fetch current transfer price from Vercel
    const teamParam = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : '';
    const priceRes = await fetch(
      `${VERCEL_API_BASE}/v1/registrar/domains/${encodeURIComponent(domain)}/price${teamParam}`,
      { headers: { Authorization: `Bearer ${VERCEL_API_TOKEN}` } }
    );

    if (!priceRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch transfer price. Please try again.' }, { status: 502 });
    }

    const priceData = await priceRes.json();
    const transferPrice: number = typeof priceData.transferPrice === 'string'
      ? parseFloat(priceData.transferPrice)
      : priceData.transferPrice;

    if (isNaN(transferPrice) || transferPrice <= 0) {
      return NextResponse.json({ error: 'Unable to determine transfer price.' }, { status: 502 });
    }

    // Check domain limit and enforce 30-day cooldown
    const { getUserEffectiveLimits } = await import('@/lib/addons');
    const limits = await getUserEffectiveLimits(user.id, supabase);

    const { count: ownedDomainCount } = await supabase
      .from('domain_purchases')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'completed');

    if ((ownedDomainCount ?? 0) >= limits.customDomainLimit) {
      return NextResponse.json(
        { error: `Domain limit reached (${limits.customDomainLimit}). Contact us for additional domains.` },
        { status: 403 }
      );
    }

    // Enforce 30-day cooldown (bypass for extra_domains addon holders)
    if (limits.customDomainLimit <= 1) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const lastClaimedAt = subscription?.last_domain_claimed_at
        ? new Date(subscription.last_domain_claimed_at)
        : null;

      if (lastClaimedAt && lastClaimedAt > thirtyDaysAgo) {
        const nextAvailable = new Date(lastClaimedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
        return NextResponse.json(
          {
            error: 'Domain changes are limited to once per month.',
            nextAvailableAt: nextAvailable.toISOString(),
            nextAvailableFormatted: nextAvailable.toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' }),
          },
          { status: 429 }
        );
      }
    }

    // Check free domain credit — flag survives domain transfer-out
    const { count: purchaseCount } = await supabase
      .from('domain_purchases')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'completed');

    const freeDomainUsed = (purchaseCount ?? 0) > 0 || !!subscription?.free_domain_claimed;

    // Determine what the user owes
    let userOwesVercelPrice = 0;
    let isFreeTransfer = false;

    if (freeDomainUsed) {
      userOwesVercelPrice = transferPrice;
    } else if (transferPrice <= FREE_DOMAIN_MAX_USD) {
      isFreeTransfer = true;
      userOwesVercelPrice = 0;
    } else {
      // Overage only, charged at cost (no markup on the portion user pays)
      userOwesVercelPrice = transferPrice - FREE_DOMAIN_MAX_USD;
    }

    // Retail amount billed to user via Stripe
    const userOwesRetail = freeDomainUsed
      ? calculateDomainPrice(transferPrice)
      : userOwesVercelPrice; // overage at cost

    // Create the domain_purchases record (pending until Vercel confirms)
    const { data: purchase, error: insertError } = await supabase
      .from('domain_purchases')
      .insert({
        user_id: user.id,
        site_id: siteId,
        domain,
        amount_cents: priceToCents(userOwesRetail),
        is_free_with_pro: !freeDomainUsed,
        status: isFreeTransfer ? 'completed' : 'pending',
        purchase_type: 'transfer',
        transfer_status: 'initiated',
        stripe_subscription_id: subscription?.stripe_subscription_id ?? null,
        // Store contact info for webhook to use (auth code cleared after use)
        transfer_auth_code: authCode,
        contact_first_name: contact.firstName,
        contact_last_name: contact.lastName,
        contact_email: contact.email,
        contact_phone: contact.phone,
        contact_address1: contact.address1,
        contact_city: contact.city,
        contact_state: contact.state,
        contact_zip: contact.zip,
        contact_country: contact.country,
      })
      .select('id')
      .single();

    if (insertError || !purchase) {
      console.error('Failed to create transfer record:', insertError);
      return NextResponse.json({ error: 'Failed to initiate transfer' }, { status: 500 });
    }

    // ── Case 1: Free transfer ──────────────────────────────────────────────
    if (isFreeTransfer) {
      const result = await initiateVercelTransfer(purchase.id, domain, authCode, contact, transferPrice);

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 502 });
      }

      // Mark free domain credit used and track claim timestamp
      const claimedAt = new Date().toISOString();
      await supabase
        .from('user_subscriptions')
        .update({ free_domain_claimed: true, free_domain_claimed_at: claimedAt, last_domain_claimed_at: claimedAt })
        .eq('user_id', user.id);

      return NextResponse.json({
        success: true,
        pending: true,
        domain,
        message: 'Transfer initiated! Watch for an approval email from your current registrar. This typically takes 5–7 days.',
      });
    }

    // ── Cases 2 & 3: Paid via Stripe ──────────────────────────────────────
    const stripe = getStripeClient();
    const amountCents = priceToCents(userOwesRetail);

    const lineItemDescription = freeDomainUsed
      ? `1-year transfer for ${domain}`
      : `1-year transfer for ${domain} ($${FREE_DOMAIN_MAX_USD} Pro credit applied)`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: `Transfer: ${domain}`, description: lineItemDescription },
          unit_amount: amountCents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      automatic_tax: { enabled: true },
      customer: subscription?.stripe_customer_id || undefined,
      customer_email: !subscription?.stripe_customer_id ? (user.email ?? undefined) : undefined,
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/publish/domain-select?siteId=${siteId}&session_id={CHECKOUT_SESSION_ID}&transfer_initiated=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/publish/domain-select?siteId=${siteId}&transfer_cancelled=true`,
      metadata: {
        type: 'domain_transfer',
        domainPurchaseId: purchase.id,
        domain,
        siteId,
        userId: user.id,
        transferPrice: transferPrice.toString(),
        freeCreditApplied: (!freeDomainUsed).toString(),
      },
    });

    await supabase
      .from('domain_purchases')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', purchase.id);

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('Error initiating domain transfer:', error);
    return NextResponse.json({ error: 'Failed to initiate transfer' }, { status: 500 });
  }
}
