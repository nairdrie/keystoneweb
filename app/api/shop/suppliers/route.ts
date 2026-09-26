import { NextRequest } from 'next/server';
import { createSupplier } from '@/lib/shop/actions/admin';
import { owner, ownerJson, run } from '@/lib/shop/http';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return run(async () => {
    const access = await owner(request);
    const { data } = await access.db.from('shop_suppliers').select('*').eq('site_id', access.siteId).order('name');
    return { suppliers: data || [] };
  });
}

export async function POST(request: NextRequest) {
  return run(async () => {
    const { access, body } = await ownerJson(request);
    return createSupplier(access, body);
  });
}
