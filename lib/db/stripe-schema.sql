-- Stripe Integration Schema Updates
-- Add these columns to the 'sites' table for subscription and publishing support

-- Add to existing 'sites' table:
ALTER TABLE sites ADD COLUMN IF NOT EXISTS (
  -- Subscription info
  subscription_status TEXT DEFAULT 'inactive', -- 'inactive', 'active', 'canceled'
  subscription_plan TEXT, -- e.g., 'Starter', 'Pro', 'Business'
  stripe_subscription_id TEXT UNIQUE, -- Stripe subscription ID for this site
  subscription_started_at TIMESTAMPTZ, -- When subscription was activated
  
  -- Publishing info
  is_published BOOLEAN DEFAULT FALSE, -- Is the site published to the web?
  published_domain TEXT UNIQUE, -- e.g., "mysite.keystoneweb.ca"
  published_at TIMESTAMPTZ -- When the site was published
);

-- Example pricing plans to store (optional, can be hardcoded in app):
-- CREATE TABLE IF NOT EXISTS pricing_plans (
--   id TEXT PRIMARY KEY,
--   name TEXT NOT NULL, -- e.g., 'Starter'
--   description TEXT,
--   price_monthly INTEGER, -- in cents (e.g., 999 = $9.99)
--   features JSONB, -- array of feature strings
--   stripe_price_id TEXT, -- Stripe Price ID for subscriptions
--   created_at TIMESTAMPTZ DEFAULT NOW()
-- );

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sites_user_id ON sites(user_id);
CREATE INDEX IF NOT EXISTS idx_sites_published_domain ON sites(published_domain);
CREATE INDEX IF NOT EXISTS idx_sites_stripe_subscription_id ON sites(stripe_subscription_id);
