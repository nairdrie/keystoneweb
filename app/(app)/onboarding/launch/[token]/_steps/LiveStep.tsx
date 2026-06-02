'use client';

import { useState } from 'react';
import { CheckCircle2, Copy, Check, ExternalLink } from 'lucide-react';
import type { OnboardingState } from '../page';

interface Props {
  state: OnboardingState;
}

export default function LiveStep({ state }: Props) {
  const domain =
    state.site?.custom_domain ||
    (state.site?.published_domain ? `${state.site.published_domain}.kswd.ca` : null);
  const liveUrl = domain ? `https://${domain}` : null;
  const siteId = state.site?.id;
  const [copied, setCopied] = useState(false);

  async function copyUrl() {
    if (!liveUrl) return;
    try {
      await navigator.clipboard.writeText(liveUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — fall back to selecting the text.
    }
  }

  return (
    <div className="max-w-md mx-auto text-center mt-12">
      <div className="relative inline-block">
        <div className="absolute inset-0 rounded-full bg-emerald-300 animate-ping opacity-30" />
        <div className="relative w-24 h-24 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-200">
          <CheckCircle2 className="w-14 h-14 text-white" strokeWidth={2.5} />
        </div>
      </div>

      <h1 className="mt-8 text-3xl font-bold text-slate-900">You’re live! 🎉</h1>
      <p className="mt-3 text-sm text-slate-600">
        Your site is up and running. Share the link — and welcome to Keystone.
      </p>

      {liveUrl && (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center">
            <div className="flex-1 px-4 py-3 text-left text-sm font-mono text-slate-800 truncate">
              {liveUrl}
            </div>
            <button
              type="button"
              onClick={copyUrl}
              className="flex-shrink-0 h-full px-3 py-3 border-l border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              aria-label="Copy link"
            >
              {copied ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                  <Check className="w-4 h-4" />
                  Copied
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-semibold">
                  <Copy className="w-4 h-4" />
                  Copy
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {liveUrl && (
        <a
          href={liveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 mt-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-8 py-3.5 text-base font-semibold text-white transition-colors shadow-md shadow-emerald-200"
        >
          View my site
          <ExternalLink className="w-4 h-4" />
        </a>
      )}

      {siteId && (
        <div className="mt-4">
          <a
            href={`/admin?siteId=${siteId}`}
            className="text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2"
          >
            Manage your site in Keystone
          </a>
        </div>
      )}

      {state.launchedAt && (
        <p className="mt-10 text-[11px] text-slate-400">
          Launched {new Date(state.launchedAt).toLocaleString('en-CA')}
        </p>
      )}
    </div>
  );
}
