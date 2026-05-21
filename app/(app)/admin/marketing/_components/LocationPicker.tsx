'use client';

import { useState } from 'react';
import { MapPin, Target, Globe, X } from 'lucide-react';
import type { CampaignTargeting } from '@/lib/marketing/types';

export type LocationMode = 'auto' | 'radius' | 'places';

export interface LocationValue {
  mode: LocationMode;
  /** For 'radius' — street address or postal code. */
  centerAddress?: string;
  /** For 'radius' — kilometres. */
  radiusKm?: number;
  /** For 'places' — list of city/region/country names. */
  places?: string[];
}

export function targetingFromLocationValue(v: LocationValue, fallback?: CampaignTargeting): CampaignTargeting {
  const base = { ...(fallback || {}) };
  delete base.locations;
  delete base.radius;

  if (v.mode === 'radius' && v.centerAddress && v.radiusKm) {
    return {
      ...base,
      locations: [v.centerAddress],
      // lat/lng filled in server-side via geocoding; here we record the user input.
      radius: { lat: 0, lng: 0, radiusKm: v.radiusKm },
    };
  }
  if (v.mode === 'places' && v.places?.length) {
    return { ...base, locations: v.places };
  }
  // 'auto' — leave locations empty; the server will derive from the site's business profile.
  return base;
}

export function locationValueFromTargeting(t: CampaignTargeting | undefined): LocationValue {
  if (!t) return { mode: 'auto' };
  if (t.radius && t.locations?.length) {
    return { mode: 'radius', centerAddress: t.locations[0], radiusKm: t.radius.radiusKm };
  }
  if (t.locations?.length) {
    return { mode: 'places', places: t.locations };
  }
  return { mode: 'auto' };
}

export default function LocationPicker({
  value,
  onChange,
  defaultAddress,
}: {
  value: LocationValue;
  onChange: (v: LocationValue) => void;
  defaultAddress?: string;
}) {
  const [newPlace, setNewPlace] = useState('');

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-sky-600" /> Where should this ad run?
        </h3>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <ModeTab
          active={value.mode === 'auto'}
          onClick={() => onChange({ mode: 'auto' })}
          icon={<Target className="w-3.5 h-3.5" />}
          label="Around my business"
          help="Within 25 km of your address."
        />
        <ModeTab
          active={value.mode === 'radius'}
          onClick={() => onChange({
            mode: 'radius',
            centerAddress: value.centerAddress || defaultAddress || '',
            radiusKm: value.radiusKm || 25,
          })}
          icon={<MapPin className="w-3.5 h-3.5" />}
          label="Radius"
          help="Around an address you pick."
        />
        <ModeTab
          active={value.mode === 'places'}
          onClick={() => onChange({ mode: 'places', places: value.places || [] })}
          icon={<Globe className="w-3.5 h-3.5" />}
          label="Specific places"
          help="Cities, regions, or countries."
        />
      </div>

      {value.mode === 'radius' && (
        <div className="space-y-3 pt-2">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Centre address or postal code</label>
            <input
              type="text"
              value={value.centerAddress || ''}
              placeholder="123 Main St, Toronto, ON M5V 2H1"
              onChange={e => onChange({ ...value, centerAddress: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">
              Radius: <span className="text-slate-900">{value.radiusKm || 25} km</span>
            </label>
            <input
              type="range"
              min="1"
              max="200"
              step="1"
              value={value.radiusKm || 25}
              onChange={e => onChange({ ...value, radiusKm: parseInt(e.target.value) })}
              className="w-full accent-emerald-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
              <span>1 km</span>
              <span>50 km</span>
              <span>100 km</span>
              <span>200 km</span>
            </div>
          </div>
        </div>
      )}

      {value.mode === 'places' && (
        <div className="space-y-2 pt-2">
          <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Locations</label>
          <div className="flex flex-wrap gap-1.5">
            {(value.places || []).map(p => (
              <span key={p} className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-sm">
                {p}
                <button
                  type="button"
                  onClick={() => onChange({ ...value, places: (value.places || []).filter(x => x !== p) })}
                  className="text-slate-400 hover:text-red-600"
                  aria-label={`Remove ${p}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newPlace}
              onChange={e => setNewPlace(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && newPlace.trim()) {
                  e.preventDefault();
                  const next = Array.from(new Set([...(value.places || []), newPlace.trim()]));
                  onChange({ ...value, places: next });
                  setNewPlace('');
                }
              }}
              placeholder="e.g. Toronto, Ontario, Canada"
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={() => {
                if (!newPlace.trim()) return;
                const next = Array.from(new Set([...(value.places || []), newPlace.trim()]));
                onChange({ ...value, places: next });
                setNewPlace('');
              }}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-bold"
            >
              Add
            </button>
          </div>
          <p className="text-xs text-slate-400">Press Enter to add. Use any combination of cities, regions, provinces, or countries.</p>
        </div>
      )}

      {value.mode === 'auto' && (
        <p className="text-xs text-slate-500 pt-1">
          {defaultAddress
            ? <>Using <strong>{defaultAddress}</strong> with a 25 km radius.</>
            : <>No business address on file — add one in your site settings, or switch to <em>Radius</em> mode.</>}
        </p>
      )}
    </div>
  );
}

function ModeTab({ active, onClick, icon, label, help }: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  help: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left px-3 py-2.5 rounded-lg border transition-colors ${
        active
          ? 'border-emerald-500 bg-emerald-50'
          : 'border-slate-200 hover:border-slate-300 bg-white'
      }`}
    >
      <div className={`flex items-center gap-1.5 text-sm font-bold ${active ? 'text-emerald-900' : 'text-slate-900'}`}>
        {icon} {label}
      </div>
      <p className={`text-[11px] mt-0.5 ${active ? 'text-emerald-700' : 'text-slate-500'}`}>{help}</p>
    </button>
  );
}
