import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-02-25.clover' as any,
});

/**
 * GET /api/stripe/connect-products?siteId=xxx
 *
 * Fetches active products from the merchant's connected Stripe account.
 * Returns product name, description, price, images, and currency.
 */
export async function GET(request: NextRequest) {
    try {
        const siteId = request.nextUrl.searchParams.get('siteId');
        if (!siteId) {
            return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
        }

        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: site } = await supabase
            .from('sites')
            .select('stripe_account_id')
            .eq('id', siteId)
            .eq('user_id', user.id)
            .single();

        if (!site) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (!site.stripe_account_id) {
            return NextResponse.json({ error: 'No Stripe account connected' }, { status: 400 });
        }

        const connectedAccountId = site.stripe_account_id;

        // Fetch active products from the connected account
        const products = await stripe.products.list(
            { active: true, limit: 100 },
            { stripeAccount: connectedAccountId }
        );

        if (products.data.length === 0) {
            return NextResponse.json({ products: [] });
        }

        // Fetch one active price per product
        const results = [];
        for (const product of products.data) {
            const prices = await stripe.prices.list(
                { product: product.id, active: true, limit: 1 },
                { stripeAccount: connectedAccountId }
            );

            const price = prices.data[0];

            results.push({
                stripe_product_id: product.id,
                name: product.name,
                description: product.description || null,
                images: product.images || [],
                price_cents: price?.unit_amount ?? 0,
                currency: (price?.currency ?? 'cad').toUpperCase(),
            });
        }

        return NextResponse.json({ products: results });
    } catch (error: any) {
        console.error('Stripe connect-products GET error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * POST /api/stripe/connect-products
 *
 * Syncs selected Stripe products into the Keystone products table.
 * Accepts an array of stripe_product_ids to import. Skips duplicates by name.
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { siteId, products: productsToSync } = body;

        if (!siteId || !Array.isArray(productsToSync) || productsToSync.length === 0) {
            return NextResponse.json({ error: 'Missing siteId or products' }, { status: 400 });
        }

        // Verify ownership
        const { data: site } = await supabase
            .from('sites')
            .select('stripe_account_id')
            .eq('id', siteId)
            .eq('user_id', user.id)
            .single();

        if (!site) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (!site.stripe_account_id) {
            return NextResponse.json({ error: 'No Stripe account connected' }, { status: 400 });
        }

        // Get existing product names to skip duplicates
        const { data: existingProducts } = await supabase
            .from('products')
            .select('name')
            .eq('site_id', siteId)
            .eq('is_archived', false);

        const existingNames = new Set(
            (existingProducts || []).map(p => p.name.toLowerCase())
        );

        // Get current max sort_order
        const { data: lastProduct } = await supabase
            .from('products')
            .select('sort_order')
            .eq('site_id', siteId)
            .order('sort_order', { ascending: false })
            .limit(1);

        let nextOrder = (lastProduct?.[0]?.sort_order ?? -1) + 1;

        let importedCount = 0;
        let skippedCount = 0;

        for (const product of productsToSync) {
            if (existingNames.has(product.name.toLowerCase())) {
                skippedCount++;
                continue;
            }

            const slug = product.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '');

            await supabase.from('products').insert({
                site_id: siteId,
                name: product.name,
                description: product.description || null,
                price_cents: product.price_cents || 0,
                currency: product.currency || 'CAD',
                images: product.images || [],
                variants: [],
                inventory_count: -1,
                slug,
                sort_order: nextOrder++,
                is_active: true,
                status: 'draft',
            });

            importedCount++;
        }

        return NextResponse.json({ imported: importedCount, skipped: skippedCount });
    } catch (error: any) {
        console.error('Stripe connect-products POST error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
