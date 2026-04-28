-- Migration: 058_leads
-- Sales / outreach lead tracking. A lead is anyone we're trying to convert
-- into a Keystone account (cold call, walk-in, referral, networking event,
-- web form, etc.). Surfaced at /ops/leads.
--
-- Two tables:
--   leads               -- the prospect record + acquisition + conversion fields
--   lead_contact_events -- timeline of touches (calls, meetings, notes, sent emails)

CREATE TABLE IF NOT EXISTS public.leads (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  -- Contact / research
  contact_name            text,
  person_role             text,
  business_name           text,
  email                   text,
  phone                   text,
  website                 text,
  has_existing_website    boolean,
  business_type           text,
  business_subcategory    text,
  address                 text,
  city                    text,
  region                  text,
  country                 text,
  postal_code             text,

  -- Acquisition
  source                  text NOT NULL DEFAULT 'other'
                          CHECK (source IN (
                            'cold_call', 'cold_email', 'walk_in', 'referral',
                            'web_form', 'networking_event', 'social_media',
                            'paid_ad', 'organic_search', 'launch_request',
                            'partner', 'other'
                          )),
  source_detail           text,
  referred_by_user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Pipeline
  status                  text NOT NULL DEFAULT 'new'
                          CHECK (status IN (
                            'new', 'researching', 'contacted', 'qualified',
                            'proposal_sent', 'negotiating', 'converted',
                            'lost', 'unresponsive', 'do_not_contact'
                          )),
  lost_reason             text,
  assignee_user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Conversion
  converted_user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  converted_at            timestamptz,
  onboarding_amount_cents integer,

  -- Free-form
  notes                   text,
  tags                    jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS leads_status_created_idx
  ON public.leads(status, created_at DESC);

CREATE INDEX IF NOT EXISTS leads_created_at_idx
  ON public.leads(created_at DESC);

CREATE INDEX IF NOT EXISTS leads_assignee_idx
  ON public.leads(assignee_user_id);

CREATE INDEX IF NOT EXISTS leads_source_idx
  ON public.leads(source);

CREATE INDEX IF NOT EXISTS leads_email_lower_idx
  ON public.leads(lower(email));


CREATE TABLE IF NOT EXISTS public.lead_contact_events (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  lead_id                 uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  kind                    text NOT NULL
                          CHECK (kind IN (
                            'call', 'meeting', 'voicemail', 'sms',
                            'email_sent', 'email_received', 'note'
                          )),
  occurred_at             timestamptz NOT NULL DEFAULT now(),
  outcome                 text,
  notes                   text,
  created_by_user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ops_sent_email_id       uuid REFERENCES public.ops_sent_emails(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS lead_contact_events_lead_idx
  ON public.lead_contact_events(lead_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS lead_contact_events_kind_idx
  ON public.lead_contact_events(kind);


-- Auto-update updated_at on leads
CREATE OR REPLACE FUNCTION update_leads_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS leads_updated_at ON public.leads;
CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION update_leads_updated_at();

-- Auto-update updated_at on lead_contact_events
CREATE OR REPLACE FUNCTION update_lead_contact_events_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS lead_contact_events_updated_at ON public.lead_contact_events;
CREATE TRIGGER lead_contact_events_updated_at
  BEFORE UPDATE ON public.lead_contact_events
  FOR EACH ROW EXECUTE FUNCTION update_lead_contact_events_updated_at();


-- RLS: only the service role reads/writes. All access goes through the
-- ops admin client; no user-facing reads are needed.
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to leads"
  ON public.leads FOR ALL
  USING (auth.role() = 'service_role');

ALTER TABLE public.lead_contact_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to lead_contact_events"
  ON public.lead_contact_events FOR ALL
  USING (auth.role() = 'service_role');
