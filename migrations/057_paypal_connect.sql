-- 057_paypal_connect.sql
-- Add PayPal Commerce Platform (Partner) support alongside Stripe Connect.
-- Mirrors the Stripe Connect shape: each site can connect its own PayPal
-- merchant account, and orders/bookings route funds directly to that
-- account via payee.merchant_id + PayPal-Auth-Assertion.

-- ── Per-site PayPal connection ────────────────────────────────────────────
ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS paypal_merchant_id            text,  -- merchantIdInPayPal (Payer ID)
  ADD COLUMN IF NOT EXISTS paypal_onboarding_status      text,  -- 'pending' | 'active' | 'limited'
  ADD COLUMN IF NOT EXISTS paypal_permissions_granted    boolean,
  ADD COLUMN IF NOT EXISTS paypal_email_confirmed        boolean,
  ADD COLUMN IF NOT EXISTS paypal_primary_email          text,
  ADD COLUMN IF NOT EXISTS paypal_advanced_card_enabled  boolean DEFAULT false;

-- ── Orders: allow 'paypal' payment_method, add capture/order id columns ──
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_payment_method_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('none', 'etransfer', 'stripe', 'paypal'));

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS paypal_order_id   text,
  ADD COLUMN IF NOT EXISTS paypal_capture_id text;

CREATE INDEX IF NOT EXISTS orders_paypal_order_id_idx
  ON public.orders(paypal_order_id)
  WHERE paypal_order_id IS NOT NULL;

-- ── Bookings: same extensions ────────────────────────────────────────────
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_payment_method_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_payment_method_check
  CHECK (payment_method IN ('none', 'etransfer', 'stripe', 'paypal'));

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS paypal_order_id   text,
  ADD COLUMN IF NOT EXISTS paypal_capture_id text;

CREATE INDEX IF NOT EXISTS bookings_paypal_order_id_idx
  ON public.bookings(paypal_order_id)
  WHERE paypal_order_id IS NOT NULL;

-- ── PayPal transaction log (parallel to stripe_transactions) ─────────────
CREATE TABLE IF NOT EXISTS public.paypal_transactions (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  paypal_event_id      text        UNIQUE NOT NULL,            -- webhook event id — idempotency key
  paypal_merchant_id   text,                                   -- merchantIdInPayPal the funds settled to
  paypal_order_id      text,
  paypal_capture_id    text,
  site_id              uuid        REFERENCES public.sites(id) ON DELETE SET NULL,
  user_id              uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type           text        NOT NULL,                   -- 'PAYMENT.CAPTURE.COMPLETED', etc.
  transaction_type     text        NOT NULL,                   -- 'ecommerce_order' | 'booking' | 'refund'
  description          text,
  amount_cents         integer     NOT NULL DEFAULT 0,
  currency             text        NOT NULL DEFAULT 'usd',
  status               text        NOT NULL DEFAULT 'succeeded'
                                   CHECK (status IN ('succeeded', 'failed', 'refunded', 'pending')),
  metadata             jsonb       DEFAULT '{}',
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS paypal_tx_site_id      ON public.paypal_transactions(site_id);
CREATE INDEX IF NOT EXISTS paypal_tx_user_id      ON public.paypal_transactions(user_id);
CREATE INDEX IF NOT EXISTS paypal_tx_event_type   ON public.paypal_transactions(event_type);
CREATE INDEX IF NOT EXISTS paypal_tx_type         ON public.paypal_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS paypal_tx_order_id     ON public.paypal_transactions(paypal_order_id);
CREATE INDEX IF NOT EXISTS paypal_tx_created      ON public.paypal_transactions(created_at);

ALTER TABLE public.paypal_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY paypal_transactions_select_own_site ON public.paypal_transactions
  FOR SELECT USING (
    site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid())
  );
