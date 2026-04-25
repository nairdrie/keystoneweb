/**
 * Marketing Automation — Shared Types
 *
 * Reusable type definitions consumed by both the ops panel (Phase A)
 * and the customer-facing admin dashboard (Phase B).
 */

// ── Channels & Campaign Types ────────────────────────────────────────────────

export type MarketingChannel = 'google_ads' | 'meta_ads' | 'email';

export type CampaignType =
  | 'search'        // Google Ads — search
  | 'display'       // Google Ads — display
  | 'feed'          // Meta — feed (FB + IG)
  | 'stories'       // Meta — stories
  | 'reels'         // Meta — reels
  | 'catalog'       // Meta — product catalog
  | 'email_blast';  // Email

export type CampaignStatus =
  | 'draft'
  | 'suggested'
  | 'approved'
  | 'submitting'
  | 'active'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** Map of allowed next statuses for each status. */
export const STATUS_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  draft:      ['approved', 'cancelled'],
  suggested:  ['draft', 'approved', 'cancelled'],
  approved:   ['submitting', 'cancelled'],
  submitting: ['active', 'failed'],
  active:     ['paused', 'completed'],
  paused:     ['active', 'cancelled', 'completed'],
  completed:  [],
  failed:     ['draft', 'cancelled'],
  cancelled:  [],
};

// ── Channel-specific Content Schemas ─────────────────────────────────────────

export interface GoogleSearchContent {
  headlines: string[];          // Up to 15, each ≤30 chars
  descriptions: string[];      // Up to 4, each ≤90 chars
  keywords: string[];           // Target keywords
  negativeKeywords: string[];   // Excluded keywords
  finalUrl: string;             // Landing page URL
}

export interface GoogleDisplayContent {
  headlines: string[];          // Up to 5, each ≤30 chars
  longHeadline: string;         // ≤90 chars
  descriptions: string[];      // Up to 5, each ≤90 chars
  businessName: string;
  images: string[];             // Image URLs
  finalUrl: string;
}

export interface MetaAdContent {
  primaryText: string;          // Main ad copy (≤125 chars recommended)
  headline: string;             // ≤40 chars
  description: string;          // ≤30 chars (optional)
  callToAction: MetaCTA;
  imageUrl?: string;
  videoUrl?: string;
  placements: MetaPlacement[];
}

export type MetaCTA =
  | 'LEARN_MORE' | 'SHOP_NOW' | 'SIGN_UP' | 'BOOK_NOW'
  | 'CONTACT_US' | 'GET_QUOTE' | 'SUBSCRIBE' | 'DOWNLOAD'
  | 'GET_OFFER' | 'ORDER_NOW';

export type MetaPlacement =
  | 'facebook_feed' | 'facebook_stories' | 'facebook_reels'
  | 'instagram_feed' | 'instagram_stories' | 'instagram_reels';

export interface EmailContent {
  subject: string;
  preheader: string;
  bodyHtml: string;
  bodyText: string;
  replyTo?: string;
}

export type CampaignContent =
  | GoogleSearchContent
  | GoogleDisplayContent
  | MetaAdContent
  | EmailContent;

// ── Targeting ────────────────────────────────────────────────────────────────

export interface CampaignTargeting {
  // Geographic
  locations?: string[];         // Country/region/city codes
  radius?: { lat: number; lng: number; radiusKm: number };

  // Demographic (Meta)
  ageMin?: number;
  ageMax?: number;
  genders?: ('male' | 'female' | 'all')[];

  // Interests (Meta)
  interests?: string[];

  // Audience
  audienceType?: 'broad' | 'custom' | 'lookalike';

  // Email
  recipientEmails?: string[];   // For email campaigns
  recipientListName?: string;   // Description of the list
}

// ── Core Campaign Record ─────────────────────────────────────────────────────

export interface Campaign {
  id: string;
  site_id: string | null;        // NULL = ops/platform campaign
  created_by: string | null;
  name: string;
  channel: MarketingChannel;
  campaign_type: CampaignType;
  status: CampaignStatus;
  content: CampaignContent;
  targeting: CampaignTargeting;
  daily_budget_cents: number | null;
  total_budget_cents: number | null;
  spent_cents: number;
  start_date: string | null;
  end_date: string | null;
  approved_at: string | null;
  launched_at: string | null;
  completed_at: string | null;
  external_campaign_id: string | null;
  external_ad_group_id: string | null;
  external_ad_id: string | null;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc_cents: number;
  ai_generated: boolean;
  ai_rationale: string | null;
  created_at: string;
  updated_at: string;
}

// ── Campaign Log ─────────────────────────────────────────────────────────────

export type CampaignLogAction =
  | 'created' | 'edited' | 'approved' | 'launched'
  | 'paused' | 'resumed' | 'failed' | 'completed' | 'cancelled'
  | 'performance_synced' | 'budget_updated';

export interface CampaignLog {
  id: string;
  campaign_id: string;
  action: CampaignLogAction;
  actor: string;               // 'system', 'user:<email>', 'ai', 'cron'
  details: Record<string, unknown>;
  created_at: string;
}

// ── Marketing Settings ───────────────────────────────────────────────────────

export interface MarketingSettings {
  id: string;
  site_id: string | null;       // NULL = platform-level
  monthly_budget_limit_cents: number | null;
  auto_suggest: boolean;
  created_at: string;
  updated_at: string;
}

// ── Marketing Spend ──────────────────────────────────────────────────────────

export interface MarketingSpend {
  id: string;
  campaign_id: string;
  site_id: string | null;
  channel: MarketingChannel;
  spend_date: string;
  ad_spend_cents: number;
  management_fee_cents: number;
  created_at: string;
}

// ── AI Generation ────────────────────────────────────────────────────────────

/** Context provided to the AI for campaign generation. */
export interface CampaignGenerationContext {
  businessName: string;
  businessType?: string;
  description?: string;
  tagline?: string;
  websiteUrl?: string;
  services?: { name: string; description?: string; price?: string }[];
  products?: { name: string; description?: string; price?: string }[];
  targetAudience?: string;
  uniqueSellingPoints?: string[];
  location?: string;
  additionalContext?: string;
}

/** Result returned by the AI generation function. */
export interface CampaignGenerationResult {
  name: string;
  content: CampaignContent;
  targeting: CampaignTargeting;
  rationale: string;
  suggestedDailyBudgetCents?: number;
  suggestedDurationDays?: number;
}

// ── UI Helpers ───────────────────────────────────────────────────────────────

export const CHANNEL_LABELS: Record<MarketingChannel, string> = {
  google_ads: 'Google Ads',
  meta_ads:   'Meta / Instagram',
  email:      'Email',
};

export const CAMPAIGN_TYPE_LABELS: Record<CampaignType, string> = {
  search:     'Search Ads',
  display:    'Display Ads',
  feed:       'Feed Ads',
  stories:    'Stories Ads',
  reels:      'Reels Ads',
  catalog:    'Catalog Ads',
  email_blast: 'Email Blast',
};

export const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft:      'Draft',
  suggested:  'Suggested',
  approved:   'Approved',
  submitting: 'Submitting',
  active:     'Active',
  paused:     'Paused',
  completed:  'Completed',
  failed:     'Failed',
  cancelled:  'Cancelled',
};

export const STATUS_COLORS: Record<CampaignStatus, string> = {
  draft:      'text-gray-400 bg-gray-400/10',
  suggested:  'text-violet-400 bg-violet-400/10',
  approved:   'text-sky-400 bg-sky-400/10',
  submitting: 'text-amber-400 bg-amber-400/10',
  active:     'text-emerald-400 bg-emerald-400/10',
  paused:     'text-amber-400 bg-amber-400/10',
  completed:  'text-gray-500 bg-gray-800',
  failed:     'text-red-400 bg-red-400/10',
  cancelled:  'text-gray-500 bg-gray-800',
};

export const CHANNEL_CAMPAIGN_TYPES: Record<MarketingChannel, CampaignType[]> = {
  google_ads: ['search', 'display'],
  meta_ads:   ['feed', 'stories', 'reels', 'catalog'],
  email:      ['email_blast'],
};
