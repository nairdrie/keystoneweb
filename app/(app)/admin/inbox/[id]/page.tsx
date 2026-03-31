'use client';

import { useState, useEffect, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Bot, User, Send, Loader2, Sparkles, CheckCircle, AlertCircle, Trash2, ShieldAlert, Clock } from 'lucide-react';
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
  ai_draft_reply: string | null;
  ai_auto_sent: boolean;
  admin_reply: string | null;
  admin_reply_at: string | null;
  created_at: string;
}

const STATUS_STYLE: Record<string, string> = {
  new: 'bg-blue-50 text-blue-700',
  needs_review: 'bg-amber-50 text-amber-700',
  ai_handled: 'bg-violet-50 text-violet-700',
  replied: 'bg-emerald-50 text-emerald-700',
  spam: 'bg-slate-100 text-slate-500',
};

const STATUS_LABEL: Record<string, string> = {
  new: 'New',
  needs_review: 'Needs Review',
  ai_handled: 'AI Replied',
  replied: 'Replied',
  spam: 'Spam',
};

export default function InboxDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const siteId = searchParams.get('siteId') ?? '';

  const { refreshInboxUnread } = useAdminContext();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [actioning, setActioning] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function fetchSubmission() {
    const res = await fetch(`/api/contact/${id}?siteId=${siteId}`, { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.submission as Submission | null;
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const found = await fetchSubmission();
        if (cancelled) return;
        if (found) {
          setSubmission(found);
          if (found.status === 'needs_review' && found.ai_draft_reply) {
            setReplyText(found.ai_draft_reply);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (siteId) load();
    return () => { cancelled = true; };
  }, [id, siteId]);

  // Poll while AI analysis is pending (status=new, no classification yet)
  useEffect(() => {
    const aiPending = submission?.status === 'new' && !submission?.ai_classification;
    if (!aiPending || !siteId) return;

    const interval = setInterval(async () => {
      const updated = await fetchSubmission();
      if (updated && (updated.status !== 'new' || updated.ai_classification)) {
        setSubmission(updated);
        if (updated.status === 'needs_review' && updated.ai_draft_reply) {
          setReplyText(updated.ai_draft_reply);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [submission?.status, submission?.ai_classification, id, siteId]);

  async function handleSend() {
    if (!replyText.trim() || !submission) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/contact/${id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ replyText, siteId }),
      });
      if (!res.ok) {
        const err = await res.json();
        setSendError(err.error ?? 'Failed to send');
        return;
      }
      setSent(true);
      setSubmission(prev => prev ? { ...prev, status: 'replied', admin_reply: replyText, admin_reply_at: new Date().toISOString() } : prev);
      refreshInboxUnread();
    } finally {
      setSending(false);
    }
  }

  async function handleMarkSpam() {
    if (!submission) return;
    setActioning(true);
    try {
      await fetch(`/api/contact/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'spam' }),
      });
      refreshInboxUnread();
      router.push(`/admin/inbox?siteId=${siteId}`);
    } finally {
      setActioning(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setActioning(true);
    try {
      await fetch(`/api/contact/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      refreshInboxUnread();
      router.push(`/admin/inbox?siteId=${siteId}`);
    } finally {
      setActioning(false);
      setConfirmDelete(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center text-slate-500 text-sm">
        Message not found.
      </div>
    );
  }

  const canReply = submission.status !== 'replied' && submission.status !== 'spam';
  const alreadyReplied = submission.status === 'replied' || sent;
  const aiPending = submission.status === 'new' && !submission.ai_classification;

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">
      {/* Back + actions row */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => router.push(`/admin/inbox?siteId=${siteId}`)}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Inbox
        </button>

        {submission.status !== 'replied' && (
          <div className="flex items-center gap-2">
            {submission.status !== 'spam' && (
              <button
                onClick={handleMarkSpam}
                disabled={actioning}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 disabled:opacity-50 transition-colors"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                Mark as Spam
              </button>
            )}
            <button
              onClick={handleDelete}
              disabled={actioning}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border disabled:opacity-50 transition-colors ${
                confirmDelete
                  ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'
                  : 'text-slate-600 bg-white border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {confirmDelete ? 'Confirm Delete' : 'Delete'}
            </button>
            {confirmDelete && (
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>

      {/* Message card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Sender header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-slate-900">{submission.sender_name}</span>
              <span className="text-xs text-slate-500">{submission.sender_email}</span>
              {submission.sender_phone && (
                <span className="text-xs text-slate-500">{submission.sender_phone}</span>
              )}
            </div>
            <time className="text-xs text-slate-400 mt-0.5 block">
              {new Date(submission.created_at).toLocaleString('en-CA', {
                month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </time>
          </div>
          <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_STYLE[submission.status]}`}>
            {STATUS_LABEL[submission.status] ?? submission.status}
          </span>
        </div>

        {/* Message body */}
        <div className="px-5 py-4">
          <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{submission.message}</p>
        </div>
      </div>

      {/* AI pending indicator */}
      {aiPending && (
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
          <Clock className="w-4 h-4 animate-pulse" />
          AI analysis is processing — check back in a moment.
        </div>
      )}

      {/* AI triage panel */}
      {(submission.ai_classification || submission.ai_summary) && (
        <div className="bg-violet-50 border border-violet-100 rounded-xl px-5 py-4 space-y-2">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-violet-500" />
            <span className="text-xs font-bold text-violet-700 uppercase tracking-wide">AI Analysis</span>
            {submission.ai_confidence != null && (
              <span className="text-xs text-violet-500 ml-auto">
                {Math.round(submission.ai_confidence * 100)}% confidence
              </span>
            )}
          </div>
          {submission.ai_summary && (
            <p className="text-xs text-violet-800">{submission.ai_summary}</p>
          )}
          {submission.ai_classification && (
            <p className="text-xs text-violet-600 font-medium">
              Category: {submission.ai_classification.replace(/_/g, ' ')}
            </p>
          )}
          {submission.ai_auto_sent && (
            <div className="flex items-center gap-1.5 text-xs text-violet-600 font-medium">
              <CheckCircle className="w-3.5 h-3.5" />
              AI reply was sent automatically
            </div>
          )}
        </div>
      )}

      {/* Existing admin reply (read-only if already sent) */}
      {alreadyReplied && submission.admin_reply && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-5 py-4 space-y-2">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Your Reply</span>
            {submission.admin_reply_at && (
              <span className="text-xs text-emerald-500 ml-auto">
                {new Date(submission.admin_reply_at).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <p className="text-sm text-emerald-900 whitespace-pre-wrap">{submission.admin_reply}</p>
        </div>
      )}

      {/* Reply box */}
      {canReply && !alreadyReplied && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 pt-4 pb-2 border-b border-slate-100 flex items-center gap-2">
            <Send className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-700">Reply to {submission.sender_name}</span>
            {submission.ai_draft_reply && (
              <button
                onClick={() => setReplyText(submission.ai_draft_reply!)}
                className="ml-auto flex items-center gap-1 text-[11px] text-violet-600 hover:text-violet-800 font-medium transition-colors"
              >
                <Sparkles className="w-3 h-3" />
                Use AI draft
              </button>
            )}
          </div>
          <div className="p-4 space-y-3">
            <textarea
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              rows={5}
              placeholder="Type your reply…"
              className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
            />
            {sendError && (
              <div className="flex items-center gap-1.5 text-xs text-red-600">
                <AlertCircle className="w-3.5 h-3.5" />
                {sendError}
              </div>
            )}
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">Sent from contact@keystoneweb.ca on your behalf</p>
              <button
                onClick={handleSend}
                disabled={sending || !replyText.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Send Reply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sent confirmation */}
      {sent && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 font-medium bg-emerald-50 rounded-xl px-4 py-3 border border-emerald-100">
          <CheckCircle className="w-4 h-4" />
          Reply sent successfully.
        </div>
      )}
    </div>
  );
}
