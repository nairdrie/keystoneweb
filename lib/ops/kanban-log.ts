import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getAssigneeDisplay,
  getOpsTicketPriorityMeta,
  getOpsTicketStatusMeta,
  type OpsAssigneeOption,
  type OpsTicket,
  type OpsTicketLogAction,
  type OpsTicketLogEntry,
  type OpsTicketLogField,
} from '@/lib/ops/kanban';

export interface OpsTicketLogInsert {
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
}

const TRACKED_UPDATE_FIELDS: OpsTicketLogField[] = [
  'title',
  'description',
  'status',
  'priority',
  'assignee',
  'client',
];

function normalizeText(value: string | null) {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function getAssigneeMaps(assignees: OpsAssigneeOption[]) {
  const byId = new Map<string, OpsAssigneeOption>();
  for (const assignee of assignees) {
    byId.set(assignee.id, assignee);
  }
  return byId;
}

export function buildCreateTicketLog(
  ticket: OpsTicket,
  actor: { userId: string | null; userEmail: string | null }
): OpsTicketLogInsert {
  return {
    ticket_id: ticket.id,
    ticket_name: ticket.name,
    actor_user_id: actor.userId,
    actor_email: actor.userEmail,
    action: 'create',
    field_name: null,
    old_value: null,
    new_value: ticket.name,
    old_label: null,
    new_label: ticket.name,
  };
}

export function buildDeleteTicketLog(
  ticket: OpsTicket,
  actor: { userId: string | null; userEmail: string | null }
): OpsTicketLogInsert {
  return {
    ticket_id: ticket.id,
    ticket_name: ticket.name,
    actor_user_id: actor.userId,
    actor_email: actor.userEmail,
    action: 'delete',
    field_name: null,
    old_value: ticket.name,
    new_value: null,
    old_label: ticket.name,
    new_label: null,
  };
}

export function buildUpdateTicketLogs(
  previousTicket: OpsTicket,
  nextTicket: OpsTicket,
  actor: { userId: string | null; userEmail: string | null },
  assignees: OpsAssigneeOption[]
) {
  const logs: OpsTicketLogInsert[] = [];
  const assigneesById = getAssigneeMaps(assignees);

  for (const field of TRACKED_UPDATE_FIELDS) {
    if (field === 'title') {
      const previousValue = normalizeText(previousTicket.name);
      const nextValue = normalizeText(nextTicket.name);
      if (previousValue === nextValue) continue;

      logs.push({
        ticket_id: nextTicket.id,
        ticket_name: nextTicket.name,
        actor_user_id: actor.userId,
        actor_email: actor.userEmail,
        action: 'update',
        field_name: field,
        old_value: previousValue,
        new_value: nextValue,
        old_label: previousValue,
        new_label: nextValue,
      });
      continue;
    }

    if (field === 'description') {
      const previousValue = normalizeText(previousTicket.description);
      const nextValue = normalizeText(nextTicket.description);
      if (previousValue === nextValue) continue;

      logs.push({
        ticket_id: nextTicket.id,
        ticket_name: nextTicket.name,
        actor_user_id: actor.userId,
        actor_email: actor.userEmail,
        action: 'update',
        field_name: field,
        old_value: previousValue,
        new_value: nextValue,
        old_label: previousValue,
        new_label: nextValue,
      });
      continue;
    }

    if (field === 'status') {
      if (previousTicket.status === nextTicket.status) continue;

      logs.push({
        ticket_id: nextTicket.id,
        ticket_name: nextTicket.name,
        actor_user_id: actor.userId,
        actor_email: actor.userEmail,
        action: 'update',
        field_name: field,
        old_value: previousTicket.status,
        new_value: nextTicket.status,
        old_label: getOpsTicketStatusMeta(previousTicket.status).label,
        new_label: getOpsTicketStatusMeta(nextTicket.status).label,
      });
      continue;
    }

    if (field === 'priority') {
      if (previousTicket.priority === nextTicket.priority) continue;

      logs.push({
        ticket_id: nextTicket.id,
        ticket_name: nextTicket.name,
        actor_user_id: actor.userId,
        actor_email: actor.userEmail,
        action: 'update',
        field_name: field,
        old_value: previousTicket.priority,
        new_value: nextTicket.priority,
        old_label: getOpsTicketPriorityMeta(previousTicket.priority).label,
        new_label: getOpsTicketPriorityMeta(nextTicket.priority).label,
      });
      continue;
    }

    if (field === 'client') {
      const previousValue = normalizeText(previousTicket.client_tag);
      const nextValue = normalizeText(nextTicket.client_tag);
      if (previousValue === nextValue) continue;

      logs.push({
        ticket_id: nextTicket.id,
        ticket_name: nextTicket.name,
        actor_user_id: actor.userId,
        actor_email: actor.userEmail,
        action: 'update',
        field_name: field,
        old_value: previousValue,
        new_value: nextValue,
        old_label: previousValue,
        new_label: nextValue,
      });
      continue;
    }

    const previousValue = previousTicket.assignee_user_id;
    const nextValue = nextTicket.assignee_user_id;
    if (previousValue === nextValue) continue;

    logs.push({
      ticket_id: nextTicket.id,
      ticket_name: nextTicket.name,
      actor_user_id: actor.userId,
      actor_email: actor.userEmail,
      action: 'update',
      field_name: field,
      old_value: previousValue,
      new_value: nextValue,
      old_label: getAssigneeDisplay(previousValue ? assigneesById.get(previousValue) : null),
      new_label: getAssigneeDisplay(nextValue ? assigneesById.get(nextValue) : null),
    });
  }

  return logs;
}

export async function insertOpsTicketLogs(
  db: SupabaseClient,
  entries: OpsTicketLogInsert[]
) {
  if (entries.length === 0) return;

  const { error } = await db.from('ops_ticket_logs').insert(entries);
  if (error) {
    throw error;
  }
}

export function formatOpsTicketLogMessage(entry: OpsTicketLogEntry) {
  if (entry.action === 'create') {
    return 'created the ticket';
  }

  if (entry.action === 'delete') {
    return 'deleted the ticket';
  }

  if (entry.field_name === 'status') {
    return `moved the ticket from ${entry.old_label ?? 'Unknown'} to ${entry.new_label ?? 'Unknown'}`;
  }

  if (entry.field_name === 'priority') {
    return `changed priority from ${entry.old_label ?? 'Unknown'} to ${entry.new_label ?? 'Unknown'}`;
  }

  if (entry.field_name === 'assignee') {
    return `changed assignee from ${entry.old_label ?? 'Unassigned'} to ${entry.new_label ?? 'Unassigned'}`;
  }

  if (entry.field_name === 'title') {
    return 'renamed the ticket';
  }

  if (entry.field_name === 'description') {
    return 'updated the description';
  }

  if (entry.field_name === 'client') {
    return `changed client from ${entry.old_label ?? 'None'} to ${entry.new_label ?? 'None'}`;
  }

  return 'updated the ticket';
}
