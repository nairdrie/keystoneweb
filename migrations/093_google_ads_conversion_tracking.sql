-- Google Ads conversion tracking, provisioned per site (sub-account).
--
-- google_ads_conversion_id     : the account-level Google tag, e.g. "AW-18264425836".
-- google_ads_conversion_labels : { event_type -> conversion label } so the site
--                                 can fire the right gtag event per action
--                                 (call, lead_form, booking, order, signup).

ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS google_ads_conversion_id text;

ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS google_ads_conversion_labels jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.sites.google_ads_conversion_id IS
  'Account-level Google Ads tag id (AW-…) injected into the published site for conversion tracking.';
COMMENT ON COLUMN public.sites.google_ads_conversion_labels IS
  'Map of conversion event type (call, lead_form, booking, order, signup) to its Google Ads conversion label.';

-- Phone/tel: clicks are the one conversion with no existing server record
-- (bookings/orders/members/contacts already persist marketing_campaign_id). Store
-- ad-attributed call clicks so they count in the Keystone campaign dashboard too.
CREATE TABLE IF NOT EXISTS public.marketing_call_clicks (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id               uuid REFERENCES public.sites(id) ON DELETE CASCADE,
  marketing_campaign_id uuid REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  page_url              text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_call_clicks_campaign
  ON public.marketing_call_clicks (marketing_campaign_id);
