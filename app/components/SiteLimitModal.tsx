'use client';

import { LayoutDashboard } from 'lucide-react';

interface SiteLimitModalProps {
  onDismiss: () => void;
}

export default function SiteLimitModal({ onDismiss }: SiteLimitModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[10000] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center animate-in fade-in zoom-in-95">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
          <LayoutDashboard className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">Site Limit Reached</h2>
        <p className="text-slate-600 mb-6 text-sm leading-relaxed">
          You've reached the <strong>5 site limit</strong> on the Basic plan. Upgrade to Pro for unlimited sites and unlock everything Keystone has to offer.
        </p>
        <a
          href="/pricing"
          className="block w-full py-3 px-6 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold text-sm hover:brightness-110 transition-all shadow-lg mb-3"
        >
          Upgrade to Pro
        </a>
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
