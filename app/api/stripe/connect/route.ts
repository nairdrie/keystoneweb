import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-02-25.clover' as any,
});

/**
 * POST /api/stripe/connect
 * 
 * Generates an onboarding link for a business owner to connect their Stripe account.
 * Creates an Express account if one doesn't exist.
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { siteId, returnUrl } = body;

        if (!siteId || !returnUrl) {
            return NextResponse.json({ error: 'Missing siteId or returnUrl' }, { status: 400 });
        }

        // Verify ownership
        const { data: site } = await supabase
            .from('sites')
            .select('user_id, stripe_account_id, site_slug, published_domain')
            .eq('id', siteId)
            .single();

        if (!site || site.user_id !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        let stripeAccountId = site.stripe_account_id;

        // Create a new connected account if it doesn't exist
        if (!stripeAccountId) {
            const account = await stripe.accounts.create({
                type: 'express',
                country: 'US', // Might want to make this dynamic later
                email: user.email,
                capabilities: {
                    card_payments: { requested: true },
                    transfers: { requested: true },
                },
                business_type: 'individual',
                metadata: {
                    siteId,
                    userId: user.id
                }
            });

            stripeAccountId = account.id;

            // Save to DB
            await supabase
                .from('sites')
                .update({ stripe_account_id: stripeAccountId })
                .eq('id', siteId);
        }

        // Create an account link for onboarding
        const accountLink = await stripe.accountLinks.create({
            account: stripeAccountId,
            refresh_url: returnUrl,
            return_url: returnUrl,
            type: 'account_onboarding',
        });

        return NextResponse.json({ url: accountLink.url });
    } catch (error: any) {
        console.error('Stripe connect error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to create Connect session' },
            { status: 500 }
        );
    }
}
