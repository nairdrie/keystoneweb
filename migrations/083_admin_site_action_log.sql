-- Audit trail for admin "Manage Site" mode.
-- One row per mutating request (POST/PUT/PATCH/DELETE) that an admin makes against
-- a site they do not own, captured by requireSiteAccess().
-- Service-role-only — surfaced through the ops dashboard, never read with auth.uid().

CREATE TABLE IF NOT EXISTS public.admin_site_action_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  site_id        uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  http_method    text NOT NULL,
  request_path   text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_site_action_log_admin_user_idx
  ON public.admin_site_action_log (admin_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS admin_site_action_log_site_idx
  ON public.admin_site_action_log (site_id, created_at DESC);

ALTER TABLE public.admin_site_action_log ENABLE ROW LEVEL SECURITY;
-- No user policies. Service role bypasses RLS and is the only writer/reader.
