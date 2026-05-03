-- Migration: Persist top-level menu sections
--
-- Allows users to create and reorder blank menus before any menu items exist
-- inside those menus.

CREATE TABLE IF NOT EXISTS public.menu_sections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    name text NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT menu_sections_site_name_unique UNIQUE (site_id, name)
);

CREATE INDEX IF NOT EXISTS idx_menu_sections_site_order
    ON public.menu_sections (site_id, sort_order, name);

ALTER TABLE public.menu_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read menu sections"
    ON public.menu_sections FOR SELECT
    USING (true);

CREATE POLICY "Owner manage menu sections"
    ON public.menu_sections FOR ALL
    USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()))
    WITH CHECK (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));
