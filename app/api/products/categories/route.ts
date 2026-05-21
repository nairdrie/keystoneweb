import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { requireSiteAccess, SiteAccessDeniedError } from '@/lib/auth/site-access';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * GET    /api/products/categories?siteId=...      List categories + subcategories with product counts.
 * POST   /api/products/categories                  Create a (possibly empty) category or subcategory.
 * PUT    /api/products/categories                  Rename a category or subcategory (cascades to products).
 * DELETE /api/products/categories                  Delete a category or subcategory (uncategorizes products).
 *
 * A "category" is a top-level entry (parent_name = null). A
 * "subcategory" is scoped under a parent category by name, mirroring
 * how products store the (category, subcategory) pair as text.
 *
 * Categories can exist with no products: they are persisted in the
 * product_categories table so they survive between sessions and show
 * up in the product editor's pickers.
 */

async function ensureOwner(siteId: string, request: NextRequest): Promise<
    | { supabase: SupabaseClient; error: null; status: 200 }
    | { supabase: null; error: string; status: 400 | 401 | 403 | 404 | 500 }
> {
    try {
        const { supabase } = await requireSiteAccess(siteId, request);
        return { supabase, error: null, status: 200 };
    } catch (e) {
        if (e instanceof SiteAccessDeniedError) {
            return { supabase: null, error: e.message, status: e.status as 400 | 401 | 403 | 404 };
        }
        return { supabase: null, error: 'Internal error', status: 500 };
    }
}

function normalizeName(input: unknown): string | null {
    if (typeof input !== 'string') return null;
    const trimmed = input.trim();
    if (!trimmed || trimmed.length > 80) return null;
    return trimmed;
}

export async function GET(request: NextRequest) {
    const siteId = request.nextUrl.searchParams.get('siteId');
    if (!siteId) {
        return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    const supabase = await createClient();

    const [{ data: persisted, error: persistedError }, { data: productRows, error: productError }] = await Promise.all([
        supabase
            .from('product_categories')
            .select('name, parent_name')
            .eq('site_id', siteId),
        supabase
            .from('products')
            .select('category, subcategory')
            .eq('site_id', siteId)
            .eq('is_archived', false)
            .not('category', 'is', null),
    ]);

    if (persistedError) return NextResponse.json({ error: persistedError.message }, { status: 500 });
    if (productError) return NextResponse.json({ error: productError.message }, { status: 500 });

    type Node = { name: string; productCount: number; subcategories: Map<string, { name: string; productCount: number }> };
    const tree = new Map<string, Node>();

    const ensureCat = (name: string): Node => {
        let node = tree.get(name);
        if (!node) {
            node = { name, productCount: 0, subcategories: new Map() };
            tree.set(name, node);
        }
        return node;
    };
    const ensureSub = (cat: Node, sub: string) => {
        let node = cat.subcategories.get(sub);
        if (!node) {
            node = { name: sub, productCount: 0 };
            cat.subcategories.set(sub, node);
        }
        return node;
    };

    for (const row of persisted || []) {
        if (!row.name) continue;
        if (row.parent_name) {
            ensureSub(ensureCat(row.parent_name), row.name);
            ensureCat(row.parent_name); // make sure parent exists
        } else {
            ensureCat(row.name);
        }
    }

    for (const row of productRows || []) {
        if (!row.category) continue;
        const cat = ensureCat(row.category);
        cat.productCount += 1;
        if (row.subcategory) ensureSub(cat, row.subcategory).productCount += 1;
    }

    const categories = Array.from(tree.values())
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(c => ({
            name: c.name,
            productCount: c.productCount,
            subcategories: Array.from(c.subcategories.values()).sort((a, b) => a.name.localeCompare(b.name)),
        }));

    return NextResponse.json({ categories });
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    const siteId: string | undefined = body.siteId;
    const name = normalizeName(body.name);
    const parent = body.parent_name === null || body.parent_name === undefined
        ? null
        : normalizeName(body.parent_name);

    if (!siteId) return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    if (!name) return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    if (body.parent_name !== null && body.parent_name !== undefined && !parent) {
        return NextResponse.json({ error: 'Invalid parent_name' }, { status: 400 });
    }

    const auth = await ensureOwner(siteId, request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.supabase!;

    if (parent) {
        // Verify parent exists either as a persisted category or via existing products.
        const [{ data: existingPersisted }, { data: existingProduct }] = await Promise.all([
            supabase
                .from('product_categories')
                .select('id')
                .eq('site_id', siteId)
                .is('parent_name', null)
                .eq('name', parent)
                .maybeSingle(),
            supabase
                .from('products')
                .select('id')
                .eq('site_id', siteId)
                .eq('is_archived', false)
                .eq('category', parent)
                .limit(1)
                .maybeSingle(),
        ]);
        if (!existingPersisted && !existingProduct) {
            return NextResponse.json({ error: 'Parent category does not exist' }, { status: 400 });
        }
    }

    // Manual existence check — partial unique indexes (NULL parent_name vs
    // not-NULL) make a single ON CONFLICT target impractical here.
    let existsQuery = supabase
        .from('product_categories')
        .select('id')
        .eq('site_id', siteId)
        .eq('name', name)
        .limit(1);
    existsQuery = parent === null
        ? existsQuery.is('parent_name', null)
        : existsQuery.eq('parent_name', parent);
    const { data: existingRow } = await existsQuery.maybeSingle();
    if (existingRow) return NextResponse.json({ success: true });

    const { error } = await supabase
        .from('product_categories')
        .insert({ site_id: siteId, name, parent_name: parent });

    if (error && !String(error.message).toLowerCase().includes('duplicate')) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}

export async function PUT(request: NextRequest) {
    const body = await request.json();
    const siteId: string | undefined = body.siteId;
    const oldName = normalizeName(body.oldName);
    const newName = normalizeName(body.newName);
    const parent = body.parent_name === null || body.parent_name === undefined
        ? null
        : normalizeName(body.parent_name);

    if (!siteId) return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    if (!oldName || !newName) return NextResponse.json({ error: 'Missing oldName or newName' }, { status: 400 });
    if (oldName === newName && parent === null) return NextResponse.json({ success: true });

    const auth = await ensureOwner(siteId, request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.supabase!;

    if (parent === null) {
        // Renaming a top-level category.
        const { error: prodErr } = await supabase
            .from('products')
            .update({ category: newName, updated_at: new Date().toISOString() })
            .eq('site_id', siteId)
            .eq('category', oldName);
        if (prodErr) return NextResponse.json({ error: prodErr.message }, { status: 500 });

        // Update the persisted top-level row, if any.
        const { error: catErr } = await supabase
            .from('product_categories')
            .update({ name: newName, updated_at: new Date().toISOString() })
            .eq('site_id', siteId)
            .is('parent_name', null)
            .eq('name', oldName);
        if (catErr && !String(catErr.message).toLowerCase().includes('duplicate')) {
            return NextResponse.json({ error: catErr.message }, { status: 500 });
        }

        // Reparent any persisted subcategories under the renamed parent.
        const { error: subErr } = await supabase
            .from('product_categories')
            .update({ parent_name: newName, updated_at: new Date().toISOString() })
            .eq('site_id', siteId)
            .eq('parent_name', oldName);
        if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });
    } else {
        // Renaming a subcategory under `parent`.
        const { error: prodErr } = await supabase
            .from('products')
            .update({ subcategory: newName, updated_at: new Date().toISOString() })
            .eq('site_id', siteId)
            .eq('category', parent)
            .eq('subcategory', oldName);
        if (prodErr) return NextResponse.json({ error: prodErr.message }, { status: 500 });

        const { error: catErr } = await supabase
            .from('product_categories')
            .update({ name: newName, updated_at: new Date().toISOString() })
            .eq('site_id', siteId)
            .eq('parent_name', parent)
            .eq('name', oldName);
        if (catErr && !String(catErr.message).toLowerCase().includes('duplicate')) {
            return NextResponse.json({ error: catErr.message }, { status: 500 });
        }
    }

    return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
    const siteId = request.nextUrl.searchParams.get('siteId');
    const name = normalizeName(request.nextUrl.searchParams.get('name'));
    const parentRaw = request.nextUrl.searchParams.get('parent_name');
    const parent = parentRaw === null || parentRaw === '' ? null : normalizeName(parentRaw);

    if (!siteId) return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 });

    const auth = await ensureOwner(siteId, request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.supabase!;

    if (parent === null) {
        // Uncategorize all products under this category (also clears their subcategory).
        const { error: prodErr } = await supabase
            .from('products')
            .update({ category: null, subcategory: null, updated_at: new Date().toISOString() })
            .eq('site_id', siteId)
            .eq('category', name);
        if (prodErr) return NextResponse.json({ error: prodErr.message }, { status: 500 });

        // Drop the category and any subcategories from the persisted table.
        const { error: subErr } = await supabase
            .from('product_categories')
            .delete()
            .eq('site_id', siteId)
            .eq('parent_name', name);
        if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });

        const { error: catErr } = await supabase
            .from('product_categories')
            .delete()
            .eq('site_id', siteId)
            .is('parent_name', null)
            .eq('name', name);
        if (catErr) return NextResponse.json({ error: catErr.message }, { status: 500 });
    } else {
        // Uncategorize the subcategory: only clears subcategory, keeps category.
        const { error: prodErr } = await supabase
            .from('products')
            .update({ subcategory: null, updated_at: new Date().toISOString() })
            .eq('site_id', siteId)
            .eq('category', parent)
            .eq('subcategory', name);
        if (prodErr) return NextResponse.json({ error: prodErr.message }, { status: 500 });

        const { error: catErr } = await supabase
            .from('product_categories')
            .delete()
            .eq('site_id', siteId)
            .eq('parent_name', parent)
            .eq('name', name);
        if (catErr) return NextResponse.json({ error: catErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
