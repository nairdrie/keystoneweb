'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Plus, RotateCcw, RotateCw } from 'lucide-react';
import { useAuth } from '@/lib/auth/context';
import KeystoneLogo from './KeystoneLogo';
import { Change } from '@/lib/hooks/useChangeTracking';

interface Palette {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
}

interface Site {
  id: string;
  siteSlug?: string;
  selectedTemplateId: string;
  businessType: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

interface FloatingToolbarProps {
  siteTitle: string;
  onSiteTitle: (title: string) => void;
  currentSiteId?: string;
  templateName?: string;
  templatePalettes?: Palette[];
  selectedPalette?: Palette;
  onSelectPalette?: (palette: Palette) => void;
  onCustomColorChange?: (type: 'primary' | 'secondary' | 'accent', value: string) => void;
  onSave: () => void;
  onPublish?: () => void;
  saving?: boolean;
  publishing?: boolean;
  changes?: Change[];
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export default function FloatingToolbar({
  siteTitle,
  onSiteTitle,
  currentSiteId,
  templateName,
  templatePalettes = [],
  selectedPalette,
  onSelectPalette,
  onCustomColorChange,
  onSave,
  onPublish,
  saving = false,
  publishing = false,
  changes = [],
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}: FloatingToolbarProps) {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [userSites, setUserSites] = useState<Site[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [showChanges, setShowChanges] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number>(0);
  const dragStartHeight = useRef<number>(0);
  const isDragging = useRef<boolean>(false);
  const [showSiteSwitcher, setShowSiteSwitcher] = useState(false);

  useEffect(() => {
    if (!isOpen || !user) return;

    const fetchSites = async () => {
      try {
        setLoadingSites(true);
        const res = await fetch('/api/user/sites', { credentials: 'include' });
        if (res.ok) {
          const { sites } = await res.json();
          setUserSites(sites);
        }
      } catch (error) {
        console.error('Failed to fetch user sites:', error);
      } finally {
        setLoadingSites(false);
      }
    };

    fetchSites();
  }, [isOpen, user]);

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

  const handlePublish = () => {
    // If there are unsaved changes, show modal to save first
    if (changes.length > 0) {
      setShowPublishModal(true);
    } else {
      // No unsaved changes, go straight to pricing
      router.push('/pricing?action=publish&siteId=' + currentSiteId);
    }
  };

  const handlePublishAndSave = async () => {
    // Save first, then redirect to pricing
    onSave();
    // Wait a moment for save to complete, then redirect
    setTimeout(() => {
      setShowPublishModal(false);
      router.push('/pricing?action=publish&siteId=' + currentSiteId);
    }, 500);
  };

  const handleDragStart = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartY.current = e.clientY;
    dragStartHeight.current = drawerRef.current?.offsetHeight || 0;
  };

  const handleDragMove = (e: React.MouseEvent) => {
    if (!isOpen || !drawerRef.current || !isDragging.current) return;
    const deltaY = e.clientY - dragStartY.current;

    // If dragged down significantly, close the drawer
    if (deltaY > 50) {
      setIsOpen(false);
      isDragging.current = false;
    }
  };

  const handleDragEnd = () => {
    isDragging.current = false;
  };

  return (
    <>
      {/* Floating Button - Always Keystone Red (z-50) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full text-white shadow-lg flex items-center justify-center transition-all hover:scale-110 hover:brightness-110"
          style={{ backgroundColor: 'var(--brand-primary)' }}
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
          className="fixed inset-0 bg-black bg-opacity-30 z-40 overscroll-none touch-none"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer - Slide animation */}
      {isOpen && (
        <div
          ref={drawerRef}
          className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[80vh] overflow-y-auto overscroll-contain transition-all duration-300 ease-out animate-in slide-in-from-bottom-10"
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
        >
          {/* White Header with Logo - Draggable */}
          <div
            className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-3xl cursor-grab active:cursor-grabbing group"
            onMouseDown={handleDragStart}
          >
            <KeystoneLogo href="/" size="lg" showText={false} />
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-900"
              title="Close (drag down to close)"
            >
              <ChevronDown className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 pb-8 pt-6 space-y-8">
            {/* Currently Editing Section */}
            <div>
              <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wide mb-4">Currently Editing</h3>

              {/* Site Name Input & Inline Switcher */}
              <div className="relative flex items-center mb-6">
                <input
                  type="text"
                  value={siteTitle}
                  onChange={(e) => onSiteTitle(e.target.value)}
                  className="w-full text-2xl font-bold text-slate-900 bg-transparent border-b-2 border-slate-300 focus:border-red-600 focus:outline-none pb-2 placeholder-slate-400 transition-colors"
                  placeholder="My Awesome Website"
                />

                {/* Always show dropdown toggle if authenticated */}
                {user && (
                  <button
                    onClick={() => setShowSiteSwitcher(!showSiteSwitcher)}
                    className="absolute right-0 bottom-2 p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                    title="Switch or create sites"
                  >
                    <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${showSiteSwitcher ? 'rotate-180' : ''}`} />
                  </button>
                )}

                {/* Dropdown Menu */}
                {user && showSiteSwitcher && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-[60] animate-in fade-in slide-in-from-top-2">
                    <div className="max-h-60 overflow-y-auto outline-none p-2 space-y-1">
                      {/* Existing Sites */}
                      {userSites.length > 0 ? (
                        <>
                          <div className="px-3 py-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Your Sites</div>
                          {userSites.map((site) => (
                            <button
                              key={site.id}
                              onClick={() => {
                                setIsOpen(false);
                                setShowSiteSwitcher(false);
                                router.push(`/editor?siteId=${site.id}`);
                              }}
                              className={`w-full text-left px-3 py-2.5 rounded-lg transition-all text-sm flex items-center justify-between group ${currentSiteId === site.id
                                ? 'bg-red-50 text-red-900 font-semibold border border-red-100'
                                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                                }`}
                            >
                              <span className="truncate pr-4">{site.siteSlug || `Site ${site.id.slice(0, 8)}`}</span>
                              {currentSiteId === site.id && (
                                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                              )}
                            </button>
                          ))}
                          <div className="h-px bg-slate-100 my-2 mx-1" />
                        </>
                      ) : (
                        <div className="px-3 py-4 text-sm text-slate-500 text-center">No other sites found</div>
                      )}

                      {/* Create New Option */}
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          setShowSiteSwitcher(false);
                          router.push('/onboarding');
                        }}
                        className="w-full text-left px-3 py-2.5 rounded-lg transition-all text-sm flex items-center gap-2 text-red-600 hover:bg-red-50 font-medium mt-1"
                      >
                        <Plus className="w-4 h-4" />
                        Create New Site
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Selected Template Section */}
            {templateName && (
              <div>
                <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wide mb-3">Selected Template</h3>
                <div className="bg-slate-50 rounded-lg p-4 mb-3">
                  <div className="font-semibold text-slate-900">{templateName}</div>
                </div>
                <button className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
                  Switch Template
                </button>
                <p className="text-xs text-slate-500 mt-2">
                  ⚠️ Switching templates will lose unsaved content that doesn't exist in the new template
                </p>
              </div>
            )}

            {/* Selected Color Palette Section */}
            {templatePalettes && templatePalettes.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wide mb-3">Color Palette</h3>
                <div className="grid grid-cols-4 gap-2">
                  {templatePalettes.map((palette) => (
                    <button
                      key={palette.name}
                      onClick={() => onSelectPalette?.(palette)}
                      className={`group relative overflow-hidden rounded-lg border-2 transition-all h-12 ${selectedPalette?.name === palette.name
                        ? 'shadow-lg'
                        : 'border-slate-200 hover:border-slate-400'
                        }`}
                      style={selectedPalette?.name === palette.name ? { borderColor: 'var(--brand-primary)' } : {}}
                      title={palette.name}
                    >
                      {/* Three color preview */}
                      <div className="h-full flex">
                        <div className="flex-1" style={{ backgroundColor: palette.primary }} />
                        <div className="flex-1" style={{ backgroundColor: palette.secondary }} />
                        <div className="flex-1" style={{ backgroundColor: palette.accent }} />
                      </div>
                      {/* Palette name on hover */}
                      <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="capitalize text-white text-xs font-semibold text-center px-1">{palette.name}</span>
                      </div>
                      {/* Selected checkmark */}
                      {selectedPalette?.name === palette.name && (
                        <div className="absolute top-1 right-1 text-white rounded-full p-0.5" style={{ backgroundColor: 'var(--brand-primary)' }}>
                          <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {/* Custom Color Pickers - Only show when "custom" is selected */}
                {selectedPalette?.name === 'custom' && (
                  <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center gap-2">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Primary</span>
                      <input
                        type="color"
                        value={selectedPalette.primary}
                        onChange={(e) => onCustomColorChange?.('primary', e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent"
                      />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Secondary</span>
                      <input
                        type="color"
                        value={selectedPalette.secondary}
                        onChange={(e) => onCustomColorChange?.('secondary', e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent"
                      />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Accent</span>
                      <input
                        type="color"
                        value={selectedPalette.accent}
                        onChange={(e) => onCustomColorChange?.('accent', e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Color Palette Selector moved above */}

            {/* Unsaved Changes Section */}
            {changes && changes.length > 0 && (
              <div className="mb-6">
                {/* Unsaved Changes Header - Clickable to expand */}
                <button
                  onClick={() => setShowChanges(!showChanges)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-amber-400 text-white flex items-center justify-center text-xs font-bold">
                      {changes.length}
                    </div>
                    <span className="text-sm font-semibold text-amber-900">
                      {changes.length} unsaved change{changes.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div
                    className={`transition-transform ${showChanges ? 'rotate-180' : ''}`}
                  >
                    <ChevronDown className="w-4 h-4 text-amber-700" />
                  </div>
                </button>

                {/* Accordion Content */}
                {showChanges && (
                  <div className="mt-2 p-4 bg-white border border-slate-200 rounded-lg space-y-2 max-h-48 overflow-y-auto">
                    {changes.map((change) => (
                      <div
                        key={change.id}
                        className="text-xs text-slate-700 pb-2 border-b border-slate-100 last:border-b-0"
                      >
                        <div className="font-medium text-slate-900">
                          {change.label}
                        </div>
                        <div className="text-slate-600 mt-1">
                          <span className="line-through text-red-600">
                            {change.from || '(empty)'}
                          </span>
                          <span className="mx-2 text-slate-400">→</span>
                          <span className="text-green-600">
                            {change.to || '(empty)'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Undo/Redo Buttons */}
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={onUndo}
                    disabled={!canUndo}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-semibold text-sm rounded transition-colors"
                    title="Undo"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Undo
                  </button>
                  <button
                    onClick={onRedo}
                    disabled={!canRedo}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-semibold text-sm rounded transition-colors"
                    title="Redo"
                  >
                    <RotateCw className="w-4 h-4" />
                    Redo
                  </button>
                </div>
              </div>
            )}

            {/* Save Draft & Publish Buttons */}
            <div className="flex gap-3">
              {/* Save Draft Button */}
              <button
                onClick={handleSave}
                disabled={saving || changes.length === 0}
                className="flex-1 py-3 text-white font-bold rounded-lg transition-colors hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed bg-slate-600 hover:bg-slate-700"
                title={changes.length === 0 ? 'No changes to save' : 'Save your draft'}
              >
                {saving ? 'Saving...' : user ? 'Save Draft' : 'Sign Up to Save'}
              </button>

              {/* Publish Button */}
              <button
                onClick={handlePublish}
                disabled={publishing || !user}
                className="flex-1 py-3 text-white font-bold rounded-lg transition-colors hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--brand-primary)' }}
                title={!user ? 'Sign in to publish' : 'Publish your site'}
              >
                {publishing ? 'Publishing...' : 'Publish'}
              </button>
            </div>

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

      {/* Publish Modal - Show when user tries to publish with unsaved changes */}
      {showPublishModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Publish Your Site?</h2>

            <p className="text-slate-600 mb-6">
              You have <strong>{changes.length} unsaved change{changes.length !== 1 ? 's' : ''}</strong> that need to be saved before publishing.
            </p>

            {/* Show changes summary */}
            {changes.length > 0 && (
              <div className="bg-slate-50 rounded-lg p-4 mb-6 max-h-32 overflow-y-auto">
                <p className="text-xs font-semibold text-slate-700 mb-2">Unsaved changes:</p>
                <div className="space-y-1">
                  {changes.map((change) => (
                    <div key={change.id} className="text-xs text-slate-600">
                      <span className="font-medium">{change.label}:</span> {change.from} → {change.to}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-sm text-slate-700 mb-6">
              Publishing requires a subscription. After saving, you'll choose a plan and complete checkout with Stripe.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPublishModal(false)}
                className="flex-1 py-2 px-4 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePublishAndSave}
                disabled={saving}
                className="flex-1 py-2 px-4 text-white font-bold rounded-lg transition-colors hover:brightness-110 disabled:opacity-60"
                style={{ backgroundColor: 'var(--brand-primary)' }}
              >
                {saving ? 'Saving...' : 'Save & Continue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
