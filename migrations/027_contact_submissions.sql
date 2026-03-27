-- Migration: 027_contact_submissions
-- Stores all incoming contact form submissions per site, with AI triage metadata.

create table if not exists contact_submissions (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references sites(id) on delete cascade,

  -- Sender info (from the contact form)
  sender_name     text not null,
  sender_email    text not null,
  sender_phone    text,
  message         text not null,

  -- Status lifecycle: new → ai_handled | needs_review → replied | spam
  status          text not null default 'new'
                  check (status in ('new', 'ai_handled', 'needs_review', 'replied', 'spam')),

  -- AI triage results (populated async after submission)
  ai_classification   text,     -- 'booking_inquiry' | 'general_question' | 'complaint' | 'spam' | 'other'
  ai_confidence       numeric,  -- 0.0 – 1.0
  ai_summary          text,     -- short summary of the message
  ai_draft_reply      text,     -- AI-generated reply draft
  ai_auto_sent        boolean not null default false,  -- true if AI reply was auto-sent

  -- Admin/owner reply
  admin_reply         text,
  admin_reply_at      timestamptz,

  -- Resend message id of the auto/manual reply (for threading future replies)
  reply_resend_id     text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Index for per-site inbox queries
create index if not exists contact_submissions_site_id_idx
  on contact_submissions(site_id, created_at desc);

-- Index for status filtering
create index if not exists contact_submissions_status_idx
  on contact_submissions(site_id, status);

-- Auto-update updated_at
create or replace function update_contact_submissions_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger contact_submissions_updated_at
  before update on contact_submissions
  for each row execute function update_contact_submissions_updated_at();

-- RLS: site owners can only see their own site's submissions
alter table contact_submissions enable row level security;

create policy "Site owners can read their contact submissions"
  on contact_submissions for select
  using (
    site_id in (
      select id from sites where user_id = auth.uid()
    )
  );

create policy "Service role has full access to contact_submissions"
  on contact_submissions for all
  using (auth.role() = 'service_role');
