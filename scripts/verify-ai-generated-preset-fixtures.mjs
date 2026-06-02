import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function extractConstStringArray(source, name) {
  const match = source.match(new RegExp(`(?:export\\s+)?const ${name} = \\[([\\s\\S]*?)\\] as const;`));
  if (!match) return [];
  return Array.from(match[1].matchAll(/'([^']+)'/g)).map((m) => m[1]);
}

function extractCardPresetIds(source) {
  const match = source.match(/export const CARD_STYLE_DEFINITIONS = \[([\s\S]*?)\] as const;/);
  if (!match) return [];
  return Array.from(match[1].matchAll(/id:\s*'([^']+)'/g)).map((m) => m[1]);
}

function capabilitySegment(source, blockType) {
  const start = source.indexOf(`type: '${blockType}'`);
  if (start === -1) return '';
  const next = source.indexOf("\n  {\n    type: '", start + 1);
  return source.slice(start, next === -1 ? source.indexOf('\n];', start) : next);
}

function fieldDefault(segment, fieldName, fallback) {
  const match = segment.match(new RegExp(`name:\\s*'${fieldName}'[\\s\\S]*?defaultValue:\\s*'([^']+)'`));
  return match?.[1] ?? fallback;
}

const capabilitySource = read('lib/ai/block-capabilities.ts');
const blockStyleOptionsSource = read('lib/block-style-options.ts');
const fixture = readJson('scripts/fixtures/ai-generated-card-presets.json');

const optionSets = {
  cardStyle: extractCardPresetIds(blockStyleOptionsSource),
  surfaceStyle: extractConstStringArray(capabilitySource, 'AI_SURFACE_STYLE_VALUE_SET'),
  spacingDensity: extractConstStringArray(blockStyleOptionsSource, 'SPACING_DENSITY_OPTIONS'),
  markerStyle: extractConstStringArray(blockStyleOptionsSource, 'MARKER_STYLE_OPTIONS'),
  iconStyle: extractConstStringArray(blockStyleOptionsSource, 'ICON_STYLE_OPTIONS'),
  mediaAspect: extractConstStringArray(blockStyleOptionsSource, 'MEDIA_ASPECT_OPTIONS'),
  mediaTreatment: extractConstStringArray(blockStyleOptionsSource, 'MEDIA_TREATMENT_OPTIONS'),
  textAlign: extractConstStringArray(blockStyleOptionsSource, 'TEXT_ALIGN_OPTIONS'),
  frameStyle: extractConstStringArray(blockStyleOptionsSource, 'GALLERY_FRAME_OPTIONS'),
};

const genericFallbacks = {
  cardStyle: 'soft',
  surfaceStyle: 'white',
  spacingDensity: 'standard',
  markerStyle: 'numbered',
  iconStyle: 'badge',
  mediaAspect: 'landscape',
  mediaTreatment: 'contained',
  textAlign: 'left',
  frameStyle: 'clean',
};

const failures = [];

if (!capabilitySource.includes('normalizeAiPresetFields(blockType, data)')) {
  failures.push('sanitizeAiBlockData must call normalizeAiPresetFields before persistence');
}
if (!capabilitySource.includes('readCardSettings(data.cardSettings)') || !capabilitySource.includes('delete data.cardSettings')) {
  failures.push('AI cardSettings sanitizer must normalize valid objects and remove invalid cardSettings values');
}

for (const [fieldName, options] of Object.entries(optionSets)) {
  if (options.length === 0) {
    failures.push(`Could not read option set for ${fieldName}`);
  }
}

for (const block of fixture.blocks ?? []) {
  const blockType = block.blockType;
  const segment = capabilitySegment(capabilitySource, blockType);
  if (!segment) {
    failures.push(`Fixture block ${blockType} is missing AI block capabilities`);
    continue;
  }

  for (const [fieldName, expectedValue] of Object.entries(block.expectedSanitized ?? {})) {
    if (!segment.includes(`name: '${fieldName}'`)) {
      failures.push(`Fixture block ${blockType} expects ${fieldName}, but the capability schema does not expose it`);
      continue;
    }

    const options = optionSets[fieldName];
    if (!options) {
      failures.push(`Fixture field ${fieldName} has no verifier option set`);
      continue;
    }

    const rawValue = block.data?.[fieldName];
    const fallback = fieldDefault(segment, fieldName, genericFallbacks[fieldName]);
    const sanitized = typeof rawValue === 'string' && options.includes(rawValue.trim())
      ? rawValue.trim()
      : fallback;

    if (sanitized !== expectedValue) {
      failures.push(`Fixture ${blockType}.${fieldName}: expected ${expectedValue}, got ${sanitized}`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`AI generated preset fixture check passed (${fixture.blocks.length} blocks).`);
