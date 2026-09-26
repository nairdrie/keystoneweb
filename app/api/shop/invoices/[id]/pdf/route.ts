import { NextRequest } from 'next/server';
import { invoicePdfFor } from '@/lib/shop/actions/invoices';
import { owner, pdfResponse, run } from '@/lib/shop/http';

export const runtime = 'nodejs';

// GET /api/shop/invoices/:id/pdf?siteId=&download=1
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const { id } = await params;
    const { buffer, filename } = await invoicePdfFor(await owner(request), id);
    return pdfResponse(buffer, filename, request);
  });
}
