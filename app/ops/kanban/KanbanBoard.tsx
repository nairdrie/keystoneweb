'use client';

import { startTransition, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDownUp, Filter, Flag, GripVertical, Plus, Sparkles, Upload, UserRound, X } from 'lucide-react';
import {
  getOpsTicketPriorityMeta,
  getOpsTicketStatusMeta,
  OPS_TICKET_PRIORITIES,
  OPS_TICKET_STATUSES,
  sortOpsTickets,
  type OpsAssigneeOption,
  type OpsTicket,
  type OpsTicketPriority,
  type OpsTicketStatus,
} from '@/lib/ops/kanban';

type TicketDraft = {
  name: string;
  description: string;
  status: OpsTicketStatus;
  priority: OpsTicketPriority;
  assignee_user_id: string;
};

const DEFAULT_DRAFT: TicketDraft = {
  name: '',
  description: '',
  status: 'backlog',
  priority: 'medium',
  assignee_user_id: '',
};

const PRIORITY_RANK: Record<OpsTicketPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

type SortMode = 'priority' | 'manual' | 'assignee';

type CsvImportRow = {
  issue: string;
  assignedTo: string;
  createdTime: string;
  dueDate: string;
  priority: string;
  status: string;
  type: string;
};

type StatusCounts = Record<OpsTicketStatus, number>;

const STATUS_PAGE_SIZE = 20;

function getManualStatusTickets(tickets: OpsTicket[], status: OpsTicketStatus) {
  return tickets
    .filter((ticket) => ticket.status === status)
    .sort((left, right) => {
      if (left.sort_order !== right.sort_order) return left.sort_order - right.sort_order;
      return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
    });
}

function getDisplayStatusTickets(
  tickets: OpsTicket[],
  status: OpsTicketStatus,
  sortMode: SortMode,
  assigneeMap: Map<string, OpsAssigneeOption>
) {
  const baseTickets = getManualStatusTickets(tickets, status);

  if (sortMode === 'manual') {
    return baseTickets;
  }

  if (sortMode === 'priority') {
    return [...baseTickets].sort((left, right) => {
      const priorityDelta = PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority];
      if (priorityDelta !== 0) return priorityDelta;
      return left.sort_order - right.sort_order;
    });
  }

  return [...baseTickets].sort((left, right) => {
    const leftAssignee = left.assignee_user_id ? assigneeMap.get(left.assignee_user_id) : undefined;
    const rightAssignee = right.assignee_user_id ? assigneeMap.get(right.assignee_user_id) : undefined;
    const leftLabel = formatAssigneeLabel(leftAssignee).toLowerCase();
    const rightLabel = formatAssigneeLabel(rightAssignee).toLowerCase();
    const assigneeDelta = leftLabel.localeCompare(rightLabel);
    if (assigneeDelta !== 0) return assigneeDelta;
    const priorityDelta = PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority];
    if (priorityDelta !== 0) return priorityDelta;
    return left.sort_order - right.sort_order;
  });
}

function getSortGroupKey(
  ticket: OpsTicket,
  sortMode: SortMode,
  assigneeMap: Map<string, OpsAssigneeOption>
) {
  if (sortMode === 'priority') return `priority:${ticket.priority}`;
  if (sortMode === 'assignee') {
    const assignee = ticket.assignee_user_id ? assigneeMap.get(ticket.assignee_user_id) : undefined;
    return `assignee:${formatAssigneeLabel(assignee).toLowerCase()}`;
  }
  return 'manual:all';
}

function relativeUpdatedAt(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatUtcTimestamp(value: string) {
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  const hours = `${date.getUTCHours()}`.padStart(2, '0');
  const minutes = `${date.getUTCMinutes()}`.padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes} UTC`;
}

function subscribeToMinuteTicker(onStoreChange: () => void) {
  const intervalId = window.setInterval(onStoreChange, 60_000);
  return () => window.clearInterval(intervalId);
}

function getMinuteTickerSnapshot() {
  return Date.now();
}

function getMinuteTickerServerSnapshot() {
  return 0;
}

function RelativeUpdatedAt({ value }: { value: string }) {
  const currentTime = useSyncExternalStore(
    subscribeToMinuteTicker,
    getMinuteTickerSnapshot,
    getMinuteTickerServerSnapshot
  );
  const label = currentTime > 0 ? relativeUpdatedAt(value) : 'Updated recently';

  return (
    <span className="shrink-0" title={formatUtcTimestamp(value)}>
      {label}
    </span>
  );
}

function formatAssigneeLabel(assignee: OpsAssigneeOption | undefined) {
  if (!assignee) return 'Unassigned';
  return assignee.name?.trim() || assignee.email;
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === ',' && !insideQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCsvRows(text: string) {
  const rows: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      current += char;
      if (nextChar === '"') {
        current += nextChar;
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (current.trim()) rows.push(current);
      current = '';
      if (char === '\r' && nextChar === '\n') index += 1;
      continue;
    }

    current += char;
  }

  if (current.trim()) rows.push(current);
  return rows;
}

function normalizeImportedStatus(value: string): OpsTicketStatus {
  const normalized = value.trim().toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_+|_+$/g, '');

  if (normalized === 'to_do' || normalized === 'todo') return 'todo';
  if (normalized === 'in_progress' || normalized === 'inprogress') return 'in_progress';
  if (normalized === 'in_review' || normalized === 'review') return 'review';
  if (normalized === 'resolved' || normalized === 'done') return 'resolved';
  if (normalized === 'testing' || normalized === 'qa') return 'testing';
  if (normalized === 'blocked') return 'blocked';
  if (normalized === 'backlog') return 'backlog';
  return 'backlog';
}

function normalizeImportedPriority(value: string): OpsTicketPriority {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'urgent' || normalized === 'critical') return 'urgent';
  if (normalized === 'high') return 'high';
  if (normalized === 'low') return 'low';
  return 'medium';
}

function findImportedAssignee(value: string, assignees: OpsAssigneeOption[]) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return '';

  const directMatch = assignees.find((assignee) =>
    assignee.email.toLowerCase() === normalized ||
    assignee.name?.trim().toLowerCase() === normalized
  );

  if (directMatch) return directMatch.id;

  const partialMatch = assignees.find((assignee) =>
    assignee.email.toLowerCase().includes(normalized) ||
    normalized.includes(assignee.email.toLowerCase()) ||
    (assignee.name?.trim().toLowerCase().includes(normalized) ?? false) ||
    normalized.includes(assignee.name?.trim().toLowerCase() ?? '')
  );

  return partialMatch?.id ?? '';
}

function buildImportedDescription(row: CsvImportRow) {
  const details = [
    row.createdTime ? `Imported created time: ${row.createdTime}` : '',
    row.dueDate ? `Imported due date: ${row.dueDate}` : '',
    row.type ? `Imported type: ${row.type}` : '',
  ].filter(Boolean);

  return details.join('\n');
}

function buildDraft(ticket?: OpsTicket): TicketDraft {
  if (!ticket) return DEFAULT_DRAFT;
  return {
    name: ticket.name,
    description: ticket.description ?? '',
    status: ticket.status,
    priority: ticket.priority,
    assignee_user_id: ticket.assignee_user_id ?? '',
  };
}

function DroppableColumn({
  status,
  children,
}: {
  status: OpsTicketStatus;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `column:${status}`,
  });
  const statusMeta = getOpsTicketStatusMeta(status);

  return (
    <section
      ref={setNodeRef}
      className={`flex min-h-[calc(100vh-21rem)] min-w-[19rem] flex-1 shrink-0 flex-col rounded-2xl border p-3 transition-colors ${statusMeta.columnClassName} ${
        isOver ? 'ring-2 ring-white/15' : ''
      }`}
    >
      {children}
    </section>
  );
}

function ColumnLoadMoreTrigger({
  status,
  disabled,
  hasMore,
  isLoading,
  onLoadMore,
}: {
  status: OpsTicketStatus;
  disabled: boolean;
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
}) {
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const { setNodeRef } = useDroppable({
    id: `load-more:${status}`,
  });

  function setRefs(node: HTMLDivElement | null) {
    triggerRef.current = node;
    setNodeRef(node);
  }

  useEffect(() => {
    if (!hasMore || disabled || isLoading || !triggerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMore();
        }
      },
      { rootMargin: '200px 0px' }
    );

    observer.observe(triggerRef.current);
    return () => observer.disconnect();
  }, [disabled, hasMore, isLoading, onLoadMore]);

  if (!hasMore) return null;

  return (
    <div ref={setRefs} className="pt-2">
      <button
        type="button"
        disabled={disabled || isLoading}
        onClick={onLoadMore}
        className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-gray-400 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? 'Loading more...' : 'Load more'}
      </button>
    </div>
  );
}

function TicketCard({
  ticket,
  assignee,
  onOpen,
}: {
  ticket: OpsTicket;
  assignee?: OpsAssigneeOption;
  onOpen: (ticket: OpsTicket) => void;
}) {
  const statusMeta = getOpsTicketStatusMeta(ticket.status);
  const priorityMeta = getOpsTicketPriorityMeta(ticket.priority);
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: `ticket:${ticket.id}`,
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `ticket-drop:${ticket.id}`,
  });

  function setNodeRef(node: HTMLElement | null) {
    setDragRef(node);
    setDropRef(node);
  }

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.45 : 1,
      }}
      className={`group cursor-pointer rounded-2xl border border-white/6 bg-black/20 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.18)] transition hover:border-white/12 hover:bg-black/30 ${
        isDragging ? 'shadow-2xl' : ''
      } ${
        isOver ? 'ring-2 ring-white/15' : ''
      }`}
      onClick={() => onOpen(ticket)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${statusMeta.chipClassName}`}>
              <span className={`h-2 w-2 rounded-full ${statusMeta.accentClassName}`} />
              {statusMeta.label}
            </span>
            <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${priorityMeta.badgeClassName}`}>
              {priorityMeta.label}
            </span>
          </div>
          <div>
            <h3 className="text-sm font-semibold leading-6 text-white">{ticket.name}</h3>
            {ticket.description && (
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-400">{ticket.description}</p>
            )}
          </div>
        </div>

        <button
          type="button"
          aria-label={`Drag ${ticket.name}`}
          className="rounded-md p-1.5 text-gray-500 transition hover:bg-white/5 hover:text-gray-200"
          onClick={(event) => event.stopPropagation()}
          {...listeners}
          {...attributes}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-gray-500">
        <div className="inline-flex min-w-0 items-center gap-2 rounded-full border border-white/8 bg-white/5 px-2.5 py-1 text-gray-300">
          <UserRound className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{formatAssigneeLabel(assignee)}</span>
        </div>
        <RelativeUpdatedAt value={ticket.updated_at} />
      </div>
    </article>
  );
}

function TicketPreviewCard({
  ticket,
  assignee,
}: {
  ticket: OpsTicket;
  assignee?: OpsAssigneeOption;
}) {
  const statusMeta = getOpsTicketStatusMeta(ticket.status);
  const priorityMeta = getOpsTicketPriorityMeta(ticket.priority);

  return (
    <article className="rounded-2xl border border-white/10 bg-black/35 p-4 shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${statusMeta.chipClassName}`}>
              <span className={`h-2 w-2 rounded-full ${statusMeta.accentClassName}`} />
              {statusMeta.label}
            </span>
            <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${priorityMeta.badgeClassName}`}>
              {priorityMeta.label}
            </span>
          </div>
          <div>
            <h3 className="text-sm font-semibold leading-6 text-white">{ticket.name}</h3>
            {ticket.description && (
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-400">{ticket.description}</p>
            )}
          </div>
        </div>
        <span className="h-7 w-7 shrink-0" aria-hidden />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-gray-500">
        <div className="inline-flex min-w-0 items-center gap-2 rounded-full border border-white/8 bg-white/5 px-2.5 py-1 text-gray-300">
          <UserRound className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{formatAssigneeLabel(assignee)}</span>
        </div>
        <RelativeUpdatedAt value={ticket.updated_at} />
      </div>
    </article>
  );
}

function DarkSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={onChange}
      style={{ colorScheme: 'dark' }}
      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-emerald-400/60 focus:outline-none"
    >
      {children}
    </select>
  );
}

function TicketModal({
  canDelete,
  isOpen,
  isSaving,
  error,
  draft,
  editingTicket,
  assignees,
  onClose,
  onDelete,
  onSubmit,
  onDraftChange,
}: {
  canDelete: boolean;
  isOpen: boolean;
  isSaving: boolean;
  error: string;
  draft: TicketDraft;
  editingTicket: OpsTicket | null;
  assignees: OpsAssigneeOption[];
  onClose: () => void;
  onDelete: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onDraftChange: (draft: TicketDraft) => void;
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-10 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-3xl border border-white/10 bg-gray-950 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-gray-500">
              {editingTicket ? 'Ticket Details' : 'New Ticket'}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              {editingTicket ? 'Edit issue' : 'Create issue'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 p-2 text-gray-400 transition hover:border-white/20 hover:text-white"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="mt-6 space-y-5" onSubmit={onSubmit}>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Name</label>
            <input
              type="text"
              value={draft.name}
              onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
              placeholder="Fix checkout tax rounding"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-emerald-400/60 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Description</label>
            <textarea
              value={draft.description}
              onChange={(event) => onDraftChange({ ...draft, description: event.target.value })}
              rows={6}
              placeholder="Add context, acceptance criteria, links, or reproduction steps."
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-emerald-400/60 focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">Status</label>
              <DarkSelect
                value={draft.status}
                onChange={(event) => onDraftChange({ ...draft, status: event.target.value as OpsTicketStatus })}
              >
                {OPS_TICKET_STATUSES.map((status) => (
                  <option key={status.value} value={status.value} className="bg-gray-950 text-white">
                    {status.label}
                  </option>
                ))}
              </DarkSelect>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">Priority</label>
              <DarkSelect
                value={draft.priority}
                onChange={(event) => onDraftChange({ ...draft, priority: event.target.value as OpsTicketPriority })}
              >
                {OPS_TICKET_PRIORITIES.map((priority) => (
                  <option key={priority.value} value={priority.value} className="bg-gray-950 text-white">
                    {priority.label}
                  </option>
                ))}
              </DarkSelect>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">Assignee</label>
              <DarkSelect
                value={draft.assignee_user_id}
                onChange={(event) => onDraftChange({ ...draft, assignee_user_id: event.target.value })}
              >
                <option value="" className="bg-gray-950 text-white">Unassigned</option>
                {assignees.map((assignee) => (
                  <option key={assignee.id} value={assignee.id} className="bg-gray-950 text-white">
                    {formatAssigneeLabel(assignee)}
                    {assignee.kind === 'admin' ? ' (Admin)' : assignee.kind === 'admin_agent' ? ' (Admin + Agent)' : ' (Agent)'}
                  </option>
                ))}
              </DarkSelect>
            </div>
          </div>

          {editingTicket && (
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-xs text-gray-500">
              Created {formatUtcTimestamp(editingTicket.created_at)}
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              {editingTicket && canDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-rose-200 transition hover:bg-rose-500/20"
                >
                  Delete ticket
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-white/10 px-4 py-2.5 text-sm font-medium text-gray-300 transition hover:border-white/20 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-2xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-gray-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? 'Saving...' : editingTicket ? 'Save changes' : 'Create ticket'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

async function persistTicketOrder(tickets: OpsTicket[], updates: OpsTicket[]) {
  await Promise.all(
    updates.map((ticket) =>
      fetch(`/api/ops/kanban/${ticket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: ticket.status,
          sort_order: ticket.sort_order,
        }),
      })
    )
  );
}

export default function KanbanBoard({
  initialTickets,
  statusCounts,
  assignees,
  currentUserId,
  canDelete,
}: {
  initialTickets: OpsTicket[];
  statusCounts: StatusCounts;
  assignees: OpsAssigneeOption[];
  currentUserId: string;
  canDelete: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 10 } })
  );

  const [tickets, setTickets] = useState(() => sortOpsTickets(initialTickets));
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TicketDraft>(DEFAULT_DRAFT);
  const [boardView, setBoardView] = useState<'all' | 'mine'>('all');
  const [sortMode, setSortMode] = useState<SortMode>('priority');
  const [priorityFilter, setPriorityFilter] = useState<OpsTicketPriority[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [countsByStatus, setCountsByStatus] = useState<StatusCounts>(statusCounts);
  const [loadedByStatus, setLoadedByStatus] = useState<StatusCounts>(() =>
    Object.fromEntries(
      OPS_TICKET_STATUSES.map((status) => [
        status.value,
        initialTickets.filter((ticket) => ticket.status === status.value).length,
      ])
    ) as StatusCounts
  );
  const [loadingByStatus, setLoadingByStatus] = useState<Partial<Record<OpsTicketStatus, boolean>>>({});
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const dragLoadStatusRef = useRef<OpsTicketStatus | null>(null);

  const prevSortModeRef = useRef(sortMode);
  useEffect(() => {
    if (prevSortModeRef.current === sortMode) return;
    prevSortModeRef.current = sortMode;
    setLoadedByStatus(
      Object.fromEntries(OPS_TICKET_STATUSES.map((s) => [s.value, 0])) as StatusCounts
    );
    setTickets([]);
  }, [sortMode]);

  const assigneeMap = new Map(assignees.map((assignee) => [assignee.id, assignee]));
  const editingTicket = editingTicketId
    ? tickets.find((ticket) => ticket.id === editingTicketId) ?? null
    : null;
  const activeTicket = activeTicketId
    ? tickets.find((ticket) => ticket.id === activeTicketId) ?? null
    : null;

  const visibleTickets = tickets.filter((ticket) => {
    if (boardView === 'mine' && ticket.assignee_user_id !== currentUserId) {
      return false;
    }

    if (priorityFilter.length > 0 && !priorityFilter.includes(ticket.priority)) {
      return false;
    }

    if (assigneeFilter === 'unassigned' && ticket.assignee_user_id) {
      return false;
    }

    if (
      assigneeFilter !== 'all' &&
      assigneeFilter !== 'unassigned' &&
      ticket.assignee_user_id !== assigneeFilter
    ) {
      return false;
    }

    return true;
  });

  const hasActiveFilters = priorityFilter.length > 0 || assigneeFilter !== 'all';

  function refreshServerState() {
    startTransition(() => router.refresh());
  }

  async function loadMoreStatus(status: OpsTicketStatus) {
    if (loadingByStatus[status]) return;
    if ((loadedByStatus[status] ?? 0) >= (countsByStatus[status] ?? 0)) return;

    setLoadingByStatus((current) => ({ ...current, [status]: true }));

    try {
      const sort = sortMode === 'priority' ? 'priority' : 'manual';
      const response = await fetch(
        `/api/ops/kanban?status=${status}&offset=${loadedByStatus[status] ?? 0}&limit=${STATUS_PAGE_SIZE}&sort=${sort}`
      );
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || `Failed to load more ${status} tickets.`);
      }

      const nextTickets = (json.tickets ?? []) as OpsTicket[];
      setTickets((currentTickets) => {
        const ticketMap = new Map(currentTickets.map((ticket) => [ticket.id, ticket]));
        for (const ticket of nextTickets) {
          ticketMap.set(ticket.id, ticket);
        }
        return sortOpsTickets([...ticketMap.values()]);
      });
      setLoadedByStatus((current) => ({
        ...current,
        [status]: (current[status] ?? 0) + nextTickets.length,
      }));
      setCountsByStatus((current) => ({
        ...current,
        [status]: json.total ?? current[status],
      }));
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load more tickets.';
      setError(message);
    } finally {
      setLoadingByStatus((current) => ({ ...current, [status]: false }));
    }
  }

  function openNewTicket(status: OpsTicketStatus = 'backlog') {
    setEditingTicketId(null);
    setDraft({ ...DEFAULT_DRAFT, status });
    setError('');
    setImportMessage('');
    setEditorOpen(true);
  }

  function openExistingTicket(ticket: OpsTicket) {
    setEditingTicketId(ticket.id);
    setDraft(buildDraft(ticket));
    setError('');
    setImportMessage('');
    setEditorOpen(true);
  }

  function closeEditor(force = false) {
    if (isSaving && !force) return;
    setEditorOpen(false);
    setEditingTicketId(null);
    setDraft(DEFAULT_DRAFT);
    setError('');
  }

  async function importCsvFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportMessage('');
    setError('');

    try {
      const text = await file.text();
      const rows = parseCsvRows(text);
      if (rows.length < 2) {
        setError('CSV must include a header row and at least one ticket row.');
        return;
      }

      const header = parseCsvLine(rows[0]).map((column) => column.trim().toLowerCase());
      const indexMap = {
        issue: header.indexOf('issue'),
        assignedTo: header.indexOf('assigned to'),
        createdTime: header.indexOf('created time'),
        dueDate: header.indexOf('due date'),
        priority: header.indexOf('priority'),
        status: header.indexOf('status'),
        type: header.indexOf('type'),
      };

      if (indexMap.issue === -1) {
        setError('CSV must include an "Issue" column.');
        return;
      }

      const parsedRows: CsvImportRow[] = rows
        .slice(1)
        .map((row) => parseCsvLine(row))
        .map((columns) => ({
          issue: columns[indexMap.issue] ?? '',
          assignedTo: indexMap.assignedTo >= 0 ? columns[indexMap.assignedTo] ?? '' : '',
          createdTime: indexMap.createdTime >= 0 ? columns[indexMap.createdTime] ?? '' : '',
          dueDate: indexMap.dueDate >= 0 ? columns[indexMap.dueDate] ?? '' : '',
          priority: indexMap.priority >= 0 ? columns[indexMap.priority] ?? '' : '',
          status: indexMap.status >= 0 ? columns[indexMap.status] ?? '' : '',
          type: indexMap.type >= 0 ? columns[indexMap.type] ?? '' : '',
        }))
        .filter((row) => row.issue.trim().length > 0);

      if (parsedRows.length === 0) {
        setError('No importable tickets were found in the CSV.');
        return;
      }

      const createdTickets: OpsTicket[] = [];

      for (const row of parsedRows) {
        const response = await fetch('/api/ops/kanban', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: row.issue.trim(),
            assignee_user_id: findImportedAssignee(row.assignedTo, assignees),
            priority: normalizeImportedPriority(row.priority),
            status: normalizeImportedStatus(row.status),
            description: buildImportedDescription(row),
          }),
        });

        const json = await response.json();
        if (!response.ok) {
          throw new Error(json.error || `Failed to import ticket "${row.issue}"`);
        }

        createdTickets.push(json);
      }

      setTickets((currentTickets) => sortOpsTickets([...currentTickets, ...createdTickets]));
      setCountsByStatus((current) => {
        const next = { ...current };
        for (const ticket of createdTickets) {
          next[ticket.status] = (next[ticket.status] ?? 0) + 1;
        }
        return next;
      });
      setLoadedByStatus((current) => {
        const next = { ...current };
        for (const ticket of createdTickets) {
          next[ticket.status] = (next[ticket.status] ?? 0) + 1;
        }
        return next;
      });
      setImportMessage(`Imported ${createdTickets.length} ${createdTickets.length === 1 ? 'ticket' : 'tickets'}.`);
      refreshServerState();
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : 'Failed to import CSV.';
      setError(message);
    } finally {
      event.target.value = '';
      setIsImporting(false);
    }
  }

  async function persistTicket(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft.name.trim()) {
      setError('Ticket name is required.');
      return;
    }

    setIsSaving(true);
    setError('');

    const payload = {
      name: draft.name.trim(),
      description: draft.description,
      status: draft.status,
      priority: draft.priority,
      assignee_user_id: draft.assignee_user_id,
    };

    try {
      if (editingTicketId) {
        const response = await fetch(`/api/ops/kanban/${editingTicketId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await response.json();

        if (!response.ok) {
          setError(json.error || 'Failed to update ticket.');
          return;
        }

        setTickets((currentTickets) =>
          sortOpsTickets(
            currentTickets.map((ticket) => (ticket.id === json.id ? json : ticket))
          )
        );
      } else {
        const response = await fetch('/api/ops/kanban', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await response.json();

        if (!response.ok) {
          setError(json.error || 'Failed to create ticket.');
          return;
        }

        setTickets((currentTickets) => sortOpsTickets([...currentTickets, json]));
        setCountsByStatus((current) => ({
          ...current,
          [json.status]: (current[json.status as OpsTicketStatus] ?? 0) + 1,
        }));
        setLoadedByStatus((current) => ({
          ...current,
          [json.status]: (current[json.status as OpsTicketStatus] ?? 0) + 1,
        }));
      }

      closeEditor(true);
      refreshServerState();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteTicket() {
    if (!editingTicketId || !canDelete) return;
    if (!window.confirm('Delete this ticket permanently?')) return;

    setIsSaving(true);
    setError('');

    try {
      const response = await fetch(`/api/ops/kanban/${editingTicketId}`, {
        method: 'DELETE',
      });
      const json = await response.json();

      if (!response.ok) {
        setError(json.error || 'Failed to delete ticket.');
        return;
      }

      setTickets((currentTickets) =>
        currentTickets.filter((ticket) => ticket.id !== editingTicketId)
      );
      if (editingTicket) {
        setCountsByStatus((current) => ({
          ...current,
          [editingTicket.status]: Math.max(0, (current[editingTicket.status] ?? 1) - 1),
        }));
        setLoadedByStatus((current) => ({
          ...current,
          [editingTicket.status]: Math.max(0, (current[editingTicket.status] ?? 1) - 1),
        }));
      }
      closeEditor(true);
      refreshServerState();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  function togglePriorityFilter(priority: OpsTicketPriority) {
    setPriorityFilter((current) =>
      current.includes(priority)
        ? current.filter((item) => item !== priority)
        : [...current, priority]
    );
  }

  function buildOrderedStatusUpdate(
    sourceStatus: OpsTicketStatus,
    targetStatus: OpsTicketStatus,
    movingTicketId: string,
    overTicketId?: string
  ) {
    const sourceTickets = getManualStatusTickets(tickets, sourceStatus);
    const movingTicket = sourceTickets.find((ticket) => ticket.id === movingTicketId);
    if (!movingTicket) return null;

    const sourceWithoutMoving = sourceTickets.filter((ticket) => ticket.id !== movingTicketId);
    const targetTickets =
      sourceStatus === targetStatus
        ? [...sourceWithoutMoving]
        : getManualStatusTickets(tickets, targetStatus);

    let insertIndex = targetTickets.length;
    if (overTicketId) {
      const targetIndex = targetTickets.findIndex((ticket) => ticket.id === overTicketId);
      if (targetIndex >= 0) insertIndex = targetIndex;
    }

    const movedTicket: OpsTicket = {
      ...movingTicket,
      status: targetStatus,
      updated_at: new Date().toISOString(),
    };
    const movedGroupKey = getSortGroupKey(movedTicket, sortMode, assigneeMap);

    if (sortMode !== 'manual') {
      const groupedTargetIndexes = targetTickets
        .map((ticket, index) => ({ ticket, index }))
        .filter(({ ticket }) => getSortGroupKey(ticket, sortMode, assigneeMap) === movedGroupKey)
        .map(({ index }) => index);

      if (sourceStatus === targetStatus && overTicketId) {
        const overTicket = targetTickets.find((ticket) => ticket.id === overTicketId);
        if (overTicket && getSortGroupKey(overTicket, sortMode, assigneeMap) !== movedGroupKey) {
          return null;
        }
      }

      if (groupedTargetIndexes.length > 0) {
        const groupStart = groupedTargetIndexes[0];
        const groupEnd = groupedTargetIndexes[groupedTargetIndexes.length - 1] + 1;
        insertIndex = Math.min(Math.max(insertIndex, groupStart), groupEnd);
      } else if (sourceStatus !== targetStatus) {
        insertIndex = targetTickets.length;
      } else {
        return null;
      }
    }

    targetTickets.splice(insertIndex, 0, movedTicket);

    const nextUpdates: OpsTicket[] = [];

    if (sourceStatus !== targetStatus) {
      sourceWithoutMoving.forEach((ticket, index) => {
        nextUpdates.push({ ...ticket, sort_order: index });
      });
    }

    targetTickets.forEach((ticket, index) => {
      nextUpdates.push({ ...ticket, sort_order: index });
    });

    const updateMap = new Map(nextUpdates.map((ticket) => [ticket.id, ticket]));
    const nextTickets = tickets.map((ticket) => updateMap.get(ticket.id) ?? ticket);

    return {
      nextTickets,
      changedTickets: nextTickets.filter((ticket) => updateMap.has(ticket.id)),
    };
  }

  async function applyOrderedStatusUpdate(
    sourceStatus: OpsTicketStatus,
    targetStatus: OpsTicketStatus,
    movingTicketId: string,
    overTicketId?: string
  ) {
    const update = buildOrderedStatusUpdate(sourceStatus, targetStatus, movingTicketId, overTicketId);
    if (!update) return;

    const previousTickets = tickets;
    setTickets(update.nextTickets);
    if (sourceStatus !== targetStatus) {
      setLoadedByStatus((current) => ({
        ...current,
        [sourceStatus]: Math.max(0, (current[sourceStatus] ?? 1) - 1),
        [targetStatus]: (current[targetStatus] ?? 0) + 1,
      }));
    }

    try {
      await persistTicketOrder(update.nextTickets, update.changedTickets);
      refreshServerState();
    } catch {
      setTickets(previousTickets);
      if (sourceStatus !== targetStatus) {
        setLoadedByStatus((current) => ({
          ...current,
          [sourceStatus]: (current[sourceStatus] ?? 0) + 1,
          [targetStatus]: Math.max(0, (current[targetStatus] ?? 1) - 1),
        }));
      }
    }
  }

  const collisionDetection: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    return closestCenter(args);
  };

  function handleDragStart(event: DragStartEvent) {
    const activeId = String(event.active.id);
    if (!activeId.startsWith('ticket:')) return;
    dragLoadStatusRef.current = null;
    setActiveTicketId(activeId.replace('ticket:', ''));
  }

  function handleDragMove(event: DragMoveEvent) {
    const overId = event.over?.id ? String(event.over.id) : null;
    if (!overId || !overId.startsWith('load-more:')) {
      dragLoadStatusRef.current = null;
      return;
    }

    const status = overId.replace('load-more:', '') as OpsTicketStatus;
    if (dragLoadStatusRef.current === status) return;
    dragLoadStatusRef.current = status;
    void loadMoreStatus(status);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTicketId(null);
    dragLoadStatusRef.current = null;
    const activeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : null;

    if (!activeId.startsWith('ticket:') || !overId) return;

    const ticketId = activeId.replace('ticket:', '');
    const ticket = tickets.find((item) => item.id === ticketId);
    if (!ticket) return;

    let nextStatus: OpsTicketStatus | null = null;
    let overTicketId: string | undefined;

    if (overId.startsWith('column:')) {
      nextStatus = overId.replace('column:', '') as OpsTicketStatus;
    } else if (overId.startsWith('load-more:')) {
      nextStatus = overId.replace('load-more:', '') as OpsTicketStatus;
    } else if (overId.startsWith('ticket-drop:')) {
      overTicketId = overId.replace('ticket-drop:', '');
      if (overTicketId === ticket.id) return;
      const hoveredTicket = tickets.find((item) => item.id === overTicketId);
      nextStatus = hoveredTicket?.status ?? null;
    }

    if (!nextStatus) return;
    if (!overTicketId && nextStatus === ticket.status && sortMode !== 'manual') return;
    if (hasActiveFilters && nextStatus === ticket.status && !overTicketId && sortMode === 'manual') return;

    void applyOrderedStatusUpdate(ticket.status, nextStatus, ticket.id, overTicketId);
  }

  return (
    <>
      <div className="-mx-4 space-y-6 sm:-mx-6 lg:-mx-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="px-4 sm:px-6 lg:px-8">
            <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Operations</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Kanban</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-400">
              A shared ticket board for admins and agents to track work across backlog, delivery, review, and resolution.
            </p>
          </div>
          <div className="mx-4 flex items-center gap-3 self-start sm:mx-6 lg:mx-8">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Upload className="h-4 w-4" />
              {isImporting ? 'Importing...' : 'Import CSV'}
            </button>
            <button
              type="button"
              onClick={() => openNewTicket('todo')}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-gray-950 transition hover:bg-emerald-400"
            >
              <Plus className="h-4 w-4" />
              New ticket
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={importCsvFile}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1.5 text-sm font-medium text-emerald-100">
            <Sparkles className="h-4 w-4" />
            Kanban
          </span>

          <button
            type="button"
            onClick={() => setBoardView('all')}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              boardView === 'all'
                ? 'border-white/15 bg-white/10 text-white'
                : 'border-white/10 bg-transparent text-gray-400 hover:border-white/15 hover:text-white'
            }`}
          >
            All issues
          </button>

          <button
            type="button"
            onClick={() => setBoardView('mine')}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              boardView === 'mine'
                ? 'border-white/15 bg-white/10 text-white'
                : 'border-white/10 bg-transparent text-gray-400 hover:border-white/15 hover:text-white'
            }`}
          >
            My issues
          </button>

          <div className="ml-auto text-sm text-gray-500">
            {visibleTickets.length} {visibleTickets.length === 1 ? 'ticket' : 'tickets'}
          </div>
        </div>

        <div className="grid gap-3 px-4 sm:grid-cols-2 sm:px-6 xl:grid-cols-[auto_auto_1fr_auto] lg:px-8">
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-gray-500">
              <ArrowDownUp className="h-3.5 w-3.5" />
              Sort
            </div>
            <DarkSelect value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
              <option value="priority" className="bg-gray-950 text-white">Priority</option>
              <option value="manual" className="bg-gray-950 text-white">Manual order</option>
              <option value="assignee" className="bg-gray-950 text-white">Assignee</option>
            </DarkSelect>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-gray-500">
              <Filter className="h-3.5 w-3.5" />
              Assignee
            </div>
            <DarkSelect value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)}>
              <option value="all" className="bg-gray-950 text-white">All assignees</option>
              <option value="unassigned" className="bg-gray-950 text-white">Unassigned</option>
              {assignees.map((assignee) => (
                <option key={assignee.id} value={assignee.id} className="bg-gray-950 text-white">
                  {formatAssigneeLabel(assignee)}
                </option>
              ))}
            </DarkSelect>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-gray-500">
              <Filter className="h-3.5 w-3.5" />
              Priority
            </div>
            <div className="flex flex-wrap gap-2">
              {OPS_TICKET_PRIORITIES.map((priority) => {
                const active = priorityFilter.includes(priority.value);
                return (
                  <button
                    key={priority.value}
                    type="button"
                    onClick={() => togglePriorityFilter(priority.value)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                      active
                        ? `${priority.badgeClassName} border-current`
                        : 'border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    {priority.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-end justify-start sm:justify-end">
            <button
              type="button"
              onClick={() => {
                setPriorityFilter([]);
                setAssigneeFilter('all');
                setSortMode('priority');
              }}
              className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-gray-300 transition hover:border-white/20 hover:text-white"
            >
              Reset controls
            </button>
          </div>
        </div>

        {(importMessage || error) && (
          <div className="px-4 sm:px-6 lg:px-8">
            {importMessage && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                {importMessage}
              </div>
            )}
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
        >
          <div className="overflow-x-auto px-4 pb-4 sm:px-6 lg:px-8">
            <div className="flex min-w-full gap-4">
              {OPS_TICKET_STATUSES.map((status) => {
                const statusMeta = getOpsTicketStatusMeta(status.value);
                const columnTickets = getDisplayStatusTickets(visibleTickets, status.value, sortMode, assigneeMap);

                return (
                  <DroppableColumn key={status.value} status={status.value}>
                    <div className="flex items-center justify-between gap-3 px-1 pb-3">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${statusMeta.accentClassName}`} />
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-sm font-medium ${statusMeta.chipClassName}`}>
                          {statusMeta.label}
                        </span>
                        <span className="text-sm text-gray-500">{countsByStatus[status.value] ?? columnTickets.length}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => openNewTicket(status.value)}
                        className="rounded-full border border-white/10 p-2 text-gray-400 transition hover:border-white/20 hover:text-white"
                        aria-label={`Create ${statusMeta.label} ticket`}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex flex-1 flex-col gap-3">
                      {columnTickets.map((ticket) => (
                        <TicketCard
                          key={ticket.id}
                          ticket={ticket}
                          assignee={ticket.assignee_user_id ? assigneeMap.get(ticket.assignee_user_id) : undefined}
                          onOpen={openExistingTicket}
                        />
                      ))}

                      <ColumnLoadMoreTrigger
                        status={status.value}
                        disabled={isSaving || isImporting}
                        hasMore={(loadedByStatus[status.value] ?? 0) < (countsByStatus[status.value] ?? 0)}
                        isLoading={Boolean(loadingByStatus[status.value])}
                        onLoadMore={() => void loadMoreStatus(status.value)}
                      />

                      <button
                        type="button"
                        onClick={() => openNewTicket(status.value)}
                        className="mt-auto rounded-2xl border border-dashed border-white/10 px-4 py-3 text-left text-sm text-gray-500 transition hover:border-white/20 hover:bg-white/[0.03] hover:text-gray-200"
                      >
                        + New issue
                      </button>
                    </div>
                  </DroppableColumn>
                );
              })}
            </div>
          </div>

          <DragOverlay>
            {activeTicket ? (
              <div className="w-[20rem] rotate-1 opacity-95">
                <TicketPreviewCard
                  ticket={activeTicket}
                  assignee={activeTicket.assignee_user_id ? assigneeMap.get(activeTicket.assignee_user_id) : undefined}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        <div className="mx-4 rounded-3xl border border-white/8 bg-white/[0.03] p-4 text-sm text-gray-400 sm:mx-6 lg:mx-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 text-gray-200">
              <Flag className="h-4 w-4 text-emerald-300" />
              Drag across columns to change status. Within a column, drag reorders tickets inside the active sort grouping.
            </span>
            <span className="text-gray-600">Open a card to edit title, description, assignee, priority, or status.</span>
          </div>
        </div>
      </div>

      <TicketModal
        canDelete={canDelete}
        isOpen={editorOpen}
        isSaving={isSaving}
        error={error}
        draft={draft}
        editingTicket={editingTicket}
        assignees={assignees}
        onClose={closeEditor}
        onDelete={deleteTicket}
        onSubmit={persistTicket}
        onDraftChange={setDraft}
      />
    </>
  );
}
