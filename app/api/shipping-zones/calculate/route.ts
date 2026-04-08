import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { findMatchingZone, type ShippingZone } from '@/lib/shipping-data';

/**
 * POST /api/shipping-zones/calculate
 * Input: { siteId, country, region, subtotalCents }
 * Output: { zone, shippingCents, shippingLabel } or { error: "no_zone" }
 */
export async function POST(request: NextRequest) {
    const body = await request.json();
    const { siteId, country, region, subtotalCents } = body;

    if (!siteId || !country) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: zones, error } = await supabase
        .from('shipping_zones')
        .select('*')
        .eq('site_id', siteId)
        .order('sort_order');

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!zones || zones.length === 0) {
        return NextResponse.json({ error: 'no_zones', message: 'This store has not configured shipping yet.' }, { status: 200 });
    }

    const result = findMatchingZone(zones as ShippingZone[], country, region || '', subtotalCents || 0);

    if (!result) {
        return NextResponse.json({ error: 'no_zone', message: 'We don\'t currently ship to this area.' }, { status: 200 });
    }

    return NextResponse.json({
        zone: { id: result.zone.id, name: result.zone.name, is_local_pickup: result.zone.is_local_pickup },
        shippingCents: result.shippingCents,
        shippingLabel: result.label,
        freeThresholdCents: result.zone.rate_type === 'free_above' ? result.zone.free_threshold_cents : null,
    });
}
