'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, Save, Globe, RotateCcw, Loader2, ChevronDown } from 'lucide-react';

interface HistoryEntry {
  id: string;
  event_type: 'save_draft' | 'publish';
  site_title: string | null;
  selected_palette: string | null;
  created_at: string;
}

interface EditHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteId: string;
  onRevert: () => void;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  let relative: string;
  if (diffMins < 1) {
    relative = 'Just now';
  } else if (diffMins < 60) {
    relative = `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    relative = `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays < 7) {
    relative = `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  } else {
    relative = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const fullDate = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  return `${relative} · ${fullDate} at ${time}`;
}

export default function EditHistoryModal({ isOpen, onClose, siteId, onRevert }: EditHistoryModalProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [reverting, setReverting] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const limit = 20;

  const fetchHistory = useCallback(async (newOffset = 0) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sites/history?siteId=${siteId}&limit=${limit}&offset=${newOffset}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to load history');
        return;
      }
      const data = await res.json();
      if (newOffset === 0) {
        setHistory(data.history);
      } else {
        setHistory(prev => [...prev, ...data.history]);
      }
      setTotal(data.total);
      setOffset(newOffset);
    } catch {
      setError('Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    if (isOpen && siteId) {
      setHistory([]);
      setOffset(0);
      fetchHistory(0);
    }
  }, [isOpen, siteId, fetchHistory]);

  const handleRevert = async (historyId: string) => {
    if (reverting) return;
    setReverting(historyId);
    try {
      const res = await fetch('/api/sites/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ siteId, historyId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to revert');
        return;
      }
      onRevert();
      onClose();
    } catch {
      setError('Failed to revert');
    } finally {
      setReverting(null);
    }
  };

  const hasMore = history.length < total;

  if (!isOpen) return null;

  const modal = (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[99999] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-600" />
            <h2 className="text-lg font-bold text-slate-900">Edit History</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {loading && history.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 font-medium">No history yet</p>
              <p className="text-xs text-slate-400 mt-1">History will appear here after you save or publish.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((entry, index) => (
                <div
                  key={entry.id}
                  className="group flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200"
                >
                  {/* Icon */}
                  <div className={`mt-0.5 shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    entry.event_type === 'publish'
                      ? 'bg-green-100'
                      : 'bg-blue-100'
                  }`}>
                    {entry.event_type === 'publish' ? (
                      <Globe className="w-4 h-4 text-green-600" />
                    ) : (
                      <Save className="w-4 h-4 text-blue-600" />
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold uppercase tracking-wide ${
                        entry.event_type === 'publish'
                          ? 'text-green-700'
                          : 'text-blue-700'
                      }`}>
                        {entry.event_type === 'publish' ? 'Published' : 'Draft Saved'}
                      </span>
                      {index === 0 && (
                        <span className="text-[9px] font-bold bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">
                          LATEST
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatTimestamp(entry.created_at)}
                    </p>
                    {entry.site_title && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate">
                        Title: {entry.site_title}
                      </p>
                    )}
                  </div>

                  {/* Revert button */}
                  {index > 0 && (
                    <button
                      onClick={() => handleRevert(entry.id)}
                      disabled={!!reverting}
                      className="shrink-0 opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-all disabled:opacity-50"
                    >
                      {reverting === entry.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3 h-3" />
                      )}
                      Revert
                    </button>
                  )}
                </div>
              ))}

              {/* Load More */}
              {hasMore && (
                <button
                  onClick={() => fetchHistory(offset + limit)}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                  Load more
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 shrink-0">
          <p className="text-[10px] text-slate-400 text-center">
            Reverting restores your site to the selected snapshot. Your current state is saved before reverting.
          </p>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
