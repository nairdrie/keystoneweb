-- Migration: moderation_events
-- Tracks all content moderation detections for legal preservation obligations.
-- Required by the Mandatory Reporting Act (S.C. 2011, c. 4) and upcoming Bill C-16.
-- Data must be retained for minimum 21 days (1 year once Bill C-16 passes).
-- Do NOT add deletion cascade from sites — content must be preserved even if site is deleted.

CREATE TABLE IF NOT EXISTS moderation_events (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       timestamptz NOT NULL DEFAULT now(),

  -- Who / where
  site_id          uuid        REFERENCES sites(id) ON DELETE SET NULL,
  user_id          uuid,
  ip_address       inet,

  -- What was detected
  content_type     text        NOT NULL CHECK (content_type IN ('image', 'pdf', 'text')),
  content_ref      text,       -- storage_path for files, SHA-256 hex for text
  content_hash     text,       -- perceptual hash returned by Arachnid Shield (for CSAEM matches)

  -- Detection details
  detection_method text        NOT NULL CHECK (detection_method IN ('arachnid_hash', 'vision_classifier', 'text_classifier')),
  severity         text        NOT NULL CHECK (severity IN ('csaem', 'adult', 'review')),
  action_taken     text        NOT NULL CHECK (action_taken IN ('blocked', 'quarantined', 'reported')),
  raw_response     jsonb,      -- full API response, preserved for evidentiary purposes

  -- Reporting
  cybertip_report_id text,     -- confirmation reference from Cybertip.ca

  -- Ops review
  reviewed_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at      timestamptz,
  review_action    text        CHECK (review_action IN ('approved', 'removed', 'escalated')),
  notes            text
);

-- Index for ops queue (unreviewed events)
CREATE INDEX IF NOT EXISTS moderation_events_unreviewed
  ON moderation_events (created_at DESC)
  WHERE reviewed_at IS NULL;

-- Index for per-site lookup
CREATE INDEX IF NOT EXISTS moderation_events_site_id
  ON moderation_events (site_id, created_at DESC);

-- RLS: only authenticated ops agents can access this table
ALTER TABLE moderation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ops_agents_only" ON moderation_events
  USING (
    auth.uid() IN (
      SELECT id FROM users WHERE is_agent = true
    )
  );

-- Service role bypasses RLS (needed for server-side writes from API routes)
-- Supabase service role key already bypasses RLS by default; no additional policy needed.

COMMENT ON TABLE moderation_events IS
  'Content moderation audit log. Retained per Mandatory Reporting Act (S.C. 2011, c. 4). '
  'Do not delete rows — legal preservation obligation applies.';
