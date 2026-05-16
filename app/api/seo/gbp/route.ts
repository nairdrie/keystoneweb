import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { buildGbpDiff, type GbpData } from '@/lib/seo/gbp-diff';
import { PUBLISHED_ROOT } from '@/lib/env/domain';
import type { BusinessProfile } from '@/lib/types/sites';

async function fetchGbp(placeId: string): Promise<GbpData | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  const fieldMask = [
    'id',
    'displayName',
    'formattedAddress',
    'nationalPhoneNumber',
    'internationalPhoneNumber',
    'websiteUri',
    'primaryType',
    'businessStatus',
    'regularOpeningHours',
  ].join(',');

  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn(`[gbp] Places fetch failed ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('[gbp] Places fetch threw:', err);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const siteId = req.nextUrl.searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId is required' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: site } = await supabase
    .from('sites')
    .select('user_id, business_profile, published_domain, custom_domain')
    .eq('id', siteId)
    .single();
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  if (site.user_id && site.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const siteProfile = site.business_profile as BusinessProfile | null;
  const siteUrl = site.custom_domain
    ? `https://${site.custom_domain}`
    : `https://${site.published_domain || 'preview'}.${PUBLISHED_ROOT}`;

  const placeId = siteProfile?.placeId || null;
  const gbp = placeId ? await fetchGbp(placeId) : null;
  const diffs = buildGbpDiff({ siteUrl, siteProfile, gbp });

  return NextResponse.json({ placeId, hasApiKey: !!process.env.GOOGLE_PLACES_API_KEY, gbp, diffs, siteUrl });
}
