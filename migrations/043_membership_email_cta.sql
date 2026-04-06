-- Migration 043: Per-template CTA button control for membership emails

ALTER TABLE public.membership_settings
  ADD COLUMN IF NOT EXISTS email_verification_cta_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_verification_cta_label   text    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS password_reset_cta_enabled     boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS password_reset_cta_label       text    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS welcome_cta_enabled            boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS welcome_cta_label              text    DEFAULT NULL;
