import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { hasLiveSubscription } from '@/lib/subscription/access';
import {
  findPlanItem,
  intervalOfItem,
  intervalPricing,
  resolvePlanFromSubscription,
  type BillingInterval,
} from '@/lib/subscription/billing-interval';
import {
  buildAddonIntervalUpdates,
  loadActiveAddons,
  saveAddonPriceUpdates,
  type ActiveAddon,
} from '@/lib/subscription/addon-items';
import {
  PLAN_CHANGE_SCHEDULE_DOWNGRADE,
  PLAN_CHANGE_SCHEDULE_KEY,
  acceptProrationDate,
  buildDowngradePhaseItems,
  buildPlanItemUpdates,
  canChangePlan,
  downgradeScheduleHasTakenEffect,
  isKeystoneDowngradeSchedule,
  phaseToUpdateParams,
  resolvePlanChangeDirection,
  resolvePriceTarget,
  type PlanChangeDirection,
  type PriceTarget,
} from '@/lib/subscription/plan-change';
import type { PlanConfig } from '@/lib/plans';

/**
 * Plan changes (Basic ↔ Pro) for a customer who already has a subscription.
 *
 *   GET    /api/stripe/plan-change                → current plan + any scheduled change
 *   GET    /api/stripe/plan-change?priceId=...    → what changing to that price would do / cost
 *   POST   /api/stripe/plan-change                → apply it   body: { priceId, prorationDate? }
 *   DELETE /api/stripe/plan-change                → cancel a scheduled downgrade
 *
 * Upgrades apply immediately (prorated, charged today); downgrades are scheduled
 * for the end of the current period. Rules live in lib/subscription/plan-change.ts.
 *
 * This replaced the Customer Portal's subscription_update_confirm flow, which
 * Stripe rejects for subscriptions with more than one item — i.e. all of ours.
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

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function fail(status: number, reason: string, error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ reason, error, ...extra }, { status });
}

interface PlanContext {
  stripe: Stripe;
  subscription: Stripe.Subscription;
  schedule: Stripe.SubscriptionSchedule | null;
  plan: PlanConfig;
  planItem: Stripe.SubscriptionItem;
  currentInterval: BillingInterval;
  addons: ActiveAddon[];
  customerId: string;
  userId: string;
}

async function loadContext(): Promise<PlanContext | NextResponse> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return fail(401, 'unauthorized', 'Unauthorized');
  }

  const { data: subRow } = await supabase
    .from('user_subscriptions')
    .select('stripe_subscription_id, stripe_customer_id, subscription_status, subscription_plan')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!subRow?.stripe_subscription_id || !subRow.stripe_customer_id) {
    return fail(404, 'no_subscription', 'No subscription found for this account.');
  }

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subRow.stripe_subscription_id, {
    expand: ['items.data.price', 'schedule'],
  });

  // Trust Stripe over our copy — a missed webhook can leave the row `active`.
  if (!hasLiveSubscription(subscription.status)) {
    return fail(409, 'no_live_subscription', 'This subscription is no longer active. Choose a plan to start a new one.');
  }

  const plan = resolvePlanFromSubscription(subscription, subRow.subscription_plan);
  if (!plan) {
    return fail(409, 'unknown_plan', 'Could not match this subscription to a Keystone plan.');
  }

  const db = createAdminClient();
  const addons = await loadActiveAddons(db, user.id, subscription);
  const planItem = findPlanItem(subscription, plan, new Set(addons.map((a) => a.stripe_item_id)));
  const currentInterval = intervalOfItem(planItem);
  if (!planItem || !currentInterval) {
    return fail(409, 'no_plan_item', 'Could not find the plan item on this subscription.');
  }

  let schedule =
    subscription.schedule && typeof subscription.schedule === 'object' ? subscription.schedule : null;

  // A downgrade of ours that has already happened has nothing left to do. The
  // webhook normally releases it; if that was missed, do it here so it doesn't
  // block the next change (e.g. upgrading back to Pro).
  if (schedule && downgradeScheduleHasTakenEffect(schedule)) {
    const finishedScheduleId = schedule.id;
    try {
      await stripe.subscriptionSchedules.release(finishedScheduleId);
      schedule = null;
    } catch (err) {
      console.error(`[plan-change] could not release finished schedule ${finishedScheduleId}:`, err);
    }
  }

  return {
    stripe,
    subscription,
    schedule,
    plan,
    planItem,
    currentInterval,
    addons,
    customerId: subRow.stripe_customer_id,
    userId: user.id,
  };
}

function periodEndSeconds(subscription: Stripe.Subscription, item: Stripe.SubscriptionItem): number | null {
  // The 2026 API moved period fields onto the subscription item; older payloads
  // still carry them on the subscription itself.
  const raw =
    (item as unknown as { current_period_end?: number }).current_period_end ??
    (subscription as unknown as { current_period_end?: number }).current_period_end ??
    null;
  return typeof raw === 'number' ? raw : null;
}

const toIso = (seconds: number | null | undefined) => (seconds ? new Date(seconds * 1000).toISOString() : null);

/** The pending downgrade, if this subscription has one of ours that hasn't kicked in yet. */
function describeScheduledChange(ctx: PlanContext) {
  const schedule = ctx.schedule;
  if (!schedule || !isKeystoneDowngradeSchedule(schedule) || downgradeScheduleHasTakenEffect(schedule)) {
    return null;
  }
  const next = schedule.phases.find((phase) => phase.start_date > (schedule.current_phase?.start_date ?? 0));
  if (!next) return null;

  let target: PriceTarget | null = null;
  for (const item of next.items) {
    const priceId = typeof item.price === 'string' ? item.price : item.price?.id;
    target = resolvePriceTarget(priceId);
    if (target) break;
  }

  return {
    toPlan: target?.plan.name ?? null,
    toInterval: target?.interval ?? null,
    effectiveAt: toIso(next.start_date),
  };
}

function resolveTarget(ctx: PlanContext, priceId: unknown):
  | { target: PriceTarget; direction: PlanChangeDirection }
  | NextResponse {
  const target = resolvePriceTarget(typeof priceId === 'string' ? priceId : null);
  if (!target) {
    return fail(400, 'invalid_price', 'That plan is not available.');
  }

  const direction = resolvePlanChangeDirection(ctx.plan, target.plan);
  if (!direction) {
    return fail(409, 'same_plan', `You're already on the ${ctx.plan.name} plan.`, {
      currentPlan: ctx.plan.name,
      currentInterval: ctx.currentInterval,
    });
  }

  if (!canChangePlan(direction, ctx.subscription.status)) {
    return fail(
      409,
      'payment_required',
      'Your last payment didn’t go through. Please update your payment method and settle your balance before upgrading.',
    );
  }

  if (direction === 'downgrade' && ctx.subscription.cancel_at_period_end) {
    return fail(
      409,
      'cancel_scheduled',
      'Your subscription is already set to cancel at the end of the period. Resume it before changing plans.',
    );
  }

  // Any schedule other than our own pending downgrade means something we don't
  // manage is in flight on this subscription — don't stomp on it.
  if (ctx.schedule && !isKeystoneDowngradeSchedule(ctx.schedule)) {
    return fail(
      409,
      'external_schedule',
      'This subscription has a billing change in progress. Please contact support to change plans.',
    );
  }

  return { target, direction };
}

/** All item updates for an upgrade: plan + metered, plus add-ons if the interval moves. */
async function buildUpgradeItems(ctx: PlanContext, target: PriceTarget, mode: 'preview' | 'apply') {
  const { items, meteredMissing } = buildPlanItemUpdates(ctx.subscription, ctx.planItem, target);
  if (meteredMissing) {
    console.warn(`[plan-change] no metered price configured for ${target.plan.name}; overage item left as-is`);
  }

  if (target.interval === ctx.currentInterval) {
    return { items, addonPriceUpdates: [] as Array<{ addonId: string; priceId: string }>, skippedAddons: 0 };
  }

  const productId = typeof ctx.planItem.price?.product === 'string' ? ctx.planItem.price.product : null;
  const addonUpdates = await buildAddonIntervalUpdates({
    stripe: ctx.stripe,
    subscription: ctx.subscription,
    addons: ctx.addons,
    productId,
    interval: target.interval,
    mode,
  });

  return {
    items: [...items, ...addonUpdates.items],
    addonPriceUpdates: addonUpdates.addonPriceUpdates,
    skippedAddons: addonUpdates.skippedAddons,
  };
}

type PreviewLine = {
  amount: number;
  period?: { end?: number };
  pricing?: { price_details?: { price?: string | { id: string } } } | null;
};

function linePriceId(line: PreviewLine): string | null {
  const price = line.pricing?.price_details?.price;
  if (!price) return null;
  return typeof price === 'string' ? price : price.id;
}

async function previewUpgrade(ctx: PlanContext, target: PriceTarget, prorationDate: number) {
  const { items } = await buildUpgradeItems(ctx, target, 'preview');
  const preview = await ctx.stripe.invoices.createPreview({
    customer: ctx.customerId,
    subscription: ctx.subscription.id,
    subscription_details: {
      items,
      proration_behavior: 'always_invoice',
      proration_date: prorationDate,
    },
  });

  const lines = (preview.lines?.data ?? []) as unknown as PreviewLine[];
  const creditCents = -lines.filter((l) => l.amount < 0).reduce((sum, l) => sum + l.amount, 0);
  const chargesCents = lines.filter((l) => l.amount > 0).reduce((sum, l) => sum + l.amount, 0);
  const taxCents = (preview.total_taxes ?? []).reduce((sum, t) => sum + (t.amount ?? 0), 0);

  // Same cycle: the renewal date doesn't move. New cycle: it restarts today, and
  // the plan line's period end is the next renewal.
  let nextRenewal = periodEndSeconds(ctx.subscription, ctx.planItem);
  if (target.interval !== ctx.currentInterval) {
    const planLineEnds = lines
      .filter((l) => linePriceId(l) === target.priceId)
      .map((l) => l.period?.end ?? 0)
      .filter((end) => end > 0);
    nextRenewal = planLineEnds.length ? Math.max(...planLineEnds) : null;
  }

  return {
    currency: preview.currency ?? ctx.subscription.currency ?? 'cad',
    amountDueCents: preview.amount_due ?? 0,
    chargesCents,
    creditCents,
    taxCents,
    nextRenewalAt: toIso(nextRenewal),
  };
}

// ── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const ctx = await loadContext();
    if (ctx instanceof NextResponse) return ctx;

    const base = {
      currentPlan: ctx.plan.name,
      currentInterval: ctx.currentInterval,
      status: ctx.subscription.status,
      cancelAtPeriodEnd: ctx.subscription.cancel_at_period_end === true,
      currentPeriodEnd: toIso(periodEndSeconds(ctx.subscription, ctx.planItem)),
      scheduledChange: describeScheduledChange(ctx),
    };

    const priceId = request.nextUrl.searchParams.get('priceId');
    if (!priceId) return NextResponse.json(base);

    const resolved = resolveTarget(ctx, priceId);
    if (resolved instanceof NextResponse) return resolved;
    const { target, direction } = resolved;

    const common = {
      ...base,
      direction,
      targetPlan: target.plan.name,
      targetInterval: target.interval,
      targetPricing: intervalPricing(target.plan, target.interval),
      intervalChanges: target.interval !== ctx.currentInterval,
      addonCount: ctx.addons.length,
    };

    if (direction === 'downgrade') {
      return NextResponse.json({
        ...common,
        effectiveAt: toIso(periodEndSeconds(ctx.subscription, ctx.planItem)),
      });
    }

    const prorationDate = Math.floor(Date.now() / 1000);
    try {
      const preview = await previewUpgrade(ctx, target, prorationDate);
      return NextResponse.json({ ...common, prorationDate, preview });
    } catch (err) {
      // Never ask the customer to confirm a charge we couldn't price.
      console.error('[plan-change] upgrade preview failed:', err);
      return fail(
        502,
        'preview_failed',
        'We couldn’t calculate your upgrade price right now. Please try again in a moment, or contact support if this keeps happening.',
      );
    }
  } catch (error) {
    console.error('[plan-change] GET failed:', error);
    return fail(500, 'server_error', errorMessage(error, 'Failed to load plan change'));
  }
}

// ── POST ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const ctx = await loadContext();
    if (ctx instanceof NextResponse) return ctx;

    const resolved = resolveTarget(ctx, body?.priceId);
    if (resolved instanceof NextResponse) return resolved;
    const { target, direction } = resolved;

    return direction === 'upgrade'
      ? await applyUpgrade(ctx, target, body?.prorationDate)
      : await scheduleDowngrade(ctx, target);
  } catch (error) {
    console.error('[plan-change] POST failed:', error);
    return fail(500, 'server_error', errorMessage(error, 'Failed to change plan'));
  }
}

async function applyUpgrade(ctx: PlanContext, target: PriceTarget, rawProrationDate: unknown) {
  // resolveTarget let our own schedule through for downgrades; an upgrade means
  // the customer is on the cheaper plan, so one of ours shouldn't exist here.
  if (ctx.schedule) {
    return fail(
      409,
      'external_schedule',
      'This subscription has a billing change in progress. Please contact support to change plans.',
    );
  }

  const prorationDate = acceptProrationDate(rawProrationDate, Math.floor(Date.now() / 1000));
  const { items, addonPriceUpdates, skippedAddons } = await buildUpgradeItems(ctx, target, 'apply');
  if (skippedAddons > 0) {
    console.warn(
      `[plan-change] ${skippedAddons} add-on item(s) for user ${ctx.userId} could not be moved to ${target.interval} billing`,
    );
  }

  let updated: Stripe.Subscription;
  try {
    updated = await ctx.stripe.subscriptions.update(ctx.subscription.id, {
      items,
      proration_behavior: 'always_invoice',
      proration_date: prorationDate,
      // Only switch plans if the prorated invoice is actually paid. On a decline
      // or a card needing authentication, Stripe leaves the subscription as it was.
      payment_behavior: 'error_if_incomplete',
      expand: ['latest_invoice'],
    });
  } catch (err) {
    const stripeErr = err as { type?: string; statusCode?: number; message?: string };
    if (stripeErr?.type === 'StripeCardError' || stripeErr?.statusCode === 402) {
      return fail(
        402,
        'payment_failed',
        `Your payment didn’t go through${stripeErr.message ? `: ${stripeErr.message}` : '.'} Your plan hasn’t changed. Update your payment method and try again.`,
      );
    }
    throw err;
  }

  const db = createAdminClient();
  // The webhook syncs this too; writing it now means the app reflects the new
  // plan the moment the customer lands back on it.
  await db
    .from('user_subscriptions')
    .update({
      subscription_status: updated.status,
      subscription_plan: target.plan.name,
      billing_interval: target.interval,
      visitor_limit: target.plan.visitorLimit,
      storage_limit_mb: target.plan.storageLimitMb,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', ctx.userId);
  await saveAddonPriceUpdates(db, addonPriceUpdates);

  const invoice = updated.latest_invoice && typeof updated.latest_invoice === 'object'
    ? updated.latest_invoice
    : null;
  const updatedPlanItem = updated.items.data.find((item) => item.price?.id === target.priceId) ?? null;

  return NextResponse.json({
    success: true,
    direction: 'upgrade',
    planName: target.plan.name,
    interval: target.interval,
    status: updated.status,
    nextRenewalAt: updatedPlanItem ? toIso(periodEndSeconds(updated, updatedPlanItem)) : null,
    invoice: invoice
      ? {
          status: invoice.status,
          paid: invoice.status === 'paid',
          amountPaidCents: invoice.amount_paid ?? 0,
          amountDueCents: invoice.amount_due ?? 0,
          currency: invoice.currency ?? 'cad',
          hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
        }
      : null,
  });
}

async function scheduleDowngrade(ctx: PlanContext, target: PriceTarget) {
  const periodEnd = periodEndSeconds(ctx.subscription, ctx.planItem);
  if (!periodEnd) {
    return fail(409, 'no_period_end', 'Could not determine when your current billing period ends.');
  }

  // Add-ons follow the plan onto the new cycle when it changes too. Phase items
  // take prices, so map each add-on item to the price it should carry.
  const addonPrices = new Map<string, string>();
  if (target.interval !== ctx.currentInterval) {
    const productId = typeof ctx.planItem.price?.product === 'string' ? ctx.planItem.price.product : null;
    const addonUpdates = await buildAddonIntervalUpdates({
      stripe: ctx.stripe,
      subscription: ctx.subscription,
      addons: ctx.addons,
      productId,
      interval: target.interval,
      mode: 'apply',
    });
    for (const item of addonUpdates.items) {
      if (item.id && item.price) addonPrices.set(item.id, item.price);
    }
    if (addonUpdates.skippedAddons > 0) {
      console.warn(
        `[plan-change] ${addonUpdates.skippedAddons} add-on item(s) for user ${ctx.userId} keep their current cycle after the downgrade`,
      );
    }
  }

  const nextPhaseItems = buildDowngradePhaseItems(
    ctx.subscription,
    ctx.planItem,
    target,
    (item) => addonPrices.get(item.id) ?? null,
  );

  // Reuse our own pending downgrade (the customer may be changing which Basic
  // cycle they want), otherwise attach a fresh schedule to the subscription.
  const createdSchedule = !ctx.schedule;
  const schedule =
    ctx.schedule ?? (await ctx.stripe.subscriptionSchedules.create({ from_subscription: ctx.subscription.id }));

  try {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const currentPhase =
      schedule.phases.find((phase) => phase.start_date <= nowSeconds && (phase.end_date ?? Infinity) > nowSeconds) ??
      schedule.phases[0];

    const thisPhase = phaseToUpdateParams(currentPhase);
    // Run the current plan right up to the end of the period the customer paid for.
    thisPhase.end_date = periodEnd;

    const nextPhase: Stripe.SubscriptionScheduleUpdateParams.Phase = {
      items: nextPhaseItems,
      duration: { interval: target.interval, interval_count: 1 },
      proration_behavior: 'none',
      metadata: { [PLAN_CHANGE_SCHEDULE_KEY]: PLAN_CHANGE_SCHEDULE_DOWNGRADE },
    };
    if (thisPhase.automatic_tax) nextPhase.automatic_tax = thisPhase.automatic_tax;
    if (thisPhase.discounts) nextPhase.discounts = thisPhase.discounts;
    if (thisPhase.default_payment_method) nextPhase.default_payment_method = thisPhase.default_payment_method;

    await ctx.stripe.subscriptionSchedules.update(schedule.id, {
      // Hand the subscription back once the schedule is done. The webhook also
      // releases it as soon as the downgrade phase starts.
      end_behavior: 'release',
      proration_behavior: 'none',
      metadata: {
        [PLAN_CHANGE_SCHEDULE_KEY]: PLAN_CHANGE_SCHEDULE_DOWNGRADE,
        target_price: target.priceId,
        user_id: ctx.userId,
      },
      phases: [thisPhase, nextPhase],
    });
  } catch (err) {
    // Don't leave a half-configured schedule attached to the subscription.
    if (createdSchedule) {
      try {
        await ctx.stripe.subscriptionSchedules.release(schedule.id);
      } catch (releaseErr) {
        console.error(`[plan-change] could not release schedule ${schedule.id} after failure:`, releaseErr);
      }
    }
    throw err;
  }

  return NextResponse.json({
    success: true,
    direction: 'downgrade',
    planName: target.plan.name,
    interval: target.interval,
    effectiveAt: toIso(periodEnd),
  });
}

// ── DELETE ──────────────────────────────────────────────────────────────────

export async function DELETE() {
  try {
    const ctx = await loadContext();
    if (ctx instanceof NextResponse) return ctx;

    if (!ctx.schedule || !isKeystoneDowngradeSchedule(ctx.schedule)) {
      return fail(404, 'nothing_scheduled', 'There is no scheduled plan change to cancel.');
    }
    if (downgradeScheduleHasTakenEffect(ctx.schedule)) {
      return fail(409, 'already_applied', 'This plan change has already taken effect.');
    }

    // Releasing leaves the subscription exactly as it is now — on the current plan.
    await ctx.stripe.subscriptionSchedules.release(ctx.schedule.id);

    return NextResponse.json({ success: true, planName: ctx.plan.name });
  } catch (error) {
    console.error('[plan-change] DELETE failed:', error);
    return fail(500, 'server_error', errorMessage(error, 'Failed to cancel the scheduled change'));
  }
}
