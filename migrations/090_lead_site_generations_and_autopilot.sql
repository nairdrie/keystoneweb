-- Migration: 090_lead_site_generations_and_autopilot
-- Two pieces of the automated lead-conversion pipeline:
--
--   1. lead_site_generations — one row per "Generate site" click on a lead.
--      Records the prompt, the Google/vision enrichment snapshot used for the
--      build, and the resulting site + launch request. Powers the
--      /ops/autopilot dashboard list of generated sites.
--
--   2. lead_autopilot (+ events) — opt-in automated follow-up per lead. A cron
--      tick asks Claude to decide the next outreach action (email / SMS /
--      wait / flag for human / stop). When a lead replies or shows intent the
--      enrollment flips to 'hooked' so an operator can take over.

-- ── lead_site_generations ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lead_site_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  launch_request_id uuid REFERENCES public.launch_requests(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'generating'
    CHECK (status IN ('generating', 'succeeded', 'failed')),
  prompt text,
  -- Snapshot of the Google Places / vision-branding / website enrichment the
  -- build used (jsonb so the dashboard can show what we learned).
  enrichment jsonb,
  error text,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS lead_site_generations_lead_id_idx
  ON public.lead_site_generations(lead_id);
CREATE INDEX IF NOT EXISTS lead_site_generations_created_at_idx
  ON public.lead_site_generations(created_at DESC);

ALTER TABLE public.lead_site_generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_lead_site_generations" ON public.lead_site_generations;
CREATE POLICY "service_role_all_lead_site_generations"
  ON public.lead_site_generations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── lead_autopilot ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lead_autopilot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL UNIQUE REFERENCES public.leads(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'hooked', 'stopped', 'converted')),
  -- Which channels Claude may use: {"email": true, "sms": false}
  channels jsonb NOT NULL DEFAULT '{"email": true, "sms": false}'::jsonb,
  max_touches integer NOT NULL DEFAULT 6,
  min_hours_between_touches integer NOT NULL DEFAULT 72,
  touches_sent integer NOT NULL DEFAULT 0,
  next_action_at timestamptz DEFAULT now(),
  last_action_at timestamptz,
  hook_reason text,
  stop_reason text,
  -- Last decision JSON Claude returned (action/reason), for the dashboard.
  last_decision jsonb,
  enrolled_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_autopilot_status_next_action_idx
  ON public.lead_autopilot(status, next_action_at);

ALTER TABLE public.lead_autopilot ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_lead_autopilot" ON public.lead_autopilot;
CREATE POLICY "service_role_all_lead_autopilot"
  ON public.lead_autopilot
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- updated_at trigger (mirrors the leads table pattern)
CREATE OR REPLACE FUNCTION public.set_lead_autopilot_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lead_autopilot_updated_at ON public.lead_autopilot;
CREATE TRIGGER lead_autopilot_updated_at
  BEFORE UPDATE ON public.lead_autopilot
  FOR EACH ROW
  EXECUTE FUNCTION public.set_lead_autopilot_updated_at();

-- ── lead_autopilot_events ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lead_autopilot_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  autopilot_id uuid NOT NULL REFERENCES public.lead_autopilot(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  kind text NOT NULL
    CHECK (kind IN ('enrolled', 'decision', 'email_sent', 'sms_sent', 'wait', 'hooked', 'stopped', 'paused', 'resumed', 'error')),
  summary text,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_autopilot_events_autopilot_id_idx
  ON public.lead_autopilot_events(autopilot_id, created_at DESC);

ALTER TABLE public.lead_autopilot_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_lead_autopilot_events" ON public.lead_autopilot_events;
CREATE POLICY "service_role_all_lead_autopilot_events"
  ON public.lead_autopilot_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
