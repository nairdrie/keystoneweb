-- Migration: 091_lead_prospect_niche
-- Adds a clean `niche` category to lead_prospects so the discover UI can
-- badge + filter prospects by the niche they were discovered under
-- (e.g. "plumber", "hvac contractor") instead of the raw Google Places
-- business_types array.
--
-- The niche already lives on lead_discovery_queries (the niche x city matrix
-- the cron rotates through); discovery just never copied it onto the prospect.
-- We add the column, backfill from the originating query, and index it for
-- the new filter.

ALTER TABLE public.lead_prospects
  ADD COLUMN IF NOT EXISTS niche text;

-- Backfill existing prospects from the query that discovered them.
UPDATE public.lead_prospects p
SET niche = q.niche
FROM public.lead_discovery_queries q
WHERE p.discovered_via_query_id = q.id
  AND p.niche IS NULL;

CREATE INDEX IF NOT EXISTS lead_prospects_niche_idx
  ON public.lead_prospects(niche);
