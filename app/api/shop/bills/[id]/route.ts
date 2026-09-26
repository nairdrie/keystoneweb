import { NextRequest } from 'next/server';
import { ShopRuleError } from '@/lib/shop/access';
import { deleteBill, matchBill, rereadBill, updateBill } from '@/lib/shop/actions/bills';
import { owner, ownerJson, run } from '@/lib/shop/http';

export const runtime = 'nodejs';
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  return run(async () => {
    const { id } = await params;
    const { access, body } = await ownerJson(request);
    return updateBill(access, id, body);
  });
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  return run(async () => {
    const { id } = await params;
    return deleteBill(await owner(request), id);
  });
}

// POST /api/shop/bills/:id — { action: match | reread }
export async function POST(request: NextRequest, { params }: Ctx) {
  return run(async () => {
    const { id } = await params;
    const { access, body } = await ownerJson<Record<string, unknown>>(request);
    if (body.action === 'match') return matchBill(access, id, body);
    if (body.action === 'reread') return rereadBill(access, id);
    throw new ShopRuleError('Unknown action.', undefined, 400);
  });
}
