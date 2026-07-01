/**
 * RAG feature flag + tunables. The builder's retrieval path is OFF by default:
 * with the flag unset, orchestrateNewSiteBuild behaves exactly as before.
 */

export function isRagEnabled(): boolean {
  const v = (process.env.AI_BUILDER_RAG ?? process.env.RAG_ENABLED ?? '').toLowerCase();
  return v === '1' || v === 'true' || v === 'on';
}

export interface RagConfig {
  /** How many candidates to pull from pgvector before MMR re-selection. */
  candidatePool: number;
  /** How many diverse exemplars to keep as few-shot copy references. */
  topK: number;
  /** MMR relevance/diversity tradeoff (higher = more relevant). */
  lambda: number;
  /** Weighted-random window for primary-exemplar selection (anti-sameness). */
  stochasticWindow: number;
}

export function getRagConfig(): RagConfig {
  const int = (name: string, dflt: number) => {
    const v = process.env[name] ? parseInt(process.env[name] as string, 10) : NaN;
    return Number.isFinite(v) ? v : dflt;
  };
  const float = (name: string, dflt: number) => {
    const v = process.env[name] ? parseFloat(process.env[name] as string) : NaN;
    return Number.isFinite(v) ? v : dflt;
  };
  return {
    candidatePool: int('RAG_CANDIDATE_POOL', 24),
    topK: int('RAG_TOP_K', 3),
    lambda: float('RAG_MMR_LAMBDA', 0.6),
    stochasticWindow: int('RAG_STOCHASTIC_WINDOW', 3),
  };
}
