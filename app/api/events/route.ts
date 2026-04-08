import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { scanText } from '@/lib/moderation/text-scan';
import { handleModerationResult } from '@/lib/moderation/report';

// ─── Helper ─────────────────────────────────────────────────────────────────

async function getAuthAndSite(supabase: Awaited<ReturnType<typeof createClient>>, siteId: string) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized', status: 401 };

  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('id, user_id')
    .eq('id', siteId)
    .single();

  if (siteError || !site) return { error: 'Site not found', status: 404 };
  if (site.user_id !== user.id) return { error: 'Forbidden', status: 403 };

  return { user, site };
}

// ─── GET /api/events?siteId=&includePast=true&sortOrder=asc|desc ────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const siteId = searchParams.get('siteId');
  const includePast = searchParams.get('includePast') === 'true';
  // 'asc' = closest/soonest first; 'desc' = newest/latest first (default)
  const ascending = searchParams.get('sortOrder') === 'asc';

  if (!siteId) return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });

  const supabase = await createClient();

  let query = supabase
    .from('events')
    .select('*')
    .eq('site_id', siteId)
    .order('event_date', { ascending });

  if (!includePast) {
    // today's date in YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];
    query = query.gte('event_date', today);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ events: data || [] });
}

// ─── POST /api/events ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { siteId, title, description, event_date, date_display, image_url, event_url } = body;

  if (!siteId || !title || !event_date || !date_display) {
    return NextResponse.json({ error: 'Missing required fields: siteId, title, event_date, date_display' }, { status: 400 });
  }

  const auth = await getAuthAndSite(supabase, siteId);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Scan event text for illegal content before storing
  const textToScan = [title, description].filter(Boolean).join('\n\n');
  const textScanResult = await scanText(textToScan);
  if (textScanResult.flagged) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')
      ?? null;
    await handleModerationResult(
      { ...textScanResult, severity: 'review' as const },
      {
        siteId:      siteId,
        userId:      auth.user.id,
        ipAddress:   ip,
        contentType: 'text',
        contentRef:  null,
        contentHash: null,
      }
    );
    return NextResponse.json({ error: 'Content policy violation' }, { status: 422 });
  }

  const { data, error } = await supabase
    .from('events')
    .insert({
      site_id: siteId,
      title,
      description: description || null,
      event_date,
      date_display,
      image_url: image_url || null,
      event_url: event_url || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ event: data }, { status: 201 });
}

// ─── PATCH /api/events ───────────────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { id, siteId, ...fields } = body;

  if (!id || !siteId) return NextResponse.json({ error: 'Missing id or siteId' }, { status: 400 });

  const auth = await getAuthAndSite(supabase, siteId);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const allowed = ['title', 'description', 'event_date', 'date_display', 'image_url', 'event_url', 'sort_order'];
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in fields) updates[key] = fields[key];
  }

  const { data, error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', id)
    .eq('site_id', siteId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ event: data });
}

// ─── DELETE /api/events?id=&siteId= ─────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const id = searchParams.get('id');
  const siteId = searchParams.get('siteId');

  if (!id || !siteId) return NextResponse.json({ error: 'Missing id or siteId' }, { status: 400 });

  const supabase = await createClient();
  const auth = await getAuthAndSite(supabase, siteId);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', id)
    .eq('site_id', siteId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
