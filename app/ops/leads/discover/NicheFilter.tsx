'use client';

import { useRouter } from 'next/navigation';

// Category dropdown for the prospect call list. Options carry their own
// destination href (built server-side) so this stays a thin client wrapper.
export default function NicheFilter({
  current,
  options,
}: {
  current: string;
  options: Array<{ value: string; label: string; href: string }>;
}) {
  const router = useRouter();

  return (
    <select
      value={current}
      onChange={(e) => {
        const next = options.find((o) => o.value === e.target.value);
        if (next) router.push(next.href);
      }}
      className="rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-gray-500"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
