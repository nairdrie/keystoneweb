import { NextRequest } from 'next/server';
import { createCustomer, listCustomers } from '@/lib/shop/actions/admin';
import { owner, ownerJson, run } from '@/lib/shop/http';

export const runtime = 'nodejs';

// GET /api/shop/customers?siteId=&q=&archived=1 — search by name, phone, email, plate or VIN.
export async function GET(request: NextRequest) {
  return run(async () => {
    const access = await owner(request);
    const sp = request.nextUrl.searchParams;
    return { customers: await listCustomers(access, sp.get('q'), sp.get('archived') === '1') };
  });
}

// POST /api/shop/customers — new customer (optionally with a vehicle).
export async function POST(request: NextRequest) {
  return run(async () => {
    const { access, body } = await ownerJson(request);
    return createCustomer(access, body);
  });
}
