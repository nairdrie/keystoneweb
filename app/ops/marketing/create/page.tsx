'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CHANNEL_LABELS, CHANNEL_CAMPAIGN_TYPES, CAMPAIGN_TYPE_LABELS,
  type MarketingChannel, type CampaignType,
} from '@/lib/marketing/types';

type Step = 'channel' | 'context' | 'review';

const KEYSTONEWEB_DEFAULT_CONTEXT = {
  businessName: 'Keystone Web',
  businessType: 'SaaS / Website Builder',
  description: 'Scalable, cost-effective multi-tenant CMS platform that enables unlimited website creation. Single codebase, infinite sites. 99% cost reduction vs traditional hosting.',
  tagline: 'Build Your Business Online',
  websiteUrl: 'https://keystoneweb.ca',
  services: [
    { name: 'Website Builder', description: 'Drag-and-drop visual editor with AI assistance', price: '$30/mo' },
    { name: 'E-Commerce', description: 'Full online store with Stripe payments', price: 'Included' },
    { name: 'Booking System', description: 'Service scheduling with availability management', price: 'Included' },
    { name: 'Membership Portal', description: 'Member registration, tiers, and content gating', price: 'Included' },
  ],
  uniqueSellingPoints: [
    'AI-powered site builder',
    'All-in-one platform (website + store + bookings + memberships)',
    'Custom domains included with Pro plan',
    'Free domain with Pro subscription',
    '99% cheaper than traditional website hosting',
  ],
  location: 'Canada',
  targetAudience: 'Small business owners, entrepreneurs, freelancers, and non-profits looking for an affordable, easy-to-use website solution',
};

export default function CreateCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('channel');
  const [channel, setChannel] = useState<MarketingChannel | ''>('');
  const [campaignType, setCampaignType] = useState<CampaignType | ''>('');
  const [context, setContext] = useState(KEYSTONEWEB_DEFAULT_CONTEXT);
  const [additionalContext, setAdditionalContext] = useState('');
  const [generatedResult, setGeneratedResult] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Budget
  const [dailyBudget, setDailyBudget] = useState('10');
  const [totalBudget, setTotalBudget] = useState('300');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  async function handleGenerate() {
    if (!channel || !campaignType) return;
    setGenerating(true);
    setError('');

    try {
      const res = await fetch('/api/ops/marketing/campaigns/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          campaignType,
          context: { ...context, additionalContext },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setGeneratedResult(data.result);
      setStep('review');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave(status: 'draft' | 'approved') {
    if (!generatedResult || !channel || !campaignType) return;
    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/ops/marketing/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: generatedResult.name,
          channel,
          campaign_type: campaignType,
          content: generatedResult.content,
          targeting: generatedResult.targeting,
          daily_budget_cents: Math.round(parseFloat(dailyBudget) * 100),
          total_budget_cents: Math.round(parseFloat(totalBudget) * 100),
          start_date: startDate || null,
          end_date: endDate || null,
          ai_generated: true,
          ai_rationale: generatedResult.rationale,
          status,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');

      router.push(`/marketing/campaigns/${data.campaign.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <Link href="/marketing" className="text-sm text-gray-500 hover:text-gray-300 mb-2 inline-block">
          &larr; Marketing
        </Link>
        <h1 className="text-2xl font-bold text-white">Create Campaign</h1>
        <p className="mt-1 text-sm text-gray-500">
          AI will generate campaign content based on your business context.
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex gap-2 text-xs">
        {(['channel', 'context', 'review'] as Step[]).map((s, i) => (
          <div key={s} className={`flex items-center gap-1.5 ${step === s ? 'text-emerald-400' : 'text-gray-600'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              step === s ? 'bg-emerald-400/20 text-emerald-400' : 'bg-gray-800 text-gray-600'
            }`}>
              {i + 1}
            </span>
            <span className="capitalize">{s}</span>
            {i < 2 && <span className="text-gray-700 mx-1">&rarr;</span>}
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-lg bg-red-900/20 border border-red-800/30 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Step 1: Channel Selection */}
      {step === 'channel' && (
        <div className="space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-300">Select Channel</label>
            <div className="grid grid-cols-3 gap-3">
              {(Object.entries(CHANNEL_LABELS) as [MarketingChannel, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => {
                    setChannel(key);
                    setCampaignType(CHANNEL_CAMPAIGN_TYPES[key][0]);
                  }}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    channel === key
                      ? 'border-emerald-500 bg-emerald-500/10 text-white'
                      : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <p className="font-medium">{label}</p>
                  <p className="text-xs mt-1 text-gray-500">
                    {CHANNEL_CAMPAIGN_TYPES[key].map(t => CAMPAIGN_TYPE_LABELS[t]).join(', ')}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {channel && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-300">Campaign Type</label>
              <div className="flex gap-2 flex-wrap">
                {CHANNEL_CAMPAIGN_TYPES[channel].map(type => (
                  <button
                    key={type}
                    onClick={() => setCampaignType(type)}
                    className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                      campaignType === type
                        ? 'border-emerald-500 bg-emerald-500/10 text-white'
                        : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    {CAMPAIGN_TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {channel && campaignType && (
            <button
              onClick={() => setStep('context')}
              className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
            >
              Next: Business Context &rarr;
            </button>
          )}
        </div>
      )}

      {/* Step 2: Business Context */}
      {step === 'context' && (
        <div className="space-y-6">
          <p className="text-sm text-gray-400">
            The context below is pre-filled for KeystoneWeb. Add any additional context for this specific campaign.
          </p>

          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-gray-500">Business:</span> <span className="text-gray-300">{context.businessName}</span></div>
              <div><span className="text-gray-500">Type:</span> <span className="text-gray-300">{context.businessType}</span></div>
              <div><span className="text-gray-500">Website:</span> <span className="text-gray-300">{context.websiteUrl}</span></div>
              <div><span className="text-gray-500">Location:</span> <span className="text-gray-300">{context.location}</span></div>
            </div>
            <div>
              <span className="text-gray-500">Target Audience:</span>
              <p className="text-gray-300 text-xs mt-0.5">{context.targetAudience}</p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-300 block mb-2">
              Additional Context for This Campaign
            </label>
            <textarea
              value={additionalContext}
              onChange={e => setAdditionalContext(e.target.value)}
              placeholder="e.g., Promoting our new AI builder feature launch, targeting Canadian small businesses..."
              rows={4}
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Budget */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-300">Budget & Schedule</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Daily Budget ($)</label>
                <input
                  type="number"
                  value={dailyBudget}
                  onChange={e => setDailyBudget(e.target.value)}
                  min="1"
                  step="1"
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Total Budget ($)</label>
                <input
                  type="number"
                  value={totalBudget}
                  onChange={e => setTotalBudget(e.target.value)}
                  min="1"
                  step="1"
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('channel')}
              className="rounded-lg bg-gray-800 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
            >
              &larr; Back
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
            >
              {generating ? 'Generating with AI...' : 'Generate Campaign with AI'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review Generated Content */}
      {step === 'review' && generatedResult && (
        <div className="space-y-6">
          <div className="rounded-lg border border-violet-800/30 bg-violet-900/10 p-5">
            <h2 className="text-sm font-semibold text-violet-400 uppercase tracking-wider mb-2">AI Rationale</h2>
            <p className="text-sm text-gray-300">{generatedResult.rationale}</p>
          </div>

          <div className="rounded-lg border border-gray-800 bg-gray-900 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Campaign Name</h2>
            <p className="text-white font-medium">{generatedResult.name}</p>
          </div>

          <div className="rounded-lg border border-gray-800 bg-gray-900 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Generated Content</h2>
            <pre className="text-xs text-gray-400 bg-gray-950 rounded p-3 overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(generatedResult.content, null, 2)}
            </pre>
          </div>

          {generatedResult.targeting && (
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Targeting</h2>
              <pre className="text-xs text-gray-400 bg-gray-950 rounded p-3 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(generatedResult.targeting, null, 2)}
              </pre>
            </div>
          )}

          <div className="rounded-lg border border-gray-800 bg-gray-900 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Budget</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Daily:</span> <span className="text-white">${dailyBudget}</span></div>
              <div><span className="text-gray-500">Total:</span> <span className="text-white">${totalBudget}</span></div>
              <div><span className="text-gray-500">Start:</span> <span className="text-white">{startDate || 'Immediately'}</span></div>
              <div><span className="text-gray-500">End:</span> <span className="text-white">{endDate || 'Until budget exhausted'}</span></div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('context')}
              className="rounded-lg bg-gray-800 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
            >
              &larr; Back
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="rounded-lg bg-gray-800 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {generating ? 'Regenerating...' : 'Regenerate'}
            </button>
            <button
              onClick={() => handleSave('draft')}
              disabled={saving}
              className="rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save as Draft'}
            </button>
            <button
              onClick={() => handleSave('approved')}
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save & Approve'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
