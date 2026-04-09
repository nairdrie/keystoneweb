'use client';

import dynamic from 'next/dynamic';
import type { KanbanBoardProps } from './KanbanBoard';

const KanbanBoard = dynamic(() => import('./KanbanBoard'), {
  ssr: false,
  loading: () => (
    <div className="-mx-4 space-y-6 sm:-mx-6 lg:-mx-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="px-4 sm:px-6 lg:px-8">
          <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Operations</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Kanban</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-400">
            Loading board...
          </p>
        </div>
      </div>

      <div className="grid gap-4 px-4 pb-4 sm:px-6 lg:grid-cols-3 lg:px-8">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="min-h-[360px] rounded-3xl border border-white/8 bg-white/[0.03] p-4"
          >
            <div className="h-6 w-28 rounded-full bg-white/10" />
            <div className="mt-4 space-y-3">
              <div className="h-24 rounded-2xl bg-white/[0.04]" />
              <div className="h-24 rounded-2xl bg-white/[0.04]" />
              <div className="h-24 rounded-2xl bg-white/[0.04]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  ),
});

export default function KanbanBoardClient(props: KanbanBoardProps) {
  return <KanbanBoard {...props} />;
}
