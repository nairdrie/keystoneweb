-- Add category and tags columns to products table
-- category: text field for product category name
-- tags: jsonb array of tag strings

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products (site_id, category)
  WHERE category IS NOT NULL;
