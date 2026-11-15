import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import {
  canSwitchInterval,
  findPlanItem,
  intervalOfItem,
  intervalPricing,
  isBillingInterval,
  isLateStatus,
  oppositeInterval,
  planKeyFor,
  resolveIntervalChangeStrategy,
  resolvePlanFromSubscription,
  yearlySavings,
  type BillingInterval,
} from '@/lib/subscription/billing-interval';
import type { PlanConfig } from '@/lib/plans';
import {
  buildAddonIntervalUpdates,
  loadActiveAddons,
  saveAddonPriceUpdates,
  type ActiveAddon,
} from '@/lib/subscription/addon-items';

/**
 * Billing-cycle switching for the customer's own subscription.
 *
 *   GET  /api/stripe/billing-interval  → what the switch would cost, previewed against Stripe
 *   POST /api/stripe/billing-interval  → apply it   body: { interval: 'month' | 'year' }
 *
 * The rules (proration when paid up, whole new term when late) live in
 * lib/subscription/billing-interval.ts so both verbs stay in step.
 */

const getStripeClient = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiVersion: '2026-02-25.clover' as any,
  });
};

/** Stripe throws plain Errors and StripeErrors — both carry a usable message. */
function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

interface SubscriptionContext {
  stripe: Stripe;
  subscription: Stripe.Subscription;
  plan: PlanConfig;
  planItem: Stripe.SubscriptionItem;
  currentInterval: BillingInterval;
  status: string;
  addons: ActiveAddon[];
  customerId: string;
  userId: string;
}

/**
 * Shared loader for both verbs: authenticate, pull the live Stripe subscription
 * and pin down which item carries the base plan.
 *
 * Returns a NextResponse instead of a context when the customer has nothing to
 * switch — the caller passes it straight back.
 */
async function loadContext(): Promise<SubscriptionContext | NextResponse> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: subRow } = await supabase
    .from('user_subscriptions')
    .select('stripe_subscription_id, stripe_customer_id, subscription_status, subscription_plan')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!subRow?.stripe_subscription_id || !subRow.stripe_customer_id) {
    return NextResponse.json(
      { available: false, reason: 'no_subscription', error: 'No subscription found for this account.' },
      { status: 404 },
    );
  }

  if (!canSwitchInterval(subRow.subscription_status)) {
    return NextResponse.json(
      {
        available: false,
        reason: 'status_not_switchable',
        status: subRow.subscription_status,
        error: 'This subscription is not in a state where the billing cycle can be changed.',
      },
      { status: 409 },
    );
  }

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subRow.stripe_subscription_id, {
    expand: ['items.data.price'],
  });

  // Re-check against Stripe rather than trusting our copy: a missed webhook can
  // leave the row saying `active` for a subscription Stripe has already ended.
  if (!canSwitchInterval(subscription.status)) {
    return NextResponse.json(
      {
        available: false,
        reason: 'status_not_switchable',
        status: subscription.status,
        error: 'This subscription is not in a state where the billing cycle can be changed.',
      },
      { status: 409 },
    );
  }

  // A plan change scheduled for the end of the period (a Pro → Basic downgrade)
  // runs through a subscription schedule, which would overwrite any item change
  // made here when it kicks in. Switch cycle after it has taken effect instead.
  if (subscription.schedule) {
    return NextResponse.json(
      {
        available: false,
        reason: 'scheduled_change',
        error: 'You have a plan change scheduled. The billing cycle can be changed once it takes effect, or after you cancel it on the Pricing page.',
      },
      { status: 409 },
    );
  }

  // Add-ons are extra items on the same subscription and must follow the base
  // plan's interval, otherwise the customer pays monthly add-on rates on a
  // yearly plan. Read them up front so they're excluded from plan-item matching.
  const db = createAdminClient();
  const addons: ActiveAddon[] = await loadActiveAddons(db, user.id, subscription);

  const plan = resolvePlanFromSubscription(subscription, subRow.subscription_plan);
  if (!plan) {
    return NextResponse.json(
      { available: false, reason: 'unknown_plan', error: 'Could not match this subscription to a Keystone plan.' },
      { status: 409 },
    );
  }

  const addonItemIds = new Set(addons.map((addon) => addon.stripe_item_id));
  const planItem = findPlanItem(subscription, plan, addonItemIds);
  const currentInterval = intervalOfItem(planItem);

  if (!planItem || !currentInterval) {
    return NextResponse.json(
      { available: false, reason: 'no_plan_item', error: 'Could not find the plan item on this subscription.' },
      { status: 409 },
    );
  }

  return {
    stripe,
    subscription,
    plan,
    planItem,
    currentInterval,
    status: subscription.status,
    addons,
    customerId: subRow.stripe_customer_id,
    userId: user.id,
  };
}

function priceIdFor(plan: PlanConfig, interval: BillingInterval): string {
  return interval === 'year' ? plan.stripe.yearly : plan.stripe.monthly;
}

/**
 * Build the `items` payload that moves the plan (and its add-ons) to `interval`.
 * See lib/subscription/addon-items.ts for how add-on prices are resolved in
 * `'preview'` vs `'apply'` mode.
 */
async function buildItemUpdates(
  ctx: SubscriptionContext,
  interval: BillingInterval,
  mode: 'preview' | 'apply',
): Promise<{
  items: Stripe.SubscriptionUpdateParams.Item[];
  addonPriceUpdates: Array<{ addonId: string; priceId: string }>;
  skippedAddons: number;
}> {
  const items: Stripe.SubscriptionUpdateParams.Item[] = [
    { id: ctx.planItem.id, price: priceIdFor(ctx.plan, interval), quantity: ctx.planItem.quantity ?? 1 },
  ];
  const productId = typeof ctx.planItem.price?.product === 'string' ? ctx.planItem.price.product : null;
  const addonUpdates = await buildAddonIntervalUpdates({
    stripe: ctx.stripe,
    subscription: ctx.subscription,
    addons: ctx.addons,
    productId,
    interval,
    mode,
  });

  return {
    items: [...items, ...addonUpdates.items],
    addonPriceUpdates: addonUpdates.addonPriceUpdates,
    skippedAddons: addonUpdates.skippedAddons,
  };
}

/** Summary of the invoice Stripe would raise for the switch, in cents. */
interface SwitchPreview {
  estimated: boolean;
  currency: string;
  amountDueCents: number;
  newTermCents: number;
  creditCents: number;
  nextRenewalAt: string | null;
}

async function previewSwitch(
  ctx: SubscriptionContext,
  interval: BillingInterval,
  prorationBehavior: 'always_invoice' | 'none',
): Promise<SwitchPreview> {
  const pricing = intervalPricing(ctx.plan, interval);
  const fallback: SwitchPreview = {
    estimated: true,
    currency: ctx.subscription.currency ?? 'cad',
    amountDueCents: Math.round(pricing.perTerm * 100),
    newTermCents: Math.round(pricing.perTerm * 100),
    creditCents: 0,
    nextRenewalAt: null,
  };

  try {
    const { items } = await buildItemUpdates(ctx, interval, 'preview');
    const preview = await ctx.stripe.invoices.createPreview({
      customer: ctx.customerId,
      subscription: ctx.subscription.id,
      subscription_details: {
        items,
        proration_behavior: prorationBehavior,
      },
    });

    const lines: Array<{ amount: number; period?: { end?: number } }> = preview.lines?.data ?? [];
    const creditCents = -lines.filter((l) => l.amount < 0).reduce((sum, l) => sum + l.amount, 0);
    const newTermCents = lines.filter((l) => l.amount > 0).reduce((sum, l) => sum + l.amount, 0);
    const periodEnds = lines.map((l) => l.period?.end ?? 0).filter((end) => end > 0);

    return {
      estimated: false,
      currency: preview.currency ?? fallback.currency,
      amountDueCents: preview.amount_due ?? fallback.amountDueCents,
      newTermCents: newTermCents || fallback.newTermCents,
      creditCents,
      nextRenewalAt: periodEnds.length ? new Date(Math.max(...periodEnds) * 1000).toISOString() : null,
    };
  } catch (err) {
    // A preview can fail for reasons that don't block the switch itself (missing
    // tax address, an unusual discount). Fall back to list pricing rather than
    // hiding the option entirely.
    console.error('[billing-interval] invoice preview failed, falling back to list pricing:', err);
    return fallback;
  }
}

function currentPeriodEndIso(subscription: Stripe.Subscription, planItem: Stripe.SubscriptionItem): string | null {
  // The 2026 API moved period fields onto the subscription item; older payloads
  // still carry them on the subscription itself.
  const raw =
    (planItem as unknown as { current_period_end?: number }).current_period_end ??
    (subscription as unknown as { current_period_end?: number }).current_period_end ??
    null;
  return typeof raw === 'number' ? new Date(raw * 1000).toISOString() : null;
}

export async function GET() {
  try {
    const ctx = await loadContext();
    if (ctx instanceof NextResponse) return ctx;

    const targetInterval = oppositeInterval(ctx.currentInterval);
    const strategy = resolveIntervalChangeStrategy(ctx.status);
    const preview = await previewSwitch(ctx, targetInterval, strategy.prorationBehavior);

    return NextResponse.json({
      available: true,
      planKey: planKeyFor(ctx.plan),
      planName: ctx.plan.name,
      status: ctx.status,
      isLate: isLateStatus(ctx.status),
      cancelAtPeriodEnd: ctx.subscription.cancel_at_period_end === true,
      currentInterval: ctx.currentInterval,
      targetInterval,
      currentPeriodEnd: currentPeriodEndIso(ctx.subscription, ctx.planItem),
      pricing: {
        month: intervalPricing(ctx.plan, 'month'),
        year: intervalPricing(ctx.plan, 'year'),
      },
      savingsPerYear: yearlySavings(ctx.plan),
      addonCount: ctx.addons.length,
      strategy: {
        reason: strategy.reason,
        chargesFullTerm: strategy.chargesFullTerm,
      },
      preview,
    });
  } catch (error) {
    console.error('[billing-interval] GET failed:', error);
    return NextResponse.json(
      { error: errorMessage(error, 'Failed to load billing cycle options') },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const interval = body?.interval;

    if (!isBillingInterval(interval)) {
      return NextResponse.json(
        { error: "Invalid billing interval — expected 'month' or 'year'." },
        { status: 400 },
      );
    }

    const ctx = await loadContext();
    if (ctx instanceof NextResponse) return ctx;

    if (ctx.currentInterval === interval) {
      return NextResponse.json(
        { error: `You are already billed ${interval === 'year' ? 'yearly' : 'monthly'}.` },
        { status: 409 },
      );
    }

    const targetPriceId = priceIdFor(ctx.plan, interval);
    if (!targetPriceId) {
      return NextResponse.json(
        { error: 'No Stripe price is configured for that billing cycle.' },
        { status: 500 },
      );
    }

    const strategy = resolveIntervalChangeStrategy(ctx.status);
    const { items, addonPriceUpdates, skippedAddons } = await buildItemUpdates(ctx, interval, 'apply');

    if (skippedAddons > 0) {
      // The add-on stays on its old interval — worth knowing about, but not a
      // reason to block the customer's plan change.
      console.warn(
        `[billing-interval] ${skippedAddons} add-on item(s) for user ${ctx.userId} could not be moved to ${interval} billing`,
      );
    }

    // Switching cycle restarts the term from today, so a late customer's new term
    // overlaps the days their failed invoice covers and they'd be dunned twice for
    // them. Snapshot those invoices *before* the switch — afterwards there's a
    // fresh open invoice in the list that must not be touched.
    let staleInvoiceIds: string[] = [];
    if (strategy.voidStaleInvoices) {
      const openInvoices = await ctx.stripe.invoices.list({
        customer: ctx.customerId,
        subscription: ctx.subscription.id,
        status: 'open',
        limit: 10,
      });
      staleInvoiceIds = openInvoices.data.map((invoice) => invoice.id).filter((id): id is string => !!id);
    }

    const updated = await ctx.stripe.subscriptions.update(ctx.subscription.id, {
      items,
      proration_behavior: strategy.prorationBehavior,
      expand: ['latest_invoice'],
    });

    // Only now that the new term exists — if the update had failed we'd have
    // written off the old invoice for nothing.
    let voidedInvoices = 0;
    for (const invoiceId of staleInvoiceIds) {
      try {
        await ctx.stripe.invoices.voidInvoice(invoiceId);
        voidedInvoices += 1;
      } catch (voidErr) {
        // Not fatal — the customer is on the right cycle either way.
        console.error(`[billing-interval] could not void stale invoice ${invoiceId}:`, voidErr);
      }
    }

    const db = createAdminClient();
    await db
      .from('user_subscriptions')
      .update({ billing_interval: interval, updated_at: new Date().toISOString() })
      .eq('user_id', ctx.userId);

    // Keep the per-user add-on prices we just minted on the add-on rows so a
    // later switch back reuses them instead of creating another one.
    await saveAddonPriceUpdates(db, addonPriceUpdates);

    const invoice = updated.latest_invoice && typeof updated.latest_invoice === 'object'
      ? updated.latest_invoice
      : null;

    const updatedPlanItem = findPlanItem(
      updated,
      ctx.plan,
      new Set(ctx.addons.map((a) => a.stripe_item_id)),
    );

    return NextResponse.json({
      success: true,
      interval,
      status: updated.status,
      voidedInvoices,
      chargedFullTerm: strategy.chargesFullTerm,
      nextRenewalAt: updatedPlanItem ? currentPeriodEndIso(updated, updatedPlanItem) : null,
      invoice: invoice
        ? {
            status: invoice.status,
            paid: invoice.status === 'paid',
            amountDueCents: invoice.amount_due ?? 0,
            amountPaidCents: invoice.amount_paid ?? 0,
            currency: invoice.currency ?? 'cad',
            hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
          }
        : null,
    });
  } catch (error) {
    console.error('[billing-interval] POST failed:', error);
    return NextResponse.json(
      { error: errorMessage(error, 'Failed to change billing cycle') },
      { status: 500 },
    );
  }
}
