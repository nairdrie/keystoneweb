-- Migration: Site-level Converge & Clover payment processors
-- Allows site owners to use Converge (Elavon) or Clover for their own payments,
-- not just through vendors. Mirrors the vendor-level fields from 062.

-- 1. Converge credentials on sites table
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS converge_merchant_id text;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS converge_user_id text;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS converge_pin text;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS converge_demo_mode boolean DEFAULT false;

-- 2. Clover credentials on sites table
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS clover_merchant_id text;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS clover_public_key text;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS clover_private_token text;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS clover_webhook_secret text;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS clover_sandbox_mode boolean DEFAULT false;

-- 3. Bookings: expand payment_method constraint to include converge/clover
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_payment_method_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_payment_method_check
  CHECK (payment_method IN ('none', 'etransfer', 'stripe', 'paypal', 'converge', 'clover'));

-- 4. Bookings: add payment tracking columns for Converge/Clover
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS converge_txn_id text,
  ADD COLUMN IF NOT EXISTS clover_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS clover_charge_id text;
