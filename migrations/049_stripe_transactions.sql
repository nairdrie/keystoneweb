-- Stripe transaction log: every payment event from webhooks is recorded here.
-- This serves two purposes:
--   1. Accounting dashboard can compute MRR/ARR from local data (no Stripe API calls)
--   2. Future user-facing billing history / invoices feature
--
-- Also adds billing_interval to user_subscriptions so MRR calculation
-- can distinguish monthly vs yearly subscribers without hitting Stripe.

-- ── Stripe transactions table ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.stripe_transactions (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id           text        UNIQUE NOT NULL,   -- idempotency: prevents duplicate webhook processing
  stripe_subscription_id    text,
  stripe_customer_id        text,
  stripe_invoice_id         text,
  stripe_payment_intent_id  text,
  stripe_charge_id          text,
  user_id                   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type                text        NOT NULL,          -- 'checkout.session.completed', 'invoice.paid', etc.
  transaction_type          text        NOT NULL,          -- 'subscription', 'domain_purchase', 'domain_transfer', 'ecommerce_order', 'addon'
  description               text,                          -- human-readable: "Pro Plan - Monthly", "Domain: example.com"
  plan_name                 text,
  billing_interval          text,                          -- 'month' or 'year' (for subscriptions)
  amount_cents              integer     NOT NULL DEFAULT 0,
  currency                  text        NOT NULL DEFAULT 'cad',
  status                    text        NOT NULL DEFAULT 'succeeded'
                                        CHECK (status IN ('succeeded', 'failed', 'refunded', 'pending')),
  invoice_url               text,                          -- Stripe hosted invoice page (user can view)
  invoice_pdf               text,                          -- direct PDF download URL
  period_start              timestamptz,                   -- billing period start
  period_end                timestamptz,                   -- billing period end
  metadata                  jsonb       DEFAULT '{}',      -- extra context (domain name, order ID, addon type, etc.)
  created_at                timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS stripe_tx_user_id        ON public.stripe_transactions(user_id);
CREATE INDEX IF NOT EXISTS stripe_tx_event_type     ON public.stripe_transactions(event_type);
CREATE INDEX IF NOT EXISTS stripe_tx_type           ON public.stripe_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS stripe_tx_sub_id         ON public.stripe_transactions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS stripe_tx_created        ON public.stripe_transactions(created_at);
CREATE INDEX IF NOT EXISTS stripe_tx_user_created   ON public.stripe_transactions(user_id, created_at DESC);

-- ── Add billing_interval to user_subscriptions ─────────────────────────────
-- Stores 'month' or 'year' so accounting can compute MRR without Stripe API.
-- Set by the webhook on checkout.session.completed and subscription.updated.

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS billing_interval text DEFAULT 'month';

-- ── RLS — service-role bypasses; users can read their own transactions ─────

ALTER TABLE public.stripe_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own billing history (for future invoices page)
CREATE POLICY stripe_transactions_select_own ON public.stripe_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Only service role can insert/update (webhook handler uses admin client)
-- No INSERT/UPDATE/DELETE policies for anon/authenticated = denied by default.
