'use client';

import { useState, useEffect, useCallback } from 'react';
import { User, Mail, Package, Calendar, Download, Trash2, LogOut, Loader2, CreditCard, Settings } from 'lucide-react';

interface MemberProfilePageProps {
  siteId: string;
  siteName?: string;
  palette: Record<string, string>;
}

export default function MemberProfilePage({ siteId, siteName, palette }: MemberProfilePageProps) {
  const [member, setMember] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const primary = palette.primary || '#374151';

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/membership/me', { credentials: 'include' });
      const data = await res.json();
      if (data.member) {
        setMember(data.member);
        setEditName(data.member.name || '');
      } else {
        // Not authenticated — redirect to signin
        window.location.href = '/signin?returnTo=/member';
      }
    } catch {
      window.location.href = '/signin?returnTo=/member';
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  async function handleSaveProfile() {
    setSaving(true);
    try {
      await fetch('/api/membership/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName }),
        credentials: 'include',
      });
      setMember((prev: any) => ({ ...prev, name: editName }));
      setEditing(false);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function handleExportData() {
    window.location.href = '/api/membership/me/export';
  }

  async function handleDeleteAccount() {
    try {
      await fetch('/api/membership/me', {
        method: 'DELETE',
        credentials: 'include',
      });
      window.location.href = '/?deleted=true';
    } catch {
      // ignore
    }
  }

  async function handleSignOut() {
    await fetch('/api/membership/signout', { method: 'POST', credentials: 'include' });
    window.location.href = '/';
  }

  async function handleManageBilling() {
    try {
      const res = await fetch('/api/membership/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnUrl: window.location.href }),
        credentials: 'include',
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!member) return null;

  const initials = member.name
    ? member.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : member.email[0].toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <a href="/" className="text-sm text-slate-400 hover:text-slate-600">&larr; Back to site</a>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>

        {/* Profile card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="flex items-center gap-4 mb-6">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold"
              style={{ backgroundColor: primary }}
            >
              {member.avatarUrl ? (
                <img src={member.avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div>
              {editing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg text-white"
                    style={{ backgroundColor: primary }}
                  >
                    {saving ? '...' : 'Save'}
                  </button>
                  <button onClick={() => setEditing(false)} className="text-xs text-slate-400">Cancel</button>
                </div>
              ) : (
                <h1 className="text-xl font-bold text-slate-900">
                  {member.name || 'Member'}
                  <button onClick={() => setEditing(true)} className="ml-2 text-xs text-slate-400 hover:text-slate-600">
                    Edit
                  </button>
                </h1>
              )}
              <p className="text-sm text-slate-500 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                {member.email}
              </p>
            </div>
          </div>

          {/* No membership yet (e.g. checkout was abandoned): choose one */}
          {!member.package && <ChooseMembership siteId={siteId} memberId={member.id} primary={primary} onJoined={fetchProfile} />}

          {/* Subscription info */}
          {member.package && (
            <div className="bg-slate-50 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5 text-slate-500" />
                  <div>
                    <p className="font-medium text-slate-900">{member.package.name}</p>
                    <p className="text-xs text-slate-500">
                      {member.package.price_cents > 0
                        ? `$${(member.package.price_cents / 100).toFixed(2)} ${member.package.currency}/${member.package.billing_interval}`
                        : 'Free tier'}
                    </p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  member.subscriptionStatus === 'active' ? 'bg-green-100 text-green-700' :
                  member.subscriptionStatus === 'trialing' ? 'bg-blue-100 text-blue-700' :
                  member.subscriptionStatus === 'past_due' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {member.subscriptionStatus === 'none' ? 'Free' : member.subscriptionStatus}
                </span>
              </div>
              {member.currentPeriodEnd && (
                <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {member.subscriptionStatus === 'active' ? 'Renews' : 'Expires'}{' '}
                  {new Date(member.currentPeriodEnd).toLocaleDateString()}
                </p>
              )}
              {member.subscriptionStatus === 'active' && (
                <button
                  onClick={handleManageBilling}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                  style={{ color: primary }}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Manage Billing
                </button>
              )}
            </div>
          )}

          {/* Member since */}
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Member since {new Date(member.signedUpAt).toLocaleDateString()}
          </div>
        </div>

        {/* Data & Privacy */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Data & Privacy
          </h2>
          <div className="space-y-3">
            <button
              onClick={handleExportData}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-left"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <div>
                <p className="text-sm font-medium text-slate-700">Download My Data</p>
                <p className="text-xs text-slate-400">Export all your personal data as JSON</p>
              </div>
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-red-200 hover:bg-red-50 transition-colors text-left"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
              <div>
                <p className="text-sm font-medium text-red-700">Delete My Account</p>
                <p className="text-xs text-red-400">Permanently remove all your data</p>
              </div>
            </button>
          </div>
        </div>

        {/* Delete confirmation modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
              <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Account?</h3>
              <p className="text-sm text-slate-600 mb-6">
                This will permanently delete your account, cancel any active subscriptions, and remove all your data. This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface PackageOption {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  billing_interval: string;
  stripe_price_id?: string | null;
}

/**
 * Packages the member can take: paid ones open Stripe checkout (authorized by the
 * member's own session), free ones are added to the account directly.
 */
function ChooseMembership({ siteId, memberId, primary, onJoined }: { siteId: string; memberId: string; primary: string; onJoined: () => void }) {
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/membership/packages?siteId=${encodeURIComponent(siteId)}`)
      .then((r) => r.json())
      .then((d) => setPackages((d.packages || []).filter((p: PackageOption) => !(p.price_cents > 0) || p.stripe_price_id)))
      .catch(() => setPackages([]));
  }, [siteId]);

  if (!packages.length) return null;

  const priceLabel = (p: PackageOption) => {
    if (!(p.price_cents > 0) || p.billing_interval === 'free') return 'Free';
    const amount = new Intl.NumberFormat('en-CA', { style: 'currency', currency: p.currency || 'CAD' }).format(p.price_cents / 100);
    return p.billing_interval === 'month' ? `${amount} / month` : p.billing_interval === 'year' ? `${amount} / year` : amount;
  };

  async function choose(p: PackageOption) {
    setBusy(p.id);
    setError('');
    try {
      if (!(p.price_cents > 0) || p.billing_interval === 'free') {
        const res = await fetch('/api/membership/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ joinFreePackageId: p.id }),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Could not add that membership');
        onJoined();
        return;
      }
      const res = await fetch('/api/membership/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          siteId,
          memberId,
          packageId: p.id,
          successUrl: `${window.location.origin}/member?joined=true`,
          cancelUrl: `${window.location.origin}/member`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not start checkout');
      window.location.href = data.url;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="bg-slate-50 rounded-xl p-4 mb-6">
      <h2 className="text-sm font-semibold text-slate-900 mb-1">Choose your membership</h2>
      <p className="text-xs text-slate-500 mb-3">Your account is ready. Pick a membership to get members-only access.</p>
      <div className="space-y-2">
        {packages.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 bg-white rounded-lg border border-slate-200 px-3 py-2">
            <div>
              <p className="text-sm font-medium text-slate-900">{p.name}</p>
              <p className="text-xs text-slate-500">{priceLabel(p)}</p>
            </div>
            <button
              onClick={() => choose(p)}
              disabled={!!busy}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white disabled:opacity-60"
              style={{ backgroundColor: primary }}
            >
              {busy === p.id ? '…' : p.price_cents > 0 && p.billing_interval !== 'free' ? 'Join & pay' : 'Join'}
            </button>
          </div>
        ))}
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
