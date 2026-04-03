'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, FileJson, Globe, Loader2, Sparkles } from 'lucide-react';

type ScraperType = 'products' | 'services' | 'content' | 'other';

interface ScraperResult {
  preset: ScraperType;
  provider: string;
  providerLabel: string;
  csv: string;
  filename: string;
  rawJson: string;
  warnings: string[];
  summary: {
    discoveredPages: number;
    productsExtracted: number;
    csvRows: number;
    failedPages: number;
    skippedProducts: number;
  };
  previewRows: string[][];
  metadata: {
    sourceUrl: string;
    strategy: string;
  };
}

const TYPE_OPTIONS: { value: ScraperType; label: string; available: boolean; description: string }[] = [
  {
    value: 'products',
    label: 'Products',
    available: true,
    description: 'Scrape store catalogs into a normalized CSV with product, price, image, and variant fields.',
  },
  {
    value: 'services',
    label: 'Services',
    available: true,
    description: 'Extract service menus, pricing, and durations from public pages.',
  },
  {
    value: 'content',
    label: 'Content',
    available: false,
    description: 'Future preset for general site content and reusable page copy.',
  },
  {
    value: 'other',
    label: 'Other',
    available: false,
    description: 'Reserved for future workflows like team, FAQ, and blog migration.',
  },
];

const PRODUCT_PROGRESS_STEPS = [
  'Detecting provider',
  'Discovering product pages',
  'Scraping products',
  'Normalizing data',
  'Generating CSV',
];

const SERVICE_PROGRESS_STEPS = [
  'Fetching page',
  'Extracting service content',
  'Generating CSV',
];

function downloadBlob(filename: string, text: string, contentType: string) {
  const blob = new Blob([text], { type: contentType });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function ScraperPage() {
  const [scraperType, setScraperType] = useState<ScraperType>('products');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScraperResult | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  const selectedPreset = TYPE_OPTIONS.find((option) => option.value === scraperType) ?? TYPE_OPTIONS[0];
  const progressSteps = useMemo(
    () => (scraperType === 'products' ? PRODUCT_PROGRESS_STEPS : SERVICE_PROGRESS_STEPS),
    [scraperType]
  );
  const canSubmit = selectedPreset.available && isValidHttpUrl(url.trim()) && !loading;

  useEffect(() => {
    if (!loading) return;

    setActiveStep(0);
    const interval = window.setInterval(() => {
      setActiveStep((current) => Math.min(current + 1, progressSteps.length - 1));
    }, 1400);

    return () => window.clearInterval(interval);
  }, [loading, progressSteps]);

  async function handleScrape() {
    if (!canSubmit) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/ops/scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), type: scraperType }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Scraper failed.');
        return;
      }

      setActiveStep(progressSteps.length - 1);
      setResult(data as ScraperResult);
    } catch (scrapeError: unknown) {
      setError(scrapeError instanceof Error ? scrapeError.message : 'Unexpected error.');
    } finally {
      setLoading(false);
    }
  }

  const previewHeaders = result?.previewRows?.[0] ?? [];
  const previewData = result?.previewRows?.slice(1) ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
          <Sparkles className="h-3.5 w-3.5" />
          Ops Scraper
        </div>
        <h1 className="mt-4 text-3xl font-bold text-white">Scraper workflows</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-400">
          Scrape public storefronts and service pages into a stable CSV shape for KeystoneWeb migration work.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-gray-800 bg-gray-900/80 p-6 shadow-2xl shadow-black/20">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
              What are you scraping?
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {TYPE_OPTIONS.map((option) => {
                const isSelected = option.value === scraperType;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => option.available && setScraperType(option.value)}
                    disabled={!option.available}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : option.available
                          ? 'border-gray-700 bg-gray-950 hover:border-gray-600'
                          : 'cursor-not-allowed border-gray-800 bg-gray-950/60 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-gray-200'}`}>{option.label}</span>
                      {!option.available && (
                        <span className="rounded-full border border-gray-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                          Soon
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-gray-400">{option.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
              Store or page URL
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleScrape();
                  }}
                  placeholder={scraperType === 'products' ? 'https://example.com/shop' : 'https://example.com/services'}
                  className="w-full rounded-xl border border-gray-700 bg-gray-950 py-3 pl-10 pr-4 text-sm text-white placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={handleScrape}
                disabled={!canSubmit}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Scrape
              </button>
            </div>
            {!selectedPreset.available && (
              <p className="mt-2 text-xs text-amber-400">This preset is not enabled yet.</p>
            )}
            {!loading && url.trim() && !isValidHttpUrl(url.trim()) && (
              <p className="mt-2 text-xs text-red-400">Enter a full `http://` or `https://` URL.</p>
            )}
          </div>

          {loading && (
            <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="text-sm font-semibold text-white">Running {selectedPreset.label.toLowerCase()} workflow</p>
              <div className="mt-4 space-y-3">
                {progressSteps.map((step, index) => {
                  const complete = index < activeStep;
                  const current = index === activeStep;
                  return (
                    <div key={step} className="flex items-center gap-3">
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs ${
                          complete
                            ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
                            : current
                              ? 'border-emerald-400 text-emerald-300'
                              : 'border-gray-700 text-gray-500'
                        }`}
                      >
                        {complete ? <CheckCircle2 className="h-3.5 w-3.5" /> : current ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : index + 1}
                      </div>
                      <span className={`${current || complete ? 'text-gray-200' : 'text-gray-500'} text-sm`}>{step}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-700 bg-red-950/30 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}
        </section>

        <aside className="rounded-2xl border border-gray-800 bg-gray-900/80 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-400">Current preset</h2>
          <p className="mt-3 text-lg font-semibold text-white">{selectedPreset.label}</p>
          <p className="mt-2 text-sm leading-6 text-gray-400">{selectedPreset.description}</p>
          <div className="mt-6 rounded-xl border border-gray-800 bg-gray-950/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Expected output</p>
            <ul className="mt-3 space-y-2 text-sm text-gray-300">
              <li>Stable CSV schema across supported providers</li>
              <li>Warnings when pages fail or structure is weak</li>
              <li>Preview rows before download</li>
              <li>Raw JSON debug export for inspection</li>
            </ul>
          </div>
        </aside>
      </div>

      {result && (
        <section className="mt-8 space-y-6">
          <div className="rounded-2xl border border-gray-800 bg-gray-900/80 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Scrape complete</p>
                <h2 className="mt-2 text-2xl font-bold text-white">{result.providerLabel}</h2>
                <p className="mt-2 text-sm text-gray-400">
                  Source: <span className="text-gray-200">{result.metadata.sourceUrl}</span>
                </p>
                <p className="mt-1 text-sm text-gray-500">Strategy: {result.metadata.strategy}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => downloadBlob(result.filename, result.csv, 'text/csv')}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/20"
                >
                  <Download className="h-4 w-4" />
                  Download CSV
                </button>
                <button
                  type="button"
                  onClick={() => downloadBlob(result.filename.replace(/\.csv$/, '.json'), result.rawJson, 'application/json')}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-950 px-4 py-2.5 text-sm font-semibold text-gray-200 transition-colors hover:border-gray-600"
                >
                  <FileJson className="h-4 w-4" />
                  Raw JSON
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Pages found</p>
                <p className="mt-2 text-2xl font-bold text-white">{result.summary.discoveredPages}</p>
              </div>
              <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500">
                  {result.preset === 'services' ? 'Services extracted' : 'Products extracted'}
                </p>
                <p className="mt-2 text-2xl font-bold text-white">{result.summary.productsExtracted}</p>
              </div>
              <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500">CSV rows</p>
                <p className="mt-2 text-2xl font-bold text-white">{result.summary.csvRows}</p>
              </div>
              <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Failed pages</p>
                <p className="mt-2 text-2xl font-bold text-white">{result.summary.failedPages}</p>
              </div>
              <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Skipped / deduped</p>
                <p className="mt-2 text-2xl font-bold text-white">{result.summary.skippedProducts}</p>
              </div>
            </div>

            {result.warnings.length > 0 && (
              <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                <p className="text-sm font-semibold text-amber-200">Warnings</p>
                <ul className="mt-3 space-y-2 text-sm text-amber-100">
                  {result.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {previewHeaders.length > 0 && (
            <div className="rounded-2xl border border-gray-800 bg-gray-900/80 p-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">Preview</h3>
                  <p className="mt-1 text-sm text-gray-400">Showing the first {previewData.length} row{previewData.length === 1 ? '' : 's'} of the generated CSV.</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-800">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-950">
                    <tr>
                      {previewHeaders.map((header) => (
                        <th
                          key={header}
                          className="whitespace-nowrap border-b border-gray-800 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800 bg-gray-900">
                    {previewData.map((row, rowIndex) => (
                      <tr key={`${rowIndex}-${row[0] || 'row'}`} className="align-top">
                        {previewHeaders.map((_, cellIndex) => (
                          <td key={`${rowIndex}-${cellIndex}`} className="max-w-xs px-4 py-3 text-gray-200">
                            <div className="line-clamp-3 whitespace-pre-wrap break-words">{row[cellIndex] ?? ''}</div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
