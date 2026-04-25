import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { requireOpsAccess } from '@/lib/ops/access';
import type { EntryType, EntrySource, TaxType } from '@/lib/ops/accounting';

// Revenue transaction types that appear as auto-entries in the transaction list
const STRIPE_REVENUE_TYPES = [
  'subscription_payment', 'subscription_created',
  'domain_purchase', 'domain_transfer',
  'ecommerce_order', 'one_time_payment',
];

const STRIPE_SOURCE_MAP: Record<string, string> = {
  subscription_payment: 'subscription',
  subscription_created: 'subscription',
  domain_purchase: 'domain_sale',
  domain_transfer: 'domain_sale',
  ecommerce_order: 'manual',
  one_time_payment: 'manual',
};

const STRIPE_CATEGORY_MAP: Record<string, string> = {
  subscription_payment: 'Subscriptions',
  subscription_created: 'Subscriptions',
  domain_purchase: 'Domains',
  domain_transfer: 'Domains',
  ecommerce_order: 'Other',
  one_time_payment: 'Other',
};

/**
 * GET /api/ops/accounting/entries
 * List accounting entries with filters.
 * Merges manual accounting_entries with auto-generated entries from
 * stripe_transactions so that subscription/domain payments appear
 * alongside manual entries in a single, sortable list.
 */
export async function GET(request: NextRequest) {
  const access = await requireOpsAccess();
  if (!access || (!access.isAdmin && !access.isAgent)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const source = searchParams.get('source');
  const category = searchParams.get('category');
  const dateFrom = searchParams.get('from');
  const dateTo = searchParams.get('to');
  const search = searchParams.get('search');
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10) || 0);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10) || 50));

  const db = createAdminClient();

  // ── Manual accounting entries ──────────────────────────────────────────
  let manualQuery = db
    .from('accounting_entries')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (type && (type === 'revenue' || type === 'expense')) {
    manualQuery = manualQuery.eq('type', type);
  }
  if (source) {
    manualQuery = manualQuery.eq('source', source);
  }
  if (category) {
    manualQuery = manualQuery.eq('category', category);
  }
  if (dateFrom) {
    manualQuery = manualQuery.gte('date', dateFrom);
  }
  if (dateTo) {
    manualQuery = manualQuery.lte('date', dateTo);
  }
  if (search) {
    manualQuery = manualQuery.or(`title.ilike.%${search}%,description.ilike.%${search}%,notes.ilike.%${search}%`);
  }

  // ── Stripe revenue transactions (auto-entries) ─────────────────────────
  // Skip if filtering to expenses only, since Stripe transactions are revenue.
  const includeStripe = type !== 'expense';

  let stripeEntries: any[] = [];
  if (includeStripe) {
    let stripeQuery = db
      .from('stripe_transactions')
      .select('id, stripe_event_id, transaction_type, description, plan_name, amount_cents, currency, status, user_id, created_at')
      .eq('status', 'succeeded')
      .in('transaction_type', STRIPE_REVENUE_TYPES)
      .gt('amount_cents', 0)
      .order('created_at', { ascending: false });

    if (dateFrom) {
      stripeQuery = stripeQuery.gte('created_at', dateFrom);
    }
    if (dateTo) {
      stripeQuery = stripeQuery.lte('created_at', dateTo + 'T23:59:59.999Z');
    }
    if (search) {
      stripeQuery = stripeQuery.or(`description.ilike.%${search}%,plan_name.ilike.%${search}%`);
    }

    const { data: stripeTx } = await stripeQuery;

    stripeEntries = (stripeTx ?? [])
      .filter((tx: any) => {
        // Apply source/category filters
        if (source && STRIPE_SOURCE_MAP[tx.transaction_type] !== source) return false;
        if (category && STRIPE_CATEGORY_MAP[tx.transaction_type] !== category) return false;
        return true;
      })
      .map((tx: any) => ({
        id: tx.id,
        type: 'revenue' as const,
        source: STRIPE_SOURCE_MAP[tx.transaction_type] ?? 'manual',
        title: tx.description || `${tx.transaction_type} payment`,
        description: tx.plan_name ? `Plan: ${tx.plan_name}` : null,
        amount_cents: tx.amount_cents,
        tax_cents: 0,
        tax_type: null,
        currency: (tx.currency || 'cad').toUpperCase(),
        category: STRIPE_CATEGORY_MAP[tx.transaction_type] ?? null,
        date: tx.created_at?.slice(0, 10) ?? '',
        reference_id: tx.stripe_event_id,
        reference_type: 'stripe_event',
        user_id: tx.user_id,
        recurring_entry_id: null,
        invoice_storage_path: null,
        invoice_filename: null,
        notes: null,
        is_auto: true,
        created_by: null,
        created_at: tx.created_at,
        updated_at: tx.created_at,
      }));
  }

  const { data: manualData, error } = await manualQuery;

  if (error) {
    console.error('[accounting/entries GET]', error);
    return NextResponse.json({ error: 'Failed to load entries' }, { status: 500 });
  }

  // ── Merge, sort, and paginate ──────────────────────────────────────────
  const merged = [...(manualData ?? []), ...stripeEntries]
    .sort((a, b) => {
      // Sort by date descending, then created_at descending
      if (a.date !== b.date) return a.date > b.date ? -1 : 1;
      return (a.created_at ?? '') > (b.created_at ?? '') ? -1 : 1;
    });

  const total = merged.length;
  const paged = merged.slice(offset, offset + limit);

  return NextResponse.json({
    entries: paged,
    total,
    offset,
    limit,
    hasMore: offset + paged.length < total,
  });
}

/**
 * POST /api/ops/accounting/entries
 * Create a new manual accounting entry.
 */
export async function POST(request: NextRequest) {
  const access = await requireOpsAccess();
  if (!access || (!access.isAdmin && !access.isAgent)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const {
    type,
    title,
    description,
    amount_cents,
    tax_cents,
    tax_type,
    currency,
    category,
    date,
    notes,
    recurring_entry_id,
  } = body;

  if (!type || !['revenue', 'expense'].includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }
  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }
  if (typeof amount_cents !== 'number' || amount_cents < 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('accounting_entries')
    .insert({
      type: type as EntryType,
      source: 'manual' as EntrySource,
      title: title.trim(),
      description: description?.trim() || null,
      amount_cents: Math.round(amount_cents),
      tax_cents: Math.round(tax_cents ?? 0),
      tax_type: (tax_type as TaxType) || null,
      currency: currency || 'CAD',
      category: category || null,
      date: date || new Date().toISOString().slice(0, 10),
      recurring_entry_id: recurring_entry_id || null,
      notes: notes?.trim() || null,
      is_auto: false,
      created_by: access.userId,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !data) {
    console.error('[accounting/entries POST]', error);
    return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * PATCH /api/ops/accounting/entries
 * Update an existing manual entry.
 */
export async function PATCH(request: NextRequest) {
  const access = await requireOpsAccess();
  if (!access || (!access.isAdmin && !access.isAgent)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: 'Entry ID is required' }, { status: 400 });
  }

  const allowed: Record<string, boolean> = {
    type: true, title: true, description: true, amount_cents: true,
    tax_cents: true, tax_type: true, currency: true, category: true,
    date: true, notes: true, invoice_storage_path: true, invoice_filename: true,
  };

  const sanitized: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [key, val] of Object.entries(updates)) {
    if (allowed[key]) sanitized[key] = val;
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('accounting_entries')
    .update(sanitized)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    console.error('[accounting/entries PATCH]', error);
    return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/ops/accounting/entries
 * Delete a manual entry.
 */
export async function DELETE(request: NextRequest) {
  const access = await requireOpsAccess();
  if (!access || (!access.isAdmin && !access.isAgent)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Entry ID is required' }, { status: 400 });
  }

  const db = createAdminClient();
  const { error } = await db
    .from('accounting_entries')
    .delete()
    .eq('id', id)
    .eq('is_auto', false); // Safety: don't delete auto entries

  if (error) {
    console.error('[accounting/entries DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete entry' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
