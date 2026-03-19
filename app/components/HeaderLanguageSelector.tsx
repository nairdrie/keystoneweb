'use client';

import { useEditorContext } from '@/lib/editor-context';
import LanguageSelector from './LanguageSelector';

/**
 * A self-contained language selector for template headers.
 * Reads translations config from the editor context (siteContent)
 * and renders a language picker dropdown when multiple languages are configured.
 *
 * Only renders on published sites (not in edit mode) with 2+ languages enabled.
 */
export default function HeaderLanguageSelector() {
  const context = useEditorContext();
  if (!context) return null;

  const { siteContent, isEditMode } = context;

  // Don't show in editor — translations are managed via the toolbar panel
  if (isEditMode) return null;

  const config = siteContent?.__translationsConfig;
  if (!config?.enabled || !config.languages || config.languages.length < 2) return null;

  const currentLanguage = siteContent?.__currentLanguage || config.defaultLanguage || 'en';

  return (
    <LanguageSelector
      languages={config.languages}
      currentLanguage={currentLanguage}
      defaultLanguage={config.defaultLanguage || 'en'}
    />
  );
}
