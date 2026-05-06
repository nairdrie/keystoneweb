-- Migration 076: email_drafts table
--
-- Stores both types of user-written drafts:
--   compose drafts   thread_id IS NULL  – new emails not yet sent
--   reply drafts     thread_id IS SET   – in-progress replies to a thread
--
-- At most one reply draft per thread per site (UNIQUE constraint).
-- NULL values in thread_id are not considered equal by Postgres UNIQUE,
-- so multiple compose drafts per site are allowed.

CREATE TABLE public.email_drafts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     uuid        NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  thread_id   uuid        NULL,
  address_id  uuid        NULL REFERENCES public.site_inbox_addresses(id) ON DELETE SET NULL,
  to_emails   text[]      NOT NULL DEFAULT '{}',
  cc_emails   text[]      NOT NULL DEFAULT '{}',
  bcc_emails  text[]      NOT NULL DEFAULT '{}',
  subject     text,
  body_html   text,
  body_text   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (site_id, thread_id)
);

ALTER TABLE public.email_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_drafts_owner_only" ON public.email_drafts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = email_drafts.site_id
        AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = email_drafts.site_id
        AND s.user_id = auth.uid()
    )
  );

CREATE INDEX email_drafts_site_id_idx
  ON public.email_drafts (site_id, updated_at DESC);

CREATE INDEX email_drafts_thread_id_idx
  ON public.email_drafts (thread_id)
  WHERE thread_id IS NOT NULL;
