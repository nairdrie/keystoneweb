import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
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
 * Handle Stripe webhook events for subscription confirmation
 * 
 * Listens for:
 * - checkout.session.completed: Store subscription info in DB
 * - customer.subscription.updated: Update subscription status
 * - customer.subscription.deleted: Handle cancellation
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
        const siteId = session.metadata?.siteId;
        const userId = session.metadata?.userId;
        const planName = session.metadata?.planName;

        if (!siteId || !userId) {
          console.error('Missing metadata in checkout session');
          return NextResponse.json({ error: 'Invalid session metadata' }, { status: 400 });
        }

        // Store subscription info in DB
        const { error } = await supabase
          .from('sites')
          .update({
            subscription_status: 'active',
            subscription_plan: planName,
            stripe_subscription_id: session.subscription as string,
            subscription_started_at: new Date().toISOString(),
          })
          .eq('id', siteId)
          .eq('user_id', userId);

        if (error) {
          console.error('Failed to update site subscription:', error);
          return NextResponse.json(
            { error: 'Failed to update subscription' },
            { status: 500 }
          );
        }

        console.log(`✅ Subscription activated for site ${siteId}, plan: ${planName}`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        // Update subscription status in DB if needed
        console.log(`Subscription updated: ${subscription.id}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        // Mark subscription as inactive
        const { error } = await supabase
          .from('sites')
          .update({
            subscription_status: 'canceled',
          })
          .eq('stripe_subscription_id', subscription.id);

        if (error) {
          console.error('Failed to update subscription cancellation:', error);
        }

        console.log(`Subscription canceled: ${subscription.id}`);
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
