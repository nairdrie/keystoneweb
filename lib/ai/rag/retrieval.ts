/**
 * Retrieval entry point for the RAG builder.
 *
 * Given a wizard brief, embed it, pull a candidate pool from the builder_corpus
 * pgvector table via the match_builder_corpus RPC, then re-select a diverse
 * top-k with MMR and pick the primary exemplar with light stochastic weighting.
 *
 * Design choices for a SMALL corpus (~dozens of rows):
 *  - No hard category filter by default — with one row per category, an exact
 *    filter would usually return 0–1 rows. Pure semantic nearest-neighbour +
 *    MMR is more robust and is what makes "a florist" match the closest curated
 *    aesthetic even without a florist exemplar.
 *  - Everything is defensive: any misconfiguration or error returns an empty
 *    result so the builder falls back to its deterministic pipeline. Retrieval
 *    must NEVER break a build.
 */

import { createAdminClient } from '@/lib/db/supabase-admin';
import { embedQuery, isEmbeddingConfigured } from './embeddings';
import { mmrSelect, stochasticPick, type MmrCandidate } from './mmr';
import { getRagConfig, isRagEnabled } from './config';
import type { CorpusExemplar, RetrievalInput, RetrievalResult, RetrievedExemplar } from './types';

const EMPTY: RetrievalResult = { primary: null, exemplars: [] };

function buildQueryText(input: RetrievalInput): string {
  return [
    input.category,
    input.businessType,
    (input.styleLabels ?? []).join(' '),
    input.description,
    input.extras,
  ]
    .filter((v) => typeof v === 'string' && v.trim().length > 0)
    .join(' | ')
    .slice(0, 2000);
}

/** pgvector values can come back as a JSON array or a "[...]" string depending on transport. */
function parseEmbedding(value: unknown): number[] | null {
  if (Array.isArray(value)) return value as number[];
  if (typeof value === 'string') {
    try {
      const arr = JSON.parse(value);
      return Array.isArray(arr) ? (arr as number[]) : null;
    } catch {
      return null;
    }
  }
  return null;
}

interface MatchRow {
  slug: string;
  category: string;
  business_type: string;
  style_family: string | null;
  tags: string[] | null;
  payload: CorpusExemplar;
  similarity: number;
  embedding: unknown;
}

/**
 * Retrieve a primary structural/design exemplar plus a diverse set of copy
 * references for the given brief. Returns EMPTY when RAG is disabled,
 * unconfigured, the corpus is empty, or anything fails.
 */
export async function retrieveSiteExemplar(input: RetrievalInput): Promise<RetrievalResult> {
  if (!isRagEnabled() || !isEmbeddingConfigured()) return EMPTY;

  const cfg = getRagConfig();

  try {
    const queryText = buildQueryText(input);
    if (!queryText) return EMPTY;

    const queryEmbedding = await embedQuery(queryText);
    if (!queryEmbedding || queryEmbedding.length === 0) return EMPTY;

    const admin = createAdminClient();
    const { data, error } = await admin.rpc('match_builder_corpus', {
      // Supabase/PostgREST serializes the number[] and casts it to the vector arg.
      query_embedding: queryEmbedding,
      match_count: cfg.candidatePool,
      filter_category: null,
    });

    if (error) {
      console.error('[RAG] match_builder_corpus failed:', error.message);
      return EMPTY;
    }
    const rows = (data ?? []) as MatchRow[];
    if (rows.length === 0) return EMPTY;

    // Build MMR candidates. If an embedding fails to parse, fall back to its
    // query score only (diversity term contributes 0 for it).
    const candidates: MmrCandidate[] = rows.map((r) => ({
      embedding: parseEmbedding(r.embedding) ?? [],
      queryScore: typeof r.similarity === 'number' ? r.similarity : 0,
    }));

    const ordered = mmrSelect(queryEmbedding, candidates, { k: cfg.topK, lambda: cfg.lambda });
    if (ordered.length === 0) return EMPTY;

    // Primary: weighted-random among the top MMR results so near-identical
    // briefs don't always collapse to the same site.
    const primaryIdx = stochasticPick(ordered, cfg.stochasticWindow) ?? ordered[0];

    // Order the final exemplar list with the chosen primary first, then the
    // rest of the MMR selection (deduped).
    const finalOrder = [primaryIdx, ...ordered.filter((i) => i !== primaryIdx)];

    const exemplars: RetrievedExemplar[] = finalOrder
      .map((i) => {
        const r = rows[i];
        if (!r || !r.payload) return null;
        return { ...(r.payload as CorpusExemplar), similarity: r.similarity };
      })
      .filter((e): e is RetrievedExemplar => Boolean(e));

    if (exemplars.length === 0) return EMPTY;

    return { primary: exemplars[0], exemplars };
  } catch (err) {
    console.error('[RAG] retrieveSiteExemplar error:', err instanceof Error ? err.message : String(err));
    return EMPTY;
  }
}
