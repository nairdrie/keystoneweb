import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { sendOrderConfirmation, sendOrderNotification, sendSubscriptionPurchaseEmail, sendSubscriptionCancelledEmail, sendPaymentFailedEmail, sendPaymentRetryReminderEmail, sendSubscriptionLapsedEmail, sendPaymentRecoveredEmail } from '@/lib/email';
import { buildSiteOrigin } from '@/lib/email/order-tracking-url';
import { completeDomainPurchase } from '@/app/api/domains/purchase/route';
import { initiateVercelTransfer } from '@/app/api/domains/transfer/route';
import { provisionLaunch } from '@/lib/launch-service/provision';
import { getPlanByName } from '@/lib/plans';
import Stripe from 'stripe';
import { trackEvent } from '@/lib/analytics';

// Initialize Stripe only when API key is available
const getStripeClient = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-02-25.clover' as any,
  });
};

// Dunning config: how long a past_due subscription keeps full (Pro) access
// before we expect Stripe to cancel it. Emails + the in-app banner reference
// this window. CTAs point at the billing settings page (Stripe portal) and the
// dashboard.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://keystoneweb.ca';
const BILLING_URL = `${APP_URL}/settings`;
const GRACE_PERIOD_DAYS = 14;

const formatGraceDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });

/**
 * Record a Stripe event as a transaction in our DB.
 * Uses upsert with stripe_event_id as the unique key for idempotency —
 * if Stripe retries a webhook, we won't create duplicate records.
 */
async function recordStripeTransaction(data: {
  stripe_event_id: string;
  stripe_subscription_id?: string | null;
  stripe_customer_id?: string | null;
  stripe_invoice_id?: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_charge_id?: string | null;
  user_id?: string | null;
  event_type: string;
  transaction_type: string;
  description?: string | null;
  plan_name?: string | null;
  billing_interval?: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  invoice_url?: string | null;
  invoice_pdf?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  metadata?: Record<string, any>;
}) {
  try {
    const db = createAdminClient();
    const { error } = await db.from('stripe_transactions').upsert(data, {
      onConflict: 'stripe_event_id',
      ignoreDuplicates: true,
    });
    if (error) {
      console.error('Failed to record stripe transaction:', error);
    }
  } catch (err) {
    // Non-blocking — don't fail the webhook if transaction recording fails
    console.error('Error recording stripe transaction:', err);
  }
}

/**
 * Fetch invoice or receipt URLs from a completed checkout session.
 * - Subscription sessions: retrieves the Stripe Invoice for hosted_invoice_url + invoice_pdf
 * - One-time payment sessions: retrieves the Charge receipt_url as a fallback
 */
async function getCheckoutInvoiceUrls(session: Stripe.Checkout.Session): Promise<{
  invoice_url: string | null;
  invoice_pdf: string | null;
  amount_paid_cents: number | null;
  currency: string | null;
}> {
  try {
    const stripe = getStripeClient();

    // Subscription checkout — fetch the associated invoice so we can record the
    // post-tax amount actually paid (session.amount_total is pre-tax when Stripe
    // Tax adjusts the total at finalization).
    if (session.invoice) {
      const invoiceId = typeof session.invoice === 'string' ? session.invoice : (session.invoice as any).id;
      const invoice = await stripe.invoices.retrieve(invoiceId) as any;
      return {
        invoice_url: invoice.hosted_invoice_url || null,
        invoice_pdf: invoice.invoice_pdf || null,
        amount_paid_cents: typeof invoice.amount_paid === 'number' ? invoice.amount_paid : null,
        currency: invoice.currency || null,
      };
    }

    // One-time payment — fetch receipt URL from the charge
    if (session.payment_intent) {
      const piId = typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent as any).id;
      const pi = await stripe.paymentIntents.retrieve(piId, { expand: ['latest_charge'] }) as any;
      const charge = pi.latest_charge;
      if (charge?.receipt_url) {
        return {
          invoice_url: charge.receipt_url,
          invoice_pdf: null,
          amount_paid_cents: typeof charge.amount === 'number' ? charge.amount : null,
          currency: charge.currency || null,
        };
      }
    }
  } catch (err) {
    // Non-blocking — transaction still records, just without invoice links
    console.error('Failed to retrieve checkout invoice/receipt URLs:', err);
  }
  return { invoice_url: null, invoice_pdf: null, amount_paid_cents: null, currency: null };
}

/**
 * POST /api/stripe/webhook
 * Handle Stripe webhook events for subscription and payment lifecycle.
 *
 * Listens for:
 * - checkout.session.completed: Store subscription info / trigger domain purchase on payment success
 * - customer.subscription.updated: Sync status; tag customer as refund-ineligible if free domain was claimed
 * - customer.subscription.deleted: Same as above + marks subscription as canceled
 * - invoice.paid: Record confirmed payment for revenue tracking / billing history
 * - invoice.payment_failed: Record failed payment attempt
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature') || '';

  let event: Stripe.Event;

  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }

  // Webhooks have no user JWT; use the admin client so all table writes succeed under RLS.
  const supabase = createAdminClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        // Fetch invoice/receipt URLs so billing history entries have direct Stripe links
        const checkoutUrls = await getCheckoutInvoiceUrls(session);

        // ── Domain Purchase Payment ─────────────────────────────────
        if (session.metadata?.type === 'domain_purchase') {
          const { domainPurchaseId, domain, siteId, userId, isDomainSwitch } = session.metadata;

          if (!domainPurchaseId || !domain || !siteId || !userId) {
            console.error('Missing domain purchase metadata in checkout session');
            return NextResponse.json({ error: 'Invalid session metadata' }, { status: 400 });
          }

          console.log(`Processing paid domain purchase: ${domain} for user ${userId}`);

          const result = await completeDomainPurchase(
            domainPurchaseId,
            domain,
            siteId,
            userId,
            isDomainSwitch === 'true',
          );

          if (result.success) {
            console.log(`✅ Domain ${domain} purchased and linked successfully`);
          } else {
            console.error(`❌ Domain purchase failed for ${domain}:`, result.error);
          }

          // Record domain purchase transaction
          await recordStripeTransaction({
            stripe_event_id: event.id,
            stripe_customer_id: typeof session.customer === 'string' ? session.customer : '',
            stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
            user_id: userId,
            event_type: 'checkout.session.completed',
            transaction_type: 'domain_purchase',
            description: `Domain purchase: ${domain}`,
            amount_cents: session.amount_total ?? 0,
            currency: session.currency ?? 'cad',
            status: result.success ? 'succeeded' : 'failed',
            invoice_url: checkoutUrls.invoice_url,
            invoice_pdf: checkoutUrls.invoice_pdf,
            metadata: { domain, domainPurchaseId, siteId },
          });

          break;
        }

        // ── Domain Transfer Payment ─────────────────────────────────
        if (session.metadata?.type === 'domain_transfer') {
          const { domainPurchaseId, domain, userId, transferPrice, freeCreditApplied } = session.metadata;

          if (!domainPurchaseId || !domain || !userId || !transferPrice) {
            console.error('Missing domain transfer metadata in checkout session');
            return NextResponse.json({ error: 'Invalid session metadata' }, { status: 400 });
          }

          console.log(`Processing paid domain transfer: ${domain} for user ${userId}`);

          // Retrieve stored auth code and contact info from the purchase record
          const { data: purchase } = await supabase
            .from('domain_purchases')
            .select('transfer_auth_code, contact_first_name, contact_last_name, contact_email, contact_phone, contact_address1, contact_city, contact_state, contact_zip, contact_country')
            .eq('id', domainPurchaseId)
            .single();

          if (!purchase?.transfer_auth_code) {
            console.error(`Missing auth code for transfer ${domainPurchaseId}`);
            break;
          }

          const result = await initiateVercelTransfer(
            domainPurchaseId,
            domain,
            purchase.transfer_auth_code,
            {
              firstName: purchase.contact_first_name,
              lastName: purchase.contact_last_name,
              email: purchase.contact_email,
              phone: purchase.contact_phone,
              address1: purchase.contact_address1,
              city: purchase.contact_city,
              state: purchase.contact_state,
              zip: purchase.contact_zip,
              country: purchase.contact_country,
            },
            parseFloat(transferPrice),
          );

          if (result.success) {
            console.log(`✅ Domain transfer initiated for ${domain}`);

            const claimedAt = new Date().toISOString();

            // Track claim timestamp for 30-day cooldown enforcement
            await supabase
              .from('user_subscriptions')
              .update({
                ...(freeCreditApplied === 'true' ? { free_domain_claimed: true, free_domain_claimed_at: claimedAt } : {}),
                last_domain_claimed_at: claimedAt,
              })
              .eq('user_id', userId);
          } else {
            console.error(`❌ Domain transfer failed for ${domain}:`, result.error);
          }

          // Record domain transfer transaction
          await recordStripeTransaction({
            stripe_event_id: event.id,
            stripe_customer_id: typeof session.customer === 'string' ? session.customer : '',
            stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
            user_id: userId,
            event_type: 'checkout.session.completed',
            transaction_type: 'domain_transfer',
            description: `Domain transfer: ${domain}`,
            amount_cents: session.amount_total ?? 0,
            currency: session.currency ?? 'cad',
            status: result.success ? 'succeeded' : 'failed',
            invoice_url: checkoutUrls.invoice_url,
            invoice_pdf: checkoutUrls.invoice_pdf,
            metadata: { domain, domainPurchaseId, freeCreditApplied },
          });

          break;
        }

        // ── Marketing Campaign Prepay / Top-up ──────────────────────
        if (
          session.metadata?.type === 'marketing_campaign_prepay' ||
          session.metadata?.type === 'marketing_campaign_topup'
        ) {
          const isTopup = session.metadata.type === 'marketing_campaign_topup';
          const { campaignId, siteId, userId } = session.metadata;
          if (!campaignId || !siteId) {
            console.error('Missing marketing_campaign payment metadata');
            return NextResponse.json({ error: 'Invalid session metadata' }, { status: 400 });
          }
          try {
            const piId = typeof session.payment_intent === 'string' ? session.payment_intent : null;
            const amountCents = session.amount_total ?? 0;
            if (!piId || amountCents <= 0) {
              console.error('Missing PI or amount on marketing campaign payment');
              break;
            }

            const { recordCampaignPayment } = await import('@/lib/marketing/campaign-budget');
            await recordCampaignPayment({
              campaignId,
              siteId,
              kind: isTopup ? 'topup' : 'prepay',
              amountCents,
              stripePaymentIntentId: piId,
              stripeCheckoutSessionId: session.id,
              actor: userId ? `user:${userId}` : 'system',
              description: isTopup ? 'Campaign budget top-up' : 'Initial campaign prepay',
            });

            const supabaseAdmin = (await import('@/lib/db/supabase-admin')).createAdminClient();

            if (isTopup) {
              // Top-up: if campaign was paused due to depleted budget, resume it.
              const { data: c } = await supabaseAdmin
                .from('marketing_campaigns')
                .select('status, channel, external_campaign_id')
                .eq('id', campaignId)
                .single();
              if (c?.status === 'paused' && c.channel === 'google_ads' && c.external_campaign_id) {
                try {
                  const { resumeCampaign } = await import('@/lib/marketing/google-ads');
                  await resumeCampaign(c.external_campaign_id);
                  await supabaseAdmin.from('marketing_campaigns')
                    .update({ status: 'active', updated_at: new Date().toISOString() })
                    .eq('id', campaignId);
                  await supabaseAdmin.from('marketing_campaign_log').insert({
                    campaign_id: campaignId,
                    action: 'resumed',
                    actor: 'system',
                    details: { reason: 'budget_topped_up' },
                  });
                } catch (resumeErr) {
                  console.error('[stripe webhook] resume after topup failed:', resumeErr);
                }
              }
            } else {
              // Initial prepay: flip to pending_launch + notify ops.
              const { data: c } = await supabaseAdmin
                .from('marketing_campaigns')
                .select('name, daily_budget_cents, sites!inner(id, site_slug, design_data, google_ads_customer_id, google_ads_billing_ready, user_id)')
                .eq('id', campaignId)
                .single();

              const { error: statusErr } = await supabaseAdmin.from('marketing_campaigns')
                .update({ status: 'pending_launch', updated_at: new Date().toISOString() })
                .eq('id', campaignId);
              if (statusErr) {
                // The payment succeeded and is recorded, but we couldn't advance
                // the campaign out of its current status. Don't swallow this —
                // return 500 so Stripe retries the webhook (recordCampaignPayment
                // is idempotent), rather than stranding a paid campaign in draft.
                console.error('[stripe webhook] failed to flip campaign to pending_launch after payment:', statusErr);
                return NextResponse.json(
                  { error: `Campaign status update to pending_launch failed: ${statusErr.message}` },
                  { status: 500 },
                );
              }

              await supabaseAdmin.from('marketing_campaign_log').insert({
                campaign_id: campaignId,
                action: 'pending_launch',
                actor: 'system',
                details: { reason: 'payment_received', stripe_payment_intent_id: piId },
              });

              try {
                const site = Array.isArray(c?.sites) ? c.sites[0] : c?.sites;
                if (site) {
                  const { data: ownerUser } = await supabaseAdmin.auth.admin.getUserById(site.user_id);
                  const customerEmail = ownerUser?.user?.email || 'unknown';
                  const siteName = (site.design_data as { siteTitle?: string } | null)?.siteTitle
                    || site.site_slug
                    || 'Untitled site';
                  const { sendMarketingOpsPendingNotification } = await import('@/lib/marketing/notifications');
                  await sendMarketingOpsPendingNotification({
                    campaignId,
                    campaignName: c?.name || 'Untitled campaign',
                    siteId,
                    siteName,
                    customerEmail,
                    dailyBudgetCents: c?.daily_budget_cents || 0,
                    googleAdsCustomerId: site.google_ads_customer_id,
                    billingAlreadyReady: site.google_ads_billing_ready === true,
                  });
                }
              } catch (notifyErr) {
                console.error('[stripe webhook] ops notification failed (non-fatal):', notifyErr);
              }
            }

            await recordStripeTransaction({
              stripe_event_id: event.id,
              stripe_customer_id: typeof session.customer === 'string' ? session.customer : '',
              stripe_payment_intent_id: piId,
              user_id: userId || null,
              event_type: 'checkout.session.completed',
              transaction_type: isTopup ? 'marketing_campaign_topup' : 'marketing_campaign_prepay',
              description: isTopup ? 'Marketing campaign top-up' : 'Marketing campaign prepay',
              amount_cents: amountCents,
              currency: session.currency ?? 'cad',
              status: 'succeeded',
              invoice_url: checkoutUrls.invoice_url,
              invoice_pdf: checkoutUrls.invoice_pdf,
              metadata: { campaignId, siteId },
            });
          } catch (err: any) {
            console.error('Failed to record marketing campaign payment:', err);
          }
          break;
        }

        if (session.metadata?.type === 'ecommerce_order') {
          const orderId = session.metadata.orderId;
          const siteId = session.metadata.siteId;

          if (!orderId) {
            console.error('Missing orderId in checkout session metadata');
            return NextResponse.json({ error: 'Invalid session metadata' }, { status: 400 });
          }

          // Update order status to paid, store payment_intent for future refunds
          const { data: order, error } = await supabase
            .from('orders')
            .update({
              status: 'confirmed',
              payment_status: 'paid',
              stripe_payment_id: session.payment_intent as string ?? null,
              updated_at: new Date().toISOString()
            })
            .eq('id', orderId)
            .select()
            .single();

          if (error || !order) {
            console.error('Failed to update order status:', error);
            return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
          }

          // Fetch site name + logo for customer emails
          const { data: webhookSiteInfo } = await supabase
            .from('sites')
            .select('site_slug, design_data, published_domain, custom_domain')
            .eq('id', siteId)
            .single();
          const webhookSiteName = webhookSiteInfo?.site_slug || undefined;
          const webhookLogoUrl: string | undefined = (webhookSiteInfo?.design_data as any)?.headerLogo || (webhookSiteInfo?.design_data as any)?.siteLogo || undefined;
          const webhookSiteOrigin = buildSiteOrigin({
            customDomain: webhookSiteInfo?.custom_domain,
            publishedDomain: webhookSiteInfo?.published_domain,
          });

          // Fetch ecommerce settings for notification email (fallback to booking_settings)
          const { data: ecomSettings } = await supabase
            .from('ecommerce_settings')
            .select('notification_email')
            .eq('site_id', siteId)
            .single();

          const { data: bookingSettings } = !ecomSettings ? await supabase
            .from('booking_settings')
            .select('notification_email')
            .eq('site_id', siteId)
            .single() : { data: null };

          const webhookPaymentConfig = ecomSettings || bookingSettings;

          const { data: webhookCustomRows } = await supabase
            .from('email_customizations')
            .select('email_key, overrides')
            .eq('site_id', siteId)
            .eq('email_key', 'order_confirmed');
          const webhookOverrides = webhookCustomRows?.[0]?.overrides;

          // Send emails
          const emailData = {
            orderId: order.id,
            items: order.items,
            subtotalCents: order.subtotal_cents,
            currency: order.items[0]?.currency || 'CAD',
            customerName: order.customer_name,
            customerEmail: order.customer_email,
            customerPhone: order.customer_phone,
            shippingAddress: order.shipping_address,
            paymentMethod: 'stripe',
            siteName: webhookSiteName,
            siteOrigin: webhookSiteOrigin,
            logoUrl: webhookLogoUrl,
            overrides: webhookOverrides,
          };

          sendOrderConfirmation(emailData).catch(err => console.error('Stripe webhook customer email failed:', err));

          if (webhookPaymentConfig?.notification_email) {
            sendOrderNotification(emailData, webhookPaymentConfig.notification_email)
              .catch(err => console.error('Stripe webhook owner email failed:', err));
          }

          // If this is a vendor order, notify the site owner
          if (order.vendor_id) {
            const { data: vendor } = await supabase
              .from('vendors')
              .select('name')
              .eq('id', order.vendor_id)
              .single();

            if (webhookPaymentConfig?.notification_email) {
              const { sendOwnerVendorOrderNotification } = await import('@/lib/email');
              sendOwnerVendorOrderNotification({
                parentOrderId: order.parent_order_id || order.id,
                childOrders: [{
                  orderId: order.id,
                  vendorName: vendor?.name || 'Vendor',
                  items: order.items,
                  subtotalCents: order.subtotal_cents,
                  paymentMethod: 'stripe',
                  status: 'confirmed',
                }],
                customerName: order.customer_name,
                customerEmail: order.customer_email,
                currency: order.items[0]?.currency || 'CAD',
                ownerEmail: webhookPaymentConfig.notification_email,
                siteName: webhookSiteName,
              }).catch(err => console.error('Vendor order owner notification failed:', err));
            }
          }

          console.log(`✅ Order ${orderId} marked as paid via Stripe.`);

          // Record ecommerce order transaction
          await recordStripeTransaction({
            stripe_event_id: event.id,
            stripe_customer_id: typeof session.customer === 'string' ? session.customer : '',
            stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
            user_id: session.metadata?.userId || null,
            event_type: 'checkout.session.completed',
            transaction_type: 'ecommerce_order',
            description: `Order ${orderId}`,
            amount_cents: session.amount_total ?? 0,
            currency: session.currency ?? 'cad',
            status: 'succeeded',
            invoice_url: checkoutUrls.invoice_url,
            invoice_pdf: checkoutUrls.invoice_pdf,
            metadata: { orderId, siteId },
          });

          break;
        }

        // ── Launch Service Checkout (subscription + one-time launch fee + optional domain)
        // This branch DOES NOT break — it falls through to the subscription handler
        // below so user_subscriptions is upserted normally. We just additionally
        // kick off domain provisioning + site publish, and mark the launch_request.
        if (session.metadata?.type === 'launch_service') {
          const launchRequestId = session.metadata?.launch_request_id;
          if (launchRequestId) {
            // Mark as launching so the polling loader sees progress.
            await supabase
              .from('launch_requests')
              .update({ onboarding_status: 'launching' })
              .eq('id', launchRequestId);

            // Fire-and-forget so Stripe gets its 200 quickly. Provisioning
            // updates onboarding_status to 'launched' or 'failed' on its own.
            provisionLaunch(launchRequestId).catch((err) => {
              console.error(`[launch-service] provisioning crashed for ${launchRequestId}:`, err);
            });
          }
          // continue to subscription handling below
        }

        // ── Subscription Checkout ─────────────────────────────────
        const userId = session.metadata?.userId;
        const planName = session.metadata?.planName;
        const customerId = typeof session.customer === 'string' ? session.customer : '';

        if (!userId) {
          console.error('Missing userId in checkout session metadata');
          return NextResponse.json({ error: 'Invalid session metadata' }, { status: 400 });
        }

        // Look up plan config for visitor/storage limits
        const planConfig = getPlanByName(planName);

        // Referral attribution: prefer metadata (set from ks_ref cookie at checkout
        // creation). If absent, backfill from the applied Stripe promotion code so
        // walk-ins who typed COMPUWAREZ still get attributed to Mike.
        let referralSource = (session.metadata?.referral_source ?? '')
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, '')
          .slice(0, 32);

        if (!referralSource) {
          try {
            const stripeClient = getStripeClient();
            const expanded = await stripeClient.checkout.sessions.retrieve(session.id, {
              expand: ['total_details.breakdown.discounts.discount.promotion_code'],
            });
            const discounts = expanded.total_details?.breakdown?.discounts ?? [];
            for (const d of discounts) {
              const promoCode = (d.discount as unknown as { promotion_code?: { code?: string } })
                ?.promotion_code?.code;
              if (promoCode) {
                referralSource = promoCode.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
                break;
              }
            }
          } catch (refErr) {
            // Non-blocking — subscription still activates, attribution just won't be recorded
            console.error('Failed to backfill referral_source from promo code:', refErr);
          }
        }

        // Upsert subscription info in user_subscriptions DB
        const { error } = await supabase
          .from('user_subscriptions')
          .upsert({
            user_id: userId,
            stripe_customer_id: customerId,
            subscription_status: 'active',
            subscription_plan: planName,
            stripe_subscription_id: session.subscription as string,
            subscription_started_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...(referralSource ? { referral_source: referralSource } : {}),
            ...(planConfig ? {
              visitor_limit: planConfig.visitorLimit,
              storage_limit_mb: planConfig.storageLimitMb,
            } : {}),
          }, { onConflict: 'user_id' }); // If a user manages to buy again, update their existing row

        if (error) {
          console.error('Failed to update user subscription:', error);
          return NextResponse.json(
            { error: 'Failed to update subscription' },
            { status: 500 }
          );
        }

        // ── Attach metered overage price to the subscription ────────
        // This is done post-checkout because Stripe Checkout doesn't allow
        // mixed billing intervals. The metered price is always monthly so
        // overage is billed monthly regardless of the base plan interval.
        const meteredPriceId = planConfig?.stripe.metered;
        if (meteredPriceId && session.subscription) {
          try {
            const stripeClient = getStripeClient();
            await stripeClient.subscriptionItems.create({
              subscription: session.subscription as string,
              price: meteredPriceId,
            });
            console.log(`✅ Metered overage price attached to subscription ${session.subscription}`);
          } catch (meteredErr) {
            // Non-blocking — subscription still works, overage just won't be tracked
            console.error('Failed to attach metered price to subscription:', meteredErr);
          }
        }

        try {
          const adminClient = createAdminClient();
          const { data: { user } } = await adminClient.auth.admin.getUserById(userId);
          if (user?.email) {
            const customerName = user.user_metadata?.full_name || user.user_metadata?.name || '';
            await sendSubscriptionPurchaseEmail({
              customerEmail: user.email,
              customerName: customerName,
              planName: planName || 'Unknown Plan',
              loginUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://keystoneweb.ca'}/signin`
            });
          }
        } catch (err) {
          console.error('Failed to send subscription purchase email:', err);
        }

        trackEvent('subscription_upgrade', {
          userId,
          metadata: { plan: planName, customerId },
        });

        // Record subscription creation transaction
        // (Revenue is tracked via invoice.paid — this is informational only)
        await recordStripeTransaction({
          stripe_event_id: event.id,
          stripe_subscription_id: session.subscription as string,
          stripe_customer_id: customerId,
          user_id: userId,
          event_type: 'checkout.session.completed',
          transaction_type: 'subscription_created',
          description: `Subscription created: ${planName}`,
          plan_name: planName,
          // Prefer the invoice's actual paid amount (post-tax) over session.amount_total
          // which is the pre-tax checkout subtotal when Stripe Tax is enabled.
          amount_cents: checkoutUrls.amount_paid_cents ?? session.amount_total ?? 0,
          currency: checkoutUrls.currency ?? session.currency ?? 'cad',
          status: 'succeeded',
          invoice_url: checkoutUrls.invoice_url,
          invoice_pdf: checkoutUrls.invoice_pdf,
          metadata: { planName },
        });

        console.log(`✅ Subscription activated for user ${userId}, plan: ${planName}`);
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const status = subscription.status; // 'active', 'past_due', 'canceled', etc.

        // Extract billing interval from subscription items
        const billingInterval = subscription.items.data[0]?.price?.recurring?.interval ?? 'month';

        // Safely extract a plan name. If nickname fails, try to fetch the product name, or default to generic.
        let planName = subscription.items.data[0]?.price.nickname;

        if (!planName && subscription.items.data[0]?.price.product) {
          const productId = subscription.items.data[0].price.product as string;
          try {
            const stripeClient = getStripeClient();
            const product = await stripeClient.products.retrieve(productId);
            planName = product.name;
          } catch (e) {
            console.error('Failed to retrieve full product name for subscription webhook', e);
          }
        }

        planName = planName || 'Unknown Plan';

        // Resolve plan config so we can keep storage/visitor limits in sync
        const updatedPlanConfig = getPlanByName(planName);

        // Read existing dunning state so we (a) open the grace window only once
        // when going past_due, and (b) can tell a payment-failure cancellation
        // apart from a user-requested one.
        const { data: priorSub } = await supabase
          .from('user_subscriptions')
          .select('subscription_status, grace_period_ends_at')
          .eq('stripe_subscription_id', subscription.id)
          .maybeSingle();

        const stripeCancelReason = (subscription as any).cancellation_details?.reason as string | undefined;
        const cancellationReason = status === 'canceled'
          ? ((stripeCancelReason === 'payment_failure' || priorSub?.subscription_status === 'past_due')
              ? 'payment_failed'
              : 'user_requested')
          : null;

        const dunningExtra: Record<string, any> = {};
        if (status === 'past_due' && !priorSub?.grace_period_ends_at) {
          // Stripe flipped us to past_due without an invoice.payment_failed first
          // (or it arrived out of order) — open the grace window here too.
          dunningExtra.payment_failed_at = new Date().toISOString();
          dunningExtra.grace_period_ends_at = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();
        }
        if (status === 'canceled') {
          dunningExtra.cancellation_reason = cancellationReason;
        }

        const { data: userSub, error } = await supabase
          .from('user_subscriptions')
          .update({
            subscription_status: status,
            subscription_plan: planName,
            billing_interval: billingInterval,
            ...(updatedPlanConfig ? {
              visitor_limit: updatedPlanConfig.visitorLimit,
              storage_limit_mb: updatedPlanConfig.storageLimitMb,
            } : {}),
            ...dunningExtra,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id)
          .select('user_id, stripe_customer_id, free_domain_claimed, free_domain_claimed_at')
          .maybeSingle();

        if (error) {
          console.error(`Failed to update subscription ${subscription.id} to ${status}:`, error);
          return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
        }

        if (!userSub) {
          // Subscription not tracked in our DB (e.g. created before this webhook was set up)
          console.warn(`Subscription ${subscription.id} not found in user_subscriptions; skipping sync.`);
          break;
        }

        // Record subscription status change
        await recordStripeTransaction({
          stripe_event_id: event.id,
          stripe_subscription_id: subscription.id,
          stripe_customer_id: userSub.stripe_customer_id,
          user_id: userSub.user_id,
          event_type: event.type,
          transaction_type: 'subscription_status_change',
          description: `Subscription ${status}: ${planName}`,
          plan_name: planName,
          billing_interval: billingInterval,
          amount_cents: 0,
          currency: subscription.currency ?? 'cad',
          status: status === 'active' ? 'succeeded' : status,
          metadata: { status, cancel_at_period_end: subscription.cancel_at_period_end },
        });

        // ── Refund abuse prevention ────────────────────────────────────────
        // If this subscription is being cancelled/lapsed and the user already
        // claimed their free Pro domain, tag the Stripe customer so any refund
        // request is immediately flagged in the dashboard.
        const isCancelling = status === 'canceled' ||
          (event.type === 'customer.subscription.updated' &&
            (event.data.object as Stripe.Subscription).cancel_at_period_end === true);

        if (isCancelling && userSub?.free_domain_claimed && userSub.stripe_customer_id) {
          try {
            const stripeClient = getStripeClient();
            await stripeClient.customers.update(userSub.stripe_customer_id, {
              metadata: {
                free_domain_claimed: 'true',
                free_domain_claimed_at: userSub.free_domain_claimed_at ?? new Date().toISOString(),
                refund_policy: 'no_refund_digital_goods_delivered',
              },
            });
            console.warn(
              `⚠️  Subscription ${subscription.id} cancelled — free domain was already claimed. ` +
              `Customer ${userSub.stripe_customer_id} tagged as refund-ineligible.`
            );
          } catch (tagErr) {
            console.error('Failed to tag Stripe customer for refund prevention:', tagErr);
          }
        }

        if (status === 'canceled' || isCancelling) {
          // Look up user_id for the event — userSub has stripe_customer_id, not user_id directly
          // We stored user_id in user_subscriptions so fetch it
          const { data: subRow } = await supabase
            .from('user_subscriptions')
            .select('user_id')
            .eq('stripe_subscription_id', subscription.id)
            .single();
          trackEvent('subscription_cancel', {
            userId: subRow?.user_id,
            metadata: { plan: planName, status },
          });

          if (subRow?.user_id) {
            try {
              const adminClient = createAdminClient();
              const { data: { user } } = await adminClient.auth.admin.getUserById(subRow.user_id);
              if (user?.email) {
                const customerName = user.user_metadata?.full_name || user.user_metadata?.name || '';
                if (cancellationReason === 'payment_failed') {
                  // Lapsed because we couldn't recover payment — softer, recovery-focused copy.
                  await sendSubscriptionLapsedEmail({
                    customerEmail: user.email,
                    customerName,
                    planName,
                    billingUrl: `${APP_URL}/pricing`,
                  });
                } else {
                  await sendSubscriptionCancelledEmail({
                    customerEmail: user.email,
                    customerName,
                    planName,
                  });
                }
              }
            } catch (err) {
              console.error('Failed to send subscription cancelled email:', err);
            }
          }
        }

        // ── Cancel all add-ons when subscription is fully deleted/cancelled ──
        if (status === 'canceled' && event.type === 'customer.subscription.deleted') {
          const { data: subRow } = await supabase
            .from('user_subscriptions')
            .select('user_id')
            .eq('stripe_subscription_id', subscription.id)
            .single();

          if (subRow?.user_id) {
            const { error: addonErr } = await supabase
              .from('user_addons')
              .update({
                status: 'cancelled',
                cancelled_at: new Date().toISOString(),
                stripe_item_id: null,
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', subRow.user_id)
              .in('status', ['approved', 'active']);

            if (addonErr) {
              console.error('Failed to cancel add-ons on subscription deletion:', addonErr);
            } else {
              console.log(`Add-ons cancelled for user ${subRow.user_id} due to subscription cancellation`);
            }
          }
        }

        console.log(`✅ Subscription ${subscription.id} updated to status: ${status}, plan: ${planName}`);
        break;
      }

      // ── Invoice paid: confirmed payment for revenue tracking ──────────
      case 'invoice.paid': {
        // Cast to any: the 2026-02-25 Stripe API version restructured Invoice types
        // but the runtime object still has these fields.
        const invoice = event.data.object as any;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : '';
        const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : '';
        const interval = invoice.lines?.data?.[0]?.price?.recurring?.interval ?? null;

        // Look up user_id from stripe_customer_id
        const { data: invoiceSubRow } = await supabase
          .from('user_subscriptions')
          .select('user_id, subscription_plan, payment_failed_at, last_dunning_email_stage')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        // Update billing_interval on user_subscriptions if this is a subscription invoice
        if (subscriptionId && interval) {
          await supabase
            .from('user_subscriptions')
            .update({ billing_interval: interval, updated_at: new Date().toISOString() })
            .eq('stripe_subscription_id', subscriptionId);
        }

        // Determine period from line items
        const firstLine = invoice.lines?.data?.[0];
        const periodStart = firstLine?.period?.start
          ? new Date(firstLine.period.start * 1000).toISOString()
          : null;
        const periodEnd = firstLine?.period?.end
          ? new Date(firstLine.period.end * 1000).toISOString()
          : null;

        // Build description from line item descriptions
        const lineDescriptions = invoice.lines?.data
          ?.map((l: any) => l.description)
          .filter(Boolean)
          .join(', ');

        await recordStripeTransaction({
          stripe_event_id: event.id,
          stripe_subscription_id: subscriptionId || null,
          stripe_customer_id: customerId,
          stripe_invoice_id: invoice.id,
          stripe_payment_intent_id: typeof invoice.payment_intent === 'string' ? invoice.payment_intent : null,
          stripe_charge_id: typeof invoice.charge === 'string' ? invoice.charge : null,
          user_id: invoiceSubRow?.user_id ?? null,
          event_type: 'invoice.paid',
          transaction_type: subscriptionId ? 'subscription_payment' : 'one_time_payment',
          description: lineDescriptions || `Invoice ${invoice.id}`,
          plan_name: invoiceSubRow?.subscription_plan ?? null,
          billing_interval: interval,
          amount_cents: invoice.amount_paid,
          currency: invoice.currency,
          status: 'succeeded',
          invoice_url: invoice.hosted_invoice_url,
          invoice_pdf: invoice.invoice_pdf,
          period_start: periodStart,
          period_end: periodEnd,
          metadata: {
            invoice_number: invoice.number,
            billing_reason: invoice.billing_reason,
          },
        });

        // ── Recovery: a previously-failed payment just succeeded ───────────
        // Clear the dunning state (hides the banner, stops reminder emails) and
        // confirm to the customer that Pro is restored. The guard ensures normal
        // renewals / first payments don't trigger this.
        if (invoiceSubRow?.user_id && (invoiceSubRow.payment_failed_at || invoiceSubRow.last_dunning_email_stage)) {
          await supabase
            .from('user_subscriptions')
            .update({
              payment_failed_at: null,
              grace_period_ends_at: null,
              last_dunning_email_stage: null,
              last_dunning_email_at: null,
              cancellation_reason: null,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', invoiceSubRow.user_id);

          try {
            const adminClient = createAdminClient();
            const { data: { user } } = await adminClient.auth.admin.getUserById(invoiceSubRow.user_id);
            if (user?.email) {
              const customerName = user.user_metadata?.full_name || user.user_metadata?.name || '';
              await sendPaymentRecoveredEmail({
                customerEmail: user.email,
                customerName,
                planName: invoiceSubRow.subscription_plan || 'Pro',
                dashboardUrl: `${APP_URL}/admin`,
              });
            }
          } catch (emailErr) {
            console.error('Failed to send payment recovered email:', emailErr);
          }

          console.log(`✅ Payment recovered for user ${invoiceSubRow.user_id} — dunning state cleared`);
        }

        console.log(`✅ Invoice ${invoice.id} paid — $${(invoice.amount_paid / 100).toFixed(2)} ${invoice.currency}`);
        break;
      }

      // ── Invoice payment failed ────────────────────────────────────────
      case 'invoice.payment_failed': {
        const failedInvoice = event.data.object as any;
        const failedCustomerId = typeof failedInvoice.customer === 'string' ? failedInvoice.customer : '';
        const failedSubscriptionId = typeof failedInvoice.subscription === 'string' ? failedInvoice.subscription : '';

        const { data: failedSubRow } = await supabase
          .from('user_subscriptions')
          .select('user_id, subscription_plan')
          .eq('stripe_customer_id', failedCustomerId)
          .maybeSingle();

        await recordStripeTransaction({
          stripe_event_id: event.id,
          stripe_subscription_id: failedSubscriptionId || null,
          stripe_customer_id: failedCustomerId,
          stripe_invoice_id: failedInvoice.id,
          user_id: failedSubRow?.user_id ?? null,
          event_type: 'invoice.payment_failed',
          transaction_type: failedSubscriptionId ? 'subscription_payment' : 'one_time_payment',
          description: `Payment failed: Invoice ${failedInvoice.id}`,
          plan_name: failedSubRow?.subscription_plan ?? null,
          amount_cents: failedInvoice.amount_due,
          currency: failedInvoice.currency,
          status: 'failed',
          invoice_url: failedInvoice.hosted_invoice_url,
          invoice_pdf: failedInvoice.invoice_pdf,
          metadata: {
            invoice_number: failedInvoice.number,
            billing_reason: failedInvoice.billing_reason,
            attempt_count: failedInvoice.attempt_count,
          },
        });

        // ── Dunning: open the grace window + notify the customer ───────────
        // We keep the customer on full Pro access during Stripe's retry window
        // and warn them via email + an in-app banner. Stripe handles retrying
        // the card; we handle communicating + tracking the grace deadline.
        // Subscription invoices only — one-time payment failures don't dun.
        if (failedSubscriptionId && failedSubRow?.user_id) {
          const attemptCount: number = failedInvoice.attempt_count ?? 1;
          const nowIso = new Date().toISOString();

          // Read current dunning state so we open the grace window only once and
          // never send the same stage twice (Stripe retries fire multiple events).
          const { data: dunRow } = await supabase
            .from('user_subscriptions')
            .select('grace_period_ends_at, last_dunning_email_stage, subscription_plan')
            .eq('user_id', failedSubRow.user_id)
            .maybeSingle();

          const planName = dunRow?.subscription_plan || failedSubRow.subscription_plan || 'Pro';
          const isFirstFailure = !dunRow?.grace_period_ends_at;
          const graceEndsIso = dunRow?.grace_period_ends_at
            || new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();

          // Decide which email this attempt warrants:
          // first failure → failure notice; later retries → reminder (each once).
          const currentStage = dunRow?.last_dunning_email_stage || null;
          let nextStage: 'failure' | 'reminder' | null = null;
          if (attemptCount <= 1 && currentStage === null) {
            nextStage = 'failure';
          } else if (attemptCount >= 2 && currentStage !== 'reminder' && currentStage !== 'final') {
            nextStage = 'reminder';
          }

          const updateFields: Record<string, any> = {
            grace_period_ends_at: graceEndsIso,
            updated_at: nowIso,
          };
          if (isFirstFailure) updateFields.payment_failed_at = nowIso;
          if (nextStage) {
            updateFields.last_dunning_email_stage = nextStage;
            updateFields.last_dunning_email_at = nowIso;
          }

          await supabase
            .from('user_subscriptions')
            .update(updateFields)
            .eq('user_id', failedSubRow.user_id);

          if (nextStage) {
            try {
              const adminClient = createAdminClient();
              const { data: { user } } = await adminClient.auth.admin.getUserById(failedSubRow.user_id);
              if (user?.email) {
                const customerName = user.user_metadata?.full_name || user.user_metadata?.name || '';
                const graceEndsAt = formatGraceDate(graceEndsIso);
                if (nextStage === 'failure') {
                  await sendPaymentFailedEmail({ customerEmail: user.email, customerName, planName, graceEndsAt, billingUrl: BILLING_URL });
                } else {
                  await sendPaymentRetryReminderEmail({ customerEmail: user.email, customerName, planName, graceEndsAt, billingUrl: BILLING_URL });
                }
              }
            } catch (emailErr) {
              console.error('Failed to send dunning email:', emailErr);
            }
          }
        }

        console.error(`❌ Invoice ${failedInvoice.id} payment failed — $${(failedInvoice.amount_due / 100).toFixed(2)} ${failedInvoice.currency}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
