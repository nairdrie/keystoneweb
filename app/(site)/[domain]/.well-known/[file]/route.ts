import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { deriveIndexNowKey } from '@/lib/seo/indexnow';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ domain: string; file: string }> }) {
  const { domain, file } = await params;
  const match = file.match(/^indexnow-([a-f0-9]{32})\.txt$/);
  if (!match) return new NextResponse('Not found', { status: 404 });

  const cleanDomain = domain.replace(/^www\./, '');
  const supabase = createAdminClient();
  const { data: site } = await supabase
    .from('sites')
    .select('id')
    .eq('custom_domain', cleanDomain)
    .eq('is_published', true)
    .single();
  if (!site) return new NextResponse('Not found', { status: 404 });

  const expected = deriveIndexNowKey(site.id);
  if (expected !== match[1]) return new NextResponse('Not found', { status: 404 });

  return new NextResponse(expected, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' },
  });
}
