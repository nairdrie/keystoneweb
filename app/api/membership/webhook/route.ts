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

type Db = ReturnType<typeof createAdminClient>;

/**
 * Members a Stripe customer belongs to. Customer ids live on the site's connected
 * account (event.account), so look only at that account's sites, and prefer the
 * member id stamped on the subscription. Several rows can share a customer (e.g.
 * a member re-imported on a new site), so this returns all of them — never .single().
 */
async function membersForCustomer(supabase: Db, customerId: string, account: string | null | undefined, metadata?: Stripe.Metadata | null): Promise<string[]> {
  if (!customerId) return [];
  let siteIds: string[] | null = null;
  if (account) {
    const { data: sites } = await supabase.from('sites').select('id').eq('stripe_account_id', account);
    siteIds = (sites || []).map((s: { id: string }) => s.id);
    if (!siteIds.length) return [];
  }
  if (metadata?.memberId) {
    let q = supabase.from('members').select('id').eq('id', metadata.memberId).eq('stripe_customer_id', customerId);
    if (siteIds) q = q.in('site_id', siteIds);
    const { data } = await q.maybeSingle();
    if (data) return [data.id];
  }
  let q = supabase.from('members').select('id').eq('stripe_customer_id', customerId);
  if (siteIds) q = q.in('site_id', siteIds);
  const { data } = await q;
  return (data || []).map((m: { id: string }) => m.id);
}

/** Stripe subscription status → members.subscription_status. */
function memberSubscriptionStatus(status: Stripe.Subscription.Status): string {
  if (status === 'trialing') return 'trialing';
  if (status === 'past_due' || status === 'incomplete') return 'past_due';
  if (status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired') return 'cancelled';
  return 'active';
}

/** A finished membership checkout: grant the package (only now, once paid). */
async function completeMembershipCheckout(supabase: Db, session: Stripe.Checkout.Session) {
  if (session.metadata?.type !== 'membership') return;
  const { memberId, siteId, packageId } = session.metadata;
  if (!memberId || !siteId || !packageId) return;
  // One-time payments can complete before the money arrives (async methods): wait for it.
  if (session.mode === 'payment' && session.payment_status !== 'paid') return;

  const { data: pkg } = await supabase.from('membership_packages').select('id').eq('id', packageId).eq('site_id', siteId).maybeSingle();
  if (!pkg) return;

  const updates: Record<string, unknown> = {
    package_id: packageId,
    updated_at: new Date().toISOString(),
  };
  if (session.subscription) {
    updates.stripe_subscription_id = session.subscription as string;
    updates.subscription_status = 'active';
  }
  await supabase.from('members').update(updates).eq('id', memberId).eq('site_id', siteId);
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
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        await completeMembershipCheckout(supabase, event.data.object as Stripe.Checkout.Session);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const memberIds = await membersForCustomer(supabase, subscription.customer as string, event.account, subscription.metadata);
        if (!memberIds.length) break;

        const periodEnd = (subscription as any).current_period_end;
        await supabase
          .from('members')
          .update({
            subscription_status: memberSubscriptionStatus(subscription.status),
            ...(periodEnd ? { current_period_end: new Date(periodEnd * 1000).toISOString() } : {}),
            updated_at: new Date().toISOString(),
          })
          .in('id', memberIds);

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const memberIds = await membersForCustomer(supabase, subscription.customer as string, event.account, subscription.metadata);
        if (!memberIds.length) break;

        await supabase
          .from('members')
          .update({
            subscription_status: 'cancelled',
            stripe_subscription_id: null,
            updated_at: new Date().toISOString(),
          })
          .in('id', memberIds);

        // Send cancellation email
        for (const memberId of memberIds) {
          const cancelCtx = await getMemberEmailContext(supabase, memberId);
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
        }

        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        // Mark the subscription active again on a successful payment.
        if ((invoice as any).subscription) {
          const memberIds = await membersForCustomer(supabase, customerId, event.account, (invoice as any).subscription_details?.metadata);
          if (memberIds.length) {
            await supabase
              .from('members')
              .update({
                subscription_status: 'active',
                updated_at: new Date().toISOString(),
              })
              .in('id', memberIds);
          }

          // Send renewal email only for actual renewals, not first payment
          if ((invoice as any).billing_reason === 'subscription_cycle') {
            for (const memberId of memberIds) {
              const renewalCtx = await getMemberEmailContext(supabase, memberId);
              if (!renewalCtx) continue;
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
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Membership webhook error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
