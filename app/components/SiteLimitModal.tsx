'use client';

import { LayoutDashboard } from 'lucide-react';

interface PublishLimitModalProps {
  plan: string;
  limit: number;
  onDismiss: () => void;
  onManageSites?: () => void;
}

export default function SiteLimitModal({ plan, limit, onDismiss, onManageSites }: PublishLimitModalProps) {
  const isPro = plan.toLowerCase().includes('pro');

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[10000] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center animate-in fade-in zoom-in-95">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
          <LayoutDashboard className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">Publish Limit Reached</h2>
        <p className="text-slate-600 mb-6 text-sm leading-relaxed">
          {isPro ? (
            <>
              You&apos;ve reached the <strong>{limit}-site publish limit</strong> on the Pro plan.
              Unpublish a site to free up a slot, or contact us for a Custom plan.
            </>
          ) : (
            <>
              You&apos;ve reached the <strong>{limit}-site publish limit</strong> on the Basic plan.
              Upgrade to Pro to publish up to 5 sites, or unpublish your current site first.
            </>
          )}
        </p>

        {!isPro && (
          <a
            href="/pricing"
            className="block w-full py-3 px-6 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold text-sm hover:brightness-110 transition-all shadow-lg mb-3"
          >
            Upgrade to Pro
          </a>
        )}

        {isPro && (
          <a
            href="/contact"
            className="block w-full py-3 px-6 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold text-sm hover:brightness-110 transition-all shadow-lg mb-3"
          >
            Contact Us for Custom Plan
          </a>
        )}

        {onManageSites && (
          <button
            onClick={onManageSites}
            className="w-full py-3 px-6 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-colors mb-2"
          >
            Manage My Sites
          </button>
        )}

        <button
          onClick={onDismiss}
          className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
