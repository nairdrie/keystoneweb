/**
 * Verifies lib/subscription/billing-interval.ts — the rules behind the
 * monthly ↔ yearly billing-cycle switch in Account Settings.
 *
 * The money side of that switch is decided here: whether the customer is
 * credited for the part of the cycle they already paid, or billed for the whole
 * new term because they're behind on payment. Getting it wrong either gives away
 * a year or double-charges someone, so the rules are exercised directly rather
 * than eyeballed.
 *
 * Transpiles the real TypeScript (it has relative imports, so Node's built-in
 * type stripping can't load it on its own) and runs the actual exports.
 *
 * Run: node scripts/verify-billing-interval.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const root = process.cwd();
const failures = [];

function check(name, cond, detail) {
  if (!cond) failures.push(`${name}${detail ? `: ${detail}` : ''}`);
}

function equal(name, actual, expected) {
  check(name, actual === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// ── Minimal TypeScript module loader ────────────────────────────────────────
// Transpiles on demand and resolves relative specifiers to their .ts files, so
// the lib can be imported with its real dependency graph intact.

const moduleCache = new Map();

function loadTs(filePath) {
  const resolved = filePath.endsWith('.ts') ? filePath : `${filePath}.ts`;
  if (moduleCache.has(resolved)) return moduleCache.get(resolved).exports;

  const source = fs.readFileSync(resolved, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: resolved,
  });

  const mod = { exports: {} };
  moduleCache.set(resolved, mod);

  const localRequire = (specifier) => {
    if (specifier.startsWith('.')) {
      return loadTs(path.resolve(path.dirname(resolved), specifier));
    }
    return require(specifier);
  };

  const factory = vm.runInThisContext(
    `(function (exports, require, module, __filename, __dirname) {\n${outputText}\n})`,
    { filename: resolved },
  );
  factory(mod.exports, localRequire, mod, resolved, path.dirname(resolved));
  return mod.exports;
}

// Shared add-on prices come from env at import time — set one so the "standard
// pricing uses the shared price" branch is actually reachable.
process.env.STRIPE_ADDON_SITES_MONTHLY = 'price_addon_sites_monthly';
process.env.STRIPE_ADDON_SITES_YEARLY = 'price_addon_sites_yearly';

const billing = loadTs(path.join(root, 'lib/subscription/billing-interval.ts'));
const { PLANS } = loadTs(path.join(root, 'lib/plans.ts'));

const {
  canSwitchInterval,
  findPlanItem,
  intervalOfItem,
  intervalPricing,
  isBillingInterval,
  isLateStatus,
  isMeteredItem,
  oppositeInterval,
  planKeyFor,
  resolveAddonTargetPrice,
  resolveIntervalChangeStrategy,
  resolvePlanFromSubscription,
  yearlySavings,
} = billing;

// ── Who may switch ──────────────────────────────────────────────────────────

for (const status of ['active', 'trialing', 'past_due', 'unpaid']) {
  check(`canSwitchInterval(${status})`, canSwitchInterval(status) === true);
}
for (const status of ['canceled', 'incomplete', 'incomplete_expired', 'paused', 'inactive', null, undefined, '']) {
  check(`canSwitchInterval(${status})`, canSwitchInterval(status) === false);
}

check('isLateStatus(past_due)', isLateStatus('past_due') === true);
check('isLateStatus(unpaid)', isLateStatus('unpaid') === true);
check('isLateStatus(active)', isLateStatus('active') === false);
check('isLateStatus(trialing)', isLateStatus('trialing') === false);
check('isLateStatus(null)', isLateStatus(null) === false);

// ── Proration vs. whole-term billing ────────────────────────────────────────
// A customer who is paid up is credited for the unused remainder of the cycle
// they bought. A customer who is behind has no paid time to credit, so Stripe
// bills the full new term from today.

for (const status of ['active', 'trialing']) {
  const strategy = resolveIntervalChangeStrategy(status);
  equal(`strategy(${status}).prorationBehavior`, strategy.prorationBehavior, 'always_invoice');
  equal(`strategy(${status}).chargesFullTerm`, strategy.chargesFullTerm, false);
  equal(`strategy(${status}).voidStaleInvoices`, strategy.voidStaleInvoices, false);
  equal(`strategy(${status}).reason`, strategy.reason, 'prorated');
}

for (const status of ['past_due', 'unpaid']) {
  const strategy = resolveIntervalChangeStrategy(status);
  equal(`strategy(${status}).prorationBehavior`, strategy.prorationBehavior, 'none');
  equal(`strategy(${status}).chargesFullTerm`, strategy.chargesFullTerm, true);
  equal(`strategy(${status}).reason`, strategy.reason, 'late_full_term');
  // Voiding the stale invoice is what stops the new term double-billing the
  // days the failed invoice already covers.
  equal(`strategy(${status}).voidStaleInvoices`, strategy.voidStaleInvoices, billing.VOID_STALE_INVOICE_ON_LATE_SWITCH);
}

// ── Interval helpers ────────────────────────────────────────────────────────

equal('oppositeInterval(month)', oppositeInterval('month'), 'year');
equal('oppositeInterval(year)', oppositeInterval('year'), 'month');
check('isBillingInterval(month)', isBillingInterval('month') === true);
check('isBillingInterval(year)', isBillingInterval('year') === true);
check('isBillingInterval(week)', isBillingInterval('week') === false);
check('isBillingInterval(undefined)', isBillingInterval(undefined) === false);

// ── Pricing shown on the switch card ────────────────────────────────────────

const basicMonthly = intervalPricing(PLANS.basic, 'month');
equal('basic monthly perMonth', basicMonthly.perMonth, 25);
equal('basic monthly perTerm', basicMonthly.perTerm, 25);
equal('basic monthly termLabel', basicMonthly.termLabel, 'month');

const basicYearly = intervalPricing(PLANS.basic, 'year');
equal('basic yearly perMonth', basicYearly.perMonth, 15);
equal('basic yearly perTerm', basicYearly.perTerm, 180);
equal('basic yearly termLabel', basicYearly.termLabel, 'year');

const proYearly = intervalPricing(PLANS.pro, 'year');
equal('pro yearly perMonth', proYearly.perMonth, 30);
equal('pro yearly perTerm', proYearly.perTerm, 360);

equal('basic yearly savings', yearlySavings(PLANS.basic), 120);
equal('pro yearly savings', yearlySavings(PLANS.pro), 240);

equal('planKeyFor(basic)', planKeyFor(PLANS.basic), 'basic');
equal('planKeyFor(pro)', planKeyFor(PLANS.pro), 'pro');

// ── Picking the right subscription item ─────────────────────────────────────
// Subscriptions carry the base plan, a monthly metered overage item and any
// add-ons. Swapping the interval onto the wrong one would wreck the customer's
// billing, so the base item must be identified exactly.

const planMonthlyItem = {
  id: 'si_plan',
  quantity: 1,
  price: { id: PLANS.pro.stripe.monthly, product: 'prod_pro', recurring: { interval: 'month', usage_type: 'licensed' } },
};
const meteredItem = {
  id: 'si_metered',
  quantity: 1,
  price: { id: 'price_metered', product: 'prod_pro', recurring: { interval: 'month', usage_type: 'metered' } },
};
const meterBackedItem = {
  id: 'si_meter',
  quantity: 1,
  price: { id: 'price_meter', product: 'prod_pro', recurring: { interval: 'month', meter: 'mtr_123' } },
};
const addonItem = {
  id: 'si_addon',
  quantity: 2,
  price: { id: 'price_addon', product: 'prod_pro', recurring: { interval: 'month', usage_type: 'licensed' } },
};

const subscription = {
  id: 'sub_1',
  status: 'active',
  currency: 'cad',
  items: { data: [meteredItem, addonItem, planMonthlyItem] },
};

check('isMeteredItem(usage_type)', isMeteredItem(meteredItem) === true);
check('isMeteredItem(meter)', isMeteredItem(meterBackedItem) === true);
check('isMeteredItem(licensed)', isMeteredItem(planMonthlyItem) === false);

equal('intervalOfItem(plan)', intervalOfItem(planMonthlyItem), 'month');
equal('intervalOfItem(null)', intervalOfItem(null), null);
equal(
  'intervalOfItem(weekly)',
  intervalOfItem({ id: 'x', price: { recurring: { interval: 'week' } } }),
  null,
);

equal(
  'findPlanItem matches the known plan price, not the metered or add-on item',
  findPlanItem(subscription, PLANS.pro, new Set(['si_addon']))?.id,
  'si_plan',
);

// Falls back to the first licensed non-add-on item when the price is one we've
// since rotated out of lib/plans.ts.
const legacySubscription = {
  id: 'sub_2',
  items: {
    data: [
      meteredItem,
      { id: 'si_legacy', quantity: 1, price: { id: 'price_retired', product: 'prod_pro', recurring: { interval: 'month', usage_type: 'licensed' } } },
      addonItem,
    ],
  },
};
equal(
  'findPlanItem falls back past the metered item',
  findPlanItem(legacySubscription, PLANS.pro, new Set(['si_addon']))?.id,
  'si_legacy',
);
equal(
  'findPlanItem skips known add-on items in the fallback',
  findPlanItem({ id: 'sub_3', items: { data: [addonItem] } }, null, new Set(['si_addon'])),
  null,
);

// ── Plan resolution ─────────────────────────────────────────────────────────

equal(
  'resolvePlanFromSubscription prefers the price ID over the stored name',
  resolvePlanFromSubscription(subscription, 'Basic'),
  PLANS.pro,
);
equal(
  'resolvePlanFromSubscription falls back to the plan name',
  resolvePlanFromSubscription(legacySubscription, 'Keystone Pro'),
  PLANS.pro,
);
equal(
  'resolvePlanFromSubscription returns null when nothing matches',
  resolvePlanFromSubscription(legacySubscription, 'Mystery Plan'),
  null,
);

// ── Add-ons follow the base plan's interval ─────────────────────────────────
// Otherwise a customer on yearly keeps paying monthly add-on rates.

const standardAddon = { addon_type: 'extra_sites', monthly_price: 5, yearly_price: 3 };
const standardMonthly = resolveAddonTargetPrice(standardAddon, 'month');
equal('standard add-on monthly price', standardMonthly.priceId, 'price_addon_sites_monthly');
equal('standard add-on monthly needsCustomPrice', standardMonthly.needsCustomPrice, false);

const standardYearly = resolveAddonTargetPrice(standardAddon, 'year');
equal('standard add-on yearly price', standardYearly.priceId, 'price_addon_sites_yearly');
equal('standard add-on yearly unit amount', standardYearly.unitAmountCents, 300);

const overriddenAddon = { addon_type: 'extra_sites', monthly_price: 4, yearly_price: 2.5 };
const overriddenYearly = resolveAddonTargetPrice(overriddenAddon, 'year');
equal('overridden add-on needs a per-user price', overriddenYearly.needsCustomPrice, true);
equal('overridden add-on price is null', overriddenYearly.priceId, null);
equal('overridden add-on unit amount rounds to cents', overriddenYearly.unitAmountCents, 250);

// An add-on type with no shared price configured still needs a per-user price.
const noSharedPrice = resolveAddonTargetPrice(
  { addon_type: 'white_label', monthly_price: 25, yearly_price: 15 },
  'year',
);
equal('add-on with no configured shared price', noSharedPrice.needsCustomPrice, true);

equal(
  'unknown add-on type resolves to null',
  resolveAddonTargetPrice({ addon_type: 'not_a_real_addon', monthly_price: 1, yearly_price: 1 }, 'year'),
  null,
);

// ── Report ──────────────────────────────────────────────────────────────────

if (failures.length) {
  console.error('✗ billing-interval: checks failed');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('✓ billing-interval: all checks passed');
