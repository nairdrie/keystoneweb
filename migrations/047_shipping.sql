-- Shipping zones table
CREATE TABLE IF NOT EXISTS public.shipping_zones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    name text NOT NULL,
    countries jsonb NOT NULL DEFAULT '[]',
    regions jsonb DEFAULT '[]',
    rate_type text NOT NULL DEFAULT 'flat'
        CHECK (rate_type IN ('flat', 'free', 'free_above')),
    rate_cents integer NOT NULL DEFAULT 0,
    free_threshold_cents integer DEFAULT 0,
    is_local_pickup boolean DEFAULT false,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipping_zones_site ON public.shipping_zones (site_id, sort_order);

ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Site owners manage shipping zones" ON public.shipping_zones
    FOR ALL USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));

CREATE POLICY "Public can read shipping zones" ON public.shipping_zones
    FOR SELECT USING (true);

-- Add shipping columns to orders
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS shipping_cents integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS shipping_method text;

-- Add shipping_required flag to ecommerce_settings
ALTER TABLE public.ecommerce_settings
    ADD COLUMN IF NOT EXISTS shipping_required boolean DEFAULT true;
