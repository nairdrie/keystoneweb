import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { sendMemberRenewalEmail, sendMemberCancellationEmail } from '@/lib/email';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover' as any,
});

const webhookSecret = process.env.STRIPE_MEMBERSHIP_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET!;

/** Fetch member + package + site settings for sending emails */
async function getMemberEmailContext(supabase: ReturnType<typeof createAdminClient>, memberId: string) {
  const { data: member } = await supabase
    .from('members')
    .select('id, email, name, site_id, package_id, current_period_end')
    .eq('id', memberId)
    .single();

  if (!member) return null;

  const [{ data: pkg }, { data: site }, { data: settings }] = await Promise.all([
    member.package_id
      ? supabase.from('membership_packages').select('name').eq('id', member.package_id).single()
      : Promise.resolve({ data: null }),
    supabase.from('sites').select('site_slug, custom_domain, published_domain').eq('id', member.site_id).single(),
    supabase.from('membership_settings').select('branding, renewal_email_subject, renewal_email_body, renewal_cta_enabled, renewal_cta_label, cancellation_email_subject, cancellation_email_body, cancellation_cta_enabled, cancellation_cta_label').eq('site_id', member.site_id).single(),
  ]);

  const siteName = site?.site_slug || site?.custom_domain || site?.published_domain || undefined;

  return { member, packageName: pkg?.name || 'Membership', siteName, settings };
}

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

        // Send cancellation email
        const cancelCtx = await getMemberEmailContext(supabase, member.id);
        if (cancelCtx) {
          const accessEndDate = cancelCtx.member.current_period_end
            ? new Date(cancelCtx.member.current_period_end).toLocaleDateString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric',
              })
            : undefined;

          await sendMemberCancellationEmail({
            memberEmail: cancelCtx.member.email,
            memberName: cancelCtx.member.name || undefined,
            siteName: cancelCtx.siteName,
            packageName: cancelCtx.packageName,
            accessEndDate,
            customSubject: cancelCtx.settings?.cancellation_email_subject || undefined,
            customBody: cancelCtx.settings?.cancellation_email_body || undefined,
            ctaEnabled: cancelCtx.settings?.cancellation_cta_enabled ?? false,
            ctaLabel: cancelCtx.settings?.cancellation_cta_label || undefined,
            branding: cancelCtx.settings?.branding || undefined,
          });
        }

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

            // Send renewal email only for actual renewals, not first payment
            if ((invoice as any).billing_reason === 'subscription_cycle') {
              const renewalCtx = await getMemberEmailContext(supabase, member.id);
              if (renewalCtx) {
                const nextRenewalDate = renewalCtx.member.current_period_end
                  ? new Date(renewalCtx.member.current_period_end).toLocaleDateString('en-US', {
                      month: 'long', day: 'numeric', year: 'numeric',
                    })
                  : undefined;

                await sendMemberRenewalEmail({
                  memberEmail: renewalCtx.member.email,
                  memberName: renewalCtx.member.name || undefined,
                  siteName: renewalCtx.siteName,
                  packageName: renewalCtx.packageName,
                  nextRenewalDate,
                  customSubject: renewalCtx.settings?.renewal_email_subject || undefined,
                  customBody: renewalCtx.settings?.renewal_email_body || undefined,
                  ctaEnabled: renewalCtx.settings?.renewal_cta_enabled ?? false,
                  ctaLabel: renewalCtx.settings?.renewal_cta_label || undefined,
                  branding: renewalCtx.settings?.branding || undefined,
                });
              }
            }
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
