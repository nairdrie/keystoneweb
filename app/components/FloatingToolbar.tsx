'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronUp, Home } from 'lucide-react';
import { useAuth } from '@/lib/auth/context';
import KeystoneLogo from './KeystoneLogo';

interface Palette {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
}

interface FloatingToolbarProps {
  siteTitle: string;
  onSiteTitle: (title: string) => void;
  templateName?: string;
  templatePalettes?: Palette[];
  selectedPalette?: Palette;
  onSelectPalette?: (palette: Palette) => void;
  onSave: () => void;
  saving?: boolean;
}

export default function FloatingToolbar({
  siteTitle,
  onSiteTitle,
  templateName,
  templatePalettes = [],
  selectedPalette,
  onSelectPalette,
  onSave,
  saving = false,
}: FloatingToolbarProps) {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    router.push('/');
  };

  const handleSave = () => {
    if (!user) {
      router.push('/signup');
      return;
    }
    onSave();
  };

  return (
    <>
      {/* Floating Button - Always Keystone Red (z-50) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg flex items-center justify-center transition-all hover:scale-110"
          title="Open editor settings"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5A2.25 2.25 0 008.25 22.5h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25h-2.25m-4.5 0v3m0-3h3m-3 3h3"
            />
          </svg>
        </button>
      )}

      {/* Drawer Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer - z-50 to be above overlay, Keystone Red header */}
      {isOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl max-h-[80vh] overflow-y-auto">
          {/* Red Header with Logo */}
          <div className="sticky top-0 bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-4 flex items-center justify-between rounded-t-2xl">
            <KeystoneLogo href="/" size="sm" showText={false} />
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/')}
                className="p-2 hover:bg-red-700 rounded-full transition-colors"
                title="Back to home"
              >
                <Home className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-red-700 rounded-full transition-colors"
                title="Close editor"
              >
                <ChevronUp className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 pb-8 pt-6">
            {/* Site Info Section */}
            <div className="bg-slate-50 rounded-lg p-4 mb-6">
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-semibold text-slate-600">Site Name: </span>
                  <span className="text-slate-900">{siteTitle}</span>
                </div>
                {templateName && (
                  <div>
                    <span className="font-semibold text-slate-600">Template: </span>
                    <span className="text-slate-900">{templateName}</span>
                  </div>
                )}
                {selectedPalette && (
                  <div>
                    <span className="font-semibold text-slate-600">Color Palette: </span>
                    <span className="text-slate-900">{selectedPalette.name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Site Title Edit */}
            <div className="mb-8">
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Edit Site Name
              </label>
              <input
                type="text"
                value={siteTitle}
                onChange={(e) => onSiteTitle(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                placeholder="My Awesome Website"
              />
            </div>

            {/* Color Palette Selector */}
            {templatePalettes && templatePalettes.length > 0 && (
              <div className="mb-8">
                <label className="block text-sm font-semibold text-slate-900 mb-4">
                  Color Palette
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {templatePalettes.map((palette) => (
                    <button
                      key={palette.name}
                      onClick={() => onSelectPalette?.(palette)}
                      className={`group relative overflow-hidden rounded-lg border-2 transition-all hover:shadow-md ${
                        selectedPalette?.name === palette.name
                          ? 'border-red-600 shadow-lg'
                          : 'border-slate-200 hover:border-slate-400'
                      }`}
                      title={palette.name}
                    >
                      {/* Three color preview */}
                      <div className="h-16 flex">
                        <div
                          className="flex-1"
                          style={{ backgroundColor: palette.primary }}
                        />
                        <div
                          className="flex-1"
                          style={{ backgroundColor: palette.secondary }}
                        />
                        <div
                          className="flex-1"
                          style={{ backgroundColor: palette.accent }}
                        />
                      </div>
                      {/* Palette name on hover */}
                      <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white text-xs font-semibold text-center px-2">
                          {palette.name}
                        </span>
                      </div>
                      {/* Selected checkmark */}
                      {selectedPalette?.name === palette.name && (
                        <div className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Save Button - Keystone Red */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-bold rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : user ? 'Save Site' : 'Sign Up to Save'}
            </button>

            {/* Divider */}
            <div className="my-6 h-px bg-slate-200" />

            {/* Logout Button */}
            {user && (
              <button
                onClick={handleLogout}
                className="w-full py-3 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold rounded-lg transition-colors"
              >
                Log Out
              </button>
            )}

            {/* Footer Info */}
            <p className="text-xs text-slate-600 text-center mt-4">
              Changes apply in real-time
            </p>
          </div>
        </div>
      )}
    </>
  );
}
