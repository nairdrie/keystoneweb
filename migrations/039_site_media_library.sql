-- Media library: tracks all uploaded files (images, PDFs, videos) per site.
-- This enables the admin media tab: listing, deleting, storage usage tracking.

CREATE TABLE IF NOT EXISTS public.site_media (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid        NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path  text        NOT NULL,   -- path inside the site-assets bucket
  public_url    text        NOT NULL,
  file_name     text        NOT NULL,   -- original display name
  media_type    text        NOT NULL CHECK (media_type IN ('image', 'pdf', 'video')),
  mime_type     text        NOT NULL,
  size_bytes    bigint      NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(storage_path)
);

CREATE INDEX IF NOT EXISTS site_media_site_id  ON public.site_media(site_id);
CREATE INDEX IF NOT EXISTS site_media_user_id  ON public.site_media(user_id);

ALTER TABLE public.site_media ENABLE ROW LEVEL SECURITY;

-- Users can view media belonging to their own sites
CREATE POLICY "Users can view own site media"
  ON public.site_media FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sites
      WHERE id = site_id AND user_id = auth.uid()
    )
  );

-- Users can insert media for their own sites
CREATE POLICY "Users can insert own site media"
  ON public.site_media FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sites
      WHERE id = site_id AND user_id = auth.uid()
    )
  );

-- Users can delete media from their own sites
CREATE POLICY "Users can delete own site media"
  ON public.site_media FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.sites
      WHERE id = site_id AND user_id = auth.uid()
    )
  );
