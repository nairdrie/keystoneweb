import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { getRegistrantSchema } from '@/lib/domains/registrant-server';
import { emptyRegistrant, registrantFromColumns, REGISTRANT_COLUMNS } from '@/lib/domains/registrant';

/**
 * GET /api/domains/registrant?domain=example.ca
 *
 * Returns the registry's requirements for the domain's TLD plus the user's
 * most recently used registrant details (or a profile-based starting point),
 * so the purchase form can be pre-filled and validated before buying.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const domain = request.nextUrl.searchParams.get('domain')?.trim().toLowerCase();
  if (!domain || !domain.includes('.')) {
    return NextResponse.json({ error: 'Missing domain' }, { status: 400 });
  }

  const [schema, lastPurchase, profile] = await Promise.all([
    getRegistrantSchema(domain),
    supabase
      .from('domain_purchases')
      .select(REGISTRANT_COLUMNS)
      .eq('user_id', user.id)
      .not('contact_first_name', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('users').select('email, business_name').eq('id', user.id).maybeSingle(),
  ]);

  const saved =
    registrantFromColumns(lastPurchase.data as Record<string, unknown> | null) ??
    emptyRegistrant({
      email: profile.data?.email || user.email || '',
      companyName: profile.data?.business_name || '',
    });

  return NextResponse.json({ schema, saved });
}
