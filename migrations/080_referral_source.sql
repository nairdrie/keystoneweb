-- Migration 080: Track referral source on subscriptions for partner payouts.
-- Captured from the `?ref=...` URL param (via the `ks_ref` cookie) at checkout,
-- or backfilled from the Stripe promotion code if the customer used one.
-- Lowercased slug, e.g. 'compuwarez'.

ALTER TABLE public.user_subscriptions
    ADD COLUMN IF NOT EXISTS referral_source text;

CREATE INDEX IF NOT EXISTS user_subscriptions_referral_source_idx
    ON public.user_subscriptions (referral_source)
    WHERE referral_source IS NOT NULL;
