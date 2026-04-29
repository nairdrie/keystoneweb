-- Add brand name to products. Free-text label rendered in small caps above
-- the product title (e.g. "NIKE", "APPLE"). Optional and unindexed for now;
-- product search/filtering by brand can be added later.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand text;
