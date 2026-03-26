import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

const SERVICES_CSV_HEADER = 'name,description,duration_minutes,price,currency,category,is_featured,compare_at_price,status';

const SERVICES_SYSTEM_PROMPT = `You are a data extraction assistant. You will be given the HTML of a business website. Your task is to extract all services (treatments, appointments, classes, or similar offerings) from the page.

Return ONLY a CSV with these exact columns in this exact order:
name,description,duration_minutes,price,currency,category,is_featured,compare_at_price,status

Rules:
- name: required, the service name
- description: optional, a short description of the service (max 200 chars, escape commas with quotes)
- duration_minutes: integer, duration in minutes (default 30 if unknown)
- price: decimal dollar amount (e.g. 75.00), 0 if free or unknown
- currency: CAD or USD (default CAD)
- category: optional category/group name this service belongs to
- is_featured: true or false (default false)
- compare_at_price: optional original/crossed-out price in dollars, blank if none
- status: always "draft"

Quote any field that contains commas or newlines. Do not include a header row — I will add it. Do not add any explanation before or after the CSV. If no services are found, return a single empty line.`;

async function assertAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const adminEmails = (process.env.OPS_ADMIN_EMAILS || '')
      .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    return adminEmails.includes(user.email?.toLowerCase() ?? '');
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!await assertAdmin()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { url, type } = body;

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }
  if (type !== 'services') {
    return NextResponse.json({ error: 'Only "services" type is supported currently.' }, { status: 400 });
  }

  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('bad protocol');
  } catch {
    return NextResponse.json({ error: 'Invalid URL.' }, { status: 400 });
  }

  // Fetch the page HTML
  let html: string;
  try {
    const pageRes = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; KeystoneScraper/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!pageRes.ok) {
      return NextResponse.json({ error: `Failed to fetch page: HTTP ${pageRes.status}` }, { status: 422 });
    }
    html = await pageRes.text();
  } catch (e: any) {
    return NextResponse.json({ error: `Could not reach URL: ${e.message}` }, { status: 422 });
  }

  // Strip HTML down to readable text to reduce tokens
  const text = stripHtml(html).slice(0, 60000);

  // Call Anthropic
  const apiKey = process.env.AI_BUILDER_API_KEY;
  const model = process.env.AI_BUILDER_MODEL || 'claude-sonnet-4-6';
  if (!apiKey) {
    return NextResponse.json({ error: 'AI not configured.' }, { status: 500 });
  }

  let csvRows: string;
  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: SERVICES_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Extract services from this page:\n\n${text}` }],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error('Anthropic scraper error:', errText);
      return NextResponse.json({ error: 'AI extraction failed.' }, { status: 500 });
    }

    const aiData = await aiRes.json();
    csvRows = (aiData.content?.[0]?.text || '').trim();
  } catch (e: any) {
    console.error('Anthropic scraper exception:', e);
    return NextResponse.json({ error: 'AI extraction failed.' }, { status: 500 });
  }

  // Prepend header
  const csv = csvRows ? `${SERVICES_CSV_HEADER}\n${csvRows}` : SERVICES_CSV_HEADER;

  return NextResponse.json({ csv });
}

/** Strip HTML tags and collapse whitespace to reduce token count */
function stripHtml(html: string): string {
  return html
    // Remove scripts, styles, svgs, head
    .replace(/<(script|style|svg|head)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    // Remove all remaining tags
    .replace(/<[^>]+>/g, ' ')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}
