import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const repoRoot = process.cwd();
const registryPath = path.join(repoRoot, 'app/components/blocks/settings/registry.ts');
const source = fs.readFileSync(registryPath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
  fileName: registryPath,
});

const sandbox = {
  exports: {},
  module: { exports: {} },
};
sandbox.exports = sandbox.module.exports;
vm.runInNewContext(compiled.outputText, sandbox, { filename: registryPath });

const {
  BLOCK_SETTINGS_SCHEMAS,
  SCHEMA_REGISTERED_BLOCK_TYPES,
} = sandbox.module.exports;

const canonicalSections = ['content', 'layout', 'display', 'style', 'integrations', 'advanced'];
const fieldControlKinds = new Set([
  'toggle',
  'select',
  'segmented',
  'range',
  'number',
  'text',
  'url',
  'textarea',
  'color',
]);

const errors = [];

if (!BLOCK_SETTINGS_SCHEMAS || typeof BLOCK_SETTINGS_SCHEMAS !== 'object') {
  errors.push('BLOCK_SETTINGS_SCHEMAS must export an object.');
}

if (!Array.isArray(SCHEMA_REGISTERED_BLOCK_TYPES)) {
  errors.push('SCHEMA_REGISTERED_BLOCK_TYPES must export an array.');
}

for (const blockType of SCHEMA_REGISTERED_BLOCK_TYPES || []) {
  if (!BLOCK_SETTINGS_SCHEMAS?.[blockType]) {
    errors.push(`Missing settings schema for registered block "${blockType}".`);
  }
}

for (const [blockType, schema] of Object.entries(BLOCK_SETTINGS_SCHEMAS || {})) {
  if (!schema || typeof schema !== 'object') {
    errors.push(`${blockType}: schema must be an object.`);
    continue;
  }

  if (schema.blockType !== blockType) {
    errors.push(`${blockType}: schema.blockType must match its registry key.`);
  }

  if (!Array.isArray(schema.sections) || schema.sections.length === 0) {
    errors.push(`${blockType}: schema must include at least one section.`);
    continue;
  }

  let previousSectionIndex = -1;
  const seenFields = new Set();

  for (const section of schema.sections) {
    if (!canonicalSections.includes(section.id)) {
      errors.push(`${blockType}: section "${section.id}" is not canonical.`);
    }

    const sectionIndex = canonicalSections.indexOf(section.id);
    if (sectionIndex < previousSectionIndex) {
      errors.push(`${blockType}: section "${section.id}" is out of canonical order.`);
    }
    previousSectionIndex = Math.max(previousSectionIndex, sectionIndex);

    if (!Array.isArray(section.controls) || section.controls.length === 0) {
      errors.push(`${blockType}: section "${section.id}" must include controls.`);
      continue;
    }

    for (const control of section.controls) {
      if (!control.id || !control.kind) {
        errors.push(`${blockType}: every control must include id and kind.`);
        continue;
      }

      if (fieldControlKinds.has(control.kind)) {
        if (!control.field) {
          errors.push(`${blockType}: ${control.id} (${control.kind}) must include a field.`);
        } else if (seenFields.has(control.field)) {
          errors.push(`${blockType}: field "${control.field}" is written by multiple schema controls.`);
        } else {
          seenFields.add(control.field);
        }
      }

      if (control.kind === 'custom' && !control.renderKey) {
        errors.push(`${blockType}: custom control "${control.id}" must include renderKey.`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error('Settings schema verification failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Verified ${Object.keys(BLOCK_SETTINGS_SCHEMAS).length} block settings schemas.`);
