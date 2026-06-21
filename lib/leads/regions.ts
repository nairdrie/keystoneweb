// Shared GTA region/city/niche constants for lead discovery.
//
// These mirror the seed in migrations/059_lead_prospects.sql. They're the
// source of truth for:
//   - the region labels + pills on /ops/leads/discover
//   - the city picker in the manual "Run prospect finder" form
//   - validation in the manual discovery endpoint
//
// Discovery is GTA-only (the Places search biases to a GTA bounding box and
// regions carry a DB CHECK constraint), so keeping the list centralized keeps
// the UI, the endpoint, and the cron rotation in agreement.

export const LEAD_REGIONS = [
  'toronto_core',
  'york',
  'peel',
  'halton',
  'durham',
] as const;
export type LeadRegion = (typeof LEAD_REGIONS)[number];

export const LEAD_REGION_LABELS: Record<LeadRegion, string> = {
  toronto_core: 'Toronto core',
  york: 'York Region',
  peel: 'Peel Region',
  halton: 'Halton Region',
  durham: 'Durham Region',
};

// Cities per region, matching the discovery seed matrix.
export const LEAD_REGION_CITIES: Record<LeadRegion, string[]> = {
  toronto_core: ['Toronto', 'North York', 'Scarborough', 'Etobicoke', 'East York'],
  york: ['Vaughan', 'Markham', 'Richmond Hill', 'Aurora', 'Newmarket', 'Stouffville', 'King City'],
  peel: ['Mississauga', 'Brampton', 'Caledon'],
  halton: ['Oakville', 'Burlington', 'Milton', 'Halton Hills'],
  durham: ['Pickering', 'Ajax', 'Whitby', 'Oshawa'],
};

// Niches the discovery seed targets — local service businesses that tend to
// have weak websites. Offered as quick-pick suggestions in the manual form;
// the operator can still type any niche they like.
export const COMMON_LEAD_NICHES = [
  'plumber',
  'electrician',
  'hvac contractor',
  'roofer',
  'landscaper',
  'painter',
  'general contractor',
  'handyman',
  'accountant',
  'small law firm',
  'dentist',
  'chiropractor',
  'auto repair shop',
  'auto body shop',
  'hair salon',
  'nail salon',
  'barbershop',
  'pet groomer',
  'real estate agent',
  'cleaning service',
] as const;

export function isLeadRegion(value: unknown): value is LeadRegion {
  return typeof value === 'string' && (LEAD_REGIONS as readonly string[]).includes(value);
}
