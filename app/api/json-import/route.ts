import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { downloadAndUploadImages } from '@/lib/ecommerce/import-images';

// ─── Types ───────────────────────────────────────────────────────────────────

interface JsonProduct {
    sourceUrl?: string;
    canonicalUrl?: string;
    productName?: string;
    shortDescription?: string;
    fullDescription?: string;
    price?: string;
    compareAtPrice?: string;
    currency?: string;
    sku?: string;
    brand?: string;
    category?: string;
    tags?: string[];
    mainImageUrl?: string;
    additionalImageUrls?: string[];
    availability?: string;
    variants?: any[];
}

interface JsonImportFile {
    sourceUrl?: string;
    provider?: string;
    strategy?: string;
    warnings?: string[];
    products?: JsonProduct[];
}

// ─── Value Parsers ───────────────────────────────────────────────────────────

function parsePriceCents(val: string | undefined): number | null {
    if (!val || val.trim() === '' || val.trim() === '-') return null;
    const cleaned = val.replace(/[$,\u20ac\u00a3\u00a5\s]/g, '');
    const num = parseFloat(cleaned);
    if (isNaN(num) || num < 0) return null;
    return Math.round(num * 100);
}

function parseVariants(variants: any[] | undefined): any[] {
    if (!variants || !Array.isArray(variants) || variants.length === 0) return [];
    // Map WooCommerce-style variants to our format: { name, options[] }
    // The input format may vary, so try to be flexible
    return variants.map(v => {
        if (v.name && Array.isArray(v.options)) return v;
        if (v.attribute && Array.isArray(v.values)) return { name: v.attribute, options: v.values };
        return null;
    }).filter(Boolean);
}

// ─── Main POST Handler ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let formData: FormData;
        try {
            formData = await req.formData();
        } catch {
            return NextResponse.json({ error: 'Invalid request: expected multipart/form-data' }, { status: 400 });
        }

        const file = formData.get('file') as File | null;
        const siteId = formData.get('siteId') as string | null;

        if (!file || !siteId) {
            return NextResponse.json({ error: 'Missing required fields: file, siteId' }, { status: 400 });
        }

        // ── File Validation ──────────────────────────────────────────────────

        if (!file.name.toLowerCase().endsWith('.json')) {
            return NextResponse.json({ error: 'File must be a JSON (.json extension required)' }, { status: 400 });
        }

        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB for JSON (larger than CSV since it contains URLs)
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({
                error: `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 10MB.`
            }, { status: 400 });
        }

        const text = await file.text();

        let jsonData: JsonImportFile;
        try {
            jsonData = JSON.parse(text);
        } catch {
            return NextResponse.json({ error: 'Invalid JSON file. Please check the format.' }, { status: 400 });
        }

        // Validate structure
        if (!jsonData.products || !Array.isArray(jsonData.products)) {
            return NextResponse.json({ error: 'JSON must contain a "products" array.' }, { status: 400 });
        }

        if (jsonData.products.length === 0) {
            return NextResponse.json({ error: 'Products array is empty.' }, { status: 400 });
        }

        const MAX_PRODUCTS = 500;
        if (jsonData.products.length > MAX_PRODUCTS) {
            return NextResponse.json({
                error: `JSON contains ${jsonData.products.length} products. Maximum allowed is ${MAX_PRODUCTS}. Please split into smaller files.`
            }, { status: 400 });
        }

        // ── Verify Site Ownership ────────────────────────────────────────────

        const { data: site } = await supabase.from('sites').select('user_id').eq('id', siteId).single();
        if (!site || site.user_id !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // ── Pre-load Existing Products (for duplicate detection) ─────────────

        const { data: existingItemsRaw } = await supabase
            .from('products')
            .select('*')
            .eq('site_id', siteId)
            .eq('is_archived', false);
        const existingItems = (existingItemsRaw || []) as any[];

        const existingByName = new Map<string, any>();
        let maxSortOrder = -1;
        for (const item of existingItems) {
            existingByName.set(item.name.toLowerCase(), item);
            if (item.sort_order > maxSortOrder) maxSortOrder = item.sort_order;
        }
        let nextSortOrder = maxSortOrder + 1;

        // ── Process Products ─────────────────────────────────────────────────

        const imported:      { index: number; name: string }[] = [];
        const modified:      { index: number; name: string }[] = [];
        const alreadyExists: { index: number; name: string }[] = [];
        const errors:        { row: number; name: string; error: string }[] = [];
        let totalImagesUploaded = 0;
        let totalImageBytes = 0;
        let imagesFailed = 0;

        for (let i = 0; i < jsonData.products.length; i++) {
            const jp = jsonData.products[i];
            const rowNum = i + 1;
            const name = jp.productName?.trim();

            if (!name) {
                errors.push({ row: rowNum, name: '(unnamed)', error: 'Missing productName' });
                continue;
            }

            try {
                // Parse fields
                const description = jp.fullDescription?.trim() || jp.shortDescription?.trim() || null;
                const priceCents = parsePriceCents(jp.price) ?? 0;
                const compareAtCents = parsePriceCents(jp.compareAtPrice);
                const currency = jp.currency?.trim().toUpperCase() || 'CAD';
                const category = jp.category?.trim() || null;
                const tags = Array.isArray(jp.tags) ? jp.tags.filter(t => typeof t === 'string' && t.trim()).map(t => t.trim()) : [];
                const variants = parseVariants(jp.variants);
                const isActive = jp.availability !== 'out_of_stock';

                const allSourceUrls: string[] = [];
                if (jp.mainImageUrl) allSourceUrls.push(jp.mainImageUrl);
                if (jp.additionalImageUrls && Array.isArray(jp.additionalImageUrls)) {
                    allSourceUrls.push(...jp.additionalImageUrls);
                }

                const imgResult = await downloadAndUploadImages(allSourceUrls, siteId, user.id, supabase);
                const imageUrls = imgResult.publicUrls;
                totalImagesUploaded += imgResult.uploaded;
                totalImageBytes += imgResult.totalBytes;
                imagesFailed += imgResult.failed;

                const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

                const existingItem = existingByName.get(name.toLowerCase());

                const incoming = {
                    description,
                    price_cents: priceCents,
                    compare_at_cents: compareAtCents,
                    currency,
                    category,
                    tags,
                    variants,
                    is_active: isActive,
                    // Only update images if we downloaded any; preserve existing otherwise
                    ...(imageUrls.length > 0 ? { images: imageUrls } : {}),
                };

                if (existingItem) {
                    // Check if anything differs
                    const differs =
                        existingItem.description !== incoming.description ||
                        existingItem.price_cents !== incoming.price_cents ||
                        existingItem.compare_at_cents !== incoming.compare_at_cents ||
                        existingItem.currency !== incoming.currency ||
                        existingItem.category !== incoming.category ||
                        JSON.stringify(existingItem.tags) !== JSON.stringify(incoming.tags) ||
                        JSON.stringify(existingItem.variants) !== JSON.stringify(incoming.variants) ||
                        (imageUrls.length > 0 && JSON.stringify(existingItem.images) !== JSON.stringify(imageUrls));

                    if (!differs) {
                        alreadyExists.push({ index: rowNum, name });
                    } else {
                        const { error } = await supabase
                            .from('products')
                            .update({ ...incoming, slug, updated_at: new Date().toISOString() })
                            .eq('id', existingItem.id);
                        if (error) throw new Error(error.message);
                        modified.push({ index: rowNum, name });
                    }
                } else {
                    const { error } = await supabase
                        .from('products')
                        .insert({
                            site_id: siteId,
                            name,
                            slug,
                            images: imageUrls,
                            sort_order: nextSortOrder++,
                            status: 'draft',
                            inventory_count: -1,
                            ...incoming,
                        });
                    if (error) throw new Error(error.message);
                    imported.push({ index: rowNum, name });
                }
            } catch (err: any) {
                errors.push({ row: rowNum, name, error: err.message || 'Unknown error' });
            }
        }

        return NextResponse.json({
            imported: imported.length,
            modified: modified.length,
            already_exists: alreadyExists.length,
            skipped: 0,
            errors,
            total: jsonData.products.length,
            images: {
                uploaded: totalImagesUploaded,
                failed: imagesFailed,
                totalBytes: totalImageBytes,
            },
            source: {
                provider: jsonData.provider || null,
                sourceUrl: jsonData.sourceUrl || null,
            },
        });
    } catch (err: any) {
        console.error('JSON import error:', err);
        return NextResponse.json({ error: 'Import failed. Please try again.' }, { status: 500 });
    }
}
