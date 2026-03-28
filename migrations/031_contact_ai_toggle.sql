-- Add AI auto-reply toggle per site.
-- When false, triage still runs (classification, summary, draft) but never auto-sends.
-- Messages land in needs_review for the owner to handle manually.

alter table sites
  add column if not exists contact_ai_replies_enabled boolean not null default true;
