'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useEditorContext } from '@/lib/editor-context';
import { CalendarDays, ExternalLink, ArrowDownUp, Eye, EyeOff } from 'lucide-react';
import EditableText from '../EditableText';

interface Event {
    id: string;
    title: string;
    description: string | null;
    event_date: string;
    date_display: string;
    image_url: string | null;
    event_url: string | null;
}

interface EventsBlockProps {
    id: string;
    data: any;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: (key: string, value: any) => void;
}

// 'desc' = newest/latest date first (default)
// 'asc'  = closest/soonest date first
type SortOrder = 'desc' | 'asc';

export default function EventsBlock({ id, data, isEditMode, palette, updateContent }: EventsBlockProps) {
    const router = useRouter();
    const context = useEditorContext();
    const siteId = context?.siteId;
    const requestNavigation = context?.requestNavigation;
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(false);

    const pPrimary = palette.primary || '#1f2937';
    const pAccent = palette.accent || '#f8fafc';

    const sortOrder: SortOrder = data.sortOrder || 'desc';
    const showPast: boolean = data.showPast ?? false;

    useEffect(() => {
        if (isEditMode || !siteId) return;
        setLoading(true);
        fetch(`/api/events?siteId=${siteId}&includePast=${showPast}&sortOrder=${sortOrder}`)
            .then(r => r.ok ? r.json() : { events: [] })
            .then(d => setEvents(d.events || []))
            .catch(() => setEvents([]))
            .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [siteId, isEditMode, sortOrder, showPast]);

    // ── Edit mode ─────────────────────────────────────────────────────────────
    if (isEditMode) {
        return (
            <section className="py-16" style={{ backgroundColor: data.backgroundColor || '#ffffff' }}>
                <div className="max-w-5xl mx-auto px-4">
                    <EditableText
                        as="h2"
                        contentKey="title"
                        content={data.title}
                        defaultValue="Upcoming Events"
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="text-3xl font-bold text-center mb-2"
                        style={{ color: pPrimary }}
                    />
                    <EditableText
                        as="p"
                        contentKey="subtitle"
                        content={data.subtitle}
                        defaultValue="Stay up to date with what's happening."
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="text-base text-center mb-10 max-w-xl mx-auto opacity-60"
                        style={{ color: pPrimary }}
                    />

                    <div className="flex flex-col items-center justify-center gap-5 py-10 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                            <CalendarDays className="w-6 h-6 text-slate-400" />
                        </div>

                        {/* Display settings */}
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            {/* Sort order toggle */}
                            <div className="flex items-center gap-1 p-0.5 bg-white rounded-full border border-slate-200 shadow-sm">
                                <button
                                    onClick={() => updateContent('sortOrder', 'asc')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                                        sortOrder === 'asc'
                                            ? 'bg-slate-900 text-white'
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    <ArrowDownUp className="w-3 h-3" />
                                    Closest first
                                </button>
                                <button
                                    onClick={() => updateContent('sortOrder', 'desc')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                                        sortOrder === 'desc'
                                            ? 'bg-slate-900 text-white'
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    <ArrowDownUp className="w-3 h-3" />
                                    Newest first
                                </button>
                            </div>

                            {/* Show past toggle */}
                            <button
                                onClick={() => updateContent('showPast', !showPast)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors shadow-sm ${
                                    showPast
                                        ? 'bg-slate-900 text-white border-slate-900'
                                        : 'bg-white text-slate-500 border-slate-200 hover:text-slate-800'
                                }`}
                            >
                                {showPast ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                {showPast ? 'Showing past events' : 'Hiding past events'}
                            </button>
                        </div>

                        <div className="text-center">
                            <div className="font-bold text-slate-800 mb-1">Manage Events in Admin</div>
                            <div className="text-sm text-slate-500 mb-4">
                                Add and manage your events from the Admin Dashboard.
                            </div>
                            <button
                                onClick={() => {
                                    const go = () => router.push(`/admin/events?siteId=${siteId}`);
                                    if (requestNavigation) requestNavigation(go);
                                    else go();
                                }}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-lg transition-colors"
                            >
                                <CalendarDays className="w-4 h-4" />
                                Manage Events
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    // ── View mode ─────────────────────────────────────────────────────────────
    return (
        <section className="py-16" style={{ backgroundColor: data.backgroundColor || '#ffffff' }}>
            <div className="max-w-5xl mx-auto px-4">
                {(data.title || data.subtitle) && (
                    <div className="text-center mb-12">
                        {data.title && (
                            <h2 className="text-3xl sm:text-4xl font-bold mb-3" style={{ color: pPrimary }}>
                                {data.title}
                            </h2>
                        )}
                        {data.subtitle && (
                            <p className="text-base opacity-60 max-w-xl mx-auto" style={{ color: pPrimary }}>
                                {data.subtitle}
                            </p>
                        )}
                    </div>
                )}

                {loading && (
                    <div className="text-center py-12 text-slate-400">Loading events…</div>
                )}

                {!loading && events.length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                        <CalendarDays className="w-8 h-8 mx-auto mb-3 opacity-30" />
                        <p>No {showPast ? '' : 'upcoming '}events.</p>
                    </div>
                )}

                {!loading && events.length > 0 && (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {events.map(event => (
                            <EventCard key={event.id} event={event} pPrimary={pPrimary} pAccent={pAccent} />
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}

function EventCard({ event, pPrimary, pAccent }: { event: Event; pPrimary: string; pAccent: string }) {
    const inner = (
        <div className="group flex flex-col rounded-2xl overflow-hidden border border-slate-200 bg-white hover:shadow-lg transition-shadow h-full">
            {event.image_url ? (
                <div className="aspect-[16/9] overflow-hidden bg-slate-100 flex-shrink-0">
                    <img
                        src={event.image_url}
                        alt={event.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                </div>
            ) : (
                <div className="aspect-[16/9] flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: pAccent }}>
                    <CalendarDays className="w-10 h-10 opacity-20" style={{ color: pPrimary }} />
                </div>
            )}

            <div className="flex flex-col flex-1 p-5">
                <div className="flex items-center gap-1.5 mb-2">
                    <CalendarDays className="w-3.5 h-3.5 flex-shrink-0 opacity-50" style={{ color: pPrimary }} />
                    <span className="text-xs font-semibold opacity-60" style={{ color: pPrimary }}>
                        {event.date_display}
                    </span>
                </div>

                <h3 className="text-base font-bold leading-snug mb-2" style={{ color: pPrimary }}>
                    {event.title}
                </h3>

                {event.description && (
                    <p className="text-sm leading-relaxed opacity-60 flex-1 line-clamp-3" style={{ color: pPrimary }}>
                        {event.description}
                    </p>
                )}

                {event.event_url && (
                    <div className="mt-4 flex-shrink-0">
                        <span
                            className="inline-flex items-center gap-1.5 text-xs font-bold transition-opacity group-hover:opacity-70"
                            style={{ color: pPrimary }}
                        >
                            Learn more
                            <ExternalLink className="w-3 h-3" />
                        </span>
                    </div>
                )}
            </div>
        </div>
    );

    if (event.event_url) {
        return (
            <a href={event.event_url} target="_blank" rel="noopener noreferrer" className="flex flex-col h-full">
                {inner}
            </a>
        );
    }

    return <div className="flex flex-col h-full">{inner}</div>;
}
