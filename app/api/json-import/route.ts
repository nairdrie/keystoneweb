import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import sharp from 'sharp';

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

// ─── Image Helpers ───────────────────────────────────────────────────────────

const IMAGE_DOWNLOAD_TIMEOUT = 15_000; // 15s per image
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Download an image from a URL, process with Sharp, upload to Supabase,
 * and track in site_media. Returns the public URL or null on failure.
 */
async function downloadAndUploadImage(
    imageUrl: string,
    siteId: string,
    userId: string,
    supabase: any,
): Promise<{ publicUrl: string; sizeBytes: number } | null> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), IMAGE_DOWNLOAD_TIMEOUT);

        const res = await fetch(imageUrl, {
            signal: controller.signal,
            headers: { 'User-Agent': 'KeystoneWeb/1.0 ProductImporter' },
        });
        clearTimeout(timeout);

        if (!res.ok) return null;

        const arrayBuffer = await res.arrayBuffer();
        const inputBuffer = Buffer.from(arrayBuffer);

        if (inputBuffer.length > MAX_IMAGE_SIZE) return null;
        if (inputBuffer.length === 0) return null;

        // Process with Sharp (resize + sanitize)
        let finalBuffer: Buffer;
        let contentType: string;
        let ext: string;

        try {
            const image = sharp(inputBuffer);
            const metadata = await image.metadata();
            const isTransparent = metadata.format === 'png' || metadata.format === 'webp' || metadata.format === 'gif';

            if (isTransparent) {
                finalBuffer = await image
                    .resize({ width: 2000, withoutEnlargement: true })
                    .toBuffer();
                contentType = `image/${metadata.format}`;
                ext = metadata.format === 'png' ? 'png' : metadata.format === 'webp' ? 'webp' : 'gif';
            } else {
                finalBuffer = await image
                    .resize({ width: 2000, withoutEnlargement: true })
                    .jpeg({ quality: 85, mozjpeg: true })
                    .toBuffer();
                contentType = 'image/jpeg';
                ext = 'jpg';
            }
        } catch {
            return null; // Corrupted or unsupported image format
        }

        // Generate unique storage path
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).slice(2, 8);
        const safeName = extractFileName(imageUrl);
        const storagePath = `${siteId}/${timestamp}-${randomStr}-${safeName}.${ext}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('site-assets')
            .upload(storagePath, finalBuffer, {
                contentType,
                cacheControl: '31536000',
                upsert: false,
            });

        if (uploadError) return null;

        const { data: { publicUrl } } = supabase.storage
            .from('site-assets')
            .getPublicUrl(uploadData.path);

        // Track in site_media (for media library + storage accounting)
        await supabase.from('site_media').upsert({
            site_id: siteId,
            user_id: userId,
            storage_path: uploadData.path,
            public_url: publicUrl,
            file_name: `${safeName}.${ext}`,
            media_type: 'image',
            mime_type: contentType,
            size_bytes: finalBuffer.length,
        }, { onConflict: 'storage_path', ignoreDuplicates: true });

        return { publicUrl, sizeBytes: finalBuffer.length };
    } catch {
        return null; // Network error, timeout, etc.
    }
}

function extractFileName(url: string): string {
    try {
        const pathname = new URL(url).pathname;
        const basename = pathname.split('/').pop() || 'product-image';
        return basename
            .replace(/\.[^/.]+$/, '')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .slice(0, 60) || 'product-image';
    } catch {
        return 'product-image';
    }
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

                // Download and upload images (main + additional)
                const imageUrls: string[] = [];
                const allSourceUrls: string[] = [];
                if (jp.mainImageUrl) allSourceUrls.push(jp.mainImageUrl);
                if (jp.additionalImageUrls && Array.isArray(jp.additionalImageUrls)) {
                    allSourceUrls.push(...jp.additionalImageUrls);
                }

                // Process images in batches of 3 for concurrency
                for (let batch = 0; batch < allSourceUrls.length; batch += 3) {
                    const batchUrls = allSourceUrls.slice(batch, batch + 3);
                    const results = await Promise.all(
                        batchUrls.map(url => downloadAndUploadImage(url, siteId, user.id, supabase))
                    );
                    for (const result of results) {
                        if (result) {
                            imageUrls.push(result.publicUrl);
                            totalImagesUploaded++;
                            totalImageBytes += result.sizeBytes;
                        } else {
                            imagesFailed++;
                        }
                    }
                }

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
