-- Migration 095: Agent-built sites (engine v2)
--
-- Adds a second site engine next to the existing block engine. Every existing
-- site keeps engine = 'blocks_v1' (the column default), so nothing about how
-- current sites are stored, edited or rendered changes.
--
-- A v2 site is three layers:
--   design    → v2_themes + v2_sections            (written by agents / staff)
--   content   → v2_content                          (written by the owner; agents seed it)
--   structure → pages (existing table) + v2_page_layouts
-- Publishing freezes all of it into an immutable v2_releases row that the
-- public renderer serves. Snapshots (restore points) use the same table.

-- ── Engine flag ─────────────────────────────────────────────────────────────
ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS engine text NOT NULL DEFAULT 'blocks_v1';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sites_engine_check'
  ) THEN
    ALTER TABLE public.sites
      ADD CONSTRAINT sites_engine_check CHECK (engine IN ('blocks_v1', 'sections_v2'));
  END IF;
END $$;

-- The release the live site serves (v2 only).
ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS v2_release_id uuid;

-- ── Design layer ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.v2_themes (
  site_id         uuid PRIMARY KEY REFERENCES public.sites(id) ON DELETE CASCADE,
  -- [{ name, value, label, group, type: color|font|length|text, editable }]
  tokens          jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- { tokenName: value } — the owner's Brand-panel changes, layered over tokens
  owner_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- extra Google Font families: [{ family, weights }]
  fonts           jsonb NOT NULL DEFAULT '[]'::jsonb,
  global_css      text  NOT NULL DEFAULT '',
  global_js       text  NOT NULL DEFAULT '',
  header_section  text,
  footer_section  text,
  version         integer NOT NULL DEFAULT 1,
  updated_by      text,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.v2_sections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  key         text NOT NULL,
  name        text NOT NULL,
  html        text NOT NULL DEFAULT '',
  css         text NOT NULL DEFAULT '',
  js          text NOT NULL DEFAULT '',
  -- compiled field schema + defaults (derived from html on every save)
  schema      jsonb NOT NULL DEFAULT '{}'::jsonb,
  version     integer NOT NULL DEFAULT 1,
  updated_by  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, key)
);

-- ── Structure ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.v2_page_layouts (
  page_id     uuid PRIMARY KEY REFERENCES public.pages(id) ON DELETE CASCADE,
  site_id     uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  -- ordered section instances: [{ id, section, hidden }]
  instances   jsonb NOT NULL DEFAULT '[]'::jsonb,
  version     integer NOT NULL DEFAULT 1,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS v2_page_layouts_site ON public.v2_page_layouts(site_id);

-- ── Content layer ───────────────────────────────────────────────────────────
-- One row per top-level field of a section instance. List fields hold the
-- whole array. Missing rows fall back to the section template's defaults.
CREATE TABLE IF NOT EXISTS public.v2_content (
  site_id       uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  instance_id   text NOT NULL,
  field         text NOT NULL,
  locale        text NOT NULL DEFAULT 'default',
  value         jsonb,
  -- once the owner edits a field, agents can't overwrite it without force
  owner_edited  boolean NOT NULL DEFAULT false,
  updated_by    text,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (site_id, instance_id, field, locale)
);

-- ── Releases & restore points ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.v2_releases (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('publish', 'snapshot')),
  label       text,
  manifest    jsonb NOT NULL,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS v2_releases_site_time ON public.v2_releases(site_id, created_at DESC);

-- ── Who changed what ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.v2_activity (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  actor_type  text NOT NULL CHECK (actor_type IN ('owner', 'agent', 'staff')),
  actor_label text,
  action      text NOT NULL,
  detail      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS v2_activity_site_time ON public.v2_activity(site_id, created_at DESC);

-- ── Personal access tokens (MCP / API) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text NOT NULL,
  token_prefix  text NOT NULL,           -- first characters, shown in the UI
  token_hash    text NOT NULL UNIQUE,    -- sha256 of the full token
  scopes        text[] NOT NULL DEFAULT ARRAY['sites:read', 'sites:write'],
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz,
  expires_at    timestamptz,
  revoked_at    timestamptz
);

CREATE INDEX IF NOT EXISTS api_tokens_user ON public.api_tokens(user_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- All reads and writes go through server routes that check site access and use
-- the service-role client. Owners may read their own rows directly.
ALTER TABLE public.v2_themes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_sections     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_page_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_content      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_releases     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_activity     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_tokens      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read v2_themes" ON public.v2_themes;
CREATE POLICY "Owners read v2_themes" ON public.v2_themes FOR SELECT
  USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Owners read v2_sections" ON public.v2_sections;
CREATE POLICY "Owners read v2_sections" ON public.v2_sections FOR SELECT
  USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Owners read v2_page_layouts" ON public.v2_page_layouts;
CREATE POLICY "Owners read v2_page_layouts" ON public.v2_page_layouts FOR SELECT
  USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Owners read v2_content" ON public.v2_content;
CREATE POLICY "Owners read v2_content" ON public.v2_content FOR SELECT
  USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Owners read v2_releases" ON public.v2_releases;
CREATE POLICY "Owners read v2_releases" ON public.v2_releases FOR SELECT
  USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Owners read v2_activity" ON public.v2_activity;
CREATE POLICY "Owners read v2_activity" ON public.v2_activity FOR SELECT
  USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users read own api_tokens" ON public.api_tokens;
CREATE POLICY "Users read own api_tokens" ON public.api_tokens FOR SELECT
  USING (user_id = auth.uid());
