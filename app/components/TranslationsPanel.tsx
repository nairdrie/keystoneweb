'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Globe,
  Plus,
  Trash2,
  Loader2,
  CheckCircle,
  AlertCircle,
  Zap,
  ChevronDown,
} from 'lucide-react';

export interface LanguageConfig {
  code: string;
  name: string;
  autoTranslate: boolean;
}

export interface TranslationsConfig {
  enabled: boolean;
  defaultLanguage: string;
  languages: LanguageConfig[];
}

interface TranslationsPanelProps {
  siteId?: string;
}

const AVAILABLE_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'French' },
  { code: 'es', name: 'Spanish' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'nl', name: 'Dutch' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ru', name: 'Russian' },
  { code: 'pl', name: 'Polish' },
  { code: 'sv', name: 'Swedish' },
  { code: 'da', name: 'Danish' },
  { code: 'fi', name: 'Finnish' },
  { code: 'no', name: 'Norwegian' },
  { code: 'tr', name: 'Turkish' },
  { code: 'uk', name: 'Ukrainian' },
];

const EMPTY_CONFIG: TranslationsConfig = {
  enabled: false,
  defaultLanguage: 'en',
  languages: [],
};

export default function TranslationsPanel({ siteId }: TranslationsPanelProps) {
  const [config, setConfig] = useState<TranslationsConfig>(EMPTY_CONFIG);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [translatingLang, setTranslatingLang] = useState<string | null>(null);
  const [translateStatus, setTranslateStatus] = useState<Record<string, 'idle' | 'success' | 'error'>>({});
  const [showAddLanguage, setShowAddLanguage] = useState(false);

  // Load config on mount
  useEffect(() => {
    if (!siteId) return;
    setLoading(true);
    fetch(`/api/translations/config?siteId=${siteId}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.translationsConfig && data.translationsConfig.languages) {
          setConfig(data.translationsConfig);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [siteId]);

  const saveConfig = useCallback(
    async (newConfig: TranslationsConfig) => {
      if (!siteId) return;
      setSaving(true);
      setSaveStatus('idle');
      try {
        const res = await fetch('/api/translations/config', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteId, translationsConfig: newConfig }),
        });
        if (res.ok) {
          setSaveStatus('success');
          setTimeout(() => setSaveStatus('idle'), 3000);
        } else {
          setSaveStatus('error');
        }
      } catch {
        setSaveStatus('error');
      } finally {
        setSaving(false);
      }
    },
    [siteId],
  );

  const handleToggleEnabled = () => {
    const newConfig = { ...config, enabled: !config.enabled };
    setConfig(newConfig);
    saveConfig(newConfig);
  };

  const handleAddLanguage = (code: string, name: string) => {
    if (config.languages.some((l) => l.code === code)) return;
    const newConfig = {
      ...config,
      languages: [...config.languages, { code, name, autoTranslate: false }],
    };
    // If this is the first language, set it as default
    if (newConfig.languages.length === 1) {
      newConfig.defaultLanguage = code;
    }
    setConfig(newConfig);
    setShowAddLanguage(false);
    saveConfig(newConfig);
  };

  const handleRemoveLanguage = (code: string) => {
    const newLanguages = config.languages.filter((l) => l.code !== code);
    let newDefault = config.defaultLanguage;
    if (newDefault === code) {
      newDefault = newLanguages[0]?.code || 'en';
    }
    const newConfig = { ...config, languages: newLanguages, defaultLanguage: newDefault };
    setConfig(newConfig);
    saveConfig(newConfig);
  };

  const handleSetDefault = (code: string) => {
    const newConfig = { ...config, defaultLanguage: code };
    setConfig(newConfig);
    saveConfig(newConfig);
  };

  const handleToggleAutoTranslate = (code: string) => {
    const newLanguages = config.languages.map((l) =>
      l.code === code ? { ...l, autoTranslate: !l.autoTranslate } : l,
    );
    const newConfig = { ...config, languages: newLanguages };
    setConfig(newConfig);
    saveConfig(newConfig);
  };

  const handleGenerateTranslation = async (code: string, name: string) => {
    if (!siteId || translatingLang) return;
    setTranslatingLang(code);
    setTranslateStatus((prev) => ({ ...prev, [code]: 'idle' }));
    try {
      const res = await fetch('/api/translations/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          targetLanguage: code,
          targetLanguageName: name,
        }),
      });
      if (res.ok) {
        setTranslateStatus((prev) => ({ ...prev, [code]: 'success' }));
        setTimeout(() => setTranslateStatus((prev) => ({ ...prev, [code]: 'idle' })), 5000);
      } else {
        setTranslateStatus((prev) => ({ ...prev, [code]: 'error' }));
      }
    } catch {
      setTranslateStatus((prev) => ({ ...prev, [code]: 'error' }));
    } finally {
      setTranslatingLang(null);
    }
  };

  const availableToAdd = AVAILABLE_LANGUAGES.filter(
    (l) => !config.languages.some((cl) => cl.code === l.code),
  );

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Intro */}
      <div className="text-xs text-slate-600 leading-relaxed">
        Serve your site in multiple languages. Visitors pick their language via a selector in your
        site header, and each language gets its own <code className="bg-slate-100 px-1 rounded text-[11px]">/en</code>, <code className="bg-slate-100 px-1 rounded text-[11px]">/fr</code> route.
      </div>

      {/* Enable toggle */}
      <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
        <span className="text-sm font-medium text-slate-800">Enable translations</span>
        <button
          onClick={handleToggleEnabled}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            config.enabled ? 'bg-blue-600' : 'bg-slate-300'
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              config.enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
            }`}
          />
        </button>
      </div>

      {config.enabled && (
        <>
          {/* Languages list */}
          {config.languages.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold uppercase text-slate-500 tracking-wide">
                Supported Languages
              </h3>
              {config.languages.map((lang) => (
                <div
                  key={lang.code}
                  className="border border-slate-200 rounded-lg bg-white p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500 uppercase w-6">
                        {lang.code}
                      </span>
                      <span className="text-sm font-medium text-slate-800">{lang.name}</span>
                      {config.defaultLanguage === lang.code && (
                        <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                          DEFAULT
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveLanguage(lang.code)}
                      className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Remove language"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    {/* Set as default */}
                    {config.defaultLanguage !== lang.code && (
                      <button
                        onClick={() => handleSetDefault(lang.code)}
                        className="text-[10px] text-slate-500 hover:text-blue-600 underline underline-offset-2"
                      >
                        Set as default
                      </button>
                    )}
                    {config.defaultLanguage === lang.code && <span />}

                    {/* Auto-translate toggle */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-500">Auto-translate</span>
                      <button
                        onClick={() => handleToggleAutoTranslate(lang.code)}
                        className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                          lang.autoTranslate ? 'bg-violet-500' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${
                            lang.autoTranslate ? 'translate-x-[14px]' : 'translate-x-[3px]'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Generate translation button (for non-default languages) */}
                  {config.defaultLanguage !== lang.code && (
                    <button
                      onClick={() => handleGenerateTranslation(lang.code, lang.name)}
                      disabled={translatingLang !== null}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-violet-50 border border-violet-200 text-violet-700 text-xs font-semibold rounded-lg hover:bg-violet-100 disabled:opacity-50 transition-colors"
                    >
                      {translatingLang === lang.code ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Translating...
                        </>
                      ) : (
                        <>
                          <Zap className="w-3 h-3" />
                          Generate Draft Translation
                        </>
                      )}
                    </button>
                  )}

                  {/* Translation status */}
                  {translateStatus[lang.code] === 'success' && (
                    <div className="flex items-center gap-1.5 text-[11px] text-green-700 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5">
                      <CheckCircle className="w-3 h-3 flex-shrink-0" />
                      Translation draft saved
                    </div>
                  )}
                  {translateStatus[lang.code] === 'error' && (
                    <div className="flex items-center gap-1.5 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      Translation failed
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add language */}
          {availableToAdd.length > 0 && (
            <div>
              <button
                onClick={() => setShowAddLanguage(!showAddLanguage)}
                className="w-full flex items-center gap-2 px-3 py-2.5 bg-white border border-dashed border-slate-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all text-sm text-slate-600 hover:text-blue-700"
              >
                <Plus className="w-4 h-4" />
                Add language
                <ChevronDown
                  className={`w-3 h-3 ml-auto transition-transform ${showAddLanguage ? 'rotate-180' : ''}`}
                />
              </button>

              {showAddLanguage && (
                <div className="mt-2 border border-slate-200 rounded-lg bg-white max-h-48 overflow-y-auto shadow-sm">
                  {availableToAdd.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => handleAddLanguage(lang.code, lang.name)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors text-sm text-slate-700 border-b border-slate-100 last:border-b-0 flex items-center gap-2"
                    >
                      <span className="text-[10px] font-bold text-slate-400 uppercase w-5">
                        {lang.code}
                      </span>
                      {lang.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Info about language selector */}
          {config.languages.length >= 2 && (
            <div className="text-[11px] text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 leading-relaxed">
              <Globe className="w-3 h-3 inline mr-1" />
              A language selector will appear in your published site header. Each language is served at its own route
              (e.g. <code className="bg-blue-100 px-0.5 rounded">/fr</code>).
            </div>
          )}

          {/* Save status */}
          {saveStatus === 'success' && (
            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
              Settings saved
            </div>
          )}
          {saveStatus === 'error' && (
            <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              Failed to save
            </div>
          )}
        </>
      )}
    </div>
  );
}
