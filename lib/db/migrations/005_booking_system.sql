-- Migration: Booking System Tables
-- Run this in the Supabase SQL Editor

-- 1. Booking Settings (per-site configuration)
CREATE TABLE IF NOT EXISTS public.booking_settings (
    site_id uuid PRIMARY KEY REFERENCES public.sites(id) ON DELETE CASCADE,
    timezone text NOT NULL DEFAULT 'America/Toronto',
    buffer_minutes integer NOT NULL DEFAULT 15,
    max_advance_days integer NOT NULL DEFAULT 60,
    require_payment boolean NOT NULL DEFAULT false,
    payment_methods jsonb DEFAULT '{"none": true, "etransfer": false, "stripe": false}'::jsonb,
    etransfer_email text,
    stripe_account_id text,
    confirmation_message text DEFAULT 'Your booking has been confirmed! We look forward to seeing you.',
    notification_email text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Booking Services
CREATE TABLE IF NOT EXISTS public.booking_services (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    duration_minutes integer NOT NULL DEFAULT 30,
    price_cents integer NOT NULL DEFAULT 0,
    currency text NOT NULL DEFAULT 'CAD',
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3. Booking Availability (weekly schedule)
CREATE TABLE IF NOT EXISTS public.booking_availability (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
    start_time time NOT NULL DEFAULT '09:00',
    end_time time NOT NULL DEFAULT '17:00',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz DEFAULT now(),
    UNIQUE(site_id, day_of_week)
);

-- 4. Blocked Dates (holidays, vacations, etc.)
CREATE TABLE IF NOT EXISTS public.booking_blocked_dates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    blocked_date date NOT NULL,
    reason text,
    created_at timestamptz DEFAULT now(),
    UNIQUE(site_id, blocked_date)
);

-- 5. Bookings (actual appointments)
CREATE TABLE IF NOT EXISTS public.bookings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    service_id uuid NOT NULL REFERENCES public.booking_services(id) ON DELETE CASCADE,
    booking_date date NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,
    customer_name text NOT NULL,
    customer_email text NOT NULL,
    customer_phone text,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    payment_method text NOT NULL DEFAULT 'none' CHECK (payment_method IN ('none', 'etransfer', 'stripe')),
    payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'pending', 'paid')),
    stripe_payment_id text,
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_booking_services_site ON public.booking_services(site_id);
CREATE INDEX IF NOT EXISTS idx_booking_availability_site ON public.booking_availability(site_id);
CREATE INDEX IF NOT EXISTS idx_booking_blocked_dates_site ON public.booking_blocked_dates(site_id, blocked_date);
CREATE INDEX IF NOT EXISTS idx_bookings_site_date ON public.bookings(site_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_service ON public.bookings(service_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(site_id, status);

-- RLS Policies
ALTER TABLE public.booking_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Site owners can manage their booking configuration
CREATE POLICY "Site owners manage booking_settings"
    ON public.booking_settings FOR ALL
    USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()))
    WITH CHECK (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));

CREATE POLICY "Site owners manage booking_services"
    ON public.booking_services FOR ALL
    USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()))
    WITH CHECK (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));

CREATE POLICY "Site owners manage booking_availability"
    ON public.booking_availability FOR ALL
    USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()))
    WITH CHECK (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));

CREATE POLICY "Site owners manage booking_blocked_dates"
    ON public.booking_blocked_dates FOR ALL
    USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()))
    WITH CHECK (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));

CREATE POLICY "Site owners manage bookings"
    ON public.bookings FOR ALL
    USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()))
    WITH CHECK (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));

-- Public read access for published site booking data
-- Customers need to see services, availability, and check slot availability
CREATE POLICY "Anyone can read active booking_services"
    ON public.booking_services FOR SELECT
    USING (is_active = true);

CREATE POLICY "Anyone can read active booking_availability"
    ON public.booking_availability FOR SELECT
    USING (is_active = true);

CREATE POLICY "Anyone can read booking_blocked_dates"
    ON public.booking_blocked_dates FOR SELECT
    USING (true);

CREATE POLICY "Anyone can read booking_settings"
    ON public.booking_settings FOR SELECT
    USING (true);

-- Customers can create bookings (insert only, no auth required)
CREATE POLICY "Anyone can create bookings"
    ON public.bookings FOR INSERT
    WITH CHECK (true);

-- Customers can read their own bookings by email (for confirmation pages)
-- Note: This is permissive — in production you might want a token-based lookup instead
CREATE POLICY "Anyone can read bookings for slot checking"
    ON public.bookings FOR SELECT
    USING (true);

-- Insert default availability for Monday-Friday when settings are created
-- (Business owners can customize later)
CREATE OR REPLACE FUNCTION public.create_default_availability()
RETURNS TRIGGER AS $$
BEGIN
    -- Create Mon-Fri 9am-5pm defaults
    INSERT INTO public.booking_availability (site_id, day_of_week, start_time, end_time, is_active)
    VALUES
        (NEW.site_id, 1, '09:00', '17:00', true),  -- Monday
        (NEW.site_id, 2, '09:00', '17:00', true),  -- Tuesday
        (NEW.site_id, 3, '09:00', '17:00', true),  -- Wednesday
        (NEW.site_id, 4, '09:00', '17:00', true),  -- Thursday
        (NEW.site_id, 5, '09:00', '17:00', true),  -- Friday
        (NEW.site_id, 0, '09:00', '17:00', false),  -- Sunday (inactive)
        (NEW.site_id, 6, '09:00', '17:00', false)   -- Saturday (inactive)
    ON CONFLICT (site_id, day_of_week) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_booking_settings_created
    AFTER INSERT ON public.booking_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.create_default_availability();
