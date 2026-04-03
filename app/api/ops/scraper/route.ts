import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';

const SERVICES_CSV_HEADER = 'name,description,duration_minutes,price,currency,category,is_featured,compare_at_price,status';

const SERVICES_SYSTEM_PROMPT = `You are a data extraction assistant. You will be given the content of a business website. Your task is to extract all services (treatments, appointments, classes, or similar offerings) from the page.

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

Quote any field that contains commas or newlines. Do not include a header row — I will add it. Do not add any explanation before or after the CSV. If no services are found, return exactly: NO_SERVICES_FOUND`;

async function assertOpsAccess(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const adminEmails = (process.env.OPS_ADMIN_EMAILS || '')
      .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    if (adminEmails.includes(user.email?.toLowerCase() ?? '')) {
      return true;
    }

    const db = createAdminClient();
    const { data: profile } = await db
      .from('users')
      .select('is_agent')
      .eq('id', user.id)
      .single();

    return profile?.is_agent ?? false;
  } catch {
    return false;
  }
}

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

/** Fetch a URL with browser-like headers */
async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': BROWSER_UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'identity',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** Extract all iframe src URLs from HTML */
function findIframeSrcs(html: string, baseUrl: string): string[] {
  const srcs: string[] = [];
  const re = /<iframe[^>]+src=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      srcs.push(new URL(m[1], baseUrl).toString());
    } catch { /* skip bad URLs */ }
  }
  return srcs;
}

/** Strip HTML tags, scripts, styles → plain text */
function stripHtml(html: string): string {
  return html
    .replace(/<(script|style|svg|noscript)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function POST(req: NextRequest) {
  if (!await assertOpsAccess()) {
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

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('bad protocol');
  } catch {
    return NextResponse.json({ error: 'Invalid URL.' }, { status: 400 });
  }

  // Step 1: Fetch the main page
  let mainHtml: string;
  try {
    mainHtml = await fetchPage(parsedUrl.toString());
  } catch (e: any) {
    return NextResponse.json({ error: `Could not reach URL: ${e.message}` }, { status: 422 });
  }

  let text = stripHtml(mainHtml);
  console.log('[scraper] main page text length:', text.length);
  console.log('[scraper] main page preview:', text.slice(0, 400));

  // Step 2: Find iframes and fetch their content too
  const iframeSrcs = findIframeSrcs(mainHtml, parsedUrl.toString());
  if (iframeSrcs.length > 0) {
    console.log('[scraper] found iframes:', iframeSrcs);
    for (const src of iframeSrcs) {
      try {
        const iframeHtml = await fetchPage(src);
        const iframeText = stripHtml(iframeHtml);
        console.log('[scraper] iframe text length:', iframeText.length, 'from', src);
        console.log('[scraper] iframe preview:', iframeText.slice(0, 400));
        text += '\n\n' + iframeText;
      } catch (e: any) {
        console.log('[scraper] iframe fetch failed:', src, e.message);
      }
    }
  }

  // Step 3: Also look for embedded JSON data in script tags (SSR apps)
  const scriptJsonMatches = mainHtml.match(/<script[^>]*>(\{[\s\S]{500,}?\})<\/script>/gi) || [];
  for (const match of scriptJsonMatches.slice(0, 3)) {
    const inner = match.replace(/<\/?script[^>]*>/gi, '');
    const lower = inner.toLowerCase();
    if (lower.includes('service') || lower.includes('treatment') || lower.includes('price')) {
      console.log('[scraper] found service-like script data, length:', inner.length);
      text += '\n\n' + inner.slice(0, 20000);
    }
  }

  text = text.slice(0, 60000);

  if (text.length < 50) {
    return NextResponse.json({ error: 'Page returned very little content. It may require JavaScript or block automated access.' }, { status: 422 });
  }

  // Step 4: Call Anthropic
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
    console.log('[scraper] AI response:', csvRows.slice(0, 500));
  } catch (e: any) {
    console.error('Anthropic scraper exception:', e);
    return NextResponse.json({ error: 'AI extraction failed.' }, { status: 500 });
  }

  if (csvRows === 'NO_SERVICES_FOUND') {
    return NextResponse.json({ error: 'No services found on this page. The page may require JavaScript rendering or block automated access.' }, { status: 422 });
  }

  const csv = csvRows ? `${SERVICES_CSV_HEADER}\n${csvRows}` : SERVICES_CSV_HEADER;

  return NextResponse.json({ csv });
}
