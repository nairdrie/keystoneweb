-- Track when a user last acquired any domain (free, paid, or transfer-in).
-- Used to enforce the 1-per-month domain claim cooldown even after a domain
-- is transferred out via site transfer.
ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS last_domain_claimed_at timestamptz;

-- Backfill from free_domain_claimed_at for existing users who have claimed a domain.
UPDATE user_subscriptions
  SET last_domain_claimed_at = free_domain_claimed_at
  WHERE free_domain_claimed = true
    AND free_domain_claimed_at IS NOT NULL
    AND last_domain_claimed_at IS NULL;
