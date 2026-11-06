/** Guardrails for agent-written code. Keep in sync with the guide (lib/v2/guide.ts). */

/** Hosts agent JS may import ES modules from. */
export const SCRIPT_HOST_ALLOWLIST = [
  'cdn.jsdelivr.net',
  'unpkg.com',
  'esm.sh',
  'cdnjs.cloudflare.com',
];

/** Hosts agent CSS/HTML may load fonts or styles from. */
export const STYLE_HOST_ALLOWLIST = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net', 'unpkg.com'];

export const BUDGETS = {
  sectionHtmlBytes: 60_000,
  sectionCssBytes: 40_000,
  sectionJsBytes: 40_000,
  globalCssBytes: 80_000,
  globalJsBytes: 60_000,
  pageCssBytes: 150_000,
  pageJsBytes: 150_000,
};

/** `@...` bindings agents can use in data-ks to show site-wide business info. */
export const GLOBAL_BINDINGS = [
  '@business.name',
  '@business.phone',
  '@business.email',
  '@business.address',
  '@business.hours',
  '@site.name',
  '@site.logo',
  '@site.year',
] as const;

export const SECTION_KEY_RE = /^[a-z][a-z0-9-]{0,47}$/;
export const FIELD_ID_RE = /^[a-z][a-zA-Z0-9_-]{0,47}$/;
export const PAGE_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
export const TOKEN_NAME_RE = /^[a-z][a-z0-9-]{0,47}$/;

export function isAllowedScriptUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && SCRIPT_HOST_ALLOWLIST.includes(u.hostname);
  } catch {
    return false;
  }
}
