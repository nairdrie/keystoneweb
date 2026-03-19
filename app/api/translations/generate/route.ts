import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

/**
 * POST /api/translations/generate
 * Auto-translate site content into a target language using LLM.
 * Translates both site-level design_data and all page design_data.
 *
 * Body: { siteId: string, targetLanguage: string, targetLanguageName: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteId, targetLanguage, targetLanguageName } = body;

    if (!siteId || !targetLanguage || !targetLanguageName) {
      return NextResponse.json(
        { error: 'Missing required fields: siteId, targetLanguage, targetLanguageName' },
        { status: 400 }
      );
    }

    // Verify ownership and get site content
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('user_id, design_data, translations')
      .eq('id', siteId)
      .single();

    if (siteError || !site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    if (site.user_id && site.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get all pages
    const { data: pages } = await supabase
      .from('pages')
      .select('id, slug, title, display_name, design_data')
      .eq('site_id', siteId)
      .order('nav_order', { ascending: true });

    const apiKey = process.env.AI_BUILDER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI translation is not configured.' },
        { status: 500 }
      );
    }

    // Extract translatable text from design_data
    const siteDesignData = site.design_data || {};
    const translatableContent = extractTranslatableContent(siteDesignData);

    // Build page content for translation
    const pageContents: { pageId: string; slug: string; content: Record<string, string> }[] = [];
    if (pages) {
      for (const page of pages) {
        const pageDesignData = page.design_data || {};
        const pageContent = extractTranslatableContent(pageDesignData);
        if (Object.keys(pageContent).length > 0) {
          pageContents.push({ pageId: page.id, slug: page.slug, content: pageContent });
        }
      }
    }

    // Call LLM to translate everything in one batch
    const allContent = {
      site: translatableContent,
      pages: pageContents.reduce((acc, p) => {
        acc[p.slug] = p.content;
        return acc;
      }, {} as Record<string, Record<string, string>>),
    };

    const translatedContent = await translateWithLLM(
      apiKey,
      allContent,
      targetLanguage,
      targetLanguageName,
    );

    if (!translatedContent) {
      return NextResponse.json(
        { error: 'Translation failed. Please try again.' },
        { status: 500 }
      );
    }

    // Save site-level translations
    const siteTranslations = site.translations || {};
    const translatedSiteData = applyTranslations(
      siteDesignData,
      translatedContent.site || {},
    );
    siteTranslations[targetLanguage] = translatedSiteData;

    await supabase
      .from('sites')
      .update({
        translations: siteTranslations,
        updated_at: new Date().toISOString(),
      })
      .eq('id', siteId);

    // Save page-level translations
    if (pages) {
      for (const page of pages) {
        const pageSlugTranslations = translatedContent.pages?.[page.slug];
        if (pageSlugTranslations) {
          const existingTranslations = (page as any).translations || {};
          const translatedPageData = applyTranslations(
            page.design_data || {},
            pageSlugTranslations,
          );
          existingTranslations[targetLanguage] = translatedPageData;

          await supabase
            .from('pages')
            .update({ translations: existingTranslations })
            .eq('id', page.id);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Content translated to ${targetLanguageName}`,
      language: targetLanguage,
    });
  } catch (error) {
    console.error('Error generating translations:', error);
    return NextResponse.json(
      { error: 'Failed to generate translations' },
      { status: 500 }
    );
  }
}

/**
 * Extract all translatable string fields from design_data.
 * Walks through blocks and top-level text fields.
 */
function extractTranslatableContent(designData: Record<string, any>): Record<string, string> {
  const result: Record<string, string> = {};

  // Top-level text fields
  const textFields = ['siteTitle', 'title', 'tagline', 'description', 'subtitle'];
  for (const field of textFields) {
    if (designData[field] && typeof designData[field] === 'string') {
      result[field] = designData[field];
    }
  }

  // Walk through blocks
  const blocks = designData.__blocks || [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (!block?.data) continue;
    extractBlockStrings(block.data, `blocks[${i}]`, result);
  }

  return result;
}

/**
 * Recursively extract string values from block data.
 */
function extractBlockStrings(
  obj: any,
  prefix: string,
  result: Record<string, string>,
) {
  if (typeof obj === 'string' && obj.trim().length > 0) {
    result[prefix] = obj;
    return;
  }
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      extractBlockStrings(obj[i], `${prefix}[${i}]`, result);
    }
    return;
  }
  if (obj && typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      // Skip non-text fields
      if (['id', 'type', 'src', 'url', 'href', 'icon', 'image', 'imageUrl', 'imageSrc', 'color', 'backgroundColor'].includes(key)) continue;
      extractBlockStrings(obj[key], `${prefix}.${key}`, result);
    }
  }
}

/**
 * Apply translated strings back into a copy of design_data.
 */
function applyTranslations(
  originalData: Record<string, any>,
  translations: Record<string, string>,
): Record<string, any> {
  // Deep clone the original data
  const result = JSON.parse(JSON.stringify(originalData));

  for (const [path, value] of Object.entries(translations)) {
    setNestedValue(result, path, value);
  }

  return result;
}

/**
 * Set a value at a dot/bracket-notation path like "blocks[0].data.title"
 */
function setNestedValue(obj: any, path: string, value: any) {
  // Parse path segments: "blocks[0].data.title" → ["blocks", "0", "data", "title"]
  const segments = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);

  // For block paths, map back to __blocks
  if (segments[0] === 'blocks') {
    segments[0] = '__blocks';
    // The block index is segments[1], then we need to go into .data
  }

  let current = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    const key = /^\d+$/.test(seg) ? parseInt(seg, 10) : seg;
    if (current[key] === undefined) return; // Path doesn't exist
    current = current[key];
  }

  const lastSeg = segments[segments.length - 1];
  const lastKey = /^\d+$/.test(lastSeg) ? parseInt(lastSeg, 10) : lastSeg;
  current[lastKey] = value;
}

/**
 * Call the LLM to translate content.
 */
async function translateWithLLM(
  apiKey: string,
  content: { site: Record<string, string>; pages: Record<string, Record<string, string>> },
  targetLanguageCode: string,
  targetLanguageName: string,
): Promise<{ site: Record<string, string>; pages: Record<string, Record<string, string>> } | null> {
  const provider = process.env.AI_BUILDER_PROVIDER || 'anthropic';
  const model = process.env.AI_BUILDER_MODEL || (provider === 'anthropic' ? 'claude-sonnet-4-5-20250514' : 'gpt-4o-mini');

  const systemPrompt = `You are a professional website translator. You translate website content accurately and naturally into ${targetLanguageName} (${targetLanguageCode}).

Rules:
- Preserve the exact same JSON structure in your response
- Only translate the string VALUES, never change the keys
- Keep brand names, proper nouns, and technical terms as-is unless they have well-known translations
- Maintain the same tone and style as the original
- Keep HTML tags intact if present
- Return ONLY valid JSON, no explanation or markdown`;

  const userMessage = `Translate the following website content to ${targetLanguageName}. Return the same JSON structure with translated values.

${JSON.stringify(content, null, 2)}`;

  try {
    let responseText: string;

    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 8192,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error(`Anthropic translation API error ${res.status}:`, errBody);
        return null;
      }

      const data = await res.json();
      responseText = data.content?.[0]?.text || '';
    } else {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          max_tokens: 8192,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error(`OpenAI translation API error ${res.status}:`, errBody);
        return null;
      }

      const data = await res.json();
      responseText = data.choices?.[0]?.message?.content || '';
    }

    // Parse JSON from the response (strip markdown code fences if present)
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : responseText.trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('LLM translation error:', error);
    return null;
  }
}
