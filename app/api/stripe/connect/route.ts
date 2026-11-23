import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import Stripe from 'stripe';
import {
    ensureConnectAccount,
    getConnectStatus,
    isConnectCountry,
    publicBusinessProfile,
    resolveConnectCountry,
} from '@/lib/payments/stripe-connect';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-02-25.clover' as any,
});

/** GET /api/stripe/connect?siteId=xxx — Check Stripe connection status */
export async function GET(request: NextRequest) {
    try {
        const siteId = request.nextUrl.searchParams.get('siteId');
        if (!siteId) {
            return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
        }

        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: site } = await supabase
            .from('sites')
            .select('stripe_account_id, business_profile')
            .eq('id', siteId)
            .eq('user_id', user.id)
            .single();

        if (!site) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const status = await getConnectStatus(stripe, site.stripe_account_id);
        return NextResponse.json({
            connected: !!site.stripe_account_id,
            // false until the owner finishes Stripe's onboarding form
            onboarded: status.onboarded,
            // the account's (fixed) country, or our best guess before one exists
            country: status.country || resolveConnectCountry(null, site.business_profile),
            stripeAccountId: site.stripe_account_id || null,
        });
    } catch (error: any) {
        console.error('Stripe connect GET error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * POST /api/stripe/connect
 *
 * Generates an onboarding link for a business owner to connect their Stripe account.
 * Creates an Express account if one doesn't exist (in the country the owner
 * picked), and replaces an unfinished one if the owner picked a different country.
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { siteId, returnUrl, country } = body;

        if (!siteId || !returnUrl) {
            return NextResponse.json({ error: 'Missing siteId or returnUrl' }, { status: 400 });
        }

        // Verify ownership
        const { data: site } = await supabase
            .from('sites')
            .select('user_id, stripe_account_id, site_slug, published_domain, custom_domain, design_data, business_profile')
            .eq('id', siteId)
            .single();

        if (!site || site.user_id !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { accountId: stripeAccountId } = await ensureConnectAccount(stripe, {
            existingAccountId: site.stripe_account_id,
            requestedCountry: isConnectCountry(country) ? country : null,
            fallbackCountry: resolveConnectCountry(null, site.business_profile),
            email: user.email,
            businessProfile: publicBusinessProfile(site),
            metadata: { siteId, userId: user.id },
        });

        if (stripeAccountId !== site.stripe_account_id) {
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
