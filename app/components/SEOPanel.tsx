'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, Phone, CheckCircle, AlertCircle, Loader2, PlusCircle } from 'lucide-react';

export interface BusinessProfile {
  legalName: string;
  streetAddress: string;
  addressLocality: string;
  addressRegion: string;
  postalCode: string;
  addressCountry: string;
  telephone: string;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  verifiedAt: string | null;
}

interface PlaceCandidate {
  placeId: string;
  name: string;
  formattedAddress: string;
  latitude: number | null;
  longitude: number | null;
  telephone?: string | null;
  streetNumber?: string;
  route?: string;
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
  addressCountry?: string;
}

interface SEOPanelProps {
  siteId?: string;
}

const EMPTY_PROFILE: BusinessProfile = {
  legalName: '',
  streetAddress: '',
  addressLocality: '',
  addressRegion: '',
  postalCode: '',
  addressCountry: 'CA',
  telephone: '',
  latitude: null,
  longitude: null,
  placeId: null,
  verifiedAt: null,
};

export default function SEOPanel({ siteId }: SEOPanelProps) {
  const [mode, setMode] = useState<'idle' | 'search' | 'manual'>('idle');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlaceCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [profile, setProfile] = useState<BusinessProfile>(EMPTY_PROFILE);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [loadingProfile, setLoadingProfile] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load existing profile on mount
  useEffect(() => {
    if (!siteId) return;
    setLoadingProfile(true);
    fetch(`/api/seo/business-profile?siteId=${siteId}`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.businessProfile) {
          setProfile(data.businessProfile);
          // If there's already a profile, show the manual form pre-filled
          setMode('manual');
        }
      })
      .catch(() => { })
      .finally(() => setLoadingProfile(false));
  }, [siteId]);

  // Debounced Places search
  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/seo/places?query=${encodeURIComponent(q)}`, { credentials: 'include' });
      if (res.ok) {
        const { places } = await res.json();
        setSearchResults(places || []);
      }
    } catch {
      // silently ignore
    } finally {
      setSearching(false);
    }
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => runSearch(value), 400);
  };

  const handleSelectPlace = (place: PlaceCandidate) => {
    const streetAddress = [place.streetNumber, place.route].filter(Boolean).join(' ') || place.formattedAddress.split(',')[0];
    setProfile({
      legalName: place.name,
      streetAddress,
      addressLocality: place.addressLocality || '',
      addressRegion: place.addressRegion || '',
      postalCode: place.postalCode || '',
      addressCountry: place.addressCountry || 'CA',
      telephone: place.telephone || '',
      latitude: place.latitude,
      longitude: place.longitude,
      placeId: place.placeId,
      verifiedAt: new Date().toISOString(),
    });
    setSearchResults([]);
    setQuery('');
    setMode('manual');
  };

  const handleFieldChange = (field: keyof BusinessProfile, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!siteId) return;
    setSaving(true);
    setSaveStatus('idle');
    try {
      const res = await fetch('/api/seo/business-profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, businessProfile: profile }),
      });
      if (res.ok) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 4000);
      } else {
        setSaveStatus('error');
      }
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  if (loadingProfile) {
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
        Add your business location to unlock <span className="font-semibold text-slate-800">Google Knowledge Panels</span>, Rich Snippets, and Local Map Pack visibility.
      </div>

      {/* Mode: idle — show action buttons */}
      {mode === 'idle' && (
        <div className="space-y-2">
          <button
            onClick={() => setMode('search')}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-white border border-slate-200 rounded-lg hover:border-red-400 hover:bg-red-50 transition-all text-sm font-medium text-slate-800"
          >
            <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
            Sync Business Profile
          </button>
          <button
            onClick={() => setMode('manual')}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-white border border-slate-200 rounded-lg hover:border-slate-400 hover:bg-slate-50 transition-all text-sm text-slate-500"
          >
            <PlusCircle className="w-4 h-4 flex-shrink-0" />
            Add manually
          </button>
        </div>
      )}

      {/* Mode: search — Google Places search */}
      {mode === 'search' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search your business name..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-red-400 focus:ring-1 focus:ring-red-400 focus:outline-none"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 animate-spin" />
            )}
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100 shadow-sm">
              {searchResults.map((place) => (
                <button
                  key={place.placeId}
                  onClick={() => handleSelectPlace(place)}
                  className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors"
                >
                  <div className="text-sm font-semibold text-slate-800 truncate">{place.name}</div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5">{place.formattedAddress}</div>
                </button>
              ))}
            </div>
          )}

          {/* Fallback to manual */}
          <button
            onClick={() => setMode('manual')}
            className="text-xs text-slate-500 hover:text-slate-700 underline underline-offset-2"
          >
            Not listed? Add manually
          </button>
        </div>
      )}

      {/* Mode: manual — edit form */}
      {mode === 'manual' && (
        <div className="space-y-3">
          {/* Back to search */}
          {profile.placeId && (
            <div className="flex items-center gap-1.5 text-[11px] text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Synced from Google Places</span>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wide mb-1">Business Name</label>
            <input
              type="text"
              value={profile.legalName}
              onChange={(e) => handleFieldChange('legalName', e.target.value)}
              placeholder="Acme Plumbing Ltd."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-red-400 focus:ring-1 focus:ring-red-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wide mb-1">Street Address</label>
            <input
              type="text"
              value={profile.streetAddress}
              onChange={(e) => handleFieldChange('streetAddress', e.target.value)}
              placeholder="123 Main Street"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-red-400 focus:ring-1 focus:ring-red-400 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wide mb-1">City</label>
              <input
                type="text"
                value={profile.addressLocality}
                onChange={(e) => handleFieldChange('addressLocality', e.target.value)}
                placeholder="Toronto"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-red-400 focus:ring-1 focus:ring-red-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wide mb-1">Province</label>
              <input
                type="text"
                value={profile.addressRegion}
                onChange={(e) => handleFieldChange('addressRegion', e.target.value)}
                placeholder="ON"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-red-400 focus:ring-1 focus:ring-red-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wide mb-1">Postal Code</label>
              <input
                type="text"
                value={profile.postalCode}
                onChange={(e) => handleFieldChange('postalCode', e.target.value)}
                placeholder="M5A 1A1"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-red-400 focus:ring-1 focus:ring-red-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wide mb-1">Country</label>
              <input
                type="text"
                value={profile.addressCountry}
                onChange={(e) => handleFieldChange('addressCountry', e.target.value)}
                placeholder="CA"
                maxLength={2}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-red-400 focus:ring-1 focus:ring-red-400 focus:outline-none uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wide mb-1">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="tel"
                value={profile.telephone}
                onChange={(e) => handleFieldChange('telephone', e.target.value)}
                placeholder="+1 416-555-0123"
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-red-400 focus:ring-1 focus:ring-red-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Search again */}
          <button
            onClick={() => { setMode('search'); setSearchResults([]); }}
            className="text-xs text-slate-500 hover:text-slate-700 underline underline-offset-2"
          >
            Search Google Places instead
          </button>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving || !siteId || !profile.legalName.trim()}
            className="w-full py-2.5 text-white font-bold text-sm rounded-lg transition-all hover:brightness-110 disabled:opacity-50"
            style={{ backgroundColor: 'var(--brand-primary)' }}
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Saving...
              </span>
            ) : 'Save'}
          </button>

          {/* Save status */}
          {saveStatus === 'success' && (
            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
              Address Verified. Google Local SEO applied.
            </div>
          )}
          {saveStatus === 'error' && (
            <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              Failed to save. Please try again.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
