// Calls Claude Sonnet 4.6 with vision to pull lead-relevant fields out of a
// photo (business card, billboard, flyer, sign, storefront, etc.). Mirrors
// the direct-fetch Anthropic pattern used in lib/contact/triage.ts and
// app/api/ai/builder/route.ts (no SDK; AI_BUILDER_API_KEY).

import { isLeadSource, type LeadSource } from '@/lib/ops/leads';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.LEADS_VISION_MODEL || 'claude-sonnet-4-6';

const SUPPORTED_MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export interface ExtractedLeadFields {
  business_name: string | null;
  contact_name: string | null;
  person_role: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  business_type: string | null;
  notes: string | null;
  // Suggested source if Claude can infer it (e.g. business card vs billboard).
  suggested_source: LeadSource | null;
}

const EMPTY: ExtractedLeadFields = {
  business_name: null,
  contact_name: null,
  person_role: null,
  phone: null,
  email: null,
  website: null,
  address: null,
  city: null,
  business_type: null,
  notes: null,
  suggested_source: null,
};

export class ImageExtractError extends Error {
  constructor(
    message: string,
    public status: number = 500,
  ) {
    super(message);
    this.name = 'ImageExtractError';
  }
}

const SYSTEM_PROMPT = `You extract sales-lead information from photos of physical advertising materials: business cards, flyers, billboards, signs, storefronts, vehicle wraps, brochures, etc.

Look at the image and pull out anything you can identify. Be conservative — only fill a field if you can read it clearly and are confident. Use null when unsure rather than guessing.

Return ONLY a JSON object with these keys (no markdown fences, no commentary):
{
  "business_name": string | null,
  "contact_name": string | null,
  "person_role": string | null,           // e.g. "Owner", "Manager", "Realtor"
  "phone": string | null,                  // primary phone, formatted as shown
  "email": string | null,
  "website": string | null,                // include scheme if visible (https://...)
  "address": string | null,                // street address
  "city": string | null,
  "business_type": string | null,          // e.g. "plumber", "real estate agent"
  "notes": string | null,                  // anything else useful for outreach
  "suggested_source": "physical_ad" | null  // always "physical_ad" if there's a real ad in the image
}`;

export async function extractLeadFromImage(
  imageBuffer: Buffer,
  mediaType: string,
): Promise<ExtractedLeadFields> {
  const apiKey = process.env.AI_BUILDER_API_KEY;
  if (!apiKey) {
    throw new ImageExtractError('AI_BUILDER_API_KEY not configured', 503);
  }
  if (!SUPPORTED_MEDIA_TYPES.has(mediaType)) {
    throw new ImageExtractError(`Unsupported media type: ${mediaType}`, 400);
  }
  if (imageBuffer.length === 0) {
    throw new ImageExtractError('Empty image', 400);
  }
  // Anthropic vision caps at 5 MB per image when sent as base64.
  if (imageBuffer.length > 5 * 1024 * 1024) {
    throw new ImageExtractError('Image too large (5 MB max for AI extraction)', 413);
  }

  const base64 = imageBuffer.toString('base64');

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            {
              type: 'text',
              text: 'Extract lead info from this image and return the JSON object as instructed.',
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[leads/image-extract] Anthropic ${res.status}:`, body.slice(0, 500));
    throw new ImageExtractError(`Vision API error ${res.status}`, 502);
  }

  const data = await res.json();
  const raw: string = data.content?.[0]?.text?.trim() ?? '';
  const json = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(json);
  } catch {
    console.error('[leads/image-extract] Non-JSON response:', raw.slice(0, 500));
    return EMPTY;
  }

  return {
    business_name: pickString(parsed.business_name),
    contact_name: pickString(parsed.contact_name),
    person_role: pickString(parsed.person_role),
    phone: pickString(parsed.phone),
    email: pickString(parsed.email),
    website: pickString(parsed.website),
    address: pickString(parsed.address),
    city: pickString(parsed.city),
    business_type: pickString(parsed.business_type),
    notes: pickString(parsed.notes),
    suggested_source: isLeadSource(parsed.suggested_source) ? parsed.suggested_source : null,
  };
}

function pickString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}
