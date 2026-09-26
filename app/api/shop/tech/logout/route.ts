import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { clearTechCookie, readTechSession } from '@/lib/shop/tech-session';

export const runtime = 'nodejs';

// POST /api/shop/tech/logout — sign this device out.
export async function POST(request: NextRequest) {
  const session = await readTechSession(request);
  if (session) {
    await createAdminClient().from('shop_tech_devices').update({ revoked_at: new Date().toISOString() }).eq('id', session.deviceId).eq('site_id', session.siteId);
  }
  const res = NextResponse.json({ ok: true });
  clearTechCookie(res);
  return res;
}
