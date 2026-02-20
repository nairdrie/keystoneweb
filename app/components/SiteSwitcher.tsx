'use client';

import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Site {
  id: string;
  title: string;
  updatedAt: string;
  businessType: string;
  category: string;
}

interface SiteSwitcherProps {
  currentSiteId: string;
  currentSiteTitle: string;
}

export default function SiteSwitcher({ currentSiteId, currentSiteTitle }: SiteSwitcherProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch user's sites when dropdown opens
  useEffect(() => {
    if (isOpen && sites.length === 0) {
      fetchSites();
    }
  }, [isOpen]);

  const fetchSites = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/user/sites');
      if (res.ok) {
        const { sites: userSites } = await res.json();
        setSites(userSites);
      }
    } catch (err) {
      console.error('Failed to fetch sites:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchSite = (siteId: string) => {
    router.push(`/editor?siteId=${siteId}`);
    setIsOpen(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 text-sm font-semibold rounded-lg transition-colors"
      >
        <span className="truncate max-w-[150px]">{currentSiteTitle}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-lg shadow-lg z-40 max-h-96 overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-slate-50 border-b border-slate-200 px-4 py-3">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Your Sites
              </p>
            </div>

            {/* Sites List */}
            {loading ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-slate-500">Loading sites...</p>
              </div>
            ) : sites.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-slate-500">No sites found</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {sites.map(site => (
                  <button
                    key={site.id}
                    onClick={() => handleSwitchSite(site.id)}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      site.id === currentSiteId
                        ? 'bg-red-50 hover:bg-red-100'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Site Title */}
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {site.title}
                      </p>
                      {site.id === currentSiteId && (
                        <span className="text-xs font-bold bg-red-600 text-white px-2 py-1 rounded">
                          Current
                        </span>
                      )}
                    </div>

                    {/* Site Meta */}
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-500 capitalize">
                        {site.category}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatDate(site.updatedAt)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Create New Site Link */}
            <div className="sticky bottom-0 border-t border-slate-200 bg-slate-50 px-4 py-3">
              <button
                onClick={() => {
                  router.push('/onboarding');
                  setIsOpen(false);
                }}
                className="w-full text-sm font-semibold text-red-600 hover:text-red-700 transition-colors"
              >
                + Create New Site
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
