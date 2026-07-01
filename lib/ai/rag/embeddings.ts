/**
 * Pluggable embedding client for the RAG builder.
 *
 * Anthropic (the builder's generation provider) has NO embeddings API, so the
 * embedder targets a dedicated provider selected by env. Defaults to OpenAI
 * `text-embedding-3-small` because the project already has an OpenAI-compatible
 * key path; Voyage (Anthropic's recommended embedding partner) is also supported.
 *
 * Env:
 *   RAG_EMBED_PROVIDER   'openai' | 'voyage'   (default 'openai')
 *   RAG_EMBED_API_KEY    api key (falls back to OPENAI_API_KEY / VOYAGE_API_KEY)
 *   RAG_EMBED_MODEL      model id (default per provider)
 *   RAG_EMBED_DIM        vector dimension (default per provider) — MUST match the
 *                        `vector(N)` dimension in migration 093 and match_builder_corpus.
 *
 * IMPORTANT: if you switch provider/model, the embedding dimension usually changes
 * (OpenAI small=1536, Voyage voyage-3=1024). Re-run the migration with the matching
 * dimension and re-index (`npm run rag:index`).
 */

const EMBED_FETCH_TIMEOUT_MS = 30_000;

export type EmbedProvider = 'openai' | 'voyage';

interface ProviderDefaults {
  model: string;
  dim: number;
  url: string;
}

const PROVIDER_DEFAULTS: Record<EmbedProvider, ProviderDefaults> = {
  openai: { model: 'text-embedding-3-small', dim: 1536, url: 'https://api.openai.com/v1/embeddings' },
  voyage: { model: 'voyage-3', dim: 1024, url: 'https://api.voyageai.com/v1/embeddings' },
};

export function getEmbedProvider(): EmbedProvider {
  const p = (process.env.RAG_EMBED_PROVIDER || 'openai').toLowerCase();
  return p === 'voyage' ? 'voyage' : 'openai';
}

function getApiKey(provider: EmbedProvider): string | undefined {
  return (
    process.env.RAG_EMBED_API_KEY ||
    (provider === 'voyage' ? process.env.VOYAGE_API_KEY : process.env.OPENAI_API_KEY) ||
    undefined
  );
}

export function getEmbedModel(provider: EmbedProvider = getEmbedProvider()): string {
  return process.env.RAG_EMBED_MODEL || PROVIDER_DEFAULTS[provider].model;
}

export function getEmbedDim(provider: EmbedProvider = getEmbedProvider()): number {
  const fromEnv = process.env.RAG_EMBED_DIM ? parseInt(process.env.RAG_EMBED_DIM, 10) : NaN;
  return Number.isFinite(fromEnv) ? fromEnv : PROVIDER_DEFAULTS[provider].dim;
}

/** True when an embedding key is configured — retrieval no-ops safely when false. */
export function isEmbeddingConfigured(): boolean {
  return Boolean(getApiKey(getEmbedProvider()));
}

/**
 * Embed a batch of texts. Returns one vector per input, in order.
 * Throws on transport/API errors — callers in the build path must catch and
 * fall back to the non-RAG pipeline.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const provider = getEmbedProvider();
  const apiKey = getApiKey(provider);
  if (!apiKey) throw new Error('RAG embeddings not configured (missing RAG_EMBED_API_KEY)');

  const model = getEmbedModel(provider);
  const { url } = PROVIDER_DEFAULTS[provider];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EMBED_FETCH_TIMEOUT_MS);
  try {
    const body: Record<string, unknown> = { model, input: texts };
    if (provider === 'voyage') body.input_type = 'document';

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Embedding API ${res.status} (${provider}): ${errBody.slice(0, 300)}`);
    }

    const data = await res.json();
    const rows: Array<{ embedding: number[]; index?: number }> = data.data || [];
    // Both OpenAI and Voyage return data[] with an embedding array; keep input order.
    const ordered = rows
      .slice()
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .map((r) => r.embedding);
    return ordered;
  } finally {
    clearTimeout(timer);
  }
}

/** Embed a single query string. */
export async function embedQuery(text: string): Promise<number[]> {
  const [vec] = await embedTexts([text]);
  return vec;
}
