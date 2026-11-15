/**
 * Verifies lib/subscription/plan-change.ts — the rules behind Basic ↔ Pro plan
 * changes on an existing subscription (app/api/stripe/plan-change).
 *
 * These replaced the Stripe Customer Portal's update flow, which rejects any
 * subscription with more than one item. The checks here pin down that the base
 * plan and the metered overage item both move to the new plan, add-ons are left
 * alone, and the current schedule phase survives a downgrade being scheduled.
 *
 * Run: npm run test:billing
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

process.env.STRIPE_BASIC_METERED_PRICE = 'price_basic_metered';
process.env.STRIPE_PRO_METERED_PRICE = 'price_pro_metered';

const pc = loadTs(path.join(root, 'lib/subscription/plan-change.ts'));
const { PLANS } = loadTs(path.join(root, 'lib/plans.ts'));

const {
  acceptProrationDate,
  buildDowngradePhaseItems,
  buildPlanItemUpdates,
  canChangePlan,
  downgradeScheduleHasTakenEffect,
  isKeystoneDowngradeSchedule,
  phaseToUpdateParams,
  resolvePlanChangeDirection,
  resolvePriceTarget,
  PRORATION_DATE_MAX_AGE_SECONDS,
} = pc;

// ── Price → plan ────────────────────────────────────────────────────────────

const proYearly = resolvePriceTarget(PLANS.pro.stripe.yearly);
equal('pro yearly price → pro', proYearly?.planKey, 'pro');
equal('pro yearly price → year', proYearly?.interval, 'year');
const basicMonthly = resolvePriceTarget(PLANS.basic.stripe.monthly);
equal('basic monthly price → basic', basicMonthly?.planKey, 'basic');
equal('basic monthly price → month', basicMonthly?.interval, 'month');
equal('metered price is not a plan target', resolvePriceTarget('price_pro_metered'), null);
equal('unknown price', resolvePriceTarget('price_nope'), null);
equal('empty price', resolvePriceTarget(''), null);

// ── Direction ───────────────────────────────────────────────────────────────

equal('basic → pro', resolvePlanChangeDirection(PLANS.basic, PLANS.pro), 'upgrade');
equal('pro → basic', resolvePlanChangeDirection(PLANS.pro, PLANS.basic), 'downgrade');
equal('basic → basic', resolvePlanChangeDirection(PLANS.basic, PLANS.basic), null);

// ── Who may change ──────────────────────────────────────────────────────────
// Upgrades charge today, so a customer who's behind settles up first.

for (const s of ['active', 'trialing']) check(`upgrade allowed (${s})`, canChangePlan('upgrade', s) === true);
for (const s of ['past_due', 'unpaid', 'canceled', null]) check(`upgrade blocked (${s})`, canChangePlan('upgrade', s) === false);
for (const s of ['active', 'trialing', 'past_due', 'unpaid']) check(`downgrade allowed (${s})`, canChangePlan('downgrade', s) === true);
for (const s of ['canceled', 'incomplete', null]) check(`downgrade blocked (${s})`, canChangePlan('downgrade', s) === false);

// ── Proration date from the preview ─────────────────────────────────────────

const now = 1_800_000_000;
equal('recent proration date kept', acceptProrationDate(now - 60, now), now - 60);
equal('stale proration date replaced', acceptProrationDate(now - PRORATION_DATE_MAX_AGE_SECONDS - 1, now), now);
equal('future proration date replaced', acceptProrationDate(now + 5, now), now);
equal('missing proration date', acceptProrationDate(undefined, now), now);
equal('string proration date', acceptProrationDate('123', now), now);

// ── Upgrade items ───────────────────────────────────────────────────────────
// The customer this was written for: Basic plan + Basic metered item + add-on.

const planItem = {
  id: 'si_plan',
  quantity: 1,
  price: { id: PLANS.basic.stripe.monthly, product: 'prod_basic', recurring: { interval: 'month', usage_type: 'licensed' } },
};
const meteredItem = {
  id: 'si_metered',
  price: { id: 'price_basic_metered', product: 'prod_basic', recurring: { interval: 'month', usage_type: 'metered' } },
};
const addonItem = {
  id: 'si_addon',
  quantity: 2,
  price: { id: 'price_addon', product: 'prod_addon', recurring: { interval: 'month', usage_type: 'licensed' } },
};
const sub = { id: 'sub_1', items: { data: [meteredItem, planItem, addonItem] } };

const proMonthly = resolvePriceTarget(PLANS.pro.stripe.monthly);
const up = buildPlanItemUpdates(sub, planItem, proMonthly);
equal('upgrade: two item updates (plan + metered)', up.items.length, 2);
equal('upgrade: plan item id', up.items[0].id, 'si_plan');
equal('upgrade: plan item price', up.items[0].price, PLANS.pro.stripe.monthly);
equal('upgrade: plan item quantity', up.items[0].quantity, 1);
equal('upgrade: metered item id', up.items[1].id, 'si_metered');
equal('upgrade: metered moves to pro rate', up.items[1].price, 'price_pro_metered');
check('upgrade: metered has no quantity', !('quantity' in up.items[1]));
check('upgrade: add-on untouched', !up.items.some((i) => i.id === 'si_addon'));
equal('upgrade: meteredMissing', up.meteredMissing, false);

const noMeteredSub = { id: 'sub_2', items: { data: [planItem] } };
const upNoMetered = buildPlanItemUpdates(noMeteredSub, planItem, proMonthly);
equal('upgrade without metered item adds one', upNoMetered.items[1]?.price, 'price_pro_metered');
check('added metered item has no id', upNoMetered.items[1] && !upNoMetered.items[1].id);

const alreadyProMetered = { id: 'sub_3', items: { data: [planItem, { ...meteredItem, price: { ...meteredItem.price, id: 'price_pro_metered' } }] } };
equal('metered already on target price is left alone', buildPlanItemUpdates(alreadyProMetered, planItem, proMonthly).items.length, 1);

// ── Downgrade phase items ───────────────────────────────────────────────────

const proPlanItem = { ...planItem, price: { ...planItem.price, id: PLANS.pro.stripe.yearly, recurring: { interval: 'year', usage_type: 'licensed' } } };
const proSub = {
  id: 'sub_4',
  items: { data: [proPlanItem, { ...meteredItem, price: { ...meteredItem.price, id: 'price_pro_metered' } }, addonItem] },
};
const basicYearly = resolvePriceTarget(PLANS.basic.stripe.yearly);
const phase = buildDowngradePhaseItems(proSub, proPlanItem, basicYearly, () => null);
equal('downgrade phase: 3 items', phase.length, 3);
equal('downgrade phase: plan price', phase[0].price, PLANS.basic.stripe.yearly);
equal('downgrade phase: metered → basic rate', phase[1].price, 'price_basic_metered');
check('downgrade phase: metered has no quantity', !('quantity' in phase[1]));
equal('downgrade phase: add-on keeps price', phase[2].price, 'price_addon');
equal('downgrade phase: add-on keeps quantity', phase[2].quantity, 2);

const phaseNewAddonPrice = buildDowngradePhaseItems(proSub, proPlanItem, basicYearly, (item) => (item.id === 'si_addon' ? 'price_addon_yearly' : null));
equal('downgrade phase: add-on moved to new-cycle price', phaseNewAddonPrice[2].price, 'price_addon_yearly');

// ── Rebuilding the current phase ────────────────────────────────────────────
// Schedule updates replace phases wholesale; losing the discount or tax on the
// current phase would silently change what the customer pays now.

const rebuilt = phaseToUpdateParams({
  start_date: 100,
  end_date: 200,
  items: [
    { price: { id: 'price_pro' }, quantity: 1, discounts: [] },
    { price: 'price_pro_metered', quantity: undefined, discounts: [] },
  ],
  discounts: [{ coupon: null, discount: 'di_123', promotion_code: null }],
  automatic_tax: { enabled: true },
  metadata: {},
  default_payment_method: null,
});
equal('rebuilt phase start', rebuilt.start_date, 100);
equal('rebuilt phase end', rebuilt.end_date, 200);
equal('rebuilt phase item price (expanded)', rebuilt.items[0].price, 'price_pro');
equal('rebuilt phase item price (string)', rebuilt.items[1].price, 'price_pro_metered');
check('rebuilt metered item has no quantity', !('quantity' in rebuilt.items[1]));
equal('rebuilt phase keeps discount', rebuilt.discounts?.[0]?.discount, 'di_123');
equal('rebuilt phase keeps automatic tax', rebuilt.automatic_tax?.enabled, true);
check('rebuilt phase drops empty metadata', !('metadata' in rebuilt));

// ── Our schedules ───────────────────────────────────────────────────────────

const ours = {
  status: 'active',
  metadata: { keystone_plan_change: 'downgrade' },
  phases: [{ start_date: 100, end_date: 200 }, { start_date: 200, end_date: 300 }],
  current_phase: { start_date: 100, end_date: 200 },
};
check('isKeystoneDowngradeSchedule(ours)', isKeystoneDowngradeSchedule(ours) === true);
check('isKeystoneDowngradeSchedule(foreign)', isKeystoneDowngradeSchedule({ metadata: {} }) === false);
check('pending downgrade has not taken effect', downgradeScheduleHasTakenEffect(ours) === false);
check(
  'downgrade in its last phase has taken effect',
  downgradeScheduleHasTakenEffect({ ...ours, current_phase: { start_date: 200, end_date: 300 } }) === true,
);
check(
  'foreign schedule is never treated as finished',
  downgradeScheduleHasTakenEffect({ ...ours, metadata: {}, current_phase: { start_date: 200, end_date: 300 } }) === false,
);

// ── Report ──────────────────────────────────────────────────────────────────

if (failures.length) {
  console.error('✗ plan-change: checks failed');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('✓ plan-change: all checks passed');
