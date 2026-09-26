import { NextRequest } from 'next/server';
import { ShopRuleError } from '@/lib/shop/access';
import { ensureSettings, loadSiteInfo } from '@/lib/shop/data';
import { listDevices, saveSettings, setTechPin } from '@/lib/shop/actions/admin';
import { dismissIntake } from '@/lib/shop/actions/jobs';
import { aiConfigured, transcriptionConfigured } from '@/lib/shop/ai';
import { owner, ownerJson, run } from '@/lib/shop/http';

export const runtime = 'nodejs';

// GET /api/shop/settings?siteId=
export async function GET(request: NextRequest) {
  return run(async () => {
    const access = await owner(request);
    const settings = await ensureSettings(access.db, access.siteId);
    const [site, devices] = await Promise.all([loadSiteInfo(access.db, access.siteId, settings), listDevices(access)]);
    return {
      settings,
      devices,
      site: { name: site.name, base_url: site.base_url, stripe: site.stripe, paypal: site.paypal },
      services: { ai: aiConfigured(), transcription: transcriptionConfigured() },
    };
  });
}

// PUT /api/shop/settings — business details, rates, bays, staff, sign text.
export async function PUT(request: NextRequest) {
  return run(async () => {
    const { access, body } = await ownerJson(request);
    return { settings: await saveSettings(access, body) };
  });
}

// POST /api/shop/settings — { action: 'pin', pin, sign_out_devices, new_code } | { action: 'dismiss_intake', ref }
export async function POST(request: NextRequest) {
  return run(async () => {
    const { access, body } = await ownerJson<Record<string, unknown>>(request);
    if (body.action === 'pin') return { settings: await setTechPin(access, body.pin, { signOutDevices: body.sign_out_devices === true, newCode: body.new_code === true }) };
    if (body.action === 'dismiss_intake') return dismissIntake(access, body.ref);
    throw new ShopRuleError('Unknown action.', undefined, 400);
  });
}
