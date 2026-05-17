import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { validateAddress, type ShippoAddress } from '@/lib/shipping/shippo';

/**
 * POST /api/shipping/validate-address
 *
 * Input: { siteId, address: { line1, line2?, city, region, postal, country } }
 *
 * Output:
 *   { valid: boolean, corrected?: {...}, messages: [{text}] }
 *   { error: 'not_configured' } — site has no Shippo key, treat as skip on the client
 */
export async function POST(request: NextRequest) {
    const body = await request.json();
    const { siteId, address } = body;

    if (!siteId || !address?.line1 || !address?.country) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: settings } = await supabase
        .from('ecommerce_settings')
        .select('shippo_api_key')
        .eq('site_id', siteId)
        .single();

    if (!settings?.shippo_api_key) {
        return NextResponse.json({ error: 'not_configured' }, { status: 200 });
    }

    const shippoAddress: ShippoAddress = {
        street1: address.line1,
        street2: address.line2 || undefined,
        city: address.city || '',
        state: address.region || '',
        zip: address.postal || '',
        country: address.country,
    };

    try {
        const result = await validateAddress({ apiKey: settings.shippo_api_key, address: shippoAddress });
        const corrected = result.corrected ? {
            line1: result.corrected.street1,
            line2: result.corrected.street2,
            city: result.corrected.city,
            region: result.corrected.state,
            postal: result.corrected.zip,
            country: result.corrected.country,
        } : undefined;
        return NextResponse.json({
            valid: result.valid,
            corrected,
            messages: result.messages,
        });
    } catch (err: any) {
        console.error('Address validation error:', err?.message || err);
        // Don't block checkout on validation outage.
        return NextResponse.json({ valid: true, messages: [] });
    }
}
