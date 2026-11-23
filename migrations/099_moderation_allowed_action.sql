-- Migration: let moderation_events record images that were flagged but allowed.
-- Image moderation now only blocks explicit nudity (SafeSearch adult VERY_LIKELY).
-- Borderline images (adult LIKELY) are stored and logged with action_taken = 'allowed'
-- so ops can review them. "racy" (swimwear, suggestive) no longer blocks or logs.

ALTER TABLE moderation_events DROP CONSTRAINT IF EXISTS moderation_events_action_taken_check;
ALTER TABLE moderation_events
  ADD CONSTRAINT moderation_events_action_taken_check
  CHECK (action_taken IN ('blocked', 'quarantined', 'reported', 'allowed'));
