'use client';

import { useState } from 'react';
import type { ModerationEvent } from './page';

const SEVERITY_STYLES: Record<string, string> = {
  csaem: 'bg-red-900/70 text-red-300 border border-red-600',
  adult: 'bg-orange-900/70 text-orange-300 border border-orange-600',
  review: 'bg-yellow-900/70 text-yellow-300 border border-yellow-700',
};

const METHOD_LABELS: Record<string, string> = {
  arachnid_hash:    'Arachnid Shield (hash)',
  vision_classifier:'Vision SafeSearch (AI)',
  text_classifier:  'Text classifier (AI)',
};

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${SEVERITY_STYLES[severity] ?? 'bg-gray-700 text-gray-300'}`}>
      {severity}
    </span>
  );
}

function EventRow({
  event,
  isAdmin,
  onAction,
}: {
  event: ModerationEvent;
  isAdmin: boolean;
  onAction: (id: string, action: 'approved' | 'removed' | 'escalated', notes?: string) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAction = async (action: 'approved' | 'removed' | 'escalated') => {
    setLoading(true);
    await onAction(event.id, action, notes);
    setLoading(false);
  };

  const isReviewed = !!event.reviewed_at;

  return (
    <tr className="border-b border-gray-700 hover:bg-gray-800/50">
      {/* Severity */}
      <td className="px-4 py-3 whitespace-nowrap">
        <SeverityBadge severity={event.severity} />
      </td>

      {/* Type / Method */}
      <td className="px-4 py-3 text-sm text-gray-300">
        <div className="font-medium">{event.content_type}</div>
        <div className="text-xs text-gray-500">{METHOD_LABELS[event.detection_method]}</div>
      </td>

      {/* Site / User */}
      <td className="px-4 py-3 text-sm">
        <div className="text-gray-300">{event.site_slug ?? event.site_id?.slice(0, 8) ?? '—'}</div>
        <div className="text-xs text-gray-500">{event.user_email ?? event.user_id?.slice(0, 8) ?? '—'}</div>
      </td>

      {/* Content ref (blurred unless revealed) */}
      <td className="px-4 py-3 text-sm max-w-xs">
        {event.content_ref ? (
          <div
            className={`text-xs font-mono break-all transition-all ${revealed ? 'text-gray-300' : 'blur-sm select-none text-gray-500 cursor-pointer'}`}
            onClick={() => setRevealed(true)}
            title={revealed ? undefined : 'Click to reveal content reference'}
          >
            {event.content_ref}
          </div>
        ) : (
          <span className="text-gray-600 text-xs">blocked before storage</span>
        )}
      </td>

      {/* Cybertip */}
      <td className="px-4 py-3 text-xs">
        {event.severity === 'csaem' ? (
          event.cybertip_report_id ? (
            <span className="text-green-400 font-mono">{event.cybertip_report_id}</span>
          ) : (
            <a
              href="https://www.cybertip.ca"
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-400 underline font-semibold"
            >
              REPORT NOW
            </a>
          )
        ) : (
          <span className="text-gray-600">n/a</span>
        )}
      </td>

      {/* Date */}
      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
        {new Date(event.created_at).toLocaleString('en-CA', { timeZone: 'America/Toronto' })}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        {isReviewed ? (
          <span className="text-xs text-gray-500">
            {event.review_action} · {new Date(event.reviewed_at!).toLocaleDateString('en-CA')}
          </span>
        ) : (
          <div className="flex flex-col gap-2 min-w-[160px]">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              rows={1}
              className="text-xs bg-gray-700 text-gray-200 rounded px-2 py-1 resize-none border border-gray-600 focus:outline-none focus:border-gray-400"
              disabled={loading}
            />
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => handleAction('approved')}
                disabled={loading}
                className="px-2 py-1 text-xs bg-green-800 text-green-200 rounded hover:bg-green-700 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => handleAction('removed')}
                disabled={loading}
                className="px-2 py-1 text-xs bg-orange-800 text-orange-200 rounded hover:bg-orange-700 disabled:opacity-50"
              >
                Remove
              </button>
              {isAdmin && (
                <button
                  onClick={() => handleAction('escalated')}
                  disabled={loading}
                  className="px-2 py-1 text-xs bg-red-800 text-red-200 rounded hover:bg-red-700 disabled:opacity-50"
                >
                  Escalate
                </button>
              )}
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}

export default function ModerationQueue({
  events: initialEvents,
  showReviewed,
  isAdmin,
}: {
  events: ModerationEvent[];
  showReviewed: boolean;
  isAdmin: boolean;
}) {
  const [events, setEvents] = useState(initialEvents);

  const handleAction = async (
    id: string,
    action: 'approved' | 'removed' | 'escalated',
    notes?: string
  ) => {
    const res = await fetch('/api/ops/moderation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, notes }),
    });

    if (res.ok) {
      setEvents((prev) =>
        prev.map((e) =>
          e.id === id
            ? { ...e, review_action: action, reviewed_at: new Date().toISOString(), notes: notes ?? null }
            : e
        )
      );
    } else {
      alert('Failed to update moderation event. Please try again.');
    }
  };

  if (events.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        {showReviewed ? 'No moderation events found.' : 'No pending events — queue is clear.'}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <a
          href={`/ops/moderation${showReviewed ? '' : '?reviewed=true'}`}
          className="text-sm text-blue-400 underline"
        >
          {showReviewed ? 'Show pending only' : 'Show reviewed events'}
        </a>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 bg-gray-800/70 text-left text-xs text-gray-400 uppercase tracking-wide">
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Type / Detection</th>
              <th className="px-4 py-3">Site / User</th>
              <th className="px-4 py-3">Content Ref</th>
              <th className="px-4 py-3">Cybertip ID</th>
              <th className="px-4 py-3">Detected</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                isAdmin={isAdmin}
                onAction={handleAction}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
