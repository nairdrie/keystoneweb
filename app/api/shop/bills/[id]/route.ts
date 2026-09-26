import { NextRequest } from 'next/server';
import { ShopRuleError } from '@/lib/shop/access';
import { deleteBill, matchBill, rereadBill, updateBill } from '@/lib/shop/actions/bills';
import { owner, ownerJson, run, techJson } from '@/lib/shop/http';

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
// A tech device can match an invoice it snapped from a car's screen to that car only.
export async function POST(request: NextRequest, { params }: Ctx) {
  return run(async () => {
    const { id } = await params;
    const { access, body } = await techJson<Record<string, unknown>>(request);
    if (access.isTech) {
      const { data: bill } = await access.db.from('shop_supplier_bills').select('suggested_job_id, status').eq('site_id', access.siteId).eq('id', id).maybeSingle();
      if (body.action !== 'match' || body.target !== 'job' || !bill || bill.status !== 'needs_match' || !bill.suggested_job_id || bill.suggested_job_id !== body.job_id) {
        throw new ShopRuleError('Ask the service desk to file this one.', undefined, 403);
      }
      return matchBill(access, id, { target: 'job', job_id: bill.suggested_job_id });
    }
    if (body.action === 'match') return matchBill(access, id, body);
    if (body.action === 'reread') return rereadBill(access, id);
    throw new ShopRuleError('Unknown action.', undefined, 400);
  });
}
