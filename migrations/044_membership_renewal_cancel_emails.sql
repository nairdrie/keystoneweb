-- Migration 044: Add renewal and cancellation email template columns to membership_settings
-- Allows site owners to customize the subject/body/CTA for renewal and cancellation emails

ALTER TABLE public.membership_settings
  ADD COLUMN IF NOT EXISTS renewal_email_subject text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS renewal_email_body text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS renewal_cta_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS renewal_cta_label text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cancellation_email_subject text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cancellation_email_body text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cancellation_cta_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancellation_cta_label text DEFAULT NULL;
