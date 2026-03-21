-- Site analytics: visitor tracking for published sites
-- Run in Supabase SQL editor

-- ─── Site visits table ─────────────────────────────────────────────────────
-- Stores individual page visits for published sites. Each row = one page view.
-- We fingerprint visitors via a hash of IP + User-Agent to count uniques
-- without storing PII.

CREATE TABLE IF NOT EXISTS public.site_visits (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid        NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  visitor_hash  text        NOT NULL,                -- SHA-256(ip + user_agent), no PII stored
  page_path     text        NOT NULL DEFAULT '/',    -- e.g. '/', '/about', '/blog/my-post'
  referrer      text,                                -- document.referrer
  referrer_source text,                              -- 'organic', 'social', 'direct', 'referral'
  country       text,                                -- geo from IP (optional, populated server-side)
  device_type   text,                                -- 'desktop', 'mobile', 'tablet'
  browser       text,                                -- 'Chrome', 'Firefox', 'Safari', etc.
  os            text,                                -- 'Windows', 'macOS', 'iOS', 'Android', etc.
  session_id    text,                                -- groups hits into sessions (~30 min window)
  duration_ms   integer,                             -- time on page (sent via beacon on unload)
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common analytics queries
CREATE INDEX IF NOT EXISTS site_visits_site_time
  ON public.site_visits(site_id, created_at DESC);

CREATE INDEX IF NOT EXISTS site_visits_site_visitor
  ON public.site_visits(site_id, visitor_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS site_visits_site_page
  ON public.site_visits(site_id, page_path, created_at DESC);

-- Lock down: no public access — service role bypasses RLS
ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

-- ─── Daily aggregates (materialized for fast dashboard reads) ──────────────
-- Rolled up nightly or on-demand. Keeps the dashboard snappy without
-- scanning millions of raw rows.

CREATE TABLE IF NOT EXISTS public.site_analytics_daily (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         uuid        NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  date            date        NOT NULL,
  unique_visitors integer     NOT NULL DEFAULT 0,
  total_views     integer     NOT NULL DEFAULT 0,
  avg_duration_ms integer,                            -- average time on page
  bounce_count    integer     NOT NULL DEFAULT 0,     -- single-page sessions
  top_pages       jsonb       NOT NULL DEFAULT '[]',  -- [{path, views}]
  top_referrers   jsonb       NOT NULL DEFAULT '[]',  -- [{source, count}]
  devices         jsonb       NOT NULL DEFAULT '{}',  -- {desktop: N, mobile: N, tablet: N}
  browsers        jsonb       NOT NULL DEFAULT '{}',  -- {Chrome: N, Firefox: N, ...}
  countries       jsonb       NOT NULL DEFAULT '{}',  -- {US: N, CA: N, ...}
  UNIQUE(site_id, date)
);

CREATE INDEX IF NOT EXISTS site_analytics_daily_site_date
  ON public.site_analytics_daily(site_id, date DESC);

ALTER TABLE public.site_analytics_daily ENABLE ROW LEVEL SECURITY;
