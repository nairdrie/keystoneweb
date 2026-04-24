import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { requestSessionToken } from '@/lib/payments/converge';

/**
 * POST /api/bookings/converge-token
 * Body: { siteId, serviceId, selectedOptionName?, selectedPriceCents?, date, startTime,
 *         customerName, customerEmail, customerPhone?, notes? }
 *
 * Generates a Converge Lightbox session token for a booking payment.
 * Credentials come from the site's converge_* columns.
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const body = await request.json();
        const {
            siteId, serviceId, selectedOptionName, selectedPriceCents,
            date, startTime, customerName, customerEmail, customerPhone, notes,
        } = body;

        if (!siteId || !serviceId || !date || !startTime || !customerName || !customerEmail) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const admin = createAdminClient();
        const { data: site } = await admin
            .from('sites')
            .select('converge_merchant_id, converge_user_id, converge_pin, converge_demo_mode')
            .eq('id', siteId)
            .single();

        if (!site?.converge_merchant_id || !site?.converge_user_id || !site?.converge_pin) {
            return NextResponse.json({ error: 'Converge is not configured for this site' }, { status: 400 });
        }

        const { data: service } = await supabase
            .from('booking_services')
            .select('*')
            .eq('id', serviceId)
            .eq('is_active', true)
            .single();

        if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 });

        const priceCents = selectedPriceCents ?? service.price_cents;
        if (!priceCents || priceCents <= 0) {
            return NextResponse.json({ error: 'Cannot create payment for a free service' }, { status: 400 });
        }

        const totalAmount = priceCents / 100;
        const itemName = selectedOptionName ? `${service.name} — ${selectedOptionName}` : service.name;
        const [firstName, ...lastNameParts] = (customerName || '').split(' ');

        const pendingId = `booking_${siteId}_${Date.now()}`;

        const token = await requestSessionToken(
            {
                merchantId: site.converge_merchant_id,
                userId: site.converge_user_id,
                pin: site.converge_pin,
                demoMode: !!site.converge_demo_mode,
            },
            {
                amount: totalAmount,
                invoiceNumber: `BK-${pendingId.slice(-8).toUpperCase()}`,
                description: `${itemName} on ${date} at ${startTime}`,
                firstName,
                lastName: lastNameParts.join(' ') || undefined,
                email: customerEmail,
                phone: customerPhone || undefined,
            }
        );

        return NextResponse.json({
            token,
            demoMode: !!site.converge_demo_mode,
            amount: totalAmount.toFixed(2),
            pendingId,
        });
    } catch (err: any) {
        console.error('Booking Converge token error:', err);
        return NextResponse.json({ error: err.message || 'Failed to generate payment token' }, { status: 500 });
    }
}
