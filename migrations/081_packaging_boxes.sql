-- Multi-box packaging: merchant defines a catalog of boxes; per-product
-- ships_alone overrides combining; chosen plan persists on the order so
-- the merchant knows exactly how to pack.

ALTER TABLE public.ecommerce_settings
    ADD COLUMN IF NOT EXISTS packaging_boxes jsonb DEFAULT '[]';

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS ships_alone boolean DEFAULT false;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS packing_plan jsonb;
