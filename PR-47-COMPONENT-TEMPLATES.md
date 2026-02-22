# PR #47: Convert Templates to React Components

## Overview

Converts templates from static HTML files to React components, enabling:
- **Industry-specific defaults** — Each template has sensible defaults per industry
- **Reusable `EditableText` component** — Click-to-edit text in any template
- **Built-in routing** — Each template gets its own Next.js pages (multi-page sites)
- **Future extensibility** — Easy to add `EditableImage`, `EditableSection`, etc.
- **Cleaner organization** — No more metadata.json or HTML parsing

## Architecture Changes

### Old System (HTML-based)
```
public/templates/
├── services/
│   ├── plumber/
│   │   ├── classic-pro.html      ← Plain HTML with {{keys}}
│   │   └── modern-blue.html
│   └── fitness/
│       └── minimal-clean.html

app/components/
└── TemplateRenderer.tsx           ← Parses HTML, replaces {{keys}} with inputs
```

**Problem**: HTML parsing is fragile, no routing, limited interactivity

### New System (Component-based)
```
app/templates/
├── registry.ts                    ← Maps templateId → component
├── plumber/
│   ├── classic-pro.tsx            ← React component with defaults
│   └── modern-blue.tsx
├── fitness/
│   └── minimal-clean.tsx
└── shared/
    └── EditableText.tsx           ← Reusable editable component

lib/
├── editor-context.tsx             ← Provides edit mode + content to templates
└── db/
    ├── template-metadata.sql      ← DB schema for palettes + customizables
    └── template-queries.ts        ← Query helpers
```

**Benefits**:
- React components are powerful and flexible
- Native routing for multi-page sites
- Palettes stored in DB (not code)
- Each template can have custom styling/logic
- Easy to extend with new editable components

## New Files

### Core Infrastructure
1. **`app/templates/registry.ts`**
   - Maps `templateId` → dynamic import
   - Lazy-loads components to keep bundle small
   - Example: `'classic-pro-plumber'` → `ClassicProPlumber` component

2. **`lib/editor-context.tsx`**
   - Context provider that templates use
   - Provides: `content`, `isEditMode`, `updateContent()`, `palette`
   - Templates access via `useEditorContext()` hook

3. **`lib/db/template-metadata.sql`**
   - New table: `template_metadata` (stores palettes, customizables, metadata)
   - Schema:
     ```sql
     template_id (unique, e.g., 'classic-pro-plumber')
     name, description, category, business_type
     palettes (JSONB, e.g., { "default": {...}, "dark": {...} })
     customizables (JSONB, e.g., { "hero": ["title", "subtitle"] })
     thumbnail_url
     ```

4. **`lib/db/template-queries.ts`**
   - Helper functions: `getTemplateMetadata()`, `getTemplatePalette()`, etc.
   - Used by editor and API routes

### API Changes
5. **`app/api/templates/metadata/route.ts`** (NEW)
   - `GET /api/templates/metadata` — All templates with metadata
   - `GET /api/templates/metadata?category=plumber` — Filtered
   - Replaces static `metadata.json`

### Template Examples
6. **`app/templates/plumber/classic-pro.tsx`**
   - Example component with industry defaults
   - Shows usage of `EditableText`
   - Shows color palette application
   - Uses `useEditorContext()` to access edit mode

7. **`app/templates/plumber/modern-blue.tsx`**
   - Another example template
   - Different design, same pattern

### Editor Update
8. **`app/(app)/editor/editor-content-v2.tsx`**
   - New editor that uses component-based templates
   - Dynamically loads template component via registry
   - Loads palettes from DB
   - Wraps template in `EditorProvider`

## How to Use

### For Users (No Change)
- Select a business type and category
- Choose a template
- Edit content with pencil icons
- Change palette from dropdown
- Save design

### For Developers (New Pattern)

**1. Create a new template component:**

```tsx
// app/templates/category/template-name.tsx
'use client';

import EditableText from '@/app/components/EditableText';
import { useEditorContext } from '@/lib/editor-context';

export function TemplateName({ palette = {}, isEditMode = false }) {
  const { content = {}, isEditMode: contextEditMode, updateContent } = useEditorContext() || {
    content: {},
    isEditMode: false,
    updateContent: () => {},
  };

  const actualEditMode = isEditMode || contextEditMode;

  const defaults = {
    heroTitle: 'Industry-specific default text',
    heroCTA: 'Call to action',
    // ... more defaults
  };

  return (
    <EditableText
      as="h1"
      contentKey="heroTitle"
      content={content.heroTitle}
      defaultText={defaults.heroTitle}
      isEditMode={actualEditMode}
      onSave={(key, value) => updateContent(key, value)}
      className="text-4xl font-bold"
    />
  );
}
```

**2. Register in the template registry:**

```ts
// app/templates/registry.ts
const TEMPLATE_REGISTRY = {
  'template-id': () =>
    import('./category/template-name').then((m) => ({default: m.TemplateName})),
};
```

**3. Add metadata to database:**

```sql
INSERT INTO template_metadata (template_id, name, category, business_type, palettes)
VALUES (
  'template-id',
  'Template Name',
  'category',
  'services',
  '{"default": {"primary": "#dc2626", ...}, "dark": {...}}'::jsonb
);
```

That's it! Template is now available in the editor with full functionality.

## Migration Steps

### Step 1: Run Database Migration
```bash
# In Supabase SQL Editor, run:
cat lib/db/template-metadata.sql

# Seed with at least the plumber templates
INSERT INTO template_metadata ...
```

### Step 2: Replace Editor
- Rename `app/(app)/editor/editor-content.tsx` → `editor-content-old.tsx`
- Rename `editor-content-v2.tsx` → `editor-content.tsx`
- Remove `TemplateRenderer` component (no longer needed)

### Step 3: Convert Remaining 58 Templates
- Use the two plumber examples as templates
- Convert each HTML file to a `.tsx` component
- Each gets industry defaults from HTML
- Register in `registry.ts`
- Add to `template_metadata` table

**Batch approach**:
- 60 templates ÷ 6 templates per PR = ~10 PRs
- OR: Convert all 60 in one large PR and merge after testing

### Step 4: Test
- Create a new site and select a template
- Verify pencil icons appear in edit mode
- Test palette switching
- Test saving design
- Verify defaults show when no content set

## Supabase Migration Script

Run this in Supabase SQL Editor to create the table and seed initial templates:

```sql
-- Create template_metadata table
CREATE TABLE template_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id VARCHAR UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  description TEXT,
  category VARCHAR,
  business_type VARCHAR,
  palettes JSONB DEFAULT '{
    "default": {
      "primary": "#dc2626",
      "secondary": "#1e40af",
      "accent": "#06b6d4",
      "text": "#1f2937",
      "bg": "#ffffff"
    }
  }'::jsonb,
  customizables JSONB DEFAULT '{
    "hero": ["title", "subtitle", "cta"]
  }'::jsonb,
  thumbnail_url VARCHAR,
  multi_page BOOLEAN DEFAULT FALSE,
  has_blog BOOLEAN DEFAULT FALSE,
  has_gallery BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_template_metadata_category ON template_metadata(category);
CREATE INDEX idx_template_metadata_business_type ON template_metadata(business_type);

-- Seed plumber templates
INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes) VALUES
(
  'classic-pro-plumber',
  'Classic Pro',
  'Professional plumber website with services and portfolio',
  'plumber',
  'services',
  '{
    "default": {
      "primary": "#dc2626",
      "secondary": "#1e40af",
      "accent": "#06b6d4",
      "text": "#1f2937",
      "bg": "#ffffff"
    },
    "dark": {
      "primary": "#991b1b",
      "secondary": "#1e3a8a",
      "accent": "#0891b2",
      "text": "#f3f4f6",
      "bg": "#111827"
    }
  }'::jsonb
),
(
  'modern-blue-plumber',
  'Modern Blue',
  'Modern blue design for plumbing services',
  'plumber',
  'services',
  '{
    "default": {
      "primary": "#1e40af",
      "secondary": "#0ea5e9",
      "accent": "#f59e0b",
      "text": "#0f172a",
      "bg": "#f8fafc"
    },
    "dark": {
      "primary": "#1e3a8a",
      "secondary": "#0369a1",
      "accent": "#d97706",
      "text": "#f1f5f9",
      "bg": "#020617"
    }
  }'::jsonb
);
```

## Benefits Summary

| Aspect | Old (HTML) | New (Components) |
|--------|-----------|-----------------|
| **Defaults** | None | Industry-specific per template |
| **Routing** | Single page | Multi-page per template |
| **Extensibility** | Hard (HTML parsing) | Easy (React components) |
| **Palettes** | metadata.json | Database |
| **Editable Components** | EditableText only | Easy to add more (EditableImage, etc.) |
| **Code Reuse** | Limited | Full React ecosystem |

## Testing Checklist

- [ ] Database table created and seeded
- [ ] Editor loads template component
- [ ] Edit mode shows pencil icons
- [ ] Text edits save to `editableContent`
- [ ] Palette selector works
- [ ] Palette changes reflected in template
- [ ] Design save includes palette + content
- [ ] Reload page, content/palette persist
- [ ] New sites load with industry defaults
- [ ] All 60 templates converted and registered

## Rollback Plan

If issues arise:
1. Keep `editor-content-old.tsx` as fallback
2. Switch back: `editor-content.tsx` → `editor-content-new.tsx`, `editor-content-old.tsx` → `editor-content.tsx`
3. Revert database if needed (template_metadata table is new, safe to drop)

## Next Phase (After Merge)

1. **Design persistence** — Save `designData` properly to DB
2. **Multi-site switcher** — Allow editing different sites in same session
3. **Public site rendering** — Render templates on public domain
4. **Convert remaining 58 templates** — Bulk conversion PRs
