import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { sendOrderConfirmation, sendOrderNotification } from '@/lib/email';
import { completeDomainPurchase } from '@/app/api/domains/purchase/route';
import Stripe from 'stripe';

// Initialize Stripe only when API key is available
const getStripeClient = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

/**
 * POST /api/stripe/webhook
 * Handle Stripe webhook events for subscription and payment lifecycle.
 *
 * Listens for:
 * - checkout.session.completed: Store subscription info / trigger domain purchase on payment success
 * - customer.subscription.updated: Sync status; tag customer as refund-ineligible if free domain was claimed
 * - customer.subscription.deleted: Same as above + marks subscription as canceled
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

  const supabase = await createClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        // ── Domain Purchase Payment ─────────────────────────────────
        if (session.metadata?.type === 'domain_purchase') {
          const { domainPurchaseId, domain, siteId, userId } = session.metadata;

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
          );

          if (result.success) {
            console.log(`✅ Domain ${domain} purchased and linked successfully`);
          } else {
            console.error(`❌ Domain purchase failed for ${domain}:`, result.error);
            // The purchase record is already marked as 'failed' by completeDomainPurchase
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

          // Update order status to paid
          const { data: order, error } = await supabase
            .from('orders')
            .update({
              status: 'confirmed',
              payment_status: 'paid',
              updated_at: new Date().toISOString()
            })
            .eq('id', orderId)
            .select()
            .single();

          if (error || !order) {
            console.error('Failed to update order status:', error);
            return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
          }

          // Fetch booking settings for notification email
          const { data: bookingSettings } = await supabase
            .from('booking_settings')
            .select('notification_email')
            .eq('site_id', siteId)
            .single();

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
          };

          sendOrderConfirmation(emailData).catch(err => console.error('Stripe webhook customer email failed:', err));

          if (bookingSettings?.notification_email) {
            sendOrderNotification(emailData, bookingSettings.notification_email)
              .catch(err => console.error('Stripe webhook owner email failed:', err));
          }

          console.log(`✅ Order ${orderId} marked as paid via Stripe.`);
          break;
        }

        const userId = session.metadata?.userId;
        const planName = session.metadata?.planName;
        // Optionally capture customer email/id for future referencing
        const customerId = typeof session.customer === 'string' ? session.customer : '';

        if (!userId) {
          console.error('Missing userId in checkout session metadata');
          return NextResponse.json({ error: 'Invalid session metadata' }, { status: 400 });
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
          }, { onConflict: 'user_id' }); // If a user manages to buy again, update their existing row

        if (error) {
          console.error('Failed to update user subscription:', error);
          return NextResponse.json(
            { error: 'Failed to update subscription' },
            { status: 500 }
          );
        }

        console.log(`✅ Subscription activated for user ${userId}, plan: ${planName}`);
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const status = subscription.status; // 'active', 'past_due', 'canceled', etc.

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

        const { data: userSub, error } = await supabase
          .from('user_subscriptions')
          .update({
            subscription_status: status,
            subscription_plan: planName,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id)
          .select('stripe_customer_id, free_domain_claimed, free_domain_claimed_at')
          .single();

        if (error) {
          console.error(`Failed to update subscription ${subscription.id} to ${status}:`, error);
          return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
        }

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

        console.log(`✅ Subscription ${subscription.id} updated to status: ${status}, plan: ${planName}`);
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
