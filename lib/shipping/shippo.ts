/**
 * Minimal Shippo REST client — rates and address validation only.
 *
 * Shippo's rate API is free and unlimited; we never call the label-purchase
 * endpoints from here. The `fetch`-based wrapper mirrors the style used by
 * the Stripe webhook handler (no SDK dep).
 *
 * Docs: https://docs.goshippo.com/shippoapi/public-api/
 */

const SHIPPO_BASE = 'https://api.goshippo.com';

export interface ShippoAddress {
    name?: string;
    street1: string;
    street2?: string;
    city: string;
    state: string;     // e.g. "ON", "CA"
    zip: string;
    country: string;   // ISO-2, e.g. "US", "CA"
    phone?: string;
    email?: string;
}

export interface ShippoParcel {
    length: string;          // decimal string in `distance_unit`
    width: string;
    height: string;
    distance_unit: 'cm' | 'in';
    weight: string;          // decimal string in `mass_unit`
    mass_unit: 'g' | 'kg' | 'lb' | 'oz';
}

export interface ShippoRate {
    object_id: string;
    provider: string;          // "USPS", "UPS", "FedEx", ...
    servicelevel_token: string; // e.g. "usps_priority"
    servicelevel_name: string;  // e.g. "Priority Mail"
    amount_cents: number;       // converted from Shippo's decimal string
    currency: string;           // e.g. "USD"
    estimated_days: number | null;
}

export interface ShippoAddressValidation {
    valid: boolean;
    corrected?: {
        street1: string;
        street2?: string;
        city: string;
        state: string;
        zip: string;
        country: string;
    };
    messages: Array<{ source?: string; code?: string; text: string }>;
}

async function shippoFetch(apiKey: string, path: string, init?: RequestInit) {
    const res = await fetch(`${SHIPPO_BASE}${path}`, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `ShippoToken ${apiKey}`,
            ...(init?.headers || {}),
        },
    });
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
    if (!res.ok) {
        const msg = json?.detail || json?.message || text || `Shippo ${res.status}`;
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
    return json;
}

/**
 * Fetch live shipping rates for one parcel from origin to destination.
 * Returns an empty array if Shippo reports no rates for this pairing.
 * Throws on credential / network errors so callers can surface a sensible message.
 */
export async function getRates(args: {
    apiKey: string;
    addressFrom: ShippoAddress;
    addressTo: ShippoAddress;
    parcels: ShippoParcel[];
}): Promise<ShippoRate[]> {
    const body = {
        address_from: args.addressFrom,
        address_to: args.addressTo,
        parcels: args.parcels,
        async: false,
    };
    const data = await shippoFetch(args.apiKey, '/shipments/', {
        method: 'POST',
        body: JSON.stringify(body),
    });
    const rates: any[] = data?.rates || [];
    return rates.map(r => ({
        object_id: r.object_id,
        provider: r.provider,
        servicelevel_token: r.servicelevel?.token || '',
        servicelevel_name: r.servicelevel?.name || r.provider,
        amount_cents: Math.round(parseFloat(r.amount || '0') * 100),
        currency: r.currency || 'USD',
        estimated_days: typeof r.estimated_days === 'number' ? r.estimated_days : null,
    }));
}

/**
 * Validate a destination address. Shippo returns a corrected variant when
 * USPS/Loqate find a near-match; we surface both validity and the suggestion.
 */
export async function validateAddress(args: {
    apiKey: string;
    address: ShippoAddress;
}): Promise<ShippoAddressValidation> {
    const data = await shippoFetch(args.apiKey, '/addresses/', {
        method: 'POST',
        body: JSON.stringify({ ...args.address, validate: true }),
    });
    const vr = data?.validation_results || {};
    const messages = Array.isArray(vr.messages) ? vr.messages : [];
    const valid = vr.is_valid !== false; // treat unknown as valid; only reject explicit failures
    const corrected = (data?.street1 && data?.city) ? {
        street1: data.street1,
        street2: data.street2 || undefined,
        city: data.city,
        state: data.state,
        zip: data.zip,
        country: data.country,
    } : undefined;
    return { valid, corrected, messages };
}

/**
 * Roll up cart items into a single parcel for rate quoting.
 *
 * v1 approximation: sum weights, take the max of each dimension. This
 * over-estimates for irregularly shaped multi-item carts (real packing
 * would stack them) but never under-quotes, which is the safer direction.
 * If any item is missing weight/dimensions we bail out — the merchant
 * needs to fill those in for live rates to work.
 */
export function buildSingleParcel(items: Array<{
    weight_grams: number | null;
    length_mm: number | null;
    width_mm: number | null;
    height_mm: number | null;
    qty: number;
}>): ShippoParcel | null {
    let totalGrams = 0;
    let maxL = 0, maxW = 0, maxH = 0;
    for (const it of items) {
        if (!it.weight_grams || !it.length_mm || !it.width_mm || !it.height_mm) return null;
        totalGrams += it.weight_grams * it.qty;
        if (it.length_mm > maxL) maxL = it.length_mm;
        if (it.width_mm > maxW) maxW = it.width_mm;
        if (it.height_mm > maxH) maxH = it.height_mm;
    }
    if (totalGrams <= 0 || maxL <= 0 || maxW <= 0 || maxH <= 0) return null;
    return {
        length: (maxL / 10).toFixed(2),
        width: (maxW / 10).toFixed(2),
        height: (maxH / 10).toFixed(2),
        distance_unit: 'cm',
        weight: totalGrams.toFixed(0),
        mass_unit: 'g',
    };
}
