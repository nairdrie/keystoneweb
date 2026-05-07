-- Migration 079: One-time email codes for passwordless checkout sign-in.
-- Codes are 6 digits, expire after 10 minutes, and limited to 5 verify attempts.
-- One outstanding code per (site_id, email) — re-requesting replaces it.

CREATE TABLE IF NOT EXISTS public.member_otps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    email text NOT NULL,
    code_hash text NOT NULL,
    expires_at timestamptz NOT NULL,
    attempts integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(site_id, email)
);

CREATE INDEX IF NOT EXISTS idx_member_otps_expires
    ON public.member_otps(expires_at);

ALTER TABLE public.member_otps ENABLE ROW LEVEL SECURITY;

-- Service role only — public clients reach this through API routes.
CREATE POLICY "Service role manages member_otps" ON public.member_otps FOR ALL
    USING (false) WITH CHECK (false);
