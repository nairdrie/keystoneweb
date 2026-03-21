import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import crypto from 'crypto';

/**
 * POST /api/sites/analytics/track
 * Public endpoint called by the tracking script on published sites.
 * Logs a page visit without requiring authentication.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { siteId, pagePath, referrer, sessionId, durationMs } = body;

    if (!siteId) {
      return NextResponse.json({ error: 'siteId required' }, { status: 400 });
    }

    // Build a privacy-safe visitor hash from IP + User-Agent
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';
    const ua = req.headers.get('user-agent') || 'unknown';
    const visitorHash = crypto
      .createHash('sha256')
      .update(`${ip}::${ua}`)
      .digest('hex');

    // Classify referrer source
    const referrerSource = classifyReferrer(referrer);

    // Detect device type from User-Agent
    const deviceType = detectDeviceType(ua);
    const browser = detectBrowser(ua);
    const os = detectOS(ua);

    const admin = createAdminClient();
    await admin.from('site_visits').insert({
      site_id: siteId,
      visitor_hash: visitorHash,
      page_path: pagePath || '/',
      referrer: referrer || null,
      referrer_source: referrerSource,
      device_type: deviceType,
      browser,
      os,
      session_id: sessionId || null,
      duration_ms: durationMs || null,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[analytics/track] Error:', err);
    return NextResponse.json({ ok: true }); // Never break the client
  }
}

function classifyReferrer(referrer?: string): string {
  if (!referrer) return 'direct';
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    if (
      host.includes('google') ||
      host.includes('bing') ||
      host.includes('yahoo') ||
      host.includes('duckduckgo') ||
      host.includes('baidu')
    ) {
      return 'organic';
    }
    if (
      host.includes('facebook') ||
      host.includes('twitter') ||
      host.includes('x.com') ||
      host.includes('instagram') ||
      host.includes('linkedin') ||
      host.includes('tiktok') ||
      host.includes('reddit') ||
      host.includes('pinterest') ||
      host.includes('youtube')
    ) {
      return 'social';
    }
    return 'referral';
  } catch {
    return 'direct';
  }
}

function detectDeviceType(ua: string): string {
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  if (/mobile|android|iphone|ipod/i.test(ua)) return 'mobile';
  return 'desktop';
}

function detectBrowser(ua: string): string {
  if (/edg\//i.test(ua)) return 'Edge';
  if (/chrome|crios/i.test(ua)) return 'Chrome';
  if (/firefox|fxios/i.test(ua)) return 'Firefox';
  if (/safari/i.test(ua) && !/chrome/i.test(ua)) return 'Safari';
  if (/opera|opr/i.test(ua)) return 'Opera';
  return 'Other';
}

function detectOS(ua: string): string {
  if (/windows/i.test(ua)) return 'Windows';
  if (/macintosh|mac os/i.test(ua)) return 'macOS';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/android/i.test(ua)) return 'Android';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Other';
}
