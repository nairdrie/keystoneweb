/**
 * Verifies lib/marketing/bidding.ts — the search-campaign bidding & budget
 * calibration logic. Runs the real TypeScript via Node's built-in type
 * stripping (Node >= 22.6), so this exercises the actual exported functions,
 * not a copy.
 *
 * Run: node scripts/verify-marketing-bidding.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

function check(name, cond, detail) {
  if (!cond) failures.push(`${name}${detail ? `: ${detail}` : ''}`);
}

const bidding = await import(path.join(root, 'lib/marketing/bidding.ts'));
const {
  planSearchBidding,
  planDisplayBidding,
  computeBidCeilingMicros,
  calibrateMatchType,
  prioritizeKeywords,
  summarizeKeywordMetrics,
  heuristicEstimate,
  recommendedDailyBudgetCents,
  MIN_CPC_CEILING_MICROS,
  MAX_CLICK_BUDGET_FRACTION,
  MICROS_PER_CENT,
} = bidding;

// ── 1. Maximize Clicks ceiling: caps a single click at a fraction of daily ────
{
  // $200/day, cheap long-tail market ($2 rep, $5 max). Budget fraction = $50,
  // but capped at the $5 market high → $5.00.
  const est = { source: 'google_keyword_plan', representativeCpcMicros: 2_000_000, maxTopOfPageBidMicros: 5_000_000, minTopOfPageBidMicros: 1_000_000, perKeyword: [] };
  const ceiling = computeBidCeilingMicros(20_000 * MICROS_PER_CENT, est);
  check('ceiling capped at market high', ceiling === 5_000_000, `got ${ceiling}`);
}
{
  // $14/day, no market high cap binding → 25% of $14 = $3.50.
  const est = heuristicEstimate(['plumber', 'plumber near me']); // median 2 words → $8 rep, $20 max
  const ceiling = computeBidCeilingMicros(1_400 * MICROS_PER_CENT, est);
  check('ceiling = 25% of daily budget', ceiling === 3_500_000, `got ${ceiling}`);
}
{
  // $1/day → 25% = $0.25, below the $0.40 floor → clamps up to the floor.
  const est = heuristicEstimate(['plumber']);
  const ceiling = computeBidCeilingMicros(100 * MICROS_PER_CENT, est);
  check('ceiling respects absolute floor', ceiling === MIN_CPC_CEILING_MICROS, `got ${ceiling}`);
}

// ── 2. Match-type tiering from clicks/day ─────────────────────────────────────
check('>=8 clicks → BROAD', calibrateMatchType(8) === 'BROAD');
check('=3 clicks → PHRASE', calibrateMatchType(3) === 'PHRASE');
check('=2.9 clicks → EXACT', calibrateMatchType(2.9) === 'EXACT');
check('0 clicks → EXACT', calibrateMatchType(0) === 'EXACT');

// ── 3. Long-tail prioritization + trimming ────────────────────────────────────
{
  const kws = ['plumber', 'emergency plumber near me', 'drain cleaning service'];
  const out = prioritizeKeywords(kws, 'EXACT');
  check('long-tail sorted first', out[0] === 'emergency plumber near me', `got ${out[0]}`);
  check('keeps all when under cap', out.length === 3, `got ${out.length}`);
}
{
  // 20 one-word head terms, EXACT cap = 10 → trimmed to 10.
  const kws = Array.from({ length: 20 }, (_, i) => `kw${i}`);
  const out = prioritizeKeywords(kws, 'EXACT');
  check('EXACT trims to cap (10)', out.length === 10, `got ${out.length}`);
}
{
  // Tiny list never padded and never trimmed below MIN_KEYWORDS.
  const kws = ['a a a', 'b b', 'c'];
  const out = prioritizeKeywords(kws, 'EXACT');
  check('small list kept intact', out.length === 3, `got ${out.length}`);
}

// ── 4. Market estimate aggregation (median of mid-bids) ───────────────────────
{
  const metrics = [
    { text: 'a', avgMonthlySearches: 100, competition: 'HIGH', lowTopOfPageBidMicros: 2_000_000, highTopOfPageBidMicros: 6_000_000 },
    { text: 'b', avgMonthlySearches: 50, competition: 'MEDIUM', lowTopOfPageBidMicros: 4_000_000, highTopOfPageBidMicros: 10_000_000 },
  ];
  const est = summarizeKeywordMetrics(metrics);
  // mids = [4M, 7M] → median 5.5M; max high 10M; min low 2M.
  check('summarize representative = median mid', est && est.representativeCpcMicros === 5_500_000, `got ${est && est.representativeCpcMicros}`);
  check('summarize max top-of-page', est && est.maxTopOfPageBidMicros === 10_000_000, `got ${est && est.maxTopOfPageBidMicros}`);
  check('summarize min top-of-page', est && est.minTopOfPageBidMicros === 2_000_000, `got ${est && est.minTopOfPageBidMicros}`);
  check('summarize source', est && est.source === 'google_keyword_plan');
}
check('summarize null on empty', summarizeKeywordMetrics([]) === null);
check('summarize null when no bids', summarizeKeywordMetrics([{ text: 'x', avgMonthlySearches: null, competition: 'UNKNOWN', lowTopOfPageBidMicros: null, highTopOfPageBidMicros: null }]) === null);

// ── 5. The headline regression: $14/day on broad competitive keywords ─────────
{
  // Real market: ~$18 mid CPC, $30 top-of-page — exactly the note's scenario.
  const estimate = {
    source: 'google_keyword_plan',
    representativeCpcMicros: 18_000_000,
    maxTopOfPageBidMicros: 30_000_000,
    minTopOfPageBidMicros: 12_000_000,
    perKeyword: [],
  };
  const plan = planSearchBidding({ dailyBudgetCents: 1_400, keywords: ['plumber', 'plumbing company', 'emergency plumber near me'], estimate });
  check('thin budget → not BROAD', plan.matchType !== 'BROAD', `got ${plan.matchType}`);
  check('thin budget → EXACT (<1 click/day)', plan.matchType === 'EXACT', `got ${plan.matchType}`);
  check('ceiling capped below a full day', plan.cpcBidCeilingMicros === 3_500_000, `got ${plan.cpcBidCeilingMicros}`);
  check('strategy is maximize clicks', plan.strategy === 'MAXIMIZE_CLICKS');
  check('emits a budget flag', plan.warnings.some(w => /budget too small|thin budget/i.test(w)), JSON.stringify(plan.warnings));
  check('ceiling note present', plan.warnings.some(w => /Maximize Clicks with a Max-CPC ceiling/i.test(w)));
  check('long-tail kept first', plan.keywords[0] === 'emergency plumber near me', `got ${plan.keywords[0]}`);
}

// ── 6. Healthy budget keeps broad + stays clean ───────────────────────────────
{
  const estimate = { source: 'google_keyword_plan', representativeCpcMicros: 2_000_000, maxTopOfPageBidMicros: 5_000_000, minTopOfPageBidMicros: 1_000_000, perKeyword: [] };
  const plan = planSearchBidding({ dailyBudgetCents: 20_000, keywords: ['plumber', 'emergency plumber near me'], estimate });
  check('healthy budget → BROAD', plan.matchType === 'BROAD', `got ${plan.matchType}`);
  check('healthy budget → no budget flag', !plan.warnings.some(w => /thin|too small|moderate/i.test(w)), JSON.stringify(plan.warnings));
}

// ── 7. Heuristic fallback drives tightening with no market data ────────────────
{
  const plan = planSearchBidding({ dailyBudgetCents: 1_400, keywords: ['plumber', 'plumbing company'], estimate: null });
  check('heuristic source flagged', plan.estimateSource === 'heuristic');
  check('heuristic still tightens', plan.matchType !== 'BROAD', `got ${plan.matchType}`);
  check('heuristic confidence note', plan.warnings.some(w => /approximate/i.test(w)), JSON.stringify(plan.warnings));
}

// ── 8. Recommended budget scales with target clicks ───────────────────────────
{
  const est = { source: 'google_keyword_plan', representativeCpcMicros: 5_000_000, maxTopOfPageBidMicros: 8_000_000, minTopOfPageBidMicros: 3_000_000, perKeyword: [] };
  // $5 CPC × 3 clicks = $15.00 → 1500 cents.
  check('recommended budget for 3 clicks', recommendedDailyBudgetCents(est, 3) === 1_500, `got ${recommendedDailyBudgetCents(est, 3)}`);
}

// ── 9. Display ceiling is budget-fraction with floor ──────────────────────────
{
  check('display ceiling = 25% daily', planDisplayBidding({ dailyBudgetCents: 1_400 }).cpcBidCeilingMicros === 3_500_000);
  check('display ceiling floor', planDisplayBidding({ dailyBudgetCents: 100 }).cpcBidCeilingMicros === MIN_CPC_CEILING_MICROS);
}

// ── 10. Source-level guards on the deploy path (google-ads.ts) ────────────────
{
  const src = fs.readFileSync(path.join(root, 'lib/marketing/google-ads.ts'), 'utf8');
  const searchBlock = src.slice(src.indexOf('export async function createSearchCampaign'), src.indexOf('export async function createDisplayCampaign'));
  check('search: uses Maximize Clicks (target_spend)', /target_spend/.test(searchBlock));
  check('search: sets a cpc bid ceiling', /cpc_bid_ceiling_micros/.test(searchBlock));
  check('search: no manual_cpc', !/manual_cpc/.test(searchBlock), 'manual_cpc still present in search create');
  check('search: Search partners OFF', /target_search_network:\s*false/.test(searchBlock));
  check('search: Display network OFF', /target_content_network:\s*false/.test(searchBlock));
  check('search: no hardcoded $1 ad-group bid', !/cpc_bid_micros:\s*1_000_000/.test(searchBlock), 'flat $1 cpc_bid_micros still present');
  check('search: match type from plan', /match_type:\s*plan\.matchType|match_type:\s*matchType/.test(searchBlock));
}

// ── Report ────────────────────────────────────────────────────────────────────
if (failures.length) {
  console.error(`\n✗ marketing-bidding: ${failures.length} check(s) failed:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('✓ marketing-bidding: all checks passed');
