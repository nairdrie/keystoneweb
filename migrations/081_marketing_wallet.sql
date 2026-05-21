-- Migration 081: Marketing Wallet + Sub-account Provisioning
--
-- Adds the customer-facing marketing infrastructure on top of 048:
--   * Per-site prepaid wallet (Stripe top-up -> credit, daily ad spend -> debit)
--   * Wallet transaction ledger
--   * First-launch approval gate
--   * sites.google_ads_customer_id  (per-site MCC sub-account ID)
--   * sites.marketing_enabled       (feature flag, ops toggleable)

-- 1. Per-site columns ----------------------------------------------------------
ALTER TABLE public.sites
    ADD COLUMN IF NOT EXISTS google_ads_customer_id text,
    ADD COLUMN IF NOT EXISTS marketing_enabled boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_sites_marketing_enabled
    ON public.sites(marketing_enabled) WHERE marketing_enabled = true;

-- 2. Marketing wallet ---------------------------------------------------------
-- One wallet per site. Balance is denormalized; the txn ledger is the source of truth.
CREATE TABLE IF NOT EXISTS public.marketing_wallet (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    balance_cents integer NOT NULL DEFAULT 0,
    lifetime_credited_cents integer NOT NULL DEFAULT 0,
    lifetime_debited_cents integer NOT NULL DEFAULT 0,
    low_balance_notified_at timestamptz,
    empty_balance_notified_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),

    UNIQUE(site_id)
);

CREATE INDEX IF NOT EXISTS idx_mktg_wallet_site ON public.marketing_wallet(site_id);

-- 3. Wallet transactions (immutable ledger) ----------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_wallet_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    wallet_id uuid NOT NULL REFERENCES public.marketing_wallet(id) ON DELETE CASCADE,

    -- 'credit' = customer top-up via Stripe; 'debit' = daily ad spend rollup;
    -- 'refund' = manual refund/adjustment by ops.
    kind text NOT NULL CHECK (kind IN ('credit', 'debit', 'refund')),

    -- Positive integer cents (sign is implied by kind)
    amount_cents integer NOT NULL CHECK (amount_cents > 0),

    -- Balance immediately after this txn was applied (for audit + reconciliation)
    balance_after_cents integer NOT NULL,

    -- Stripe identifiers for credits/refunds
    stripe_payment_intent_id text,
    stripe_checkout_session_id text,

    -- For debits: which campaign + date this debit covers
    campaign_id uuid REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
    spend_date date,

    -- For debits: raw Google spend before markup; markup applied separately for display.
    raw_ad_spend_cents integer,
    markup_cents integer,

    description text,
    actor text NOT NULL DEFAULT 'system',  -- 'system' | 'user:<email>' | 'cron' | 'ops:<email>'
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mktg_wallet_tx_site ON public.marketing_wallet_transactions(site_id);
CREATE INDEX IF NOT EXISTS idx_mktg_wallet_tx_wallet ON public.marketing_wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_mktg_wallet_tx_kind ON public.marketing_wallet_transactions(kind);
CREATE INDEX IF NOT EXISTS idx_mktg_wallet_tx_created ON public.marketing_wallet_transactions(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_mktg_wallet_tx_stripe_pi
    ON public.marketing_wallet_transactions(stripe_payment_intent_id)
    WHERE stripe_payment_intent_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_mktg_wallet_tx_debit_per_day
    ON public.marketing_wallet_transactions(campaign_id, spend_date)
    WHERE kind = 'debit';

-- 4. First-launch approval records -------------------------------------------
-- Each campaign needs one approved record before it can be submitted to Google
-- the first time. Subsequent edits don't require re-approval (see spec).
CREATE TABLE IF NOT EXISTS public.marketing_approvals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id uuid NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_by_email text,
    -- Snapshot of what was approved, in case the campaign is later edited.
    snapshot jsonb NOT NULL,
    created_at timestamptz DEFAULT now(),

    UNIQUE(campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_mktg_approvals_site ON public.marketing_approvals(site_id);

-- 5. RLS ----------------------------------------------------------------------
ALTER TABLE public.marketing_wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Site owners manage own wallet" ON public.marketing_wallet FOR ALL
    USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()))
    WITH CHECK (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));

CREATE POLICY "Site owners view own wallet txns" ON public.marketing_wallet_transactions FOR SELECT
    USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));

CREATE POLICY "Site owners manage own approvals" ON public.marketing_approvals FOR ALL
    USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()))
    WITH CHECK (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));
