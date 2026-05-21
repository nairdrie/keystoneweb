'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Sparkles, Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAdminContext } from '../../../admin-context';
import {
  CHANNEL_LABELS,
  CHANNEL_CAMPAIGN_TYPES,
  CAMPAIGN_TYPE_LABELS,
  type MarketingChannel,
  type CampaignType,
  type CampaignGenerationResult,
  type GoogleSearchContent,
  type GoogleDisplayContent,
} from '@/lib/marketing/types';
import { formatCents } from '@/lib/marketing/pricing';
import { AdPreview } from '../../_components/AdPreview';

type Step = 'goal' | 'generating' | 'review' | 'launch';

export default function NewCampaignPage() {
  const { siteId, siteTitle } = useAdminContext();
  const router = useRouter();

  const [step, setStep] = useState<Step>('goal');
  const [goal, setGoal] = useState('');
  const [channel, setChannel] = useState<MarketingChannel>('google_ads');
  const [campaignType, setCampaignType] = useState<CampaignType>('search');
  const [generated, setGenerated] = useState<CampaignGenerationResult | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [dailyBudget, setDailyBudget] = useState(2000); // $20 default
  const [editedContent, setEditedContent] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleGenerate() {
    setError(null);
    setStep('generating');
    try {
      const res = await fetch('/api/admin/marketing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          siteId,
          channel,
          campaignType,
          contextOverrides: goal ? { additionalContext: goal } : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'AI generation failed');
        setStep('goal');
        return;
      }
      setGenerated(data.result);
      setCampaignName(data.result.name);
      setEditedContent(data.result.content);
      setBusinessName(data.context?.businessName || siteTitle || '');
      if (data.result.suggestedDailyBudgetCents) {
        setDailyBudget(data.result.suggestedDailyBudgetCents);
      }
      setStep('review');
    } catch {
      setError('Network error');
      setStep('goal');
    }
  }

  async function handleLaunch() {
    if (!generated) return;
    setError(null);
    setSubmitting(true);
    try {
      // 1. Create draft
      const createRes = await fetch('/api/admin/marketing/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          siteId,
          name: campaignName,
          channel,
          campaign_type: campaignType,
          content: editedContent,
          targeting: generated.targeting,
          daily_budget_cents: dailyBudget,
          ai_generated: true,
          ai_rationale: generated.rationale,
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        setError(createData.error || 'Failed to create campaign');
        setSubmitting(false);
        return;
      }
      const campaignId = createData.campaign.id;

      // 2. Approve + launch
      const approveRes = await fetch(`/api/admin/marketing/campaigns/${campaignId}/approve`, {
        method: 'POST',
        credentials: 'include',
      });
      const approveData = await approveRes.json();
      if (!approveRes.ok) {
        if (approveRes.status === 402) {
          setError('Your wallet balance is too low to launch. Top up first.');
        } else {
          setError(approveData.error || 'Failed to launch campaign');
        }
        setSubmitting(false);
        return;
      }

      router.push(`/admin/marketing/campaigns/${campaignId}?siteId=${siteId}&just=launched`);
    } catch {
      setError('Network error');
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <Link
          href={`/admin/marketing?siteId=${siteId}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Marketing
        </Link>
        <h1 className="text-2xl font-black text-slate-900 mt-2">New campaign</h1>
        <p className="text-sm text-slate-500 mt-1">
          {step === 'goal' && 'Tell us your goal and AI will write a complete campaign you can review and edit.'}
          {step === 'generating' && 'Our AI is drafting your campaign…'}
          {step === 'review' && 'Edit anything before launching. Your wallet is debited at cost plus a small fee.'}
        </p>
      </div>

      <StepPills step={step} />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">{error}</div>
      )}

      {step === 'goal' && (
        <div className="space-y-5 bg-white border border-slate-200 rounded-xl p-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Channel</label>
            <div className="grid grid-cols-3 gap-2">
              {(['google_ads', 'meta_ads', 'email'] as MarketingChannel[]).map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setChannel(c);
                    setCampaignType(CHANNEL_CAMPAIGN_TYPES[c][0]);
                  }}
                  className={`px-3 py-2.5 rounded-lg border text-sm font-bold transition-colors ${
                    channel === c
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  {CHANNEL_LABELS[c]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Format</label>
            <div className="flex flex-wrap gap-2">
              {CHANNEL_CAMPAIGN_TYPES[channel].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setCampaignType(t)}
                  className={`px-3 py-1.5 rounded-md border text-xs font-bold transition-colors ${
                    campaignType === t
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  {CAMPAIGN_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Your goal (optional)</label>
            <textarea
              value={goal}
              onChange={e => setGoal(e.target.value)}
              rows={3}
              placeholder="e.g. Drive bookings for summer patio installations in the Toronto area"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
            />
            <p className="text-xs text-slate-400 mt-1">Leave blank to let AI pick a goal from your site content.</p>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-3 rounded-lg text-sm font-bold transition-colors"
          >
            <Sparkles className="w-4 h-4" /> Generate campaign with AI
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {step === 'generating' && (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-4" />
          <p className="text-sm font-bold text-slate-900">Drafting your campaign…</p>
          <p className="text-xs text-slate-500 mt-1">This takes about 10-15 seconds.</p>
        </div>
      )}

      {step === 'review' && generated && (
        <ReviewForm
          channel={channel}
          campaignType={campaignType}
          generated={generated}
          businessName={businessName}
          campaignName={campaignName}
          setCampaignName={setCampaignName}
          editedContent={editedContent}
          setEditedContent={setEditedContent}
          dailyBudget={dailyBudget}
          setDailyBudget={setDailyBudget}
          submitting={submitting}
          onLaunch={handleLaunch}
          onBack={() => setStep('goal')}
        />
      )}
    </div>
  );
}

function StepPills({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: 'goal', label: '1. Goal' },
    { id: 'review', label: '2. Review & edit' },
    { id: 'launch', label: '3. Launch' },
  ];
  const activeIndex = steps.findIndex(s => s.id === step || (step === 'generating' && s.id === 'goal'));
  return (
    <div className="flex items-center gap-2 text-xs font-bold">
      {steps.map((s, i) => (
        <div key={s.id} className={`flex items-center gap-2 ${i > activeIndex ? 'text-slate-400' : 'text-emerald-700'}`}>
          {i < activeIndex && <CheckCircle2 className="w-3.5 h-3.5" />}
          <span>{s.label}</span>
          {i < steps.length - 1 && <span className="text-slate-300">·</span>}
        </div>
      ))}
    </div>
  );
}

function ReviewForm(props: {
  channel: MarketingChannel;
  campaignType: CampaignType;
  generated: CampaignGenerationResult;
  businessName: string;
  campaignName: string;
  setCampaignName: (v: string) => void;
  editedContent: Record<string, unknown> | null;
  setEditedContent: (v: Record<string, unknown>) => void;
  dailyBudget: number;
  setDailyBudget: (v: number) => void;
  submitting: boolean;
  onLaunch: () => void;
  onBack: () => void;
}) {
  const { channel, campaignType, generated, businessName, campaignName, setCampaignName,
    editedContent, setEditedContent, dailyBudget, setDailyBudget, submitting, onLaunch, onBack } = props;

  return (
    <div className="space-y-5">
      <AdPreview
        channel={channel}
        campaignType={campaignType}
        content={editedContent}
        businessName={businessName}
      />

      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-violet-700">AI rationale</p>
        <p className="text-sm text-violet-900 mt-1">{generated.rationale}</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Campaign name</label>
          <input
            type="text"
            value={campaignName}
            onChange={e => setCampaignName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {editedContent && channel === 'google_ads' && campaignType === 'search' && (
        <SearchContentEditor
          content={editedContent as unknown as GoogleSearchContent}
          onChange={(v) => setEditedContent(v as unknown as Record<string, unknown>)}
        />
      )}
      {editedContent && channel === 'google_ads' && campaignType === 'display' && (
        <DisplayContentEditor
          content={editedContent as unknown as GoogleDisplayContent}
          onChange={(v) => setEditedContent(v as unknown as Record<string, unknown>)}
        />
      )}
      {editedContent && channel === 'meta_ads' && (
        <MetaContentEditor content={editedContent} onChange={setEditedContent} />
      )}
      {editedContent && channel === 'email' && (
        <EmailContentEditor content={editedContent} onChange={setEditedContent} />
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Daily budget (CAD)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
            <input
              type="number"
              min="5"
              step="1"
              value={(dailyBudget / 100).toFixed(2)}
              onChange={e => setDailyBudget(Math.round(parseFloat(e.target.value || '0') * 100))}
              className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            We&apos;ll spend up to <strong>{formatCents(dailyBudget)}</strong>/day. Your wallet is debited as ads run.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Start over
        </button>
        <button
          type="button"
          onClick={onLaunch}
          disabled={submitting || !campaignName}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-colors"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {submitting ? 'Launching…' : 'Approve & launch'}
        </button>
      </div>
    </div>
  );
}

// ── Channel editors ─────────────────────────────────────────────────────────

function FieldList({ label, items, onChange, max, charLimit, placeholder }: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  max: number;
  charLimit?: number;
  placeholder?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</label>
        <span className="text-[10px] text-slate-400">{items.length}/{max}{charLimit ? ` · ≤${charLimit} chars` : ''}</span>
      </div>
      <div className="space-y-1.5">
        {items.map((it, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <input
              type="text"
              value={it}
              maxLength={charLimit}
              placeholder={placeholder}
              onChange={e => {
                const next = [...items];
                next[idx] = e.target.value;
                onChange(next);
              }}
              className="flex-1 px-3 py-1.5 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, i) => i !== idx))}
              className="text-slate-400 hover:text-red-600 text-xs px-2"
              aria-label="Remove"
            >
              ×
            </button>
          </div>
        ))}
        {items.length < max && (
          <button
            type="button"
            onClick={() => onChange([...items, ''])}
            className="text-xs text-emerald-700 hover:text-emerald-600 font-bold"
          >
            + Add {label.toLowerCase().replace(/s$/, '')}
          </button>
        )}
      </div>
    </div>
  );
}

function SearchContentEditor({ content, onChange }: { content: GoogleSearchContent; onChange: (c: GoogleSearchContent) => void }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      <h3 className="text-sm font-bold text-slate-900">Ad copy</h3>
      <FieldList
        label="Headlines"
        items={content.headlines || []}
        onChange={v => onChange({ ...content, headlines: v })}
        max={15}
        charLimit={30}
      />
      <FieldList
        label="Descriptions"
        items={content.descriptions || []}
        onChange={v => onChange({ ...content, descriptions: v })}
        max={4}
        charLimit={90}
      />
      <FieldList
        label="Keywords"
        items={content.keywords || []}
        onChange={v => onChange({ ...content, keywords: v })}
        max={20}
      />
      <FieldList
        label="Negative keywords"
        items={content.negativeKeywords || []}
        onChange={v => onChange({ ...content, negativeKeywords: v })}
        max={10}
      />
      <div>
        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Landing page URL</label>
        <input
          type="url"
          value={content.finalUrl || ''}
          onChange={e => onChange({ ...content, finalUrl: e.target.value })}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
        />
      </div>
    </div>
  );
}

function DisplayContentEditor({ content, onChange }: { content: GoogleDisplayContent; onChange: (c: GoogleDisplayContent) => void }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      <h3 className="text-sm font-bold text-slate-900">Display ad</h3>
      <FieldList
        label="Headlines"
        items={content.headlines || []}
        onChange={v => onChange({ ...content, headlines: v })}
        max={5}
        charLimit={30}
      />
      <div>
        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Long headline (≤90 chars)</label>
        <input
          type="text"
          value={content.longHeadline || ''}
          maxLength={90}
          onChange={e => onChange({ ...content, longHeadline: e.target.value })}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
        />
      </div>
      <FieldList
        label="Descriptions"
        items={content.descriptions || []}
        onChange={v => onChange({ ...content, descriptions: v })}
        max={5}
        charLimit={90}
      />
      <div>
        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Landing page URL</label>
        <input
          type="url"
          value={content.finalUrl || ''}
          onChange={e => onChange({ ...content, finalUrl: e.target.value })}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
        />
      </div>
    </div>
  );
}

function MetaContentEditor({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const c = content as { primaryText?: string; headline?: string; description?: string };
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <h3 className="text-sm font-bold text-slate-900">Ad copy</h3>
      <Field label="Primary text" value={c.primaryText || ''} onChange={v => onChange({ ...content, primaryText: v })} multiline />
      <Field label="Headline" value={c.headline || ''} onChange={v => onChange({ ...content, headline: v })} maxLength={40} />
      <Field label="Description" value={c.description || ''} onChange={v => onChange({ ...content, description: v })} maxLength={30} />
    </div>
  );
}

function EmailContentEditor({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const c = content as { subject?: string; preheader?: string; bodyHtml?: string };
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <h3 className="text-sm font-bold text-slate-900">Email content</h3>
      <Field label="Subject" value={c.subject || ''} onChange={v => onChange({ ...content, subject: v })} />
      <Field label="Preheader" value={c.preheader || ''} onChange={v => onChange({ ...content, preheader: v })} />
      <Field label="Body (HTML)" value={c.bodyHtml || ''} onChange={v => onChange({ ...content, bodyHtml: v })} multiline rows={10} />
    </div>
  );
}

function Field({ label, value, onChange, multiline, rows, maxLength }: {
  label: string; value: string; onChange: (v: string) => void;
  multiline?: boolean; rows?: number; maxLength?: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</label>
        {maxLength && <span className="text-[10px] text-slate-400">{value.length}/{maxLength}</span>}
      </div>
      {multiline ? (
        <textarea
          value={value}
          rows={rows || 4}
          maxLength={maxLength}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:border-emerald-500"
        />
      ) : (
        <input
          type="text"
          value={value}
          maxLength={maxLength}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
        />
      )}
    </div>
  );
}
