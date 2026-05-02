'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Mail, Inbox as InboxIcon, AlertCircle, Send, Trash2,
  Sparkles, Bot, User, Loader2, Plus, Settings,
  ShieldAlert, RefreshCw, ArrowLeft, ChevronDown,
  CornerUpLeft, MailMinus, Menu, X,
} from 'lucide-react';
import { useAdminContext } from '@/app/(app)/admin/admin-context';
import EmailBody from './EmailBody';
import ComposeModal from './ComposeModal';
import EmailSettingsModal from './EmailSettingsModal';
import EmailRichEditor from './EmailRichEditor';

type Folder = 'inbox' | 'needs_review' | 'sent' | 'spam';

interface InboxAddress {
  id: string;
  site_id: string;
  address: string;
  kind: 'kswd_subdomain' | 'custom_domain';
  is_primary: boolean;
  resend_domain_id: string | null;
}

interface ThreadSummary {
  threadId: string;
  addressId: string | null;
  lastMessageAt: string;
  messageCount: number;
  unreadCount: number;
  hasNeedsReview: boolean;
  hasSpam: boolean;
  hasOutbound: boolean;
  hasInboundUnread: boolean;
  participantName: string;
  participantEmails: string[];
  subject: string;
  snippet: string;
  aiSummary: string | null;
  aiClassification: string | null;
  hasAiDraft: boolean;
  sourceType: string;
  metadata: Record<string, unknown> | null;
}

interface ThreadMessage {
  id: string;
  thread_id: string;
  direction: 'inbound' | 'outbound';
  status: string;
  source_type: string;
  sender_name: string;
  sender_email: string;
  subject: string | null;
  message: string;
  body_html: string | null;
  ai_classification: string | null;
  ai_confidence: number | null;
  ai_summary: string | null;
  ai_draft_reply: string | null;
  admin_reply: string | null;
  admin_reply_at: string | null;
  inbox_address_id: string | null;
  from_email: string | null;
  from_name: string | null;
  to_emails: string[];
  cc_emails: string[];
  bcc_emails: string[];
  created_at: string;
  is_read: boolean;
  metadata: Record<string, unknown> | null;
}

const FOLDERS: { id: Folder; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'inbox',        label: 'Inbox',        icon: InboxIcon },
  { id: 'needs_review', label: 'Needs Review', icon: AlertCircle },
  { id: 'sent',         label: 'Sent',         icon: Send },
  { id: 'spam',         label: 'Spam',         icon: ShieldAlert },
];

export default function EmailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { siteId, site, isProUser, refreshInboxUnread } = useAdminContext();

  const initialFolder = (searchParams.get('folder') as Folder) || 'inbox';
  const initialAddressId = searchParams.get('addressId');
  const initialMessageId = searchParams.get('messageId');

  const [folder, setFolder] = useState<Folder>(initialFolder);
  const [addressId, setAddressId] = useState<string | null>(initialAddressId);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({ inbox: 0, needs_review: 0, sent: 0, spam: 0 });
  const [perAddress, setPerAddress] = useState<Record<string, { unread: number; total: number }>>({});
  const [addresses, setAddresses] = useState<InboxAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<ThreadMessage[] | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFolderDrawer, setShowFolderDrawer] = useState(false);
  const [aiDraftsEnabled, setAiDraftsEnabled] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [replyHtml, setReplyHtml] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [ccDraft, setCcDraft] = useState('');
  const [bccDraft, setBccDraft] = useState('');
  const initialRef = useRef({ messageId: initialMessageId, applied: false });
  // Tracks which thread we've already auto-filled with the AI draft, so
  // reopening a thread doesn't overwrite the user's edits.
  const aiPrefilledRef = useRef<Set<string>>(new Set());

  // ── Load addresses + AI setting on mount / siteId change
  useEffect(() => {
    if (!siteId) return;
    fetch(`/api/email/addresses?siteId=${siteId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.addresses) return;
        setAddresses(d.addresses);
        if (!addressId && d.addresses.length > 0) {
          const primary = d.addresses.find((a: InboxAddress) => a.is_primary) ?? d.addresses[0];
          setAddressId(primary.id);
        }
      });
    fetch(`/api/contact/settings?siteId=${siteId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setAiDraftsEnabled(d.ai_replies_enabled !== false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  // ── Sync URL on folder/address/thread changes (preserves siteId)
  useEffect(() => {
    if (!siteId) return;
    const params = new URLSearchParams();
    params.set('siteId', siteId);
    if (folder !== 'inbox') params.set('folder', folder);
    if (addressId) params.set('addressId', addressId);
    if (activeThreadId) params.set('messageId', activeThreadId);
    router.replace(`/admin/inbox?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, folder, addressId, activeThreadId]);

  const fetchThreads = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ siteId, folder });
      if (addressId) params.set('addressId', addressId);
      const res = await fetch(`/api/email/threads?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) return;
      const d = await res.json();
      setThreads(d.threads ?? []);
      setCounts(d.counts ?? {});
      setPerAddress(d.perAddress ?? {});
      if (d.addresses) setAddresses(d.addresses);
    } finally {
      setLoading(false);
    }
  }, [siteId, folder, addressId]);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  useEffect(() => {
    if (!showFolderDrawer) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowFolderDrawer(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showFolderDrawer]);

  // After threads load and we have a deep-linked messageId from a notification,
  // open it once. New notifications send thread_id directly; legacy redirects
  // (/admin/inbox/<rowId>) send a sub-row id, which we resolve to its parent
  // thread by hitting /api/contact/<id>.
  useEffect(() => {
    if (initialRef.current.applied) return;
    const target = initialRef.current.messageId;
    if (!target || threads.length === 0 || !siteId) return;
    initialRef.current.applied = true;

    const hit = threads.find(t => t.threadId === target);
    if (hit) {
      setActiveThreadId(hit.threadId);
      return;
    }

    // The id might be an inbound sub-row in an existing thread — resolve it.
    fetch(`/api/contact/${target}?siteId=${siteId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const resolved = d?.submission?.thread_id ?? target;
        setActiveThreadId(resolved);
      })
      .catch(() => setActiveThreadId(target));
  }, [threads, siteId]);

  // Load active thread messages
  useEffect(() => {
    if (!activeThreadId || !siteId) {
      setActiveMessages(null);
      return;
    }
    let cancelled = false;
    setThreadLoading(true);
    fetch(`/api/email/threads/${activeThreadId}?siteId=${siteId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (cancelled || !d?.messages) return;
        setActiveMessages(d.messages);
        // Pre-fill the AI draft only the first time this thread is opened
        // in this session — re-opens shouldn't clobber edits in progress.
        if (!aiPrefilledRef.current.has(activeThreadId)) {
          aiPrefilledRef.current.add(activeThreadId);
          const lastInbound = [...d.messages].reverse().find((m: ThreadMessage) => m.direction === 'inbound');
          if (lastInbound?.ai_draft_reply) {
            setReplyText(lastInbound.ai_draft_reply);
            setReplyHtml(`<p>${lastInbound.ai_draft_reply.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`);
          }
        }
      })
      .finally(() => { if (!cancelled) setThreadLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThreadId, siteId]);

  // Mark-as-read dwell timer. Only fires if the thread stays open for a
  // few seconds — quick previews and accidental clicks shouldn't clear
  // the unread badge.
  useEffect(() => {
    if (!activeThreadId || !siteId || !activeMessages) return;
    const hasUnread = activeMessages.some(m => m.direction === 'inbound' && !m.is_read);
    if (!hasUnread) return;

    const timer = window.setTimeout(() => {
      fetch(`/api/email/threads/${activeThreadId}?siteId=${siteId}`, {
        method: 'POST',
        credentials: 'include',
      })
        .then(() => {
          // Reflect the read state locally so the row de-emphasizes after the dwell
          setActiveMessages(prev =>
            prev?.map(m => (m.direction === 'inbound' ? { ...m, is_read: true } : m)) ?? null
          );
          refreshInboxUnread();
          fetchThreads();
        })
        .catch(() => {});
    }, 4000);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThreadId, siteId, activeMessages]);

  function clearReplyState() {
    setReplyText('');
    setReplyHtml('');
    setSendError(null);
    setShowCcBcc(false);
    setCcDraft('');
    setBccDraft('');
  }

  function openThread(threadId: string) {
    clearReplyState();
    setActiveThreadId(threadId);
  }

  function closeThread() {
    clearReplyState();
    setActiveThreadId(null);
  }

  async function handleSendReply() {
    if (!activeThreadId || !siteId || !activeMessages) return;
    const lastInbound = [...activeMessages].reverse().find(m => m.direction === 'inbound');
    if (!lastInbound) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/contact/${lastInbound.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          replyHtml: replyHtml || undefined,
          replyText: replyText || undefined,
          siteId,
          addressId,
          ccEmails: ccDraft.split(/[,;]/).map(s => s.trim()).filter(Boolean),
          bccEmails: bccDraft.split(/[,;]/).map(s => s.trim()).filter(Boolean),
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setSendError(d.error ?? 'Failed to send');
        return;
      }
      // Reload thread + list
      clearReplyState();
      await Promise.all([
        fetch(`/api/email/threads/${activeThreadId}?siteId=${siteId}`, { credentials: 'include' })
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d?.messages) setActiveMessages(d.messages); }),
        fetchThreads(),
      ]);
      refreshInboxUnread();
    } finally {
      setSending(false);
    }
  }

  async function handleMarkSpam(threadId: string) {
    if (!siteId) return;
    const targetMessages = activeMessages?.filter(m => m.thread_id === threadId && m.direction === 'inbound') ?? [];
    await Promise.all(targetMessages.map(m =>
      fetch(`/api/contact/${m.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'spam' }),
      })
    ));
    closeThread();
    fetchThreads();
    refreshInboxUnread();
  }

  async function handleMarkUnread(threadId: string) {
    if (!siteId) return;
    // Mark the most recent inbound message as unread so the thread shows
    // up with a "New" pill in the list again.
    const inbound = activeMessages?.filter(m => m.thread_id === threadId && m.direction === 'inbound') ?? [];
    const target = inbound[inbound.length - 1];
    if (!target) return;
    await fetch(`/api/contact/${target.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ is_read: false }),
    });
    closeThread();
    fetchThreads();
    refreshInboxUnread();
  }

  async function handleNotSpam(threadId: string) {
    if (!siteId) return;
    // Restore each inbound message in the thread to a sensible non-spam status:
    // if it has an AI draft, send it back to Needs Review, otherwise New.
    const targetMessages = activeMessages?.filter(m => m.thread_id === threadId && m.direction === 'inbound') ?? [];
    await Promise.all(targetMessages.map(m => {
      const nextStatus = m.ai_draft_reply ? 'needs_review' : 'new';
      return fetch(`/api/contact/${m.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: nextStatus, is_read: false }),
      });
    }));
    closeThread();
    setFolder('inbox');
    fetchThreads();
    refreshInboxUnread();
  }

  async function handleDeleteThread(threadId: string) {
    if (!siteId) return;
    if (!window.confirm('Delete this conversation? This cannot be undone.')) return;
    await fetch(`/api/email/threads/${threadId}?siteId=${siteId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    closeThread();
    fetchThreads();
    refreshInboxUnread();
  }

  async function toggleAiDrafts() {
    if (!siteId) return;
    const next = !aiDraftsEnabled;
    setAiDraftsEnabled(next);
    await fetch('/api/contact/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ siteId, ai_replies_enabled: next }),
    });
  }

  if (!siteId) return null;

  const activeThread = threads.find(t => t.threadId === activeThreadId);
  const activeAddress = addresses.find(a => a.id === addressId);
  const lastInbound = activeMessages ? [...activeMessages].reverse().find(m => m.direction === 'inbound') : null;
  const canReply = !!lastInbound && (lastInbound.status !== 'spam');
  const hasInboundSpam = !!activeMessages?.some(m => m.direction === 'inbound' && m.status === 'spam');

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Address tabs row + actions */}
      <div className="flex-none flex items-center gap-2 px-3 sm:px-4 py-2 bg-white border-b border-slate-200">
        <button
          onClick={() => setShowFolderDrawer(true)}
          className="md:hidden p-2 -ml-1 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
          aria-label="Open folders"
          title="Folders"
        >
          <Menu className="w-4 h-4" />
        </button>

        <button
          onClick={() => setShowCompose(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Compose
        </button>

        <div className="flex-1 overflow-x-auto flex items-center gap-1">
          {addresses.length > 0 && addresses.map(a => {
            const stats = perAddress[a.id] ?? { unread: 0, total: 0 };
            const isActive = addressId === a.id;
            return (
              <button
                key={a.id}
                onClick={() => { setAddressId(a.id); closeThread(); }}
                className={`relative shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                  isActive ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
                title={a.address}
              >
                <span className="font-mono">{a.address}</span>
                {stats.unread > 0 && (
                  <span className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-black px-1 ${
                    isActive ? 'bg-white text-slate-900' : 'bg-red-500 text-white'
                  }`}>
                    {stats.unread > 99 ? '99+' : stats.unread}
                  </span>
                )}
              </button>
            );
          })}
          {addresses.length === 0 && !loading && (
            <span className="text-xs text-slate-400 px-2">No inbox addresses configured</span>
          )}
        </div>

        <button
          onClick={() => fetchThreads()}
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
          aria-label="Refresh"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <button
          onClick={toggleAiDrafts}
          className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all shrink-0 ${
            aiDraftsEnabled
              ? 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100'
              : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'
          }`}
          title={aiDraftsEnabled ? 'AI drafts on — click to disable' : 'AI drafts off — click to enable'}
        >
          <Sparkles className="w-3.5 h-3.5" />
          AI drafts {aiDraftsEnabled ? 'on' : 'off'}
        </button>
        <button
          onClick={() => setShowSettings(true)}
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
          aria-label="Email settings"
          title="Email settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Three-pane layout: folders | thread list | thread detail */}
      <div className="flex-1 min-h-0 flex">
        {/* Folder sidebar */}
        <aside className="hidden md:flex w-52 flex-none flex-col bg-white border-r border-slate-200 py-2 px-2">
          {FOLDERS.map(f => {
            const Icon = f.icon;
            const count = (counts[f.id] ?? 0) as number;
            const unread = f.id === 'inbox'
              ? (counts.inbox_unread ?? 0)
              : f.id === 'needs_review'
                ? (counts.needs_review_unread ?? 0)
                : 0;
            const isActive = folder === f.id;
            return (
              <button
                key={f.id}
                onClick={() => { setFolder(f.id); closeThread(); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                  isActive
                    ? 'bg-red-50 text-red-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="flex-1 text-left">{f.label}</span>
                {unread > 0 ? (
                  <span className="ml-auto min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-black px-1">
                    {unread > 99 ? '99+' : unread}
                  </span>
                ) : count > 0 ? (
                  <span className="ml-auto text-[11px] text-slate-400 font-semibold">{count}</span>
                ) : null}
              </button>
            );
          })}
        </aside>

        {/* Mobile folder drawer */}
        <div
          className={`md:hidden fixed inset-0 z-40 transition-opacity ${
            showFolderDrawer ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          aria-hidden={!showFolderDrawer}
        >
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setShowFolderDrawer(false)}
          />
          <aside
            role="dialog"
            aria-label="Folders"
            className={`absolute inset-y-0 left-0 w-64 max-w-[80%] bg-white shadow-xl flex flex-col transition-transform duration-200 ease-out ${
              showFolderDrawer ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <span className="text-sm font-bold text-slate-900">Folders</span>
              <button
                onClick={() => setShowFolderDrawer(false)}
                className="p-1.5 -mr-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Close folders"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
              {FOLDERS.map(f => {
                const Icon = f.icon;
                const count = (counts[f.id] ?? 0) as number;
                const unread = f.id === 'inbox'
                  ? (counts.inbox_unread ?? 0)
                  : f.id === 'needs_review'
                    ? (counts.needs_review_unread ?? 0)
                    : 0;
                const isActive = folder === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => {
                      setFolder(f.id);
                      closeThread();
                      setShowFolderDrawer(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                      isActive
                        ? 'bg-red-50 text-red-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="flex-1 text-left">{f.label}</span>
                    {unread > 0 ? (
                      <span className="ml-auto min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-black px-1">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    ) : count > 0 ? (
                      <span className="ml-auto text-[11px] text-slate-400 font-semibold">{count}</span>
                    ) : null}
                  </button>
                );
              })}

              <div className="pt-2 mt-2 border-t border-slate-100">
                <button
                  onClick={toggleAiDrafts}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                    aiDraftsEnabled
                      ? 'bg-violet-50 text-violet-700 hover:bg-violet-100'
                      : 'text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span className="flex-1 text-left">AI drafts</span>
                  <span className="text-[11px] font-semibold">{aiDraftsEnabled ? 'On' : 'Off'}</span>
                </button>
              </div>
            </nav>
          </aside>
        </div>

        {/* Thread list pane (hidden on mobile when a thread is open) */}
        <section className={`flex-1 min-w-0 flex flex-col bg-white md:max-w-md md:flex-none lg:max-w-lg border-r border-slate-200 ${activeThreadId ? 'hidden md:flex' : 'flex'}`}>
          {loading && threads.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
            </div>
          ) : threads.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12">
              <Mail className="w-10 h-10 text-slate-300 mb-3" />
              <p className="text-sm text-slate-500 font-medium">
                {folder === 'sent' ? 'No sent messages yet.'
                  : folder === 'spam' ? 'No spam in this folder.'
                  : folder === 'needs_review' ? 'No drafts waiting for review.'
                  : 'Inbox is empty.'}
              </p>
            </div>
          ) : (
            <ul className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {threads.map(t => {
                const isActive = t.threadId === activeThreadId;
                const isUnread = t.hasInboundUnread;
                const isReplied = t.hasOutbound && !isUnread;
                const isSpam = t.hasSpam;
                return (
                  <li key={t.threadId} className="relative">
                    {/* Left accent bar — solid red for unread, transparent otherwise */}
                    <span
                      aria-hidden
                      className={`absolute inset-y-0 left-0 w-1 ${
                        isActive ? 'bg-red-500' : isUnread ? 'bg-red-500' : 'bg-transparent'
                      }`}
                    />
                    <button
                      onClick={() => openThread(t.threadId)}
                      className={`relative w-full text-left pl-5 pr-4 py-3 transition-colors ${
                        isActive ? 'bg-red-50' : 'bg-white hover:bg-slate-50'
                      } ${isSpam ? 'opacity-70' : ''}`}
                    >
                      <div className="flex items-baseline gap-2 mb-1">
                        {/* Unread dot for extra hierarchy when there's no active row */}
                        {isUnread && !isActive && (
                          <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 -ml-2.5 mr-0.5" />
                        )}
                        <span
                          className={`text-sm truncate ${
                            isUnread ? 'font-extrabold text-slate-900' : 'font-medium text-slate-500'
                          }`}
                        >
                          {t.participantName || t.participantEmails[0] || 'Unknown'}
                        </span>
                        {t.messageCount > 1 && (
                          <span className="text-[11px] text-slate-400">({t.messageCount})</span>
                        )}
                        {/* Status pills — at most one shown, in priority order */}
                        {isUnread ? (
                          <span className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-700 rounded-full font-bold uppercase tracking-wide">
                            New
                          </span>
                        ) : t.hasNeedsReview ? (
                          <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded-full font-bold uppercase tracking-wide">
                            Draft
                          </span>
                        ) : isReplied ? (
                          <span className="text-[10px] inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-semibold">
                            <CornerUpLeft className="w-2.5 h-2.5" />
                            Replied
                          </span>
                        ) : isSpam ? (
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full font-bold uppercase tracking-wide">
                            Spam
                          </span>
                        ) : null}
                        <time
                          className={`ml-auto shrink-0 text-[11px] ${
                            isUnread ? 'text-slate-700 font-semibold' : 'text-slate-400'
                          }`}
                        >
                          {new Date(t.lastMessageAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                        </time>
                      </div>
                      <p
                        className={`text-xs truncate mb-0.5 ${
                          isUnread ? 'font-bold text-slate-900' : 'text-slate-500'
                        }`}
                      >
                        {t.subject || '(no subject)'}
                      </p>
                      <p
                        className={`text-xs truncate ${
                          isUnread ? 'text-slate-700' : 'text-slate-400'
                        }`}
                      >
                        {t.snippet || ''}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Thread detail pane */}
        <section className={`flex-1 min-w-0 flex flex-col bg-slate-50 ${activeThreadId ? 'flex' : 'hidden md:flex'}`}>
          {!activeThreadId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 text-sm px-6">
              <Mail className="w-10 h-10 mb-3 text-slate-300" />
              Select a conversation to view it here.
            </div>
          ) : threadLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
            </div>
          ) : !activeMessages ? (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
              Conversation not found.
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col">
              {/* Thread header */}
              <header className="flex-none px-4 sm:px-6 py-3 bg-white border-b border-slate-200 flex items-center gap-3">
                <button
                  onClick={closeThread}
                  className="md:hidden p-1.5 -ml-1 text-slate-500 hover:text-slate-900 rounded-lg"
                  aria-label="Back"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                    {activeThread?.subject || activeMessages[0]?.subject || '(no subject)'}
                  </h2>
                  <p className="text-xs text-slate-500 truncate">
                    {activeMessages.length} message{activeMessages.length !== 1 ? 's' : ''} · {activeThread?.participantEmails?.join(', ')}
                  </p>
                </div>
                {hasInboundSpam ? (
                  <button
                    onClick={() => handleNotSpam(activeThreadId)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                    title="Not spam — move back to Inbox"
                  >
                    <InboxIcon className="w-3.5 h-3.5" />
                    Not spam
                  </button>
                ) : (
                  <>
                    {lastInbound && (
                      <button
                        onClick={() => handleMarkUnread(activeThreadId)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Mark as unread"
                      >
                        <MailMinus className="w-4 h-4" />
                      </button>
                    )}
                    {canReply && (
                      <button
                        onClick={() => handleMarkSpam(activeThreadId)}
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Mark as spam"
                      >
                        <ShieldAlert className="w-4 h-4" />
                      </button>
                    )}
                  </>
                )}
                <button
                  onClick={() => handleDeleteThread(activeThreadId)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete thread"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </header>

              {/* Conversation messages */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3">
                {activeMessages.map((m) => (
                  <article
                    key={m.id}
                    className={`rounded-xl border p-4 ${
                      m.direction === 'outbound'
                        ? 'bg-white border-emerald-100'
                        : m.status === 'spam'
                          ? 'bg-slate-50 border-slate-200'
                          : 'bg-white border-slate-200'
                    }`}
                  >
                    <header className="flex items-start gap-3 mb-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        m.direction === 'outbound' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {m.direction === 'outbound' ? <User className="w-4 h-4" /> : (m.sender_name?.[0] ?? '?').toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-900">
                            {m.direction === 'outbound' ? `You (${m.from_name ?? 'You'})` : m.sender_name}
                          </span>
                          <span className="text-xs text-slate-500">
                            {m.direction === 'outbound'
                              ? `→ ${m.to_emails.join(', ')}`
                              : m.sender_email}
                          </span>
                          <time className="ml-auto text-[11px] text-slate-400 shrink-0">
                            {new Date(m.created_at).toLocaleString('en-CA', {
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </time>
                        </div>
                        {m.cc_emails?.length > 0 && (
                          <p className="text-[11px] text-slate-400">cc: {m.cc_emails.join(', ')}</p>
                        )}
                      </div>
                    </header>

                    <EmailBody
                      html={m.body_html ?? undefined}
                      text={m.message}
                      className="email-body--light text-slate-800"
                      emptyLabel="(no content)"
                    />

                    {m.direction === 'inbound' && m.ai_summary && (
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-start gap-2">
                        <Bot className="w-3.5 h-3.5 text-violet-500 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-violet-700 uppercase tracking-wide">AI Analysis</p>
                          <p className="text-xs text-violet-700">{m.ai_summary}</p>
                          {m.ai_classification && m.ai_confidence != null && (
                            <p className="text-[11px] text-violet-500">
                              {m.ai_classification.replace(/_/g, ' ')} · {Math.round(m.ai_confidence * 100)}% confidence
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </div>

              {/* Reply box */}
              {canReply && (
                <div className="flex-none border-t border-slate-200 bg-white p-4 sm:p-5">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Send className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-bold text-slate-700">
                      Reply from <span className="font-mono">{activeAddress?.address ?? 'your inbox'}</span>
                    </span>
                    {lastInbound?.ai_draft_reply && (
                      <button
                        onClick={() => {
                          setReplyText(lastInbound.ai_draft_reply!);
                          setReplyHtml(`<p>${lastInbound.ai_draft_reply!.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`);
                        }}
                        className="ml-auto flex items-center gap-1 text-[11px] text-violet-600 hover:text-violet-800 font-semibold"
                      >
                        <Sparkles className="w-3 h-3" />
                        Use AI draft
                      </button>
                    )}
                    <button
                      onClick={() => setShowCcBcc(v => !v)}
                      className="text-[11px] text-slate-400 hover:text-slate-700 font-semibold ml-auto"
                    >
                      <ChevronDown className={`w-3 h-3 inline -mt-0.5 transition-transform ${showCcBcc ? 'rotate-180' : ''}`} /> Cc/Bcc
                    </button>
                  </div>

                  {showCcBcc && (
                    <div className="space-y-2 mb-2">
                      <input
                        type="text"
                        placeholder="cc: separate by comma"
                        value={ccDraft}
                        onChange={e => setCcDraft(e.target.value)}
                        className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50"
                      />
                      <input
                        type="text"
                        placeholder="bcc: separate by comma"
                        value={bccDraft}
                        onChange={e => setBccDraft(e.target.value)}
                        className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50"
                      />
                    </div>
                  )}

                  <EmailRichEditor
                    siteId={siteId}
                    value={replyHtml}
                    onChange={(html, text) => { setReplyHtml(html); setReplyText(text); }}
                    placeholder={`Reply to ${lastInbound?.sender_name ?? 'sender'}…`}
                    minHeight={140}
                  />

                  {sendError && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
                      <AlertCircle className="w-3.5 h-3.5" /> {sendError}
                    </div>
                  )}

                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={handleSendReply}
                      disabled={sending || (!replyHtml.trim() && !replyText.trim())}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
                    >
                      {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Send reply
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {showCompose && siteId && (
        <ComposeModal
          siteId={siteId}
          addresses={addresses}
          defaultAddressId={addressId}
          onClose={() => setShowCompose(false)}
          onSent={() => {
            setShowCompose(false);
            setFolder('sent');
            fetchThreads();
          }}
        />
      )}

      {showSettings && siteId && (
        <EmailSettingsModal
          siteId={siteId}
          isProUser={isProUser}
          customDomain={site?.customDomain ?? null}
          aiDraftsEnabled={aiDraftsEnabled}
          onAiDraftsChange={setAiDraftsEnabled}
          onAddressesChanged={(updated) => {
            setAddresses(updated as InboxAddress[]);
            if (!updated.find(a => a.id === addressId)) {
              const primary = updated.find(a => a.is_primary) ?? updated[0];
              setAddressId(primary?.id ?? null);
            }
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
