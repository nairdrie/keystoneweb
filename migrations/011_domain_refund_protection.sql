-- Track which subscription period granted a free domain, and flag the subscription
-- so we have evidence to block refunds when a digital good (domain) was delivered.

ALTER TABLE domain_purchases
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS free_domain_claimed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS free_domain_claimed_at timestamp with time zone;
