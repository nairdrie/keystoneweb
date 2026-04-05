import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';

/** GET /api/membership/packages?siteId=xxx — List packages (public for active, all for admin) */
export async function GET(request: NextRequest) {
  try {
    const siteId = request.nextUrl.searchParams.get('siteId');
    if (!siteId) {
      return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    // Use admin client so we can fetch regardless of auth state
    const supabase = createAdminClient();

    const { data: packages, error } = await supabase
      .from('membership_packages')
      .select('*')
      .eq('site_id', siteId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch packages' }, { status: 500 });
    }

    return NextResponse.json({ packages: packages || [] });
  } catch (error: any) {
    console.error('Packages list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST /api/membership/packages — Create package (admin) */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteId, name, description, priceCents, currency, billingInterval, trialDays, features, sortOrder } = body;

    if (!siteId || !name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify ownership
    const { data: site } = await supabase
      .from('sites')
      .select('id, stripe_account_id')
      .eq('id', siteId)
      .eq('user_id', user.id)
      .single();

    if (!site) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // For paid packages, create Stripe Product + Price on connected account
    let stripePriceId = null;
    let stripeProductId = null;

    if (priceCents > 0 && billingInterval !== 'free') {
      if (!site.stripe_account_id) {
        return NextResponse.json({
          error: 'Please connect your Stripe account before creating paid packages',
        }, { status: 400 });
      }

      try {
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
          apiVersion: '2026-02-25.clover' as any,
        });

        // Create product on connected account
        const product = await stripe.products.create(
          { name, description: description || undefined },
          { stripeAccount: site.stripe_account_id }
        );
        stripeProductId = product.id;

        // Create price on connected account
        const priceData: any = {
          product: product.id,
          unit_amount: priceCents,
          currency: (currency || 'CAD').toLowerCase(),
        };

        if (billingInterval === 'month' || billingInterval === 'year') {
          priceData.recurring = { interval: billingInterval };
        }

        const price = await stripe.prices.create(priceData, {
          stripeAccount: site.stripe_account_id,
        });
        stripePriceId = price.id;
      } catch (stripeError: any) {
        console.error('Stripe product/price creation error:', stripeError);
        return NextResponse.json({
          error: `Stripe error: ${stripeError.message}`,
        }, { status: 500 });
      }
    }

    const { data: pkg, error: insertError } = await supabase
      .from('membership_packages')
      .insert({
        site_id: siteId,
        name,
        description: description || null,
        price_cents: priceCents || 0,
        currency: currency || 'CAD',
        billing_interval: billingInterval || 'free',
        trial_days: trialDays || 0,
        stripe_price_id: stripePriceId,
        stripe_product_id: stripeProductId,
        features: features || [],
        sort_order: sortOrder || 0,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Package creation error:', insertError);
      return NextResponse.json({ error: 'Failed to create package' }, { status: 500 });
    }

    return NextResponse.json({ package: pkg });
  } catch (error: any) {
    console.error('Package creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** PUT /api/membership/packages — Update package (admin) */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteId, packageId, ...updates } = body;

    if (!siteId || !packageId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify ownership
    const { data: site } = await supabase
      .from('sites')
      .select('id')
      .eq('id', siteId)
      .eq('user_id', user.id)
      .single();

    if (!site) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const dbUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.features !== undefined) dbUpdates.features = updates.features;
    if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
    if (updates.sortOrder !== undefined) dbUpdates.sort_order = updates.sortOrder;
    if (updates.trialDays !== undefined) dbUpdates.trial_days = updates.trialDays;

    const { error } = await supabase
      .from('membership_packages')
      .update(dbUpdates)
      .eq('id', packageId)
      .eq('site_id', siteId);

    if (error) {
      return NextResponse.json({ error: 'Failed to update package' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Package update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** DELETE /api/membership/packages — Delete package (admin) */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { siteId, packageId } = await request.json();
    if (!siteId || !packageId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: site } = await supabase
      .from('sites')
      .select('id')
      .eq('id', siteId)
      .eq('user_id', user.id)
      .single();

    if (!site) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Soft-delete by deactivating (members may reference this package)
    const { error } = await supabase
      .from('membership_packages')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', packageId)
      .eq('site_id', siteId);

    if (error) {
      return NextResponse.json({ error: 'Failed to delete package' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Package delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
