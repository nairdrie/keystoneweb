import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { verifyTransaction } from '@/lib/payments/converge';
import { sendCustomerConfirmation, sendOwnerNotification } from '@/lib/email';

/**
 * POST /api/bookings/converge-verify
 * Body: { sslTxnId, siteId, serviceId, selectedOptionName?, selectedPriceCents?,
 *         date, startTime, customerName, customerEmail, customerPhone?, notes? }
 *
 * Called after Lightbox onApproval. Verifies transaction, creates the booking row,
 * and sends confirmation emails (mirrors paypal-capture-order flow).
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const body = await request.json();
        const {
            sslTxnId, siteId, serviceId, selectedOptionName, selectedPriceCents,
            date, startTime, customerName, customerEmail, customerPhone, notes,
        } = body;

        if (!sslTxnId || !siteId || !serviceId || !date || !startTime || !customerName || !customerEmail) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const admin = createAdminClient();
        const { data: site } = await admin
            .from('sites')
            .select('converge_merchant_id, converge_user_id, converge_pin, converge_demo_mode, site_slug, user_id, design_data')
            .eq('id', siteId)
            .single();

        if (!site?.converge_merchant_id || !site?.converge_user_id || !site?.converge_pin) {
            return NextResponse.json({ error: 'Converge not configured' }, { status: 400 });
        }

        const { data: service } = await supabase
            .from('booking_services')
            .select('*')
            .eq('id', serviceId)
            .single();

        if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 });

        const result = await verifyTransaction(
            { merchantId: site.converge_merchant_id, userId: site.converge_user_id, pin: site.converge_pin, demoMode: !!site.converge_demo_mode },
            sslTxnId
        );

        if (!result.approved) {
            return NextResponse.json({ error: 'Payment not approved', resultMessage: result.resultMessage }, { status: 400 });
        }

        const priceCents = selectedPriceCents ?? service.price_cents;
        const paidAmount = parseFloat(result.amount || '0');
        const expectedAmount = priceCents / 100;
        if (Math.abs(paidAmount - expectedAmount) > 0.01) {
            return NextResponse.json({ error: 'Payment amount mismatch', expected: expectedAmount, received: paidAmount }, { status: 400 });
        }

        // Slot check
        const [h, m] = startTime.split(':').map(Number);
        const startMinutes = h * 60 + m;
        const endMinutes = startMinutes + service.duration_minutes;
        const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;

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
            const toMin = (t: string) => { const [bh, bm] = t.split(':').map(Number); return bh * 60 + bm; };
            return startMinutes < toMin(b.end_time) + bufferMinutes && endMinutes + bufferMinutes > toMin(b.start_time);
        });

        if (timeConflict) {
            return NextResponse.json({ error: 'That time slot is no longer available.' }, { status: 409 });
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
                payment_method: 'converge',
                payment_status: 'paid',
                converge_txn_id: result.txnId,
                notes: notes || null,
                selected_option_name: selectedOptionName || null,
                total_price_cents: priceCents,
            })
            .select()
            .single();

        if (bookError || !booking) {
            console.error('Booking insert after Converge payment failed:', bookError);
            return NextResponse.json({ error: 'Payment captured but booking could not be created' }, { status: 500 });
        }

        const formatTime = (t: string) => {
            const [hh, mm] = t.split(':').map(Number);
            const period = hh >= 12 ? 'PM' : 'AM';
            const displayHour = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
            return `${displayHour}:${mm.toString().padStart(2, '0')} ${period}`;
        };

        const cvgBookingLogoUrl: string | undefined = (site?.design_data as any)?.headerLogo || (site?.design_data as any)?.siteLogo || undefined;
        const { data: cvgBookingCustomRows } = await admin
            .from('email_customizations')
            .select('email_key, overrides')
            .eq('site_id', siteId)
            .eq('email_key', 'booking_confirmed');
        const cvgBookingOverrides = cvgBookingCustomRows?.[0]?.overrides;

        const emailData = {
            serviceName: service.name,
            selectedOptionName: selectedOptionName || undefined,
            date, startTime: formatTime(startTime),
            duration: service.duration_minutes,
            priceCents, currency: service.currency,
            customerName, customerEmail, customerPhone, notes,
            bookingId: booking.id,
            paymentMethod: 'converge' as const,
            confirmationMessage: settings?.confirmation_message,
            siteName: site.site_slug || undefined,
            logoUrl: cvgBookingLogoUrl,
            overrides: cvgBookingOverrides,
        };

        sendCustomerConfirmation(emailData as any).catch(e => console.error('Customer email failed:', e));
        if (settings?.notification_email) {
            sendOwnerNotification(emailData as any, settings.notification_email).catch(e => console.error('Owner email failed:', e));
        }

        return NextResponse.json({
            success: true,
            booking,
            transaction: { txnId: result.txnId, approvalCode: result.approvalCode, cardLast4: result.cardLast4 },
            confirmationMessage: settings?.confirmation_message || 'Your booking is confirmed!',
        });
    } catch (err: any) {
        console.error('Booking Converge verify error:', err);
        return NextResponse.json({ error: err.message || 'Verification failed' }, { status: 500 });
    }
}
