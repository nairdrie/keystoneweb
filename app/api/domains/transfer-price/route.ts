import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { FREE_DOMAIN_MAX_USD, calculateDomainPrice, priceToCents } from '@/lib/domains/pricing';

const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
const VERCEL_API_BASE = 'https://api.vercel.com';

/**
 * GET /api/domains/transfer-price?domain=example.com
 *
 * Fetches the transfer price for a domain from Vercel (no EPP code required).
 * Returns pricing details and whether the user's Pro free credit covers it.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const domain = request.nextUrl.searchParams.get('domain');
    if (!domain) {
      return NextResponse.json({ error: 'Missing domain parameter' }, { status: 400 });
    }

    if (!VERCEL_API_TOKEN) {
      return NextResponse.json({ error: 'Domain purchasing is not configured.' }, { status: 503 });
    }

    // Check whether the user's free domain credit is still available
    const { count: purchaseCount } = await supabase
      .from('domain_purchases')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'completed');

    const freeDomainUsed = (purchaseCount ?? 0) > 0;

    // Fetch transfer price from Vercel
    const teamParam = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : '';
    const priceRes = await fetch(
      `${VERCEL_API_BASE}/v1/registrar/domains/${encodeURIComponent(domain)}/price${teamParam}`,
      { headers: { Authorization: `Bearer ${VERCEL_API_TOKEN}` } }
    );

    if (!priceRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch transfer price.' }, { status: 502 });
    }

    const priceData = await priceRes.json();
    const transferPrice: number = typeof priceData.transferPrice === 'string'
      ? parseFloat(priceData.transferPrice)
      : priceData.transferPrice;

    if (isNaN(transferPrice) || transferPrice <= 0) {
      return NextResponse.json({ error: 'Transfer pricing unavailable for this domain.' }, { status: 422 });
    }

    // Calculate what the user owes
    const isFreeEligible = !freeDomainUsed && transferPrice <= FREE_DOMAIN_MAX_USD;
    let userOwesVercelPrice: number;

    if (freeDomainUsed) {
      // Free credit already used — full retail price
      userOwesVercelPrice = transferPrice;
    } else if (transferPrice <= FREE_DOMAIN_MAX_USD) {
      // Fully covered by Pro credit
      userOwesVercelPrice = 0;
    } else {
      // Partially covered — user pays the overage at cost (no markup on the overage)
      userOwesVercelPrice = transferPrice - FREE_DOMAIN_MAX_USD;
    }

    const userOwesRetail = freeDomainUsed
      ? calculateDomainPrice(transferPrice)
      : userOwesVercelPrice > 0
        ? userOwesVercelPrice  // overage charged at cost, no markup
        : 0;

    return NextResponse.json({
      domain,
      transferPrice,
      freeDomainUsed,
      isFreeEligible,
      userOwesUsd: userOwesRetail,
      userOwesCents: priceToCents(userOwesRetail),
      freeCredit: FREE_DOMAIN_MAX_USD,
    });
  } catch (error) {
    console.error('Error fetching transfer price:', error);
    return NextResponse.json({ error: 'Failed to fetch transfer price' }, { status: 500 });
  }
}
