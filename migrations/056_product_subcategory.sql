-- Two-level category support: add a subcategory string to products.
-- Free-text to match the existing category column; uniqueness is implicit
-- (category + subcategory pair). Backfills to NULL so existing products
-- retain their single-level category classification.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS subcategory text;

CREATE INDEX IF NOT EXISTS idx_products_subcategory
  ON public.products(site_id, category, subcategory);
