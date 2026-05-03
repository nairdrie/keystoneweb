export type RangePreset = '30' | '90' | '180' | '365' | 'custom';
export type BucketSize = 'day' | 'week' | 'month';

export type DashboardEvent = {
  id?: string;
  event_type: string;
  created_at: string;
  user_id: string | null;
  site_id: string | null;
  metadata?: unknown;
};

export type DateRange = {
  start: Date;
  end: Date;
  label: string;
};

export type Bucket = {
  key: string;
  label: string;
  start: Date;
  end: Date;
  values: Record<string, number>;
};

export type ActivityGroup = {
  key: string;
  eventType: string;
  siteId: string | null;
  userId: string | null;
  count: number;
  latestAt: string;
  earliestAt: string;
  events: DashboardEvent[];
};

const fmtDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtShortDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const fmtMonth = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function parseSafeDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDateRange(
  preset: RangePreset,
  customStart?: string | null,
  customEnd?: string | null,
  now = new Date(),
): DateRange {
  const today = startOfDay(now);
  const rangeEnd = endOfDay(today);

  if (preset === 'custom') {
    const parsedStart = parseSafeDate(customStart);
    const parsedEnd = parseSafeDate(customEnd);
    const start = parsedStart ? startOfDay(parsedStart) : addDays(today, -29);
    const end = parsedEnd ? endOfDay(parsedEnd) : rangeEnd;
    const safeStart = start <= end ? start : endOfDay(end);
    const safeEnd = end >= start ? end : endOfDay(start);
    return {
      start: startOfDay(safeStart),
      end: safeEnd,
      label: `${fmtDay.format(safeStart)} to ${fmtDay.format(safeEnd)}`,
    };
  }

  const days = Number(preset);
  const start = addDays(today, -(days - 1));
  return {
    start,
    end: rangeEnd,
    label: `${fmtDay.format(start)} to ${fmtDay.format(rangeEnd)}`,
  };
}

export function getPreviousRange(range: DateRange): DateRange {
  const durationMs = range.end.getTime() - range.start.getTime();
  const previousEnd = new Date(range.start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - durationMs);

  return {
    start: previousStart,
    end: previousEnd,
    label: `${fmtDay.format(previousStart)} to ${fmtDay.format(previousEnd)}`,
  };
}

export function isWithinRange(value: string, range: DateRange) {
  const date = parseSafeDate(value);
  if (!date) return false;
  return date >= range.start && date <= range.end;
}

export function formatBucketLabel(start: Date, end: Date, bucketSize: BucketSize) {
  if (bucketSize === 'day') return fmtDay.format(start);
  if (bucketSize === 'month') return fmtMonth.format(start);
  return `${fmtShortDay.format(start)} - ${fmtShortDay.format(end)}`;
}

export function buildBuckets(range: DateRange, bucketSize: BucketSize): Bucket[] {
  const buckets: Bucket[] = [];

  if (bucketSize === 'month') {
    let cursor = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
    while (cursor <= range.end) {
      const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const nextMonth = addMonths(monthStart, 1);
      const monthEnd = new Date(nextMonth.getTime() - 1);
      const start = monthStart < range.start ? range.start : monthStart;
      const end = monthEnd > range.end ? range.end : monthEnd;
      buckets.push({
        key: `${start.toISOString()}-${end.toISOString()}`,
        label: formatBucketLabel(start, end, bucketSize),
        start,
        end,
        values: {},
      });
      cursor = nextMonth;
    }
    return buckets;
  }

  const step = bucketSize === 'week' ? 7 : 1;
  for (let cursor = range.start; cursor <= range.end; cursor = addDays(cursor, step)) {
    const rawEnd = endOfDay(addDays(cursor, step - 1));
    const end = rawEnd > range.end ? range.end : rawEnd;
    buckets.push({
      key: `${cursor.toISOString()}-${end.toISOString()}`,
      label: formatBucketLabel(cursor, end, bucketSize),
      start: cursor,
      end,
      values: {},
    });
  }

  return buckets;
}

export function bucketEvents(events: DashboardEvent[], range: DateRange, bucketSize: BucketSize) {
  const buckets = buildBuckets(range, bucketSize);

  for (const event of events) {
    const occurredAt = parseSafeDate(event.created_at);
    if (!occurredAt || occurredAt < range.start || occurredAt > range.end) continue;
    const bucket = buckets.find((candidate) => occurredAt >= candidate.start && occurredAt <= candidate.end);
    if (!bucket) continue;
    bucket.values[event.event_type] = (bucket.values[event.event_type] ?? 0) + 1;
  }

  return buckets;
}

export function countEvents(events: DashboardEvent[], keys: string[], range: DateRange) {
  const keySet = new Set(keys);
  return events.reduce((sum, event) => (
    keySet.has(event.event_type) && isWithinRange(event.created_at, range) ? sum + 1 : sum
  ), 0);
}

export function percent(part: number, whole: number) {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return null;
  return Math.round((part / whole) * 100);
}

export function getDelta(current: number, previous: number) {
  if (previous === 0) {
    return current === 0
      ? { label: 'No change', tone: 'neutral' as const }
      : { label: 'No prior data', tone: 'neutral' as const };
  }

  const raw = ((current - previous) / previous) * 100;
  const rounded = Math.round(raw);
  if (rounded === 0) return { label: 'No change', tone: 'neutral' as const };
  return {
    label: `${rounded > 0 ? '+' : ''}${rounded}% vs previous`,
    tone: rounded > 0 ? 'positive' as const : 'negative' as const,
  };
}

export function safeSiteName(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || 'Untitled site';
}

export function safeUserName(email: string | null | undefined, businessName?: string | null) {
  return businessName?.trim() || email?.trim() || 'Unknown user';
}

export function relativeTime(value: string, now = new Date()) {
  const date = parseSafeDate(value);
  if (!date) return 'Unknown time';
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return fmtDay.format(date);
}

export function groupRecentActivity(events: DashboardEvent[], proximityMinutes = 10): ActivityGroup[] {
  const sorted = [...events].sort((left, right) => {
    const leftTime = parseSafeDate(left.created_at)?.getTime() ?? 0;
    const rightTime = parseSafeDate(right.created_at)?.getTime() ?? 0;
    return rightTime - leftTime;
  });

  const groups: ActivityGroup[] = [];

  for (const event of sorted) {
    const eventTime = parseSafeDate(event.created_at);
    if (!eventTime) continue;
    const latest = groups[groups.length - 1];
    const latestTime = latest ? parseSafeDate(latest.earliestAt) : null;
    const sameGroup = latest
      && latest.eventType === event.event_type
      && latest.siteId === event.site_id
      && latest.userId === event.user_id
      && latestTime
      && Math.abs(latestTime.getTime() - eventTime.getTime()) <= proximityMinutes * 60_000;

    if (sameGroup) {
      latest.count += 1;
      latest.earliestAt = event.created_at;
      latest.events.push(event);
      continue;
    }

    groups.push({
      key: `${event.event_type}:${event.site_id ?? 'platform'}:${event.user_id ?? 'system'}:${event.created_at}`,
      eventType: event.event_type,
      siteId: event.site_id,
      userId: event.user_id,
      count: 1,
      latestAt: event.created_at,
      earliestAt: event.created_at,
      events: [event],
    });
  }

  return groups;
}
