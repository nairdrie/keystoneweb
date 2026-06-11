import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { sanitizeAiSampleDataPayload } from '@/lib/ai/sample-data';
import { seedSampleBookingServices, seedSampleMenuItems, seedSampleProducts } from '@/lib/ai/sample-data-seed';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const siteId = typeof body?.siteId === 'string' ? body.siteId : '';
    if (!siteId) {
      return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    const { data: site } = await supabase
      .from('sites')
      .select('user_id')
      .eq('id', siteId)
      .single();

    if (!site || site.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const samples = sanitizeAiSampleDataPayload(body?.samples);
    const admin = createAdminClient();

    const seeded = {
      products: samples.products?.length ? await seedSampleProducts(admin, siteId, samples.products) : 0,
      menuItems: samples.menuItems?.length ? await seedSampleMenuItems(admin, siteId, samples.menuItems) : 0,
      bookingServices: samples.bookingServices?.length ? await seedSampleBookingServices(admin, siteId, samples.bookingServices) : 0,
    };

    return NextResponse.json({ seeded });
  } catch (error) {
    console.error('[AI Builder] Sample data seed failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to seed sample data' }, { status: 500 });
  }
}
