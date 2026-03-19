-- Add translations support to sites and pages
-- translations_config: stores language settings (enabled, default language, supported languages with auto-translate flags)
-- translations: stores translated content keyed by language code

ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS translations_config jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS translations jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.pages
  ADD COLUMN IF NOT EXISTS translations jsonb DEFAULT '{}'::jsonb;

-- Example translations_config shape:
-- {
--   "enabled": true,
--   "defaultLanguage": "en",
--   "languages": [
--     { "code": "en", "name": "English", "autoTranslate": false },
--     { "code": "fr", "name": "French", "autoTranslate": true }
--   ]
-- }
--
-- Example translations shape (on sites or pages):
-- {
--   "fr": { "siteTitle": "Mon Site", "tagline": "Bienvenue", "__blocks": [...] },
--   "es": { "siteTitle": "Mi Sitio", ... }
-- }
