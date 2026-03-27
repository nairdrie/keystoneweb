-- 030_agent_roles.sql
-- Adds agent role support: agents can access ops, manage their own support threads

-- Add agent fields to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_agent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS agent_contact_email VARCHAR;

-- Index for agent lookup
CREATE INDEX IF NOT EXISTS users_is_agent ON users(is_agent) WHERE is_agent = true;

-- Agent invites table
-- Admins create invites for a personal email; the invite link lets the recipient
-- set a password and choose (confirm) their @keystoneweb.ca contact address.
CREATE TABLE IF NOT EXISTS agent_invites (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  personal_email  VARCHAR     NOT NULL,
  contact_email   VARCHAR     NOT NULL,   -- pre-assigned @keystoneweb.ca email
  token           VARCHAR(64) UNIQUE NOT NULL,
  created_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
  accepted_at     TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_invites_token         ON agent_invites(token);
CREATE INDEX IF NOT EXISTS agent_invites_personal_email ON agent_invites(personal_email);
