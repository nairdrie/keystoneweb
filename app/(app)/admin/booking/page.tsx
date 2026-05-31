'use client';

import { useAdminContext } from '../admin-context';
import {
    CategoriesEditor,
    ServicesEditor,
    HoursEditor,
    SettingsEditor,
    type BookingSettings,
    type Category,
    type Service,
    type AvailabilityDay,
} from '@/app/components/blocks/BookingBlock';
import BookingsPanel from '@/app/components/booking/BookingsPanel';
import BookingAutomatedEmailsPanel from '@/app/components/booking/AutomatedEmailsPanel';
import BookingPaymentsPanel from '@/app/components/booking/BookingPaymentsPanel';
import {
    Calendar, DollarSign, LayoutTemplate, Clock, CreditCard, Settings2, Mail, Loader2,
} from 'lucide-react';
import { useState, useEffect } from 'react';

type TabId = 'bookings' | 'services' | 'categories' | 'hours' | 'payments' | 'settings' | 'emails';

export default function AdminBookingPage() {
    const { siteId, palette, siteBlockTypes, confirmNavigation } = useAdminContext();
    const [activeTab, setActiveTab] = useState<TabId>('bookings');
    const [siteLogoUrl, setSiteLogoUrl] = useState<string | undefined>(undefined);

    // Shared data for the editor tabs. Each editor mutates its own slice and
    // saves to its own endpoint; we keep the loaded copies here so switching
    // tabs doesn't re-fetch and so cross-tab references (services referencing
    // categories) stay in sync.
    const [categories, setCategories] = useState<Category[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [availability, setAvailability] = useState<AvailabilityDay[]>([]);
    const [settings, setSettings] = useState<BookingSettings | null>(null);
    const [loadingData, setLoadingData] = useState(true);

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

    useEffect(() => {
        if (!siteId) return;
        if (!siteBlockTypes.has('booking')) return;
        (async () => {
            setLoadingData(true);
            // Ensure booking_settings row exists; the insert trigger also
            // creates the default 7-day availability schedule.
            const settingsRes = await fetch(`/api/bookings/settings?siteId=${siteId}`);
            const settingsData = await settingsRes.json();
            if (!settingsData.settings) {
                await fetch('/api/bookings/settings', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ siteId }),
                });
            }

            const [catRes, svcRes, avRes, stRes] = await Promise.all([
                fetch(`/api/bookings/categories?siteId=${siteId}`),
                fetch(`/api/bookings/services?siteId=${siteId}`),
                fetch(`/api/bookings/availability?siteId=${siteId}`),
                fetch(`/api/bookings/settings?siteId=${siteId}`),
            ]);
            const [catData, svcData, avData, stData] = await Promise.all([
                catRes.json(), svcRes.json(), avRes.json(), stRes.json(),
            ]);
            setCategories(catData.categories || []);
            setServices(svcData.services || []);
            setAvailability(avData.availability || []);
            setSettings(stData.settings || null);
            setLoadingData(false);
        })();
    }, [siteId, siteBlockTypes]);

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
        { id: 'services', label: 'Services', icon: DollarSign },
        { id: 'categories', label: 'Categories', icon: LayoutTemplate },
        { id: 'hours', label: 'Hours', icon: Clock },
        { id: 'payments', label: 'Payments', icon: CreditCard },
        { id: 'settings', label: 'Settings', icon: Settings2 },
        { id: 'emails', label: 'Emails', icon: Mail },
    ];

    const editorLoading = loadingData && activeTab !== 'bookings' && activeTab !== 'emails' && activeTab !== 'payments';

    return (
        <div className="p-6 space-y-6">
            <h2 className="text-base font-bold text-slate-900">Booking &amp; Services</h2>

            <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => confirmNavigation(() => setActiveTab(tab.id))}
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

                {editorLoading && (
                    <div className="py-12 text-center">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                    </div>
                )}

                {!editorLoading && activeTab === 'services' && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Services</h3>
                        </div>
                        <div className="p-5">
                            <ServicesEditor
                                siteId={siteId}
                                services={services}
                                setServices={setServices}
                                categories={categories}
                            />
                        </div>
                    </div>
                )}

                {!editorLoading && activeTab === 'categories' && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Service Categories</h3>
                        </div>
                        <div className="p-5">
                            <CategoriesEditor
                                siteId={siteId}
                                categories={categories}
                                setCategories={setCategories}
                            />
                        </div>
                    </div>
                )}

                {!editorLoading && activeTab === 'hours' && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Business Hours</h3>
                        </div>
                        <div className="p-5">
                            <HoursEditor
                                siteId={siteId}
                                availability={availability}
                                setAvailability={setAvailability}
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'payments' && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Payment Settings</h3>
                        </div>
                        <BookingPaymentsPanel siteId={siteId} />
                    </div>
                )}

                {!editorLoading && activeTab === 'settings' && settings && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Booking Preferences</h3>
                        </div>
                        <div className="p-5">
                            <SettingsEditor
                                siteId={siteId}
                                settings={settings}
                                setSettings={setSettings}
                            />
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
