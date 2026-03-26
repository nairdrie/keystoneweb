-- Migration 026: Draft/publish status for products and booking services
-- New items start as 'draft' (not visible to public)
-- Owners click "Publish" in admin to make them live

-- Products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published'));

-- Mark all existing products as published so nothing breaks
UPDATE public.products SET status = 'published' WHERE status = 'draft';

-- Booking Services
ALTER TABLE public.booking_services
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published'));

-- Mark all existing services as published so nothing breaks
UPDATE public.booking_services SET status = 'published' WHERE status = 'draft';

-- Update public RLS policies to require status = 'published'
DROP POLICY IF EXISTS "Anyone can read active products" ON public.products;
CREATE POLICY "Anyone can read active products"
  ON public.products FOR SELECT
  USING (is_active = true AND status = 'published');

DROP POLICY IF EXISTS "Anyone can read active booking_services" ON public.booking_services;
CREATE POLICY "Anyone can read active booking_services"
  ON public.booking_services FOR SELECT
  USING (is_active = true AND status = 'published');

-- Index for draft lookups
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products (site_id, status);
CREATE INDEX IF NOT EXISTS idx_booking_services_status ON public.booking_services (site_id, status);
