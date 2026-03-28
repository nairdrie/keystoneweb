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
    // Normalize line endings
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
    // Products specific
    variants: string | null;
    inventory_count: string | null;
}

// ─── AI Column Mapping ────────────────────────────────────────────────────────

async function mapColumnsWithAI(
    headers: string[],
    sampleRows: string[][],
    importType: ImportType,
): Promise<ColumnMapping> {
    const apiKey = process.env.AI_BUILDER_API_KEY;

    // Fallback: fuzzy matching without AI
    const fallback = fuzzyMapColumns(headers, importType);
    if (!apiKey) return fallback;

    const fieldDescriptions = importType === 'services'
        ? `Fields to map (services/bookings):
- name (REQUIRED): The service name
- description: A description of the service
- price: Price in dollars (e.g. "45.00" or "45")
- compare_at_price: Original/strikethrough price in dollars
- duration_minutes: Duration in minutes (e.g. "30", "60")
- currency: Currency code (e.g. "CAD", "USD")
- is_featured: Whether to feature this service ("true"/"false"/"yes"/"no"/"1"/"0")
- status: Publication status ("draft" or "published")
- options: Service variants/packages as JSON array or "Name:Price | Name2:Price2" format`
        : `Fields to map (products):
- name (REQUIRED): The product name
- description: A description of the product
- price: Price in dollars (e.g. "29.99" or "30")
- compare_at_price: Original/compare-at price in dollars
- currency: Currency code (e.g. "CAD", "USD")
- inventory_count: Stock quantity (-1 for unlimited)
- status: Publication status ("draft" or "published")
- variants: Product variants as JSON array or "Size:S,M,L | Color:Red,Blue" format`;

    const sampleText = sampleRows.slice(0, 3).map((row, i) =>
        `Row ${i + 1}: ${JSON.stringify(Object.fromEntries(headers.map((h, j) => [h, row[j] ?? ''])))}`
    ).join('\n');

    const prompt = `You are mapping CSV columns for a data import. The user is importing ${importType}.

CSV Headers: ${JSON.stringify(headers)}

Sample data:
${sampleText}

${fieldDescriptions}

Return ONLY a JSON object mapping our field names to the user's CSV column names.
If a field has no matching column, use null.
Be smart about fuzzy matches (e.g. "Product Name" → "name", "Price $" → "price", "Duration (min)" → "duration_minutes", "Sale Price" → "compare_at_price", "Featured?" → "is_featured").

Example response format:
{"name": "Product Name", "description": "Desc", "price": "Price ($)", "compare_at_price": null, "currency": null, "status": null, "duration_minutes": null, "is_featured": null, "options": null, "variants": null, "inventory_count": null}`;

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

        // Extract JSON from the response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return fallback;

        const parsed = JSON.parse(jsonMatch[0]);

        // Validate the mapping: ensure all returned column names exist in headers
        const headerSet = new Set(headers);
        const validated: ColumnMapping = {
            name: parsed.name && headerSet.has(parsed.name) ? parsed.name : fallback.name,
            description: parsed.description && headerSet.has(parsed.description) ? parsed.description : fallback.description,
            price: parsed.price && headerSet.has(parsed.price) ? parsed.price : fallback.price,
            compare_at_price: parsed.compare_at_price && headerSet.has(parsed.compare_at_price) ? parsed.compare_at_price : fallback.compare_at_price,
            currency: parsed.currency && headerSet.has(parsed.currency) ? parsed.currency : fallback.currency,
            status: parsed.status && headerSet.has(parsed.status) ? parsed.status : fallback.status,
            duration_minutes: parsed.duration_minutes && headerSet.has(parsed.duration_minutes) ? parsed.duration_minutes : fallback.duration_minutes,
            is_featured: parsed.is_featured && headerSet.has(parsed.is_featured) ? parsed.is_featured : fallback.is_featured,
            options: parsed.options && headerSet.has(parsed.options) ? parsed.options : fallback.options,
            variants: parsed.variants && headerSet.has(parsed.variants) ? parsed.variants : fallback.variants,
            inventory_count: parsed.inventory_count && headerSet.has(parsed.inventory_count) ? parsed.inventory_count : fallback.inventory_count,
        };

        return validated;
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
        // Partial match
        for (const key of keys) {
            const match = headers.find(h => norm(h).includes(norm(key)) || norm(key).includes(norm(h)));
            if (match) return match;
        }
        return null;
    };

    return {
        name: find('name', 'title', 'service name', 'product name', 'item name'),
        description: find('description', 'desc', 'details', 'about', 'summary'),
        price: find('price', 'cost', 'amount', 'rate', 'fee', 'price cad', 'price usd', 'price $'),
        compare_at_price: find('compare at price', 'compare_at_price', 'original price', 'was price', 'regular price', 'sale price', 'msrp'),
        currency: find('currency', 'cur', 'ccy'),
        status: find('status', 'state', 'published', 'active'),
        duration_minutes: find('duration', 'duration_minutes', 'duration minutes', 'length', 'time', 'minutes', 'mins'),
        is_featured: find('featured', 'is_featured', 'is featured', 'highlight', 'promoted', 'star'),
        options: importType === 'services' ? find('options', 'variants', 'packages', 'tiers', 'add ons', 'addons') : null,
        variants: importType === 'products' ? find('variants', 'options', 'variations') : null,
        inventory_count: importType === 'products' ? find('inventory', 'stock', 'quantity', 'qty', 'inventory_count', 'count') : null,
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

function parseOptions(val: string | undefined): any[] | null {
    if (!val || val.trim() === '') return null;
    const trimmed = val.trim();

    // Try JSON first
    if (trimmed.startsWith('[')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) return parsed;
        } catch { /* fall through */ }
    }

    // Try "Name:Price | Name2:Price2" format
    // e.g. "Single Session:50.00 | 5-Pack:200.00"
    const parts = trimmed.split(/\s*\|\s*/);
    const result: any[] = [];
    for (const part of parts) {
        const colonIdx = part.lastIndexOf(':');
        if (colonIdx === -1) {
            // No price, just a name
            result.push({
                id: crypto.randomUUID(),
                name: part.trim(),
                price_cents: 0,
                price_type: 'override' as const,
            });
        } else {
            const name = part.slice(0, colonIdx).trim();
            const priceStr = part.slice(colonIdx + 1).trim();
            const price = parsePriceCents(priceStr) ?? 0;
            result.push({
                id: crypto.randomUUID(),
                name,
                price_cents: price,
                price_type: 'override' as const,
            });
        }
    }
    return result.length > 0 ? result : null;
}

function parseVariants(val: string | undefined): any[] | null {
    if (!val || val.trim() === '') return null;
    const trimmed = val.trim();

    // Try JSON first
    if (trimmed.startsWith('[')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) return parsed;
        } catch { /* fall through */ }
    }

    // Try "Size:S,M,L | Color:Red,Blue" format
    const parts = trimmed.split(/\s*\|\s*/);
    const result: any[] = [];
    for (const part of parts) {
        const colonIdx = part.indexOf(':');
        if (colonIdx === -1) continue;
        const name = part.slice(0, colonIdx).trim();
        const options = part.slice(colonIdx + 1).split(',').map(o => o.trim()).filter(Boolean);
        if (name && options.length > 0) {
            result.push({ name, options });
        }
    }
    return result.length > 0 ? result : null;
}

function parseStatus(val: string | undefined): 'draft' | 'published' {
    if (!val) return 'draft';
    const v = val.trim().toLowerCase();
    return v === 'published' || v === 'live' || v === 'active' || v === 'true' || v === '1' ? 'published' : 'draft';
}

// ─── Main POST Handler ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Parse multipart form data
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

        // Check file extension
        const fileName = file.name.toLowerCase();
        if (!fileName.endsWith('.csv')) {
            return NextResponse.json({ error: 'File must be a CSV (.csv extension required)' }, { status: 400 });
        }

        // Check MIME type (allow text/csv, text/plain, application/csv, application/vnd.ms-excel)
        const allowedMimeTypes = ['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel', 'application/octet-stream'];
        if (file.type && !allowedMimeTypes.includes(file.type)) {
            return NextResponse.json({ error: `Invalid file type "${file.type}". Please upload a CSV file.` }, { status: 400 });
        }

        // Check file size (max 2MB)
        const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({
                error: `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 2MB.`
            }, { status: 400 });
        }

        // Read file content
        const text = await file.text();

        // Check it actually looks like CSV (not binary)
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

        // Max 500 rows
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

        // ── Get current sort_order offset ────────────────────────────────────

        const table = importType === 'services' ? 'booking_services' : 'products';
        const { data: existingItems } = await supabase
            .from(table)
            .select('sort_order')
            .eq('site_id', siteId)
            .order('sort_order', { ascending: false })
            .limit(1);
        let sortOffset = (existingItems?.[0]?.sort_order ?? -1) + 1;

        // ── Process Rows ─────────────────────────────────────────────────────

        const colIdx = (colName: string | null) =>
            colName ? headers.indexOf(colName) : -1;

        const nameIdx = colIdx(mapping.name);
        const descIdx = colIdx(mapping.description);
        const priceIdx = colIdx(mapping.price);
        const compareIdx = colIdx(mapping.compare_at_price);
        const currencyIdx = colIdx(mapping.currency);
        const statusIdx = colIdx(mapping.status);

        const imported: any[] = [];
        const errors: { row: number; name: string; error: string }[] = [];
        const skipped: number[] = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 2; // 1-indexed, +1 for header

            const name = nameIdx >= 0 ? row[nameIdx]?.trim() : undefined;
            if (!name) {
                skipped.push(rowNum);
                continue;
            }

            const description = descIdx >= 0 ? row[descIdx]?.trim() || null : null;
            const priceCents = priceIdx >= 0 ? (parsePriceCents(row[priceIdx]) ?? 0) : 0;
            const compareAtCents = compareIdx >= 0 ? parsePriceCents(row[compareIdx]) : null;
            const currency = currencyIdx >= 0 && row[currencyIdx]?.trim() ? row[currencyIdx].trim().toUpperCase() : 'CAD';
            const status = statusIdx >= 0 ? parseStatus(row[statusIdx]) : 'draft';

            try {
                if (importType === 'services') {
                    const durIdx = colIdx(mapping.duration_minutes);
                    const featIdx = colIdx(mapping.is_featured);
                    const optsIdx = colIdx(mapping.options);

                    const durationMinutes = durIdx >= 0 ? (parseInt(row[durIdx] || '30') || 30) : 30;
                    const isFeatured = featIdx >= 0 ? parseBool(row[featIdx]) : false;
                    const options = optsIdx >= 0 ? parseOptions(row[optsIdx]) : null;

                    const { data, error } = await supabase
                        .from('booking_services')
                        .insert({
                            site_id: siteId,
                            name,
                            description,
                            duration_minutes: durationMinutes,
                            price_cents: priceCents,
                            currency,
                            is_featured: isFeatured,
                            compare_at_price_cents: compareAtCents,
                            options,
                            status,
                            sort_order: sortOffset++,
                        })
                        .select('id, name')
                        .single();

                    if (error) throw new Error(error.message);
                    imported.push(data);
                } else {
                    const varIdx = colIdx(mapping.variants);
                    const invIdx = colIdx(mapping.inventory_count);

                    const variants = varIdx >= 0 ? parseVariants(row[varIdx]) : null;
                    const inventoryCount = invIdx >= 0
                        ? (row[invIdx]?.trim() === '' ? -1 : (parseInt(row[invIdx] || '-1') ?? -1))
                        : -1;

                    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

                    const { data, error } = await supabase
                        .from('products')
                        .insert({
                            site_id: siteId,
                            name,
                            description,
                            price_cents: priceCents,
                            compare_at_cents: compareAtCents,
                            currency,
                            variants: variants || [],
                            inventory_count: inventoryCount,
                            images: [],
                            slug,
                            status,
                            sort_order: sortOffset++,
                        })
                        .select('id, name')
                        .single();

                    if (error) throw new Error(error.message);
                    imported.push(data);
                }
            } catch (err: any) {
                errors.push({ row: rowNum, name, error: err.message || 'Unknown error' });
            }
        }

        return NextResponse.json({
            imported: imported.length,
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
