-- Migration: Create booking_addons table for reusable add-on price variants
-- Add-on variants add their price on top of the base service price.
-- They are site-level and can be reused across multiple services.
--
-- Service option shape (updated):
--   { id: string, name: string, price_cents: number, price_type: 'override' | 'addon', addon_id?: string }
--
-- price_type:
--   'override' (default, backward-compatible) — option price replaces the base service price
--   'addon'                                   — option price is added to the base service price
--
-- addon_id (optional): references booking_addons.id for options that were added from the
--   reusable addon library. Stored for informational purposes; the name/price are
--   denormalized into the option itself.

CREATE TABLE IF NOT EXISTS public.booking_addons (
  id         UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id    UUID         REFERENCES public.sites(id) ON DELETE CASCADE NOT NULL,
  name       TEXT         NOT NULL,
  price_cents INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ  DEFAULT NOW(),
  updated_at TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE public.booking_addons ENABLE ROW LEVEL SECURITY;

-- Site owners can manage their own addons
CREATE POLICY "Site owners can manage booking addons"
  ON public.booking_addons
  FOR ALL
  USING (
    site_id IN (
      SELECT id FROM public.sites WHERE user_id = auth.uid()
    )
  );
