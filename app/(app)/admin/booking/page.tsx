'use client';

import { useAdminContext } from '../admin-context';
import { BookingSetup } from '@/app/components/blocks/BookingBlock';
import BookingsPanel from '@/app/components/booking/BookingsPanel';
import BookingAutomatedEmailsPanel from '@/app/components/booking/AutomatedEmailsPanel';
import { Calendar, Settings2, Mail } from 'lucide-react';
import { useState, useEffect } from 'react';

type TabId = 'bookings' | 'setup' | 'emails';

export default function AdminBookingPage() {
  const { siteId, palette, siteBlockTypes } = useAdminContext();
  const [activeTab, setActiveTab] = useState<TabId>('bookings');
  const [siteLogoUrl, setSiteLogoUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!siteId) return;
    fetch(`/api/sites?id=${siteId}`)
      .then(r => r.json())
      .then(data => {
        const designData = data?.designData || {};
        const logo = designData.headerLogo || designData.siteLogo;
        if (logo) setSiteLogoUrl(logo);
      })
      .catch(() => {});
  }, [siteId]);

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

  const tabs: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'bookings', label: 'Bookings', icon: Calendar },
    { id: 'setup', label: 'Setup', icon: Settings2 },
    { id: 'emails', label: 'Emails', icon: Mail },
  ];

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-base font-bold text-slate-900">Booking &amp; Services</h2>

      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="max-w-3xl mx-auto">
        {activeTab === 'bookings' && (
          <BookingsPanel siteId={siteId} />
        )}
        {activeTab === 'setup' && (
          <div className="border-2 border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200">
              <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <Settings2 className="w-4 h-4 text-slate-500" />
                Booking System Setup
              </span>
            </div>
            <div className="border-t border-slate-200">
              <BookingSetup siteId={siteId} palette={palette} />
            </div>
          </div>
        )}
        {activeTab === 'emails' && (
          <BookingAutomatedEmailsPanel siteId={siteId} logoUrl={siteLogoUrl} />
        )}
      </div>
    </div>
  );
}
