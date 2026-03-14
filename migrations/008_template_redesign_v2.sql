-- Migration: Template Redesign V2
-- Replaces the old 3 templates (Bold, Elegant, Starter) with 8 new templates
-- (Luxe, Vivid, Airy, Edge, Classic, Organic, Sleek, Vibrant)
-- Each category now gets 8 visually distinct templates
-- All templates are multi-page with booking (services) or products (ecommerce) pages

-- Step 1: Ensure default_content column exists (should already from migration 003)
ALTER TABLE template_metadata ADD COLUMN IF NOT EXISTS default_content jsonb DEFAULT '{}'::jsonb;

-- Step 2: Remove old templates (bold_*, elegant_*, starter_*, svc_*, prod_*)
-- Keep the table structure, just clear old data
DELETE FROM template_metadata WHERE template_id LIKE 'bold_%'
  OR template_id LIKE 'elegant_%'
  OR template_id LIKE 'starter_%'
  OR template_id LIKE 'svc_%'
  OR template_id LIKE 'prod_%';

-- Step 3: New template data is inserted via template_inserts_v2.sql
-- Run that file after this migration:
--   psql -f template_inserts_v2.sql
-- Or execute it through your Supabase SQL editor

-- Note: Existing sites are not affected — they reference template_id in their
-- design_data and pages, so they continue to work. The old template components
-- are preserved as legacy fallbacks in the registry.
