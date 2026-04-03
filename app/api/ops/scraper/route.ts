import { NextRequest, NextResponse } from 'next/server';
import { requireOpsAccess } from '@/lib/ops/access';
import { runOpsScraper } from '@/lib/ops/scraper';
import type { ScraperPreset } from '@/lib/ops/scraper/types';

const SUPPORTED_PRESETS: ScraperPreset[] = ['products', 'services', 'content', 'other'];

export async function POST(req: NextRequest) {
  const access = await requireOpsAccess();
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { url?: unknown; type?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const url = typeof body.url === 'string' ? body.url.trim() : '';
  const preset = typeof body.type === 'string' ? (body.type as ScraperPreset) : 'products';

  if (!url) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }

  if (!SUPPORTED_PRESETS.includes(preset)) {
    return NextResponse.json({ error: 'Unsupported scraper preset.' }, { status: 400 });
  }

  try {
    const result = await runOpsScraper(url, preset);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Scraper failed.';
    const status = /invalid url/i.test(message) || /unsupported|coming soon/i.test(message) ? 400 : 422;
    return NextResponse.json({ error: message }, { status });
  }
}
