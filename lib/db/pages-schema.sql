-- Pages table for multi-page site support
CREATE TABLE IF NOT EXISTS pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,           -- URL-friendly identifier (e.g., "home", "about", "contact")
  title TEXT NOT NULL,          -- Display title in editor
  display_name TEXT NOT NULL DEFAULT 'Untitled', -- Menu label (e.g., "About Us" in nav)
  is_visible_in_nav BOOLEAN DEFAULT TRUE,
  nav_order INTEGER DEFAULT 0,  -- Sort order in navigation menu
  design_data JSONB DEFAULT '{}', -- Page-specific design data (content, layout)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, slug)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_pages_site_id ON pages(site_id);
CREATE INDEX IF NOT EXISTS idx_pages_site_slug ON pages(site_id, slug);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_pages_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_pages_timestamp_trigger ON pages;
CREATE TRIGGER update_pages_timestamp_trigger
BEFORE UPDATE ON pages
FOR EACH ROW
EXECUTE FUNCTION update_pages_timestamp();
