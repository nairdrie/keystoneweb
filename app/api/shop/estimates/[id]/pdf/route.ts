import { NextRequest } from 'next/server';
import { estimatePdfFor } from '@/lib/shop/actions/estimates';
import { owner, pdfResponse, run } from '@/lib/shop/http';

export const runtime = 'nodejs';

// GET /api/shop/estimates/:id/pdf?siteId=&download=1
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const { id } = await params;
    const { buffer, filename } = await estimatePdfFor(await owner(request), id);
    return pdfResponse(buffer, filename, request);
  });
}
