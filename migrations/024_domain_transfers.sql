-- Migration 024: Domain transfer support
-- Adds transfer-specific columns to domain_purchases

ALTER TABLE domain_purchases
  ADD COLUMN IF NOT EXISTS purchase_type text NOT NULL DEFAULT 'registration'
    CHECK (purchase_type IN ('registration', 'transfer')),
  ADD COLUMN IF NOT EXISTS transfer_status text
    CHECK (transfer_status IN ('initiated', 'pending_approval', 'completed', 'failed', 'cancelled')),
  ADD COLUMN IF NOT EXISTS vercel_transfer_id text,
  ADD COLUMN IF NOT EXISTS transfer_auth_code text,
  ADD COLUMN IF NOT EXISTS contact_first_name text,
  ADD COLUMN IF NOT EXISTS contact_last_name text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS contact_address1 text,
  ADD COLUMN IF NOT EXISTS contact_city text,
  ADD COLUMN IF NOT EXISTS contact_state text,
  ADD COLUMN IF NOT EXISTS contact_zip text,
  ADD COLUMN IF NOT EXISTS contact_country text;

-- Index for looking up in-progress transfers
CREATE INDEX IF NOT EXISTS idx_domain_purchases_transfer_status
  ON domain_purchases (transfer_status)
  WHERE transfer_status IS NOT NULL;
