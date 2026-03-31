-- Migration 035: Track Vercel's cost for domain transfers
-- amount_cents = what user paid us (can be 0 for free transfers)
-- vercel_cost_cents = what Vercel bills us (always > 0 for any transfer)
-- The difference is our subsidy for Pro users using their free domain credit.

ALTER TABLE domain_purchases
  ADD COLUMN IF NOT EXISTS vercel_cost_cents integer;

COMMENT ON COLUMN domain_purchases.vercel_cost_cents IS
  'Wholesale cost Vercel bills us for this transfer/registration. '
  'For free Pro transfers, amount_cents=0 but this is still non-zero.';
