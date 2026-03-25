-- Domain ownership: allow domains to persist independently of sites.
-- When a site is deleted, the domain remains owned by the user until its
-- registration expires or the user cancels auto-renewal.

-- Make site_id nullable so domains can exist without a site
ALTER TABLE domain_purchases
  ALTER COLUMN site_id DROP NOT NULL;

-- Track domain registration lifecycle
ALTER TABLE domain_purchases
  ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS auto_renew boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone;
