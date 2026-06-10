// Shared types and constants for the /ops/leads feature.
// Used by API routes (validation), the list page (filters/badges), and the
// detail page (selects).

export const LEAD_STATUSES = [
  'new',
  'researching',
  'contacted',
  'qualified',
  'proposal_sent',
  'negotiating',
  'building',
  'converted',
  'lost',
  'unresponsive',
  'do_not_contact',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

// Industry / vertical the lead operates in. Used for tagging + filtering the
// pipeline. Kept as an app-level list (no DB CHECK constraint) so we can add
// verticals without a migration. 'other' is the catch-all.
export const LEAD_INDUSTRIES = [
  'automotive',
  'landscaping',
  'accounting',
  'handyman',
  'roofing',
  'real_estate',
  'dental',
  'spa',
  'plumbing',
  'electrical',
  'hvac',
  'cleaning',
  'salon',
  'fitness',
  'restaurant',
  'legal',
  'medical',
  'construction',
  'painting',
  'pest_control',
  'photography',
  'retail',
  'other',
] as const;
export type LeadIndustry = (typeof LEAD_INDUSTRIES)[number];

export const LEAD_SOURCES = [
  'cold_call',
  'cold_email',
  'walk_in',
  'referral',
  'web_form',
  'networking_event',
  'social_media',
  'paid_ad',
  'organic_search',
  'launch_request',
  'partner',
  'physical_ad',
  'other',
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const CONTACT_EVENT_KINDS = [
  'call',
  'meeting',
  'voicemail',
  'sms',
  'email_sent',
  'email_received',
  'note',
] as const;
export type ContactEventKind = (typeof CONTACT_EVENT_KINDS)[number];

export const CONTACT_EVENT_OUTCOMES = [
  'connected',
  'no_answer',
  'voicemail_left',
  'callback_scheduled',
  'interested',
  'not_interested',
  'not_a_fit',
  'meeting_booked',
  'left_message',
] as const;
export type ContactEventOutcome = (typeof CONTACT_EVENT_OUTCOMES)[number];

// Tailwind class maps. Mirrors app/ops/launch/page.tsx STATUS_STYLES.
export const LEAD_STATUS_STYLES: Record<LeadStatus, string> = {
  new: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  researching: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  contacted: 'text-sky-400 bg-sky-400/10 border-sky-400/30',
  qualified: 'text-sky-400 bg-sky-400/10 border-sky-400/30',
  proposal_sent: 'text-violet-400 bg-violet-400/10 border-violet-400/30',
  negotiating: 'text-violet-400 bg-violet-400/10 border-violet-400/30',
  building: 'text-violet-400 bg-violet-400/10 border-violet-400/30',
  converted: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  lost: 'text-gray-500 bg-gray-800 border-gray-700',
  unresponsive: 'text-gray-500 bg-gray-800 border-gray-700',
  do_not_contact: 'text-red-400 bg-red-400/10 border-red-400/30',
};

export const LEAD_INDUSTRY_LABELS: Record<LeadIndustry, string> = {
  automotive: 'Automotive',
  landscaping: 'Landscaping',
  accounting: 'Accounting',
  handyman: 'Handyman',
  roofing: 'Roofer',
  real_estate: 'Real Estate',
  dental: 'Dental',
  spa: 'Spa',
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  hvac: 'HVAC',
  cleaning: 'Cleaning',
  salon: 'Salon / Barber',
  fitness: 'Fitness / Gym',
  restaurant: 'Restaurant / Food',
  legal: 'Legal',
  medical: 'Medical / Health',
  construction: 'Construction',
  painting: 'Painting',
  pest_control: 'Pest Control',
  photography: 'Photography',
  retail: 'Retail',
  other: 'Other',
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  cold_call: 'Cold call',
  cold_email: 'Cold email',
  walk_in: 'Walk-in',
  referral: 'Referral',
  web_form: 'Web form',
  networking_event: 'Networking event',
  social_media: 'Social media',
  paid_ad: 'Paid ad',
  organic_search: 'Organic search',
  launch_request: 'Launch request',
  partner: 'Partner',
  physical_ad: 'Physical ad / sign',
  other: 'Other',
};

export const CONTACT_EVENT_KIND_LABELS: Record<ContactEventKind, string> = {
  call: 'Call',
  meeting: 'Meeting',
  voicemail: 'Voicemail',
  sms: 'SMS',
  email_sent: 'Email sent',
  email_received: 'Email received',
  note: 'Note',
};

export function formatLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return value.replace(/_/g, ' ');
}

export function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === 'string' && (LEAD_STATUSES as readonly string[]).includes(value);
}

export function isLeadSource(value: unknown): value is LeadSource {
  return typeof value === 'string' && (LEAD_SOURCES as readonly string[]).includes(value);
}

export function isLeadIndustry(value: unknown): value is LeadIndustry {
  return typeof value === 'string' && (LEAD_INDUSTRIES as readonly string[]).includes(value);
}

export function isContactEventKind(value: unknown): value is ContactEventKind {
  return typeof value === 'string' && (CONTACT_EVENT_KINDS as readonly string[]).includes(value);
}

// Fields a PATCH /api/ops/leads/[id] request is allowed to update.
export const LEAD_UPDATABLE_FIELDS = [
  'contact_name',
  'person_role',
  'business_name',
  'email',
  'phone',
  'website',
  'has_existing_website',
  'business_type',
  'business_subcategory',
  'industry',
  'address',
  'city',
  'region',
  'country',
  'postal_code',
  'source',
  'source_detail',
  'referred_by_user_id',
  'status',
  'lost_reason',
  'assignee_user_id',
  'converted_user_id',
  'converted_at',
  'onboarding_amount_cents',
  'notes',
  'tags',
] as const;
