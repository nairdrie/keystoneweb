'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

type SupportRequest = {
  id: string;
  from_email: string;
  from_name: string | null;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  status: string;
  priority: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

const STATUS_STYLES: Record<string, string> = {
  open: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  in_progress: 'text-sky-400 bg-sky-400/10 border-sky-400/30',
  resolved: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  closed: 'text-gray-500 bg-gray-800 border-gray-700',
};

export default function SupportTicketPage() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<SupportRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetch(`/api/ops/support/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setTicket(data);
        setNotes(data.notes ?? '');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  async function update(patch: Partial<SupportRequest>) {
    setSaving(true);
    const res = await fetch(`/api/ops/support/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const updated = await res.json();
      setTicket(updated);
      setNotes(updated.notes ?? '');
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        Loading…
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="py-24 text-center text-gray-500">
        Ticket not found.{' '}
        <Link href="/ops/support" className="text-emerald-400 underline">
          Back to support
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/ops/support"
          className="text-sm text-gray-500 hover:text-white transition-colors"
        >
          ← Support
        </Link>
        <span className={`rounded border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[ticket.status] ?? STATUS_STYLES.open}`}>
          {ticket.status.replace('_', ' ')}
        </span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">{ticket.subject || '(no subject)'}</h1>
        <p className="mt-1 text-sm text-gray-400">
          From{' '}
          <span className="text-gray-200">
            {ticket.from_name ? `${ticket.from_name} <${ticket.from_email}>` : ticket.from_email}
          </span>
          {' · '}
          <time className="text-gray-500">
            {new Date(ticket.created_at).toLocaleString('en-CA', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </time>
        </p>
      </div>

      {/* Body */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-5">
        {ticket.body_text ? (
          <pre className="whitespace-pre-wrap text-sm text-gray-300 font-sans leading-relaxed">
            {ticket.body_text}
          </pre>
        ) : (
          <p className="text-gray-600 text-sm">No plain-text body.</p>
        )}
      </div>

      {/* Controls */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Status</label>
          <select
            value={ticket.status}
            onChange={(e) => update({ status: e.target.value })}
            disabled={saving}
            className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-gray-500 disabled:opacity-50"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Priority</label>
          <select
            value={ticket.priority}
            onChange={(e) => update({ priority: e.target.value })}
            disabled={saving}
            className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-gray-500 disabled:opacity-50"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Internal notes */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Internal Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Add notes for yourself…"
          className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-none"
        />
        <button
          onClick={() => update({ notes })}
          disabled={saving || notes === (ticket.notes ?? '')}
          className="mt-2 rounded-md bg-gray-700 px-4 py-1.5 text-sm text-white hover:bg-gray-600 transition-colors disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save notes'}
        </button>
      </div>

      <p className="text-xs text-gray-700">
        Last updated {new Date(ticket.updated_at).toLocaleString('en-CA')}
      </p>
    </div>
  );
}
