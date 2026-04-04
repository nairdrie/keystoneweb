'use client';

import { useState, useEffect, useRef } from 'react';
import { useAdminContext } from '../admin-context';
import { CalendarDays, Plus, Pencil, Trash2, X, Loader2, ExternalLink, ImageIcon, Upload, ArrowDownUp } from 'lucide-react';

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  date_display: string;
  image_url: string | null;
  event_url: string | null;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

type DateFormat = 'month_year' | 'full';

function buildDateDisplay(year: string, month: string, day: string, fmt: DateFormat): string {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const m = parseInt(month, 10);
  if (fmt === 'month_year') return `${monthNames[m - 1]} ${year}`;
  return `${monthNames[m - 1]} ${parseInt(day, 10)}, ${year}`;
}

function buildIsoDate(year: string, month: string, day: string, fmt: DateFormat): string {
  const d = fmt === 'month_year' ? '01' : day.padStart(2, '0');
  return `${year}-${month.padStart(2, '0')}-${d}`;
}

// Parse an ISO date string back into parts for editing
function parseIsoDate(iso: string) {
  const [year, month, day] = iso.split('-');
  return { year, month, day };
}

// ─── Event Form Modal ─────────────────────────────────────────────────────────

interface EventFormProps {
  siteId: string;
  event?: Event | null;
  onSave: (event: Event) => void;
  onClose: () => void;
}

function EventFormModal({ siteId, event, onSave, onClose }: EventFormProps) {
  const isEdit = !!event;

  const parsed = event ? parseIsoDate(event.event_date) : null;

  const [title, setTitle] = useState(event?.title ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [eventUrl, setEventUrl] = useState(event?.event_url ?? '');
  const [imageUrl, setImageUrl] = useState(event?.image_url ?? '');
  const [fmt, setFmt] = useState<DateFormat>(() => {
    if (!event) return 'full';
    // If day is '01' and date_display doesn't contain a space-delimited day number, assume month_year
    const parts = event.date_display.split(' ');
    return parts.length === 2 ? 'month_year' : 'full';
  });
  const [year, setYear] = useState(parsed?.year ?? String(new Date().getFullYear()));
  const [month, setMonth] = useState(parsed?.month ?? String(new Date().getMonth() + 1).padStart(2, '0'));
  const [day, setDay] = useState(parsed?.day ?? String(new Date().getDate()).padStart(2, '0'));

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => String(currentYear - 1 + i));
  const months = [
    { value: '01', label: 'January' }, { value: '02', label: 'February' },
    { value: '03', label: 'March' }, { value: '04', label: 'April' },
    { value: '05', label: 'May' }, { value: '06', label: 'June' },
    { value: '07', label: 'July' }, { value: '08', label: 'August' },
    { value: '09', label: 'September' }, { value: '10', label: 'October' },
    { value: '11', label: 'November' }, { value: '12', label: 'December' },
  ];

  async function handleImageUpload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('siteId', siteId);
      const res = await fetch('/api/sites/upload-image', { method: 'POST', body: form, credentials: 'include' });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setImageUrl(data.imageUrl);
    } catch {
      setError('Image upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!year || !month || (fmt === 'full' && !day)) { setError('Date is required.'); return; }

    const event_date = buildIsoDate(year, month, day, fmt);
    const date_display = buildDateDisplay(year, month, day, fmt);

    setSaving(true);
    try {
      const body: Record<string, any> = {
        siteId,
        title: title.trim(),
        description: description.trim() || null,
        event_date,
        date_display,
        image_url: imageUrl || null,
        event_url: eventUrl.trim() || null,
      };
      if (isEdit) body.id = event!.id;

      const res = await fetch('/api/events', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Save failed');
      }
      const data = await res.json();
      onSave(data.event);
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <h2 className="text-sm font-bold text-slate-900">{isEdit ? 'Edit Event' : 'Add Event'}</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* Image */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Event Image</label>
            <div
              className="relative w-full aspect-[16/9] rounded-xl overflow-hidden bg-slate-100 border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors group"
              onClick={() => fileInputRef.current?.click()}
            >
              {imageUrl ? (
                <>
                  <img src={imageUrl} alt="Event" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-xs font-bold flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" /> Change image
                    </span>
                  </div>
                </>
              ) : uploading ? (
                <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <ImageIcon className="w-8 h-8" />
                  <span className="text-xs font-medium">Click to upload image</span>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ''; }}
            />
            {imageUrl && (
              <button
                type="button"
                onClick={() => setImageUrl('')}
                className="mt-1 text-xs text-slate-400 hover:text-red-500 transition-colors"
              >
                Remove image
              </button>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Event name"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of the event…"
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Date <span className="text-red-500">*</span>
            </label>

            {/* Format toggle */}
            <div className="flex gap-2 mb-2">
              {(['full', 'month_year'] as DateFormat[]).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFmt(f)}
                  className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${
                    fmt === f
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {f === 'full' ? 'Month Day, Year' : 'Month, Year'}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <select
                value={month}
                onChange={e => setMonth(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white"
              >
                {months.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>

              {fmt === 'full' && (
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={parseInt(day, 10)}
                  onChange={e => setDay(String(e.target.value).padStart(2, '0'))}
                  placeholder="Day"
                  className="w-20 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
              )}

              <select
                value={year}
                onChange={e => setYear(e.target.value)}
                className="w-28 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white"
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {/* Preview */}
            <p className="mt-1 text-xs text-slate-400">
              Displays as: <span className="font-semibold text-slate-600">{buildDateDisplay(year, month, day, fmt)}</span>
            </p>
          </div>

          {/* URL */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Registration / Info URL
            </label>
            <input
              type="url"
              value={eventUrl}
              onChange={e => setEventUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 font-medium">{error}</p>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit as any}
            disabled={saving || uploading}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {isEdit ? 'Save Changes' : 'Add Event'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminEventsPage() {
  const { siteId, siteBlockTypes } = useAdminContext();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  if (!siteId) return null;

  // Gate: require events block on site
  if (!siteBlockTypes.has('events')) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <CalendarDays className="w-7 h-7 text-slate-300" />
        </div>
        <h2 className="text-base font-bold text-slate-900 mb-1">No Events block on this site</h2>
        <p className="text-sm text-slate-500 max-w-xs mb-5">
          Add an <strong>Events</strong> block to your site to start publishing and managing events.
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

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    fetchEvents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, showPast, sortOrder]);

  async function fetchEvents() {
    setLoading(true);
    try {
      const res = await fetch(`/api/events?siteId=${siteId}&includePast=${showPast}&sortOrder=${sortOrder}`, { credentials: 'include' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEvents(data.events || []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this event?')) return;
    setDeletingId(id);
    try {
      await fetch(`/api/events?id=${id}&siteId=${siteId}`, { method: 'DELETE', credentials: 'include' });
      setEvents(prev => prev.filter(e => e.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  function handleSaved(saved: Event) {
    setEvents(prev => {
      const idx = prev.findIndex(e => e.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setShowModal(false);
    setEditingEvent(null);
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-bold text-slate-900">Events</h2>
        <div className="flex items-center gap-2">
          {/* Sort order toggle */}
          <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-lg border border-slate-200">
            <button
              onClick={() => setSortOrder('asc')}
              title="Closest first"
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                sortOrder === 'asc' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ArrowDownUp className="w-3 h-3" />
              Closest
            </button>
            <button
              onClick={() => setSortOrder('desc')}
              title="Newest first"
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                sortOrder === 'desc' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ArrowDownUp className="w-3 h-3" />
              Newest
            </button>
          </div>

          <button
            onClick={() => setShowPast(p => !p)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors border ${
              showPast
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
            }`}
          >
            {showPast ? 'Hiding past' : 'Show past'}
          </button>
          <button
            onClick={() => { setEditingEvent(null); setShowModal(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Event
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-xl border border-slate-200">
          <CalendarDays className="w-8 h-8 text-slate-200 mb-3" />
          <p className="text-sm font-semibold text-slate-500 mb-1">No events yet</p>
          <p className="text-xs text-slate-400 mb-5">Add your first event to get started.</p>
          <button
            onClick={() => { setEditingEvent(null); setShowModal(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Event
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map(event => {
            const isPast = event.event_date < today;
            return (
              <div
                key={event.id}
                className={`flex items-start gap-4 bg-white rounded-xl border p-4 transition-colors ${
                  isPast ? 'border-slate-100 opacity-60' : 'border-slate-200'
                }`}
              >
                {/* Image thumbnail */}
                <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center">
                  {event.image_url ? (
                    <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
                  ) : (
                    <CalendarDays className="w-6 h-6 text-slate-300" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{event.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        {event.date_display}
                        {isPast && <span className="ml-1 px-1.5 py-px bg-slate-100 text-slate-400 text-[9px] font-black uppercase rounded-full">Past</span>}
                      </p>
                      {event.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{event.description}</p>
                      )}
                      {event.event_url && (
                        <a
                          href={event.event_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-700 mt-1 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {event.event_url.replace(/^https?:\/\//, '').split('/')[0]}
                        </a>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => { setEditingEvent(event); setShowModal(true); }}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Edit event"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(event.id)}
                        disabled={deletingId === event.id}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Delete event"
                      >
                        {deletingId === event.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />
                        }
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <EventFormModal
          siteId={siteId}
          event={editingEvent}
          onSave={handleSaved}
          onClose={() => { setShowModal(false); setEditingEvent(null); }}
        />
      )}
    </div>
  );
}
