-- Migration 082: Marketing transparency
--
-- Surfaces what's actually happening in a customer's campaigns:
--   * marketing_activity_events  — hourly geo/click data from Google Ads
--   * conversion attribution columns on bookings/orders/members
--   * marketing_wallet.last_daily_digest_at — idempotency for the daily email

-- 1. Activity event ledger ----------------------------------------------------
-- One row per (campaign, date, hour, city) bucket from Google's reporting API.
CREATE TABLE IF NOT EXISTS public.marketing_activity_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id uuid NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
    site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,

    occurred_date date NOT NULL,
    occurred_hour smallint NOT NULL CHECK (occurred_hour >= 0 AND occurred_hour <= 23),

    -- Geographic segment (from Google's segments.geo_target_city etc.)
    geo_city text,
    geo_region text,
    geo_country text,

    -- Device segment (mobile / desktop / tablet)
    device text,

    impressions integer NOT NULL DEFAULT 0,
    clicks integer NOT NULL DEFAULT 0,
    cost_cents integer NOT NULL DEFAULT 0,

    created_at timestamptz DEFAULT now(),

    UNIQUE(campaign_id, occurred_date, occurred_hour, geo_city, geo_region, device)
);

CREATE INDEX IF NOT EXISTS idx_mktg_activity_campaign ON public.marketing_activity_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_mktg_activity_site ON public.marketing_activity_events(site_id);
CREATE INDEX IF NOT EXISTS idx_mktg_activity_recent ON public.marketing_activity_events(occurred_date DESC, occurred_hour DESC);

ALTER TABLE public.marketing_activity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Site owners view own activity" ON public.marketing_activity_events FOR SELECT
    USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));

-- 2. Daily-digest idempotency -------------------------------------------------
ALTER TABLE public.marketing_wallet
    ADD COLUMN IF NOT EXISTS last_daily_digest_at timestamptz;

-- 3. Conversion attribution columns -------------------------------------------
-- A click that lands on the site with utm_campaign=<id> can become a booking,
-- order, member or contact submission. Each gets a nullable FK so the UI can
-- count and value conversions against the campaign.

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS marketing_campaign_id uuid REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS marketing_campaign_id uuid REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL;

ALTER TABLE public.members
    ADD COLUMN IF NOT EXISTS marketing_campaign_id uuid REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL;

-- contact_submissions already has metadata jsonb that the estimate form writes
-- tracking.utm_campaign into. Add a denormalized FK column for fast counts.
ALTER TABLE public.contact_submissions
    ADD COLUMN IF NOT EXISTS marketing_campaign_id uuid REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_mktg_campaign ON public.bookings(marketing_campaign_id) WHERE marketing_campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_mktg_campaign ON public.orders(marketing_campaign_id) WHERE marketing_campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_members_mktg_campaign ON public.members(marketing_campaign_id) WHERE marketing_campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contact_mktg_campaign ON public.contact_submissions(marketing_campaign_id) WHERE marketing_campaign_id IS NOT NULL;
