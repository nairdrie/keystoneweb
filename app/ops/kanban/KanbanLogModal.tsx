'use client';

import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { OpsTicketLogEntry } from '@/lib/ops/kanban';
import { formatOpsTicketLogMessage } from '@/lib/ops/kanban-log';
import LocalTimestamp from './LocalTimestamp';

function formatFieldLabel(fieldName: OpsTicketLogEntry['field_name']) {
  if (!fieldName) return null;
  if (fieldName === 'title') return 'Title';
  if (fieldName === 'description') return 'Description';
  if (fieldName === 'status') return 'Status';
  if (fieldName === 'priority') return 'Priority';
  if (fieldName === 'assignee') return 'Assignee';
  return fieldName;
}

function formatValue(value: string | null, label: string | null) {
  const displayValue = label ?? value;
  if (!displayValue) return 'Empty';
  return displayValue.length > 180 ? `${displayValue.slice(0, 177)}...` : displayValue;
}

export default function KanbanLogModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [logs, setLogs] = useState<OpsTicketLogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch('/api/ops/kanban/logs?limit=200', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load log');
        const json = await res.json();
        if (!cancelled) setLogs(json.logs ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? 'Failed to load log');
      });
    return () => {
      cancelled = true;
      setLogs(null);
      setError(null);
    };
  }, [open]);

  const loading = open && logs === null && error === null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-5xl rounded-2xl border border-white/10 bg-gray-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-white">Kanban Log</h2>
            <p className="text-xs text-gray-500">Most recent kanban changes first.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading log...
            </div>
          )}
          {error && !loading && (
            <div className="px-5 py-12 text-center text-sm text-red-400">{error}</div>
          )}
          {logs && !loading && !error && logs.length === 0 && (
            <div className="px-5 py-12 text-center text-sm text-gray-500">No kanban history yet.</div>
          )}
          {logs && !loading && !error && logs.length > 0 && (
            <div className="divide-y divide-gray-800">
              <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,2.4fr)_180px] gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 lg:grid">
                <div>Actor</div>
                <div>Ticket</div>
                <div>Change</div>
                <div>When</div>
              </div>
              {logs.map((entry) => {
                const fieldLabel = formatFieldLabel(entry.field_name);
                return (
                  <div
                    key={entry.id}
                    className="grid grid-cols-1 gap-4 px-5 py-4 text-sm text-gray-200 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,2.4fr)_180px]"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-white">{entry.actor_email ?? 'Unknown user'}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.14em] text-gray-500">{entry.action}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-white">{entry.ticket_name}</div>
                      {entry.ticket_id ? (
                        <div className="mt-1 text-xs font-mono text-gray-500">{entry.ticket_id}</div>
                      ) : (
                        <div className="mt-1 text-xs text-gray-500">Deleted ticket snapshot</div>
                      )}
                    </div>
                    <div className="min-w-0 space-y-2">
                      <div className="text-gray-200">{formatOpsTicketLogMessage(entry)}</div>
                      {fieldLabel ? (
                        <div className="space-y-1 rounded-xl border border-gray-800 bg-gray-900/70 p-3">
                          <div className="text-xs uppercase tracking-[0.14em] text-gray-500">{fieldLabel}</div>
                          <div className="text-xs text-gray-400">
                            <span className="text-gray-500">From:</span>{' '}
                            <span className="break-words">{formatValue(entry.old_value, entry.old_label)}</span>
                          </div>
                          <div className="text-xs text-gray-300">
                            <span className="text-gray-500">To:</span>{' '}
                            <span className="break-words">{formatValue(entry.new_value, entry.new_label)}</span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div className="text-xs text-gray-500">
                      <LocalTimestamp value={entry.created_at} className="whitespace-nowrap" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
