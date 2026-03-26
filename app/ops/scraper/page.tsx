'use client';

import { useState, useRef } from 'react';
import { Globe, Loader2, Download, AlertCircle, ChevronDown } from 'lucide-react';

type ScraperType = 'services' | 'products' | 'content';

const TYPE_OPTIONS: { value: ScraperType; label: string; available: boolean }[] = [
  { value: 'services', label: 'Services', available: true },
  { value: 'products', label: 'Products', available: false },
  { value: 'content', label: 'Content', available: false },
];

export default function ScraperPage() {
  const [scraperType, setScraperType] = useState<ScraperType>('services');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [csv, setCsv] = useState<string | null>(null);
  const [rows, setRows] = useState<string[][]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleGo = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setCsv(null);
    setRows([]);

    try {
      const res = await fetch('/api/ops/scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), type: scraperType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Scraper failed.');
        return;
      }
      const csvString: string = data.csv;
      setCsv(csvString);

      // Parse CSV for preview
      const lines = csvString.trim().split('\n');
      const parsed = lines.map(line => parseCsvLine(line));
      setRows(parsed);
    } catch (e: any) {
      setError(e.message || 'Unexpected error.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!csv) return;
    const blob = new Blob([csv], { type: 'text/csv' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `keystone-${scraperType}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(href);
  };

  const headers = rows[0] || [];
  const dataRows = rows.slice(1);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Scraper</h1>
        <p className="text-gray-400 text-sm mt-1">
          Paste a website URL and extract structured data as a CSV ready to import into Keystone.
        </p>
      </div>

      {/* Form */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-4">
        {/* Type selector */}
        <div>
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
            Data type
          </label>
          <div className="flex gap-2 flex-wrap">
            {TYPE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => opt.available && setScraperType(opt.value)}
                disabled={!opt.available}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  scraperType === opt.value && opt.available
                    ? 'bg-emerald-600 border-emerald-500 text-white'
                    : opt.available
                    ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-900 border-gray-700 text-gray-600 cursor-not-allowed'
                }`}
              >
                {opt.label}
                {!opt.available && (
                  <span className="ml-2 text-[10px] font-bold text-gray-600 uppercase">soon</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* URL input + button */}
        <div>
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
            Website URL
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                ref={inputRef}
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleGo(); }}
                placeholder="https://example.com/services"
                className="w-full pl-9 pr-3 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={handleGo}
              disabled={loading || !url.trim()}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Go
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 flex items-start gap-3 bg-red-900/30 border border-red-700 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Results */}
      {rows.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-white font-semibold">{dataRows.length} row{dataRows.length !== 1 ? 's' : ''} extracted</span>
              <span className="text-gray-400 text-sm ml-2">— ready to import</span>
            </div>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Download CSV
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-800 border-b border-gray-700">
                <tr>
                  {headers.map((h, i) => (
                    <th key={i} className="px-4 py-2.5 text-left text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-gray-900 divide-y divide-gray-800">
                {dataRows.map((row, ri) => (
                  <tr key={ri} className="hover:bg-gray-800/50 transition-colors">
                    {headers.map((_, ci) => (
                      <td key={ci} className="px-4 py-2.5 text-gray-300 max-w-xs truncate" title={row[ci] ?? ''}>
                        {row[ci] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-500 mt-3">
            Download the CSV then use the <strong className="text-gray-400">Import CSV</strong> button in Admin → Booking → Services.
          </p>
        </div>
      )}
    </div>
  );
}

/** Minimal CSV line parser that handles quoted fields */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
