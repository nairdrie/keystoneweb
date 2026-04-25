-- Migration: 053_launch_requests
-- Stores inbound "Launch Service" (done-for-you setup) consultation requests.
-- Populated by /api/contact/launch, surfaced in /ops/launch.

CREATE TABLE IF NOT EXISTS public.launch_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  -- Contact
  name                  text NOT NULL,
  email                 text NOT NULL,
  phone                 text,
  business_name         text,

  -- Project details
  business_type         text,
  sub_category          text,
  pages                 jsonb NOT NULL DEFAULT '[]'::jsonb,
  logo_status           text,
  domain_status         text,
  launch_timing         text,
  budget_band           text,

  -- Scheduling
  preferred_days        jsonb NOT NULL DEFAULT '[]'::jsonb,
  preferred_times       jsonb NOT NULL DEFAULT '[]'::jsonb,
  scheduling_notes      text,

  -- Free text
  description           text,
  referral_source       text,

  -- Pipeline
  status                text NOT NULL DEFAULT 'new'
                        CHECK (status IN (
                          'new', 'contacted', 'scheduled', 'building',
                          'preview_sent', 'approved', 'paid', 'launched',
                          'post_launch', 'closed_won', 'closed_lost'
                        )),
  assignee_user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes                 text,

  -- Linked site once a build starts (site owned by internal build account
  -- until handoff via /api/sites/transfer).
  site_id               uuid REFERENCES sites(id) ON DELETE SET NULL,

  -- Billing breadcrumbs (manual for v1; staff pastes the Stripe payment link).
  stripe_setup_invoice_id text,
  stripe_checkout_url     text
);

CREATE INDEX IF NOT EXISTS launch_requests_status_idx
  ON launch_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS launch_requests_created_at_idx
  ON launch_requests(created_at DESC);

CREATE INDEX IF NOT EXISTS launch_requests_assignee_idx
  ON launch_requests(assignee_user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_launch_requests_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS launch_requests_updated_at ON launch_requests;
CREATE TRIGGER launch_requests_updated_at
  BEFORE UPDATE ON launch_requests
  FOR EACH ROW EXECUTE FUNCTION update_launch_requests_updated_at();

-- RLS: only the service role reads/writes. Intake route and ops endpoints
-- go through the admin client; no user-facing reads are needed.
ALTER TABLE launch_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to launch_requests"
  ON launch_requests FOR ALL
  USING (auth.role() = 'service_role');
