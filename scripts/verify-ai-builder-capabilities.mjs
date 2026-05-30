import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function extractStringArray(source, name) {
  const match = source.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const;`));
  if (!match) {
    throw new Error(`Could not find ${name}`);
  }
  return Array.from(match[1].matchAll(/'([^']+)'/g)).map((m) => m[1]);
}

const capabilitySource = read('lib/ai/block-capabilities.ts');
const sampleDataSource = read('lib/ai/sample-data.ts');
const templateProfileSource = read('lib/templates/template-style-profiles.ts');
const structuralTemplateSource = read('lib/templates/structural-templates.ts');
const existingBlocksSource = read('lib/builder/existing-blocks.ts');
const siteArchitectureSource = read('lib/ai/site-architecture.ts');
const templatePersonalizationSource = read('lib/templates/template-content-personalization.ts');
const registrySource = read('app/components/blocks/block-registry.ts');
const rendererSource = read('app/components/blocks/BlockRenderer.tsx');
const aiBuilderRouteSource = read('app/api/ai/builder/route.ts');
const siteCreateRouteSource = read('app/api/sites/route.ts');

const supported = extractStringArray(capabilitySource, 'AI_SUPPORTED_BLOCK_TYPES');
const disabled = extractStringArray(capabilitySource, 'AI_INTENTIONALLY_DISABLED_BLOCK_TYPES');
const capabilityTypes = Array.from(capabilitySource.matchAll(/^\s+type: '([^']+)',/gm)).map((m) => m[1]);
const registered = Array.from(registrySource.matchAll(/\{\s*type:\s*'([^']+)'/g)).map((m) => m[1]);

if (/type:\s*'membershipGate'/.test(rendererSource)) {
  registered.push('membershipGate');
}

const registeredSet = new Set(registered);
const covered = new Set([...supported, ...disabled]);
const missingCoverage = registered.filter((type) => !covered.has(type));
const unknownSupported = supported.filter((type) => !registeredSet.has(type));
const supportedWithoutCapabilities = supported.filter((type) => !capabilityTypes.includes(type));
const capabilitiesNotSupported = capabilityTypes.filter((type) => !supported.includes(type));

const requiredCapabilitySnippets = [
  'menuTitle',
  'menuSubtitle',
  'showMenuIconLegend',
  'itemDetailImageFit',
  'cards[].content.title',
  'cards[].background.type',
  'transition',
  'height',
  'logoPosition',
  'desktopMenuStyle',
  'showProductSearch',
  'showLightboxNav',
  'featuredOnly',
  'showPreferredDate',
  'sanitizeAiBlockData',
  'filterAiBlockDataToAllowedSettings',
  'sanitizeAiCustomColors',
  'SAFE_LIGHT_SECTION_BACKGROUND',
  'AI_DISALLOWED_CUSTOM_CSS_KEYS',
  'AI-generated block/header Custom CSS is disabled',
  'cardStyle',
  'surfaceStyle',
  'spacingDensity',
  'iconStyle',
  'splitMedia',
  'mediaAspect',
  'mediaTreatment',
  'frameStyle',
  'stripAiHtmlCss',
  'delete obj[key]',
  'return !key || !AI_DISALLOWED_CUSTOM_CSS_KEYS.has(key)',
  "return '';",
  'The sanitizer drops any data key',
];

const missingSnippets = requiredCapabilitySnippets.filter((snippet) => !capabilitySource.includes(snippet));
const requiredSampleDataSnippets = [
  'sanitizeAiSampleDataPayload',
  'productSamplesFor',
  'menuSamplesFor',
  'bookingServiceSamplesFor',
  'sampleImagesFor',
  'enrichHeroWithSampleMedia',
  'bookingServices',
];
const missingSampleDataSnippets = requiredSampleDataSnippets.filter((snippet) => !sampleDataSource.includes(snippet));
const requiredTemplateProfileSnippets = [
  'TEMPLATE_STYLE_PROFILE_IDS',
  'renderTemplateStyleProfilesForAi',
  'recommendTemplateStyleProfileIds',
  'STYLE-ONLY',
  'setCustomColors',
  'setHeaderConfig',
  'luxe',
  'vivid',
  'airy',
  'edge',
  'classic',
  'organic',
  'sleek',
  'vibrant',
  'atlas',
  'editorial',
  'booked',
  'menu',
  'craft',
  'retro',
  'proof',
  'gallery',
];
const missingTemplateProfileSnippets = requiredTemplateProfileSnippets.filter((snippet) => !templateProfileSource.includes(snippet));
const requiredStructuralTemplateSnippets = [
  'desktop: { mode, valuePx, revealNext }',
  "itemDetailPhotoVisibility: 'menu'",
  "showMenuIconLegend: true",
  "cardStyle: 'offset'",
  "frameStyle: 'gapless'",
];
const missingStructuralTemplateSnippets = requiredStructuralTemplateSnippets.filter((snippet) => !structuralTemplateSource.includes(snippet));
const requiredExistingBlockSnippets = [
  'KEYSTONE_ALLOWED_BLOCK_DISPLAY_NAMES',
  'resolveBuilderBlock',
  "'Services Grid'",
  "internalType: 'menu'",
  "internalType: 'estimateForm'",
  "displayName: 'Membership Gate'",
];
const missingExistingBlockSnippets = requiredExistingBlockSnippets.filter((snippet) => !existingBlocksSource.includes(snippet));
const requiredArchitectureSnippets = [
  'buildSiteArchitecture',
  'renderArchitectureForAi',
  'buildFallbackBlocksForArchitecture',
  'Pages are made from blocks. Blocks are not pages.',
  'Forbidden block types for this industry',
  "block('Menu'",
  "block('Services Grid'",
  "block('Estimate / Quote Form'",
  "block('Delivery App Links'",
  'FOOD_CATEGORIES',
  'TRADE_CATEGORIES',
  'compactArchitecturePage',
  'architectureBlockFamily',
];
const missingArchitectureSnippets = requiredArchitectureSnippets.filter((snippet) => !siteArchitectureSource.includes(snippet));
const requiredBuilderPromptSnippets = [
  'styleProfileIds',
  'logPlan(plan',
  'styleNames=',
  'recommendTemplateStyleProfileIds',
  'booking services',
  'Do not output custom CSS',
  'buildSiteArchitecture',
  'fitBlocksToArchitecture',
  'plan.homeArchitecture',
  'architecture fallback',
];
const builderSchemaAndOrchestratorSource = read('lib/ai/builder-schema.ts') + read('lib/ai/builder-orchestrator.ts');
const missingBuilderPromptSnippets = requiredBuilderPromptSnippets.filter((snippet) => !builderSchemaAndOrchestratorSource.includes(snippet));
const requiredTemplatePersonalizationSnippets = [
  'buildSiteArchitecture',
  'buildArchitectureBlocks',
  'architecture.pages.map',
  'pickTemplateStyleData',
  'TEMPLATE_STYLE_FIELDS',
  'sanitizeHeroCardStyle',
  'sampleImagesForCategory',
  'Creative Work With a Clear Strategy',
  'seedTemplateAdminContent',
];
const missingTemplatePersonalizationSnippets = requiredTemplatePersonalizationSnippets.filter((snippet) => !templatePersonalizationSource.includes(snippet) && !read('lib/templates/admin-seed-data.ts').includes(snippet));
const requiredTemplateCreationSnippets = [
  'shouldApplyTemplateArchitecture',
  "selectedTemplateId !== 'custom_ai'",
  'personalizeTemplateContentForCategory(baseDefaultContent',
];
const missingTemplateCreationSnippets = requiredTemplateCreationSnippets.filter((snippet) => !siteCreateRouteSource.includes(snippet));
const requiredRouteSanitizerSnippets = [
  '<style[\\s\\S]*?<\\/style>',
  '\\sstyle\\s*=',
  '@import\\s+',
];
const missingRouteSanitizerSnippets = requiredRouteSanitizerSnippets.filter((snippet) => !aiBuilderRouteSource.includes(snippet));
const forbiddenBuilderPromptSnippets = [
  'For NEW SITE BUILDS, add 2-4 small "__customCss"',
  '1-3 small "__customCss"',
  'Use __customCss BEFORE custom_html',
  'except "__customCss"',
  'CSS treatment family:',
  'CSS treatment:',
  '"headerCustomCss": "<header-only CSS>"',
  'customCss:',
  "__customCss: '",
];
const presentForbiddenBuilderPromptSnippets = forbiddenBuilderPromptSnippets.filter((snippet) => builderSchemaAndOrchestratorSource.includes(snippet) || capabilitySource.includes(snippet) || templateProfileSource.includes(snippet));

const failures = [];
if (missingCoverage.length > 0) {
  failures.push(`Addable blocks missing AI support/disable decision: ${missingCoverage.join(', ')}`);
}
if (unknownSupported.length > 0) {
  failures.push(`AI-supported blocks not present in block registry: ${unknownSupported.join(', ')}`);
}
if (supportedWithoutCapabilities.length > 0) {
  failures.push(`AI-supported blocks missing capability docs: ${supportedWithoutCapabilities.join(', ')}`);
}
if (capabilitiesNotSupported.length > 0) {
  failures.push(`Capability docs not included in AI-supported list: ${capabilitiesNotSupported.join(', ')}`);
}
if (missingSnippets.length > 0) {
  failures.push(`Critical AI capability snippets missing: ${missingSnippets.join(', ')}`);
}
if (missingSampleDataSnippets.length > 0) {
  failures.push(`Critical AI sample data snippets missing: ${missingSampleDataSnippets.join(', ')}`);
}
if (missingTemplateProfileSnippets.length > 0) {
  failures.push(`Critical template style profile snippets missing: ${missingTemplateProfileSnippets.join(', ')}`);
}
if (missingStructuralTemplateSnippets.length > 0) {
  failures.push(`Critical structural template readiness snippets missing: ${missingStructuralTemplateSnippets.join(', ')}`);
}
if (missingExistingBlockSnippets.length > 0) {
  failures.push(`Critical existing block registry adapter snippets missing: ${missingExistingBlockSnippets.join(', ')}`);
}
if (missingArchitectureSnippets.length > 0) {
  failures.push(`Critical deterministic site architecture snippets missing: ${missingArchitectureSnippets.join(', ')}`);
}
if (missingBuilderPromptSnippets.length > 0) {
  failures.push(`Critical AI style visibility snippets missing: ${missingBuilderPromptSnippets.join(', ')}`);
}
if (missingTemplatePersonalizationSnippets.length > 0) {
  failures.push(`Critical template personalization architecture snippets missing: ${missingTemplatePersonalizationSnippets.join(', ')}`);
}
if (missingTemplateCreationSnippets.length > 0) {
  failures.push(`Critical template creation architecture snippets missing: ${missingTemplateCreationSnippets.join(', ')}`);
}
if (missingRouteSanitizerSnippets.length > 0) {
  failures.push(`Critical AI route CSS sanitizer snippets missing: ${missingRouteSanitizerSnippets.join(', ')}`);
}
if (presentForbiddenBuilderPromptSnippets.length > 0) {
  failures.push(`Forbidden AI custom-CSS prompt snippets still present: ${presentForbiddenBuilderPromptSnippets.join(', ')}`);
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`AI builder capability check passed (${supported.length} supported, ${disabled.length} intentionally disabled).`);
