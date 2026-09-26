import { NextRequest } from 'next/server';
import { ShopRuleError } from '@/lib/shop/access';
import { loadBills } from '@/lib/shop/data';
import { billsCsv, invoicesCsv, paymentsCsv, transactionsIif, type ExportInvoice, type ExportPayment } from '@/lib/shop/quickbooks';
import { addDays, quarterRange, shopMidnight } from '@/lib/shop/dates';
import { fileResponse, owner, run } from '@/lib/shop/http';
import type { Supplier } from '@/lib/shop/types';

export const runtime = 'nodejs';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/shop/export?siteId=&kind=invoices|payments|bills|iif&from=&to=
// QuickBooks Online CSV imports, or one IIF file for QuickBooks Desktop.
export async function GET(request: NextRequest) {
  return run(async () => {
    const access = await owner(request);
    const sp = request.nextUrl.searchParams;
    const kind = sp.get('kind') || 'invoices';
    const q = quarterRange();
    const from = DATE.test(sp.get('from') || '') ? sp.get('from')! : q.start;
    const to = DATE.test(sp.get('to') || '') ? sp.get('to')! : q.end;
    if (from > to) throw new ShopRuleError('The start date is after the end date.', undefined, 400);
    const { db, siteId } = access;
    const range = { from: shopMidnight(from), to: shopMidnight(addDays(to, 1)) };

    const loadInvoices = async (): Promise<(ExportInvoice & { id: string })[]> => {
      const { data } = await db.from('shop_invoices').select('id, invoice_number, issued_at, snapshot, status, total_cents, tax_cents')
        .eq('site_id', siteId).eq('status', 'issued').gte('issued_at', range.from).lt('issued_at', range.to).order('invoice_number');
      return (data || []) as (ExportInvoice & { id: string })[];
    };
    const loadPayments = async (): Promise<ExportPayment[]> => {
      const { data } = await db.from('shop_payments').select('received_at, amount_cents, method, reference, invoice:shop_invoices(invoice_number, snapshot)')
        .eq('site_id', siteId).gte('received_at', range.from).lt('received_at', range.to).order('received_at');
      return ((data || []) as unknown as { received_at: string; amount_cents: number; method: ExportPayment['method']; reference: string | null; invoice: { invoice_number: number; snapshot: { customer: { name: string } } } }[])
        .map(p => ({ received_at: p.received_at, amount_cents: p.amount_cents, method: p.method, reference: p.reference, invoice_number: p.invoice.invoice_number, customer_name: p.invoice.snapshot.customer.name }));
    };
    const loadPeriodBills = async () => {
      const bills = await loadBills(db, siteId, { since: `${addDays(from, -60)}T00:00:00Z` });
      const { data } = await db.from('shop_suppliers').select('*').eq('site_id', siteId);
      return {
        bills: bills.filter(b => { const d = (b.invoice_date || b.created_at).slice(0, 10); return d >= from && d <= to; }),
        suppliers: (data || []) as Supplier[],
      };
    };

    const stamp = `${from}_to_${to}`;
    switch (kind) {
      case 'invoices':
        return fileResponse(Buffer.from(invoicesCsv(await loadInvoices())), `shop-invoices_${stamp}.csv`, 'text/csv; charset=utf-8', true);
      case 'payments':
        return fileResponse(Buffer.from(paymentsCsv(await loadPayments())), `shop-payments_${stamp}.csv`, 'text/csv; charset=utf-8', true);
      case 'bills': {
        const { bills, suppliers } = await loadPeriodBills();
        return fileResponse(Buffer.from(billsCsv(bills, suppliers)), `supplier-bills_${stamp}.csv`, 'text/csv; charset=utf-8', true);
      }
      case 'iif': {
        const [invoices, payments, { bills, suppliers }] = await Promise.all([loadInvoices(), loadPayments(), loadPeriodBills()]);
        return fileResponse(Buffer.from(transactionsIif(invoices, payments, bills, suppliers)), `shop_${stamp}.iif`, 'text/plain; charset=utf-8', true);
      }
      default:
        throw new ShopRuleError('Unknown export.', undefined, 400);
    }
  });
}
