'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import type { OnboardingState } from '../page';

interface Props {
  state: OnboardingState;
  token: string;
  onClaimed: () => void;
}

export default function SetPasswordStep({ state, token, onClaimed }: Props) {
  const { signIn } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords don’t match.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/onboarding/launch/${token}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create your account');

      // Establish the browser session.
      const signInResult = await signIn(state.email, password);
      if (signInResult.error) {
        throw signInResult.error;
      }

      onClaimed();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create your account');
      setSubmitting(false);
    }
  }

  const friendlySite = state.businessName || `${state.name}’s site`;

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <div className="text-center mb-6">
          <div className="inline-block bg-emerald-100 rounded-full px-3 py-1 text-xs font-semibold text-emerald-700 mb-3">
            Step 1 of {state.launchConfig?.skipPreview ? '3' : '4'}
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            {friendlySite} is ready 🎉
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Set a password to take a look and launch your site. Everything else is already set up.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm">
            <div className="text-[11px] uppercase tracking-wider text-slate-500">Your email</div>
            <div className="text-slate-800 font-medium">{state.email}</div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Choose a password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
            />
            <p className="mt-1 text-[11px] text-slate-500">At least 8 characters.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-3 text-sm font-semibold text-white transition-colors"
          >
            {submitting ? 'Setting up your account…' : 'Continue →'}
          </button>
        </form>
      </div>

      <p className="text-center mt-4 text-[11px] text-slate-500">
        Need help? Just reply to the email we sent you.
      </p>
    </div>
  );
}
