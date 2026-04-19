import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-02-25.clover' as any,
});

/**
 * GET /api/vendors/connect?vendorId=... — Check vendor Stripe connection status
 * POST /api/vendors/connect — Generate onboarding link for a vendor's Stripe account
 */

export async function GET(request: NextRequest) {
    try {
        const vendorId = request.nextUrl.searchParams.get('vendorId');
        if (!vendorId) {
            return NextResponse.json({ error: 'Missing vendorId' }, { status: 400 });
        }

        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: vendor } = await supabase
            .from('vendors')
            .select('stripe_account_id, site_id')
            .eq('id', vendorId)
            .single();

        if (!vendor) {
            return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
        }

        // Verify site ownership
        const { data: site } = await supabase
            .from('sites')
            .select('user_id')
            .eq('id', vendor.site_id)
            .single();

        if (!site || site.user_id !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        return NextResponse.json({
            connected: !!vendor.stripe_account_id,
            stripeAccountId: vendor.stripe_account_id || null,
        });
    } catch (error: any) {
        console.error('Vendor connect GET error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { vendorId, returnUrl } = body;

        if (!vendorId || !returnUrl) {
            return NextResponse.json({ error: 'Missing vendorId or returnUrl' }, { status: 400 });
        }

        const { data: vendor } = await supabase
            .from('vendors')
            .select('*')
            .eq('id', vendorId)
            .single();

        if (!vendor) {
            return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
        }

        // Verify site ownership
        const { data: site } = await supabase
            .from('sites')
            .select('user_id')
            .eq('id', vendor.site_id)
            .single();

        if (!site || site.user_id !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        let stripeAccountId = vendor.stripe_account_id;

        // Create a new connected account if it doesn't exist
        if (!stripeAccountId) {
            const account = await stripe.accounts.create({
                type: 'express',
                country: 'US',
                email: vendor.contact_email,
                capabilities: {
                    card_payments: { requested: true },
                    transfers: { requested: true },
                },
                business_type: 'company',
                metadata: {
                    vendorId: vendor.id,
                    siteId: vendor.site_id,
                },
            });

            stripeAccountId = account.id;

            await supabase
                .from('vendors')
                .update({ stripe_account_id: stripeAccountId, payment_mode: 'stripe' })
                .eq('id', vendorId);
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
        console.error('Vendor Stripe connect error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to create Connect session' },
            { status: 500 }
        );
    }
}
