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

requireSnippets('lib/estimate-quote.ts', [
  'export function normalizeEstimateQuoteSettings',
  'export function calculateQuote',
  'basePriceCents',
  'triggeredRuleIds',
  'inactiveRuleIds',
  'rangeSpread',
  'Deposit payment settings are saved, but quote checkout is not connected yet.',
  'CRM tags are saved, but no CRM tagging integration is connected yet.',
  'function evaluateCondition',
]);

requireSnippets('app/components/blocks/EstimateFormBlock.tsx', [
  'normalizeEstimateQuoteSettings(data)',
  'calculateQuote(settings, quoteValues)',
  'captureTracking(settings)',
  'quoteResult',
  'triggeredRuleIds',
  'inactiveRuleIds',
  "source_type: 'estimate_form'",
  'preferredDate: contactInfo.preferredDate || undefined',
]);

requireSnippets('app/components/blocks/estimate/EstimateQuoteSettingsPanel.tsx', [
  "type EditorMode = 'simple' | 'advanced'",
  'Simple Mode',
  'Advanced Pricing',
  'Live Quote Preview',
  'Add Pricing Rule',
  'Quote checkout is not connected yet',
  'CRM tag controls are disabled',
  'onDraftBlockDataChange(buildPreviewBlockData',
]);

requireSnippets('app/components/blocks/block-panel-registry.tsx', [
  "import('./estimate/EstimateQuoteSettingsPanel')",
  'component: EstimateQuoteSettingsPanel',
]);

requireSnippets('app/api/contact/route.ts', [
  'calculateQuote(settings, quoteValues)',
  'findEstimateBlockData',
  'serverCalculated: true',
  'quoteResult',
  'tracking',
  'sendEstimateQuoteCustomerConfirmation',
  'Contact details:',
  'contact.preferredDate',
]);

requireSnippets('lib/email.ts', [
  'buildEstimateQuoteOwnerSummaryHtml',
  'sendEstimateQuoteCustomerConfirmation',
  'Triggered pricing rules',
  'Attribution',
  'Validated server-side',
]);

requireSnippets('app/components/email/EmailClient.tsx', [
  'QuoteMetadataPanel',
  "m.source_type === 'estimate_form'",
  'Server validated',
  'Triggered rules',
  'Attribution',
]);

if (failures.length > 0) {
  console.error('Estimate quote checks failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Estimate quote checks passed.');
