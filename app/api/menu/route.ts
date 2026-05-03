import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';

const MENU_ICON_PICKER_IDS = new Set([
  'wheat-off',
  'leaf',
  'vegan',
  'flame',
  'sprout',
  'salad',
  'sandwich',
  'soup',
  'pizza',
  'milk',
  'nut',
  'fish',
  'egg',
  'star',
  'heart',
  'coffee',
  'circle',
]);

function sanitizeMenuIconTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value
      .filter((tag): tag is string => typeof tag === 'string')
      .map(tag => tag.trim())
      .filter(Boolean)
      .slice(0, 20),
  ));
}

function sanitizeMenuIconName(value: unknown): string {
  const icon = typeof value === 'string' ? value.trim() : '';
  return MENU_ICON_PICKER_IDS.has(icon) ? icon : 'circle';
}

function sanitizeMenuIconLabel(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 48) : '';
}

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

  const { data: sections } = await supabase
    .from('menu_sections')
    .select('id, name, sort_order')
    .eq('site_id', siteId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  const { data: iconOptions } = await supabase
    .from('menu_icon_options')
    .select('id, label, icon, sort_order')
    .eq('site_id', siteId)
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true });

  return NextResponse.json({ items: data ?? [], sections: sections ?? [], iconOptions: iconOptions ?? [] });
}

// POST /api/menu — create item (owner only)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const action = body?.action;

  if (action === 'create-menu-section') {
    const { siteId, name } = body;
    const sectionName = typeof name === 'string' ? name.trim() : '';
    if (!siteId || !sectionName) return NextResponse.json({ error: 'Missing siteId or menu name' }, { status: 400 });

    const { data: site } = await supabase.from('sites').select('user_id').eq('id', siteId).single();
    if (!site || site.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data: existingSection } = await supabase
      .from('menu_sections')
      .select('id')
      .eq('site_id', siteId)
      .ilike('name', sectionName)
      .limit(1);

    if (existingSection && existingSection.length > 0) {
      return NextResponse.json({ error: 'A menu with this name already exists.' }, { status: 409 });
    }

    const { data: existingItemsSection } = await supabase
      .from('menu_items')
      .select('menu_section')
      .eq('site_id', siteId)
      .ilike('menu_section', sectionName)
      .eq('is_archived', false)
      .limit(1);

    if (existingItemsSection && existingItemsSection.length > 0) {
      return NextResponse.json({ error: 'A menu with this name already exists.' }, { status: 409 });
    }

    const { data: lastSection } = await supabase
      .from('menu_sections')
      .select('sort_order')
      .eq('site_id', siteId)
      .order('sort_order', { ascending: false })
      .limit(1);

    const { data: lastItemSection } = await supabase
      .from('menu_items')
      .select('menu_section_order')
      .eq('site_id', siteId)
      .order('menu_section_order', { ascending: false })
      .limit(1);

    const nextOrder = Math.max(
      lastSection?.[0]?.sort_order ?? -1,
      lastItemSection?.[0]?.menu_section_order ?? -1,
    ) + 1;

    const { data: section, error } = await supabase
      .from('menu_sections')
      .insert({ site_id: siteId, name: sectionName, sort_order: nextOrder })
      .select('id, name, sort_order')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ section }, { status: 201 });
  }

  if (action === 'reorder-menu-sections') {
    const { siteId, sections } = body;
    if (!siteId || !Array.isArray(sections)) return NextResponse.json({ error: 'Missing siteId or sections' }, { status: 400 });

    const { data: site } = await supabase.from('sites').select('user_id').eq('id', siteId).single();
    if (!site || site.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const rows = sections
      .map((name: unknown, index: number) => typeof name === 'string' ? { site_id: siteId, name: name.trim(), sort_order: index } : null)
      .filter((row: { site_id: string; name: string; sort_order: number } | null): row is { site_id: string; name: string; sort_order: number } => !!row && row.name.length > 0);

    if (rows.length === 0) return NextResponse.json({ sections: [] });

    const { data: updatedSections, error } = await supabase
      .from('menu_sections')
      .upsert(rows, { onConflict: 'site_id,name' })
      .select('id, name, sort_order');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ sections: updatedSections ?? [] });
  }

  if (action === 'delete-menu-section') {
    const { siteId, name } = body;
    const sectionName = typeof name === 'string' ? name.trim() : '';
    if (!siteId || !sectionName) return NextResponse.json({ error: 'Missing siteId or menu name' }, { status: 400 });

    const { data: site } = await supabase.from('sites').select('user_id').eq('id', siteId).single();
    if (!site || site.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const archivedOn = new Date().toISOString();
    const { error: itemError } = await supabase
      .from('menu_items')
      .update({ is_archived: true, archived_on: archivedOn })
      .eq('site_id', siteId)
      .eq('menu_section', sectionName)
      .eq('is_archived', false);

    if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 });

    const { error: sectionError } = await supabase
      .from('menu_sections')
      .delete()
      .eq('site_id', siteId)
      .eq('name', sectionName);

    if (sectionError) return NextResponse.json({ error: sectionError.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'delete-menu-category') {
    const { siteId, menu_section, category } = body;
    const sectionName = typeof menu_section === 'string' && menu_section.trim() ? menu_section.trim() : 'Main Menu';
    const categoryName = typeof category === 'string' ? category.trim() : '';
    if (!siteId || !categoryName) return NextResponse.json({ error: 'Missing siteId or category name' }, { status: 400 });

    const { data: site } = await supabase.from('sites').select('user_id').eq('id', siteId).single();
    if (!site || site.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { error } = await supabase
      .from('menu_items')
      .update({ is_archived: true, archived_on: new Date().toISOString() })
      .eq('site_id', siteId)
      .eq('menu_section', sectionName)
      .eq('category', categoryName)
      .eq('is_archived', false);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'create-menu-icon-option') {
    const { siteId, label, icon } = body;
    const optionLabel = sanitizeMenuIconLabel(label);
    if (!siteId || !optionLabel) return NextResponse.json({ error: 'Missing siteId or icon label' }, { status: 400 });

    const { data: site } = await supabase.from('sites').select('user_id').eq('id', siteId).single();
    if (!site || site.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data: lastOption } = await supabase
      .from('menu_icon_options')
      .select('sort_order')
      .eq('site_id', siteId)
      .order('sort_order', { ascending: false })
      .limit(1);

    const { data: option, error } = await supabase
      .from('menu_icon_options')
      .insert({
        site_id: siteId,
        label: optionLabel,
        icon: sanitizeMenuIconName(icon),
        sort_order: (lastOption?.[0]?.sort_order ?? -1) + 1,
      })
      .select('id, label, icon, sort_order')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ option }, { status: 201 });
  }

  if (action === 'update-menu-icon-option') {
    const { siteId, id, label, icon } = body;
    const optionLabel = sanitizeMenuIconLabel(label);
    if (!siteId || !id || !optionLabel) return NextResponse.json({ error: 'Missing icon option details' }, { status: 400 });

    const { data: site } = await supabase.from('sites').select('user_id').eq('id', siteId).single();
    if (!site || site.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data: option, error } = await supabase
      .from('menu_icon_options')
      .update({ label: optionLabel, icon: sanitizeMenuIconName(icon) })
      .eq('id', id)
      .eq('site_id', siteId)
      .select('id, label, icon, sort_order')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ option });
  }

  if (action === 'delete-menu-icon-option') {
    const { siteId, id } = body;
    if (!siteId || !id) return NextResponse.json({ error: 'Missing icon option details' }, { status: 400 });

    const { data: site } = await supabase.from('sites').select('user_id').eq('id', siteId).single();
    if (!site || site.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { error } = await supabase
      .from('menu_icon_options')
      .delete()
      .eq('id', id)
      .eq('site_id', siteId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  const { siteId, menu_section, menu_section_order, name, description, price, category, category_order, image_url, is_available, is_featured, icon_tags } = body;
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

  await supabase
    .from('menu_sections')
    .upsert({ site_id: siteId, name: sectionName, sort_order: sectionOrder }, { onConflict: 'site_id,name' });

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
      icon_tags: sanitizeMenuIconTags(icon_tags),
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
  const { id, siteId, menu_section, menu_section_order, name, description, price, category, category_order, image_url, is_available, is_featured, icon_tags, sort_order } = body;
  if (!id || !siteId) return NextResponse.json({ error: 'Missing id or siteId' }, { status: 400 });

  const { data: site } = await supabase.from('sites').select('user_id').eq('id', siteId).single();
  if (!site || site.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const updates: Record<string, string | number | boolean | null | string[]> = {};
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
  if (icon_tags !== undefined) updates.icon_tags = sanitizeMenuIconTags(icon_tags);
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
