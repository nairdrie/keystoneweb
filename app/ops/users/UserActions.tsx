'use client';

import { useState, useRef, useEffect } from 'react';
import { UserCircle, Ban, Unlock, CreditCard, ChevronDown, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';

interface UserActionsProps {
  userId: string;
  userEmail: string;
  isBanned: boolean;
  currentPlan: string;
  phone: string | null;
}

const SENDER_OPTIONS = [
  { email: 'nick@keystoneweb.ca', name: 'Nick' },
  { email: 'support@keystoneweb.ca', name: 'Keystone Support' },
];

export default function UserActions({ userId, userEmail, isBanned, currentPlan, phone }: UserActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPlanMenu, setShowShowPlanMenu] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [menuCoords, setMenuCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  // Contact form state
  const [contactSubject, setContactSubject] = useState('');
  const [contactBody, setContactBody] = useState('');
  const [contactSenderIndex, setContactSenderIndex] = useState(0);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (showPlanMenu && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuCoords({
        top: rect.bottom + window.scrollY,
        left: rect.right - 128 + window.scrollX,
      });
    }
  }, [showPlanMenu]);

  async function handleImpersonate() {
    if (!confirm(`Are you sure you want to login as ${userEmail}?`)) return;
    setLoading(true);
    try {
      const res = await fetch('/api/ops/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) window.location.href = 'https://keystoneweb.ca';
      else alert('Failed to impersonate');
    } finally {
      setLoading(false);
    }
  }

  async function toggleBan() {
    const action = isBanned ? 'unban' : 'ban';
    if (!confirm(`Are you sure you want to ${action} ${userEmail}?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/ops/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_banned: !isBanned }),
      });
      if (res.ok) router.refresh();
      else alert(`Failed to ${action}`);
    } finally {
      setLoading(false);
    }
  }

  async function changePlan(newPlan: string) {
    if (!confirm(`Change ${userEmail} to ${newPlan} plan?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/ops/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: newPlan }),
      });
      if (res.ok) {
        setShowShowPlanMenu(false);
        router.refresh();
      } else alert('Failed to update plan');
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }

  async function sendContactEmail() {
    if (!contactSubject.trim() || !contactBody.trim()) return;
    setSending(true);
    const sender = SENDER_OPTIONS[contactSenderIndex];
    try {
      const res = await fetch('/api/ops/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: userEmail,
          fromEmail: sender.email,
          fromName: sender.name,
          subject: contactSubject,
          bodyText: contactBody,
        }),
      });
      if (res.ok) {
        alert('Email sent!');
        setContactSubject('');
        setContactBody('');
        setShowContact(false);
      } else {
        const err = await res.json();
        alert(`Failed: ${err.error || 'Unknown error'}`);
      }
    } catch {
      alert('An error occurred.');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        {/* Contact */}
        <button
          onClick={() => setShowContact(true)}
          className="p-1.5 rounded-md bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          title="Contact User"
        >
          <Mail className="w-4 h-4" />
        </button>

        {/* Impersonate */}
        <button
          onClick={handleImpersonate}
          disabled={loading}
          className="p-1.5 rounded-md bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          title="Login As"
        >
          <UserCircle className="w-4 h-4" />
        </button>

        {/* Ban/Unban */}
        <button
          onClick={toggleBan}
          disabled={loading}
          className={`p-1.5 rounded-md transition-colors ${
            isBanned
              ? 'bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50'
              : 'bg-red-900/30 text-red-400 hover:bg-red-900/50'
          }`}
          title={isBanned ? 'Unban User' : 'Ban User'}
        >
          {isBanned ? <Unlock className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
        </button>

        {/* Plan Dropdown */}
        <div className="relative" ref={triggerRef}>
          <button
            onClick={() => setShowShowPlanMenu(!showPlanMenu)}
            disabled={loading}
            className="p-1.5 rounded-md bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors flex items-center gap-1"
            title="Change Plan"
          >
            <CreditCard className="w-4 h-4" />
            <ChevronDown className="w-3 h-3" />
          </button>

          {showPlanMenu && createPortal(
            <>
              <div
                className="fixed inset-0 z-[60]"
                onClick={() => setShowShowPlanMenu(false)}
              />
              <div
                className="absolute z-[70] mt-2 w-32 rounded-md bg-gray-800 border border-gray-700 shadow-xl overflow-hidden"
                style={{
                  top: menuCoords.top,
                  left: menuCoords.left
                }}
              >
                {['Free', 'Basic', 'Pro'].map((p) => (
                  <button
                    key={p}
                    onClick={() => changePlan(p)}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-700 transition-colors ${
                      currentPlan.toLowerCase().includes(p.toLowerCase()) ? 'text-emerald-400 font-bold' : 'text-gray-300'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </>,
            document.body
          )}
        </div>
      </div>

      {/* Contact Modal */}
      {showContact && createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-lg border border-gray-700 bg-gray-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
              <h3 className="text-sm font-semibold text-white">Contact User</h3>
              <button
                onClick={() => setShowContact(false)}
                className="text-gray-500 hover:text-white text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Quick copy info */}
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-md bg-gray-800 px-3 py-2">
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-sm text-white font-mono">{userEmail}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(userEmail, 'email')}
                    className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600 transition-colors"
                  >
                    {copied === 'email' ? 'Copied!' : 'Copy'}
                  </button>
                </div>

                {phone && (
                  <div className="flex items-center justify-between rounded-md bg-gray-800 px-3 py-2">
                    <div>
                      <p className="text-xs text-gray-500">Phone</p>
                      <p className="text-sm text-white font-mono">{phone}</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(phone, 'phone')}
                      className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600 transition-colors"
                    >
                      {copied === 'phone' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-gray-800" />

              {/* Send email form */}
              <div className="space-y-3">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Send Email</p>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 shrink-0">From:</span>
                  <select
                    value={contactSenderIndex}
                    onChange={(e) => setContactSenderIndex(Number(e.target.value))}
                    disabled={sending}
                    className="flex-1 rounded-md border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-gray-500"
                  >
                    {SENDER_OPTIONS.map((opt, i) => (
                      <option key={i} value={i}>
                        {opt.name} &lt;{opt.email}&gt;
                      </option>
                    ))}
                  </select>
                </div>

                <input
                  type="text"
                  value={contactSubject}
                  onChange={(e) => setContactSubject(e.target.value)}
                  placeholder="Subject"
                  disabled={sending}
                  className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
                />

                <textarea
                  value={contactBody}
                  onChange={(e) => setContactBody(e.target.value)}
                  rows={4}
                  placeholder="Message..."
                  disabled={sending}
                  className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-y"
                />

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowContact(false)}
                    className="rounded-md bg-gray-800 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={sendContactEmail}
                    disabled={sending || !contactSubject.trim() || !contactBody.trim()}
                    className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
                  >
                    {sending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
