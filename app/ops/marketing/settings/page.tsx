'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Connections {
  google_ads: boolean;
  meta_ads: boolean;
  email: boolean;
}

export default function MarketingSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [connections, setConnections] = useState<Connections>({ google_ads: false, meta_ads: false, email: false });
  const [monthlyBudgetLimit, setMonthlyBudgetLimit] = useState('');
  const [autoSuggest, setAutoSuggest] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch('/api/ops/marketing/settings');
      const data = await res.json();
      if (data.connections) setConnections(data.connections);
      if (data.settings) {
        setMonthlyBudgetLimit(data.settings.monthly_budget_limit_cents ? String(data.settings.monthly_budget_limit_cents / 100) : '');
        setAutoSuggest(data.settings.auto_suggest ?? true);
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
          monthly_budget_limit_cents: monthlyBudgetLimit ? Math.round(parseFloat(monthlyBudgetLimit) * 100) : null,
          auto_suggest: autoSuggest,
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

  const platforms = [
    {
      name: 'Google Ads',
      connected: connections.google_ads,
      envVars: ['GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_CLIENT_ID', 'GOOGLE_ADS_CLIENT_SECRET', 'GOOGLE_ADS_CUSTOMER_ID', 'GOOGLE_ADS_REFRESH_TOKEN'],
    },
    {
      name: 'Meta / Instagram Ads',
      connected: connections.meta_ads,
      envVars: ['META_APP_ID', 'META_APP_SECRET', 'META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID'],
    },
    {
      name: 'Email (Resend)',
      connected: connections.email,
      envVars: ['RESEND_API_KEY'],
    },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <Link href="/marketing" className="text-sm text-gray-500 hover:text-gray-300 mb-2 inline-block">
          &larr; Marketing
        </Link>
        <h1 className="text-2xl font-bold text-white">Marketing Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Platform connections are managed via environment variables. Budget limits are configured here.
        </p>
      </div>

      {message && (
        <div className={`rounded-lg p-3 text-sm ${
          message.startsWith('Error') ? 'bg-red-900/20 text-red-400 border border-red-800/30' : 'bg-emerald-900/20 text-emerald-400 border border-emerald-800/30'
        }`}>
          {message}
        </div>
      )}

      {/* Platform Connections */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Platform Connections</h2>
        <p className="text-xs text-gray-600">
          All ad platform credentials are set as environment variables (agency model). Keystone runs ads on behalf of customers from a single account.
        </p>
        <div className="space-y-3">
          {platforms.map(p => (
            <div key={p.name} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
              <div>
                <span className="text-sm text-gray-200">{p.name}</span>
                {!p.connected && (
                  <p className="text-xs text-gray-600 mt-0.5">
                    Missing: {p.envVars.join(', ')}
                  </p>
                )}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                p.connected
                  ? 'text-emerald-400 bg-emerald-400/10'
                  : 'text-gray-500 bg-gray-800'
              }`}>
                {p.connected ? 'Connected' : 'Not Connected'}
              </span>
            </div>
          ))}
        </div>
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

      {/* Preferences */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Preferences</h2>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={autoSuggest}
            onChange={e => setAutoSuggest(e.target.checked)}
            className="w-4 h-4 rounded border-gray-700 bg-gray-950 text-emerald-500 focus:ring-emerald-500"
          />
          <div>
            <span className="text-sm text-gray-200">AI auto-suggestions</span>
            <p className="text-xs text-gray-600">Allow AI to suggest campaign ideas based on performance data.</p>
          </div>
        </label>
      </div>

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
