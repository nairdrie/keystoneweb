'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import DOMPurify from 'isomorphic-dompurify';

type ThreadMessage = {
  id: string;
  from_email: string;
  from_name: string | null;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  created_at: string;
  thread_id: string | null;
};

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
  resend_email_id: string | null;
  thread_id: string | null;
  created_at: string;
  updated_at: string;
  thread_messages?: ThreadMessage[];
};

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const SENDER_OPTIONS = [
  { email: 'support@keystoneweb.ca', name: 'Keystone Support' },
  { email: 'nick@keystoneweb.ca', name: 'Nick' },
];

const STATUS_STYLES: Record<string, string> = {
  open: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  in_progress: 'text-sky-400 bg-sky-400/10 border-sky-400/30',
  resolved: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  closed: 'text-gray-500 bg-gray-800 border-gray-700',
};

/** Strip the hidden thread ref token from displayed body text */
function cleanBody(text: string | null): string | null {
  if (!text) return text;
  return text.replace(/\n*ref:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\s*$/i, '').trimEnd();
}

export default function SupportTicketPage() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<SupportRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');

  // Reply state
  const [replying, setReplying] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [replySenderIndex, setReplySenderIndex] = useState(0);

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

  async function sendReply() {
    if (!replyBody.trim()) return;
    setReplying(true);

    const sender = SENDER_OPTIONS[replySenderIndex];

    try {
      const res = await fetch(`/api/ops/support/${id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromEmail: sender.email,
          fromName: sender.name,
          bodyText: replyBody,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setTicket(updated);
        setNotes(updated.notes ?? '');
        setReplyBody('');
        alert('Reply sent successfully!');
      } else {
        const err = await res.json();
        alert(`Failed to send: ${err.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred while sending the reply.');
    } finally {
      setReplying(false);
    }
  }

  async function deleteTicket() {
    if (!confirm('Are you sure you want to permanently delete this ticket? This cannot be undone.')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ops/support/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        window.location.href = '/support';
      } else {
        alert('Failed to delete ticket.');
        setSaving(false);
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred while deleting.');
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        Loading...
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="py-24 text-center text-gray-500">
        Ticket not found.{' '}
        <Link href="/support" className="text-emerald-400 underline">
          Back to support
        </Link>
      </div>
    );
  }

  const threadMessages = ticket.thread_messages ?? [];
  const hasThread = threadMessages.length > 1;

  return (
    <div className="max-w-3xl space-y-8 pb-12">
      <div className="flex items-center gap-3">
        <Link
          href="/support"
          className="text-sm text-gray-500 hover:text-white transition-colors"
        >
          &larr; Support
        </Link>
        <span className={`rounded border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[ticket.status] ?? STATUS_STYLES.open}`}>
          {ticket.status.replace('_', ' ')}
        </span>
        {hasThread && (
          <span className="text-xs text-gray-500">
            {threadMessages.length} messages in thread
          </span>
        )}
      </div>

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">{ticket.subject || '(no subject)'}</h1>
        <p className="mt-1 text-sm text-gray-400">
          From{' '}
          <span className="text-gray-200">
            {ticket.from_name ? `${ticket.from_name} <${ticket.from_email}>` : ticket.from_email}
          </span>
          {' \u00b7 '}
          <time className="text-gray-500">
            {new Date(ticket.created_at).toLocaleString('en-CA', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </time>
        </p>
      </div>

      {/* Conversation thread */}
      {hasThread ? (
        <div className="space-y-3">
          {threadMessages.map((msg, i) => {
            const isRoot = !msg.thread_id;
            const bodyClean = cleanBody(msg.body_text);
            return (
              <div
                key={msg.id}
                className={`rounded-lg border p-4 overflow-hidden ${
                  isRoot
                    ? 'border-gray-800 bg-gray-900'
                    : 'border-gray-800/60 bg-gray-900/60 ml-4'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-400">
                    <span className="text-gray-300 font-medium">
                      {msg.from_name || msg.from_email}
                    </span>
                    {msg.from_name && (
                      <span className="text-gray-600 ml-1">&lt;{msg.from_email}&gt;</span>
                    )}
                  </p>
                  <time className="text-xs text-gray-600">
                    {new Date(msg.created_at).toLocaleString('en-CA', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </time>
                </div>
                {bodyClean ? (
                  <pre className="whitespace-pre-wrap text-sm text-gray-300 font-sans leading-relaxed">
                    {bodyClean}
                  </pre>
                ) : msg.body_html ? (
                  <div
                    className="prose prose-invert prose-sm max-w-none text-gray-300"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(msg.body_html) }}
                  />
                ) : (
                  <p className="text-gray-600 text-sm italic">No message body.</p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Single message — no thread */
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-5 overflow-hidden">
          {ticket.body_text ? (
            <pre className="whitespace-pre-wrap text-sm text-gray-300 font-sans leading-relaxed">
              {cleanBody(ticket.body_text)}
            </pre>
          ) : ticket.body_html ? (
            <div
              className="prose prose-invert prose-sm max-w-none text-gray-300"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(ticket.body_html) }}
            />
          ) : (
            <p className="text-gray-600 text-sm italic">No message body content found.</p>
          )}
        </div>
      )}

      {/* Reply Section */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="bg-gray-800 px-4 py-3 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Reply to Customer</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Send as:</span>
            <select
              value={replySenderIndex}
              onChange={(e) => setReplySenderIndex(Number(e.target.value))}
              disabled={replying}
              className="rounded-md border border-gray-600 bg-gray-700 px-2 py-1 text-xs text-white focus:outline-none focus:border-gray-500"
            >
              {SENDER_OPTIONS.map((opt, i) => (
                <option key={i} value={i}>
                  {opt.name} &lt;{opt.email}&gt;
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <textarea
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            rows={5}
            placeholder="Write your reply here..."
            className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-y"
            disabled={replying}
          />
          <div className="flex justify-end">
            <button
              onClick={sendReply}
              disabled={replying || !replyBody.trim()}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
            >
              {replying ? 'Sending...' : 'Send Reply via Email'}
            </button>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 pt-4 border-t border-gray-800 items-end">
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
        <div className="sm:col-span-2 flex justify-end">
          <button
            onClick={deleteTicket}
            disabled={saving}
            className="rounded-md bg-red-900/30 px-4 py-1.5 text-sm font-medium text-red-400 hover:bg-red-900/50 transition-colors disabled:opacity-50"
          >
            {saving ? 'Processing...' : 'Delete Ticket'}
          </button>
        </div>
      </div>

      {/* Internal notes */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Internal Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Add notes for yourself..."
          className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-none"
        />
        <button
          onClick={() => update({ notes })}
          disabled={saving || notes === (ticket.notes ?? '')}
          className="mt-2 rounded-md bg-gray-700 px-4 py-1.5 text-sm text-white hover:bg-gray-600 transition-colors disabled:opacity-40"
        >
          {saving ? 'Saving...' : 'Save notes'}
        </button>
      </div>

      <p className="text-xs text-gray-700 pb-8">
        Last updated {new Date(ticket.updated_at).toLocaleString('en-CA')}
      </p>
    </div>
  );
}
