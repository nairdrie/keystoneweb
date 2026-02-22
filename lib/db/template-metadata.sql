-- Create template_metadata table
CREATE TABLE IF NOT EXISTS template_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id VARCHAR UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  description TEXT,
  category VARCHAR,
  business_type VARCHAR,
  
  -- Palettes: Array of color schemes
  -- { "default": { "primary": "#dc2626", "secondary": "#1e40af", ... }, ... }
  palettes JSONB DEFAULT '{
    "default": {
      "primary": "#dc2626",
      "secondary": "#1e40af",
      "accent": "#06b6d4",
      "text": "#1f2937",
      "bg": "#ffffff"
    }
  }'::jsonb,
  
  -- Customizables: Fields that can be edited in this template
  -- { "hero": ["title", "subtitle", "cta"], "features": ["title", "description"] }
  customizables JSONB DEFAULT '{
    "hero": ["title", "subtitle", "cta"],
    "features": ["title", "description"],
    "cta": ["title", "button_text"]
  }'::jsonb,
  
  -- Thumbnail URL
  thumbnail_url VARCHAR,
  
  -- Feature flags
  multi_page BOOLEAN DEFAULT FALSE,
  has_blog BOOLEAN DEFAULT FALSE,
  has_gallery BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_template_metadata_category ON template_metadata(category);
CREATE INDEX IF NOT EXISTS idx_template_metadata_business_type ON template_metadata(business_type);

-- Seed initial templates (adjust based on your 60 templates)
INSERT INTO template_metadata (template_id, name, description, category, business_type, thumbnail_url)
VALUES
  ('classic-pro-plumber', 'Classic Pro', 'Professional plumber website with services and portfolio', 'plumber', 'services', '/templates/thumbnails/classic-pro.png'),
  ('modern-blue-plumber', 'Modern Blue', 'Modern blue design for plumbing services', 'plumber', 'services', '/templates/thumbnails/modern-blue.png'),
  ('minimal-clean-fitness', 'Minimal Clean', 'Clean minimal fitness trainer website', 'fitness', 'services', '/templates/thumbnails/minimal-clean.png')
  -- Add remaining 57 templates here
ON CONFLICT (template_id) DO NOTHING;
