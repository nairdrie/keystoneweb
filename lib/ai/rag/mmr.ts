/**
 * Maximal Marginal Relevance (MMR) + cosine helpers.
 *
 * Naive top-k retrieval returns the k items most similar to the query — which,
 * for near-identical briefs ("a plumber", "another plumber"), returns the SAME
 * items every time and produces same-y sites. MMR instead balances relevance to
 * the query against diversity from what's already been picked, so two similar
 * briefs can diverge. This is the core anti-sameness mechanism on the retrieval
 * side (paired with light stochastic selection in retrieval.ts).
 *
 * Pure and dependency-free so it can be unit-tested in isolation.
 */

export function dot(a: number[], b: number[]): number {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) sum += a[i] * b[i];
  return sum;
}

export function norm(a: number[]): number {
  return Math.sqrt(dot(a, a));
}

export function cosineSim(a: number[], b: number[]): number {
  const denom = norm(a) * norm(b);
  if (denom === 0) return 0;
  return dot(a, b) / denom;
}

export interface MmrCandidate {
  embedding: number[];
  /** Precomputed similarity to the query (0..1). If omitted it's derived from the query. */
  queryScore?: number;
}

export interface MmrOptions {
  /** Number of items to select. */
  k: number;
  /** Relevance vs. diversity tradeoff in [0,1]. Higher = more relevant, lower = more diverse. */
  lambda?: number;
}

/**
 * Select up to `k` diverse-but-relevant candidate indices via MMR.
 * Returns indices into `candidates`, ordered by selection.
 */
export function mmrSelect(
  queryEmbedding: number[],
  candidates: MmrCandidate[],
  { k, lambda = 0.6 }: MmrOptions,
): number[] {
  const n = candidates.length;
  if (n === 0) return [];
  const want = Math.min(k, n);

  const relevance = candidates.map((c) =>
    typeof c.queryScore === 'number' ? c.queryScore : cosineSim(queryEmbedding, c.embedding),
  );

  const selected: number[] = [];
  const remaining = new Set<number>(candidates.map((_, i) => i));

  while (selected.length < want && remaining.size > 0) {
    let bestIdx = -1;
    let bestScore = -Infinity;

    for (const i of remaining) {
      // Max similarity of candidate i to anything already selected.
      let maxSimToSelected = 0;
      for (const j of selected) {
        const sim = cosineSim(candidates[i].embedding, candidates[j].embedding);
        if (sim > maxSimToSelected) maxSimToSelected = sim;
      }
      const mmr = lambda * relevance[i] - (1 - lambda) * maxSimToSelected;
      if (mmr > bestScore) {
        bestScore = mmr;
        bestIdx = i;
      }
    }

    if (bestIdx === -1) break;
    selected.push(bestIdx);
    remaining.delete(bestIdx);
  }

  return selected;
}

/**
 * Weighted-random pick from the top `window` indices (already MMR-ordered), so
 * repeated identical briefs don't always land on the exact same primary exemplar.
 * Weights decay linearly by rank. `rng` defaults to Math.random (runtime only —
 * never call this from a workflow sandbox).
 */
export function stochasticPick(orderedIndices: number[], window = 3, rng: () => number = Math.random): number | null {
  if (orderedIndices.length === 0) return null;
  const pool = orderedIndices.slice(0, Math.min(window, orderedIndices.length));
  const weights = pool.map((_, i) => pool.length - i); // e.g. [3,2,1]
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[0];
}
