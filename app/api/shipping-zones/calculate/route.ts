import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import {
    findMatchingZone,
    applyMarkup,
    type ShippingZone,
    type ShippingOption,
} from '@/lib/shipping-data';
import { getRates, buildSingleParcel, type ShippoAddress } from '@/lib/shipping/shippo';

/**
 * POST /api/shipping-zones/calculate
 *
 * Input:
 *  {
 *    siteId, country, region, postal?, city?, line1?,
 *    subtotalCents,
 *    items?: [{ productId, qty }]   // required for carrier rate quotes
 *  }
 *
 * Output:
 *  - Single zone matched:
 *      { options: [ShippingOption,...], default_id: string,
 *        zone: {id,name,is_local_pickup}, freeThresholdCents?: number }
 *  - No match / no zones / no rates returned:
 *      { error: 'no_zone' | 'no_zones' | 'no_rates', message: string }
 *
 * Legacy fields (shippingCents, shippingLabel) are also populated for backwards
 * compat with any caller still reading them — they mirror the first option.
 */
export async function POST(request: NextRequest) {
    const body = await request.json();
    const { siteId, country, region, postal, city, line1, subtotalCents, items } = body;

    if (!siteId || !country) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: zones, error } = await supabase
        .from('shipping_zones')
        .select('*')
        .eq('site_id', siteId)
        .eq('is_archived', false)
        .order('sort_order');

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!zones || zones.length === 0) {
        return NextResponse.json({ error: 'no_zones', message: 'This store has not configured shipping yet.' }, { status: 200 });
    }

    const matched = findMatchingZone(
        zones as ShippingZone[],
        country,
        region || '',
        subtotalCents || 0,
    );

    if (!matched) {
        return NextResponse.json({ error: 'no_zone', message: "We don't currently ship to this area." }, { status: 200 });
    }

    const zone = matched.zone;

    // Non-carrier zone: legacy single-option response.
    if (zone.rate_type !== 'carrier') {
        const option: ShippingOption = {
            id: `${zone.id}:default`,
            label: matched.label,
            amount_cents: matched.shippingCents,
            zone_id: zone.id,
        };
        return NextResponse.json({
            options: [option],
            default_id: option.id,
            zone: { id: zone.id, name: zone.name, is_local_pickup: zone.is_local_pickup },
            shippingCents: option.amount_cents,
            shippingLabel: option.label,
            freeThresholdCents: zone.rate_type === 'free_above' ? zone.free_threshold_cents : null,
        });
    }

    // Carrier zone — need origin address + Keystone's platform Shippo key + item weights/dimensions.
    const shippoApiKey = process.env.SHIPPO_API_KEY;
    const { data: settings } = await supabase
        .from('ecommerce_settings')
        .select('origin_line1, origin_line2, origin_city, origin_region, origin_postal, origin_country')
        .eq('site_id', siteId)
        .single();

    if (!shippoApiKey || !settings?.origin_line1 || !settings?.origin_postal) {
        return NextResponse.json({
            error: 'no_rates',
            message: 'Live shipping rates are not yet configured for this store.',
        }, { status: 200 });
    }

    if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ error: 'no_rates', message: 'Cart is empty.' }, { status: 200 });
    }

    const productIds = Array.from(new Set(items.map((i: any) => i.productId).filter(Boolean)));
    const { data: productRows } = await supabase
        .from('products')
        .select('id, weight_grams, length_mm, width_mm, height_mm')
        .in('id', productIds as string[]);
    const productById = new Map((productRows || []).map((p: any) => [p.id, p]));

    const parcelItems = items.map((i: any) => {
        const p = productById.get(i.productId);
        return {
            qty: Math.max(1, Math.floor(Number(i.qty) || 1)),
            weight_grams: p?.weight_grams || null,
            length_mm: p?.length_mm || null,
            width_mm: p?.width_mm || null,
            height_mm: p?.height_mm || null,
        };
    });

    const parcel = buildSingleParcel(parcelItems);
    if (!parcel) {
        // Should never reach a customer — products without dims are gated as
        // 'unavailable' upstream. This is the defense-in-depth message for
        // stale carts after a merchant config change.
        return NextResponse.json({
            error: 'no_rates',
            message: "One or more items in your cart are currently unavailable for shipping.",
        }, { status: 200 });
    }

    const addressFrom: ShippoAddress = {
        street1: settings.origin_line1,
        street2: settings.origin_line2 || undefined,
        city: settings.origin_city || '',
        state: settings.origin_region || '',
        zip: settings.origin_postal,
        country: settings.origin_country || 'US',
    };

    const addressTo: ShippoAddress = {
        street1: line1 || '',
        city: city || '',
        state: region || '',
        zip: postal || '',
        country,
    };

    let rates;
    try {
        rates = await getRates({
            apiKey: shippoApiKey,
            addressFrom,
            addressTo,
            parcels: [parcel],
        });
    } catch (err: any) {
        console.error('Shippo rate error:', err?.message || err);
        return NextResponse.json({
            error: 'no_rates',
            message: 'Could not retrieve live shipping rates. Please try again.',
        }, { status: 200 });
    }

    const allowed = Array.isArray(zone.carrier_services) ? zone.carrier_services : [];
    const filtered = allowed.length > 0
        ? rates.filter(r => allowed.includes(r.servicelevel_token))
        : rates;

    if (filtered.length === 0) {
        return NextResponse.json({
            error: 'no_rates',
            message: 'No shipping services are available for this address.',
        }, { status: 200 });
    }

    const options: ShippingOption[] = filtered
        .map(r => {
            const days = typeof r.estimated_days === 'number' && r.estimated_days > 0
                ? ` (~${r.estimated_days} day${r.estimated_days === 1 ? '' : 's'})`
                : '';
            return {
                id: `${zone.id}:${r.servicelevel_token || r.object_id}`,
                label: `${r.provider} ${r.servicelevel_name}${days}`,
                amount_cents: applyMarkup(r.amount_cents, zone.markup_type, zone.markup_cents),
                carrier: r.provider.toLowerCase(),
                service_token: r.servicelevel_token,
                zone_id: zone.id,
            };
        })
        .sort((a, b) => a.amount_cents - b.amount_cents);

    return NextResponse.json({
        options,
        default_id: options[0].id,
        zone: { id: zone.id, name: zone.name, is_local_pickup: false },
        shippingCents: options[0].amount_cents,
        shippingLabel: options[0].label,
        freeThresholdCents: null,
    });
}
