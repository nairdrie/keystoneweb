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
  'renderLogoImage',
  'pendingLogoSlots',
  'handleAddLogo',
  'Add Logo',
  'fallback={<LogoPlaceholder className={previewFrameClassName} />}',
  'function LogoPlaceholder',
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

requireSnippets('app/components/blocks/AboutImageTextBlock.tsx', [
  "import InlineCardControls, { reorderItems } from './InlineCardControls';",
  'normalizeImageFocalPoint(persistedImageSettings.objectPosition ?? data.imageFocalPoint)',
  'isImagePositionPercentToken(x)',
  'roundImagePositionPercent(Number(x.slice(0, -1)))',
  'enableInlineCropControls',
  'editorPreviewFrameClassName={`w-full ${aspectClass} ${mediaTreatmentClass}`}',
  'handleReorderItem(draggedIndex, sourceIndex);',
  'getActiveItemEntries(data, items)',
  'dragTitle="Drag to reorder about item"',
  'removeTitle="Delete about item"',
], failures);

requireSnippets('app/components/blocks/generic/GenericBlockSettingsPanel.tsx', [
  "const REPEATABLE_ITEMS_DRAFT_UPDATE_EVENT = 'ks:repeatable-items-draft-update';",
  'const DEFAULT_ABOUT_ITEMS = [',
  "const hasAboutItemsControl = blockType === 'aboutImageText';",
  "const ids: string[] = hasAboutItemsControl ? ['items', 'universal-layout'] : ['universal-layout'];",
  'title="Content: Items"',
  'function AboutItemsControl',
  'Drag to reorder about item',
  'Delete about item',
  "draft.items = normalizeAboutItems(blockData.items, blockData);",
  'getClearedAboutItemRemovedFlags(blockData || {})',
], failures);

requireSnippets('app/components/EditableImage.tsx', [
  'editorPreviewFrameClassName?: string;',
  'showInlineCropZoomControl?: boolean;',
  'inlineCropFrameClassName?: string;',
  'inlineCropImageClassName?: string;',
  'const editorFrameClassName = editorPreviewFrameClassName || className || undefined;',
  'const imageRadiusClassName = getImageRadiusClasses(className);',
  'frameClassName={cropFrameClassName}',
  'previewFrameClassName={editorFrameClassName}',
  'previewFrameSize={editorPreviewFrameSize}',
  'onFrameSizeChange={handleFrameSizeChange}',
  'showZoomControl={showInlineCropZoomControl}',
  'getInitialImageSettings(className, initialSettings)',
  'function getImageRadiusClasses(value: string): string',
], failures);

const editableImageSource = read('app/components/EditableImage.tsx');
if (editableImageSource.includes('stripImageRadiusClasses') || editableImageSource.includes('frameClassName={`rounded ${cropFrameClassName}`}')) {
  failures.push('app/components/EditableImage.tsx should preserve real image radius classes without adding or stripping rounded corners');
}

requireSnippets('app/components/ImageCropFrame.tsx', [
  'onFrameSizeChange?: (size: Size) => void;',
  'onFrameSizeChange?.(nextSize);',
  'const cropFrameTitle = interactive',
  'Use the slider to zoom.',
  'title={cropFrameTitle}',
], failures);

const imageCropFrameSource = read('app/components/ImageCropFrame.tsx');
if (imageCropFrameSource.includes("addEventListener('wheel'") || imageCropFrameSource.includes('Scroll to zoom')) {
  failures.push('app/components/ImageCropFrame.tsx should not support scroll-to-zoom');
}

requireSnippets('app/components/ImageEditorModal.tsx', [
  'previewFrameClassName?: string;',
  'previewFrameSize?: ImageFrameSize;',
  "previewFrameClassName = 'h-56 w-full'",
  'const scaledPreviewFrame = getScaledPreviewFrame(previewFrameClassName, previewFrameSize);',
  'const modalPreviewFrameClassName = `${scaledPreviewFrame.className} mx-auto`.trim();',
  'frameClassName={modalPreviewFrameClassName}',
  'aspectRatio: `${roundPixel(scaled.width)} / ${roundPixel(scaled.height)}`',
  'function getScaledPreviewFrame(sourceClassName: string, measuredSize?: ImageFrameSize): ScaledPreviewFrame',
  'const measuredWidth = measuredSize && measuredSize.width > 0 ? measuredSize.width : undefined;',
], failures);

const imageEditorModalSource = read('app/components/ImageEditorModal.tsx');
if (imageEditorModalSource.includes('rounded-lg border border-slate-200 bg-slate-100 p-3')) {
  failures.push('app/components/ImageEditorModal.tsx should not add a gray box behind image previews');
}

requireSnippets('app/components/blocks/CarouselBlock.tsx', [
  'enableInlineCropControls',
  "editorPreviewFrameClassName={`w-full ${isCircleMediaCard ? 'aspect-square' : isSplitMediaCard ? 'min-h-56 md:min-h-full' : mediaAspectClass}`}",
  "editorPreviewFrameClassName={isFullBleedMediaCard ? 'h-full min-h-[280px] w-full md:min-h-[420px]' : `w-full ${isCircleMediaCard ? 'aspect-square' : mediaAspectClass}`}",
  'editorPreviewFrameClassName={minimalMediaFrameClass}',
], failures);

requireSnippets('app/components/blocks/FeaturedQuoteBlock.tsx', [
  'enableInlineCropControls',
  'showInlineCropZoomControl={false}',
  'editorPreviewFrameClassName="w-full aspect-[3/4]"',
  'editorPreviewFrameClassName="w-16 h-16 rounded-full"',
  'editorPreviewFrameClassName="w-full min-h-64"',
  'editorPreviewFrameClassName="w-20 h-20 rounded-full"',
  'editorPreviewFrameClassName="w-10 h-10 rounded-full"',
  'updateContent(key, value);',
], failures);

requireSnippets('app/components/blocks/GalleryBlock.tsx', [
  'enableInlineCropControls',
  'editorPreviewFrameClassName={`w-full ${imageAspectClass}`}',
  'e.dataTransfer.setData(\'text/plain\', `gallery-image-${index}`)',
], failures);

requireSnippets('app/components/blocks/HeroBlock.tsx', [
  'enableInlineCropControls',
  'editorPreviewFrameClassName={imagePreviewFrameClass}',
], failures);

requireSnippets('app/components/blocks/ImageBlock.tsx', [
  'enableInlineCropControls',
  'editorPreviewFrameClassName="w-full min-h-[300px]"',
], failures);

requireSnippets('app/components/blocks/LogoCloudBlock.tsx', [
  'enableInlineCropControls',
  'showInlineCropZoomControl={false}',
  'inlineCropFrameClassName="h-full w-full object-contain"',
  'ks-layout-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8',
  'flex w-[200%] items-center animate-marquee',
  'flex w-1/2 items-center justify-center gap-16',
  'editorPreviewFrameClassName={previewFrameClassName}',
  "previewFrameClassName: 'h-12 w-40 max-w-full'",
  "previewFrameClassName: 'h-10 w-36 max-w-full'",
], failures);

const logoCloudSource = read('app/components/blocks/LogoCloudBlock.tsx');
if (logoCloudSource.includes('Math.max(logos.length + 1, 6)')) {
  failures.push('app/components/blocks/LogoCloudBlock.tsx should use an Add Logo button instead of fixed empty logo slots');
}
if (logoCloudSource.includes('[...logos, ...logos].map')) {
  failures.push('app/components/blocks/LogoCloudBlock.tsx should keep marquee duplicate logos offscreen at the centered starting position');
}

requireSnippets('app/components/blocks/TeamBlock.tsx', [
  'enableInlineCropControls',
  'showInlineCropZoomControl={false}',
  'editorPreviewFrameClassName="h-16 w-16 rounded-full"',
  'editorPreviewFrameClassName="h-64 w-full"',
  'editorPreviewFrameClassName="h-32 w-32 rounded-full"',
  'else updateContent(key, value);',
], failures);

requireSnippets('app/components/blocks/hero/HeroSettingsPanel.tsx', [
  'const imagePickerPreviewFrameClassName = imageEditorOpen === \'foreground\'',
  'previewFrameClassName={imagePickerPreviewFrameClassName}',
], failures);

requireSnippets('app/components/blocks/sideBySide/SideBySideSettingsPanel.tsx', [
  'overrideChildBackgrounds: boolean;',
  'Override inner block backgrounds',
  "updates.overrideChildBackgrounds = draft.overrideChildBackgrounds;",
], failures);

requireSnippets('app/components/blocks/SideBySideBlock.tsx', [
  'const overrideChildBackgrounds = Boolean(data?.overrideChildBackgrounds);',
  'data-side-by-side-id={id}',
  'background-color: var(--side-by-side-child-bg) !important;',
], failures);

[
  ['app/components/blocks/AboutImageTextBlock.tsx', 'rounded-lg shadow-xl object-cover'],
  ['app/components/blocks/AboutImageTextBlock.tsx', 'editorPreviewFrameClassName={`w-full ${aspectClass} rounded-lg`}'],
  ['app/components/blocks/ImageBlock.tsx', 'object-cover rounded-xl shadow-md'],
  ['app/components/blocks/ImageBlock.tsx', 'editorPreviewFrameClassName="w-full min-h-[300px] rounded-xl"'],
  ['app/components/blocks/HeroBlock.tsx', 'object-cover rounded-2xl shadow-xl'],
  ['app/components/blocks/HeroBlock.tsx', 'editorPreviewFrameClassName="w-full h-96 rounded-2xl"'],
  ['app/components/blocks/hero/HeroSettingsPanel.tsx', "'w-full h-96 rounded-2xl'"],
  ['app/components/blocks/hero/HeroSettingsPanel.tsx', "'w-full min-h-[360px] rounded-xl'"],
  ['app/components/blocks/GalleryBlock.tsx', 'aspect-square object-cover rounded-xl'],
  ['app/components/blocks/GalleryBlock.tsx', 'editorPreviewFrameClassName="w-full aspect-square rounded-xl"'],
  ['app/components/blocks/CarouselBlock.tsx', 'h-44 object-cover rounded-xl'],
  ['app/components/blocks/CarouselBlock.tsx', 'h-44 rounded-xl bg-slate-100'],
  ['app/components/blocks/CarouselBlock.tsx', 'overflow-hidden rounded-3xl shadow-lg'],
  ['app/components/blocks/CarouselBlock.tsx', 'w-48 h-48 object-cover rounded-2xl'],
  ['app/components/blocks/CarouselBlock.tsx', 'editorPreviewFrameClassName="w-48 h-48 rounded-2xl mx-auto"'],
  ['app/components/blocks/FeaturedQuoteBlock.tsx', 'aspect-[3/4] object-cover rounded-2xl'],
  ['app/components/blocks/FeaturedQuoteBlock.tsx', 'editorPreviewFrameClassName="w-full aspect-[3/4] rounded-2xl"'],
  ['app/components/blocks/FeaturedQuoteBlock.tsx', 'object-cover rounded-2xl min-h-64'],
  ['app/components/blocks/FeaturedQuoteBlock.tsx', 'editorPreviewFrameClassName="w-full min-h-64 rounded-2xl"'],
].forEach(([file, snippet]) => {
  if (read(file).includes(snippet)) {
    failures.push(`${file} should keep default rectangular image boxes square: remove "${snippet}"`);
  }
});

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
], failures);

requireSnippets('app/components/blocks/HeroBlock.tsx', [
  'updateContent?: (key: string, value: unknown) => void;',
  'const cardsRef = useRef<HeroCard[]>(cards);',
  'const next = cardsRef.current.map((c, i) => {',
  "if (updateContent) updateContent('cards', next);",
  "const nextUrl = String(value ?? '');",
  'nc.content.image.enabled = true;',
  "hero-content ${imageOnRight || !showForeground ? 'order-1' : 'order-2'}",
  "const imageColumnClass = splitScreen",
], failures);

requireSnippets('app/components/blocks/BlockWrapperEditor.tsx', [
  "const HERO_DRAFT_UPDATE_EVENT = 'ks:hero-draft-update';",
  "settingsOpen && usesPanel && type === 'hero' && key === 'cards'",
  'window.dispatchEvent(new CustomEvent(HERO_DRAFT_UPDATE_EVENT',
  "const CONTACT_DRAFT_UPDATE_EVENT = 'ks:contact-draft-update';",
  "settingsOpen && usesPanel && type === 'contact' && isContactDraftKey(key)",
  'window.dispatchEvent(new CustomEvent(CONTACT_DRAFT_UPDATE_EVENT',
  "return key === 'contactItems' || key === 'socialLinks';",
  "import { Children, ReactNode, cloneElement",
  "Children.map(children.props.children",
  "if ('value' in children.props)",
  "value: data,",
  "type === 'timeline' || type === 'aboutImageText'",
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
