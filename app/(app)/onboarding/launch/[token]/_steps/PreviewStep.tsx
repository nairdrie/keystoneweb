'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { OnboardingState } from '../page';

interface Props {
  state: OnboardingState;
  token: string;
  userIsSignedIn: boolean;
  onRefresh: () => void;
}

export default function PreviewStep({ state, token, userIsSignedIn, onRefresh }: Props) {
  const router = useRouter();
  const [advancing, setAdvancing] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [changesText, setChangesText] = useState('');
  const [submittingChanges, setSubmittingChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changesSubmitted, setChangesSubmitted] = useState(false);

  const siteId = state.site?.id;
  const previewSrc = siteId ? `/preview?siteId=${siteId}&launchToken=${token}` : null;

  async function advance() {
    if (!userIsSignedIn) {
      router.push('/signin?onboardingToken=' + token);
      return;
    }
    setError(null);
    setAdvancing(true);
    try {
      const res = await fetch(`/api/onboarding/launch/${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'advance-to-payment' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not advance');
      }
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not advance');
    } finally {
      setAdvancing(false);
    }
  }

  async function submitChanges() {
    if (!changesText.trim()) {
      setError('Tell us what you’d like changed.');
      return;
    }
    setError(null);
    setSubmittingChanges(true);
    try {
      const res = await fetch(`/api/onboarding/launch/${token}/request-changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: changesText.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not submit');
      }
      setChangesSubmitted(true);
      setChangesOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit');
    } finally {
      setSubmittingChanges(false);
    }
  }

  if (changesSubmitted) {
    return (
      <div className="max-w-lg mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
        <div className="text-4xl mb-3">📨</div>
        <h1 className="text-xl font-bold text-slate-900">Got it — we’ll get to work.</h1>
        <p className="mt-2 text-sm text-slate-600">
          We’ll email you as soon as your updates are ready. You can close this tab.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="inline-block bg-emerald-100 rounded-full px-3 py-1 text-xs font-semibold text-emerald-700 mb-2">
          Take a look
        </div>
        <h1 className="text-2xl font-bold text-slate-900">This is your new site</h1>
        <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
          Click around to explore. When you’re ready, continue to launch — or let us know if anything needs to change.
        </p>
      </div>

      {previewSrc ? (
        <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-lg bg-white">
          <iframe
            src={previewSrc}
            className="w-full"
            style={{ height: '70vh' }}
            title="Site preview"
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          Preview is not available yet — please contact us.
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <button
          onClick={advance}
          disabled={advancing}
          className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-3.5 text-base font-semibold text-white transition-colors"
        >
          {advancing ? 'One moment…' : 'Looks good — continue to launch →'}
        </button>

        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setChangesOpen((v) => !v)}
            className="text-sm font-medium text-slate-600 hover:text-slate-900 underline underline-offset-2"
          >
            Request changes
          </button>
          {siteId && userIsSignedIn && (
            <a
              href={`/editor?siteId=${siteId}&launchToken=${token}`}
              className="text-xs text-slate-500 hover:text-slate-700 underline underline-offset-2"
            >
              Edit it myself →
            </a>
          )}
        </div>

        {changesOpen && (
          <div className="rounded-xl bg-white border border-slate-200 p-4 space-y-3">
            <label className="block text-xs font-semibold text-slate-700">
              What would you like changed?
            </label>
            <textarea
              value={changesText}
              onChange={(e) => setChangesText(e.target.value)}
              rows={5}
              placeholder="E.g. change the headline on the home page to 'Family-owned since 1992'…"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setChangesOpen(false);
                  setChangesText('');
                }}
                disabled={submittingChanges}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={submitChanges}
                disabled={submittingChanges || !changesText.trim()}
                className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-3 py-2 text-sm font-semibold text-white"
              >
                {submittingChanges ? 'Sending…' : 'Send changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
