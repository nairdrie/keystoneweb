/**
 * Read models for the Parts and Money screens.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureSettings, loadBills, loadLiens, paidByInvoice } from './data';
import { coresOwed, collectedSince, hstReturn, profitAndLoss, supplierTabs, unbilledParts, weekStart, type ReceivableRow } from './reports';
import { addDays, daysBetween, monthRange, quarterRange, todayISO } from './dates';
import { invoiceLabel, vehicleLabel } from './board';
import type { Invoice, Payment, Supplier, SupplierBill } from './types';

type Db = SupabaseClient;

export interface OpenJobOption { id: string; ro_number: number; label: string; parts: string[] }

async function openJobOptions(db: Db, siteId: string): Promise<OpenJobOption[]> {
  const { data } = await db
    .from('shop_jobs')
    .select('id, ro_number, customer:shop_customers(name), vehicle:shop_vehicles(year, make, model), estimates:shop_estimates(status, lines:shop_estimate_lines(kind, description, decision))')
    .eq('site_id', siteId)
    .or(`status.eq.open,closed_at.gte.${addDays(todayISO(), -30)}`)
    .order('ro_number', { ascending: false })
    .limit(80);
  return ((data || []) as unknown as {
    id: string; ro_number: number; customer: { name: string } | null; vehicle: { year: number | null; make: string | null; model: string | null } | null;
    estimates: { status: string; lines: { kind: string; description: string; decision: string }[] }[];
  }[]).map(j => {
    const est = j.estimates.find(e => e.status === 'approved') ?? j.estimates[j.estimates.length - 1];
    return {
      id: j.id,
      ro_number: j.ro_number,
      label: `RO-${j.ro_number} · ${j.customer?.name ?? 'Customer'} · ${j.vehicle ? vehicleLabel(j.vehicle) : 'Vehicle'}`,
      parts: (est?.lines || []).filter(l => l.kind === 'part' && l.decision === 'include').map(l => l.description),
    };
  });
}

export async function loadPartsView(db: Db, siteId: string) {
  const since = addDays(todayISO(), -120);
  const [recent, unpaid, suppliersRes, jobs] = await Promise.all([
    loadBills(db, siteId, { since: `${since}T00:00:00Z` }),
    loadBills(db, siteId, { status: ['needs_match', 'matched', 'stock'] }),
    db.from('shop_suppliers').select('*').eq('site_id', siteId).order('name'),
    openJobOptions(db, siteId),
  ]);
  const byId = new Map<string, SupplierBill>();
  for (const b of [...recent, ...unpaid]) byId.set(b.id, b);
  const bills = [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const suppliers = (suppliersRes.data || []) as Supplier[];

  const jobIds = [...new Set(bills.flatMap(b => b.lines.map(l => l.job_id)).filter((x): x is string => !!x))];
  const invoicesByJob = new Map<string, Pick<Invoice, 'snapshot'>>();
  const roByJob = new Map<string, number>();
  if (jobIds.length) {
    const [invs, jobRows] = await Promise.all([
      db.from('shop_invoices').select('job_id, snapshot').eq('site_id', siteId).eq('status', 'issued').in('job_id', jobIds),
      db.from('shop_jobs').select('id, ro_number').eq('site_id', siteId).in('id', jobIds),
    ]);
    for (const i of (invs.data || []) as { job_id: string; snapshot: Invoice['snapshot'] }[]) invoicesByJob.set(i.job_id, { snapshot: i.snapshot });
    for (const j of (jobRows.data || []) as { id: string; ro_number: number }[]) roByJob.set(j.id, j.ro_number);
  }
  return {
    bills,
    suppliers,
    jobs,
    ro_by_job: Object.fromEntries(roByJob),
    tabs: supplierTabs(bills.filter(b => b.status !== 'returned'), suppliers),
    cores: coresOwed(bills, suppliers),
    unbilled: unbilledParts(bills, suppliers, invoicesByJob, roByJob),
  };
}

export async function loadMoneyView(db: Db, siteId: string, period: string | null) {
  const today = todayISO();
  const at = period && /^\d{4}-\d{2}-\d{2}$/.test(period) ? period : today;
  const settings = await ensureSettings(db, siteId);
  const q = quarterRange(at);
  const m = monthRange(at);
  const from = q.start < m.start ? q.start : m.start;

  const { data: openInv } = await db
    .from('shop_invoices')
    .select('id, job_id, invoice_number, issued_at, total_cents, snapshot, job:shop_jobs(id, status, closed_reason, holding_since, returned_at, customer:shop_customers(name, customer_type), vehicle:shop_vehicles(year, make, model))')
    .eq('site_id', siteId)
    .eq('status', 'issued')
    .order('issued_at', { ascending: true })
    .limit(1000);
  const invRows = (openInv || []) as unknown as (Pick<Invoice, 'id' | 'job_id' | 'invoice_number' | 'issued_at' | 'total_cents' | 'snapshot'> & {
    job: { id: string; status: string; closed_reason: string | null; holding_since: string | null; returned_at: string | null; customer: { name: string; customer_type: 'consumer' | 'business' }; vehicle: { year: number | null; make: string | null; model: string | null } };
  })[];
  const paid = await paidByInvoice(db, siteId, invRows.map(i => i.id));
  const liens = await loadLiens(db, siteId, ['active', 'paid', 'discharged']);
  const activeLienByInvoice = new Map(liens.filter(l => l.status === 'active').map(l => [l.invoice_id, l.id]));
  const receivables: ReceivableRow[] = invRows
    .map(i => {
      const p = paid.get(i.id) ?? 0;
      const lienId = activeLienByInvoice.get(i.id) ?? null;
      const situation: ReceivableRow['situation'] = i.job.holding_since ? 'holding' : lienId ? 'plan' : i.job.status === 'open' && !i.job.returned_at ? 'on_lot' : 'released';
      return {
        invoice_id: i.id,
        job_id: i.job_id,
        invoice_label: invoiceLabel(i.invoice_number),
        customer_name: i.job.customer.name,
        customer_type: i.job.customer.customer_type,
        vehicle: vehicleLabel(i.job.vehicle),
        issued_on: i.issued_at.slice(0, 10),
        total_cents: i.total_cents,
        paid_cents: p,
        balance_cents: i.total_cents - p,
        age_days: daysBetween(i.issued_at.slice(0, 10), today),
        situation,
        lien_id: lienId,
      };
    })
    .filter(r => r.balance_cents > 0);

  const [periodInv, periodBills, payments] = await Promise.all([
    db.from('shop_invoices').select('issued_at, subtotal_cents, tax_cents, status, snapshot').eq('site_id', siteId).gte('issued_at', `${from}T00:00:00Z`).lte('issued_at', `${addDays(q.end > m.end ? q.end : m.end, 1)}T06:00:00Z`),
    loadBills(db, siteId, { since: `${addDays(from, -45)}T00:00:00Z` }),
    db.from('shop_payments').select('id, invoice_id, job_id, lien_id, amount_cents, method, reference, received_at, recorded_by, notes, provider_ref').eq('site_id', siteId).gte('received_at', `${addDays(today, -60)}T00:00:00Z`).order('received_at', { ascending: false }).limit(300),
  ]);
  const inv = (periodInv.data || []) as Pick<Invoice, 'issued_at' | 'subtotal_cents' | 'tax_cents' | 'status' | 'snapshot'>[];
  const pays = (payments.data || []) as Payment[];
  const aging = { current: 0, d30: 0, d60: 0, d90: 0 };
  for (const r of receivables) {
    if (r.age_days < 30) aging.current += r.balance_cents;
    else if (r.age_days < 60) aging.d30 += r.balance_cents;
    else if (r.age_days < 90) aging.d60 += r.balance_cents;
    else aging.d90 += r.balance_cents;
  }
  return {
    period: at,
    receivables,
    aging,
    owed_cents: receivables.reduce((s, r) => s + r.balance_cents, 0),
    liens,
    hst: hstReturn(inv, periodBills, at),
    pnl: profitAndLoss(inv, periodBills, at),
    collected_week_cents: collectedSince(pays, weekStart(today)),
    collected_month_cents: collectedSince(pays, monthRange(today).start),
    payments: pays.slice(0, 50),
    hst_number: settings.hst_number,
    tax_label: settings.tax_label,
  };
}
