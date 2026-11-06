-- Migration 096: agent-built sites — stale-write protection + platform colours
--
-- v2_content.rev: per-field revision, bumped on every write. Writers update
-- "WHERE rev = <the rev they read>"; a mismatch means someone else changed the
-- field first, so the write is rejected instead of silently overwriting it.
-- (v2_sections, v2_themes and v2_page_layouts already carry `version`.)
--
-- v2_themes.platform: which theme tokens Keystone's own flows (cart, checkout,
-- booking, product pages) use for their colours, e.g.
--   { "primary": "brand", "secondary": "ink", "accent": "paper" }

ALTER TABLE public.v2_content
  ADD COLUMN IF NOT EXISTS rev integer NOT NULL DEFAULT 1;

ALTER TABLE public.v2_themes
  ADD COLUMN IF NOT EXISTS platform jsonb NOT NULL DEFAULT '{}'::jsonb;
