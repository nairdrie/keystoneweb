import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { createOrder, getSitePaypalCreds, type PaypalItem } from '@/lib/paypal';

/**
 * POST /api/paypal/create-order
 *
 * Creates a PayPal Order with the site owner's own PayPal credentials, so funds
 * settle directly to their account (owner = merchant of record). Mirrors the
 * Stripe checkout flow in app/api/stripe/checkout/route.ts.
 *
 * Called from the Smart Buttons `createOrder` callback. Returns the PayPal
 * order id so the JS SDK can hand it off to PayPal's popup.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }

    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const creds = await getSitePaypalCreds(order.site_id);
    if (!creds) {
      return NextResponse.json(
        { error: 'This site has not connected PayPal yet' },
        { status: 400 }
      );
    }

    const currency = (order.items?.[0]?.currency || 'USD').toUpperCase();

    const items: PaypalItem[] = (order.items || []).map((item: any) => {
      const variantStr = item.variants
        ? Object.values(item.variants).join(' / ')
        : '';
      const optionStr = item.options
        ? Object.values(item.options).join(' / ')
        : '';
      const suffix = [variantStr, optionStr].filter(Boolean).join(' · ');
      return {
        name: `${item.name}${suffix ? ` (${suffix})` : ''}`.slice(0, 127),
        quantity: String(item.qty),
        unit_amount: {
          currency_code: currency,
          value: (item.price_cents / 100).toFixed(2),
        },
        ...(item.productId ? { sku: String(item.productId).slice(0, 127) } : {}),
      };
    });

    const pp = await createOrder(creds, {
      currency,
      items,
      shippingCents: order.shipping_cents || 0,
      taxCents: order.tax_cents || 0,
      customId: order.id,
      description: `Order ${order.id.slice(0, 8).toUpperCase()}`,
      customerEmail: order.customer_email || undefined,
      metadata: {
        orderId: order.id,
        siteId: order.site_id,
        type: 'ecommerce_order',
      },
    });

    await supabase
      .from('orders')
      .update({
        paypal_order_id: pp.id,
        payment_method: 'paypal',
      })
      .eq('id', order.id);

    return NextResponse.json({ paypalOrderId: pp.id, status: pp.status });
  } catch (error: any) {
    console.error('PayPal create-order error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create PayPal order' },
      { status: 500 }
    );
  }
}
