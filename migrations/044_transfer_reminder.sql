-- Migration 044: Track when a publish reminder was sent for accepted transfers
ALTER TABLE public.site_transfers
  ADD COLUMN IF NOT EXISTS transfer_reminder_sent_at TIMESTAMP WITH TIME ZONE;
