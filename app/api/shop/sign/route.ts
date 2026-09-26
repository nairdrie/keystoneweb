import { NextRequest } from 'next/server';
import { ensureSettings, loadSiteInfo } from '@/lib/shop/data';
import { shopSignPdf } from '@/lib/shop/pdf';
import { owner, pdfResponse, run } from '@/lib/shop/http';

export const runtime = 'nodejs';

// GET /api/shop/sign?siteId= — the customer-rights sign to post at the counter (O. Reg. 17/05, s. 50).
export async function GET(request: NextRequest) {
  return run(async () => {
    const access = await owner(request);
    const settings = await ensureSettings(access.db, access.siteId);
    const site = await loadSiteInfo(access.db, access.siteId, settings);
    return pdfResponse(await shopSignPdf(settings, site.name), 'shop-sign.pdf', request);
  });
}
