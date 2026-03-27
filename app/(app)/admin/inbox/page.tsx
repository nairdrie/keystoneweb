'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, RefreshCw, Inbox, Bot, User, CheckCircle, Ban } from 'lucide-react';
import { useAdminContext } from '../admin-context';

interface Submission {
  id: string;
  sender_name: string;
  sender_email: string;
  sender_phone: string | null;
  message: string;
  status: 'new' | 'ai_handled' | 'needs_review' | 'replied' | 'spam';
  ai_classification: string | null;
  ai_confidence: number | null;
  ai_summary: string | null;
  ai_auto_sent: boolean;
  admin_reply: string | null;
  admin_reply_at: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  new: 'New',
  needs_review: 'Needs Review',
  ai_handled: 'AI Replied',
  replied: 'Replied',
  spam: 'Spam',
};

const STATUS_STYLE: Record<string, string> = {
  new: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  needs_review: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  ai_handled: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  replied: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  spam: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
};

const CLASS_ICON: Record<string, string> = {
  booking_inquiry: '📅',
  general_question: '❓',
  complaint: '😤',
  spam: '🚫',
  other: '💬',
};

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'New', value: 'new' },
  { label: 'Needs Review', value: 'needs_review' },
  { label: 'AI Replied', value: 'ai_handled' },
  { label: 'Replied', value: 'replied' },
  { label: 'Spam', value: 'spam' },
];

export default function AdminInboxPage() {
  const { siteId } = useAdminContext();
  const router = useRouter();

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  const fetchSubmissions = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ siteId, status: statusFilter, page: String(page) });
      const res = await fetch(`/api/contact/inbox?${params}`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setSubmissions(data.submissions);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [siteId, statusFilter, page]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  if (!siteId) return null;

  const totalPages = Math.ceil(total / 40);

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Inbox className="w-4 h-4" />
            Contact Inbox
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">{total} total message{total !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={fetchSubmissions}
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          aria-label="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === f.value
                ? 'bg-slate-900 text-white'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        {loading && !submissions.length ? (
          <div className="text-center py-12 text-slate-400 text-sm">Loading…</div>
        ) : submissions.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
            <Mail className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No messages here yet.</p>
          </div>
        ) : (
          submissions.map(sub => (
            <button
              key={sub.id}
              onClick={() => router.push(`/admin/inbox/${sub.id}?siteId=${siteId}`)}
              className={`w-full text-left rounded-xl border bg-white p-4 hover:border-slate-300 hover:shadow-sm transition-all ${
                sub.status === 'new' || sub.status === 'needs_review'
                  ? 'border-slate-300 shadow-sm'
                  : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${STATUS_STYLE[sub.status]}`}>
                      {sub.status === 'ai_handled' && <Bot className="w-3 h-3 mr-1" />}
                      {sub.status === 'replied' && <User className="w-3 h-3 mr-1" />}
                      {STATUS_LABEL[sub.status] ?? sub.status}
                    </span>
                    {sub.ai_classification && sub.ai_classification !== 'spam' && (
                      <span className="text-[11px] text-slate-400">
                        {CLASS_ICON[sub.ai_classification] ?? '💬'} {sub.ai_classification.replace('_', ' ')}
                      </span>
                    )}
                    <span className="text-xs font-semibold text-slate-800 truncate">
                      {sub.sender_name}
                    </span>
                    <span className="text-xs text-slate-400 truncate">{sub.sender_email}</span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2">
                    {sub.ai_summary || sub.message.slice(0, 160)}
                  </p>
                </div>
                <time className="shrink-0 text-[11px] text-slate-400 mt-0.5">
                  {new Date(sub.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                </time>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <button onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 font-medium transition-colors">
                Prev
              </button>
            )}
            {page < totalPages && (
              <button onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 font-medium transition-colors">
                Next
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
