'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LEAD_REGIONS,
  LEAD_REGION_LABELS,
  LEAD_REGION_CITIES,
  COMMON_LEAD_NICHES,
  type LeadRegion,
} from '@/lib/leads/regions';

interface RunResult {
  niche: string;
  city: string;
  inserted: number;
  duplicates: number;
  scanned: number;
  error: string | null;
  tooNarrow: boolean;
}

export default function RunDiscovery() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [niche, setNiche] = useState('');
  const [region, setRegion] = useState<LeadRegion>('toronto_core');
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [customCities, setCustomCities] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ inserted: number; duplicates: number; results: RunResult[] } | null>(null);

  const regionCities = LEAD_REGION_CITIES[region];

  function toggleCity(city: string) {
    setSelectedCities((prev) =>
      prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city],
    );
  }

  function selectAll() {
    setSelectedCities((prev) =>
      regionCities.every((c) => prev.includes(c))
        ? prev.filter((c) => !regionCities.includes(c))
        : Array.from(new Set([...prev, ...regionCities])),
    );
  }

  async function run() {
    setError(null);
    setSummary(null);

    const cities = Array.from(
      new Set([
        ...selectedCities,
        ...customCities.split(',').map((c) => c.trim()).filter(Boolean),
      ]),
    );

    if (!niche.trim()) {
      setError('Enter a niche to search for.');
      return;
    }
    if (cities.length === 0) {
      setError('Pick at least one city (or type a custom one).');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/ops/lead-prospects/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche: niche.trim(), region, cities }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Discovery failed.');
        return;
      }
      setSummary({
        inserted: data.totals?.inserted ?? 0,
        duplicates: data.totals?.duplicates ?? 0,
        results: data.results ?? [],
      });
      router.refresh();
    } catch {
      setError('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition-colors"
      >
        Run prospect finder
      </button>
    );
  }

  const allSelected = regionCities.every((c) => selectedCities.includes(c));

  return (
    <div className="w-full rounded-lg border border-gray-700 bg-gray-900 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Run prospect finder</h2>
        <button
          onClick={() => setOpen(false)}
          className="text-gray-500 hover:text-white text-sm"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      <p className="text-xs text-gray-500">
        Search Google Places now for a niche across the cities you pick. New prospects join the
        normal audit pipeline. Discovery skips the top-ranked page 1 (businesses already doing well)
        and keeps the lower-ranked results who actually need a site.
      </p>

      {/* Niche */}
      <div>
        <label className="block text-[11px] uppercase tracking-wider text-gray-500 mb-1">Niche</label>
        <input
          type="text"
          list="discovery-niches"
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          placeholder="e.g. plumber, hvac contractor, dentist…"
          className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
        />
        <datalist id="discovery-niches">
          {COMMON_LEAD_NICHES.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </div>

      {/* Region */}
      <div>
        <label className="block text-[11px] uppercase tracking-wider text-gray-500 mb-1">Region</label>
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value as LeadRegion)}
          className="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
        >
          {LEAD_REGIONS.map((r) => (
            <option key={r} value={r}>
              {LEAD_REGION_LABELS[r]}
            </option>
          ))}
        </select>
      </div>

      {/* Cities */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[11px] uppercase tracking-wider text-gray-500">Cities</label>
          <button
            type="button"
            onClick={selectAll}
            className="text-[11px] text-emerald-400 hover:text-emerald-300"
          >
            {allSelected ? 'Clear all' : 'Select all'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {regionCities.map((city) => {
            const active = selectedCities.includes(city);
            return (
              <button
                key={city}
                type="button"
                onClick={() => toggleCity(city)}
                className={`rounded-full px-3 py-1 text-xs transition-colors border ${
                  active
                    ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/30'
                    : 'bg-gray-950 text-gray-400 border-gray-800 hover:text-white'
                }`}
              >
                {city}
              </button>
            );
          })}
        </div>
        <input
          type="text"
          value={customCities}
          onChange={(e) => setCustomCities(e.target.value)}
          placeholder="Other cities (comma-separated)…"
          className="mt-2 w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
        />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {summary && (
        <div className="rounded-md border border-gray-800 bg-gray-950 p-3 text-xs text-gray-300 space-y-1">
          <p className="text-emerald-400 font-medium">
            +{summary.inserted} new prospect{summary.inserted === 1 ? '' : 's'} · {summary.duplicates} already known
          </p>
          <ul className="space-y-0.5">
            {summary.results.map((r) => (
              <li key={r.city} className="text-gray-500">
                {r.city}: {r.error ? <span className="text-red-400">{r.error}</span> : r.tooNarrow ? 'too few results' : `+${r.inserted} new, ${r.duplicates} dupes`}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={run}
          disabled={busy}
          className="rounded-md bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
        >
          {busy ? 'Searching…' : 'Find prospects'}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-md bg-gray-800 hover:bg-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
