-- Migration: Featured menu items
--
-- Adds the same kind of editorial "featured" affordance to menu items.

ALTER TABLE public.menu_items
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_menu_items_site_section_featured
ON public.menu_items (site_id, menu_section, is_featured);
