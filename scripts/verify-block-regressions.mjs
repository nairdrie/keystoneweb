import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function requireSnippets(file, snippets, failures) {
  const source = read(file);
  for (const snippet of snippets) {
    if (!source.includes(snippet)) {
      failures.push(`${file} missing: ${snippet}`);
    }
  }
}

const failures = [];

requireSnippets('app/components/blocks/TextBlock.tsx', [
  "import { sanitizeRichHtml } from '@/lib/html-sanitize';",
  'sanitizeRichHtml(prefixInternalLinks(rawHtml, langPrefix))',
], failures);

requireSnippets('app/components/blocks/BlogBlock.tsx', [
  "import { sanitizeRichHtml } from '@/lib/html-sanitize';",
  'sanitizeRichHtml(prefixInternalLinks(post.content, langPrefix))',
], failures);

requireSnippets('app/components/blocks/BlogBlockEditor.tsx', [
  "import { sanitizeRichHtml } from '@/lib/html-sanitize';",
  'sanitizeRichHtml(prefixInternalLinks(post.content, langPrefix))',
], failures);

requireSnippets('lib/html-sanitize.ts', [
  "allowedSchemes: ['http', 'https', 'mailto', 'tel']",
  "img: ['http', 'https', 'data']",
], failures);

requireSnippets('app/components/blocks/EstimateFormBlock.tsx', [
  "const submissionName = contactInfo.name.trim() || 'Estimate request';",
  "const submissionEmail = contactInfo.email.trim() || 'estimate-request@kswd.ca';",
  'address: contactInfo.address.trim() || undefined',
  'preferredDate: contactInfo.preferredDate || undefined',
], failures);

requireSnippets('app/api/contact/route.ts', [
  'Contact details:',
  'contact.address',
  'contact.preferredDate',
  'contact.phone',
], failures);

requireSnippets('app/components/blocks/LogoCloudBlock.tsx', [
  'handleLogoSave',
  'updateContent(key, value);',
  "typeof logo === 'string' ? logo : ''",
], failures);

requireSnippets('app/components/blocks/CarouselBlock.tsx', [
  'handleCarouselImageSave',
  "key === `carousel_${idx}_image`",
  'updateContent(key, value);',
], failures);

requireSnippets('app/components/blocks/RepeatableItemsSettingsPanel.tsx', [
  "{ id: 'scroll', label: 'Horizontal Scroll'",
  'showMoreEnabled',
  'visibleCount',
  'autoScroll',
  'infiniteScroll',
  'loopScroll',
], failures);

const mapSource = read('app/components/blocks/MapBlock.tsx');
const mapIframeCount = (mapSource.match(/<iframe/g) || []).length;
if (mapIframeCount !== 1) {
  failures.push(`app/components/blocks/MapBlock.tsx should render one iframe, found ${mapIframeCount}`);
}
if (!mapSource.includes('title={title ||')) {
  failures.push('app/components/blocks/MapBlock.tsx missing iframe title');
}

requireSnippets('app/components/blocks/GalleryBlock.tsx', [
  'aria-label={`Open gallery image',
  'type="button"',
], failures);

requireSnippets('lib/url.ts', [
  'SAFE_EXPLICIT_HREF_PATTERN',
  'HAS_SCHEME_PATTERN',
  'return `https://${href}`;',
], failures);

requireSnippets('app/components/blocks/DeliveryLinksBlock.tsx', [
  "import { normalizeExternalHref } from '@/lib/url';",
  'const href = normalizeExternalHref(link.url);',
], failures);

requireSnippets('app/components/blocks/ResourcesBlock.tsx', [
  "import { normalizeExternalHref } from '@/lib/url';",
  'normalizeExternalHref(rawActionHref)',
], failures);

requireSnippets('app/components/blocks/block-registry.ts', [
  'contactForm: ContactFormBlock',
  'customHtml: CustomHTMLBlock',
  'customHTML: CustomHTMLBlock',
], failures);

requireSnippets('app/components/blocks/block-panel-registry.tsx', [
  'membershipGate: {',
  'hideSettingsButton: true',
], failures);

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Block regression checks passed.');
