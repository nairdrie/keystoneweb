'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function MarketingSettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Form state
  const [googleCustomerId, setGoogleCustomerId] = useState('');
  const [googleRefreshToken, setGoogleRefreshToken] = useState('');
  const [metaAdAccountId, setMetaAdAccountId] = useState('');
  const [metaAccessToken, setMetaAccessToken] = useState('');
  const [metaPageId, setMetaPageId] = useState('');
  const [metaInstagramId, setMetaInstagramId] = useState('');
  const [monthlyBudgetLimit, setMonthlyBudgetLimit] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch('/api/ops/marketing/settings');
      const data = await res.json();
      if (data.settings) {
        const s = data.settings;
        setSettings(s);
        setGoogleCustomerId(s.google_ads_customer_id || '');
        setGoogleRefreshToken(s.google_ads_refresh_token || '');
        setMetaAdAccountId(s.meta_ad_account_id || '');
        setMetaAccessToken(s.meta_access_token || '');
        setMetaPageId(s.meta_page_id || '');
        setMetaInstagramId(s.meta_instagram_actor_id || '');
        setMonthlyBudgetLimit(s.monthly_budget_limit_cents ? String(s.monthly_budget_limit_cents / 100) : '');
      }
    } catch {
      setMessage('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage('');

    try {
      const res = await fetch('/api/ops/marketing/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          google_ads_customer_id: googleCustomerId || null,
          google_ads_refresh_token: googleRefreshToken || null,
          meta_ad_account_id: metaAdAccountId || null,
          meta_access_token: metaAccessToken || null,
          meta_page_id: metaPageId || null,
          meta_instagram_actor_id: metaInstagramId || null,
          monthly_budget_limit_cents: monthlyBudgetLimit ? Math.round(parseFloat(monthlyBudgetLimit) * 100) : null,
        }),
      });

      if (!res.ok) throw new Error('Failed to save');
      setMessage('Settings saved successfully');
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-gray-500 py-20 text-center">Loading settings...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <Link href="/marketing" className="text-sm text-gray-500 hover:text-gray-300 mb-2 inline-block">
          &larr; Marketing
        </Link>
        <h1 className="text-2xl font-bold text-white">Marketing Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Connect ad platform accounts and configure budget limits.
        </p>
      </div>

      {message && (
        <div className={`rounded-lg p-3 text-sm ${
          message.startsWith('Error') ? 'bg-red-900/20 text-red-400 border border-red-800/30' : 'bg-emerald-900/20 text-emerald-400 border border-emerald-800/30'
        }`}>
          {message}
        </div>
      )}

      {/* Google Ads */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Google Ads</h2>
          <span className={`text-xs px-2 py-0.5 rounded ${
            googleCustomerId ? 'text-emerald-400 bg-emerald-400/10' : 'text-gray-500 bg-gray-800'
          }`}>
            {googleCustomerId ? 'Connected' : 'Not Connected'}
          </span>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Customer ID</label>
            <input
              type="text"
              value={googleCustomerId}
              onChange={e => setGoogleCustomerId(e.target.value)}
              placeholder="123-456-7890"
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">OAuth Refresh Token</label>
            <input
              type="password"
              value={googleRefreshToken}
              onChange={e => setGoogleRefreshToken(e.target.value)}
              placeholder="Paste refresh token from OAuth flow"
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>
        <p className="text-xs text-gray-600">
          Requires GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID, and GOOGLE_ADS_CLIENT_SECRET env vars.
        </p>
      </div>

      {/* Meta Ads */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Meta / Instagram Ads</h2>
          <span className={`text-xs px-2 py-0.5 rounded ${
            metaAdAccountId ? 'text-emerald-400 bg-emerald-400/10' : 'text-gray-500 bg-gray-800'
          }`}>
            {metaAdAccountId ? 'Connected' : 'Not Connected'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Ad Account ID</label>
            <input
              type="text"
              value={metaAdAccountId}
              onChange={e => setMetaAdAccountId(e.target.value)}
              placeholder="act_123456789"
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Page ID</label>
            <input
              type="text"
              value={metaPageId}
              onChange={e => setMetaPageId(e.target.value)}
              placeholder="Facebook Page ID"
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Instagram Actor ID</label>
            <input
              type="text"
              value={metaInstagramId}
              onChange={e => setMetaInstagramId(e.target.value)}
              placeholder="Instagram Business Account ID"
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Access Token</label>
            <input
              type="password"
              value={metaAccessToken}
              onChange={e => setMetaAccessToken(e.target.value)}
              placeholder="Long-lived access token"
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>
        <p className="text-xs text-gray-600">
          Requires META_APP_ID and META_APP_SECRET env vars.
        </p>
      </div>

      {/* Budget Limit */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Budget</h2>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Monthly Budget Limit ($)</label>
          <input
            type="number"
            value={monthlyBudgetLimit}
            onChange={e => setMonthlyBudgetLimit(e.target.value)}
            placeholder="No limit"
            min="0"
            step="1"
            className="w-64 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-emerald-500 focus:outline-none"
          />
          <p className="text-xs text-gray-600 mt-1">
            Total monthly ad spend cap across all campaigns. Leave empty for no limit.
          </p>
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}
