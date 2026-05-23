'use client';

import { useEffect, useState } from 'react';
import { Loader2, ExternalLink, CheckCircle2, AlertCircle, MapPin, Mic, Bot, Building2, Mail, Send } from 'lucide-react';

type DiffSeverity = 'critical' | 'warning' | 'info';

interface GbpDiff {
  id: string;
  severity: DiffSeverity;
  title: string;
  detail: string;
  steps: string[];
}

interface GbpResponse {
  placeId: string | null;
  hasApiKey: boolean;
  gbp: Record<string, unknown> | null;
  diffs: GbpDiff[];
  siteUrl: string;
}

interface ChecklistItem {
  key: 'applemaps' | 'bingplaces' | 'yelp' | 'facebook' | 'tripadvisor' | 'nextdoor';
  name: string;
  claimUrl: string;
  why: string;
  steps: string[];
}

const OFF_PLATFORM: ChecklistItem[] = [
  {
    key: 'applemaps',
    name: 'Apple Business Connect',
    claimUrl: 'https://businessconnect.apple.com/',
    why: 'Anyone on an iPhone using Siri, Maps, or Spotlight sees Apple\'s data, not Google\'s. Apple\'s listing is separate.',
    steps: [
      'Open https://businessconnect.apple.com and sign in with an Apple ID.',
      'Search for your business or click "Add Location".',
      'Verify by phone call or postcard (Apple supports both).',
      'Match address, phone, hours, and website to your Google Business Profile exactly.',
    ],
  },
  {
    key: 'bingplaces',
    name: 'Bing Places',
    claimUrl: 'https://www.bingplaces.com/',
    why: 'Microsoft\'s search, ChatGPT (which uses Bing\'s index for live web search), Duck Duck Go, and Yahoo all rank against Bing\'s data.',
    steps: [
      'Open https://www.bingplaces.com and sign in.',
      'Choose "Import from Google Business" if you have GBP — Bing fetches everything in one step.',
      'Verify by phone or postcard.',
      'Re-check NAP consistency after import.',
    ],
  },
  {
    key: 'facebook',
    name: 'Facebook Page',
    claimUrl: 'https://www.facebook.com/pages/create',
    why: 'Used as a "social proof" signal by Google and as a sameAs link in your LocalBusiness schema. Many people search for businesses on Facebook directly.',
    steps: [
      'Open https://www.facebook.com/pages/create.',
      'Choose "Business or Brand", name it after your business.',
      'Add the same NAP details as your site and GBP.',
      'Once created, paste the page URL into /admin/seo → Site → Social Links → Facebook.',
    ],
  },
  {
    key: 'yelp',
    name: 'Yelp',
    claimUrl: 'https://biz.yelp.com/',
    why: 'Still a major source of local-business discovery, especially in food, beauty, and home services. Reviews here are crawled by AI assistants.',
    steps: [
      'Open https://biz.yelp.com.',
      'Search for your business — many businesses already have unclaimed listings.',
      'Claim it. Verify by phone.',
      'Match NAP exactly to GBP. Reply to existing reviews.',
    ],
  },
  {
    key: 'tripadvisor',
    name: 'TripAdvisor',
    claimUrl: 'https://www.tripadvisor.com/Owners',
    why: 'Essential for restaurants, hotels, attractions. Often a top organic result for "things to do in [city]" queries.',
    steps: [
      'Open https://www.tripadvisor.com/Owners.',
      'Add or claim your business.',
      'Verify ownership.',
      'Encourage recent customers to leave honest reviews.',
    ],
  },
  {
    key: 'nextdoor',
    name: 'Nextdoor',
    claimUrl: 'https://business.nextdoor.com/',
    why: 'Hyperlocal — Nextdoor users explicitly look for recommendations from their immediate neighborhood. High intent for trades, healthcare, family services.',
    steps: [
      'Open https://business.nextdoor.com.',
      'Sign up as a local business.',
      'Match NAP to GBP.',
      'Post occasional updates to stay visible in the neighborhood feed.',
    ],
  },
];

interface SeoProfilesPanelProps { siteId: string | undefined }

export default function SeoProfilesPanel({ siteId }: SeoProfilesPanelProps) {
  const [gbp, setGbp] = useState<GbpResponse | null>(null);
  const [loadingGbp, setLoadingGbp] = useState<boolean>(!!siteId);
  const [profiles, setProfiles] = useState<Record<string, { claimed?: boolean; profileUrl?: string }>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [openSteps, setOpenSteps] = useState<Record<string, boolean>>({});
  const [gbpEmailTo, setGbpEmailTo] = useState('');
  const [gbpEmailName, setGbpEmailName] = useState('');
  const [gbpEmailSending, setGbpEmailSending] = useState(false);
  const [gbpEmailStatus, setGbpEmailStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showGbpEmail, setShowGbpEmail] = useState(false);

  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    Promise.all([
      fetch(`/api/seo/gbp?siteId=${siteId}`, { credentials: 'include' }).then(r => r.ok ? r.json() : null),
      fetch(`/api/seo/profiles?siteId=${siteId}`, { credentials: 'include' }).then(r => r.ok ? r.json() : { profileChecklist: {} }),
    ]).then(([gbpData, profData]) => {
      if (cancelled) return;
      setGbp(gbpData);
      setProfiles(profData.profileChecklist || {});
    }).finally(() => { if (!cancelled) setLoadingGbp(false); });
    return () => { cancelled = true; };
  }, [siteId]);

  const setProfile = async (item: ChecklistItem, patch: { claimed?: boolean; profileUrl?: string }) => {
    if (!siteId) return;
    setSavingKey(item.key);
    setProfiles(prev => ({ ...prev, [item.key]: { ...prev[item.key], ...patch } }));
    try {
      await fetch('/api/seo/profiles', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, key: item.key, ...patch }),
      });
    } finally {
      setSavingKey(null);
    }
  };

  const handleSendGbpEmail = async () => {
    if (!siteId || !gbpEmailTo.trim()) return;
    setGbpEmailSending(true);
    setGbpEmailStatus('idle');
    try {
      const res = await fetch('/api/seo/gbp-setup-email', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, recipientEmail: gbpEmailTo.trim(), recipientName: gbpEmailName.trim() || undefined }),
      });
      if (res.ok) {
        setGbpEmailStatus('success');
        setShowGbpEmail(false);
        setTimeout(() => setGbpEmailStatus('idle'), 6000);
      } else {
        setGbpEmailStatus('error');
      }
    } catch {
      setGbpEmailStatus('error');
    } finally {
      setGbpEmailSending(false);
    }
  };

  if (!siteId) {
    return <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-500">Select a site to manage off-platform profiles.</div>;
  }

  const voiceChecks = buildVoiceReadinessChecks(gbp);

  return (
    <div className="space-y-6">
      {/* Google Business Profile diff */}
      <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-bold text-slate-900">Google Business Profile</h3>
          {gbp?.placeId && <span className="text-[11px] text-slate-400 font-mono">{gbp.placeId.slice(0, 16)}…</span>}
        </div>
        {loadingGbp || !gbp ? (
          <div className="p-6 text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Comparing your site to your live Google listing…</div>
        ) : (
          <div className="p-4 space-y-3">
            {!gbp.hasApiKey && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                Places API key not configured (<code>GOOGLE_PLACES_API_KEY</code>). The instructions below are based on a manual review only.
              </div>
            )}
            {gbp.diffs.map(diff => (
              <DiffItem key={diff.id} diff={diff} />
            ))}
            {gbp.diffs.some(d => d.id === 'no-gbp') && (
              <div className="border border-blue-200 bg-blue-50 rounded-lg p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <Mail className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-700 leading-relaxed">
                    <strong className="text-slate-900">Send your client a setup guide</strong> — a step-by-step email with their business info pre-filled, a direct link to create their profile, and verification instructions.
                  </div>
                </div>
                {!showGbpEmail ? (
                  <button
                    onClick={() => setShowGbpEmail(true)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Email Setup Guide to Client
                  </button>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={gbpEmailName}
                      onChange={(e) => setGbpEmailName(e.target.value)}
                      placeholder="Client name (optional)"
                      className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:border-blue-400 focus:ring-1 focus:ring-blue-400 focus:outline-none"
                    />
                    <input
                      type="email"
                      value={gbpEmailTo}
                      onChange={(e) => setGbpEmailTo(e.target.value)}
                      placeholder="client@example.com"
                      className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:border-blue-400 focus:ring-1 focus:ring-blue-400 focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSendGbpEmail}
                        disabled={gbpEmailSending || !gbpEmailTo.trim()}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {gbpEmailSending ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...</>
                        ) : (
                          <><Send className="w-3.5 h-3.5" /> Send</>
                        )}
                      </button>
                      <button onClick={() => setShowGbpEmail(false)} className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {gbpEmailStatus === 'success' && (
                  <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    Setup guide sent!
                  </div>
                )}
                {gbpEmailStatus === 'error' && (
                  <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    Failed to send. Try again.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Off-platform listings */}
      <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-bold text-slate-900">Off-platform listings</h3>
        </div>
        <ul className="divide-y divide-slate-100">
          {OFF_PLATFORM.map(item => {
            const state = profiles[item.key] || {};
            const isOpen = openSteps[item.key];
            return (
              <li key={item.key} className="p-4 space-y-2">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 flex-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!state.claimed}
                      onChange={e => setProfile(item, { claimed: e.target.checked })}
                      disabled={savingKey === item.key}
                      className="rounded border-slate-300"
                    />
                    <span className="text-sm font-semibold text-slate-900">{item.name}</span>
                    {state.claimed && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  </label>
                  <a
                    href={item.claimUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
                  >
                    Claim <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    onClick={() => setOpenSteps(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    {isOpen ? 'Hide steps' : 'How'}
                  </button>
                </div>
                <p className="text-xs text-slate-600 pl-6">{item.why}</p>
                {isOpen && (
                  <ol className="pl-9 list-decimal text-xs text-slate-700 space-y-1">
                    {item.steps.map((s, i) => <li key={i}>{s}</li>)}
                  </ol>
                )}
                {state.claimed && (
                  <div className="pl-6">
                    <input
                      type="url"
                      placeholder="Profile URL (e.g. https://yelp.com/biz/your-business)"
                      value={state.profileUrl || ''}
                      onChange={e => setProfile(item, { profileUrl: e.target.value })}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Voice-search readiness */}
      <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
          <Mic className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-bold text-slate-900">Voice search readiness</h3>
        </div>
        <ul className="divide-y divide-slate-100">
          {voiceChecks.map(c => (
            <li key={c.id} className="p-4 flex items-start gap-3">
              {c.ok ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />}
              <div>
                <div className="text-sm font-semibold text-slate-900">{c.label}</div>
                <div className="text-xs text-slate-600 mt-0.5">{c.detail}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* AI assistant discoverability */}
      <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
          <Bot className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-bold text-slate-900">AI assistant discoverability</h3>
        </div>
        <div className="p-4 text-sm text-slate-700 space-y-3">
          <p>
            ChatGPT, Perplexity, Claude.ai, and Google&apos;s AI Overview pull from the open web. They look for:
            structured data (LocalBusiness, FAQ, Service — handled by the Schema tab), an <code>llms.txt</code>{' '}
            index file (auto-served at <code>{gbp?.siteUrl || ''}/llms.txt</code>), and authoritative citations
            from third-party listings (Yelp, TripAdvisor, news mentions).
          </p>
          <p className="text-xs text-slate-500">
            Action items: keep the off-platform listings above in sync, encourage real customer reviews on
            Google + Yelp, and answer common customer questions inside an FAQ block on your site — these become
            the exact passages an AI assistant will quote when someone asks about your business.
          </p>
          {gbp?.siteUrl && (
            <a
              href={`${gbp.siteUrl}/llms.txt`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              View your llms.txt <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </section>
    </div>
  );
}

function DiffItem({ diff }: { diff: GbpDiff }) {
  const tone =
    diff.severity === 'critical' ? 'border-rose-200 bg-rose-50' :
    diff.severity === 'warning' ? 'border-amber-200 bg-amber-50' :
    'border-slate-200 bg-slate-50';
  const Icon = diff.severity === 'critical' ? AlertCircle : diff.severity === 'warning' ? AlertCircle : CheckCircle2;
  const iconColor = diff.severity === 'critical' ? 'text-rose-600' : diff.severity === 'warning' ? 'text-amber-600' : 'text-slate-500';
  return (
    <div className={`border rounded-lg p-3 ${tone}`}>
      <div className="flex items-start gap-2">
        <Icon className={`w-4 h-4 ${iconColor} shrink-0 mt-0.5`} />
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-900">{diff.title}</div>
          <div className="text-xs text-slate-700 mt-1 leading-relaxed">{diff.detail}</div>
          {diff.steps.length > 0 && (
            <ol className="list-decimal pl-4 mt-2 text-xs text-slate-700 space-y-1">
              {diff.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

function buildVoiceReadinessChecks(gbp: GbpResponse | null) {
  return [
    {
      id: 'nap-set',
      ok: !!gbp?.placeId,
      label: 'NAP consistency (Name, Address, Phone)',
      detail: gbp?.placeId
        ? 'Business profile is linked to a verified Google Places ID. The GBP section above flags any mismatch with off-platform listings.'
        : 'Link a Google Places ID first (Site tab → Find on Google). Voice assistants depend on consistent NAP across the web.',
    },
    {
      id: 'short-answers',
      ok: true,
      label: 'Short-answer paragraphs',
      detail:
        'Voice assistants pick passages that answer a question in 1–2 sentences. Make sure your home, about, and FAQ pages each have at least one short, direct paragraph answering "What does this business do?" / "Where is it?" / "What hours?".',
    },
    {
      id: 'faq-depth',
      ok: true,
      label: 'FAQ depth',
      detail:
        'Aim for 6–10 FAQ entries covering: services, pricing model, hours, location/parking, what to bring, cancellation policy. Each becomes a candidate answer for "Hey Google, ..." style queries.',
    },
    {
      id: 'schema',
      ok: true,
      label: 'Schema completeness',
      detail: 'See the Schema tab — every page should emit at least LocalBusiness and (for sub-pages) BreadcrumbList.',
    },
  ];
}
