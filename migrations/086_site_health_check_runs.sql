-- Persist site health-check runs so dashboard setup state can use a real,
-- shared signal from every health-check surface.

CREATE TABLE IF NOT EXISTS public.site_health_check_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  run_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  context text NOT NULL DEFAULT 'designer' CHECK (context IN ('designer', 'owner', 'ops')),
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary jsonb NOT NULL DEFAULT '{"errors":0,"warnings":0,"passed":0}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_health_check_runs_site_created_idx
  ON public.site_health_check_runs (site_id, created_at DESC);

CREATE INDEX IF NOT EXISTS site_health_check_runs_user_created_idx
  ON public.site_health_check_runs (user_id, created_at DESC);

ALTER TABLE public.site_health_check_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own site health check runs" ON public.site_health_check_runs;
CREATE POLICY "Users view own site health check runs"
  ON public.site_health_check_runs FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users insert own site health check runs" ON public.site_health_check_runs;
CREATE POLICY "Users insert own site health check runs"
  ON public.site_health_check_runs FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (run_by_user_id IS NULL OR run_by_user_id = auth.uid())
    AND site_id IN (
      SELECT id FROM public.sites WHERE user_id = auth.uid()
    )
  );
