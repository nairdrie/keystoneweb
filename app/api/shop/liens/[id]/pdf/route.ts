import { NextRequest } from 'next/server';
import { acknowledgmentPdfFor } from '@/lib/shop/actions/liens';
import { owner, pdfResponse, run } from '@/lib/shop/http';

export const runtime = 'nodejs';

// GET /api/shop/liens/:id/pdf — signed acknowledgment, schedule and credit disclosure.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const { id } = await params;
    const { buffer, filename } = await acknowledgmentPdfFor(await owner(request), id);
    return pdfResponse(buffer, filename, request);
  });
}
