'use client';

import { useState, useEffect } from 'react';
import { X, Send, AlertCircle, Loader2, ChevronDown } from 'lucide-react';
import EmailRichEditor from './EmailRichEditor';

interface InboxAddress {
  id: string;
  address: string;
  kind: 'kswd_subdomain' | 'custom_domain';
  is_primary: boolean;
}

interface Props {
  siteId: string;
  addresses: InboxAddress[];
  defaultAddressId: string | null;
  onClose: () => void;
  onSent: () => void;
}

export default function ComposeModal({ siteId, addresses, defaultAddressId, onClose, onSent }: Props) {
  const [addressId, setAddressId] = useState<string | null>(defaultAddressId ?? addresses[0]?.id ?? null);
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) { if (e.key === 'Escape' && !sending) onClose(); }
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose, sending]);

  const activeAddress = addresses.find(a => a.id === addressId);

  async function handleSend() {
    setError(null);
    if (!to.trim()) { setError('Add at least one recipient.'); return; }
    if (!subject.trim()) { setError('Subject is required.'); return; }
    if (!bodyText.trim() && !bodyHtml.trim()) { setError('Message body is required.'); return; }

    setSending(true);
    try {
      const res = await fetch('/api/email/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ siteId, addressId, to, cc, bcc, subject, bodyHtml }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? 'Failed to send');
        return;
      }
      onSent();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-xl shadow-2xl flex flex-col max-h-[100dvh] sm:max-h-[90vh]">
        {/* Header */}
        <header className="flex-none flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h2 className="text-sm font-bold text-slate-900">New message</h2>
          <button onClick={onClose} disabled={sending} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg disabled:opacity-50">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          {/* From */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-slate-500 w-12 shrink-0">From</label>
            <div className="relative flex-1">
              <select
                value={addressId ?? ''}
                onChange={e => setAddressId(e.target.value || null)}
                className="appearance-none w-full text-sm font-mono bg-transparent border-0 border-b border-slate-200 focus:border-slate-900 focus:outline-none py-1 pr-8"
              >
                {addresses.map(a => (
                  <option key={a.id} value={a.id}>{a.address}{a.is_primary ? ' (primary)' : ''}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* To */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-slate-500 w-12 shrink-0">To</label>
            <input
              type="text"
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="customer@example.com, another@example.com"
              className="flex-1 text-sm bg-transparent border-0 border-b border-slate-200 focus:border-slate-900 focus:outline-none py-1"
            />
            {!showCcBcc && (
              <button onClick={() => setShowCcBcc(true)} className="text-[11px] font-semibold text-slate-400 hover:text-slate-700 shrink-0">
                Cc / Bcc
              </button>
            )}
          </div>

          {showCcBcc && (
            <>
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-slate-500 w-12 shrink-0">Cc</label>
                <input
                  type="text"
                  value={cc}
                  onChange={e => setCc(e.target.value)}
                  className="flex-1 text-sm bg-transparent border-0 border-b border-slate-200 focus:border-slate-900 focus:outline-none py-1"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-slate-500 w-12 shrink-0">Bcc</label>
                <input
                  type="text"
                  value={bcc}
                  onChange={e => setBcc(e.target.value)}
                  className="flex-1 text-sm bg-transparent border-0 border-b border-slate-200 focus:border-slate-900 focus:outline-none py-1"
                />
              </div>
            </>
          )}

          {/* Subject */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-slate-500 w-12 shrink-0">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="flex-1 text-sm bg-transparent border-0 border-b border-slate-200 focus:border-slate-900 focus:outline-none py-1"
            />
          </div>

          {/* Body */}
          <EmailRichEditor
            siteId={siteId}
            value={bodyHtml}
            onChange={(html, text) => { setBodyHtml(html); setBodyText(text); }}
            placeholder="Write your message…"
            minHeight={260}
          />

          {error && (
            <div className="flex items-center gap-1.5 text-xs text-red-600">
              <AlertCircle className="w-3.5 h-3.5" /> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="flex-none flex items-center justify-between px-4 py-3 border-t border-slate-200">
          <p className="text-[11px] text-slate-400 font-mono">
            {activeAddress ? `Sending from ${activeAddress.address}` : ''}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} disabled={sending} className="text-xs font-semibold text-slate-500 hover:text-slate-900 px-3 py-1.5 rounded-lg disabled:opacity-50">
              Discard
            </button>
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-700 disabled:opacity-50"
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
