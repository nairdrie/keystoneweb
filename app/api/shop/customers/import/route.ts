import { NextRequest } from 'next/server';
import { importCustomers } from '@/lib/shop/actions/admin';
import { ownerJson, run } from '@/lib/shop/http';

export const runtime = 'nodejs';

// POST /api/shop/customers/import — { rows: [{ name, phone, email, address, notes }] }
export async function POST(request: NextRequest) {
  return run(async () => {
    const { access, body } = await ownerJson(request);
    return importCustomers(access, body.rows);
  });
}
