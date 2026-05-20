import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import {
    findMatchingZone,
    applyMarkup,
    type ShippingZone,
    type ShippingOption,
    type PackagingBox,
} from '@/lib/shipping-data';
import { getRates, type ShippoAddress, type ShippoRate } from '@/lib/shipping/shippo';
import { generatePackingPlans, planToShippoParcels, type PackerItem } from '@/lib/shipping/packer';

/**
 * POST /api/shipping-zones/calculate
 *
 * Carrier zones: generate candidate packing plans, quote each with Shippo, and
 * for every service-level token across plans pick the cheapest plan. The
 * customer sees one option per service at the best price we can find.
 *
 * Non-carrier zones (flat / free / free_above / pickup) still return a single
 * option as before.
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

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!zones || zones.length === 0) {
        return NextResponse.json({ error: 'no_zones', message: 'This store has not configured shipping yet.' });
    }

    const matched = findMatchingZone(
        zones as ShippingZone[],
        country,
        region || '',
        subtotalCents || 0,
    );
    if (!matched) {
        return NextResponse.json({ error: 'no_zone', message: "We don't currently ship to this area." });
    }

    const zone = matched.zone;

    // Non-carrier zones: legacy single-option response.
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

    // ── Carrier zone path ───────────────────────────────────────────────
    const shippoApiKey = process.env.SHIPPO_API_KEY;
    const { data: settings } = await supabase
        .from('ecommerce_settings')
        .select('origin_line1, origin_line2, origin_city, origin_region, origin_postal, origin_country, packaging_boxes')
        .eq('site_id', siteId)
        .single();

    if (!shippoApiKey || !settings?.origin_line1 || !settings?.origin_postal) {
        return NextResponse.json({ error: 'no_rates', message: 'Live shipping rates are not yet configured for this store.' });
    }

    const boxes: PackagingBox[] = Array.isArray(settings.packaging_boxes) ? settings.packaging_boxes : [];
    if (boxes.length === 0) {
        return NextResponse.json({ error: 'no_rates', message: 'Live shipping rates are not yet configured for this store.' });
    }

    if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ error: 'no_rates', message: 'Cart is empty.' });
    }

    const packerItems = await loadPackerItems(supabase, items);
    if (!packerItems) {
        return NextResponse.json({
            error: 'no_rates',
            message: "One or more items in your cart are currently unavailable for shipping.",
        });
    }

    const plans = generatePackingPlans(packerItems, boxes);
    if (plans.length === 0) {
        return NextResponse.json({
            error: 'no_rates',
            message: 'Items in this cart don\'t fit any available box size.',
        });
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

    // Quote each plan independently — Shippo returns rates per shipment, not
    // per-parcel-option, so we have to ask once per candidate plan.
    const quoted: Array<{ planIndex: number; rates: ShippoRate[] }> = [];
    for (let i = 0; i < plans.length; i++) {
        try {
            const rates = await getRates({
                apiKey: shippoApiKey,
                addressFrom,
                addressTo,
                parcels: planToShippoParcels(plans[i]),
            });
            quoted.push({ planIndex: i, rates });
        } catch (err: any) {
            console.error(`Shippo plan ${i} error:`, err?.message || err);
        }
    }

    if (quoted.length === 0) {
        return NextResponse.json({ error: 'no_rates', message: 'Could not retrieve live shipping rates. Please try again.' });
    }

    const allowed = Array.isArray(zone.carrier_services) ? zone.carrier_services : [];

    // For each service token, find the cheapest plan that offers it.
    type ServiceBest = { rate: ShippoRate; planIndex: number };
    const bestByService = new Map<string, ServiceBest>();
    for (const { planIndex, rates } of quoted) {
        for (const r of rates) {
            if (!r.servicelevel_token) continue;
            if (allowed.length > 0 && !allowed.includes(r.servicelevel_token)) continue;
            const prev = bestByService.get(r.servicelevel_token);
            if (!prev || r.amount_cents < prev.rate.amount_cents) {
                bestByService.set(r.servicelevel_token, { rate: r, planIndex });
            }
        }
    }

    if (bestByService.size === 0) {
        return NextResponse.json({ error: 'no_rates', message: 'No shipping services are available for this address.' });
    }

    const options: ShippingOption[] = Array.from(bestByService.values()).map(({ rate }) => {
        const days = typeof rate.estimated_days === 'number' && rate.estimated_days > 0
            ? ` (~${rate.estimated_days} day${rate.estimated_days === 1 ? '' : 's'})`
            : '';
        return {
            id: `${zone.id}:${rate.servicelevel_token || rate.object_id}`,
            label: `${rate.provider} ${rate.servicelevel_name}${days}`,
            amount_cents: applyMarkup(rate.amount_cents, zone.markup_type, zone.markup_cents),
            carrier: rate.provider.toLowerCase(),
            service_token: rate.servicelevel_token,
            zone_id: zone.id,
        };
    }).sort((a, b) => a.amount_cents - b.amount_cents);

    return NextResponse.json({
        options,
        default_id: options[0].id,
        zone: { id: zone.id, name: zone.name, is_local_pickup: false },
        shippingCents: options[0].amount_cents,
        shippingLabel: options[0].label,
        freeThresholdCents: null,
    });
}

/**
 * Fetch weight/dim/ships_alone for the cart's products and merge with qty.
 * Returns null if any item is missing required dims — caller surfaces a
 * generic "unavailable" error rather than leaking the config issue.
 */
async function loadPackerItems(
    supabase: any,
    items: Array<{ productId: string; qty: number }>,
): Promise<PackerItem[] | null> {
    const productIds = Array.from(new Set(items.map(i => i.productId).filter(Boolean)));
    if (productIds.length === 0) return null;

    const { data: rows } = await supabase
        .from('products')
        .select('id, name, weight_grams, length_mm, width_mm, height_mm, ships_alone')
        .in('id', productIds);

    const byId = new Map<string, any>((rows || []).map((r: any) => [r.id, r]));
    const out: PackerItem[] = [];
    for (const i of items) {
        const p = byId.get(i.productId);
        const qty = Math.max(1, Math.floor(Number(i.qty) || 1));
        if (!p || !p.weight_grams || !p.length_mm || !p.width_mm || !p.height_mm) return null;
        out.push({
            productId: p.id,
            name: p.name,
            qty,
            weight_grams: p.weight_grams,
            length_mm: p.length_mm,
            width_mm: p.width_mm,
            height_mm: p.height_mm,
            ships_alone: !!p.ships_alone,
        });
    }
    return out;
}
