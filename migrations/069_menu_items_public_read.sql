-- Migration: Menu items public read policy
--
-- Menu items are rendered on public sites. Owner writes still go through the
-- authenticated API, but published-site reads need to work for anonymous
-- visitors even when RLS is enabled.

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Public read menu items for published sites" ON public.menu_items;

CREATE POLICY "Public read menu items for published sites"
    ON public.menu_items FOR SELECT
    USING (site_id IN (SELECT id FROM public.sites WHERE is_published = true));

DROP POLICY IF EXISTS "Site owners manage menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Owner manage menu items" ON public.menu_items;

CREATE POLICY "Site owners manage menu items"
    ON public.menu_items FOR ALL
    USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()))
    WITH CHECK (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));
