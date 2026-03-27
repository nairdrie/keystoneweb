'use client';

import { useAdminContext } from '../admin-context';
import { BookingSetup } from '@/app/components/blocks/BookingBlock';
import BookingsPanel from '@/app/components/booking/BookingsPanel';

export default function AdminBookingPage() {
  const { siteId, palette } = useAdminContext();

  if (!siteId) return null;

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
