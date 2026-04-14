import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { sendOrderConfirmation, sendOrderNotification, sendSubscriptionPurchaseEmail, sendSubscriptionCancelledEmail } from '@/lib/email';
import { completeDomainPurchase } from '@/app/api/domains/purchase/route';
import { initiateVercelTransfer } from '@/app/api/domains/transfer/route';
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

/**
 * Record a Stripe event as a transaction in our DB.
 * Uses upsert with stripe_event_id as the unique key for idempotency —
 * if Stripe retries a webhook, we won't create duplicate records.
 *
 * Also syncs succeeded revenue transactions to accounting_entries so they
 * appear in the ops/accounting transaction list alongside manual entries.
 */

/** Map Stripe transaction_type to accounting entry source. */
const ACCOUNTING_SOURCE_MAP: Record<string, string> = {
  subscription_payment: 'subscription',
  domain_purchase: 'domain_sale',
  domain_transfer: 'domain_sale',
  one_time_payment: 'manual',
};

/** Revenue transaction types that should be synced to accounting_entries. */
const REVENUE_TRANSACTION_TYPES = new Set(Object.keys(ACCOUNTING_SOURCE_MAP));

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

    // Sync revenue transactions to accounting_entries so they appear in
    // the ops/accounting transaction list (not just in aggregate metrics).
    if (
      data.status === 'succeeded' &&
      data.amount_cents > 0 &&
      REVENUE_TRANSACTION_TYPES.has(data.transaction_type)
    ) {
      const source = ACCOUNTING_SOURCE_MAP[data.transaction_type] ?? 'manual';
      const entryDate = data.period_start
        ? new Date(data.period_start).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);

      const { error: entryError } = await db.from('accounting_entries').upsert(
        {
          type: 'revenue',
          source,
          title: data.description || `${data.transaction_type} payment`,
          description: data.plan_name ? `Plan: ${data.plan_name}` : null,
          amount_cents: data.amount_cents,
          tax_cents: 0,
          currency: (data.currency || 'cad').toUpperCase(),
          category: source === 'subscription' ? 'Subscriptions' : source === 'domain_sale' ? 'Domains' : null,
          date: entryDate,
          reference_id: data.stripe_event_id,
          reference_type: 'stripe_event',
          user_id: data.user_id || null,
          is_auto: true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'reference_id',
          ignoreDuplicates: true,
        },
      );
      if (entryError) {
        console.error('Failed to sync accounting entry:', entryError);
      }
    }
  } catch (err) {
    // Non-blocking — don't fail the webhook if transaction recording fails
    console.error('Error recording stripe transaction:', err);
  }
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

  // Use admin client for all DB operations — the webhook runs without an
  // authenticated user session, so the anon client would hit RLS restrictions
  // (e.g. user_subscriptions lookups in invoice.paid would silently return null).
  const supabase = createAdminClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

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
            metadata: { domain, domainPurchaseId, freeCreditApplied },
          });

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

          // Fetch site name for customer emails
          const { data: webhookSiteInfo } = await supabase
            .from('sites')
            .select('title, site_slug')
            .eq('id', siteId)
            .single();
          const webhookSiteName = webhookSiteInfo?.title || webhookSiteInfo?.site_slug || undefined;

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
          };

          sendOrderConfirmation(emailData).catch(err => console.error('Stripe webhook customer email failed:', err));

          if (webhookPaymentConfig?.notification_email) {
            sendOrderNotification(emailData, webhookPaymentConfig.notification_email)
              .catch(err => console.error('Stripe webhook owner email failed:', err));
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
            metadata: { orderId, siteId },
          });

          break;
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
          amount_cents: session.amount_total ?? 0,
          currency: session.currency ?? 'cad',
          status: 'succeeded',
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
                await sendSubscriptionCancelledEmail({
                  customerEmail: user.email,
                  customerName: customerName,
                  planName: planName,
                });
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
          .select('user_id, subscription_plan')
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
