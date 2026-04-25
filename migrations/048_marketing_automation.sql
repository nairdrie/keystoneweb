-- Migration 048: Marketing Automation
-- Adds tables for AI-powered marketing campaigns: settings, campaigns, spend ledger, activity log.
-- Phase A: ops panel (site_id IS NULL = platform campaigns).
-- Phase B: customer-facing (site_id set = per-site campaigns).

-- 1. Marketing settings (platform-level for Phase A, per-site for Phase B)
CREATE TABLE IF NOT EXISTS public.marketing_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- NULL site_id = platform-level (ops). Non-null = per-site (Phase B).
    -- Platform credentials live in env vars (agency model).
    site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,

    -- Budget
    monthly_budget_limit_cents integer,

    -- Preferences
    auto_suggest boolean NOT NULL DEFAULT true,

    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),

    UNIQUE(site_id)
);

-- 2. Marketing campaigns
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- NULL site_id = ops/platform campaign. Non-null = customer campaign (Phase B).
    site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

    name text NOT NULL,
    channel text NOT NULL CHECK (channel IN ('google_ads', 'meta_ads', 'email')),
    campaign_type text NOT NULL CHECK (campaign_type IN (
        'search', 'display',
        'feed', 'stories', 'reels', 'catalog',
        'email_blast'
    )),
    status text NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft', 'suggested', 'approved', 'submitting',
        'active', 'paused', 'completed', 'failed', 'cancelled'
    )),

    -- Content (channel-specific JSON, see lib/marketing/types.ts)
    content jsonb NOT NULL DEFAULT '{}',
    targeting jsonb DEFAULT '{}',

    -- Budget
    daily_budget_cents integer,
    total_budget_cents integer,
    spent_cents integer NOT NULL DEFAULT 0,

    -- Schedule
    start_date date,
    end_date date,
    approved_at timestamptz,
    launched_at timestamptz,
    completed_at timestamptz,

    -- External platform IDs (set after submission to Google/Meta)
    external_campaign_id text,
    external_ad_group_id text,
    external_ad_id text,

    -- Performance metrics (synced from platforms)
    impressions integer NOT NULL DEFAULT 0,
    clicks integer NOT NULL DEFAULT 0,
    conversions integer NOT NULL DEFAULT 0,
    ctr numeric(5,4) NOT NULL DEFAULT 0,
    cpc_cents integer NOT NULL DEFAULT 0,

    -- AI metadata
    ai_generated boolean NOT NULL DEFAULT false,
    ai_rationale text,

    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3. Campaign activity log (audit trail)
CREATE TABLE IF NOT EXISTS public.marketing_campaign_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id uuid NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
    action text NOT NULL,
    actor text NOT NULL,
    details jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

-- 4. Marketing spend ledger
CREATE TABLE IF NOT EXISTS public.marketing_spend (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id uuid NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
    site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
    channel text NOT NULL,
    spend_date date NOT NULL,
    ad_spend_cents integer NOT NULL,
    management_fee_cents integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),

    UNIQUE(campaign_id, spend_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mktg_campaigns_site ON public.marketing_campaigns(site_id);
CREATE INDEX IF NOT EXISTS idx_mktg_campaigns_status ON public.marketing_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_mktg_campaigns_channel ON public.marketing_campaigns(channel);
CREATE INDEX IF NOT EXISTS idx_mktg_campaigns_active ON public.marketing_campaigns(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_mktg_spend_campaign ON public.marketing_spend(campaign_id);
CREATE INDEX IF NOT EXISTS idx_mktg_spend_date ON public.marketing_spend(spend_date);
CREATE INDEX IF NOT EXISTS idx_mktg_log_campaign ON public.marketing_campaign_log(campaign_id);
CREATE INDEX IF NOT EXISTS idx_mktg_settings_site ON public.marketing_settings(site_id);

-- RLS (enabled for Phase B, ops routes bypass via service role)
ALTER TABLE public.marketing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_spend ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaign_log ENABLE ROW LEVEL SECURITY;

-- Phase B policies (site owners see only their own data)
CREATE POLICY "Site owners manage own marketing_settings" ON public.marketing_settings FOR ALL
    USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()))
    WITH CHECK (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));

CREATE POLICY "Site owners manage own campaigns" ON public.marketing_campaigns FOR ALL
    USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()))
    WITH CHECK (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));

CREATE POLICY "Site owners view own spend" ON public.marketing_spend FOR SELECT
    USING (site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid()));

CREATE POLICY "Site owners view own campaign_log" ON public.marketing_campaign_log FOR SELECT
    USING (campaign_id IN (
        SELECT id FROM public.marketing_campaigns
        WHERE site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid())
    ));
