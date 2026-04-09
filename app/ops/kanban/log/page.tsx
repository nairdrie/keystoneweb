import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getOpsAccessContext } from '@/lib/ops/access';
import { formatOpsTicketLogMessage } from '@/lib/ops/kanban-log';
import type { OpsTicketLogEntry } from '@/lib/ops/kanban';
import LocalTimestamp from '../LocalTimestamp';

export const metadata = { title: 'Keystone Ops Kanban Log' };

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

export default async function OpsKanbanLogPage() {
  const access = await getOpsAccessContext();
  if (!access || (!access.isAdmin && !access.isAgent)) {
    redirect('https://keystoneweb.ca');
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('ops_ticket_logs')
    .select('id, ticket_id, ticket_name, actor_user_id, actor_email, action, field_name, old_value, new_value, old_label, new_label, created_at')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(200);

  if (error) {
    console.error('[ops/kanban/log page]', error);
  }

  const logs = ((data ?? []) as OpsTicketLogEntry[]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Kanban Log</h1>
          <p className="mt-1 text-sm text-gray-400">
            Most recent kanban changes first. Tracking create, delete, and updates to title,
            description, status, priority, and assignee.
          </p>
        </div>

        <Link
          href="/kanban"
          className="inline-flex items-center justify-center rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-gray-500 hover:text-white"
        >
          Back to Kanban
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-950/70">
        <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,2.4fr)_220px] gap-4 border-b border-gray-800 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
          <div>Actor</div>
          <div>Ticket</div>
          <div>Change</div>
          <div>When</div>
        </div>

        <div className="divide-y divide-gray-800">
          {logs.map((entry) => {
            const fieldLabel = formatFieldLabel(entry.field_name);
            return (
              <div
                key={entry.id}
                className="grid grid-cols-1 gap-4 px-5 py-4 text-sm text-gray-200 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,2.4fr)_220px]"
              >
                <div className="min-w-0">
                  <div className="font-medium text-white">
                    {entry.actor_email ?? 'Unknown user'}
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-[0.14em] text-gray-500">
                    {entry.action}
                  </div>
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
                      <div className="text-xs uppercase tracking-[0.14em] text-gray-500">
                        {fieldLabel}
                      </div>
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

          {logs.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-gray-500">
              No kanban history yet.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
