import { NextRequest } from 'next/server';
import { ppsrSheet, updateLien } from '@/lib/shop/actions/liens';
import { owner, ownerJson, run } from '@/lib/shop/http';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/shop/liens/:id — what the PPSR registration asks for.
export async function GET(request: NextRequest, { params }: Ctx) {
  return run(async () => {
    const { id } = await params;
    return ppsrSheet(await owner(request), id);
  });
}

// PATCH /api/shop/liens/:id — { action: register_ppsr | register_discharge | update_debtor | cancel }
export async function PATCH(request: NextRequest, { params }: Ctx) {
  return run(async () => {
    const { id } = await params;
    const { access, body } = await ownerJson(request);
    return updateLien(access, id, body);
  });
}
