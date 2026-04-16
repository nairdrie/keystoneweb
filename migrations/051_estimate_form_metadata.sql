-- Add structured metadata and source type to contact submissions
-- Supports estimate form, booking, and inbound email submissions

ALTER TABLE contact_submissions
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}';

ALTER TABLE contact_submissions
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'contact_form';

-- Add check constraint for allowed source types
ALTER TABLE contact_submissions
  ADD CONSTRAINT contact_submissions_source_type_check
  CHECK (source_type IN ('contact_form', 'estimate_form', 'booking', 'inbound_email'));
