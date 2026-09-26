import { NextRequest } from 'next/server';
import { ShopRuleError, readJson } from '@/lib/shop/access';
import { approveOnline, declineOnline, loadPublicDoc, startPayment } from '@/lib/shop/actions/public';
import { run } from '@/lib/shop/http';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Ctx = { params: Promise<{ token: string }> };

// GET /api/shop/public/:token — the customer's estimate or invoice.
export async function GET(_request: NextRequest, { params }: Ctx) {
  return run(async () => loadPublicDoc((await params).token));
}

// POST /api/shop/public/:token — { action: approve | decline | pay }
export async function POST(request: NextRequest, { params }: Ctx) {
  return run(async () => {
    const { token } = await params;
    const body = await readJson<Record<string, unknown>>(request);
    switch (body.action) {
      case 'approve': return approveOnline(token, body, request);
      case 'decline': return declineOnline(token, body);
      case 'pay': return startPayment(token, body.provider);
      default: throw new ShopRuleError('Unknown action.', undefined, 400);
    }
  });
}
