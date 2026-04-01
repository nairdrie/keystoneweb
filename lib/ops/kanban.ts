export const OPS_TICKET_STATUSES = [
  {
    value: 'backlog',
    label: 'Backlog',
    chipClassName: 'border-gray-700 bg-gray-800/80 text-gray-200',
    columnClassName: 'border-gray-800 bg-gray-900/50',
    accentClassName: 'bg-gray-400',
  },
  {
    value: 'blocked',
    label: 'Blocked',
    chipClassName: 'border-rose-500/30 bg-rose-500/15 text-rose-200',
    columnClassName: 'border-rose-500/20 bg-rose-950/20',
    accentClassName: 'bg-rose-400',
  },
  {
    value: 'todo',
    label: 'To Do',
    chipClassName: 'border-amber-500/30 bg-amber-500/15 text-amber-200',
    columnClassName: 'border-amber-500/20 bg-amber-950/20',
    accentClassName: 'bg-amber-400',
  },
  {
    value: 'in_progress',
    label: 'In Progress',
    chipClassName: 'border-sky-500/30 bg-sky-500/15 text-sky-200',
    columnClassName: 'border-sky-500/20 bg-sky-950/20',
    accentClassName: 'bg-sky-400',
  },
  {
    value: 'review',
    label: 'In Review',
    chipClassName: 'border-pink-500/30 bg-pink-500/15 text-pink-200',
    columnClassName: 'border-pink-500/20 bg-pink-950/20',
    accentClassName: 'bg-pink-400',
  },
  {
    value: 'testing',
    label: 'Testing',
    chipClassName: 'border-violet-500/30 bg-violet-500/15 text-violet-200',
    columnClassName: 'border-violet-500/20 bg-violet-950/20',
    accentClassName: 'bg-violet-400',
  },
  {
    value: 'resolved',
    label: 'Resolved',
    chipClassName: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200',
    columnClassName: 'border-emerald-500/20 bg-emerald-950/20',
    accentClassName: 'bg-emerald-400',
  },
] as const;

export const OPS_TICKET_PRIORITIES = [
  {
    value: 'low',
    label: 'Low',
    badgeClassName: 'border-gray-700 bg-gray-800 text-gray-300',
  },
  {
    value: 'medium',
    label: 'Medium',
    badgeClassName: 'border-amber-500/30 bg-amber-500/15 text-amber-200',
  },
  {
    value: 'high',
    label: 'High',
    badgeClassName: 'border-orange-500/30 bg-orange-500/15 text-orange-200',
  },
  {
    value: 'urgent',
    label: 'Urgent',
    badgeClassName: 'border-rose-500/30 bg-rose-500/15 text-rose-200',
  },
] as const;

export type OpsTicketStatus = (typeof OPS_TICKET_STATUSES)[number]['value'];
export type OpsTicketPriority = (typeof OPS_TICKET_PRIORITIES)[number]['value'];

export interface OpsTicket {
  id: string;
  name: string;
  description: string | null;
  status: OpsTicketStatus;
  priority: OpsTicketPriority;
  assignee_user_id: string | null;
  created_by_user_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface OpsAssigneeOption {
  id: string;
  email: string;
  name: string | null;
  kind: 'admin' | 'agent' | 'admin_agent';
}

export const OPS_TICKET_LOG_FIELDS = [
  'title',
  'description',
  'status',
  'priority',
  'assignee',
] as const;

export const OPS_TICKET_LOG_ACTIONS = [
  'create',
  'update',
  'delete',
] as const;

export type OpsTicketLogField = (typeof OPS_TICKET_LOG_FIELDS)[number];
export type OpsTicketLogAction = (typeof OPS_TICKET_LOG_ACTIONS)[number];

export interface OpsTicketLogEntry {
  id: number;
  ticket_id: string | null;
  ticket_name: string;
  actor_user_id: string | null;
  actor_email: string | null;
  action: OpsTicketLogAction;
  field_name: OpsTicketLogField | null;
  old_value: string | null;
  new_value: string | null;
  old_label: string | null;
  new_label: string | null;
  created_at: string;
}

const STATUS_VALUES = new Set<string>(OPS_TICKET_STATUSES.map((status) => status.value));
const PRIORITY_VALUES = new Set<string>(OPS_TICKET_PRIORITIES.map((priority) => priority.value));

export function isOpsTicketStatus(value: string): value is OpsTicketStatus {
  return STATUS_VALUES.has(value);
}

export function isOpsTicketPriority(value: string): value is OpsTicketPriority {
  return PRIORITY_VALUES.has(value);
}

export function getOpsTicketStatusMeta(status: OpsTicketStatus) {
  return OPS_TICKET_STATUSES.find((item) => item.value === status) ?? OPS_TICKET_STATUSES[0];
}

export function getOpsTicketPriorityMeta(priority: OpsTicketPriority) {
  return OPS_TICKET_PRIORITIES.find((item) => item.value === priority) ?? OPS_TICKET_PRIORITIES[1];
}

export function getAssigneeDisplay(assignee: OpsAssigneeOption | null | undefined) {
  if (!assignee) return 'Unassigned';
  return assignee.name?.trim() || assignee.email;
}

export function sortOpsTickets(tickets: OpsTicket[]) {
  const statusIndex = new Map(OPS_TICKET_STATUSES.map((status, index) => [status.value, index]));

  return [...tickets].sort((left, right) => {
    const leftStatusIndex = statusIndex.get(left.status) ?? 0;
    const rightStatusIndex = statusIndex.get(right.status) ?? 0;
    if (leftStatusIndex !== rightStatusIndex) return leftStatusIndex - rightStatusIndex;
    if (left.sort_order !== right.sort_order) return left.sort_order - right.sort_order;
    return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
  });
}

export function getNextSortOrder(tickets: OpsTicket[], status: OpsTicketStatus) {
  const maxOrder = tickets
    .filter((ticket) => ticket.status === status)
    .reduce((currentMax, ticket) => Math.max(currentMax, ticket.sort_order), -1);

  return maxOrder + 1;
}
