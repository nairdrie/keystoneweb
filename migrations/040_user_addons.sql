-- Add-ons for Pro plan users (extra sites, domains, storage, etc.)
-- Admin approves add-ons → user accepts & pays → Stripe subscription updated

CREATE TABLE IF NOT EXISTS public.user_addons (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addon_type      text NOT NULL CHECK (addon_type IN (
    'extra_sites', 'extra_domains', 'extra_storage',
    'extra_ai', 'white_label'
  )),
  quantity        integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  status          text NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'active', 'cancelled')),
  monthly_price   numeric(10,2) NOT NULL,
  yearly_price    numeric(10,2) NOT NULL,
  stripe_price_id text,           -- custom Stripe Price if admin overrode default pricing
  approved_by     text,
  approved_at     timestamptz DEFAULT now(),
  activated_at    timestamptz,
  cancelled_at    timestamptz,
  stripe_item_id  text,           -- Stripe subscription item ID once active
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, addon_type)
);

CREATE INDEX IF NOT EXISTS idx_user_addons_user ON user_addons(user_id);
ALTER TABLE user_addons ENABLE ROW LEVEL SECURITY;

-- Extend user_subscriptions with per-user overridable limits
ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS custom_domain_limit integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS publish_limit integer,
  ADD COLUMN IF NOT EXISTS ai_multiplier integer DEFAULT 1;
