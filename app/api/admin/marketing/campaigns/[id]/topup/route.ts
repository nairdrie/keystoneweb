import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/db/supabase-server';
import { applyMarkup, formatCents } from '@/lib/marketing/pricing';
import { htmlToPlainText } from '@/lib/email/sanitize';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apiVersion: '2026-02-25.clover' as any,
});

const MIN_TOPUP_RAW_CENTS = 1000;        // $10 of ad spend
const MAX_TOPUP_RAW_CENTS = 1_000_000;   // $10k of ad spend

/**
 * POST /api/admin/marketing/campaigns/[id]/topup
 * Body: { rawAdSpendCents }   (how many more dollars of Google spend they want)
 *
 * Mints a durable Stripe Payment Link for the additional budget (ad spend ×
 * 1.05, plus GST/HST added on top at checkout). Like the initial-prepay
 * /approve flow, the link is single-use and never expires, so the operator can
 * pay now or copy it and send it to the client to pay later.
 *
 * Returns: { paymentUrl, totalCents }
 *
 * When the link is paid, the Stripe webhook (checkout.session.completed —
 * Payment Link metadata is copied onto the session) records the top-up against
 * the campaign's prepaid budget and resumes the campaign if it was paused for a
 * depleted budget. The budget is funded from the PRE-TAX subtotal; the GST/HST
 * portion is remitted to the CRA, not spent on ads (see the webhook handler).
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const rawAdSpendCents = Math.round(Number(body.rawAdSpendCents) || 0);
  if (rawAdSpendCents < MIN_TOPUP_RAW_CENTS || rawAdSpendCents > MAX_TOPUP_RAW_CENTS) {
    return NextResponse.json({
      error: `Top-up must be between $${MIN_TOPUP_RAW_CENTS / 100} and $${MAX_TOPUP_RAW_CENTS / 100} of ad spend`,
    }, { status: 400 });
  }

  const { data: campaign } = await supabase
    .from('marketing_campaigns')
    .select('id, name, site_id, status, daily_budget_cents, sites!inner(user_id, marketing_enabled, site_slug, design_data)')
    .eq('id', id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const site = (campaign as any)?.sites;
  if (!campaign || site?.user_id !== user.id) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }
  if (!site?.marketing_enabled) {
    return NextResponse.json({ error: 'Marketing not enabled' }, { status: 403 });
  }
  if (['cancelled', 'completed', 'failed', 'draft', 'suggested', 'awaiting_payment'].includes(campaign.status)) {
    return NextResponse.json({ error: `Cannot top up from status ${campaign.status}` }, { status: 400 });
  }

  const totalCents = applyMarkup(rawAdSpendCents);
  const origin = request.nextUrl.origin;
  // siteTitle can be a rich-text logo blob — strip to plain text so the Stripe
  // line item doesn't render raw HTML markup.
  const rawSiteTitle = (site.design_data as { siteTitle?: string } | null)?.siteTitle;
  const siteName = (htmlToPlainText(typeof rawSiteTitle === 'string' ? rawSiteTitle : '')
    .replace(/\s+/g, ' ')
    .trim()
    || site.site_slug
    || 'your site').slice(0, 60);
  const successUrl = `${origin}/admin/marketing/campaigns/${id}?siteId=${campaign.site_id}&topup=success`;

  try {
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{
        price_data: {
          currency: 'cad',
          product_data: {
            name: `${campaign.name} — additional budget`,
            description: `Adds ${formatCents(rawAdSpendCents)} of Google ad spend to ${siteName}. Includes 5% service fee.`,
            // Website advertising — standard-rated for GST/HST in Canada.
            tax_code: 'txcd_10701000',
          },
          unit_amount: totalCents,
          // Our amount is pre-tax (ad spend + fee); Stripe Tax adds GST/HST on top.
          tax_behavior: 'exclusive',
        },
        quantity: 1,
      }],
      // Add GST/HST automatically from the payer's billing address. Requires
      // Stripe Tax to be enabled with your registrations in the Stripe dashboard;
      // until then Stripe simply adds $0 tax.
      automatic_tax: { enabled: true },
      billing_address_collection: 'required',
      // Single completed payment, then the link deactivates itself.
      restrictions: { completed_sessions: { limit: 1 } },
      after_completion: {
        type: 'redirect',
        redirect: { url: successUrl },
      },
      // Payment Link metadata is automatically copied onto the Checkout Session
      // created when the link is paid, so the existing webhook reads it as usual.
      metadata: {
        type: 'marketing_campaign_topup',
        campaignId: id,
        siteId: campaign.site_id,
        userId: user.id,
      },
      payment_intent_data: {
        metadata: {
          type: 'marketing_campaign_topup',
          campaignId: id,
          siteId: campaign.site_id,
          userId: user.id,
        },
      },
    });

    return NextResponse.json({ paymentUrl: paymentLink.url, totalCents });
  } catch (err) {
    console.error('[marketing/topup] Stripe error:', err);
    return NextResponse.json({ error: 'Failed to create payment link' }, { status: 500 });
  }
}
