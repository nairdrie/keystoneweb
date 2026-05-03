-- Menu item dietary/custom icons

ALTER TABLE public.menu_items
    ADD COLUMN IF NOT EXISTS icon_tags text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.menu_icon_options (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    label text NOT NULL,
    icon text NOT NULL DEFAULT 'circle',
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_icon_options_site_order
    ON public.menu_icon_options (site_id, sort_order, label);

ALTER TABLE public.menu_icon_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read menu icon options"
    ON public.menu_icon_options FOR SELECT
    USING (true);

CREATE POLICY "Owner manage menu icon options"
    ON public.menu_icon_options FOR ALL
    USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()))
    WITH CHECK (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));
