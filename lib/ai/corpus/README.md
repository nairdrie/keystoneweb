# AI Builder — Site Corpus (RAG seed)

A curated corpus of **gold-standard example sites** for the AI website builder. This is the
reference material the builder retrieves from to produce more **beautiful, specific, and
varied** output — the fix for the "every generated site is bland and looks the same" problem.

## What's here

- `sites/*.json` — 12 complete example sites, each expressed in the builder's own block
  schema (`blockType` + `data`), so they map directly onto orchestrator operations
  (`replaceBlocks` / `createPages`) and onto the prompts in `lib/ai/builder-schema.ts`.
- `manifest.json` — a retrieval index: per-site metadata (category, style family, palette,
  fonts, tone, tags, per-page block structure) plus an `embedText` blob ready to embed.

## How it was generated

Produced by the `synthetic-site-corpus-gen` workflow: a fleet of **Opus** agents, one per
`(category × style × structure)` combo, each running **author → adversarial design-critique →
revise**. This deliberately beats the one-shot Sonnet runtime call on quality, and every site
was authored against the real block schema extracted from `lib/ai/block-capabilities.ts`.

Two properties are baked in **by construction**:

- **Diversity** — distinct category, palette, fonts, hero treatment, and *block ordering* per
  site (see each site's `metadata.structureNotes`, which explains how it deviates from the
  generic `hero → services → testimonials → cta` template). This is what will teach the
  retriever to break out of the fixed skeleton in `lib/ai/site-architecture.ts`.
- **Depth** — every block meets or exceeds the `CONTENT_DEPTH_RULES` minimums
  (servicesGrid 4–6, faq 5–8, testimonials 3–5, pricing 3 tiers, …). Unlike the existing
  `template_metadata` corpus (which is *thinner* than the rules), these are safe to use as
  few-shot exemplars.

## Coverage

12 sites across: bakery, legal, wellness, coffee, dental, photographer, saas, restaurant,
fitness, landscaping, nonprofit, handmade — spanning services / products / portfolio /
nonprofit / food / booking business types, and 11 distinct visual style families.

## Site JSON shape

```jsonc
{
  "slug": "...", "category": "...", "businessType": "...",
  "styleFamily": "...", "siteTitle": "...", "voice": "...",
  "designTokens": {
    "customColors": { "primary": "#dark-text", "secondary": "#brand", "accent": "#light-bg" },
    "fonts": { "heading": "...", "body": "..." },
    "headerConfig": { "bgType": "...", "logoPosition": "...", ... },
    "paletteMood": "..."
  },
  "pages": [ { "slug": "home", "role": "home", "blocks": [ { "blockType": "...", "data": { ... } } ] } ],
  "metadata": { "tone": "...", "structureNotes": "...", "tags": ["..."] }
}
```

## Known limitations (honest)

- **Images are intentionally empty.** Sites leave image URLs blank; the builder fills
  prompt-aware sample media after generation. Visual impact depends on that step.
- **Admin-backed records (products, menu items, booking services)** are described in copy but
  seeded separately — a bakery's "signature bakes" render only once the admin seeds matching
  items. This mirrors how the live builder works.
- **Header config is site-wide**, so a few interior pages inherit a header tuned for the home
  hero. Noted per-site in the workflow's `remainingWeaknesses`.

## Next steps (the RAG build)

1. **Embed** each site's `embedText` (Voyage or OpenAI `text-embedding-3` — Anthropic has no
   embeddings API) into a `pgvector` table on Supabase.
2. **Retrieve** at build time by the wizard brief: hybrid (vector + category filter) + **MMR**
   for diversity + light stochastic sampling so two similar briefs diverge.
3. **Inject** the retrieved exemplar(s) into the plan/home/page prompts in
   `lib/ai/builder-schema.ts`, and/or lift design-token bundles directly as
   `setCustomColors` / `setFont` / `setHeaderConfig` ops.
4. **Unlock the skeleton** in `lib/ai/site-architecture.ts` so retrieved structural variety
   can actually surface.

## Editing / extending

These are meant to be **hand-edited** — tighten copy, adjust tokens, fix structure. To add
more, re-run the generator workflow (`scratchpad/corpus-gen.mjs`) with new combos, or author
new `sites/*.json` by hand and regenerate `manifest.json`.
