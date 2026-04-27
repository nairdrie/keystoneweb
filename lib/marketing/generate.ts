/**
 * Marketing Campaign AI Generation
 *
 * Uses Claude to generate marketing campaign content based on business context.
 * Reusable: called from ops (Phase A) and admin dashboard (Phase B).
 */

import type {
  MarketingChannel,
  CampaignType,
  CampaignGenerationContext,
  CampaignGenerationResult,
  GoogleSearchContent,
  GoogleDisplayContent,
  MetaAdContent,
  EmailContent,
  CampaignTargeting,
} from './types';

// ── System Prompts ───────────────────────────────────────────────────────────

const BASE_SYSTEM_PROMPT = `You are a performance marketing strategist for small and medium businesses.
Your job is to create high-converting marketing campaigns.

Rules:
- Write concise, compelling ad copy that drives action
- Follow platform-specific character limits strictly
- Suggest realistic targeting based on the business context
- Explain your strategic rationale briefly
- Respond with valid JSON only, no markdown fences or extra text`;

const CHANNEL_PROMPTS: Record<MarketingChannel, string> = {
  google_ads: `
PLATFORM: Google Ads

For SEARCH campaigns, generate:
- headlines: array of 10-15 headlines, each MUST be ≤30 characters
- descriptions: array of 3-4 descriptions, each MUST be ≤90 characters
- keywords: array of 10-20 target keywords (include exact, phrase, broad match)
- negativeKeywords: array of 5-10 irrelevant terms to exclude
- finalUrl: the landing page URL (use the business website if provided)

For DISPLAY campaigns, generate:
- headlines: array of 3-5 headlines, each MUST be ≤30 characters
- longHeadline: one headline ≤90 characters
- descriptions: array of 3-5 descriptions, each MUST be ≤90 characters
- businessName: the business name
- images: empty array (images added separately)
- finalUrl: the landing page URL

Character limits are STRICT. Count characters carefully.`,

  meta_ads: `
PLATFORM: Meta Ads (Facebook + Instagram)

Generate:
- primaryText: main ad copy, recommended ≤125 characters for optimal display
- headline: ≤40 characters
- description: ≤30 characters (optional supporting text)
- callToAction: one of LEARN_MORE, SHOP_NOW, SIGN_UP, BOOK_NOW, CONTACT_US, GET_QUOTE, SUBSCRIBE, DOWNLOAD, GET_OFFER, ORDER_NOW
- placements: array from facebook_feed, facebook_stories, facebook_reels, instagram_feed, instagram_stories, instagram_reels

Choose placements that match the campaign type and business.`,

  email: `
PLATFORM: Email Campaign

Generate:
- subject: compelling email subject line, ≤60 characters
- preheader: preview text shown after subject in inbox, ≤100 characters
- bodyHtml: full HTML email body using simple inline styles. Include a clear CTA button. Keep it professional and scannable.
- bodyText: plain text version of the email body

Write like you're emailing a valued customer. Be warm, direct, and action-oriented.`,
};

// ── Campaign Type Context ────────────────────────────────────────────────────

const TYPE_CONTEXT: Partial<Record<CampaignType, string>> = {
  search: 'This is a SEARCH campaign — the user is actively looking for this product/service. Write intent-matching copy.',
  display: 'This is a DISPLAY campaign — the user is browsing. Write attention-grabbing, visual-first copy.',
  feed: 'This is a FEED ad — the user is scrolling their feed. Write thumb-stopping copy that blends naturally.',
  stories: 'This is a STORIES ad — full-screen vertical format. Write short, punchy copy with urgency.',
  reels: 'This is a REELS ad — short-form video context. Write energetic, action-oriented copy.',
  catalog: 'This is a CATALOG ad — showcasing products. Write product-focused copy that drives purchases.',
  email_blast: 'This is an EMAIL BLAST to an existing audience. Write personalized, value-driven copy.',
};

// ── Build Prompt ─────────────────────────────────────────────────────────────

function buildUserPrompt(
  context: CampaignGenerationContext,
  channel: MarketingChannel,
  campaignType: CampaignType,
): string {
  const parts = [
    `Generate a ${campaignType.replace('_', ' ')} campaign for ${channel.replace('_', ' ')}.`,
    '',
    'BUSINESS CONTEXT:',
    `Business Name: ${context.businessName}`,
  ];

  if (context.businessType) parts.push(`Business Type: ${context.businessType}`);
  if (context.description) parts.push(`Description: ${context.description}`);
  if (context.tagline) parts.push(`Tagline: ${context.tagline}`);
  if (context.websiteUrl) parts.push(`Website: ${context.websiteUrl}`);
  if (context.location) parts.push(`Location: ${context.location}`);
  if (context.targetAudience) parts.push(`Target Audience: ${context.targetAudience}`);

  if (context.services?.length) {
    parts.push(`Services: ${context.services.map(s => s.name + (s.price ? ` (${s.price})` : '')).join(', ')}`);
  }
  if (context.products?.length) {
    parts.push(`Products: ${context.products.map(p => p.name + (p.price ? ` (${p.price})` : '')).join(', ')}`);
  }
  if (context.uniqueSellingPoints?.length) {
    parts.push(`Key Differentiators: ${context.uniqueSellingPoints.join(', ')}`);
  }
  if (context.additionalContext) {
    parts.push(`Additional Context: ${context.additionalContext}`);
  }

  parts.push('');
  parts.push(TYPE_CONTEXT[campaignType] || '');

  parts.push('');
  parts.push(`Respond with a JSON object in this exact format:
{
  "name": "Campaign name (short, descriptive)",
  "content": { ... channel-specific fields as described above ... },
  "targeting": {
    "locations": ["country/city codes or names"],
    "audienceType": "broad | custom"
  },
  "rationale": "Brief strategic rationale for this campaign",
  "suggestedDailyBudgetCents": 1000,
  "suggestedDurationDays": 30
}`);

  return parts.join('\n');
}

// ── Core Generation Function ─────────────────────────────────────────────────

/**
 * Generate a marketing campaign using AI.
 * This is the main reusable function — call it from any consumer (ops, admin, cron).
 */
export async function generateCampaign(
  context: CampaignGenerationContext,
  channel: MarketingChannel,
  campaignType: CampaignType,
): Promise<CampaignGenerationResult> {
  const apiKey = process.env.AI_BUILDER_API_KEY;
  if (!apiKey) {
    throw new Error('AI_BUILDER_API_KEY is not configured');
  }

  const systemPrompt = `${BASE_SYSTEM_PROMPT}\n\n${CHANNEL_PROMPTS[channel]}`;
  const userPrompt = buildUserPrompt(context, channel, campaignType);

  if(!process.env.MARKETING_MODEL) {
    console.error(`[marketing/generate] Missing env. var MARKETING_MODEL`);
    throw new Error('AI generation service unavailable');
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.MARKETING_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error(`[marketing/generate] Anthropic API error ${res.status}:`, errBody);
    throw new Error('AI generation service unavailable');
  }

  const data = await res.json();
  const rawText: string = data.content?.[0]?.text?.trim() ?? '';

  // Strip markdown fences if present
  const jsonStr = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    console.error('[marketing/generate] Failed to parse AI response:', rawText.slice(0, 500));
    throw new Error('AI returned invalid campaign data');
  }

  // Validate and sanitize the content based on channel
  const content = sanitizeContent(parsed.content, channel, campaignType);
  const targeting = sanitizeTargeting(parsed.targeting);

  return {
    name: String(parsed.name || `${context.businessName} — ${campaignType}`).slice(0, 100),
    content,
    targeting,
    rationale: String(parsed.rationale || '').slice(0, 500),
    suggestedDailyBudgetCents: Number(parsed.suggestedDailyBudgetCents) || undefined,
    suggestedDurationDays: Number(parsed.suggestedDurationDays) || undefined,
  };
}

// ── Content Sanitization ─────────────────────────────────────────────────────

function sanitizeContent(
  raw: any,
  channel: MarketingChannel,
  campaignType: CampaignType,
): GoogleSearchContent | GoogleDisplayContent | MetaAdContent | EmailContent {
  if (!raw || typeof raw !== 'object') {
    throw new Error('AI returned empty content');
  }

  if (channel === 'google_ads') {
    if (campaignType === 'display') {
      return {
        headlines: toStringArray(raw.headlines).map(h => h.slice(0, 30)),
        longHeadline: String(raw.longHeadline || '').slice(0, 90),
        descriptions: toStringArray(raw.descriptions).map(d => d.slice(0, 90)),
        businessName: String(raw.businessName || ''),
        images: toStringArray(raw.images),
        finalUrl: String(raw.finalUrl || ''),
      } satisfies GoogleDisplayContent;
    }
    return {
      headlines: toStringArray(raw.headlines).map(h => h.slice(0, 30)),
      descriptions: toStringArray(raw.descriptions).map(d => d.slice(0, 90)),
      keywords: toStringArray(raw.keywords),
      negativeKeywords: toStringArray(raw.negativeKeywords),
      finalUrl: String(raw.finalUrl || ''),
    } satisfies GoogleSearchContent;
  }

  if (channel === 'meta_ads') {
    const validCTAs = [
      'LEARN_MORE', 'SHOP_NOW', 'SIGN_UP', 'BOOK_NOW', 'CONTACT_US',
      'GET_QUOTE', 'SUBSCRIBE', 'DOWNLOAD', 'GET_OFFER', 'ORDER_NOW',
    ];
    const validPlacements = [
      'facebook_feed', 'facebook_stories', 'facebook_reels',
      'instagram_feed', 'instagram_stories', 'instagram_reels',
    ];

    return {
      primaryText: String(raw.primaryText || '').slice(0, 500),
      headline: String(raw.headline || '').slice(0, 40),
      description: String(raw.description || '').slice(0, 30),
      callToAction: validCTAs.includes(raw.callToAction) ? raw.callToAction : 'LEARN_MORE',
      imageUrl: raw.imageUrl || undefined,
      videoUrl: raw.videoUrl || undefined,
      placements: toStringArray(raw.placements).filter(p => validPlacements.includes(p)) as any,
    } satisfies MetaAdContent;
  }

  // email
  return {
    subject: String(raw.subject || '').slice(0, 200),
    preheader: String(raw.preheader || '').slice(0, 200),
    bodyHtml: String(raw.bodyHtml || raw.body_html || ''),
    bodyText: String(raw.bodyText || raw.body_text || ''),
    replyTo: raw.replyTo || undefined,
  } satisfies EmailContent;
}

function sanitizeTargeting(raw: any): CampaignTargeting {
  if (!raw || typeof raw !== 'object') return {};

  return {
    locations: raw.locations ? toStringArray(raw.locations) : undefined,
    ageMin: typeof raw.ageMin === 'number' ? raw.ageMin : undefined,
    ageMax: typeof raw.ageMax === 'number' ? raw.ageMax : undefined,
    interests: raw.interests ? toStringArray(raw.interests) : undefined,
    audienceType: ['broad', 'custom', 'lookalike'].includes(raw.audienceType)
      ? raw.audienceType
      : undefined,
    recipientEmails: raw.recipientEmails ? toStringArray(raw.recipientEmails) : undefined,
    recipientListName: typeof raw.recipientListName === 'string' ? raw.recipientListName : undefined,
  };
}

// ── Phase B Helper (for future use) ──────────────────────────────────────────

/**
 * Assemble campaign context from a site's stored data.
 * Phase B: auto-pulls data from the site's design_data, products, services, etc.
 */
export async function assembleContextFromSite(
  siteId: string,
  db: any,
): Promise<CampaignGenerationContext> {
  const { data: site } = await db
    .from('sites')
    .select('site_slug, design_data, published_data, custom_domain')
    .eq('id', siteId)
    .single();

  const designData = site?.published_data ?? site?.design_data ?? {};

  // Pull products
  const { data: products } = await db
    .from('products')
    .select('title, description, price')
    .eq('site_id', siteId)
    .eq('is_active', true)
    .limit(20);

  // Pull booking services
  const { data: services } = await db
    .from('booking_services')
    .select('name, description, price')
    .eq('site_id', siteId)
    .limit(20);

  const websiteUrl = site?.custom_domain
    ? `https://${site.custom_domain}`
    : site?.site_slug
      ? `https://${site.site_slug}.kswd.ca`
      : undefined;

  return {
    businessName: designData.siteTitle || site?.site_slug || 'Business',
    businessType: designData.businessType,
    description: designData.aboutText || designData.description,
    tagline: designData.tagline,
    websiteUrl,
    services: (services ?? []).map((s: any) => ({
      name: s.name,
      description: s.description,
      price: s.price ? `$${(s.price / 100).toFixed(2)}` : undefined,
    })),
    products: (products ?? []).map((p: any) => ({
      name: p.title,
      description: p.description,
      price: p.price ? `$${(p.price / 100).toFixed(2)}` : undefined,
    })),
    location: designData.businessProfile
      ? `${designData.businessProfile.addressLocality || ''}, ${designData.businessProfile.addressRegion || ''}`.trim()
      : undefined,
  };
}

// ── Utilities ────────────────────────────────────────────────────────────────

function toStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((v): v is string => typeof v === 'string' && v.length > 0);
}
