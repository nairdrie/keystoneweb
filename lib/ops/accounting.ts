/**
 * Accounting types, helpers, and auto-tracking logic.
 *
 * Revenue / expenses are a mix of:
 *  1. Auto-computed entries from user_subscriptions, user_addons, domain_purchases
 *  2. Manual entries stored in accounting_entries
 *  3. Recurring entries that generate manual entries each period
 */

// ── Types ───────────────────────────────────────────────────────────────────

export type EntryType = 'revenue' | 'expense';
export type EntrySource = 'manual' | 'subscription' | 'addon' | 'domain_sale' | 'domain_cost' | 'overage';
export type TaxType = 'gst' | 'hst' | 'gst_pst' | 'none';
export type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

export interface AccountingEntry {
  id: string;
  type: EntryType;
  source: EntrySource;
  title: string;
  description: string | null;
  amount_cents: number;
  tax_cents: number;
  tax_type: TaxType | null;
  currency: string;
  category: string | null;
  date: string;
  reference_id: string | null;
  reference_type: string | null;
  user_id: string | null;
  recurring_entry_id: string | null;
  invoice_storage_path: string | null;
  invoice_filename: string | null;
  notes: string | null;
  is_auto: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecurringEntry {
  id: string;
  type: EntryType;
  title: string;
  description: string | null;
  amount_cents: number;
  tax_cents: number;
  tax_type: TaxType | null;
  currency: string;
  category: string | null;
  frequency: Frequency;
  start_date: string;
  end_date: string | null;
  next_due_date: string;
  is_active: boolean;
  requires_invoice: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccountingCategory {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

// ── Metrics ─────────────────────────────────────────────────────────────────

export interface AccountingMetrics {
  revenue: { month: number; year: number; allTime: number };
  expenses: { month: number; year: number; allTime: number };
  net: { month: number; year: number; allTime: number };
  taxCollected: { month: number; year: number };
  taxPaid: { month: number; year: number };
  mrr: number;           // monthly recurring revenue
  arr: number;           // annual recurring revenue
  activeSubscriptions: number;
  activeAddons: number;
}

// ── Auto-tracking helpers ───────────────────────────────────────────────────

export interface SubscriptionRevenue {
  userId: string;
  email: string | null;
  plan: string;
  monthlyAmount: number;   // cents per month
  isYearly: boolean;
  status: string;
}

export interface AddonRevenue {
  userId: string;
  email: string | null;
  addonType: string;
  quantity: number;
  monthlyAmount: number;   // cents per month
  isYearly: boolean;
}

// ── Forecasting ─────────────────────────────────────────────────────────────

export interface ForecastPoint {
  month: string;           // YYYY-MM
  label: string;           // "Apr 2026"
  projectedRevenue: number;
  projectedExpenses: number;
  projectedNet: number;
  cumulativeNet: number;
}

// ── Frequency helpers ───────────────────────────────────────────────────────

export const FREQUENCIES: { value: Frequency; label: string; monthlyMultiplier: number }[] = [
  { value: 'weekly', label: 'Weekly', monthlyMultiplier: 52 / 12 },
  { value: 'biweekly', label: 'Bi-weekly', monthlyMultiplier: 26 / 12 },
  { value: 'monthly', label: 'Monthly', monthlyMultiplier: 1 },
  { value: 'quarterly', label: 'Quarterly', monthlyMultiplier: 1 / 3 },
  { value: 'yearly', label: 'Yearly', monthlyMultiplier: 1 / 12 },
];

export function getMonthlyEquivalent(amountCents: number, frequency: Frequency): number {
  const freq = FREQUENCIES.find((f) => f.value === frequency);
  return Math.round(amountCents * (freq?.monthlyMultiplier ?? 1));
}

export function getNextDueDate(currentDate: string, frequency: Frequency): string {
  const d = new Date(currentDate + 'T00:00:00');
  switch (frequency) {
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'biweekly':
      d.setDate(d.getDate() + 14);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'quarterly':
      d.setMonth(d.getMonth() + 3);
      break;
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Check how many periods of a recurring entry fall within a date range.
 * Returns the count of occurrences.
 */
export function countOccurrencesInRange(
  startDate: string,
  frequency: Frequency,
  rangeStart: string,
  rangeEnd: string,
  endDate?: string | null,
): number {
  let count = 0;
  let current = new Date(startDate + 'T00:00:00');
  const rStart = new Date(rangeStart + 'T00:00:00');
  const rEnd = new Date(rangeEnd + 'T00:00:00');
  const eDate = endDate ? new Date(endDate + 'T00:00:00') : null;

  // Advance to range start
  while (current < rStart) {
    current = new Date(getNextDueDate(current.toISOString().slice(0, 10), frequency) + 'T00:00:00');
  }

  while (current <= rEnd) {
    if (eDate && current > eDate) break;
    count++;
    current = new Date(getNextDueDate(current.toISOString().slice(0, 10), frequency) + 'T00:00:00');
  }

  return count;
}

// ── Formatting ──────────────────────────────────────────────────────────────

export function formatCents(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
  });
}

export function formatCentsShort(cents: number): string {
  const dollars = Math.abs(cents) / 100;
  const sign = cents < 0 ? '-' : '';
  if (dollars >= 1_000_000) return `${sign}$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `${sign}$${(dollars / 1_000).toFixed(1)}K`;
  return `${sign}$${dollars.toFixed(2)}`;
}

// ── Tax rates (Canada) ──────────────────────────────────────────────────────

export const TAX_RATES: Record<string, { label: string; rate: number }> = {
  gst: { label: 'GST (5%)', rate: 0.05 },
  hst: { label: 'HST (13%)', rate: 0.13 },
  gst_pst: { label: 'GST+PST (varies)', rate: 0.12 },
  none: { label: 'No Tax', rate: 0 },
};

// ── Invoice status for recurring entries ────────────────────────────────────

export interface InvoiceAlert {
  recurringEntryId: string;
  title: string;
  frequency: Frequency;
  missingMonths: string[];   // YYYY-MM dates where invoice is missing
}

/**
 * Get months between two dates as YYYY-MM strings.
 */
export function getMonthsBetween(start: string, end: string): string[] {
  const months: string[] = [];
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const current = new Date(s.getFullYear(), s.getMonth(), 1);
  while (current <= e) {
    months.push(current.toISOString().slice(0, 7));
    current.setMonth(current.getMonth() + 1);
  }
  return months;
}
