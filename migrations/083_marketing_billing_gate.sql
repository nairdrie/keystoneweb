-- Marketing billing gate: tracks per-sub-account billing setup so the ops team
-- can manually configure billing in Google Ads before campaigns launch.
--
-- Flow:
--   1. Customer approves campaign -> ensure sub-account exists, save campaign as
--      'pending_launch', notify ops.
--   2. Ops configures billing in Google Ads UI for that sub-account (one-time
--      per client, until Google approves consolidated MCC billing).
--   3. Ops marks the campaign as launched via /admin/marketing/_ops -> the
--      campaign gets created in Google Ads and goes active.
--   4. After first launch, sites.google_ads_billing_ready = true, and
--      subsequent campaigns from that site skip the ops gate.

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS google_ads_billing_ready boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN sites.google_ads_billing_ready IS
  'True once the Google Ads sub-account for this site has a working billing setup. Set by ops after manually adding a payment method to the sub-account. When false, new campaign approvals are queued for ops review instead of being launched directly.';
