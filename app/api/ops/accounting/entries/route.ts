import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { requireOpsAccess } from '@/lib/ops/access';
import type { EntryType, EntrySource, TaxType } from '@/lib/ops/accounting';

/**
 * GET /api/ops/accounting/entries
 * List accounting entries with filters.
 */
export async function GET(request: NextRequest) {
  const access = await requireOpsAccess();
  if (!access || !access.isAdmin) {
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
  let query = db
    .from('accounting_entries')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  let countQuery = db
    .from('accounting_entries')
    .select('id', { count: 'exact', head: true });

  if (type && (type === 'revenue' || type === 'expense')) {
    query = query.eq('type', type);
    countQuery = countQuery.eq('type', type);
  }
  if (source) {
    query = query.eq('source', source);
    countQuery = countQuery.eq('source', source);
  }
  if (category) {
    query = query.eq('category', category);
    countQuery = countQuery.eq('category', category);
  }
  if (dateFrom) {
    query = query.gte('date', dateFrom);
    countQuery = countQuery.gte('date', dateFrom);
  }
  if (dateTo) {
    query = query.lte('date', dateTo);
    countQuery = countQuery.lte('date', dateTo);
  }
  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,notes.ilike.%${search}%`);
    countQuery = countQuery.or(`title.ilike.%${search}%,description.ilike.%${search}%,notes.ilike.%${search}%`);
  }

  const [{ data, error }, { count, error: countError }] = await Promise.all([
    query.range(offset, offset + limit - 1),
    countQuery,
  ]);

  if (error || countError) {
    console.error('[accounting/entries GET]', error || countError);
    return NextResponse.json({ error: 'Failed to load entries' }, { status: 500 });
  }

  return NextResponse.json({
    entries: data ?? [],
    total: count ?? 0,
    offset,
    limit,
    hasMore: offset + (data?.length ?? 0) < (count ?? 0),
  });
}

/**
 * POST /api/ops/accounting/entries
 * Create a new manual accounting entry.
 */
export async function POST(request: NextRequest) {
  const access = await requireOpsAccess();
  if (!access || !access.isAdmin) {
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
  if (!access || !access.isAdmin) {
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
  if (!access || !access.isAdmin) {
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
