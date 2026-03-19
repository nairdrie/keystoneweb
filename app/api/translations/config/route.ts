import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

export interface TranslationsConfig {
  enabled: boolean;
  defaultLanguage: string;
  languages: {
    code: string;
    name: string;
    autoTranslate: boolean;
  }[];
}

const EMPTY_CONFIG: TranslationsConfig = {
  enabled: false,
  defaultLanguage: 'en',
  languages: [],
};

/**
 * GET /api/translations/config?siteId=xxx
 * Fetch the translations configuration for a site
 */
export async function GET(request: NextRequest) {
  const siteId = request.nextUrl.searchParams.get('siteId');
  if (!siteId) {
    return NextResponse.json({ error: 'siteId is required' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: site, error } = await supabase
    .from('sites')
    .select('translations_config, user_id')
    .eq('id', siteId)
    .single();

  if (error || !site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  if (site.user_id && site.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    translationsConfig: site.translations_config || EMPTY_CONFIG,
  });
}

/**
 * PATCH /api/translations/config
 * Update translations configuration for a site
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { siteId, translationsConfig } = body;

  if (!siteId) {
    return NextResponse.json({ error: 'siteId is required' }, { status: 400 });
  }

  // Verify ownership
  const { data: site, error: fetchError } = await supabase
    .from('sites')
    .select('user_id')
    .eq('id', siteId)
    .single();

  if (fetchError || !site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  if (site.user_id && site.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error: updateError } = await supabase
    .from('sites')
    .update({
      translations_config: translationsConfig,
      updated_at: new Date().toISOString(),
    })
    .eq('id', siteId);

  if (updateError) {
    console.error('Error updating translations config:', updateError);
    return NextResponse.json({ error: 'Failed to save translations config' }, { status: 500 });
  }

  return NextResponse.json({ message: 'Translations config saved', translationsConfig });
}
