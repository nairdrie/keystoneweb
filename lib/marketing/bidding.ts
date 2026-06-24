/**
 * Search-campaign bidding & budget calibration.
 *
 * This module is the brain that decides HOW a Google search campaign should bid
 * and which keywords/match-types it should deploy, given the customer's daily
 * budget and (when available) live market data from Google's Keyword Planner.
 *
 * It exists because the old deploy path forced a static Manual CPC bid
 * (a flat $1.00) with broad-match keywords on micro-budgets. In competitive
 * local-service auctions that bid sits below the first-page bid, so the ads
 * never enter the auction (zero impressions), while broad match on a $14/day
 * budget burns the whole day on one or two clicks.
 *
 * The fixes encoded here:
 *   1. Default to an automated, volume-focused strategy (Maximize Clicks) with a
 *      sane Max-CPC ceiling so a single expensive click can't drain the day.
 *   2. Compare the daily budget against the estimated market CPC and, when the
 *      budget is thin, tighten the keyword match type and prioritize cheaper
 *      long-tail keywords — and always surface a human-readable flag.
 *
 * IMPORTANT: keep this module free of runtime imports (only `import type`). It is
 * pure so it can be unit-tested directly and reused by both the search and
 * display deploy paths without dragging in the Google client.
 */

// ── Tunable constants ────────────────────────────────────────────────────────

/** Google money is expressed in "micros": 1,000,000 micros = 1 currency unit. */
export const MICROS_PER_DOLLAR = 1_000_000;
/** Our budgets are stored in cents. 1 cent = 10,000 micros. */
export const MICROS_PER_CENT = 10_000;

/**
 * A single click's Max-CPC is capped at this fraction of the *daily* budget, so
 * even in the worst case the budget can afford ~1/fraction clicks before it's
 * exhausted. 0.25 ⇒ a click never costs more than a quarter of the day's spend.
 */
export const MAX_CLICK_BUDGET_FRACTION = 0.25;

/**
 * Absolute floor for the Max-CPC ceiling. Below roughly $0.40 a search ad almost
 * never clears the auction, so even a tiny budget shouldn't bid lower than this —
 * it just means the budget affords fewer clicks (which we flag separately).
 */
export const MIN_CPC_CEILING_MICROS = 400_000; // $0.40

/**
 * Match-type tiers, expressed as the estimated number of clicks the daily budget
 * buys at the representative market CPC:
 *   - >= BROAD_MIN_CLICKS  → BROAD  (enough headroom to let Maximize Clicks roam)
 *   - >= PHRASE_MIN_CLICKS → PHRASE (moderate budget; keep some breadth, more control)
 *   - <  PHRASE_MIN_CLICKS → EXACT  (thin budget; only the highest-intent traffic)
 */
export const BROAD_MIN_CLICKS = 8;
export const PHRASE_MIN_CLICKS = 3;

/** Keyword-count caps per match type, so a thin budget isn't sprayed too thin. */
export const EXACT_MAX_KEYWORDS = 10;
export const PHRASE_MAX_KEYWORDS = 15;
export const BROAD_MAX_KEYWORDS = 20;

// ── Types ────────────────────────────────────────────────────────────────────

export type KeywordMatchType = 'BROAD' | 'PHRASE' | 'EXACT';
export type CompetitionLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';

/** Per-keyword market data as returned by Google's Keyword Plan service. */
export interface KeywordMetric {
  text: string;
  avgMonthlySearches: number | null;
  competition: CompetitionLevel;
  /** Low end of the "first page" / top-of-page bid range, in micros. */
  lowTopOfPageBidMicros: number | null;
  /** High end of the top-of-page bid range, in micros. */
  highTopOfPageBidMicros: number | null;
}

/** Aggregated market view used to drive bidding decisions. */
export interface MarketCpcEstimate {
  source: 'google_keyword_plan' | 'heuristic';
  /** Representative expected CPC (micros) — drives the clicks/day calibration. */
  representativeCpcMicros: number;
  /** Most expensive top-of-page bid across the set (micros), or null. */
  maxTopOfPageBidMicros: number | null;
  /** Cheapest top-of-page bid across the set (micros), or null. */
  minTopOfPageBidMicros: number | null;
  perKeyword: KeywordMetric[];
}

/** The deploy-ready bidding plan. */
export interface BiddingPlan {
  strategy: 'MAXIMIZE_CLICKS';
  /** Max-CPC ceiling for the Maximize Clicks strategy, in micros. */
  cpcBidCeilingMicros: number;
  matchType: KeywordMatchType;
  /** Keywords reordered (long-tail first) and trimmed to the match-type cap. */
  keywords: string[];
  /** How many of the original keywords were dropped during calibration. */
  droppedKeywordCount: number;
  /** Estimated clicks/day the budget buys at the representative CPC. */
  estimatedClicksPerDay: number;
  representativeCpcMicros: number;
  estimateSource: MarketCpcEstimate['source'];
  /** Human-readable flags for ops (empty when the config is healthy). */
  warnings: string[];
}

// ── Small numeric helpers ────────────────────────────────────────────────────

function median(nums: number[]): number | null {
  const xs = nums.filter(n => typeof n === 'number' && isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : Math.round((xs[mid - 1] + xs[mid]) / 2);
}

function wordCount(keyword: string): number {
  return keyword.trim().split(/\s+/).filter(Boolean).length;
}

function fmtMicros(micros: number): string {
  return `$${(micros / MICROS_PER_DOLLAR).toFixed(2)}`;
}

function fmtCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Round a cents amount up to the next whole dollar — keeps recommendations clean. */
function roundUpToDollarCents(cents: number): number {
  return Math.ceil(cents / 100) * 100;
}

// ── Market estimate aggregation (pure; fed by the Google client) ──────────────

/**
 * Collapse per-keyword market metrics into a single estimate. Returns null when
 * there is no usable bid data (caller then falls back to {@link heuristicEstimate}).
 *
 * `representativeCpcMicros` is the median of each keyword's mid-bid
 * ((low + high) / 2). The median resists a single sky-high head term skewing the
 * whole calibration, which matters because broad campaigns often mix one generic
 * term with several cheaper long-tail ones.
 */
export function summarizeKeywordMetrics(metrics: KeywordMetric[]): MarketCpcEstimate | null {
  if (!metrics.length) return null;

  const midBids: number[] = [];
  const highs: number[] = [];
  const lows: number[] = [];
  for (const m of metrics) {
    const low = m.lowTopOfPageBidMicros;
    const high = m.highTopOfPageBidMicros;
    if (typeof low === 'number' && low > 0) lows.push(low);
    if (typeof high === 'number' && high > 0) highs.push(high);
    if (typeof low === 'number' && low > 0 && typeof high === 'number' && high > 0) {
      midBids.push(Math.round((low + high) / 2));
    } else if (typeof high === 'number' && high > 0) {
      // A lone high bid is the TOP of the first-page range, not a mid-point —
      // pull it toward a representative mid so it doesn't bias the median upward.
      midBids.push(Math.round(high * 0.6));
    } else if (typeof low === 'number' && low > 0) {
      midBids.push(low);
    }
  }

  const representative = median(midBids);
  if (representative == null) return null; // no bid data at all → heuristic

  return {
    source: 'google_keyword_plan',
    representativeCpcMicros: representative,
    maxTopOfPageBidMicros: highs.length ? Math.max(...highs) : null,
    minTopOfPageBidMicros: lows.length ? Math.min(...lows) : null,
    perKeyword: metrics,
  };
}

/**
 * Fallback estimate when Google returns no keyword data (mock mode, a brand-new
 * sub-account with no Keyword Plan access, an API error, or no geo target).
 *
 * Without real bids we proxy competitiveness from keyword specificity: short,
 * generic head terms ("plumber") pull expensive, broad traffic, while multi-word
 * long-tail terms ("emergency plumber near me") are cheaper and higher-intent.
 * This is deliberately conservative for local-service niches and is always
 * labelled `heuristic` so ops knows the confidence is low.
 */
export function heuristicEstimate(keywords: string[]): MarketCpcEstimate {
  const counts = keywords.map(wordCount).filter(n => n > 0);
  const medianWords = median(counts) ?? 2;

  // Representative CPC by median keyword length (micros).
  let representative: number;
  if (medianWords <= 2) representative = 8_000_000;       // $8.00 — generic/head terms
  else if (medianWords === 3) representative = 4_000_000; // $4.00 — moderate
  else representative = 2_000_000;                         // $2.00 — long-tail

  return {
    source: 'heuristic',
    representativeCpcMicros: representative,
    maxTopOfPageBidMicros: Math.round(representative * 2.5), // head terms can spike
    minTopOfPageBidMicros: Math.round(representative * 0.5),
    perKeyword: [],
  };
}

// ── Core decisions (pure) ─────────────────────────────────────────────────────

/**
 * Max-CPC ceiling for the Maximize Clicks strategy.
 *
 * The original (naive) ceiling was simply 25% of the daily budget. That re-created
 * the very bug we set out to fix: on a $14/day budget in an $18-CPC niche the cap
 * lands at $3.50 — far below the ~$12 first-page bid — so under Maximize Clicks the
 * ad never clears the auction (zero impressions), exactly like the old flat $1 bid.
 *
 * So the ceiling is composed in two competing directions:
 *   - PROTECT: start at {@link MAX_CLICK_BUDGET_FRACTION} of the daily budget so a
 *     single click can't drain the day when traffic is cheap.
 *   - COMPETE: lift the ceiling up to the cheapest first-page bid
 *     (minTopOfPageBidMicros) so the ad can actually enter the auction — even when
 *     that exceeds the protective fraction. A thin budget that forces this is
 *     flagged loudly (see buildWarnings) rather than silently locked out.
 *
 * Then it is bounded: never above the priciest top-of-page bid (no extra clicks to
 * be won past the top of the page), never above a full day's budget (a single click
 * shouldn't be allowed to overspend the day), and never below the absolute floor
 * where ads stop serving at all.
 */
export function computeBidCeilingMicros(dailyBudgetMicros: number, estimate: MarketCpcEstimate): number {
  // PROTECT: a single click ≤ a fraction of the day when traffic is cheap.
  let ceiling = Math.round(dailyBudgetMicros * MAX_CLICK_BUDGET_FRACTION);

  // COMPETE: lift to the cheapest first-page bid so the ad can enter the auction.
  if (estimate.minTopOfPageBidMicros && estimate.minTopOfPageBidMicros > 0) {
    ceiling = Math.max(ceiling, estimate.minTopOfPageBidMicros);
  }

  // No point bidding above the priciest top-of-page bid.
  if (estimate.maxTopOfPageBidMicros && estimate.maxTopOfPageBidMicros > 0) {
    ceiling = Math.min(ceiling, estimate.maxTopOfPageBidMicros);
  }
  // A single click should never be allowed to overspend the whole day's budget.
  if (dailyBudgetMicros > 0) {
    ceiling = Math.min(ceiling, dailyBudgetMicros);
  }

  // Always bid at least enough to serve.
  return Math.max(ceiling, MIN_CPC_CEILING_MICROS);
}

/** Pick the match type from the estimated clicks/day the budget supports. */
export function calibrateMatchType(estimatedClicksPerDay: number): KeywordMatchType {
  if (estimatedClicksPerDay >= BROAD_MIN_CLICKS) return 'BROAD';
  if (estimatedClicksPerDay >= PHRASE_MIN_CLICKS) return 'PHRASE';
  return 'EXACT';
}

/**
 * Reorder keywords long-tail-first (more words ⇒ more specific ⇒ cheaper &
 * higher-intent) and trim to the cap for the chosen match type. Ordering is
 * stable so equally-specific keywords keep the AI's original priority.
 */
export function prioritizeKeywords(keywords: string[], matchType: KeywordMatchType): string[] {
  const cleaned = keywords.map(k => k.trim()).filter(Boolean);
  const ranked = cleaned
    .map((text, index) => ({ text, index, words: wordCount(text), len: text.length }))
    .sort((a, b) => (b.words - a.words) || (b.len - a.len) || (a.index - b.index))
    .map(k => k.text);

  const cap =
    matchType === 'EXACT' ? EXACT_MAX_KEYWORDS :
    matchType === 'PHRASE' ? PHRASE_MAX_KEYWORDS :
    BROAD_MAX_KEYWORDS;

  // Trim to the match-type cap; never pad beyond what we actually have.
  return ranked.slice(0, Math.min(ranked.length, cap));
}

/** Daily budget (cents) needed to afford `targetClicks` at the estimate's CPC. */
export function recommendedDailyBudgetCents(estimate: MarketCpcEstimate, targetClicks: number): number {
  const cents = (estimate.representativeCpcMicros * targetClicks) / MICROS_PER_CENT;
  return roundUpToDollarCents(Math.ceil(cents));
}

/**
 * Produce the full bidding plan for a search campaign.
 *
 * @param dailyBudgetCents Raw ad-spend budget/day sent to Google (NOT the
 *   customer-facing bundled number).
 * @param keywords The AI-generated target keywords.
 * @param estimate Live market data, or null to fall back to the heuristic.
 */
export function planSearchBidding(opts: {
  dailyBudgetCents: number;
  keywords: string[];
  estimate: MarketCpcEstimate | null;
}): BiddingPlan {
  const dailyBudgetCents = Math.max(0, Math.round(opts.dailyBudgetCents || 0));
  const dailyBudgetMicros = dailyBudgetCents * MICROS_PER_CENT;
  const keywords = opts.keywords.map(k => k.trim()).filter(Boolean);

  const estimate = opts.estimate ?? heuristicEstimate(keywords);
  const repCpc = estimate.representativeCpcMicros;

  const cpcBidCeilingMicros = computeBidCeilingMicros(dailyBudgetMicros, estimate);
  const estimatedClicksPerDay = repCpc > 0 ? dailyBudgetMicros / repCpc : 0;
  const matchType = calibrateMatchType(estimatedClicksPerDay);
  const prioritized = prioritizeKeywords(keywords, matchType);
  const droppedKeywordCount = Math.max(0, keywords.length - prioritized.length);

  const warnings = buildWarnings({
    dailyBudgetCents,
    estimatedClicksPerDay,
    matchType,
    estimate,
    cpcBidCeilingMicros,
    droppedKeywordCount,
  });

  return {
    strategy: 'MAXIMIZE_CLICKS',
    cpcBidCeilingMicros,
    matchType,
    keywords: prioritized,
    droppedKeywordCount,
    estimatedClicksPerDay,
    representativeCpcMicros: repCpc,
    estimateSource: estimate.source,
    warnings,
  };
}

/** Budget-only ceiling for display campaigns (no keyword market data applies). */
export function planDisplayBidding(opts: { dailyBudgetCents: number }): { cpcBidCeilingMicros: number } {
  const dailyBudgetMicros = Math.max(0, Math.round(opts.dailyBudgetCents || 0)) * MICROS_PER_CENT;
  const cpcBidCeilingMicros = Math.max(
    MIN_CPC_CEILING_MICROS,
    Math.round(dailyBudgetMicros * MAX_CLICK_BUDGET_FRACTION),
  );
  return { cpcBidCeilingMicros };
}

// ── Warning copy ─────────────────────────────────────────────────────────────

function buildWarnings(opts: {
  dailyBudgetCents: number;
  estimatedClicksPerDay: number;
  matchType: KeywordMatchType;
  estimate: MarketCpcEstimate;
  cpcBidCeilingMicros: number;
  droppedKeywordCount: number;
}): string[] {
  const { dailyBudgetCents, estimatedClicksPerDay, matchType, estimate, cpcBidCeilingMicros, droppedKeywordCount } = opts;
  const warnings: string[] = [];

  const dailyBudgetMicros = dailyBudgetCents * MICROS_PER_CENT;
  const cpc = fmtMicros(estimate.representativeCpcMicros);
  const daily = fmtCents(dailyBudgetCents);
  const clicks = estimatedClicksPerDay.toFixed(1);
  const sourceNote = estimate.source === 'google_keyword_plan'
    ? 'Google Keyword Planner'
    : 'an internal estimate (no live keyword data)';

  const recPhrase = fmtCents(recommendedDailyBudgetCents(estimate, PHRASE_MIN_CLICKS));
  const recBroad = fmtCents(recommendedDailyBudgetCents(estimate, BROAD_MIN_CLICKS));

  if (estimatedClicksPerDay < 1) {
    warnings.push(
      `Budget too small for this niche: at an estimated CPC of ${cpc} (${sourceNote}), ${daily}/day affords ~${clicks} clicks/day. ` +
      `Deployed with ${matchType} match on long-tail keywords to compete for the cheapest traffic, but volume will be minimal. ` +
      `Raise the daily budget to ~${recPhrase} (≈${PHRASE_MIN_CLICKS} clicks/day) or ${recBroad} (≈${BROAD_MIN_CLICKS} clicks/day) for meaningful reach.`,
    );
  } else if (estimatedClicksPerDay < PHRASE_MIN_CLICKS) {
    warnings.push(
      `Thin budget for this niche: ~${clicks} clicks/day at an estimated CPC of ${cpc} (${sourceNote}). ` +
      `Tightened keyword match to ${matchType} and prioritized long-tail terms to stretch the budget. ` +
      `Consider raising the daily budget to ~${recPhrase}–${recBroad} for steadier volume.`,
    );
  } else if (estimatedClicksPerDay < BROAD_MIN_CLICKS) {
    warnings.push(
      `Moderate budget: ~${clicks} clicks/day at an estimated CPC of ${cpc} (${sourceNote}). ` +
      `Using ${matchType} match to keep spend controlled; raising the daily budget toward ~${recBroad} would unlock broad-match volume.`,
    );
  }

  // Auction-entry check: if even the protective ceiling can't reach the cheapest
  // first-page bid, the ad essentially can't enter the auction — name that
  // explicitly (this is the exact zero-impression failure mode we set out to fix).
  const floorMicros = estimate.minTopOfPageBidMicros && estimate.minTopOfPageBidMicros > 0
    ? estimate.minTopOfPageBidMicros
    : null;
  if (floorMicros && cpcBidCeilingMicros < floorMicros) {
    warnings.push(
      `Max-CPC ceiling ${fmtMicros(cpcBidCeilingMicros)} is below the cheapest first-page bid (${fmtMicros(floorMicros)}) for this niche — ` +
      `the ${daily}/day budget is too small to bid competitively, so the ad may win close to zero impressions until the budget is raised (suggested ${recPhrase}–${recBroad}).`,
    );
  }

  if (droppedKeywordCount > 0) {
    warnings.push(
      `Trimmed ${droppedKeywordCount} of the broadest keyword${droppedKeywordCount === 1 ? '' : 's'} to concentrate the budget on the highest-intent terms.`,
    );
  }

  if (estimate.source === 'heuristic' && warnings.length > 0) {
    warnings.push('Note: market CPC could not be fetched from Google, so these figures are approximate. Re-check once the campaign has live data.');
  }

  // Always record the protective ceiling so ops can see the cap that was applied.
  // The % is computed from the ACTUAL ceiling vs the budget (the floor/market/day
  // clamps mean it isn't always the nominal 25%).
  const ceilingPct = dailyBudgetMicros > 0
    ? Math.round((cpcBidCeilingMicros / dailyBudgetMicros) * 100)
    : null;
  warnings.unshift(
    ceilingPct != null
      ? `Bidding: Maximize Clicks with a Max-CPC ceiling of ${fmtMicros(cpcBidCeilingMicros)} (≈${ceilingPct}% of the ${daily}/day budget per click).`
      : `Bidding: Maximize Clicks with a Max-CPC ceiling of ${fmtMicros(cpcBidCeilingMicros)}.`,
  );

  return warnings;
}
