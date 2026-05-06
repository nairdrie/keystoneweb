-- Migration: Unsplash attribution columns
--
-- Per Unsplash API Terms §9, every displayed Unsplash photo must carry a
-- visible "Photo by {name} on Unsplash" credit with both names linked. We
-- already capture this attribution at the picker (ImageEditorModal) for
-- editor-driven block content; the database-driven content blocks (blog
-- posts, events, menu items, products) need a place to persist it
-- alongside the URL.
--
-- A nullable JSONB column keeps the schema minimal and flexible. The
-- expected shape is { photographerName, photographerUrl, unsplashUrl }
-- matching the UnsplashAttribution type in lib/unsplash/types.ts. NULL
-- means the image is not from Unsplash, or attribution is unknown — the
-- renderer's URL-based fallback (lib/unsplash/attribution-map.ts) covers
-- the unknown-but-Unsplash case for the photo IDs we ship hardcoded.
--
-- Existing rows are unaffected; columns default to NULL. RLS policies
-- already operate at the row level and need no change.

ALTER TABLE public.blog_posts
    ADD COLUMN IF NOT EXISTS cover_image_attribution jsonb;

ALTER TABLE public.events
    ADD COLUMN IF NOT EXISTS image_attribution jsonb;

ALTER TABLE public.menu_items
    ADD COLUMN IF NOT EXISTS image_attribution jsonb;

-- products.images is already a JSONB array of URLs. We store a parallel
-- JSONB array of attribution objects (or nulls) at the same indices.
-- Using a separate column keeps the existing array untouched and
-- backwards-compatible with existing read paths.
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS images_attribution jsonb DEFAULT '[]'::jsonb;
