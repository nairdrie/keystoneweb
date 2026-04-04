-- Migration 038: Custom domain inbox email per site (Pro plan feature)
-- Stores the owner-configured email address for their custom domain inbox.
-- e.g. hello@theirdomain.ca — receives email via Resend inbound and routes to
-- the site's contact_submissions just like the @kswd.ca address does.
--
-- inbox_custom_email     : full address, e.g. "hello@example.com"
-- inbox_resend_domain_id : Resend domain ID for the linked domain (for cleanup/management)

ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS inbox_custom_email    text,
  ADD COLUMN IF NOT EXISTS inbox_resend_domain_id text;

-- Unique constraint so two sites can't claim the same inbox address
CREATE UNIQUE INDEX IF NOT EXISTS sites_inbox_custom_email_unique
  ON public.sites (inbox_custom_email)
  WHERE inbox_custom_email IS NOT NULL;
