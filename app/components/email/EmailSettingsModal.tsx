'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  X, Sparkles, Mail, Check, Loader2, AlertCircle, Crown, Trash2,
  Star, AtSign, Plus, ExternalLink,
} from 'lucide-react';

interface InboxAddress {
  id: string;
  address: string;
  kind: 'kswd_subdomain' | 'custom_domain';
  is_primary: boolean;
  resend_domain_id: string | null;
}

interface Props {
  siteId: string;
  isProUser: boolean;
  customDomain: string | null;
  aiDraftsEnabled: boolean;
  onAiDraftsChange: (enabled: boolean) => void;
  onAddressesChanged: (addresses: InboxAddress[]) => void;
  onClose: () => void;
}

const SUGGESTED_PREFIXES = ['hello', 'support', 'contact', 'info', 'hi'];

export default function EmailSettingsModal({
  siteId, isProUser, customDomain,
  aiDraftsEnabled, onAiDraftsChange, onAddressesChanged, onClose,
}: Props) {
  const [addresses, setAddresses] = useState<InboxAddress[]>([]);
  const [usage, setUsage] = useState<{ used: number; limit: number }>({ used: 0, limit: 1 });
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPrefix, setNewPrefix] = useState('hello');
  const [error, setError] = useState<string | null>(null);
  const [notificationEmail, setNotificationEmail] = useState('');
  const [notificationDraft, setNotificationDraft] = useState('');
  const [savingNotification, setSavingNotification] = useState(false);
  const [savingAi, setSavingAi] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [addrRes, settingsRes] = await Promise.all([
        fetch(`/api/email/addresses?siteId=${siteId}`, { credentials: 'include' }),
        fetch(`/api/bookings/settings?siteId=${siteId}`, { credentials: 'include' }),
      ]);
      if (addrRes.ok) {
        const d = await addrRes.json();
        setAddresses(d.addresses ?? []);
        setUsage(d.customAddressUsage ?? { used: 0, limit: 1 });
        onAddressesChanged(d.addresses ?? []);
      }
      if (settingsRes.ok) {
        const d = await settingsRes.json();
        const email = d?.settings?.notification_email ?? '';
        setNotificationEmail(email);
        setNotificationDraft(email);
      }
    } finally {
      setLoading(false);
    }
  }, [siteId, onAddressesChanged]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  async function handleAdd() {
    if (!newPrefix.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch('/api/email/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ siteId, localPart: newPrefix.trim().toLowerCase() }),
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.addonNeeded === 'extra_inbox_email') {
          setError(`You've used ${d.used}/${d.limit} of your inbox addresses. Request an Extra Inbox Email add-on to add more.`);
        } else {
          setError(d.error ?? 'Failed to add address');
        }
        return;
      }
      setShowAddForm(false);
      setNewPrefix('hello');
      setError(null);
      await refresh();
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(addressId: string) {
    if (!window.confirm('Remove this email address? Customers can no longer reach you here.')) return;
    const res = await fetch(`/api/email/addresses?siteId=${siteId}&addressId=${addressId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? 'Failed to remove');
      return;
    }
    setError(null);
    await refresh();
  }

  async function handleSetPrimary(addressId: string) {
    const res = await fetch('/api/email/addresses', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ siteId, addressId }),
    });
    if (!res.ok) return;
    await refresh();
  }

  async function saveNotificationEmail() {
    setSavingNotification(true);
    try {
      await fetch('/api/bookings/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ siteId, notification_email: notificationDraft || null }),
      });
      setNotificationEmail(notificationDraft);
    } finally {
      setSavingNotification(false);
    }
  }

  async function toggleAi() {
    const next = !aiDraftsEnabled;
    setSavingAi(true);
    try {
      await fetch('/api/contact/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ siteId, ai_replies_enabled: next }),
      });
      onAiDraftsChange(next);
    } finally {
      setSavingAi(false);
    }
  }

  function requestExtraAddressAddon() {
    // Open a pre-filled email to ops. The addon then flows through the
    // existing manual approval path (ops panel → user accepts & pays).
    const subject = encodeURIComponent('Extra Inbox Email add-on request');
    const body = encodeURIComponent(
      `Hi Keystone team,\n\nI'd like to add an additional inbox email address ($5/mo per address) to my account.\n\nSite ID: ${siteId}\n\nThanks!`
    );
    window.location.href = `mailto:support@keystoneweb.ca?subject=${subject}&body=${body}`;
  }

  const canAddCustom = !!customDomain && isProUser;
  const reachedLimit = usage.used >= usage.limit;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-xl sm:rounded-xl shadow-2xl flex flex-col max-h-[100dvh] sm:max-h-[90vh]">
        <header className="flex-none flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h2 className="text-sm font-bold text-slate-900">Email Settings</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-6">
          {/* AI Drafts */}
          <section>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> AI Drafts
            </h3>
            <div className="rounded-xl border border-slate-200 p-4 flex items-start gap-3">
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">Let AI draft replies for new messages</p>
                <p className="text-xs text-slate-500 mt-0.5">Drafts land in <strong>Needs Review</strong> for you to edit and send. We never send anything automatically.</p>
              </div>
              <button
                onClick={toggleAi}
                disabled={savingAi}
                className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${aiDraftsEnabled ? 'bg-violet-600' : 'bg-slate-300'} ${savingAi ? 'opacity-50' : ''}`}
                aria-pressed={aiDraftsEnabled}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${aiDraftsEnabled ? 'translate-x-4' : ''}`} />
              </button>
            </div>
          </section>

          {/* Inbox addresses */}
          <section>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <AtSign className="w-3.5 h-3.5" /> Inbox Addresses
            </h3>

            {loading ? (
              <div className="text-center py-4 text-slate-400 text-sm">
                <Loader2 className="w-4 h-4 inline animate-spin mr-2" /> Loading…
              </div>
            ) : (
              <div className="space-y-2">
                {addresses.map(a => (
                  <div key={a.id} className="rounded-lg border border-slate-200 p-3 flex items-center gap-2 flex-wrap">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-mono text-sm text-slate-900 truncate">{a.address}</span>
                    {a.is_primary && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-bold">Primary</span>
                    )}
                    {a.kind === 'kswd_subdomain' && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full font-bold">Free</span>
                    )}
                    <div className="ml-auto flex items-center gap-1">
                      {!a.is_primary && (
                        <button
                          onClick={() => handleSetPrimary(a.id)}
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Set as primary"
                        >
                          <Star className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {a.kind === 'custom_domain' && (
                        <button
                          onClick={() => handleDelete(a.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove address"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Add custom address */}
                {canAddCustom ? (
                  <>
                    {!showAddForm && !reachedLimit && (
                      <button
                        onClick={() => setShowAddForm(true)}
                        className="w-full rounded-lg border border-dashed border-slate-300 p-3 flex items-center justify-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 hover:border-slate-400 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add address on @{customDomain}
                      </button>
                    )}
                    {!showAddForm && reachedLimit && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs">
                        <p className="text-amber-900 font-semibold mb-1">
                          You&apos;re using {usage.used} of {usage.limit} inbox address{usage.limit !== 1 ? 'es' : ''}.
                        </p>
                        <p className="text-amber-800 mb-2">Need more? Request the Extra Inbox Email add-on ($5/month per address).</p>
                        <button
                          onClick={requestExtraAddressAddon}
                          className="inline-flex items-center gap-1 text-xs font-bold text-amber-900 underline underline-offset-2"
                        >
                          Request add-on <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    {showAddForm && (
                      <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 space-y-2">
                        <p className="text-xs font-semibold text-indigo-900">Pick a prefix for @{customDomain}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {SUGGESTED_PREFIXES.map(p => (
                            <button
                              key={p}
                              onClick={() => setNewPrefix(p)}
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                                newPrefix === p
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'bg-white text-indigo-700 border-indigo-200 hover:border-indigo-400'
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={newPrefix}
                            onChange={e => setNewPrefix(e.target.value.replace(/[^a-zA-Z0-9._+-]/g, '').toLowerCase())}
                            className="flex-1 px-2 py-1.5 text-sm font-mono border border-indigo-300 rounded bg-white"
                          />
                          <span className="px-2 py-1.5 text-sm font-mono text-slate-400">@{customDomain}</span>
                          <button
                            onClick={handleAdd}
                            disabled={adding || !newPrefix.trim()}
                            className="px-3 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          </button>
                          <button onClick={() => { setShowAddForm(false); setError(null); }} className="px-2 text-xs text-slate-500 hover:text-slate-900">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex items-start gap-2">
                    <Crown className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-semibold text-slate-900 mb-0.5">Want a branded inbox at your own domain?</p>
                      <p className="text-slate-600">
                        {!isProUser ? <><Link href="/pricing" className="underline font-semibold">Upgrade to Pro</Link> and connect a custom domain to enable email at your own domain.</>
                          : <>Connect a <Link href={`/admin/domains?siteId=${siteId}`} className="underline font-semibold">custom domain</Link> first, then add inbox addresses here.</>}
                      </p>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Notification email */}
          <section>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">External Notification Email</h3>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-2">Where Keystone sends a copy of new messages so you can preview them in your regular inbox.</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={notificationDraft}
                  onChange={e => setNotificationDraft(e.target.value)}
                  placeholder="you@business.ca"
                  className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-blue-400"
                />
                <button
                  onClick={saveNotificationEmail}
                  disabled={savingNotification || notificationDraft === notificationEmail}
                  className="px-3 py-2 text-xs font-bold bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50"
                >
                  {savingNotification ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">Leave blank to use your account email.</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
