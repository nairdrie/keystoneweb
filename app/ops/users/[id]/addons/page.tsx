'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Loader2, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { ADDON_TYPES, ADDON_PRICES } from '@/lib/addons';
import type { AddonType } from '@/lib/addons';

interface Addon {
  id: string;
  addon_type: AddonType;
  quantity: number;
  status: 'approved' | 'active' | 'cancelled';
  monthly_price: number;
  yearly_price: number;
  approved_by: string | null;
  approved_at: string | null;
  activated_at: string | null;
  cancelled_at: string | null;
  notes: string | null;
}

interface UserInfo {
  email: string;
  business_name: string | null;
}

interface SubscriptionInfo {
  subscription_plan: string | null;
  subscription_status: string | null;
  stripe_subscription_id: string | null;
}

const STATUS_STYLES = {
  approved: { icon: Clock, color: 'text-amber-400 bg-amber-400/10', label: 'Approved' },
  active: { icon: CheckCircle2, color: 'text-emerald-400 bg-emerald-400/10', label: 'Active' },
  cancelled: { icon: XCircle, color: 'text-red-400 bg-red-400/10', label: 'Cancelled' },
};

export default function ManageAddonsPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [selectedType, setSelectedType] = useState<AddonType>('extra_sites');
  const [quantity, setQuantity] = useState(1);
  const [monthlyPrice, setMonthlyPrice] = useState(ADDON_PRICES.extra_sites.monthly);
  const [yearlyPrice, setYearlyPrice] = useState(ADDON_PRICES.extra_sites.yearly);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchData();
  }, [userId]);

  useEffect(() => {
    const defaults = ADDON_PRICES[selectedType as AddonType];
    setMonthlyPrice(defaults.monthly);
    setYearlyPrice(defaults.yearly);
    if (selectedType === 'white_label') setQuantity(1);
  }, [selectedType]);

  async function fetchData() {
    try {
      const res = await fetch(`/api/ops/users/${userId}/addons`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setUserInfo(data.user);
      setSubscription(data.subscription);
      setAddons(data.addons || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function approveAddon() {
    setSaving(true);
    try {
      const res = await fetch(`/api/ops/users/${userId}/addons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addon_type: selectedType,
          quantity,
          monthly_price: monthlyPrice,
          yearly_price: yearlyPrice,
          notes: notes || undefined,
        }),
      });
      if (res.ok) {
        setNotes('');
        await fetchData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to approve add-on');
      }
    } catch {
      alert('An error occurred');
    } finally {
      setSaving(false);
    }
  }

  async function cancelAddon(addonType: string) {
    if (!confirm(`Cancel ${ADDON_TYPES[addonType as AddonType]?.label}? This will remove it from the user's subscription.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ops/users/${userId}/addons`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addon_type: addonType }),
      });
      if (res.ok) {
        await fetchData();
      } else {
        alert('Failed to cancel add-on');
      }
    } catch {
      alert('An error occurred');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  const activeAddons = addons.filter(a => a.status !== 'cancelled');
  const cancelledAddons = addons.filter(a => a.status === 'cancelled');

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => router.push('/ops/users')}
          className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Manage Add-Ons</h1>
          <p className="text-sm text-gray-400">{userInfo?.email} &middot; {subscription?.subscription_plan || 'No plan'}</p>
        </div>
      </div>

      {/* Current Add-Ons */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Current Add-Ons</h2>
        {activeAddons.length === 0 ? (
          <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-6 text-center text-sm text-gray-500">
            No add-ons configured for this user.
          </div>
        ) : (
          <div className="space-y-2">
            {activeAddons.map((addon) => {
              const typeInfo = ADDON_TYPES[addon.addon_type];
              const statusInfo = STATUS_STYLES[addon.status];
              const StatusIcon = statusInfo.icon;
              return (
                <div key={addon.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 p-4">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${statusInfo.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {statusInfo.label}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {addon.quantity > 1 ? `${addon.quantity}× ` : ''}{typeInfo?.label}
                      </p>
                      <p className="text-xs text-gray-500">
                        ${addon.monthly_price}/mo &middot; ${addon.yearly_price}/mo yearly
                        {addon.notes && <> &middot; {addon.notes}</>}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => cancelAddon(addon.addon_type)}
                    disabled={saving}
                    className="p-1.5 rounded bg-red-900/30 text-red-400 hover:bg-red-900/50 transition-colors"
                    title="Cancel Add-On"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add New Add-On Form */}
      <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-6">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Approve Add-On
        </h2>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Add-On Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as AddonType)}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
            >
              {(Object.entries(ADDON_TYPES) as [AddonType, { label: string }][]).map(([key, info]) => (
                <option key={key} value={key}>{info.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Quantity</label>
            <input
              type="number"
              min={1}
              max={50}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              disabled={selectedType === 'white_label'}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500 disabled:opacity-50"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Monthly Price ($/unit)</label>
            <input
              type="number"
              step="0.01"
              min={0}
              value={monthlyPrice}
              onChange={(e) => setMonthlyPrice(parseFloat(e.target.value) || 0)}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Yearly Price ($/unit/mo)</label>
            <input
              type="number"
              step="0.01"
              min={0}
              value={yearlyPrice}
              onChange={(e) => setYearlyPrice(parseFloat(e.target.value) || 0)}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Volume discount, enterprise deal"
            className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
          />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Total: <span className="text-white font-medium">${(monthlyPrice * quantity).toFixed(2)}/mo</span> or{' '}
            <span className="text-white font-medium">${(yearlyPrice * quantity).toFixed(2)}/mo yearly</span>
          </p>
          <button
            onClick={approveAddon}
            disabled={saving}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Approve Add-On'}
          </button>
        </div>
      </div>

      {/* Cancelled Add-Ons */}
      {cancelledAddons.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Cancelled</h2>
          <div className="space-y-2">
            {cancelledAddons.map((addon) => {
              const typeInfo = ADDON_TYPES[addon.addon_type];
              return (
                <div key={addon.id} className="flex items-center justify-between rounded-lg border border-gray-800/50 bg-gray-900/30 p-3 opacity-50">
                  <div>
                    <p className="text-sm text-gray-400">{typeInfo?.label}</p>
                    <p className="text-xs text-gray-600">
                      Cancelled {addon.cancelled_at ? new Date(addon.cancelled_at).toLocaleDateString() : ''}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
