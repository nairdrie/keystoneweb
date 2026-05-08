import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function requireSnippets(file, snippets) {
  const source = read(file);
  for (const snippet of snippets) {
    if (!source.includes(snippet)) {
      failures.push(`${file} missing: ${snippet}`);
    }
  }
}

requireSnippets('lib/builder/layout-settings.ts', [
  'export type ResponsiveValue<T>',
  'export type ResponsiveBoxValue',
  'export type SectionSettings',
  'export type LayoutCapabilities',
  'export const DEFAULT_LAYOUT_SETTINGS',
  'export const DEFAULT_LAYOUT_COLUMN_MAX',
  'export function getLayoutCapabilities',
  'export function getLayoutColumnLimit',
  'export function normalizeSectionSettings',
  'export function areSectionSettingsEqual',
  'export function buildLayoutCss',
  "if (!hasLayoutOverrides(sectionSettings)) return '';",
  '.ks-layout-content',
  'const COLUMN_BLOCKS = new Set',
  'const GAP_BLOCKS = new Set',
  'function makeColumnCapabilities',
  'function makeGapCapabilities',
  'featuresList: makeGapCapabilities()',
  'faq: makeGapCapabilities()',
  'tabBar: makeCapabilities()',
  'sanitizeCssSize',
  'Math.min(normalizeColumnLimit(maxColumns), Math.max(1, Math.round(value)))',
]);

requireSnippets('app/components/blocks/layout/LayoutTab.tsx', [
  'export function LayoutTab',
  'export function ContainerWidthControl',
  'LAYOUT_GUIDE_PREVIEW_EVENT',
  'onPreview={(containerWidth, active) => dispatchLayoutGuidePreview',
  'export function AlignmentControl',
  'export function ResponsiveColumnsControl',
  'export function ResponsiveGapControl',
  'export function ResponsiveSpacingControl',
  'AdvancedLayoutDisclosure',
  'CollapsibleLayoutSection',
  'type="range"',
  'showLabel={false}',
  'Reset all',
  'aria-label={`Reset ${title.toLowerCase()} to default`}',
  'handleSummaryButtonClick',
  'Advanced layout',
  'getLayoutCapabilities(blockType)',
  'maxColumns = COLUMN_SLIDER_MAX',
  'Limited to {effectiveMaxColumns}',
]);

requireSnippets('app/components/blocks/RepeatableItemsSettingsPanel.tsx', [
  'ResponsiveColumnsControl',
  'hasColumnLayoutControl',
  "id=\"block-layout\"",
  'onChange={(columns) => updateSectionLayout({ columns })}',
  'maxColumns={items.length}',
]);

requireSnippets('app/components/blocks/generic/GenericBlockSettingsPanel.tsx', [
  'ResponsiveColumnsControl',
  'visibleDisplayControls',
  'hasColumnLayoutControl',
  'getLayoutColumnLimit',
  "control.key !== 'columns'",
  "id=\"block-layout\"",
  'onChange={(columns) => updateSectionLayout({ columns })}',
  'maxColumns={maxColumnCount}',
]);

requireSnippets('app/components/blocks/product/ProductSettingsPanel.tsx', [
  'ResponsiveColumnsControl',
  "id=\"block-layout\"",
  'onChange={(columns) => updateSectionLayout({ columns })}',
]);

requireSnippets('app/components/blocks/menu/MenuSettingsPanel.tsx', [
  'ResponsiveColumnsControl',
  "id=\"block-layout\"",
  'onChange={(columns) => updateSectionLayout({ columns })}',
]);

for (const [file, removedSnippets] of Object.entries({
  'lib/builder/layout-settings.ts': [
    'supportsVerticalAlign',
    'supportsMinHeight',
    'supportsContentOrder',
    'verticalJustify',
    'contentOrderRules',
  ],
  'app/components/blocks/layout/LayoutTab.tsx': [
    'VerticalAlignmentControl',
    'ResponsiveSizeControl',
    'ContentOrderControl',
    'Section minimum height',
    'Vertical alignment',
    'Content order',
  ],
  'app/components/blocks/HeroBlock.tsx': [
    'ks-layout-vertical',
    'ks-layout-order',
  ],
  'app/components/blocks/hero/HeroSettingsPanel.tsx': [
    'normalizeHeroSectionSettings',
  ],
})) {
  const source = read(file);
  for (const snippet of removedSnippets) {
    if (source.includes(snippet)) failures.push(`${file} should no longer include removed layout setting: ${snippet}`);
  }
}

if (read('lib/builder/layout-settings.ts').includes('text-align:')) {
  failures.push('Universal horizontal layout alignment should not cascade text-align into card/content internals');
}

requireSnippets('app/components/blocks/BlockWrapper.tsx', [
  "import { buildLayoutCss } from '@/lib/builder/layout-settings';",
  'const layoutCss = buildLayoutCss(id, type, props.data?.sectionSettings, props.data);',
  "const combinedCss = [scopedCss, layoutCss].filter(Boolean).join('\\n');",
]);

requireSnippets('app/components/blocks/BlockWrapperEditor.tsx', [
  'buildLayoutCss',
  'const previewLayoutCss = buildLayoutCss(id, type, previewData?.sectionSettings, previewData);',
  'LAYOUT_GUIDE_PREVIEW_EVENT',
  'handleLayoutGuidePreview',
  'ks-container-width-guide',
]);

requireSnippets('app/components/blocks/HeroBlock.tsx', [
  'ks-layout-content',
]);

requireSnippets('lib/ai/block-capabilities.ts', [
  "const UNIVERSAL_ALLOWED_TOP_LEVEL_KEYS = ['sectionSettings'] as const;",
  'for (const key of UNIVERSAL_ALLOWED_TOP_LEVEL_KEYS) keys.add(key);',
]);

for (const file of [
  'app/components/blocks/generic/GenericBlockSettingsPanel.tsx',
  'app/components/blocks/RepeatableItemsSettingsPanel.tsx',
  'app/components/blocks/product/ProductSettingsPanel.tsx',
  'app/components/blocks/hero/HeroSettingsPanel.tsx',
  'app/components/blocks/contact/ContactSettingsPanel.tsx',
  'app/components/blocks/map/MapSettingsPanel.tsx',
  'app/components/blocks/menu/MenuSettingsPanel.tsx',
]) {
  requireSnippets(file, [
    'LayoutTab',
    'sectionSettings',
    'universal-layout',
    'areSectionSettingsEqual',
  ]);
}

const registry = read('app/components/blocks/block-panel-registry.tsx');
for (const type of ['estimateForm', 'membershipGate']) {
  const entryIndex = registry.indexOf(`${type}: {`);
  if (entryIndex === -1) {
    failures.push(`block-panel-registry.tsx missing ${type} panel entry`);
  }
}
if (registry.includes('hideSettingsButton: true')) {
  failures.push('block-panel-registry.tsx still hides a settings button, which can make the universal Layout tab unreachable');
}

const availableBlocks = Array.from(read('app/components/blocks/block-registry.ts').matchAll(/type:\s*'([^']+)'/g))
  .map((match) => match[1])
  .filter((type) => type !== 'chatSupport');
const capabilitySource = read('lib/builder/layout-settings.ts');
for (const type of [...availableBlocks, 'membershipGate']) {
  if (!capabilitySource.includes(`${type}:`) && !capabilitySource.includes(`'${type}'`)) {
    failures.push(`layout capabilities should mention block type: ${type}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Layout settings regression checks passed.');
