-- Migration: Menu category order
--
-- Allows categories inside each menu section to be ordered independently from
-- item ordering.

ALTER TABLE public.menu_items
ADD COLUMN IF NOT EXISTS category_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_menu_items_site_section_category_order
ON public.menu_items (site_id, menu_section, category_order, category);
