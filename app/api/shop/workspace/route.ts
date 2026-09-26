import { NextRequest } from 'next/server';
import { loadWorkspace } from '@/lib/shop/data';
import { owner, run } from '@/lib/shop/http';

export const runtime = 'nodejs';

// GET /api/shop/workspace?siteId= — board, desk, suppliers, liens, intake.
export async function GET(request: NextRequest) {
  return run(async () => {
    const access = await owner(request);
    return loadWorkspace(access.db, access.siteId);
  });
}
