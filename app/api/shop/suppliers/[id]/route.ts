import { NextRequest } from 'next/server';
import { updateSupplier } from '@/lib/shop/actions/admin';
import { ownerJson, run } from '@/lib/shop/http';

export const runtime = 'nodejs';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const { id } = await params;
    const { access, body } = await ownerJson(request);
    return updateSupplier(access, id, body);
  });
}
