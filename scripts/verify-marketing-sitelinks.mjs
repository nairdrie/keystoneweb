/**
 * Verifies lib/marketing/sitelinks.ts — the pure sitelink builders — by running
 * the real TypeScript via Node's built-in type stripping (Node >= 22.6).
 *
 * Run: node scripts/verify-marketing-sitelinks.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
function check(name, cond, detail) {
  if (!cond) failures.push(`${name}${detail ? `: ${detail}` : ''}`);
}

const { siteBaseUrl, buildSitelinkSpecs } = await import(path.join(root, 'lib/marketing/sitelinks.ts'));

// ── siteBaseUrl ───────────────────────────────────────────────────────────────
check('custom domain wins', siteBaseUrl({ customDomain: 'torontoroofer.net', siteSlug: 'aman' }) === 'https://torontoroofer.net');
check('strips scheme + trailing slash', siteBaseUrl({ customDomain: 'https://torontoroofer.net/' }) === 'https://torontoroofer.net');
check('falls back to slug.kswd.ca', siteBaseUrl({ siteSlug: 'aman-roofing' }) === 'https://aman-roofing.kswd.ca');
check('null when neither', siteBaseUrl({}) === null);

// ── buildSitelinkSpecs ────────────────────────────────────────────────────────
const pages = [
  { slug: 'home', display_name: 'Home', is_visible_in_nav: true, nav_order: 0 },
  { slug: 'services', display_name: 'Services', is_visible_in_nav: true, nav_order: 1 },
  { slug: 'gallery', display_name: 'Gallery', is_visible_in_nav: true, nav_order: 2 },
  { slug: 'contact', display_name: 'Contact Us', is_visible_in_nav: true, nav_order: 3 },
  { slug: 'get-a-quote', display_name: 'Get a Quote', is_visible_in_nav: true, nav_order: 4 },
  { slug: 'secret', display_name: 'Secret', is_visible_in_nav: false, nav_order: 5 },
];

{
  // Landing is the home page → home excluded; nav order preserved; hidden skipped.
  const specs = buildSitelinkSpecs({ baseUrl: 'https://torontoroofer.net', pages, landingFinalUrl: 'https://torontoroofer.net/?utm_source=keystone' });
  const texts = specs.map(s => s.linkText);
  check('excludes landing (home)', !texts.includes('Home'), JSON.stringify(texts));
  check('excludes hidden page', !texts.includes('Secret'), JSON.stringify(texts));
  check('keeps nav order', texts.join(',') === 'Services,Gallery,Contact Us,Get a Quote', texts.join(','));
  check('builds page url from slug', specs[0].finalUrl === 'https://torontoroofer.net/services', specs[0].finalUrl);
  check('produces >= 4 sitelinks', specs.length >= 4, `${specs.length}`);
}

{
  // No landing → home included, mapped to the bare base URL.
  const specs = buildSitelinkSpecs({ baseUrl: 'https://torontoroofer.net', pages });
  const home = specs.find(s => s.linkText === 'Home');
  check('home maps to base url', !!home && home.finalUrl === 'https://torontoroofer.net', home && home.finalUrl);
}

{
  // Cap is respected.
  const many = Array.from({ length: 20 }, (_, i) => ({ slug: `p${i}`, display_name: `Page ${i}`, is_visible_in_nav: true, nav_order: i }));
  const specs = buildSitelinkSpecs({ baseUrl: 'https://x.kswd.ca', pages: many, max: 8 });
  check('caps at max', specs.length === 8, `${specs.length}`);
}

{
  // 'Untitled' display_name falls back to title, then humanized slug.
  const specs = buildSitelinkSpecs({ baseUrl: 'https://x.kswd.ca', pages: [
    { slug: 'about-us', display_name: 'Untitled', title: '', is_visible_in_nav: true, nav_order: 0 },
  ] });
  check('humanizes slug when no label', specs[0]?.linkText === 'About Us', specs[0]?.linkText);
}

{
  // De-dupes by URL and by label.
  const specs = buildSitelinkSpecs({ baseUrl: 'https://x.kswd.ca', pages: [
    { slug: 'services', display_name: 'Services', is_visible_in_nav: true, nav_order: 0 },
    { slug: 'services', display_name: 'Services', is_visible_in_nav: true, nav_order: 1 },
  ] });
  check('dedupes duplicate pages', specs.length === 1, `${specs.length}`);
}

{
  // link_text is truncated to Google's 25-char limit.
  const specs = buildSitelinkSpecs({ baseUrl: 'https://x.kswd.ca', pages: [
    { slug: 'p', display_name: 'A very long navigation label that exceeds the limit', is_visible_in_nav: true, nav_order: 0 },
  ] });
  check('link text <= 25 chars', specs[0].linkText.length <= 25, `${specs[0].linkText.length}`);
}

// ── Source-level guards on the deploy path (google-ads.ts) ────────────────────
{
  const src = fs.readFileSync(path.join(root, 'lib/marketing/google-ads.ts'), 'utf8');
  check('creates sitelink assets', /sitelink_asset/.test(src));
  check('links sitelinks to campaign', /field_type:\s*'SITELINK'/.test(src));
  check('uses campaignAssets + assets accessors', /customer\.campaignAssets\.create/.test(src) && /customer\.assets\.create/.test(src));
}

if (failures.length) {
  console.error(`\n✗ marketing-sitelinks: ${failures.length} check(s) failed:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('✓ marketing-sitelinks: all checks passed');
