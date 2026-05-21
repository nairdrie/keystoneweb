'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { OnboardingState } from '../page';

interface Props {
  state: OnboardingState;
  token: string;
  onLaunched: () => void;
}

const MESSAGES = [
  'Confirming your payment…',
  'Setting up your site…',
  'Pointing your domain…',
  'Going live…',
  'Almost ready!',
];

export default function LaunchingStep({ state, token, onLaunched }: Props) {
  const [messageIdx, setMessageIdx] = useState(0);
  const [status, setStatus] = useState(state.onboardingStatus);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIdx((i) => (i + 1) % MESSAGES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`/api/onboarding/launch/${token}/status`, { cache: 'no-store' });
        if (!cancelled && res.ok) {
          const data = await res.json();
          setStatus(data.onboardingStatus);
          if (data.onboardingStatus === 'launched') {
            onLaunched();
            return;
          }
          if (data.onboardingStatus === 'failed') {
            setError(
              data.message ||
                'Something went wrong launching your site. Reply to the email we sent and we’ll fix it right away.',
            );
            return;
          }
        }
      } catch {
        // transient network errors — keep polling
      }
      if (!cancelled) setTimeout(poll, 2500);
    }
    poll();
    return () => {
      cancelled = true;
    };
  }, [token, onLaunched]);

  return (
    <div className="max-w-md mx-auto text-center mt-8">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10">
        <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mx-auto" />
        <h1 className="mt-6 text-2xl font-bold text-slate-900">{MESSAGES[messageIdx]}</h1>
        <p className="mt-2 text-sm text-slate-500">
          This usually takes less than a minute. Hang tight.
        </p>
        {status === 'failed' && error && (
          <p className="mt-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
