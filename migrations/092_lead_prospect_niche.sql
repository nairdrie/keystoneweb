-- Migration: 092_lead_prospect_niche
-- Give every prospect a clean, filterable category (the discovery niche, e.g.
-- "landscaper") so ops can filter the call list to one trade at a time instead
-- of paging through everything. Backfills existing rows from the discovery
-- query they came from.

ALTER TABLE public.lead_prospects
  ADD COLUMN IF NOT EXISTS niche text;

UPDATE public.lead_prospects p
SET niche = q.niche
FROM public.lead_discovery_queries q
WHERE p.discovered_via_query_id = q.id
  AND p.niche IS NULL;

-- Filter index for the active call list, scoped per niche.
CREATE INDEX IF NOT EXISTS lead_prospects_niche_idx
  ON public.lead_prospects (niche, review_count DESC NULLS LAST)
  WHERE dismissed_at IS NULL AND promoted_lead_id IS NULL;
