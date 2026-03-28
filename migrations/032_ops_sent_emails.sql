-- 032_ops_sent_emails.sql
-- Tracks outbound emails sent from the ops email composer.
-- Used to show agents inbound support replies from people they've emailed.

CREATE TABLE IF NOT EXISTS ops_sent_emails (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by_user_id UUID        REFERENCES users(id) ON DELETE SET NULL,
  from_email      VARCHAR     NOT NULL,
  to_email        VARCHAR     NOT NULL,
  subject         TEXT,
  resend_id       VARCHAR,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ops_sent_emails_sent_by    ON ops_sent_emails(sent_by_user_id);
CREATE INDEX IF NOT EXISTS ops_sent_emails_to_email   ON ops_sent_emails(to_email);
CREATE INDEX IF NOT EXISTS ops_sent_emails_from_email ON ops_sent_emails(from_email);
