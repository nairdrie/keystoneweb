import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { ShopRuleError, readJson, shopErrorResponse } from '@/lib/shop/access';
import { setTechCookie, signTechSession } from '@/lib/shop/tech-session';

export const runtime = 'nodejs';

const MAX_TRIES = 5;
const LOCK_MINUTES = 15;

// POST /api/shop/tech/login — { code, pin, label } → signs this phone/tablet in for the bay.
export async function POST(request: NextRequest) {
  try {
    const body = await readJson<{ code?: unknown; pin?: unknown; label?: unknown }>(request);
    const code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const pin = String(body.pin || '').trim();
    if (code.length < 4 || !/^\d{4,8}$/.test(pin)) throw new ShopRuleError('Enter the shop code and PIN.', undefined, 400);
    const db = createAdminClient();
    const { data: row } = await db.from('shop_settings').select('site_id, tech_pin_hash, tech_failed_attempts, tech_locked_until, legal_name').eq('tech_code', code).maybeSingle();
    // Same message for a wrong code and a wrong PIN.
    const wrong = new ShopRuleError('That code and PIN don’t match.', undefined, 401);
    if (!row || !row.tech_pin_hash) throw wrong;
    if (row.tech_locked_until && Date.parse(row.tech_locked_until) > Date.now()) {
      throw new ShopRuleError(`Too many wrong PINs. Try again in ${Math.ceil((Date.parse(row.tech_locked_until) - Date.now()) / 60000)} minutes, or ask the owner.`, undefined, 429);
    }
    const { data: site } = await db.from('sites').select('shop_enabled, site_slug').eq('id', row.site_id).single();
    if (!site?.shop_enabled) throw wrong;
    const ok = await bcrypt.compare(pin, row.tech_pin_hash);
    if (!ok) {
      const tries = (row.tech_failed_attempts || 0) + 1;
      await db.from('shop_settings').update({
        tech_failed_attempts: tries >= MAX_TRIES ? 0 : tries,
        tech_locked_until: tries >= MAX_TRIES ? new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() : null,
      }).eq('site_id', row.site_id);
      throw wrong;
    }
    await db.from('shop_settings').update({ tech_failed_attempts: 0, tech_locked_until: null }).eq('site_id', row.site_id);
    const label = String(body.label || '').trim().slice(0, 60) || 'Shop device';
    const { data: device, error } = await db.from('shop_tech_devices').insert({ site_id: row.site_id, label, last_seen_at: new Date().toISOString() }).select('id').single();
    if (error || !device) throw new Error(error?.message || 'Could not register device');
    const res = NextResponse.json({ ok: true, siteId: row.site_id, shop: row.legal_name || site.site_slug });
    setTechCookie(res, await signTechSession({ siteId: row.site_id, deviceId: device.id }));
    return res;
  } catch (err) {
    return shopErrorResponse(err);
  }
}
