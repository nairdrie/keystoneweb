/**
 * Shared types for the retrieval-augmented builder (RAG).
 *
 * A "corpus exemplar" is one curated example site distilled into the pieces
 * the builder actually needs at generation time: its page/block STRUCTURE, its
 * DESIGN TOKENS, and a few COPY samples. The full source sites live in
 * lib/ai/corpus/sites/*.json; the indexing script (scripts/index-builder-corpus.mjs)
 * distills each into this shape, embeds it, and stores it in the builder_corpus
 * pgvector table.
 */

export interface CorpusStructurePage {
  slug: string;
  title: string;
  displayName: string;
  role: string;
  /** Ordered list of internal block types on this page (e.g. ["hero","servicesGrid",...]). */
  blockTypes: string[];
}

export interface CorpusDesignTokens {
  customColors?: { primary?: string; secondary?: string; accent?: string };
  fonts?: { heading?: string; body?: string };
  headerConfig?: Record<string, unknown>;
  paletteMood?: string;
}

/** A compact copy sample lifted from the source site, one per notable block type. */
export interface CorpusCopyExemplar {
  blockType: string;
  sample: string;
}

/** The distilled, embeddable unit stored in builder_corpus.payload. */
export interface CorpusExemplar {
  slug: string;
  category: string;
  businessType: string;
  styleFamily: string;
  siteTitle: string;
  voice: string;
  tone?: string;
  tags: string[];
  structureNotes?: string;
  pages: CorpusStructurePage[];
  designTokens: CorpusDesignTokens;
  copyExemplars: CorpusCopyExemplar[];
}

export interface RetrievedExemplar extends CorpusExemplar {
  /** Cosine similarity to the query in [0,1]. */
  similarity: number;
}

export interface RetrievalInput {
  description: string;
  category?: string | null;
  businessType?: string | null;
  styleLabels?: string[] | null;
  pageLabels?: string[] | null;
  extras?: string | null;
}

export interface RetrievalResult {
  /** Primary exemplar used to seed structure + design tokens (null when nothing retrieved). */
  primary: RetrievedExemplar | null;
  /** The diverse top-k (includes primary) used as few-shot copy references. */
  exemplars: RetrievedExemplar[];
}
