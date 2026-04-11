import { NextRequest, NextResponse } from 'next/server';
import { requireOpsAccess } from '@/lib/ops/access';
import { runOpsScraper } from '@/lib/ops/scraper';
import { isSupportedContentNormalizationModel } from '@/lib/ops/scraper/models';
import type { ContentNormalizationModel, ScraperMode, ScraperPreset } from '@/lib/ops/scraper/types';

const SUPPORTED_PRESETS: ScraperPreset[] = ['products', 'services', 'content', 'other'];

export async function POST(req: NextRequest) {
  const access = await requireOpsAccess();
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { url?: unknown; type?: unknown; mode?: unknown; includeBlog?: unknown; llmModel?: unknown; aiOnly?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const url = typeof body.url === 'string' ? body.url.trim() : '';
  const preset = typeof body.type === 'string' ? (body.type as ScraperPreset) : 'products';
  const mode = typeof body.mode === 'string' ? (body.mode as ScraperMode) : undefined;
  const includeBlog = typeof body.includeBlog === 'boolean' ? body.includeBlog : undefined;
  const aiOnly = typeof body.aiOnly === 'boolean' ? body.aiOnly : undefined;
  const llmModel = typeof body.llmModel === 'string' && (body.llmModel === 'auto' || isSupportedContentNormalizationModel(body.llmModel))
    ? (body.llmModel as ContentNormalizationModel)
    : undefined;

  if (!url) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }

  if (!SUPPORTED_PRESETS.includes(preset)) {
    return NextResponse.json({ error: 'Unsupported scraper preset.' }, { status: 400 });
  }

  try {
    const result = await runOpsScraper(url, preset, { mode, includeBlog, llmModel, aiOnly });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Scraper failed.';
    const status = /invalid url/i.test(message) || /unsupported|coming soon/i.test(message) ? 400 : 422;
    return NextResponse.json({ error: message }, { status });
  }
}
