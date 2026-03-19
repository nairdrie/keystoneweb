import type { SupabaseClient } from '@supabase/supabase-js';

export interface TranslationsConfig {
  enabled: boolean;
  defaultLanguage: string;
  languages: { code: string; name: string; autoTranslate: boolean }[];
}

/**
 * Check if a slug is a valid language code for a site's translations config.
 */
export function isLanguageCode(
  slug: string,
  config: TranslationsConfig | null,
): boolean {
  if (!config?.enabled || !config.languages?.length) return false;
  return config.languages.some((l) => l.code === slug);
}

/**
 * Resolve translated content for a site or page.
 * If a translation exists for the requested language, merge it over the original data.
 * Translations are stored as complete copies of design_data with translated strings.
 */
export function resolveTranslatedContent(
  originalData: Record<string, any>,
  translations: Record<string, any> | null,
  language: string,
  defaultLanguage: string,
): Record<string, any> {
  // If requesting the default language, return original
  if (language === defaultLanguage || !translations) {
    return originalData;
  }

  const translated = translations[language];
  if (!translated) {
    return originalData;
  }

  // The translated content is a full copy of design_data with translated strings.
  // Merge: translated data takes precedence, but keep structural fields from original
  // that might not be in the translation (like palette, fonts, etc.)
  return {
    ...originalData,
    ...translated,
  };
}

/**
 * Fetch the translations config and site/page translations from the database.
 */
export async function fetchTranslationsConfig(
  supabase: SupabaseClient,
  siteId: string,
): Promise<TranslationsConfig | null> {
  const { data } = await supabase
    .from('sites')
    .select('translations_config')
    .eq('id', siteId)
    .single();

  const config = data?.translations_config;
  if (!config?.enabled || !config?.languages?.length) return null;
  return config as TranslationsConfig;
}

/**
 * Fetch published translations for a site.
 */
export async function fetchSiteTranslations(
  supabase: SupabaseClient,
  siteId: string,
): Promise<Record<string, any> | null> {
  const { data } = await supabase
    .from('sites')
    .select('translations')
    .eq('id', siteId)
    .single();

  return data?.translations || null;
}

/**
 * Fetch published translations for a specific page.
 */
export async function fetchPageTranslations(
  supabase: SupabaseClient,
  siteId: string,
  pageSlug: string,
): Promise<Record<string, any> | null> {
  const { data } = await supabase
    .from('pages')
    .select('translations')
    .eq('site_id', siteId)
    .eq('slug', pageSlug)
    .single();

  return data?.translations || null;
}
