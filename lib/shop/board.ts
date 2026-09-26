/**
 * Board lanes, card status pills and "My desk" tasks. Client-safe; derived
 * entirely from the workspace payload so the board and desk always agree.
 */

import { daysBetween, todayISO } from './dates';
import { formatCents } from './money';
import type { JobSummary, Stage, Workspace } from './types';

export const LANES: { id: Stage; label: string; hint: string }[] = [
  { id: 'dropped', label: 'Dropped off', hint: 'Key logged, complaint written down' },
  { id: 'estimate', label: 'Write estimate', hint: 'Tech notes are in. Price it.' },
  { id: 'waiting', label: 'Waiting on customer', hint: 'Estimate sent' },
  { id: 'approved', label: 'Approved', hint: 'Order parts, then a bay' },
  { id: 'done', label: 'Done · parked', hint: 'Invoice, get paid, hand back the key' },
];

export const STAGE_LABELS: Record<Stage, string> = {
  dropped: 'Dropped off',
  estimate: 'Write estimate',
  waiting: 'Waiting on customer',
  approved: 'Approved',
  done: 'Done · parked',
};

export type Tone = 'ok' | 'warn' | 'info' | 'crit' | 'neutral';
export type StatusIcon = 'key' | 'dollar' | 'alert' | 'file' | 'wrench' | 'search' | 'mic' | 'clock' | 'package' | 'globe' | 'calendar' | 'check';

export interface CardStatus { tone: Tone; icon: StatusIcon; text: string }

export function vehicleLabel(v: { year: number | null; make: string | null; model: string | null }): string {
  return [v.year, v.make, v.model].filter(Boolean).join(' ') || 'Vehicle';
}

export function shortVehicleLabel(v: { year: number | null; make: string | null; model: string | null }): string {
  return [v.year, v.make, v.model?.split(' ')[0]].filter(Boolean).join(' ') || 'Vehicle';
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash', debit: 'Debit', credit: 'Credit card', etransfer: 'E-transfer', cheque: 'Cheque', stripe: 'Card (online)', paypal: 'PayPal', other: 'Other',
};

export function roLabel(n: number): string { return `RO-${n}`; }
export function invoiceLabel(n: number): string { return `INV-${String(n).padStart(4, '0')}`; }

export function cardStatus(j: JobSummary, today: string = todayISO()): CardStatus {
  if (j.holding_since && j.invoice && j.invoice.balance_cents > 0) return { tone: 'crit', icon: 'key', text: 'Holding · unpaid' };
  if (j.invoice && j.invoice.balance_cents > 0) return { tone: 'warn', icon: 'dollar', text: 'Invoiced, unpaid' };
  if (j.invoice) return { tone: 'ok', icon: 'check', text: 'Paid' };
  if (j.pending_revision) return { tone: 'warn', icon: 'alert', text: 'Extra work needs OK' };
  if (j.bay) {
    if (j.voice_ready) return { tone: 'info', icon: 'mic', text: 'Voice note ready' };
    return j.approved ? { tone: 'ok', icon: 'wrench', text: 'Repairing' } : { tone: 'info', icon: 'search', text: 'Diagnosing' };
  }
  switch (j.stage) {
    case 'done':
      return j.approved ? { tone: 'ok', icon: 'file', text: 'Ready to invoice' } : { tone: 'neutral', icon: 'key', text: 'Ready for pickup' };
    case 'approved':
      if (j.parts.expected > j.parts.received) {
        return { tone: 'info', icon: 'clock', text: j.parts.next_eta ? `Parts ETA ${j.parts.next_eta}` : 'Waiting on parts' };
      }
      return { tone: 'ok', icon: 'package', text: j.parts.expected ? 'Parts here' : 'Ready for a bay' };
    case 'waiting': {
      const days = j.estimate?.sent_at ? daysBetween(j.estimate.sent_at, today) : 0;
      return { tone: 'neutral', icon: 'clock', text: days > 0 ? `No reply · ${days}d` : 'Sent today' };
    }
    case 'estimate':
      if (j.voice_ready) return { tone: 'info', icon: 'mic', text: 'Voice note ready' };
      if (!j.estimate) return { tone: 'neutral', icon: 'file', text: 'Start the estimate' };
      return j.estimate.needs_price > 0 ? { tone: 'neutral', icon: 'file', text: 'Needs a price' } : { tone: 'neutral', icon: 'file', text: 'Ready to send' };
    default:
      if (j.source === 'website_form') return { tone: 'info', icon: 'globe', text: 'From website' };
      if (j.source === 'booking') return { tone: 'info', icon: 'calendar', text: 'Booked online' };
      return { tone: 'neutral', icon: 'key', text: 'Waiting for a tech' };
  }
}

/** The dollar figure shown on a card: what's owed, else what's approved, else the estimate so far. */
export function cardAmount(j: JobSummary): number | null {
  if (j.invoice) return j.invoice.balance_cents;
  if (j.approved) return j.approved.total_cents;
  if (j.estimate && j.estimate.total_cents > 0) return j.estimate.total_cents;
  return null;
}

export function daysOnLot(j: Pick<JobSummary, 'created_at'>, today: string = todayISO()): number {
  return Math.max(0, daysBetween(j.created_at, today));
}

// ── My desk ────────────────────────────────────────────────────────────────

export type DeskGroup = 'now' | 'customers' | 'money' | 'paperwork';

export interface DeskTask {
  key: string;
  group: DeskGroup;
  tone: Tone;
  icon: StatusIcon | 'landmark' | 'rotate' | 'phone' | 'inbox';
  title: string;
  text: string;
  action: { label: string; view?: string; jobId?: string; tab?: string; lienId?: string };
}

export function deskTasks(ws: Workspace, today: string = todayISO()): DeskTask[] {
  const tasks: DeskTask[] = [];
  const first = (name: string) => name.split(' ')[0];

  for (const l of ws.liens) {
    if (l.status === 'active' && !l.ppsr_registration_number) {
      tasks.push({
        key: `lien-reg-${l.id}`, group: 'now', tone: 'warn', icon: 'landmark',
        title: `Register the lien on ${l.customer_name}’s ${l.vehicle_label}`,
        text: 'Released on credit. Until the claim for lien is in the PPSR, a sale of the car wipes out your lien.',
        action: { label: 'Open lien file', view: 'money', lienId: l.id },
      });
    }
  }

  if (ws.pile_count > 0) {
    tasks.push({
      key: 'pile', group: 'now', tone: 'info', icon: 'package',
      title: `${ws.pile_count} supplier invoice${ws.pile_count === 1 ? '' : 's'} need${ws.pile_count === 1 ? 's' : ''} a job`,
      text: 'Match each one to a car so the parts land on the right invoice.',
      action: { label: 'Match them', view: 'parts' },
    });
  }

  if (ws.intake.length > 0) {
    tasks.push({
      key: 'intake', group: 'now', tone: 'info', icon: 'inbox',
      title: `${ws.intake.length} drop-off request${ws.intake.length === 1 ? '' : 's'} from your website`,
      text: ws.intake.slice(0, 3).map(i => i.name).join(', '),
      action: { label: 'Put on the board', view: 'board' },
    });
  }

  for (const j of ws.jobs) {
    if (j.status !== 'open') continue;
    const who = first(j.customer.name);
    const car = shortVehicleLabel(j.vehicle);
    if (j.pending_revision && !j.invoice) {
      tasks.push({
        key: `rev-${j.id}`, group: 'now', tone: 'warn', icon: 'alert',
        title: `${car}: extra work needs ${who}’s OK`,
        text: `${j.pending_revision.added_lines} added line${j.pending_revision.added_lines === 1 ? '' : 's'} (${formatCents(j.pending_revision.added_cents)}) aren’t on the approved estimate. Send the revised estimate before invoicing.`,
        action: { label: 'Open invoice', jobId: j.id, tab: 'invoice' },
      });
    } else if (j.stage === 'done' && !j.invoice && j.approved) {
      tasks.push({
        key: `inv-${j.id}`, group: 'now', tone: 'ok', icon: 'file',
        title: `${car}: invoice ready to issue`,
        text: 'Built from the approved estimate and the parts that came in.',
        action: { label: 'Review invoice', jobId: j.id, tab: 'invoice' },
      });
    }
    if (j.voice_ready) {
      tasks.push({
        key: `voice-${j.id}`, group: 'now', tone: 'info', icon: 'mic',
        title: `${car}: the tech’s notes are in`,
        text: 'Keystone drafted the estimate lines. Add prices and send it.',
        action: { label: 'Price it', jobId: j.id, tab: 'estimate' },
      });
    } else if (j.stage === 'estimate' && !j.bay) {
      tasks.push({
        key: `est-${j.id}`, group: 'customers', tone: 'neutral', icon: 'rotate',
        title: `${car}: finish the estimate`,
        text: j.next_step || (j.estimate?.needs_price ? `${j.estimate.needs_price} line${j.estimate.needs_price === 1 ? '' : 's'} still need a price.` : 'Ready to send.'),
        action: { label: 'Resume', jobId: j.id, tab: 'estimate' },
      });
    }
    if (j.stage === 'waiting' && j.estimate?.sent_at && daysBetween(j.estimate.sent_at, today) >= 1) {
      tasks.push({
        key: `wait-${j.id}`, group: 'customers', tone: 'neutral', icon: 'phone',
        title: `${car}: no answer on the estimate`,
        text: `Sent ${daysBetween(j.estimate.sent_at, today)} day${daysBetween(j.estimate.sent_at, today) === 1 ? '' : 's'} ago.${j.customer.phone ? ` Call ${who} at ${j.customer.phone}.` : ''}`,
        action: { label: 'Open', jobId: j.id, tab: 'estimate' },
      });
    }
    if (j.invoice && j.invoice.balance_cents > 0) {
      tasks.push({
        key: `owe-${j.id}`, group: 'money', tone: j.holding_since ? 'warn' : 'neutral', icon: j.holding_since ? 'key' : 'dollar',
        title: j.holding_since ? `${car}: held on the lot, ${daysBetween(j.holding_since, today)} days` : `${car}: invoice unpaid`,
        text: `${j.customer.name} owes ${formatCents(j.invoice.balance_cents)}.${j.holding_since ? ' Offer a payment plan or keep holding it.' : ''}`,
        action: { label: 'Open invoice', jobId: j.id, tab: 'invoice' },
      });
    }
  }

  for (const l of ws.liens) {
    if (l.status === 'active' && l.next_due) {
      const days = daysBetween(today, l.next_due.due);
      if (days <= 7) {
        tasks.push({
          key: `lien-due-${l.id}`, group: 'money', tone: days < 0 ? 'warn' : 'neutral', icon: 'dollar',
          title: `${l.customer_name}: ${formatCents(l.next_due.amount_cents)} ${days < 0 ? `overdue since ${l.next_due.due}` : days === 0 ? 'due today' : `due ${l.next_due.due}`}`,
          text: `Payment plan on the ${l.vehicle_label}. ${formatCents(l.balance_cents)} left.`,
          action: { label: 'Open plan', view: 'money', lienId: l.id },
        });
      }
    }
    if (l.status === 'paid' && l.ppsr_registration_number && !l.discharge_registered_at && l.discharge_due_on) {
      tasks.push({
        key: `lien-dis-${l.id}`, group: 'paperwork', tone: 'warn', icon: 'landmark',
        title: `Register the discharge for ${l.customer_name} by ${l.discharge_due_on}`,
        text: 'Paid in full. The lien has to come off the car within 30 days. Filing a discharge is free.',
        action: { label: 'Open lien file', view: 'money', lienId: l.id },
      });
    }
    if (l.status === 'active' && l.ppsr_expires_on && daysBetween(today, l.ppsr_expires_on) <= 30) {
      tasks.push({
        key: `lien-exp-${l.id}`, group: 'paperwork', tone: 'warn', icon: 'landmark',
        title: `PPSR registration for ${l.customer_name} expires ${l.ppsr_expires_on}`,
        text: 'Extend it before it lapses (never past 3 years from registration), or the lien comes off.',
        action: { label: 'Open lien file', view: 'money', lienId: l.id },
      });
    }
  }
  return tasks;
}
