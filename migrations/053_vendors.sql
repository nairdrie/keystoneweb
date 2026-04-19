-- Migration: Vendor Fulfillment & External Payment
-- Adds vendor management, product vendor assignment, order splitting, and vendor portal access

-- 1. Vendors table
CREATE TABLE IF NOT EXISTS public.vendors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    name text NOT NULL,
    contact_email text NOT NULL,
    payment_mode text NOT NULL DEFAULT 'external' CHECK (payment_mode IN ('stripe', 'external')),
    stripe_account_id text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendors_site ON public.vendors(site_id);

-- RLS
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Site owners manage vendors"
    ON public.vendors FOR ALL
    USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()))
    WITH CHECK (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));

-- 2. Add vendor_id to products (nullable — null means self-fulfilled)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL;

-- 3. Add vendor/split fields to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS parent_order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS vendor_notified_at timestamptz;

-- Update orders status check to include 'pending_external'
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
    CHECK (status IN ('pending', 'pending_external', 'confirmed', 'shipped', 'completed', 'cancelled'));

-- Update orders payment_method check to include 'external'
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_check
    CHECK (payment_method IN ('none', 'etransfer', 'stripe', 'external'));

-- Indexes for order lookups
CREATE INDEX IF NOT EXISTS idx_orders_vendor ON public.orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_orders_parent ON public.orders(parent_order_id);

-- 4. Vendor portal access tokens
CREATE TABLE IF NOT EXISTS public.vendor_order_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    token text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_tokens_token ON public.vendor_order_tokens(token);
CREATE INDEX IF NOT EXISTS idx_vendor_tokens_vendor ON public.vendor_order_tokens(vendor_id);

-- RLS
ALTER TABLE public.vendor_order_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Site owners manage vendor tokens"
    ON public.vendor_order_tokens FOR ALL
    USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()))
    WITH CHECK (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));

-- Public read for token-based lookups (the API validates the token)
CREATE POLICY "Anyone can read vendor tokens"
    ON public.vendor_order_tokens FOR SELECT
    USING (true);

-- Allow public reads on vendors table for vendor portal (token-validated in API)
CREATE POLICY "Anyone can read vendors"
    ON public.vendors FOR SELECT
    USING (true);
