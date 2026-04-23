import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import {
  recordPaypalTransaction,
  verifyWebhookSignature,
} from '@/lib/paypal';

/**
 * POST /api/paypal/webhook
 *
 * Reconciliation safety net. The primary paid-state transition happens in
 * `/api/paypal/capture-order` synchronously from the buyer's browser; the
 * webhook only matters if the client never returned (tab closed mid-capture),
 * or for post-capture events like refunds and onboarding revocations.
 *
 * Idempotency: upsert into paypal_transactions keyed on event id.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const authAlgo = request.headers.get('paypal-auth-algo') || '';
  const certUrl = request.headers.get('paypal-cert-url') || '';
  const transmissionId = request.headers.get('paypal-transmission-id') || '';
  const transmissionSig = request.headers.get('paypal-transmission-sig') || '';
  const transmissionTime =
    request.headers.get('paypal-transmission-time') || '';

  const verified = await verifyWebhookSignature({
    authAlgo,
    certUrl,
    transmissionId,
    transmissionSig,
    transmissionTime,
    rawBody,
  });

  if (!verified) {
    console.error('PayPal webhook signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const eventType: string = event?.event_type || '';
  const eventId: string = event?.id || '';
  const resource = event?.resource || {};

  if (!eventId) {
    return NextResponse.json({ error: 'Missing event id' }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    switch (eventType) {
      case 'PAYMENT.CAPTURE.COMPLETED': {
        const captureId: string = resource.id;
        const amountCents = resource.amount?.value
          ? Math.round(parseFloat(resource.amount.value) * 100)
          : 0;
        const currency: string = (
          resource.amount?.currency_code || 'usd'
        ).toLowerCase();
        const customId: string = resource.custom_id || '';
        const merchantId: string =
          resource.payee?.merchant_id ||
          resource.supplementary_data?.related_ids?.merchant_id ||
          '';

        // Find the matching order row by custom_id (we set it to order.id).
        const { data: order } = await admin
          .from('orders')
          .select('id, site_id, payment_status, sites!inner(user_id)')
          .eq('id', customId)
          .maybeSingle();

        if (order && order.payment_status !== 'paid') {
          await admin
            .from('orders')
            .update({
              status: 'confirmed',
              payment_status: 'paid',
              payment_method: 'paypal',
              paypal_capture_id: captureId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', order.id);
        }

        // Also try bookings (bookings store custom_id = booking.id once created,
        // but for booking captures we create the booking row in the route, not here).
        await admin
          .from('bookings')
          .update({
            payment_status: 'paid',
            paypal_capture_id: captureId,
          })
          .eq('id', customId)
          .is('paypal_capture_id', null);

        await recordPaypalTransaction({
          paypal_event_id: eventId,
          paypal_merchant_id: merchantId || null,
          paypal_order_id:
            resource.supplementary_data?.related_ids?.order_id || null,
          paypal_capture_id: captureId,
          site_id: order?.site_id || null,
          user_id: (order?.sites as any)?.user_id || null,
          event_type: eventType,
          transaction_type: 'ecommerce_order',
          description: `Capture ${captureId}`,
          amount_cents: amountCents,
          currency,
          status: 'succeeded',
          metadata: { customId },
        });
        break;
      }

      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.DECLINED': {
        const captureId: string = resource.id;
        const amountCents = resource.amount?.value
          ? Math.round(parseFloat(resource.amount.value) * 100)
          : 0;
        const currency: string = (
          resource.amount?.currency_code || 'usd'
        ).toLowerCase();
        await recordPaypalTransaction({
          paypal_event_id: eventId,
          paypal_capture_id: captureId,
          event_type: eventType,
          transaction_type: 'ecommerce_order',
          description: `Capture denied ${captureId}`,
          amount_cents: amountCents,
          currency,
          status: 'failed',
        });
        break;
      }

      case 'PAYMENT.CAPTURE.REFUNDED':
      case 'PAYMENT.CAPTURE.REVERSED': {
        const captureId: string =
          resource.links?.find((l: any) => l.rel === 'up')?.href?.split('/').pop() ||
          '';
        const amountCents = resource.amount?.value
          ? Math.round(parseFloat(resource.amount.value) * 100)
          : 0;
        const currency: string = (
          resource.amount?.currency_code || 'usd'
        ).toLowerCase();
        await recordPaypalTransaction({
          paypal_event_id: eventId,
          paypal_capture_id: captureId || null,
          event_type: eventType,
          transaction_type: 'refund',
          description: `Refund ${resource.id}`,
          amount_cents: amountCents,
          currency,
          status: 'refunded',
        });
        break;
      }

      case 'MERCHANT.ONBOARDING.COMPLETED': {
        const merchantId: string = resource.merchant_id;
        const trackingId: string = resource.tracking_id || '';
        if (trackingId) {
          await admin
            .from('sites')
            .update({
              paypal_merchant_id: merchantId,
              paypal_onboarding_status: 'active',
              paypal_permissions_granted: true,
              paypal_email_confirmed: true,
            })
            .eq('id', trackingId);
        }
        await recordPaypalTransaction({
          paypal_event_id: eventId,
          paypal_merchant_id: merchantId,
          site_id: trackingId || null,
          event_type: eventType,
          transaction_type: 'onboarding',
          description: 'Merchant onboarding completed',
          amount_cents: 0,
          currency: 'usd',
          status: 'succeeded',
        });
        break;
      }

      case 'MERCHANT.PARTNER-CONSENT.REVOKED': {
        const merchantId: string = resource.merchant_id;
        await admin
          .from('sites')
          .update({
            paypal_onboarding_status: 'limited',
            paypal_permissions_granted: false,
          })
          .eq('paypal_merchant_id', merchantId);

        await recordPaypalTransaction({
          paypal_event_id: eventId,
          paypal_merchant_id: merchantId,
          event_type: eventType,
          transaction_type: 'onboarding',
          description: 'Merchant consent revoked',
          amount_cents: 0,
          currency: 'usd',
          status: 'failed',
        });
        break;
      }

      default:
        // Record unhandled events for audit, but don't fail.
        await recordPaypalTransaction({
          paypal_event_id: eventId,
          event_type: eventType,
          transaction_type: 'other',
          description: eventType,
          amount_cents: 0,
          currency: 'usd',
          status: 'pending',
          metadata: { summary: event.summary || null },
        });
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('PayPal webhook handler error:', err);
    return NextResponse.json(
      { error: err.message || 'Webhook handler failure' },
      { status: 500 }
    );
  }
}
