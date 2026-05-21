'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import KeystoneLogoImage from '@/assets/logo/keystone-logo.png';
import { useAuth } from '@/lib/auth/context';
import SetPasswordStep from './_steps/SetPasswordStep';
import PreviewStep from './_steps/PreviewStep';
import PaymentStep from './_steps/PaymentStep';
import LaunchingStep from './_steps/LaunchingStep';
import LiveStep from './_steps/LiveStep';

export interface OnboardingState {
  id: string;
  name: string;
  email: string;
  businessName: string | null;
  launchConfig: {
    planTier?: 'basic' | 'pro';
    billingInterval?: 'monthly' | 'yearly';
    domain?: {
      mode?: 'subdomain' | 'purchase' | 'external' | 'owned';
      subdomain?: string;
      domainName?: string;
      vercelPriceUsd?: number;
      billToClient?: boolean;
      ownedPurchaseId?: string;
      externalVerified?: boolean;
    };
    launchServicePriceCents?: number;
    billDomainCents?: number;
    skipPreview?: boolean;
  } | null;
  launchServicePriceCents: number | null;
  onboardingStatus: string;
  onboardingUserId: string | null;
  launchedAt: string | null;
  site: {
    id: string;
    site_slug: string | null;
    published_domain: string | null;
    custom_domain: string | null;
  } | null;
}

type StepId = 'password' | 'preview' | 'payment' | 'launching' | 'live';

function stepFromStatus(status: string, skipPreview: boolean): StepId {
  switch (status) {
    case 'not_sent':
    case 'sent':
      return 'password';
    case 'set_password':
      return skipPreview ? 'payment' : 'preview';
    case 'previewing':
    case 'editing':
    case 'changes_requested':
      return 'preview';
    case 'awaiting_payment':
      return 'payment';
    case 'launching':
      return 'launching';
    case 'launched':
      return 'live';
    case 'failed':
      return 'launching';
    default:
      return 'password';
  }
}

export default function LaunchOnboardingPage() {
  const { token } = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const [state, setState] = useState<OnboardingState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const stepOverride = searchParams.get('step') as StepId | null;

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/onboarding/launch/${token}`, { cache: 'no-store' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load onboarding');
      }
      const data: OnboardingState = await res.json();
      setState(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white flex items-center justify-center">
        <div className="text-sm text-slate-500">Loading…</div>
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <Image src={KeystoneLogoImage} alt="Keystone" className="w-32 mx-auto mb-4" />
          <h1 className="text-lg font-semibold text-slate-900">Onboarding link not found</h1>
          <p className="mt-2 text-sm text-slate-600">
            {error ?? 'This link may have expired or been replaced. Reply to the email we sent for help.'}
          </p>
        </div>
      </div>
    );
  }

  const skipPreview = state.launchConfig?.skipPreview ?? false;
  const currentStep: StepId = stepOverride ?? stepFromStatus(state.onboardingStatus, skipPreview);

  const friendlyBusinessName = state.businessName || `${state.name}’s site`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white">
      <header className="border-b border-emerald-100 bg-white/70 backdrop-blur">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Image src={KeystoneLogoImage} alt="Keystone" className="w-32" />
          <div className="text-xs text-slate-500">
            Launching <strong className="text-slate-700">{friendlyBusinessName}</strong>
          </div>
        </div>
        <StepIndicator current={currentStep} skipPreview={skipPreview} />
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {currentStep === 'password' && (
          <SetPasswordStep state={state} token={token} onClaimed={refresh} />
        )}
        {currentStep === 'preview' && (
          <PreviewStep state={state} token={token} userIsSignedIn={!!user} onRefresh={refresh} />
        )}
        {currentStep === 'payment' && (
          <PaymentStep state={state} token={token} onRefresh={refresh} />
        )}
        {currentStep === 'launching' && (
          <LaunchingStep state={state} token={token} onLaunched={() => router.replace(`/onboarding/launch/${token}?step=live`)} />
        )}
        {currentStep === 'live' && <LiveStep state={state} />}
      </main>
    </div>
  );
}

function StepIndicator({ current, skipPreview }: { current: StepId; skipPreview: boolean }) {
  const steps: { id: StepId; label: string }[] = [
    { id: 'password', label: 'Account' },
    ...(skipPreview ? [] : ([{ id: 'preview', label: 'Preview' }] as { id: StepId; label: string }[])),
    { id: 'payment', label: 'Payment' },
    { id: 'live', label: 'Live!' },
  ];
  const currentIndex = steps.findIndex(
    (s) => s.id === current || (current === 'launching' && s.id === 'live'),
  );

  return (
    <div className="max-w-3xl mx-auto px-6 pb-4">
      <ol className="flex items-center gap-2">
        {steps.map((s, i) => {
          const isActive = i === currentIndex;
          const isDone = i < currentIndex;
          return (
            <li key={s.id} className="flex items-center gap-2 flex-1">
              <div
                className={`flex items-center gap-2 flex-1 ${
                  isActive ? 'text-emerald-700' : isDone ? 'text-emerald-500' : 'text-slate-400'
                }`}
              >
                <span
                  className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold ${
                    isActive
                      ? 'bg-emerald-600 text-white'
                      : isDone
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {isDone ? '✓' : i + 1}
                </span>
                <span className="text-xs font-medium">{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`h-px flex-1 ${i < currentIndex ? 'bg-emerald-400' : 'bg-slate-200'}`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
