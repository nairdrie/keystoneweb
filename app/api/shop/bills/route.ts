import { NextRequest } from 'next/server';
import { ShopRuleError } from '@/lib/shop/access';
import { createBillFromUpload, createBillManual } from '@/lib/shop/actions/bills';
import { loadPartsView } from '@/lib/shop/views';
import { fileFrom, owner, ownerOnly, readForm, run, tech } from '@/lib/shop/http';

export const runtime = 'nodejs';
export const maxDuration = 120;

// GET /api/shop/bills?siteId= — the pile, supplier tabs, cores owed, parts never billed.
export async function GET(request: NextRequest) {
  return run(async () => {
    const access = await owner(request);
    return loadPartsView(access.db, access.siteId);
  });
}

// POST /api/shop/bills — multipart photo/PDF (tech or desk; AI reads it) or JSON typed in by the desk.
export async function POST(request: NextRequest) {
  return run(async () => {
    const access = await tech(request);
    if ((request.headers.get('content-type') || '').includes('multipart/form-data')) {
      const form = await readForm(request);
      const file = await fileFrom(form, 'file');
      if (!file) throw new ShopRuleError('Take a photo of the invoice.', undefined, 400);
      const note = form.get('note');
      const jobId = form.get('job_id');
      return createBillFromUpload(access, request, {
        buffer: file.buffer,
        mime: file.mime,
        handwritten_note: typeof note === 'string' ? note : null,
        job_id: typeof jobId === 'string' ? jobId : null,
      });
    }
    ownerOnly(access);
    const body = await request.json().catch(() => { throw new ShopRuleError('The request body must be JSON.', undefined, 400); });
    return createBillManual(access, body);
  });
}
