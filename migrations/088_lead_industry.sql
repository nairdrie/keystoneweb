-- Migration: 088_lead_industry
-- Adds an `industry` vertical to leads so the /ops/leads pipeline can be
-- tagged and filtered by industry (Automotive, Landscaping, Accounting,
-- Handyman, Roofer, Real Estate, Dental, Spa, etc.).
--
-- Stored as free text (no CHECK constraint) and validated at the app layer
-- via LEAD_INDUSTRIES in lib/ops/leads.ts, so new verticals can be added
-- without a schema migration. NULL means "unset".

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS industry text;

CREATE INDEX IF NOT EXISTS leads_industry_idx
  ON public.leads(industry);
