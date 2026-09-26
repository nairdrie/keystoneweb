import { NextRequest } from 'next/server';
import { ShopRuleError } from '@/lib/shop/access';
import { authorizeEstimate, declineEstimate, deleteEstimate, newVersion, saveEstimate, sendEstimate } from '@/lib/shop/actions/estimates';
import { owner, ownerJson, run } from '@/lib/shop/http';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/shop/estimates/:id — save a draft (lines, dates, notes).
export async function PATCH(request: NextRequest, { params }: Ctx) {
  return run(async () => {
    const { id } = await params;
    const { access, body } = await ownerJson(request);
    return saveEstimate(access, id, body);
  });
}

// DELETE /api/shop/estimates/:id — drafts only.
export async function DELETE(request: NextRequest, { params }: Ctx) {
  return run(async () => {
    const { id } = await params;
    return deleteEstimate(await owner(request), id);
  });
}

// POST /api/shop/estimates/:id — { action: send | authorize | decline | new_version }
export async function POST(request: NextRequest, { params }: Ctx) {
  return run(async () => {
    const { id } = await params;
    const { access, body } = await ownerJson<Record<string, unknown>>(request);
    switch (body.action) {
      case 'send': return sendEstimate(access, id, body);
      case 'authorize': return authorizeEstimate(access, id, body, { request });
      case 'decline': return declineEstimate(access, id, body);
      case 'new_version': return newVersion(access, id);
      default: throw new ShopRuleError('Unknown action.', undefined, 400);
    }
  });
}
