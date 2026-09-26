import { NextRequest } from 'next/server';
import { ShopRuleError } from '@/lib/shop/access';
import { markBillsPaid, setCoreReturned } from '@/lib/shop/actions/bills';
import { aiConfigured, readSupplierStatement } from '@/lib/shop/ai';
import { DOC_TYPES, baseMime } from '@/lib/shop/files';
import { loadBills } from '@/lib/shop/data';
import { reconcileStatement } from '@/lib/shop/reports';
import { fileFrom, owner, ownerJson, readForm, run } from '@/lib/shop/http';

export const runtime = 'nodejs';
export const maxDuration = 120;

// POST /api/shop/bills/actions
//   JSON { action: 'paid', bill_ids, paid_on, paid } — mark supplier invoices paid/unpaid
//   JSON { action: 'core', line_id, returned } — core returned for credit
//   JSON { action: 'reconcile', supplier_id, numbers[] } — check a statement against the pile
//   multipart { action: 'reconcile', supplier_id, file } — same, reading a photo of the statement
export async function POST(request: NextRequest) {
  return run(async () => {
    if ((request.headers.get('content-type') || '').includes('multipart/form-data')) {
      const access = await owner(request);
      const form = await readForm(request);
      const file = await fileFrom(form, 'file');
      if (!file) throw new ShopRuleError('Take a photo of the statement.', undefined, 400);
      const mime = baseMime(file.mime);
      if (!DOC_TYPES.includes(mime)) throw new ShopRuleError('That file type isn’t supported here.', undefined, 400);
      if (!aiConfigured()) throw new ShopRuleError('AI reading isn’t set up on this server. Type the invoice numbers instead.', undefined, 503);
      const read = await readSupplierStatement({ buffer: file.buffer, mime });
      const supplierId = String(form.get('supplier_id') || '');
      const bills = await loadBills(access.db, access.siteId, {});
      const scoped = supplierId ? bills.filter(b => b.supplier_id === supplierId) : bills;
      return { read, result: reconcileStatement(read.entries.map(e => e.invoice_number), scoped) };
    }
    const { access, body } = await ownerJson<Record<string, unknown>>(request);
    switch (body.action) {
      case 'paid': return markBillsPaid(access, body.bill_ids, body.paid_on, body.paid !== false);
      case 'core': return setCoreReturned(access, String(body.line_id || ''), body.returned !== false);
      case 'reconcile': {
        const numbers = Array.isArray(body.numbers) ? body.numbers.map(String) : String(body.numbers || '').split(/[\s,;]+/);
        const bills = await loadBills(access.db, access.siteId, {});
        const scoped = typeof body.supplier_id === 'string' && body.supplier_id ? bills.filter(b => b.supplier_id === body.supplier_id) : bills;
        return { result: reconcileStatement(numbers, scoped) };
      }
      default: throw new ShopRuleError('Unknown action.', undefined, 400);
    }
  });
}
