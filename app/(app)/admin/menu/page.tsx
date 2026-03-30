'use client';

import { UtensilsCrossed } from 'lucide-react';

export default function AdminMenuPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <UtensilsCrossed className="w-7 h-7 text-slate-300" />
      </div>
      <h2 className="text-base font-bold text-slate-900 mb-1">Menu — Coming Soon</h2>
      <p className="text-sm text-slate-500 max-w-xs">
        Manage your restaurant or café menu, update items and prices, and keep everything in sync with your site. This feature is on the way.
      </p>
    </div>
  );
}
