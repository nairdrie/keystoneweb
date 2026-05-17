import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { PUBLISHED_ROOT } from '@/lib/env/domain';

/**
 * Server-side 404 logging. Called fire-and-forget from the published-site
 * not-found.tsx boundary. The endpoint resolves the site by hostname so the
 * caller doesn't need credentials.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false }, { status: 400 });

  const { host, path, referrer } = body as { host?: string; path?: string; referrer?: string };
  if (!host || !path) return NextResponse.json({ ok: false }, { status: 400 });

  // Refuse to log paths that look like asset/probe scans to keep the table tidy.
  if (/\.(php|asp|aspx|jsp|env|git|sql|bak)$/i.test(path)) return NextResponse.json({ ok: true, skipped: true });

  try {
    const admin = createAdminClient();
    const clean = host.replace(/^www\./, '');
    let siteId: string | null = null;

    if (clean.endsWith(`.${PUBLISHED_ROOT}`)) {
      const subdomain = clean.slice(0, -1 - PUBLISHED_ROOT.length);
      const { data } = await admin
        .from('sites')
        .select('id')
        .eq('published_domain', subdomain)
        .eq('is_published', true)
        .maybeSingle();
      siteId = data?.id ?? null;
    } else {
      const { data } = await admin
        .from('sites')
        .select('id')
        .eq('custom_domain', clean)
        .eq('is_published', true)
        .maybeSingle();
      siteId = data?.id ?? null;
    }

    if (!siteId) return NextResponse.json({ ok: true, skipped: true });

    await admin.rpc('log_site_404', {
      p_site_id: siteId,
      p_path: path,
      p_referrer: referrer ?? '',
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('log-404 failed:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
