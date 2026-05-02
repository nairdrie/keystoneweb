-- Migration 068: turn contact_submissions into a threaded email-message store
--
-- Adds the columns needed to model real email conversations:
--   thread_id          : groups inbound + outbound messages of a conversation
--   direction          : 'inbound' or 'outbound'
--   subject            : email subject line
--   body_html          : sanitized HTML body (rich content)
--   inbox_address_id   : which of the site's addresses received this (or sent it)
--   to/cc/bcc_emails   : recipient lists for outbound messages
--   from_email/name    : sender (for outbound, our address; for inbound, the customer)
--   message_id_header  : RFC822 Message-ID we emit/receive (for threading)
--   in_reply_to        : RFC822 In-Reply-To header
--   references_header  : RFC822 References header (space-separated)
--   is_read            : per-message read state
--
-- Adds 'reply' and 'compose' to source_type so outbound messages can be stored.

ALTER TABLE public.contact_submissions
  ADD COLUMN IF NOT EXISTS thread_id          uuid,
  ADD COLUMN IF NOT EXISTS direction          text NOT NULL DEFAULT 'inbound'
                              CHECK (direction IN ('inbound', 'outbound')),
  ADD COLUMN IF NOT EXISTS subject            text,
  ADD COLUMN IF NOT EXISTS body_html          text,
  ADD COLUMN IF NOT EXISTS inbox_address_id   uuid REFERENCES public.site_inbox_addresses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS to_emails          text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cc_emails          text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS bcc_emails         text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS from_email         text,
  ADD COLUMN IF NOT EXISTS from_name          text,
  ADD COLUMN IF NOT EXISTS message_id_header  text,
  ADD COLUMN IF NOT EXISTS in_reply_to        text,
  ADD COLUMN IF NOT EXISTS references_header  text,
  ADD COLUMN IF NOT EXISTS is_read            boolean NOT NULL DEFAULT false;

-- Bootstrap thread_id for existing rows: each inbound message starts its own thread
UPDATE public.contact_submissions
SET thread_id = id
WHERE thread_id IS NULL;

ALTER TABLE public.contact_submissions
  ALTER COLUMN thread_id SET NOT NULL;

-- Auto-assign thread_id := id on new rows that don't supply one. Lets older
-- callers (the public contact form, inbound webhook) keep working without
-- having to pre-allocate a UUID before the insert.
CREATE OR REPLACE FUNCTION set_contact_submission_thread_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.thread_id IS NULL THEN
    NEW.thread_id := NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contact_submissions_set_thread_id ON public.contact_submissions;
CREATE TRIGGER contact_submissions_set_thread_id
  BEFORE INSERT ON public.contact_submissions
  FOR EACH ROW EXECUTE FUNCTION set_contact_submission_thread_id();

-- Existing replied/handled/spam messages are considered "read"
UPDATE public.contact_submissions
SET is_read = true
WHERE status IN ('replied', 'ai_handled', 'spam');

-- Backfill primary inbox_address_id for existing inbound messages
UPDATE public.contact_submissions cs
SET inbox_address_id = sia.id
FROM public.site_inbox_addresses sia
WHERE sia.site_id = cs.site_id
  AND sia.is_primary = true
  AND cs.inbox_address_id IS NULL;

-- Update source_type CHECK to allow 'reply' and 'compose' BEFORE we synthesize
-- the outbound rows, otherwise the insert below trips the old constraint.
ALTER TABLE public.contact_submissions
  DROP CONSTRAINT IF EXISTS contact_submissions_source_type_check;
ALTER TABLE public.contact_submissions
  ADD CONSTRAINT contact_submissions_source_type_check
  CHECK (source_type IN ('contact_form', 'estimate_form', 'booking', 'inbound_email', 'reply', 'compose'));

-- Synthesize an outbound message for every prior owner reply so the new
-- "Sent" folder has data and threads render correctly. Skip rows that ended
-- up as spam — those replies (if any) were never actually delivered to the
-- customer and should not appear as Sent items.
INSERT INTO public.contact_submissions (
  site_id, thread_id, direction, status,
  sender_name, sender_email, message,
  subject, body_html,
  to_emails, from_email, from_name,
  inbox_address_id,
  source_type,
  is_read,
  created_at,
  updated_at
)
SELECT
  cs.site_id,
  cs.thread_id,
  'outbound',
  'replied',
  COALESCE(s.site_slug, 'Site'),
  'contact@keystoneweb.ca',
  cs.admin_reply,
  COALESCE('Re: ' || NULLIF(cs.subject, ''), 'Re: Your message'),
  NULL,
  ARRAY[cs.sender_email],
  'contact@keystoneweb.ca',
  COALESCE(s.site_slug, 'Site'),
  cs.inbox_address_id,
  'reply',
  true,
  COALESCE(cs.admin_reply_at, cs.updated_at),
  COALESCE(cs.admin_reply_at, cs.updated_at)
FROM public.contact_submissions cs
LEFT JOIN public.sites s ON s.id = cs.site_id
WHERE cs.admin_reply IS NOT NULL
  AND cs.direction = 'inbound'
  AND cs.status <> 'spam'
  AND NOT EXISTS (
    SELECT 1 FROM public.contact_submissions cs2
    WHERE cs2.thread_id = cs.thread_id AND cs2.direction = 'outbound'
  );

CREATE INDEX IF NOT EXISTS contact_submissions_thread_id_idx
  ON public.contact_submissions (thread_id, created_at);

CREATE INDEX IF NOT EXISTS contact_submissions_inbox_address_id_idx
  ON public.contact_submissions (inbox_address_id);

CREATE INDEX IF NOT EXISTS contact_submissions_message_id_header_idx
  ON public.contact_submissions (message_id_header)
  WHERE message_id_header IS NOT NULL;
