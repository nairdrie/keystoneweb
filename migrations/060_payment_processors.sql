-- Migration: Expand vendor payment processors (Converge, Clover) + defaults + email config
-- Builds on 059_vendors.sql to support four payment modes and multi-recipient notifications.

-- 1. Expand payment_mode options to include 'converge' and 'clover'
ALTER TABLE public.vendors DROP CONSTRAINT IF EXISTS vendors_payment_mode_check;
ALTER TABLE public.vendors ADD CONSTRAINT vendors_payment_mode_check
    CHECK (payment_mode IN ('stripe', 'converge', 'clover', 'external'));

-- 2. Converge credentials (per-vendor)
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS converge_merchant_id text;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS converge_user_id text;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS converge_pin text;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS converge_demo_mode boolean DEFAULT false;

-- 3. Clover credentials (per-vendor)
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS clover_merchant_id text;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS clover_public_key text;       -- PAKMS (client-side, safe)
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS clover_private_token text;    -- server-only
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS clover_webhook_secret text;   -- for HMAC verification
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS clover_sandbox_mode boolean DEFAULT false;

-- 4. Default vendor flag — used as the fulfiller for any product that doesn't specify one
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_one_default_per_site
    ON public.vendors(site_id) WHERE is_default = true;

-- 5. Extra CC email recipients for order notifications (array of emails beyond contact_email)
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS cc_notification_emails jsonb DEFAULT '[]'::jsonb;

-- 6. Order payment_method: add 'converge' and 'clover'
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_check
    CHECK (payment_method IN ('none', 'etransfer', 'stripe', 'paypal', 'converge', 'clover', 'external'));

-- 7. Order payment tracking for non-Stripe processors
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS converge_txn_id text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS clover_checkout_session_id text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS clover_charge_id text;

CREATE INDEX IF NOT EXISTS idx_orders_converge_txn ON public.orders(converge_txn_id);
CREATE INDEX IF NOT EXISTS idx_orders_clover_session ON public.orders(clover_checkout_session_id);
