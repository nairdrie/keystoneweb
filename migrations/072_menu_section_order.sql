-- Migration: Menu section order
--
-- Allows menu groups such as Breakfast, Lunch, Dinner, and Drinks to be ordered
-- independently from item/category ordering.

ALTER TABLE public.menu_items
ADD COLUMN IF NOT EXISTS menu_section_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_menu_items_site_section_order
ON public.menu_items (site_id, menu_section_order, menu_section);
