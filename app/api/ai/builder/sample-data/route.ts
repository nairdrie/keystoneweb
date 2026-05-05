import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { sanitizeAiSampleDataPayload } from '@/lib/ai/sample-data';
import type { AiSampleBookingService, AiSampleMenuItem, AiSampleProduct } from '@/lib/ai/sample-data';

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
      products: samples.products?.length ? await seedProducts(admin, siteId, samples.products) : 0,
      menuItems: samples.menuItems?.length ? await seedMenuItems(admin, siteId, samples.menuItems) : 0,
      bookingServices: samples.bookingServices?.length ? await seedBookingServices(admin, siteId, samples.bookingServices) : 0,
    };

    return NextResponse.json({ seeded });
  } catch (error: any) {
    console.error('[AI Builder] Sample data seed failed:', error?.message || error);
    return NextResponse.json({ error: 'Failed to seed sample data' }, { status: 500 });
  }
}

async function seedProducts(admin: ReturnType<typeof createAdminClient>, siteId: string, products: AiSampleProduct[]) {
  const { count, error: countError } = await admin
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .eq('is_archived', false);

  if (countError) throw countError;
  if ((count ?? 0) > 0) return 0;

  const rows = products.map((product, index) => ({
    site_id: siteId,
    name: product.name,
    brand: product.brand || null,
    description: product.description || null,
    price_cents: product.price_cents,
    compare_at_cents: product.compare_at_cents || null,
    currency: product.currency || 'CAD',
    images: product.images || [],
    variants: [],
    options: [],
    inventory_count: -1,
    is_active: true,
    is_featured: product.is_featured === true,
    status: 'published',
    category: product.category || null,
    subcategory: product.subcategory || null,
    tags: product.tags || [],
    slug: `${slugify(product.name)}-${index + 1}`,
    sort_order: index,
  }));

  const { error } = await admin.from('products').insert(rows);
  if (error) throw error;
  return rows.length;
}

async function seedMenuItems(admin: ReturnType<typeof createAdminClient>, siteId: string, menuItems: AiSampleMenuItem[]) {
  const { count, error: countError } = await admin
    .from('menu_items')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .eq('is_archived', false);

  if (countError) throw countError;
  if ((count ?? 0) > 0) return 0;

  const sections = Array.from(
    new Map(menuItems.map((item) => [
      item.menu_section,
      {
        site_id: siteId,
        name: item.menu_section,
        sort_order: item.menu_section_order,
      },
    ])).values(),
  );

  if (sections.length > 0) {
    const { error: sectionError } = await admin
      .from('menu_sections')
      .upsert(sections, { onConflict: 'site_id,name' });
    if (sectionError && !/menu_sections/i.test(sectionError.message)) {
      throw sectionError;
    }
  }

  const rows = menuItems.map((item) => ({
    site_id: siteId,
    menu_section: item.menu_section,
    menu_section_order: item.menu_section_order,
    name: item.name,
    description: item.description || null,
    price: item.price || null,
    category: item.category,
    category_order: item.category_order,
    image_url: item.image_url || null,
    is_available: true,
    is_featured: item.is_featured === true,
    icon_tags: item.icon_tags || [],
    sort_order: item.sort_order,
  }));

  const { error } = await admin.from('menu_items').insert(rows);
  if (error) throw error;
  return rows.length;
}

async function seedBookingServices(
  admin: ReturnType<typeof createAdminClient>,
  siteId: string,
  bookingServices: AiSampleBookingService[],
) {
  const { count, error: countError } = await admin
    .from('booking_services')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .eq('is_archived', false);

  if (countError) throw countError;
  if ((count ?? 0) > 0) return 0;

  await ensureBookingSettings(admin, siteId);

  const rows = bookingServices.map((service, index) => ({
    site_id: siteId,
    name: service.name,
    description: service.description || null,
    duration_minutes: service.duration_minutes || 30,
    price_cents: service.price_cents || 0,
    currency: service.currency || 'CAD',
    is_active: true,
    is_featured: service.is_featured === true,
    compare_at_price_cents: service.compare_at_price_cents || null,
    options: service.options?.length ? service.options : null,
    options_required: service.options_required !== false,
    status: 'published',
    sort_order: service.sort_order ?? index,
  }));

  const { error } = await admin.from('booking_services').insert(rows);
  if (error) throw error;
  return rows.length;
}

async function ensureBookingSettings(admin: ReturnType<typeof createAdminClient>, siteId: string) {
  const { error } = await admin
    .from('booking_settings')
    .upsert({
      site_id: siteId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'site_id' });

  if (error) throw error;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80) || 'sample-product';
}
