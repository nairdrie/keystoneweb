-- Migration: 093_mcp_tokens
-- Personal access tokens for the Model Context Protocol (MCP) server at
-- /api/mcp. Each token authenticates an external MCP client (e.g. Claude Code)
-- AS a specific user, so every tool call is scoped to that user's own sites.
--
-- Only the SHA-256 hash of the token is stored — the raw token is shown once at
-- creation time (see scripts/create-mcp-token.mjs) and can never be recovered.
-- token_prefix keeps the first few visible characters so a token can be
-- identified and revoked from a list without exposing the secret.

CREATE TABLE IF NOT EXISTS public.mcp_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  token_prefix text NOT NULL,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

-- Active-token lookups are scoped per user.
CREATE INDEX IF NOT EXISTS mcp_tokens_user_idx
  ON public.mcp_tokens (user_id)
  WHERE revoked_at IS NULL;

-- The MCP route only ever reads/writes this table with the service-role client.
-- Enable RLS with no policies so it is unreachable via the anon/authenticated
-- keys (matches migration 057's hardening of public tables).
ALTER TABLE public.mcp_tokens ENABLE ROW LEVEL SECURITY;
