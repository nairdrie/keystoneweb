/** Common shipping countries with display names (ISO 3166-1 alpha-2) */
export const COUNTRIES = [
    { code: 'CA', name: 'Canada' },
    { code: 'US', name: 'United States' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'AU', name: 'Australia' },
    { code: 'FR', name: 'France' },
    { code: 'DE', name: 'Germany' },
    { code: 'IT', name: 'Italy' },
    { code: 'ES', name: 'Spain' },
    { code: 'NL', name: 'Netherlands' },
    { code: 'BE', name: 'Belgium' },
    { code: 'IE', name: 'Ireland' },
    { code: 'NZ', name: 'New Zealand' },
    { code: 'JP', name: 'Japan' },
    { code: 'MX', name: 'Mexico' },
] as const;

/** Province/state lists keyed by country code */
export const REGIONS: Record<string, Array<{ code: string; name: string }>> = {
    CA: [
        { code: 'AB', name: 'Alberta' },
        { code: 'BC', name: 'British Columbia' },
        { code: 'MB', name: 'Manitoba' },
        { code: 'NB', name: 'New Brunswick' },
        { code: 'NL', name: 'Newfoundland and Labrador' },
        { code: 'NS', name: 'Nova Scotia' },
        { code: 'NT', name: 'Northwest Territories' },
        { code: 'NU', name: 'Nunavut' },
        { code: 'ON', name: 'Ontario' },
        { code: 'PE', name: 'Prince Edward Island' },
        { code: 'QC', name: 'Quebec' },
        { code: 'SK', name: 'Saskatchewan' },
        { code: 'YT', name: 'Yukon' },
    ],
    US: [
        { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' },
        { code: 'AZ', name: 'Arizona' }, { code: 'AR', name: 'Arkansas' },
        { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
        { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' },
        { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' },
        { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
        { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
        { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' },
        { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
        { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
        { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' },
        { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
        { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
        { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' },
        { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
        { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
        { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' },
        { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
        { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
        { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' },
        { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
        { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
        { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' },
        { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
        { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
        { code: 'DC', name: 'District of Columbia' },
    ],
};

/** Get country display name from code */
export function getCountryName(code: string): string {
    return COUNTRIES.find(c => c.code === code)?.name || code;
}

/** Get region display name from country + region code */
export function getRegionName(countryCode: string, regionCode: string): string {
    return REGIONS[countryCode]?.find(r => r.code === regionCode)?.name || regionCode;
}

/** Shipping zone type used across client and server */
export interface ShippingZone {
    id: string;
    site_id: string;
    name: string;
    countries: string[];
    regions: string[];
    rate_type: 'flat' | 'free' | 'free_above' | 'carrier';
    rate_cents: number;
    free_threshold_cents: number;
    is_local_pickup: boolean;
    sort_order: number;
    /** For rate_type='carrier': allowed Shippo servicelevel tokens. Empty = allow all. */
    carrier_services: string[];
    /** For rate_type='carrier': pass carrier price through ('exact') or add a flat handling fee. */
    markup_type: 'exact' | 'flat';
    /** For rate_type='carrier' + markup_type='flat': cents added on top of each rate. */
    markup_cents: number;
}

/** A single shipping option presented to the customer at checkout. */
export interface ShippingOption {
    /** Unique within the response — used as the radio key + persisted on the order. */
    id: string;
    label: string;
    amount_cents: number;
    /** Shippo carrier slug ("usps", "ups", ...) — set only for carrier zones. */
    carrier?: string;
    /** Shippo servicelevel.token — set only for carrier zones. */
    service_token?: string;
    zone_id: string;
}

/**
 * A product needs weight + all three dimensions to be quotable by a carrier.
 * Returns true if any of the four fields is missing or non-positive.
 */
export function productMissingShippingInfo(p: {
    weight_grams?: number | null;
    length_mm?: number | null;
    width_mm?: number | null;
    height_mm?: number | null;
}): boolean {
    return !p.weight_grams || !p.length_mm || !p.width_mm || !p.height_mm;
}

/** True if the site has at least one carrier (live-rate) shipping zone. */
export function siteHasCarrierZone(zones: Array<{ rate_type: string; is_archived?: boolean }>): boolean {
    return (zones || []).some(z => z.rate_type === 'carrier' && z.is_archived !== true);
}

/** Apply a zone's markup policy to a raw carrier rate. */
export function applyMarkup(
    baseCents: number,
    markupType: 'exact' | 'flat',
    markupCents: number,
): number {
    if (markupType === 'flat') return baseCents + Math.max(0, markupCents || 0);
    return baseCents;
}

/** Find the first shipping zone matching a given country + region */
export function findMatchingZone(
    zones: ShippingZone[],
    country: string,
    region: string,
    subtotalCents: number
): { zone: ShippingZone; shippingCents: number; label: string } | null {
    const sorted = [...zones].sort((a, b) => a.sort_order - b.sort_order);

    for (const zone of sorted) {
        const countriesArr = zone.countries as string[];
        if (!countriesArr.includes(country)) continue;

        const regionsArr = zone.regions as string[];
        if (regionsArr.length > 0 && !regionsArr.includes(region)) continue;

        // Zone matches — calculate rate
        let shippingCents = 0;
        let label = zone.name;

        if (zone.is_local_pickup) {
            shippingCents = 0;
            label = `Local Pickup — ${zone.name}`;
        } else if (zone.rate_type === 'free') {
            shippingCents = 0;
            label = `Free Shipping — ${zone.name}`;
        } else if (zone.rate_type === 'free_above' && subtotalCents >= zone.free_threshold_cents) {
            shippingCents = 0;
            label = `Free Shipping — ${zone.name}`;
        } else if (zone.rate_type === 'free_above') {
            shippingCents = zone.rate_cents;
            label = zone.name;
        } else {
            shippingCents = zone.rate_cents;
            label = zone.name;
        }

        return { zone, shippingCents, label };
    }

    return null;
}
