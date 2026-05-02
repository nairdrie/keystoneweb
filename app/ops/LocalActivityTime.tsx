'use client';

import { useSyncExternalStore } from 'react';

type LocalActivityTimeProps = {
  value: string;
  className?: string;
};

const ACTIVITY_TIME_OPTIONS = {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
} satisfies Intl.DateTimeFormatOptions;

function subscribe() {
  return () => {};
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

function formatUtcActivityTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    ...ACTIVITY_TIME_OPTIONS,
    timeZone: 'UTC',
  }).format(new Date(value));
}

function formatLocalActivityTime(value: string) {
  return new Intl.DateTimeFormat(undefined, ACTIVITY_TIME_OPTIONS).format(new Date(value));
}

export default function LocalActivityTime({ value, className }: LocalActivityTimeProps) {
  const hasMounted = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const displayValue = hasMounted ? formatLocalActivityTime(value) : formatUtcActivityTime(value);

  return (
    <time dateTime={value} className={className} suppressHydrationWarning title={displayValue}>
      {displayValue}
    </time>
  );
}
