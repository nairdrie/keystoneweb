import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-02-25.clover' as any,
});

/**
 * POST /api/stripe/checkout
 * 
 * Creates a Stripe Checkout Session for a given order, routing funds via
 * destination charges to the connected Stripe account (business owner).
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const body = await request.json();
        const { orderId, successUrl, cancelUrl } = body;

        if (!orderId || !successUrl || !cancelUrl) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        // Fetch the order
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('*, sites!inner(stripe_account_id)')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const stripeAccountId = order.sites?.stripe_account_id;
        if (!stripeAccountId) {
            return NextResponse.json({ error: 'This site is not fully connected to Stripe yet' }, { status: 400 });
        }

        // Build line items
        const lineItems = order.items.map((item: any) => {
            const variantStr = item.variants ? Object.values(item.variants).join(' / ') : '';
            return {
                price_data: {
                    currency: item.currency || 'cad',
                    product_data: {
                        name: `${item.name}${variantStr ? ` (${variantStr})` : ''}`,
                        images: item.image ? [item.image] : [],
                    },
                    unit_amount: item.price_cents,
                },
                quantity: item.qty,
            }
        });

        // 0% platform fee - everything goes to the connected account (minus Stripe fees)
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: successUrl,
            cancel_url: cancelUrl,
            customer_email: order.customer_email || undefined,
            metadata: {
                orderId: order.id,
                siteId: order.site_id,
                type: 'ecommerce_order'
            },
            payment_intent_data: {
                transfer_data: {
                    destination: stripeAccountId,
                },
            },
        });

        // Optionally, save the checkout session ID in DB
        await supabase
            .from('orders')
            .update({ stripe_payment_id: session.id })
            .eq('id', order.id);

        return NextResponse.json({ url: session.url });

    } catch (error: any) {
        console.error('Stripe checkout error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to create Checkout session' },
            { status: 500 }
        );
    }
}
