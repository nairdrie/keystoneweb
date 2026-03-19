-- Add is_banned column to public.users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;
