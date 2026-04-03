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
  Link2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/context';
import SiteLimitModal from '@/app/components/SiteLimitModal';

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

interface OwnedDomain {
  id: string;
  domain: string;
  site_id: string | null;
  status: string;
  is_free_with_pro: boolean;
  expires_at: string | null;
  auto_renew: boolean;
}

interface TransferPriceData {
  domain: string;
  transferPrice: number;
  freeDomainUsed: boolean;
  isFreeEligible: boolean;
  userOwesUsd: number;
  userOwesCents: number;
  freeCredit: number;
}

interface TransferContact {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

type CustomMode = 'search' | 'external';

// ─── DomainManager Props (for embedding in other pages) ─────────────────────

export interface DomainManagerProps {
  siteId: string | null;
  transferInitiated?: boolean;
  /** When true, renders inline without full-page wrapper/auth redirect */
  embedded?: boolean;
  /** Called on successful domain setup */
  onSuccess?: (url: string) => void;
  /** Called when Cancel is clicked (standalone mode defaults to /editor) */
  onCancel?: () => void;
}

// ─── URL → Root Domain Extraction ────────────────────────────────────────────

function extractRootDomain(input: string): string {
  let cleaned = input.trim();
  // Strip protocol
  cleaned = cleaned.replace(/^https?:\/\//i, '');
  // Strip www. prefix
  cleaned = cleaned.replace(/^www\./i, '');
  // Strip trailing slashes and paths
  cleaned = cleaned.replace(/\/.*$/, '');
  // Strip port
  cleaned = cleaned.replace(/:\d+$/, '');
  return cleaned.toLowerCase();
}

// ─── Registrar-Specific DNS Guides ───────────────────────────────────────────

const REGISTRAR_GUIDES = [
  {
    name: 'GoDaddy',
    steps: [
      'Log in to your GoDaddy account and go to "My Products".',
      'Find your domain and click "DNS" or "Manage DNS".',
      'Under "Records", click "Add" to add each record below.',
      'For the A record: Select Type "A", enter "@" in the Name field, paste the IP address in the Value field.',
      'For the CNAME record: Select Type "CNAME", enter "www" in the Name field, paste the target in the Value field.',
      'For the TXT record: Select Type "TXT", enter "@" in the Name field, paste the verification value in the Value/Data field.',
      'Click "Save" for each record. Changes may take a few minutes.',
    ],
  },
  {
    name: 'Namecheap',
    steps: [
      'Log in to Namecheap and go to "Domain List" in the sidebar.',
      'Click "Manage" next to your domain, then go to the "Advanced DNS" tab.',
      'Click "Add New Record" for each record below.',
      'For the A record: Select Type "A Record", enter "@" as Host, paste the IP address as Value.',
      'For the CNAME record: Select Type "CNAME Record", enter "www" as Host, paste the target as Value.',
      'For the TXT record: Select Type "TXT Record", enter "@" as Host, paste the verification value as Value.',
      'Click the green checkmark to save each record.',
    ],
  },
  {
    name: 'Cloudflare',
    steps: [
      'Log in to Cloudflare and select your domain from the dashboard.',
      'Go to "DNS" > "Records" in the left sidebar.',
      'Click "Add Record" for each record below.',
      'For the A record: Select Type "A", enter "@" in Name, paste the IP address in Content. Set Proxy status to "DNS only" (grey cloud).',
      'For the CNAME record: Select Type "CNAME", enter "www" in Name, paste the target in Content. Set Proxy status to "DNS only" (grey cloud).',
      'For the TXT record: Select Type "TXT", enter "@" in Name, paste the verification value in Content.',
      'Click "Save" for each record. Changes propagate within minutes.',
    ],
  },
  {
    name: 'Google Domains / Squarespace',
    steps: [
      'Log in to Google Domains (now Squarespace Domains) and select your domain.',
      'Go to "DNS" in the left sidebar, then scroll to "Custom records".',
      'Click "Manage custom records".',
      'For the A record: Leave Host name blank (or enter "@"), select Type "A", paste the IP address in Data.',
      'For the CNAME record: Enter "www" as Host name, select Type "CNAME", paste the target in Data.',
      'For the TXT record: Leave Host name blank (or enter "@"), select Type "TXT", paste the verification value in Data.',
      'Click "Save" after adding all records.',
    ],
  },
];

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

export function DomainManager({
  siteId: siteIdProp,
  transferInitiated: transferInitiatedProp = false,
  embedded = false,
  onSuccess,
  onCancel,
}: DomainManagerProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const siteId = siteIdProp;
  const transferInitiatedParam = transferInitiatedProp;

  // Site domain status (fetched from API)
  const [siteStatus, setSiteStatus] = useState<{
    publishedDomain: string | null;
    customDomain: string | null;
    pendingCustomDomain: string | null;
    transferStatus: string | null;
  } | null>(null);
  const [loadingSiteStatus, setLoadingSiteStatus] = useState(true);

  // Shared state
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState('');
  const [publishLimitInfo, setPublishLimitInfo] = useState<{ plan: string; limit: number } | null>(null);

  // Subscription state
  const [userPlan, setUserPlan] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);

  // Subdomain state
  const [subdomain, setSubdomain] = useState('');
  const [domainCheck, setDomainCheck] = useState<DomainCheckResult | null>(null);
  const [checking, setChecking] = useState(false);

  // Custom domain state
  const [customMode, setCustomMode] = useState<CustomMode>(transferInitiatedParam ? 'external' : 'search');
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
  const [expandedRegistrar, setExpandedRegistrar] = useState<string | null>(null);

  // Owned domains state
  const [ownedDomains, setOwnedDomains] = useState<OwnedDomain[]>([]);
  const [loadingOwnedDomains, setLoadingOwnedDomains] = useState(false);
  const [externalMode, setExternalMode] = useState<'owned' | 'import' | 'transfer'>(
    transferInitiatedParam ? 'transfer' : 'import'
  );

  // Cross-site domain conflict state
  const [otherSiteWithDomain, setOtherSiteWithDomain] = useState<{ siteId: string; domain: string; siteTitle: string } | null>(null);
  const [showConflictWarning, setShowConflictWarning] = useState(false);
  const [pendingConflictDomain, setPendingConflictDomain] = useState<string | null>(null);

  // Domain switch rate limit state
  const [switchRateLimited, setSwitchRateLimited] = useState(false);
  const [switchNextAvailable, setSwitchNextAvailable] = useState<string | null>(null);

  // Transfer state
  const [transferDomain, setTransferDomain] = useState('');
  const [transferPriceData, setTransferPriceData] = useState<TransferPriceData | null>(null);
  const [transferPriceLoading, setTransferPriceLoading] = useState(false);
  const [transferAuthCode, setTransferAuthCode] = useState('');
  const [transferContact, setTransferContact] = useState<TransferContact>({
    firstName: '', lastName: '', email: '', phone: '',
    address1: '', city: '', state: '', zip: '', country: 'CA',
  });
  const [showTransferContact, setShowTransferContact] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [transferInitiated, setTransferInitiated] = useState(transferInitiatedParam);
  const [verifyingTransfer, setVerifyingTransfer] = useState(false);

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

  // Fetch site domain status
  const fetchSiteStatus = useCallback(async () => {
    if (!siteId) return;
    setLoadingSiteStatus(true);
    try {
      const res = await fetch(`/api/admin/domains?siteId=${siteId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSiteStatus({
          publishedDomain: data.publishedDomain,
          customDomain: data.customDomain,
          pendingCustomDomain: data.pendingCustomDomain,
          transferStatus: data.transferStatus,
        });
        // Pre-populate subdomain input if site already has one
        if (data.publishedDomain && !subdomain) {
          setSubdomain(data.publishedDomain);
        }
      }
    } catch (err) {
      console.error('Failed to fetch site status:', err);
    } finally {
      setLoadingSiteStatus(false);
    }
  }, [siteId]);

  useEffect(() => {
    if (authLoading || !user || !siteId) return;
    fetchSiteStatus();
  }, [user, authLoading, siteId, fetchSiteStatus]);

  // Fetch cross-site domain conflict: check if another user site has a custom domain
  useEffect(() => {
    if (authLoading || !user || !siteId) return;
    fetch('/api/user/sites', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.sites) return;
        const conflict = data.sites.find((s: any) => s.customDomain && s.id !== siteId);
        if (conflict) {
          setOtherSiteWithDomain({
            siteId: conflict.id,
            domain: conflict.customDomain,
            siteTitle: conflict.siteSlug || conflict.id.slice(0, 8),
          });
        }
      })
      .catch(console.error);
  }, [user, authLoading, siteId]);

  // Check domain switch rate limit
  useEffect(() => {
    if (authLoading || !user) return;
    fetch('/api/domains/switch-status', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.rateLimited) {
          setSwitchRateLimited(true);
          setSwitchNextAvailable(data.nextAvailableFormatted ?? null);
        }
      })
      .catch(console.error);
  }, [user, authLoading]);

  // Fetch owned domains (unallocated ones for the dropdown)
  useEffect(() => {
    if (authLoading || !user) return;

    setLoadingOwnedDomains(true);
    fetch('/api/domains/owned', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.domains) {
          setOwnedDomains(data.domains);
          // If user has unallocated domains, default to the owned tab
          const unallocated = data.domains.filter((d: OwnedDomain) => !d.site_id);
          if (unallocated.length > 0) {
            setExternalMode('owned');
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoadingOwnedDomains(false));
  }, [user, authLoading]);

  // Auth verification (skip redirect in embedded mode — parent handles auth)
  useEffect(() => {
    if (embedded || authLoading) return;

    if (!user) {
      router.push('/signin');
      return;
    }

    if (!siteId) {
      setError('Invalid session. Missing siteId.');
    }
  }, [user, authLoading, siteId, router, embedded]);

  // ─── Subdomain Logic ────────────────────────────────────────────────────

  const checkDomainAvailability = useCallback(async (domainToCheck: string) => {
    setChecking(true);
    setError(null);

    try {
      const baseDomain = process.env.NEXT_PUBLIC_PUBLISHED_DOMAIN_BASE || 'kswd.ca';
      const siteIdParam = siteId ? `&siteId=${siteId}` : '';
      const res = await fetch(
        `/api/domains/check-availability?subdomain=${domainToCheck}&baseDomain=${baseDomain}${siteIdParam}`,
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
  }, [siteId]);

  useEffect(() => {
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
  }, [subdomain, checkDomainAvailability]);

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
        if (errorData.publishLimitReached) {
          setPublishLimitInfo({ plan: errorData.plan, limit: errorData.limit });
          return;
        }
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
    const cleanedQuery = extractRootDomain(searchQuery);
    if (!cleanedQuery || cleanedQuery.length < 2) return;

    setSearching(true);
    setError(null);
    setRecommendedResults([]);
    setOtherResults([]);
    setSuggestions([]);
    setSelectedDomain(null);
    setShowOtherTlds(false);

    try {
      const res = await fetch(
        `/api/domains/search?query=${encodeURIComponent(cleanedQuery)}`,
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

  // ─── Assign Owned Domain to Site ────────────────────────────────────────
  const handleAssignOwnedDomain = async (domain: string) => {
    if (!siteId) return;

    setLinking(true);
    setError(null);

    try {
      const res = await fetch('/api/domains/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ siteId, domain }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to assign domain');
      }

      setSuccess(true);
      setPublishedUrl(`https://${domain}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign domain');
      console.error(err);
    } finally {
      setLinking(false);
    }
  };

  const handleLinkExternal = async () => {
    const cleaned = extractRootDomain(externalDomain);
    if (!cleaned || !siteId) return;

    setLinking(true);
    setError(null);
    setDnsInstructions(null);

    try {
      const res = await fetch('/api/domains/link-external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ siteId, domain: cleaned }),
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

  // ─── Transfer Domain ────────────────────────────────────────────────────

  const fetchTransferPrice = useCallback(async (domain: string) => {
    setTransferPriceData(null);
    if (!domain || !domain.includes('.')) return;
    setTransferPriceLoading(true);
    try {
      const res = await fetch(
        `/api/domains/transfer-price?domain=${encodeURIComponent(domain)}`,
        { credentials: 'include' }
      );
      if (!res.ok) return;
      const data: TransferPriceData = await res.json();
      setTransferPriceData(data);
    } catch {
      // silent — price just won't show
    } finally {
      setTransferPriceLoading(false);
    }
  }, []);

  useEffect(() => {
    if (externalMode !== 'transfer') return;
    const cleaned = extractRootDomain(transferDomain);
    const timer = setTimeout(() => {
      if (cleaned && cleaned.includes('.')) fetchTransferPrice(cleaned);
    }, 600);
    return () => clearTimeout(timer);
  }, [transferDomain, externalMode, fetchTransferPrice]);

  const handleInitiateTransfer = async () => {
    const cleaned = extractRootDomain(transferDomain);
    if (!cleaned || !siteId || !transferAuthCode.trim()) return;

    setTransferring(true);
    setError(null);

    try {
      const res = await fetch('/api/domains/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          siteId,
          domain: cleaned,
          authCode: transferAuthCode.trim(),
          contact: transferContact,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to initiate transfer');
      }

      if (result.url) {
        // Redirect to Stripe for paid transfers
        window.location.href = result.url;
        return;
      }

      // Free transfer — show pending state
      setTransferInitiated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate transfer');
    } finally {
      setTransferring(false);
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

  const handleVerifyTransferStatus = async () => {
    if (!siteId) return;

    setVerifyingTransfer(true);
    setError(null);

    try {
      const res = await fetch('/api/domains/check-transfer-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ siteId }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to check transfer status');
      }

      const result = await res.json();
      
      if (result.status === 'completed') {
        setSuccess(true);
        setPublishedUrl(`https://${result.domain}`);
      } else {
        // Just refresh the UI status to show it's still initiated
        await fetchSiteStatus();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check transfer status');
      console.error(err);
    } finally {
      setVerifyingTransfer(false);
    }
  };

  // ─── Copy to Clipboard ─────────────────────────────────────────────────

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  if (authLoading || loadingPlan || loadingSiteStatus) {
    if (embedded) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  // Success state
  if (success) {
    if (embedded) {
      if (onSuccess) onSuccess(publishedUrl);
      return (
        <div className="p-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
            <Check className="w-6 h-6 text-green-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Domain Configured!</h2>
          <p className="text-sm text-slate-600 mb-4">Your site is now live on the web.</p>
          <div className="bg-slate-100 rounded-lg p-3 mb-4">
            <p className="text-xs text-slate-600 mb-1">Your live URL:</p>
            <p className="text-sm font-mono font-bold text-slate-900 break-all">{publishedUrl}</p>
          </div>
          <a
            href={publishedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-colors"
          >
            Visit Your Live Site
          </a>
        </div>
      );
    }
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

  const hasActiveSubdomain = !!siteStatus?.publishedDomain;
  const baseDomainDisplay = process.env.NEXT_PUBLIC_PUBLISHED_DOMAIN_BASE || 'kswd.ca';

  const outerWrapperClass = embedded
    ? ''
    : 'min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center p-4';
  const innerWrapperClass = embedded
    ? 'w-full space-y-6'
    : 'bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 space-y-6';

  return (
    <div className={outerWrapperClass}>
      <div className={innerWrapperClass}>
        {!embedded && (
          <>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Set Up Your Domain</h1>
            <p className="text-slate-600 mb-0">
              Your free subdomain is always active. Optionally add a custom domain.
            </p>
          </>
        )}

        {/* ─── Error Banner ──────────────────────────────────────────── */}
        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* SECTION: Free Subdomain (always visible)                    */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <div className={`rounded-xl border ${hasActiveSubdomain ? 'border-green-200 bg-green-50/30' : 'border-slate-200 bg-white'} overflow-hidden`}>
          <div className={`px-5 py-3 border-b ${hasActiveSubdomain ? 'border-green-100 bg-green-50' : 'border-slate-100 bg-slate-50'} flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-slate-600" />
              <h3 className="text-sm font-bold text-slate-900">Free Subdomain</h3>
            </div>
            {hasActiveSubdomain && (
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-xs font-semibold text-green-700">Currently active</span>
              </div>
            )}
          </div>
          <div className="px-5 py-4 space-y-4">
            {hasActiveSubdomain && (
              <div className="flex items-center gap-2 p-2.5 bg-green-50 rounded-lg border border-green-100">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                <span className="font-mono text-sm font-semibold text-slate-900">{siteStatus.publishedDomain}.{baseDomainDisplay}</span>
                <span className="text-[10px] text-green-700 font-medium ml-auto">Live</span>
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                {hasActiveSubdomain ? 'Change Subdomain' : 'Website Address'}
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
                  .{baseDomainDisplay}
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
                className={`p-4 rounded-lg border-2 flex items-start gap-3 ${domainCheck.available
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
              {publishing ? 'Publishing...' : hasActiveSubdomain ? 'Update Subdomain' : 'Publish Site'}
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* SECTION: Active/Pending Custom Domain Status                */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {siteStatus?.customDomain && (
          <div className="rounded-xl border border-green-200 bg-green-50/30 overflow-hidden">
            <div className="px-5 py-3 border-b border-green-100 bg-green-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-green-600" />
                <h3 className="text-sm font-bold text-slate-900">Active Custom Domain</h3>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-xs font-semibold text-green-700">Verified &amp; Active</span>
              </div>
            </div>
            <div className="px-5 py-4 flex items-center justify-between">
              <span className="font-mono text-sm font-semibold text-slate-900">{siteStatus.customDomain}</span>
              <a href={`https://${siteStatus.customDomain}`} target="_blank" rel="noopener noreferrer" className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1">
                Visit <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {siteStatus?.pendingCustomDomain && (
          <div className="rounded-xl border border-amber-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-amber-100 bg-amber-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-amber-900">Pending Domain</h3>
              </div>
              <button
                onClick={handleVerifyTransferStatus}
                disabled={verifyingTransfer}
                className="flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-900 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${verifyingTransfer ? 'animate-spin' : ''}`} />
                {verifyingTransfer ? 'Checking...' : 'Refresh Status'}
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <span className="font-mono text-sm font-semibold text-slate-900">{siteStatus.pendingCustomDomain}</span>
              {siteStatus.transferStatus && siteStatus.transferStatus !== 'completed' ? (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                  <p className="text-xs text-blue-800">
                    <strong>Domain transfer in progress.</strong> This typically takes 5-7 days.
                    Status: <span className="font-semibold capitalize">{siteStatus.transferStatus.replace('_', ' ')}</span>
                  </p>
                  <p className="text-xs text-blue-700">
                    Check your email for a verification message from <strong>Vercel Domain Services</strong>, our domain services partner. You must click the link in that email to avoid suspension of the transfer.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-800">
                    <strong>DNS verification pending.</strong> Configure the required DNS records at your registrar, then use the DNS connect option below to verify.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* SECTION: Change Custom Domain                               */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <Crown className="w-4 h-4 text-slate-600" />
            <h3 className="text-sm font-bold text-slate-900">
              {siteStatus?.customDomain ? 'Change Custom Domain' : 'Custom Domain'}
            </h3>
            {!isPro && <Lock className="w-3.5 h-3.5 text-slate-400 ml-1" />}
            <span className="text-xs text-slate-500 ml-auto">Pro Feature</span>
          </div>
          <div className="px-5 py-4">
            {!isPro ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
                  <Lock className="w-8 h-8 text-slate-400" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">
                  Custom Domains are a Pro Feature
                </h2>
                <p className="text-slate-600 mb-6 max-w-sm mx-auto">
                  Upgrade to Pro to register a custom domain like <span className="font-mono font-semibold text-slate-800">yourbusiness.ca</span> or
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

                {/* Account-level policy note */}
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 leading-relaxed">
                  <strong>1 custom domain per account.</strong> Your Pro plan includes one free custom domain registration. You can change it to a new domain once per month — a one-time registration fee applies for the new domain.
                  {freeDomainUsed && switchRateLimited && switchNextAvailable && (
                    <span className="block mt-1 font-semibold text-amber-700">
                      Domain switch available again on {switchNextAvailable}.
                    </span>
                  )}
                </div>

                {/* Cross-site conflict warning */}
                {otherSiteWithDomain && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-900 font-semibold mb-1">
                      Custom domain already in use on another site
                    </p>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Your account&apos;s custom domain <span className="font-mono font-semibold">{otherSiteWithDomain.domain}</span> is currently assigned to &ldquo;{otherSiteWithDomain.siteTitle}&rdquo;.
                      Adding a domain to this site will disconnect it from that site.
                    </p>
                  </div>
                )}

                {/* Mode Toggle */}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setCustomMode('search'); setError(null); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold border-2 transition-all ${customMode === 'search'
                        ? 'border-red-600 bg-red-50 text-red-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    {siteStatus?.customDomain ? 'Switch Domain' : 'Register a Domain'}
                  </button>
                  <button
                    onClick={() => { setCustomMode('external'); setError(null); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold border-2 transition-all ${customMode === 'external'
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
                          <span className="hidden sm:inline">Search</span>
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
                              className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all text-left ${selectedDomain === result.domain
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
                              className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all text-left ${selectedDomain === s.domain
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
                                className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all text-left ${selectedDomain === result.domain
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
                      // Switch price = Vercel price + $5 rounded to .99
                      const switchPrice = domainPrice ? (Math.ceil(domainPrice + 5) - 0.01) : null;

                      return (
                        <div className="pt-3 border-t border-slate-100 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-600">Selected domain:</span>
                            <span className="font-mono font-bold text-slate-900">{selectedDomain}</span>
                          </div>

                          {/* Cross-site conflict diagram */}
                          {otherSiteWithDomain && isPaid && (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                              <p className="text-xs font-semibold text-amber-900 mb-2">What will change:</p>
                              <div className="space-y-1 text-xs font-mono text-amber-800">
                                <div><span className="text-slate-500">{otherSiteWithDomain.siteTitle}:</span> <span className="line-through text-red-500">{otherSiteWithDomain.domain}</span> → <span className="text-slate-700">{otherSiteWithDomain.domain.split('.')[0]}.kswd.ca</span></div>
                                <div><span className="text-slate-500">This site:</span> <span className="text-slate-500">*.kswd.ca</span> → <span className="text-green-700 font-bold">{selectedDomain}</span></div>
                              </div>
                            </div>
                          )}

                          {switchRateLimited ? (
                            <div className="p-3 bg-slate-100 rounded-lg text-center">
                              <p className="text-xs text-slate-600">
                                Domain switch available again on <strong>{switchNextAvailable}</strong>.
                              </p>
                            </div>
                          ) : (
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
                                    ? `Switch Domain — $${switchPrice?.toFixed(2) ?? domainPrice?.toFixed(2)} USD`
                                    : 'Claim & Connect Domain'}
                                </>
                              )}
                            </button>
                          )}
                          <p className="text-xs text-center text-slate-500">
                            {isPaid
                              ? 'One-time registration fee. You\u2019ll be redirected to a secure checkout.'
                              : 'No extra cost \u2014 your free domain included with Pro.'}
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
                    {/* Owned Domains Section (if any are unallocated) */}
                    {(() => {
                      const unallocated = ownedDomains.filter((d) => !d.site_id && d.status === 'completed');
                      if (unallocated.length === 0 && !loadingOwnedDomains) {
                        // Skip directly to import mode, no toggle needed
                      }
                      return (unallocated.length > 0 || loadingOwnedDomains) ? (
                        <>
                          {/* Mode toggle for owned / import / transfer */}
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={() => setExternalMode('owned')}
                              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold border-2 transition-all ${externalMode === 'owned'
                                ? 'border-red-600 bg-red-50 text-red-700'
                                : 'border-slate-200 text-slate-600 hover:border-slate-300'
                              }`}
                            >
                              <Link2 className="w-4 h-4" />
                              Use an Owned Domain
                            </button>
                            <button
                              onClick={() => setExternalMode('import')}
                              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold border-2 transition-all ${externalMode === 'import'
                                ? 'border-red-600 bg-red-50 text-red-700'
                                : 'border-slate-200 text-slate-600 hover:border-slate-300'
                              }`}
                            >
                              <ExternalLink className="w-4 h-4" />
                              Connect via DNS
                            </button>
                            <button
                              onClick={() => setExternalMode('transfer')}
                              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold border-2 transition-all ${externalMode === 'transfer'
                                ? 'border-red-600 bg-red-50 text-red-700'
                                : 'border-slate-200 text-slate-600 hover:border-slate-300'
                              }`}
                            >
                              <ArrowRight className="w-4 h-4" />
                              Transfer to Keystone
                            </button>
                          </div>

                          {/* Owned domains dropdown */}
                          {externalMode === 'owned' && (
                            <div className="space-y-3">
                              <p className="text-sm text-slate-600">
                                Select one of your owned domains to connect to this site.
                              </p>
                              {loadingOwnedDomains ? (
                                <div className="flex items-center gap-2 p-4 bg-slate-50 rounded-lg">
                                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                                  <span className="text-sm text-slate-500">Loading your domains...</span>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {unallocated.map((d) => (
                                    <button
                                      key={d.id}
                                      onClick={() => handleAssignOwnedDomain(d.domain)}
                                      disabled={linking}
                                      className="w-full flex items-center justify-between p-3 rounded-lg border-2 border-slate-200 hover:border-red-300 bg-white transition-all text-left"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Globe className="w-4 h-4 text-slate-500" />
                                        <span className="font-mono font-semibold text-sm text-slate-900">{d.domain}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-green-700 font-medium">
                                          {d.is_free_with_pro ? 'Included with Pro' : 'Purchased'}
                                        </span>
                                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      ) : null;
                    })()}

                    {/* When no owned domains: show the import/transfer toggle */}
                    {ownedDomains.filter((d) => !d.site_id && d.status === 'completed').length === 0 && !loadingOwnedDomains && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setExternalMode('import')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold border-2 transition-all ${externalMode === 'import'
                            ? 'border-red-600 bg-red-50 text-red-700'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <ExternalLink className="w-4 h-4" />
                          Connect via DNS
                        </button>
                        <button
                          onClick={() => setExternalMode('transfer')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold border-2 transition-all ${externalMode === 'transfer'
                            ? 'border-red-600 bg-red-50 text-red-700'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <ArrowRight className="w-4 h-4" />
                          Transfer to Keystone
                        </button>
                      </div>
                    )}

                    {/* Import from Other Provider */}
                    {externalMode === 'import' && !dnsInstructions ? (
                      <>
                        <div>
                          <label className="block text-sm font-semibold text-slate-900 mb-2">
                            Your Domain Name
                          </label>
                          <input
                            type="text"
                            value={externalDomain}
                            onChange={(e) => setExternalDomain(e.target.value)}
                            placeholder="e.g., mybusiness.com or https://mybusiness.com"
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-slate-900 font-medium placeholder-slate-400 focus:ring-2 focus:ring-red-600 focus:border-transparent"
                          />
                          <p className="text-xs text-slate-500 mt-1.5">
                            Enter the domain you&apos;ve purchased from another registrar. You can paste a full URL &mdash; we&apos;ll extract the domain automatically.
                          </p>
                        </div>

                        <button
                          onClick={handleLinkExternal}
                          disabled={linking || !extractRootDomain(externalDomain) || !extractRootDomain(externalDomain).includes('.')}
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
                    ) : externalMode === 'import' && dnsInstructions ? (
                      /* ──── DNS Instructions (Improved) ─────────────────── */
                      <div className="space-y-4">
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <h3 className="text-sm font-bold text-blue-900 mb-1">
                            Configure Your DNS Records
                          </h3>
                          <p className="text-xs text-blue-700">
                            Log into your domain registrar (where you bought your domain) and add the following 3 DNS records. You&apos;ll need to find the &quot;DNS Settings&quot;, &quot;DNS Management&quot;, or &quot;DNS Records&quot; section — each registrar calls it something slightly different.
                          </p>
                          <p className="text-xs text-blue-600 mt-1">
                            {dnsInstructions.note}
                          </p>
                        </div>

                        <div className="space-y-3">
                          {dnsInstructions.records.map((record, i) => (
                            <div
                              key={i}
                              className="border border-slate-200 rounded-lg overflow-hidden bg-white"
                            >
                              {/* Record header */}
                              <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 border-b border-slate-200">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-800 text-white">
                                  {record.type}
                                </span>
                                <span className="text-xs text-slate-600 flex-1">{record.description}</span>
                              </div>

                              {/* Record fields with individual copy buttons */}
                              <div className="p-3 space-y-2">
                                {/* Type field */}
                                <div className="flex items-center justify-between p-2 bg-slate-50 rounded-md">
                                  <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Type</span>
                                    <span className="font-mono font-semibold text-sm text-slate-900">{record.type}</span>
                                  </div>
                                  <button
                                    onClick={() => copyToClipboard(record.type, `type-${i}`)}
                                    className="p-1.5 rounded-md hover:bg-slate-200 transition-colors"
                                    title="Copy type"
                                  >
                                    {copiedField === `type-${i}` ? (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                                    )}
                                  </button>
                                </div>

                                {/* Name/Host field */}
                                <div className="flex items-center justify-between p-2 bg-slate-50 rounded-md">
                                  <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Name / Host</span>
                                    <span className="font-mono font-semibold text-sm text-slate-900">{record.name}</span>
                                  </div>
                                  <button
                                    onClick={() => copyToClipboard(record.name, `name-${i}`)}
                                    className="p-1.5 rounded-md hover:bg-slate-200 transition-colors"
                                    title="Copy name"
                                  >
                                    {copiedField === `name-${i}` ? (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                                    )}
                                  </button>
                                </div>

                                {/* Value field */}
                                <div className="flex items-center justify-between p-2 bg-slate-50 rounded-md">
                                  <div className="flex-1 min-w-0">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Value / Points to</span>
                                    <span className="font-mono font-semibold text-sm text-slate-900 break-all">{record.value}</span>
                                  </div>
                                  <button
                                    onClick={() => copyToClipboard(record.value, `value-${i}`)}
                                    className="p-1.5 rounded-md hover:bg-slate-200 transition-colors flex-shrink-0 ml-2"
                                    title="Copy value"
                                  >
                                    {copiedField === `value-${i}` ? (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* What are these records? Explainer */}
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <div className="flex items-start gap-2">
                            <HelpCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div className="text-xs text-amber-800 space-y-1">
                              <p><strong>A Record</strong> — Points your root domain (e.g., mybusiness.com) to the Vercel server IP address (<code className="bg-amber-100 px-1 rounded">76.76.21.21</code>) that hosts your site.</p>
                              <p><strong>CNAME Record</strong> — Points the <code className="bg-amber-100 px-1 rounded">www</code> version of your domain to our servers so both www and non-www work.</p>
                              <p><strong>TXT Record</strong> — A verification token that proves you own this domain. It doesn&apos;t affect your website or email &mdash; it&apos;s just a text string we check to confirm ownership.</p>
                            </div>
                          </div>
                        </div>

                        {/* Registrar-Specific Guides */}
                        <div>
                          <h4 className="text-sm font-semibold text-slate-800 mb-2">Step-by-step for your registrar</h4>
                          <div className="space-y-1">
                            {REGISTRAR_GUIDES.map((registrar) => (
                              <div key={registrar.name} className="border border-slate-200 rounded-lg overflow-hidden">
                                <button
                                  onClick={() => setExpandedRegistrar(expandedRegistrar === registrar.name ? null : registrar.name)}
                                  className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-50 transition-colors"
                                >
                                  <span className="text-sm font-semibold text-slate-700">{registrar.name}</span>
                                  {expandedRegistrar === registrar.name ? (
                                    <ChevronUp className="w-4 h-4 text-slate-400" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-slate-400" />
                                  )}
                                </button>
                                {expandedRegistrar === registrar.name && (
                                  <div className="px-3 pb-3 border-t border-slate-100">
                                    <ol className="list-decimal list-inside space-y-1.5 mt-2">
                                      {registrar.steps.map((step, idx) => (
                                        <li key={idx} className="text-xs text-slate-600 leading-relaxed">{step}</li>
                                      ))}
                                    </ol>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-slate-500 mt-2">
                            Don&apos;t see your registrar? The general process is the same: find DNS settings, add the 3 records above.
                          </p>
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
                    ) : null}

                    {/* ──── Transfer to Keystone ────────────────────── */}
                    {externalMode === 'transfer' && (
                      <div className="space-y-4">
                        {transferInitiated ? (
                          <div className="p-5 bg-green-50 border border-green-200 rounded-lg text-center space-y-2">
                            <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto" />
                            <h3 className="font-bold text-green-900">Transfer Initiated!</h3>
                            <p className="text-sm text-green-800">
                              Watch for an approval email from your current registrar — you&apos;ll need to confirm the transfer there. This typically takes <strong>5–7 days</strong> to complete.
                            </p>
                            <p className="text-xs text-green-700 mt-1">
                              Once approved, your domain will automatically point to your Keystone site.
                            </p>
                          </div>
                        ) : (
                          <>
                            {/* Pre-transfer checklist */}
                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                              <h3 className="text-sm font-bold text-amber-900 mb-2">Before you begin</h3>
                              <ol className="space-y-1.5 text-xs text-amber-800 list-decimal list-inside">
                                <li>Log into your current registrar and <strong>unlock</strong> the domain (sometimes called &quot;disable domain lock&quot;)</li>
                                <li>Get your <strong>EPP / Authorization code</strong> from your registrar (usually under domain settings)</li>
                                <li>Make sure DNSSEC is <strong>disabled</strong> at your current registrar</li>
                                <li>Domain must be <strong>at least 60 days old</strong> (ICANN requirement)</li>
                              </ol>
                            </div>

                            {/* Domain input + live price */}
                            <div>
                              <label className="block text-sm font-semibold text-slate-900 mb-2">
                                Domain to Transfer
                              </label>
                              <input
                                type="text"
                                value={transferDomain}
                                onChange={(e) => setTransferDomain(e.target.value)}
                                placeholder="e.g., mybusiness.com"
                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-slate-900 font-medium placeholder-slate-400 focus:ring-2 focus:ring-red-600 focus:border-transparent"
                              />
                              {/* Pricing feedback */}
                              <div className="mt-2 min-h-[20px]">
                                {transferPriceLoading && (
                                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Checking transfer price…
                                  </div>
                                )}
                                {!transferPriceLoading && transferPriceData && (
                                  <div className="flex items-center gap-2">
                                    {transferPriceData.isFreeEligible ? (
                                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                                        <Check className="w-3 h-3" />
                                        Included with Pro
                                      </span>
                                    ) : transferPriceData.userOwesUsd > 0 && !transferPriceData.freeDomainUsed ? (
                                      <span className="text-xs text-slate-700">
                                        <span className="font-bold">${transferPriceData.userOwesUsd.toFixed(2)} USD</span>
                                        <span className="text-slate-500 ml-1">
                                          (${transferPriceData.transferPrice.toFixed(2)} transfer − ${transferPriceData.freeCredit} Pro credit)
                                        </span>
                                      </span>
                                    ) : (
                                      <span className="text-xs font-bold text-slate-800">
                                        ${transferPriceData.userOwesUsd.toFixed(2)} USD/yr
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* EPP code */}
                            <div>
                              <label className="block text-sm font-semibold text-slate-900 mb-2">
                                EPP / Authorization Code
                              </label>
                              <input
                                type="text"
                                value={transferAuthCode}
                                onChange={(e) => setTransferAuthCode(e.target.value)}
                                placeholder="Paste your EPP code here"
                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg font-mono text-slate-900 text-sm placeholder-slate-400 focus:ring-2 focus:ring-red-600 focus:border-transparent"
                              />
                              <p className="text-xs text-slate-500 mt-1">
                                Get this from your current registrar under domain settings.
                              </p>
                            </div>

                            {/* Contact info (collapsible) */}
                            <div>
                              <button
                                onClick={() => setShowTransferContact(!showTransferContact)}
                                className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors"
                              >
                                {showTransferContact ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                Registrant Contact Info
                                <span className="text-xs font-normal text-slate-500">(required by ICANN)</span>
                              </button>
                              {showTransferContact && (
                                <div className="mt-3 grid grid-cols-2 gap-3">
                                  {(
                                    [
                                      { key: 'firstName', label: 'First Name', placeholder: 'Jane' },
                                      { key: 'lastName', label: 'Last Name', placeholder: 'Smith' },
                                      { key: 'email', label: 'Email', placeholder: 'jane@example.com', full: true },
                                      { key: 'phone', label: 'Phone', placeholder: '+1.4165551234', full: true },
                                      { key: 'address1', label: 'Address', placeholder: '123 Main St', full: true },
                                      { key: 'city', label: 'City', placeholder: 'Toronto' },
                                      { key: 'state', label: 'Province / State', placeholder: 'ON' },
                                      { key: 'zip', label: 'Postal Code', placeholder: 'M5V 3A8' },
                                      { key: 'country', label: 'Country Code', placeholder: 'CA' },
                                    ] as Array<{ key: keyof TransferContact; label: string; placeholder: string; full?: boolean }>
                                  ).map(({ key, label, placeholder, full }) => (
                                    <div key={key} className={full ? 'col-span-2' : ''}>
                                      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                                      <input
                                        type="text"
                                        value={transferContact[key]}
                                        onChange={(e) => setTransferContact((c) => ({ ...c, [key]: e.target.value }))}
                                        placeholder={placeholder}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-red-600 focus:border-transparent"
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Transfer note */}
                            <p className="text-xs text-slate-500">
                              Transfers take <strong>5–7 days</strong> to complete. You&apos;ll receive an approval email from your current registrar — you must click confirm there to complete the transfer.
                            </p>
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                              <p className="text-xs text-slate-600">
                                <strong>Check your email.</strong> Vercel, our domain services partner, will send a verification email to the administrative contact for this domain. You must click the link in that email within 15 days or the transfer may be suspended.
                              </p>
                            </div>

                            {/* Submit */}
                            <button
                              onClick={handleInitiateTransfer}
                              disabled={
                                transferring ||
                                !extractRootDomain(transferDomain).includes('.') ||
                                !transferAuthCode.trim()
                              }
                              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              {transferring ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Initiating Transfer…
                                </>
                              ) : (
                                <>
                                  <ArrowRight className="w-4 h-4" />
                                  {transferPriceData?.userOwesUsd === 0
                                    ? 'Initiate Transfer — Free with Pro'
                                    : transferPriceData
                                      ? `Initiate Transfer — $${transferPriceData.userOwesUsd.toFixed(2)}`
                                      : 'Initiate Transfer'}
                                </>
                              )}
                            </button>
                          </>
                        )}
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
          </div>
        </div>

        {/* Cancel button */}
        {!embedded && (
          <button
            onClick={() => onCancel ? onCancel() : router.push('/editor')}
            className="w-full py-2 px-4 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold rounded-lg transition-colors"
          >
            Cancel
          </button>
        )}
      </div>

      {publishLimitInfo && (
        <SiteLimitModal
          plan={publishLimitInfo.plan}
          limit={publishLimitInfo.limit}
          onDismiss={() => setPublishLimitInfo(null)}
          onManageSites={() => {
            setPublishLimitInfo(null);
            router.push('/admin');
          }}
        />
      )}
    </div>
  );
}

function DomainSelectContent() {
  const searchParams = useSearchParams();
  const siteId = searchParams.get('siteId');
  const transferInitiated = searchParams.get('transferInitiated') === 'true';

  return (
    <DomainManager
      siteId={siteId}
      transferInitiated={transferInitiated}
    />
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
