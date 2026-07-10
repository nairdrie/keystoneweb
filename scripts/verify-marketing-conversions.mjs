/**
 * Verifies lib/marketing/conversions.ts — the pure conversion-tracking helpers
 * (id normalization, send_to building, event-snippet label parsing). Runs the
 * real TypeScript via Node type stripping.
 *
 * Run: node scripts/verify-marketing-conversions.mjs
 */

import path from 'node:path';

const root = process.cwd();
const failures = [];
const check = (name, cond, detail) => { if (!cond) failures.push(`${name}${detail ? `: ${detail}` : ''}`); };

const mod = await import(path.join(root, 'lib/marketing/conversions.ts'));
const {
  normalizeConversionId, buildSendTo, parseConversionLabelFromSnippet,
  isConversionTrackingActive, CONVERSION_ACTION_SPECS, CONVERSION_EVENT_TYPES,
} = mod;

// ── normalizeConversionId ────────────────────────────────────────────────────
check('normalize: already AW', normalizeConversionId('AW-18264425836') === 'AW-18264425836');
check('normalize: bare digits', normalizeConversionId('18264425836') === 'AW-18264425836');
check('normalize: null', normalizeConversionId(null) === null);
check('normalize: junk', normalizeConversionId('not-an-id') === null);

// ── buildSendTo ──────────────────────────────────────────────────────────────
check('sendTo', buildSendTo('AW-123456789', 'AbC-D_efG') === 'AW-123456789/AbC-D_efG');

// ── parseConversionLabelFromSnippet ──────────────────────────────────────────
const snippet = `
<!-- Event snippet for Keystone – Lead form -->
<script>
  gtag('event', 'conversion', {
      'send_to': 'AW-18264425836/AbC-D_efGhIjKl',
      'value': 1.0,
      'currency': 'CAD'
  });
</script>`;
check('parse label', parseConversionLabelFromSnippet(snippet) === 'AbC-D_efGhIjKl',
  parseConversionLabelFromSnippet(snippet));
check('parse label: double quotes',
  parseConversionLabelFromSnippet(`"send_to": "AW-1/XyZ_9"`) === 'XyZ_9');
check('parse label: null snippet', parseConversionLabelFromSnippet(null) === null);
check('parse label: no send_to', parseConversionLabelFromSnippet('<script>foo()</script>') === null);

// ── isConversionTrackingActive ───────────────────────────────────────────────
// A base tag (conversion id) is enough to be "active": it injects gtag on the
// site and marks the Google Ads account as set up. Labels only gate which
// events fire (see fireAdsConversion), so a pasted base tag with no labels yet
// is still active — this is the "enter tag manually" case.
check('active: has id + labels', isConversionTrackingActive({ conversionId: 'AW-1', labels: { call: 'x' } }) === true);
check('active: base tag only (no labels)', isConversionTrackingActive({ conversionId: 'AW-1', labels: {} }) === true);
check('active: no id', isConversionTrackingActive({ conversionId: '', labels: { call: 'x' } }) === false);
check('active: null', isConversionTrackingActive(null) === false);

// ── specs catalogue ──────────────────────────────────────────────────────────
check('specs cover every event type',
  CONVERSION_EVENT_TYPES.every((t) => CONVERSION_ACTION_SPECS[t] && CONVERSION_ACTION_SPECS[t].category),
  JSON.stringify(Object.keys(CONVERSION_ACTION_SPECS)));
check('order counts many-per-click', CONVERSION_ACTION_SPECS.order.countingType === 'MANY_PER_CLICK');
check('call counts one-per-click', CONVERSION_ACTION_SPECS.call.countingType === 'ONE_PER_CLICK');

if (failures.length) {
  console.error(`\n✗ verify-marketing-conversions: ${failures.length} failure(s)`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('✓ verify-marketing-conversions: all checks passed');
