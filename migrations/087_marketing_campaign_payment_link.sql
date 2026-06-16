-- Durable, shareable Stripe Payment Links for campaign prepay.
--
-- Previously /approve created a one-shot Stripe Checkout Session and the wizard
-- force-redirected the customer to it. That gave the operator no way to hand a
-- payment link to the client (Checkout Session URLs also expire ~24h after
-- creation). We now create a real Stripe Payment Link that never expires and is
-- restricted to a single completed payment, and store it on the campaign so the
-- "Continue to payment" / "Copy payment link" actions can reuse it across
-- reloads and re-approvals.

ALTER TABLE marketing_campaigns
  ADD COLUMN IF NOT EXISTS payment_link_id text,
  ADD COLUMN IF NOT EXISTS payment_link_url text;

COMMENT ON COLUMN marketing_campaigns.payment_link_id IS
  'Stripe Payment Link id (plink_...) for the current prepay of this campaign. Single-use (restrictions.completed_sessions.limit = 1); auto-deactivates after payment.';
COMMENT ON COLUMN marketing_campaigns.payment_link_url IS
  'Public URL of the Stripe Payment Link. Surfaced as "Continue to payment" / "Copy payment link" while the campaign is awaiting payment.';
