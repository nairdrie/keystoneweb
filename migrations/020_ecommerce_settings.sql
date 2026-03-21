-- Migration: E-Commerce Settings (per-site payment configuration)
-- Separates e-commerce payment config from booking_settings

CREATE TABLE IF NOT EXISTS public.ecommerce_settings (
    site_id uuid PRIMARY KEY REFERENCES public.sites(id) ON DELETE CASCADE,
    payment_methods jsonb NOT NULL DEFAULT '{"none": true, "etransfer": false, "stripe": false}'::jsonb,
    etransfer_email text,
    notification_email text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.ecommerce_settings ENABLE ROW LEVEL SECURITY;

-- Site owners manage their e-commerce settings
CREATE POLICY "Site owners manage ecommerce_settings"
    ON public.ecommerce_settings FOR ALL
    USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()))
    WITH CHECK (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));

-- Public read (needed for checkout to know accepted payment methods)
CREATE POLICY "Anyone can read ecommerce_settings"
    ON public.ecommerce_settings FOR SELECT
    USING (true);
