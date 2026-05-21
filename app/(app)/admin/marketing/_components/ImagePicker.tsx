'use client';

import { useEffect, useState, useRef } from 'react';
import { Image as ImageIcon, Upload, Check, Loader2, X } from 'lucide-react';

interface MediaRow {
  id: string;
  public_url: string;
  file_name: string;
  media_type: string;
  mime_type: string;
}

const MAX_IMAGES = 15;
const RECOMMENDED_MIN = 1;

export default function ImagePicker({
  siteId,
  selected,
  onChange,
}: {
  siteId: string | null;
  selected: string[];
  onChange: (urls: string[]) => void;
}) {
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    fetch(`/api/sites/media?siteId=${siteId}`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : { media: [] }))
      .then(d => {
        if (cancelled) return;
        const images = (d.media || []).filter((m: MediaRow) =>
          m.media_type === 'image' || (m.mime_type || '').startsWith('image/'),
        );
        setMedia(images);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [siteId]);

  function toggle(url: string) {
    if (selected.includes(url)) {
      onChange(selected.filter(u => u !== url));
    } else if (selected.length < MAX_IMAGES) {
      onChange([...selected, url]);
    }
  }

  async function handleUpload(file: File) {
    if (!siteId) return;
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('siteId', siteId);
      const res = await fetch('/api/sites/media', {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Upload failed');
        return;
      }
      const row: MediaRow = data.media || data;
      if (row?.public_url) {
        setMedia(prev => [row, ...prev]);
        onChange([...selected, row.public_url]);
      }
    } catch {
      setError('Network error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-violet-600" /> Display ad images
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Google rotates these in your banner ads. Add at least {RECOMMENDED_MIN}; up to {MAX_IMAGES}.
            Best results: 1.91:1 landscape, ≥600×314 px.
          </p>
        </div>
        <span className="text-xs text-slate-500 font-bold">
          {selected.length}/{MAX_IMAGES}
        </span>
      </div>

      {/* Selected strip */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map(url => (
            <div key={url} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-20 h-20 object-cover rounded-md border border-slate-200" />
              <button
                type="button"
                onClick={() => toggle(url)}
                className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow"
                aria-label="Remove"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload + library */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || selected.length >= MAX_IMAGES}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-sm font-bold"
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {uploading ? 'Uploading…' : 'Upload new'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
          }}
        />
        <span className="text-xs text-slate-400">or pick from your media library</span>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* Library grid */}
      <div>
        {loading ? (
          <div className="text-xs text-slate-400 py-4 text-center">Loading library…</div>
        ) : media.length === 0 ? (
          <div className="text-xs text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded-lg">
            No images in your library yet. Upload one above.
          </div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-64 overflow-y-auto pr-1">
            {media.map(m => {
              const active = selected.includes(m.public_url);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle(m.public_url)}
                  className={`relative aspect-square rounded-md overflow-hidden border-2 transition-colors ${
                    active ? 'border-emerald-500' : 'border-transparent hover:border-slate-300'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.public_url} alt={m.file_name} className="w-full h-full object-cover" />
                  {active && (
                    <div className="absolute inset-0 bg-emerald-500/30 flex items-center justify-center">
                      <div className="bg-emerald-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
