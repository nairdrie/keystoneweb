import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-02-25.clover' as any,
});

/**
 * POST /api/bookings/stripe-checkout
 *
 * Creates a Stripe Checkout session (payment mode, one-time) using the
 * site owner's connected Express account. The customer is redirected to
 * Stripe to pay; on success the booking is created via success_url callback.
 *
 * Body: {
 *   siteId, serviceId, optionId?, selectedOptionName?, selectedOptionPrice?,
 *   date, startTime,
 *   customerName, customerEmail, customerPhone?, notes?
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        const body = await request.json();
        const {
            siteId,
            serviceId,
            optionId,
            selectedOptionName,
            selectedPriceCents,
            date,
            startTime,
            customerName,
            customerEmail,
            customerPhone,
            notes,
        } = body;

        if (!siteId || !serviceId || !date || !startTime || !customerName || !customerEmail) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Get site + connected Stripe account
        const { data: site } = await supabase
            .from('sites')
            .select('stripe_account_id, site_slug, published_domain')
            .eq('id', siteId)
            .single();

        if (!site?.stripe_account_id) {
            return NextResponse.json(
                { error: 'Stripe is not connected for this site' },
                { status: 400 }
            );
        }

        // Get service details
        const { data: service } = await supabase
            .from('booking_services')
            .select('*')
            .eq('id', serviceId)
            .eq('is_active', true)
            .single();

        if (!service) {
            return NextResponse.json({ error: 'Service not found' }, { status: 404 });
        }

        // Determine price: use selected option price, or service base price
        const priceCents = selectedPriceCents ?? service.price_cents;
        const itemName = selectedOptionName
            ? `${service.name} — ${selectedOptionName}`
            : service.name;

        if (!priceCents || priceCents <= 0) {
            return NextResponse.json(
                { error: 'Cannot create Stripe checkout for a free service' },
                { status: 400 }
            );
        }

        // Base URL for success/cancel redirects
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        // Encode booking details for the success callback
        const bookingParams = new URLSearchParams({
            siteId,
            serviceId,
            date,
            startTime,
            customerName,
            customerEmail,
            ...(customerPhone ? { customerPhone } : {}),
            ...(notes ? { notes } : {}),
            ...(optionId ? { optionId } : {}),
            ...(selectedOptionName ? { selectedOptionName } : {}),
            paymentMethod: 'stripe',
        });

        const session = await stripe.checkout.sessions.create(
            {
                payment_method_types: ['card'],
                line_items: [
                    {
                        price_data: {
                            currency: (service.currency || 'cad').toLowerCase(),
                            product_data: {
                                name: itemName,
                                description: service.description || undefined,
                            },
                            unit_amount: priceCents,
                        },
                        quantity: 1,
                    },
                ],
                mode: 'payment',
                success_url: `${appUrl}/api/bookings/stripe-success?session_id={CHECKOUT_SESSION_ID}&${bookingParams.toString()}`,
                cancel_url: request.headers.get('referer') || appUrl,
                customer_email: customerEmail,
                metadata: {
                    siteId,
                    serviceId,
                    date,
                    startTime,
                    customerName,
                    customerEmail,
                    optionId: optionId || '',
                    selectedOptionName: selectedOptionName || '',
                },
            },
            {
                stripeAccount: site.stripe_account_id,
            }
        );

        return NextResponse.json({ url: session.url });
    } catch (error: any) {
        console.error('Booking Stripe checkout error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to create checkout session' },
            { status: 500 }
        );
    }
}
