-- Migration: 082_launch_service_pipeline
-- Extends launch_requests with operator-configurable launch config + a
-- client-facing onboarding state machine, and adds user-level flags that
-- drive launch-onboarding editor behavior.

-- ──────────────────────────────────────────────────────────────────────────
-- launch_requests: launch config + onboarding state
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.launch_requests
  ADD COLUMN IF NOT EXISTS launch_config jsonb,
  ADD COLUMN IF NOT EXISTS onboarding_token text,
  ADD COLUMN IF NOT EXISTS onboarding_status text NOT NULL DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS onboarding_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS launch_service_price_cents int NOT NULL DEFAULT 39900,
  ADD COLUMN IF NOT EXISTS changes_requested_text text,
  ADD COLUMN IF NOT EXISTS launched_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS launch_requests_onboarding_token_idx
  ON public.launch_requests(onboarding_token)
  WHERE onboarding_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS launch_requests_onboarding_status_idx
  ON public.launch_requests(onboarding_status);

-- onboarding_status values:
--   'not_sent'           — operator hasn't sent the onboarding email yet
--   'sent'               — email sent, client hasn't claimed the token
--   'set_password'       — token claimed, account auto-created, password not yet set
--   'previewing'         — password set, on the preview step
--   'editing'            — client clicked "Edit it myself" into the editor
--   'changes_requested'  — client submitted the change-request form; back to operator
--   'awaiting_payment'   — on the payment step
--   'launching'          — Stripe payment succeeded, provisioning in progress
--   'launched'           — site is live
--   'failed'             — provisioning failed; needs operator intervention
ALTER TABLE public.launch_requests
  DROP CONSTRAINT IF EXISTS launch_requests_onboarding_status_check;
ALTER TABLE public.launch_requests
  ADD CONSTRAINT launch_requests_onboarding_status_check
  CHECK (onboarding_status IN (
    'not_sent', 'sent', 'set_password', 'previewing', 'editing',
    'changes_requested', 'awaiting_payment', 'launching', 'launched', 'failed'
  ));

-- ──────────────────────────────────────────────────────────────────────────
-- users: launch-service flags
-- ──────────────────────────────────────────────────────────────────────────
-- launch_service_active: true while the client is in the launch onboarding
--   flow (between password-set and live). Drives:
--     - publish-button interception in the editor (routes to payment step)
--     - support tagging
--   Cleared by the Stripe webhook once provisioning completes.
--
-- suppress_designer_walkthrough: true permanently for any user who came
--   through launch service. We built their site; we never want to nag them
--   into changing colors / adding pages.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS launch_service_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suppress_designer_walkthrough boolean NOT NULL DEFAULT false;
