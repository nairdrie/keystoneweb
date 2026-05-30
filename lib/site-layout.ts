export type SiteLayoutContainerWidth = 'small' | 'medium' | 'large' | 'wide';

export const SITE_LAYOUT_CONTAINER_WIDTH_KEY = 'layoutContainerWidth';
export const DEFAULT_SITE_LAYOUT_CONTAINER_WIDTH: SiteLayoutContainerWidth = 'large';

export const SITE_LAYOUT_CONTAINER_WIDTH_OPTIONS: Array<{
  value: SiteLayoutContainerWidth;
  label: string;
  maxWidthPx: number;
  maxWidthCss: string;
}> = [
  { value: 'small', label: 'Small', maxWidthPx: 960, maxWidthCss: '60rem' },
  { value: 'medium', label: 'Medium', maxWidthPx: 1120, maxWidthCss: '70rem' },
  { value: 'large', label: 'Large', maxWidthPx: 1280, maxWidthCss: '80rem' },
  { value: 'wide', label: 'Wide', maxWidthPx: 1440, maxWidthCss: '90rem' },
];

const OPTION_BY_VALUE = new Map(
  SITE_LAYOUT_CONTAINER_WIDTH_OPTIONS.map((option) => [option.value, option]),
);

export function normalizeSiteLayoutContainerWidth(value: unknown): SiteLayoutContainerWidth {
  return typeof value === 'string' && OPTION_BY_VALUE.has(value as SiteLayoutContainerWidth)
    ? value as SiteLayoutContainerWidth
    : DEFAULT_SITE_LAYOUT_CONTAINER_WIDTH;
}

export function getSiteLayoutContainerWidthOption(siteContent: unknown) {
  const source = isRecord(siteContent) ? siteContent[SITE_LAYOUT_CONTAINER_WIDTH_KEY] : undefined;
  return OPTION_BY_VALUE.get(normalizeSiteLayoutContainerWidth(source))!;
}

export function buildSiteLayoutCss(blockId: string, siteContent: unknown): string {
  const option = getSiteLayoutContainerWidthOption(siteContent);
  const scope = `[data-block-id="${escapeAttribute(blockId)}"]`;
  const targetClasses = getTargetMaxWidthClasses(option.value);
  const targets = [
    ...targetClasses.flatMap((className) => [
      `${scope} > section > .${className}`,
      `${scope} > .${className}`,
    ]),
    `${scope} > section > .ks-site-container`,
    `${scope} > .ks-site-container`,
  ];

  return `${targets.join(', ')} { max-width: min(100%, ${option.maxWidthCss}) !important; width: 100%; margin-left: auto !important; margin-right: auto !important; }`;
}

function getTargetMaxWidthClasses(width: SiteLayoutContainerWidth): string[] {
  if (width === 'small') return ['max-w-5xl', 'max-w-6xl', 'max-w-7xl'];
  if (width === 'medium') return ['max-w-6xl', 'max-w-7xl'];
  return ['max-w-7xl'];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function escapeAttribute(value: string): string {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
