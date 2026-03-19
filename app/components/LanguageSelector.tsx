'use client';

import { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown } from 'lucide-react';

interface Language {
  code: string;
  name: string;
}

interface LanguageSelectorProps {
  languages: Language[];
  currentLanguage: string;
  defaultLanguage: string;
}

/**
 * A language selector dropdown for published sites.
 * Navigates to /<langCode> or / (for the default language).
 */
export default function LanguageSelector({
  languages,
  currentLanguage,
  defaultLanguage,
}: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (languages.length < 2) return null;

  const current = languages.find((l) => l.code === currentLanguage) || languages[0];

  const handleSelect = (code: string) => {
    setIsOpen(false);
    // Navigate to the language route
    // Default language goes to /, others go to /code
    const currentPath = window.location.pathname;
    // Strip existing language prefix if present
    const langPrefixMatch = currentPath.match(/^\/([a-z]{2})(\/.*)?$/);
    const basePath = langPrefixMatch ? (langPrefixMatch[2] || '/') : currentPath;

    if (code === defaultLanguage) {
      window.location.href = basePath;
    } else {
      window.location.href = `/${code}${basePath === '/' ? '' : basePath}`;
    }
  };

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium rounded-lg hover:bg-black/5 transition-colors"
        aria-label="Select language"
      >
        <Globe className="w-4 h-4 opacity-60" />
        <span className="uppercase text-xs font-bold">{current.code}</span>
        <ChevronDown className={`w-3 h-3 opacity-50 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 py-1 min-w-[140px] z-50 animate-in fade-in slide-in-from-top-1">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors flex items-center gap-2 ${
                lang.code === currentLanguage
                  ? 'font-semibold text-blue-700 bg-blue-50'
                  : 'text-slate-700'
              }`}
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
  );
}
