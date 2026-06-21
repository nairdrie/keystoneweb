-- Migration: 091_lead_prospects_no_website_focus
-- Repolish the discovery pipeline around a single ICP: local businesses with
-- NO website that we can phone. Adds the Google quality signals we now use to
-- qualify + rank a call list (rating, review count, business status), clears
-- the website-having backlog out of the working view, and widens the niche net
-- toward micro-businesses that frequently have no site.

-- ── 1. Quality signals from Google Places ────────────────────────────────────
ALTER TABLE public.lead_prospects
  ADD COLUMN IF NOT EXISTS rating          numeric,
  ADD COLUMN IF NOT EXISTS review_count    integer,
  ADD COLUMN IF NOT EXISTS business_status text;

-- Call list ordering: most-reviewed (most established) no-website businesses first.
CREATE INDEX IF NOT EXISTS lead_prospects_no_website_call_idx
  ON public.lead_prospects (review_count DESC NULLS LAST, discovered_at DESC)
  WHERE website IS NULL AND dismissed_at IS NULL AND promoted_lead_id IS NULL;

-- ── 2. Clear the website-having backlog out of the active view ────────────────
-- The old cron stored every result regardless of website, so ~95% of prospects
-- have a site and are out of scope now. Dismiss them (reversible via Restore)
-- so the working list is no-website only. Promoted ones are left untouched.
UPDATE public.lead_prospects
SET dismissed_at = COALESCE(dismissed_at, now()),
    dismissed_reason = COALESCE(dismissed_reason,
      'Has a website — out of scope for the no-website calling focus')
WHERE website IS NOT NULL
  AND dismissed_at IS NULL
  AND promoted_lead_id IS NULL;

-- ── 3. Widen the niche net toward businesses that usually have no website ─────
-- Same 23-city GTA matrix, more micro-service niches. ON CONFLICT keeps it
-- idempotent against the existing seed.
INSERT INTO public.lead_discovery_queries (niche, city, region)
SELECT niche, city, region
FROM (
  VALUES
    ('Toronto', 'toronto_core'),
    ('North York', 'toronto_core'),
    ('Scarborough', 'toronto_core'),
    ('Etobicoke', 'toronto_core'),
    ('East York', 'toronto_core'),
    ('Vaughan', 'york'),
    ('Markham', 'york'),
    ('Richmond Hill', 'york'),
    ('Aurora', 'york'),
    ('Newmarket', 'york'),
    ('Stouffville', 'york'),
    ('King City', 'york'),
    ('Mississauga', 'peel'),
    ('Brampton', 'peel'),
    ('Caledon', 'peel'),
    ('Oakville', 'halton'),
    ('Burlington', 'halton'),
    ('Milton', 'halton'),
    ('Halton Hills', 'halton'),
    ('Pickering', 'durham'),
    ('Ajax', 'durham'),
    ('Whitby', 'durham'),
    ('Oshawa', 'durham')
) AS cities(city, region)
CROSS JOIN (
  VALUES
    ('mobile mechanic'),
    ('junk removal'),
    ('snow removal'),
    ('fence installer'),
    ('deck builder'),
    ('window cleaning'),
    ('pressure washing'),
    ('pool service'),
    ('tree service'),
    ('moving company'),
    ('catering'),
    ('personal trainer'),
    ('photographer'),
    ('appliance repair'),
    ('locksmith'),
    ('flooring installer'),
    ('drywall contractor'),
    ('tiling contractor'),
    ('concrete contractor'),
    ('masonry contractor'),
    ('gutter cleaning'),
    ('pest control'),
    ('mobile detailing'),
    ('tutoring service')
) AS niches(niche)
ON CONFLICT (niche, city) DO NOTHING;
