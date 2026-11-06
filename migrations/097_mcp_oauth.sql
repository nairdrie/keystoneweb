-- Migration 097: OAuth sign-in for the Keystone MCP server
--
-- Lets AI apps (e.g. Claude's "Add custom connector") connect with just the
-- server URL: the app sends the user to a Keystone sign-in + approval page and
-- receives short-lived access tokens (stored in api_tokens) plus rotating
-- refresh tokens. Authorization code + PKCE (S256), public clients only.

-- OAuth clients: registered automatically (RFC 7591) or described by a client
-- ID metadata document at an https URL (client_id = that URL).
CREATE TABLE IF NOT EXISTS public.oauth_clients (
  client_id      text PRIMARY KEY,
  client_name    text,
  redirect_uris  text[] NOT NULL DEFAULT '{}',
  metadata_url   text,                         -- set for URL-based client ids
  created_at     timestamptz NOT NULL DEFAULT now(),
  refreshed_at   timestamptz NOT NULL DEFAULT now()
);

-- One-time authorization codes (10 minutes).
CREATE TABLE IF NOT EXISTS public.oauth_codes (
  code_hash       text PRIMARY KEY,
  client_id       text NOT NULL,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redirect_uri    text NOT NULL,
  code_challenge  text NOT NULL,
  scopes          text[] NOT NULL,
  resource        text,
  expires_at      timestamptz NOT NULL,
  used_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Refresh tokens (rotated on every use).
CREATE TABLE IF NOT EXISTS public.oauth_refresh_tokens (
  token_hash   text PRIMARY KEY,
  client_id    text NOT NULL,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scopes       text[] NOT NULL,
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS oauth_refresh_tokens_user ON public.oauth_refresh_tokens(user_id);

-- Access tokens issued through OAuth live in api_tokens, tagged with the client.
ALTER TABLE public.api_tokens ADD COLUMN IF NOT EXISTS client_id text;

ALTER TABLE public.oauth_clients        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_codes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_refresh_tokens ENABLE ROW LEVEL SECURITY;
-- No policies: only server routes (service role) read or write these tables.
