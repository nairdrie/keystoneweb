-- Add pending_custom_domain to sites table
-- This stores a domain that has been configured but not yet verified (DNS propagation or transfer completion)
-- Once verified, it gets promoted to custom_domain

ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS pending_custom_domain character varying UNIQUE;
