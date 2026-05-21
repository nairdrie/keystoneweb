/**
 * AI-powered product attribute enrichment.
 *
 * Goal: a site owner uploads a product with just a name, description, and
 * a few images, and we automatically populate the conversational attribute
 * fields Gemini's compatibility/fit reasoning relies on (material, fit,
 * socket/interface, weight class, occasion, etc.) — plus light SEO fields
 * (gtin, mpn) when the model can infer them from the description.
 *
 * Idempotent: keyed by sha256 of the source fields so the same product
 * doesn't get re-enriched on every save.
 */

import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { callAi, extractJSON, getProviderConfig } from '@/lib/ai/ai-client';

const SYSTEM_PROMPT = `You are a structured-data extractor for an ecommerce platform's AI commerce layer.

You will be given a product's title, description, brand, category, and optional image URLs. Output a flat JSON object of *conversational product attributes* that an AI shopping assistant (e.g. Google Gemini in Universal Cart, OpenAI Operator) would need to:

  1. Answer compatibility / fit questions ("will this fit my AM5 socket?", "does this work for narrow feet?")
  2. Compare against alternatives ("which one is more waterproof?")
  3. Auto-apply filters ("show me weatherproof jackets under $200")

Rules:
  - Use snake_case keys. Values must be string, number, or boolean. No nested objects, no arrays.
  - Only include attributes the source materially supports. Do NOT invent specs.
  - Prefer canonical units (e.g. "weight_g": 540, "screen_in": 13.3, "battery_wh": 56).
  - For apparel: include "material", "fit", "care", "occasion", "season".
  - For tech: include "socket", "interface", "form_factor", "compatibility".
  - For home/outdoor: include "material", "use_case", "weather_rating", "indoor_outdoor".
  - For food/beverage: include "diet" ("vegan"|"vegetarian"|"halal"|"kosher"|null), "allergens" (comma string), "shelf_life_days" if known.
  - If you spot a likely GTIN/UPC/EAN in the description, return it as "gtin". Otherwise omit.
  - Always include "audience" (e.g. "men", "women", "kids", "any") and "tone" (a one-word brand tone).
  - Return ONLY the JSON object. No prose, no markdown fences.`;

export interface EnrichInput {
  name: string;
  description: string | null;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  images: string[];
}

export interface EnrichResult {
  attributes: Record<string, string | number | boolean>;
  inputHash: string;
  source: 'ai' | 'cache';
}

export function hashEnrichInput(input: EnrichInput): string {
  const canonical = JSON.stringify({
    n: input.name.trim(),
    d: (input.description || '').trim(),
    b: input.brand || '',
    c: input.category || '',
    s: input.subcategory || '',
    i: input.images.slice(0, 5),
  });
  return createHash('sha256').update(canonical).digest('hex');
}

export async function enrichProductAttributes(input: EnrichInput): Promise<EnrichResult> {
  const inputHash = hashEnrichInput(input);
  const { apiKey, provider, model } = getProviderConfig();
  if (!apiKey) {
    // Without an AI provider configured, return an empty-but-keyed result
    // so the pipeline still records a skipped enrichment row.
    return { attributes: {}, inputHash, source: 'cache' };
  }

  const userPayload = JSON.stringify({
    name: input.name,
    description: input.description,
    brand: input.brand,
    category: input.category,
    subcategory: input.subcategory,
    images: input.images.slice(0, 5),
  });

  const raw = await callAi({ apiKey, model, system: SYSTEM_PROMPT, user: userPayload, maxTokens: 2048 }, provider);
  const parsed = extractJSON<Record<string, unknown>>(raw);

  const attributes: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(parsed || {})) {
    if (typeof k !== 'string' || !k) continue;
    if (k.length > 64) continue;
    if (typeof v === 'string') {
      const s = v.trim();
      if (s.length > 0 && s.length <= 256) attributes[k] = s;
    } else if (typeof v === 'number' && Number.isFinite(v)) {
      attributes[k] = v;
    } else if (typeof v === 'boolean') {
      attributes[k] = v;
    }
  }

  return { attributes, inputHash, source: 'ai' };
}

/**
 * Apply enrichment to a product row, writing into `ai_attributes` and
 * `ai_enriched_at` and de-duping via the job table's unique (product_id,
 * input_hash) constraint.
 */
export async function enrichProductById(productId: string): Promise<{ status: 'done' | 'skipped' | 'error'; hash: string }> {
  const admin = createAdminClient();
  const { data: product } = await admin
    .from('products')
    .select('id, site_id, name, description, brand, category, subcategory, images, ai_enrichment_hash, gtin, mpn')
    .eq('id', productId)
    .maybeSingle();
  if (!product) return { status: 'error', hash: '' };

  const input: EnrichInput = {
    name: product.name,
    description: product.description,
    brand: product.brand,
    category: product.category,
    subcategory: product.subcategory,
    images: Array.isArray(product.images) ? (product.images as string[]).slice(0, 5) : [],
  };
  const inputHash = hashEnrichInput(input);
  if (product.ai_enrichment_hash === inputHash) return { status: 'skipped', hash: inputHash };

  // Reserve a job row so concurrent saves don't fire duplicate AI calls.
  const { error: insertErr } = await admin
    .from('product_ai_enrichment_jobs')
    .insert({ site_id: product.site_id, product_id: product.id, input_hash: inputHash, status: 'running' });
  if (insertErr && !String(insertErr.message).includes('duplicate')) {
    return { status: 'error', hash: inputHash };
  }

  try {
    const result = await enrichProductAttributes(input);
    const gtinFromAttrs = typeof result.attributes.gtin === 'string' && /^\d{8,14}$/.test(result.attributes.gtin)
      ? result.attributes.gtin
      : null;
    delete result.attributes.gtin;

    await admin.from('products').update({
      ai_attributes: result.attributes,
      ai_enriched_at: new Date().toISOString(),
      ai_enrichment_hash: inputHash,
      ...(gtinFromAttrs && !product.gtin ? { gtin: gtinFromAttrs } : {}),
    }).eq('id', product.id);

    await admin.from('product_ai_enrichment_jobs')
      .update({ status: 'done', result: result.attributes, updated_at: new Date().toISOString() })
      .eq('product_id', product.id)
      .eq('input_hash', inputHash);

    return { status: 'done', hash: inputHash };
  } catch (err) {
    await admin.from('product_ai_enrichment_jobs')
      .update({ status: 'error', error: (err as Error).message, updated_at: new Date().toISOString() })
      .eq('product_id', product.id)
      .eq('input_hash', inputHash);
    return { status: 'error', hash: inputHash };
  }
}
