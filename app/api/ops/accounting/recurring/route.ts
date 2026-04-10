import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { requireOpsAccess } from '@/lib/ops/access';
import { getNextDueDate, type EntryType, type TaxType, type Frequency } from '@/lib/ops/accounting';

const VALID_FREQUENCIES: Frequency[] = ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'];

/**
 * GET /api/ops/accounting/recurring
 * List all recurring entries with invoice alert status.
 */
export async function GET() {
  const access = await requireOpsAccess();
  if (!access || !access.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = createAdminClient();
  const { data: recurring, error } = await db
    .from('accounting_recurring')
    .select('*')
    .order('is_active', { ascending: false })
    .order('next_due_date', { ascending: true });

  if (error) {
    console.error('[accounting/recurring GET]', error);
    return NextResponse.json({ error: 'Failed to load recurring entries' }, { status: 500 });
  }

  // For entries that require invoices, check which months are missing
  const activeWithInvoice = (recurring ?? []).filter((r: any) => r.is_active && r.requires_invoice);
  const recurringIds = activeWithInvoice.map((r: any) => r.id);

  let invoiceEntries: any[] = [];
  if (recurringIds.length > 0) {
    const { data } = await db
      .from('accounting_entries')
      .select('recurring_entry_id, date, invoice_storage_path')
      .in('recurring_entry_id', recurringIds)
      .not('invoice_storage_path', 'is', null);
    invoiceEntries = data ?? [];
  }

  // Build map of recurring_id -> set of months with invoices
  const invoiceMap = new Map<string, Set<string>>();
  for (const entry of invoiceEntries) {
    const key = entry.recurring_entry_id;
    if (!invoiceMap.has(key)) invoiceMap.set(key, new Set());
    invoiceMap.get(key)!.add(entry.date?.slice(0, 7));
  }

  // Compute missing invoice months for each recurring entry
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  const alerts: Record<string, string[]> = {};

  for (const r of activeWithInvoice) {
    const hasInvoices = invoiceMap.get(r.id) ?? new Set<string>();
    const missing: string[] = [];

    // Check from start_date up to current month
    let check = new Date(r.start_date + 'T00:00:00');
    const endCheck = r.end_date ? new Date(r.end_date + 'T00:00:00') : now;

    while (check <= endCheck && check.toISOString().slice(0, 7) <= currentMonth) {
      const monthKey = check.toISOString().slice(0, 7);
      if (!hasInvoices.has(monthKey)) {
        missing.push(monthKey);
      }
      check = new Date(getNextDueDate(check.toISOString().slice(0, 10), r.frequency as Frequency) + 'T00:00:00');
    }

    if (missing.length > 0) {
      alerts[r.id] = missing;
    }
  }

  return NextResponse.json({ recurring: recurring ?? [], invoiceAlerts: alerts });
}

/**
 * POST /api/ops/accounting/recurring
 * Create a new recurring entry.
 */
export async function POST(request: NextRequest) {
  const access = await requireOpsAccess();
  if (!access || !access.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const {
    type, title, description, amount_cents, tax_cents, tax_type,
    currency, category, frequency, start_date, end_date,
    requires_invoice, notes,
  } = body;

  if (!type || !['revenue', 'expense'].includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }
  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }
  if (typeof amount_cents !== 'number' || amount_cents < 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  }
  if (!frequency || !VALID_FREQUENCIES.includes(frequency)) {
    return NextResponse.json({ error: 'Invalid frequency' }, { status: 400 });
  }
  if (!start_date) {
    return NextResponse.json({ error: 'Start date is required' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('accounting_recurring')
    .insert({
      type: type as EntryType,
      title: title.trim(),
      description: description?.trim() || null,
      amount_cents: Math.round(amount_cents),
      tax_cents: Math.round(tax_cents ?? 0),
      tax_type: (tax_type as TaxType) || null,
      currency: currency || 'CAD',
      category: category || null,
      frequency: frequency as Frequency,
      start_date,
      end_date: end_date || null,
      next_due_date: start_date, // First occurrence
      requires_invoice: requires_invoice ?? true,
      notes: notes?.trim() || null,
      created_by: access.userId,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !data) {
    console.error('[accounting/recurring POST]', error);
    return NextResponse.json({ error: 'Failed to create recurring entry' }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * PATCH /api/ops/accounting/recurring
 * Update a recurring entry.
 */
export async function PATCH(request: NextRequest) {
  const access = await requireOpsAccess();
  if (!access || !access.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  const allowed: Record<string, boolean> = {
    type: true, title: true, description: true, amount_cents: true,
    tax_cents: true, tax_type: true, currency: true, category: true,
    frequency: true, start_date: true, end_date: true, next_due_date: true,
    is_active: true, requires_invoice: true, notes: true,
  };

  const sanitized: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [key, val] of Object.entries(updates)) {
    if (allowed[key]) sanitized[key] = val;
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('accounting_recurring')
    .update(sanitized)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    console.error('[accounting/recurring PATCH]', error);
    return NextResponse.json({ error: 'Failed to update recurring entry' }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/ops/accounting/recurring
 * Delete a recurring entry.
 */
export async function DELETE(request: NextRequest) {
  const access = await requireOpsAccess();
  if (!access || !access.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  const db = createAdminClient();
  const { error } = await db
    .from('accounting_recurring')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[accounting/recurring DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
