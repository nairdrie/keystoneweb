import { NextRequest } from 'next/server';
import { ensureSettings, loadJobSummaries, loadSiteInfo } from '@/lib/shop/data';
import { aiConfigured, transcriptionConfigured } from '@/lib/shop/ai';
import { run, tech } from '@/lib/shop/http';

export const runtime = 'nodejs';

// GET /api/shop/tech/board — bays, staff and the cars a tech can pick up.
export async function GET(request: NextRequest) {
  return run(async () => {
    const access = await tech(request);
    const settings = await ensureSettings(access.db, access.siteId);
    const [site, jobs] = await Promise.all([loadSiteInfo(access.db, access.siteId, settings), loadJobSummaries(access.db, access.siteId, settings)]);
    return {
      siteId: access.siteId,
      shop: site.name,
      is_device: access.isTech,
      bays: settings.bays,
      staff: settings.staff,
      jobs: jobs.map(j => ({ ...j, invoice: null })),
      services: { ai: aiConfigured(), transcription: transcriptionConfigured() },
    };
  });
}
