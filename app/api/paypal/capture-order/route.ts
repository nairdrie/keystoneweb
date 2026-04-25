import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import {
  captureOrder,
  isPaypalConfigured,
  recordPaypalTransaction,
} from '@/lib/paypal';
import { sendOrderConfirmation, sendOrderNotification } from '@/lib/email';

/**
 * POST /api/paypal/capture-order
 *
 * Called from the Smart Buttons `onApprove` callback after the buyer
 * authorizes the payment in the PayPal popup. Captures the PayPal order,
 * flips our local order to paid/confirmed, and fires the same confirmation
 * emails as the Stripe webhook does for ecommerce_order events.
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
    const { orderId, paypalOrderId } = await request.json();

    if (!orderId || !paypalOrderId) {
      return NextResponse.json(
        { error: 'Missing orderId or paypalOrderId' },
        { status: 400 }
      );
    }

    const { data: order, error } = await supabase
      .from('orders')
      .select(
        '*, sites!inner(paypal_merchant_id, id, title, site_slug, user_id)'
      )
      .eq('id', orderId)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Guard: PayPal order id must match what we stored at create-order time.
    if (order.paypal_order_id && order.paypal_order_id !== paypalOrderId) {
      return NextResponse.json(
        { error: 'PayPal order mismatch' },
        { status: 400 }
      );
    }

    const merchantId = order.sites?.paypal_merchant_id;
    if (!merchantId) {
      return NextResponse.json(
        { error: 'Site is not connected to PayPal' },
        { status: 400 }
      );
    }

    // Idempotency: if the webhook already marked this paid, just return OK.
    if (order.payment_status === 'paid') {
      return NextResponse.json({
        success: true,
        status: 'already_paid',
        captureId: order.paypal_capture_id,
      });
    }

    const capture = await captureOrder(paypalOrderId, merchantId);

    const isCompleted =
      capture.status === 'COMPLETED' || capture.status === 'APPROVED';

    const admin = createAdminClient();

    if (!isCompleted) {
      return NextResponse.json({
        success: false,
        status: capture.status,
      });
    }

    const { data: updated } = await admin
      .from('orders')
      .update({
        status: 'confirmed',
        payment_status: 'paid',
        payment_method: 'paypal',
        paypal_order_id: paypalOrderId,
        paypal_capture_id: capture.captureId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .select()
      .single();

    // Confirmation emails (fire-and-forget, matches Stripe webhook behaviour)
    const siteName = order.sites?.title || order.sites?.site_slug || undefined;

    const { data: ecomSettings } = await supabase
      .from('ecommerce_settings')
      .select('notification_email')
      .eq('site_id', order.site_id)
      .single();

    const emailData = {
      orderId: order.id,
      items: order.items,
      subtotalCents: order.subtotal_cents,
      currency: order.items?.[0]?.currency || 'USD',
      customerName: order.customer_name,
      customerEmail: order.customer_email,
      customerPhone: order.customer_phone,
      shippingAddress: order.shipping_address,
      paymentMethod: 'paypal',
      siteName,
    };

    sendOrderConfirmation(emailData as any).catch((err) =>
      console.error('PayPal customer email failed:', err)
    );

    if (ecomSettings?.notification_email) {
      sendOrderNotification(emailData as any, ecomSettings.notification_email).catch(
        (err) => console.error('PayPal owner email failed:', err)
      );
    }

    // Log a transaction row (idempotent via paypal_event_id); use the
    // capture id as the synthetic event id so the webhook's later
    // PAYMENT.CAPTURE.COMPLETED doesn't double-insert.
    if (capture.captureId) {
      await recordPaypalTransaction({
        paypal_event_id: `capture:${capture.captureId}`,
        paypal_merchant_id: merchantId,
        paypal_order_id: paypalOrderId,
        paypal_capture_id: capture.captureId,
        site_id: order.site_id,
        user_id: order.sites?.user_id || null,
        event_type: 'capture.synchronous',
        transaction_type: 'ecommerce_order',
        description: `Order ${order.id}`,
        amount_cents: capture.amountCents,
        currency: capture.currency.toLowerCase(),
        status: 'succeeded',
        metadata: { orderId: order.id, siteId: order.site_id },
      });
    }

    return NextResponse.json({
      success: true,
      status: capture.status,
      captureId: capture.captureId,
      order: updated,
    });
  } catch (error: any) {
    console.error('PayPal capture-order error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to capture PayPal order' },
      { status: 500 }
    );
  }
}
