-- Migration: 059_lead_prospects
-- Auto-discovered lead prospects from the GTA scraping pipeline.
--
-- Two tables:
--   lead_discovery_queries -- the niche x city matrix the cron rotates through.
--                            Each row is a Google Places searchText query that
--                            gets paginated across multiple cron runs.
--   lead_prospects         -- raw prospects discovered by the cron, with audit
--                            results (PageSpeed + CMS sniff). Promoted to the
--                            real `leads` table via an ops UI action.

CREATE TABLE IF NOT EXISTS public.lead_discovery_queries (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  niche               text NOT NULL,
  city                text NOT NULL,
  -- Sub-region of the GTA. Discovery cron picks one region per weekday so
  -- a day's prospects are geographically coherent for outreach.
  region              text NOT NULL CHECK (region IN (
                        'toronto_core', 'york', 'peel', 'halton', 'durham'
                      )),

  enabled             boolean NOT NULL DEFAULT true,

  -- Pagination cursor. Places searchText returns up to 20 results per page,
  -- ~3 pages per query. We advance one page per visit, store nextPageToken
  -- for the next visit. When token is null AND page_index > 0, the query is
  -- exhausted; cooldown_until is set so we requeue it later (new businesses
  -- will have appeared by then).
  next_page_token     text,
  page_index          integer NOT NULL DEFAULT 0,
  total_results_seen  integer NOT NULL DEFAULT 0,

  last_run_at         timestamptz,
  cooldown_until      timestamptz,
  last_error          text,

  UNIQUE(niche, city)
);

CREATE INDEX IF NOT EXISTS lead_discovery_queries_region_idx
  ON public.lead_discovery_queries(region, last_run_at NULLS FIRST);

CREATE INDEX IF NOT EXISTS lead_discovery_queries_enabled_idx
  ON public.lead_discovery_queries(enabled) WHERE enabled = true;


CREATE TABLE IF NOT EXISTS public.lead_prospects (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  -- Google Places stable id; UNIQUE keeps dedup simple across queries.
  place_id                text NOT NULL UNIQUE,
  name                    text NOT NULL,
  formatted_address       text,
  city                    text,
  region                  text,
  phone                   text,
  website                 text,
  business_types          text[],

  discovered_via_query_id uuid REFERENCES public.lead_discovery_queries(id) ON DELETE SET NULL,
  discovered_at           timestamptz NOT NULL DEFAULT now(),

  -- Audit pipeline state. 'no_website' is a terminal happy path (the easy pitch).
  audit_status            text NOT NULL DEFAULT 'pending'
                          CHECK (audit_status IN (
                            'pending', 'auditing', 'audited', 'failed', 'no_website'
                          )),
  audit_attempted_at      timestamptz,
  audit_completed_at      timestamptz,
  audit_error             text,

  -- Lighthouse scores 0-100; null if unaudited/failed.
  perf_score              integer,
  seo_score               integer,
  best_practices_score    integer,
  accessibility_score     integer,
  mobile_load_seconds     numeric,
  uses_https              boolean,
  failed_audits           text[],

  -- CMS detection
  cms                     text,
  cms_confidence          text CHECK (cms_confidence IN ('high', 'medium', 'low') OR cms_confidence IS NULL),
  cms_signals             jsonb,

  -- Pitch surface
  pitch_angles            text[] NOT NULL DEFAULT '{}',
  pitch_strength          integer NOT NULL DEFAULT 0,

  -- Workflow
  dismissed_at            timestamptz,
  dismissed_reason        text,
  promoted_lead_id        uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  promoted_at             timestamptz
);

CREATE INDEX IF NOT EXISTS lead_prospects_status_idx
  ON public.lead_prospects(audit_status, pitch_strength DESC);

CREATE INDEX IF NOT EXISTS lead_prospects_region_idx
  ON public.lead_prospects(region, pitch_strength DESC);

CREATE INDEX IF NOT EXISTS lead_prospects_active_idx
  ON public.lead_prospects(pitch_strength DESC, discovered_at DESC)
  WHERE dismissed_at IS NULL AND promoted_lead_id IS NULL;

CREATE INDEX IF NOT EXISTS lead_prospects_discovered_at_idx
  ON public.lead_prospects(discovered_at DESC);


-- Auto-update updated_at on both tables
CREATE OR REPLACE FUNCTION update_lead_prospects_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS lead_prospects_updated_at ON public.lead_prospects;
CREATE TRIGGER lead_prospects_updated_at
  BEFORE UPDATE ON public.lead_prospects
  FOR EACH ROW EXECUTE FUNCTION update_lead_prospects_updated_at();

CREATE OR REPLACE FUNCTION update_lead_discovery_queries_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS lead_discovery_queries_updated_at ON public.lead_discovery_queries;
CREATE TRIGGER lead_discovery_queries_updated_at
  BEFORE UPDATE ON public.lead_discovery_queries
  FOR EACH ROW EXECUTE FUNCTION update_lead_discovery_queries_updated_at();


-- RLS: service role only. All access goes through the cron + ops admin client.
ALTER TABLE public.lead_prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to lead_prospects"
  ON public.lead_prospects FOR ALL
  USING (auth.role() = 'service_role');

ALTER TABLE public.lead_discovery_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to lead_discovery_queries"
  ON public.lead_discovery_queries FOR ALL
  USING (auth.role() = 'service_role');


-- Seed the GTA discovery matrix: 20 niches x 23 cities = 460 queries.
-- Niches focus on local service businesses that historically have weak
-- websites (good Keystone pitch surface).
INSERT INTO public.lead_discovery_queries (niche, city, region)
SELECT niche, city, region
FROM (
  VALUES
    -- Toronto core
    ('Toronto', 'toronto_core'),
    ('North York', 'toronto_core'),
    ('Scarborough', 'toronto_core'),
    ('Etobicoke', 'toronto_core'),
    ('East York', 'toronto_core'),
    -- York Region
    ('Vaughan', 'york'),
    ('Markham', 'york'),
    ('Richmond Hill', 'york'),
    ('Aurora', 'york'),
    ('Newmarket', 'york'),
    ('Stouffville', 'york'),
    ('King City', 'york'),
    -- Peel Region
    ('Mississauga', 'peel'),
    ('Brampton', 'peel'),
    ('Caledon', 'peel'),
    -- Halton Region
    ('Oakville', 'halton'),
    ('Burlington', 'halton'),
    ('Milton', 'halton'),
    ('Halton Hills', 'halton'),
    -- Durham Region
    ('Pickering', 'durham'),
    ('Ajax', 'durham'),
    ('Whitby', 'durham'),
    ('Oshawa', 'durham')
) AS cities(city, region)
CROSS JOIN (
  VALUES
    ('plumber'),
    ('electrician'),
    ('hvac contractor'),
    ('roofer'),
    ('landscaper'),
    ('painter'),
    ('general contractor'),
    ('handyman'),
    ('accountant'),
    ('small law firm'),
    ('dentist'),
    ('chiropractor'),
    ('auto repair shop'),
    ('auto body shop'),
    ('hair salon'),
    ('nail salon'),
    ('barbershop'),
    ('pet groomer'),
    ('real estate agent'),
    ('cleaning service')
) AS niches(niche)
ON CONFLICT (niche, city) DO NOTHING;
