'use client';

import { useSyncExternalStore } from 'react';
import { formatLocalTimestamp, formatUtcTimestamp } from './timestamp';

type LocalTimestampProps = {
  value: string;
  className?: string;
};

function subscribe() {
  return () => {};
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

export default function LocalTimestamp({ value, className }: LocalTimestampProps) {
  const hasMounted = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const displayValue = hasMounted ? formatLocalTimestamp(value) : formatUtcTimestamp(value);

  return (
    <time
      dateTime={value}
      className={className}
      suppressHydrationWarning
      title={displayValue}
    >
      {displayValue}
    </time>
  );
}
