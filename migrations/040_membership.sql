-- Migration 040: Membership Portal
-- Adds tables for site membership: settings, packages, members, sessions, email campaigns

-- 1. Membership Settings (per-site configuration)
CREATE TABLE IF NOT EXISTS public.membership_settings (
    site_id uuid PRIMARY KEY REFERENCES public.sites(id) ON DELETE CASCADE,
    is_enabled boolean NOT NULL DEFAULT true,
    require_email_verification boolean NOT NULL DEFAULT true,
    welcome_email_subject text DEFAULT 'Welcome!',
    welcome_email_body text DEFAULT '',
    signup_form_fields jsonb NOT NULL DEFAULT '[
        {"key": "name", "label": "Full Name", "type": "text", "required": true},
        {"key": "email", "label": "Email", "type": "email", "required": true},
        {"key": "password", "label": "Password", "type": "password", "required": true}
    ]'::jsonb,
    branding jsonb DEFAULT '{}'::jsonb,
    notification_email text,
    privacy_policy_url text,
    marketing_opt_in_label text DEFAULT 'Send me updates and news',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Membership Packages / Tiers
CREATE TABLE IF NOT EXISTS public.membership_packages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    price_cents integer NOT NULL DEFAULT 0,
    currency text NOT NULL DEFAULT 'CAD',
    billing_interval text NOT NULL DEFAULT 'free' CHECK (billing_interval IN ('month', 'year', 'one_time', 'free')),
    trial_days integer NOT NULL DEFAULT 0,
    stripe_price_id text,
    stripe_product_id text,
    features jsonb DEFAULT '[]'::jsonb,
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3. Members (per-site, scoped by site_id + email uniqueness)
CREATE TABLE IF NOT EXISTS public.members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    email text NOT NULL,
    password_hash text NOT NULL,
    name text,
    avatar_url text,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'cancelled')),
    email_verified boolean NOT NULL DEFAULT false,
    email_verification_token text,
    email_verification_expires_at timestamptz,
    password_reset_token text,
    password_reset_expires_at timestamptz,
    package_id uuid REFERENCES public.membership_packages(id) ON DELETE SET NULL,
    stripe_customer_id text,
    stripe_subscription_id text,
    subscription_status text NOT NULL DEFAULT 'none' CHECK (subscription_status IN ('none', 'active', 'past_due', 'cancelled', 'trialing')),
    current_period_end timestamptz,
    marketing_opt_in boolean NOT NULL DEFAULT false,
    signed_up_at timestamptz DEFAULT now(),
    last_login_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(site_id, email)
);

-- 4. Member Sessions (JWT revocation + multi-device)
CREATE TABLE IF NOT EXISTS public.member_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    token_hash text NOT NULL,
    user_agent text,
    ip_address inet,
    expires_at timestamptz NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- 5. Member Email Campaigns
CREATE TABLE IF NOT EXISTS public.member_email_campaigns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    subject text NOT NULL,
    body text NOT NULL,
    target_package_ids uuid[] DEFAULT '{}',
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
    scheduled_at timestamptz,
    sent_at timestamptz,
    recipient_count integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_members_site ON public.members(site_id);
CREATE INDEX IF NOT EXISTS idx_members_site_email ON public.members(site_id, email);
CREATE INDEX IF NOT EXISTS idx_members_site_status ON public.members(site_id, status);
CREATE INDEX IF NOT EXISTS idx_members_package ON public.members(package_id);
CREATE INDEX IF NOT EXISTS idx_members_stripe_customer ON public.members(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_member_sessions_member ON public.member_sessions(member_id);
CREATE INDEX IF NOT EXISTS idx_member_sessions_token ON public.member_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_member_sessions_expires ON public.member_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_membership_packages_site ON public.membership_packages(site_id);
CREATE INDEX IF NOT EXISTS idx_membership_packages_active ON public.membership_packages(site_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_member_email_campaigns_site ON public.member_email_campaigns(site_id);

-- RLS
ALTER TABLE public.membership_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_email_campaigns ENABLE ROW LEVEL SECURITY;

-- Site owners: full CRUD
CREATE POLICY "Site owners manage membership_settings" ON public.membership_settings FOR ALL
    USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()))
    WITH CHECK (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));

CREATE POLICY "Site owners manage membership_packages" ON public.membership_packages FOR ALL
    USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()))
    WITH CHECK (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));

CREATE POLICY "Site owners manage members" ON public.members FOR ALL
    USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()))
    WITH CHECK (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));

CREATE POLICY "Site owners manage member_sessions" ON public.member_sessions FOR ALL
    USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()))
    WITH CHECK (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));

CREATE POLICY "Site owners manage member_email_campaigns" ON public.member_email_campaigns FOR ALL
    USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()))
    WITH CHECK (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));

-- Public read for active packages (visitors see pricing)
CREATE POLICY "Anyone can read active packages" ON public.membership_packages FOR SELECT
    USING (is_active = true);

-- Public read for membership settings (signup form config)
CREATE POLICY "Anyone can read membership_settings" ON public.membership_settings FOR SELECT
    USING (true);

-- Public insert for members (signup) — API routes use service role for updates
CREATE POLICY "Anyone can sign up as member" ON public.members FOR INSERT
    WITH CHECK (true);

-- Public insert for sessions (login)
CREATE POLICY "Anyone can create member_sessions" ON public.member_sessions FOR INSERT
    WITH CHECK (true);

-- Cleanup: auto-delete expired sessions (can be called via cron or scheduled function)
-- CREATE OR REPLACE FUNCTION cleanup_expired_member_sessions() RETURNS void AS $$
--   DELETE FROM public.member_sessions WHERE expires_at < now();
-- $$ LANGUAGE sql SECURITY DEFINER;
