'use client';

import { useState, useEffect } from 'react';
import type { AccountingCategory } from '@/lib/ops/accounting';
import MetricsCards from './MetricsCards';
import TransactionList from './TransactionList';
import EntryForm from './EntryForm';
import RecurringManager from './RecurringManager';
import ForecastView from './ForecastView';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'recurring', label: 'Recurring' },
  { id: 'forecast', label: 'Forecast' },
] as const;

type Tab = (typeof TABS)[number]['id'];

export default function AccountingDashboard({
  categories,
}: {
  categories: AccountingCategory[];
}) {
  const [tab, setTab] = useState<Tab>('overview');
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey((k) => k + 1);

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex items-center gap-2 border-b border-gray-800 pb-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-[1px] ${
              tab === t.id
                ? 'border-emerald-500 text-white'
                : 'border-transparent text-gray-400 hover:text-white hover:border-gray-600'
            }`}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto">
          <button
            onClick={() => setShowEntryForm(true)}
            className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
          >
            + Add Entry
          </button>
        </div>
      </div>

      {/* Overview tab: metrics + recent transactions */}
      {tab === 'overview' && (
        <>
          <MetricsCards refreshKey={refreshKey} />
          <TransactionList
            categories={categories}
            refreshKey={refreshKey}
            compact
          />
        </>
      )}

      {/* Transactions tab: full transaction list */}
      {tab === 'transactions' && (
        <TransactionList
          categories={categories}
          refreshKey={refreshKey}
        />
      )}

      {/* Recurring tab */}
      {tab === 'recurring' && (
        <RecurringManager
          categories={categories}
          refreshKey={refreshKey}
          onRefresh={refresh}
        />
      )}

      {/* Forecast tab */}
      {tab === 'forecast' && <ForecastView refreshKey={refreshKey} />}

      {/* Entry form modal */}
      {showEntryForm && (
        <EntryForm
          categories={categories}
          onClose={() => setShowEntryForm(false)}
          onSaved={() => {
            setShowEntryForm(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}
