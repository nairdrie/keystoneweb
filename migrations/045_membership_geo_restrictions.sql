-- Migration 045: Geographic restrictions for membership packages
-- Allows restricting packages to specific countries (e.g. Canada-only)

ALTER TABLE public.membership_packages
  ADD COLUMN IF NOT EXISTS geo_restriction jsonb DEFAULT NULL;
-- Example: {"allowed_countries": ["CA"], "error_message": "This membership is only available to Canadian residents"}

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS country text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS province text DEFAULT NULL;
