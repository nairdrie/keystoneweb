-- Migration 050: Compliance — consent tracking for Ontario/CASL/PIPEDA
-- Adds ToS acceptance timestamp and marketing opt-in to users table

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS tos_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false;
