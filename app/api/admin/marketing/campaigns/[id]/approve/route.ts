import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { createClient } from '@/lib/db/supabase-server';
import { computePrepayAmount, computeDurationDays } from '@/lib/marketing/campaign-budget';
import { formatCents } from '@/lib/marketing/pricing';
import { htmlToPlainText } from '@/lib/email/sanitize';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apiVersion: '2026-02-25.clover' as any,
});

/**
 * Some sites store a rich-text (TipTap) logo blob as their siteTitle. Dropping
 * that raw HTML into a Stripe line item renders a wall of <span style=…> markup.
 * Strip it to plain text and cap the length so the line item reads cleanly.
 */
function plainBusinessName(siteTitle: unknown, fallback: string | null | undefined): string {
  const raw = typeof siteTitle === 'string' ? siteTitle : '';
  const plain = htmlToPlainText(raw).replace(/\s+/g, ' ').trim();
  return (plain || fallback || 'your business').slice(0, 60);
}

/**
 * POST /api/admin/marketing/campaigns/[id]/approve
 *
 * Customer's approval. Validates the campaign and creates a durable Stripe
 * Payment Link for the prepaid amount (daily budget × duration × 1.05). The
 * link is single-use and never expires, so the operator can either pay now or
 * copy it and send it to the client to pay later.
 *
 * Returns { paymentUrl, prepayCents, durationDays }. The campaign moves to
 * 'awaiting_payment'; the UI then offers "Continue to payment" / "Copy link".
 *
 * When payment succeeds, the Stripe webhook (checkout.session.completed —
 * Payment Link metadata is copied onto the session) flips the campaign to
 * 'pending_launch' and notifies ops to set up billing + launch.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: campaign } = await supabase
    .from('marketing_campaigns')
    .select('*, sites!inner(id, user_id, marketing_enabled, site_slug, design_data)')
    .eq('id', id)
    .single();

  if (!campaign || campaign.sites.user_id !== user.id) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }
  if (!campaign.sites.marketing_enabled) {
    return NextResponse.json({ error: 'Marketing not enabled' }, { status: 403 });
  }
  if (campaign.status !== 'draft' && campaign.status !== 'suggested' && campaign.status !== 'failed' && campaign.status !== 'awaiting_payment') {
    return NextResponse.json({ error: `Cannot approve from status ${campaign.status}` }, { status: 400 });
  }
  if (!campaign.daily_budget_cents || campaign.daily_budget_cents <= 0) {
    return NextResponse.json({ error: 'Campaign has no daily budget set' }, { status: 400 });
  }

  // Duration must match exactly what the wizard quoted (exclusive end − start;
  // see computeDurationDays). If no end_date, default to 30 days.
  const startDate = campaign.start_date ? new Date(campaign.start_date) : new Date();
  const endDate = campaign.end_date ? new Date(campaign.end_date) : null;
  const durationDays = computeDurationDays(startDate, endDate);

  const prepay = computePrepayAmount({
    dailyBudgetCents: campaign.daily_budget_cents,
    durationDays,
  });

  const db = createAdminClient();

  // Note: we no longer auto-provision a Google Ads sub-account here. Payment
  // comes first; ops links/funds the customer's ad account after payment (see
  // the ops launch flow). This avoids the "manager account can't create new
  // accounts" gate on fresh MCCs.

  // Snapshot what was approved.
  await db.from('marketing_approvals').upsert({
    campaign_id: id,
    site_id: campaign.site_id,
    approved_by: user.id,
    approved_by_email: user.email || '',
    snapshot: {
      name: campaign.name,
      channel: campaign.channel,
      campaign_type: campaign.campaign_type,
      content: campaign.content,
      targeting: campaign.targeting,
      daily_budget_cents: campaign.daily_budget_cents,
      duration_days: durationDays,
      start_date: campaign.start_date,
      end_date: campaign.end_date,
      prepay_total_cents: prepay.totalCents,
    },
  }, { onConflict: 'campaign_id' });

  const { error: statusErr } = await db.from('marketing_campaigns')
    .update({
      status: 'awaiting_payment',
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (statusErr) {
    // Bail before creating the payment link — otherwise the customer could pay
    // for a campaign whose status never advances out of 'draft'.
    console.error('[approve] failed to set campaign to awaiting_payment:', statusErr);
    return NextResponse.json(
      { error: 'Could not start payment for this campaign. ' + statusErr.message },
      { status: 500 },
    );
  }

  const origin = request.nextUrl.origin;
  const businessName = plainBusinessName(
    (campaign.sites.design_data as { siteTitle?: string } | null)?.siteTitle,
    campaign.sites.site_slug,
  );
  const successUrl = `${origin}/admin/marketing/campaigns/${id}?siteId=${campaign.site_id}&paid=1`;

  // Reuse an existing, still-active payment link if we already minted one for
  // this campaign (e.g. operator re-opens the page or re-approves). This keeps a
  // single link the operator can copy, instead of orphaning previous ones.
  if (campaign.payment_link_id) {
    try {
      const existing = await stripe.paymentLinks.retrieve(campaign.payment_link_id);
      if (existing.active && existing.url) {
        if (existing.url !== campaign.payment_link_url) {
          await db.from('marketing_campaigns')
            .update({ payment_link_url: existing.url, updated_at: new Date().toISOString() })
            .eq('id', id);
        }
        return NextResponse.json({
          paymentUrl: existing.url,
          prepayCents: prepay.totalCents,
          durationDays,
        });
      }
    } catch (err) {
      // Link was deleted or unreadable — fall through and create a fresh one.
      console.warn('[approve] could not reuse existing payment link, creating new:', err);
    }
  }

  const dayWord = durationDays === 1 ? 'day' : 'days';
  const description =
    `${durationDays} ${dayWord} of Google Ads at ${formatCents(campaign.daily_budget_cents)}/day` +
    ` = ${formatCents(prepay.rawCents)} ad spend + ${formatCents(prepay.serviceFeeCents)} service fee (5%).` +
    ` Advertising for ${businessName}.`;

  try {
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{
        price_data: {
          currency: 'cad',
          product_data: {
            name: `${campaign.name} — ${durationDays} ${dayWord}`,
            description,
          },
          unit_amount: prepay.totalCents,
        },
        quantity: 1,
      }],
      // Single completed payment, then the link deactivates itself.
      restrictions: { completed_sessions: { limit: 1 } },
      after_completion: {
        type: 'redirect',
        redirect: { url: successUrl },
      },
      // Payment Link metadata is automatically copied onto the Checkout Session
      // created when the link is paid, so the existing webhook reads it as usual.
      metadata: {
        type: 'marketing_campaign_prepay',
        campaignId: id,
        siteId: campaign.site_id,
        userId: user.id,
        durationDays: String(durationDays),
      },
      payment_intent_data: {
        metadata: {
          type: 'marketing_campaign_prepay',
          campaignId: id,
          siteId: campaign.site_id,
          userId: user.id,
        },
      },
    });

    await db.from('marketing_campaigns')
      .update({
        payment_link_id: paymentLink.id,
        payment_link_url: paymentLink.url,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    await db.from('marketing_campaign_log').insert({
      campaign_id: id,
      action: 'awaiting_payment',
      actor: `user:${user.email || ''}`,
      details: {
        prepay_cents: prepay.totalCents,
        duration_days: durationDays,
        payment_link_id: paymentLink.id,
      },
    });

    return NextResponse.json({
      paymentUrl: paymentLink.url,
      prepayCents: prepay.totalCents,
      durationDays,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[approve] Stripe payment link creation failed:', err);
    return NextResponse.json({ error: 'Failed to create payment link. ' + message }, { status: 500 });
  }
}
