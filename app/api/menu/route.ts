import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Menu Items API
 *
 * Required Supabase table (run once in dashboard):
 *
 *   CREATE TABLE menu_items (
 *     id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     site_id     UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
 *     name        TEXT NOT NULL,
 *     description TEXT,
 *     price       TEXT,
 *     category    TEXT NOT NULL DEFAULT 'General',
 *     image_url   TEXT,
 *     is_available BOOLEAN NOT NULL DEFAULT true,
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

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .eq('site_id', siteId)
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
  const { siteId, name, description, price, category, image_url, is_available } = body;
  if (!siteId || !name) return NextResponse.json({ error: 'Missing siteId or name' }, { status: 400 });

  const { data: site } = await supabase.from('sites').select('user_id').eq('id', siteId).single();
  if (!site || site.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Get next sort_order for this category
  const { data: existing } = await supabase
    .from('menu_items')
    .select('sort_order')
    .eq('site_id', siteId)
    .eq('category', category || 'General')
    .order('sort_order', { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? (existing[0].sort_order + 1) : 0;

  const { data: item, error } = await supabase
    .from('menu_items')
    .insert({
      site_id: siteId,
      name,
      description: description || null,
      price: price || null,
      category: category || 'General',
      image_url: image_url || null,
      is_available: is_available !== false,
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
  const { id, siteId, name, description, price, category, image_url, is_available, sort_order } = body;
  if (!id || !siteId) return NextResponse.json({ error: 'Missing id or siteId' }, { status: 400 });

  const { data: site } = await supabase.from('sites').select('user_id').eq('id', siteId).single();
  if (!site || site.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const updates: Record<string, any> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description || null;
  if (price !== undefined) updates.price = price || null;
  if (category !== undefined) updates.category = category || 'General';
  if (image_url !== undefined) updates.image_url = image_url || null;
  if (is_available !== undefined) updates.is_available = is_available;
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
    .delete()
    .eq('id', id)
    .eq('site_id', siteId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
