import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';

/**
 * GET /api/sites/analytics?siteId=xxx&days=30
 * Returns analytics summary for the site owner.
 * Requires authentication + site ownership.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const siteId = req.nextUrl.searchParams.get('siteId');
    const days = Math.min(
      parseInt(req.nextUrl.searchParams.get('days') || '30', 10),
      90
    );

    if (!siteId) {
      return NextResponse.json(
        { error: 'siteId required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: site } = await supabase
      .from('sites')
      .select('id, user_id')
      .eq('id', siteId)
      .single();

    if (!site || site.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const admin = createAdminClient();
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Fetch raw visits for the period
    const { data: visits } = await admin
      .from('site_visits')
      .select('visitor_hash, page_path, referrer_source, device_type, browser, os, duration_ms, session_id, created_at')
      .eq('site_id', siteId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(10000);

    const rows = visits || [];

    // ── Compute metrics ─────────────────────────────────────────────
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);

    // Daily unique visitors (today)
    const todayVisitors = new Set(
      rows
        .filter((r) => new Date(r.created_at) >= todayStart)
        .map((r) => r.visitor_hash)
    ).size;

    // This week unique visitors
    const weekVisitors = new Set(
      rows
        .filter((r) => new Date(r.created_at) >= weekStart)
        .map((r) => r.visitor_hash)
    ).size;

    // Previous week unique visitors (for trend)
    const prevWeekVisitors = new Set(
      rows
        .filter(
          (r) =>
            new Date(r.created_at) >= prevWeekStart &&
            new Date(r.created_at) < weekStart
        )
        .map((r) => r.visitor_hash)
    ).size;

    // Trend: up, down, or flat
    const trend =
      weekVisitors > prevWeekVisitors
        ? 'up'
        : weekVisitors < prevWeekVisitors
          ? 'down'
          : 'flat';

    // Total views in period
    const totalViews = rows.length;
    const totalUniqueVisitors = new Set(rows.map((r) => r.visitor_hash)).size;

    // ── Top pages ───────────────────────────────────────────────────
    const pageCounts: Record<string, number> = {};
    for (const r of rows) {
      pageCounts[r.page_path] = (pageCounts[r.page_path] || 0) + 1;
    }
    const topPages = Object.entries(pageCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, views]) => ({ path, views }));

    // ── Traffic sources ─────────────────────────────────────────────
    const sourceCounts: Record<string, number> = {};
    for (const r of rows) {
      const src = r.referrer_source || 'direct';
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    }
    const trafficSources = Object.entries(sourceCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([source, count]) => ({ source, count }));

    // ── Device breakdown ────────────────────────────────────────────
    const deviceCounts: Record<string, number> = {};
    for (const r of rows) {
      const d = r.device_type || 'desktop';
      deviceCounts[d] = (deviceCounts[d] || 0) + 1;
    }

    // ── Browser breakdown ───────────────────────────────────────────
    const browserCounts: Record<string, number> = {};
    for (const r of rows) {
      const b = r.browser || 'Other';
      browserCounts[b] = (browserCounts[b] || 0) + 1;
    }

    // ── OS breakdown ────────────────────────────────────────────────
    const osCounts: Record<string, number> = {};
    for (const r of rows) {
      const o = r.os || 'Other';
      osCounts[o] = (osCounts[o] || 0) + 1;
    }

    // ── Bounce rate ─────────────────────────────────────────────────
    const sessionPages: Record<string, number> = {};
    for (const r of rows) {
      if (r.session_id) {
        sessionPages[r.session_id] = (sessionPages[r.session_id] || 0) + 1;
      }
    }
    const sessionIds = Object.keys(sessionPages);
    const bounceCount = sessionIds.filter((s) => sessionPages[s] === 1).length;
    const bounceRate =
      sessionIds.length > 0
        ? Math.round((bounceCount / sessionIds.length) * 100)
        : 0;

    // ── Avg time on page ────────────────────────────────────────────
    const durationsValid = rows
      .map((r) => r.duration_ms)
      .filter((d): d is number => typeof d === 'number' && d > 0);
    const avgDuration =
      durationsValid.length > 0
        ? Math.round(
            durationsValid.reduce((a, b) => a + b, 0) / durationsValid.length
          )
        : 0;

    // ── Daily chart data ────────────────────────────────────────────
    const dailyMap: Record<string, { visitors: Set<string>; views: number }> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(todayStart);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      dailyMap[key] = { visitors: new Set(), views: 0 };
    }
    for (const r of rows) {
      const key = new Date(r.created_at).toISOString().split('T')[0];
      if (dailyMap[key]) {
        dailyMap[key].visitors.add(r.visitor_hash);
        dailyMap[key].views += 1;
      }
    }
    const dailyChart = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        visitors: data.visitors.size,
        views: data.views,
      }));

    // ── Exit pages ──────────────────────────────────────────────────
    // Last page per session
    const sessionLastPage: Record<string, { page: string; time: string }> = {};
    for (const r of rows) {
      if (!r.session_id) continue;
      if (
        !sessionLastPage[r.session_id] ||
        r.created_at > sessionLastPage[r.session_id].time
      ) {
        sessionLastPage[r.session_id] = {
          page: r.page_path,
          time: r.created_at,
        };
      }
    }
    const exitPageCounts: Record<string, number> = {};
    for (const s of Object.values(sessionLastPage)) {
      exitPageCounts[s.page] = (exitPageCounts[s.page] || 0) + 1;
    }
    const exitPages = Object.entries(exitPageCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, exits]) => ({
        path,
        exits,
        rate: sessionIds.length > 0 ? Math.round((exits / sessionIds.length) * 100) : 0,
      }));

    return NextResponse.json({
      todayVisitors,
      weekVisitors,
      prevWeekVisitors,
      trend,
      totalViews,
      totalUniqueVisitors,
      topPages,
      trafficSources,
      devices: deviceCounts,
      browsers: browserCounts,
      operatingSystems: osCounts,
      bounceRate,
      avgDuration,
      dailyChart,
      exitPages,
      days,
    });
  } catch (err) {
    console.error('[analytics] Error:', err);
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    );
  }
}
