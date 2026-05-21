'use client';

import { CheckCircle2 } from 'lucide-react';
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
        <a
          href={liveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-8 py-3.5 text-base font-semibold text-white transition-colors shadow-md shadow-emerald-200"
        >
          View my site →
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
