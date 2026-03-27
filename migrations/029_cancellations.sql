-- Migration: Booking & Order Cancellation Support
-- Adds cancellation tokens for customer self-cancel, configurable notice window,
-- and cancellation reason tracking for both bookings and orders.

-- 1. Add cancellation_token to bookings (unique per booking, for customer self-cancel links)
ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS cancellation_token uuid DEFAULT gen_random_uuid() NOT NULL;

-- Ensure each existing booking gets a unique token (in case DEFAULT didn't apply)
UPDATE public.bookings SET cancellation_token = gen_random_uuid() WHERE cancellation_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_cancellation_token ON public.bookings(cancellation_token);

-- 2. Add cancellation_reason to bookings
ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS cancellation_reason text;

-- 3. Add cancellation_notice_hours to booking_settings
--    0 = customer self-cancellation disabled
--    Default: 24 hours notice required
ALTER TABLE public.booking_settings
    ADD COLUMN IF NOT EXISTS cancellation_notice_hours integer NOT NULL DEFAULT 24;

-- 4. Add cancellation_reason to orders
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS cancellation_reason text;

-- RLS: Allow anyone to SELECT a single booking by cancellation_token
-- (used to display booking details on the cancel page before confirming)
-- The existing "Anyone can read bookings for slot checking" policy already covers SELECT.

-- Note: The public cancel endpoint uses the service-role (admin) client to perform
-- the UPDATE, so no additional RLS UPDATE policy is needed for token-based cancellation.
