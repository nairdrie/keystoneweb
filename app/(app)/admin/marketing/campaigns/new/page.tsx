'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Sparkles, Loader2, ArrowRight, CheckCircle2, Search, Image as ImageIcon } from 'lucide-react';
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
import LocationPicker, { type LocationValue, targetingFromLocationValue, locationValueFromTargeting } from '../../_components/LocationPicker';
import ImagePicker from '../../_components/ImagePicker';

type Step = 'goal' | 'generating' | 'review' | 'launch';

// 70% of the daily budget goes to Search (high-intent), 30% to Display (cheap reach).
const SEARCH_SPLIT = 0.7;

export default function NewCampaignPage() {
  const { siteId, siteTitle, site } = useAdminContext();
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
  const [locationValue, setLocationValue] = useState<LocationValue>({ mode: 'auto' });
  const [alsoDisplay, setAlsoDisplay] = useState(true);
  const [displayImages, setDisplayImages] = useState<string[]>([]);
  const [campaignDurationDays, setCampaignDurationDays] = useState<number | null>(30);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const businessAddress = useMemo<string | undefined>(() => {
    const bp = (site?.designData as { businessProfile?: Record<string, string> } | undefined)?.businessProfile;
    if (!bp) return undefined;
    const parts = [bp.streetAddress, bp.addressLocality, bp.addressRegion, bp.postalCode]
      .filter(Boolean)
      .join(', ');
    return parts || undefined;
  }, [site]);

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
      setBusinessName(stripHtml(data.context?.businessName || siteTitle || ''));
      setLocationValue(locationValueFromTargeting(data.result.targeting));
      if (data.result.suggestedDailyBudgetCents) {
        setDailyBudget(data.result.suggestedDailyBudgetCents);
      }
      setStep('review');
    } catch {
      setError('Network error');
      setStep('goal');
    }
  }

  async function createAndApprove(payload: Record<string, unknown>): Promise<{ ok: boolean; id?: string; error?: string; status?: number; }> {
    const createRes = await fetch('/api/admin/marketing/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const createData = await createRes.json();
    if (!createRes.ok) return { ok: false, error: createData.error };

    const id = createData.campaign.id;
    const approveRes = await fetch(`/api/admin/marketing/campaigns/${id}/approve`, {
      method: 'POST',
      credentials: 'include',
    });
    const approveData = await approveRes.json();
    if (!approveRes.ok) return { ok: false, error: approveData.error, status: approveRes.status, id };

    return { ok: true, id };
  }

  async function handleLaunch() {
    if (!generated || !editedContent) return;
    setError(null);
    setSubmitting(true);

    const targeting = targetingFromLocationValue(locationValue, generated.targeting);
    const includeDisplay = channel === 'google_ads' && alsoDisplay;
    const searchBudget = includeDisplay ? Math.round(dailyBudget * SEARCH_SPLIT) : dailyBudget;
    const displayBudget = dailyBudget - searchBudget;
    const startDate = new Date().toISOString().slice(0, 10);
    const endDate = campaignDurationDays
      ? new Date(Date.now() + campaignDurationDays * 86_400_000).toISOString().slice(0, 10)
      : undefined;

    try {
      // Primary campaign (Search for google_ads, the chosen format for other channels)
      const primaryResult = await createAndApprove({
        siteId,
        name: includeDisplay ? `${campaignName} — Search` : campaignName,
        channel,
        campaign_type: campaignType,
        content: editedContent,
        targeting,
        daily_budget_cents: searchBudget,
        start_date: startDate,
        ...(endDate && { end_date: endDate }),
        ai_generated: true,
        ai_rationale: generated.rationale,
      });

      if (!primaryResult.ok) {
        if (primaryResult.status === 402) setError('Your wallet balance is too low to launch. Top up first.');
        else setError(primaryResult.error || 'Failed to launch campaign');
        setSubmitting(false);
        return;
      }

      // Optional Display companion (Google only)
      if (includeDisplay) {
        const displayContent = deriveDisplayContent(editedContent as unknown as GoogleSearchContent, businessName, displayImages);
        const displayResult = await createAndApprove({
          siteId,
          name: `${campaignName} — Display`,
          channel: 'google_ads',
          campaign_type: 'display',
          content: displayContent,
          targeting,
          daily_budget_cents: displayBudget,
          start_date: startDate,
          ...(endDate && { end_date: endDate }),
          ai_generated: true,
          ai_rationale: 'Companion display campaign — visual reach across the Google Display Network.',
        });

        if (!displayResult.ok) {
          // Search succeeded; warn about Display but redirect to Search.
          console.warn('Display companion failed:', displayResult.error);
        }
      }

      router.push(`/admin/marketing/campaigns/${primaryResult.id}?siteId=${siteId}&just=launched`);
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
            {channel === 'google_ads' && (
              <p className="text-xs text-slate-500 mt-2">
                Runs on Google Search by default. You can add Display ads (banners on partner websites) in the next step.
              </p>
            )}
          </div>

          {/* Format picker — hidden for google_ads (we always do Search + optional Display) */}
          {channel !== 'google_ads' && CHANNEL_CAMPAIGN_TYPES[channel].length > 1 && (
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
          )}

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
          siteId={siteId}
          channel={channel}
          campaignType={campaignType}
          generated={generated}
          businessName={businessName}
          businessAddress={businessAddress}
          campaignName={campaignName}
          setCampaignName={setCampaignName}
          editedContent={editedContent}
          setEditedContent={setEditedContent}
          dailyBudget={dailyBudget}
          setDailyBudget={setDailyBudget}
          locationValue={locationValue}
          setLocationValue={setLocationValue}
          alsoDisplay={alsoDisplay}
          setAlsoDisplay={setAlsoDisplay}
          displayImages={displayImages}
          setDisplayImages={setDisplayImages}
          campaignDurationDays={campaignDurationDays}
          setCampaignDurationDays={setCampaignDurationDays}
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

interface ReviewFormProps {
  siteId: string | null;
  channel: MarketingChannel;
  campaignType: CampaignType;
  generated: CampaignGenerationResult;
  businessName: string;
  businessAddress?: string;
  campaignName: string;
  setCampaignName: (v: string) => void;
  editedContent: Record<string, unknown> | null;
  setEditedContent: (v: Record<string, unknown>) => void;
  dailyBudget: number;
  setDailyBudget: (v: number) => void;
  locationValue: LocationValue;
  setLocationValue: (v: LocationValue) => void;
  alsoDisplay: boolean;
  setAlsoDisplay: (v: boolean) => void;
  displayImages: string[];
  setDisplayImages: (urls: string[]) => void;
  campaignDurationDays: number | null;
  setCampaignDurationDays: (v: number | null) => void;
  submitting: boolean;
  onLaunch: () => void;
  onBack: () => void;
}

function ReviewForm(p: ReviewFormProps) {
  const [previewTab, setPreviewTab] = useState<'search' | 'display'>('search');
  const isGoogle = p.channel === 'google_ads';
  const showDisplayCompanion = isGoogle && p.alsoDisplay;

  const displayContent = useMemo(() => {
    if (!showDisplayCompanion || !p.editedContent) return null;
    return deriveDisplayContent(p.editedContent as unknown as GoogleSearchContent, p.businessName, p.displayImages);
  }, [showDisplayCompanion, p.editedContent, p.businessName, p.displayImages]);

  const searchBudget = showDisplayCompanion ? Math.round(p.dailyBudget * SEARCH_SPLIT) : p.dailyBudget;
  const displayBudget = p.dailyBudget - searchBudget;

  return (
    <div className="space-y-5">
      {/* Preview, with tab when Display is enabled */}
      {isGoogle && (
        <div className="space-y-2">
          {showDisplayCompanion && (
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit">
              <PreviewTab active={previewTab === 'search'} onClick={() => setPreviewTab('search')} icon={<Search className="w-3.5 h-3.5" />} label="Search preview" />
              <PreviewTab active={previewTab === 'display'} onClick={() => setPreviewTab('display')} icon={<ImageIcon className="w-3.5 h-3.5" />} label="Display preview" />
            </div>
          )}
          <AdPreview
            channel="google_ads"
            campaignType={previewTab === 'display' && showDisplayCompanion ? 'display' : 'search'}
            content={previewTab === 'display' && displayContent
              ? (displayContent as unknown as Record<string, unknown>)
              : p.editedContent}
            businessName={p.businessName}
          />
        </div>
      )}

      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-violet-700">AI rationale</p>
        <p className="text-sm text-violet-900 mt-1">{p.generated.rationale}</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Campaign name</label>
          <input
            type="text"
            value={p.campaignName}
            onChange={e => p.setCampaignName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Content editor */}
      {p.editedContent && isGoogle && (
        <SearchContentEditor
          content={p.editedContent as unknown as GoogleSearchContent}
          onChange={(v) => p.setEditedContent(v as unknown as Record<string, unknown>)}
        />
      )}
      {p.editedContent && p.channel === 'meta_ads' && (
        <MetaContentEditor content={p.editedContent} onChange={p.setEditedContent} />
      )}
      {p.editedContent && p.channel === 'email' && (
        <EmailContentEditor content={p.editedContent} onChange={p.setEditedContent} />
      )}

      {/* Display companion toggle + image picker */}
      {isGoogle && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={p.alsoDisplay}
              onChange={e => p.setAlsoDisplay(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-emerald-600"
            />
            <div className="flex-1">
              <div className="text-sm font-bold text-slate-900">Also run on the Google Display Network</div>
              <p className="text-xs text-slate-500 mt-0.5">
                Banner ads on 2M+ partner websites, YouTube and Gmail. Cheaper clicks, broader reach.
                Your daily budget splits {Math.round(SEARCH_SPLIT * 100)}% Search / {Math.round((1 - SEARCH_SPLIT) * 100)}% Display.
              </p>
            </div>
            <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              Recommended
            </span>
          </label>

          {p.alsoDisplay && (
            <ImagePicker siteId={p.siteId} selected={p.displayImages} onChange={p.setDisplayImages} />
          )}
        </div>
      )}

      {/* Location picker (Google + Meta) */}
      {p.channel !== 'email' && (
        <LocationPicker
          value={p.locationValue}
          onChange={p.setLocationValue}
          defaultAddress={p.businessAddress}
        />
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Daily budget (CAD)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
            <input
              type="number"
              min="5"
              step="1"
              value={(p.dailyBudget / 100).toFixed(2)}
              onChange={e => p.setDailyBudget(Math.round(parseFloat(e.target.value || '0') * 100))}
              className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
          {showDisplayCompanion ? (
            <p className="text-xs text-slate-500 mt-1.5">
              Split: <strong>{formatCents(searchBudget)}</strong>/day Search · <strong>{formatCents(displayBudget)}</strong>/day Display.
            </p>
          ) : (
            <p className="text-xs text-slate-500 mt-1.5">
              Up to <strong>{formatCents(p.dailyBudget)}</strong>/day. Wallet is debited as ads run.
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Campaign duration</label>
          <div className="flex flex-wrap gap-2">
            {([null, 7, 14, 30, 60] as (number | null)[]).map(d => (
              <button
                key={d ?? 'ongoing'}
                type="button"
                onClick={() => p.setCampaignDurationDays(d)}
                className={`px-3 py-1.5 rounded-md border text-xs font-bold transition-colors ${
                  p.campaignDurationDays === d
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                {d === null ? 'Ongoing' : `${d} days`}
              </button>
            ))}
          </div>
          {p.campaignDurationDays ? (
            <p className="text-xs text-slate-500 mt-1.5">
              Estimated total: <strong>{formatCents(p.dailyBudget * p.campaignDurationDays)}</strong> over {p.campaignDurationDays} days. Campaign pauses automatically when it ends.
            </p>
          ) : (
            <p className="text-xs text-slate-500 mt-1.5">
              Runs until you pause or cancel it. No automatic end.
            </p>
          )}
        </div>

        {p.campaignDurationDays && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Total wallet required</span>
              <span className="font-black text-slate-900">{formatCents(p.dailyBudget * p.campaignDurationDays)}</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Actual spend depends on traffic. Unused balance stays in your wallet.</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={p.onBack}
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Start over
        </button>
        <button
          type="button"
          onClick={p.onLaunch}
          disabled={p.submitting || !p.campaignName}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-colors"
        >
          {p.submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {p.submitting ? 'Launching…' : 'Approve & launch'}
        </button>
      </div>
    </div>
  );
}

function PreviewTab({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
        active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      {icon} {label}
    </button>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  if (typeof document !== 'undefined') {
    const el = document.createElement('div');
    el.innerHTML = html;
    return (el.textContent || el.innerText || '').trim();
  }
  return html.replace(/<[^>]*>/g, '').trim();
}

// ── Display derivation ───────────────────────────────────────────────────────

function deriveDisplayContent(
  search: GoogleSearchContent,
  businessName: string,
  images: string[],
): GoogleDisplayContent {
  const headlines = (search.headlines || []).filter(Boolean).slice(0, 5);
  const descriptions = (search.descriptions || []).filter(Boolean).slice(0, 5);
  const longHeadline = headlines[0] ? headlines[0].slice(0, 90) : (descriptions[0] || '').slice(0, 90);
  return {
    headlines,
    longHeadline,
    descriptions,
    businessName,
    images,
    finalUrl: search.finalUrl || '',
  };
}

// ── Channel editors (unchanged below) ────────────────────────────────────────

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
