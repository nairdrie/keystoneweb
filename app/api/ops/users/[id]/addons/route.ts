import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { createClient } from '@/lib/db/supabase-server';
import { ADDON_PRICES, type AddonType } from '@/lib/addons';
import { sendAddonApprovalEmail } from '@/lib/email';

const VALID_ADDON_TYPES: AddonType[] = ['extra_sites', 'extra_domains', 'extra_storage', 'extra_ai', 'white_label', 'extra_inbox_email'];

async function getAdminEmail(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const adminEmails = (process.env.OPS_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!adminEmails.includes(user.email?.toLowerCase() ?? '')) return null;
  return user.email!;
}

/**
 * GET /api/ops/users/[id]/addons
 * Fetch all add-ons for a user (admin only).
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminEmail = await getAdminEmail();
  if (!adminEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;
  const db = createAdminClient();

  // Fetch user info
  const { data: userInfo } = await db
    .from('users')
    .select('email, business_name')
    .eq('id', id)
    .single();

  // Fetch subscription
  const { data: sub } = await db
    .from('user_subscriptions')
    .select('subscription_plan, subscription_status, stripe_subscription_id')
    .eq('user_id', id)
    .single();

  // Fetch add-ons
  const { data: addons, error } = await db
    .from('user_addons')
    .select('*')
    .eq('user_id', id)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch add-ons' }, { status: 500 });
  }

  return NextResponse.json({
    user: userInfo,
    subscription: sub,
    addons: addons || [],
  });
}

/**
 * POST /api/ops/users/[id]/addons
 * Approve or update an add-on for a user (admin only).
 * Body: { addon_type, quantity, monthly_price?, yearly_price?, notes? }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminEmail = await getAdminEmail();
  if (!adminEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { addon_type, quantity, monthly_price, yearly_price, notes } = body;

  if (!addon_type || !VALID_ADDON_TYPES.includes(addon_type)) {
    return NextResponse.json({ error: 'Invalid addon_type' }, { status: 400 });
  }

  const qty = parseInt(quantity) || 1;
  if (qty < 1) {
    return NextResponse.json({ error: 'Quantity must be at least 1' }, { status: 400 });
  }

  const defaults = ADDON_PRICES[addon_type as AddonType];
  const mPrice = monthly_price ?? defaults.monthly;
  const yPrice = yearly_price ?? defaults.yearly;

  const db = createAdminClient();

  const { data: addon, error } = await db
    .from('user_addons')
    .upsert({
      user_id: id,
      addon_type,
      quantity: qty,
      status: 'approved',
      monthly_price: mPrice,
      yearly_price: yPrice,
      approved_by: adminEmail,
      approved_at: new Date().toISOString(),
      notes: notes || null,
      activated_at: null,
      cancelled_at: null,
      stripe_item_id: null,
      stripe_price_id: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,addon_type' })
    .select()
    .single();

  if (error) {
    console.error('Failed to upsert add-on:', error);
    return NextResponse.json({ error: 'Failed to save add-on' }, { status: 500 });
  }

  // Send approval email to user
  try {
    const { data: userInfo } = await db
      .from('users')
      .select('email, business_name')
      .eq('id', id)
      .single();

    if (userInfo?.email) {
      await sendAddonApprovalEmail({
        customerEmail: userInfo.email,
        customerName: userInfo.business_name || '',
        addonLabel: (await import('@/lib/addons')).ADDON_TYPES[addon_type as AddonType].label,
        quantity: qty,
        monthlyPrice: mPrice,
        settingsUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://keystoneweb.ca'}/settings`,
      });
    }
  } catch (emailErr) {
    console.error('Failed to send add-on approval email:', emailErr);
  }

  return NextResponse.json({ success: true, addon });
}

/**
 * DELETE /api/ops/users/[id]/addons
 * Cancel an add-on for a user (admin only).
 * Body: { addon_type }
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminEmail = await getAdminEmail();
  if (!adminEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { addon_type } = body;

  if (!addon_type || !VALID_ADDON_TYPES.includes(addon_type)) {
    return NextResponse.json({ error: 'Invalid addon_type' }, { status: 400 });
  }

  const db = createAdminClient();

  // Get current add-on to check if it has a Stripe item
  const { data: existing } = await db
    .from('user_addons')
    .select('stripe_item_id, status')
    .eq('user_id', id)
    .eq('addon_type', addon_type)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Add-on not found' }, { status: 404 });
  }

  // If active on Stripe, remove the subscription item
  if (existing.status === 'active' && existing.stripe_item_id) {
    try {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      await stripe.subscriptionItems.del(existing.stripe_item_id, {
        proration_behavior: 'create_prorations',
      });
    } catch (stripeErr) {
      console.error('Failed to remove Stripe subscription item:', stripeErr);
    }
  }

  const { error } = await db
    .from('user_addons')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      stripe_item_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', id)
    .eq('addon_type', addon_type);

  if (error) {
    return NextResponse.json({ error: 'Failed to cancel add-on' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
