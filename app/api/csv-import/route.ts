import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

// ─── CSV Parser ──────────────────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
            else { inQuotes = !inQuotes; }
        } else if (ch === ',' && !inQuotes) {
            result.push(current.trim()); current = '';
        } else {
            current += ch;
        }
    }
    result.push(current.trim());
    return result;
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const nonEmpty = lines.filter(l => l.trim().length > 0);
    if (nonEmpty.length < 1) return { headers: [], rows: [] };
    const headers = parseCsvLine(nonEmpty[0]);
    const rows = nonEmpty.slice(1).map(l => parseCsvLine(l));
    return { headers, rows };
}

// ─── Type Definitions ─────────────────────────────────────────────────────────

type ImportType = 'services' | 'products';

interface ColumnMapping {
    name: string | null;
    description: string | null;
    price: string | null;
    compare_at_price: string | null;
    currency: string | null;
    status: string | null;
    // Services specific
    duration_minutes: string | null;
    is_featured: string | null;
    options: string | null;
    options_required: string | null;
    category: string | null;
    // Products specific
    variants: string | null;
    inventory_count: string | null;
    tags: string | null;
}

// ─── AI Column Mapping ────────────────────────────────────────────────────────

async function mapColumnsWithAI(
    headers: string[],
    sampleRows: string[][],
    importType: ImportType,
): Promise<ColumnMapping> {
    const apiKey = process.env.AI_BUILDER_API_KEY;
    const fallback = fuzzyMapColumns(headers, importType);
    if (!apiKey) return fallback;

    const fieldDescriptions = importType === 'services'
        ? `Fields to map (services/bookings):
- name (REQUIRED): The service name
- description: A description of the service
- price: Price in dollars (e.g. "45.00")
- compare_at_price: Original/strikethrough price in dollars
- duration_minutes: Duration in minutes (e.g. "30", "60")
- currency: Currency code (e.g. "CAD", "USD")
- is_featured: Whether to feature this service ("true"/"false"/"yes"/"no")
- status: Publication status ("draft" or "published")
- options: Service variants/packages (e.g. "Name:Price:override | Add-on:Price:addon")
- options_required: Whether customers must select an option ("required"/"optional"/"true"/"false")
- category: Service category name (e.g. "Massage", "Skin Care")`
        : `Fields to map (products):
- name (REQUIRED): The product name
- description: A description of the product
- price: Price in dollars (e.g. "29.99")
- compare_at_price: Original/compare-at price in dollars
- currency: Currency code (e.g. "CAD", "USD")
- inventory_count: Stock quantity (-1 for unlimited)
- status: Publication status ("draft" or "published")
- variants: Product variants (e.g. "Size:S,M,L | Color:Red,Blue")
- category: Product category name (e.g. "Skin Care", "Clothing")
- tags: Comma-separated tags (e.g. "gift set, retinol, holiday")`;

    const sampleText = sampleRows.slice(0, 3).map((row, i) =>
        `Row ${i + 1}: ${JSON.stringify(Object.fromEntries(headers.map((h, j) => [h, row[j] ?? ''])))}`
    ).join('\n');

    const exampleFormat = importType === 'services'
        ? `{"name": "Service Name", "description": "Desc", "price": "Price", "compare_at_price": null, "currency": null, "status": null, "duration_minutes": null, "is_featured": null, "options": null, "options_required": null, "category": null, "variants": null, "inventory_count": null}`
        : `{"name": "Product Name", "description": "Desc", "price": "Price", "compare_at_price": null, "currency": null, "status": null, "duration_minutes": null, "is_featured": null, "options": null, "options_required": null, "category": null, "variants": null, "inventory_count": null, "tags": null}`;

    const prompt = `You are mapping CSV columns for a data import. The user is importing ${importType}.

CSV Headers: ${JSON.stringify(headers)}

Sample data:
${sampleText}

${fieldDescriptions}

Return ONLY a JSON object mapping our field names to the user's CSV column names.
If a field has no matching column, use null.
Be smart about fuzzy matches (e.g. "Service Name" → "name", "Price $" → "price", "Duration (min)" → "duration_minutes", "Sale Price" → "compare_at_price", "Featured?" → "is_featured", "Required?" → "options_required", "Category" → "category").

Example: ${exampleFormat}`;

    try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: process.env.AI_BUILDER_MODEL || 'claude-haiku-4-5-20251001',
                max_tokens: 512,
                messages: [{ role: 'user', content: prompt }],
            }),
        });

        if (!res.ok) {
            console.error('AI column mapping failed, using fuzzy fallback');
            return fallback;
        }

        const data = await res.json();
        const text: string = data.content?.[0]?.text || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return fallback;

        const parsed = JSON.parse(jsonMatch[0]);
        const headerSet = new Set(headers);
        const pick = (val: any, fb: string | null) =>
            val && headerSet.has(val) ? val : fb;

        return {
            name:             pick(parsed.name,             fallback.name),
            description:      pick(parsed.description,      fallback.description),
            price:            pick(parsed.price,            fallback.price),
            compare_at_price: pick(parsed.compare_at_price, fallback.compare_at_price),
            currency:         pick(parsed.currency,         fallback.currency),
            status:           pick(parsed.status,           fallback.status),
            duration_minutes: pick(parsed.duration_minutes, fallback.duration_minutes),
            is_featured:      pick(parsed.is_featured,      fallback.is_featured),
            options:          pick(parsed.options,          fallback.options),
            options_required: pick(parsed.options_required, fallback.options_required),
            category:         pick(parsed.category,         fallback.category),
            variants:         pick(parsed.variants,         fallback.variants),
            inventory_count:  pick(parsed.inventory_count,  fallback.inventory_count),
            tags:             pick(parsed.tags,             fallback.tags),
        };
    } catch (err) {
        console.error('AI column mapping error, using fuzzy fallback:', err);
        return fallback;
    }
}

// ─── Fuzzy Column Matching (fallback) ─────────────────────────────────────────

function fuzzyMapColumns(headers: string[], importType: ImportType): ColumnMapping {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const find = (...keys: string[]) => {
        for (const key of keys) {
            const match = headers.find(h => norm(h) === norm(key));
            if (match) return match;
        }
        for (const key of keys) {
            const match = headers.find(h => norm(h).includes(norm(key)) || norm(key).includes(norm(h)));
            if (match) return match;
        }
        return null;
    };

    return {
        name:             find('name', 'title', 'service name', 'product name', 'item name'),
        description:      find('description', 'desc', 'details', 'about', 'summary'),
        price:            find('price', 'cost', 'amount', 'rate', 'fee', 'price cad', 'price usd', 'price $'),
        compare_at_price: find('compare at price', 'compare_at_price', 'original price', 'was price', 'regular price', 'sale price', 'msrp'),
        currency:         find('currency', 'cur', 'ccy'),
        status:           find('status', 'state', 'published', 'active'),
        duration_minutes: find('duration', 'duration_minutes', 'duration minutes', 'length', 'time', 'minutes', 'mins'),
        is_featured:      find('featured', 'is_featured', 'is featured', 'highlight', 'promoted', 'star'),
        options:          importType === 'services' ? find('options', 'packages', 'tiers', 'add ons', 'addons') : null,
        options_required: importType === 'services' ? find('options_required', 'required', 'option required', 'mandatory', 'option type') : null,
        category:         find('category', 'cat', 'group', 'type', importType === 'services' ? 'service type' : 'product type', importType === 'services' ? 'service category' : 'product category'),
        variants:         importType === 'products' ? find('variants', 'options', 'variations') : null,
        inventory_count:  importType === 'products' ? find('inventory', 'stock', 'quantity', 'qty', 'inventory_count', 'count') : null,
        tags:             importType === 'products' ? find('tags', 'tag', 'keywords', 'labels') : null,
    };
}

// ─── Value Parsers ────────────────────────────────────────────────────────────

function parsePriceCents(val: string | undefined): number | null {
    if (!val || val.trim() === '' || val.trim() === '-') return null;
    const cleaned = val.replace(/[$,€£¥\s]/g, '');
    const num = parseFloat(cleaned);
    if (isNaN(num) || num < 0) return null;
    return Math.round(num * 100);
}

function parseBool(val: string | undefined): boolean {
    if (!val) return false;
    const v = val.trim().toLowerCase();
    return v === 'true' || v === 'yes' || v === '1' || v === 'y' || v === 'x';
}

function parseOptionsRequired(val: string | undefined): boolean {
    if (!val) return true; // default: required
    const v = val.trim().toLowerCase();
    // Explicitly optional
    if (v === 'false' || v === 'no' || v === '0' || v === 'n' || v === 'optional') return false;
    // Explicitly required
    return true;
}

/**
 * Parse service options from CSV value.
 * Supported formats:
 *   - JSON array: [{"name":"...","price_cents":5000,"price_type":"override"}]
 *   - Pipe-separated: "Single Session:50.00 | Add-on:20.00:addon | Package:100:override"
 *     Each segment: "Name:Price" (default override) or "Name:Price:type" (override|addon)
 */
function parseOptions(val: string | undefined): any[] | null {
    if (!val || val.trim() === '') return null;
    const trimmed = val.trim();

    if (trimmed.startsWith('[')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                // Ensure each option has an id
                return parsed.map(o => ({
                    id: o.id || crypto.randomUUID(),
                    name: o.name || '',
                    price_cents: typeof o.price_cents === 'number' ? o.price_cents : (parsePriceCents(String(o.price ?? '')) ?? 0),
                    price_type: (o.price_type === 'addon' ? 'addon' : 'override') as 'override' | 'addon',
                    ...(o.addon_id ? { addon_id: o.addon_id } : {}),
                }));
            }
        } catch { /* fall through */ }
    }

    const parts = trimmed.split(/\s*\|\s*/);
    const result: any[] = [];

    for (const part of parts) {
        if (!part.trim()) continue;

        // Split by colon, then determine if last segment is a type keyword
        const segments = part.split(':');
        let priceType: 'override' | 'addon' = 'override';

        if (segments.length >= 2) {
            const lastSeg = segments[segments.length - 1].trim().toLowerCase();
            if (lastSeg === 'override' || lastSeg === 'addon') {
                priceType = lastSeg as 'override' | 'addon';
                segments.pop();
            }
        }

        if (segments.length === 0) continue;

        // Last remaining segment is the price; everything before is the name
        const priceStr = segments.pop()?.trim() || '';
        const name = segments.join(':').trim();

        // If there's no name (only one segment total), treat the whole thing as a name with price 0
        if (!name) {
            result.push({
                id: crypto.randomUUID(),
                name: priceStr,
                price_cents: 0,
                price_type: priceType,
            });
        } else {
            result.push({
                id: crypto.randomUUID(),
                name,
                price_cents: parsePriceCents(priceStr) ?? 0,
                price_type: priceType,
            });
        }
    }

    return result.length > 0 ? result : null;
}

function parseVariants(val: string | undefined): any[] | null {
    if (!val || val.trim() === '') return null;
    const trimmed = val.trim();

    if (trimmed.startsWith('[')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) return parsed;
        } catch { /* fall through */ }
    }

    const parts = trimmed.split(/\s*\|\s*/);
    const result: any[] = [];
    for (const part of parts) {
        const colonIdx = part.indexOf(':');
        if (colonIdx === -1) continue;
        const name = part.slice(0, colonIdx).trim();
        const options = part.slice(colonIdx + 1).split(',').map(o => o.trim()).filter(Boolean);
        if (name && options.length > 0) result.push({ name, options });
    }
    return result.length > 0 ? result : null;
}

function parseStatus(val: string | undefined): 'draft' | 'published' {
    if (!val) return 'draft';
    const v = val.trim().toLowerCase();
    return v === 'published' || v === 'live' || v === 'active' || v === 'true' || v === '1' ? 'published' : 'draft';
}

// ─── Category Resolution ──────────────────────────────────────────────────────

/**
 * Load existing categories for a site, then for each name in the import:
 * - Case-insensitively match an existing category → return its id
 * - Otherwise create a new category → return its id
 * Returns a map from lowercase category name → category_id.
 */
async function resolveCategoryIds(
    siteId: string,
    categoryNames: string[],
    supabase: any,
): Promise<Map<string, string>> {
    const uniqueNames = [...new Set(categoryNames.map(n => n.trim()).filter(Boolean))];
    if (uniqueNames.length === 0) return new Map();

    // Load existing categories
    const { data: existing } = await supabase
        .from('booking_categories')
        .select('id, name, sort_order')
        .eq('site_id', siteId)
        .eq('is_archived', false);

    const categoryMap = new Map<string, string>(); // lowercase → id
    let maxOrder = -1;

    for (const cat of (existing || [])) {
        categoryMap.set(cat.name.toLowerCase(), cat.id);
        if (cat.sort_order > maxOrder) maxOrder = cat.sort_order;
    }

    // Create missing categories
    for (const name of uniqueNames) {
        const key = name.toLowerCase();
        if (!categoryMap.has(key)) {
            maxOrder++;
            const { data: newCat } = await supabase
                .from('booking_categories')
                .insert({ site_id: siteId, name, sort_order: maxOrder })
                .select('id')
                .single();
            if (newCat?.id) categoryMap.set(key, newCat.id);
        }
    }

    return categoryMap;
}

// ─── Duplicate Detection Helpers ─────────────────────────────────────────────

function serviceIsIdentical(existing: any, incoming: any): boolean {
    return (
        existing.description === incoming.description &&
        existing.price_cents === incoming.price_cents &&
        existing.compare_at_price_cents === incoming.compare_at_price_cents &&
        existing.duration_minutes === incoming.duration_minutes &&
        existing.currency === incoming.currency &&
        existing.is_featured === incoming.is_featured &&
        existing.status === incoming.status &&
        existing.category_id === incoming.category_id &&
        existing.options_required === incoming.options_required &&
        JSON.stringify(existing.options) === JSON.stringify(incoming.options)
    );
}

function productIsIdentical(existing: any, incoming: any): boolean {
    return (
        existing.description === incoming.description &&
        existing.price_cents === incoming.price_cents &&
        existing.compare_at_cents === incoming.compare_at_cents &&
        existing.currency === incoming.currency &&
        existing.status === incoming.status &&
        existing.inventory_count === incoming.inventory_count &&
        JSON.stringify(existing.variants) === JSON.stringify(incoming.variants)
    );
}

// ─── Main POST Handler ────────────────────────────────────────────────────────

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
        const importType = formData.get('type') as ImportType | null;
        const siteId = formData.get('siteId') as string | null;

        if (!file || !importType || !siteId) {
            return NextResponse.json({ error: 'Missing required fields: file, type, siteId' }, { status: 400 });
        }

        if (!['services', 'products'].includes(importType)) {
            return NextResponse.json({ error: 'Invalid type: must be "services" or "products"' }, { status: 400 });
        }

        // ── File Validation ──────────────────────────────────────────────────

        if (!file.name.toLowerCase().endsWith('.csv')) {
            return NextResponse.json({ error: 'File must be a CSV (.csv extension required)' }, { status: 400 });
        }

        const allowedMimeTypes = ['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel', 'application/octet-stream'];
        if (file.type && !allowedMimeTypes.includes(file.type)) {
            return NextResponse.json({ error: `Invalid file type "${file.type}". Please upload a CSV file.` }, { status: 400 });
        }

        const MAX_FILE_SIZE = 2 * 1024 * 1024;
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({
                error: `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 2MB.`
            }, { status: 400 });
        }

        const text = await file.text();

        // eslint-disable-next-line no-control-regex
        if (/[\x00-\x08\x0E-\x1F]/.test(text.slice(0, 1000))) {
            return NextResponse.json({ error: 'File does not appear to be a valid CSV text file.' }, { status: 400 });
        }

        // ── Parse CSV ────────────────────────────────────────────────────────

        const { headers, rows } = parseCsv(text);

        if (headers.length === 0) {
            return NextResponse.json({ error: 'CSV file is empty or could not be parsed.' }, { status: 400 });
        }
        if (rows.length === 0) {
            return NextResponse.json({ error: 'CSV has headers but no data rows.' }, { status: 400 });
        }

        const MAX_ROWS = 500;
        if (rows.length > MAX_ROWS) {
            return NextResponse.json({
                error: `CSV has ${rows.length} rows. Maximum allowed is ${MAX_ROWS}. Please split into smaller files.`
            }, { status: 400 });
        }

        // ── Verify Site Ownership ────────────────────────────────────────────

        const { data: site } = await supabase.from('sites').select('user_id').eq('id', siteId).single();
        if (!site || site.user_id !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // ── AI Column Mapping ────────────────────────────────────────────────

        const mapping = await mapColumnsWithAI(headers, rows.slice(0, 5), importType);

        if (!mapping.name) {
            return NextResponse.json({
                error: 'Could not find a "name" column in your CSV. Please ensure your file has a column for the item name.',
                headers,
                mapping,
            }, { status: 400 });
        }

        // ── Column Index Helpers ─────────────────────────────────────────────

        const colIdx = (colName: string | null) => colName ? headers.indexOf(colName) : -1;

        const nameIdx        = colIdx(mapping.name);
        const descIdx        = colIdx(mapping.description);
        const priceIdx       = colIdx(mapping.price);
        const compareIdx     = colIdx(mapping.compare_at_price);
        const currencyIdx    = colIdx(mapping.currency);
        const statusIdx      = colIdx(mapping.status);

        // Services
        const durIdx         = colIdx(mapping.duration_minutes);
        const featIdx        = colIdx(mapping.is_featured);
        const optsIdx        = colIdx(mapping.options);
        const optsReqIdx     = colIdx(mapping.options_required);
        const catIdx         = colIdx(mapping.category);

        // Products
        const varIdx         = colIdx(mapping.variants);
        const invIdx         = colIdx(mapping.inventory_count);
        const tagsIdx        = colIdx(mapping.tags);

        // ── Pre-load Existing Items (for duplicate detection) ────────────────

        const table = importType === 'services' ? 'booking_services' : 'products';
        const { data: existingItemsRaw } = await supabase
            .from(table)
            .select('*')
            .eq('site_id', siteId)
            .eq('is_archived', false);
        const existingItems = (existingItemsRaw || []) as any[];

        // Map lowercase name → existing record
        const existingByName = new Map<string, any>();
        let maxSortOrder = -1;
        for (const item of (existingItems || [])) {
            existingByName.set(item.name.toLowerCase(), item);
            if (item.sort_order > maxSortOrder) maxSortOrder = item.sort_order;
        }
        let nextSortOrder = maxSortOrder + 1;

        // ── Resolve Categories (services only) ───────────────────────────────

        let categoryMap = new Map<string, string>();
        if (importType === 'services' && catIdx >= 0) {
            const catNames = rows
                .map(r => r[catIdx]?.trim())
                .filter((n): n is string => Boolean(n));
            categoryMap = await resolveCategoryIds(siteId, catNames, supabase);
        }

        // ── Process Rows (in CSV order) ──────────────────────────────────────

        const imported:      { row: number; name: string }[] = [];
        const modified:      { row: number; name: string }[] = [];
        const alreadyExists: { row: number; name: string }[] = [];
        const skipped:       { row: number; reason: string }[] = [];
        const errors:        { row: number; name: string; error: string }[] = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 2; // 1-indexed + header row

            const name = nameIdx >= 0 ? row[nameIdx]?.trim() : undefined;
            if (!name) {
                skipped.push({ row: rowNum, reason: 'Empty name' });
                continue;
            }

            const description    = descIdx >= 0     ? row[descIdx]?.trim() || null : null;
            const priceCents     = priceIdx >= 0    ? (parsePriceCents(row[priceIdx]) ?? 0) : 0;
            const compareAtCents = compareIdx >= 0  ? parsePriceCents(row[compareIdx]) : null;
            const currency       = currencyIdx >= 0 && row[currencyIdx]?.trim() ? row[currencyIdx].trim().toUpperCase() : 'CAD';
            const status         = statusIdx >= 0   ? parseStatus(row[statusIdx]) : 'draft';

            const existingItem = existingByName.get(name.toLowerCase());

            try {
                if (importType === 'services') {
                    const durationMinutes  = durIdx >= 0     ? (parseInt(row[durIdx] || '30') || 30) : 30;
                    const isFeatured       = featIdx >= 0    ? parseBool(row[featIdx]) : false;
                    const options          = optsIdx >= 0    ? parseOptions(row[optsIdx]) : null;
                    const optionsRequired  = optsReqIdx >= 0 ? parseOptionsRequired(row[optsReqIdx]) : true;
                    const catName          = catIdx >= 0     ? row[catIdx]?.trim() || null : null;
                    const categoryId       = catName ? (categoryMap.get(catName.toLowerCase()) ?? null) : null;

                    const incoming = {
                        description,
                        price_cents: priceCents,
                        compare_at_price_cents: compareAtCents,
                        duration_minutes: durationMinutes,
                        currency,
                        is_featured: isFeatured,
                        status,
                        category_id: categoryId,
                        options_required: optionsRequired,
                        options,
                    };

                    if (existingItem) {
                        if (serviceIsIdentical(existingItem, incoming)) {
                            alreadyExists.push({ row: rowNum, name });
                        } else {
                            const { error } = await supabase
                                .from('booking_services')
                                .update({ ...incoming, updated_at: new Date().toISOString() })
                                .eq('id', existingItem.id);
                            if (error) throw new Error(error.message);
                            modified.push({ row: rowNum, name });
                        }
                    } else {
                        const { error } = await supabase
                            .from('booking_services')
                            .insert({
                                site_id: siteId,
                                name,
                                sort_order: nextSortOrder++,
                                ...incoming,
                            });
                        if (error) throw new Error(error.message);
                        imported.push({ row: rowNum, name });
                    }
                } else {
                    const variants       = varIdx >= 0 ? parseVariants(row[varIdx]) : null;
                    const inventoryCount = invIdx >= 0
                        ? (row[invIdx]?.trim() === '' ? -1 : (parseInt(row[invIdx] || '-1') ?? -1))
                        : -1;
                    const productCategory = catIdx >= 0 ? row[catIdx]?.trim() || null : null;
                    const productTags = tagsIdx >= 0 && row[tagsIdx]?.trim()
                        ? row[tagsIdx].split(',').map((t: string) => t.trim()).filter(Boolean)
                        : [];

                    const incoming = {
                        description,
                        price_cents: priceCents,
                        compare_at_cents: compareAtCents,
                        currency,
                        status,
                        variants: variants || [],
                        inventory_count: inventoryCount,
                        category: productCategory,
                        tags: productTags,
                    };

                    if (existingItem) {
                        if (productIsIdentical(existingItem, incoming)) {
                            alreadyExists.push({ row: rowNum, name });
                        } else {
                            const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                            const { error } = await supabase
                                .from('products')
                                .update({ ...incoming, slug, updated_at: new Date().toISOString() })
                                .eq('id', existingItem.id);
                            if (error) throw new Error(error.message);
                            modified.push({ row: rowNum, name });
                        }
                    } else {
                        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                        const { error } = await supabase
                            .from('products')
                            .insert({
                                site_id: siteId,
                                name,
                                slug,
                                images: [],
                                sort_order: nextSortOrder++,
                                ...incoming,
                            });
                        if (error) throw new Error(error.message);
                        imported.push({ row: rowNum, name });
                    }
                }
            } catch (err: any) {
                errors.push({ row: rowNum, name, error: err.message || 'Unknown error' });
            }
        }

        return NextResponse.json({
            imported: imported.length,
            modified: modified.length,
            already_exists: alreadyExists.length,
            skipped: skipped.length,
            errors,
            mapping,
            total: rows.length,
        });
    } catch (err: any) {
        console.error('CSV import error:', err);
        return NextResponse.json({ error: 'Import failed. Please try again.' }, { status: 500 });
    }
}
