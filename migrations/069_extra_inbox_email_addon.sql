-- Migration 069: register the `extra_inbox_email` add-on type
--
-- Lets a Pro user with a custom domain purchase additional inbox addresses
-- (e.g. support@ in addition to hello@) at $5/month/address. Goes through
-- the existing addon approval / Stripe-attach flow.

ALTER TABLE public.user_addons
  DROP CONSTRAINT IF EXISTS user_addons_addon_type_check;

ALTER TABLE public.user_addons
  ADD CONSTRAINT user_addons_addon_type_check
  CHECK (addon_type IN (
    'extra_sites',
    'extra_domains',
    'extra_storage',
    'extra_ai',
    'white_label',
    'extra_inbox_email'
  ));
