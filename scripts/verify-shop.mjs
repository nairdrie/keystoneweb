/**
 * Verifies the Shop tab's money math and Ontario compliance rules
 * (lib/shop/money.ts, rules.ts, board.ts, documents.ts, data.ts helpers).
 * Runs the real TypeScript through Node's type stripping (Node >= 22.6); a
 * small resolve hook adds the `.ts` extension and the `@/` path alias.
 *
 * Run: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/verify-shop.mjs
 */

import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const hook = `
const ROOT = ${JSON.stringify(pathToFileURL(root + '/').href)};
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) specifier = new URL(specifier.slice(2), ROOT).href;
  try { return await next(specifier, context); }
  catch (err) {
    const relative = specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('file:');
    if (relative && !/\\.[cm]?[jt]sx?$/.test(specifier)) return next(specifier + '.ts', context);
    throw err;
  }
}`;
register('data:text/javascript,' + encodeURIComponent(hook));

const failures = [];
let passed = 0;
function check(name, cond, detail) {
  if (cond) passed++;
  else failures.push(`${name}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ''}`);
}

const money = await import(path.join(root, 'lib/shop/money.ts'));
const rules = await import(path.join(root, 'lib/shop/rules.ts'));
const board = await import(path.join(root, 'lib/shop/board.ts'));
const docs = await import(path.join(root, 'lib/shop/documents.ts'));
const data = await import(path.join(root, 'lib/shop/data.ts'));
const dates = await import(path.join(root, 'lib/shop/dates.ts'));

// ── Money ──────────────────────────────────────────────────────────────────
// The Tacoma estimate from the prototype: v2 subtotal $732.25, HST $95.19, total $827.44.
const tacomaV2 = [
  { kind: 'labour', hours: 1.6, rate_cents: 12500 },
  { kind: 'part', qty: 2, unit_price_cents: 8995, unit_cost_cents: 5840 },
  { kind: 'part', qty: 1, unit_price_cents: 7495, unit_cost_cents: 4610 },
  { kind: 'labour', hours: 0.8, rate_cents: 12500 },
  { kind: 'part', qty: 1, unit_price_cents: 10995, unit_cost_cents: 7125 },
  { kind: 'labour', hours: 0.6, rate_cents: 12500 },
  { kind: 'part', qty: 1, unit_price_cents: 1295, unit_cost_cents: 640 },
  { kind: 'supply', amount_cents: 1190 },
  { kind: 'supply', amount_cents: 760 },
  { kind: 'discount', amount_cents: -4000 },
  { kind: 'labour', decision: 'declined', hours: 2, rate_cents: 12500 },
];
const t = money.computeTotals(tacomaV2, 1300);
check('subtotal', t.subtotal_cents === 73225, t.subtotal_cents);
check('HST 13% rounded once', t.tax_cents === 9519, t.tax_cents);
check('total', t.total_cents === 82744, t.total_cents);
check('labour total', t.labour_cents === 37500, t.labour_cents);
check('declined lines excluded', t.labour_cents === 37500);
check('parts cost', t.cost_cents === 5840 * 2 + 4610 + 7125 + 640, t.cost_cents);
check('no lines need a price', t.needs_price === 0, t.needs_price);
check('part without a price needs one', money.lineNeedsPrice({ kind: 'part', qty: 2, unit_price_cents: null }));
check('labour without hours needs them', money.lineNeedsPrice({ kind: 'labour', hours: null, rate_cents: 12500 }));
check('parseMoney $1,234.50', money.parseMoneyToCents('$1,234.50') === 123450);
check('parseMoney −40', money.parseMoneyToCents('-40') === -4000);
check('parseMoney blank', money.parseMoneyToCents('  ') === null);
check('fractional hours round', money.lineTotalCents({ kind: 'labour', hours: 0.35, rate_cents: 12500 }) === 4375);

// ── 10% cap (CPA s. 58(2)) ─────────────────────────────────────────────────
check('exactly 10% over is allowed', rules.capCheck(100000, 110000).ok === true);
check('one cent over 10% is blocked', rules.capCheck(100000, 110001).ok === false);
check('cap limit', rules.capCheck(82744, 0).limitCents === 91018, rules.capCheck(82744, 0).limitCents);
const withHose = money.computeTotals([...tacomaV2, { kind: 'labour', hours: 0.4, rate_cents: 12500 }, { kind: 'part', qty: 1, unit_price_cents: 4295 }], 1300);
check('prototype hose case is over 10%', rules.capCheck(82744, withHose.total_cents).ok === false, withHose.total_cents);
check('hose case is 12.7% over', Math.abs(rules.capCheck(82744, withHose.total_cents).overPct - 12.69) < 0.05);

// ── Estimate required items (O. Reg. 17/05 s. 48) ──────────────────────────
const goodCtx = {
  estimate: { valid_until: '2026-10-22', ready_by: '2026-09-25' },
  lines: [{ kind: 'part', description: 'Rotor', decision: 'include', condition: 'new_non_oem', qty: 1, unit_price_cents: 8995 }, { kind: 'labour', description: 'Replace', decision: 'include', hours: 1, rate_cents: 12500 }],
  job: { odometer_in: 187412, estimate_fee_cents: 0, estimate_fee_agreed_at: null },
  customer: { name: 'Dave' },
  vehicle: { make: 'Toyota', model: 'Tacoma', vin: '5TFUX4EN3EX028417', plate: 'CBTR 418' },
  settings: { legal_name: 'Northside Auto Service Inc.', phone: '416-555-0100', address: '221 Railside Rd' },
};
check('complete estimate has no problems', rules.estimateProblems(goodCtx).length === 0, rules.estimateProblems(goodCtx));
const bad = rules.estimateProblems({ ...goodCtx, vehicle: { make: 'Toyota', model: 'Tacoma', vin: null, plate: null }, job: { odometer_in: null, estimate_fee_cents: 9500, estimate_fee_agreed_at: null }, lines: [{ kind: 'part', description: 'Rotor', decision: 'include', condition: null, qty: 1, unit_price_cents: null }], estimate: { valid_until: null, ready_by: null } });
const badText = bad.map(p => p.message).join(' | ');
for (const needle of ['VIN', 'Licence plate', 'Odometer', 'Condition', 'price', 'stops applying', 'work will be done', 'estimate fee']) {
  check(`estimate problems mention ${needle}`, badText.toLowerCase().includes(needle.toLowerCase()), badText);
}

// ── Authorization records (O. Reg. 17/05 s. 49) ───────────────────────────
check('phone approval needs the number', rules.authProblems({ method: 'phone', authorized_by: 'Dave', authorized_at: '2026-09-23T18:14:00Z', phone: '' }).some(p => p.field === 'phone'));
check('complete phone approval passes', rules.authProblems({ method: 'phone', authorized_by: 'Dave', authorized_at: '2026-09-23T18:14:00Z', phone: '416-555-0148' }).length === 0);
check('in-person approval needs a signature', rules.authProblems({ method: 'in_person', authorized_by: 'Dave', authorized_at: '2026-09-23T18:14:00Z' }).some(p => p.field === 'signature'));
check('online approval needs a typed name', rules.authProblems({ method: 'online', authorized_by: 'Dave', authorized_at: '2026-09-23T18:14:00Z' }).some(p => p.field === 'typed_name'));

// ── Estimate fee (CPA s. 57) ───────────────────────────────────────────────
const feeJob = { estimate_fee_cents: 9500, estimate_fee_agreed_at: '2026-09-25T12:00:00Z' };
check('fee not chargeable when the repair is approved', rules.estimateFeeChargeable(feeJob, true) === false);
check('fee chargeable when the repair is declined', rules.estimateFeeChargeable(feeJob, false) === true);
check('fee never chargeable if not agreed', rules.estimateFeeChargeable({ estimate_fee_cents: 9500, estimate_fee_agreed_at: null }, false) === false);

// ── Lien validity (RSLA s. 3(2)) ───────────────────────────────────────────
const approvedEst = { id: 'e2', version: 2, status: 'approved', sent_at: '2026-09-22T20:40:00Z', lines: [] };
const phoneAuth = { id: 'a1', estimate_id: 'e2', kind: 'estimate', method: 'phone', authorized_by: 'Dave', phone: '416-555-0148', contact: null, authorized_at: '2026-09-23T18:14:00Z', signature_path: null, typed_name: null };
const lienJob = { estimate_fee_cents: 0, estimate_fee_agreed_at: null };
check('lien valid with sent estimate + recorded approval', rules.lienCheck({ job: lienJob, estimates: [approvedEst], authorizations: [phoneAuth] }).valid === true);
check('no lien without an approval record', rules.lienCheck({ job: lienJob, estimates: [approvedEst], authorizations: [] }).valid === false);
check('no lien if the estimate was never given', rules.lienCheck({ job: lienJob, estimates: [{ ...approvedEst, sent_at: null }], authorizations: [phoneAuth] }).valid === false);
check('no lien if the phone number is missing', rules.lienCheck({ job: lienJob, estimates: [approvedEst], authorizations: [{ ...phoneAuth, phone: null }] }).valid === false);
check('no lien without an approved estimate', rules.lienCheck({ job: lienJob, estimates: [], authorizations: [] }).valid === false);

// ── Lien dates and schedules ───────────────────────────────────────────────
check('sale eligible 60 days after due', rules.saleEligibleOn('2026-09-02') === '2026-11-01', rules.saleEligibleOn('2026-09-02'));
check('discharge due 30 days after payment', rules.dischargeDueOn('2026-12-11') === '2027-01-10');
check('PPSR 1 year', rules.ppsrExpiresOn('2026-09-08', 1) === '2027-09-08');
check('PPSR capped at 3 years', rules.ppsrExpiresOn('2026-09-08', 7) === '2029-09-08');
const single = rules.buildSchedule({ owingCents: 90096, planKind: 'single', firstDue: '2026-10-09' });
check('single payment schedule', single.length === 1 && single[0].amount_cents === 90096);
const biweekly = rules.buildSchedule({ owingCents: 174000, planKind: 'instalments', frequency: 'biweekly', instalmentCents: 25000, firstDue: '2026-09-18' });
check('biweekly count', biweekly.length === 7, biweekly.length);
check('last instalment is the remainder', biweekly[6].amount_cents === 24000, biweekly[6]);
check('biweekly spacing', biweekly[1].due === '2026-10-02' && biweekly[6].due === '2026-12-11', biweekly.map(b => b.due));
check('schedule sums to owing', biweekly.reduce((s, i) => s + i.amount_cents, 0) === 174000);
const monthly = rules.buildSchedule({ owingCents: 30000, planKind: 'instalments', frequency: 'monthly', instalmentCents: 10000, firstDue: '2026-01-31' });
check('monthly schedule', monthly.length === 3, monthly);
const folded = rules.buildSchedule({ owingCents: 90096, planKind: 'instalments', frequency: 'biweekly', instalmentCents: 15000, firstDue: '2026-10-09' });
check('tiny remainder folds into the last payment', folded.length === 6 && folded[5].amount_cents === 15096, folded);
check('next item after one payment', JSON.stringify(data.nextScheduleItem(biweekly, 25000)) === JSON.stringify({ due: '2026-10-02', amount_cents: 25000 }));
check('next item after a partial payment', data.nextScheduleItem(biweekly, 30000).amount_cents === 20000);
check('no next item when paid off', data.nextScheduleItem(biweekly, 174000) === null);

// ── Dates ──────────────────────────────────────────────────────────────────
check('addDays across month', dates.addDays('2026-09-25', 10) === '2026-10-05');
check('daysBetween', dates.daysBetween('2026-09-02', '2026-09-25') === 23);
check('quarter range', JSON.stringify(dates.quarterRange('2026-09-25')) === JSON.stringify({ start: '2026-07-01', end: '2026-09-30', label: 'Jul–Sep 2026' }));

// ── Parts matching ─────────────────────────────────────────────────────────
const expectedLines = [
  { id: 'l1', kind: 'part', decision: 'include', description: 'Front brake rotor, coated', part_number: 'MP-R4127', supplier_id: 's1', eta: 'Same day' },
  { id: 'l2', kind: 'part', decision: 'include', description: 'Front ceramic pad set', part_number: 'LK-CP1291', supplier_id: 's2', eta: 'Same day' },
  { id: 'l3', kind: 'part', decision: 'include', description: 'Alternator', part_number: null, supplier_id: 's2', eta: 'Fri 2:00 pm' },
  { id: 'l4', kind: 'part', decision: 'include', description: 'DOT 3 brake fluid', part_number: null, supplier_id: null, eta: 'In stock' },
];
const matched = data.matchExpectedParts(expectedLines, [
  { description: 'ROTOR COATED FRONT', part_number: 'mp-r4127', is_core: false },
  { description: 'Pad set ceramic front', part_number: null, is_core: false },
  { description: 'Core charge', part_number: 'CORE', is_core: true },
]);
check('matched by part number (case-insensitive)', matched[0].received === true);
check('matched by description', matched[1].received === true);
check('missing part stays expected', matched[2].received === false);
check('stock part counts as received', matched[3].received === true && matched[3].from_stock === true);

// ── Board status and desk ──────────────────────────────────────────────────
const summary = (over) => ({
  id: 'j', ro_number: 1041, key_tag: '07', stage: 'done', bay: null, sort_order: 0, assigned_tech: 'Mike', complaint: 'Grinding', source: 'key_drop',
  next_step: null, holding_since: null, created_at: '2026-09-20T23:42:00Z', updated_at: '2026-09-25T15:40:00Z', status: 'open',
  customer: { id: 'c', name: 'Dave Kowalski', phone: '(416) 555-0148', email: null, preferences: null, customer_type: 'consumer' },
  vehicle: { id: 'v', year: 2014, make: 'Toyota', model: 'Tacoma SR5', trim: null, plate: 'CBTR 418', color: 'Silver', vin: null },
  estimate: null, approved: { id: 'e2', version: 2, total_cents: 82744 }, pending_revision: null,
  parts: { expected: 0, received: 0, next_eta: null }, invoice: null, voice_ready: false, last_voice_at: null, ...over,
});
check('ready to invoice', board.cardStatus(summary({})).text === 'Ready to invoice');
check('extra work pill', board.cardStatus(summary({ pending_revision: { id: 'e3', version: 3, added_cents: 10504, added_lines: 2 } })).text === 'Extra work needs OK');
check('holding pill', board.cardStatus(summary({ holding_since: '2026-09-02T12:00:00Z', invoice: { id: 'i', number: 388, total_cents: 110096, paid_cents: 0, balance_cents: 110096, issued_at: '2026-09-02T13:00:00Z' } })).tone === 'crit');
check('parts ETA pill', board.cardStatus(summary({ stage: 'approved', parts: { expected: 2, received: 1, next_eta: 'Fri 2:00 pm' } })).text === 'Parts ETA Fri 2:00 pm');
check('diagnosing in bay', board.cardStatus(summary({ bay: 'bay1', approved: null })).text === 'Diagnosing');
check('waiting days', board.cardStatus(summary({ stage: 'waiting', approved: null, estimate: { id: 'e', version: 1, status: 'sent', is_revision: false, total_cents: 33036, needs_price: 0, sent_at: '2026-09-24T20:10:00Z' } }), '2026-09-26').text === 'No reply · 2d');
check('invoice label', board.invoiceLabel(412) === 'INV-0412');
const ws = { settings: {}, jobs: [summary({ pending_revision: { id: 'e3', version: 3, added_cents: 10504, added_lines: 2 } })], suppliers: [], pile_count: 2, liens: [
  { id: 'L1', status: 'active', ppsr_registration_number: null, customer_name: 'Kevin O’Brien', vehicle_label: '2009 Chevrolet Silverado', next_due: { due: '2026-10-02', amount_cents: 25000 }, balance_cents: 149000, ppsr_expires_on: null, discharge_registered_at: null, discharge_due_on: null },
], intake: [], site: {} };
const tasks = board.deskTasks(ws, '2026-09-26');
check('desk: register lien task', tasks.some(x => x.key === 'lien-reg-L1' && x.group === 'now'));
check('desk: parts pile task', tasks.some(x => x.key === 'pile'));
check('desk: extra work task', tasks.some(x => x.key.startsWith('rev-')));
check('desk: payment due soon', tasks.some(x => x.key === 'lien-due-L1'));

// ── Documents ──────────────────────────────────────────────────────────────
const settings = { legal_name: 'Northside Auto Service Inc.', address: '221 Railside Rd', phone: '(416) 555-0100', email: null, hst_number: '71234 5678 RT0001', tax_label: 'HST', tax_rate_bps: 1300, payment_terms: 'Due at pickup', payment_methods_note: 'Debit, credit, cash or e-transfer', warranty_extra: null, other_charges: null };
const estLines = [
  { id: 'x1', estimate_id: 'e2', position: 0, kind: 'labour', description: 'Replace front pads and rotors', decision: 'include', qty: 1, hours: 1.6, rate_cents: 12500, unit_price_cents: null, amount_cents: null, unit_cost_cents: null, supplier_id: null, part_number: null, brand: null, condition: null, no_warranty: false, is_added_work: false, alternates: [] },
  { id: 'x2', estimate_id: 'e2', position: 1, kind: 'part', description: 'DOT 3 brake fluid', decision: 'include', qty: 1, hours: null, rate_cents: null, unit_price_cents: 1295, amount_cents: null, unit_cost_cents: 640, supplier_id: null, part_number: null, brand: null, condition: 'new_non_oem', no_warranty: true, is_added_work: false, alternates: [] },
  { id: 'x3', estimate_id: 'e2', position: 2, kind: 'labour', description: 'Rear brake shoes', decision: 'declined', qty: 1, hours: 2, rate_cents: 12500, unit_price_cents: null, amount_cents: null, unit_cost_cents: null, supplier_id: null, part_number: null, brand: null, condition: null, no_warranty: false, is_added_work: false, alternates: [] },
];
const job = { id: 'j', ro_number: 1041, complaint: 'Grinding', odometer_in: 187412, estimate_fee_cents: 9500, estimate_fee_note: 'agreed at drop-off', estimate_fee_agreed_at: '2026-09-20T23:42:00Z', completed_at: '2026-09-25T15:40:00Z', invoice_adjustments: { x1: { hours: 1.8 } } };
const snap = docs.buildInvoiceSnapshot({
  job, customer: { name: 'Dave Kowalski', phone: '(416) 555-0148', email: null, address: null, customer_type: 'consumer' },
  vehicle: { year: 2014, make: 'Toyota', model: 'Tacoma', trim: null, vin: '5TFUX4EN3EX028417', plate: 'CBTR 418' },
  estimates: [{ id: 'e2', version: 2, status: 'approved', lines: estLines }],
  authorizations: [{ ...phoneAuth, parts_back: false }],
  settings, site: { name: 'Northside Auto', base_url: 'https://northside-auto.kswd.ca' },
  number: 412, issuedOn: '2026-09-25', odometerOut: 187415, returnedOn: '2026-09-25',
});
check('invoice applies the hours adjustment', snap.snapshot.lines[0].amount_cents === 22500, snap.snapshot.lines[0]);
check('invoice excludes declined work from lines', snap.snapshot.lines.length === 2);
check('invoice lists declined work', snap.snapshot.declined.length === 1);
check('invoice carries the statutory statement', snap.snapshot.statutory_statement.startsWith('The Consumer Protection Act, 2002 provides you'));
check('invoice carries the warranty text', snap.snapshot.warranty_text.includes('90 days or 5,000 kilometres'));
check('invoice notes the fee was not charged', (snap.snapshot.estimate_fee_note || '').includes('not charged'));
check('invoice number label', snap.snapshot.number_label === 'INV-0412');
check('invoice records the approval', snap.snapshot.authorization?.phone === '416-555-0148');
check('invoice total', snap.totals.total_cents === Math.round((22500 + 1295) * 1.13), snap.totals.total_cents);
const feeSnap = docs.buildInvoiceSnapshot({ ...{ job: { ...job, completed_at: null } }, customer: { name: 'A', phone: null, email: null, address: null, customer_type: 'consumer' }, vehicle: { year: 2014, make: 'Toyota', model: 'Tacoma', trim: null, vin: null, plate: null }, estimates: [{ id: 'e1', version: 1, status: 'declined', lines: estLines }], authorizations: [], settings, site: { name: 'N', base_url: null }, number: 413, issuedOn: '2026-09-25', odometerOut: 187412, returnedOn: '2026-09-25', kind: 'estimate_fee' });
check('fee-only invoice', feeSnap.totals.subtotal_cents === 9500 && feeSnap.snapshot.lines.length === 1);
const ack = docs.buildAcknowledgmentDoc({ shop: docs.shopIdentity(settings, { name: 'N', base_url: null }), customer: { name: 'Carl Dupont' }, vehicle: { year: 2008, make: 'Mazda', model: 'Tribute', trim: 'GX', vin: '4F2CZ02Z38KM17745', plate: 'BHKW 052', color: 'Silver' }, invoice: { label: 'INV-0388', issued_on: '2026-09-02', total_cents: 110096 }, owingCents: 90096, downPaymentCents: 20000, planKind: 'instalments', frequency: 'biweekly', schedule: rules.buildSchedule({ owingCents: 90096, planKind: 'instalments', frequency: 'biweekly', instalmentCents: 15000, firstDue: '2026-10-09' }), signerName: 'Carl Dupont', signerCapacity: 'owner', releasedOn: '2026-09-25', signedAt: null });
check('instalment plan includes a credit disclosure', !!ack.credit_disclosure && ack.credit_disclosure.cost_of_borrowing_cents === 0);
check('acknowledgment names the RSLA', ack.lien_text.includes('Repair and Storage Liens Act'));

// Part matching tolerates plurals and filler words.
check('plural part names match', data.similarDescriptions('Front rotors', 'Rotor'));
check('filler words ignored', data.similarDescriptions('Brake pads, front', 'Ceramic brake pad set'));
check('unrelated parts do not match', !data.similarDescriptions('Ignition coil', 'Cabin air filter'));

// Phone numbers for texting.
const env = await import(path.join(root, 'lib/shop/env.ts'));
check('sms off without Twilio env', env.smsConfigured() === false);

if (failures.length) {
  console.error(`verify-shop: ${failures.length} failed, ${passed} passed`);
  for (const f of failures) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log(`verify-shop: all ${passed} checks passed`);
