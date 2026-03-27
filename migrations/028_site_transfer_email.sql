-- Migration 028: Add recipient_email and include_domain to site_transfers
-- Transitions site transfer flow from link-based to email-based

ALTER TABLE public.site_transfers
  ADD COLUMN IF NOT EXISTS recipient_email TEXT,
  ADD COLUMN IF NOT EXISTS include_domain BOOLEAN NOT NULL DEFAULT false;
