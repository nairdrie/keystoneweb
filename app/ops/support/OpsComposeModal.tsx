'use client';

import { useEffect, useState } from 'react';
import { X, Send, AlertCircle, Loader2, ChevronDown } from 'lucide-react';
import EmailSignaturePreview from '@/app/components/email/EmailSignaturePreview';

interface Props {
  availableFromEmails: string[];
  senderName: string;
  onClose: () => void;
  onSent: () => void;
}

export default function OpsComposeModal({
  availableFromEmails,
  senderName,
  onClose,
  onSent,
}: Props) {
  const [fromEmail, setFromEmail] = useState(availableFromEmails[0] ?? '');
  const [to, setTo] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showReplyTo, setShowReplyTo] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape' && !sending) onClose();
    }
    window.addEventListener('keydown', onEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onEsc);
      document.body.style.overflow = '';
    };
  }, [onClose, sending]);

  async function handleSend() {
    setError(null);
    if (!to.trim()) { setError('Add at least one recipient.'); return; }
    if (!subject.trim()) { setError('Subject is required.'); return; }
    if (!body.trim()) { setError('Message body is required.'); return; }

    setSending(true);
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
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'Failed to send');
        return;
      }
      onSent();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSending(false);
    }
  }

  if (availableFromEmails.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div className="rounded-xl border border-gray-800 bg-gray-950 p-6 text-sm text-gray-400">
          No sender email assigned to your account. Contact an admin.
          <button onClick={onClose} className="ml-3 text-emerald-400 underline">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-2xl sm:rounded-xl border border-gray-800 bg-gray-950 shadow-2xl flex flex-col max-h-[100dvh] sm:max-h-[90vh]">
        <header className="flex-none flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-bold text-white">New message</h2>
          <button
            onClick={onClose}
            disabled={sending}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          {/* From */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-gray-500 w-16 shrink-0">From</label>
            <div className="relative flex-1">
              {availableFromEmails.length === 1 ? (
                <span className="text-sm font-mono text-gray-300">{availableFromEmails[0]}</span>
              ) : (
                <>
                  <select
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                    className="appearance-none w-full text-sm font-mono bg-transparent border-0 border-b border-gray-800 text-white focus:border-gray-500 focus:outline-none py-1 pr-8"
                  >
                    {availableFromEmails.map((e) => (
                      <option key={e} value={e} className="bg-gray-900">{e}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </>
              )}
            </div>
          </div>

          {/* To */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-gray-500 w-16 shrink-0">To</label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="flex-1 text-sm bg-transparent border-0 border-b border-gray-800 text-white placeholder-gray-600 focus:border-gray-500 focus:outline-none py-1"
            />
            {!showReplyTo && (
              <button
                type="button"
                onClick={() => setShowReplyTo(true)}
                className="text-[11px] font-semibold text-gray-500 hover:text-gray-300 shrink-0"
              >
                Reply-To
              </button>
            )}
          </div>

          {showReplyTo && (
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-gray-500 w-16 shrink-0">Reply-To</label>
              <input
                type="email"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                placeholder="other@keystoneweb.ca (optional)"
                className="flex-1 text-sm bg-transparent border-0 border-b border-gray-800 text-white placeholder-gray-600 focus:border-gray-500 focus:outline-none py-1"
              />
            </div>
          )}

          {/* Subject */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-gray-500 w-16 shrink-0">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="flex-1 text-sm bg-transparent border-0 border-b border-gray-800 text-white focus:border-gray-500 focus:outline-none py-1"
            />
          </div>

          {/* Body */}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            placeholder="Write your message…"
            className="w-full rounded-md border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600 resize-y"
          />

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Signature Preview</label>
            <EmailSignaturePreview senderName={senderName} fromEmail={fromEmail} />
          </div>

          {error && (
            <div className="flex items-center gap-1.5 text-xs text-red-400">
              <AlertCircle className="w-3.5 h-3.5" /> {error}
            </div>
          )}
        </div>

        <footer className="flex-none flex items-center justify-between px-4 py-3 border-t border-gray-800">
          <p className="text-[11px] text-gray-500 font-mono">
            Sending from {fromEmail}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={sending}
              className="text-xs font-semibold text-gray-400 hover:text-red-400 px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
            >
              Discard
            </button>
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-500 disabled:opacity-50 transition-colors"
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Send
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
