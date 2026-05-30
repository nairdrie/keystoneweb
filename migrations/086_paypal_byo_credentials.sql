-- 086_paypal_byo_credentials.sql
-- Move PayPal off the Commerce Platform (Partner) model onto bring-your-own
-- credentials: each site stores its own PayPal REST app Client ID + Secret and
-- creates/captures orders with its own OAuth token. The owner is merchant of
-- record and funds settle directly to their PayPal account — no partner
-- approval required.
--
-- The legacy partner columns (paypal_merchant_id, paypal_onboarding_status, …)
-- from 057_paypal_connect.sql are left in place; they're simply no longer read.

ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS paypal_client_id     text,
  ADD COLUMN IF NOT EXISTS paypal_secret        text,
  ADD COLUMN IF NOT EXISTS paypal_sandbox_mode  boolean DEFAULT false;
