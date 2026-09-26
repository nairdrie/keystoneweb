import { NextRequest } from 'next/server';
import { customerFile, updateCustomer } from '@/lib/shop/actions/admin';
import { owner, ownerJson, run } from '@/lib/shop/http';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/shop/customers/:id — the customer file: vehicles, visits, invoices, liens.
export async function GET(request: NextRequest, { params }: Ctx) {
  return run(async () => {
    const { id } = await params;
    return customerFile(await owner(request), id);
  });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  return run(async () => {
    const { id } = await params;
    const { access, body } = await ownerJson(request);
    return updateCustomer(access, id, body);
  });
}
