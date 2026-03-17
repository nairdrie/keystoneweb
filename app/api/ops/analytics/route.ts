import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { createClient } from '@/lib/db/supabase-server';

async function assertAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const adminEmails = (process.env.OPS_ADMIN_EMAILS || '')
      .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    return adminEmails.includes(user.email?.toLowerCase() ?? '');
  } catch {
    return false;
  }
}

/**
 * GET /api/ops/analytics?days=30&events=user_signup,site_create,site_publish
 *
 * Returns daily event counts for the requested event types over the last N days.
 * Response: { dates: string[], series: { [eventType]: number[] } }
 */
export async function GET(request: NextRequest) {
  if (!await assertAdmin()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const days = Math.min(Math.max(parseInt(params.get('days') ?? '30', 10), 7), 90);
  const requestedEvents = (params.get('events') ?? 'user_signup,site_create,site_publish')
    .split(',').map((e) => e.trim()).filter(Boolean);

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const db = createAdminClient();
  const { data: rows } = await db
    .from('analytics_events')
    .select('event_type, created_at')
    .in('event_type', requestedEvents)
    .gte('created_at', since)
    .order('created_at', { ascending: true });

  // Build date buckets
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    dates.push(d.toISOString().slice(0, 10)); // YYYY-MM-DD
  }

  const series: Record<string, number[]> = {};
  for (const et of requestedEvents) {
    series[et] = new Array(dates.length).fill(0);
  }

  for (const row of rows ?? []) {
    const dateKey = (row.created_at as string).slice(0, 10);
    const idx = dates.indexOf(dateKey);
    if (idx !== -1 && series[row.event_type]) {
      series[row.event_type][idx]++;
    }
  }

  return NextResponse.json({ dates, series });
}
