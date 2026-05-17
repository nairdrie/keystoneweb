import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { scanText } from '@/lib/moderation/text-scan';
import { handleModerationResult } from '@/lib/moderation/report';
import { getCurrentMemberFromRequest } from '@/lib/membership/current-member';
import { resolveProductAccess, parseProductOptions } from '@/lib/ecommerce/resolve-price';

/**
 * GET /api/products?siteId=...
 * POST /api/products — Create product (owner)
 * PUT /api/products — Update product (owner)
 * DELETE /api/products?id=... — Delete product (owner)
 */

export async function GET(request: NextRequest) {
    const siteId = request.nextUrl.searchParams.get('siteId');
    if (!siteId) {
        return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    const search = request.nextUrl.searchParams.get('search')?.trim() || '';
    const category = request.nextUrl.searchParams.get('category')?.trim() || '';
    const subcategory = request.nextUrl.searchParams.get('subcategory')?.trim() || '';
    const status = request.nextUrl.searchParams.get('status')?.trim() || '';
    const featuredOnly = request.nextUrl.searchParams.get('featuredOnly') === 'true';
    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '50')));
    const offset = (page - 1) * limit;

    const supabase = await createClient();

    let query = supabase
        .from('products')
        .select('*', { count: 'exact' })
        .eq('site_id', siteId)
        .eq('is_archived', false);

    if (search) {
        const pattern = `%${search}%`;
        query = query.or(`name.ilike.${pattern},description.ilike.${pattern}`);
    }

    if (category) {
        query = query.eq('category', category);
    }

    if (subcategory) {
        query = query.eq('subcategory', subcategory);
    }

    if (featuredOnly) {
        query = query.eq('is_featured', true);
    }

    if (status === 'draft' || status === 'published') {
        query = query.eq('status', status);
    }

    // For public search, only show published active products
    if (search && !status && !category) {
        query = query.eq('is_active', true).eq('status', 'published');
    }

    query = query.order('sort_order', { ascending: true })
        .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch distinct category + subcategory pairs for this site
    // (used to build both the flat categories list and the tree for two-level UI).
    const { data: catData } = await supabase
        .from('products')
        .select('category, subcategory')
        .eq('site_id', siteId)
        .eq('is_archived', false)
        .not('category', 'is', null)
        .order('category');

    // Persisted categories include empty ones the admin added but never
    // attached a product to yet — merge those so pickers show them.
    const { data: persistedCats } = await supabase
        .from('product_categories')
        .select('name, parent_name')
        .eq('site_id', siteId);

    const categorySet = new Set<string>();
    for (const r of catData || []) if (r.category) categorySet.add(r.category);
    for (const r of persistedCats || []) {
        if (r.parent_name) categorySet.add(r.parent_name);
        else if (r.name) categorySet.add(r.name);
    }
    const categories = Array.from(categorySet).sort();

    // Resolve per-product pricing/access for the current member (if any).
    const member = await getCurrentMemberFromRequest(request, siteId);
    const products = (data || []).map(p => {
        const resolved = resolveProductAccess(p, member);
        return {
            ...p,
            effective_price_cents: resolved.priceCents,
            public_price_cents: resolved.publicPriceCents,
            matched_package_id: resolved.matchedPackageId,
            can_purchase: resolved.canPurchase,
            gate_reason: resolved.gateReason,
        };
    });

    const categoryTree: Record<string, string[]> = {};
    for (const row of catData || []) {
        if (!row.category) continue;
        if (!categoryTree[row.category]) categoryTree[row.category] = [];
        if (row.subcategory && !categoryTree[row.category].includes(row.subcategory)) {
            categoryTree[row.category].push(row.subcategory);
        }
    }
    for (const r of persistedCats || []) {
        if (r.parent_name) {
            if (!categoryTree[r.parent_name]) categoryTree[r.parent_name] = [];
            if (r.name && !categoryTree[r.parent_name].includes(r.name)) {
                categoryTree[r.parent_name].push(r.name);
            }
        } else if (r.name && !categoryTree[r.name]) {
            categoryTree[r.name] = [];
        }
    }
    for (const k of Object.keys(categoryTree)) categoryTree[k].sort();

    return NextResponse.json({
        products,
        categories,
        categoryTree,
        pagination: {
            page,
            limit,
            total: count ?? 0,
            totalPages: Math.ceil((count ?? 0) / limit),
        },
    });
}

// Returns the trimmed URL, null if blank/missing, or false if invalid.
function normalizeExternalUrl(value: unknown): string | null | false {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (!/^https?:\/\//i.test(trimmed)) return false;
    return trimmed;
}

/**
 * Validate tier_prices and allowed_package_ids for a product update.
 * Returns a normalized value or an error string.
 */
async function validateMembershipFields(
    siteId: string,
    tierPrices: unknown,
    allowedPackageIds: unknown,
    publicPriceCents: number,
): Promise<{ tierPrices?: Array<{ packageId: string; priceCents: number }>; allowedPackageIds?: string[]; error?: string }> {
    const out: { tierPrices?: Array<{ packageId: string; priceCents: number }>; allowedPackageIds?: string[] } = {};
    const referencedIds = new Set<string>();

    if (tierPrices !== undefined) {
        if (!Array.isArray(tierPrices)) return { error: 'tier_prices must be an array' };
        const normalized: Array<{ packageId: string; priceCents: number }> = [];
        for (const entry of tierPrices) {
            if (!entry || typeof entry !== 'object') return { error: 'Invalid tier_prices entry' };
            const packageId = (entry as any).packageId;
            const priceCents = (entry as any).priceCents;
            if (typeof packageId !== 'string' || !packageId) return { error: 'Invalid tier_prices.packageId' };
            if (typeof priceCents !== 'number' || !Number.isFinite(priceCents) || priceCents < 0) {
                return { error: 'Invalid tier_prices.priceCents' };
            }
            if (priceCents > publicPriceCents) {
                return { error: 'Tier price cannot exceed the public price' };
            }
            referencedIds.add(packageId);
            normalized.push({ packageId, priceCents: Math.round(priceCents) });
        }
        out.tierPrices = normalized;
    }

    if (allowedPackageIds !== undefined) {
        if (!Array.isArray(allowedPackageIds)) return { error: 'allowed_package_ids must be an array' };
        const normalized: string[] = [];
        for (const id of allowedPackageIds) {
            if (typeof id !== 'string' || !id) return { error: 'Invalid allowed_package_ids entry' };
            referencedIds.add(id);
            normalized.push(id);
        }
        out.allowedPackageIds = normalized;
    }

    if (referencedIds.size > 0) {
        const admin = createAdminClient();
        const { data: pkgs, error } = await admin
            .from('membership_packages')
            .select('id')
            .eq('site_id', siteId)
            .in('id', Array.from(referencedIds));
        if (error) return { error: 'Failed to validate membership packages' };
        const validIds = new Set((pkgs || []).map((p: any) => p.id));
        for (const id of referencedIds) {
            if (!validIds.has(id)) return { error: `Package ${id} does not belong to this site` };
        }
    }

    return out;
}

export async function POST(request: NextRequest) {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteId, name, brand, description, price_cents, compare_at_cents, currency, images, variants, options, inventory_count, vendor_id, category, subcategory, tags, tier_prices, allowed_package_ids, external_url, is_featured, weight_grams, length_mm, width_mm, height_mm } = body;

    if (!siteId || !name) {
        return NextResponse.json({ error: 'Missing siteId or name' }, { status: 400 });
    }

    const normalizedExternalUrl = normalizeExternalUrl(external_url);
    if (normalizedExternalUrl === false) {
        return NextResponse.json({ error: 'External URL must start with http:// or https://' }, { status: 400 });
    }

    // Verify ownership
    const { data: site } = await supabase.from('sites').select('user_id').eq('id', siteId).single();
    if (!site || site.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const membershipValidation = await validateMembershipFields(
        siteId,
        tier_prices,
        allowed_package_ids,
        price_cents || 0,
    );
    if (membershipValidation.error) {
        return NextResponse.json({ error: membershipValidation.error }, { status: 400 });
    }

    // Scan product text for illegal content before storing
    const textToScan = [name, description].filter(Boolean).join('\n\n');
    const textScanResult = await scanText(textToScan);
    if (textScanResult.flagged) {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            ?? request.headers.get('x-real-ip')
            ?? null;
        await handleModerationResult(
            { ...textScanResult, severity: 'review' as const },
            {
                siteId:      siteId,
                userId:      user.id,
                ipAddress:   ip,
                contentType: 'text',
                contentRef:  null,
                contentHash: null,
            }
        );
        return NextResponse.json({ error: 'Content policy violation' }, { status: 422 });
    }

    // Generate slug
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Get max sort_order
    const { data: existing } = await supabase
        .from('products')
        .select('sort_order')
        .eq('site_id', siteId)
        .order('sort_order', { ascending: false })
        .limit(1);

    const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

    const { data, error } = await supabase
        .from('products')
        .insert({
            site_id: siteId,
            name,
            brand: brand || null,
            description: description || null,
            price_cents: price_cents || 0,
            compare_at_cents: compare_at_cents || null,
            currency: currency || 'CAD',
            images: images || [],
            variants: variants || [],
            options: parseProductOptions(options),
            inventory_count: inventory_count ?? -1,
            vendor_id: vendor_id || null,
            category: category || null,
            subcategory: subcategory || null,
            tags: Array.isArray(tags) ? tags : [],
            slug,
            sort_order: nextOrder,
            tier_prices: membershipValidation.tierPrices ?? [],
            allowed_package_ids: membershipValidation.allowedPackageIds ?? [],
            external_url: normalizedExternalUrl,
            is_featured: !!is_featured,
            weight_grams: typeof weight_grams === 'number' && weight_grams >= 0 ? Math.round(weight_grams) : null,
            length_mm: typeof length_mm === 'number' && length_mm >= 0 ? Math.round(length_mm) : null,
            width_mm: typeof width_mm === 'number' && width_mm >= 0 ? Math.round(width_mm) : null,
            height_mm: typeof height_mm === 'number' && height_mm >= 0 ? Math.round(height_mm) : null,
        })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ product: data });
}

export async function PUT(request: NextRequest) {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...fields } = body;

    // Bulk publish all drafts for a site (no id needed)
    if (fields.siteId && fields.publishAll === true) {
        const { data: site } = await supabase.from('sites').select('user_id').eq('id', fields.siteId).single();
        if (!site || site.user_id !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const { error: pubError } = await supabase
            .from('products')
            .update({ status: 'published', updated_at: new Date().toISOString() })
            .eq('site_id', fields.siteId)
            .eq('status', 'draft')
            .eq('is_archived', false);
        if (pubError) return NextResponse.json({ error: pubError.message }, { status: 500 });
        return NextResponse.json({ success: true });
    }

    // Bulk edit — ids[] takes priority over single id
    const ids: string[] | undefined = Array.isArray(fields.ids) && fields.ids.length > 0 ? fields.ids : undefined;
    delete fields.ids;

    if (!id && !ids) {
        return NextResponse.json({ error: 'Missing product id' }, { status: 400 });
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };

    const allowedFields = ['name', 'brand', 'description', 'price_cents', 'compare_at_cents', 'currency', 'images', 'variants', 'inventory_count', 'is_active', 'is_featured', 'sort_order', 'status', 'category', 'subcategory', 'tags', 'vendor_id', 'weight_grams', 'length_mm', 'width_mm', 'height_mm'];

    for (const key of allowedFields) {
        if (fields[key] !== undefined) updates[key] = fields[key];
    }

    if (fields.external_url !== undefined) {
        const normalized = normalizeExternalUrl(fields.external_url);
        if (normalized === false) {
            return NextResponse.json({ error: 'External URL must start with http:// or https://' }, { status: 400 });
        }
        updates.external_url = normalized;
    }

    if (fields.options !== undefined) {
        updates.options = parseProductOptions(fields.options);
    }

    // Regenerate slug if name changed (single-product only)
    if (!ids && fields.name) {
        updates.slug = fields.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }

    // Validate and apply membership pricing / gating updates, if provided.
    // Not supported in bulk mode — bulk path skips this block.
    if (!ids && (fields.tier_prices !== undefined || fields.allowed_package_ids !== undefined)) {
        const { data: existing, error: existingError } = await supabase
            .from('products')
            .select('site_id, price_cents')
            .eq('id', id)
            .single();
        if (existingError || !existing) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }
        const { data: siteOwner } = await supabase.from('sites').select('user_id').eq('id', existing.site_id).single();
        if (!siteOwner || siteOwner.user_id !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const publicPriceCents = updates.price_cents ?? existing.price_cents ?? 0;
        const membershipValidation = await validateMembershipFields(
            existing.site_id,
            fields.tier_prices,
            fields.allowed_package_ids,
            publicPriceCents,
        );
        if (membershipValidation.error) {
            return NextResponse.json({ error: membershipValidation.error }, { status: 400 });
        }
        if (membershipValidation.tierPrices !== undefined) updates.tier_prices = membershipValidation.tierPrices;
        if (membershipValidation.allowedPackageIds !== undefined) updates.allowed_package_ids = membershipValidation.allowedPackageIds;
    }

    // Bulk update path
    if (ids) {
        // Load all selected rows in one shot — needed both for ownership verification
        // and to compute per-row tier prices (which depend on each product's public price).
        const { data: bulkRows, error: bulkRowsError } = await supabase
            .from('products')
            .select('id, site_id, price_cents, tier_prices')
            .in('id', ids);
        if (bulkRowsError || !bulkRows || bulkRows.length === 0) {
            return NextResponse.json({ error: 'Products not found' }, { status: 404 });
        }
        const siteIds = new Set(bulkRows.map(r => r.site_id));
        if (siteIds.size !== 1) {
            return NextResponse.json({ error: 'All products must belong to the same site' }, { status: 400 });
        }
        const bulkSiteId = bulkRows[0].site_id;
        const { data: siteOwner } = await supabase
            .from('sites')
            .select('user_id')
            .eq('id', bulkSiteId)
            .single();
        if (!siteOwner || siteOwner.user_id !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Membership pricing bulk operation. Either { clear: true } or { tiers: [{ packageId, absoluteCents?, percentOff? }] }.
        // We compute per-row tier_prices because the clamp-to-public-price invariant
        // depends on each product's own price.
        let perRowTierPrices: Map<string, Array<{ packageId: string; priceCents: number }>> | null = null;
        if (fields.member_pricing !== undefined) {
            const mp = fields.member_pricing;
            if (!mp || typeof mp !== 'object') {
                return NextResponse.json({ error: 'Invalid member_pricing' }, { status: 400 });
            }
            if (mp.clear === true) {
                perRowTierPrices = new Map(bulkRows.map(r => [r.id, []]));
            } else {
                const tiers = mp.tiers;
                if (!Array.isArray(tiers) || tiers.length === 0) {
                    return NextResponse.json({ error: 'member_pricing.tiers must be a non-empty array' }, { status: 400 });
                }
                const referencedPackageIds = new Set<string>();
                for (const t of tiers) {
                    if (!t || typeof t !== 'object' || typeof t.packageId !== 'string' || !t.packageId) {
                        return NextResponse.json({ error: 'Invalid member_pricing tier entry' }, { status: 400 });
                    }
                    const hasAbs = typeof t.absoluteCents === 'number' && Number.isFinite(t.absoluteCents) && t.absoluteCents >= 0;
                    const hasPct = typeof t.percentOff === 'number' && Number.isFinite(t.percentOff) && t.percentOff >= 0 && t.percentOff <= 100;
                    if (!hasAbs && !hasPct) {
                        return NextResponse.json({ error: 'Each tier must specify absoluteCents (>=0) or percentOff (0–100)' }, { status: 400 });
                    }
                    referencedPackageIds.add(t.packageId);
                }
                // Validate all referenced packages belong to this site.
                const admin = createAdminClient();
                const { data: pkgs, error: pkgErr } = await admin
                    .from('membership_packages')
                    .select('id')
                    .eq('site_id', bulkSiteId)
                    .in('id', Array.from(referencedPackageIds));
                if (pkgErr) {
                    return NextResponse.json({ error: 'Failed to validate membership packages' }, { status: 500 });
                }
                const validIds = new Set((pkgs || []).map((p: any) => p.id));
                for (const id of referencedPackageIds) {
                    if (!validIds.has(id)) {
                        return NextResponse.json({ error: `Package ${id} does not belong to this site` }, { status: 400 });
                    }
                }

                perRowTierPrices = new Map();
                for (const row of bulkRows) {
                    const publicCents = Math.max(0, Math.round(row.price_cents ?? 0));
                    // Start from existing entries for packages that aren't being overridden.
                    const existing = Array.isArray(row.tier_prices) ? row.tier_prices as Array<{ packageId: string; priceCents: number }> : [];
                    const next: Array<{ packageId: string; priceCents: number }> = [];
                    const overridden = new Set(tiers.map((t: any) => t.packageId));
                    for (const e of existing) {
                        if (e && typeof e.packageId === 'string' && !overridden.has(e.packageId)) {
                            next.push({ packageId: e.packageId, priceCents: Math.min(Math.max(0, Math.round(e.priceCents ?? 0)), publicCents) });
                        }
                    }
                    for (const t of tiers as Array<{ packageId: string; absoluteCents?: number; percentOff?: number }>) {
                        let cents: number;
                        if (typeof t.absoluteCents === 'number') {
                            cents = Math.round(t.absoluteCents);
                        } else {
                            cents = Math.round(publicCents * (1 - (t.percentOff ?? 0) / 100));
                        }
                        cents = Math.max(0, Math.min(cents, publicCents));
                        next.push({ packageId: t.packageId, priceCents: cents });
                    }
                    perRowTierPrices.set(row.id, next);
                }
            }
        }

        // Bulk allowed_package_ids — applied uniformly across all selected products.
        if (fields.allowed_package_ids !== undefined) {
            if (!Array.isArray(fields.allowed_package_ids)) {
                return NextResponse.json({ error: 'allowed_package_ids must be an array' }, { status: 400 });
            }
            const ids: string[] = [];
            for (const v of fields.allowed_package_ids) {
                if (typeof v !== 'string' || !v) {
                    return NextResponse.json({ error: 'Invalid allowed_package_ids entry' }, { status: 400 });
                }
                ids.push(v);
            }
            if (ids.length > 0) {
                const admin = createAdminClient();
                const { data: pkgs } = await admin
                    .from('membership_packages')
                    .select('id')
                    .eq('site_id', bulkSiteId)
                    .in('id', ids);
                const validIds = new Set((pkgs || []).map((p: any) => p.id));
                for (const id of ids) {
                    if (!validIds.has(id)) {
                        return NextResponse.json({ error: `Package ${id} does not belong to this site` }, { status: 400 });
                    }
                }
            }
            updates.allowed_package_ids = ids;
        }

        // If we have per-row tier prices, we need per-row updates. Otherwise a single
        // .in('id', ids) update is enough.
        if (perRowTierPrices) {
            for (const [rowId, tierPrices] of perRowTierPrices) {
                const rowUpdate = { ...updates, tier_prices: tierPrices };
                const { error: rowErr } = await supabase
                    .from('products')
                    .update(rowUpdate)
                    .eq('id', rowId);
                if (rowErr) {
                    return NextResponse.json({ error: rowErr.message }, { status: 500 });
                }
            }
            return NextResponse.json({ success: true, updated: perRowTierPrices.size });
        }

        const { error: bulkError } = await supabase
            .from('products')
            .update(updates)
            .in('id', ids);
        if (bulkError) {
            return NextResponse.json({ error: bulkError.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, updated: ids.length });
    }

    const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ product: data });
}

export async function DELETE(request: NextRequest) {
    const productId = request.nextUrl.searchParams.get('id');
    if (!productId) {
        return NextResponse.json({ error: 'Missing product id' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
        .from('products')
        .update({ is_archived: true, archived_on: new Date().toISOString() })
        .eq('id', productId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
