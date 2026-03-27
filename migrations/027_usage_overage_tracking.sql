-- Usage tracking and overage billing
-- Adds monthly usage aggregation + stores Stripe metered subscription item IDs

-- ─── Monthly usage rollups per user ──────────────────────────────────────────
-- Aggregated from site_visits. One row per user per month.
-- The cron job rolls up visitor counts across ALL sites a user owns.

CREATE TABLE IF NOT EXISTS public.user_usage_monthly (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start    date        NOT NULL,                -- first day of the billing month
  period_end      date        NOT NULL,                -- last day of the billing month
  total_visitors  integer     NOT NULL DEFAULT 0,      -- unique visitors across all user's sites
  total_views     integer     NOT NULL DEFAULT 0,      -- total page views across all user's sites
  visitor_limit   integer     NOT NULL DEFAULT 10000,  -- plan limit for this period
  overage_visitors integer    NOT NULL DEFAULT 0,      -- visitors above the limit
  overage_reported boolean    NOT NULL DEFAULT false,   -- true once pushed to Stripe
  reported_at     timestamptz,                          -- when we last reported to Stripe
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, period_start)
);

CREATE INDEX IF NOT EXISTS user_usage_monthly_user_period
  ON public.user_usage_monthly(user_id, period_start DESC);

ALTER TABLE public.user_usage_monthly ENABLE ROW LEVEL SECURITY;

-- ─── Extend user_subscriptions with metered billing fields ───────────────────

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_metered_item_id text,          -- subscription item for the metered (overage) price
  ADD COLUMN IF NOT EXISTS visitor_limit integer DEFAULT 10000,  -- plan visitor limit
  ADD COLUMN IF NOT EXISTS storage_limit_mb integer DEFAULT 1024; -- plan storage limit in MB

-- ─── Daily usage log per site (lightweight, for real-time dashboard) ──────────
-- This supplements site_analytics_daily with a simpler per-site daily visitor count
-- that the usage API can quickly sum.

CREATE TABLE IF NOT EXISTS public.site_usage_daily (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         uuid        NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date            date        NOT NULL,
  unique_visitors integer     NOT NULL DEFAULT 0,
  total_views     integer     NOT NULL DEFAULT 0,
  UNIQUE(site_id, date)
);

CREATE INDEX IF NOT EXISTS site_usage_daily_user_date
  ON public.site_usage_daily(user_id, date DESC);

ALTER TABLE public.site_usage_daily ENABLE ROW LEVEL SECURITY;
