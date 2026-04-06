-- Migration 042: Membership email template customisation
-- Adds per-site editable subjects/bodies for system emails

ALTER TABLE public.membership_settings
  ADD COLUMN IF NOT EXISTS email_verification_subject text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS email_verification_body    text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS password_reset_subject     text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS password_reset_body        text DEFAULT NULL;
