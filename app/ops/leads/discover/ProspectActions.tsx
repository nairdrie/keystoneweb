'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ProspectActions({
  prospectId,
  dismissed,
  promoted,
  promotedLeadId,
}: {
  prospectId: string;
  dismissed: boolean;
  promoted: boolean;
  promotedLeadId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function call(action: string, extra?: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/ops/lead-prospects/${prospectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? 'Action failed');
        return null;
      }
      router.refresh();
      return await res.json();
    } finally {
      setBusy(false);
    }
  }

  if (promoted && promotedLeadId) {
    return (
      <a
        href={`/leads/${promotedLeadId}`}
        className="rounded bg-violet-600 hover:bg-violet-500 px-3 py-1.5 text-xs font-medium text-white transition-colors"
      >
        Open lead
      </a>
    );
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      {!dismissed && (
        <>
          <button
            onClick={async () => {
              if (!confirm('Promote this prospect to a lead in the pipeline?')) return;
              const r = await call('promote');
              if (r?.lead_id) router.push(`/leads/${r.lead_id}`);
            }}
            disabled={busy}
            className="rounded bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-50"
          >
            Promote
          </button>
          <button
            onClick={async () => {
              const reason = prompt('Why dismiss? (optional)') ?? undefined;
              await call('dismiss', reason ? { reason } : undefined);
            }}
            disabled={busy}
            className="rounded bg-gray-800 hover:bg-gray-700 px-3 py-1.5 text-xs text-gray-300 transition-colors disabled:opacity-50"
          >
            Dismiss
          </button>
        </>
      )}
      {dismissed && (
        <button
          onClick={() => call('undismiss')}
          disabled={busy}
          className="rounded bg-gray-800 hover:bg-gray-700 px-3 py-1.5 text-xs text-gray-300 transition-colors disabled:opacity-50"
        >
          Restore
        </button>
      )}
    </div>
  );
}
