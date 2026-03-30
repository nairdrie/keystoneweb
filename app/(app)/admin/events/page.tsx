'use client';

import { CalendarDays } from 'lucide-react';

export default function AdminEventsPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <CalendarDays className="w-7 h-7 text-slate-300" />
      </div>
      <h2 className="text-base font-bold text-slate-900 mb-1">Events — Coming Soon</h2>
      <p className="text-sm text-slate-500 max-w-xs">
        Publish and manage events directly from your dashboard. This feature is on the way.
      </p>
    </div>
  );
}
