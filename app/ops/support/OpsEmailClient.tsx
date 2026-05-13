'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Inbox as InboxIcon, Send, Trash2, Loader2, Plus, RefreshCw,
  ArrowLeft, CheckCircle2, CircleDot, CircleDashed, MailX, Mail,
  AlertTriangle, FolderOpen, X,
} from 'lucide-react';
import EmailBody from '@/app/components/email/EmailBody';
import EmailSignaturePreview from '@/app/components/email/EmailSignaturePreview';
import OpsComposeModal from './OpsComposeModal';

type Folder = 'open' | 'in_progress' | 'resolved' | 'closed';

const FOLDERS: { id: Folder; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'open',        label: 'Inbox',       icon: InboxIcon },
  { id: 'in_progress', label: 'In Progress', icon: CircleDot },
  { id: 'resolved',    label: 'Resolved',    icon: CheckCircle2 },
  { id: 'closed',      label: 'Closed',      icon: CircleDashed },
];

const STATUS_PILL: Record<string, string> = {
  open:        'text-amber-400 bg-amber-400/10',
  in_progress: 'text-sky-400 bg-sky-400/10',
  resolved:    'text-emerald-400 bg-emerald-400/10',
  closed:      'text-gray-500 bg-gray-800',
};

const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'text-red-400',
  high:   'text-orange-400',
  normal: '',
  low:    'text-gray-600',
};

const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
const STATUSES: Folder[] = ['open', 'in_progress', 'resolved', 'closed'];

interface ThreadSummary {
  id: string;
  fromEmail: string;
  fromName: string | null;
  subject: string | null;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  messageCount: number;
  hasReplies: boolean;
  snippet: string;
}

interface ThreadMessage {
  id: string;
  from_email: string;
  from_name: string | null;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  created_at: string;
  thread_id: string | null;
}

interface TicketDetail {
  id: string;
  from_email: string;
  from_name: string | null;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  status: string;
  priority: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  thread_id: string | null;
  thread_messages?: ThreadMessage[];
}

interface Counts {
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
  all: number;
}

interface Props {
  availableFromEmails: string[];
  senderName: string;
  scopedTo: string | null;
  isAdmin: boolean;
}

/** Strip the hidden thread ref token so it doesn't show up in the body preview. */
function cleanBody(text: string | null): string | null {
  if (!text) return text;
  return text.replace(/\n*ref:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\s*$/i, '').trimEnd();
}

function senderInitial(name: string | null, email: string) {
  const src = (name && name.trim()) || email;
  return (src[0] ?? '?').toUpperCase();
}

export default function OpsEmailClient({ availableFromEmails, senderName, scopedTo, isAdmin }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialFolder = (searchParams.get('status') as Folder) || 'open';
  const initialId = searchParams.get('id');

  const [folder, setFolder] = useState<Folder>(
    STATUSES.includes(initialFolder as Folder) ? (initialFolder as Folder) : 'open'
  );
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [searchInput, setSearchInput] = useState(searchParams.get('q') ?? '');
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [counts, setCounts] = useState<Counts>({ open: 0, in_progress: 0, resolved: 0, closed: 0, all: 0 });
  const [loading, setLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(initialId);
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [showFolderDrawer, setShowFolderDrawer] = useState(false);

  // Reply composer state
  const [replyBody, setReplyBody] = useState('');
  const [replySenderIndex, setReplySenderIndex] = useState(0);
  const [replySending, setReplySending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  // Internal notes
  const [notes, setNotes] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);

  const replyOptions = useMemo(
    () => availableFromEmails.map((email) => ({ email, name: senderName || email })),
    [availableFromEmails, senderName]
  );

  // Sync URL when folder / active thread / search changes
  useEffect(() => {
    const p = new URLSearchParams();
    if (folder !== 'open') p.set('status', folder);
    if (activeId) p.set('id', activeId);
    if (search) p.set('q', search);
    const qs = p.toString();
    router.replace(`/support${qs ? `?${qs}` : ''}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, activeId, search]);

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ status: folder });
      if (search) p.set('q', search);
      const res = await fetch(`/api/ops/support/threads?${p.toString()}`, { credentials: 'include' });
      if (!res.ok) return;
      const d = await res.json();
      setThreads(d.threads ?? []);
      setCounts(d.counts ?? { open: 0, in_progress: 0, resolved: 0, closed: 0, all: 0 });
    } finally {
      setLoading(false);
    }
  }, [folder, search]);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  // Load the active ticket
  useEffect(() => {
    if (!activeId) { setTicket(null); return; }
    let cancelled = false;
    setTicketLoading(true);
    setReplyBody('');
    setReplyError(null);
    fetch(`/api/ops/support/${activeId}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        setTicket(d);
        setNotes(d?.notes ?? '');
      })
      .finally(() => { if (!cancelled) setTicketLoading(false); });
    return () => { cancelled = true; };
  }, [activeId]);

  useEffect(() => {
    if (!showFolderDrawer) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowFolderDrawer(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showFolderDrawer]);

  function openThread(id: string) { setActiveId(id); }
  function closeThread() { setActiveId(null); setTicket(null); }

  function switchFolder(f: Folder) {
    closeThread();
    setFolder(f);
    setShowFolderDrawer(false);
  }

  async function patchTicket(patch: Partial<TicketDetail>) {
    if (!activeId) return;
    const res = await fetch(`/api/ops/support/${activeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const updated = await res.json();
      setTicket((prev) => (prev ? { ...prev, ...updated } : updated));
      fetchThreads();
    }
  }

  async function saveNotes() {
    setNotesSaving(true);
    try {
      await patchTicket({ notes });
    } finally {
      setNotesSaving(false);
    }
  }

  async function deleteThread() {
    if (!activeId) return;
    if (!window.confirm('Delete this conversation? This cannot be undone.')) return;
    const res = await fetch(`/api/ops/support/${activeId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      closeThread();
      fetchThreads();
    }
  }

  async function sendReply() {
    if (!activeId || !replyBody.trim()) return;
    const sender = replyOptions[replySenderIndex];
    if (!sender) { setReplyError('No sender available.'); return; }
    setReplySending(true);
    setReplyError(null);
    try {
      const res = await fetch(`/api/ops/support/${activeId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fromEmail: sender.email,
          fromName: sender.name,
          bodyText: replyBody,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setReplyError(json.error || 'Failed to send reply.');
        return;
      }
      setReplyBody('');
      // Reload the ticket + list so the new reply shows up
      const refreshed = await fetch(`/api/ops/support/${activeId}`, { credentials: 'include' });
      if (refreshed.ok) {
        const d = await refreshed.json();
        setTicket(d);
        setNotes(d.notes ?? '');
      }
      fetchThreads();
    } catch {
      setReplyError('Network error. Please try again.');
    } finally {
      setReplySending(false);
    }
  }

  const threadOpen = !!activeId;
  const threadMessages = ticket?.thread_messages ?? [];
  const hasThread = threadMessages.length > 1;

  function renderFolderItems(mobile = false) {
    return FOLDERS.map((f) => {
      const Icon = f.icon;
      const count = counts[f.id] ?? 0;
      const isActive = folder === f.id;
      return (
        <button
          key={f.id}
          onClick={() => switchFolder(f.id)}
          className={`${mobile ? 'w-full' : ''} flex items-center gap-2 px-3 ${mobile ? 'py-2.5' : 'py-2'} rounded-lg text-sm font-semibold transition-colors ${
            isActive
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          }`}
        >
          <Icon className="w-4 h-4" />
          <span className="flex-1 text-left">{f.label}</span>
          {count > 0 && (
            <span className={`ml-auto text-[11px] font-bold ${isActive ? 'text-emerald-300' : 'text-gray-500'}`}>
              {count}
            </span>
          )}
        </button>
      );
    });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
  }

  function clearSearch() {
    setSearchInput('');
    setSearch('');
  }

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-8 h-[calc(100vh-64px)] flex flex-col bg-gray-950">
      {/* Top bar */}
      <div className="flex-none flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-900 border-b border-gray-800">
        <button
          onClick={() => setShowFolderDrawer(true)}
          className="md:hidden flex items-center gap-1.5 px-2 py-1.5 -ml-1 text-gray-400 hover:bg-gray-800 hover:text-white rounded-lg transition-colors shrink-0 text-[11px] font-bold"
          aria-label="Open folders"
        >
          <FolderOpen className="w-4 h-4" />
          Folders
        </button>

        <button
          onClick={() => setShowCompose(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-500 transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Compose
        </button>

        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-0 flex items-center gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by sender, subject, or content…"
            className="flex-1 min-w-0 rounded-md border border-gray-800 bg-gray-900 px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
          />
          {search && (
            <button
              type="button"
              onClick={clearSearch}
              className="text-[11px] text-gray-500 hover:text-white shrink-0"
            >
              Clear
            </button>
          )}
        </form>

        {!isAdmin && scopedTo && (
          <span className="hidden md:inline text-[11px] text-violet-400 font-mono shrink-0" title="Agent scope">
            {scopedTo}
          </span>
        )}

        <button
          onClick={() => fetchThreads()}
          className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors shrink-0"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Three-pane layout */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Folder sidebar — desktop */}
        <aside className="hidden md:flex w-48 flex-none flex-col bg-gray-900 border-r border-gray-800 py-2 px-2 space-y-0.5">
          {renderFolderItems()}
        </aside>

        {/* Mobile folder drawer */}
        <div
          className={`md:hidden fixed inset-0 z-40 transition-opacity ${
            showFolderDrawer ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          aria-hidden={!showFolderDrawer}
        >
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowFolderDrawer(false)} />
          <aside
            role="dialog"
            aria-label="Folders"
            className={`absolute inset-y-0 left-0 w-64 max-w-[80%] bg-gray-950 border-r border-gray-800 shadow-xl flex flex-col transition-transform duration-200 ease-out ${
              showFolderDrawer ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <span className="text-sm font-bold text-white">Folders</span>
              <button
                onClick={() => setShowFolderDrawer(false)}
                className="p-1.5 -mr-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
              {renderFolderItems(true)}
            </nav>
          </aside>
        </div>

        {/* Thread list pane */}
        <section
          className={`min-w-0 flex-col bg-gray-950 border-r border-gray-800 ${
            threadOpen ? 'hidden md:flex md:w-[380px] flex-none' : 'flex flex-1'
          }`}
        >
          <div className="flex-none px-4 py-2 border-b border-gray-800 flex items-center justify-between text-[11px] text-gray-500">
            <span className="font-semibold uppercase tracking-wide">
              {FOLDERS.find((f) => f.id === folder)?.label}
            </span>
            <span>{threads.length} {threads.length === 1 ? 'conversation' : 'conversations'}</span>
          </div>

          {loading && threads.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
            </div>
          ) : threads.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12">
              <Mail className="w-10 h-10 text-gray-700 mb-3" />
              <p className="text-sm text-gray-500 font-medium">
                {search
                  ? `No results for "${search}".`
                  : folder === 'open'
                    ? 'Inbox is empty.'
                    : `No ${folder.replace('_', ' ')} conversations.`}
              </p>
            </div>
          ) : (
            <ul className="flex-1 overflow-y-auto divide-y divide-gray-800">
              {threads.map((t) => {
                const isActive = t.id === activeId;
                const initial = senderInitial(t.fromName, t.fromEmail);
                return (
                  <li key={t.id} className="relative">
                    <span
                      aria-hidden
                      className={`absolute inset-y-0 left-0 w-1 ${isActive ? 'bg-emerald-400' : 'bg-transparent'}`}
                    />
                    <button
                      onClick={() => openThread(t.id)}
                      className={`relative w-full text-left pl-5 pr-4 py-3 transition-colors ${
                        isActive ? 'bg-gray-900' : 'bg-transparent hover:bg-gray-900/60'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-800 text-gray-300 flex items-center justify-center text-xs font-bold shrink-0">
                          {initial}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2 mb-0.5">
                            <span className="text-sm font-semibold text-white truncate">
                              {t.fromName || t.fromEmail}
                            </span>
                            {t.messageCount > 1 && (
                              <span className="text-[10px] text-gray-500">({t.messageCount})</span>
                            )}
                            <time className="ml-auto shrink-0 text-[11px] text-gray-500">
                              {new Date(t.lastMessageAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                            </time>
                          </div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded ${STATUS_PILL[t.status] ?? STATUS_PILL.open}`}>
                              {t.status.replace('_', ' ')}
                            </span>
                            {t.priority !== 'normal' && (
                              <span className={`text-[10px] font-semibold ${PRIORITY_LABEL[t.priority] ?? ''}`}>
                                ● {t.priority}
                              </span>
                            )}
                            <span className="text-xs text-gray-300 truncate">
                              {t.subject || '(no subject)'}
                            </span>
                          </div>
                          {t.snippet && (
                            <p className="text-xs text-gray-500 line-clamp-2">{t.snippet}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Thread detail pane */}
        {threadOpen && (
          <section className="flex-1 min-w-0 flex flex-col bg-gray-950">
            {ticketLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
              </div>
            ) : !ticket ? (
              <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
                Conversation not found.
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col">
                {/* Header */}
                <header className="flex-none px-4 sm:px-6 py-3 bg-gray-900 border-b border-gray-800 flex items-center gap-3">
                  <button
                    onClick={closeThread}
                    className="md:hidden p-1.5 -ml-1 text-gray-400 hover:text-white rounded-lg"
                    aria-label="Back"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm sm:text-base font-bold text-white truncate">
                      {ticket.subject || '(no subject)'}
                    </h2>
                    <p className="text-xs text-gray-500 truncate">
                      {ticket.thread_messages?.length || 1} message{(ticket.thread_messages?.length || 1) !== 1 ? 's' : ''}
                      {' · '}
                      {ticket.from_name ? `${ticket.from_name} <${ticket.from_email}>` : ticket.from_email}
                    </p>
                  </div>

                  <select
                    value={ticket.status}
                    onChange={(e) => patchTicket({ status: e.target.value })}
                    className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-[11px] text-white focus:outline-none focus:border-gray-500"
                    title="Status"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s.replace('_', ' ')}</option>
                    ))}
                  </select>
                  <select
                    value={ticket.priority}
                    onChange={(e) => patchTicket({ priority: e.target.value })}
                    className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-[11px] text-white focus:outline-none focus:border-gray-500"
                    title="Priority"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <button
                    onClick={deleteThread}
                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Delete thread"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </header>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3">
                  {hasThread ? (
                    threadMessages.map((m) => {
                      const isRoot = !m.thread_id;
                      const bodyClean = cleanBody(m.body_text);
                      return (
                        <article
                          key={m.id}
                          className={`rounded-xl border p-4 overflow-hidden ${
                            isRoot
                              ? 'border-gray-800 bg-gray-900'
                              : 'border-emerald-900/40 bg-emerald-950/10 ml-0 sm:ml-4'
                          }`}
                        >
                          <header className="flex items-start gap-3 mb-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                              isRoot ? 'bg-gray-800 text-gray-300' : 'bg-emerald-500/15 text-emerald-300'
                            }`}>
                              {senderInitial(m.from_name, m.from_email)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <span className="text-sm font-bold text-white">
                                  {m.from_name || m.from_email}
                                </span>
                                {m.from_name && (
                                  <span className="text-xs text-gray-500">&lt;{m.from_email}&gt;</span>
                                )}
                                {!isRoot && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-bold uppercase tracking-wide">
                                    You
                                  </span>
                                )}
                                <time className="ml-auto text-[11px] text-gray-500 shrink-0">
                                  {new Date(m.created_at).toLocaleString('en-CA', {
                                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                                  })}
                                </time>
                              </div>
                            </div>
                          </header>
                          <EmailBody
                            html={m.body_html}
                            text={bodyClean}
                            className="text-gray-300"
                            emptyLabel="(no content)"
                          />
                        </article>
                      );
                    })
                  ) : (
                    <article className="rounded-xl border border-gray-800 bg-gray-900 p-4 overflow-hidden">
                      <EmailBody
                        html={ticket.body_html}
                        text={cleanBody(ticket.body_text)}
                        className="text-gray-300"
                        emptyLabel="No message body."
                      />
                    </article>
                  )}

                  {/* Internal notes inline below messages */}
                  <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[11px] font-bold uppercase tracking-wide text-amber-400">
                        Internal Notes
                      </span>
                      {notes !== (ticket.notes ?? '') && (
                        <span className="text-[10px] text-gray-500 italic">unsaved</span>
                      )}
                    </div>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      placeholder="Notes for yourself or the team…"
                      className="w-full rounded-md border border-gray-800 bg-gray-950 px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-600 resize-y"
                    />
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={saveNotes}
                        disabled={notesSaving || notes === (ticket.notes ?? '')}
                        className="rounded-md bg-gray-800 px-3 py-1 text-[11px] font-semibold text-white hover:bg-gray-700 transition-colors disabled:opacity-40"
                      >
                        {notesSaving ? 'Saving…' : 'Save notes'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Reply box */}
                <div className="flex-none border-t border-gray-800 bg-gray-900 p-4 sm:p-5 flex flex-col max-h-[55vh] min-h-0">
                  {replyOptions.length === 0 ? (
                    <p className="text-xs text-gray-500">
                      No sender email assigned to your account. Contact an admin to reply.
                    </p>
                  ) : (
                    <>
                      <div className="flex-none flex items-center gap-2 mb-2 flex-wrap">
                        <Send className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-xs font-bold text-gray-300">Reply</span>
                        <span className="text-[11px] text-gray-500">as</span>
                        <select
                          value={replySenderIndex}
                          onChange={(e) => setReplySenderIndex(Number(e.target.value))}
                          disabled={replySending}
                          className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-[11px] text-white focus:outline-none focus:border-gray-500"
                        >
                          {replyOptions.map((opt, i) => (
                            <option key={opt.email} value={i}>
                              {opt.name} &lt;{opt.email}&gt;
                            </option>
                          ))}
                        </select>
                      </div>

                      <textarea
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        rows={6}
                        placeholder={`Reply to ${ticket.from_name || ticket.from_email}…`}
                        disabled={replySending}
                        className="flex-1 min-h-[100px] w-full rounded-md border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600 resize-y"
                      />

                      <div className="mt-2">
                        <p className="text-[11px] font-medium text-gray-500 mb-1">Signature preview</p>
                        <EmailSignaturePreview
                          senderName={replyOptions[replySenderIndex]?.name ?? ''}
                          fromEmail={replyOptions[replySenderIndex]?.email ?? ''}
                        />
                      </div>

                      {replyError && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
                          <AlertTriangle className="w-3.5 h-3.5" /> {replyError}
                        </div>
                      )}

                      <div className="flex-none mt-3 flex justify-end">
                        <button
                          onClick={sendReply}
                          disabled={replySending || !replyBody.trim()}
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                        >
                          {replySending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          Send reply
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Empty detail pane placeholder (desktop only) */}
        {!threadOpen && (
          <section className="hidden md:flex flex-1 min-w-0 items-center justify-center bg-gray-950 text-gray-600 text-sm">
            <div className="flex flex-col items-center gap-2">
              <MailX className="w-8 h-8 text-gray-800" />
              <span>Select a conversation to read.</span>
            </div>
          </section>
        )}
      </div>

      {showCompose && (
        <OpsComposeModal
          availableFromEmails={availableFromEmails}
          senderName={senderName}
          onClose={() => setShowCompose(false)}
          onSent={() => { setShowCompose(false); fetchThreads(); }}
        />
      )}
    </div>
  );
}
