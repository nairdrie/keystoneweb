'use client';

/**
 * Live previews of what a campaign will look like once published.
 *
 * Google Search: mock SERP "Sponsored" entry. Google's Responsive Search Ads
 * show 3 of N headlines + 2 of M descriptions per impression and rotate them,
 * so the preview cycles through combinations on a timer to match reality.
 *
 * Google Display: mock banner with cycling headline + description, since
 * Responsive Display Ads also rotate copy.
 */

import { useEffect, useState } from 'react';
import { Globe, RefreshCw } from 'lucide-react';
import type { GoogleSearchContent, GoogleDisplayContent } from '@/lib/marketing/types';

const ROTATE_MS = 3500;

function useRotatingIndex(total: number) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (total <= 1) return;
    const id = setInterval(() => setI(v => (v + 1) % total), ROTATE_MS);
    return () => clearInterval(id);
  }, [total]);
  return Math.min(i, Math.max(0, total - 1));
}

function pickWindow<T>(items: T[], startIdx: number, count: number): T[] {
  if (items.length === 0) return [];
  const out: T[] = [];
  for (let k = 0; k < count && k < items.length; k++) {
    out.push(items[(startIdx + k) % items.length]);
  }
  return out;
}

function displayUrl(rawUrl: string, businessName: string): string {
  if (!rawUrl) return businessName.toLowerCase().replace(/[^a-z0-9]+/g, '') + '.com';
  try {
    const u = new URL(rawUrl);
    return u.hostname.replace(/^www\./, '') + (u.pathname && u.pathname !== '/' ? u.pathname : '');
  } catch {
    return rawUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }
}

// ── Google Search ────────────────────────────────────────────────────────────

export function GoogleSearchAdPreview({
  content,
  businessName,
}: {
  content: GoogleSearchContent;
  businessName: string;
}) {
  const headlines = (content.headlines || []).filter(Boolean);
  const descriptions = (content.descriptions || []).filter(Boolean);

  const headlineCombos = Math.max(1, headlines.length);
  const descCombos = Math.max(1, descriptions.length);
  const totalCombos = Math.max(headlineCombos, descCombos);

  const idx = useRotatingIndex(totalCombos);
  const shownHeadlines = pickWindow(headlines, idx, 3);
  const shownDescriptions = pickWindow(descriptions, idx, 2);
  const url = displayUrl(content.finalUrl || '', businessName);

  return (
    <PreviewShell
      label="Live preview"
      sublabel="How this ad appears in Google Search results"
      rotateBadge={totalCombos > 1 ? `Combination ${idx + 1} of ${totalCombos}` : undefined}
    >
      <div className="bg-white rounded-lg p-5 font-[arial,sans-serif] max-w-2xl">
        {/* Site row */}
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
            <Globe className="w-3.5 h-3.5" />
          </div>
          <div className="leading-tight">
            <div className="text-[14px] text-slate-900 font-medium">{businessName || 'Your business'}</div>
            <div className="text-[12px] text-slate-600 flex items-center gap-1.5">
              <span>{url}</span>
            </div>
          </div>
        </div>

        {/* Sponsored + headline */}
        <div className="mt-1.5">
          <span className="text-[12px] text-slate-700 font-medium mr-1.5">Sponsored</span>
        </div>
        <h3
          key={`hl-${idx}`}
          className="text-[20px] leading-tight text-[#1a0dab] font-normal mt-0.5 cursor-pointer hover:underline animate-fade-in"
        >
          {shownHeadlines.length > 0
            ? shownHeadlines.join(' | ')
            : <span className="text-slate-400 italic">Add at least one headline</span>}
        </h3>

        {/* Description */}
        <p
          key={`desc-${idx}`}
          className="text-[14px] text-slate-700 mt-1 leading-snug animate-fade-in"
        >
          {shownDescriptions.length > 0
            ? shownDescriptions.join(' ')
            : <span className="text-slate-400 italic">Add at least one description</span>}
        </p>
      </div>

      <CycleFootnote>
        Google rotates your {headlines.length || 0} headline{headlines.length === 1 ? '' : 's'}
        {' '}and {descriptions.length || 0} description{descriptions.length === 1 ? '' : 's'},
        showing 3 + 2 at a time and learning which combinations convert best.
      </CycleFootnote>
    </PreviewShell>
  );
}

// ── Google Display ──────────────────────────────────────────────────────────

export function GoogleDisplayAdPreview({
  content,
  businessName,
}: {
  content: GoogleDisplayContent;
  businessName: string;
}) {
  const headlines = (content.headlines || []).filter(Boolean);
  const descriptions = (content.descriptions || []).filter(Boolean);
  const totalCombos = Math.max(1, headlines.length, descriptions.length);
  const idx = useRotatingIndex(totalCombos);

  const headline = headlines[idx % Math.max(1, headlines.length)] || content.longHeadline || '';
  const description = descriptions[idx % Math.max(1, descriptions.length)] || '';
  const url = displayUrl(content.finalUrl || '', businessName);

  return (
    <PreviewShell
      label="Live preview"
      sublabel="How this ad appears on websites in the Google Display Network"
      rotateBadge={totalCombos > 1 ? `Variant ${idx + 1} of ${totalCombos}` : undefined}
    >
      <div className="max-w-md">
        <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white">
          {/* Image area placeholder */}
          <div className="aspect-video bg-gradient-to-br from-emerald-500 to-sky-600 flex items-center justify-center">
            <span className="text-white/80 text-xs font-bold uppercase tracking-wider">Your image</span>
          </div>
          <div className="p-4">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Ad · {url}</p>
            <h3
              key={`dh-${idx}`}
              className="text-[16px] font-bold text-slate-900 mt-1 leading-tight animate-fade-in"
            >
              {headline || <span className="text-slate-400 italic">Add a headline</span>}
            </h3>
            <p
              key={`dd-${idx}`}
              className="text-[13px] text-slate-600 mt-1 leading-snug animate-fade-in"
            >
              {description || <span className="text-slate-400 italic">Add a description</span>}
            </p>
            <div className="mt-3 inline-block px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded">
              {businessName || 'Learn more'}
            </div>
          </div>
        </div>
      </div>

      <CycleFootnote>
        Google rotates your headlines and descriptions across millions of partner websites,
        YouTube, Gmail and mobile apps.
      </CycleFootnote>
    </PreviewShell>
  );
}

// ── Shared shell ─────────────────────────────────────────────────────────────

function PreviewShell({
  label,
  sublabel,
  rotateBadge,
  children,
}: {
  label: string;
  sublabel: string;
  rotateBadge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">{label}</p>
          <p className="text-sm text-slate-600 mt-0.5">{sublabel}</p>
        </div>
        {rotateBadge && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded-full">
            <RefreshCw className="w-3 h-3 animate-spin" />
            {rotateBadge}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function CycleFootnote({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-slate-500 leading-relaxed">{children}</p>
  );
}

// ── Channel router ──────────────────────────────────────────────────────────

export function AdPreview({
  channel,
  campaignType,
  content,
  businessName,
}: {
  channel: 'google_ads' | 'meta_ads' | 'email';
  campaignType: string;
  content: Record<string, unknown> | null;
  businessName: string;
}) {
  if (!content) return null;
  if (channel === 'google_ads' && campaignType === 'search') {
    return <GoogleSearchAdPreview content={content as unknown as GoogleSearchContent} businessName={businessName} />;
  }
  if (channel === 'google_ads' && campaignType === 'display') {
    return <GoogleDisplayAdPreview content={content as unknown as GoogleDisplayContent} businessName={businessName} />;
  }
  return null;
}
