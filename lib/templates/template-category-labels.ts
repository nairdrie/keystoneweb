const TEMPLATE_CATEGORY_LABELS: Record<string, string> = {
  handyman: 'Handyman',
  plumber: 'Plumber',
  electrical: 'Electrician',
  hvac: 'HVAC/Heating',
  mechanic: 'Mechanic',
  trades: 'Trades',
  cleaning: 'Cleaning',
  landscaping: 'Landscaping',
  consulting: 'Consulting',
  freelance: 'Freelancer',
  salon: 'Salon/Spa',
  fitness: 'Fitness/Coaching',
  ecommerce: 'E-Commerce Store',
  handmade: 'Handmade/Crafts',
  digital: 'Digital Products',
  dropship: 'Dropshipping',
  subscription: 'Subscription Box',
  photographer: 'Photographer',
  designer: 'Designer',
  artist: 'Artist',
  videographer: 'Videographer',
  architect: 'Architect / Interior',
  agency: 'Creative Agency',
  nonprofit: 'Non-Profit Org',
  charity: 'Charity / Fundraising',
  association: 'Association',
  community: 'Community Group',
  foundation: 'Foundation',
  church: 'Church / Religious',
  restaurant: 'Restaurant / Food',
  event: 'Events / Weddings',
  blog: 'Blog / Content',
  realestate: 'Real Estate',
  education: 'Education / Courses',
  general: 'General',
};

export function getTemplateCategoryLabel(category: string | null | undefined): string {
  const normalized = normalizeCategory(category);
  if (!normalized) return '';
  return TEMPLATE_CATEGORY_LABELS[normalized] || titleCaseCategory(normalized);
}

export function formatTemplateNameForCategory(
  templateName: string,
  category: string | null | undefined,
): string {
  const label = getTemplateCategoryLabel(category);
  const baseName = templateName.trim();
  if (!baseName || !label) return baseName;
  if (hasCategorySuffix(baseName, label)) return baseName;
  return `${baseName} — ${label}`;
}

function normalizeCategory(category: string | null | undefined): string {
  return (category || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/-/g, '_');
}

function titleCaseCategory(category: string): string {
  return category
    .split(/[_-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function hasCategorySuffix(templateName: string, label: string): boolean {
  const normalizedName = templateName.toLowerCase().replace(/\s+/g, ' ').trim();
  const normalizedLabel = label.toLowerCase().replace(/\s+/g, ' ').trim();
  return normalizedName.endsWith(`— ${normalizedLabel}`)
    || normalizedName.endsWith(`- ${normalizedLabel}`)
    || normalizedName.endsWith(`– ${normalizedLabel}`);
}
