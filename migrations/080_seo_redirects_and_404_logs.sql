-- SEO redirects + 404 logging
--
-- site_redirects: per-site map of old paths → new paths. Looked up by
-- middleware so old URLs (Google Business Profile links, business cards,
-- backlinks from before a slug change) 301 to the current location.
--
-- site_404_logs: rolling tally of paths that hit 404 on each site. Powers
-- the admin "recent 404s" view and the AI-suggested redirect feature.

CREATE TABLE public.site_redirects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  from_path text NOT NULL,
  to_path text NOT NULL,
  status_code integer NOT NULL DEFAULT 301 CHECK (status_code IN (301, 302, 307, 308)),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'auto_slug_rename', 'ai_suggested')),
  hit_count integer NOT NULL DEFAULT 0,
  last_hit_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT site_redirects_pkey PRIMARY KEY (id),
  CONSTRAINT site_redirects_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE,
  CONSTRAINT site_redirects_unique UNIQUE (site_id, from_path)
);

CREATE INDEX site_redirects_site_lookup_idx ON public.site_redirects (site_id, from_path);

ALTER TABLE public.site_redirects ENABLE ROW LEVEL SECURITY;

CREATE POLICY site_redirects_owner_select ON public.site_redirects
  FOR SELECT USING (
    site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid())
  );

CREATE POLICY site_redirects_owner_insert ON public.site_redirects
  FOR INSERT WITH CHECK (
    site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid())
  );

CREATE POLICY site_redirects_owner_update ON public.site_redirects
  FOR UPDATE USING (
    site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid())
  );

CREATE POLICY site_redirects_owner_delete ON public.site_redirects
  FOR DELETE USING (
    site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid())
  );

CREATE TABLE public.site_404_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  path text NOT NULL,
  hit_count integer NOT NULL DEFAULT 1,
  first_hit_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_hit_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  referrer_sample text,
  resolved boolean NOT NULL DEFAULT false,
  CONSTRAINT site_404_logs_pkey PRIMARY KEY (id),
  CONSTRAINT site_404_logs_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE,
  CONSTRAINT site_404_logs_unique UNIQUE (site_id, path)
);

CREATE INDEX site_404_logs_site_idx ON public.site_404_logs (site_id, last_hit_at DESC);
CREATE INDEX site_404_logs_unresolved_idx ON public.site_404_logs (site_id, resolved, hit_count DESC);

ALTER TABLE public.site_404_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY site_404_logs_owner_select ON public.site_404_logs
  FOR SELECT USING (
    site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid())
  );

CREATE POLICY site_404_logs_owner_update ON public.site_404_logs
  FOR UPDATE USING (
    site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid())
  );

CREATE POLICY site_404_logs_owner_delete ON public.site_404_logs
  FOR DELETE USING (
    site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid())
  );

-- Atomic counter bump for site_redirects, callable from middleware.
-- SECURITY DEFINER lets the anon role increment without leaking write access.
CREATE OR REPLACE FUNCTION public.bump_site_redirect_hit(redirect_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.site_redirects
     SET hit_count = hit_count + 1,
         last_hit_at = CURRENT_TIMESTAMP
   WHERE id = redirect_id;
$$;

GRANT EXECUTE ON FUNCTION public.bump_site_redirect_hit(uuid) TO anon, authenticated;

-- Insert-or-increment for site_404_logs. Called from the 404 logging endpoint
-- after notFound() resolves on a published site.
CREATE OR REPLACE FUNCTION public.log_site_404(
  p_site_id uuid,
  p_path text,
  p_referrer text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.site_404_logs (site_id, path, referrer_sample)
  VALUES (p_site_id, p_path, NULLIF(p_referrer, ''))
  ON CONFLICT (site_id, path)
  DO UPDATE SET
    hit_count = public.site_404_logs.hit_count + 1,
    last_hit_at = CURRENT_TIMESTAMP,
    referrer_sample = COALESCE(NULLIF(EXCLUDED.referrer_sample, ''), public.site_404_logs.referrer_sample);
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_site_404(uuid, text, text) TO anon, authenticated;
