import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Menu Items API
 *
 * Required Supabase table (run once in dashboard):
 *
 *   CREATE TABLE menu_items (
 *     id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     site_id     UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
 *     menu_section TEXT NOT NULL DEFAULT 'Main Menu',
 *     menu_section_order INTEGER NOT NULL DEFAULT 0,
 *     name        TEXT NOT NULL,
 *     description TEXT,
 *     price       TEXT,
 *     category    TEXT NOT NULL DEFAULT 'General',
 *     category_order INTEGER NOT NULL DEFAULT 0,
 *     image_url   TEXT,
 *     is_available BOOLEAN NOT NULL DEFAULT true,
 *     is_featured BOOLEAN NOT NULL DEFAULT false,
 *     sort_order  INTEGER NOT NULL DEFAULT 0,
 *     created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
 *   );
 *
 *   CREATE INDEX ON menu_items (site_id, sort_order);
 *   ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
 *
 *   -- Public read (live site display)
 *   CREATE POLICY "Public read menu items"
 *     ON menu_items FOR SELECT USING (true);
 *
 *   -- Owner write
 *   CREATE POLICY "Owner manage menu items"
 *     ON menu_items FOR ALL
 *     USING (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));
 */

// GET /api/menu?siteId=<id>
export async function GET(request: NextRequest) {
  const siteId = request.nextUrl.searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .eq('site_id', siteId)
    .eq('is_archived', false)
    .order('menu_section_order', { ascending: true })
    .order('menu_section', { ascending: true })
    .order('category_order', { ascending: true })
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data ?? [] });
}

// POST /api/menu — create item (owner only)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { siteId, menu_section, menu_section_order, name, description, price, category, category_order, image_url, is_available, is_featured } = body;
  if (!siteId || !name) return NextResponse.json({ error: 'Missing siteId or name' }, { status: 400 });

  const { data: site } = await supabase.from('sites').select('user_id').eq('id', siteId).single();
  if (!site || site.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const sectionName = menu_section || 'Main Menu';

  const { data: existingSection } = await supabase
    .from('menu_items')
    .select('menu_section_order')
    .eq('site_id', siteId)
    .eq('menu_section', sectionName)
    .limit(1);

  const { data: lastSection } = await supabase
    .from('menu_items')
    .select('menu_section_order')
    .eq('site_id', siteId)
    .order('menu_section_order', { ascending: false })
    .limit(1);

  const sectionOrder = menu_section_order ?? existingSection?.[0]?.menu_section_order ?? ((lastSection?.[0]?.menu_section_order ?? -1) + 1);
  const categoryName = category || 'General';

  const { data: existingCategory } = await supabase
    .from('menu_items')
    .select('category_order')
    .eq('site_id', siteId)
    .eq('menu_section', sectionName)
    .eq('category', categoryName)
    .limit(1);

  const { data: lastCategory } = await supabase
    .from('menu_items')
    .select('category_order')
    .eq('site_id', siteId)
    .eq('menu_section', sectionName)
    .order('category_order', { ascending: false })
    .limit(1);

  const categoryOrder = category_order ?? existingCategory?.[0]?.category_order ?? ((lastCategory?.[0]?.category_order ?? -1) + 1);

  // Get next sort_order for this category
  const { data: existing } = await supabase
    .from('menu_items')
    .select('sort_order')
    .eq('site_id', siteId)
    .eq('menu_section', sectionName)
    .eq('category', categoryName)
    .order('sort_order', { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? (existing[0].sort_order + 1) : 0;

  const { data: item, error } = await supabase
    .from('menu_items')
    .insert({
      site_id: siteId,
      menu_section: sectionName,
      menu_section_order: sectionOrder,
      name,
      description: description || null,
      price: price || null,
      category: categoryName,
      category_order: categoryOrder,
      image_url: image_url || null,
      is_available: is_available !== false,
      is_featured: is_featured === true,
      sort_order: nextOrder,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ item }, { status: 201 });
}

// PUT /api/menu — update item (owner only)
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { id, siteId, menu_section, menu_section_order, name, description, price, category, category_order, image_url, is_available, is_featured, sort_order } = body;
  if (!id || !siteId) return NextResponse.json({ error: 'Missing id or siteId' }, { status: 400 });

  const { data: site } = await supabase.from('sites').select('user_id').eq('id', siteId).single();
  if (!site || site.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const updates: Record<string, string | number | boolean | null> = {};
  if (menu_section !== undefined) {
    const sectionName = menu_section || 'Main Menu';
    updates.menu_section = sectionName;

    if (menu_section_order === undefined) {
      const { data: existingSection } = await supabase
        .from('menu_items')
        .select('menu_section_order')
        .eq('site_id', siteId)
        .eq('menu_section', sectionName)
        .limit(1);

      const { data: lastSection } = await supabase
        .from('menu_items')
        .select('menu_section_order')
        .eq('site_id', siteId)
        .order('menu_section_order', { ascending: false })
        .limit(1);

      updates.menu_section_order = existingSection?.[0]?.menu_section_order ?? ((lastSection?.[0]?.menu_section_order ?? -1) + 1);
    }
  }
  if (menu_section_order !== undefined) updates.menu_section_order = menu_section_order;
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description || null;
  if (price !== undefined) updates.price = price || null;
  if (category !== undefined) {
    const categoryName = category || 'General';
    updates.category = categoryName;

    if (category_order === undefined) {
      let sectionName = typeof updates.menu_section === 'string' ? updates.menu_section : null;
      if (!sectionName) {
        const { data: currentItem } = await supabase
          .from('menu_items')
          .select('menu_section')
          .eq('id', id)
          .eq('site_id', siteId)
          .single();
        sectionName = currentItem?.menu_section || 'Main Menu';
      }

      const { data: existingCategory } = await supabase
        .from('menu_items')
        .select('category_order')
        .eq('site_id', siteId)
        .eq('menu_section', sectionName)
        .eq('category', categoryName)
        .limit(1);

      const { data: lastCategory } = await supabase
        .from('menu_items')
        .select('category_order')
        .eq('site_id', siteId)
        .eq('menu_section', sectionName)
        .order('category_order', { ascending: false })
        .limit(1);

      updates.category_order = existingCategory?.[0]?.category_order ?? ((lastCategory?.[0]?.category_order ?? -1) + 1);
    }
  }
  if (category_order !== undefined) updates.category_order = category_order;
  if (image_url !== undefined) updates.image_url = image_url || null;
  if (is_available !== undefined) updates.is_available = is_available;
  if (is_featured !== undefined) updates.is_featured = is_featured;
  if (sort_order !== undefined) updates.sort_order = sort_order;

  const { data: item, error } = await supabase
    .from('menu_items')
    .update(updates)
    .eq('id', id)
    .eq('site_id', siteId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ item });
}

// DELETE /api/menu?id=<id>&siteId=<siteId> — delete item (owner only)
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = request.nextUrl.searchParams.get('id');
  const siteId = request.nextUrl.searchParams.get('siteId');
  if (!id || !siteId) return NextResponse.json({ error: 'Missing id or siteId' }, { status: 400 });

  const { data: site } = await supabase.from('sites').select('user_id').eq('id', siteId).single();
  if (!site || site.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { error } = await supabase
    .from('menu_items')
    .update({ is_archived: true, archived_on: new Date().toISOString() })
    .eq('id', id)
    .eq('site_id', siteId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
