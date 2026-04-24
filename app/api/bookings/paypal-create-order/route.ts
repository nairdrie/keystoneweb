import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import {
  createOrder,
  isPaypalConfigured,
  type PaypalItem,
} from '@/lib/paypal';

/**
 * POST /api/bookings/paypal-create-order
 *
 * Creates a PayPal Order for a booking service purchase. Funds settle
 * directly to the site owner's PayPal account via payee.merchant_id.
 *
 * Mirrors the role of /api/bookings/stripe-checkout. The customer-facing
 * flow here is a popup-based Smart Buttons capture — no redirect required.
 * Unlike the Stripe path, we do NOT create the booking row yet; that happens
 * after a successful capture in paypal-capture-order so we never create an
 * unpaid/abandoned booking.
 *
 * Body: { siteId, serviceId, optionId?, selectedOptionName?, selectedPriceCents?,
 *         date, startTime, customerName, customerEmail, customerPhone?, notes? }
 */
export async function POST(request: NextRequest) {
  try {
    if (!isPaypalConfigured()) {
      return NextResponse.json(
        { error: 'PayPal is not configured on this platform' },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    const body = await request.json();
    const {
      siteId,
      serviceId,
      selectedOptionName,
      selectedPriceCents,
      date,
      startTime,
      customerName,
      customerEmail,
    } = body;

    if (
      !siteId ||
      !serviceId ||
      !date ||
      !startTime ||
      !customerName ||
      !customerEmail
    ) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const { data: site } = await createAdminClient()
      .from('sites')
      .select('paypal_merchant_id, paypal_onboarding_status')
      .eq('id', siteId)
      .single();

    if (
      !site?.paypal_merchant_id ||
      site.paypal_onboarding_status !== 'active'
    ) {
      return NextResponse.json(
        { error: 'PayPal is not connected for this site' },
        { status: 400 }
      );
    }

    const { data: service } = await supabase
      .from('booking_services')
      .select('*')
      .eq('id', serviceId)
      .eq('is_active', true)
      .single();

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    const priceCents = selectedPriceCents ?? service.price_cents;
    if (!priceCents || priceCents <= 0) {
      return NextResponse.json(
        { error: 'Cannot create PayPal checkout for a free service' },
        { status: 400 }
      );
    }

    const itemName = selectedOptionName
      ? `${service.name} — ${selectedOptionName}`
      : service.name;

    const currency = (service.currency || 'USD').toUpperCase();

    const items: PaypalItem[] = [
      {
        name: itemName.slice(0, 127),
        quantity: '1',
        unit_amount: {
          currency_code: currency,
          value: (priceCents / 100).toFixed(2),
        },
        description: service.description?.slice(0, 127) || undefined,
      },
    ];

    // The booking row doesn't exist yet; use a stable synthetic custom_id so
    // we can look this pending booking up on capture. We pass back the fields
    // required to create the booking in capture-order as URL-encoded state,
    // but we also stash them in pending_paypal_bookings if present.
    const pendingId = `pending_${siteId}_${Date.now()}`;

    const pp = await createOrder({
      merchantId: site.paypal_merchant_id,
      currency,
      items,
      customId: pendingId,
      description: `${itemName} on ${date} at ${startTime}`,
      customerEmail,
    });

    return NextResponse.json({
      paypalOrderId: pp.id,
      status: pp.status,
      pendingId,
    });
  } catch (error: any) {
    console.error('Booking PayPal create-order error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create PayPal order' },
      { status: 500 }
    );
  }
}
