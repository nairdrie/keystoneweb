'use client';

import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  closestCorners,
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Flag, GripVertical, Plus, Sparkles, UserRound, X } from 'lucide-react';
import {
  getNextSortOrder,
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

function relativeUpdatedAt(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatAssigneeLabel(assignee: OpsAssigneeOption | undefined) {
  if (!assignee) return 'Unassigned';
  return assignee.name?.trim() || assignee.email;
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
      className={`flex min-h-[32rem] w-[20rem] shrink-0 flex-col rounded-2xl border p-3 transition-colors ${statusMeta.columnClassName} ${
        isOver ? 'ring-2 ring-white/15' : ''
      }`}
    >
      {children}
    </section>
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useDraggable({
    id: `ticket:${ticket.id}`,
  });

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.45 : 1,
      }}
      className={`group cursor-pointer rounded-2xl border border-white/6 bg-black/20 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.18)] transition hover:border-white/12 hover:bg-black/30 ${
        isDragging ? 'shadow-2xl' : ''
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
        <span className="shrink-0">{relativeUpdatedAt(ticket.updated_at)}</span>
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
        <span className="shrink-0">{relativeUpdatedAt(ticket.updated_at)}</span>
      </div>
    </article>
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
              <select
                value={draft.status}
                onChange={(event) => onDraftChange({ ...draft, status: event.target.value as OpsTicketStatus })}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-emerald-400/60 focus:outline-none"
              >
                {OPS_TICKET_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">Priority</label>
              <select
                value={draft.priority}
                onChange={(event) => onDraftChange({ ...draft, priority: event.target.value as OpsTicketPriority })}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-emerald-400/60 focus:outline-none"
              >
                {OPS_TICKET_PRIORITIES.map((priority) => (
                  <option key={priority.value} value={priority.value}>
                    {priority.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">Assignee</label>
              <select
                value={draft.assignee_user_id}
                onChange={(event) => onDraftChange({ ...draft, assignee_user_id: event.target.value })}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-emerald-400/60 focus:outline-none"
              >
                <option value="">Unassigned</option>
                {assignees.map((assignee) => (
                  <option key={assignee.id} value={assignee.id}>
                    {formatAssigneeLabel(assignee)}
                    {assignee.kind === 'admin' ? ' (Admin)' : assignee.kind === 'admin_agent' ? ' (Admin + Agent)' : ' (Agent)'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {editingTicket && (
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-xs text-gray-500">
              Created {new Date(editingTicket.created_at).toLocaleString('en-CA')}
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

export default function KanbanBoard({
  initialTickets,
  assignees,
  currentUserId,
  canDelete,
}: {
  initialTickets: OpsTicket[];
  assignees: OpsAssigneeOption[];
  currentUserId: string;
  canDelete: boolean;
}) {
  const router = useRouter();
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
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const assigneeMap = new Map(assignees.map((assignee) => [assignee.id, assignee]));
  const editingTicket = editingTicketId
    ? tickets.find((ticket) => ticket.id === editingTicketId) ?? null
    : null;
  const activeTicket = activeTicketId
    ? tickets.find((ticket) => ticket.id === activeTicketId) ?? null
    : null;

  const visibleTickets = boardView === 'mine'
    ? tickets.filter((ticket) => ticket.assignee_user_id === currentUserId)
    : tickets;

  function refreshServerState() {
    startTransition(() => router.refresh());
  }

  function openNewTicket(status: OpsTicketStatus = 'backlog') {
    setEditingTicketId(null);
    setDraft({ ...DEFAULT_DRAFT, status });
    setError('');
    setEditorOpen(true);
  }

  function openExistingTicket(ticket: OpsTicket) {
    setEditingTicketId(ticket.id);
    setDraft(buildDraft(ticket));
    setError('');
    setEditorOpen(true);
  }

  function closeEditor(force = false) {
    if (isSaving && !force) return;
    setEditorOpen(false);
    setEditingTicketId(null);
    setDraft(DEFAULT_DRAFT);
    setError('');
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
      closeEditor(true);
      refreshServerState();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  async function moveTicket(ticketId: string, nextStatus: OpsTicketStatus) {
    const existing = tickets.find((ticket) => ticket.id === ticketId);
    if (!existing || existing.status === nextStatus) return;

    const previousTickets = tickets;
    const optimisticTicket: OpsTicket = {
      ...existing,
      status: nextStatus,
      sort_order: getNextSortOrder(tickets, nextStatus),
      updated_at: new Date().toISOString(),
    };

    setTickets((currentTickets) =>
      sortOpsTickets(
        currentTickets.map((ticket) => (ticket.id === ticketId ? optimisticTicket : ticket))
      )
    );

    try {
      const response = await fetch(`/api/ops/kanban/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await response.json();

      if (!response.ok) {
        setTickets(previousTickets);
        return;
      }

      setTickets((currentTickets) =>
        sortOpsTickets(
          currentTickets.map((ticket) => (ticket.id === json.id ? json : ticket))
        )
      );
      refreshServerState();
    } catch {
      setTickets(previousTickets);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const activeId = String(event.active.id);
    if (!activeId.startsWith('ticket:')) return;
    setActiveTicketId(activeId.replace('ticket:', ''));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTicketId(null);
    const activeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : null;

    if (!activeId.startsWith('ticket:') || !overId) return;

    const ticketId = activeId.replace('ticket:', '');
    const ticket = tickets.find((item) => item.id === ticketId);
    if (!ticket) return;

    let nextStatus: OpsTicketStatus | null = null;

    if (overId.startsWith('column:')) {
      nextStatus = overId.replace('column:', '') as OpsTicketStatus;
    } else if (overId.startsWith('ticket:')) {
      const hoveredTicket = tickets.find((item) => item.id === overId.replace('ticket:', ''));
      nextStatus = hoveredTicket?.status ?? null;
    }

    if (!nextStatus || nextStatus === ticket.status) return;
    void moveTicket(ticket.id, nextStatus);
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Operations</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Kanban</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-400">
              A shared ticket board for admins and agents to track work across backlog, delivery, review, and resolution.
            </p>
          </div>

          <button
            type="button"
            onClick={() => openNewTicket('todo')}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-gray-950 transition hover:bg-emerald-400"
          >
            <Plus className="h-4 w-4" />
            New ticket
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
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

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="overflow-x-auto pb-4">
            <div className="flex min-w-max gap-4">
              {OPS_TICKET_STATUSES.map((status) => {
                const statusMeta = getOpsTicketStatusMeta(status.value);
                const columnTickets = visibleTickets.filter((ticket) => ticket.status === status.value);

                return (
                  <DroppableColumn key={status.value} status={status.value}>
                    <div className="flex items-center justify-between gap-3 px-1 pb-3">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${statusMeta.accentClassName}`} />
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-sm font-medium ${statusMeta.chipClassName}`}>
                          {statusMeta.label}
                        </span>
                        <span className="text-sm text-gray-500">{columnTickets.length}</span>
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

        <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4 text-sm text-gray-400">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 text-gray-200">
              <Flag className="h-4 w-4 text-emerald-300" />
              Drag cards between columns to move work through the pipeline.
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
