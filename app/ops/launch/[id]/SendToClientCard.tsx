'use client';

import { useState } from 'react';

interface LaunchRequestSummary {
  id: string;
  onboarding_token: string | null;
  onboarding_status: string | null;
  changes_requested_text: string | null;
  launched_at: string | null;
  email: string;
}

interface Props {
  launchRequest: LaunchRequestSummary;
  onUpdated: (next: Partial<LaunchRequestSummary>) => void;
}

const STATUS_LABEL: Record<string, string> = {
  not_sent: 'Not sent',
  sent: 'Onboarding link sent',
  set_password: 'Client set their password',
  previewing: 'Previewing',
  editing: 'Editing in Keystone',
  changes_requested: 'Changes requested',
  awaiting_payment: 'On payment step',
  launching: 'Launching',
  launched: 'Launched',
  failed: 'Failed — needs attention',
};

const STATUS_TONE: Record<string, string> = {
  not_sent: 'text-gray-400',
  sent: 'text-sky-400',
  set_password: 'text-sky-400',
  previewing: 'text-violet-400',
  editing: 'text-violet-400',
  changes_requested: 'text-amber-400',
  awaiting_payment: 'text-emerald-400',
  launching: 'text-emerald-400',
  launched: 'text-emerald-400',
  failed: 'text-red-400',
};

export default function SendToClientCard({ launchRequest, onUpdated }: Props) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUrl, setLastUrl] = useState<string | null>(null);

  const status = launchRequest.onboarding_status ?? 'not_sent';
  const isLaunched = status === 'launched';
  const isChangesRequested = status === 'changes_requested';
  const hasToken = !!launchRequest.onboarding_token;

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const onboardingUrl = hasToken ? `${baseUrl}/onboarding/launch/${launchRequest.onboarding_token}` : null;

  async function send() {
    setError(null);
    setSending(true);
    try {
      const res = await fetch(`/api/ops/launch/${launchRequest.id}/send`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send failed');
      setLastUrl(data.onboardingUrl);
      onUpdated({
        onboarding_status: 'sent',
        onboarding_token: data.onboardingUrl.split('/').pop() ?? null,
        changes_requested_text: null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-lg border border-gray-800 bg-gray-900 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Onboarding</h2>
        <span className={`text-xs font-medium ${STATUS_TONE[status] ?? 'text-gray-400'}`}>
          {STATUS_LABEL[status] ?? status}
        </span>
      </div>

      {isChangesRequested && launchRequest.changes_requested_text && (
        <div className="rounded border border-amber-900 bg-amber-950/40 p-3 text-xs text-amber-200 whitespace-pre-wrap">
          <div className="font-semibold mb-1">Client requested changes:</div>
          {launchRequest.changes_requested_text}
        </div>
      )}

      {onboardingUrl && (
        <div>
          <p className="text-[11px] text-gray-500 mb-1">Client onboarding link</p>
          <code className="block break-all text-[11px] text-sky-300 bg-gray-950 border border-gray-800 rounded px-2 py-1.5">
            {onboardingUrl}
          </code>
        </div>
      )}

      {lastUrl && (
        <p className="text-[11px] text-emerald-400">
          ✓ Sent to <strong>{launchRequest.email}</strong>
        </p>
      )}

      {error && (
        <p className="text-[11px] text-red-300 bg-red-950 border border-red-900 rounded px-2 py-1.5">
          {error}
        </p>
      )}

      {!isLaunched && (
        <button
          onClick={send}
          disabled={sending}
          className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
        >
          {sending
            ? 'Sending…'
            : isChangesRequested
              ? 'Notify client — updates ready'
              : hasToken
                ? 'Re-send onboarding email'
                : 'Send to client'}
        </button>
      )}

      {isLaunched && launchRequest.launched_at && (
        <p className="text-[11px] text-emerald-400">
          Launched {new Date(launchRequest.launched_at).toLocaleString('en-CA')}
        </p>
      )}
    </section>
  );
}
