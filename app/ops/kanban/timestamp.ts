const ABSOLUTE_TIMESTAMP_OPTIONS = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
} satisfies Intl.DateTimeFormatOptions;

export function formatUtcTimestamp(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    ...ABSOLUTE_TIMESTAMP_OPTIONS,
    timeZone: 'UTC',
  }).format(new Date(value));
}

export function formatLocalTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, ABSOLUTE_TIMESTAMP_OPTIONS).format(new Date(value));
}
