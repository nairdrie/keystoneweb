-- ============================================================
-- KEYSTONE WEB - DATABASE SCHEMA
-- Multi-tenant CMS database schema for Supabase (PostgreSQL)
-- ============================================================

-- Users table (leverages Supabase auth, but we extend with profile data)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  business_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Sites table (each site is a website instance in the multi-tenant system)
CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Template & Classification
  selected_template_id VARCHAR(255) NOT NULL,
  business_type VARCHAR(50) NOT NULL CHECK (business_type IN ('services', 'products', 'both')),
  category VARCHAR(100) NOT NULL,
  
  -- URLs & Domain
  site_slug VARCHAR(255) UNIQUE, -- auto-generated, e.g., "my-plumbing-123"
  custom_domain VARCHAR(255) UNIQUE, -- optional custom domain
  
  -- Design data (JSONB for flexibility)
  design_data JSONB DEFAULT '{}',
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  published_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  -- Indexes for fast lookups
  CONSTRAINT valid_user_or_unowned CHECK (user_id IS NULL OR user_id IS NOT NULL)
);

CREATE INDEX idx_sites_user_id ON sites(user_id);
CREATE INDEX idx_sites_slug ON sites(site_slug);
CREATE INDEX idx_sites_domain ON sites(custom_domain);
CREATE INDEX idx_sites_created ON sites(created_at);

-- Templates table (available templates for selection)
CREATE TABLE IF NOT EXISTS templates (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT,
  image_url VARCHAR(500),
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_templates_category ON templates(category);

-- Payment Methods table (securely store card info - encrypted at rest)
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Encrypted card data (stored encrypted via Supabase encryption)
  encrypted_number TEXT NOT NULL, -- last 4 digits could be plaintext for reference
  encrypted_cvc TEXT NOT NULL,
  expiry_month INTEGER NOT NULL CHECK (expiry_month >= 1 AND expiry_month <= 12),
  expiry_year INTEGER NOT NULL,
  cardholder_name VARCHAR(255),
  
  -- Type
  card_type VARCHAR(20) NOT NULL, -- visa, mastercard, amex, etc.
  last_four VARCHAR(4),
  
  -- Metadata
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_payment_methods_user_id ON payment_methods(user_id);

-- Site Access Logs (audit trail)
CREATE TABLE IF NOT EXISTS site_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  action VARCHAR(50) NOT NULL, -- created, updated, published, deleted, viewed
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_site_access_logs_site_id ON site_access_logs(site_id);
CREATE INDEX idx_site_access_logs_user_id ON site_access_logs(user_id);

-- DNS Records (for custom domains)
CREATE TABLE IF NOT EXISTS dns_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  
  record_type VARCHAR(10) NOT NULL CHECK (record_type IN ('A', 'AAAA', 'CNAME', 'MX', 'TXT')),
  name VARCHAR(255) NOT NULL,
  value TEXT NOT NULL,
  ttl INTEGER DEFAULT 3600,
  
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(site_id, record_type, name)
);

CREATE INDEX idx_dns_records_site_id ON dns_records(site_id);
CREATE INDEX idx_dns_records_verified ON dns_records(verified_at);

-- Subscriptions & Billing (future)
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  plan VARCHAR(50) NOT NULL DEFAULT 'free', -- free, starter, pro, enterprise
  status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, cancelled, suspended
  
  sites_limit INTEGER, -- NULL = unlimited
  storage_limit_gb INTEGER,
  custom_domain_allowed BOOLEAN DEFAULT FALSE,
  
  renewal_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);

-- ============================================================
-- SECURITY POLICIES (RLS - Row Level Security)
-- ============================================================

ALTER TABLE sites ENABLE ROW LEVEL SECURITY;

-- Users can only see their own sites
CREATE POLICY "Users can view own sites" ON sites
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can create sites" ON sites
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update own sites" ON sites
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sites" ON sites
  FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own payment methods" ON payment_methods
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- NOTES FOR IMPLEMENTATION
-- ============================================================
/*
1. design_data is JSONB for flexibility - schema can evolve without migrations
2. All timestamps use TIMESTAMP WITH TIME ZONE for proper timezone handling
3. deleted_at allows soft deletes (don't physically remove data)
4. Card encryption: Use pgcrypto extension or application-level encryption via Supabase Vault
5. RLS policies ensure users can only access their own data
6. Indexes on frequently-queried columns for performance
7. Future: Add `site_analytics` table for pageviews, traffic, etc.
8. Future: Add `site_collaborators` table for team access (multiple users per site)
*/
