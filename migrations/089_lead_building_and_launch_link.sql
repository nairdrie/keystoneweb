-- Migration: 089_lead_building_and_launch_link
-- Connects the leads pipeline to the launch-service pipeline.
--
--   1. Adds a 'building' status to leads. When an operator builds a site for a
--      lead from one of their existing sites (a template), the lead moves into
--      this actively-building stage. Surfaced as a "Building" tab in /ops/leads.
--
--   2. Adds launch_requests.lead_id so a launch service request created from a
--      lead links back to its originating lead. This lets the lead detail page
--      show the in-progress launch request, and ties the duplicated site that
--      the operator built into the launch pipeline.

-- ── leads: add 'building' status ───────────────────────────────────────────
-- The original CHECK was defined inline in 058_leads.sql, so Postgres named it
-- leads_status_check. Drop + recreate it with 'building' inserted between
-- 'negotiating' and 'converted'.
ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_status_check
  CHECK (status IN (
    'new', 'researching', 'contacted', 'qualified',
    'proposal_sent', 'negotiating', 'building', 'converted',
    'lost', 'unresponsive', 'do_not_contact'
  ));

-- ── launch_requests: link back to originating lead ─────────────────────────
ALTER TABLE public.launch_requests
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS launch_requests_lead_id_idx
  ON public.launch_requests(lead_id);
