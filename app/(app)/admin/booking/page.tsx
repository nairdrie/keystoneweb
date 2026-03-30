'use client';

import { useAdminContext } from '../admin-context';
import { BookingSetup } from '@/app/components/blocks/BookingBlock';
import BookingsPanel from '@/app/components/booking/BookingsPanel';
import { Calendar, ChevronDown, ChevronRight, Settings2 } from 'lucide-react';
import { useState, useEffect } from 'react';

const SETUP_STORAGE_KEY = 'admin_booking_setup_expanded';

export default function AdminBookingPage() {
  const { siteId, palette, siteBlockTypes } = useAdminContext();
  const [setupExpanded, setSetupExpanded] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(SETUP_STORAGE_KEY);
    if (saved !== null) setSetupExpanded(saved === 'true');
  }, []);

  const toggleSetup = () => {
    setSetupExpanded(prev => {
      localStorage.setItem(SETUP_STORAGE_KEY, String(!prev));
      return !prev;
    });
  };

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
      <div className="border-2 border-slate-200 rounded-xl overflow-hidden">
        <button
          onClick={toggleSetup}
          className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <Settings2 className="w-4 h-4 text-slate-500" />
            Booking System Setup
          </span>
          {setupExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </button>
        {setupExpanded && (
          <div className="border-t border-slate-200">
            <BookingSetup siteId={siteId} palette={palette} />
          </div>
        )}
      </div>
    </div>
  );
}
