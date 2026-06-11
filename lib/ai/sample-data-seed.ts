// Server-side seeding of AI-generated sample content (products, menu items,
// booking services) into the same admin-editable tables users manage.
// Shared between the /api/ai/builder/sample-data route (editor onboarding
// flow) and the ops lead site generator (server-side builds).

import { createAdminClient } from '@/lib/db/supabase-admin';
import type { AiSampleBookingService, AiSampleMenuItem, AiSampleProduct } from '@/lib/ai/sample-data';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

export async function seedSampleProducts(admin: SupabaseAdmin, siteId: string, products: AiSampleProduct[]) {
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

export async function seedSampleMenuItems(admin: SupabaseAdmin, siteId: string, menuItems: AiSampleMenuItem[]) {
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

export async function seedSampleBookingServices(
  admin: SupabaseAdmin,
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

async function ensureBookingSettings(admin: SupabaseAdmin, siteId: string) {
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
