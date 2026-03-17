-- Internal ops dashboard: admin flag, analytics events, support requests
-- Run in Supabase SQL editor

-- ─── Admin flag on users ─────────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- ─── Analytics events ────────────────────────────────────────────────────────
-- Lightweight event log for platform activity. Written server-side only via
-- the service-role key so RLS is not a concern, but we lock the table down
-- so no anon/authenticated client can read or write it directly.

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  text        NOT NULL,          -- e.g. 'user_signup', 'site_publish'
  user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  site_id     uuid        REFERENCES public.sites(id) ON DELETE SET NULL,
  metadata    jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_events_type_time
  ON public.analytics_events(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_user_time
  ON public.analytics_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_created_at
  ON public.analytics_events(created_at DESC);

-- Lock down: no public access — service role bypasses RLS
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- ─── Support requests ────────────────────────────────────────────────────────
-- Incoming emails to support@keystoneweb.ca forwarded by Resend inbound webhook.

CREATE TABLE IF NOT EXISTS public.support_requests (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  from_email      text        NOT NULL,
  from_name       text,
  subject         text,
  body_text       text,
  body_html       text,
  status          text        NOT NULL DEFAULT 'open',     -- open | in_progress | resolved | closed
  priority        text        NOT NULL DEFAULT 'normal',   -- low | normal | high | urgent
  notes           text,                                    -- internal admin notes
  resend_email_id text,                                    -- Resend message ID for dedup
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_requests_status_time
  ON public.support_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS support_requests_created_at
  ON public.support_requests(created_at DESC);

-- Lock down: no public access
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

-- ─── Seed: grant your account admin access ───────────────────────────────────
-- Replace the email below and run once after migration, or run via the dashboard.
-- UPDATE public.users SET is_admin = true WHERE email = 'you@example.com';
