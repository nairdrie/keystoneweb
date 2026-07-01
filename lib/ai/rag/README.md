# AI Builder — RAG (retrieval-augmented generation)

Retrieval layer for the AI website builder. Given a wizard brief, it retrieves the
closest curated example site from a pgvector index and uses it to (1) seed a
**varied page/block structure**, (2) supply **coherent design tokens**, and
(3) act as a **copy/tone quality benchmark** injected into the generation prompts.

**Off by default.** With `AI_BUILDER_RAG` unset, `orchestrateNewSiteBuild` behaves
exactly as before. Nothing here runs unless the flag is on *and* embeddings are
configured, and retrieval never throws into a build (it falls back to the
deterministic pipeline on any error).

## How it fits together

```
wizard brief
   │
   ├─▶ retrieveSiteExemplar()                         (lib/ai/rag/retrieval.ts)
   │       embed brief ─▶ match_builder_corpus RPC ─▶ MMR + stochastic pick
   │
   ├─▶ buildArchitectureFromExemplar()                (lib/ai/site-architecture.ts)   ← Part B: unlocked skeleton
   │       exemplar page/block structure ─▶ SiteArchitecture (varies per site)
   │
   └─▶ prompts get renderExemplarForAi(exemplar)      (lib/ai/builder-schema.ts)
           tone/depth/design benchmark (adapt, never copy)
           + design tokens merged as setCustomColors/setFont/setHeaderConfig ops
```

Both builder entry points (`app/api/ai/builder/route.ts` and the lead→site flow in
`lib/leads/generate-site.ts`) call the orchestrator, so both get RAG for free.

## Files

| File | Role |
|------|------|
| `types.ts` | Shared `CorpusExemplar` / `RetrievedExemplar` shapes |
| `config.ts` | `isRagEnabled()` + tunables (`RAG_TOP_K`, `RAG_MMR_LAMBDA`, …) |
| `embeddings.ts` | Pluggable embedder (OpenAI / Voyage), used at query time |
| `mmr.ts` | Cosine + **Maximal Marginal Relevance** + stochastic pick (anti-sameness) |
| `retrieval.ts` | The retrieval entry point (`retrieveSiteExemplar`) |
| `../corpus/` | The seed corpus + `manifest.json` (source data) |
| `../../../migrations/093_builder_corpus_pgvector.sql` | pgvector table + `match_builder_corpus` RPC |
| `../../../scripts/index-builder-corpus.mjs` | Embeds the corpus and upserts rows (`npm run rag:index`) |

## Setup

1. **Apply the migration** (`migrations/093_builder_corpus_pgvector.sql`) to your
   Supabase/Postgres. It enables `vector`, creates `builder_corpus`, an HNSW index,
   and the `match_builder_corpus` RPC.

2. **Configure embeddings** (env):
   ```
   RAG_EMBED_PROVIDER=openai            # or voyage
   RAG_EMBED_API_KEY=sk-...             # or OPENAI_API_KEY / VOYAGE_API_KEY
   # RAG_EMBED_MODEL=text-embedding-3-small   (default per provider)
   ```
   ⚠️ The embedding dimension must match the `vector(N)` in migration 093.
   Defaults: OpenAI `text-embedding-3-small` = **1536**, Voyage `voyage-3` = **1024**.
   If you switch providers, update the migration's dimension and re-index.

3. **Index the corpus:**
   ```
   npm run rag:index
   ```
   Reads `lib/ai/corpus/`, distills + embeds each site, upserts into `builder_corpus`.
   Re-run whenever the corpus changes.

4. **Enable the feature:**
   ```
   AI_BUILDER_RAG=1
   ```

## Tunables (env)

| Var | Default | Meaning |
|-----|---------|---------|
| `RAG_CANDIDATE_POOL` | 24 | rows pulled from pgvector before MMR |
| `RAG_TOP_K` | 3 | diverse exemplars kept |
| `RAG_MMR_LAMBDA` | 0.6 | relevance↔diversity (higher = more relevant) |
| `RAG_STOCHASTIC_WINDOW` | 3 | weighted-random window for the primary pick |

## Why MMR + stochastic selection

Naive top-k returns the *same* nearest neighbours for similar briefs → same-y
sites. MMR selects results that are relevant **and** mutually diverse, and the
primary exemplar is chosen by weighted-random over the top MMR results, so two
"a plumber" briefs can land on different references and diverge. This is the
retrieval-side half of the anti-sameness fix; the other half is the unlocked
structure in `buildArchitectureFromExemplar`.

## Extending the corpus

Add/curate `lib/ai/corpus/sites/*.json`, regenerate `manifest.json`, and re-run
`npm run rag:index`. More diverse, high-quality sites → better and more varied
retrieval. See `lib/ai/corpus/README.md`.
