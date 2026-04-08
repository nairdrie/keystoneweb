import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';

// ── GET /api/chat-support/settings?siteId=X ─────────────────────────────────
// Public: returns chat support settings for a site (used by the widget)
// Authenticated: returns full settings for the site owner

export async function GET(req: NextRequest) {
  const siteId = req.nextUrl.searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });

  const admin = createAdminClient();

  const { data, error } = await admin
    .from('chat_support_settings')
    .select('agent_name, welcome_message, accent_color, position, enabled, contact_email, allow_general, allow_booking, allow_ecommerce, allow_faq')
    .eq('site_id', siteId)
    .single();

  if (error || !data) {
    // Return defaults if no settings row exists
    return NextResponse.json({
      agent_name: 'Archie',
      welcome_message: 'Hi there! I\'m here to help. Ask me anything about our business.',
      accent_color: null,
      position: 'bottom-right',
      enabled: true,
      contact_email: null,
      allow_general: true,
      allow_booking: false,
      allow_ecommerce: false,
      allow_faq: true,
    });
  }

  return NextResponse.json(data);
}

// ── POST /api/chat-support/settings ─────────────────────────────────────────
// Authenticated: upsert chat support settings for a site the user owns

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { siteId, ...settings } = body;

  if (!siteId) return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });

  // Verify ownership
  const { data: site } = await supabase
    .from('sites')
    .select('id')
    .eq('id', siteId)
    .eq('user_id', user.id)
    .single();

  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  // Whitelist fields
  const allowed: Record<string, any> = {};
  const stringFields = ['agent_name', 'welcome_message', 'contact_email', 'accent_color', 'position'] as const;
  const boolFields = ['enabled', 'allow_general', 'allow_booking', 'allow_ecommerce', 'allow_faq'] as const;

  for (const f of stringFields) {
    if (typeof settings[f] === 'string') allowed[f] = settings[f].slice(0, 500);
  }
  for (const f of boolFields) {
    if (typeof settings[f] === 'boolean') allowed[f] = settings[f];
  }

  if (allowed.position && !['bottom-right', 'bottom-left'].includes(allowed.position)) {
    delete allowed.position;
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from('chat_support_settings')
    .upsert(
      { site_id: siteId, ...allowed, updated_at: new Date().toISOString() },
      { onConflict: 'site_id' },
    );

  if (error) {
    console.error('Failed to save chat support settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
