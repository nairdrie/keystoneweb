-- Migration 098: Real registrant details for domain registrations
--
-- Domain purchases used to send placeholder owner details to Vercel, which
-- registries with extra rules (e.g. .ca / CIRA) reject. The purchase flow now
-- collects the owner's details and stores them on the purchase so the Stripe
-- webhook can register paid domains with them. contact_* columns from 024 are
-- reused; these add the remaining fields plus failure/refund tracking.

ALTER TABLE domain_purchases
  ADD COLUMN IF NOT EXISTS contact_address2 text,
  ADD COLUMN IF NOT EXISTS contact_company_name text,
  -- TLD-specific fields (e.g. {"legal_type":"CCT","lang_pref":"EN"} for .ca)
  ADD COLUMN IF NOT EXISTS contact_additional jsonb,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz;
