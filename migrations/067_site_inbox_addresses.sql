-- Migration 067: per-site inbox email addresses (one-to-many)
--
-- Replaces the single sites.inbox_custom_email column with a dedicated
-- site_inbox_addresses table so a site can have multiple addresses on the
-- same custom domain (e.g. hello@ AND support@).
--
-- The existing sites.inbox_custom_email column is preserved for backwards
-- compatibility — it now mirrors the primary custom_domain row. New code
-- should always read from site_inbox_addresses.
--
-- Address kinds:
--   kswd_subdomain  : <published_domain>@kswd.ca, free for any published site
--   custom_domain   : <prefix>@<custom_domain>, requires Pro + custom domain;
--                     1 free, additional via the `extra_inbox_email` addon

CREATE TABLE IF NOT EXISTS public.site_inbox_addresses (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id           uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  address           text NOT NULL,
  kind              text NOT NULL CHECK (kind IN ('kswd_subdomain', 'custom_domain')),
  is_primary        boolean NOT NULL DEFAULT false,
  resend_domain_id  text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- An address may only be claimed by one site
CREATE UNIQUE INDEX IF NOT EXISTS site_inbox_addresses_address_unique
  ON public.site_inbox_addresses (lower(address));

CREATE INDEX IF NOT EXISTS site_inbox_addresses_site_id_idx
  ON public.site_inbox_addresses (site_id);

-- Only one primary address per site
CREATE UNIQUE INDEX IF NOT EXISTS site_inbox_addresses_site_primary_unique
  ON public.site_inbox_addresses (site_id)
  WHERE is_primary = true;

CREATE OR REPLACE FUNCTION update_site_inbox_addresses_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS site_inbox_addresses_updated_at ON public.site_inbox_addresses;
CREATE TRIGGER site_inbox_addresses_updated_at
  BEFORE UPDATE ON public.site_inbox_addresses
  FOR EACH ROW EXECUTE FUNCTION update_site_inbox_addresses_updated_at();

ALTER TABLE public.site_inbox_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Site owners read own inbox addresses" ON public.site_inbox_addresses;
CREATE POLICY "Site owners read own inbox addresses"
  ON public.site_inbox_addresses FOR SELECT
  USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Service role full access on site_inbox_addresses" ON public.site_inbox_addresses;
CREATE POLICY "Service role full access on site_inbox_addresses"
  ON public.site_inbox_addresses FOR ALL
  USING (auth.role() = 'service_role');

-- ── Backfill ──────────────────────────────────────────────────────────────────
-- 1) kswd subdomain addresses for every published site
INSERT INTO public.site_inbox_addresses (site_id, address, kind, is_primary)
SELECT
  s.id,
  lower(s.published_domain) || '@kswd.ca',
  'kswd_subdomain',
  (s.inbox_custom_email IS NULL)  -- primary unless a custom one exists
FROM public.sites s
WHERE s.is_published = true
  AND s.published_domain IS NOT NULL
ON CONFLICT (lower(address)) DO NOTHING;

-- 2) Custom domain addresses (existing inbox_custom_email)
INSERT INTO public.site_inbox_addresses (site_id, address, kind, is_primary, resend_domain_id)
SELECT
  s.id,
  lower(s.inbox_custom_email),
  'custom_domain',
  true,
  s.inbox_resend_domain_id
FROM public.sites s
WHERE s.inbox_custom_email IS NOT NULL
ON CONFLICT (lower(address)) DO NOTHING;
