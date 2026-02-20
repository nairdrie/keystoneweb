'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronUp } from 'lucide-react';
import { useAuth } from '@/lib/auth/context';

interface FloatingToolbarProps {
  siteTitle: string;
  onSiteTitle: (title: string) => void;
  onSave: () => void;
  saving?: boolean;
}

const COLOR_PALETTES = [
  {
    name: 'Ocean Blue',
    primary: '#0369a1',
    secondary: '#06b6d4',
  },
  {
    name: 'Forest Green',
    primary: '#15803d',
    secondary: '#4ade80',
  },
  {
    name: 'Sunset Orange',
    primary: '#ea580c',
    secondary: '#fb923c',
  },
  {
    name: 'Royal Purple',
    primary: '#7c3aed',
    secondary: '#c084fc',
  },
  {
    name: 'Keystone Red',
    primary: '#dc2626',
    secondary: '#f87171',
  },
];

export default function FloatingToolbar({
  siteTitle,
  onSiteTitle,
  onSave,
  saving = false,
}: FloatingToolbarProps) {
  const router = useRouter();
  const { signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg flex items-center justify-center transition-all hover:scale-110"
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
          className="fixed inset-0 bg-black bg-opacity-30 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer */}
      {isOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white rounded-t-2xl shadow-2xl max-h-[80vh] overflow-y-auto">
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-2">
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
            >
              <ChevronUp className="w-6 h-6 text-slate-400" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 pb-8">
            {/* Title */}
            <h2 className="text-2xl font-bold mb-6">Site Settings</h2>

            {/* Site Title */}
            <div className="mb-8">
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Site Name
              </label>
              <input
                type="text"
                value={siteTitle}
                onChange={(e) => onSiteTitle(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                placeholder="My Awesome Website"
              />
            </div>

            {/* Color Palette */}
            <div className="mb-8">
              <label className="block text-sm font-semibold text-slate-900 mb-4">
                Color Palette
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {COLOR_PALETTES.map((palette) => (
                  <button
                    key={palette.name}
                    className="group relative overflow-hidden rounded-lg border-2 border-slate-200 hover:border-slate-400 transition-all hover:shadow-md"
                    title={palette.name}
                  >
                    {/* Two color preview */}
                    <div className="h-16 flex">
                      <div
                        className="flex-1"
                        style={{ backgroundColor: palette.primary }}
                      />
                      <div
                        className="flex-1"
                        style={{ backgroundColor: palette.secondary }}
                      />
                    </div>
                    {/* Palette name on hover */}
                    <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-white text-xs font-semibold text-center px-2">
                        {palette.name}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-3">
                Color selection coming soon — these are previews for now
              </p>
            </div>

            {/* Save Button */}
            <button
              onClick={onSave}
              disabled={saving}
              className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-bold rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : 'Save Site'}
            </button>

            {/* Divider */}
            <div className="my-6 h-px bg-slate-200" />

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="w-full py-3 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold rounded-lg transition-colors"
            >
              Log Out
            </button>

            {/* Footer Info */}
            <p className="text-xs text-slate-600 text-center mt-4">
              More customization options coming soon
            </p>
          </div>
        </div>
      )}
    </>
  );
}
