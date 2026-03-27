'use client';

import { useState } from 'react';

export default function EmailComposer({
  availableFromEmails,
}: {
  availableFromEmails: string[];
}) {
  const [fromEmail, setFromEmail] = useState(availableFromEmails[0] ?? '');
  const [to, setTo] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setResult(null);

    try {
      const res = await fetch('/api/ops/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject,
          body,
          from_email: fromEmail,
          reply_to: replyTo || undefined,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        setResult({ error: json.error });
      } else {
        setResult({ success: true });
        setTo('');
        setReplyTo('');
        setSubject('');
        setBody('');
      }
    } catch {
      setResult({ error: 'Network error. Please try again.' });
    } finally {
      setSending(false);
    }
  }

  if (availableFromEmails.length === 0) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-8 text-center text-gray-500">
        No sender email assigned to your account. Contact an admin.
      </div>
    );
  }

  return (
    <form onSubmit={handleSend} className="rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4">
      {/* From */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">From</label>
        {availableFromEmails.length === 1 ? (
          <div className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 font-mono">
            {availableFromEmails[0]}
          </div>
        ) : (
          <select
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
          >
            {availableFromEmails.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        )}
      </div>

      {/* To */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">To</label>
        <input
          type="email"
          required
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="recipient@example.com"
          className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
        />
      </div>

      {/* Reply-To (optional) */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">
          Reply-To <span className="text-gray-600">(optional — defaults to From)</span>
        </label>
        <input
          type="email"
          value={replyTo}
          onChange={(e) => setReplyTo(e.target.value)}
          placeholder="other@keystoneweb.ca"
          className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
        />
      </div>

      {/* Subject */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Subject</label>
        <input
          type="text"
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Email subject"
          className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
        />
      </div>

      {/* Body */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Message</label>
        <textarea
          required
          rows={10}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your message here…"
          className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-y"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={sending}
          className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
        >
          {sending ? 'Sending…' : 'Send Email'}
        </button>

        {result?.success && (
          <span className="text-sm text-emerald-400">Email sent successfully.</span>
        )}
        {result?.error && (
          <span className="text-sm text-red-400">{result.error}</span>
        )}
      </div>
    </form>
  );
}
