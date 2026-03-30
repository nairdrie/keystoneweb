'use client';

import { useAdminContext } from '../admin-context';
import { BookingSetup } from '@/app/components/blocks/BookingBlock';
import BookingsPanel from '@/app/components/booking/BookingsPanel';
import { Calendar } from 'lucide-react';

export default function AdminBookingPage() {
  const { siteId, palette, siteBlockTypes } = useAdminContext();

  if (!siteId) return null;

  if (!siteBlockTypes.has('booking')) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <Calendar className="w-7 h-7 text-slate-300" />
        </div>
        <h2 className="text-base font-bold text-slate-900 mb-1">No Booking block on this site</h2>
        <p className="text-sm text-slate-500 max-w-xs mb-5">
          Add a <strong>Booking</strong> block to your site to start accepting appointments and configuring your services.
        </p>
        <a
          href={`/design?siteId=${siteId}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-700 transition-colors"
        >
          Open Designer
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h2 className="text-base font-bold text-slate-900">Booking &amp; Services</h2>
      <BookingsPanel siteId={siteId} />
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <BookingSetup siteId={siteId} palette={palette} />
      </div>
    </div>
  );
}
