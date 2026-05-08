import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import {
  captureOrder,
  isPaypalConfigured,
  recordPaypalTransaction,
} from '@/lib/paypal';
import { sendCustomerConfirmation, sendOwnerNotification } from '@/lib/email';

/**
 * POST /api/bookings/paypal-capture-order
 *
 * Called from the Smart Buttons `onApprove` callback for a booking flow.
 * Captures the PayPal order, creates the confirmed booking row (matching
 * what app/api/bookings/stripe-success does for Stripe), and fires the
 * customer/owner notification emails.
 *
 * Body: { paypalOrderId, siteId, serviceId, optionId?, selectedOptionName?,
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
      paypalOrderId,
      siteId,
      serviceId,
      selectedOptionName,
      date,
      startTime,
      customerName,
      customerEmail,
      customerPhone,
      notes,
    } = body;

    if (
      !paypalOrderId ||
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

    const admin = createAdminClient();

    const { data: site } = await admin
      .from('sites')
      .select('paypal_merchant_id, site_slug, published_domain, user_id, design_data')
      .eq('id', siteId)
      .single();

    if (!site?.paypal_merchant_id) {
      return NextResponse.json(
        { error: 'Site is not connected to PayPal' },
        { status: 400 }
      );
    }

    const { data: service } = await supabase
      .from('booking_services')
      .select('*')
      .eq('id', serviceId)
      .single();

    if (!service) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      );
    }

    // Race-free slot check before capturing money.
    const [h, m] = startTime.split(':').map(Number);
    const startMinutes = h * 60 + m;
    const endMinutes = startMinutes + service.duration_minutes;
    const endTime = `${Math.floor(endMinutes / 60)
      .toString()
      .padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;

    const { data: settings } = await supabase
      .from('booking_settings')
      .select('*')
      .eq('site_id', siteId)
      .single();

    const bufferMinutes = settings?.buffer_minutes ?? 15;
    const { data: conflictCheck } = await supabase
      .from('bookings')
      .select('start_time, end_time')
      .eq('site_id', siteId)
      .eq('booking_date', date)
      .in('status', ['pending', 'confirmed']);

    const timeConflict = (conflictCheck || []).some((b: any) => {
      const toMin = (t: string) => {
        const [bh, bm] = t.split(':').map(Number);
        return bh * 60 + bm;
      };
      const bStartMin = toMin(b.start_time);
      const bEndMin = toMin(b.end_time);
      return (
        startMinutes < bEndMin + bufferMinutes &&
        endMinutes + bufferMinutes > bStartMin
      );
    });

    if (timeConflict) {
      return NextResponse.json(
        { error: 'That time slot is no longer available.' },
        { status: 409 }
      );
    }

    const capture = await captureOrder(paypalOrderId, site.paypal_merchant_id);

    const isCompleted =
      capture.status === 'COMPLETED' || capture.status === 'APPROVED';
    if (!isCompleted) {
      return NextResponse.json(
        { error: `PayPal capture returned status ${capture.status}` },
        { status: 400 }
      );
    }

    const { data: booking, error: bookError } = await admin
      .from('bookings')
      .insert({
        site_id: siteId,
        service_id: serviceId,
        booking_date: date,
        start_time: startTime,
        end_time: endTime,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone || null,
        status: 'confirmed',
        payment_method: 'paypal',
        payment_status: 'paid',
        paypal_order_id: paypalOrderId,
        paypal_capture_id: capture.captureId,
        notes: notes || null,
        selected_option_name: selectedOptionName || null,
        total_price_cents: capture.amountCents || service.price_cents,
      })
      .select()
      .single();

    if (bookError || !booking) {
      console.error('Booking insert after PayPal capture failed:', bookError);
      return NextResponse.json(
        { error: 'Payment captured but booking could not be created' },
        { status: 500 }
      );
    }

    // Log a synchronous transaction so the later webhook can dedupe.
    if (capture.captureId) {
      await recordPaypalTransaction({
        paypal_event_id: `capture:${capture.captureId}`,
        paypal_merchant_id: site.paypal_merchant_id,
        paypal_order_id: paypalOrderId,
        paypal_capture_id: capture.captureId,
        site_id: siteId,
        user_id: site.user_id || null,
        event_type: 'capture.synchronous',
        transaction_type: 'booking',
        description: `Booking ${booking.id}`,
        amount_cents: capture.amountCents,
        currency: capture.currency.toLowerCase(),
        status: 'succeeded',
        metadata: { bookingId: booking.id, siteId },
      });
    }

    // Fire confirmation emails (matches Stripe success path).
    const formatTime = (t: string) => {
      const [hh, mm] = t.split(':').map(Number);
      const period = hh >= 12 ? 'PM' : 'AM';
      const displayHour = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
      return `${displayHour}:${mm.toString().padStart(2, '0')} ${period}`;
    };

    const ppBookingLogoUrl: string | undefined = (site?.design_data as any)?.headerLogo || (site?.design_data as any)?.siteLogo || undefined;
    const { data: ppBookingCustomRows } = await admin
      .from('email_customizations')
      .select('email_key, overrides')
      .eq('site_id', siteId)
      .eq('email_key', 'booking_confirmed');
    const ppBookingOverrides = ppBookingCustomRows?.[0]?.overrides;

    const emailData = {
      serviceName: service.name,
      selectedOptionName: selectedOptionName || undefined,
      date,
      startTime: formatTime(startTime),
      duration: service.duration_minutes,
      priceCents: capture.amountCents || service.price_cents,
      currency: service.currency,
      customerName,
      customerEmail,
      customerPhone,
      notes,
      bookingId: booking.id,
      paymentMethod: 'paypal' as const,
      etransferEmail: undefined,
      confirmationMessage: settings?.confirmation_message,
      siteName: site.site_slug || undefined,
      logoUrl: ppBookingLogoUrl,
      overrides: ppBookingOverrides,
    };

    sendCustomerConfirmation(emailData as any).catch((err) =>
      console.error('Customer email failed:', err)
    );
    if (settings?.notification_email) {
      sendOwnerNotification(emailData as any, settings.notification_email).catch(
        (err) => console.error('Owner email failed:', err)
      );
    }

    return NextResponse.json({
      success: true,
      booking,
      confirmationMessage:
        settings?.confirmation_message || 'Your booking is confirmed!',
    });
  } catch (error: any) {
    console.error('Booking PayPal capture error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to capture PayPal order' },
      { status: 500 }
    );
  }
}
