-- Migration: Booking Categories Table & Relations
-- Run this in the Supabase SQL Editor

-- 1. Create mapping table for categories
CREATE TABLE IF NOT EXISTS public.booking_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    name text NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Add an optional category reference to services
ALTER TABLE public.booking_services
ADD COLUMN category_id uuid REFERENCES public.booking_categories(id) ON DELETE SET NULL;

-- 3. Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_booking_categories_site ON public.booking_categories(site_id);
CREATE INDEX IF NOT EXISTS idx_booking_services_category ON public.booking_services(category_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.booking_categories ENABLE ROW LEVEL SECURITY;

-- 5. RLS Constraints
CREATE POLICY "Site owners manage booking_categories"
    ON public.booking_categories FOR ALL
    USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()))
    WITH CHECK (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));

CREATE POLICY "Anyone can read booking_categories"
    ON public.booking_categories FOR SELECT
    USING (true);
