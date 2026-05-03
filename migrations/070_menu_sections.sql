-- Migration: Menu sections
--
-- A menu item can now belong to a top-level menu section such as Breakfast,
-- Lunch, Dinner, or Drinks. Categories remain nested inside each section.

ALTER TABLE public.menu_items
    ADD COLUMN IF NOT EXISTS menu_section text NOT NULL DEFAULT 'Main Menu';

CREATE INDEX IF NOT EXISTS idx_menu_items_section_category_sort
    ON public.menu_items(site_id, menu_section, category, sort_order);
