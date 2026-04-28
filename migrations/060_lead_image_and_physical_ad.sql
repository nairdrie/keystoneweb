-- Migration: 060_lead_image_and_physical_ad
-- Adds:
--   1. 'physical_ad' to the leads.source enum (for leads created from a photo
--      of a billboard, business card, flyer, sign, etc.)
--   2. leads.image_storage_path — references a Supabase Storage object in the
--      private 'lead-images' bucket. Surfaced via signed URLs in the ops UI.
--   3. The 'lead-images' Storage bucket itself, configured private.

-- 1. Update the source CHECK constraint to allow 'physical_ad'.
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_source_check;

ALTER TABLE public.leads ADD CONSTRAINT leads_source_check CHECK (source IN (
  'cold_call', 'cold_email', 'walk_in', 'referral', 'web_form',
  'networking_event', 'social_media', 'paid_ad', 'organic_search',
  'launch_request', 'partner', 'physical_ad', 'other'
));

-- 2. New column for the image path.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS image_storage_path text;

-- 3. Create the private storage bucket. ON CONFLICT keeps the migration
-- idempotent and harmless if the bucket has already been created via the
-- Supabase dashboard.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lead-images',
  'lead-images',
  false,
  10485760, -- 10 MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- Service-role full access policy. Ops endpoints use the admin client, which
-- bypasses RLS by default — but having an explicit policy keeps the bucket
-- consistent with the rest of the app's storage rules.
DROP POLICY IF EXISTS "Service role full access on lead-images" ON storage.objects;

CREATE POLICY "Service role full access on lead-images"
  ON storage.objects FOR ALL
  USING (bucket_id = 'lead-images' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'lead-images' AND auth.role() = 'service_role');
