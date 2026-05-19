'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Upload, Trash2, Copy, Check, FileText, Film,
  ImageIcon, AlertTriangle, X, Loader2, FileImage,
  ExternalLink, RefreshCw, Info,
} from 'lucide-react';
import { useAdminContext } from '../admin-context';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MediaItem {
  id:           string;
  site_id:      string;
  storage_path: string;
  public_url:   string;
  file_name:    string;
  media_type:   'image' | 'pdf' | 'video';
  mime_type:    string;
  size_bytes:   number;
  created_at:   string;
}

interface DeleteState {
  item:   MediaItem;
  stage:  'confirm' | 'inUse';
  usages: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

const ACCEPT = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
  'image/x-icon', 'image/vnd.microsoft.icon',
  'application/pdf',
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
].join(',');

// ─── Sub-components ───────────────────────────────────────────────────────────

function StorageBar({
  usedBytes,
  limitMb,
}: {
  usedBytes: number;
  limitMb:   number;
}) {
  const limitBytes = limitMb * 1024 * 1024;
  const pct = (usedBytes / limitBytes) * 100;
  const isOverLimit = usedBytes > limitBytes;
  const barColor = isOverLimit ? 'bg-red-600'
    : pct >= 90 ? 'bg-red-500'
    : pct >= 70 ? 'bg-amber-400'
    : 'bg-emerald-500';
  const overageBytes = usedBytes - limitBytes;

  return (
    <div className={`border rounded-xl p-4 ${isOverLimit ? 'bg-red-50 border-red-300' : 'bg-white border-slate-200'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-slate-700">Storage</span>
        <span className={`text-xs ${isOverLimit ? 'text-red-600 font-bold' : 'text-slate-500'}`}>
          {formatBytes(usedBytes)} / {formatBytes(limitBytes)}
          {isOverLimit && ` (+${formatBytes(overageBytes)} over)`}
        </span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      {isOverLimit && (
        <div className="mt-3 p-2.5 bg-red-100 border border-red-200 rounded-lg">
          <p className="text-xs text-red-700 font-bold flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Storage limit exceeded — uploads are blocked
          </p>
          <p className="text-xs text-red-600 mt-1">
            You are {formatBytes(overageBytes)} over your {formatBytes(limitBytes)} limit.
            Delete unused files or upgrade your plan to resume uploading.
          </p>
        </div>
      )}
      {!isOverLimit && pct >= 90 && (
        <p className="mt-2 text-xs text-red-600 font-medium flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" />
          Storage nearly full — delete unused files or upgrade your plan.
        </p>
      )}
    </div>
  );
}

function MediaCard({
  item,
  onDelete,
}: {
  item:     MediaItem;
  onDelete: (item: MediaItem) => void;
}) {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    navigator.clipboard.writeText(item.public_url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const thumb =
    item.media_type === 'image' ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.public_url}
        alt={item.file_name}
        className="w-full h-full object-cover"
        loading="lazy"
      />
    ) : item.media_type === 'video' ? (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 gap-1">
        <Film className="w-8 h-8 text-slate-300" />
        <span className="text-[10px] text-slate-400 uppercase font-bold">
          {item.mime_type.split('/')[1]}
        </span>
      </div>
    ) : (
      <div className="w-full h-full flex flex-col items-center justify-center bg-red-50 gap-1">
        <FileText className="w-8 h-8 text-red-400" />
        <span className="text-[10px] text-red-400 uppercase font-bold">PDF</span>
      </div>
    );

  return (
    <div className="group relative bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 hover:shadow-md transition-all">
      {/* Thumbnail */}
      <div className="aspect-square bg-slate-100 overflow-hidden">{thumb}</div>

      {/* Overlay actions — appear on hover */}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        <button
          onClick={copyLink}
          title="Copy public link"
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-slate-700 hover:bg-slate-100 transition-colors shadow"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
        </button>
        <a
          href={item.public_url}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in new tab"
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-slate-700 hover:bg-slate-100 transition-colors shadow"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
        <button
          onClick={() => onDelete(item)}
          title="Delete"
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-red-500 hover:bg-red-50 transition-colors shadow"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Footer */}
      <div className="px-2.5 py-2 border-t border-slate-100">
        <p className="text-xs font-medium text-slate-700 truncate" title={item.file_name}>
          {item.file_name}
        </p>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-[11px] text-slate-400">{formatBytes(item.size_bytes)}</span>
          <span className="text-[11px] text-slate-400">{formatDate(item.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

function UploadZone({
  onFiles,
  uploading,
}: {
  onFiles:   (files: File[]) => void;
  uploading: boolean;
}) {
  const inputRef  = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFiles(files);
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !uploading && inputRef.current?.click()}
      className={`relative flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all select-none ${
        dragOver
          ? 'border-red-400 bg-red-50'
          : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100'
      } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        onChange={e => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = '';
        }}
      />
      {uploading ? (
        <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
      ) : (
        <Upload className={`w-8 h-8 ${dragOver ? 'text-red-500' : 'text-slate-400'}`} />
      )}
      <div className="text-center">
        <p className="text-sm font-bold text-slate-700">
          {uploading ? 'Uploading…' : 'Drop files here or click to browse'}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          Images (JPEG, PNG, WebP, GIF, AVIF) · PDFs · Videos (MP4, WebM, MOV)
        </p>
        <p className="text-xs text-slate-400">
          Max: 10 MB images · 50 MB PDFs · 10 MB videos (60s max)
        </p>
      </div>
    </div>
  );
}

function DeleteModal({
  state,
  onCancel,
  onConfirm,
  deleting,
}: {
  state:     DeleteState;
  onCancel:  () => void;
  onConfirm: (force: boolean) => void;
  deleting:  boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        {state.stage === 'inUse' ? (
          <>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-black text-slate-900">File is in use</h3>
                <p className="text-sm text-slate-600 mt-1">
                  <strong>{state.item.file_name}</strong> is currently referenced in:
                </p>
                <ul className="mt-2 space-y-0.5">
                  {state.usages.map((u, i) => (
                    <li key={i} className="text-sm text-slate-700 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {u}
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-slate-500 mt-3">
                  Deleting it will break those references. Are you sure?
                </p>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => onConfirm(true)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete Anyway
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-black text-slate-900">Delete file?</h3>
                <p className="text-sm text-slate-600 mt-1">
                  <strong>{state.item.file_name}</strong> ({formatBytes(state.item.size_bytes)}) will be
                  permanently deleted and the public link will stop working.
                </p>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => onConfirm(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type FilterType = 'all' | 'image' | 'pdf' | 'video';

export default function MediaPage() {
  const { siteId } = useAdminContext();

  const [media,        setMedia]        = useState<MediaItem[]>([]);
  const [usedBytes,    setUsedBytes]    = useState(0);
  const [limitMb,      setLimitMb]      = useState(1024);
  const [loading,      setLoading]      = useState(true);
  const [filter,       setFilter]       = useState<FilterType>('all');
  const [uploading,    setUploading]    = useState(false);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [deleteState,  setDeleteState]  = useState<DeleteState | null>(null);
  const [deleting,     setDeleting]     = useState(false);

  const fetchMedia = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/sites/media?siteId=${siteId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setMedia(data.media ?? []);
      setUsedBytes(data.storageUsedBytes ?? 0);
      setLimitMb(data.storageLimitMb ?? 1024);
    } catch {
      // silent — grid just stays empty
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { fetchMedia(); }, [fetchMedia]);

  async function handleFiles(files: File[]) {
    if (!siteId) return;
    setUploading(true);
    setUploadErrors([]);

    const errors: string[] = [];
    const newItems: MediaItem[] = [];

    for (const file of files) {
      const fd = new FormData();
      fd.append('file',   file);
      fd.append('siteId', siteId);

      try {
        const res = await fetch('/api/sites/media', {
          method: 'POST',
          body: fd,
          credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) {
          errors.push(`${file.name}: ${data.error ?? 'Upload failed'}`);
        } else {
          newItems.push(data.media);
        }
      } catch {
        errors.push(`${file.name}: Network error`);
      }
    }

    if (newItems.length > 0) {
      setMedia(prev => [...newItems, ...prev]);
      const addedBytes = newItems.reduce((s, m) => s + m.size_bytes, 0);
      setUsedBytes(prev => prev + addedBytes);
    }
    if (errors.length > 0) setUploadErrors(errors);
    setUploading(false);
  }

  function startDelete(item: MediaItem) {
    setDeleteState({ item, stage: 'confirm', usages: [] });
  }

  async function confirmDelete(force: boolean) {
    if (!deleteState || !siteId) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/sites/media', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mediaId: deleteState.item.id, siteId, force }),
      });
      const data = await res.json();

      if (res.status === 409 && data.inUse) {
        // Show the "in use" warning stage
        setDeleteState(prev => prev ? { ...prev, stage: 'inUse', usages: data.usages } : null);
        return;
      }

      if (!res.ok) {
        setUploadErrors([data.error ?? 'Delete failed']);
        setDeleteState(null);
        return;
      }

      setMedia(prev => prev.filter(m => m.id !== deleteState.item.id));
      setUsedBytes(prev => Math.max(0, prev - deleteState.item.size_bytes));
      setDeleteState(null);
    } catch {
      setUploadErrors(['Network error — please try again.']);
      setDeleteState(null);
    } finally {
      setDeleting(false);
    }
  }

  const filtered = filter === 'all' ? media : media.filter(m => m.media_type === filter);

  const counts = {
    all:   media.length,
    image: media.filter(m => m.media_type === 'image').length,
    pdf:   media.filter(m => m.media_type === 'pdf').length,
    video: media.filter(m => m.media_type === 'video').length,
  };

  const FILTERS: { key: FilterType; label: string; icon: React.ReactNode }[] = [
    { key: 'all',   label: 'All',    icon: <FileImage className="w-3.5 h-3.5" /> },
    { key: 'image', label: 'Images', icon: <ImageIcon   className="w-3.5 h-3.5" /> },
    { key: 'pdf',   label: 'PDFs',   icon: <FileText    className="w-3.5 h-3.5" /> },
    { key: 'video', label: 'Videos', icon: <Film        className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900">Media Library</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Upload and manage your images, PDFs, and videos. Copy links to reference them anywhere on your site.
          </p>
        </div>
        <button
          onClick={fetchMedia}
          disabled={loading}
          title="Refresh"
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Storage bar */}
      <StorageBar usedBytes={usedBytes} limitMb={limitMb} />

      {/* Upload zone */}
      {usedBytes > limitMb * 1024 * 1024 ? (
        <div className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-red-300 rounded-xl p-8 bg-red-50/50">
          <AlertTriangle className="w-8 h-8 text-red-400" />
          <p className="text-sm font-bold text-red-600">Uploads blocked — storage limit exceeded</p>
          <p className="text-xs text-red-500">Delete files or upgrade your plan to upload more.</p>
        </div>
      ) : (
        <UploadZone onFiles={handleFiles} uploading={uploading} />
      )}

      {/* Upload errors */}
      {uploadErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-red-700 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              {uploadErrors.length === 1 ? 'Upload failed' : `${uploadErrors.length} uploads failed`}
            </p>
            <button
              onClick={() => setUploadErrors([])}
              className="text-red-400 hover:text-red-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {uploadErrors.map((e, i) => (
            <p key={i} className="text-sm text-red-600">{e}</p>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      {!loading && media.length > 0 && (
        <div className="flex gap-1.5">
          {FILTERS.map(f => (
            counts[f.key] > 0 || f.key === 'all' ? (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filter === f.key
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                {f.icon}
                {f.label}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                  filter === f.key ? 'bg-white/20' : 'bg-slate-100 text-slate-500'
                }`}>
                  {counts[f.key]}
                </span>
              </button>
            ) : null
          ))}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 gap-3">
          <FileImage className="w-10 h-10 text-slate-300" />
          <div>
            <p className="font-bold text-slate-500">
              {filter !== 'all' ? `No ${filter}s uploaded yet` : 'No files uploaded yet'}
            </p>
            <p className="text-sm mt-0.5">Upload files above to see them here.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map(item => (
            <MediaCard key={item.id} item={item} onDelete={startDelete} />
          ))}
        </div>
      )}

      {/* Delete modal */}
      {deleteState && (
        <DeleteModal
          state={deleteState}
          onCancel={() => setDeleteState(null)}
          onConfirm={confirmDelete}
          deleting={deleting}
        />
      )}
    </div>
  );
}
