'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const REGION_OPTIONS = [
  { value: 'all', label: 'All GTA' },
  { value: 'toronto_core', label: 'Toronto core' },
  { value: 'york', label: 'York Region' },
  { value: 'peel', label: 'Peel Region' },
  { value: 'halton', label: 'Halton Region' },
  { value: 'durham', label: 'Durham Region' },
];

// On-demand prospect finder: type a niche, click, and it pulls ~10 fresh
// no-website businesses in that trade right now (no waiting for the cron).
export default function ProspectFinder({
  knownNiches,
  opsBasePath,
}: {
  knownNiches: string[];
  opsBasePath: string;
}) {
  const router = useRouter();
  const [niche, setNiche] = useState('');
  const [region, setRegion] = useState('all');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    const trimmed = niche.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/ops/lead-prospects/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche: trimmed, region }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error ?? 'Search failed');
        return;
      }
      const found = data.new_prospects ?? 0;
      if (found > 0) {
        setMessage(`Found ${found} new ${trimmed}${found === 1 ? '' : 's'} — showing them now.`);
        // Jump to the filtered call list so the new prospects are front and centre.
        const params = new URLSearchParams({ niche: trimmed.toLowerCase() });
        router.push(`${opsBasePath}/leads/discover?${params.toString()}`);
        router.refresh();
      } else if ((data.duplicates ?? 0) > 0) {
        setMessage(`No new ones — the ${trimmed}s we found are already in your list.`);
      } else {
        setMessage(`No no-website ${trimmed}s found in that area right now.`);
      }
    } catch {
      setMessage('Search failed — try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[11px] uppercase tracking-wider text-gray-500 mb-1">
            Find prospects by trade
          </label>
          <input
            type="text"
            list="known-niches"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') run();
            }}
            placeholder="e.g. landscaper, plumber, locksmith…"
            className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
          />
          <datalist id="known-niches">
            {knownNiches.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-gray-500 mb-1">Area</label>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
          >
            {REGION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={run}
          disabled={busy || !niche.trim()}
          className="rounded-md bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
        >
          {busy ? 'Searching…' : 'Find 10'}
        </button>
      </div>
      {message && <p className="mt-2 text-xs text-gray-400">{message}</p>}
    </div>
  );
}
