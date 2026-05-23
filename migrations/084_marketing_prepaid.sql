-- Per-campaign prepaid billing model. Replaces the site-level marketing_wallet.
--
-- Customer pays upfront for each campaign via Stripe Checkout. The prepaid
-- amount sits on the campaign. As Google reports spend, we track it against
-- prepaid_cents. When spend (with 5% markup baked in) reaches prepaid_cents,
-- the campaign auto-pauses. Customer can top up to resume or cancel to refund
-- any remaining balance.

-- Add prepaid columns to campaigns
ALTER TABLE marketing_campaigns
  ADD COLUMN IF NOT EXISTS prepaid_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prepaid_refunded_cents integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN marketing_campaigns.prepaid_cents IS
  'Total amount (in cents) the customer has prepaid for this campaign. Sum of all successful payments from marketing_campaign_payments. Includes the 5% service fee.';
COMMENT ON COLUMN marketing_campaigns.prepaid_refunded_cents IS
  'Total amount refunded back to the customer via Stripe for this campaign.';

-- Per-campaign payment ledger (initial prepay + top-ups + refunds)
CREATE TABLE IF NOT EXISTS marketing_campaign_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('prepay', 'topup', 'refund')),
  amount_cents integer NOT NULL,                          -- positive for prepay/topup, positive for refund (amount returned)
  raw_ad_spend_cents integer NOT NULL DEFAULT 0,          -- the portion covering actual Google spend (= amount / 1.05 for prepay/topup)
  service_fee_cents integer NOT NULL DEFAULT 0,           -- the 5% markup portion
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  stripe_refund_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed')),
  actor text NOT NULL DEFAULT 'system',
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  succeeded_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_mcp_campaign ON marketing_campaign_payments(campaign_id);
CREATE INDEX IF NOT EXISTS idx_mcp_site ON marketing_campaign_payments(site_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_mcp_pi
  ON marketing_campaign_payments(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_mcp_refund
  ON marketing_campaign_payments(stripe_refund_id)
  WHERE stripe_refund_id IS NOT NULL;

-- Move the daily-digest "last sent" tracker from marketing_wallet to sites
-- (since wallet is going away in favor of per-campaign prepaid).
ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS last_marketing_digest_at timestamptz;

COMMENT ON COLUMN sites.last_marketing_digest_at IS
  'Idempotency guard for the daily marketing digest email cron. Set to NOW() after a successful send.';
