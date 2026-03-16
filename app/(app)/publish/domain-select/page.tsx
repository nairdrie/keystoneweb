'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Check,
  X,
  Loader2,
  Globe,
  Search,
  ExternalLink,
  Lock,
  Crown,
  ArrowRight,
  Copy,
  CheckCircle2,
  AlertCircle,
  Mail,
  RefreshCw,
  MapPin,
  ChevronDown,
  ChevronUp,
  Leaf,
  ShoppingCart,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/context';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DomainCheckResult {
  available: boolean;
  subdomain: string;
  fullDomain: string;
  message: string;
}

interface DomainSearchResult {
  domain: string;
  available: boolean;
  price?: number;
  currency?: string;
  isAlternative?: boolean;
}

interface DnsRecord {
  type: string;
  name: string;
  value: string;
  description: string;
}

interface DnsInstructions {
  records: DnsRecord[];
  note: string;
}

type DomainTab = 'subdomain' | 'custom';
type CustomMode = 'search' | 'external';

// ─── Loading Messages ────────────────────────────────────────────────────────

const LOADING_MESSAGES = [
  'Checking availability...',
  'Finding the perfect domain for you...',
  'Searching across registrars...',
  'Looking for smart alternatives...',
  'Almost there...',
];

function useRotatingText(active: boolean, messages: string[], intervalMs = 2200) {
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (active) {
      setIndex(0);
      timerRef.current = setInterval(() => {
        setIndex((prev: number) => (prev + 1) % messages.length);
      }, intervalMs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [active, messages.length, intervalMs]);

  return messages[index];
}

// ─── Skeleton Loader ─────────────────────────────────────────────────────────

function DomainResultsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Recommended .ca skeleton */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-6 w-28 bg-red-100 rounded-full" />
          <div className="h-4 w-32 bg-slate-200 rounded" />
        </div>
        <div className="h-14 bg-slate-100 rounded-lg border-2 border-slate-100" />
      </div>
      {/* Smart suggestions skeleton */}
      <div>
        <div className="h-4 w-36 bg-slate-200 rounded mb-3" />
        <div className="space-y-2">
          <div className="h-12 bg-slate-50 rounded-lg border border-slate-100" />
          <div className="h-12 bg-slate-50 rounded-lg border border-slate-100" />
          <div className="h-12 bg-slate-50 rounded-lg border border-slate-100" />
        </div>
      </div>
      {/* Other extensions skeleton */}
      <div className="h-10 bg-slate-50 rounded-lg border border-slate-100" />
    </div>
  );
}

// ─── Price Label ─────────────────────────────────────────────────────────────

function DomainPriceLabel({
  available,
  price,
  freeDomainUsed,
  domain,
  showTooltip,
  onToggleTooltip,
}: {
  available: boolean;
  price?: number;
  freeDomainUsed: boolean;
  domain: string;
  showTooltip: boolean;
  onToggleTooltip: (domain: string | null) => void;
}) {
  if (!available) {
    return <span className="text-xs font-semibold text-slate-400">Taken</span>;
  }

  if (!freeDomainUsed) {
    return <span className="text-xs font-semibold text-green-700">Included with Pro</span>;
  }

  return (
    <div className="flex items-center gap-1 relative">
      <span className="text-xs font-semibold text-slate-800">
        ${price?.toFixed(2) ?? '—'} USD
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleTooltip(showTooltip ? null : domain);
        }}
        className="text-slate-400 hover:text-slate-600 transition-colors"
        aria-label="Why does this cost money?"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {showTooltip && (
        <div className="absolute right-0 top-6 z-10 w-56 p-2.5 bg-slate-800 text-white text-xs rounded-lg shadow-lg">
          <p>Your Pro plan includes one free domain. Since you&apos;ve already registered a domain, additional domains are available at this price.</p>
          <div className="absolute -top-1 right-3 w-2 h-2 bg-slate-800 rotate-45" />
        </div>
      )}
    </div>
  );
}

// ─── Main Content ────────────────────────────────────────────────────────────

function DomainSelectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const siteId = searchParams.get('siteId');
  const sessionId = searchParams.get('session_id');
  const currentDomain = searchParams.get('currentDomain');

  // Shared state
  const [activeTab, setActiveTab] = useState<DomainTab>('subdomain');
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState('');

  // Subscription state
  const [userPlan, setUserPlan] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);

  // Subdomain state
  const [subdomain, setSubdomain] = useState(currentDomain || '');
  const [domainCheck, setDomainCheck] = useState<DomainCheckResult | null>(null);
  const [checking, setChecking] = useState(false);

  // Custom domain state
  const [customMode, setCustomMode] = useState<CustomMode>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [recommendedResults, setRecommendedResults] = useState<DomainSearchResult[]>([]);
  const [otherResults, setOtherResults] = useState<DomainSearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<DomainSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [showOtherTlds, setShowOtherTlds] = useState(false);
  const [freeDomainUsed, setFreeDomainUsed] = useState(false);
  const [showPriceTooltip, setShowPriceTooltip] = useState<string | null>(null);

  // External domain state
  const [externalDomain, setExternalDomain] = useState('');
  const [dnsInstructions, setDnsInstructions] = useState<DnsInstructions | null>(null);
  const [linking, setLinking] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [dnsVerified, setDnsVerified] = useState(false);
  const [dnsChecks, setDnsChecks] = useState<{ cname: boolean; txt: boolean } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const isPro = userPlan?.toLowerCase().includes('pro');

  // Rotating loading text for domain search
  const loadingText = useRotatingText(searching, LOADING_MESSAGES);

  // Fetch user subscription
  useEffect(() => {
    if (authLoading || !user) return;

    fetch('/api/user/subscription', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.subscription?.subscription_status === 'active') {
          setUserPlan(data.subscription.subscription_plan);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingPlan(false));
  }, [user, authLoading]);

  // Auth verification
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/signin');
      return;
    }

    if (!siteId || !sessionId) {
      setError('Invalid session. Missing siteId or sessionId.');
    }
  }, [user, authLoading, siteId, sessionId, router]);

  // ─── Subdomain Logic ────────────────────────────────────────────────────

  const checkDomainAvailability = useCallback(async (domainToCheck: string) => {
    setChecking(true);
    setError(null);

    try {
      const baseDomain = process.env.NEXT_PUBLIC_PUBLISHED_DOMAIN_BASE || 'kswd.ca';
      const res = await fetch(
        `/api/domains/check-availability?subdomain=${domainToCheck}&baseDomain=${baseDomain}`,
        { credentials: 'include' }
      );

      if (!res.ok) throw new Error('Failed to check domain availability');

      const result: DomainCheckResult = await res.json();
      setDomainCheck(result);

      if (!result.available) setError(result.message);
    } catch (err) {
      setError('Failed to check domain availability');
      console.error(err);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'subdomain') return;

    const timer = setTimeout(() => {
      const trimmed = subdomain.trim();
      if (trimmed.length >= 3) {
        checkDomainAvailability(trimmed);
      } else if (trimmed.length > 0) {
        setError('Website address must be at least 3 characters');
        setDomainCheck(null);
      } else {
        setError(null);
        setDomainCheck(null);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [subdomain, activeTab, checkDomainAvailability]);

  // ─── Publish with Subdomain ─────────────────────────────────────────────

  const handlePublish = async () => {
    if (!domainCheck || !domainCheck.available) {
      setError('Please select an available domain');
      return;
    }

    setPublishing(true);
    setError(null);

    try {
      const res = await fetch('/api/sites/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          siteId,
          publishedDomain: domainCheck.fullDomain,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to publish site');
      }

      const result = await res.json();
      setSuccess(true);
      setPublishedUrl(result.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish site');
      console.error(err);
    } finally {
      setPublishing(false);
    }
  };

  // ─── Custom Domain Search ───────────────────────────────────────────────

  const handleDomainSearch = async () => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return;

    setSearching(true);
    setError(null);
    setRecommendedResults([]);
    setOtherResults([]);
    setSuggestions([]);
    setSelectedDomain(null);
    setShowOtherTlds(false);

    try {
      const res = await fetch(
        `/api/domains/search?query=${encodeURIComponent(searchQuery.trim())}`,
        { credentials: 'include' }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to search domains');
      }

      const data = await res.json();
      setRecommendedResults(data.recommended || []);
      setOtherResults(data.other || []);
      setSuggestions(data.suggestions || []);
      setFreeDomainUsed(data.freeDomainUsed ?? false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search domains');
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  // ─── Purchase Domain ────────────────────────────────────────────────────

  const handlePurchaseDomain = async () => {
    if (!selectedDomain || !siteId) return;

    setPurchasing(true);
    setError(null);

    try {
      if (freeDomainUsed) {
        // Paid flow: create Stripe checkout session, redirect to Stripe
        const res = await fetch('/api/domains/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ siteId, domain: selectedDomain }),
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Failed to create checkout');
        }

        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
          return; // Don't set purchasing false — we're navigating away
        }
      } else {
        // Free flow: purchase directly
        const res = await fetch('/api/domains/purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ siteId, domain: selectedDomain }),
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Failed to purchase domain');
        }

        setSuccess(true);
        setPublishedUrl(`https://${selectedDomain}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to purchase domain');
      console.error(err);
    } finally {
      setPurchasing(false);
    }
  };

  // ─── Link External Domain ──────────────────────────────────────────────

  const handleLinkExternal = async () => {
    if (!externalDomain.trim() || !siteId) return;

    setLinking(true);
    setError(null);
    setDnsInstructions(null);

    try {
      const res = await fetch('/api/domains/link-external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ siteId, domain: externalDomain.trim().toLowerCase() }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to link domain');
      }

      const result = await res.json();
      setDnsInstructions(result.dnsInstructions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link domain');
      console.error(err);
    } finally {
      setLinking(false);
    }
  };

  // ─── Verify DNS ────────────────────────────────────────────────────────

  const handleVerifyDns = async () => {
    if (!siteId) return;

    setVerifying(true);
    setError(null);

    try {
      const res = await fetch('/api/domains/verify-dns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ siteId }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to verify DNS');
      }

      const result = await res.json();
      setDnsVerified(result.verified);
      setDnsChecks(result.checks);

      if (result.verified) {
        setSuccess(true);
        setPublishedUrl(`https://${externalDomain.trim()}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify DNS');
      console.error(err);
    } finally {
      setVerifying(false);
    }
  };

  // ─── Copy to Clipboard ─────────────────────────────────────────────────

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  if (authLoading || loadingPlan) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Site Published!</h1>
          </div>

          <p className="text-slate-600 mb-6">Your site is now live on the web.</p>

          <div className="bg-slate-100 rounded-lg p-4 mb-6">
            <p className="text-xs text-slate-600 mb-2">Your live URL:</p>
            <p className="text-lg font-mono font-bold text-slate-900 break-all">
              {publishedUrl}
            </p>
          </div>

          <div className="space-y-3">
            <a
              href={publishedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors"
            >
              Visit Your Live Site
            </a>
            <a
              href="/editor"
              className="block w-full py-3 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold rounded-lg transition-colors"
            >
              Back to Editor
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Choose Your Domain</h1>
        <p className="text-slate-600 mb-6">
          Pick how you want your site to appear on the web.
        </p>

        {/* ─── Tab Switcher ──────────────────────────────────────────── */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-6">
          <button
            onClick={() => { setActiveTab('subdomain'); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'subdomain'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Globe className="w-4 h-4" />
            Free Subdomain
          </button>
          <button
            onClick={() => { setActiveTab('custom'); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'custom'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Crown className="w-4 h-4" />
            Custom Domain
            {!isPro && <Lock className="w-3.5 h-3.5 text-slate-400" />}
          </button>
        </div>

        {/* ─── Error Banner ──────────────────────────────────────────── */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* TAB: Free Subdomain                                        */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'subdomain' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Website Address
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
                  placeholder="e.g., myawesome-site"
                  className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-slate-900 font-medium placeholder-slate-400 focus:ring-2 focus:ring-red-600 focus:border-transparent"
                />
                <span className="text-slate-600 font-semibold text-lg whitespace-nowrap">
                  .{process.env.NEXT_PUBLIC_PUBLISHED_DOMAIN_BASE || 'kswd.ca'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                3-63 characters, alphanumeric &amp; hyphens.
                {checking && (
                  <span className="ml-2 text-blue-600 inline-flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Checking...
                  </span>
                )}
              </p>
            </div>

            {domainCheck && !error && (
              <div
                className={`p-4 rounded-lg border-2 flex items-start gap-3 ${
                  domainCheck.available
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                {domainCheck.available ? (
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <X className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-mono font-semibold text-sm text-slate-900">
                    {domainCheck.fullDomain}
                  </p>
                  <p className={`text-sm mt-1 ${domainCheck.available ? 'text-green-700' : 'text-red-700'}`}>
                    {domainCheck.message}
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={handlePublish}
              disabled={publishing || !domainCheck || !domainCheck.available || !siteId}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {publishing && <Loader2 className="w-4 h-4 animate-spin" />}
              {publishing ? 'Publishing...' : 'Publish Site'}
            </button>

            <button
              onClick={() => router.push('/editor')}
              className="w-full py-2 px-4 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* TAB: Custom Domain                                         */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'custom' && (
          <>
            {/* ─── Pro Gate ──────────────────────────────────────────── */}
            {!isPro ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
                  <Lock className="w-8 h-8 text-slate-400" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">
                  Custom Domains are a Pro Feature
                </h2>
                <p className="text-slate-600 mb-6 max-w-sm mx-auto">
                  Upgrade to Pro to register a custom domain like <span className="font-mono font-semibold text-slate-800">yourbusiness.com</span> or
                  connect a domain you already own.
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => router.push(`/pricing?action=publish&siteId=${siteId}`)}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors"
                  >
                    <Crown className="w-4 h-4" />
                    Upgrade to Pro — $30/mo
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <p className="text-xs text-slate-500">
                    Includes a free custom domain, priority support, advanced SEO &amp; more.
                  </p>
                </div>
              </div>
            ) : (
              /* ─── Pro User: Custom Domain Options ─────────────────── */
              <div className="space-y-5">
                {/* Mode Toggle */}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setCustomMode('search'); setError(null); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold border-2 transition-all ${
                      customMode === 'search'
                        ? 'border-red-600 bg-red-50 text-red-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Buy a New Domain
                  </button>
                  <button
                    onClick={() => { setCustomMode('external'); setError(null); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold border-2 transition-all ${
                      customMode === 'external'
                        ? 'border-red-600 bg-red-50 text-red-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <ExternalLink className="w-4 h-4" />
                    Use a Domain I Own
                  </button>
                </div>

                {/* ──── Buy New Domain ──────────────────────────────── */}
                {customMode === 'search' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-2">
                        Search for Your Domain
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value.toLowerCase().replace(/[^a-z0-9-.]/g, ''))}
                          onKeyDown={(e) => e.key === 'Enter' && handleDomainSearch()}
                          placeholder="e.g., mybusiness or mybusiness.ca"
                          className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-slate-900 font-medium placeholder-slate-400 focus:ring-2 focus:ring-red-600 focus:border-transparent"
                        />
                        <button
                          onClick={handleDomainSearch}
                          disabled={searching || searchQuery.trim().length < 2}
                          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          {searching ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Search className="w-4 h-4" />
                          )}
                          Search
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 mt-1.5">
                        A custom domain is included free with your Pro plan.
                      </p>
                    </div>

                    {/* ── Skeleton Loader ─────────────────────────────── */}
                    {searching && (
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                          <p className="text-sm font-medium text-slate-600 transition-all duration-300">
                            {loadingText}
                          </p>
                        </div>
                        <DomainResultsSkeleton />
                      </div>
                    )}

                    {/* ── Recommended: .ca Domain ────────────────────────── */}
                    {!searching && recommendedResults.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 border border-red-200 rounded-full">
                            <Leaf className="w-3.5 h-3.5 text-red-600" />
                            <span className="text-xs font-bold text-red-700">Recommended</span>
                          </div>
                          <h3 className="text-sm font-semibold text-slate-900">Canadian Domain</h3>
                        </div>

                        <div className="p-3 bg-red-50/50 border border-red-100 rounded-lg mb-3">
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-slate-700">
                              <span className="font-semibold text-slate-900">Running a Canadian business?</span>{' '}
                              A <span className="font-mono font-bold">.ca</span> domain builds trust with local customers, boosts your SEO
                              rankings in Canada, and shows you&apos;re proudly Canadian. It&apos;s the go-to choice for businesses serving Canadian markets.
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {recommendedResults.map((result) => (
                            <button
                              key={result.domain}
                              onClick={() => result.available && setSelectedDomain(result.domain)}
                              disabled={!result.available}
                              className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all text-left ${
                                selectedDomain === result.domain
                                  ? 'border-red-600 bg-red-50'
                                  : result.available
                                    ? 'border-red-200 hover:border-red-300 bg-white'
                                    : 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {selectedDomain === result.domain ? (
                                  <CheckCircle2 className="w-4 h-4 text-red-600 flex-shrink-0" />
                                ) : result.available ? (
                                  <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                                ) : (
                                  <X className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                )}
                                <span className="font-mono font-semibold text-sm text-slate-900">
                                  {result.domain}
                                </span>
                              </div>
                              <DomainPriceLabel
                                available={result.available}
                                price={result.price}
                                freeDomainUsed={freeDomainUsed}
                                domain={result.domain}
                                showTooltip={showPriceTooltip === result.domain}
                                onToggleTooltip={setShowPriceTooltip}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── Smart Suggestions (.ca alternatives, only when exact .ca is taken) ── */}
                    {!searching && suggestions.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 border border-purple-200 rounded-full">
                            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                            <span className="text-xs font-bold text-purple-700">Smart Suggestions</span>
                          </div>
                          <h3 className="text-sm font-semibold text-slate-700">Available .ca alternatives</h3>
                        </div>

                        <div className="space-y-2">
                          {suggestions.map((s) => (
                            <button
                              key={s.domain}
                              onClick={() => s.available && setSelectedDomain(s.domain)}
                              disabled={!s.available}
                              className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all text-left ${
                                selectedDomain === s.domain
                                  ? 'border-red-600 bg-red-50'
                                  : s.available
                                    ? 'border-purple-100 hover:border-purple-200 bg-white'
                                    : 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {selectedDomain === s.domain ? (
                                  <CheckCircle2 className="w-4 h-4 text-red-600 flex-shrink-0" />
                                ) : s.available ? (
                                  <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                                ) : (
                                  <X className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                )}
                                <span className="font-mono font-semibold text-sm text-slate-900">
                                  {s.domain}
                                </span>
                              </div>
                              <DomainPriceLabel
                                available={s.available}
                                price={s.price}
                                freeDomainUsed={freeDomainUsed}
                                domain={s.domain}
                                showTooltip={showPriceTooltip === s.domain}
                                onToggleTooltip={setShowPriceTooltip}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── Other TLDs (Collapsible, below suggestions) ──── */}
                    {!searching && otherResults.filter(r => r.available).length > 0 && (
                      <div>
                        <button
                          onClick={() => setShowOtherTlds(!showOtherTlds)}
                          className="w-full flex items-center justify-between py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                        >
                          <span>Explore other extensions (.com, .net, .org...)</span>
                          {showOtherTlds ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>

                        {showOtherTlds && (
                          <div className="space-y-2 mt-2">
                            {otherResults.filter(r => r.available).map((result) => (
                              <button
                                key={result.domain}
                                onClick={() => result.available && setSelectedDomain(result.domain)}
                                disabled={!result.available}
                                className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all text-left ${
                                  selectedDomain === result.domain
                                    ? 'border-red-600 bg-red-50'
                                    : result.available
                                      ? 'border-slate-200 hover:border-slate-300 bg-white'
                                      : 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  {selectedDomain === result.domain ? (
                                    <CheckCircle2 className="w-4 h-4 text-red-600 flex-shrink-0" />
                                  ) : result.available ? (
                                    <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                                  ) : (
                                    <X className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                  )}
                                  <span className="font-mono font-semibold text-sm text-slate-900">
                                    {result.domain}
                                  </span>
                                </div>
                                <DomainPriceLabel
                                  available={result.available}
                                  price={result.price}
                                  freeDomainUsed={freeDomainUsed}
                                  domain={result.domain}
                                  showTooltip={showPriceTooltip === result.domain}
                                  onToggleTooltip={setShowPriceTooltip}
                                />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Register Button */}
                    {!searching && selectedDomain && (() => {
                      const selectedResult = [...recommendedResults, ...suggestions, ...otherResults]
                        .find(r => r.domain === selectedDomain);
                      const domainPrice = selectedResult?.price;
                      const isPaid = freeDomainUsed && domainPrice && domainPrice > 0;

                      return (
                        <div className="pt-3 border-t border-slate-100">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-slate-600">Selected domain:</span>
                            <span className="font-mono font-bold text-slate-900">{selectedDomain}</span>
                          </div>
                          <button
                            onClick={handlePurchaseDomain}
                            disabled={purchasing}
                            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {purchasing ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {isPaid ? 'Proceeding to checkout...' : 'Registering Domain...'}
                              </>
                            ) : (
                              <>
                                <Globe className="w-4 h-4" />
                                {isPaid
                                  ? `Purchase Domain — $${domainPrice.toFixed(2)} USD`
                                  : 'Claim & Connect Domain'}
                              </>
                            )}
                          </button>
                          <p className="text-xs text-center text-slate-500 mt-2">
                            {isPaid
                              ? 'You\u2019ll be redirected to a secure checkout.'
                              : 'No extra cost \u2014 included with your Pro plan.'}
                          </p>
                        </div>
                      );
                    })()}

                    {/* Empty state */}
                    {!searching && recommendedResults.length === 0 && otherResults.length === 0 && searchQuery.length >= 2 && suggestions.length === 0 && (
                      <p className="text-sm text-slate-500 text-center py-4">
                        Search for a domain name to see available options.
                      </p>
                    )}
                  </div>
                )}

                {/* ──── External Domain ─────────────────────────────── */}
                {customMode === 'external' && (
                  <div className="space-y-4">
                    {!dnsInstructions ? (
                      <>
                        <div>
                          <label className="block text-sm font-semibold text-slate-900 mb-2">
                            Your Domain Name
                          </label>
                          <input
                            type="text"
                            value={externalDomain}
                            onChange={(e) => setExternalDomain(e.target.value.toLowerCase())}
                            placeholder="e.g., mybusiness.com"
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-slate-900 font-medium placeholder-slate-400 focus:ring-2 focus:ring-red-600 focus:border-transparent"
                          />
                          <p className="text-xs text-slate-500 mt-1.5">
                            Enter the domain you&apos;ve purchased from another registrar.
                          </p>
                        </div>

                        <button
                          onClick={handleLinkExternal}
                          disabled={linking || !externalDomain.trim() || !externalDomain.includes('.')}
                          className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {linking ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Connecting...
                            </>
                          ) : (
                            <>
                              <ExternalLink className="w-4 h-4" />
                              Connect Domain
                            </>
                          )}
                        </button>
                      </>
                    ) : (
                      /* ──── DNS Instructions ────────────────────────── */
                      <div className="space-y-4">
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <h3 className="text-sm font-bold text-blue-900 mb-1">
                            Configure Your DNS Records
                          </h3>
                          <p className="text-xs text-blue-700">
                            Log into your domain registrar and add the following DNS records. {dnsInstructions.note}
                          </p>
                        </div>

                        <div className="space-y-3">
                          {dnsInstructions.records.map((record, i) => (
                            <div
                              key={i}
                              className="border border-slate-200 rounded-lg p-3 bg-slate-50"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-200 text-slate-700">
                                  {record.type}
                                </span>
                                <button
                                  onClick={() => copyToClipboard(record.value, `${record.type}-${i}`)}
                                  className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
                                >
                                  {copiedField === `${record.type}-${i}` ? (
                                    <><CheckCircle2 className="w-3 h-3 text-green-600" /> Copied</>
                                  ) : (
                                    <><Copy className="w-3 h-3" /> Copy value</>
                                  )}
                                </button>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-slate-500 block">Name / Host</span>
                                  <span className="font-mono font-semibold text-slate-900">{record.name}</span>
                                </div>
                                <div>
                                  <span className="text-slate-500 block">Value / Points to</span>
                                  <span className="font-mono font-semibold text-slate-900 break-all">{record.value}</span>
                                </div>
                              </div>
                              <p className="text-xs text-slate-500 mt-1.5">{record.description}</p>
                            </div>
                          ))}
                        </div>

                        {/* DNS Verification Status */}
                        {dnsChecks && (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 text-xs">
                              {dnsChecks.cname ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                              ) : (
                                <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                              )}
                              <span className={dnsChecks.cname ? 'text-green-700' : 'text-slate-500'}>
                                CNAME record {dnsChecks.cname ? 'verified' : 'not detected yet'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              {dnsChecks.txt ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                              ) : (
                                <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                              )}
                              <span className={dnsChecks.txt ? 'text-green-700' : 'text-slate-500'}>
                                TXT verification {dnsChecks.txt ? 'verified' : 'not detected yet'}
                              </span>
                            </div>
                          </div>
                        )}

                        <button
                          onClick={handleVerifyDns}
                          disabled={verifying}
                          className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {verifying ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Checking DNS...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-4 h-4" />
                              Verify DNS Records
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => {
                            setDnsInstructions(null);
                            setDnsChecks(null);
                            setExternalDomain('');
                          }}
                          className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                        >
                          Start over with a different domain
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Contact Link */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <a
                    href="mailto:support@keystoneweb.ca"
                    className="text-xs text-slate-500 hover:text-red-600 transition-colors"
                  >
                    Need help with your domain? Contact us
                  </a>
                </div>
              </div>
            )}

            {/* Cancel button for custom tab */}
            <div className="mt-4">
              <button
                onClick={() => router.push('/editor')}
                className="w-full py-2 px-4 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function DomainSelectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      }
    >
      <DomainSelectContent />
    </Suspense>
  );
}
