/** Date helpers for the Shop tab. Client-safe. Shops are assumed to run on Toronto time. */

export const SHOP_TZ = 'America/Toronto';

/** Today's date (YYYY-MM-DD) in the shop's time zone. */
export function todayISO(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: SHOP_TZ });
}

/** Add days to a YYYY-MM-DD date without time-zone drift. */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function addYears(isoDate: string, years: number): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y + years, m - 1, d));
  return dt.toISOString().slice(0, 10);
}

export function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + months, d));
  return dt.toISOString().slice(0, 10);
}

/** Whole days from a to b (b - a), using calendar dates in the shop's time zone. */
export function daysBetween(a: string | Date, b: string | Date = new Date()): number {
  const toDay = (v: string | Date) => {
    const iso = typeof v === 'string' && v.length === 10 ? v : todayISO(new Date(v));
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toDay(b) - toDay(a)) / 86400000);
}

export function formatDate(value: string | null | undefined, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!value) return '—';
  const date = value.length === 10 ? new Date(`${value}T12:00:00Z`) : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-CA', { timeZone: value.length === 10 ? 'UTC' : SHOP_TZ, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', ...opts });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-CA', { timeZone: SHOP_TZ, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function formatShortDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-CA', { timeZone: SHOP_TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** YYYY-MM for grouping supplier statements and reports. */
export function monthKey(value: string | Date = new Date()): string {
  return todayISO(typeof value === 'string' ? new Date(value) : value).slice(0, 7);
}

/** First and last date of the calendar quarter containing `iso`. */
export function quarterRange(iso: string = todayISO()): { start: string; end: string; label: string } {
  const [y, m] = iso.split('-').map(Number);
  const q = Math.floor((m - 1) / 3);
  const startMonth = q * 3 + 1;
  const start = `${y}-${String(startMonth).padStart(2, '0')}-01`;
  const end = addDays(addMonths(start, 3), -1);
  const names = ['Jan–Mar', 'Apr–Jun', 'Jul–Sep', 'Oct–Dec'];
  return { start, end, label: `${names[q]} ${y}` };
}

export function monthRange(iso: string = todayISO()): { start: string; end: string; label: string } {
  const start = `${iso.slice(0, 7)}-01`;
  const end = addDays(addMonths(start, 1), -1);
  const label = new Date(`${start}T12:00:00Z`).toLocaleDateString('en-CA', { timeZone: 'UTC', month: 'long', year: 'numeric' });
  return { start, end, label };
}

/** Local midnight of a shop date as an ISO timestamp with the Toronto offset (EST or EDT). */
export function shopMidnight(isoDate: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: SHOP_TZ, timeZoneName: 'shortOffset' }).formatToParts(new Date(`${isoDate}T12:00:00Z`));
  const m = /GMT([+-]\d{1,2})(?::(\d{2}))?/.exec(parts.find(p => p.type === 'timeZoneName')?.value || '');
  const hours = m ? parseInt(m[1], 10) : -5;
  const mins = m?.[2] ? parseInt(m[2], 10) : 0;
  return `${isoDate}T00:00:00${hours < 0 ? '-' : '+'}${String(Math.abs(hours)).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}
