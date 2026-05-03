-- Add a `is_featured` flag to products so admins can highlight a curated
-- subset on the storefront. Used by the Products block on home pages to
-- render a "featured products" row scoped to a category/subcategory.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_products_is_featured
  ON public.products(site_id, is_featured)
  WHERE is_featured = true;
