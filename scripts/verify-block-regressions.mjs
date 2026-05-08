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
  'isTestimonialDisplaySectionVisible',
  "const isCardLayout = variant === 'cards';",
  "const isScrollLayout = variant === 'scroll';",
  '{value.showMoreEnabled && (',
  '{value.autoScroll && (',
  '{!value.infiniteScroll && (',
], failures);

const mapSource = read('app/components/blocks/MapBlock.tsx');
const mapIframeCount = (mapSource.match(/<iframe/g) || []).length;
if (mapIframeCount !== 1) {
  failures.push(`app/components/blocks/MapBlock.tsx should render one Google fallback iframe, found ${mapIframeCount}`);
}
if (!mapSource.includes("aria-label={settings.title || markerLabel || 'Map'}")) {
  failures.push('app/components/blocks/MapBlock.tsx missing map aria label');
}
for (const snippet of [
  'normalizeMapSettings',
  "settings.mapProvider === 'maptiler'",
  'buildGoogleMapEmbedUrl',
  'buildGoogleAllLocationsEmbedUrl',
  "import('maplibre-gl')",
  'buildMapTilerStyleUrl',
  'buildMapTilerGeocodingUrl',
  'getMapTilerKey',
  'buildDirectionsUrl',
  'syncMapMarkers',
  'Number.isFinite(location.latitude)',
  'showMarkerLabelPill',
  'settings.showMapDirections',
  'settings.showCardDirections',
  "isMapTilerProvider && settings.showAllPinsToggle",
  'new maplibregl.Map',
  'map.fitBounds',
  'map.flyTo',
  'map.isStyleLoaded()',
  'applyDarkGreyMapStyle',
  'buildDirectionsUrl(location.address, location.coordinates)',
  'settings.mapHeight',
  'LocationSummaryOverlay',
  'settings.showLocationCards',
  'settings.showAllPinsToggle',
  'buildAllLocationsDirectionsUrl',
  'All pins',
  'Selected pin',
  'settings.requireMapConsent && !mapLoaded',
  'MapTiler key needed',
  'MapLibre',
]) {
  if (!mapSource.includes(snippet)) failures.push(`app/components/blocks/MapBlock.tsx missing: ${snippet}`);
}

requireSnippets('app/components/blocks/map/map-config.ts', [
  "DEFAULT_MAP_PROVIDER: MapProvider = 'google'",
  "DEFAULT_MAP_STYLE: MapStyle = 'plain'",
  'LEGACY_STYLE_MAP',
  'buildGoogleMapEmbedUrl',
  'buildGoogleAllLocationsEmbedUrl',
  'buildMapTilerStyleUrl',
  'buildMapTilerGeocodingUrl',
  'NEXT_PUBLIC_MAPTILER_KEY',
  'google.com/maps/dir',
  'showMapDirections: readOptionalBoolean',
  'showCardDirections: readOptionalBoolean',
  "mapTilerId: 'bright-v2'",
  "mapTilerId: 'dataviz'",
  "mapTilerId: 'dataviz-dark'",
], failures);

requireSnippets('app/components/blocks/map/MapSettingsPanel.tsx', [
  'Map Provider',
  'MapProviderControl',
  'Google Maps',
  'MapTiler Styles',
  "draft.mapProvider === 'maptiler' && draft.locations.length > 1",
  'Map height',
  'Zoom',
  'Map style',
  'option.preview',
  'PlaceSearchField',
  '/api/seo/places?query=',
  'latitude: place.latitude',
  'Use',
  'Add Location',
  'Show directions button on map',
  'Show directions on location cards',
  'showDirections: draft.showMapDirections || draft.showCardDirections',
  'Show location cards',
  'showLocationCards: locations.length > 1 ? true : draft.showLocationCards',
  'Show all pins toggle',
  'Start with all pins',
  'Require consent before loading map',
  'MapTiler',
  'MAP_DRAFT_UPDATE_EVENT',
], failures);

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
  "primaryButton: { label: 'Settings', icon: Settings }",
], failures);

requireSnippets('app/components/blocks/hero/HeroSettingsPanel.tsx', [
  "const HERO_DRAFT_UPDATE_EVENT = 'ks:hero-draft-update';",
  'const cardsRef = useRef<HeroCard[]>(persistedData.cards);',
  'cardsRef.current = next;',
  'window.addEventListener(HERO_DRAFT_UPDATE_EVENT, handler);',
  'const cardsToSave = cardsRef.current;',
  'cards: cardsToSave,',
  'cardsRef.current = persistedData.cards;',
], failures);

requireSnippets('app/components/blocks/HeroBlock.tsx', [
  'updateContent?: (key: string, value: unknown) => void;',
  'const cardsRef = useRef<HeroCard[]>(cards);',
  'const next = cardsRef.current.map((c, i) => {',
  "if (updateContent) updateContent('cards', next);",
  "const nextUrl = String(value ?? '');",
  'nc.content.image.enabled = true;',
  "hero-content ${imageOnRight || !showForeground ? 'order-1' : 'order-2'}",
  "className={imageOnRight ? 'order-2' : 'order-1'}",
], failures);

requireSnippets('app/components/blocks/BlockWrapperEditor.tsx', [
  "const HERO_DRAFT_UPDATE_EVENT = 'ks:hero-draft-update';",
  "settingsOpen && usesPanel && type === 'hero' && key === 'cards'",
  'window.dispatchEvent(new CustomEvent(HERO_DRAFT_UPDATE_EVENT',
  "const CONTACT_DRAFT_UPDATE_EVENT = 'ks:contact-draft-update';",
  "settingsOpen && usesPanel && type === 'contact' && isContactDraftKey(key)",
  'window.dispatchEvent(new CustomEvent(CONTACT_DRAFT_UPDATE_EVENT',
  "return key === 'contactItems' || key === 'socialLinks';",
], failures);

requireSnippets('app/components/blocks/contact/ContactSettingsPanel.tsx', [
  "const CONTACT_DRAFT_UPDATE_EVENT = 'ks:contact-draft-update';",
  'window.addEventListener(CONTACT_DRAFT_UPDATE_EVENT, handleCanvasDraftUpdate);',
  "detail.key === 'contactItems'",
  "detail.key === 'socialLinks'",
], failures);

requireSnippets('app/components/blocks/InlineCardControls.tsx', [
  'GripVertical',
  'Trash2',
  'group-hover/card:opacity-100',
  'export function reorderItems',
], failures);

for (const file of [
  'app/components/blocks/ServicesGridBlock.tsx',
  'app/components/blocks/StatsBlock.tsx',
  'app/components/blocks/FeaturesListBlock.tsx',
  'app/components/blocks/TestimonialsBlock.tsx',
  'app/components/blocks/TeamBlock.tsx',
  'app/components/blocks/PricingBlock.tsx',
  'app/components/blocks/CarouselBlock.tsx',
  'app/components/blocks/ResourcesBlock.tsx',
]) {
  requireSnippets(file, [
    'InlineCardControls',
    'reorderItems',
  ], failures);
}

requireSnippets('app/components/blocks/FAQBlock.tsx', [
  'InlineCardControls',
  "dragTitle=\"Drag to reorder FAQ\"",
  "removeTitle=\"Delete FAQ\"",
], failures);

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Block regression checks passed.');
