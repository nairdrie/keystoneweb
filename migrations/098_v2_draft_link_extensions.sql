-- Migration 098: let site owners extend expired draft preview links
--
-- Draft links (/v2r/draft/<token>) are signed JWTs that expire (a week for the
-- links the MCP tools hand out). When the owner opens an expired one they can
-- extend it; the extension is stored here, keyed by a hash of the token, so the
-- link they already shared starts working again without a new URL.

CREATE TABLE IF NOT EXISTS public.v2_draft_link_extensions (
  token_hash   text PRIMARY KEY,                 -- sha256 of the draft token
  site_id      uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  expires_at   timestamptz NOT NULL,
  extended_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS v2_draft_link_extensions_site ON public.v2_draft_link_extensions(site_id);

ALTER TABLE public.v2_draft_link_extensions ENABLE ROW LEVEL SECURITY;
-- No policies: only server routes (service role) read or write this table.
