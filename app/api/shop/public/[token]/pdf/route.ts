import { NextRequest } from 'next/server';
import { publicPdf } from '@/lib/shop/actions/public';
import { pdfResponse, run } from '@/lib/shop/http';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return run(async () => {
    const { buffer, filename } = await publicPdf((await params).token);
    return pdfResponse(buffer, filename, request);
  });
}
