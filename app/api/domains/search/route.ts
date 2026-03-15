import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

const GODADDY_API_KEY = process.env.GODADDY_API_KEY;
const GODADDY_API_SECRET = process.env.GODADDY_API_SECRET;
const GODADDY_BASE_URL = process.env.GODADDY_ENV === 'production'
  ? 'https://api.godaddy.com'
  : 'https://api.ote-godaddy.com';

/**
 * GET /api/domains/search?query=mybusiness
 * Search for available domains via GoDaddy API and return suggestions
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

    // Search for exact domain availability + suggestions
    const tlds = ['com', 'ca', 'net', 'org', 'co', 'io', 'shop', 'store'];
    const domainsToCheck = tlds.map(tld => `${query}.${tld}`);

    // Check availability for exact matches
    const availabilityRes = await fetch(
      `${GODADDY_BASE_URL}/v1/domains/available?checkType=FAST`,
      {
        method: 'POST',
        headers: {
          'Authorization': `sso-key ${GODADDY_API_KEY}:${GODADDY_API_SECRET}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(domainsToCheck),
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

    // Get domain suggestions from GoDaddy
    const suggestRes = await fetch(
      `${GODADDY_BASE_URL}/v1/domains/suggest?query=${encodeURIComponent(query)}&limit=6&waitMs=2000`,
      {
        headers: {
          'Authorization': `sso-key ${GODADDY_API_KEY}:${GODADDY_API_SECRET}`,
        },
      }
    );

    let suggestions: Array<{ domain: string; price?: number }> = [];
    if (suggestRes.ok) {
      const suggestData = await suggestRes.json();
      suggestions = suggestData.map((s: { domain: string }) => ({
        domain: s.domain,
      }));
    }

    // Format exact match results
    const exactResults = (availabilityData.domains || availabilityData || []).map(
      (d: { domain: string; available: boolean; price?: number; currency?: string }) => ({
        domain: d.domain,
        available: d.available,
        price: d.price,
        currency: d.currency || 'USD',
      })
    );

    return NextResponse.json({
      exact: exactResults,
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
