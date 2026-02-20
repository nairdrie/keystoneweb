# Template Setup Guide

This guide explains how to set up templates in Supabase for production use.

## Overview

Templates are currently stored as **static files in the Next.js project** (`/public/templates/`). For production and scalability, we should also store template metadata in Supabase so they can be:

1. **Updated without redeploying** the application
2. **Tagged and filtered** in the database
3. **Tracked and versioned**
4. **Cached** for better performance

## Current Architecture

- **Metadata**: `public/templates/metadata.json` (managed locally)
- **HTML files**: `public/templates/{businessType}/{category}/{id}.html` (served via Next.js static assets)
- **API endpoint**: `/api/templates/metadata` (reads metadata.json)
- **API endpoint**: `/api/templates/[id]` (fetches HTML from filesystem)

## Supabase Setup Steps

### 1. Create Templates Table

Run this SQL in the Supabase SQL Editor:

```sql
-- Create templates table
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id TEXT NOT NULL UNIQUE, -- e.g., "plumber-classic-pro"
  name TEXT NOT NULL,
  business_type TEXT NOT NULL, -- 'services', 'products', 'both'
  category TEXT NOT NULL, -- e.g., 'plumber', 'ecommerce'
  description TEXT,
  
  -- Template content (stored as JSONB for flexibility)
  html_content TEXT, -- Can store full HTML or URL to CDN
  
  -- Metadata
  tags TEXT[] DEFAULT '{}', -- Array of tags
  sections TEXT[] DEFAULT '{}', -- Sections included
  
  -- Color scheme
  colors JSONB DEFAULT '{
    "primary": "#0066cc",
    "secondary": "#003399",
    "accent": "#ff6600"
  }',
  
  -- Preview & media
  image_url TEXT, -- Preview screenshot URL
  
  -- Versioning
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes for fast queries
  CONSTRAINT templates_business_type_check 
    CHECK (business_type IN ('services', 'products', 'both'))
);

-- Create indexes for common queries
CREATE INDEX idx_templates_business_type_category 
  ON templates(business_type, category);
CREATE INDEX idx_templates_is_active 
  ON templates(is_active);
CREATE INDEX idx_templates_template_id 
  ON templates(template_id);

-- Enable Row-Level Security
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Everyone can read active templates
CREATE POLICY "Templates are publicly readable"
  ON templates
  FOR SELECT
  USING (is_active = true);

-- RLS Policy: Only admins can create/update/delete
-- (You'll need to set up an admin role - for now, disable this)
-- CREATE POLICY "Only admins can manage templates"
--   ON templates
--   FOR ALL
--   USING (auth.uid() IN (SELECT user_id FROM admin_users));
```

### 2. Insert Template Metadata

After the sub-agent creates all 60 templates, you'll have a `metadata.json` file with all template definitions.

**Insert templates into Supabase using this SQL template:**

```sql
INSERT INTO templates (
  template_id,
  name,
  business_type,
  category,
  description,
  tags,
  sections,
  colors,
  image_url
) VALUES
  -- SERVICES: PLUMBER
  (
    'plumber-classic-pro',
    'Classic Professional',
    'services',
    'plumber',
    'Clean professional design with emphasis on service listings',
    ARRAY['professional', 'modern', 'blue', 'services'],
    ARRAY['header', 'hero', 'services', 'about', 'testimonials', 'cta', 'footer'],
    '{"primary": "#0066cc", "secondary": "#003399", "accent": "#ff6600"}',
    '/templates/services/plumber/classic-pro-preview.png'
  ),
  (
    'plumber-modern-bold',
    'Modern Bold',
    'services',
    'plumber',
    'Contemporary design with high visual impact',
    ARRAY['modern', 'bold', 'red', 'services'],
    ARRAY['header', 'hero', 'services', 'portfolio', 'testimonials', 'cta', 'footer'],
    '{"primary": "#e74c3c", "secondary": "#c0392b", "accent": "#3498db"}',
    '/templates/services/plumber/modern-bold-preview.png'
  ),
  (
    'plumber-minimal-clean',
    'Minimal Clean',
    'services',
    'plumber',
    'Simplistic whitespace-focused elegant design',
    ARRAY['minimal', 'clean', 'gray', 'services'],
    ARRAY['header', 'hero', 'services', 'about', 'testimonials', 'cta', 'footer'],
    '{"primary": "#2c3e50", "secondary": "#34495e", "accent": "#16a085"}',
    '/templates/services/plumber/minimal-clean-preview.png'
  ),
  -- Add more templates here...
  -- SERVICES: ELECTRICIAN
  (
    'electrician-classic-pro',
    'Classic Professional',
    'services',
    'electrician',
    'Trusted professional design for electrical services',
    ARRAY['professional', 'modern', 'blue', 'services'],
    ARRAY['header', 'hero', 'services', 'about', 'testimonials', 'cta', 'footer'],
    '{"primary": "#1e40af", "secondary": "#1e3a8a", "accent": "#f59e0b"}',
    '/templates/services/electrician/classic-pro-preview.png'
  )
  -- ... continue with all 60 templates
  ;
```

**Automated Insertion Script (Node.js)**

Save as `scripts/insert-templates.js`:

```javascript
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role for admin access

const supabase = createClient(supabaseUrl, supabaseKey);

async function insertTemplates() {
  const metadata = JSON.parse(fs.readFileSync('./public/templates/metadata.json', 'utf-8'));
  
  const templates = metadata.map(t => ({
    template_id: t.id,
    name: t.name,
    business_type: t.businessType,
    category: t.category,
    description: t.description,
    tags: t.tags,
    sections: t.sections,
    colors: t.colors,
    image_url: t.imageUrl,
  }));

  const { data, error } = await supabase
    .from('templates')
    .insert(templates)
    .select();

  if (error) {
    console.error('Error inserting templates:', error);
    process.exit(1);
  }

  console.log(`✅ Inserted ${data.length} templates`);
}

insertTemplates();
```

**Run the script:**

```bash
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
node scripts/insert-templates.js
```

### 3. Update API Endpoints (Optional)

Currently, the API reads from the filesystem. To use Supabase in the future:

**Updated `/api/templates/metadata/route.ts`:**

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const businessType = searchParams.get('businessType');
  const category = searchParams.get('category');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(50, parseInt(searchParams.get('limit') || '12'));

  let query = supabase
    .from('templates')
    .select('*', { count: 'exact' })
    .eq('is_active', true);

  if (businessType) query = query.eq('business_type', businessType);
  if (category) query = query.eq('category', category);

  const { data, count, error } = await query
    .range((page - 1) * limit, page * limit - 1)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return Response.json({
    templates: data,
    total: count,
    page,
    limit,
    hasMore: (page * limit) < (count || 0),
  });
}
```

## Hybrid Approach (Recommended)

For now, use the **filesystem + metadata.json** approach:

1. ✅ Store template HTML files in `/public/templates/` (served as static assets)
2. ✅ Store metadata in `metadata.json` (managed locally)
3. ✅ API endpoints read from filesystem
4. ⏳ Optionally insert metadata into Supabase for future filtering/analytics

This allows:
- Fast static file serving
- No redeployment needed for Supabase updates
- Easy template management during development
- Migration path to full Supabase storage later

## Moving Forward

Once templates are working well, migrate to **Supabase + CDN**:

1. Store HTML files in **S3 or Cloudflare R2**
2. Store metadata + HTML URLs in **Supabase**
3. Cache in **Redis** or **Edge functions**
4. Update without redeploying Next.js

This architecture supports that evolution.

## File Checklist Before Deployment

- [ ] All 60 template HTML files created
- [ ] metadata.json populated with 60 entries
- [ ] Preview screenshots captured (optional but recommended)
- [ ] Templates tested in `/editor`
- [ ] Color customization working
- [ ] Mobile responsiveness verified
- [ ] Supabase table created (optional)
- [ ] Metadata inserted into Supabase (optional)

## Testing in Production

1. Deploy to Vercel
2. Verify templates load in onboarding
3. Select a template and view in editor
4. Test color customization
5. Verify on mobile devices

## Troubleshooting

### Templates not loading in onboarding
- Check that `/api/templates/metadata` is accessible
- Verify `metadata.json` exists at `/public/templates/metadata.json`
- Check browser console for fetch errors

### Editor shows "Template not found"
- Verify HTML file exists at `/public/templates/{businessType}/{category}/{id}.html`
- Check `/api/templates/[id]` endpoint logs
- Ensure template IDs match exactly

### Colors not applying
- Verify `designData.colors` is set in site data
- Check that template HTML uses one of these color patterns:
  - `var(--primary)`, `var(--secondary)`, `var(--accent)`
  - `[primary]`, `[secondary]`, `[accent]`
  - Tailwind arbitrary values like `bg-[#0066cc]`

### Preview images not showing
- Verify image URLs are correct in metadata.json
- Store images in `/public/templates/{businessType}/{category}/`
- Use relative URLs: `/templates/...`

---

Once the sub-agent finishes creating all 60 templates, follow these steps to integrate them into Keystone Web.
