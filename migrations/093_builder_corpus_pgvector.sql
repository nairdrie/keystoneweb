-- 093_builder_corpus_pgvector.sql
-- RAG corpus for the AI website builder: curated example sites distilled into
-- structure + design tokens + copy samples, embedded for nearest-neighbour
-- retrieval at generation time.
--
-- IMPORTANT: the vector dimension below MUST match RAG_EMBED_DIM / the embedding
-- model in lib/ai/rag/embeddings.ts. Default is 1536 (OpenAI text-embedding-3-small).
-- If you switch to Voyage (voyage-3 = 1024), change every vector(1536) here to
-- vector(1024), re-run this migration, and re-index (npm run rag:index).

create extension if not exists vector;

create table if not exists public.builder_corpus (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,
  category       text not null default 'general',
  business_type  text not null default 'services',
  style_family   text,
  tags           text[] not null default '{}',
  embed_text     text not null,
  payload        jsonb not null default '{}'::jsonb,
  embedding      vector(1536),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists builder_corpus_category_idx on public.builder_corpus (category);

-- HNSW works well without a training step and suits a small, occasionally-updated
-- corpus. (ivfflat would need ANALYZE and enough rows to be useful.)
create index if not exists builder_corpus_embedding_idx
  on public.builder_corpus using hnsw (embedding vector_cosine_ops);

-- Internal-only table. Enable RLS with no public policy so only the service role
-- (createAdminClient) can read/write it — the corpus is never client-exposed.
alter table public.builder_corpus enable row level security;

-- Similarity search used by lib/ai/rag/retrieval.ts. Returns the candidate's
-- embedding too so MMR re-ranking can run client-side.
create or replace function public.match_builder_corpus(
  query_embedding vector(1536),
  match_count     int default 24,
  filter_category text default null
)
returns table (
  slug          text,
  category      text,
  business_type text,
  style_family  text,
  tags          text[],
  payload       jsonb,
  similarity    float,
  embedding     vector(1536)
)
language sql
stable
as $$
  select
    c.slug,
    c.category,
    c.business_type,
    c.style_family,
    c.tags,
    c.payload,
    1 - (c.embedding <=> query_embedding) as similarity,
    c.embedding
  from public.builder_corpus c
  where c.embedding is not null
    and (filter_category is null or c.category = filter_category)
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
