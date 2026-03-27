'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { Check, Loader2 } from 'lucide-react';
import SignUpModal from '@/app/components/SignUpModal';

interface TransferDetails {
  transferId: string;
  siteId: string;
  siteName: string;
  senderEmail: string;
  senderName: string | null;
  expiresAt: string;
  includeDomain: boolean;
  domainName: string | null;
  recipientEmail: string | null;
}

type TransferStep = 'loading' | 'error' | 'details' | 'auth' | 'accepting' | 'plan-selection' | 'complete';

const STRIPE_PRICES = {
  basic: {
    monthly: 'price_1TCZSU9e8C5naDN47tc8rB74',
    yearly: 'price_1TCZSm9e8C5naDN4d8Zctb6D',
  },
  pro: {
    monthly: 'price_1TCZRk9e8C5naDN44O78PCfh',
    yearly: 'price_1TCZRS9e8C5naDN4LtllOW7G',
  },
};
const MONTHLY_PRICES = { basic: 30, pro: 60 };
const YEARLY_PRICES = { basic: 15, pro: 30 };

// ─── Plan selection step ────────────────────────────────────────────────────

function PlanSelectionStep({
  transfer,
  acceptedSiteId,
}: {
  transfer: TransferDetails;
  acceptedSiteId: string;
}) {
  const [isYearly, setIsYearly] = useState(true);
  const [loading, setLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const handleChoosePlan = async (planName: 'Basic' | 'Pro', priceId: string) => {
    setLoading(true);
    setCheckoutError(null);
    try {
      const res = await fetch('/api/stripe/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ priceId, planName, siteId: acceptedSiteId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start checkout');
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  const basicUrl = transfer.includeDomain ? null : `${transfer.siteName}.kswd.ca`;
  const proUrl = transfer.includeDomain && transfer.domainName
    ? transfer.domainName
    : `${transfer.siteName}.kswd.ca`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-green-100 rounded-full mb-4">
            <Check className="w-7 h-7 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            <strong className="text-slate-900">&ldquo;{transfer.siteName}&rdquo;</strong> is yours — choose a plan to go live
          </h1>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            The site has been transferred to your account. Pick a plan to publish it.
            {transfer.includeDomain && transfer.domainName && (
              <span> The domain <strong className="font-mono">{transfer.domainName}</strong> was included — choose Pro to keep it active.</span>
            )}
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <span className={`text-sm font-semibold ${!isYearly ? 'text-slate-900' : 'text-slate-400'}`}>Monthly</span>
          <button
            onClick={() => setIsYearly(!isYearly)}
            className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none ${isYearly ? 'bg-red-600' : 'bg-slate-300'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${isYearly ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
          <span className={`text-sm font-semibold ${isYearly ? 'text-slate-900' : 'text-slate-400'}`}>Yearly</span>
          {isYearly && (
            <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">Save 50%</span>
          )}
        </div>

        {checkoutError && (
          <p className="text-sm text-red-600 text-center mb-4">{checkoutError}</p>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Basic */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-md">
            <h3 className="text-xl font-bold text-slate-900 mb-1">Basic</h3>
            <p className="text-slate-500 text-sm mb-4">Get your site live on a Keystone subdomain.</p>
            <div className="mb-5">
              <span className="text-4xl font-black text-slate-900">${isYearly ? YEARLY_PRICES.basic : MONTHLY_PRICES.basic}</span>
              <span className="text-slate-500 text-sm">/mo</span>
              {isYearly && <p className="text-xs text-slate-400 mt-0.5">billed ${YEARLY_PRICES.basic * 12}/yr</p>}
            </div>
            <div className="bg-slate-50 rounded-lg p-3 mb-4 text-sm">
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-1">Your site URL</p>
              <p className="font-mono text-slate-700 text-xs">{basicUrl ?? `${transfer.siteName}.kswd.ca`}</p>
            </div>
            {transfer.includeDomain && transfer.domainName && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-800">
                Domain <strong className="font-mono">{transfer.domainName}</strong> will be parked in your account (inactive). Upgrade to Pro to activate it.
              </div>
            )}
            <ul className="space-y-2 mb-5 text-sm text-slate-600">
              {['Unlimited site pages', 'All premium templates', 'Drag-and-drop editor', 'AI Builder (3/day)', 'Email support'].map(f => (
                <li key={f} className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-slate-400 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleChoosePlan('Basic', isYearly ? STRIPE_PRICES.basic.yearly : STRIPE_PRICES.basic.monthly)}
              disabled={loading}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Choose Basic
            </button>
          </div>

          {/* Pro */}
          <div className="bg-slate-950 rounded-2xl p-6 border border-slate-800 shadow-xl relative">
            <div className="absolute top-0 right-6 -translate-y-1/2 bg-red-600 outline outline-4 outline-slate-50 text-white px-3 py-0.5 rounded-full text-xs font-bold">
              Most Popular
            </div>
            <h3 className="text-xl font-bold text-white mb-1">Pro</h3>
            <p className="text-slate-300 text-sm mb-4">
              {transfer.includeDomain && transfer.domainName
                ? `Go live on ${transfer.domainName} — included.`
                : 'Everything you need to grow your business online.'}
            </p>
            <div className="mb-5">
              <span className="text-4xl font-black text-white">${isYearly ? YEARLY_PRICES.pro : MONTHLY_PRICES.pro}</span>
              <span className="text-slate-300 text-sm">/mo</span>
              {isYearly && <p className="text-xs text-slate-400 mt-0.5">billed ${YEARLY_PRICES.pro * 12}/yr</p>}
            </div>
            <div className="bg-slate-800 rounded-lg p-3 mb-4 text-sm">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-1">Your site URL</p>
              <p className="font-mono text-white text-xs">{proUrl}</p>
              {transfer.includeDomain && transfer.domainName && (
                <p className="text-green-400 text-[10px] mt-1">Domain active &amp; live</p>
              )}
            </div>
            <ul className="space-y-2 mb-5 text-sm text-slate-200">
              {[
                'Everything in Basic',
                'Unlimited sites',
                transfer.includeDomain && transfer.domainName ? `${transfer.domainName} — live & active` : 'Custom domain support',
                'Increased AI Builder limits',
                '24/7 priority support',
                'Advanced analytics',
                'Custom CSS injection',
              ].map(f => (
                <li key={f} className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-red-400 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleChoosePlan('Pro', isYearly ? STRIPE_PRICES.pro.yearly : STRIPE_PRICES.pro.monthly)}
              disabled={loading}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Get Pro
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          You can upgrade or downgrade anytime from your account settings.
        </p>
      </div>
    </div>
  );
}

// ─── Main transfer content ───────────────────────────────────────────────────

function TransferContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const token = searchParams.get('token');

  const [step, setStep] = useState<TransferStep>('loading');
  const [transfer, setTransfer] = useState<TransferDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSignUp, setShowSignUp] = useState(false);
  const [acceptedSiteId, setAcceptedSiteId] = useState<string | null>(null);
  const [pendingAccept, setPendingAccept] = useState(false);

  // Fetch transfer details on mount
  useEffect(() => {
    if (!token) {
      setError('No transfer token provided.');
      setStep('error');
      return;
    }

    const fetchTransfer = async () => {
      try {
        const res = await fetch(`/api/sites/transfer?token=${token}`);
        if (res.ok) {
          const data = await res.json();
          setTransfer(data);
          setStep('details');
        } else {
          const data = await res.json();
          setError(data.error || 'This transfer link is invalid or has expired.');
          setStep('error');
        }
      } catch {
        setError('Failed to load transfer details.');
        setStep('error');
      }
    };

    fetchTransfer();
  }, [token]);

  // When user becomes authenticated after sign-up and we were waiting to accept
  useEffect(() => {
    if (user && pendingAccept && token) {
      setPendingAccept(false);
      doAccept();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pendingAccept]);

  const doAccept = async () => {
    if (!token) return;
    setStep('accepting');
    try {
      const res = await fetch('/api/sites/transfer/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        const data = await res.json();
        setAcceptedSiteId(data.siteId);
        if (data.isPaid) {
          setStep('complete');
          setTimeout(() => router.push(`/editor?siteId=${data.siteId}`), 1500);
        } else {
          setStep('plan-selection');
        }
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to accept transfer.');
        setStep('error');
      }
    } catch {
      setError('An unexpected error occurred.');
      setStep('error');
    }
  };

  const handleAccept = () => {
    if (!user) {
      setPendingAccept(true);
      setShowSignUp(true);
      setStep('auth');
      return;
    }
    doAccept();
  };

  const handleAuthSuccess = () => {
    setShowSignUp(false);
    // doAccept fires via the pendingAccept + user effect above
  };

  // ── Render states ──────────────────────────────────────────────────────────

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Loading transfer details...</p>
        </div>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Transfer Unavailable</h1>
          <p className="text-slate-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition-colors"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  if (step === 'accepting') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Accepting transfer...</p>
        </div>
      </div>
    );
  }

  if (step === 'complete') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Transfer Complete!</h1>
          <p className="text-slate-600 mb-2">
            <strong>{transfer?.siteName}</strong> is now yours.
          </p>
          <p className="text-sm text-slate-500">Redirecting to the editor...</p>
        </div>
      </div>
    );
  }

  if (step === 'plan-selection' && transfer && acceptedSiteId) {
    return <PlanSelectionStep transfer={transfer} acceptedSiteId={acceptedSiteId} />;
  }

  // ── details / auth step ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      {(step === 'details' || step === 'auth') && transfer && (
        <>
          {/* Accept/decline card — always shown on details/auth step */}
          {!showSignUp && (
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Site Transfer</h1>
              <p className="text-slate-600 mb-6">
                <strong>{transfer.senderName || transfer.senderEmail}</strong> wants to transfer the site{' '}
                <strong>&ldquo;{transfer.siteName}&rdquo;</strong> to{' '}
                <strong>{user?.email ?? transfer.recipientEmail ?? 'you'}</strong>.
              </p>

              <div className="bg-slate-50 rounded-lg p-4 mb-6 text-left">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-500">Site</span>
                  <span className="font-semibold text-slate-900">{transfer.siteName}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-500">From</span>
                  <span className="font-semibold text-slate-900">{transfer.senderEmail}</span>
                </div>
                {user && (
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-500">To</span>
                    <span className="font-semibold text-slate-900">{user.email}</span>
                  </div>
                )}
                {transfer.includeDomain && transfer.domainName && (
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-500">Domain</span>
                    <span className="font-semibold text-slate-900 font-mono">{transfer.domainName}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Expires</span>
                  <span className="font-semibold text-slate-900">{new Date(transfer.expiresAt).toLocaleDateString()}</span>
                </div>
              </div>

              {transfer.includeDomain && transfer.domainName && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-left">
                  <p className="text-xs text-blue-800">
                    <strong>Domain included:</strong> <span className="font-mono">{transfer.domainName}</span> will transfer to your account.
                    Activate it by choosing Pro during setup.
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => router.push('/')}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold rounded-lg transition-colors"
                >
                  Decline
                </button>
                <button
                  onClick={handleAccept}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors"
                >
                  Accept Transfer
                </button>
              </div>
            </div>
          )}

          {/* Auth modal when user is not signed in */}
          {showSignUp && !user && (
            <SignUpModal
              isOpen={true}
              onClose={() => { setShowSignUp(false); setStep('details'); setPendingAccept(false); }}
              siteId={transfer.siteId}
              onSuccess={handleAuthSuccess}
            />
          )}

          {/* Spinner while waiting for auth state to propagate */}
          {showSignUp && user && (
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-slate-600 font-medium">Signing you in...</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function TransferPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <TransferContent />
    </Suspense>
  );
}
