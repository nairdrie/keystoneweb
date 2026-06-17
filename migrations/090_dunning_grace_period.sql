-- Migration 090: Failed-payment dunning + grace period tracking
--
-- When a subscription payment fails, Stripe marks the subscription `past_due`
-- and begins its Smart Retry schedule. We keep the customer on full (Pro) access
-- during this grace window and dun them via email + an in-app banner, only
-- landing them on Free once Stripe finally cancels the subscription.
--
-- These columns let us drive that flow:
--   payment_failed_at        — when the first failed charge for the current lapse occurred
--   grace_period_ends_at     — when Pro access is expected to end if payment isn't fixed
--   last_dunning_email_stage — which dunning email we last sent ('failure' | 'reminder' | 'final')
--   last_dunning_email_at    — when we last sent a dunning email (idempotency guard)
--   cancellation_reason      — why the subscription ended ('payment_failed' | 'user_requested')
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS payment_failed_at        TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS grace_period_ends_at     TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_dunning_email_stage TEXT,
  ADD COLUMN IF NOT EXISTS last_dunning_email_at     TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS cancellation_reason       TEXT;

-- Backstop cron scans for past_due rows near their grace deadline.
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_grace
  ON public.user_subscriptions (grace_period_ends_at)
  WHERE subscription_status = 'past_due';
