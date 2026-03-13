import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import Stripe from 'stripe';

const getStripeClient = () => {
    if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('STRIPE_SECRET_KEY is not set');
    }
    return new Stripe(process.env.STRIPE_SECRET_KEY);
};

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        // 1. Verify user is authenticated
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Fetch the user's Stripe Customer ID from their subscription record
        const { data: subscription, error: subError } = await supabase
            .from('user_subscriptions')
            .select('stripe_customer_id')
            .eq('user_id', user.id)
            .single();

        if (subError || !subscription?.stripe_customer_id) {
            return NextResponse.json(
                { error: 'No active subscription found. You must have a Stripe customer record to access the billing portal.' },
                { status: 404 }
            );
        }

        // 3. Create a Stripe Customer Portal Session
        const stripe = getStripeClient();

        // This is the URL the user will be redirected to after they exit the portal
        const returnUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/settings`;

        const portalSession = await stripe.billingPortal.sessions.create({
            customer: subscription.stripe_customer_id,
            return_url: returnUrl,
        });

        // 4. Return the portal URL
        return NextResponse.json({ url: portalSession.url });

    } catch (error: any) {
        console.error('Error generating Stripe Customer Portal session:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error while generating billing portal link' },
            { status: 500 }
        );
    }
}
