-- Migration: Public read policy for site_redirects
--
-- The middleware looks up redirects on every published-site request using the
-- anon Supabase client. The original policy only allowed the site owner to
-- SELECT, so anonymous visitors got zero rows back and the redirect never
-- fired. Add a published-site read policy alongside the existing owner CRUD,
-- matching the pattern used for pages / menu_items / events.

DROP POLICY IF EXISTS "Public read redirects for published sites" ON public.site_redirects;

CREATE POLICY "Public read redirects for published sites"
    ON public.site_redirects FOR SELECT
    USING (site_id IN (SELECT id FROM public.sites WHERE is_published = true));
