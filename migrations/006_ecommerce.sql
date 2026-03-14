-- Migration: E-Commerce Tables
-- Run this in the Supabase SQL Editor

-- 1. Products
CREATE TABLE IF NOT EXISTS public.products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    price_cents integer NOT NULL DEFAULT 0,
    compare_at_cents integer, -- strike-through / "was" price
    currency text NOT NULL DEFAULT 'CAD',
    images jsonb DEFAULT '[]'::jsonb, -- array of image URLs
    variants jsonb DEFAULT '[]'::jsonb, -- [{name:"Size", options:["S","M","L"]}]
    inventory_count integer NOT NULL DEFAULT -1, -- -1 = unlimited
    slug text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(site_id, slug)
);

-- 2. Orders
CREATE TABLE IF NOT EXISTS public.orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    items jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{productId, name, price_cents, qty, variants:{}}]
    subtotal_cents integer NOT NULL DEFAULT 0,
    customer_name text NOT NULL,
    customer_email text NOT NULL,
    customer_phone text,
    shipping_address jsonb, -- {line1, line2, city, province, postal, country}
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'completed', 'cancelled')),
    payment_method text NOT NULL DEFAULT 'none' CHECK (payment_method IN ('none', 'etransfer', 'stripe')),
    payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'pending', 'paid')),
    stripe_payment_id text,
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_site ON public.products(site_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(site_id, slug);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(site_id, is_active);
CREATE INDEX IF NOT EXISTS idx_orders_site ON public.orders(site_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(site_id, status);

-- RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Site owners manage products
CREATE POLICY "Site owners manage products"
    ON public.products FOR ALL
    USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()))
    WITH CHECK (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));

-- Anyone can read active products (published site)
CREATE POLICY "Anyone can read active products"
    ON public.products FOR SELECT
    USING (is_active = true);

-- Site owners manage orders
CREATE POLICY "Site owners manage orders"
    ON public.orders FOR ALL
    USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()))
    WITH CHECK (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));

-- Anyone can create orders (public checkout)
CREATE POLICY "Anyone can create orders"
    ON public.orders FOR INSERT
    WITH CHECK (true);

-- Anyone can read orders (for confirmation page lookup)
CREATE POLICY "Anyone can read orders"
    ON public.orders FOR SELECT
    USING (true);
