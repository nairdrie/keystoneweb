'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Download, FileJson, Globe, Loader2, Sparkles } from 'lucide-react';
import { CONTENT_NORMALIZATION_MODELS } from '@/lib/ops/scraper/models';
import type { ContentNormalizationModel, ContentScraperPreview, ScraperMode, ScraperResult } from '@/lib/ops/scraper/types';

type ScraperType = 'products' | 'services' | 'content' | 'other';

const TYPE_OPTIONS = [
  { value: 'products' as const, label: 'Products', available: true, description: 'Scrape store catalogs into a normalized CSV with product, price, image, and variant fields.' },
  { value: 'services' as const, label: 'Services', available: true, description: 'Extract service menus, pricing, and durations from public pages.' },
  { value: 'content' as const, label: 'Content', available: true, description: 'Scrape full websites into reusable builder-ready content for KeystoneWeb migration.' },
  { value: 'other' as const, label: 'Other', available: false, description: 'Reserved for future workflows like team, FAQ, and blog migration.' },
];

const MODE_OPTIONS: Array<{ value: ScraperMode; label: string; description: string }> = [
  { value: 'fast', label: 'Fast', description: 'Deterministic extraction only. Lowest recurring cost.' },
  { value: 'standard', label: 'Standard', description: 'Deterministic extraction plus light normalization for low-confidence pages.' },
  { value: 'deep', label: 'Deep', description: 'Higher crawl limits and fallback normalization for important migrations.' },
];

const PRODUCT_PROGRESS_STEPS = ['Detecting provider', 'Discovering product pages', 'Scraping products', 'Normalizing data', 'Generating CSV'];
const SERVICE_PROGRESS_STEPS = ['Fetching page', 'Extracting service content', 'Generating CSV'];
const CONTENT_PROGRESS_STEPS: Record<ScraperMode, string[]> = {
  fast: ['Discovering pages', 'Extracting reusable sections', 'Mapping to builder blocks', 'Packing export'],
  standard: ['Discovering pages', 'Extracting reusable sections', 'Normalizing low-confidence pages', 'Packing export'],
  deep: ['Discovering pages', 'Crawling deeper pages', 'Normalizing low-confidence pages', 'Packing export'],
};

const CONTENT_AI_ONLY_PROGRESS_STEPS: Record<ScraperMode, string[]> = {
  fast: ['Discovering pages', 'Rendering full page HTML', 'Mapping every page with AI', 'Packing export'],
  standard: ['Discovering pages', 'Rendering full page HTML', 'Mapping every page with AI', 'Packing export'],
  deep: ['Discovering pages', 'Crawling deeper pages', 'Mapping every page with AI', 'Packing export'],
};

function downloadBlob(filename: string, text: string, contentType: string) {
  const blob = new Blob([text], { type: contentType });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

function downloadBase64Blob(filename: string, base64: string, contentType: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: contentType });
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

function getCompatibilityClasses(status: string) {
  if (status === 'supported') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200';
  if (status === 'approximated') return 'border-amber-500/40 bg-amber-500/10 text-amber-200';
  return 'border-red-500/40 bg-red-500/10 text-red-200';
}

export default function ScraperPage() {
  const router = useRouter();
  const [scraperType, setScraperType] = useState<ScraperType>('products');
  const [mode, setMode] = useState<ScraperMode>('standard');
  const [llmModel, setLlmModel] = useState<ContentNormalizationModel>('auto');
  const [includeBlog, setIncludeBlog] = useState(false);
  const [aiOnly, setAiOnly] = useState(false);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [buildingSite, setBuildingSite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScraperResult | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  const selectedPreset = TYPE_OPTIONS.find((option) => option.value === scraperType) ?? TYPE_OPTIONS[0];
  const progressSteps = useMemo(
    () => scraperType === 'products'
      ? PRODUCT_PROGRESS_STEPS
      : scraperType === 'services'
        ? SERVICE_PROGRESS_STEPS
        : aiOnly
          ? CONTENT_AI_ONLY_PROGRESS_STEPS[mode]
          : CONTENT_PROGRESS_STEPS[mode],
    [aiOnly, mode, scraperType]
  );
  const canSubmit = selectedPreset.available && isValidHttpUrl(url.trim()) && !loading;
  const contentPreview = (result?.contentData || null) as ContentScraperPreview | null;
  const previewHeaders = result?.previewRows?.[0] ?? [];
  const previewData = result?.previewRows?.slice(1) ?? [];

  useEffect(() => {
    if (!loading) return;
    setActiveStep(0);
    const interval = window.setInterval(() => setActiveStep((current: number) => Math.min(current + 1, progressSteps.length - 1)), 1400);
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
        body: JSON.stringify({ url: url.trim(), type: scraperType, ...(scraperType === 'content' ? { mode, includeBlog, llmModel, aiOnly } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Scraper failed.');
        return;
      }
      setActiveStep(progressSteps.length - 1);
      setResult(data);
    } catch (scrapeError: unknown) {
      setError(scrapeError instanceof Error ? scrapeError.message : 'Unexpected error.');
    } finally {
      setLoading(false);
    }
  }

  async function handleBuildSite() {
    if (!result?.builderImport || result.preset !== 'content' || buildingSite) return;

    setBuildingSite(true);
    setError(null);
    try {
      const response = await fetch('/api/ops/scraper/build-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ builderImport: result.builderImport }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to build draft site.');
        return;
      }
      router.push(data.editorUrl || `/editor?siteId=${data.siteId}`);
    } catch (buildError: unknown) {
      setError(buildError instanceof Error ? buildError.message : 'Failed to build draft site.');
    } finally {
      setBuildingSite(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
          <Sparkles className="h-3.5 w-3.5" />
          Ops Scraper
        </div>
        <h1 className="mt-4 text-3xl font-bold text-white">Scraper workflows</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-400">Scrape public storefronts, service pages, and full websites into migration-ready outputs that Keystone agents can reuse.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-gray-800 bg-gray-900/80 p-6 shadow-2xl shadow-black/20">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">What are you scraping?</label>
          <div className="grid gap-3 sm:grid-cols-2">
            {TYPE_OPTIONS.map((option) => {
              const isSelected = option.value === scraperType;
              return (
                <button key={option.value} type="button" onClick={() => option.available && setScraperType(option.value)} disabled={!option.available} className={`rounded-xl border p-4 text-left transition-colors ${isSelected ? 'border-emerald-500 bg-emerald-500/10' : option.available ? 'border-gray-700 bg-gray-950 hover:border-gray-600' : 'cursor-not-allowed border-gray-800 bg-gray-950/60 opacity-60'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-gray-200'}`}>{option.label}</span>
                    {!option.available && <span className="rounded-full border border-gray-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Soon</span>}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-gray-400">{option.description}</p>
                </button>
              );
            })}
          </div>

          {scraperType === 'content' && (
            <div className="mt-6 space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                {MODE_OPTIONS.map((option) => (
                  <button key={option.value} type="button" onClick={() => setMode(option.value)} className={`rounded-xl border p-3 text-left transition-colors ${option.value === mode ? 'border-emerald-500 bg-emerald-500/10' : 'border-gray-700 bg-gray-950 hover:border-gray-600'}`}>
                    <p className={`text-sm font-semibold ${option.value === mode ? 'text-white' : 'text-gray-200'}`}>{option.label}</p>
                    <p className="mt-1 text-xs leading-5 text-gray-400">{option.description}</p>
                  </button>
                ))}
              </div>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Normalization model</span>
                <select
                  value={llmModel}
                  onChange={(event) => setLlmModel(event.target.value as ContentNormalizationModel)}
                  className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none"
                >
                  {CONTENT_NORMALIZATION_MODELS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} {option.value === 'auto' ? '' : `(${option.value})`}
                    </option>
                  ))}
                </select>
                <span className="mt-2 block text-xs text-gray-500">
                  {aiOnly
                    ? 'AI-only mapping sends every discovered page through the selected model and disables heuristic block fallback.'
                    : 'Used only for low-confidence page normalization. Fast mode will usually skip LLM use even when a model is selected.'}
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-xl border border-gray-800 bg-gray-950/70 p-4 text-sm text-gray-300">
                <input type="checkbox" checked={aiOnly} onChange={(event) => setAiOnly(event.target.checked)} className="mt-1 h-4 w-4 rounded border-gray-700 bg-gray-900 text-emerald-500 focus:ring-emerald-500" />
                <span>
                  AI-only mapping
                  <span className="mt-1 block text-xs text-gray-500">Use 100% model-generated builder block mapping from the full rendered HTML. No heuristic block fallback will be used if the model fails or is unavailable.</span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-xl border border-gray-800 bg-gray-950/70 p-4 text-sm text-gray-300">
                <input type="checkbox" checked={includeBlog} onChange={(event) => setIncludeBlog(event.target.checked)} className="mt-1 h-4 w-4 rounded border-gray-700 bg-gray-900 text-emerald-500 focus:ring-emerald-500" />
                <span>
                  Include blog / news pages
                  <span className="mt-1 block text-xs text-gray-500">Disabled by default so archives and post libraries do not inflate recurring crawl and normalization cost.</span>
                </span>
              </label>
            </div>
          )}

          <div className="mt-6">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">{scraperType === 'content' ? 'Website URL' : 'Store or page URL'}</label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input type="url" value={url} onChange={(event) => setUrl(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') handleScrape(); }} placeholder={scraperType === 'products' ? 'https://example.com/shop' : scraperType === 'services' ? 'https://example.com/services' : 'https://example.com'} className="w-full rounded-xl border border-gray-700 bg-gray-950 py-3 pl-10 pr-4 text-sm text-white placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none" />
              </div>
              <button type="button" onClick={handleScrape} disabled={!canSubmit} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Scrape
              </button>
            </div>
            {!selectedPreset.available && <p className="mt-2 text-xs text-amber-400">This preset is not enabled yet.</p>}
            {!loading && url.trim() && !isValidHttpUrl(url.trim()) && <p className="mt-2 text-xs text-red-400">Enter a full `http://` or `https://` URL.</p>}
          </div>

          {loading && <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4"><p className="text-sm font-semibold text-white">Running {selectedPreset.label.toLowerCase()} workflow</p><div className="mt-4 space-y-3">{progressSteps.map((step, index) => { const complete = index < activeStep; const current = index === activeStep; return <div key={step} className="flex items-center gap-3"><div className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs ${complete ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300' : current ? 'border-emerald-400 text-emerald-300' : 'border-gray-700 text-gray-500'}`}>{complete ? <CheckCircle2 className="h-3.5 w-3.5" /> : current ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : index + 1}</div><span className={`${current || complete ? 'text-gray-200' : 'text-gray-500'} text-sm`}>{step}</span></div>; })}</div></div>}
          {error && <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-700 bg-red-950/30 p-4"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" /><p className="text-sm text-red-200">{error}</p></div>}
        </section>

        <aside className="rounded-2xl border border-gray-800 bg-gray-900/80 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-400">{scraperType === 'content' ? 'Current Preset: Content' : `Current Preset: ${selectedPreset.label}`}</h2>
          <p className="mt-3 text-sm leading-6 text-gray-400">{scraperType === 'content' ? 'Crawl public pages and convert site copy, structure, SEO, media references, and reusable sections into Keystone builder-compatible export files.' : selectedPreset.description}</p>
          <div className="mt-6 rounded-xl border border-gray-800 bg-gray-950/70 p-4"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Expected output</p><ul className="mt-3 space-y-2 text-sm text-gray-300">{(scraperType === 'content' ? ['Builder-ready page files', 'Navigation and global content', 'SEO metadata', 'Media manifest', 'Warnings and confidence flags', 'Downloadable ZIP export', 'Raw debug JSON'] : ['Stable CSV schema across supported providers', 'Warnings when pages fail or structure is weak', 'Preview rows before download', 'Raw JSON debug export for inspection']).map((item) => <li key={item}>{item}</li>)}</ul></div>
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
                {typeof result.metadata.aiOnly === 'boolean' ? <p className="mt-1 text-sm text-gray-500">AI-only mapping: {result.metadata.aiOnly ? 'Yes' : 'No'}</p> : null}
                {result.metadata.normalizationModel ? <p className="mt-1 text-sm text-gray-500">Normalization model: {result.metadata.normalizationModel}</p> : null}
                {result.metadata.traceId ? <p className="mt-1 text-sm text-gray-500">Trace: {result.metadata.traceId}</p> : null}
              </div>
              <div className="flex flex-wrap gap-3">
                {result.preset === 'content' && result.zipBase64 ? (
                  <button
                    type="button"
                    onClick={() => downloadBase64Blob(result.zipFilename || result.filename, result.zipBase64 || '', 'application/zip')}
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/20"
                  >
                    <Download className="h-4 w-4" />
                    Download ZIP
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => downloadBlob(result.filename, result.csv, 'text/csv')}
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/20"
                  >
                    <Download className="h-4 w-4" />
                    Download CSV
                  </button>
                )}
                {result.preset === 'content' && result.builderImport ? (
                  <button
                    type="button"
                    onClick={handleBuildSite}
                    disabled={buildingSite}
                    className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {buildingSite ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Build Site
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => downloadBlob(result.preset === 'content' ? (result.zipFilename || 'keystone-content-export.zip').replace(/\.zip$/, '.json') : result.filename.replace(/\.csv$/, '.json'), result.rawJson, 'application/json')}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-950 px-4 py-2.5 text-sm font-semibold text-gray-200 transition-colors hover:border-gray-600"
                >
                  <FileJson className="h-4 w-4" />
                  Raw JSON
                </button>
              </div>
            </div>

            {result.preset === 'content' && contentPreview ? (
              <>
                <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                  <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Pages found</p>
                    <p className="mt-2 text-2xl font-bold text-white">{result.summary.discoveredPages}</p>
                  </div>
                  <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Pages extracted</p>
                    <p className="mt-2 text-2xl font-bold text-white">{result.summary.pagesExtracted ?? 0}</p>
                  </div>
                  <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Builder-compatible</p>
                    <p className="mt-2 text-2xl font-bold text-white">{result.summary.builderCompatiblePages ?? 0}</p>
                  </div>
                  <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Approximated</p>
                    <p className="mt-2 text-2xl font-bold text-white">{result.summary.approximatedPages ?? 0}</p>
                  </div>
                  <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Manual cleanup</p>
                    <p className="mt-2 text-2xl font-bold text-white">{result.summary.manualCleanupPages ?? 0}</p>
                  </div>
                  <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Nav / globals</p>
                    <p className="mt-2 text-2xl font-bold text-white">{result.summary.navigationItems ?? 0} / {result.summary.globalsFound ?? 0}</p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 xl:grid-cols-4">
                  <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4 xl:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Compatibility snapshot</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-xs text-gray-500">Supported pages</p>
                        <p className="mt-1 text-xl font-semibold text-white">{contentPreview.compatibility.fullySupportedPages}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Approximated pages</p>
                        <p className="mt-1 text-xl font-semibold text-white">{contentPreview.compatibility.approximatedPages}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Manual follow-up</p>
                        <p className="mt-1 text-xl font-semibold text-white">{contentPreview.compatibility.manualCleanupPages}</p>
                      </div>
                    </div>
                    <p className="mt-4 text-sm text-gray-400">
                      Template suggestion: <span className="text-gray-200">{contentPreview.templateSuggestion.style}</span> for a <span className="text-gray-200">{contentPreview.templateSuggestion.businessType}</span> site.
                    </p>
                    <p className="mt-1 text-sm text-gray-500">{contentPreview.templateSuggestion.reason}</p>
                  </div>
                  <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Globals found</p>
                    <div className="mt-3 space-y-2 text-sm text-gray-300">
                      <p>Primary nav items: {contentPreview.globals.navigationCount}</p>
                      <p>Footer links: {contentPreview.globals.footerNavigationCount}</p>
                      <p>Contact info: {contentPreview.globals.hasContactInfo ? 'Yes' : 'No'}</p>
                      <p>Social links: {contentPreview.globals.socialCount}</p>
                      <p>Legal links: {contentPreview.globals.legalLinkCount}</p>
                      <p>Logos: {contentPreview.globals.logoCount}</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Budget and cache</p>
                    <div className="mt-3 space-y-2 text-sm text-gray-300">
                      <p>Mode: {contentPreview.mode}</p>
                      <p>Mapping: {contentPreview.aiOnly ? 'AI-only' : 'Hybrid'}</p>
                      <p>Model: {result.metadata.normalizationModel || 'Not set'}</p>
                      <p>LLM pages: {contentPreview.budget.llmPagesUsed}</p>
                      <p>Fallback pages: {contentPreview.budget.llmFallbackPages}</p>
                      <p>Estimated tokens: {contentPreview.budget.estimatedTokensUsed}</p>
                      <p>Page cache hits: {contentPreview.cache.pageHits}</p>
                      <p>Normalization cache hits: {contentPreview.cache.normalizationHits}</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
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
            )}

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

          {result.preset === 'content' && contentPreview && (
            <>
              <div className="rounded-2xl border border-gray-800 bg-gray-900/80 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Extracted pages</h3>
                    <p className="mt-1 text-sm text-gray-400">Each row shows how the page maps into Keystone-supported builder blocks, plus warnings when a section had to be approximated.</p>
                  </div>
                  <div className="text-right text-sm text-gray-400">
                    <p>{contentPreview.pages.length} page{contentPreview.pages.length === 1 ? '' : 's'} in export</p>
                    <p>{contentPreview.exportFiles.length} file{contentPreview.exportFiles.length === 1 ? '' : 's'} in ZIP</p>
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto rounded-xl border border-gray-800">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-950">
                      <tr>
                        {['Title', 'URL', 'Slug', 'Type', 'Confidence', 'Compatibility', 'Warnings', 'Builder blocks'].map((header) => (
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
                      {contentPreview.pages.map((page) => (
                        <tr key={page.url} className="align-top">
                          <td className="max-w-xs px-4 py-3 text-gray-100">
                            <div className="font-semibold">{page.title || 'Untitled'}</div>
                          </td>
                          <td className="max-w-xs px-4 py-3 text-gray-300">
                            <div className="line-clamp-2 break-all">{page.url}</div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-gray-300">{page.slug}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-gray-300">{page.inferredType}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-gray-200">{page.confidence}%</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${getCompatibilityClasses(page.compatibilityStatus)}`}>
                              {page.compatibilityStatus.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-gray-300">{page.warningsCount}</td>
                          <td className="max-w-sm px-4 py-3 text-gray-300">
                            <div className="line-clamp-3 break-words">{page.builderBlocks.join(', ') || 'None mapped'}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[1fr_0.75fr]">
                <div className="rounded-2xl border border-gray-800 bg-gray-900/80 p-6">
                  <h3 className="text-lg font-semibold text-white">Export files</h3>
                  <p className="mt-1 text-sm text-gray-400">The ZIP includes builder-oriented page JSON, site globals, compatibility reports, and raw extraction debug data.</p>
                  <div className="mt-4 overflow-x-auto rounded-xl border border-gray-800">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-950">
                        <tr>
                          <th className="border-b border-gray-800 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">Path</th>
                          <th className="border-b border-gray-800 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">Size</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800 bg-gray-900">
                        {contentPreview.exportFiles.map((file) => (
                          <tr key={file.path}>
                            <td className="px-4 py-3 text-gray-200">{file.path}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-gray-400">{file.size.toLocaleString()} B</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-800 bg-gray-900/80 p-6">
                  <h3 className="text-lg font-semibold text-white">Compatibility report</h3>
                  <p className="mt-1 text-sm text-gray-400">Unsupported sections are preserved by falling back to the nearest builder-safe structure and flagged for manual cleanup.</p>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Section totals</p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <div>
                          <p className="text-xs text-gray-500">Supported</p>
                          <p className="mt-1 text-xl font-semibold text-white">{contentPreview.compatibility.supportedSections}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Approximated</p>
                          <p className="mt-1 text-xl font-semibold text-white">{contentPreview.compatibility.approximatedSections}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Unsupported</p>
                          <p className="mt-1 text-xl font-semibold text-white">{contentPreview.compatibility.unsupportedSections}</p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4 text-sm text-gray-300">
                      <p>Blog included: {contentPreview.includeBlog ? 'Yes' : 'No'}</p>
                      <p>AI-only mapping: {contentPreview.aiOnly ? 'Yes' : 'No'}</p>
                      <p className="mt-2">Budget exhausted: {contentPreview.budget.exhausted ? 'Yes' : 'No'}</p>
                      <p className="mt-2">Job cache hit: {contentPreview.cache.jobHit ? 'Yes' : 'No'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {result.preset !== 'content' && previewHeaders.length > 0 && (
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
