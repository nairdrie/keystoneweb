import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover' as any,
});

const webhookSecret = process.env.STRIPE_MEMBERSHIP_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET!;

/**
 * POST /api/membership/webhook
 * Handles Stripe Connect webhook events for membership subscriptions.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const sig = request.headers.get('stripe-signature');

    if (!sig) {
      return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const supabase = createAdminClient();

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.type !== 'membership') break;

        const memberId = session.metadata.memberId;
        const packageId = session.metadata.packageId;

        if (!memberId) break;

        const updates: Record<string, any> = {
          package_id: packageId,
          updated_at: new Date().toISOString(),
        };

        if (session.subscription) {
          updates.stripe_subscription_id = session.subscription as string;
          updates.subscription_status = 'active';
        }

        await supabase
          .from('members')
          .update(updates)
          .eq('id', memberId);

        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: member } = await supabase
          .from('members')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (!member) break;

        let status = 'active';
        if (subscription.status === 'past_due') status = 'past_due';
        else if (subscription.status === 'canceled') status = 'cancelled';
        else if (subscription.status === 'trialing') status = 'trialing';

        await supabase
          .from('members')
          .update({
            subscription_status: status,
            current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', member.id);

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: member } = await supabase
          .from('members')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (!member) break;

        await supabase
          .from('members')
          .update({
            subscription_status: 'cancelled',
            stripe_subscription_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', member.id);

        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        // Update current_period_end on successful renewal
        if ((invoice as any).subscription) {
          const { data: member } = await supabase
            .from('members')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .single();

          if (member) {
            await supabase
              .from('members')
              .update({
                subscription_status: 'active',
                updated_at: new Date().toISOString(),
              })
              .eq('id', member.id);
          }
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Membership webhook error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
