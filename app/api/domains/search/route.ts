import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

const GODADDY_API_KEY = process.env.GODADDY_API_KEY;
const GODADDY_API_SECRET = process.env.GODADDY_API_SECRET;
const GODADDY_BASE_URL = process.env.GODADDY_ENV === 'production'
  ? 'https://api.godaddy.com'
  : 'https://api.ote-godaddy.com';

// Max price in micro-units (GoDaddy prices are in micros: 1,000,000 = $1)
// $20/yr cap filters out premium/aftermarket domains
const MAX_DOMAIN_PRICE_MICROS = 20_000_000;

interface GoDaddyDomain {
  domain: string;
  available: boolean;
  price?: number;
  currency?: string;
  definitive?: boolean;
}

/**
 * GET /api/domains/search?query=mybusiness
 * Search for available domains via GoDaddy API.
 * Returns results split into recommended (.ca) and other TLDs.
 * Filters out premium/aftermarket domains — only standard-priced registrations.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify Pro plan
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('subscription_status, subscription_plan')
      .eq('user_id', user.id)
      .single();

    const isPro = subscription?.subscription_status === 'active' &&
      subscription?.subscription_plan?.toLowerCase().includes('pro');

    if (!isPro) {
      return NextResponse.json(
        { error: 'Pro plan required for custom domains' },
        { status: 403 }
      );
    }

    const query = request.nextUrl.searchParams.get('query');
    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: 'Search query must be at least 2 characters' },
        { status: 400 }
      );
    }

    if (!GODADDY_API_KEY || !GODADDY_API_SECRET) {
      return NextResponse.json(
        { error: 'Domain search is not configured. Contact support.' },
        { status: 503 }
      );
    }

    const authHeader = `sso-key ${GODADDY_API_KEY}:${GODADDY_API_SECRET}`;

    // Check .ca TLDs first (recommended)
    const caTlds = ['ca', 'co.ca'];
    const otherTlds = ['com', 'net', 'org', 'co', 'shop', 'store'];

    const caDomainsToCheck = caTlds.map(tld => `${query}.${tld}`);
    const otherDomainsToCheck = otherTlds.map(tld => `${query}.${tld}`);
    const allDomainsToCheck = [...caDomainsToCheck, ...otherDomainsToCheck];

    // Check availability for all TLDs in one request
    const availabilityRes = await fetch(
      `${GODADDY_BASE_URL}/v1/domains/available?checkType=FULL`,
      {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(allDomainsToCheck),
      }
    );

    if (!availabilityRes.ok) {
      console.error('GoDaddy availability check failed:', await availabilityRes.text());
      return NextResponse.json(
        { error: 'Failed to check domain availability' },
        { status: 502 }
      );
    }

    const availabilityData = await availabilityRes.json();
    const allResults: GoDaddyDomain[] = availabilityData.domains || availabilityData || [];

    // Filter: only standard-priced, directly available domains (no premium/aftermarket)
    const filterStandard = (d: GoDaddyDomain) => {
      if (!d.available) return true; // Keep unavailable ones so UI can show them as taken
      // If price is present and exceeds cap, it's likely premium — exclude
      if (d.price && d.price > MAX_DOMAIN_PRICE_MICROS) return false;
      return true;
    };

    const formatResult = (d: GoDaddyDomain) => ({
      domain: d.domain,
      available: d.available,
      price: d.price,
      currency: d.currency || 'USD',
    });

    // Split into .ca recommended and other
    const caResults = allResults
      .filter(d => d.domain.endsWith('.ca'))
      .filter(filterStandard)
      .map(formatResult);

    const otherResults = allResults
      .filter(d => !d.domain.endsWith('.ca'))
      .filter(filterStandard)
      .map(formatResult);

    // Get .ca-focused suggestions from GoDaddy
    const suggestRes = await fetch(
      `${GODADDY_BASE_URL}/v1/domains/suggest?query=${encodeURIComponent(query)}&country=CA&limit=8&waitMs=2000`,
      {
        headers: { 'Authorization': authHeader },
      }
    );

    let suggestions: Array<{ domain: string; price?: number }> = [];
    if (suggestRes.ok) {
      const suggestData = await suggestRes.json();
      suggestions = suggestData
        .filter((s: GoDaddyDomain) => {
          // Only include standard-priced suggestions
          if (s.price && s.price > MAX_DOMAIN_PRICE_MICROS) return false;
          return true;
        })
        .map((s: GoDaddyDomain) => ({
          domain: s.domain,
          price: s.price,
        }));
    }

    return NextResponse.json({
      recommended: caResults,
      other: otherResults,
      suggestions,
    });
  } catch (error) {
    console.error('Error searching domains:', error);
    return NextResponse.json(
      { error: 'Failed to search domains' },
      { status: 500 }
    );
  }
}
